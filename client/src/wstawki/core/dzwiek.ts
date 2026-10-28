/**
 * Dźwięk wstawek: wszystko syntezowane w przeglądarce (Web Audio), bez plików audio.
 * Projekt i odsłuch: artefakt „Dźwięki wstawek helloEKG” (zatwierdzony przez JK 28.10.2026).
 *
 * Zasady:
 * - domyślnie wyciszone; jeden przełącznik na cały kurs (pamiętany w przeglądarce);
 * - kontekst audio rusza dopiero po geście kursanta (kliknięcie, klawisz), nigdy sam;
 * - każda wstawka gra przez własny tor, który milknie, gdy wstawka zniknie z ekranu albo karta będzie ukryta;
 * - dźwięk ciągły (monitor, metronom) gra tylko z jednego źródła naraz: najbardziej widocznego;
 * - każdy dźwięk ma odpowiednik na ekranie; na pomyłkę cisza (decyzja JK).
 */
const KLUCZ = 'hk:dzwiek';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let on = czytaj();
const sluchacze = new Set<(on: boolean) => void>();

function czytaj(): boolean {
  try { return localStorage.getItem(KLUCZ) === '1'; } catch { return false; }
}

/** Tworzy albo wznawia kontekst. Wołane tylko z gestu kursanta (inaczej przeglądarka i tak go nie uruchomi). */
function kontekst(): void {
  if (!ac) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 6;
    master.connect(comp).connect(ac.destination);
  }
  if (ac.state === 'suspended') void ac.resume().catch(() => {});
}

if (typeof document !== 'undefined') {
  // po przeładowaniu strony z włączonym dźwiękiem kontekst rusza przy pierwszym dotknięciu albo klawiszu
  const wznow = () => { if (on) kontekst(); };
  document.addEventListener('pointerdown', wznow, { capture: true, passive: true });
  document.addEventListener('keydown', wznow, { capture: true });
  document.addEventListener('visibilitychange', () => aktualizuj());
}

export const dzwiekWlaczony = (): boolean => on;

export function ustawDzwiek(v: boolean): void {
  on = v;
  try { localStorage.setItem(KLUCZ, v ? '1' : '0'); } catch { /* bez pamięci w trybie prywatnym */ }
  if (v) kontekst();
  aktualizuj();
  sluchacze.forEach((f) => f(v));
}

/** Kontekst gotowy do grania (włączony, uruchomiony, karta widoczna) albo null. */
function gotowy(): AudioContext | null {
  return on && ac && master && ac.state === 'running' && !document.hidden ? ac : null;
}

/* ─────────── tory wstawek ─────────── */

interface Tor { el: Element; gain: GainNode | null; ciagly: boolean; widac: number }
const tory = new Set<Tor>();

/** Czy tor może teraz grać: widać go na ekranie, a dźwięk ciągły tylko z najbardziej widocznego toru ciągłego. */
function moze(t: Tor): boolean {
  if (t.widac <= 0 || !on || document.hidden) return false;
  if (!t.ciagly) return true;
  let naj: Tor | null = null;
  for (const x of tory) if (x.ciagly && x.widac > 0 && (!naj || x.widac > naj.widac)) naj = x;
  return naj === t;
}

function aktualizuj(): void {
  if (!ac) return;
  for (const t of tory) t.gain?.gain.setTargetAtTime(moze(t) ? 1 : 0, ac.currentTime, 0.04);
}

const io = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((wpisy) => {
    for (const w of wpisy) {
      const t = [...tory].find((x) => x.el === w.target);
      if (!t) continue;
      if (!w.target.isConnected) { io?.unobserve(w.target); t.gain?.disconnect(); tory.delete(t); continue; }
      t.widac = w.isIntersecting ? Math.max(0.01, w.intersectionRatio) : 0;
    }
    aktualizuj();
  }, { threshold: [0, 0.15, 0.3, 0.5, 0.75, 1] })
  : null;

/** Wysokość tonu QRS jak w monitorach z pulsoksymetrem: niższa saturacja, niższy ton (półton na każdy punkt %). */
const tonQrs = (spo2: number | null | undefined) => 880 * 2 ** ((Math.min(spo2 ?? 99, 100) - 99) / 12);

export interface Dzwiek {
  /** Ton QRS; `spo2` obniża wysokość, null lub brak = ton bazowy. */
  qrs(spo2?: number | null, za?: number): void;
  /** Alarm wg IEC 60601-1-8: wysoki = 3 + 2 tony dwa razy, średni = 3 tony. Zwraca czas trwania w s. */
  alarm(priorytet: 'wysoki' | 'sredni', za?: number): number;
  /** Krótki tyk (kratka cyrkla, kompas, takt dyrygenta); mocny = wyraźniejszy. */
  tik(mocny?: boolean, za?: number): void;
  /** Stuk pobudzenia komór. */
  stuk(za?: number): void;
  /** Iglica stymulatora: „dzwoneczek” (wybór JK). */
  iglica(za?: number): void;
  /** Ładowanie kondensatora ICD (narastający ton) i wstrząs. */
  ladowanie(s?: number, za?: number): void;
  wstrzas(za?: number): void;
  /** Zatrzask elektrody na właściwym miejscu. */
  zatrzask(za?: number): void;
  /** Werdykt „Dobrze”: dwa krótkie tony w górę. */
  dobrze(): void;
  /** Czy ten tor może teraz grać (np. żeby nie liczyć dźwięków na zapas). */
  aktywny(): boolean;
}

/**
 * Tor dźwięku dla elementu wstawki. `ciagly` dla źródeł, które grają same (monitor, metronom):
 * z kilku widocznych naraz gra tylko najbardziej widoczne.
 */
export function tor(el: Element, o: { ciagly?: boolean } = {}): Dzwiek {
  const t: Tor = { el, gain: null, ciagly: !!o.ciagly, widac: 0 };
  tory.add(t);
  io?.observe(el);

  const wyjscie = (c: AudioContext): GainNode => {
    if (!t.gain) { t.gain = c.createGain(); t.gain.gain.value = moze(t) ? 1 : 0; t.gain.connect(master!); }
    return t.gain;
  };
  const graj = (): AudioContext | null => { const c = gotowy(); return c && moze(t) ? c : null; };

  function ton(c: AudioContext, { f, d, g, typ = 'sine', za = 0, f2, harm = false, zanik = false }: {
    f: number; d: number; g: number; typ?: OscillatorType; za?: number; f2?: number; harm?: boolean; zanik?: boolean;
  }): void {
    const t0 = c.currentTime + 0.005 + za;
    const out = c.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(g, t0 + 0.004);
    if (!zanik) out.gain.setValueAtTime(g, t0 + Math.max(0.005, d - 0.02));
    out.gain.exponentialRampToValueAtTime(0.0008, t0 + d);
    out.connect(wyjscie(c));
    for (const k of harm ? [1, 2, 3, 4, 5] : [1]) {
      const osc = c.createOscillator(); osc.type = typ;
      osc.frequency.setValueAtTime(f * k, t0);
      if (f2) osc.frequency.exponentialRampToValueAtTime(f2 * k, t0 + d);
      const pg = c.createGain(); pg.gain.value = 1 / (k * k * (harm ? 1.4 : 1));
      osc.connect(pg).connect(out); osc.start(t0); osc.stop(t0 + d + 0.02);
    }
  }
  function szum(c: AudioContext, { d, g, f, q = 1.2, za = 0, typ = 'bandpass' }: { d: number; g: number; f: number; q?: number; za?: number; typ?: BiquadFilterType }): void {
    const t0 = c.currentTime + 0.005 + za;
    const len = Math.max(1, Math.floor(c.sampleRate * d));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = c.createBufferSource(); src.buffer = buf;
    const fl = c.createBiquadFilter(); fl.type = typ; fl.frequency.value = f; fl.Q.value = q;
    const gn = c.createGain(); gn.gain.value = g;
    src.connect(fl).connect(gn).connect(wyjscie(c)); src.start(t0);
  }

  return {
    qrs(spo2, za = 0) { const c = graj(); if (c) ton(c, { f: tonQrs(spo2), d: 0.07, g: 0.22, typ: 'triangle', za }); },
    alarm(p, za = 0) {
      const c = graj(); if (!c) return 0;
      if (p === 'wysoki') {
        const offs = [0, 0.16, 0.32, 0.64, 0.8];
        for (const s of [0, 1.4]) for (const x of offs) ton(c, { f: 660, d: 0.11, g: 0.26, harm: true, za: za + s + x });
        return 2.3;
      }
      for (const x of [0, 0.22, 0.44]) ton(c, { f: 520, d: 0.11, g: 0.26, harm: true, za: za + x });
      return 0.6;
    },
    tik(mocny = false, za = 0) { const c = graj(); if (c) szum(c, { d: mocny ? 0.016 : 0.008, g: mocny ? 0.5 : 0.28, f: mocny ? 2400 : 3600, za }); },
    stuk(za = 0) { const c = graj(); if (c) { szum(c, { d: 0.05, g: 0.5, f: 520, q: 3, za }); ton(c, { f: 140, d: 0.08, g: 0.25, za }); } },
    iglica(za = 0) { const c = graj(); if (c) ton(c, { f: 2637, d: 0.12, g: 0.13, zanik: true, za }); },
    ladowanie(s = 2, za = 0) { const c = graj(); if (c) ton(c, { f: 420, f2: 2600, d: s, g: 0.06, za }); },
    wstrzas(za = 0) { const c = graj(); if (c) { szum(c, { d: 0.18, g: 0.9, f: 180, q: 0.7, typ: 'lowpass', za }); ton(c, { f: 55, d: 0.25, g: 0.5, za }); } },
    zatrzask(za = 0) { const c = graj(); if (c) { szum(c, { d: 0.016, g: 0.5, f: 2400, za }); szum(c, { d: 0.008, g: 0.28, f: 3600, za: za + 0.045 }); } },
    dobrze() { const c = graj(); if (c) { ton(c, { f: 659, d: 0.09, g: 0.18 }); ton(c, { f: 988, d: 0.14, g: 0.18, za: 0.09 }); } },
    aktywny: () => !!graj(),
  };
}

/* ─────────── przełącznik ─────────── */

const GLOSNIK = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" style="flex:none"><path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor"/>'
  + '<path class="hw-snd-fale" d="M13 7.2a4 4 0 0 1 0 5.6M15.2 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
  + '<path class="hw-snd-x" d="M13.5 8l4 4m0-4l-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

/**
 * Przełącznik dźwięku (wspólny stan dla wszystkich wstawek na stronie i w kursie).
 * Nazwa stała („Dźwięk”), stan przez aria-pressed; ikona głośnika z falami albo przekreślona.
 */
export function przyciskDzwieku(o: { maly?: boolean } = {}): HTMLButtonElement {
  // bez importu z ui.ts (ui.ts importuje ten plik)
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hw-chip hw-snd' + (o.maly ? ' hw-snd--maly' : '');
  b.innerHTML = `${GLOSNIK}<span>Dźwięk</span>`;
  const maluj = (v: boolean) => {
    b.setAttribute('aria-pressed', v ? 'true' : 'false');
    b.title = v ? 'Wycisz dźwięk wstawek' : 'Włącz dźwięk wstawek';
  };
  maluj(on);
  b.addEventListener('click', () => {
    ustawDzwiek(!on);
    // potwierdzenie włączenia tym samym dźwiękiem co „Dobrze”; przy wyłączaniu cisza
    if (on) potwierdz(b);
  });
  // słuchacz odpina się sam, gdy przycisk zniknie ze strony (wstawka odmontowana)
  const f = (v: boolean) => {
    if (b.isConnected) { b.dataset.hwSnd = '1'; maluj(v); } else if (b.dataset.hwSnd) sluchacze.delete(f); else maluj(v);
  };
  sluchacze.add(f);
  return b;
}

/** „Dobrze” zaraz po włączeniu: kontekst dopiero rusza, więc chwila na start. */
function potwierdz(el: Element): void {
  const d = dzwiekDla(el);
  setTimeout(() => d.dobrze(), 120);
}

/* ─────────── tor korzenia wstawki ─────────── */

const toryKorzeni = new WeakMap<Element, Dzwiek>();

/** Tor dla wstawki, w której leży `el` (korzeń `.hw`), np. dla wspólnego werdyktu ćwiczeń. */
export function dzwiekDla(el: Element): Dzwiek {
  const root = el.closest('.hw') ?? el;
  let d = toryKorzeni.get(root);
  if (!d) { d = tor(root); toryKorzeni.set(root, d); }
  return d;
}
