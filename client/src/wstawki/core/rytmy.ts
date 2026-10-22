/**
 * Generatory rytmów dla kardiomonitora: każdy dopisuje do paska (`Strip`) zdarzenia P, QRS i iglice
 * na kilka sekund do przodu. Kształty z modelu wektorowego (`model.ts`), więc ten sam rytm można
 * oglądać w dowolnym odprowadzeniu.
 *
 * Znaczniki zdarzeń (`tag`), z których korzysta monitor:
 *  - 'p'          załamek P przewiedziony albo zwykły,
 *  - 'p-blok'     P bez QRS,
 *  - 'qrs'        pobudzenie komór z tętnem (monitor liczy z nich HR, a SpO₂ rysuje falę tętna),
 *  - 'qrs-bt'     pobudzenie komór bez tętna (PEA, VT bez tętna),
 *  - 'iglica'     impuls stymulatora.
 */
import { bgAF, bgFlutter, bgVF, pComps, vBeat, type Background, type Strip, type StripEvent } from './rytm.js';
import type { BeatOpts, Comp, PKind } from './model.js';

export type Generator = (strip: Pisak, until: number) => void;

/** Losowanie z ziarnem, żeby ten sam scenariusz wyglądał zawsze tak samo. */
function los(seed: number): () => number {
  let a = seed >>> 0 || 7;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

const pEv = (strip: Pisak, at: number, comps: Comp[], blok = false) => strip.add({ kind: 'P', at, comps, tag: blok ? 'p-blok' : 'p' });
const qEv = (strip: Pisak, at: number, b: ReturnType<typeof vBeat>, tetno = true) => strip.add({ kind: 'QRS', at, beat: b, tag: tetno ? 'qrs' : 'qrs-bt' });

export interface ZatokowyOpts {
  hr: number;
  pr?: number;
  beat?: BeatOpts;
  p?: PKind;
  /** zmienność RR jak w rytmie zatokowym (ułamek, np. 0,03) */
  hrv?: number;
  /** przedwczesne pobudzenia komorowe: co które pobudzenie i jaki kształt */
  pvc?: { co: number; beat?: BeatOpts; sprzezenie?: number };
  /** pauza: co ile pobudzeń i jak długa (s), np. zahamowanie zatokowe */
  pauza?: { co: number; s: number };
  tetno?: boolean;
  seed?: number;
}

/** Rytm zatokowy (także bradykardia, tachykardia, blok I°, zawał, przerost — przez `beat`). */
export function zatokowy(o: ZatokowyOpts): Generator {
  const rr = 60 / o.hr, pr = o.pr ?? 0.16, r = los(o.seed ?? 11);
  const b = vBeat({ ...(o.beat ?? {}), pr });
  const pvcB = o.pvc ? vBeat(o.pvc.beat ?? { qrs: 'pvc-rv' }) : null;
  const pc = pComps(o.p ?? 'normal');
  let next = 0.4, n = 0;
  return (strip, until) => {
    while (next < until) {
      n++;
      if (o.pvc && pvcB && n % o.pvc.co === 0) {
        // pobudzenie przedwczesne, potem pauza wyrównawcza (następne P w swoim rytmie)
        const at = next - rr + rr * (o.pvc.sprzezenie ?? 0.62);
        qEv(strip, at, pvcB, o.tetno !== false);
        next += rr;
        continue;
      }
      const at = next;
      pEv(strip, at - pr, pc);
      qEv(strip, at, b, o.tetno !== false);
      const jitter = o.hrv ? (r() - 0.5) * 2 * o.hrv * rr : 0;
      next += rr + jitter + (o.pauza && n % o.pauza.co === 0 ? o.pauza.s : 0);
    }
  };
}

/** Migotanie przedsionków: brak P, fala f, RR zupełnie niemiarowe wokół średniej częstości. */
export function migotanie(o: { hr: number; beat?: BeatOpts; seed?: number; fala?: number }): Generator {
  const rr = 60 / o.hr, r = los(o.seed ?? 5), b = vBeat(o.beat ?? {});
  let next = 0.4, init = false;
  return (strip, until) => {
    if (!init) { strip.backgrounds.push(bgAF(o.fala ?? 0.05)); init = true; }
    while (next < until) {
      qEv(strip, next, b);
      const u = Math.max(0.0001, r()), v = r();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      next += Math.max(rr * 0.5, Math.min(rr * 1.8, rr * (1 + z * 0.26)));
    }
  };
}

/** Trzepotanie przedsionków: fale F z częstością `fala`/min, przewodzenie `ratio`:1 (albo zmienne). */
export function trzepotanie(o: { fala?: number; ratio: number | number[]; beat?: BeatOpts }): Generator {
  const fr = 60 / (o.fala ?? 300), b = vBeat(o.beat ?? {});
  const ratios = Array.isArray(o.ratio) ? o.ratio : [o.ratio];
  let next = 0.4, k = 0, init = false;
  return (strip, until) => {
    if (!init) { strip.backgrounds.push(bgFlutter(o.fala ?? 300, 0.15)); init = true; }
    while (next < until) {
      qEv(strip, next, b);
      next += fr * (ratios[k++ % ratios.length] ?? 2);
    }
  };
}

/**
 * Bloki AV z powtarzalnym wzorem: `pq` to lista odstępów PQ kolejnych P w sekwencji,
 * `null` oznacza P bez QRS. Np. Wenckebach 4:3: [0.16, 0.28, 0.36, null].
 */
export function blokAV(o: { pp: number; pq: Array<number | null>; beat?: BeatOpts }): Generator {
  const b = vBeat(o.beat ?? {}), pc = pComps('normal');
  let tp = 0.25, k = 0;
  return (strip, until) => {
    while (tp < until) {
      const pq = o.pq[k++ % o.pq.length] ?? null;
      pEv(strip, tp, pc, pq === null);
      if (pq !== null) qEv(strip, tp + pq, b);
      tp += o.pp;
    }
  };
}

/** Blok AV III stopnia: P i QRS niezależnie, każde we własnym rytmie. */
export function rozkojarzenie(o: { pp: number; rr: number; beat?: BeatOpts; przesuniecie?: number }): Generator {
  const b = vBeat(o.beat ?? { qrs: 'vent' }), pc = pComps('normal');
  let tp = 0.2, tq = 0.2 + (o.przesuniecie ?? 0.37);
  return (strip, until) => {
    while (tp < until) { pEv(strip, tp, pc, true); tp += o.pp; }
    while (tq < until) { qEv(strip, tq, b); tq += o.rr; }
  };
}

/** Miarowy rytm komorowy (VT jednokształtny, rytm komorowy zastępczy) albo wąski częstoskurcz bez P. */
export function miarowyBezP(o: { hr: number; beat?: BeatOpts; tetno?: boolean; ptyl?: PKind }): Generator {
  const rr = 60 / o.hr, b = vBeat(o.beat ?? { qrs: 'vent' });
  const pt = o.ptyl ? pComps(o.ptyl, 0.8) : null;
  let next = 0.3;
  return (strip, until) => {
    while (next < until) {
      qEv(strip, next, b, o.tetno !== false);
      if (pt) pEv(strip, next + 0.09, pt); // wsteczne P tuż za QRS
      next += rr;
    }
  };
}

/** Torsade de pointes: szybki rytm komorowy, którego amplituda i kierunek falują wokół linii. */
export function torsade(o: { hr?: number; tetno?: boolean }): Generator {
  const rr = 60 / (o.hr ?? 240);
  let next = 0.3, n = 0;
  return (strip, until) => {
    while (next < until) {
      // obrót wokół linii izoelektrycznej: przez kilka pobudzeń przewaga wychyleń dodatnich, potem ujemnych (S2_05)
      const faza = Math.sin((2 * Math.PI * n) / 12);
      const b0 = vBeat({ qrs: 'vent', qrsAmp: 0.2 + 2.1 * Math.abs(faza) ** 1.3, qt: 0.26 });
      const znak = faza >= 0 ? 1 : -1;
      const odwr = (c: Comp): Comp => ({ ...c, v: [c.v[0] * znak, c.v[1] * znak, c.v[2] * znak] });
      const b = { ...b0, qrs: b0.qrs.map(odwr), t: b0.t.map(odwr) };
      qEv(strip, next, b, o.tetno === true);
      n++; next += rr;
    }
  };
}

/** Migotanie komór (bez zespołów QRS i bez tętna). */
export function migotanieKomor(o: { grube?: boolean }): Generator {
  let init = false;
  return (strip) => { if (!init) { strip.backgrounds.push(bgVF(o.grube !== false, 1.7)); init = true; } };
}

/** Asystolia: prawie płaska linia; opcjonalnie same załamki P bez odpowiedzi komór. */
export function asystolia(o: { p?: number } = {}): Generator {
  const pc = pComps('normal');
  let tp = 0.5, init = false;
  return (strip, until) => {
    if (!init) { strip.backgrounds.push((t) => 0.012 * Math.sin(2 * Math.PI * 0.33 * t) + 0.006 * Math.sin(2 * Math.PI * 1.7 * t)); init = true; }
    if (!o.p) return;
    while (tp < until) { pEv(strip, tp, pc, true); tp += 60 / o.p; }
  };
}

/** Stymulacja komorowa VVI z częstością `hr` (iglica + szeroki QRS); opcjonalnie co któryś impuls bez wychwytu. */
export function stymulacjaVVI(o: { hr: number; bezWychwytu?: number; beatPaced?: BeatOpts }): Generator {
  const rr = 60 / o.hr;
  const b = vBeat(o.beatPaced ?? { qrs: 'paced-rv', qrsAmp: 2.2 });
  let next = 0.4, n = 0;
  return (strip, until) => {
    while (next < until) {
      n++;
      strip.add({ kind: 'spike', at: next, chamber: 'V', amp: 1.6, tag: 'iglica' });
      if (!(o.bezWychwytu && n % o.bezWychwytu === 0)) qEv(strip, next + 0.004, b);
      next += rr;
    }
  };
}

/** To, czego generator potrzebuje od paska: dopisać zdarzenie i dołożyć tło. */
export interface Pisak {
  add(e: StripEvent): unknown;
  backgrounds: { push(b: Background): unknown };
}

/** Pisak przesunięty w czasie: generator pisze od zera, a zdarzenia lądują od `od` do `doo`. */
function przesuniety(strip: Strip, od: number, doo: number): Pisak {
  return {
    add: (e) => { const at = e.at + od; if (at < doo) strip.add({ ...e, at }); return e; },
    backgrounds: { push: (b: Background) => strip.backgrounds.push((t, lead) => (t >= od && t < doo ? b(t - od, lead) : 0)) },
  };
}

/**
 * Scenariusz z kolejnymi fazami: od chwili `od` (s) działa nowy rytm. `gen` to fabryka, bo przy
 * zapętleniu (`petla` w s) każdy obieg zaczyna fazy od nowa.
 */
export function fazy(lista: Array<{ od: number; gen: () => Generator }>, petla?: number): Generator {
  const obiegi = new Map<number, Array<{ g: Generator; od: number; doo: number; p: Pisak | null }>>();
  let pierwszy = 0;
  return (strip, until) => {
    const L = petla ?? Infinity;
    const ostatni = Number.isFinite(L) ? Math.floor(until / L) : 0;
    for (let c = pierwszy; c <= ostatni; c++) {
      const start = Number.isFinite(L) ? c * L : 0;
      if (start > until) break;
      let ob = obiegi.get(c);
      if (!ob) {
        ob = lista.map((f, i) => ({ g: f.gen(), od: start + f.od, doo: Math.min(start + (lista[i + 1]?.od ?? L), Number.isFinite(L) ? start + L : Infinity), p: null }));
        obiegi.set(c, ob);
      }
      for (const f of ob) {
        if (until < f.od) continue;
        f.p ??= przesuniety(strip as Strip, f.od, f.doo);
        f.g(f.p as unknown as Strip, Math.min(until, f.doo) - f.od);
      }
    }
    // stare obiegi nie są już potrzebne
    // stare obiegi już nic nie dopisują — nie odtwarzamy ich więcej
    for (const c of obiegi.keys()) if (Number.isFinite(L) && (c + 1) * L < until - 15) { obiegi.delete(c); pierwszy = Math.max(pierwszy, c + 1); }
  };
}
