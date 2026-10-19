/**
 * Silnik żywych zapisów EKG — przeniesiony z helloekg.pl/blog/ekg-engine.js.
 * Morfologia (kształt QRS, HRV, kolory, warstwy) jest kanonem marki i nie wolno jej zmieniać.
 * Kopia 1:1 z helloEKG Studio (web/src/ekg/ekgEngine.ts) — przy zmianach synchronizować oba.
 * Różnica wobec oryginału: zamiast skanowania DOM eksportujemy `mount(canvas, rhythm) → cleanup`,
 * dokładamy zatrzymanie animacji poza ekranem i sprzątanie nasłuchów.
 */

export type Rhythm = 'sinus' | 'af' | 'avb1' | 'wenckebach' | 'avb3' | 'aflutter' | 'brady' | 'tachy';

export interface EkgOptions {
  hr?: number;
  pr?: number;
  atrialRate?: number;
  flutterRate?: number;
  ratio?: number;
  /** Wysokość w pikselach CSS. */
  height?: number;
  /** Ile sekund zapisu mieści się w kadrze. */
  seconds?: number;
  /** Długość jasnego „impulsu" na czole fali, w sekundach. */
  pulse?: number;
}

const gauss = (t: number, c: number, w: number, a: number): number => {
  const d = (t - c) / w;
  return a * Math.exp(-0.5 * d * d);
};

const srand = (i: number): number => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

interface Schedule { times: number[]; amps: number[]; extend(upTo: number): void }

function makeSchedule(nextRR: (t: number, i: number) => number): Schedule {
  const times = [0];
  const amps = [1];
  return {
    times, amps,
    extend(upTo: number) {
      while ((times[times.length - 1] ?? 0) < upTo) {
        const i = times.length;
        times.push((times[i - 1] ?? 0) + nextRR(times[i - 1] ?? 0, i));
        amps.push(1 + (srand(i * 31 + 7) - 0.5) * 0.16);
      }
    },
  };
}

/** QRS o kanonicznej morfologii marki. */
function qrsT(dt: number, rr: number, amp: number, tAmp?: number): number {
  let v = 0;
  v += gauss(dt, -0.020, 0.009, -0.10 * amp);
  v += gauss(dt, 0.000, 0.011, 1.00 * amp);
  v += gauss(dt, 0.022, 0.011, -0.24 * amp);
  v += gauss(dt, 0.30 * Math.sqrt(rr / 0.83), 0.065, tAmp == null ? 0.28 : tAmp);
  return v;
}

/** Zmienność rytmu zatokowego: LF/HF + arytmia oddechowa. */
function hrv(t: number): number {
  const lf = Math.sin(2 * Math.PI * 0.05 * t) * 0.5 + Math.sin(2 * Math.PI * 0.08 * t + 1.2) * 0.3 + Math.sin(2 * Math.PI * 0.12 * t + 2.5) * 0.2;
  const hf = Math.sin(2 * Math.PI * 0.20 * t) * 0.4 + Math.sin(2 * Math.PI * 0.28 * t + 0.8) * 0.35 + Math.sin(2 * Math.PI * 0.35 * t + 1.6) * 0.25;
  const rsa = -Math.sin(2 * Math.PI * 0.25 * t) * 0.10;
  return (lf * 0.3 + hf * 0.7) * 0.025 + rsa;
}

type Signal = (t: number) => number;
type Maker = (o: EkgOptions) => Signal;

const RHYTHMS: Record<Rhythm, Maker> = {
  sinus: (opts) => {
    const RR = 60 / (opts.hr || 72);
    const PR = opts.pr || 0.16;
    const sched = makeSchedule((t) => RR * (1 + hrv(t)));
    return (t0) => {
      const t = t0 < 0 ? 0 : t0;
      sched.extend(t + 3);
      const ts = sched.times;
      let i = ts.length - 1;
      while (i > 0 && (ts[i] ?? 0) > t + 1.2) i--;
      let v = 0;
      for (let k = Math.max(0, i - 2); k <= Math.min(ts.length - 1, i + 2); k++) {
        const dt = t - (ts[k] ?? 0);
        const rr = k + 1 < ts.length ? (ts[k + 1] ?? 0) - (ts[k] ?? 0) : RR;
        v += gauss(dt, -PR, 0.045, 0.15) + qrsT(dt, rr, sched.amps[k] ?? 1);
      }
      return v * 0.78;
    };
  },
  brady: (o) => RHYTHMS.sinus({ hr: o.hr || 42, ...(o.pr !== undefined ? { pr: o.pr } : {}) }),
  tachy: (o) => RHYTHMS.sinus({ hr: o.hr || 150, ...(o.pr !== undefined ? { pr: o.pr } : {}) }),

  /** Migotanie przedsionków: fala f + RR o dużej zmienności, bez załamka P. */
  af: (opts) => {
    const RR = 60 / (opts.hr || 80);
    const FIB: Array<[number, number, number]> = [[4.5, 0.05, 0], [5.2, 0.04, 1.2], [6.1, 0.03, 2.4], [7.0, 0.025, 0.8], [8.3, 0.02, 1.6]];
    const sched = makeSchedule((_t, i) => {
      const u1 = Math.max(0.0001, srand(i * 7919 + 13));
      const u2 = srand(i * 6547 + 29);
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return Math.max(RR * 0.5, Math.min(RR * 1.8, RR * (1 + z * 0.22)));
    });
    return (t0) => {
      const t = t0 < 0 ? 0 : t0;
      sched.extend(t + 3);
      let v = 0;
      for (const [f, a, p] of FIB) v += Math.sin(2 * Math.PI * f * t + p) * a;
      const ts = sched.times;
      let i = ts.length - 1;
      while (i > 0 && (ts[i] ?? 0) > t + 1.0) i--;
      for (let k = Math.max(0, i - 2); k <= Math.min(ts.length - 1, i + 2); k++) {
        const rr = k + 1 < ts.length ? (ts[k + 1] ?? 0) - (ts[k] ?? 0) : RR;
        v += qrsT(t - (ts[k] ?? 0), rr, 0.92 * (sched.amps[k] ?? 1), 0.22);
      }
      return v * 0.78;
    };
  },

  /** Blok AV I stopnia: wydłużony PR, poza tym rytm zatokowy. */
  avb1: (o) => RHYTHMS.sinus({ hr: o.hr || 70, pr: 0.28 }),

  /** Wenckebach 4:3 — PR rośnie, czwarty załamek P zostaje bez QRS. */
  wenckebach: (opts) => {
    const PP = 60 / (opts.hr || 75);
    const PRs: Array<number | null> = [0.16, 0.19, 0.21, null];
    return (t0) => {
      const t = t0 < 0 ? 0 : t0;
      let v = 0;
      const n0 = Math.floor((t - 1.5) / PP);
      const n1 = Math.ceil((t + 1.5) / PP);
      for (let n = Math.max(0, n0); n <= n1; n++) {
        const tp = n * PP;
        const pr = PRs[n % 4];
        v += gauss(t - tp, 0, 0.045, 0.15);
        if (pr !== null && pr !== undefined) v += qrsT(t - (tp + pr), PP, 1);
      }
      return v * 0.78;
    };
  },

  /** Blok AV III stopnia: przedsionki i komory idą niezależnie. */
  avb3: (opts) => {
    const PP = 60 / (opts.atrialRate || 80);
    const VV = 60 / (opts.hr || 38);
    return (t0) => {
      const t = t0 < 0 ? 0 : t0;
      let v = 0;
      for (let n = Math.max(0, Math.floor((t - 1) / PP)); n <= Math.ceil((t + 1) / PP); n++) v += gauss(t - n * PP, 0, 0.045, 0.15);
      for (let n = Math.max(0, Math.floor((t - 1.8) / VV)); n <= Math.ceil((t + 1.8) / VV); n++) v += qrsT(t - n * VV - 0.3, VV, 0.9);
      return v * 0.78;
    };
  },

  /** Trzepotanie przedsionków: zęby piły 300/min, przewodzenie 2:1. */
  aflutter: (opts) => {
    const FR = 60 / (opts.flutterRate || 300);
    const ratio = opts.ratio || 2;
    return (t0) => {
      const t = t0 < 0 ? 0 : t0;
      let v = 0;
      for (let n = Math.max(0, Math.floor((t - 1) / FR)); n <= Math.ceil((t + 1) / FR); n++) {
        const dt = t - n * FR;
        if (dt >= 0 && dt < FR) {
          v += dt < FR * 0.7 ? -0.09 * (dt / (FR * 0.7)) : -0.09 + 0.09 * ((dt - FR * 0.7) / (FR * 0.3));
        }
        if (n % ratio === 0) v += qrsT(t - (n * FR + 0.08), FR * ratio, 0.95, 0.2);
      }
      return v * 0.78;
    };
  },
};

export const TRACE_COLOR = '#1E4536';
export const PULSE_COLOR = '#3EE6A8';

/** Podpina animację do canvasu. Zwraca funkcję sprzątającą. */
export function mount(canvas: HTMLCanvasElement, rhythm: Rhythm, opts: EkgOptions = {}): () => void {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const fn = (RHYTHMS[rhythm] ?? RHYTHMS.sinus)(opts);
  const height = opts.height ?? 90;
  const seconds = opts.seconds ?? 7.0;
  const pulseS = opts.pulse ?? 1.6;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const SUB = 4;
  const centerY = height * 0.56;
  const amp = height * 0.30;
  let width = 0;
  let raf = 0;
  let visible = true;
  let t0 = performance.now();

  /** Nadpróbkowanie ×4 na kolumnę piksela — bez tego szczyt R gubi się między pikselami. */
  const yAt = (x: number, el: number): number => {
    let ex = 0;
    for (let s = 0; s < SUB; s++) {
      const xs = x + s / SUB;
      const v = fn(el - ((width - xs) / width) * seconds);
      if (Math.abs(v) > Math.abs(ex)) ex = v;
    }
    return centerY - ex * amp;
  };

  const draw = (rawTime: number): void => {
    if (width === 0) return;
    const pps = width / seconds;
    // przesuw skokami o pełny piksel — inaczej fala „pływa"
    const el = Math.round(rawTime * pps) / pps;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = TRACE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x++) {
      const y = yAt(x, el);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = PULSE_COLOR;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const hf = Math.max(0, width - Math.round(pps * pulseS));
    for (let x = hf; x <= width; x++) {
      const y = yAt(x, el);
      if (x === hf) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  const resize = (): void => {
    const parent = canvas.parentElement;
    width = parent?.clientWidth || 800;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduced || !visible) draw(seconds + 10);
  };

  const loop = (now: number): void => {
    draw((now - t0) / 1000 + seconds);
    raf = requestAnimationFrame(loop);
  };

  const start = (): void => {
    if (reduced || raf) return;
    t0 = performance.now() - seconds * 1000;
    raf = requestAnimationFrame(loop);
  };
  const stop = (): void => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  };

  resize();
  window.addEventListener('resize', resize);

  // poza ekranem animacja jest marnowaniem baterii
  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) start(); else stop();
  }, { threshold: 0 });
  io.observe(canvas);

  if (reduced) draw(seconds + 10); else start();

  return () => {
    stop();
    io.disconnect();
    window.removeEventListener('resize', resize);
  };
}
