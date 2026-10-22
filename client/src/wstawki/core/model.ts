/**
 * Model elektryczny serca: pobudzenie jako wektor w przestrzeni, zapis jako jego rzut na odprowadzenia.
 *
 * Układ współrzędnych pacjenta: x — w stronę LEWEJ ręki pacjenta, y — w dół (ku nogom),
 * z — do przodu (ku ścianie klatki). Płaszczyzna czołowa to (x, y), pozioma to (x, z).
 * Kąty w płaszczyźnie czołowej jak w układzie heksaksjalnym: 0° = I, +90° = aVF, −30° = aVL.
 *
 * Każda składowa pobudzenia to wektor o kształcie Gaussa w czasie. Napięcie w odprowadzeniu
 * = suma po składowych (wektor · oś odprowadzenia) × wzmocnienie odprowadzenia.
 * Dzięki temu jedna zmiana (np. odwrócenie sił przegrodowych w LBBB) zmienia spójnie wszystkie
 * odprowadzenia i nikt nie rysuje krzywych ręcznie.
 *
 * Czas w sekundach. t = 0 to początek zespołu QRS. Załamek P ma czasy ujemne.
 */
import { rad } from './ui.js';

export type V3 = readonly [number, number, number];

export const LIMB = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] as const;
export const PRECORDIAL = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as const;
export const EXTRA = ['V3R', 'V4R', 'V7', 'V8', 'V9'] as const;
export type LeadName = (typeof LIMB)[number] | (typeof PRECORDIAL)[number] | (typeof EXTRA)[number];
export const LEADS_12: readonly LeadName[] = [...LIMB, ...PRECORDIAL];

export interface Lead { name: LeadName; u: V3; gain: number; /** kąt w płaszczyźnie odprowadzenia (czołowej albo poziomej) */ angle: number; plane: 'frontal' | 'horizontal' }

const frontal = (name: LeadName, a: number): Lead => ({ name, u: [Math.cos(rad(a)), Math.sin(rad(a)), 0], gain: 1, angle: a, plane: 'frontal' });
/** Płaszczyzna pozioma: 0° = lewy bok (V6), +90° = przód (V2), wartości ujemne = tył. */
const horiz = (name: LeadName, b: number, gain: number): Lead => ({ name, u: [Math.cos(rad(b)), 0, Math.sin(rad(b))], gain, angle: b, plane: 'horizontal' });

export const LEADS: Record<LeadName, Lead> = {
  I: frontal('I', 0), II: frontal('II', 60), III: frontal('III', 120),
  aVR: frontal('aVR', -150), aVL: frontal('aVL', -30), aVF: frontal('aVF', 90),
  V1: horiz('V1', 115, 1.9), V2: horiz('V2', 94, 2.5), V3: horiz('V3', 70, 2.35),
  V4: horiz('V4', 50, 2.2), V5: horiz('V5', 28, 1.9), V6: horiz('V6', 0, 1.5),
  V3R: horiz('V3R', 103, 1.2), V4R: horiz('V4R', 120, 1.1),
  V7: horiz('V7', -28, 1.0), V8: horiz('V8', -52, 0.95), V9: horiz('V9', -72, 0.9),
};

/** Składowa pobudzenia: wektor [mV] × Gauss w czasie (w — szerokość przed szczytem, w2 — po). */
export interface Comp { t: number; w: number; w2?: number; v: V3 }

export interface Beat {
  p: Comp[];
  qrs: Comp[];
  t: Comp[];
  u: Comp[];
  /** Prąd uszkodzenia: stałe przesunięcie od punktu J do końca T, kierunek = obszar uszkodzony. */
  st: V3 | null;
  /** Czas punktu J (koniec QRS) i szczytu T, w s od początku QRS. */
  j: number;
  tPeak: number;
  /** Czas trwania QRS w ms i QT w ms (do odczytów). */
  qrsMs: number;
  qtMs: number;
}

export type QrsKind =
  | 'normal' | 'rbbb' | 'lbbb' | 'lafb' | 'lpfb' | 'lvh' | 'rvh' | 'posterior'
  | 'paced-rv' | 'vent' | 'pvc-lv' | 'pvc-rv' | 'wpw';
export type PKind = 'normal' | 'pulmonale' | 'mitrale' | 'none' | 'retro' | 'ectopic-low';

export interface Injury {
  /** Kierunek obszaru uszkodzenia (zostanie znormalizowany). */
  dir: V3;
  /** Uniesienie ST w kierunku obszaru [mV], 0.2 = 2 mm w odprowadzeniu patrzącym prosto. */
  st: number;
  /** Ostre, wysokie T w kierunku obszaru [mV] (pierwsze minuty). */
  hyperT?: number;
  /** Martwica: utrata sił — załamek Q w odprowadzeniach patrzących na obszar [mV]. */
  q?: number;
  /** Odwrócenie T w odprowadzeniach patrzących na obszar [mV]. */
  tInv?: number;
}

export interface BeatOpts {
  /** Kierunek głównych sił QRS w płaszczyźnie czołowej (°). Domyślnie +55°. */
  axis?: number;
  qrs?: QrsKind;
  p?: PKind;
  /** Odstęp PQ w s (od początku P do początku QRS). Domyślnie 0,16. */
  pr?: number;
  /** Mnożnik amplitudy QRS. */
  qrsAmp?: number;
  /** Mnożnik szerokości QRS (np. hiperkaliemia). */
  qrsWide?: number;
  /** QT w s — przesuwa szczyt T. Domyślnie 0,38. */
  qt?: number;
  tAmp?: number;
  /** Mnożnik szerokości T (płaskie i szerokie < 1 < wąskie i szpiczaste). */
  tSharp?: number;
  pAmp?: number;
  uAmp?: number;
  injury?: Injury | null;
  /** Dodatkowe obniżenie ST w kierunku przeciwnym do wektora (przeciążenie, „strain”) [mV]. */
  strain?: number;
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const norm3 = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Obraca wektor w płaszczyźnie czołowej tak, by jego kierunek w (x,y) wynosił `axis`, zachowując z. */
function withAxis(v: V3, axis: number): V3 {
  const len = Math.hypot(v[0], v[1]);
  return [len * Math.cos(rad(axis)), len * Math.sin(rad(axis)), v[2]];
}
function rotFrontal(v: V3, by: number): V3 {
  const a = Math.atan2(v[1], v[0]) + rad(by), len = Math.hypot(v[0], v[1]);
  return [len * Math.cos(a), len * Math.sin(a), v[2]];
}

/* ─────────── załamek P ─────────── */

function pWave(kind: PKind, pr: number, amp: number): Comp[] {
  // P z dwóch części: prawy przedsionek (wcześniej, w dół i do przodu), lewy (później, w lewo i do tyłu)
  const t0 = -pr; // początek P
  const ra: Comp = { t: t0 + 0.035, w: 0.017, v: mul([0.02, 0.10, 0.06], amp) };
  const la: Comp = { t: t0 + 0.062, w: 0.019, v: mul([0.10, 0.055, -0.06], amp) };
  switch (kind) {
    case 'none': return [];
    case 'pulmonale': return [{ ...ra, v: mul([0.03, 0.24, 0.13], amp), w: 0.019 }, { ...la, v: mul([0.07, 0.04, -0.04], amp) }];
    case 'mitrale': return [ra, { t: t0 + 0.085, w: 0.024, v: mul([0.15, 0.08, -0.13], amp) }];
    case 'retro': return [{ t: t0 + 0.045, w: 0.02, v: mul([-0.02, -0.14, 0.02], amp) }];
    case 'ectopic-low': return [{ t: t0 + 0.04, w: 0.02, v: mul([0.04, -0.12, 0.02], amp) }];
    default: return [ra, la];
  }
}

/* ─────────── QRS ─────────── */

function qrsComps(kind: QrsKind, axis: number | undefined, amp: number, wide: number): { c: Comp[]; dur: number; tVec: V3 } {
  const W = (w: number) => w * wide;
  const T = (t: number) => t * wide;
  const septal: V3 = [-0.08, 0.04, 0.12];
  const main0: V3 = [0.71, 0.97, -0.38];
  const term: V3 = [-0.10, -0.14, -0.18];
  const main = axis === undefined ? main0 : withAxis(main0, axis);
  const tNorm: V3 = [0.21, 0.21, 0.09];
  const turn = axis === undefined ? 0 : axis - 54;
  const sep = rotFrontal(septal, turn), trm = rotFrontal(term, turn);
  const tv = axis === undefined ? tNorm : rotFrontal(tNorm, Math.max(-40, Math.min(40, turn * 0.6)));

  switch (kind) {
    case 'rbbb': // normalny początek, potem późne, nieprzeciwważone siły prawej komory w prawo i do przodu
      return {
        dur: 0.14,
        c: [
          { t: 0.012, w: 0.007, v: mul(sep, amp) },
          { t: 0.045, w: 0.012, v: mul(main, 0.92 * amp) },
          { t: 0.072, w: 0.010, v: mul([-0.15, -0.05, -0.12], amp) },
          { t: 0.108, w: 0.019, v: mul([-0.26, -0.04, 0.55], amp) },
        ],
        tVec: [0.24, 0.22, -0.16],
      };
    case 'lbbb': // przegroda pobudzana od prawej do lewej, potem powolna, zwolniona lewa komora
      return {
        dur: 0.15,
        c: [
          { t: 0.02, w: 0.014, v: mul([0.18, 0.02, -0.16], amp) },
          { t: 0.065, w: 0.02, v: mul([0.75, 0.28, -0.55], amp) },
          { t: 0.115, w: 0.02, v: mul([0.78, 0.12, -0.45], amp) },
        ],
        tVec: [-0.26, -0.06, 0.28],
      };
    case 'lafb': {
      // pobudzenie zaczyna się od tylno-dolnej części lewej komory (małe r w II, III, aVF), potem idzie w lewo i w górę
      const m = withAxis(main0, -62);
      return { dur: 0.105, c: [{ t: 0.014, w: 0.008, v: mul([0.0, 0.16, 0.08], amp) }, { t: 0.05, w: 0.013, v: mul(m, amp) }, { t: 0.082, w: 0.01, v: mul(rotFrontal(term, -60), amp * 0.8) }], tVec: [0.24, 0.12, 0.08] };
    }
    case 'lpfb': {
      const m = withAxis(main0, 112);
      return { dur: 0.105, c: [{ t: 0.014, w: 0.008, v: mul([0.10, -0.12, 0.08], amp) }, { t: 0.05, w: 0.013, v: mul(m, amp) }, { t: 0.08, w: 0.01, v: mul(term, amp * 0.7) }], tVec: [0.18, 0.22, 0.08] };
    }
    case 'lvh':
      return {
        dur: 0.105,
        c: [
          { t: 0.012, w: 0.007, v: mul(sep, amp) },
          { t: 0.05, w: 0.014, v: mul(withAxis([0.95, 0.85, -0.95], axis ?? 30), amp) },
          { t: 0.082, w: 0.01, v: mul(trm, amp) },
        ],
        tVec: [0.12, 0.14, 0.12],
      };
    case 'rvh':
      return {
        dur: 0.1,
        c: [
          { t: 0.012, w: 0.007, v: mul([-0.06, 0.05, 0.14], amp) },
          { t: 0.045, w: 0.013, v: mul([-0.42, 0.95, 0.62], amp) },
          { t: 0.075, w: 0.01, v: mul([-0.18, -0.1, 0.12], amp) },
        ],
        tVec: [0.18, 0.18, -0.12],
      };
    case 'posterior': // utrata sił tylnych = przewaga przednich: wysokie R w V1–V2
      return {
        dur: 0.095,
        c: [
          { t: 0.012, w: 0.007, v: mul(sep, amp) },
          { t: 0.04, w: 0.011, v: mul(add(main, [0, 0, 0.52]), amp) },
          { t: 0.072, w: 0.01, v: mul(trm, amp * 0.6) },
        ],
        tVec: [0.21, 0.21, 0.2],
      };
    case 'wpw': // fala delta: wolny początek, potem szybkie przewodzenie
      return {
        dur: 0.12,
        c: [
          { t: 0.03, w: 0.022, v: mul([0.28, 0.32, 0.10], amp) },
          { t: 0.07, w: 0.011, v: mul(main, 0.95 * amp) },
          { t: 0.1, w: 0.009, v: mul(term, amp) },
        ],
        tVec: [0.1, 0.12, 0.0],
      };
    case 'paced-rv': // stymulacja z koniuszka prawej komory: obraz zbliżony do LBBB z osią w górę
      return {
        dur: 0.16,
        c: [
          { t: 0.04, w: 0.024, v: mul([0.35, -0.55, -0.55], amp) },
          { t: 0.105, w: 0.026, v: mul([0.45, -0.45, -0.45], amp) },
        ],
        tVec: [-0.2, 0.25, 0.25],
      };
    case 'vent': // komorowy rytm zastępczy / szerokie pobudzenie komorowe
    case 'pvc-lv': // pobudzenie z lewej komory: obraz RBBB-podobny, R w V1
      if (kind === 'pvc-lv') return {
        dur: 0.15,
        c: [{ t: 0.045, w: 0.024, v: mul([-0.45, 0.85, 0.75], amp * 1.15) }, { t: 0.11, w: 0.022, v: mul([-0.2, 0.5, 0.5], amp) }],
        tVec: [0.25, -0.3, -0.3],
      };
      return {
        dur: 0.16,
        c: [{ t: 0.05, w: 0.026, v: mul([0.62, 0.55, -0.6], amp * 1.1) }, { t: 0.115, w: 0.024, v: mul([0.4, 0.4, -0.45], amp) }],
        tVec: [-0.3, -0.25, 0.3],
      };
    case 'pvc-rv': // z drogi odpływu prawej komory: obraz LBBB-podobny, oś w dół
      return {
        dur: 0.15,
        c: [{ t: 0.05, w: 0.024, v: mul([0.45, 1.15, -0.6], amp) }, { t: 0.11, w: 0.022, v: mul([0.3, 0.6, -0.4], amp) }],
        tVec: [-0.25, -0.3, 0.3],
      };
    default:
      return {
        dur: 0.09,
        c: [
          { t: 0.012, w: 0.007, v: mul(sep, amp) },
          { t: 0.045, w: 0.011, v: mul(main, amp) },
          { t: 0.075, w: 0.009, v: mul(trm, amp) },
        ].map((k) => ({ ...k, t: T(k.t), w: W(k.w) })),
        tVec: tv,
      };
  }
}

/** Buduje jedno pobudzenie. */
export function beat(o: BeatOpts = {}): Beat {
  const wide = o.qrsWide ?? 1;
  const q = qrsComps(o.qrs ?? 'normal', o.axis, o.qrsAmp ?? 1, wide);
  const qrs = q.c;
  const dur = q.dur * (o.qrs === 'normal' || !o.qrs ? wide : 1);
  const qt = o.qt ?? 0.38;
  const tPeak = Math.max(dur + 0.12, qt - 0.075);
  const sharp = o.tSharp ?? 1;
  let tVec = mul(q.tVec, o.tAmp ?? 1);
  let st: V3 | null = null;

  const inj = o.injury;
  if (inj) {
    const d = norm3(inj.dir);
    if (inj.st) st = mul(d, inj.st);
    if (inj.hyperT) tVec = add(tVec, mul(d, inj.hyperT));
    if (inj.tInv) tVec = add(tVec, mul(d, -inj.tInv));
    if (inj.q) qrs.push({ t: 0.022, w: 0.011, v: mul(d, -inj.q) });
  }
  if (o.strain) {
    // przeciążenie: obniżenie ST i odwrócenie T w kierunku dominującego wektora QRS
    const m = norm3(qrs.reduce<V3>((s, k) => add(s, k.v), [0, 0, 0]));
    st = add(st ?? [0, 0, 0], mul(m, -o.strain * 0.8));
    tVec = add(tVec, mul(m, -o.strain * 2.6));
  }

  const tw = 0.06 / sharp, tw2 = 0.045 / sharp;
  const t: Comp[] = [{ t: tPeak, w: tw, w2: tw2, v: tVec }];
  const u: Comp[] = o.uAmp ? [{ t: tPeak + 0.15, w: 0.035, v: mul(norm3([0.2, 0.15, 0.25]), o.uAmp) }] : [];
  return {
    p: pWave(o.p ?? 'normal', o.pr ?? 0.16, o.pAmp ?? 1),
    qrs, t, u, st, j: dur, tPeak, qrsMs: Math.round(dur * 1000), qtMs: Math.round((tPeak + tw2 * 1.9) * 1000),
  };
}

const g = (k: Comp, t: number): number => {
  const w = k.w2 !== undefined && t > k.t ? k.w2 : k.w;
  const d = (t - k.t) / w;
  return d > 5 || d < -5 ? 0 : Math.exp(-0.5 * d * d);
};
const sig = (x: number) => 1 / (1 + Math.exp(-x));

/** Wektor wypadkowy pobudzenia w chwili t (do pętli i do rysowania strzałki). */
export function vectorAt(b: Beat, t: number, parts: { p?: boolean; qrs?: boolean; t?: boolean } = { p: true, qrs: true, t: true }): V3 {
  let v: V3 = [0, 0, 0];
  if (parts.p !== false) for (const k of b.p) v = add(v, mul(k.v, g(k, t)));
  if (parts.qrs !== false) for (const k of b.qrs) v = add(v, mul(k.v, g(k, t)));
  if (parts.t !== false) { for (const k of b.t) v = add(v, mul(k.v, g(k, t))); for (const k of b.u) v = add(v, mul(k.v, g(k, t))); }
  if (b.st && parts.t !== false) {
    const env = sig((t - b.j + 0.004) / 0.004) * (1 - sig((t - (b.tPeak + 0.07)) / 0.025));
    v = add(v, mul(b.st, env));
  }
  return v;
}

/** Napięcie [mV] w odprowadzeniu w chwili t (t = 0 — początek QRS). */
export function volt(b: Beat, lead: LeadName | Lead, t: number): number {
  const L = typeof lead === 'string' ? LEADS[lead] : lead;
  return dot(vectorAt(b, t), L.u) * L.gain;
}

/** Netto pole QRS w odprowadzeniu (znak QRS: dodatni / ujemny / równofazowy). */
export function qrsNet(b: Beat, lead: LeadName | Lead): number {
  const L = typeof lead === 'string' ? LEADS[lead] : lead;
  return b.qrs.reduce((s, k) => s + dot(k.v, L.u) * k.w, 0) * L.gain;
}

/** Oś elektryczna QRS w płaszczyźnie czołowej (°), z pola netto QRS. */
export function frontalAxis(b: Beat): number {
  const x = b.qrs.reduce((s, k) => s + k.v[0] * k.w, 0);
  const y = b.qrs.reduce((s, k) => s + k.v[1] * k.w, 0);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Odchylenie ST w punkcie J+60 ms w odprowadzeniu [mV]. */
export function stAt(b: Beat, lead: LeadName | Lead): number {
  if (!b.st) return 0;
  const L = typeof lead === 'string' ? LEADS[lead] : lead;
  return dot(b.st, L.u) * L.gain;
}

/** Klasyfikacja osi według zakresów z wykładu S1_03. */
export function axisCategory(a: number): { label: string; ok: boolean } {
  let x = ((a + 180) % 360 + 360) % 360 - 180; if (x === -180) x = 180;
  if (x >= -30 && x <= 90) return { label: 'oś prawidłowa', ok: true };
  if (x < -30 && x >= -90) return { label: 'odchylenie osi w lewo', ok: false };
  if (x > 90 && x <= 180) return { label: 'odchylenie osi w prawo', ok: false };
  return { label: 'oś skrajna', ok: false };
}
