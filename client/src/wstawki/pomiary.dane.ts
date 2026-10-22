/**
 * Pracownia pomiarów — czysta logika bez DOM: przeliczniki kratek, reguły częstości, QTc,
 * kryteria woltażowe, harmonogramy pasków i pomiar „wzorcowy” na sygnale z modelu.
 *
 * Wszystkie progi i wzory pochodzą z wykładów S1_02, S2_02, S2_03, S2_05, S3_01 (cytaty w karcie).
 */
import { LEADS, beat, dot, volt, vectorAt, type Beat, type BeatOpts, type Comp, type LeadName } from './core/model.js';
import { bgAF } from './core/rytm.js';

/* ─────────── papier ─────────── */

/** Mała kratka = 1 mm, duża = 5 mm. Przy 25 mm/s: 0,04 s i 0,20 s. */
export const MALA_MM = 1;
export const DUZA_MM = 5;
export type Przesuw = 25 | 50;
export type Cecha = 10 | 5;

/** Ile małych i dużych kratek zajmuje odcinek czasu przy danym przesuwie. */
export function kratki(dtS: number, przesuw: Przesuw = 25): { male: number; duze: number; mm: number } {
  const mm = dtS * przesuw;
  return { mm, male: mm / MALA_MM, duze: mm / DUZA_MM };
}
/** Czas jednej małej kratki [s] przy danym przesuwie. */
export const czasMalej = (przesuw: Przesuw): number => MALA_MM / przesuw;

/* ─────────── częstość ─────────── */

/** 60 s podzielone przez czas jednego cyklu. */
export const czestosc60 = (rrS: number): number => 60 / rrS;
/** Reguła 300: 300 / liczba dużych kratek (zakłada 25 mm/s). */
export const regula300 = (duze: number): number => 300 / duze;
/** Reguła 1500: 1500 / liczba małych kratek (zakłada 25 mm/s). */
export const regula1500 = (male: number): number => 1500 / male;
/** Ciąg reguły 300 dla 1-6 dużych kratek. */
export const CIAG_300 = [1, 2, 3, 4, 5, 6].map((k) => regula300(k));
/** Średnia częstość z liczby QRS w odcinku o znanym czasie: liczba QRS × 60 ÷ czas [s]. */
export const czestoscZOkna = (liczbaQrs: number, czasS: number): number => (liczbaQrs * 60) / czasS;

/* ─────────── normy odstępów ─────────── */

export type Ocena = { tekst: string; patologia: boolean };

/** PQ: norma 0,12-0,20 s z granicami włącznie; powyżej 0,20 s wydłużone. */
export function ocenaPQ(s: number): Ocena {
  const ms = Math.round(s * 1000);
  if (ms < 120) return { tekst: 'PQ poniżej 0,12 s: skrócone', patologia: true };
  if (ms <= 200) return { tekst: 'PQ w normie 0,12-0,20 s', patologia: false };
  return { tekst: 'PQ powyżej 0,20 s: wydłużone (blok AV I stopnia, jeśli każde P ma swój QRS)', patologia: true };
}
/** QRS: < 110 ms prawidłowy, 110-119 ms opóźnienie przewodzenia śródkomorowego, ≥ 120 ms szeroki. */
export function ocenaQRS(s: number): Ocena {
  const ms = Math.round(s * 1000);
  if (ms < 110) return { tekst: 'QRS krótszy niż 110 ms: prawidłowy', patologia: false };
  if (ms < 120) return { tekst: 'QRS 110-119 ms: opóźnienie przewodzenia śródkomorowego, choć to jeszcze zespół wąski', patologia: true };
  return { tekst: 'QRS od 120 ms: szeroki', patologia: true };
}

/* ─────────── QTc ─────────── */

export type Wzor = 'bazett' | 'fridericia';
/** Bazett: QTc = QT / √RR (sekundy). */
export const bazett = (qtS: number, rrS: number): number => qtS / Math.sqrt(rrS);
/** Fridericia: QTc = QT / ∛RR (sekundy). */
export const fridericia = (qtS: number, rrS: number): number => qtS / Math.cbrt(rrS);
export const qtc = (w: Wzor, qtS: number, rrS: number): number => (w === 'bazett' ? bazett(qtS, rrS) : fridericia(qtS, rrS));

/** Progi z wykładu: wydłużony ≥ 450 ms u mężczyzn, ≥ 460 ms u kobiet; ≥ 500 ms wyraźnie większe ryzyko TdP. */
export const QTC_M = 450, QTC_K = 460, QTC_RYZYKO = 500;
export function ocenaQTc(ms: number): { m: boolean; k: boolean; ryzyko: boolean } {
  return { m: ms >= QTC_M, k: ms >= QTC_K, ryzyko: ms >= QTC_RYZYKO };
}

/* ─────────── woltaż ─────────── */

/** Przeliczenie wysokości na papierze do skali 10 mm/mV. */
export const naStandard = (mmPapier: number, cecha: Cecha): number => (mmPapier * 10) / cecha;
/** Sokolow-Lyon: S w V1 + wyższy z R w V5, V6; ≥ 35 mm (przy 10 mm/mV). */
export function sokolow(sV1: number, rV5: number, rV6: number): { suma: number; spelnione: boolean } {
  const suma = sV1 + Math.max(rV5, rV6);
  return { suma, spelnione: suma >= 35 - 1e-9 };
}
/** Cornell: R w aVL + S w V3; > 28 mm u mężczyzn, > 20 mm u kobiet (nierówność ostra). */
export function cornell(rAVL: number, sV3: number, plec: 'm' | 'k'): { suma: number; prog: number; spelnione: boolean } {
  const suma = rAVL + sV3, prog = plec === 'm' ? 28 : 20;
  return { suma, prog, spelnione: suma > prog + 1e-9 };
}
/** Przykład z wykładu S3_01. */
export const SOKOLOW_PRZYKLAD = { V1: 19, V5: 18, V6: 15 } as const;
export const CORNELL_PRZYKLAD = { aVL: 9, V3: 15 } as const;

/* ─────────── sygnał z modelu ─────────── */

const gauss = (k: Comp, t: number): number => {
  const w = k.w2 !== undefined && t > k.t ? k.w2 : k.w;
  const d = (t - k.t) / w;
  return d > 5 || d < -5 ? 0 : Math.exp(-0.5 * d * d);
};
const proj = (b: Beat, lead: LeadName, t: number, parts: { p?: boolean; qrs?: boolean; t?: boolean }): number => {
  const L = LEADS[lead];
  return dot(vectorAt(b, t, parts), L.u) * L.gain;
};

/** Próg widoczności wychylenia na papierze: 0,03 mV (0,3 mm przy 10 mm/mV). */
export const PROG_MV = 0.03;

export interface Pomiar {
  /** początek P (s względem początku QRS w modelu), null gdy brak P */
  pOn: number | null;
  qrsOn: number; qrsOff: number;
  /** szczyt R (największe dodatnie wychylenie QRS) */
  rPeak: number;
  tPeak: number;
  /** koniec T metodą stycznej (przecięcie stycznej do najbardziej stromego ramienia T z linią izoelektryczną) */
  tEnd: number;
  /** do rysunku stycznej: punkt styczności i nachylenie [mV/s] */
  tang: { t: number; v: number; slope: number };
}

/**
 * Pomiar „wzorcowy” jednego pobudzenia w danym odprowadzeniu, tak jak widać je na papierze:
 * początek i koniec wychylenia tam, gdzie przekracza próg widoczności, koniec T metodą stycznej.
 * Każdą składową mierzymy osobno (P, QRS, T), żeby nachodzące na siebie fale nie przesuwały granic.
 */
export function zmierz(b: Beat, lead: LeadName): Pomiar {
  const dt = 0.0005;
  let pOn: number | null = null;
  if (b.p.length) {
    for (let t = -0.45; t < 0; t += dt) if (Math.abs(proj(b, lead, t, { p: true, qrs: false, t: false })) > PROG_MV) { pOn = t; break; }
  }
  let qrsOn = 0, qrsOff = b.j, rPeak = 0, rMax = -Infinity, found = false;
  for (let t = -0.06; t < b.j + 0.12; t += dt) {
    const v = proj(b, lead, t, { p: false, qrs: true, t: false });
    if (Math.abs(v) > PROG_MV) { if (!found) { qrsOn = t; found = true; } qrsOff = t; }
    if (v > rMax) { rMax = v; rPeak = t; }
  }
  const L = LEADS[lead];
  const tSig = (t: number) => b.t.reduce((s, k) => s + dot(k.v, L.u) * L.gain * gauss(k, t), 0);
  let tPeak = b.tPeak, tAbs = 0;
  for (let t = b.j; t < b.j + 0.6; t += dt) { const v = Math.abs(tSig(t)); if (v > tAbs) { tAbs = v; tPeak = t; } }
  const sign = Math.sign(tSig(tPeak)) || 1;
  // najbardziej strome ramię opadające ku linii izoelektrycznej po szczycie
  let best = { t: tPeak, v: tSig(tPeak), slope: 0 };
  for (let t = tPeak; t < tPeak + 0.3; t += dt) {
    const s = (tSig(t + dt) - tSig(t - dt)) / (2 * dt);
    if (-sign * s > -sign * best.slope) best = { t, v: tSig(t), slope: s };
  }
  const tEnd = best.slope !== 0 ? best.t - best.v / best.slope : tPeak;
  return { pOn, qrsOn, qrsOff, rPeak, tPeak, tEnd, tang: best };
}

/** QT w s zmierzony na zapisie (od początku QRS do końca T metodą stycznej). */
export const qtNaZapisie = (b: Beat, lead: LeadName): number => { const m = zmierz(b, lead); return m.tEnd - m.qrsOn; };

/** Opcja `qt` modelu, przy której QT zmierzony na zapisie w danym odprowadzeniu wynosi `celS`. */
export function qtOpcjaDla(celS: number, lead: LeadName, o: BeatOpts = {}): number {
  let q = celS;
  for (let i = 0; i < 3; i++) q += celS - qtNaZapisie(beat({ ...o, qt: q }), lead);
  return q;
}

/** Opcja `pr` modelu, przy której PQ zmierzony na zapisie w danym odprowadzeniu wynosi `celS`. */
export function prOpcjaDla(celS: number, lead: LeadName, o: BeatOpts = {}): number {
  let p = celS;
  for (let i = 0; i < 3; i++) { const m = zmierz(beat({ ...o, pr: p }), lead); p += celS - (m.qrsOn - (m.pOn ?? 0)); }
  return p;
}

/* ─────────── paski ─────────── */

export interface Pasek {
  /** czasy początku QRS (t = 0 modelu) w czasie paska [s] */
  qrs: number[];
  beats: Beat[];
  lead: LeadName;
  /** tło (np. fala f) */
  af: boolean;
}

/** Napięcie paska w chwili t [mV]. */
export function napiecie(p: Pasek, t: number): number {
  let v = 0;
  for (let i = 0; i < p.qrs.length; i++) {
    const d = t - (p.qrs[i] ?? 0);
    if (d > -0.5 && d < 0.95) v += volt(p.beats[i] ?? p.beats[0]!, p.lead, d);
  }
  if (p.af) v += bgAF(0.045)(t, LEADS[p.lead]);
  return v;
}

/** Pasek miarowy: pierwsze QRS tak, by szczyt R wypadł na grubej linii (0,60 s). */
export function pasekMiarowy(rr: number, o: BeatOpts = {}, lead: LeadName = 'II', ile = 16, szczyt1 = 0.6): Pasek {
  const b = beat(o);
  const r = zmierz(b, lead).rPeak;
  const t1 = szczyt1 - r;
  return { qrs: Array.from({ length: ile }, (_, i) => t1 + i * rr), beats: [b], lead, af: false };
}

/**
 * Rytm niemiarowy (bez P, z drobną falą f). Odstępy dobrane tak, żeby obok siebie stały
 * 0,50 s (120/min) i 1,00 s (60/min), w 6 s od 0,30 s było 8 QRS (80/min), a w 10 s 12 QRS (72/min).
 */
export const RR_NIEMIAROWE = [0.86, 0.5, 1.0, 0.68, 0.92, 0.58, 0.8, 0.64, 1.04, 0.84, 0.96, 1.0, 0.62, 0.88, 0.7] as const;
export const OKNO_START = 0.3;
export function pasekNiemiarowy(lead: LeadName = 'II'): Pasek {
  const b = beat({ p: 'none' });
  const qrs = [0.5];
  for (const rr of RR_NIEMIAROWE) qrs.push((qrs[qrs.length - 1] ?? 0) + rr);
  return { qrs, beats: [b], lead, af: true };
}
/** Czasy szczytów R na pasku. */
export function szczytyR(p: Pasek): number[] {
  const r = zmierz(p.beats[0]!, p.lead).rPeak;
  return p.qrs.map((t, i) => t + (i < p.beats.length ? zmierz(p.beats[i]!, p.lead).rPeak : r));
}
/** Liczba QRS (szczytów R) w oknie [a, a + czas). */
export function liczQrs(p: Pasek, a: number, czas: number): number {
  return szczytyR(p).filter((t) => t >= a && t < a + czas).length;
}

/* ─────────── ćwiczenie ─────────── */

export type Miara = 'PQ' | 'QRS' | 'QT' | 'RR';
export const MIARY: readonly Miara[] = ['PQ', 'QRS', 'QT', 'RR'];
/** Tolerancja ćwiczenia ±20 ms. */
export const TOLERANCJA_S = 0.02;

export interface Zapis {
  opts: BeatOpts;
  rr: number;
  pasek: Pasek;
  /** pobudzenie mierzone: drugie na pasku */
  wzorzec: Record<Miara, { a: number; b: number }>;
}

/** Losowy zapis o znanych wartościach. `r` daje liczby z [0, 1). */
export function losujZapis(r: () => number): Zapis {
  for (let k = 0; k < 50; k++) {
    const pr = 0.13 + Math.round(r() * 13) * 0.01;            // opcja modelu 0,13-0,26 s; na zapisie w II PQ ok. 136-270 ms
    const qrsWide = 0.92 + Math.round(r() * 6) * 0.04;          // QRS zmierzony w II ok. 70-88 ms
    const qtCel = 0.36 + Math.round(r() * 8) * 0.01;            // QT 0,36-0,44 s
    const rr = 0.72 + Math.round(r() * 10) * 0.04;              // RR 0,72-1,12 s
    if (rr - pr - 0.04 < qtCel + 0.06) continue;                // T musi skończyć się przed kolejnym P
    const base: BeatOpts = { pr, qrsWide };
    const opts: BeatOpts = { ...base, qt: qtOpcjaDla(qtCel, 'II', base) };
    const z = zapisZ(opts, rr);
    return z;
  }
  return zapisZ({}, 0.8);
}
export function zapisZ(opts: BeatOpts, rr: number, lead: LeadName = 'II', ile = 4): Zapis {
  const pasek = pasekMiarowy(rr, opts, lead, ile, 0.6);
  const b = pasek.beats[0]!;
  const m = zmierz(b, lead);
  const t2 = pasek.qrs[1] ?? 0;
  const t1 = pasek.qrs[0] ?? 0;
  return {
    opts, rr, pasek,
    wzorzec: {
      PQ: { a: t2 + (m.pOn ?? 0), b: t2 + m.qrsOn },
      QRS: { a: t2 + m.qrsOn, b: t2 + m.qrsOff },
      QT: { a: t2 + m.qrsOn, b: t2 + m.tEnd },
      RR: { a: t1 + m.rPeak, b: t2 + m.rPeak },
    },
  };
}
export const dlugosc = (x: { a: number; b: number }): number => Math.abs(x.b - x.a);
