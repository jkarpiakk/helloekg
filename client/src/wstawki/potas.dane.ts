/**
 * Potas na suwaku — czysta logika bez DOM: stany dyskretne, budowa pobudzeń z modelu, cechy do oznaczenia.
 *
 * Stężenie K⁺ nie ma wzoru na kształt EKG, więc stany są dyskretne (bez ciągłego morfingu).
 * Wykłady nie podają liczb stężeń: interfejs nie pokazuje żadnych wartości mmol/l.
 * Cechy pochodzą z S2_04, S2_05, S3_03 i S6_01 (cytaty w karcie).
 */
import { beat, type Beat, type BeatOpts, type Comp, type LeadName, type V3 } from './core/model.js';

export type StanK = 'hipo' | 'norma' | 'hiper-t' | 'hiper-p' | 'hiper-qrs' | 'sinus';
export const KOLEJNOSC: readonly StanK[] = ['hipo', 'norma', 'hiper-t', 'hiper-p', 'hiper-qrs', 'sinus'];
/** Stany hiperkaliemii w kolejności narastania, jak opisuje je wykład (z zastrzeżeniem, że nie zawsze tak jest). */
export const HIPER: readonly StanK[] = ['hiper-t', 'hiper-p', 'hiper-qrs', 'sinus'];
/** Kolejność oceniana w ćwiczeniu: tylko to, co tekst porządkuje jednoznacznie (T → szeroki QRS → sinusoida). */
export const KOLEJNOSC_CWICZENIA: readonly StanK[] = ['hiper-t', 'hiper-qrs', 'sinus'];

export type Cecha = 'T-plaskie' | 'ST-obnizone' | 'U' | 'T-szpiczaste' | 'P-splaszczone' | 'PQ-dluzsze' | 'P-zanik' | 'QRS-szeroki' | 'sinusoida';

export interface Stan {
  id: StanK;
  /** nazwa na suwaku */
  krotko: string;
  /** pełna nazwa w odpowiedziach ćwiczenia */
  nazwa: string;
  grupa: 'hipo' | 'norma' | 'hiper';
  cechy: Cecha[];
  /** wyjaśnienie z treści wykładu (HTML, bez liczb stężeń) */
  opis: string;
  /** odstęp RR na pasku [s] */
  rr: number;
}

export const CECHY: Record<Cecha, string> = {
  'T-plaskie': 'T spłaszczony',
  'ST-obnizone': 'obniżenie ST',
  U: 'wyraźna fala U',
  'T-szpiczaste': 'T wąski, szpiczasty, symetryczny',
  'P-splaszczone': 'P spłaszczony',
  'PQ-dluzsze': 'PQ wydłużony',
  'P-zanik': 'P zanika',
  'QRS-szeroki': 'QRS poszerzony',
  sinusoida: 'QRS zlewa się z T w sinusoidę',
};

export const STANY: Record<StanK, Stan> = {
  hipo: {
    id: 'hipo', krotko: 'Hipokaliemia', nazwa: 'Hipokaliemia: płaski T, obniżony ST, fala U', grupa: 'hipo', rr: 1,
    cechy: ['T-plaskie', 'ST-obnizone', 'U'],
    opis: 'Hipokaliemii mogą towarzyszyć spłaszczone T, obniżenie ST i wyraźna <b>fala U</b> za T. Niski T i duży U potrafią wyglądać jak jeden długi, dwugarbny załamek. Nie kończ pomiaru QT na U: pomiar do końca U daje odstęp QU.',
  },
  norma: {
    id: 'norma', krotko: 'Zapis prawidłowy', nazwa: 'Zapis bez cech zaburzeń potasu', grupa: 'norma', rr: 1,
    cechy: [],
    opis: 'Zapis bez cech zaburzeń potasu. To jeszcze nie dowód prawidłowego stężenia: <b>prawidłowy zapis może towarzyszyć nawet ciężkiej hiperkaliemii</b>.',
  },
  'hiper-t': {
    id: 'hiper-t', krotko: 'Szpiczaste T', nazwa: 'Hiperkaliemia: wąskie, szpiczaste T', grupa: 'hiper', rr: 1,
    cechy: ['T-szpiczaste'],
    opis: 'W hiperkaliemii T są częściej <b>wąskie, ostro zakończone i symetryczne</b>, z wąską podstawą, jak namiot. Zmiany bywają rozlane, w wielu odprowadzeniach. Hiperostre T w niedokrwieniu są za to szerokie u podstawy i skupiają się w odprowadzeniach jednego obszaru.',
  },
  'hiper-p': {
    id: 'hiper-p', krotko: 'Zmiany P i PQ', nazwa: 'Hiperkaliemia: szpiczaste T, płaski P, dłuższy PQ', grupa: 'hiper', rr: 1,
    cechy: ['T-szpiczaste', 'P-splaszczone', 'PQ-dluzsze'],
    opis: 'Przy wysokich T poszukaj spłaszczenia P i wydłużenia PQ. Kształt T jest tylko wskazówką; długość PQ też nie powie ci, ile wynosi potas.',
  },
  'hiper-qrs': {
    id: 'hiper-qrs', krotko: 'Szeroki QRS', nazwa: 'Hiperkaliemia: szeroki QRS, zanik P', grupa: 'hiper', rr: 1,
    cechy: ['T-szpiczaste', 'P-zanik', 'QRS-szeroki'],
    opis: 'Gdy stężenie rośnie bardzo, pobudzenie rozchodzi się wolniej, jak fala w gęstniejącym miodzie. Przewodzenie się wydłuża i <b>QRS się poszerza</b>. T są namiotowate, a P znikają.',
  },
  sinus: {
    id: 'sinus', krotko: 'Sinusoida', nazwa: 'Hiperkaliemia: obraz sinusoidalny', grupa: 'hiper', rr: 1.0,
    cechy: ['sinusoida'],
    opis: 'W skrajnej postaci zapis przechodzi w <b>sinusoidę</b>: QRS zlewa się z T w jedną falującą linię.',
  },
};

/** Odprowadzenia dużego paska: II oraz V2 i V3, gdzie najlepiej widać U. */
export const ODPROWADZENIA: readonly LeadName[] = ['II', 'V2', 'V3'];

/** Kierunek fali sinusoidalnej: w dół, w lewo i do tyłu, żeby była widoczna w II, V2 i V3. */
const SIN: V3 = [0.7, 0.97, -0.65];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/** T symetryczne: obie połówki o szerokości krótszej (wąskie, szpiczaste). */
function symT(b: Beat): Beat {
  return { ...b, t: b.t.map((k) => ({ ...k, w: Math.min(k.w, k.w2 ?? k.w), w2: Math.min(k.w, k.w2 ?? k.w) })) };
}

export const OPCJE: Record<Exclude<StanK, 'sinus'>, BeatOpts> = {
  hipo: { tAmp: 0.3, uAmp: 0.15, injury: { dir: [0.4, 0.6, 0.7], st: -0.05 } },
  norma: {},
  'hiper-t': { tAmp: 2.3, tSharp: 1.9 },
  'hiper-p': { tAmp: 2.3, tSharp: 1.9, pAmp: 0.4, pr: 0.24 },
  'hiper-qrs': { tAmp: 2.3, tSharp: 1.9, p: 'none', qrsWide: 1.7 },
};

/**
 * Obraz sinusoidalny zbudowany lokalnie: szeroki QRS i T przeciwnej polarności w równych odstępach,
 * tak że kolejne pobudzenia tworzą jedną falującą linię. `sasiedzi` dokłada kopie przesunięte o ±RR
 * (do widoku 12 odprowadzeń, który pokazuje jedno pobudzenie na pole).
 */
export function sinusoida(sasiedzi = false): Beat {
  const rr = STANY.sinus.rr;
  // szerokości proporcjonalne do RR, żeby fala była ciągła (bez odcinka izoelektrycznego)
  const q: Comp = { t: 0.12, w: 0.107 * rr, v: mul(SIN, 0.7) };
  const t: Comp = { t: 0.12 + rr / 2, w: 0.12 * rr, v: mul(SIN, -0.55) };
  const qrs = [q], tt = [t];
  if (sasiedzi) for (const d of [-rr, rr]) { qrs.push({ ...q, t: q.t + d }); tt.push({ ...t, t: t.t + d }); }
  return { p: [], qrs, t: tt, u: [], st: null, j: 0.3, tPeak: t.t, qrsMs: 300, qtMs: Math.round((t.t + 0.17) * 1000) };
}

export function pobudzenie(stan: StanK, sasiedzi = false): Beat {
  if (stan === 'sinus') return sinusoida(sasiedzi);
  const b = beat(OPCJE[stan]);
  return stan.startsWith('hiper') ? symT(b) : b;
}

/**
 * Miejsca cech na pobudzeniu (czas względem początku QRS) do numerowanych znaczników na pasku.
 * `do` — koniec klamry dla cech mierzonych odcinkiem (PQ, QRS).
 */
export function miejscaCech(stan: StanK): Array<{ cecha: Cecha; t: number; do?: number }> {
  const b = pobudzenie(stan);
  const o = stan === 'sinus' ? {} : OPCJE[stan];
  const pr = o.pr ?? 0.16;
  return STANY[stan].cechy.map((c) => {
    switch (c) {
      case 'T-plaskie': case 'T-szpiczaste': return { cecha: c, t: b.tPeak };
      case 'ST-obnizone': return { cecha: c, t: b.j + 0.05 };
      case 'U': return { cecha: c, t: b.tPeak + 0.15 };
      case 'P-splaszczone': return { cecha: c, t: -pr + 0.05 };
      case 'P-zanik': return { cecha: c, t: -0.11 };
      case 'PQ-dluzsze': return { cecha: c, t: -pr, do: 0 };
      case 'QRS-szeroki': return { cecha: c, t: 0, do: b.j };
      case 'sinusoida': return { cecha: c, t: 0.12 + STANY.sinus.rr / 2 };
    }
  });
}

/** Odpowiedzi w ćwiczeniu „rozpoznaj”: blisko, gdy wybrano inny obraz tej samej grupy. */
export function ocenOdpowiedz(prawda: StanK, wybor: StanK): { ok: boolean; near: boolean } {
  return { ok: prawda === wybor, near: prawda !== wybor && STANY[prawda].grupa === STANY[wybor].grupa };
}
export function ocenKolejnosc(ulozone: readonly StanK[]): boolean {
  return ulozone.length === KOLEJNOSC_CWICZENIA.length && ulozone.every((s, i) => s === KOLEJNOSC_CWICZENIA[i]);
}

/** Pierwsza litera mała, bez ruszania skrótów dalej („T”, „QRS”). */
const malaPierwsza = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);

/** Pola werdyktu dla wspólnego wzoru `werdykt()`: „Dobrze. <nazwa>.” / „Blisko. Prawidłowo: …” / „Nie. Prawidłowo: …”. */
export function werdyktRozpoznania(prawda: StanK, wybor: StanK): { ok: boolean; near: boolean; prawidlowo?: string; szczegol?: string } {
  const o = ocenOdpowiedz(prawda, wybor), n = STANY[prawda].nazwa;
  return o.ok ? { ...o, szczegol: `${n}.` } : { ...o, prawidlowo: malaPierwsza(n) };
}
/** Werdykt ćwiczenia kolejności: „Dobrze. Kolejność jak w wykładzie.” / „Nie. Prawidłowo: szpiczaste T, szeroki QRS, sinusoida.” */
export function werdyktKolejnosci(ulozone: readonly StanK[]): { ok: boolean; near: boolean; prawidlowo?: string; szczegol?: string } {
  const ok = ocenKolejnosc(ulozone);
  if (ok) return { ok, near: false, szczegol: 'Kolejność jak w wykładzie.' };
  const near = ulozone[0] === KOLEJNOSC_CWICZENIA[0];
  return { ok, near, prawidlowo: KOLEJNOSC_CWICZENIA.map((s) => malaPierwsza(STANY[s].krotko)).join(', '), szczegol: near ? 'Pierwszy obraz stoi na dobrym miejscu.' : undefined };
}
