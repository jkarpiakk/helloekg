/**
 * Trasy szkolenia z punktami edukacyjnymi (/api/szkolenie/…, /api/zaswiadczenia/…, /api/admin/szkolenie/…).
 * Logika: ./serwis.ts. Kursant widzi szkolenie, gdy ustawienie szkolenie_wlaczone = true; zespół zawsze.
 */
import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { attempts, modules, questions, sections, supportTickets } from "@shared/schema";
import { zapisSchema, czescNazwiska, ZAWODY } from "@shared/szkolenie";
import { requireActiveSubscription, requireAdmin, requireKonto, requireOwner } from "../middleware/auth";
import { weryfikacjaRateLimit } from "../middleware/rateLimit";
import { emailService, esc } from "../services/emailService";
import { quizService } from "../services/quizService";
import { ustawienie } from "../ustawienia";
import * as s from "./serwis";
import { pdfZaswiadczenia } from "./pdf";
import { NUMER_WPISU_RE } from "./logika";

const ZESPOL = ["owner", "admin", "reviewer"];
const czyZespol = (req: Request) => !!req.user && ZESPOL.includes(req.user.role);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Szkolenie wyłączone: dla kursanta trasy nie istnieją (404), zespół widzi podgląd */
async function szkolenieDostepne(req: Request, res: Response, next: NextFunction) {
  if (czyZespol(req) || (await ustawienie("szkolenie_wlaczone"))) return next();
  res.status(404).json({ error: "Nie znaleziono" });
}

function blad(res: Response, e: unknown, domyslny: string) {
  if (e instanceof s.BladSzkolenia) return res.status(e.status).json({ error: e.message });
  console.error("[szkolenie]", domyslny, (e as Error)?.message ?? e);
  res.status(500).json({ error: domyslny });
}

const notifyEmail = () => process.env.FEEDBACK_NOTIFY_EMAIL || "kontakt@helloekg.pl";

/** Regulamin szkolenia (szkic): docs/regulamin-szkolenia.md, w produkcji dist/dokumenty */
function plikRegulaminu(): string | null {
  const katalogi = [process.env.DOKUMENTY_DIR, path.resolve(import.meta.dirname, "dokumenty"), path.resolve(process.cwd(), "docs")].filter(Boolean) as string[];
  for (const k of katalogi) {
    const p = path.join(k, "regulamin-szkolenia.md");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return null;
}

const odpowiedzSchema = z.object({ questionId: z.string().regex(UUID_RE), answerIndex: z.number().int().min(0).max(50) });
const oddajSchema = z.object({ odpowiedzi: z.record(z.string(), z.number().int().min(0).max(50)).optional() });
const doProwadzacegoSchema = z.object({ tresc: z.string().trim().min(10, "Napisz co najmniej 10 znaków.").max(5000, "Wiadomość może mieć najwyżej 5000 znaków.") });
const edycjaZapisuSchema = z.object({
  imie: czescNazwiska("imię").optional(),
  nazwisko: czescNazwiska("nazwisko").optional(),
  pwz: z.string().max(40).nullable().optional(),
  specjalizacja: z.string().max(200).nullable().optional(),
  izba: z.string().max(100).nullable().optional(),
  /** Wyjątek od walidacji formatu PWZ (np. PWZ warunkowe): zapis w dzienniku */
  pominWalidacje: z.boolean().optional(),
  powod: z.string().trim().min(3, "Podaj powód zmiany (trafia do dziennika).").max(500),
});
const liczbaLubNull = z.number().min(0).max(1000).nullable();
const regulaSchema = z.object({
  active: z.boolean().optional(),
  legalBasis: z.string().max(1000).nullable().optional(),
  pointsFormula: z.string().max(500).nullable().optional(),
  pointsPerHour: z.number().min(0).max(100).optional(),
  pointsMode: z.enum(["godziny", "decyzja"]).optional(),
  pointsGranted: liczbaLubNull.optional(),
  nrlResolution: z.string().max(200).nullable().optional(),
  formInfoAcceptedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data w formacie RRRR-MM-DD").nullable().optional(),
  decisionNumber: z.string().max(200).nullable().optional(),
  formText: z.string().max(500).nullable().optional(),
  maxPoints: liczbaLubNull.optional(),
  minHours: liczbaLubNull.optional(),
  testRequired: z.boolean().optional(),
  registryRequired: z.boolean().optional(),
  registryNumber: z.string().trim().max(200).nullable().optional()
    .refine((v) => !v || NUMER_WPISU_RE.test(v), "Numer wpisu do rejestru: format RR-NNNNNN-00X-ZZZZ"),
  inactiveReason: z.string().max(1000).nullable().optional(),
});

export function registerSzkolenieRoutes(app: Express) {
  // ── Stan szkolenia (strona /szkolenie) ─────────────────────────────────────
  app.get("/api/szkolenie", requireKonto, async (req, res) => {
    try {
      if (!czyZespol(req) && !(await ustawienie("szkolenie_wlaczone"))) return res.json({ wlaczone: false });
      res.json(await s.stanSzkolenia(req.user!));
    } catch (e) {
      blad(res, e, "Nie udało się wczytać szkolenia");
    }
  });

  app.post("/api/szkolenie/zapis", requireKonto, szkolenieDostepne, requireActiveSubscription, async (req, res) => {
    const p = zapisSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? "Sprawdź dane" });
    try {
      res.json(await s.zapisz(req.user!, p.data));
    } catch (e) {
      blad(res, e, "Nie udało się zapisać na szkolenie");
    }
  });

  // ── Strona modułu: podsumowanie, bibliografia, napisz do prowadzącego ─────
  app.get("/api/szkolenie/moduly/:id", requireKonto, requireActiveSubscription, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Nie znaleziono" });
    const m = await s.modulDoPodsumowania(req.params.id);
    if (!m || (!m.isVisible && !czyZespol(req))) return res.status(404).json({ error: "Nie znaleziono" });
    res.json({
      id: m.id, tytul: m.title, kolejnosc: m.order, szkolenie: m.cme,
      podsumowanieMd: m.summaryMd?.trim() ? m.summaryMd : null,
      bibliografiaMd: m.bibliographyMd?.trim() ? m.bibliographyMd : null,
    });
  });

  app.post("/api/szkolenie/moduly/:id/podsumowanie", requireKonto, requireActiveSubscription, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Nie znaleziono" });
    try {
      const ok = await s.otworzPodsumowanie(req.user!.id, req.params.id);
      if (!ok) return res.status(404).json({ error: "Ten moduł nie ma podsumowania" });
      res.json({ ok: true });
    } catch (e) {
      blad(res, e, "Nie udało się zapisać otwarcia podsumowania");
    }
  });

  app.post("/api/szkolenie/moduly/:id/do-prowadzacego", requireKonto, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Nie znaleziono" });
    const p = doProwadzacegoSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? "Sprawdź wiadomość" });
    try {
      const m = await s.modulDoPodsumowania(req.params.id);
      if (!m || (!m.isVisible && !czyZespol(req))) return res.status(404).json({ error: "Nie znaleziono" });
      const user = req.user!;
      const [{ n }] = await db.select({ n: count() }).from(supportTickets)
        .where(and(eq(supportTickets.userId, user.id), eq(supportTickets.kind, "prowadzacy"), gte(supportTickets.createdAt, new Date(Date.now() - 86_400_000))));
      if (Number(n) >= 10) return res.status(429).json({ error: "Dziś wysłano już 10 wiadomości. Spróbuj jutro albo napisz na kontakt@helloekg.pl." });
      const userName = `${user.firstName} ${user.lastName}`.trim() || user.email;
      const [t] = await db.insert(supportTickets).values({
        kind: "prowadzacy", userId: user.id, userEmail: user.email, userName,
        subject: `Do prowadzącego: ${m.title}`.slice(0, 200), message: p.data.tresc, status: "open",
        pagePath: `/modul/${m.id}`, area: "szkolenie",
      }).returning();
      const base = (process.env.APP_BASE_URL || process.env.FRONTEND_URL || "https://kurs.helloekg.pl").replace(/\/+$/, "");
      emailService.sendEmail(notifyEmail(), {
        subject: `[Do prowadzącego] ${m.title}`,
        html: `<p><b>${esc(userName)}</b> (${esc(user.email)}) pisze w module „${esc(m.title)}”:</p><blockquote style="white-space:pre-wrap">${esc(p.data.tresc)}</blockquote><p><a href="${base}/admin?tab=support">Otwórz w panelu</a></p>`,
        text: `${userName} <${user.email}> pisze w module „${m.title}”:\n\n${p.data.tresc}\n\nPanel: ${base}/admin?tab=support`,
      }).catch((e) => console.error("[szkolenie] mail do prowadzącego:", e?.message));
      res.status(201).json({ id: t.id });
    } catch (e) {
      blad(res, e, "Nie udało się wysłać wiadomości");
    }
  });

  // ── Program i regulamin szkolenia ──────────────────────────────────────────
  app.get("/api/szkolenie/program", requireKonto, async (_req, res) => {
    res.json({ tresc: await s.programSzkolenia() });
  });

  // Regulamin szkolenia: publiczny po publikacji (ustawienie), wcześniej szkic tylko dla właściciela i admina
  app.get("/api/szkolenie/regulamin", async (req, res) => {
    const opublikowany = await ustawienie("regulamin_szkolenia_opublikowany");
    let wolno = opublikowany;
    if (!wolno && req.session?.userId) {
      const { storage } = await import("../storage");
      const u = await storage.getUser(req.session.userId);
      wolno = !!u && !u.suspendedAt && ["owner", "admin"].includes(u.role);
    }
    const tresc = wolno ? plikRegulaminu() : null;
    if (!tresc) return res.status(404).json({ error: "Nie znaleziono" });
    res.json({ tresc, wersja: s.WERSJA_REGULAMINU_SZKOLENIA, szkic: !opublikowany });
  });

  // ── Test zaliczeniowy ──────────────────────────────────────────────────────
  app.get("/api/szkolenie/test", requireKonto, szkolenieDostepne, async (req, res) => {
    try {
      res.json({ ...(await s.stanTestu(req.user!)), otwarte: await s.otwartePodejscie(req.user!) });
    } catch (e) {
      blad(res, e, "Nie udało się wczytać testu");
    }
  });

  app.post("/api/szkolenie/test/start", requireKonto, szkolenieDostepne, requireActiveSubscription, async (req, res) => {
    try {
      res.json(await s.rozpocznijTest(req.user!));
    } catch (e) {
      blad(res, e, "Nie udało się rozpocząć testu");
    }
  });

  app.put("/api/szkolenie/test/:id/odpowiedz", requireKonto, szkolenieDostepne, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Nie znaleziono" });
    const p = odpowiedzSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Nieprawidłowa odpowiedź" });
    try {
      await s.zapiszOdpowiedzTestu(req.user!, req.params.id, p.data.questionId, p.data.answerIndex);
      res.json({ ok: true });
    } catch (e) {
      blad(res, e, "Nie udało się zapisać odpowiedzi");
    }
  });

  app.post("/api/szkolenie/test/:id/oddaj", requireKonto, szkolenieDostepne, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Nie znaleziono" });
    const p = oddajSchema.safeParse(req.body ?? {});
    if (!p.success) return res.status(400).json({ error: "Nieprawidłowe odpowiedzi" });
    try {
      res.json(await s.oddajTest(req.user!, req.params.id, p.data.odpowiedzi));
    } catch (e) {
      blad(res, e, "Nie udało się oddać testu");
    }
  });

  app.get("/api/szkolenie/test/:id/wynik", requireKonto, szkolenieDostepne, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Nie znaleziono" });
    try {
      res.json(await s.wynikPodejscia(req.user!, req.params.id));
    } catch (e) {
      blad(res, e, "Nie udało się wczytać wyniku");
    }
  });

  // ── Ankieta (anonimowa) ────────────────────────────────────────────────────
  app.get("/api/szkolenie/ankieta", requireKonto, szkolenieDostepne, async (req, res) => {
    try {
      res.json(await s.stanAnkiety(req.user!));
    } catch (e) {
      blad(res, e, "Nie udało się wczytać ankiety");
    }
  });

  app.post("/api/szkolenie/ankieta", requireKonto, szkolenieDostepne, async (req, res) => {
    try {
      await s.zapiszAnkiete(req.user!, req.body?.odpowiedzi);
      res.status(201).json({ ok: true });
    } catch (e) {
      blad(res, e, "Nie udało się zapisać ankiety");
    }
  });

  // ── Zaświadczenia ──────────────────────────────────────────────────────────
  app.post("/api/szkolenie/zaswiadczenia", requireKonto, szkolenieDostepne, async (req, res) => {
    const id = req.body?.zapisId;
    if (typeof id !== "string" || !UUID_RE.test(id)) return res.status(400).json({ error: "Wybierz zawód" });
    const rodzaj = req.body?.rodzaj;
    if (rodzaj !== undefined && rodzaj !== "punkty" && rodzaj !== "ukonczenie") return res.status(400).json({ error: "Nieznany rodzaj zaświadczenia" });
    try {
      const c = await s.wydajZaswiadczenie(req.user!, id, rodzaj);
      res.status(201).json(s.widokZaswiadczenia(c));
    } catch (e) {
      blad(res, e, "Nie udało się wydać zaświadczenia");
    }
  });

  // PDF: właściciel zaświadczenia albo zespół (admin, właściciel)
  app.get("/api/szkolenie/zaswiadczenia/:numer/pdf", requireKonto, async (req, res) => {
    try {
      const c = await s.zaswiadczeniePoNumerze(req.params.numer);
      const wolno = c && (c.participantId === req.user!.id || ["owner", "admin"].includes(req.user!.role));
      if (!c || !wolno) return res.status(404).json({ error: "Nie znaleziono" });
      const pdf = await pdfZaswiadczenia(c);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="zaswiadczenie-${c.number}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(pdf);
    } catch (e) {
      blad(res, e, "Nie udało się przygotować PDF");
    }
  });

  // Publiczna weryfikacja po losowym kluczu z linku / kodu QR (nie po kolejnym numerze):
  // numer, ważność, tytuł, data, inicjały (bez PWZ i pełnego nazwiska). Własny limit na adres.
  app.get("/api/zaswiadczenia/:klucz", weryfikacjaRateLimit, async (req, res) => {
    try {
      const w = await s.weryfikacja(req.params.klucz);
      if (!w) return res.status(404).json({ error: "Nie znaleziono zaświadczenia dla tego linku" });
      res.setHeader("Cache-Control", "no-store");
      res.json(w);
    } catch (e) {
      blad(res, e, "Nie udało się sprawdzić zaświadczenia");
    }
  });

  // ── Panel admina ───────────────────────────────────────────────────────────
  app.get("/api/admin/szkolenie/uczestnicy", requireKonto, requireAdmin, async (_req, res) => {
    try {
      res.json(await s.listaUczestnikow());
    } catch (e) {
      blad(res, e, "Nie udało się wczytać uczestników");
    }
  });

  app.put("/api/admin/szkolenie/zapisy/:id", requireKonto, requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Nie znaleziono" });
    const p = edycjaZapisuSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? "Sprawdź dane" });
    try {
      const { powod, ...d } = p.data;
      res.json(await s.edytujZapis(req.user!.id, req.params.id, d, powod));
    } catch (e) {
      blad(res, e, "Nie udało się zmienić danych");
    }
  });

  // PWZ sprawdzony ręcznie w publicznym rejestrze NIL / NIPiP (warunek zaświadczenia z punktami)
  app.post("/api/admin/szkolenie/zapisy/:id/pwz-sprawdzony", requireKonto, requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Nie znaleziono" });
    const sprawdzony = req.body?.sprawdzony !== false;
    const uwaga = typeof req.body?.uwaga === "string" ? req.body.uwaga.trim().slice(0, 500) : undefined;
    try {
      res.json(await s.oznaczPwzSprawdzony(req.user!.id, req.params.id, sprawdzony, uwaga));
    } catch (e) {
      blad(res, e, "Nie udało się zapisać sprawdzenia PWZ");
    }
  });

  // Raport dla okręgowej izby lekarskiej (lekarze z zaświadczeniem), opcjonalnie ?izba=
  app.get("/api/admin/szkolenie/raport-orl.csv", requireKonto, requireAdmin, async (req, res) => {
    try {
      const izba = typeof req.query.izba === "string" ? req.query.izba.slice(0, 100) : undefined;
      const csv = await s.raportOrlCsv(izba);
      const dzien = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="raport-izba-lekarska-${dzien}.csv"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(csv);
    } catch (e) {
      blad(res, e, "Nie udało się przygotować raportu dla izby");
    }
  });

  // Pula testu: ile pytań się kwalifikuje (≥ 5 odpowiedzi, dokładnie 1 poprawna), które są pominięte
  app.get("/api/admin/szkolenie/pula-testu", requireKonto, requireAdmin, async (_req, res) => {
    try {
      res.json(await s.raportPuliTestu());
    } catch (e) {
      blad(res, e, "Nie udało się sprawdzić puli testu");
    }
  });

  // Przechowywanie: przegląd (proba) i usunięcie rejestru po 5 latach od końca roku wydania (tylko właściciel)
  app.post("/api/admin/szkolenie/retencja", requireKonto, requireOwner, async (req, res) => {
    try {
      const proba = req.body?.usun !== true;
      const w = await s.czyscPrzeterminowane({ proba });
      if (!proba) console.log("[szkolenie] retencja: usunięto", w.usunieto, "uczestników po okresie przechowywania");
      res.json(w);
    } catch (e) {
      blad(res, e, "Nie udało się sprawdzić okresu przechowywania");
    }
  });

  app.get("/api/admin/szkolenie/dziennik/:participantId", requireKonto, requireAdmin, async (req, res) => {
    if (!UUID_RE.test(req.params.participantId)) return res.status(404).json({ error: "Nie znaleziono" });
    res.json(await s.dziennikUczestnika(req.params.participantId));
  });

  app.get("/api/admin/szkolenie/lista-obecnosci.csv", requireKonto, requireAdmin, async (_req, res) => {
    try {
      const csv = await s.listaObecnosciCsv();
      const dzien = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="lista-obecnosci-${dzien}.csv"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(csv);
    } catch (e) {
      blad(res, e, "Nie udało się przygotować listy obecności");
    }
  });

  app.get("/api/admin/szkolenie/reguly", requireKonto, requireAdmin, async (_req, res) => {
    res.json(await s.reguly());
  });

  app.put("/api/admin/szkolenie/reguly/:zawod", requireKonto, requireOwner, async (req, res) => {
    if (!(ZAWODY as readonly string[]).includes(req.params.zawod)) return res.status(404).json({ error: "Nieznany zawód" });
    const p = regulaSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? "Sprawdź regułę" });
    try {
      res.json(await s.zapiszRegule(req.user!.id, req.params.zawod, p.data));
    } catch (e) {
      blad(res, e, "Nie udało się zapisać reguły");
    }
  });

  app.get("/api/admin/szkolenie/ankieta", requireKonto, requireAdmin, async (_req, res) => {
    try {
      res.json(await s.raportAnkiety());
    } catch (e) {
      blad(res, e, "Nie udało się przygotować raportu ankiety");
    }
  });

  app.post("/api/admin/szkolenie/zaswiadczenia/:numer/uniewaznij", requireKonto, requireOwner, async (req, res) => {
    const powod = typeof req.body?.powod === "string" ? req.body.powod.trim().slice(0, 500) : "";
    if (powod.length < 3) return res.status(400).json({ error: "Podaj powód unieważnienia" });
    try {
      const c = await s.uniewaznijZaswiadczenie(req.user!.id, req.params.numer, powod);
      res.json(s.widokZaswiadczenia(c));
    } catch (e) {
      blad(res, e, "Nie udało się unieważnić zaświadczenia");
    }
  });

  // ── Skrót testowy (E2E): tylko poza produkcją i z flagą CME_SKROT_TESTOWY=1 ─
  // Na produkcji trasa nie jest nawet rejestrowana.
  if (process.env.NODE_ENV !== "production" && process.env.CME_SKROT_TESTOWY === "1") {
    console.warn("[szkolenie] UWAGA: skrót testowy /api/szkolenie/_test/ukoncz-moduly włączony (CME_SKROT_TESTOWY=1)");
    app.post("/api/szkolenie/_test/ukoncz-moduly", requireKonto, async (req, res) => {
      try {
        const userId = req.user!.id;
        const { rows: secs } = await pool.query<{ id: string; module_id: string }>(
          `SELECT s.id, s.module_id FROM sections s JOIN modules m ON m.id = s.module_id
            WHERE m.cme AND m.is_visible AND s.is_visible
              AND EXISTS (SELECT 1 FROM lecture_chapters c WHERE c.section_id = s.id AND c.is_published)`);
        // te same ścieżki co w kursie: dziennik dostaje „wykład otwarty/ukończony” i „podsumowanie otwarte”
        for (const sec of secs) await s.zapiszCzytanie(userId, sec.id, 100_000);
        const mods = await db.select({ id: modules.id }).from(modules).where(and(eq(modules.cme, true), eq(modules.isVisible, true)));
        for (const m of mods) await s.otworzPodsumowanie(userId, m.id);
        // ćwiczenia: poprawna odpowiedź na każde pytanie puli ćwiczeń w modułach szkolenia
        const qs = mods.length ? await db.select({ id: questions.id, answers: questions.answers }).from(questions)
          .innerJoin(sections, eq(sections.id, questions.sectionId))
          .where(and(eq(questions.status, "published"), eq(questions.pool, "practice"), inArray(sections.moduleId, mods.map((m) => m.id)))) : [];
        for (let i = 0; i < qs.length; i += 500) {
          await db.insert(attempts).values(qs.slice(i, i + 500).map((q) => ({
            userId, questionId: q.id, selectedIndex: Math.max(0, q.answers.findIndex((a) => a.isCorrect)), isCorrect: true, timeMs: 1000, mode: "learn",
          })));
        }
        await quizService.recomputeUserProgress(userId);
        res.json({ wyklady: secs.length, moduly: mods.length, pytania: qs.length, stan: await s.sprawdzModuly(userId, userId) });
      } catch (e) {
        blad(res, e, "Skrót testowy nie zadziałał");
      }
    });
  }
}
