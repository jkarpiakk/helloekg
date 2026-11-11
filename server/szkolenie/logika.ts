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
 * - co najmniej 1 pytanie z każdego wykładu, jeśli liczba wykładów ≤ n (to najpierw, z wykluczeniami
 *   między już wybranymi; wykłady z najmniejszym wyborem pierwsze),
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

  // 1. NAJPIERW po jednym pytaniu z każdego wykładu. Kolejność: zawsze wykład z najmniejszą liczbą
  //    dozwolonych kandydatów (np. wykład z jednym pytaniem w puli). Spośród kandydatów wybieramy losowo,
  //    ale tylko takich, które nie odbierają innemu niepokrytemu wykładowi ostatniego kandydata
  //    (para „wyklucza” między wykładami: S3_02 ma jedno pytanie wykluczane przez pytanie z S1).
  if (minimumWykladow) {
    const niepokryte = new Set(wyklady);
    const dozwoleni = (w: string) => pula.filter((q) => q.sectionId === w && wolno(q));
    while (niepokryte.size) {
      const lista = Array.from(niepokryte).map((w) => ({ w, k: dozwoleni(w) }));
      const bez = lista.filter((x) => x.k.length === 0);
      bez.forEach((x) => niepokryte.delete(x.w)); // nie da się pokryć (wykluczenia): pomijamy
      const z = lista.filter((x) => x.k.length > 0);
      if (!z.length) break;
      const minK = Math.min(...z.map((x) => x.k.length));
      const nast = tasuj(z.filter((x) => x.k.length === minK), los)[0];
      // ile innych niepokrytych wykładów straciłoby ostatniego kandydata po wybraniu q
      const szkoda = (q: PytanieWPuli) => z.filter((x) => x.w !== nast.w
        && x.k.every((c) => c.id === q.id || konflikty.get(q.id)?.has(c.id))).length;
      const kandydaci = tasuj(nast.k, los);
      const najmniej = Math.min(...kandydaci.map(szkoda));
      wez(kandydaci.find((q) => szkoda(q) === najmniej)!);
      niepokryte.delete(nast.w);
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

// ── Pytania testu: warunek § 3 ust. 5 rozp. MZ z 19.04.2024 ────────────────

/** Pytanie testu kwalifikuje się do losowania: jednokrotny wybór, co najmniej 5 odpowiedzi, dokładnie 1 poprawna */
export function powodOdrzuceniaPytaniaTestu(q: { questionType: string; answers: Array<{ text: string; isCorrect: boolean }> | null | undefined }): string | null {
  if (q.questionType !== "multiple_choice") return "to nie jest pytanie jednokrotnego wyboru";
  const odp = Array.isArray(q.answers) ? q.answers : [];
  if (odp.length < 5) return `ma ${odp.length} odpowiedzi, potrzeba co najmniej 5`;
  const poprawne = odp.filter((a) => a.isCorrect).length;
  if (poprawne !== 1) return `ma ${poprawne} poprawnych odpowiedzi, potrzeba dokładnie 1`;
  return null;
}

// ── Limit czasu testu ────────────────────────────────────────────────────────

/** Zapas po terminie na opóźnienia sieci (oddanie w tym czasie jest jeszcze w terminie) */
export const ZAPAS_PO_TERMINIE_MS = 2 * 60_000;

export const terminOddania = (start: Date, limitMinut: number): Date | null =>
  limitMinut > 0 ? new Date(start.getTime() + limitMinut * 60_000) : null;

/** Po terminie i zapasie: odpowiedzi już się nie zapisują, podejście oddaje się samo */
export const poTerminie = (termin: Date | null, teraz: Date): boolean =>
  !!termin && teraz.getTime() > termin.getTime() + ZAPAS_PO_TERMINIE_MS;

// ── Punkty wg reguły zawodu ──────────────────────────────────────────────────

export interface RegulaPunktow {
  profession: string;
  active: boolean;
  /** "godziny": liczone z godzin dydaktycznych; "decyzja": wartość z uchwały NRL / decyzji NRPiP */
  pointsMode: "godziny" | "decyzja";
  pointsPerHour: number;
  pointsGranted: number | null;
  maxPoints: number | null;
  minHours: number | null;
  testRequired: boolean;
  registryRequired: boolean;
  registryNumber: string | null;
  nrlResolution: string | null;
  formInfoAcceptedAt: string | null;
  decisionNumber: string | null;
  inactiveReason: string | null;
  /** Reguła obowiązuje od (RRRR-MM-DD, włącznie); bez tej daty reguła nie daje punktów */
  obowiazujeOd?: string | null;
  /** Reguła obowiązuje do (RRRR-MM-DD, włącznie); puste = bez końca */
  obowiazujeDo?: string | null;
}

/** Numer wpisu do rejestru podmiotów prowadzących kształcenie lekarzy: RR-NNNNNN-00X-ZZZZ */
export const NUMER_WPISU_RE = /^\d{2}-\d{6}-00\d-\d{4}$/;

const jest = (v: string | null | undefined) => !!v && !!v.trim();

/**
 * Czego brakuje, żeby reguła dawała punkty (pusta lista = reguła kompletna):
 * - lekarze (registryRequired): uchwała NRL, numer wpisu w formacie RR-NNNNNN-00X-ZZZZ i data przyjęcia informacji o formie,
 * - punkty z decyzji: przyznana liczba punktów (i numer decyzji, gdy to nie lekarze, np. NRPiP),
 * - każda reguła: data, od której obowiązuje (punkty nie działają wstecz).
 */
export function brakiReguly(r: RegulaPunktow): string[] {
  const braki: string[] = [];
  if (r.registryRequired) {
    if (!jest(r.nrlResolution)) braki.push("uchwała Naczelnej Rady Lekarskiej");
    if (!NUMER_WPISU_RE.test(r.registryNumber?.trim() ?? "")) braki.push("numer wpisu do rejestru (RR-NNNNNN-00X-ZZZZ)");
    if (!jest(r.formInfoAcceptedAt)) braki.push("data przyjęcia informacji o formie kształcenia");
  }
  if (r.pointsMode === "decyzja") {
    if (!((r.pointsGranted ?? 0) > 0)) braki.push("liczba punktów przyznana w uchwale albo decyzji");
    if (!r.registryRequired && !jest(r.decisionNumber)) braki.push("numer decyzji");
  }
  if (!DATA_RE.test(r.obowiazujeOd ?? "")) braki.push("data, od której reguła obowiązuje");
  return braki;
}

/** Reguła działa, gdy jest włączona i ma komplet danych (brakiReguly) */
export function regulaDziala(r: RegulaPunktow): boolean {
  return r.active && brakiReguly(r).length === 0;
}

// ── Okres obowiązywania reguły (punkty nie działają wstecz) ──────────────────

export const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Dzień w strefie Polski jako RRRR-MM-DD (do porównań z datami obowiązywania) */
export const dzienPL = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** RRRR-MM-DD → DD.MM.RRRR */
export const dataZDnia = (d: string): string => d.split("-").reverse().join(".");

/**
 * Domyślny początek obowiązywania reguły lekarzy: późniejsza z dat uchwały NRL i przyjęcia informacji
 * o formie kształcenia (obie RRRR-MM-DD). Brak którejś: null (datę wpisuje się ręcznie).
 */
export function poczatekObowiazywania(uchwalaNrlAt: string | null | undefined, informacjaAt: string | null | undefined): string | null {
  if (!DATA_RE.test(uchwalaNrlAt ?? "") || !DATA_RE.test(informacjaAt ?? "")) return null;
  return uchwalaNrlAt! > informacjaAt! ? uchwalaNrlAt! : informacjaAt!;
}

/**
 * Całe szkolenie uczestnika (od zapisu do zaliczenia testu, daty z dziennika) musi mieścić się w okresie
 * obowiązywania reguły. Zwraca powód braku punktów albo null, gdy mieści się.
 */
export function pozaObowiazywaniem(r: Pick<RegulaPunktow, "obowiazujeOd" | "obowiazujeDo">, start: Date, koniec: Date): string | null {
  const od = r.obowiazujeOd ?? null;
  const doDnia = r.obowiazujeDo ?? null;
  if (!od || !DATA_RE.test(od)) return "Reguła punktów nie ma jeszcze daty obowiązywania, więc to zaświadczenie nie daje punktów edukacyjnych.";
  if (dzienPL(start) < od) {
    return `Szkolenie rozpoczęło się ${dataPL(start)}, przed dniem, od którego obowiązuje akceptacja punktów (${dataZDnia(od)}). Punkty nie działają wstecz, więc to zaświadczenie nie daje punktów edukacyjnych.`;
  }
  if (doDnia && DATA_RE.test(doDnia) && dzienPL(koniec) > doDnia) {
    return `Test zaliczony ${dataPL(koniec)}, po dniu, do którego obowiązywała akceptacja punktów (${dataZDnia(doDnia)}), więc to zaświadczenie nie daje punktów edukacyjnych.`;
  }
  return null;
}

export type Punkty = { punkty: number; powod: null } | { punkty: null; powod: string };

export function obliczPunkty(r: RegulaPunktow | null | undefined, godziny: number, testZaliczony: boolean): Punkty {
  if (!r) return { punkty: null, powod: "Dla tego zawodu szkolenie nie daje punktów edukacyjnych." };
  if (!regulaDziala(r)) {
    const domyslny = r.active
      ? "Brakuje danych z uchwały, decyzji albo wpisu do rejestru, więc zaświadczenie nie daje punktów edukacyjnych."
      : "Dla tego zawodu szkolenie nie daje jeszcze punktów edukacyjnych.";
    return { punkty: null, powod: r.inactiveReason?.trim() || domyslny };
  }
  if (r.testRequired && !testZaliczony) return { punkty: null, powod: "Punkty przysługują po zaliczeniu testu końcowego." };
  if (r.minHours !== null && godziny < r.minHours) {
    return { punkty: null, powod: `Szkolenie trwa krócej niż wymagane ${r.minHours} h, więc nie daje punktów edukacyjnych.` };
  }
  let p = r.pointsMode === "decyzja" ? (r.pointsGranted ?? 0) : godziny * r.pointsPerHour;
  if (r.maxPoints !== null) p = Math.min(p, r.maxPoints);
  p = Math.round(p * 100) / 100;
  if (p <= 0) return { punkty: null, powod: r.inactiveReason?.trim() || "Dla tego zawodu szkolenie nie daje punktów edukacyjnych." };
  return { punkty: p, powod: null };
}

// ── Przechowywanie (5 lat od końca roku wydania) ─────────────────────────────

/** Ostatni rok przechowywania: zaświadczenie z 2.01.2026 → dane do 31.12.2031 (rok wydania + 5, strefa Polski) */
export const ostatniRokPrzechowywania = (wydane: Date): number => rokWPolsce(wydane) + 5;

/** Okres minął, gdy bieżący rok (PL) jest późniejszy niż ostatni rok przechowywania najpóźniejszego zaświadczenia */
export function przechowywanieMinelo(wydania: Date[], teraz: Date): boolean {
  if (!wydania.length) return true;
  const ostatni = Math.max(...wydania.map(ostatniRokPrzechowywania));
  return rokWPolsce(teraz) > ostatni;
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

/** Etykieta godzin na zaświadczeniu: godzina dydaktyczna (45 min) jest zdefiniowana tylko dla ratowników */
export const etykietaGodzin = (zawod: string): string =>
  zawod === "ratownik" ? "Liczba godzin dydaktycznych (45 min)" : "Liczba godzin programu";

/**
 * Zawód na zaświadczeniu jest sprawdzony, gdy to zaświadczenie z punktami (wymaga sprawdzenia PWZ albo
 * świadomie wyłączonej weryfikacji ręcznej) albo PWZ sprawdzono w rejestrze przed wydaniem.
 * Zaświadczenie ukończenia bez sprawdzonego PWZ: bez numeru PWZ, zawód tylko „deklarowany”.
 */
export function zawodZweryfikowany(kind: string, snapshot: Record<string, unknown>): boolean {
  return kind === "punkty" || !!snapshot.pwzSprawdzonyAt;
}

export interface CertyfikatDoWeryfikacji {
  number: string;
  valid: boolean;
  issuedAt: Date;
  invalidatedAt?: Date | null;
  kind?: string;
  points?: string | number | null;
  hours?: string | number;
  profession?: string;
  snapshot: Record<string, unknown>;
}

/**
 * Widok publicznej weryfikacji: numer, ważność (unieważnione z datą), rodzaj (z punktami / bez punktów),
 * punkty, zawód (z oznaczeniem „deklarowany”, gdy niesprawdzony), godziny, tytuł, data wydania i inicjały.
 * Bez PWZ i pełnego nazwiska. Rodzaj i punkty są tu po to, żeby dopisanie punktów w PDF nie przeszło weryfikacji.
 */
export function widokWeryfikacji(c: CertyfikatDoWeryfikacji, inicjalyFn: (i: string, n: string) => string) {
  const s = c.snapshot as { imie?: string; nazwisko?: string; tytul?: string; zawodNazwa?: string; zawod?: string; godziny?: number };
  const kind = c.kind ?? "punkty";
  const punkty = c.points === null || c.points === undefined ? null : Number(c.points);
  const zawod = String(s.zawod ?? c.profession ?? "");
  const godziny = Number(c.hours ?? s.godziny ?? 0);
  return {
    numer: c.number,
    wazne: c.valid,
    uniewaznione: c.valid ? null : (c.invalidatedAt ? dataPL(c.invalidatedAt) : "tak"),
    rodzaj: kind === "punkty" && punkty !== null ? "punkty" as const : "ukonczenie" as const,
    rodzajNazwa: kind === "punkty" && punkty !== null ? "z punktami edukacyjnymi" : "ukończenie szkolenia bez punktów edukacyjnych",
    punkty: kind === "punkty" ? punkty : null,
    zawod: String(s.zawodNazwa ?? zawod),
    zawodDeklarowany: !zawodZweryfikowany(kind, c.snapshot),
    godziny,
    etykietaGodzin: etykietaGodzin(zawod),
    tytul: String(s.tytul ?? ""),
    dataWydania: dataPL(c.issuedAt),
    inicjaly: inicjalyFn(String(s.imie ?? ""), String(s.nazwisko ?? "")),
  };
}

// ── Zespół: podgląd tak, test i zaświadczenie z punktami nie ────────────────

/** Konta zespołu widzą klucz (pytania puli testu w panelu), więc nie zdają testu i nie dostają punktów */
export const ROLE_ZESPOLU = ["owner", "admin", "reviewer", "support"] as const;
export const czyRolaZespolu = (role: string | null | undefined): boolean => !!role && (ROLE_ZESPOLU as readonly string[]).includes(role);

// ── Wgląd w oceniony test ────────────────────────────────────────────────────

/**
 * Zakres wglądu w oddane podejście. Pełny wgląd (pytania, własne odpowiedzi, klucz, uzasadnienia; przy
 * ustawieniu "bledne" tylko błędne) dopiero, gdy podejścia są zakończone: test zaliczony albo wykorzystane
 * wszystkie podejścia. Wcześniej (niezaliczone, zostały podejścia) tylko wynik i udział poprawnych w modułach:
 * kolejne podejście losuje z tej samej puli, więc klucz nie może wyjść przed nim.
 */
export type ZakresWgladu = "pelny" | "bledne" | "podsumowanie";
export function zakresWgladu(ustawienie: "pelny" | "bledne", stan: StanPodejsc["stan"]): ZakresWgladu {
  return stan === "zaliczony" || stan === "wyczerpane" ? ustawienie : "podsumowanie";
}

/** Pula testu powinna mieć co najmniej 2 × liczba pytań (inaczej kolejne podejścia mają prawie ten sam zestaw) */
export const pulaZaMala = (pula: number, liczbaPytan: number): boolean => pula < 2 * liczbaPytan;

// ── Kopia pytań w podejściu (ocena i wgląd nie zależą od późniejszych zmian treści) ──

export interface KopiaPytania {
  externalId: string | null;
  sectionId: string | null;
  moduleId: string | null;
  modul: string | null;
  modulTytul: string | null;
  modulKolejnosc: number | null;
  title: string | null;
  bodyMd: string;
  imageUrl: string | null;
  answers: Array<{ text: string; isCorrect: boolean }>;
  explanationMd: string;
}
export type KopiaPytan = Record<string, KopiaPytania>;

/**
 * Pytania do oceny: z kopii z chwili losowania, gdy jest (podejścia od 11.11 wieczór); starsze podejścia
 * bez kopii: bieżąca treść. Pytanie, którego nie ma ani w kopii, ani w bazie, liczy się jako błędne.
 */
export function pytaniaDoOceny(
  questionIds: readonly string[],
  kopia: KopiaPytan | null | undefined,
  zywe: ReadonlyMap<string, { externalId: string | null; answers: Array<{ text: string; isCorrect: boolean }> }>,
): PytanieDoOceny[] {
  return questionIds.map((id) => {
    const k = kopia?.[id];
    if (k) return { id, externalId: k.externalId, answers: k.answers };
    const z = zywe.get(id);
    return { id, externalId: z?.externalId ?? null, answers: z?.answers ?? [] };
  });
}

/** Udział poprawnych odpowiedzi w każdym module (wynik niezaliczonego podejścia bez klucza) */
export function udzialModulow(
  oceny: ReadonlyArray<{ questionId: string; ok: boolean }>,
  kopia: KopiaPytan | null | undefined,
): Array<{ modul: string | null; tytul: string; dobrze: number; wszystkie: number }> {
  const grupy = new Map<string, { modul: string | null; tytul: string; kolejnosc: number; dobrze: number; wszystkie: number }>();
  for (const o of oceny) {
    const k = kopia?.[o.questionId];
    const klucz = k?.moduleId ?? k?.modul ?? "?";
    const g = grupy.get(klucz) ?? { modul: k?.modul ?? null, tytul: k?.modulTytul ?? "Inne", kolejnosc: k?.modulKolejnosc ?? 9999, dobrze: 0, wszystkie: 0 };
    g.wszystkie++;
    if (o.ok) g.dobrze++;
    grupy.set(klucz, g);
  }
  return Array.from(grupy.values()).sort((a, b) => a.kolejnosc - b.kolejnosc).map(({ kolejnosc: _k, ...g }) => g);
}

// ── Wykład ukończony: każdy rozdział otwarty ─────────────────────────────────

/** Numery rozdziałów 1…n, których uczestnik jeszcze nie otworzył (pusta lista = wykład ukończony) */
export function brakujaceRozdzialy(otwarte: Iterable<number>, n: number): number[] {
  const juz = new Set(otwarte);
  const braki: number[] = [];
  for (let i = 1; i <= n; i++) if (!juz.has(i)) braki.push(i);
  return braki;
}

// ── Dane organizatora (warunek zaświadczenia z punktami) ─────────────────────

export function brakiOrganizatora(d: {
  organizator: { nazwa?: string; adres?: string } | null | undefined;
  kierownikNaukowy: string; kierownikNaukowyTytul: string; podpisujacy: string;
}): string[] {
  const braki: string[] = [];
  if (!jest(d.organizator?.nazwa)) braki.push("nazwa organizatora");
  if (!jest(d.organizator?.adres)) braki.push("adres organizatora");
  if (!jest(d.kierownikNaukowy)) braki.push("kierownik naukowy (imię i nazwisko)");
  if (!jest(d.kierownikNaukowyTytul)) braki.push("tytuł kierownika naukowego");
  if (!jest(d.podpisujacy)) braki.push("osoba podpisująca za organizatora");
  return braki;
}

// ── Sprawdzenie PWZ: zatwierdzamy tylko dane, które admin widział ────────────

const norm = (v: string | null | undefined) => (v ?? "").trim();
export function daneZgodne(z: { pwz: string | null; firstName: string; lastName: string }, o: { pwz: string | null; imie: string; nazwisko: string }): boolean {
  return norm(z.pwz).toUpperCase() === norm(o.pwz).toUpperCase() && norm(z.firstName) === norm(o.imie) && norm(z.lastName) === norm(o.nazwisko);
}

// ── Raport ankiety: teksty dopiero od 5 odpowiedzi ───────────────────────────

export const MIN_ODPOWIEDZI_DLA_TEKSTOW = 5;

export function raportAnkietyZ(
  ankieta: { pytania: Array<{ id: string; typ: "skala" | "tak_nie" | "tekst"; tresc: string; wymagane: boolean }> },
  rows: ReadonlyArray<{ answers: Record<string, unknown>; surveyVersion: string }>,
  los: Losowe = Math.random,
) {
  const tekstyWidoczne = rows.length >= MIN_ODPOWIEDZI_DLA_TEKSTOW;
  const pytania = ankieta.pytania.map((p) => {
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
    const teksty = odp.map(String).filter((t) => t.trim());
    return { ...p, n: teksty.length, teksty: tekstyWidoczne ? tasuj(teksty, los) : [], tekstyUkryte: !tekstyWidoczne && teksty.length > 0 };
  });
  return { odpowiedzi: rows.length, tekstyWidoczne, minOdpowiedzi: MIN_ODPOWIEDZI_DLA_TEKSTOW, wersje: Array.from(new Set(rows.map((r) => r.surveyVersion))), pytania };
}
