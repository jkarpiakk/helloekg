/**
 * Szkolenie z punktami edukacyjnymi: operacje na bazie (zapis, dziennik, wykłady, moduły, test,
 * ankieta, zaświadczenia, panel). Czysta logika: ./logika.ts. Trasy: ./trasy.ts.
 *
 * participant_id = id konta w chwili zdarzenia (bez klucza obcego): po usunięciu konta dziennik,
 * zapis, podejścia i zaświadczenia dalej należą do jednej osoby (rejestr 5 lat).
 */
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, pool } from "../db";
import {
  cmeCertificates,
  cmeEnrollments,
  cmeLectureProgress,
  cmeLog,
  cmeModuleProgress,
  cmeRules,
  cmeSurveyResponses,
  cmeTestAttempts,
  courseDocuments,
  modules,
  questions,
  sections,
  type CmeCertificate,
  type CmeEnrollment,
  type CmeRule,
  type CmeTestAttempt,
  type User,
} from "@shared/schema";
import {
  NAZWA_ZAWODU,
  OSWIADCZENIE,
  ZAWODY_ZE_SPECJALIZACJA,
  czyZawod,
  inicjaly,
  sprawdzOdpowiedziAnkiety,
  sprawdzPwz,
  type Zawod,
  type ZapisInput,
} from "@shared/szkolenie";
import { ustawienie, type Organizator } from "../ustawienia";
import { komorkaCsv } from "./csv";
import {
  czyNumerZaswiadczenia,
  dataGodzinaPL,
  dataPL,
  losujTest,
  numerZaswiadczenia,
  obliczPunkty,
  ocenTest,
  regulaDziala,
  kluczWeryfikacji,
  rokWPolsce,
  stanPodejsc,
  tokenWeryfikacji,
  tasuj,
  widokWeryfikacji,
  type RegulaPunktow,
  type StanPodejsc,
} from "./logika";

export class BladSzkolenia extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Wykonawca = typeof db | Tx;

export const TYPY_ZDARZEN = {
  zapis: "Zapis na szkolenie",
  zapis_zmiana: "Zmiana danych zapisu",
  wyklad_otwarty: "Wykład otwarty",
  wyklad_ukonczony: "Wykład ukończony",
  podsumowanie_otwarte: "Podsumowanie modułu otwarte",
  modul_ukonczony: "Moduł ukończony",
  test_rozpoczety: "Test rozpoczęty",
  test_oddany: "Test oddany",
  ankieta_wypelniona: "Ankieta wypełniona",
  zaswiadczenie_wydane: "Zaświadczenie wydane",
  zaswiadczenie_uniewaznione: "Zaświadczenie unieważnione",
  dane_zmienione_admin: "Dane zmienione przez zespół",
} as const;
export type TypZdarzenia = keyof typeof TYPY_ZDARZEN;

// ── Konfiguracja ──────────────────────────────────────────────────────────────

export async function konfiguracja() {
  return {
    wlaczone: await ustawienie("szkolenie_wlaczone"),
    cwiczeniaWymagane: await ustawienie("cwiczenia_wymagane"),
    pwzTryb: await ustawienie("pwz_kontrola_lekarz"),
    regulaminOpublikowany: await ustawienie("regulamin_szkolenia_opublikowany"),
    godziny: await ustawienie("cme_godziny"),
    test: {
      liczbaPytan: await ustawienie("cme_test_liczba_pytan"),
      prog: await ustawienie("cme_test_prog_procent"),
      limit: await ustawienie("cme_test_limit_podejsc"),
      przerwaPo: await ustawienie("cme_test_przerwa_po"),
      przerwaGodziny: await ustawienie("cme_test_przerwa_godziny"),
    },
    tytul: await ustawienie("cme_tytul"),
    forma: await ustawienie("cme_forma"),
    organizator: (await ustawienie("cme_organizator")) as Organizator,
    kierownikNaukowy: await ustawienie("cme_kierownik_naukowy"),
    ankieta: await ustawienie("cme_ankieta"),
  };
}
export type Konfiguracja = Awaited<ReturnType<typeof konfiguracja>>;

/** Wersja regulaminu szkolenia (docs/regulamin-szkolenia.md); zmiana treści = nowa wersja */
export const WERSJA_REGULAMINU_SZKOLENIA = "szkic-2026-11-11";

// ── Dziennik ──────────────────────────────────────────────────────────────────

export async function wpis(
  ex: Wykonawca,
  w: { type: TypZdarzenia; participantId: string; userId?: string | null; enrollmentId?: string | null; actorId?: string | null; details?: Record<string, unknown>; at?: Date },
) {
  await ex.insert(cmeLog).values({
    type: w.type,
    participantId: w.participantId,
    userId: w.userId ?? null,
    enrollmentId: w.enrollmentId ?? null,
    actorId: w.actorId ?? null,
    details: w.details ?? {},
    ...(w.at ? { at: w.at } : {}),
  });
}

export async function czyUczestnik(participantId: string, ex: Wykonawca = db): Promise<boolean> {
  const r = await ex.select({ id: cmeEnrollments.id }).from(cmeEnrollments).where(eq(cmeEnrollments.participantId, participantId)).limit(1);
  return r.length > 0;
}

// ── Zapis na szkolenie ────────────────────────────────────────────────────────

export async function zapisyUczestnika(participantId: string, ex: Wykonawca = db): Promise<CmeEnrollment[]> {
  return ex.select().from(cmeEnrollments).where(eq(cmeEnrollments.participantId, participantId)).orderBy(asc(cmeEnrollments.createdAt));
}

export function widokZapisu(z: CmeEnrollment) {
  return {
    id: z.id,
    zawod: z.profession,
    zawodNazwa: czyZawod(z.profession) ? NAZWA_ZAWODU[z.profession] : z.profession,
    pwz: z.pwz,
    pwzOstrzezenie: z.pwzWarning,
    specjalizacja: z.specialization,
    imie: z.firstName,
    nazwisko: z.lastName,
    oswiadczenieAt: z.declarationAt,
    zablokowany: !!z.lockedAt,
  };
}

/**
 * Zapis albo zmiana danych (przed pierwszym zaświadczeniem). Kilka zawodów naraz; imię i nazwisko
 * wspólne. Po pierwszym zaświadczeniu imię, nazwisko i PWZ już zapisanych zawodów są zablokowane;
 * nowy zawód można dopisać (z zablokowanym imieniem i nazwiskiem).
 */
export async function zapisz(user: User, input: ZapisInput) {
  const k = await konfiguracja();
  if (k.regulaminOpublikowany && input.regulamin !== true) {
    throw new BladSzkolenia(400, "Zaakceptuj regulamin szkolenia");
  }
  const zawody = new Map<Zawod, ZapisInput["zawody"][number]>();
  for (const z of input.zawody) zawody.set(z.zawod, z);

  // walidacja PWZ (błąd blokuje, ostrzeżenie zapisujemy)
  const sprawdzone = new Map<Zawod, { pwz: string | null; ostrzezenie: string | null; specjalizacja: string | null }>();
  for (const [zawod, z] of Array.from(zawody.entries())) {
    const w = sprawdzPwz(zawod, z.pwz, k.pwzTryb);
    if (w.blad) throw new BladSzkolenia(400, `${NAZWA_ZAWODU[zawod]}: ${w.blad}`);
    const specjalizacja = ZAWODY_ZE_SPECJALIZACJA.includes(zawod) ? (z.specjalizacja?.trim() || null) : null;
    sprawdzone.set(zawod, { pwz: w.pwz, ostrzezenie: w.ostrzezenie, specjalizacja });
  }

  const participantId = user.id;
  const teraz = new Date();
  let pierwszy = false;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"cme:" + participantId}))`);
    const obecne = await zapisyUczestnika(participantId, tx);
    pierwszy = obecne.length === 0;
    const zablokowane = obecne.filter((z) => z.lockedAt);
    const imie = zablokowane.length ? zablokowane[0].firstName : input.imie;
    const nazwisko = zablokowane.length ? zablokowane[0].lastName : input.nazwisko;
    if (zablokowane.length && (input.imie !== imie || input.nazwisko !== nazwisko)) {
      throw new BladSzkolenia(409, "Imię i nazwisko są już na zaświadczeniu. Zmianę zrobi zespół helloEKG: napisz na kontakt@helloekg.pl.");
    }

    for (const [zawod, d] of Array.from(sprawdzone.entries())) {
      const byl = obecne.find((z) => z.profession === zawod);
      if (byl?.lockedAt) {
        if ((byl.pwz ?? null) !== d.pwz || (byl.specialization ?? null) !== d.specjalizacja) {
          throw new BladSzkolenia(409, `Dane dla zawodu „${NAZWA_ZAWODU[zawod]}” są już na zaświadczeniu. Zmianę zrobi zespół helloEKG: napisz na kontakt@helloekg.pl.`);
        }
        continue;
      }
      if (byl) {
        const zmiany: Record<string, [unknown, unknown]> = {};
        if (byl.firstName !== imie) zmiany.imie = [byl.firstName, imie];
        if (byl.lastName !== nazwisko) zmiany.nazwisko = [byl.lastName, nazwisko];
        if ((byl.pwz ?? null) !== d.pwz) zmiany.pwz = [byl.pwz, d.pwz];
        if ((byl.specialization ?? null) !== d.specjalizacja) zmiany.specjalizacja = [byl.specialization, d.specjalizacja];
        if (!Object.keys(zmiany).length) continue;
        await tx.update(cmeEnrollments).set({
          firstName: imie, lastName: nazwisko, pwz: d.pwz, pwzWarning: d.ostrzezenie, specialization: d.specjalizacja,
          declarationText: OSWIADCZENIE, declarationAt: teraz, updatedAt: teraz,
        }).where(eq(cmeEnrollments.id, byl.id));
        await wpis(tx, { type: "zapis_zmiana", participantId, userId: user.id, enrollmentId: byl.id, details: { zawod, zmiany, oswiadczenieAt: teraz.toISOString() } });
      } else {
        const [nowy] = await tx.insert(cmeEnrollments).values({
          participantId, userId: user.id, profession: zawod, pwz: d.pwz, pwzWarning: d.ostrzezenie, specialization: d.specjalizacja,
          firstName: imie, lastName: nazwisko, declarationText: OSWIADCZENIE, declarationAt: teraz,
          termsVersion: k.regulaminOpublikowany ? WERSJA_REGULAMINU_SZKOLENIA : null,
        }).returning();
        await wpis(tx, {
          type: "zapis", participantId, userId: user.id, enrollmentId: nowy.id,
          details: { zawod, pwzOstrzezenie: d.ostrzezenie, regulamin: nowy.termsVersion, oswiadczenieAt: teraz.toISOString() },
        });
      }
    }
    // Pierwszy zapis: do dziennika trafia to, co osoba zrobiła w kursie wcześniej (z prawdziwymi datami)
    if (pierwszy) await uzupelnijDziennikPoZapisie(tx, participantId, user.id);
  });
  await sprawdzModuly(participantId, user.id);
  const zapisy = await zapisyUczestnika(participantId);
  return { zapisy: zapisy.map(widokZapisu), pierwszy };
}

/** Zdarzenia sprzed zapisu (wykłady, podsumowania) do dziennika, z datami z chwili zdarzenia */
async function uzupelnijDziennikPoZapisie(tx: Tx, participantId: string, userId: string) {
  const wyklady = await tx.select({
    sectionId: cmeLectureProgress.sectionId, first: cmeLectureProgress.firstOpenedAt, done: cmeLectureProgress.completedAt,
    title: sections.title, externalId: sections.externalId, moduleId: sections.moduleId, cme: modules.cme,
  }).from(cmeLectureProgress)
    .innerJoin(sections, eq(sections.id, cmeLectureProgress.sectionId))
    .innerJoin(modules, eq(modules.id, sections.moduleId))
    .where(eq(cmeLectureProgress.participantId, participantId));
  for (const w of wyklady.filter((x) => x.cme)) {
    const details = { sectionId: w.sectionId, wyklad: w.externalId, tytul: w.title, moduleId: w.moduleId, przedZapisem: true };
    await wpis(tx, { type: "wyklad_otwarty", participantId, userId, details, at: w.first });
    if (w.done) await wpis(tx, { type: "wyklad_ukonczony", participantId, userId, details, at: w.done });
  }
  const pods = await tx.select({ moduleId: cmeModuleProgress.moduleId, at: cmeModuleProgress.summaryOpenedAt, title: modules.title, externalId: modules.externalId, cme: modules.cme })
    .from(cmeModuleProgress).innerJoin(modules, eq(modules.id, cmeModuleProgress.moduleId))
    .where(eq(cmeModuleProgress.participantId, participantId));
  for (const p of pods.filter((x) => x.cme && x.at)) {
    await wpis(tx, { type: "podsumowanie_otwarte", participantId, userId, details: { moduleId: p.moduleId, modul: p.externalId, tytul: p.title, przedZapisem: true }, at: p.at! });
  }
}

// ── Wykłady ───────────────────────────────────────────────────────────────────

/**
 * Wywoływane przy zapisie miejsca w wykładzie (PUT /api/lecture-reads): pierwsze otwarcie
 * i ukończenie (dojście do ostatniego opublikowanego rozdziału; liczba rozdziałów z bazy, nie od klienta).
 * Ślad zapisujemy każdemu (zapis na szkolenie później liczy wcześniejsze czytanie), dziennik tylko uczestnikom.
 */
export async function zapiszCzytanie(userId: string, sectionId: string, chapterOrder: number): Promise<void> {
  const [sec] = await db.select({ id: sections.id, title: sections.title, externalId: sections.externalId, moduleId: sections.moduleId, cme: modules.cme })
    .from(sections).innerJoin(modules, eq(modules.id, sections.moduleId)).where(eq(sections.id, sectionId));
  if (!sec) return;
  const { rows: [{ n }] } = await pool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM lecture_chapters WHERE section_id = $1 AND is_published", [sectionId]);
  if (!n) return;
  const participantId = userId;
  const otwarty = await db.insert(cmeLectureProgress).values({ participantId, userId, sectionId })
    .onConflictDoNothing().returning({ at: cmeLectureProgress.firstOpenedAt });
  let ukonczony: { at: Date | null }[] = [];
  if (chapterOrder >= n) {
    ukonczony = await db.update(cmeLectureProgress).set({ completedAt: new Date() })
      .where(and(eq(cmeLectureProgress.participantId, participantId), eq(cmeLectureProgress.sectionId, sectionId), isNull(cmeLectureProgress.completedAt)))
      .returning({ at: cmeLectureProgress.completedAt });
  }
  if (!sec.cme || (!otwarty.length && !ukonczony.length) || !(await czyUczestnik(participantId))) return;
  const details = { sectionId, wyklad: sec.externalId, tytul: sec.title, moduleId: sec.moduleId };
  if (otwarty.length) await wpis(db, { type: "wyklad_otwarty", participantId, userId, details, at: otwarty[0].at ?? undefined });
  if (ukonczony.length) {
    await wpis(db, { type: "wyklad_ukonczony", participantId, userId, details, at: ukonczony[0].at ?? undefined });
    await sprawdzModuly(participantId, userId);
  }
}

// ── Moduły ────────────────────────────────────────────────────────────────────

export async function modulDoPodsumowania(moduleId: string) {
  const [m] = await db.select().from(modules).where(eq(modules.id, moduleId));
  return m ?? null;
}

/** Otwarcie podsumowania modułu (strona modułu wysyła je, gdy podsumowanie się wyświetli) */
export async function otworzPodsumowanie(userId: string, moduleId: string): Promise<boolean> {
  const m = await modulDoPodsumowania(moduleId);
  if (!m || !m.summaryMd?.trim()) return false;
  const participantId = userId;
  await db.insert(cmeModuleProgress).values({ participantId, userId, moduleId }).onConflictDoNothing();
  const nowe = await db.update(cmeModuleProgress).set({ summaryOpenedAt: new Date() })
    .where(and(eq(cmeModuleProgress.participantId, participantId), eq(cmeModuleProgress.moduleId, moduleId), isNull(cmeModuleProgress.summaryOpenedAt)))
    .returning({ at: cmeModuleProgress.summaryOpenedAt });
  if (nowe.length && m.cme && (await czyUczestnik(participantId))) {
    await wpis(db, { type: "podsumowanie_otwarte", participantId, userId, details: { moduleId, modul: m.externalId, tytul: m.title }, at: nowe[0].at ?? undefined });
    await sprawdzModuly(participantId, userId);
  }
  return true;
}

export interface StanModulu {
  id: string;
  externalId: string | null;
  tytul: string;
  kolejnosc: number;
  wyklady: { ukonczone: number; wszystkie: number };
  podsumowanie: { jest: boolean; otwarte: boolean };
  cwiczenia: { opanowane: number; wszystkie: number; wymagane: boolean };
  ukonczony: boolean;
  ukonczonyAt: string | null;
}

/**
 * Stan modułów szkolenia (cme = true, widoczne). Moduł ukończony = wszystkie wykłady ukończone
 * + podsumowanie otwarte (gdy moduł je ma) + (gdy cwiczenia_wymagane) każdy temat z ćwiczeniami
 * opanowany: ostatnia odpowiedź na każde opublikowane pytanie puli ćwiczeń poprawna.
 * Ukończenie jest zapisywane raz (cme_module_progress.completed_at) i potem już nie znika.
 */
export async function sprawdzModuly(participantId: string, userId: string | null): Promise<StanModulu[]> {
  const cwiczeniaWymagane = await ustawienie("cwiczenia_wymagane");
  const mods = await db.select({ id: modules.id, externalId: modules.externalId, title: modules.title, order: modules.order, summaryMd: modules.summaryMd })
    .from(modules).where(and(eq(modules.cme, true), eq(modules.isVisible, true))).orderBy(asc(modules.order));
  if (!mods.length) return [];
  const ids = mods.map((m) => m.id);
  const { rows: wyklady } = await pool.query<{ id: string; module_id: string }>(
    `SELECT s.id, s.module_id FROM sections s
      WHERE s.is_visible AND s.module_id = ANY($1::uuid[])
        AND EXISTS (SELECT 1 FROM lecture_chapters c WHERE c.section_id = s.id AND c.is_published)`, [ids]);
  const { rows: cwiczenia } = await pool.query<{ section_id: string; module_id: string; question_id: string }>(
    `SELECT s.id AS section_id, s.module_id, q.id AS question_id FROM questions q JOIN sections s ON s.id = q.section_id
      WHERE q.status = 'published' AND q.pool = 'practice' AND s.is_visible AND s.module_id = ANY($1::uuid[])`, [ids]);
  const ostatnie = new Map<string, boolean>();
  if (userId && cwiczeniaWymagane) {
    const { rows } = await pool.query<{ question_id: string; is_correct: boolean }>(
      `SELECT DISTINCT ON (question_id) question_id, is_correct FROM attempts WHERE user_id = $1 ORDER BY question_id, created_at DESC`, [userId]);
    for (const r of rows) ostatnie.set(r.question_id, r.is_correct);
  }
  const przeczytane = new Set((await db.select({ s: cmeLectureProgress.sectionId }).from(cmeLectureProgress)
    .where(and(eq(cmeLectureProgress.participantId, participantId), sql`${cmeLectureProgress.completedAt} IS NOT NULL`))).map((r) => r.s));
  const postep = new Map((await db.select().from(cmeModuleProgress).where(eq(cmeModuleProgress.participantId, participantId))).map((r) => [r.moduleId, r]));
  const uczestnik = await czyUczestnik(participantId);

  const wynik: StanModulu[] = [];
  for (const m of mods) {
    const w = wyklady.filter((x) => x.module_id === m.id);
    const tematy = new Map<string, string[]>();
    for (const c of cwiczenia.filter((x) => x.module_id === m.id)) tematy.set(c.section_id, [...(tematy.get(c.section_id) ?? []), c.question_id]);
    const opanowane = Array.from(tematy.values()).filter((qs) => qs.every((q) => ostatnie.get(q) === true)).length;
    const p = postep.get(m.id);
    const jestPodsumowanie = !!m.summaryMd?.trim();
    const stan: StanModulu = {
      id: m.id, externalId: m.externalId, tytul: m.title, kolejnosc: m.order,
      wyklady: { ukonczone: w.filter((x) => przeczytane.has(x.id)).length, wszystkie: w.length },
      podsumowanie: { jest: jestPodsumowanie, otwarte: !!p?.summaryOpenedAt },
      cwiczenia: { opanowane, wszystkie: tematy.size, wymagane: cwiczeniaWymagane },
      ukonczony: !!p?.completedAt,
      ukonczonyAt: p?.completedAt ? p.completedAt.toISOString() : null,
    };
    const spelnia = (w.length + tematy.size > 0)
      && stan.wyklady.ukonczone === stan.wyklady.wszystkie
      && (!jestPodsumowanie || stan.podsumowanie.otwarte)
      && (!cwiczeniaWymagane || opanowane === tematy.size);
    if (!stan.ukonczony && spelnia) {
      await db.insert(cmeModuleProgress).values({ participantId, userId, moduleId: m.id }).onConflictDoNothing();
      const zapisane = await db.update(cmeModuleProgress).set({ completedAt: new Date() })
        .where(and(eq(cmeModuleProgress.participantId, participantId), eq(cmeModuleProgress.moduleId, m.id), isNull(cmeModuleProgress.completedAt)))
        .returning({ at: cmeModuleProgress.completedAt });
      if (zapisane.length) {
        stan.ukonczony = true;
        stan.ukonczonyAt = zapisane[0].at!.toISOString();
        if (uczestnik) {
          await wpis(db, { type: "modul_ukonczony", participantId, userId, details: { moduleId: m.id, modul: m.externalId, tytul: m.title, cwiczeniaWymagane }, at: zapisane[0].at! });
        }
      }
    }
    wynik.push(stan);
  }
  return wynik;
}

/** Po odpowiedzi w ćwiczeniach: moduł mógł się właśnie ukończyć (tylko uczestnicy; reszta przy zapisie) */
export async function poOdpowiedzi(userId: string): Promise<void> {
  if (!(await ustawienie("cwiczenia_wymagane"))) return;
  if (!(await czyUczestnik(userId))) return;
  await sprawdzModuly(userId, userId);
}

// ── Test zaliczeniowy ─────────────────────────────────────────────────────────

type PytanieTestu = { id: string; tags: string[] | null; excludes: string[] | null; section_id: string; module_id: string; answers: Array<{ text: string; isCorrect: boolean }> };

const externalIdZ = (tags: string[] | null | undefined) => (tags ?? []).find((t) => t.startsWith("studio:"))?.slice(7) ?? null;

async function pulaTestu(): Promise<PytanieTestu[]> {
  const { rows } = await pool.query<PytanieTestu>(
    `SELECT q.id, q.tags, q.excludes, q.section_id, s.module_id, q.answers
       FROM questions q JOIN sections s ON s.id = q.section_id JOIN modules m ON m.id = s.module_id
      WHERE q.pool = 'test' AND q.status = 'published' AND q.question_type = 'multiple_choice'
        AND m.cme AND m.is_visible AND s.is_visible`);
  return rows.filter((r) => Array.isArray(r.answers) && r.answers.length >= 2 && r.answers.some((a) => a.isCorrect));
}

async function podejsciaUczestnika(participantId: string, ex: Wykonawca = db): Promise<CmeTestAttempt[]> {
  return ex.select().from(cmeTestAttempts).where(eq(cmeTestAttempts.participantId, participantId)).orderBy(asc(cmeTestAttempts.startedAt));
}

function zasadyZ(k: Konfiguracja) {
  return { limit: k.test.limit, przerwaPo: k.test.przerwaPo, przerwaGodziny: k.test.przerwaGodziny };
}

export async function stanTestu(user: User) {
  const k = await konfiguracja();
  const zapisy = await zapisyUczestnika(user.id);
  const moduly = zapisy.length ? await sprawdzModuly(user.id, user.id) : [];
  const brakujace = moduly.filter((m) => !m.ukonczony).map((m) => m.tytul);
  const podejscia = await podejsciaUczestnika(user.id);
  const stan = stanPodejsc(podejscia, new Date(), zasadyZ(k));
  const pula = await pulaTestu();
  const odblokowany = zapisy.length > 0 && moduly.length > 0 && brakujace.length === 0 && pula.length > 0;
  return {
    zapisany: zapisy.length > 0,
    odblokowany,
    brakujaceModuly: brakujace,
    pulaPusta: pula.length === 0,
    stan,
    zasady: { ...k.test, liczbaPytan: Math.min(k.test.liczbaPytan, pula.length || k.test.liczbaPytan) },
    podejscia: podejscia.map((p, i) => ({
      id: p.id, nr: i + 1, startedAt: p.startedAt, submittedAt: p.submittedAt,
      wynik: p.score, maks: p.maxScore, procent: p.percent === null ? null : Number(p.percent), zaliczony: p.passed,
    })),
  };
}

/** Pytania podejścia dla przeglądarki: bez poprawnych odpowiedzi i wyjaśnień, odpowiedzi w zapisanej kolejności */
async function widokPodejscia(a: CmeTestAttempt) {
  const qs = a.questionIds.length
    ? await db.select({ id: questions.id, title: questions.title, bodyMd: questions.bodyMd, imageUrl: questions.imageUrl, answers: questions.answers })
      .from(questions).where(inArray(questions.id, a.questionIds))
    : [];
  const poId = new Map(qs.map((q) => [q.id, q]));
  return {
    id: a.id,
    startedAt: a.startedAt,
    pytania: a.questionIds.map((id, i) => {
      const q = poId.get(id);
      const kolejnosc = a.answerOrders[id] ?? (q ? q.answers.map((_, j) => j) : []);
      return {
        id, nr: i + 1, title: q?.title ?? "", bodyMd: q?.bodyMd ?? "Pytanie niedostępne", imageUrl: q?.imageUrl ?? null,
        answers: q ? kolejnosc.filter((j) => j < q.answers.length).map((j) => ({ index: j, text: q.answers[j].text })) : [],
      };
    }),
    odpowiedzi: a.answers,
  };
}

export async function rozpocznijTest(user: User) {
  const k = await konfiguracja();
  const t = await stanTestu(user);
  if (!t.zapisany) throw new BladSzkolenia(403, "Najpierw zapisz się na szkolenie.");
  if (!t.odblokowany) throw new BladSzkolenia(403, t.pulaPusta ? "Test nie jest jeszcze gotowy." : "Test otworzy się po ukończeniu wszystkich modułów szkolenia.");
  const participantId = user.id;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"cme:" + participantId}))`);
    const podejscia = await podejsciaUczestnika(participantId, tx);
    const otwarte = podejscia.find((p) => !p.submittedAt);
    if (otwarte) return widokPodejscia(otwarte);
    const stan = stanPodejsc(podejscia, new Date(), zasadyZ(k));
    if (stan.stan === "zaliczony") throw new BladSzkolenia(409, "Test jest już zaliczony.");
    if (stan.stan === "wyczerpane") throw new BladSzkolenia(409, "Wykorzystano wszystkie podejścia do testu. Napisz do nas: kontakt@helloekg.pl.");
    if (stan.stan === "przerwa") throw new BladSzkolenia(409, `Kolejne podejście będzie możliwe od ${dataGodzinaPL(stan.od)}.`);
    const pula = await pulaTestu();
    const poId = new Map(pula.map((q) => [q.id, q]));
    const wylosowane = losujTest(pula.map((q) => ({
      id: q.id, externalId: externalIdZ(q.tags), sectionId: q.section_id, moduleId: q.module_id, excludes: Array.isArray(q.excludes) ? q.excludes : [],
    })), k.test.liczbaPytan);
    const ids = wylosowane.map((q) => q.id);
    const { rows: noShuffle } = await pool.query<{ id: string }>("SELECT id FROM questions WHERE id = ANY($1::uuid[]) AND no_shuffle", [ids]);
    const stale = new Set(noShuffle.map((r) => r.id));
    const answerOrders: Record<string, number[]> = {};
    for (const id of ids) {
      const kolejnosc = poId.get(id)!.answers.map((_, j) => j);
      answerOrders[id] = stale.has(id) ? kolejnosc : tasuj(kolejnosc);
    }
    const [a] = await tx.insert(cmeTestAttempts).values({
      participantId, userId: user.id, questionIds: ids, answerOrders,
      rules: { ...k.test, losowanie: ids.length, pula: pula.length },
    }).returning();
    await wpis(tx, { type: "test_rozpoczety", participantId, userId: user.id, details: { attemptId: a.id, nr: podejscia.length + 1, pytan: ids.length } });
    return widokPodejscia(a);
  });
}

async function podejscieUzytkownika(user: User, attemptId: string, ex: Wykonawca = db) {
  const [a] = await ex.select().from(cmeTestAttempts).where(and(eq(cmeTestAttempts.id, attemptId), eq(cmeTestAttempts.participantId, user.id)));
  if (!a) throw new BladSzkolenia(404, "Nie znaleziono podejścia.");
  return a;
}

export async function otwartePodejscie(user: User) {
  const [a] = await db.select().from(cmeTestAttempts).where(and(eq(cmeTestAttempts.participantId, user.id), isNull(cmeTestAttempts.submittedAt)));
  return a ? widokPodejscia(a) : null;
}

/** Zapis odpowiedzi w trakcie (bez oceny i bez informacji zwrotnej) */
export async function zapiszOdpowiedzTestu(user: User, attemptId: string, questionId: string, answerIndex: number) {
  const a = await podejscieUzytkownika(user, attemptId);
  if (a.submittedAt) throw new BladSzkolenia(409, "To podejście jest już oddane.");
  if (!a.questionIds.includes(questionId)) throw new BladSzkolenia(400, "To pytanie nie należy do tego podejścia.");
  if (!(a.answerOrders[questionId] ?? []).includes(answerIndex)) throw new BladSzkolenia(400, "Nieprawidłowa odpowiedź.");
  await db.update(cmeTestAttempts)
    .set({ answers: sql`${cmeTestAttempts.answers} || ${JSON.stringify({ [questionId]: answerIndex })}::jsonb` })
    .where(and(eq(cmeTestAttempts.id, a.id), isNull(cmeTestAttempts.submittedAt)));
}

export async function oddajTest(user: User, attemptId: string, odpowiedzi?: Record<string, unknown>) {
  const k = await konfiguracja();
  const wynik = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"cme:" + user.id}))`);
    const a = await podejscieUzytkownika(user, attemptId, tx);
    if (a.submittedAt) throw new BladSzkolenia(409, "To podejście jest już oddane.");
    // odpowiedzi z oddania mają pierwszeństwo przed zapisanymi w trakcie; tylko pytania tego podejścia
    const scalone: Record<string, number> = { ...a.answers };
    for (const [qid, v] of Object.entries(odpowiedzi ?? {})) {
      if (a.questionIds.includes(qid) && typeof v === "number" && (a.answerOrders[qid] ?? []).includes(v)) scalone[qid] = v;
    }
    const qs = await tx.select({ id: questions.id, tags: questions.tags, answers: questions.answers }).from(questions).where(inArray(questions.id, a.questionIds));
    const poId = new Map(qs.map((q) => [q.id, q]));
    // pytanie usunięte w międzyczasie liczy się jako błędne (nie zmniejsza maksimum)
    const doOceny = a.questionIds.map((id) => ({ id, externalId: externalIdZ(poId.get(id)?.tags), answers: poId.get(id)?.answers ?? [] }));
    const prog = Number((a.rules as { prog?: number }).prog ?? k.test.prog);
    const w = ocenTest(doOceny, scalone, prog);
    const teraz = new Date();
    await tx.update(cmeTestAttempts).set({
      submittedAt: teraz, answers: scalone, grading: w.oceny, score: w.wynik, maxScore: w.maks, percent: w.procent.toFixed(2), passed: w.zaliczony,
    }).where(eq(cmeTestAttempts.id, a.id));
    await wpis(tx, { type: "test_oddany", participantId: user.id, userId: user.id, details: { attemptId: a.id, wynik: w.wynik, maks: w.maks, procent: w.procent, zaliczony: w.zaliczony, prog } });
    return a.id;
  });
  return wynikPodejscia(user, wynik);
}

/** Wynik oddanego podejścia: punkty i uzasadnienia tylko do błędnych odpowiedzi */
export async function wynikPodejscia(user: User, attemptId: string) {
  const a = await podejscieUzytkownika(user, attemptId);
  if (!a.submittedAt) throw new BladSzkolenia(409, "Podejście nie jest jeszcze oddane.");
  const bledne = (a.grading ?? []).filter((o) => !o.ok);
  const qs = bledne.length
    ? await db.select({ id: questions.id, title: questions.title, bodyMd: questions.bodyMd, imageUrl: questions.imageUrl, answers: questions.answers, explanationMd: questions.explanationMd })
      .from(questions).where(inArray(questions.id, bledne.map((b) => b.questionId)))
    : [];
  const poId = new Map(qs.map((q) => [q.id, q]));
  return {
    id: a.id,
    wynik: a.score ?? 0,
    maks: a.maxScore ?? 0,
    procent: a.percent === null ? 0 : Number(a.percent),
    zaliczony: !!a.passed,
    prog: Number((a.rules as { prog?: number }).prog ?? 0),
    submittedAt: a.submittedAt,
    bledne: bledne.map((b) => {
      const q = poId.get(b.questionId);
      const kolejnosc = a.answerOrders[b.questionId] ?? [];
      return {
        nr: a.questionIds.indexOf(b.questionId) + 1,
        title: q?.title ?? "",
        bodyMd: q?.bodyMd ?? "",
        imageUrl: q?.imageUrl ?? null,
        answers: q ? kolejnosc.filter((j) => j < q.answers.length).map((j) => ({ index: j, text: q.answers[j].text })) : [],
        wybrana: b.chosen,
        poprawne: b.correct,
        wyjasnienie: q?.explanationMd ?? "",
      };
    }),
  };
}

async function zaliczonePodejscie(participantId: string) {
  const [a] = await db.select().from(cmeTestAttempts)
    .where(and(eq(cmeTestAttempts.participantId, participantId), eq(cmeTestAttempts.passed, true)))
    .orderBy(asc(cmeTestAttempts.submittedAt)).limit(1);
  return a ?? null;
}

// ── Ankieta (anonimowa) ───────────────────────────────────────────────────────

async function ankietaWypelniona(participantId: string, ex: Wykonawca = db) {
  const r = await ex.select({ id: cmeLog.id }).from(cmeLog).where(and(eq(cmeLog.participantId, participantId), eq(cmeLog.type, "ankieta_wypelniona"))).limit(1);
  return r.length > 0;
}

export async function stanAnkiety(user: User) {
  const k = await konfiguracja();
  return {
    dostepna: !!(await zaliczonePodejscie(user.id)),
    wypelniona: await ankietaWypelniona(user.id),
    ankieta: k.ankieta,
  };
}

/**
 * Odpowiedzi trafiają do tabeli bez user_id i bez godziny (tylko miesiąc); w dzienniku zostaje
 * wyłącznie fakt „ankieta wypełniona”. Jedna ankieta na osobę.
 */
export async function zapiszAnkiete(user: User, surowe: unknown) {
  const k = await konfiguracja();
  if (!(await zaliczonePodejscie(user.id))) throw new BladSzkolenia(403, "Ankieta otworzy się po zaliczeniu testu.");
  const s = sprawdzOdpowiedziAnkiety(k.ankieta, surowe);
  if ("blad" in s) throw new BladSzkolenia(400, s.blad);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"cme:" + user.id}))`);
    if (await ankietaWypelniona(user.id, tx)) throw new BladSzkolenia(409, "Ankieta jest już wypełniona. Dziękujemy!");
    const teraz = new Date();
    const miesiac = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit" }).format(teraz);
    await tx.insert(cmeSurveyResponses).values({ month: miesiac, surveyVersion: k.ankieta.wersja, answers: s.odpowiedzi });
    await wpis(tx, { type: "ankieta_wypelniona", participantId: user.id, userId: user.id, details: { wersja: k.ankieta.wersja } });
  });
}

// ── Reguły punktów ────────────────────────────────────────────────────────────

export const regulaZWiersza = (r: CmeRule): RegulaPunktow => ({
  profession: r.profession,
  active: r.active,
  pointsPerHour: Number(r.pointsPerHour),
  maxPoints: r.maxPoints === null ? null : Number(r.maxPoints),
  minHours: r.minHours === null ? null : Number(r.minHours),
  testRequired: r.testRequired,
  registryRequired: r.registryRequired,
  registryNumber: r.registryNumber,
  inactiveReason: r.inactiveReason,
});

export async function reguly(): Promise<CmeRule[]> {
  return db.select().from(cmeRules).orderBy(asc(cmeRules.profession));
}

export async function zapiszRegule(adminId: string, profession: string, d: Partial<{
  active: boolean; legalBasis: string | null; pointsFormula: string | null; pointsPerHour: number; maxPoints: number | null; minHours: number | null;
  testRequired: boolean; registryRequired: boolean; registryNumber: string | null; inactiveReason: string | null;
}>) {
  if (!czyZawod(profession)) throw new BladSzkolenia(404, "Nieznany zawód.");
  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: adminId };
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue;
    set[k] = ["pointsPerHour", "maxPoints", "minHours"].includes(k) && v !== null ? String(v) : v;
  }
  const [r] = await db.insert(cmeRules).values({ profession, ...(set as object) } as any)
    .onConflictDoUpdate({ target: cmeRules.profession, set: set as any }).returning();
  return r;
}

// ── Zaświadczenia ─────────────────────────────────────────────────────────────

export function widokZaswiadczenia(c: CmeCertificate) {
  const s = c.snapshot as Record<string, any>;
  return {
    numer: c.number,
    /** Klucz linku weryfikacji (tylko dla właściciela zaświadczenia i zespołu) */
    klucz: c.verificationToken,
    zawod: c.profession,
    zawodNazwa: czyZawod(c.profession) ? NAZWA_ZAWODU[c.profession] : c.profession,
    punkty: c.points === null ? null : Number(c.points),
    powodBezPunktow: s.powodBezPunktow ?? null,
    godziny: Number(c.hours),
    wydano: c.issuedAt,
    wazne: c.valid,
  };
}

export async function zaswiadczeniaUczestnika(participantId: string) {
  return db.select().from(cmeCertificates).where(eq(cmeCertificates.participantId, participantId)).orderBy(desc(cmeCertificates.issuedAt));
}

/** Data rozpoczęcia: pierwsze otwarcie wykładu w module szkolenia albo zapis, jeśli był wcześniej */
async function dataRozpoczecia(participantId: string, zapis: CmeEnrollment): Promise<Date> {
  const { rows: [r] } = await pool.query<{ at: Date | null }>(
    `SELECT min(p.first_opened_at) AS at FROM cme_lecture_progress p JOIN sections s ON s.id = p.section_id JOIN modules m ON m.id = s.module_id
      WHERE p.participant_id = $1 AND m.cme`, [participantId]);
  const zapisAt = zapis.createdAt;
  return r?.at && r.at < zapisAt ? r.at : zapisAt;
}

export async function wydajZaswiadczenie(user: User, enrollmentId: string) {
  const k = await konfiguracja();
  if (!user.emailVerified) throw new BladSzkolenia(403, "Potwierdź adres e-mail, żeby odebrać zaświadczenie.");
  const participantId = user.id;
  const [zapis] = await db.select().from(cmeEnrollments).where(and(eq(cmeEnrollments.id, enrollmentId), eq(cmeEnrollments.participantId, participantId)));
  if (!zapis) throw new BladSzkolenia(404, "Nie znaleziono zapisu na szkolenie.");
  const test = await zaliczonePodejscie(participantId);
  if (!test) throw new BladSzkolenia(403, "Zaświadczenie będzie dostępne po zaliczeniu testu.");
  if (!(await ankietaWypelniona(participantId))) throw new BladSzkolenia(403, "Przed zaświadczeniem wypełnij krótką anonimową ankietę.");
  const [wiersz] = await db.select().from(cmeRules).where(eq(cmeRules.profession, zapis.profession));
  const regula = wiersz ? regulaZWiersza(wiersz) : null;
  const punkty = obliczPunkty(regula, k.godziny, true);
  const start = await dataRozpoczecia(participantId, zapis);

  const cert = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"cme:" + participantId}))`);
    const [jest] = await tx.select().from(cmeCertificates)
      .where(and(eq(cmeCertificates.participantId, participantId), eq(cmeCertificates.profession, zapis.profession), eq(cmeCertificates.valid, true)));
    if (jest) return jest;
    const teraz = new Date();
    const rok = rokWPolsce(teraz);
    // licznik roku w tej samej transakcji: numery bez dziur i bez powtórzeń
    const nr =await tx.execute(sql`INSERT INTO cme_certificate_counters (year, last) VALUES (${rok}, 1)
      ON CONFLICT (year) DO UPDATE SET last = cme_certificate_counters.last + 1 RETURNING last`);
    const kolejny = Number((nr.rows[0] as { last: number }).last);
    const numer = numerZaswiadczenia(rok, kolejny);
    // dane zapisu blokują się przy pierwszym zaświadczeniu (wszystkie zawody tej osoby)
    await tx.update(cmeEnrollments).set({ lockedAt: teraz }).where(and(eq(cmeEnrollments.participantId, participantId), isNull(cmeEnrollments.lockedAt)));
    const snapshot = {
      imie: zapis.firstName,
      nazwisko: zapis.lastName,
      zawod: zapis.profession,
      zawodNazwa: czyZawod(zapis.profession) ? NAZWA_ZAWODU[zapis.profession] : zapis.profession,
      pwz: zapis.pwz,
      specjalizacja: zapis.specialization,
      tytul: k.tytul,
      forma: k.forma,
      godziny: k.godziny,
      dataRozpoczecia: start.toISOString(),
      dataZakonczenia: (test.submittedAt ?? teraz).toISOString(),
      wynikTestu: { wynik: test.score, maks: test.maxScore, procent: test.percent === null ? null : Number(test.percent) },
      punkty: punkty.punkty,
      powodBezPunktow: punkty.powod,
      organizator: k.organizator,
      kierownikNaukowy: k.kierownikNaukowy,
    };
    const ruleSnapshot = wiersz ? { ...wiersz, dziala: regulaDziala(regula!) } : { profession: zapis.profession, brak: true };
    const [c] = await tx.insert(cmeCertificates).values({
      number: numer, verificationToken: tokenWeryfikacji(), participantId, userId: user.id, enrollmentId: zapis.id, profession: zapis.profession,
      snapshot, ruleSnapshot: ruleSnapshot as Record<string, unknown>,
      points: punkty.punkty === null ? null : punkty.punkty.toFixed(2), hours: String(k.godziny), testAttemptId: test.id, issuedAt: teraz,
    }).returning();
    await wpis(tx, { type: "zaswiadczenie_wydane", participantId, userId: user.id, enrollmentId: zapis.id, details: { numer, zawod: zapis.profession, punkty: punkty.punkty } });
    return c;
  });
  return cert;
}

export async function zaswiadczeniePoNumerze(numer: string) {
  if (!czyNumerZaswiadczenia(numer)) return null;
  const [c] = await db.select().from(cmeCertificates).where(eq(cmeCertificates.number, numer));
  return c ?? null;
}

/** Publiczna weryfikacja: tylko po losowym kluczu; numer HE-… sam w sobie niczego nie zwraca */
export async function weryfikacja(token: string) {
  const klucz = kluczWeryfikacji(token);
  if (!klucz) return null;
  const [c] = await db.select().from(cmeCertificates).where(eq(cmeCertificates.verificationToken, klucz));
  return c ? widokWeryfikacji(c, inicjaly) : null;
}

// ── Stan dla strony szkolenia ─────────────────────────────────────────────────

export async function stanSzkolenia(user: User) {
  const k = await konfiguracja();
  const zapisy = await zapisyUczestnika(user.id);
  const moduly = await sprawdzModuly(user.id, user.id);
  const test = await stanTestu(user);
  const ankieta = { wypelniona: await ankietaWypelniona(user.id), dostepna: !!(await zaliczonePodejscie(user.id)) };
  const certyfikaty = await zaswiadczeniaUczestnika(user.id);
  const regulyMap = new Map((await reguly()).map((r) => [r.profession, r]));
  return {
    wlaczone: k.wlaczone,
    godziny: k.godziny,
    tytul: k.tytul,
    cwiczeniaWymagane: k.cwiczeniaWymagane,
    regulaminOpublikowany: k.regulaminOpublikowany,
    pwzTryb: k.pwzTryb,
    zapisy: zapisy.map((z) => {
      const r = regulyMap.get(z.profession);
      const p = obliczPunkty(r ? regulaZWiersza(r) : null, k.godziny, true);
      return { ...widokZapisu(z), punkty: p.punkty, powodBezPunktow: p.powod };
    }),
    moduly,
    test: { odblokowany: test.odblokowany, stan: test.stan, zasady: test.zasady, pulaPusta: test.pulaPusta, podejscia: test.podejscia },
    ankieta,
    zaswiadczenia: certyfikaty.map(widokZaswiadczenia),
  };
}

export async function programSzkolenia(): Promise<string | null> {
  const [d] = await db.select().from(courseDocuments).where(eq(courseDocuments.key, "program"));
  return d?.contentMd?.trim() ? d.contentMd : null;
}

// ── Usunięcie konta ───────────────────────────────────────────────────────────

/**
 * Przy usunięciu konta (w transakcji usuwania): osoba bez zapisu na szkolenie nie zostawia śladu
 * w tabelach szkolenia. Uczestnik zostaje w rejestrze (5 lat): user_id = NULL przez klucz obcy.
 */
export async function usunSladyBezZapisu(tx: Tx, userId: string) {
  if (await czyUczestnik(userId, tx)) return;
  await tx.delete(cmeLectureProgress).where(eq(cmeLectureProgress.participantId, userId));
  await tx.delete(cmeModuleProgress).where(eq(cmeModuleProgress.participantId, userId));
  await tx.delete(cmeTestAttempts).where(eq(cmeTestAttempts.participantId, userId));
  await tx.delete(cmeLog).where(eq(cmeLog.participantId, userId));
}

// ── Panel admina ──────────────────────────────────────────────────────────────

export async function listaUczestnikow() {
  const { rows } = await pool.query(`
    SELECT e.*, u.email,
      (SELECT count(*) FROM cme_module_progress mp JOIN modules m ON m.id = mp.module_id WHERE mp.participant_id = e.participant_id AND mp.completed_at IS NOT NULL AND m.cme)::int AS moduly_ukonczone,
      (SELECT json_build_object('procent', t.percent, 'zaliczony', t.passed, 'at', t.submitted_at) FROM cme_test_attempts t
         WHERE t.participant_id = e.participant_id AND t.submitted_at IS NOT NULL ORDER BY t.passed DESC, t.submitted_at DESC LIMIT 1) AS test,
      (SELECT count(*) FROM cme_test_attempts t WHERE t.participant_id = e.participant_id)::int AS podejscia,
      (SELECT c.number FROM cme_certificates c WHERE c.enrollment_id = e.id AND c.valid ORDER BY c.issued_at DESC LIMIT 1) AS zaswiadczenie
    FROM cme_enrollments e LEFT JOIN users u ON u.id = e.user_id
    ORDER BY e.created_at DESC`);
  const { rows: [{ n }] } = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM modules WHERE cme AND is_visible");
  return {
    modulyWszystkie: n,
    uczestnicy: rows.map((r: any) => ({
      id: r.id, participantId: r.participant_id, kontoUsuniete: !r.user_id, email: r.email ?? null,
      zawod: r.profession, zawodNazwa: czyZawod(r.profession) ? NAZWA_ZAWODU[r.profession as Zawod] : r.profession,
      pwz: r.pwz, pwzOstrzezenie: r.pwz_warning, specjalizacja: r.specialization, imie: r.first_name, nazwisko: r.last_name,
      zapisAt: r.created_at, zablokowany: !!r.locked_at, modulyUkonczone: r.moduly_ukonczone, test: r.test, podejscia: r.podejscia, zaswiadczenie: r.zaswiadczenie,
    })),
  };
}

export async function edytujZapis(adminId: string, enrollmentId: string, d: { imie?: string; nazwisko?: string; pwz?: string | null; specjalizacja?: string | null }, powod: string) {
  const [z] = await db.select().from(cmeEnrollments).where(eq(cmeEnrollments.id, enrollmentId));
  if (!z) throw new BladSzkolenia(404, "Nie znaleziono zapisu.");
  const zawod = z.profession as Zawod;
  const zmiany: Record<string, [unknown, unknown]> = {};
  const set: Partial<typeof cmeEnrollments.$inferInsert> = { updatedAt: new Date() };
  if (d.imie !== undefined && d.imie !== z.firstName) { zmiany.imie = [z.firstName, d.imie]; set.firstName = d.imie; }
  if (d.nazwisko !== undefined && d.nazwisko !== z.lastName) { zmiany.nazwisko = [z.lastName, d.nazwisko]; set.lastName = d.nazwisko; }
  if (d.pwz !== undefined) {
    const w = sprawdzPwz(zawod, d.pwz, "ostrzezenie");
    if (w.blad) throw new BladSzkolenia(400, w.blad);
    if (w.pwz !== z.pwz) { zmiany.pwz = [z.pwz, w.pwz]; set.pwz = w.pwz; set.pwzWarning = w.ostrzezenie; }
  }
  if (d.specjalizacja !== undefined) {
    const s = d.specjalizacja?.trim() || null;
    if (s !== z.specialization) { zmiany.specjalizacja = [z.specialization, s]; set.specialization = s; }
  }
  if (!Object.keys(zmiany).length) return widokZapisu(z);
  const [nowy] = await db.transaction(async (tx) => {
    const r = await tx.update(cmeEnrollments).set(set).where(eq(cmeEnrollments.id, z.id)).returning();
    await wpis(tx, { type: "dane_zmienione_admin", participantId: z.participantId, userId: z.userId, enrollmentId: z.id, actorId: adminId, details: { zmiany, powod } });
    return r;
  });
  return widokZapisu(nowy);
}

export async function uniewaznijZaswiadczenie(adminId: string, numer: string, powod: string) {
  const c = await zaswiadczeniePoNumerze(numer);
  if (!c) throw new BladSzkolenia(404, "Nie znaleziono zaświadczenia.");
  if (!c.valid) return c;
  return db.transaction(async (tx) => {
    const [r] = await tx.update(cmeCertificates).set({ valid: false, invalidatedAt: new Date(), invalidatedReason: powod }).where(eq(cmeCertificates.id, c.id)).returning();
    await wpis(tx, { type: "zaswiadczenie_uniewaznione", participantId: c.participantId, userId: c.userId, enrollmentId: c.enrollmentId, actorId: adminId, details: { numer, powod } });
    return r;
  });
}

export async function dziennikUczestnika(participantId: string) {
  const rows = await db.select().from(cmeLog).where(eq(cmeLog.participantId, participantId)).orderBy(asc(cmeLog.at));
  return rows.map((r) => ({ typ: r.type, nazwa: TYPY_ZDARZEN[r.type as TypZdarzenia] ?? r.type, at: r.at, atPL: dataGodzinaPL(r.at), details: r.details, actorId: r.actorId }));
}

/** Lista obecności: wiersz na zapis (osoba × zawód), daty w strefie Polski */
export async function listaObecnosciCsv(): Promise<string> {
  const mods = await db.select({ id: modules.id, externalId: modules.externalId, title: modules.title }).from(modules)
    .where(eq(modules.cme, true)).orderBy(asc(modules.order));
  const zapisy = await db.select().from(cmeEnrollments).orderBy(asc(cmeEnrollments.lastName), asc(cmeEnrollments.firstName));
  const { rows: ukonczenia } = await pool.query<{ participant_id: string; module_id: string; at: Date }>(
    `SELECT participant_id, details->>'moduleId' AS module_id, min(at) AS at FROM cme_log WHERE type = 'modul_ukonczony' GROUP BY 1, 2`);
  const { rows: testy } = await pool.query<{ participant_id: string; submitted_at: Date; percent: string; passed: boolean }>(
    `SELECT DISTINCT ON (participant_id) participant_id, submitted_at, percent, passed FROM cme_test_attempts
      WHERE submitted_at IS NOT NULL ORDER BY participant_id, passed DESC, submitted_at ASC`);
  const certy = await db.select().from(cmeCertificates).where(eq(cmeCertificates.valid, true));
  const naglowek = ["Imię", "Nazwisko", "Zawód", "PWZ", "Specjalizacja", "Data zapisu",
    ...mods.map((m) => `Ukończenie ${m.externalId ?? ""} ${m.title}`.trim()),
    "Data testu", "Wynik testu (%)", "Test zaliczony", "Numer zaświadczenia", "Punkty", "Konto usunięte"];
  const linie = [naglowek.map(komorkaCsv).join(";")];
  for (const z of zapisy) {
    const t = testy.find((x) => x.participant_id === z.participantId);
    const c = certy.find((x) => x.enrollmentId === z.id);
    const wiersz = [
      z.firstName, z.lastName, czyZawod(z.profession) ? NAZWA_ZAWODU[z.profession] : z.profession, z.pwz ?? "", z.specialization ?? "", dataGodzinaPL(z.createdAt),
      ...mods.map((m) => {
        const u = ukonczenia.find((x) => x.participant_id === z.participantId && x.module_id === m.id);
        return u ? dataGodzinaPL(new Date(u.at)) : "";
      }),
      t ? dataGodzinaPL(new Date(t.submitted_at)) : "", t ? Number(t.percent).toFixed(2).replace(".", ",") : "", t ? (t.passed ? "tak" : "nie") : "",
      c?.number ?? "", c?.points === null || c?.points === undefined ? "" : Number(c.points).toString().replace(".", ","), z.userId ? "" : "tak",
    ];
    linie.push(wiersz.map(komorkaCsv).join(";"));
  }
  return "﻿" + linie.join("\r\n") + "\r\n";
}

/** Raport zbiorczy ankiety: średnie i rozkład skal, odsetek „tak”, lista uwag (bez dat) */
export async function raportAnkiety() {
  const k = await konfiguracja();
  const rows = await db.select().from(cmeSurveyResponses);
  const pytania = k.ankieta.pytania.map((p) => {
    const odp = rows.map((r) => r.answers[p.id]).filter((v) => v !== null && v !== undefined);
    if (p.typ === "skala") {
      const liczby = odp.filter((v): v is number => typeof v === "number");
      const rozklad = [1, 2, 3, 4, 5].map((o) => liczby.filter((v) => v === o).length);
      return { ...p, n: liczby.length, srednia: liczby.length ? Math.round((liczby.reduce((a, b) => a + b, 0) / liczby.length) * 100) / 100 : null, rozklad };
    }
    if (p.typ === "tak_nie") {
      const b = odp.filter((v): v is boolean => typeof v === "boolean");
      return { ...p, n: b.length, tak: b.filter(Boolean).length, nie: b.filter((v) => !v).length };
    }
    return { ...p, n: odp.length, teksty: tasuj(odp.map(String).filter((t) => t.trim())) };
  });
  return { odpowiedzi: rows.length, wersje: Array.from(new Set(rows.map((r) => r.surveyVersion))), pytania };
}

export { dataPL };
export type { StanPodejsc };
