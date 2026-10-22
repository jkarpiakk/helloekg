/**
 * Logika wstawki „nzk” bez DOM: rytmy zatrzymania krążenia na monitorze (S6_05, S5_04, S6_03),
 * ich klasyfikacja „do defibrylacji / nie do defibrylacji” (dosłownie z tekstu) i pułapki.
 * Tylko rozpoznanie rytmu: żadnego algorytmu RKO, żadnej sekwencji leczenia.
 *
 * Częstości i amplitudy poniżej są poglądowe (tekst ich nie podaje) i NIE są pokazywane jako liczby.
 */

export type RytmId =
  | 'vf-grube' | 'vf-drobne' | 'vt' | 'vt-wielo' | 'asystolia' | 'pea-waskie' | 'pea-szerokie' | 'artefakt' | 'odlaczona';
export type Rozpoznanie = 'vf' | 'vt' | 'asystolia' | 'pea' | 'artefakt';

export interface Rytm {
  id: RytmId;
  label: string;
  /** Prawidłowa odpowiedź w ćwiczeniu. */
  rozp: Rozpoznanie;
  /** Klasyfikacja z tekstu; null — to nie jest rytm zatrzymania krążenia. */
  klasa: 'defib' | 'niedefib' | null;
  pacjent: 'nzk' | 'przytomny';
  tetno: 'brak' | 'jest';
}

export const RYTMY: Record<RytmId, Rytm> = {
  'vf-grube': { id: 'vf-grube', label: 'VF grubofaliste', rozp: 'vf', klasa: 'defib', pacjent: 'nzk', tetno: 'brak' },
  'vf-drobne': { id: 'vf-drobne', label: 'VF drobnofaliste', rozp: 'vf', klasa: 'defib', pacjent: 'nzk', tetno: 'brak' },
  vt: { id: 'vt', label: 'VT bez tętna, jednokształtny', rozp: 'vt', klasa: 'defib', pacjent: 'nzk', tetno: 'brak' },
  'vt-wielo': { id: 'vt-wielo', label: 'VT bez tętna, wielokształtny', rozp: 'vt', klasa: 'defib', pacjent: 'nzk', tetno: 'brak' },
  asystolia: { id: 'asystolia', label: 'Asystolia', rozp: 'asystolia', klasa: 'niedefib', pacjent: 'nzk', tetno: 'brak' },
  'pea-waskie': { id: 'pea-waskie', label: 'PEA, wąskie QRS', rozp: 'pea', klasa: 'niedefib', pacjent: 'nzk', tetno: 'brak' },
  'pea-szerokie': { id: 'pea-szerokie', label: 'PEA, szerokie QRS', rozp: 'pea', klasa: 'niedefib', pacjent: 'nzk', tetno: 'brak' },
  artefakt: { id: 'artefakt', label: 'Artefakt', rozp: 'artefakt', klasa: null, pacjent: 'przytomny', tetno: 'jest' },
  // pułapka z planszy: odłączony przewód daje taki sam obraz jak asystolia; po sprawdzeniu elektrod widać VF
  odlaczona: { id: 'odlaczona', label: 'Odłączony przewód', rozp: 'vf', klasa: 'defib', pacjent: 'nzk', tetno: 'brak' },
};

export const ODPOWIEDZI: ReadonlyArray<{ v: Rozpoznanie; label: string }> = [
  { v: 'vf', label: 'Migotanie komór (VF)' },
  { v: 'vt', label: 'Częstoskurcz komorowy bez tętna (pVT)' },
  { v: 'asystolia', label: 'Asystolia' },
  { v: 'pea', label: 'Aktywność elektryczna bez tętna (PEA)' },
  { v: 'artefakt', label: 'Artefakt u przytomnego pacjenta' },
];

/** Rytmy do defibrylacji według S6_05: VF i VT bez tętna (jedno- i wielokształtny). */
export const doDefibrylacji = (r: Rytm): boolean => r.klasa === 'defib';

/* ─────────── kształty fal (poglądowe) ─────────── */

const TAU = 2 * Math.PI;

/**
 * Migotanie komór: suma składowych 3-8 Hz z wolno dryfującą częstością i fazą oraz zmienną obwiednią,
 * więc kształt i wysokość fal stale się zmieniają i nie ma powtarzalnego okresu.
 */
export function falaVF(t: number, gruba: boolean, seed = 1): number {
  const A = gruba ? 0.9 : 0.15;
  const comps: Array<[number, number, number, number]> = [
    // [częstość Hz, waga, głębokość modulacji częstości, częstość modulacji Hz]
    [4.3, 0.55, 0.9, 0.23], [5.7, 0.4, 1.3, 0.31], [3.4, 0.32, 0.7, 0.17], [6.9, 0.22, 1.6, 0.41], [8.1, 0.12, 2.0, 0.53],
  ];
  let v = 0;
  comps.forEach(([f, w, dm, fm], i) => {
    const ph = TAU * f * t + (dm / (2 * fm)) * Math.sin(TAU * fm * t + seed * (i + 1)) + seed * 1.7 * i;
    v += w * Math.sin(ph);
  });
  const env = 0.62 + 0.25 * Math.sin(TAU * 0.29 * t + seed) + 0.13 * Math.sin(TAU * 0.71 * t + 2 * seed);
  return A * env * v;
}

/** Asystolia: linia z bardzo małym, wolnym dryfem. */
export const liniaAsystolii = (t: number): number => 0.012 * Math.sin(TAU * 0.21 * t) + 0.006 * Math.sin(TAU * 0.53 * t + 1);

/**
 * Artefakt ruchu / drżenia: duże, nieregularne wychylenia 3-7 Hz w odprowadzeniu, którego elektroda się
 * porusza (II); w drugim odprowadzeniu (I) prawie ich nie ma.
 */
export function artefakt(t: number, odpr: 'I' | 'II'): number {
  const k = odpr === 'II' ? 1.5 : 0.09;
  const v = Math.sin(TAU * 4.8 * t + 0.6 * Math.sin(TAU * 0.37 * t)) * 0.5 + Math.sin(TAU * 6.6 * t + 1.1) * 0.3
    + Math.sin(TAU * 3.1 * t + 2.3) * 0.28 + Math.sin(TAU * 11.3 * t) * 0.08;
  const env = 0.7 + 0.3 * Math.sin(TAU * 0.43 * t + 0.5);
  return k * 0.62 * env * v;
}

/** Największe wychylenie funkcji w oknie (do testów i dopasowania skali). */
export function szczyt(f: (t: number) => number, t0 = 0, t1 = 20, dt = 0.002): number {
  let m = 0;
  for (let t = t0; t <= t1; t += dt) m = Math.max(m, Math.abs(f(t)));
  return m;
}

/* ─────────── rytmy zorganizowane: harmonogram pobudzeń ─────────── */

export type Uderzenie = { at: number; kind: 'n' | 'vent' | 'vt' | 'poly'; k: number };

/** Odstępy (s): poglądowe, bez podpisu wartością. */
const ODSTEP: Partial<Record<RytmId, number>> = {
  vt: 60 / 180, 'vt-wielo': 60 / 220, 'pea-waskie': 60 / 95, 'pea-szerokie': 60 / 36, artefakt: 60 / 80,
};

export function uderzenia(r: RytmId, t0: number, t1: number): Uderzenie[] {
  const d = ODSTEP[r];
  if (!d) return [];
  const kind: Uderzenie['kind'] = r === 'vt' ? 'vt' : r === 'vt-wielo' ? 'poly' : r === 'pea-szerokie' ? 'vent' : 'n';
  const out: Uderzenie[] = [];
  let k = Math.ceil(t0 / d);
  for (let at = k * d; at < t1; at = ++k * d) out.push({ at, kind, k });
  return out;
}

/**
 * Wielokształtny VT: kolejne zespoły zmieniają wysokość i kierunek. Oś obraca się płynnie o pół obrotu
 * na każde `cyc` pobudzeń, a amplituda maleje przy zmianie kierunku i rośnie po niej.
 * Zwraca skalę amplitudy i obrót osi [°] dla pobudzenia k.
 */
export const WIELO_CYKL = 9;
export function wielo(k: number): { skala: number; obrot: number } {
  const ph = k / WIELO_CYKL;
  return { skala: 0.4 + 0.9 * Math.abs(Math.cos(Math.PI * ph)), obrot: (180 * ph) % 360 };
}

/** Czy rytm pokazuje zorganizowane, powtarzalne zespoły (do odróżnienia VF od VT/PEA). */
export const zorganizowany = (r: RytmId): boolean => uderzenia(r, 0, 5).length > 0;

/* ─────────── ćwiczenie ─────────── */

export const PULA: readonly RytmId[] = ['vf-grube', 'vf-drobne', 'vt', 'vt-wielo', 'asystolia', 'pea-waskie', 'pea-szerokie', 'artefakt'];

/** 6 zadań: każde rozpoznanie co najmniej raz, reszta losowo z puli, bez powtórzeń rytmu. */
export function zestaw(r: () => number = Math.random): RytmId[] {
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
  const base: RytmId[] = [pick(['vf-grube', 'vf-drobne'] as const), pick(['vt', 'vt-wielo'] as const), 'asystolia', pick(['pea-waskie', 'pea-szerokie'] as const), 'artefakt'];
  const rest = PULA.filter((x) => !base.includes(x));
  base.push(pick(rest));
  for (let i = base.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [base[i], base[j]] = [base[j]!, base[i]!]; }
  return base;
}
