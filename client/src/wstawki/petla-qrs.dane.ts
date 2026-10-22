/**
 * Dane i czysta logika wstawki „petla-qrs” (bez DOM).
 *
 * Każdy wariant to własny zestaw składowych QRS (`Comp[]`) w układzie modelu (x — lewa ręka pacjenta,
 * y — w dół, z — do przodu). Wektor w chwili t liczy `vectorAt` z `core/model.ts`, a zapis
 * w odprowadzeniu to jego rzut na oś kamery (`volt`). Składowe są lokalne, bo gotowe morfologie
 * z modelu nie dawały wszystkich cech opisanych w wykładach (szczegóły w karcie, `doOkaJK`).
 */
import { LEADS, PRECORDIAL, vectorAt, volt, type Beat, type Comp, type LeadName } from './core/model.js';

export type WariantId = 'normal' | 'rbbb' | 'lbbb' | 'lvh' | 'rvh' | 'posterior';
export type Kamera = (typeof PRECORDIAL)[number];
export const KAMERY: readonly Kamera[] = PRECORDIAL;

export interface Faza { /** koniec fazy [s od początku QRS] */ until: number; label: string }

export interface Wariant {
  id: WariantId;
  /** Krótka nazwa na przełącznik. */
  chip: string;
  /** Pełna nazwa z wykładu. */
  nazwa: string;
  qrs: Comp[];
  /** Koniec QRS (punkt J) [s]. */
  j: number;
  /** Kierunek pobudzenia przegrody w pierwszej fazie. */
  przegroda: 'z lewa na prawo' | 'w przeciwnym kierunku';
  /** Do kiedy trwa pierwsza faza (przegroda) [s]. */
  przegrodaDo: number;
  /** Fazy pętli do opisu kursora czasu. */
  fazy: Faza[];
  /** Cechy z wykładu (krótko, na „tagi”). */
  cechy: string[];
  /** Jedno-dwa zdania „skąd ten kształt”, z treści wykładu. */
  dlaczego: string;
  /** Wyróżniona ściana/komora na rysunku przekroju. */
  rysunek: { lkGruba?: boolean; pkGruba?: boolean; tylnaZawal?: boolean; blok?: 'prawa' | 'lewa' };
}

/* ─────────── składowe ─────────── */

/** Norma: przegroda z lewa na prawo i do przodu, potem przednio-boczna i boczna lewa komora, na końcu podstawa. */
const SEPT: Comp = { t: 0.014, w: 0.0075, v: [-0.088, 0.05, 0.103] };
const NORMAL: Comp[] = [
  SEPT,
  { t: 0.036, w: 0.0095, v: [0.231, 0.55, 0.109] },
  { t: 0.052, w: 0.0105, v: [0.618, 0.62, -0.219] },
  { t: 0.074, w: 0.009, v: [-0.062, -0.12, -0.379] },
];

/** RBBB: początek jak w normie (przegroda i lewa komora zachowaną lewą odnogą), potem późne, wolne siły prawej komory ku przodowi i w prawo. */
const RBBB: Comp[] = [
  SEPT,
  { t: 0.036, w: 0.0095, v: [0.231, 0.55, 0.109] },
  { t: 0.052, w: 0.0105, v: [0.60, 0.60, -0.30] },
  { t: 0.104, w: 0.018, v: [-0.36, -0.04, 0.46] },
];

/** LBBB: przegroda w przeciwnym kierunku (z prawa na lewo i ku tyłowi), potem powolna lewa komora przez mięsień, w lewo i ku tyłowi. */
const LBBB: Comp[] = [
  { t: 0.03, w: 0.013, v: [0.22, 0.03, -0.12] },
  { t: 0.072, w: 0.018, v: [0.72, 0.28, -0.56] },
  { t: 0.116, w: 0.017, v: [0.76, 0.12, -0.44] },
];

/** LVH: ta sama kolejność co w normie, większe siły lewej komory w lewo i ku tyłowi. */
const LVH: Comp[] = [
  SEPT,
  { t: 0.036, w: 0.0095, v: [0.30, 0.55, 0.10] },
  { t: 0.054, w: 0.011, v: [1.05, 0.70, -0.85] },
  { t: 0.076, w: 0.009, v: [-0.062, -0.12, -0.379] },
];

/** RVH: przegroda jak w normie, główne siły przesunięte w prawo i ku przodowi; mniejsze siły lewej komory zostają (R w V6 mały, S głęboki). */
const RVH: Comp[] = [
  SEPT,
  { t: 0.032, w: 0.0095, v: [0.22, 0.40, 0.3] },
  { t: 0.054, w: 0.012, v: [-0.58, 0.85, 0.50] },
  { t: 0.08, w: 0.009, v: [-0.05, -0.10, -0.15] },
];

/**
 * Zawał ściany tylnej (przebyty): ubytek sił skierowanych ku tyłowi. Kamery z przodu widzą to odwrotnie:
 * szeroki, dominujący R w V1-V2 (lustrzany odpowiednik Q od tyłu).
 */
const POSTERIOR: Comp[] = [
  { ...SEPT, t: SEPT.t + 0.002 },
  { t: 0.04, w: 0.0135, v: [0.10, 0.55, 0.42] },
  { t: 0.058, w: 0.0105, v: [0.60, 0.55, 0.0] },
  { t: 0.076, w: 0.009, v: [-0.04, -0.12, -0.10] },
];

export const WARIANTY: Record<WariantId, Wariant> = {
  normal: {
    id: 'normal', chip: 'Norma', nazwa: 'Prawidłowa progresja załamka R', qrs: NORMAL, j: 0.096,
    przegroda: 'z lewa na prawo', przegrodaDo: 0.024,
    fazy: [{ until: 0.024, label: 'przegroda, z lewa na prawo' }, { until: 0.096, label: 'większa masa komór, z przewagą lewej' }],
    cechy: ['V1: rS', 'V6: qR', 'strefa przejściowa V3-V4'],
    dlaczego: 'Przegroda pobudza się pierwsza, z lewa na prawo, i daje mały r w V1 oraz małe q w V6. Potem pobudza się większa masa komór, z przewagą lewej, i kierunek się odwraca: w V1 powstaje S, a w V6 duży R.',
    rysunek: {},
  },
  rbbb: {
    id: 'rbbb', chip: 'RBBB', nazwa: 'Blok prawej odnogi (RBBB)', qrs: RBBB, j: 0.15,
    przegroda: 'z lewa na prawo', przegrodaDo: 0.024,
    fazy: [{ until: 0.024, label: 'przegroda, z lewa na prawo' }, { until: 0.075, label: 'lewa komora, zachowaną lewą odnogą' }, { until: 0.15, label: 'spóźniona prawa komora' }],
    cechy: ['QRS ≥ 0,12 s', 'V1: późne R′', 'V6: szeroki S'],
    dlaczego: 'Początek wygląda zwyczajnie, bo przegroda i lewa komora pobudzają się zachowaną lewą odnogą; spóźnia się dopiero końcówka. Późny wektor kieruje się ku prawej komorze, czyli ku przodowi i w prawo, ku V1. Stąd późne R′ w V1 i szerokie S w V6.',
    rysunek: { blok: 'prawa' },
  },
  lbbb: {
    id: 'lbbb', chip: 'LBBB', nazwa: 'Blok lewej odnogi (LBBB)', qrs: LBBB, j: 0.16,
    przegroda: 'w przeciwnym kierunku', przegrodaDo: 0.044,
    fazy: [{ until: 0.044, label: 'przegroda, w przeciwnym kierunku' }, { until: 0.16, label: 'spóźniona lewa komora, przez mięsień' }],
    cechy: ['QRS ≥ 0,12 s', 'V1: QS lub rS', 'V6: szeroki R bez q'],
    dlaczego: 'Impuls dociera zachowaną prawą odnogą, przegroda pobudza się w przeciwnym kierunku, a lewa komora dostaje pobudzenie później, przez mięsień od strony prawej komory. Dlatego znika q w V6, a w V1 zostaje zespół przeważająco ujemny.',
    rysunek: { blok: 'lewa' },
  },
  lvh: {
    id: 'lvh', chip: 'Przerost LK', nazwa: 'Przerost lewej komory (LVH)', qrs: LVH, j: 0.098,
    przegroda: 'z lewa na prawo', przegrodaDo: 0.024,
    fazy: [{ until: 0.024, label: 'przegroda, z lewa na prawo' }, { until: 0.098, label: 'powiększona masa lewej komory' }],
    cechy: ['V1-V2: głębszy S', 'V5-V6: wyższy R'],
    dlaczego: 'Przerost to więcej masy i wyższe napięcie w kierunku tej masy. Prawe przedsercowe V1-V2 widzą, jak pobudzenie ucieka od elektrody, i rejestrują głębokie S, a V5-V6 wysokie R.',
    rysunek: { lkGruba: true },
  },
  rvh: {
    id: 'rvh', chip: 'Przerost PK', nazwa: 'Przerost prawej komory (RVH)', qrs: RVH, j: 0.098,
    przegroda: 'z lewa na prawo', przegrodaDo: 0.022,
    fazy: [{ until: 0.022, label: 'przegroda, z lewa na prawo' }, { until: 0.098, label: 'powiększona prawa komora przejmuje głos' }],
    cechy: ['V1: R/S > 1', 'V5-V6: głęboki S', 'QRS poniżej 110 ms'],
    dlaczego: 'Większy udział prawej komory przesuwa wypadkowy wektor w prawo oraz ku przodowi. V1 patrzy od przodu i z prawej strony, więc widzi wysoki R. W V5-V6 pogłębia się S, bo pobudzenie oddala się od lewych elektrod.',
    rysunek: { pkGruba: true },
  },
  posterior: {
    id: 'posterior', chip: 'Ściana tylna', nazwa: 'Zawał ściany tylnej', qrs: POSTERIOR, j: 0.092,
    przegroda: 'z lewa na prawo', przegrodaDo: 0.024,
    fazy: [{ until: 0.024, label: 'przegroda, z lewa na prawo' }, { until: 0.092, label: 'brak sił ściany tylnej' }],
    cechy: ['R dominuje nad S w V1 lub V2', 'R bywa szeroki', 'obraz lustrzany'],
    dlaczego: 'Standardowe odprowadzenia nie patrzą na ścianę tylną wprost. V1-V2 patrzą z przodu, więc zmiana, która od tyłu daje ujemny załamek Q, od przodu widoczna jest jako dodatni R.',
    rysunek: { tylnaZawal: true },
  },
};

export const KOLEJNOSC: readonly WariantId[] = ['normal', 'rbbb', 'lbbb', 'lvh', 'rvh', 'posterior'];

/** Okno czasu animacji [s]: od chwili przed QRS do chwili po najdłuższym QRS. */
export const T0 = -0.006, T1 = 0.18;

const beats = new Map<WariantId, Beat>();
/** Pobudzenie z samym QRS (bez P, ST i T). */
export function beatOf(id: WariantId): Beat {
  let b = beats.get(id);
  if (!b) {
    const w = WARIANTY[id];
    b = { p: [], qrs: w.qrs, t: [], u: [], st: null, j: w.j, tPeak: w.j + 0.2, qrsMs: Math.round(w.j * 1000), qtMs: 0 };
    beats.set(id, b);
  }
  return b;
}

/** Wektor QRS w płaszczyźnie poziomej: [x (lewa strona pacjenta), z (przód)]. */
export function loopXZ(id: WariantId, t: number): [number, number] {
  const v = vectorAt(beatOf(id), t, { p: false, t: false });
  return [v[0], v[2]];
}

/** Napięcie [mV] w kamerze w chwili t. */
export function v(id: WariantId, lead: LeadName, t: number): number {
  return volt(beatOf(id), lead, t);
}

/** Rzut wektora na kierunek kamery (bez wzmocnienia odprowadzenia): + ku kamerze, − od kamery. */
export function rzut(id: WariantId, lead: LeadName, t: number): number {
  const [x, z] = loopXZ(id, t);
  const u = LEADS[lead].u;
  return x * u[0] + z * u[2];
}

/* ─────────── odczyt kształtu ─────────── */

export interface Wychylenie { znak: 1 | -1; od: number; do: number; szczyt: number; tSzczytu: number; /** liczba wierzchołków (wcięcia) */ garby: number }

/** Próg wychylenia: 0,5 mm przy 10 mm/mV. */
const PROG = 0.05;
const DT = 0.0005;

/** Wychylenia QRS w odprowadzeniu (kolejne odcinki ponad i poniżej linii, większe niż próg). */
export function wychylenia(id: WariantId, lead: LeadName): Wychylenie[] {
  const out: Wychylenie[] = [];
  let cur: Wychylenie | null = null;
  let prev = 0, prev2 = 0;
  for (let t = T0; t <= T1; t += DT) {
    const x = v(id, lead, t);
    const sg = x > PROG ? 1 : x < -PROG ? -1 : 0;
    if (cur && sg !== cur.znak) { out.push(cur); cur = null; }
    if (sg !== 0 && !cur) cur = { znak: sg, od: t, do: t, szczyt: x, tSzczytu: t, garby: 0 };
    if (cur) {
      cur.do = t;
      if (Math.abs(x) > Math.abs(cur.szczyt)) { cur.szczyt = x; cur.tSzczytu = t; }
      // lokalne maksimum |x| w odcinku = wierzchołek
      if (Math.abs(prev) > Math.abs(prev2) && Math.abs(prev) >= Math.abs(x) && Math.sign(prev) === cur.znak) cur.garby++;
    }
    prev2 = prev; prev = x;
  }
  if (cur) out.push(cur);
  return out;
}

/** Zapis kształtu literami (q, R, S, R′), małe litery dla wychyleń < 1/3 największego. */
export function kod(id: WariantId, lead: LeadName): string {
  const w = wychylenia(id, lead);
  const max = Math.max(...w.map((x) => Math.abs(x.szczyt)), 1e-9);
  if (w.length === 1 && w[0]!.znak < 0) return 'QS';
  let s = '', rCount = 0, sCount = 0, sawR = false;
  for (const x of w) {
    const big = Math.abs(x.szczyt) >= max / 3;
    if (x.znak > 0) { s += (big ? 'R' : 'r') + (rCount ? '′' : ''); rCount++; sawR = true; }
    else if (!sawR) s += big ? 'Q' : 'q';
    else { s += (big ? 'S' : 's') + (sCount ? '′' : ''); sCount++; }
  }
  return s;
}

/** Wysokość R i głębokość S [mm przy 10 mm/mV], każda od linii izoelektrycznej. */
export function rs(id: WariantId, lead: LeadName): { r: number; s: number } {
  let r = 0, s = 0;
  for (let t = T0; t <= T1; t += DT) { const x = v(id, lead, t); if (x > r) r = x; if (x < s) s = x; }
  return { r: r * 10, s: -s * 10 };
}

/** Czas trwania QRS z modelu [s]: od pierwszego do ostatniego wychylenia ponad próg w V1-V6. */
export function czasQrs(id: WariantId): number {
  let a = Infinity, b = -Infinity;
  for (const l of KAMERY) for (const w of wychylenia(id, l)) { a = Math.min(a, w.od); b = Math.max(b, w.do); }
  return b - a;
}

/* ─────────── progresja R ─────────── */

/** Wartości mm podane w wykładzie (S2_03, „Progresja załamka R i depolaryzacja przegrody”). Pozostałe kamery: kształt poglądowy. */
export const PROGRESJA_MM: Partial<Record<Kamera, { r: number; s: number }>> = {
  V2: { r: 3, s: 10 },
  V4: { r: 7, s: 7 },
};

/* ─────────── ćwiczenie ─────────── */

/** Trzy przyczyny wysokiego R w V1 (S3_02, „Jak nie pomylić RVH z innymi przyczynami wysokiego R w V1”). */
export const WYSOKIE_R: readonly WariantId[] = ['rbbb', 'rvh', 'posterior'];

export type TypZadania = 'zapis' | 'petla';
export interface Zadanie { typ: TypZadania; wariant: WariantId }

/** 5 zadań: każda przyczyna co najmniej raz, typy przemieszane. `r` — generator 0..1. */
export function zadania(r: () => number, n = 5): Zadanie[] {
  const pool: Zadanie[] = [];
  for (const w of WYSOKIE_R) for (const typ of ['zapis', 'petla'] as const) pool.push({ typ, wariant: w });
  // tasowanie Fishera-Yatesa
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  const out: Zadanie[] = [];
  for (const w of WYSOKIE_R) { const k = pool.findIndex((z) => z.wariant === w); out.push(pool.splice(k, 1)[0]!); }
  while (out.length < n && pool.length) out.push(pool.shift()!);
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  // bez dwóch identycznych zadań pod rząd
  for (let i = 1; i < out.length; i++) if (out[i]!.wariant === out[i - 1]!.wariant && i + 1 < out.length) [out[i], out[i + 1]] = [out[i + 1]!, out[i]!];
  return out;
}

/** Wyjaśnienia w ćwiczeniu (HTML), zbudowane z treści wykładów. */
export const WYJASNIENIE: Record<'rbbb' | 'rvh' | 'posterior', string> = {
  rbbb: '<b>Blok prawej odnogi (RBBB).</b> Jeśli dodatnie wychylenie w V1 pojawia się dopiero po wcześniejszych r i S, a cały QRS jest szeroki, myśl przede wszystkim o opóźnionym przewodzeniu. Prawa autostrada jest zamknięta, więc impuls dociera do prawej komory objazdem przez mięsień i pobudza ją później. Późny wektor kieruje się ku przodowi i w prawo, ku V1. Na pętli widać to jako wolną końcówkę, a w V6 jako szeroki S.',
  rvh: '<b>Przerost prawej komory (RVH).</b> W RVH bez zaburzeń przewodzenia wysoki R może stać w zespole o prawidłowej szerokości, poniżej 110 ms. Większy udział prawej komory przesuwa wypadkowy wektor komór w prawo oraz ku przodowi: w V1 R/S > 1, a w V5-V6 pogłębia się załamek S.',
  posterior: '<b>Zawał ściany tylnej.</b> Standardowe 12 odprowadzeń nie patrzy na nią bezpośrednio. V1-V2 patrzą z przodu, więc zmiana, która od tyłu daje ujemny załamek Q, od przodu widoczna jest jako dodatni R; bywa on szeroki.',
};

/** Różnicowanie po wyjaśnieniu (osobny akapit „Jak odróżnić”), te same słowa co wcześniej w wyjaśnieniu. */
export const JAK_ODROZNIC: Partial<Record<'rbbb' | 'rvh' | 'posterior', string>> = {
  posterior: 'Od bloku i przerostu odróżnisz go tak: w bloku szukasz poszerzonego QRS i końcowego R′ w V1, a w przeroście także odchylenia osi w prawo. Spójrz też na V6: w przeroście prawej komory w odprowadzeniach lewych (V5-V6, I) pogłębia się załamek S (w V6 qrS), a przy zawale ściany tylnej V6 zostaje qR.',
};

/** Ocena odpowiedzi według wspólnego wzoru werdyktu: „Dobrze. <nazwa>.” / „Nie. Prawidłowo: <nazwa małą literą>.”. */
export function ocena(right: WariantId, picked: string | null): { ok: boolean; prawidlowo?: string; szczegol?: string } {
  const n = WARIANTY[right].nazwa;
  return picked === right ? { ok: true, szczegol: `${n}.` } : { ok: false, prawidlowo: n.charAt(0).toLowerCase() + n.slice(1) };
}

/** Opis kamery w trybie „progresja R” (z S2_03 i S1_01). */
export const OPIS_KAMERY: Record<Kamera, string> = {
  V1: 'V1, przy prawym brzegu mostka: zwykle dominuje załamek ujemny, mały r i głębszy S. Mały r to przegroda pobudzana z lewa na prawo, w stronę V1.',
  V2: 'V2: jeśli R ma 3 mm, a S 10 mm, nadal przeważa wychylenie ujemne.',
  V3: 'V3: R rośnie, a S maleje, ale w tym zapisie nadal przeważa S. Strefa przejściowa leży zwykle w okolicy V3-V4.',
  V4: 'V4: jeśli oba wychylenia mają po 7 mm, tam znajduje się strefa przejściowa.',
  V5: 'V5: zespół staje się przeważnie dodatni, bo znaczna część pobudzenia kieruje się ku lewej stronie serca.',
  V6: 'V6: zespół qR. Najpierw krótkie ujemne q (przegroda), potem wysokie R (większa masa komór). R w V6 nie musi być wyższy niż w V5.',
};

/* ─────────── geometria przekroju (raster `przekrojKlatki`, 1200 × 900 px) ─────────── */

/**
 * Raster jest w konwencji „widok od stóp” (jak GFX-0039): mostek (przód) u góry, kręgosłup u dołu,
 * prawa strona pacjenta po lewej. Ekran: x pacjenta (ku lewej ręce) → w prawo, z (przód) → w górę.
 * Współrzędne z grafiki GFX-0039 (oryginał 1448 × 1086) × 0,8287.
 */
const SK = 0.8287;
const px = (x: number, y: number): [number, number] => [x * SK, y * SK];
/** Elektrody V1-V6 na skórze. */
export const ELEKTRODY_PX: Record<Kamera, [number, number]> = {
  V1: px(633, 122), V2: px(813, 120), V3: px(936, 118), V4: px(1060, 157), V5: px(1250, 308), V6: px(1364, 522),
};
/** Środek pętli: punkt w sercu (przy przegrodzie), z którego kierunki do elektrod zgadzają się z kątami odprowadzeń z dokładnością do 8°. */
export const SRODEK_PX: [number, number] = [684, 386];
export const LK_PX = { srodek: px(905, 425), obrys: [px(890, 250), px(925, 249), px(960, 257), px(1000, 275), px(1025, 320), px(1035, 380), px(1030, 440), px(1010, 500)] };
export const PK_PX = { srodek: px(740, 370), obrys: [px(880, 232), px(800, 228), px(720, 245), px(645, 285), px(590, 345), px(572, 410)] };
export const PRZEGRODA_PX: Array<[number, number]> = [px(890, 252), px(848, 320), px(808, 385), px(778, 450), px(760, 505)];

/** Wektor modelu (x, z) → przesunięcie na ekranie (widok od stóp): lewa pacjenta w prawo, przód w górę. */
export function naEkran(x: number, z: number, skala: number): [number, number] {
  return [x * skala, -z * skala];
}
/** Kierunek osi kamery na ekranie (jednostkowy), z kąta odprowadzenia w płaszczyźnie poziomej. */
export function osKamery(l: Kamera): [number, number] {
  const b = (LEADS[l].angle * Math.PI) / 180;
  return naEkran(Math.cos(b), Math.sin(b), 1);
}
