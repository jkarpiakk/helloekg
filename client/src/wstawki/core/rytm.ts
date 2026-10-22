/**
 * Paski rytmu: zdarzenia w czasie (P, QRS z T, iglice stymulatora) + tła (fala f, trzepotanie, VF, zakłócenia)
 * oraz monitor, który je rysuje — przesuwem jak kardiomonitor albo przewijanym papierem.
 *
 * Zdarzenia mają czas bezwzględny w sekundach (zegar wstawki). Kształty pochodzą z modelu wektorowego
 * (`model.ts`), więc ten sam pasek można pokazać w dowolnym odprowadzeniu.
 */
import { C, h, loop, reducedMotion, surface, paper, trace, type Surface } from './ui.js';
import { LEADS, beat, dot, volt, type Beat, type BeatOpts, type Comp, type Lead, type LeadName, type PKind } from './model.js';

export interface PEvent { kind: 'P'; at: number; comps: Comp[]; /** do nakładek: przewiedzione / zablokowane / niezależne */ tag?: string }
export interface QEvent { kind: 'QRS'; at: number; beat: Beat; tag?: string }
export interface SpikeEvent { kind: 'spike'; at: number; chamber: 'A' | 'V'; amp: number; tag?: string }
export type StripEvent = PEvent | QEvent | SpikeEvent;

/** Kształt samego załamka P, czas liczony od początku P. */
export function pComps(kind: PKind = 'normal', amp = 1): Comp[] {
  return beat({ p: kind, pr: 0, pAmp: amp }).p;
}
/** Pobudzenie komór (QRS + ST + T) bez załamka P. */
export function vBeat(o: BeatOpts = {}): Beat {
  return { ...beat({ ...o, p: 'none' }) };
}

const gk = (k: Comp, t: number): number => {
  const w = k.w2 !== undefined && t > k.t ? k.w2 : k.w;
  const d = (t - k.t) / w;
  return d > 5 || d < -5 ? 0 : Math.exp(-0.5 * d * d);
};

export type Background = (t: number, lead: Lead) => number;

/** Fala f migotania przedsionków (drobna, nieregularna). */
export const bgAF = (amp = 0.06): Background => (t) =>
  amp * (Math.sin(2 * Math.PI * 5.1 * t) * 0.5 + Math.sin(2 * Math.PI * 6.7 * t + 1.3) * 0.32 + Math.sin(2 * Math.PI * 8.3 * t + 2.1) * 0.22 + Math.sin(2 * Math.PI * 3.9 * t + 0.4) * 0.2);

/** Fale F trzepotania (zęby piły), ujemne w odprowadzeniach dolnych. `rate` na minutę. */
export const bgFlutter = (rate = 300, amp = 0.16): Background => (t, lead) => {
  const per = 60 / rate, ph = ((t % per) + per) % per / per;
  const saw = ph < 0.72 ? -(ph / 0.72) : -1 + (ph - 0.72) / 0.28; // powolne opadanie, szybki powrót
  const dirInf = dot([0.05, 1, 0.1], lead.u) * lead.gain; // fale F najlepiej widać w II, III, aVF
  return amp * (saw + 0.5) * (Math.abs(dirInf) > 0.3 ? Math.sign(dirInf) : 0.5);
};

/** Migotanie komór: grube lub drobne, chaotyczne. */
export const bgVF = (coarse = true, seed = 1): Background => (t) => {
  const a = coarse ? 0.55 : 0.18;
  const m = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.4 * t + seed);
  return a * m * (Math.sin(2 * Math.PI * 4.6 * t + seed) * 0.6 + Math.sin(2 * Math.PI * 6.1 * t + 2 * seed) * 0.35 + Math.sin(2 * Math.PI * 3.3 * t + 0.7) * 0.3 + Math.sin(2 * Math.PI * 8.9 * t + seed * 3) * 0.15);
};

/** Potencjały mięśniowe (szum o wysokiej częstotliwości), np. z mięśnia piersiowego. */
export const bgMyo = (amp = 0.08, seed = 3): Background => (t) => {
  let v = 0;
  for (let i = 1; i <= 6; i++) v += Math.sin(2 * Math.PI * (23 + i * 11.3) * t + seed * i) / i;
  const burst = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.7 * t + seed);
  return amp * v * burst * burst;
};

/** Pasek zdarzeń z szybkim wyszukiwaniem okna czasu. */
export class Strip {
  events: StripEvent[] = [];
  backgrounds: Background[] = [];

  add(e: StripEvent): StripEvent { // zdarzenia zwykle przychodzą po kolei, ale nie musimy na tym polegać
    const ev = this.events;
    let i = ev.length;
    while (i > 0 && (ev[i - 1]?.at ?? 0) > e.at) i--;
    ev.splice(i, 0, e);
    return e;
  }
  /** Usuwa zdarzenia starsze niż `before` (żeby tablica nie rosła w nieskończoność). */
  prune(before: number): void {
    let k = 0;
    while (k < this.events.length && (this.events[k]?.at ?? 0) < before) k++;
    if (k > 0) this.events.splice(0, k);
  }
  clear(): void { this.events = []; }

  private first(t: number): number {
    let lo = 0, hi = this.events.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if ((this.events[m]?.at ?? 0) < t) lo = m + 1; else hi = m; }
    return lo;
  }

  /** Napięcie w chwili t. Zdarzenie wpływa na zapis od (at − 0,05 s) do (at + 0,7 s). */
  volt(t: number, leadName: LeadName = 'II'): number {
    const lead = LEADS[leadName];
    let v = 0;
    for (let i = this.first(t - 0.75); i < this.events.length; i++) {
      const e = this.events[i]!;
      if (e.at > t + 0.06) break;
      const dt = t - e.at;
      if (e.kind === 'P') { for (const k of e.comps) v += dot(k.v, lead.u) * lead.gain * gk(k, dt); }
      else if (e.kind === 'QRS') v += volt(e.beat, lead, dt);
    }
    for (const b of this.backgrounds) v += b(t, lead);
    return v;
  }
  spikes(t0: number, t1: number): SpikeEvent[] {
    const out: SpikeEvent[] = [];
    for (let i = this.first(t0); i < this.events.length; i++) {
      const e = this.events[i]!;
      if (e.at > t1) break;
      if (e.kind === 'spike') out.push(e);
    }
    return out;
  }
  inRange(t0: number, t1: number): StripEvent[] {
    const out: StripEvent[] = [];
    for (let i = this.first(t0); i < this.events.length; i++) {
      const e = this.events[i]!;
      if (e.at > t1) break;
      out.push(e);
    }
    return out;
  }
}

/* ─────────── monitor ─────────── */

export interface MonitorMap {
  /** Pozycja x czasu t na ekranie albo null, jeśli tej chwili nie widać. */
  x(t: number): number | null;
  y(mv: number): number;
  w: number; h: number; pxPerSec: number; pxPerMv: number; now: number;
}

export interface MonitorOpts {
  /** Ile sekund mieści ekran. */
  seconds: number;
  mode?: 'sweep' | 'scroll';
  height?: number;
  /** 'paper' — kratki 1 i 5 mm, prawdziwe 10 mm/mV; 'fit' — amplituda dopasowana do wysokości. */
  scale?: 'paper' | 'fit';
  grid?: boolean;
  /** Linia bazowa jako ułamek wysokości (od góry). */
  base?: number;
  /** Ile mV mieści się od linii bazowej do góry przy skali 'fit'. */
  fitMv?: number;
  signal: (t: number) => number;
  spikes?: (t0: number, t1: number) => Array<{ at: number; amp: number; color?: string }>;
  overlay?: (ctx: CanvasRenderingContext2D, m: MonitorMap) => void;
  color?: string;
  label: string;
  /** Wołane co klatkę przed rysowaniem — tu wstawka dopisuje zdarzenia do paska. */
  tick?: (now: number, dt: number) => void;
  /** Mnożnik upływu czasu (1 = czas rzeczywisty). */
  speed?: number;
}

export interface Monitor {
  el: HTMLElement;
  now(): number;
  setSpeed(k: number): void;
  setPaused(p: boolean): void;
  paused(): boolean;
  redraw(): void;
  destroy(): void;
}

/** Kardiomonitor: rysuje sygnał przesuwem (sweep) z przerwą wymazywania albo przewijany papier. */
export function monitor(parent: HTMLElement, o: MonitorOpts): Monitor {
  const wrap = document.createElement('div');
  parent.append(wrap);
  // przy „Ogranicz ruch” nic nie rusza samo: monitor stoi, aż kursant naciśnie „Graj”
  let now = o.seconds + 0.001, speed = o.speed ?? 1, isPaused = reducedMotion();
  const mode = o.mode ?? 'sweep';

  const draw = (sf: Surface) => {
    const { ctx, w, h } = sf;
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    const pxPerSec = w / o.seconds;
    const pxPerMm = pxPerSec / 25;
    const pxPerMv = o.scale === 'paper' ? pxPerMm * 10 : (h * (o.base ?? 0.58)) / (o.fitMv ?? 1.6);
    const y0 = h * (o.base ?? 0.58);
    if (o.grid !== false) paper(ctx, 0, 0, w, h, o.scale === 'paper' ? pxPerMm : pxPerMm, { y0 });

    const sweepStart = Math.floor(now / o.seconds) * o.seconds;
    const xNow = (now - sweepStart) * pxPerSec;
    const gap = Math.max(14, w * 0.035);
    const tAtX = (x: number): number | null => {
      if (mode === 'scroll') return now - o.seconds + x / pxPerSec;
      if (x <= xNow) return sweepStart + x / pxPerSec;
      if (x > xNow + gap) return sweepStart - o.seconds + x / pxPerSec;
      return null;
    };
    const map: MonitorMap = {
      w, h, pxPerSec, pxPerMv, now,
      x: (t: number) => {
        if (mode === 'scroll') { const x = (t - (now - o.seconds)) * pxPerSec; return x >= 0 && x <= w ? x : null; }
        if (t > now || t < now - o.seconds + gap / pxPerSec) return null;
        const x = t >= sweepStart ? (t - sweepStart) * pxPerSec : (t - sweepStart + o.seconds) * pxPerSec;
        return x;
      },
      y: (mv: number) => y0 - mv * pxPerMv,
    };

    const col = o.color ?? C.puls;
    const segs: Array<[number, number]> = mode === 'scroll' ? [[0, w]] : [[0, xNow], [xNow + gap, w]];
    for (const [a, b] of segs) {
      if (b - a < 1) continue;
      const ta = tAtX(a + (a === 0 ? 0 : 0.001)), tb = tAtX(b);
      if (ta === null || tb === null) continue;
      trace(ctx, o.signal, { x: a, w: b - a, t0: ta, t1: tb, y0, pxPerMv, color: col, width: 1.7 });
    }
    // jasny „pióro” na czole przesuwu
    if (mode === 'sweep') {
      const yv = y0 - o.signal(now) * pxPerMv;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(xNow, yv, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    if (o.spikes) {
      for (const sp of o.spikes(now - o.seconds, now)) {
        const x = map.x(sp.at);
        if (x === null) continue;
        ctx.strokeStyle = sp.color ?? C.txt;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, y0 - o.signal(sp.at) * pxPerMv + 2);
        ctx.lineTo(Math.round(x) + 0.5, y0 - sp.amp * pxPerMv);
        ctx.stroke();
      }
    }
    o.overlay?.(ctx, map);
  };

  const sfc = surface(wrap, { height: o.height ?? 150, label: o.label }, (sf) => draw(sf));
  const lp = loop(wrap, (_t, dt) => {
    if (isPaused) return;
    now += dt * speed;
    o.tick?.(now, dt * speed);
    draw(sfc.s);
  });
  o.tick?.(now, 0);
  if (isPaused) {
    // stan startowy: pełny ekran zapisu zamiast pustego
    for (let k = 0; k < 60; k++) { now += o.seconds / 60; o.tick?.(now, o.seconds / 60); }
  }
  draw(sfc.s);

  return {
    el: wrap,
    now: () => now,
    setSpeed: (k) => { speed = k; },
    setPaused: (p) => { isPaused = p; },
    paused: () => isPaused,
    redraw: () => draw(sfc.s),
    destroy: () => { lp.stop(); sfc.destroy(); },
  };
}

/**
 * Harmonogram rytmu prowadzony „na bieżąco”: wstawka dostaje wywołanie, gdy trzeba dopisać
 * zdarzenia do przodu (lookahead), i sama decyduje, co przewieść, co zablokować.
 */
export function scheduler(strip: Strip, lookahead: number, plan: (until: number) => void): (now: number) => void {
  return (now: number) => {
    plan(now + lookahead);
    strip.prune(now - 12);
  };
}

/** Przycisk Pauza / Graj dla monitora (zawsze dostępny; przy „Ogranicz ruch” monitor startuje zatrzymany). */
export function playToggle(m: Monitor, onChange?: (paused: boolean) => void): HTMLButtonElement {
  const b = h('button', { class: 'hw-chip hw-chip--sm', type: 'button' });
  const paint = () => {
    b.textContent = m.paused() ? 'Graj' : 'Pauza';
    b.setAttribute('aria-label', m.paused() ? 'Wznów zapis' : 'Zatrzymaj zapis');
  };
  b.addEventListener('click', () => { m.setPaused(!m.paused()); paint(); onChange?.(m.paused()); });
  paint();
  return b;
}
