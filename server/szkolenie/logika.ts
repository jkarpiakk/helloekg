import { randomBytes } from "node:crypto";

/**
 * Szkolenie z punktami: czysta logika bez bazy (testy jednostkowe w tests/unit/szkolenie.test.ts).
 * Losowanie testu, ocena, podejścia i przerwa, punkty wg reguły zawodu, numeracja zaświadczeń.
 */

export type Losowe = () => number;

// ── Losowanie testu ──────────────────────────────────────────────────────────

export interface PytanieWPuli {
  id: string;
  /** externalId ze studia (do reguły „wyklucza”) */
  externalId: string | null;
  /** Temat kursu = wykład (minimum 1 pytanie z każdego, jeśli się da) */
  sectionId: string;
  /** Moduł = sekcja studia (proporcje losowania) */
  moduleId: string;
  /** externalId pytań, z którymi to pytanie nie może wystąpić w jednym losowaniu */
  excludes: string[];
}

export function tasuj<T>(tab: readonly T[], los: Losowe = Math.random): T[] {
  const a = [...tab];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(los() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Podział n na grupy proporcjonalnie do wag (metoda największych reszt), z górnym limitem per grupa */
export function podzialProporcjonalny(n: number, wagi: number[], limity: number[] = wagi): number[] {
  const suma = wagi.reduce((a, b) => a + b, 0);
  if (suma === 0 || n <= 0) return wagi.map(() => 0);
  const dokladne = wagi.map((w) => (n * w) / suma);
  const wynik = dokladne.map((x, i) => Math.min(Math.floor(x), limity[i]));
  let reszta = n - wynik.reduce((a, b) => a + b, 0);
  const kolejnosc = dokladne.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  // najpierw największe reszty, potem (gdy limity) kolejne grupy z wolnym miejscem
  while (reszta > 0) {
    let dodano = false;
    for (const { i } of kolejnosc) {
      if (reszta === 0) break;
      if (wynik[i] < limity[i]) {
        wynik[i]++;
        reszta--;
        dodano = true;
      }
    }
    if (!dodano) break;
  }
  return wynik;
}

/**
 * Losuje `n` pytań z puli testu:
 * - proporcjonalnie do udziału modułów (sekcji studia) w puli,
 * - co najmniej 1 pytanie z każdego wykładu, jeśli liczba wykładów ≤ n,
 * - bez par wykluczonych regułą „wyklucza” (w obie strony),
 * - kolejność pytań potasowana.
 * Gdy wykluczenia nie pozwalają wypełnić limitu modułu, brakujące miejsca bierze reszta puli.
 */
export function losujTest(pula: readonly PytanieWPuli[], n: number, los: Losowe = Math.random): PytanieWPuli[] {
  const docelowo = Math.min(Math.max(0, Math.floor(n)), pula.length);
  if (docelowo === 0) return [];

  // Konflikty po id pytania (wyklucza działa w obie strony)
  const poExt = new Map<string, string>();
  for (const q of pula) if (q.externalId) poExt.set(q.externalId, q.id);
  const konflikty = new Map<string, Set<string>>();
  const dodajKonflikt = (a: string, b: string) => {
    if (a === b) return;
    if (!konflikty.has(a)) konflikty.set(a, new Set());
    konflikty.get(a)!.add(b);
  };
  for (const q of pula) {
    for (const ext of q.excludes ?? []) {
      const inne = poExt.get(ext);
      if (inne) {
        dodajKonflikt(q.id, inne);
        dodajKonflikt(inne, q.id);
      }
    }
  }

  const wybrane = new Map<string, PytanieWPuli>();
  const wolno = (q: PytanieWPuli) => !wybrane.has(q.id) && !Array.from(konflikty.get(q.id) ?? []).some((x) => wybrane.has(x));
  const wez = (q: PytanieWPuli) => wybrane.set(q.id, q);

  // Moduły i wykłady
  const moduly = Array.from(new Set(pula.map((q) => q.moduleId)));
  const wModule = (m: string) => pula.filter((q) => q.moduleId === m);
  const wyklady = Array.from(new Set(pula.map((q) => q.sectionId)));
  const minimumWykladow = wyklady.length <= docelowo;

  // Limit per moduł: proporcja, ale nie mniej niż liczba wykładów modułu (gdy gwarantujemy minimum)
  const rozmiary = moduly.map((m) => wModule(m).length);
  let limity = podzialProporcjonalny(docelowo, rozmiary);
  if (minimumWykladow) {
    const min = moduly.map((m) => new Set(wModule(m).map((q) => q.sectionId)).size);
    limity = limity.map((l, i) => Math.max(l, min[i]));
    // nadwyżkę zabieramy modułom z największym zapasem ponad minimum
    let nadmiar = limity.reduce((a, b) => a + b, 0) - docelowo;
    while (nadmiar > 0) {
      let k = -1;
      for (let i = 0; i < limity.length; i++) {
        if (limity[i] > min[i] && (k === -1 || limity[i] - min[i] > limity[k] - min[k])) k = i;
      }
      if (k === -1) break;
      limity[k]--;
      nadmiar--;
    }
  }

  // 1. Po jednym pytaniu z każdego wykładu
  if (minimumWykladow) {
    for (const w of tasuj(wyklady, los)) {
      const kandydat = tasuj(pula.filter((q) => q.sectionId === w), los).find(wolno);
      if (kandydat) wez(kandydat);
    }
  }
  // 2. Dopełnienie modułów do limitu
  moduly.forEach((m, i) => {
    let ile = limity[i] - Array.from(wybrane.values()).filter((q) => q.moduleId === m).length;
    for (const q of tasuj(wModule(m), los)) {
      if (ile <= 0) break;
      if (wolno(q)) {
        wez(q);
        ile--;
      }
    }
  });
  // 3. Brakujące miejsca (wykluczenia) z całej puli
  for (const q of tasuj(pula, los)) {
    if (wybrane.size >= docelowo) break;
    if (wolno(q)) wez(q);
  }
  return tasuj(Array.from(wybrane.values()).slice(0, docelowo), los);
}

// ── Ocena ────────────────────────────────────────────────────────────────────

export interface PytanieDoOceny {
  id: string;
  externalId: string | null;
  answers: Array<{ text: string; isCorrect: boolean }>;
}

export interface WynikTestu {
  wynik: number;
  maks: number;
  procent: number;
  zaliczony: boolean;
  oceny: Array<{ questionId: string; externalId: string | null; chosen: number | null; correct: number[]; ok: boolean }>;
}

/**
 * Ocena po identyfikatorze odpowiedzi (indeks odpowiedzi w bazie, nie pozycja na ekranie).
 * Brak odpowiedzi albo indeks spoza listy = błędna. Próg w procentach (≥ próg zalicza).
 */
export function ocenTest(pytania: readonly PytanieDoOceny[], odpowiedzi: Record<string, unknown>, progProcent: number): WynikTestu {
  const oceny = pytania.map((q) => {
    const v = odpowiedzi[q.id];
    const chosen = typeof v === "number" && Number.isInteger(v) && v >= 0 && v < q.answers.length ? v : null;
    const correct = q.answers.map((a, i) => (a.isCorrect ? i : -1)).filter((i) => i >= 0);
    return { questionId: q.id, externalId: q.externalId, chosen, correct, ok: chosen !== null && correct.includes(chosen) };
  });
  const wynik = oceny.filter((o) => o.ok).length;
  const maks = pytania.length;
  const procent = maks ? Math.round((wynik / maks) * 10000) / 100 : 0;
  return { wynik, maks, procent, zaliczony: maks > 0 && procent >= progProcent, oceny };
}

// ── Podejścia i przerwa ──────────────────────────────────────────────────────

export interface ZasadyPodejsc {
  limit: number;
  /** Po którym niezaliczonym podejściu (i każdym kolejnym) jest przerwa */
  przerwaPo: number;
  przerwaGodziny: number;
}

export interface Podejscie {
  submittedAt: Date | null;
  passed: boolean | null;
}

export type StanPodejsc =
  | { stan: "zaliczony"; wykorzystane: number; pozostale: number }
  | { stan: "w_toku"; wykorzystane: number; pozostale: number }
  | { stan: "mozna"; wykorzystane: number; pozostale: number }
  | { stan: "przerwa"; wykorzystane: number; pozostale: number; od: Date }
  | { stan: "wyczerpane"; wykorzystane: number; pozostale: 0 };

export function stanPodejsc(podejscia: readonly Podejscie[], teraz: Date, z: ZasadyPodejsc): StanPodejsc {
  const oddane = podejscia.filter((p) => p.submittedAt).sort((a, b) => a.submittedAt!.getTime() - b.submittedAt!.getTime());
  // podejście rozpoczęte, nieoddane: liczy się jako wykorzystane (nowe losowanie dopiero po oddaniu)
  const wykorzystane = podejscia.length;
  const pozostale = Math.max(0, z.limit - wykorzystane);
  if (oddane.some((p) => p.passed)) return { stan: "zaliczony", wykorzystane, pozostale };
  if (podejscia.some((p) => !p.submittedAt)) return { stan: "w_toku", wykorzystane, pozostale };
  if (wykorzystane >= z.limit) return { stan: "wyczerpane", wykorzystane, pozostale: 0 };
  const niezaliczone = oddane.filter((p) => p.passed === false);
  if (niezaliczone.length >= z.przerwaPo && z.przerwaGodziny > 0) {
    const ostatnie = niezaliczone[niezaliczone.length - 1].submittedAt!;
    const od = new Date(ostatnie.getTime() + z.przerwaGodziny * 3600_000);
    if (teraz < od) return { stan: "przerwa", wykorzystane, pozostale, od };
  }
  return { stan: "mozna", wykorzystane, pozostale };
}

// ── Punkty wg reguły zawodu ──────────────────────────────────────────────────

export interface RegulaPunktow {
  profession: string;
  active: boolean;
  pointsPerHour: number;
  maxPoints: number | null;
  minHours: number | null;
  testRequired: boolean;
  registryRequired: boolean;
  registryNumber: string | null;
  inactiveReason: string | null;
}

/** Reguła działa: włączona i (gdy wymaga) z numerem wpisu do rejestru / decyzji */
export const regulaDziala = (r: RegulaPunktow): boolean =>
  r.active && (!r.registryRequired || !!r.registryNumber?.trim());

export type Punkty = { punkty: number; powod: null } | { punkty: null; powod: string };

export function obliczPunkty(r: RegulaPunktow | null | undefined, godziny: number, testZaliczony: boolean): Punkty {
  if (!r) return { punkty: null, powod: "Dla tego zawodu szkolenie nie daje punktów edukacyjnych." };
  if (!regulaDziala(r)) {
    const domyslny = r.registryRequired && r.active
      ? "Brakuje numeru wpisu organizatora do rejestru, więc zaświadczenie nie daje punktów edukacyjnych."
      : "Dla tego zawodu szkolenie nie daje jeszcze punktów edukacyjnych.";
    return { punkty: null, powod: r.inactiveReason?.trim() || domyslny };
  }
  if (r.testRequired && !testZaliczony) return { punkty: null, powod: "Punkty przysługują po zaliczeniu testu końcowego." };
  if (r.minHours !== null && godziny < r.minHours) {
    return { punkty: null, powod: `Szkolenie trwa krócej niż wymagane ${r.minHours} h, więc nie daje punktów edukacyjnych.` };
  }
  let p = godziny * r.pointsPerHour;
  if (r.maxPoints !== null) p = Math.min(p, r.maxPoints);
  p = Math.round(p * 100) / 100;
  if (p <= 0) return { punkty: null, powod: r.inactiveReason?.trim() || "Dla tego zawodu szkolenie nie daje punktów edukacyjnych." };
  return { punkty: p, powod: null };
}

// ── Numeracja zaświadczeń ────────────────────────────────────────────────────

export const PREFIKS_NUMERU = "HE";
export const NUMER_RE = /^HE-(\d{4})-(\d{6})$/;

/** HE-2026-000001 */
export function numerZaswiadczenia(rok: number, kolejny: number): string {
  if (!Number.isInteger(rok) || rok < 2000 || rok > 9999) throw new Error("Nieprawidłowy rok");
  if (!Number.isInteger(kolejny) || kolejny < 1 || kolejny > 999_999) throw new Error("Nieprawidłowy numer kolejny");
  return `${PREFIKS_NUMERU}-${rok}-${String(kolejny).padStart(6, "0")}`;
}

export const czyNumerZaswiadczenia = (v: unknown): v is string => typeof v === "string" && NUMER_RE.test(v);

/**
 * Klucz publicznej weryfikacji: 128 losowych bitów (base64url, 22 znaki). Kolejny numer zaświadczenia
 * da się zgadnąć, więc publiczna strona i kod QR działają wyłącznie po tym kluczu.
 */
export const tokenWeryfikacji = (): string => randomBytes(16).toString("base64url");
export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

/** Parametr z adresu /zaswiadczenie/<klucz> → klucz do wyszukania albo null (sam numer HE-… nie wystarcza) */
export const kluczWeryfikacji = (v: unknown): string | null => (typeof v === "string" && TOKEN_RE.test(v) ? v : null);

/** Rok numeracji: według daty wydania w strefie Polski (zaświadczenie z 31.12 po 23:00 UTC jest już z nowego roku) */
export function rokWPolsce(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", year: "numeric" }).format(d));
}

/** Data w strefie Polski: 11.11.2026 */
export function dataPL(d: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Data i godzina w strefie Polski: 11.11.2026, 14:05 */
export function dataGodzinaPL(d: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Widok publicznej weryfikacji: tylko numer, ważność, tytuł, data i inicjały (bez PWZ, zawodu, pełnego nazwiska) */
export function widokWeryfikacji(c: { number: string; valid: boolean; issuedAt: Date; snapshot: Record<string, unknown> }, inicjalyFn: (i: string, n: string) => string) {
  const s = c.snapshot as { imie?: string; nazwisko?: string; tytul?: string };
  return {
    numer: c.number,
    wazne: c.valid,
    tytul: String(s.tytul ?? ""),
    dataWydania: dataPL(c.issuedAt),
    inicjaly: inicjalyFn(String(s.imie ?? ""), String(s.nazwisko ?? "")),
  };
}
