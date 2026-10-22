/**
 * Droga impulsu — czysta logika bez DOM: wartości z wykładu S1_00, harmonogram pobudzenia
 * każdej struktury, scenariusze rytmu i stan schematu w dowolnej chwili t.
 *
 * Jeden zegar dla schematu i zapisu: t w sekundach, czas bezwzględny okna paska.
 * Pobudzenie (`Pob`) ma `at` = początek QRS; załamek P zaczyna się w `at − pq`.
 * Zapis liczymy z modelu wektorowego (`core/model.ts`), schemat z tego samego `at`, `pq`, `qrs`,
 * więc czoło fali na schemacie i pióro na zapisie są zawsze w tej samej chwili.
 */
import { beat, volt, type Beat } from './core/model.js';

/* ─────────── wartości z wykładu (każda ma cytat w karcie) ─────────── */

export const W = {
  /** S1_00 „Od układu przewodzącego do zapisu EKG”: przykładowy cykl. */
  pqMapa: 0.16, qrsWaski: 0.08, hrMapa: 75,
  /** S1_00 „Pęczek Hisa…”: QRS trwający 0,16 s (cztery małe kratki). */
  qrsSzeroki: 0.16,
  /** S1_00 „Przez przedsionki do węzła AV…”: norma PQ 0,12-0,20 s, przykład 0,16 i 0,24 s. */
  pqNorma: [0.12, 0.2] as const,
  pqWybor: [0.12, 0.16, 0.2, 0.24] as const,
  /** Prawidłowy QRS: mniej niż 110 ms; od 120 ms szeroki. */
  qrsNormaMs: 110, qrsSzerokiMs: 120,
  /** Hierarchia rozruszników: zakresy orientacyjne. */
  zatokowy: [60, 100] as const, lacze: [40, 60] as const, komorowy: [20, 40] as const,
  /** S1_00 „Serce, które bije samo…”: 1 s → 60/min, 0,5 s → 120/min. */
  cykl: { min: 0.5, max: 1.5, zatrzaski: [1, 0.5] as const },
  /** Mała kratka przy 25 mm/s. */
  kratka: 0.04,
} as const;

/** Częstość z czasu jednego cyklu: „Częstość to po prostu odwrotność czasu jednego cyklu”. */
export const hrZCyklu = (T: number): number => 60 / T;
export const cyklZHr = (hr: number): number => 60 / hr;
/** Częstość z liczby dużych kratek między R: 300 / n. */
export const hrZDuzychKratek = (n: number): number => 300 / n;
/** Liczba małych kratek (0,04 s) dla czasu w s. */
export const kratki = (s: number): number => Math.round((s / W.kratka) * 100) / 100;
const EPS = 1e-9;
export const pqWNormie = (pq: number): boolean => pq >= W.pqNorma[0] - EPS && pq <= W.pqNorma[1] + EPS;
/** Blok I stopnia dopiero przy PQ powyżej 0,20 s (granica należy do normy). */
export const pqBlokI = (pq: number): boolean => pq > W.pqNorma[1] + EPS;
export const qrsSzeroki = (s: number): boolean => s * 1000 >= W.qrsSzerokiMs - EPS;
export const qrsWNormie = (s: number): boolean => s * 1000 < W.qrsNormaMs - EPS;

/** Zatrzask suwaka cyklu na wartościach z tekstu. */
export function zatrzask(T: number, zasieg = 0.03): number {
  for (const z of W.cykl.zatrzaski) if (Math.abs(T - z) <= zasieg + 1e-9) return z;
  return Math.round(T * 100) / 100;
}

/* ─────────── pobudzenia i scenariusze ─────────── */

export type Rodzaj = 'zatokowy' | 'lacze' | 'komorowy';
export type Blok = 'brak' | 'prawa' | 'lewa';
export interface Pob { rodzaj: Rodzaj; at: number; pq: number; qrs: number; blok: Blok; /** kształt QT przy zmianie cyklu (bez podpisu wartością) */ rr?: number }

export type Tryb = 'mapa' | 'brama' | 'autostrady' | 'hierarchia' | 'automatyzm';
export const TRYBY: readonly Tryb[] = ['mapa', 'brama', 'autostrady', 'hierarchia', 'automatyzm'];
export type Hier = 'gra' | 'milczy' | 'cisza';

export interface Scen {
  /** Długość okna paska w s (przy 25 mm/s). */
  okno: number;
  pob: Pob[];
  /** Czy dyrygent (węzeł zatokowy) gra w danej chwili. */
  dyrygent: (t: number) => boolean;
  /** Czy łącze milczy (dla trybu „cisza”). */
  laczeMilczy: boolean;
  /** Przerwa po ostatnim pobudzeniu zatokowym (do podpisu „przerwa”). */
  przerwa: [number, number] | null;
}

const RR_MAPA = cyklZHr(W.hrMapa); // 0,8 s = cztery duże kratki
/** Rytm z łącza w środku zakresu 40-60/min, komorowy 30/min jak w przykładzie z wykładu. */
export const RR_LACZE = cyklZHr(50);
export const RR_KOMORY = cyklZHr(30);

function okresowy(okno: number, rr: number, pierwszy: number, f: (at: number) => Pob): Pob[] {
  const out: Pob[] = [];
  for (let at = pierwszy - Math.ceil(pierwszy / rr + 1) * rr; at < okno + 1; at += rr) out.push(f(Math.round(at * 1e6) / 1e6));
  return out;
}

export const OKNO = { mapa: 2.4, automatyzm: 3, hierarchia: 5.6, cwiczenie: 4 } as const;

/** Rytm zatokowy 75/min, okno = trzy cykle (bez szwu przy zapętleniu). */
export function scenZatokowy(o: { pq?: number; blok?: Blok; okno?: number; pierwszy?: number } = {}): Scen {
  const pq = o.pq ?? W.pqMapa, blok = o.blok ?? 'brak';
  const qrs = blok === 'brak' ? W.qrsWaski : W.qrsSzeroki;
  const okno = o.okno ?? OKNO.mapa;
  return { okno, pob: okresowy(okno, RR_MAPA, o.pierwszy ?? 0.4, (at) => ({ rodzaj: 'zatokowy', at, pq, qrs, blok })), dyrygent: () => true, laczeMilczy: false, przerwa: null };
}

/** Automatyzm: cykl T, pierwszy załamek P w 0,2 s. */
export function scenAutomatyzm(T: number): Scen {
  const okno = OKNO.automatyzm;
  return { okno, pob: okresowy(okno, T, 0.2 + W.pqMapa, (at) => ({ rodzaj: 'zatokowy', at, pq: W.pqMapa, qrs: W.qrsWaski, blok: 'brak', rr: T })), dyrygent: () => true, laczeMilczy: false, przerwa: null };
}

/**
 * Hierarchia: „gra” — rytm zatokowy; „milczy” — dwa pobudzenia zatokowe, przerwa, rytm z łącza;
 * „cisza” — milczy też łącze: po przerwie rytm komorowy. Pierwsze zastępcze przychodzi po przerwie
 * równej własnemu cyklowi ośrodka liczonemu od ostatniego QRS.
 */
export function scenHierarchia(st: Hier): Scen {
  const okno = OKNO.hierarchia;
  const zat = (at: number): Pob => ({ rodzaj: 'zatokowy', at, pq: W.pqMapa, qrs: W.qrsWaski, blok: 'brak' });
  if (st === 'gra') return { ...scenZatokowy({ okno }), okno };
  const ostatni = 0.4 + RR_MAPA; // 1,2 s
  const pob: Pob[] = [zat(0.4 - RR_MAPA), zat(0.4), zat(ostatni)];
  const rr = st === 'milczy' ? RR_LACZE : RR_KOMORY;
  for (let at = ostatni + rr; at < okno + 1; at += rr) {
    const a = Math.round(at * 1e6) / 1e6;
    pob.push(st === 'milczy' ? { rodzaj: 'lacze', at: a, pq: 0, qrs: W.qrsWaski, blok: 'brak' } : { rodzaj: 'komorowy', at: a, pq: 0, qrs: W.qrsSzeroki, blok: 'brak' });
  }
  const pierwszy = pob.find((p) => p.rodzaj !== 'zatokowy')!.at;
  const ciszaOd = ostatni + 0.3; // dyrygent milknie po ostatnim P
  return { okno, pob, dyrygent: (t) => t < ciszaOd, laczeMilczy: st === 'cisza', przerwa: [ostatni, pierwszy] };
}

/** Rytm zastępczy bez przejścia (do ćwiczenia). */
export function scenZastepczy(r: 'lacze' | 'komorowy', okno: number = OKNO.cwiczenie): Scen {
  const rr = r === 'lacze' ? RR_LACZE : RR_KOMORY;
  const pob = okresowy(okno, rr, r === 'lacze' ? 0.6 : 0.8, (at) => ({ rodzaj: r, at, pq: 0, qrs: r === 'lacze' ? W.qrsWaski : W.qrsSzeroki, blok: 'brak' }));
  return { okno, pob, dyrygent: () => false, laczeMilczy: r === 'komorowy', przerwa: null };
}

/* ─────────── model zapisu ─────────── */

/** Rozciąga QRS gotowej morfologii do zadanej szerokości (T przesuwa się razem z końcem QRS). */
export function rozciagnij(b: Beat, cel: number): Beat {
  const k = cel / b.j, d = cel - b.j;
  return {
    ...b,
    qrs: b.qrs.map((c) => ({ ...c, t: c.t * k, w: c.w * k, w2: c.w2 === undefined ? undefined : c.w2 * k })),
    t: b.t.map((c) => ({ ...c, t: c.t + d })),
    u: b.u.map((c) => ({ ...c, t: c.t + d })),
    j: cel, tPeak: b.tPeak + d, qrsMs: Math.round(cel * 1000), qtMs: b.qtMs + Math.round(d * 1000),
  };
}

const cache = new Map<string, Beat>();
/** Pobudzenie z modelu wektorowego dla danego `Pob`. */
export function beatDla(p: Pob): Beat {
  const key = `${p.rodzaj}|${p.pq}|${p.qrs}|${p.blok}|${p.rr ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // QT tylko jako kształt: przy krótszym cyklu T wcześniej się kończy (bez podpisu wartością)
  const qt = p.rr ? 0.38 * Math.sqrt(p.rr / RR_MAPA) : undefined;
  let b: Beat;
  if (p.rodzaj === 'komorowy') b = rozciagnij(beat({ p: 'none', qrs: 'vent', qt }), p.qrs);
  else {
    const pk = p.rodzaj === 'lacze' ? 'none' as const : 'normal' as const;
    if (p.blok === 'brak') b = beat({ p: pk, pr: p.pq || 0.16, qrsWide: p.qrs / 0.09, qt });
    else b = rozciagnij(beat({ p: pk, pr: p.pq, qrs: p.blok === 'prawa' ? 'rbbb' : 'lbbb', qt }), p.qrs);
  }
  cache.set(key, b);
  return b;
}

/** Napięcie w odprowadzeniu II w chwili t [mV]. */
export function sygnal(sc: Scen): (t: number) => number {
  const items = sc.pob.map((p) => ({ p, b: beatDla(p) }));
  return (t) => {
    let v = 0;
    for (const { p, b } of items) {
      const dt = t - p.at;
      if (dt < -p.pq - 0.08 || dt > 0.8) continue;
      v += volt(b, 'II', dt);
    }
    return v;
  };
}

/* ─────────── elementy zapisu ─────────── */

export type Seg = 'P' | 'PQ' | 'QRS' | 'ST' | 'T';
export const SEGI: readonly Seg[] = ['P', 'PQ', 'QRS', 'ST', 'T'];
/** Czas widocznego załamka P w modelu (od początku P). Kształt, bez podpisu wartością. */
export const P_DUR = 0.1;

/** Granice elementów zapisu w czasie bezwzględnym. PQ to odstęp: od początku P do początku QRS. */
export function granice(p: Pob): Partial<Record<Seg, [number, number]>> {
  const b = beatDla(p);
  const tK = tKoniec(b), tP = tPoczatek(b);
  const g: Partial<Record<Seg, [number, number]>> = {
    QRS: [p.at, p.at + p.qrs], ST: [p.at + p.qrs, p.at + tP], T: [p.at + tP, p.at + tK],
  };
  if (p.rodzaj === 'zatokowy') { g.P = [p.at - p.pq, p.at - p.pq + P_DUR]; g.PQ = [p.at - p.pq, p.at]; }
  return g;
}
const tPoczatek = (b: Beat) => b.tPeak - 0.12;
const tKoniec = (b: Beat) => b.qtMs / 1000;

export type Faza = Exclude<Seg, 'PQ'> | 'odcinekPQ' | 'spoczynek' | 'przerwa';
/** Element zapisu pod kursorem. Odcinek PQ = od końca P do początku QRS. */
export function faza(sc: Scen, t: number): { faza: Faza; pob: Pob | null } {
  for (const p of sc.pob) {
    const g = granice(p);
    if (g.P && t >= g.P[0] && t < g.P[1]) return { faza: 'P', pob: p };
    if (g.PQ && t >= g.PQ[0] && t < g.PQ[1]) return { faza: 'odcinekPQ', pob: p };
    for (const s of ['QRS', 'ST', 'T'] as const) { const r = g[s]; if (r && t >= r[0] && t < r[1]) return { faza: s, pob: p }; }
  }
  if (sc.przerwa && t > sc.przerwa[0] && t < sc.przerwa[1]) return { faza: 'przerwa', pob: null };
  return { faza: 'spoczynek', pob: null };
}

/* ─────────── harmonogram schematu ─────────── */

/** Odcinki układu przewodzącego rysowane jako ścieżki. */
export type Sciezka = 'doAV' | 'doLP' | 'his' | 'odnP' | 'odnL' | 'purP' | 'purL';
export const SCIEZKI: readonly Sciezka[] = ['doAV', 'doLP', 'his', 'odnP', 'odnL', 'purP', 'purL'];
/** Miejsce zamknięcia autostrady (ułamek drogi odnogi). */
export const STOP = { odnP: 0.3, odnL: 0.45 } as const;
export type Strefa = 'przedsionki' | 'kp' | 'kl';
export const STREFY: readonly Strefa[] = ['przedsionki', 'kp', 'kl'];
/** Punkty, z których fala rozlewa się po mięśniu (położenie zna rysunek). */
export type Zrodlo = 'sa' | 'av' | 'przegrodaL' | 'koniuszekL' | 'scianaL' | 'koniuszekP' | 'scianaP' | 'przegrodaDoL' | 'przegrodaDoP' | 'ognisko' | 'ogniskoDoL';

export interface Odc { id: Sciezka; t0: number; t1: number; /** blok: czoło staje na tym ułamku drogi */ stop?: number }
export interface Fala { strefa: Strefa; zrodlo: Zrodlo; t0: number; t1: number; /** objazd przy zamkniętej autostradzie */ objazd?: boolean; /** wolne szerzenie przez mięsień (rysowane przerywanym czołem) */ wolna?: boolean }
export interface Plan {
  pob: Pob;
  sa: number | null;
  /** Przystanek w bramie AV: od dotarcia impulsu do jego wyjścia. */
  av: [number, number] | null;
  /** Impuls narodzony w łączu (rytm zastępczy). */
  zaplonAV: number | null;
  zaplonKomory: number | null;
  odc: Odc[];
  fale: Fala[];
  /** Powrót do spoczynku (wygaszanie): przedsionki chowają się w QRS, komory to T. */
  repP: [number, number] | null;
  repK: [number, number];
}

/** Stałe kształtu (bez podpisu wartością): przewodzenie przez przedsionki do bramy i od pęczka Hisa do komór. */
export const DO_AV = 0.035;
export const HV = 0.045;
/** Postój w bramie AV: reszta odstępu PQ po odjęciu drogi przez przedsionki i dalszego układu. */
export const postojAV = (pq: number): number => pq - DO_AV - HV;

export function plan(p: Pob): Plan {
  const b = beatDla(p), at = p.at, q = p.qrs;
  const repK: [number, number] = [at + b.tPeak - 0.1, at + tKoniec(b)];
  const odc: Odc[] = [];
  const fale: Fala[] = [];
  const hisDo = (): void => {
    odc.push({ id: 'his', t0: at - HV, t1: at - 0.03 });
    const blokP = p.blok === 'prawa', blokL = p.blok === 'lewa';
    odc.push({ id: 'odnP', t0: at - 0.03, t1: at - 0.012, stop: blokP ? STOP.odnP : undefined });
    odc.push({ id: 'odnL', t0: at - 0.03, t1: at - 0.012, stop: blokL ? STOP.odnL : undefined });
    if (!blokP) odc.push({ id: 'purP', t0: at - 0.012, t1: at + 0.014 });
    if (!blokL) odc.push({ id: 'purL', t0: at - 0.012, t1: at + 0.014 });
    // komora z drożną autostradą kończy się po czasie wąskiego QRS, spóźniona — z końcem szerokiego
    const kon = at + W.qrsWaski;
    if (blokP) fale.push({ strefa: 'kp', zrodlo: 'przegrodaDoP', t0: at + 0.03, t1: at + q, objazd: true, wolna: true });
    else {
      fale.push({ strefa: 'kp', zrodlo: 'koniuszekP', t0: at + 0.01, t1: blokL ? kon : at + q });
      fale.push({ strefa: 'kp', zrodlo: 'scianaP', t0: at + 0.018, t1: blokL ? kon : at + q });
    }
    if (blokL) fale.push({ strefa: 'kl', zrodlo: 'przegrodaDoL', t0: at + 0.03, t1: at + q, objazd: true, wolna: true });
    else {
      fale.push({ strefa: 'kl', zrodlo: 'przegrodaL', t0: at, t1: blokP ? kon : at + q });
      fale.push({ strefa: 'kl', zrodlo: 'koniuszekL', t0: at + 0.01, t1: blokP ? kon : at + q });
      fale.push({ strefa: 'kl', zrodlo: 'scianaL', t0: at + 0.018, t1: blokP ? kon : at + q });
    }
  };
  if (p.rodzaj === 'zatokowy') {
    const p0 = at - p.pq;
    fale.push({ strefa: 'przedsionki', zrodlo: 'sa', t0: p0, t1: p0 + P_DUR });
    // drogi poglądowe przez przedsionki: do bramy i do lewego przedsionka
    odc.push({ id: 'doAV', t0: p0, t1: p0 + DO_AV });
    odc.push({ id: 'doLP', t0: p0, t1: p0 + P_DUR * 0.8 });
    hisDo();
    return { pob: p, sa: p0, av: [p0 + DO_AV, at - HV], zaplonAV: null, zaplonKomory: null, odc, fale, repP: [at, at + q], repK };
  }
  if (p.rodzaj === 'lacze') {
    // impuls rodzi się przy bramie: w dół autostradą, wstecznie do przedsionków (P chowa się w QRS)
    hisDo();
    fale.push({ strefa: 'przedsionki', zrodlo: 'av', t0: at - 0.03, t1: at - 0.03 + P_DUR });
    return { pob: p, sa: null, av: null, zaplonAV: at - HV - 0.01, zaplonKomory: null, odc, fale, repP: [at + 0.12, at + 0.26], repK };
  }
  // komorowy: ognisko w mięśniu komór, pobudzenie obejmuje komory inną drogą, przez mięsień
  fale.push({ strefa: 'kp', zrodlo: 'ognisko', t0: at, t1: at + 0.1, wolna: true });
  fale.push({ strefa: 'kl', zrodlo: 'ogniskoDoL', t0: at + 0.035, t1: at + q, wolna: true });
  return { pob: p, sa: null, av: null, zaplonAV: null, zaplonKomory: at, odc, fale, repP: null, repK };
}

/* ─────────── stan schematu w chwili t ─────────── */

export interface Stan {
  /** Postęp czoła na ścieżce (0..1) i jasność pobudzenia (0..1). */
  sciezki: Record<Sciezka, { p: number; a: number; glowa: boolean }>;
  /** Fale w mięśniu: promień jako ułamek zasięgu (0..1), jasność czoła. */
  fale: Array<{ strefa: Strefa; zrodlo: Zrodlo; r: number; czolo: number; objazd: boolean; wolna: boolean }>;
  strefy: Record<Strefa, number>;
  /** Błysk węzła zatokowego (0..1). */
  sa: number;
  /** Brama AV: jasność węzła, czy impuls czeka u odźwiernego, otwarcie skrzydła 0..1. */
  av: { a: number; czeka: boolean; otwarcie: number; zaplon: number };
  komoryZaplon: number;
  /** Gdzie jest czoło fali (do odczytu). */
  czolo: Czolo;
}
export type Czolo = 'spoczynek' | 'przedsionki' | 'brama' | 'his' | 'odnogi' | 'purkinje' | 'komory' | 'objazd' | 'lacze' | 'ognisko';

const cl = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (t: number, a: number, b: number) => cl((t - a) / (b - a));
const fade = (t: number, r: [number, number] | null) => (r ? 1 - ramp(t, r[0], r[1]) : 1);

/** Ostatni plan, który zaczął się przed t (pobudzenia się nie nakładają). */
function aktywny(plany: Plan[], t: number): Plan | null {
  let best: Plan | null = null;
  for (const pl of plany) {
    const start = pl.sa ?? pl.zaplonAV ?? pl.zaplonKomory ?? pl.pob.at;
    if (start <= t + 1e-9 && (!best || start > (best.sa ?? best.zaplonAV ?? best.zaplonKomory ?? best.pob.at))) best = pl;
  }
  return best;
}

export function plany(sc: Scen): Plan[] { return sc.pob.map(plan); }

export function stan(pl: Plan[], t: number): Stan {
  const s: Stan = {
    sciezki: { doAV: { p: 0, a: 0, glowa: false }, doLP: { p: 0, a: 0, glowa: false }, his: { p: 0, a: 0, glowa: false }, odnP: { p: 0, a: 0, glowa: false }, odnL: { p: 0, a: 0, glowa: false }, purP: { p: 0, a: 0, glowa: false }, purL: { p: 0, a: 0, glowa: false } },
    fale: [], strefy: { przedsionki: 0, kp: 0, kl: 0 }, sa: 0,
    av: { a: 0, czeka: false, otwarcie: 0, zaplon: 0 }, komoryZaplon: 0, czolo: 'spoczynek',
  };
  const a = aktywny(pl, t);
  if (!a) return s;
  const fK = fade(t, a.repK);
  // czoło fali = to, co ruszyło najpóźniej i jeszcze trwa
  let czolo: Czolo = 'spoczynek', czT = -Infinity;
  const kand = (c: Czolo, t0: number) => { if (t0 >= czT) { czolo = c; czT = t0; } };
  for (const f of a.fale) {
    if (t < f.t0) continue;
    const r = ramp(t, f.t0, f.t1);
    const k = f.strefa === 'przedsionki' ? fade(t, a.repP) : fK;
    if (k <= 0) continue;
    s.fale.push({ strefa: f.strefa, zrodlo: f.zrodlo, r, czolo: r < 1 ? (1 - r * 0.6) * k : 0, objazd: !!f.objazd, wolna: !!f.wolna });
    s.strefy[f.strefa] = Math.max(s.strefy[f.strefa], k);
    if (r < 1) kand(f.strefa === 'przedsionki' ? 'przedsionki' : f.objazd ? 'objazd' : 'komory', f.t0);
  }
  for (const o of a.odc) {
    if (t < o.t0) continue;
    const p = ramp(t, o.t0, o.t1) * (o.stop ?? 1);
    const przed = o.id === 'doAV' || o.id === 'doLP';
    const k = przed ? fade(t, a.repP) : fK;
    s.sciezki[o.id] = { p, a: k, glowa: t < o.t1 && k > 0 };
    if (t < o.t1) kand(przed ? 'przedsionki' : o.id === 'his' ? 'his' : o.id.startsWith('odn') ? 'odnogi' : 'purkinje', o.t0);
  }
  if (a.sa !== null) s.sa = t >= a.sa ? 1 - ramp(t, a.sa + 0.015, a.sa + 0.09) : 0;
  if (a.av) {
    const [a0, a1] = a.av;
    if (t >= a0) s.av.a = 1 - ramp(t, a.pob.at + a.pob.qrs, a.pob.at + a.pob.qrs + 0.12);
    s.av.czeka = t >= a0 && t < a1;
    // skrzydło otwiera się pod koniec postoju i zamyka po przejściu impulsu
    s.av.otwarcie = ramp(t, a1 - 0.014, a1) * (1 - ramp(t, a.pob.at + 0.02, a.pob.at + 0.05));
    // w czasie załamka P czołem są przedsionki; postój w bramie widać jako czoło dopiero po P
    if (s.av.czeka && t >= (a.sa ?? -Infinity) + P_DUR) kand('brama', a0);
  }
  if (a.zaplonAV !== null && t >= a.zaplonAV) {
    s.av.zaplon = 1 - ramp(t, a.zaplonAV + 0.02, a.zaplonAV + 0.14);
    s.av.a = fK;
    if (t < a.zaplonAV + 0.01) kand('lacze', a.zaplonAV);
  }
  if (a.zaplonKomory !== null && t >= a.zaplonKomory) {
    s.komoryZaplon = 1 - ramp(t, a.zaplonKomory + 0.02, a.zaplonKomory + 0.14);
    if (t < a.zaplonKomory + 0.006) kand('ognisko', a.zaplonKomory + 1e-6);
  }
  s.czolo = czolo;
  return s;
}

/* ─────────── automatyzm: potencjał komórki rozrusznikowej (kształt) ─────────── */

/** Czas trwania potencjału czynnościowego komórki rozrusznikowej na rysunku (kształt). */
const AP = 0.17;
/** Czas narastania fazy 0 (kształt). */
const UP = 0.06;
/**
 * Znormalizowany potencjał błonowy: 0 = najbardziej ujemny, `PROG` = próg, 1 = szczyt.
 * Impuls (przekroczenie progu) w chwilach `zaplony`; między nimi powolna spontaniczna depolaryzacja.
 */
export const PROG = 0.42;
export function potencjal(zaplony: number[], t: number): number {
  let last = -Infinity, next = Infinity;
  for (const z of zaplony) { if (z <= t) last = Math.max(last, z); else next = Math.min(next, z); }
  if (last > -Infinity && t - last < AP) {
    const d = t - last;
    // faza 0 w węźle zatokowym zależy od prądu wapniowego: narastanie łagodniejsze niż w komórce roboczej (kształt)
    if (d < UP) { const u = d / UP; return PROG + (1 - PROG) * (u * u * (3 - 2 * u)); }
    const k = (d - UP) / (AP - UP);
    return 1 - (1 - 0.0) * (k * k * (3 - 2 * k)); // repolaryzacja do dna
  }
  const start = last > -Infinity ? last + AP : next - 1;
  const end = next < Infinity ? next : start + 1;
  const k = cl((t - start) / Math.max(0.05, end - start));
  // narastanie lekko wypukłe: szybciej na początku, wolniej przy progu
  return PROG * (k * (1.25 - 0.25 * k));
}
/** Chwile wyzwolenia impulsu przez węzeł zatokowy = początki P. */
export const zaplonySA = (sc: Scen): number[] => sc.pob.filter((p) => p.rodzaj === 'zatokowy').map((p) => p.at - p.pq);
