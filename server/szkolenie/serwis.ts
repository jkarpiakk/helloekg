/**
 * Szkolenie z punktami edukacyjnymi: operacje na bazie (zapis, dziennik, wykłady, moduły, test,
 * ankieta, zaświadczenia, panel). Czysta logika: ./logika.ts. Trasy: ./trasy.ts.
 *
 * participant_id = id konta w chwili zdarzenia (bez klucza obcego): po usunięciu konta dziennik,
 * zapis, podejścia i zaświadczenia osoby z zaświadczeniem dalej należą do jednej osoby.
 * Przechowywanie: 5 lat od końca roku wydania zaświadczenia (czyscPrzeterminowane).
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
  kluczWeryfikacji,
  losujTest,
  numerZaswiadczenia,
  obliczPunkty,
  ocenTest,
  poTerminie,
  powodOdrzuceniaPytaniaTestu,
  przechowywanieMinelo,
  regulaDziala,
  rokWPolsce,
  stanPodejsc,
  tasuj,
  terminOddania,
  tokenWeryfikacji,
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
  pwz_sprawdzony: "PWZ sprawdzony w publicznym rejestrze",
  pwz_sprawdzenie_cofniete: "Cofnięte sprawdzenie PWZ",
  konto_usuniete: "Konto usunięte (rejestr szkolenia zostaje)",
} as const;
export type TypZdarzenia = keyof typeof TYPY_ZDARZEN;

// ── Konfiguracja ──────────────────────────────────────────────────────────────

export async function konfiguracja() {
  return {
    wlaczone: await ustawienie("szkolenie_wlaczone"),
    cwiczeniaWymagane: await ustawienie("cwiczenia_wymagane"),
    regulaminOpublikowany: await ustawienie("regulamin_szkolenia_opublikowany"),
    weryfikacjaReczna: await ustawienie("weryfikacja_pwz_reczna"),
    weryfikacjaDni: await ustawienie("weryfikacja_pwz_dni"),
    godziny: await ustawienie("cme_godziny"),
    test: {
      liczbaPytan: await ustawienie("cme_test_liczba_pytan"),
      prog: await ustawienie("cme_test_prog_procent"),
      limit: await ustawienie("cme_test_limit_podejsc"),
      przerwaPo: await ustawienie("cme_test_przerwa_po"),
      przerwaGodziny: await ustawienie("cme_test_przerwa_godziny"),
      limitMinut: await ustawienie("test_limit_minut"),
      wglad: await ustawienie("test_wglad"),
    },
    tytul: await ustawienie("cme_tytul"),
    forma: await ustawienie("cme_forma"),
    miejsce: await ustawienie("cme_miejsce"),
    organizator: (await ustawienie("cme_organizator")) as Organizator,
    kierownikNaukowy: await ustawienie("cme_kierownik_naukowy"),
    kierownikNaukowyTytul: await ustawienie("cme_kierownik_naukowy_tytul"),
    podpisujacy: await ustawienie("cme_organizator_podpisujacy"),
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
    pwzUwaga: z.pwzWarning,
    pwzSprawdzonyAt: z.pwzVerifiedAt,
    specjalizacja: z.specialization,
    izba: z.chamber,
    imie: z.firstName,
    nazwisko: z.lastName,
    oswiadczenieAt: z.declarationAt,
    zablokowany: !!z.lockedAt,
  };
}

const ZAWODY_LEKARSKIE: readonly string[] = ["lekarz", "lekarz_dentysta"];

/**
 * Zapis albo zmiana danych (przed pierwszym zaświadczeniem). Kilka zawodów naraz; imię i nazwisko
 * wspólne. Walidacja PWZ twarda (lekarz: cyfra kontrolna NIL; pielęgniarka/położna: 7 cyfr + P/A);
 * ratownik może zaznaczyć „nie mam jeszcze numeru”. Po pierwszym zaświadczeniu imię, nazwisko
 * i PWZ już zapisanych zawodów są zablokowane; nowy zawód można dopisać.
 */
export async function zapisz(user: User, input: ZapisInput) {
  const k = await konfiguracja();
  if (k.regulaminOpublikowany && input.regulamin !== true) {
    throw new BladSzkolenia(400, "Zaakceptuj regulamin szkolenia");
  }
  const zawody = new Map<Zawod, ZapisInput["zawody"][number]>();
  for (const z of input.zawody) zawody.set(z.zawod, z);

  const sprawdzone = new Map<Zawod, { pwz: string | null; uwaga: string | null; specjalizacja: string | null; izba: string | null }>();
  for (const [zawod, z] of Array.from(zawody.entries())) {
    const brakNumeru = zawod === "ratownik" && z.brakPwz === true;
    const w = sprawdzPwz(zawod, z.pwz, { brakNumeru });
    if (w.blad) throw new BladSzkolenia(400, `${NAZWA_ZAWODU[zawod]}: ${w.blad}`);
    const specjalizacja = ZAWODY_ZE_SPECJALIZACJA.includes(zawod) ? (z.specjalizacja?.trim() || null) : null;
    const izba = ZAWODY_LEKARSKIE.includes(zawod) ? (z.izba?.trim() || null) : null;
    sprawdzone.set(zawod, { pwz: w.pwz, uwaga: brakNumeru ? "Ratownik bez numeru PWZ (rejestr w trakcie uruchamiania)" : null, specjalizacja, izba });
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
        if ((byl.chamber ?? null) !== d.izba) await tx.update(cmeEnrollments).set({ chamber: d.izba, updatedAt: teraz }).where(eq(cmeEnrollments.id, byl.id));
        continue;
      }
      if (byl) {
        const zmiany: Record<string, [unknown, unknown]> = {};
        if (byl.firstName !== imie) zmiany.imie = [byl.firstName, imie];
        if (byl.lastName !== nazwisko) zmiany.nazwisko = [byl.lastName, nazwisko];
        if ((byl.pwz ?? null) !== d.pwz) zmiany.pwz = [byl.pwz, d.pwz];
        if ((byl.specialization ?? null) !== d.specjalizacja) zmiany.specjalizacja = [byl.specialization, d.specjalizacja];
        if ((byl.chamber ?? null) !== d.izba) zmiany.izba = [byl.chamber, d.izba];
        if (!Object.keys(zmiany).length) continue;
        // zmiana imienia, nazwiska albo PWZ unieważnia wcześniejsze sprawdzenie w rejestrze
        const sprawdzenieNieaktualne = !!(zmiany.imie || zmiany.nazwisko || zmiany.pwz);
        await tx.update(cmeEnrollments).set({
          firstName: imie, lastName: nazwisko, pwz: d.pwz, pwzWarning: d.uwaga, specialization: d.specjalizacja, chamber: d.izba,
          pwzOverride: false, declarationText: OSWIADCZENIE, declarationAt: teraz, updatedAt: teraz,
          ...(sprawdzenieNieaktualne ? { pwzVerifiedAt: null, pwzVerifiedBy: null } : {}),
        }).where(eq(cmeEnrollments.id, byl.id));
        await wpis(tx, { type: "zapis_zmiana", participantId, userId: user.id, enrollmentId: byl.id, details: { zawod, zmiany, oswiadczenieAt: teraz.toISOString() } });
      } else {
        const [nowy] = await tx.insert(cmeEnrollments).values({
          participantId, userId: user.id, profession: zawod, pwz: d.pwz, pwzWarning: d.uwaga, specialization: d.specjalizacja, chamber: d.izba,
          firstName: imie, lastName: nazwisko, declarationText: OSWIADCZENIE, declarationAt: teraz,
          termsVersion: k.regulaminOpublikowany ? WERSJA_REGULAMINU_SZKOLENIA : null,
        }).returning();
        await wpis(tx, {
          type: "zapis", participantId, userId: user.id, enrollmentId: nowy.id,
          details: { zawod, bezPwz: !d.pwz && zawod === "ratownik", regulamin: nowy.termsVersion, oswiadczenieAt: teraz.toISOString() },
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

type PytanieTestu = {
  id: string; tags: string[] | null; excludes: string[] | null; section_id: string; module_id: string; title: string | null;
  question_type: string; answers: Array<{ text: string; isCorrect: boolean }>;
};

const externalIdZ = (tags: string[] | null | undefined) => (tags ?? []).find((t) => t.startsWith("studio:"))?.slice(7) ?? null;

/** Opublikowane pytania puli testu w modułach szkolenia, podzielone na kwalifikujące się i odrzucone (z powodem) */
async function pulaTestuZRaportem() {
  const { rows } = await pool.query<PytanieTestu>(
    `SELECT q.id, q.tags, q.excludes, q.section_id, s.module_id, q.title, q.question_type, q.answers
       FROM questions q JOIN sections s ON s.id = q.section_id JOIN modules m ON m.id = s.module_id
      WHERE q.pool = 'test' AND q.status = 'published' AND m.cme AND m.is_visible AND s.is_visible`);
  const dobre: PytanieTestu[] = [];
  const odrzucone: Array<{ id: string; externalId: string | null; tytul: string | null; powod: string }> = [];
  for (const r of rows) {
    const powod = powodOdrzuceniaPytaniaTestu({ questionType: r.question_type, answers: r.answers });
    if (powod) odrzucone.push({ id: r.id, externalId: externalIdZ(r.tags), tytul: r.title, powod });
    else dobre.push(r);
  }
  return { dobre, odrzucone };
}

async function pulaTestu(): Promise<PytanieTestu[]> {
  return (await pulaTestuZRaportem()).dobre;
}

/** Panel: ile pytań puli testu się kwalifikuje i które są pominięte (mniej niż 5 odpowiedzi, nie 1 poprawna) */
export async function raportPuliTestu() {
  const { dobre, odrzucone } = await pulaTestuZRaportem();
  return { kwalifikuje: dobre.length, odrzucone };
}

async function podejsciaUczestnika(participantId: string, ex: Wykonawca = db): Promise<CmeTestAttempt[]> {
  return ex.select().from(cmeTestAttempts).where(eq(cmeTestAttempts.participantId, participantId)).orderBy(asc(cmeTestAttempts.startedAt));
}

function zasadyZ(k: Konfiguracja) {
  return { limit: k.test.limit, przerwaPo: k.test.przerwaPo, przerwaGodziny: k.test.przerwaGodziny };
}

/** Ocena i zapis podejścia (w transakcji z blokadą uczestnika) */
async function ocenIZapisz(tx: Tx, a: CmeTestAttempt, user: { id: string } | null, odpowiedzi: Record<string, number>, automatycznie: boolean) {
  const qs = a.questionIds.length
    ? await tx.select({ id: questions.id, tags: questions.tags, answers: questions.answers }).from(questions).where(inArray(questions.id, a.questionIds))
    : [];
  const poId = new Map(qs.map((q) => [q.id, q]));
  // pytanie usunięte w międzyczasie liczy się jako błędne (nie zmniejsza maksimum)
  const doOceny = a.questionIds.map((id) => ({ id, externalId: externalIdZ(poId.get(id)?.tags), answers: poId.get(id)?.answers ?? [] }));
  const prog = Number((a.rules as { prog?: number }).prog ?? 70);
  const w = ocenTest(doOceny, odpowiedzi, prog);
  await tx.update(cmeTestAttempts).set({
    submittedAt: new Date(), autoSubmitted: automatycznie, answers: odpowiedzi, grading: w.oceny,
    score: w.wynik, maxScore: w.maks, percent: w.procent.toFixed(2), passed: w.zaliczony,
  }).where(eq(cmeTestAttempts.id, a.id));
  await wpis(tx, {
    type: "test_oddany", participantId: a.participantId, userId: user?.id ?? a.userId,
    details: { attemptId: a.id, wynik: w.wynik, maks: w.maks, procent: w.procent, zaliczony: w.zaliczony, prog, automatycznie },
  });
}

/** Podejście po terminie (limit czasu + zapas) oddaje się samo: oceniamy odpowiedzi zapisane przed terminem */
async function domknijPoCzasie(participantId: string) {
  const [a] = await db.select().from(cmeTestAttempts).where(and(eq(cmeTestAttempts.participantId, participantId), isNull(cmeTestAttempts.submittedAt)));
  if (!a || !poTerminie(a.deadlineAt, new Date())) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"cme:" + participantId}))`);
    const [swieze] = await tx.select().from(cmeTestAttempts).where(and(eq(cmeTestAttempts.id, a.id), isNull(cmeTestAttempts.submittedAt)));
    if (swieze) await ocenIZapisz(tx, swieze, null, swieze.answers, true);
  });
}

export async function stanTestu(user: User) {
  await domknijPoCzasie(user.id);
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
      id: p.id, nr: i + 1, startedAt: p.startedAt, submittedAt: p.submittedAt, automatycznie: p.autoSubmitted,
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
    /** Termin oddania i czas serwera: odliczanie w przeglądarce nie zależy od jej zegara */
    termin: a.deadlineAt,
    teraz: new Date(),
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
    const start = new Date();
    const [a] = await tx.insert(cmeTestAttempts).values({
      participantId, userId: user.id, questionIds: ids, answerOrders, startedAt: start,
      deadlineAt: terminOddania(start, k.test.limitMinut),
      rules: { ...k.test, losowanie: ids.length, pula: pula.length },
    }).returning();
    await wpis(tx, { type: "test_rozpoczety", participantId, userId: user.id, details: { attemptId: a.id, nr: podejscia.length + 1, pytan: ids.length, limitMinut: k.test.limitMinut } });
    return widokPodejscia(a);
  });
}

async function podejscieUzytkownika(user: User, attemptId: string, ex: Wykonawca = db) {
  const [a] = await ex.select().from(cmeTestAttempts).where(and(eq(cmeTestAttempts.id, attemptId), eq(cmeTestAttempts.participantId, user.id)));
  if (!a) throw new BladSzkolenia(404, "Nie znaleziono podejścia.");
  return a;
}

export async function otwartePodejscie(user: User) {
  await domknijPoCzasie(user.id);
  const [a] = await db.select().from(cmeTestAttempts).where(and(eq(cmeTestAttempts.participantId, user.id), isNull(cmeTestAttempts.submittedAt)));
  return a ? widokPodejscia(a) : null;
}

/** Zapis odpowiedzi w trakcie (bez oceny i bez informacji zwrotnej); po terminie już nie */
export async function zapiszOdpowiedzTestu(user: User, attemptId: string, questionId: string, answerIndex: number) {
  const a = await podejscieUzytkownika(user, attemptId);
  if (a.submittedAt) throw new BladSzkolenia(409, "To podejście jest już oddane.");
  if (poTerminie(a.deadlineAt, new Date())) {
    await domknijPoCzasie(user.id);
    throw new BladSzkolenia(409, "Czas na test minął. Podejście zostało oddane z odpowiedziami zapisanymi przed końcem czasu.");
  }
  if (!a.questionIds.includes(questionId)) throw new BladSzkolenia(400, "To pytanie nie należy do tego podejścia.");
  if (!(a.answerOrders[questionId] ?? []).includes(answerIndex)) throw new BladSzkolenia(400, "Nieprawidłowa odpowiedź.");
  await db.update(cmeTestAttempts)
    .set({ answers: sql`${cmeTestAttempts.answers} || ${JSON.stringify({ [questionId]: answerIndex })}::jsonb` })
    .where(and(eq(cmeTestAttempts.id, a.id), isNull(cmeTestAttempts.submittedAt)));
}

/**
 * Oddanie testu. W terminie (limit + zapas) liczą się odpowiedzi z oddania i zapisane w trakcie.
 * Po terminie odpowiedzi z oddania są pomijane: oceniamy tylko te zapisane przed końcem czasu.
 */
export async function oddajTest(user: User, attemptId: string, odpowiedzi?: Record<string, unknown>) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"cme:" + user.id}))`);
    const a = await podejscieUzytkownika(user, attemptId, tx);
    if (a.submittedAt) throw new BladSzkolenia(409, "To podejście jest już oddane.");
    const poCzasie = poTerminie(a.deadlineAt, new Date());
    const scalone: Record<string, number> = { ...a.answers };
    if (!poCzasie) {
      for (const [qid, v] of Object.entries(odpowiedzi ?? {})) {
        if (a.questionIds.includes(qid) && typeof v === "number" && (a.answerOrders[qid] ?? []).includes(v)) scalone[qid] = v;
      }
    }
    await ocenIZapisz(tx, a, user, scalone, poCzasie);
  });
  return wynikPodejscia(user, attemptId);
}

/**
 * Wgląd w ocenione podejście (§ 3 ust. 4 pkt 3 lit. f rozp. MZ z 19.04.2024): przy test_wglad = "pelny"
 * całe podejście (pytania, własne odpowiedzi, klucz, uzasadnienia), przy "bledne" tylko błędne odpowiedzi.
 */
export async function wynikPodejscia(user: User, attemptId: string) {
  const a = await podejscieUzytkownika(user, attemptId);
  if (!a.submittedAt) throw new BladSzkolenia(409, "Podejście nie jest jeszcze oddane.");
  const wglad = await ustawienie("test_wglad");
  const oceny = (a.grading ?? []).filter((o) => wglad === "pelny" || !o.ok);
  const qs = oceny.length
    ? await db.select({ id: questions.id, title: questions.title, bodyMd: questions.bodyMd, imageUrl: questions.imageUrl, answers: questions.answers, explanationMd: questions.explanationMd })
      .from(questions).where(inArray(questions.id, oceny.map((b) => b.questionId)))
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
    automatycznie: a.autoSubmitted,
    wglad,
    pytania: oceny.map((b) => {
      const q = poId.get(b.questionId);
      const kolejnosc = a.answerOrders[b.questionId] ?? [];
      return {
        nr: a.questionIds.indexOf(b.questionId) + 1,
        ok: b.ok,
        title: q?.title ?? "",
        bodyMd: q?.bodyMd ?? "",
        imageUrl: q?.imageUrl ?? null,
        answers: q ? kolejnosc.filter((j) => j < q.answers.length).map((j) => ({ index: j, text: q.answers[j].text })) : [],
        wybrana: b.chosen,
        poprawne: b.correct,
        wyjasnienie: q?.explanationMd ?? "",
      };
    }).sort((x, y) => x.nr - y.nr),
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

const liczbaLubNull = (v: string | null) => (v === null ? null : Number(v));

export const regulaZWiersza = (r: CmeRule): RegulaPunktow => ({
  profession: r.profession,
  active: r.active,
  pointsMode: r.pointsMode === "decyzja" ? "decyzja" : "godziny",
  pointsPerHour: Number(r.pointsPerHour),
  pointsGranted: liczbaLubNull(r.pointsGranted),
  maxPoints: liczbaLubNull(r.maxPoints),
  minHours: liczbaLubNull(r.minHours),
  testRequired: r.testRequired,
  registryRequired: r.registryRequired,
  registryNumber: r.registryNumber,
  nrlResolution: r.nrlResolution,
  formInfoAcceptedAt: r.formInfoAcceptedAt,
  decisionNumber: r.decisionNumber,
  inactiveReason: r.inactiveReason,
});

export async function reguly() {
  const rows = await db.select().from(cmeRules).orderBy(asc(cmeRules.profession));
  return rows.map((r) => ({ ...r, dziala: regulaDziala(regulaZWiersza(r)) }));
}

export async function zapiszRegule(adminId: string, profession: string, d: Partial<{
  active: boolean; legalBasis: string | null; pointsFormula: string | null; pointsMode: "godziny" | "decyzja"; pointsPerHour: number;
  pointsGranted: number | null; maxPoints: number | null; minHours: number | null; testRequired: boolean; registryRequired: boolean;
  registryNumber: string | null; nrlResolution: string | null; formInfoAcceptedAt: string | null; decisionNumber: string | null;
  formText: string | null; inactiveReason: string | null;
}>) {
  if (!czyZawod(profession)) throw new BladSzkolenia(404, "Nieznany zawód.");
  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: adminId };
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue;
    set[k] = ["pointsPerHour", "maxPoints", "minHours", "pointsGranted"].includes(k) && v !== null ? String(v) : v;
  }
  const [r] = await db.insert(cmeRules).values({ profession, ...(set as object) } as any)
    .onConflictDoUpdate({ target: cmeRules.profession, set: set as any }).returning();
  return { ...r, dziala: regulaDziala(regulaZWiersza(r)) };
}

// ── Zaświadczenia ─────────────────────────────────────────────────────────────

export type RodzajZaswiadczenia = "punkty" | "ukonczenie";

export function widokZaswiadczenia(c: CmeCertificate) {
  const s = c.snapshot as Record<string, any>;
  return {
    numer: c.number,
    /** Klucz linku weryfikacji (tylko dla właściciela zaświadczenia i zespołu) */
    klucz: c.verificationToken,
    rodzaj: c.kind as RodzajZaswiadczenia,
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

/** Punkty dla zapisu i czy czeka na ręczne sprawdzenie PWZ (zaświadczenie z punktami dopiero po nim) */
async function punktyZapisu(zapis: CmeEnrollment, k: Konfiguracja) {
  const [wiersz] = await db.select().from(cmeRules).where(eq(cmeRules.profession, zapis.profession));
  const regula = wiersz ? regulaZWiersza(wiersz) : null;
  const punkty = obliczPunkty(regula, k.godziny, true);
  const czekaNaWeryfikacje = punkty.punkty !== null && k.weryfikacjaReczna && !zapis.pwzVerifiedAt;
  return { wiersz, regula, punkty, czekaNaWeryfikacje };
}

/**
 * Wydanie zaświadczenia dla zapisu (zawodu). Rodzaj:
 * - "punkty": reguła zawodu daje punkty i (gdy weryfikacja_pwz_reczna) zespół sprawdził PWZ w rejestrze,
 * - "ukonczenie": bez punktów; jedyne dla zawodów bez punktów, a dla pozostałych do pobrania od razu,
 *   zanim zespół sprawdzi dane.
 * Najwyżej jedno ważne zaświadczenie każdego rodzaju na zawód.
 */
export async function wydajZaswiadczenie(user: User, enrollmentId: string, chciany?: RodzajZaswiadczenia) {
  const k = await konfiguracja();
  if (!user.emailVerified) throw new BladSzkolenia(403, "Potwierdź adres e-mail, żeby odebrać zaświadczenie.");
  const participantId = user.id;
  const [zapis] = await db.select().from(cmeEnrollments).where(and(eq(cmeEnrollments.id, enrollmentId), eq(cmeEnrollments.participantId, participantId)));
  if (!zapis) throw new BladSzkolenia(404, "Nie znaleziono zapisu na szkolenie.");
  const test = await zaliczonePodejscie(participantId);
  if (!test) throw new BladSzkolenia(403, "Zaświadczenie będzie dostępne po zaliczeniu testu.");
  if (!(await ankietaWypelniona(participantId))) throw new BladSzkolenia(403, "Przed zaświadczeniem wypełnij krótką anonimową ankietę.");
  const { wiersz, regula, punkty, czekaNaWeryfikacje } = await punktyZapisu(zapis, k);
  const rodzaj: RodzajZaswiadczenia = punkty.punkty === null ? "ukonczenie" : (chciany ?? "punkty");
  if (rodzaj === "punkty" && czekaNaWeryfikacje) {
    throw new BladSzkolenia(409, `Zaświadczenie z punktami czeka na weryfikację danych (zwykle do ${k.weryfikacjaDni} dni roboczych). Możesz już pobrać zaświadczenie ukończenia bez punktów.`);
  }
  const zPunktami = rodzaj === "punkty";
  const powodBezPunktow = zPunktami ? null : (punkty.powod ?? "Zaświadczenie ukończenia bez punktów edukacyjnych: dane uczestnika czekają na weryfikację.");
  const zapisy = await zapisyUczestnika(participantId);
  const start = zapisy.reduce((min, z) => (z.createdAt < min ? z.createdAt : min), zapis.createdAt);
  const [podpisOrg, podpisKier] = [await ustawienie("cme_podpis_organizator"), await ustawienie("cme_podpis_kierownik")];

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"cme:" + participantId}))`);
    const [jest] = await tx.select().from(cmeCertificates).where(and(
      eq(cmeCertificates.participantId, participantId), eq(cmeCertificates.profession, zapis.profession),
      eq(cmeCertificates.kind, rodzaj), eq(cmeCertificates.valid, true)));
    if (jest) return jest;
    const teraz = new Date();
    const rok = rokWPolsce(teraz);
    // licznik roku w tej samej transakcji: numery bez dziur i bez powtórzeń
    const nr = await tx.execute(sql`INSERT INTO cme_certificate_counters (year, last) VALUES (${rok}, 1)
      ON CONFLICT (year) DO UPDATE SET last = cme_certificate_counters.last + 1 RETURNING last`);
    const numer = numerZaswiadczenia(rok, Number((nr.rows[0] as { last: number }).last));
    // dane zapisu blokują się przy pierwszym zaświadczeniu (wszystkie zawody tej osoby)
    await tx.update(cmeEnrollments).set({ lockedAt: teraz }).where(and(eq(cmeEnrollments.participantId, participantId), isNull(cmeEnrollments.lockedAt)));
    const snapshot = {
      rodzaj,
      imie: zapis.firstName,
      nazwisko: zapis.lastName,
      zawod: zapis.profession,
      zawodNazwa: czyZawod(zapis.profession) ? NAZWA_ZAWODU[zapis.profession] : zapis.profession,
      pwz: zapis.pwz,
      pwzSprawdzonyAt: zapis.pwzVerifiedAt?.toISOString() ?? null,
      specjalizacja: zapis.specialization,
      tytul: k.tytul,
      forma: zPunktami && wiersz?.formText?.trim() ? wiersz.formText : k.forma,
      miejsce: k.miejsce,
      godziny: k.godziny,
      dataRozpoczecia: start.toISOString(),
      dataZakonczenia: (test.submittedAt ?? teraz).toISOString(),
      wynikTestu: { wynik: test.score, maks: test.maxScore, procent: test.percent === null ? null : Number(test.percent) },
      punkty: zPunktami ? punkty.punkty : null,
      powodBezPunktow,
      organizator: k.organizator,
      podpisujacy: k.podpisujacy,
      kierownikNaukowy: k.kierownikNaukowy,
      kierownikNaukowyTytul: k.kierownikNaukowyTytul,
      podpisOrganizatora: podpisOrg || null,
      podpisKierownika: podpisKier || null,
    };
    const ruleSnapshot = wiersz ? { ...wiersz, dziala: regulaDziala(regula!) } : { profession: zapis.profession, brak: true };
    const [c] = await tx.insert(cmeCertificates).values({
      number: numer, verificationToken: tokenWeryfikacji(), participantId, userId: user.id, enrollmentId: zapis.id,
      profession: zapis.profession, kind: rodzaj, snapshot, ruleSnapshot: ruleSnapshot as Record<string, unknown>,
      points: zPunktami && punkty.punkty !== null ? punkty.punkty.toFixed(2) : null, hours: String(k.godziny), testAttemptId: test.id, issuedAt: teraz,
    }).returning();
    await wpis(tx, { type: "zaswiadczenie_wydane", participantId, userId: user.id, enrollmentId: zapis.id, details: { numer, rodzaj, zawod: zapis.profession, punkty: snapshot.punkty } });
    return c;
  });
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
  const widokiZapisow = [];
  for (const z of zapisy) {
    const p = await punktyZapisu(z, k);
    widokiZapisow.push({ ...widokZapisu(z), punkty: p.punkty.punkty, powodBezPunktow: p.punkty.powod, czekaNaWeryfikacje: p.czekaNaWeryfikacje });
  }
  return {
    wlaczone: k.wlaczone,
    godziny: k.godziny,
    tytul: k.tytul,
    cwiczeniaWymagane: k.cwiczeniaWymagane,
    regulaminOpublikowany: k.regulaminOpublikowany,
    weryfikacjaDni: k.weryfikacjaDni,
    zapisy: widokiZapisow,
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

// ── Usunięcie konta i przechowywanie ──────────────────────────────────────────

async function usunUczestnika(ex: Wykonawca, participantIds: string[]) {
  if (!participantIds.length) return;
  await ex.delete(cmeCertificates).where(inArray(cmeCertificates.participantId, participantIds));
  await ex.delete(cmeLog).where(inArray(cmeLog.participantId, participantIds));
  await ex.delete(cmeTestAttempts).where(inArray(cmeTestAttempts.participantId, participantIds));
  await ex.delete(cmeLectureProgress).where(inArray(cmeLectureProgress.participantId, participantIds));
  await ex.delete(cmeModuleProgress).where(inArray(cmeModuleProgress.participantId, participantIds));
  await ex.delete(cmeEnrollments).where(inArray(cmeEnrollments.participantId, participantIds));
}

/**
 * Przy usunięciu konta (w transakcji usuwania):
 * - osoba bez żadnego zaświadczenia: wszystkie jej dane szkolenia znikają razem z kontem;
 * - osoba z zaświadczeniem: zostaje rejestr (zapis, dziennik, wynik testu, zaświadczenia) na 5 lat od końca
 *   roku wydania; z podejść znika treść odpowiedzi (zostaje data, wynik, zaliczenie), znikają ślady czytania.
 *   user_id dostaje NULL przez klucz obcy.
 */
export async function przyUsunieciuKonta(tx: Tx, userId: string) {
  const [c] = await tx.select({ id: cmeCertificates.id }).from(cmeCertificates).where(eq(cmeCertificates.participantId, userId)).limit(1);
  if (!c) return usunUczestnika(tx, [userId]);
  await tx.update(cmeTestAttempts).set({ answers: {}, answerOrders: {}, grading: null, questionIds: [] }).where(eq(cmeTestAttempts.participantId, userId));
  await tx.delete(cmeLectureProgress).where(eq(cmeLectureProgress.participantId, userId));
  await tx.delete(cmeModuleProgress).where(eq(cmeModuleProgress.participantId, userId));
  await wpis(tx, { type: "konto_usuniete", participantId: userId, userId, details: {} });
}

/**
 * Przeglądanie i usuwanie rejestru po okresie przechowywania (server/scripts/szkolenieRetencja.ts,
 * panel → Szkolenie → Ustawienia). Dotyczy osób bez konta (usuniętego): gdy nie mają zaświadczenia albo
 * gdy minęło 5 lat od końca roku wydania ostatniego zaświadczenia. Konta istniejące nie są ruszane.
 */
export async function czyscPrzeterminowane(opts: { proba: boolean; teraz?: Date }) {
  const teraz = opts.teraz ?? new Date();
  const { rows } = await pool.query<{ participant_id: string; wydania: Date[] | null }>(`
    SELECT e.participant_id, array_remove(array_agg(DISTINCT c.issued_at), NULL) AS wydania
      FROM cme_enrollments e LEFT JOIN cme_certificates c ON c.participant_id = e.participant_id
     GROUP BY e.participant_id
    HAVING bool_and(e.user_id IS NULL) AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.participant_id)`);
  const doUsuniecia = rows.filter((r) => przechowywanieMinelo((r.wydania ?? []).map((d) => new Date(d)), teraz)).map((r) => r.participant_id);
  if (!opts.proba && doUsuniecia.length) await db.transaction(async (tx) => usunUczestnika(tx, doUsuniecia));
  return { sprawdzone: rows.length, doUsuniecia: doUsuniecia.length, usunieto: opts.proba ? 0 : doUsuniecia.length };
}

// ── Panel admina ──────────────────────────────────────────────────────────────

export async function listaUczestnikow() {
  const { rows } = await pool.query(`
    SELECT e.*, u.email, v.email AS verified_by_email,
      (SELECT count(*) FROM cme_module_progress mp JOIN modules m ON m.id = mp.module_id WHERE mp.participant_id = e.participant_id AND mp.completed_at IS NOT NULL AND m.cme)::int AS moduly_ukonczone,
      (SELECT count(*) FROM cme_log l WHERE l.participant_id = e.participant_id AND l.type = 'modul_ukonczony')::int AS moduly_w_dzienniku,
      (SELECT json_build_object('procent', t.percent, 'zaliczony', t.passed, 'at', t.submitted_at) FROM cme_test_attempts t
         WHERE t.participant_id = e.participant_id AND t.submitted_at IS NOT NULL ORDER BY t.passed DESC, t.submitted_at DESC LIMIT 1) AS test,
      (SELECT count(*) FROM cme_test_attempts t WHERE t.participant_id = e.participant_id)::int AS podejscia,
      (SELECT json_agg(json_build_object('numer', c.number, 'rodzaj', c.kind) ORDER BY c.issued_at) FROM cme_certificates c WHERE c.enrollment_id = e.id AND c.valid) AS zaswiadczenia
    FROM cme_enrollments e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN users v ON v.id = e.pwz_verified_by
    ORDER BY e.created_at DESC`);
  const { rows: [{ n }] } = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM modules WHERE cme AND is_visible");
  return {
    modulyWszystkie: n,
    uczestnicy: rows.map((r: any) => ({
      id: r.id, participantId: r.participant_id, kontoUsuniete: !r.user_id, email: r.email ?? null,
      zawod: r.profession, zawodNazwa: czyZawod(r.profession) ? NAZWA_ZAWODU[r.profession as Zawod] : r.profession,
      pwz: r.pwz, pwzUwaga: r.pwz_warning, pwzOverride: r.pwz_override, pwzSprawdzonyAt: r.pwz_verified_at, pwzSprawdzil: r.verified_by_email ?? null,
      specjalizacja: r.specialization, izba: r.chamber, imie: r.first_name, nazwisko: r.last_name,
      zapisAt: r.created_at, zablokowany: !!r.locked_at, modulyUkonczone: Math.max(r.moduly_ukonczone, r.moduly_w_dzienniku),
      test: r.test, podejscia: r.podejscia, zaswiadczenia: r.zaswiadczenia ?? [],
    })),
  };
}

/** Zespół: zmiana danych zapisu z powodem w dzienniku; `pominWalidacje` = wyjątek od formatu PWZ (np. PWZ warunkowe) */
export async function edytujZapis(adminId: string, enrollmentId: string, d: { imie?: string; nazwisko?: string; pwz?: string | null; specjalizacja?: string | null; izba?: string | null; pominWalidacje?: boolean }, powod: string) {
  const [z] = await db.select().from(cmeEnrollments).where(eq(cmeEnrollments.id, enrollmentId));
  if (!z) throw new BladSzkolenia(404, "Nie znaleziono zapisu.");
  const zawod = z.profession as Zawod;
  const zmiany: Record<string, [unknown, unknown]> = {};
  const set: Partial<typeof cmeEnrollments.$inferInsert> = { updatedAt: new Date() };
  if (d.imie !== undefined && d.imie !== z.firstName) { zmiany.imie = [z.firstName, d.imie]; set.firstName = d.imie; }
  if (d.nazwisko !== undefined && d.nazwisko !== z.lastName) { zmiany.nazwisko = [z.lastName, d.nazwisko]; set.lastName = d.nazwisko; }
  if (d.pwz !== undefined) {
    const surowy = (d.pwz ?? "").replace(/\s+/g, "").toUpperCase() || null;
    let nowy: string | null;
    if (d.pominWalidacje) {
      if (surowy && !/^[0-9A-Z]{1,20}$/.test(surowy)) throw new BladSzkolenia(400, "Numer może mieć tylko cyfry i litery (do 20 znaków).");
      nowy = surowy;
    } else {
      const w = sprawdzPwz(zawod, surowy, { brakNumeru: zawod === "ratownik" && !surowy });
      if (w.blad) throw new BladSzkolenia(400, `${w.blad} Wyjątek: zaznacz „pomiń walidację”.`);
      nowy = w.pwz;
    }
    if (nowy !== z.pwz || !!d.pominWalidacje !== z.pwzOverride) {
      zmiany.pwz = [z.pwz, nowy];
      set.pwz = nowy;
      set.pwzOverride = !!d.pominWalidacje;
      set.pwzWarning = d.pominWalidacje ? "Numer wpisany przez zespół z pominięciem walidacji formatu" : null;
    }
  }
  if (d.specjalizacja !== undefined) {
    const s = d.specjalizacja?.trim() || null;
    if (s !== z.specialization) { zmiany.specjalizacja = [z.specialization, s]; set.specialization = s; }
  }
  if (d.izba !== undefined) {
    const i = d.izba?.trim() || null;
    if (i !== z.chamber) { zmiany.izba = [z.chamber, i]; set.chamber = i; }
  }
  if (!Object.keys(zmiany).length) return widokZapisu(z);
  // zmiana danych osobowych: sprawdzenie w rejestrze trzeba zrobić od nowa
  if (zmiany.imie || zmiany.nazwisko || zmiany.pwz) { set.pwzVerifiedAt = null; set.pwzVerifiedBy = null; }
  const [nowy] = await db.transaction(async (tx) => {
    const r = await tx.update(cmeEnrollments).set(set).where(eq(cmeEnrollments.id, z.id)).returning();
    await wpis(tx, { type: "dane_zmienione_admin", participantId: z.participantId, userId: z.userId, enrollmentId: z.id, actorId: adminId, details: { zmiany, powod, pominWalidacje: !!d.pominWalidacje } });
    return r;
  });
  return widokZapisu(nowy);
}

/** „PWZ sprawdzony w publicznym rejestrze” (NIL / NIPiP): kto i kiedy, wpis w dzienniku; cofnięcie też */
export async function oznaczPwzSprawdzony(adminId: string, enrollmentId: string, sprawdzony: boolean, uwaga?: string) {
  const [z] = await db.select().from(cmeEnrollments).where(eq(cmeEnrollments.id, enrollmentId));
  if (!z) throw new BladSzkolenia(404, "Nie znaleziono zapisu.");
  const teraz = new Date();
  const [r] = await db.transaction(async (tx) => {
    const u = await tx.update(cmeEnrollments).set(sprawdzony ? { pwzVerifiedAt: teraz, pwzVerifiedBy: adminId } : { pwzVerifiedAt: null, pwzVerifiedBy: null })
      .where(eq(cmeEnrollments.id, z.id)).returning();
    await wpis(tx, {
      type: sprawdzony ? "pwz_sprawdzony" : "pwz_sprawdzenie_cofniete", participantId: z.participantId, userId: z.userId, enrollmentId: z.id, actorId: adminId,
      details: { zawod: z.profession, pwz: z.pwz, imie: z.firstName, nazwisko: z.lastName, uwaga: uwaga ?? null },
    });
    return u;
  });
  return widokZapisu(r);
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
  const naglowek = ["Imię", "Nazwisko", "Zawód", "PWZ", "PWZ sprawdzony", "Specjalizacja", "Okręgowa izba lekarska", "Data zapisu",
    ...mods.map((m) => `Ukończenie ${m.externalId ?? ""} ${m.title}`.trim()),
    "Data testu", "Wynik testu (%)", "Test zaliczony", "Numer zaświadczenia", "Punkty", "Konto usunięte"];
  const linie = [naglowek.map(komorkaCsv).join(";")];
  for (const z of zapisy) {
    const t = testy.find((x) => x.participant_id === z.participantId);
    const c = certy.filter((x) => x.enrollmentId === z.id).sort((a, b) => (a.kind === "punkty" ? -1 : 1) - (b.kind === "punkty" ? -1 : 1))[0];
    const wiersz = [
      z.firstName, z.lastName, czyZawod(z.profession) ? NAZWA_ZAWODU[z.profession] : z.profession, z.pwz ?? "",
      z.pwzVerifiedAt ? dataGodzinaPL(z.pwzVerifiedAt) : "", z.specialization ?? "", z.chamber ?? "", dataGodzinaPL(z.createdAt),
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

/**
 * Raport dla okręgowej izby lekarskiej (art. 19 ust. 4 ustawy o zawodach lekarza i lekarza dentysty):
 * lekarze i lekarze dentyści z ważnym zaświadczeniem, opcjonalnie tylko z jednej izby.
 */
export async function raportOrlCsv(izba?: string): Promise<string> {
  const { rows } = await pool.query<{ first_name: string; last_name: string; pwz: string | null; profession: string; chamber: string | null; number: string; points: string | null; kind: string; snapshot: any; issued_at: Date }>(`
    SELECT e.first_name, e.last_name, e.pwz, e.profession, e.chamber, c.number, c.points, c.kind, c.snapshot, c.issued_at
      FROM cme_certificates c JOIN cme_enrollments e ON e.id = c.enrollment_id
     WHERE c.valid AND e.profession IN ('lekarz', 'lekarz_dentysta') AND ($1::text IS NULL OR e.chamber = $1)
     ORDER BY e.last_name, e.first_name, c.issued_at`, [izba?.trim() || null]);
  const naglowek = ["Imię", "Nazwisko", "Numer PWZ", "Zawód", "Okręgowa izba lekarska", "Data ukończenia", "Punkty edukacyjne", "Numer zaświadczenia", "Data wydania"];
  const linie = [naglowek.map(komorkaCsv).join(";")];
  for (const r of rows) {
    linie.push([
      r.first_name, r.last_name, r.pwz ?? "", czyZawod(r.profession) ? NAZWA_ZAWODU[r.profession] : r.profession, r.chamber ?? "",
      r.snapshot?.dataZakonczenia ? dataPL(new Date(r.snapshot.dataZakonczenia)) : "",
      r.points === null ? "bez punktów" : Number(r.points).toString().replace(".", ","), r.number, dataPL(r.issued_at),
    ].map(komorkaCsv).join(";"));
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
