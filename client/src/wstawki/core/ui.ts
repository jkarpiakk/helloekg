/**
 * Fundament wstawek interaktywnych: styl, drobne elementy interfejsu, pętla animacji, gesty.
 *
 * Wstawki są pisane bez Reacta (czysty DOM + canvas/SVG), żeby ten sam kod dało się
 * skopiować do aplikacji kursu tak, jak dziś kopiuje się silnik EKG. Każda wstawka to
 * `mount(host, opts) → sprzątanie`. Wygląd jest zawsze ciemny („ekran urządzenia”),
 * więc wstawka wygląda tak samo w studiu i w kursie, niezależnie od motywu strony.
 */

import { dzwiekDla, przyciskDzwieku } from './dzwiek.js';

/* ─────────── styl ─────────── */

const CSS = `
.hw{--hw-ink:#0B0F14;--hw-panel:#0E141A;--hw-panel2:#121A21;--hw-line:#1A222B;--hw-line2:#223040;
--hw-txt:#F2F6F4;--hw-txt2:#A3AFB7;--hw-txt3:#6B7880;--hw-label:#7E8B94;--hw-puls:#3EE6A8;--hw-puls-deep:#0B7E54;
--hw-puls-dark:#1E4536;--hw-alarm:#E24B4A;--hw-warn:#E8B04A;--hw-blue:#6CB4FF;--hw-tint:rgba(62,230,168,.07);
--hw-on-puls:#07130E;--hw-f-d:"Space Grotesk",ui-sans-serif,system-ui,sans-serif;
--hw-f-t:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--hw-f-m:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
--hw-ease:cubic-bezier(.2,.7,.2,1);
container-type:inline-size;container-name:hw;position:relative;color:var(--hw-txt);background:var(--hw-ink);
border:1px solid var(--hw-line);border-radius:18px;padding:clamp(14px,3cqi,26px);font:15px/1.6 var(--hw-f-t);
-webkit-font-smoothing:antialiased;text-align:left;color-scheme:dark;margin:28px 0;isolation:isolate}
.hw *{box-sizing:border-box}
.hw [hidden]{display:none!important}
.hw .hw-raster,.hw image.hw-raster{mix-blend-mode:lighten}
.hw :where(h3,h4,p){margin:0}
.hw :focus-visible{outline:2px solid var(--hw-puls);outline-offset:3px;border-radius:6px}
.hw-stack{display:grid;gap:16px}
.hw-head{display:grid;gap:6px;max-width:46em}
.hw-top{display:flex;gap:10px 16px;justify-content:space-between;align-items:flex-start}
.hw-top>.hw-head{flex:1;min-width:0}
.hw-snd{display:inline-flex;align-items:center;gap:7px;flex:none;padding:0 14px}
.hw-snd .hw-snd-x{display:none}
.hw-snd[aria-pressed="false"] .hw-snd-fale{display:none}
.hw-snd[aria-pressed="false"] .hw-snd-x{display:inline}
.hw-chip.hw-snd--maly{position:relative;min-height:32px;padding:0 10px;font:500 12px/1 var(--hw-f-m);letter-spacing:.06em;text-transform:uppercase}
.hw-chip.hw-snd--maly::after{content:"";position:absolute;inset:-6px -2px}
.hw-label{font:500 12px/1.4 var(--hw-f-m);letter-spacing:.09em;text-transform:uppercase;color:var(--hw-label)}
.hw-label--g{color:var(--hw-puls)}
.hw-title{font:500 clamp(19px,3.4cqi,24px)/1.18 var(--hw-f-d);letter-spacing:-.015em;text-wrap:balance}
.hw-intro{color:var(--hw-txt2);font-size:14.5px;line-height:1.6;max-width:46em}
.hw-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between}
.hw-chips{display:flex;flex-wrap:wrap;gap:6px}
.hw-chip{appearance:none;font:500 13.5px/1 var(--hw-f-t);color:var(--hw-txt2);background:transparent;border:1px solid var(--hw-line2);
border-radius:999px;min-height:44px;padding:0 15px;cursor:pointer;transition:transform .12s var(--hw-ease),border-color .2s,color .2s,background .2s;white-space:nowrap}
.hw-chip:hover{color:var(--hw-txt);border-color:var(--hw-txt3)}
.hw-chip:active{transform:scale(.97)}
.hw-chip[aria-pressed="true"]{color:var(--hw-on-puls);background:var(--hw-puls);border-color:var(--hw-puls)}
.hw-chip[disabled]{opacity:.35;cursor:default}
.hw-chip--sm{min-height:40px;padding:6px 12px;font-size:12.5px;white-space:normal;text-align:left;line-height:1.25}
.hw-btn{appearance:none;font:500 14.5px/1 var(--hw-f-t);border-radius:999px;min-height:44px;padding:0 20px;cursor:pointer;
border:1px solid var(--hw-puls);background:var(--hw-puls);color:var(--hw-on-puls);transition:transform .12s var(--hw-ease),opacity .2s}
.hw-btn:active{transform:scale(.97)}
.hw-btn--ghost{background:transparent;color:var(--hw-txt);border-color:var(--hw-line2)}
.hw-btn--alarm{background:var(--hw-alarm);border-color:var(--hw-alarm);color:#fff}
.hw-btn[disabled]{opacity:.4;cursor:default}
.hw-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.hw-panel{background:var(--hw-panel);border:1px solid var(--hw-line);border-radius:12px;padding:12px}
.hw-screen{background:#070A0D;border:1px solid var(--hw-line);border-radius:12px;overflow:hidden;position:relative}
.hw-screen canvas,.hw-panel canvas{display:block;width:100%}
.hw-mbar{display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--hw-line);
font:500 12px/1.3 var(--hw-f-m);letter-spacing:.07em;text-transform:uppercase;color:var(--hw-label)}
.hw-mbar b{color:var(--hw-puls);font-weight:500}
.hw-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--hw-puls);margin-right:7px;vertical-align:1px}
.hw-2col{display:grid;gap:18px;grid-template-columns:minmax(0,1fr)}
@container hw (min-width:720px){.hw-2col{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.hw-2col--wide-l{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr)}.hw-2col--wide-r{grid-template-columns:minmax(0,.9fr) minmax(0,1.2fr)}}
.hw-read{display:grid;gap:10px;padding-top:14px;border-top:1px solid var(--hw-line)}
.hw-big{font:500 clamp(30px,6cqi,42px)/1 var(--hw-f-d);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.hw-cat{font:500 17px/1.25 var(--hw-f-d)}
.hw-ok{color:var(--hw-puls)!important}.hw-bad{color:var(--hw-alarm)!important}.hw-warn{color:var(--hw-warn)!important}
.hw-why{color:var(--hw-txt2);font-size:14.5px;line-height:1.62;max-width:46em}
.hw-why b{color:var(--hw-txt);font-weight:500}
.hw-tags{display:flex;flex-wrap:wrap;gap:6px}
.hw-tag{font:500 12px/1 var(--hw-f-m);border:1px solid var(--hw-line2);border-radius:8px;padding:7px 9px;color:var(--hw-txt2);font-variant-numeric:tabular-nums}
.hw-tag b{font-weight:500;color:var(--hw-txt)}
.hw-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font:12px/1.4 var(--hw-f-m);color:var(--hw-txt3)}
.hw-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.hw-verdict{font:500 17px/1.3 var(--hw-f-d)}
.hw-field{display:grid;gap:6px}
.hw-field label,.hw-field .hw-flabel{display:flex;justify-content:space-between;gap:10px;font:500 12px/1.3 var(--hw-f-m);letter-spacing:.06em;text-transform:uppercase;color:var(--hw-label)}
.hw-field output{color:var(--hw-txt);font-variant-numeric:tabular-nums;text-transform:none;letter-spacing:0}
.hw input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;background:transparent;cursor:pointer;margin:0}
.hw input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:4px;background:linear-gradient(90deg,var(--hw-puls) var(--hw-fill,50%),var(--hw-line2) var(--hw-fill,50%))}
.hw input[type=range]::-moz-range-track{height:4px;border-radius:4px;background:var(--hw-line2)}
.hw input[type=range]::-moz-range-progress{height:4px;border-radius:4px;background:var(--hw-puls)}
.hw input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--hw-txt);border:0;margin-top:-9px;box-shadow:0 0 0 4px rgba(62,230,168,.18)}
.hw input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--hw-txt);border:0;box-shadow:0 0 0 4px rgba(62,230,168,.18)}
.hw-grid{display:grid;gap:10px}
.hw-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.hw-svg{display:block;width:100%;height:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.hw-svg text{font-family:var(--hw-f-m)}
.hw-note{font:12px/1.5 var(--hw-f-m);color:var(--hw-txt3)}
.hw-pearl{border-left:2px solid var(--hw-puls);padding:2px 0 2px 12px;color:var(--hw-txt2);font-size:14px}
.hw-pearl .hw-label{display:block;margin-bottom:2px}
.hw-list{margin:0;padding:0;list-style:none;display:grid;gap:0;border-top:1px solid var(--hw-line)}
.hw-list li{padding:9px 0;border-bottom:1px solid var(--hw-line);display:flex;justify-content:space-between;gap:12px;font-size:14px;color:var(--hw-txt2)}
.hw-list li b{color:var(--hw-txt);font-weight:500;font-variant-numeric:tabular-nums}
.hw-score{font:500 12px/1 var(--hw-f-m);color:var(--hw-txt3);letter-spacing:.06em}
.hw-opt{appearance:none;display:flex;gap:10px;align-items:baseline;width:100%;text-align:left;font:15px/1.45 var(--hw-f-t);color:var(--hw-txt);background:var(--hw-panel);
border:1px solid var(--hw-line2);border-radius:12px;padding:12px 14px;cursor:pointer;transition:transform .12s var(--hw-ease),border-color .2s,background .2s}
.hw-opt:active{transform:scale(.985)}
.hw-opt:hover{border-color:var(--hw-txt3)}
.hw-opt[aria-pressed="true"]{border-color:var(--hw-puls)}
.hw-opt.is-right{border-color:var(--hw-puls);background:var(--hw-tint)}
.hw-opt.is-wrong{border-color:var(--hw-alarm)}
.hw-opt.is-dim{opacity:.5}
.hw-opt[disabled]{cursor:default}
.hw-opt .hw-mark{font:500 12px/1.6 var(--hw-f-m);color:var(--hw-txt2);white-space:nowrap}
.hw-opt.is-right .hw-mark{color:var(--hw-puls)}.hw-opt.is-wrong .hw-mark{color:var(--hw-alarm)}
.hw-opt .hw-k{font:500 12px/1.6 var(--hw-f-m);color:var(--hw-txt3);min-width:1.2em}
@media (prefers-reduced-motion:reduce){.hw *{transition:none!important}}
`;

let styled = false;
export function ensureStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.setAttribute('data-hw', '');
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Paleta dla canvasu i SVG (te same wartości co w CSS). */
export const C = {
  ink: '#0B0F14', screen: '#070A0D', panel: '#0E141A', line: '#1A222B', line2: '#223040',
  txt: '#F2F6F4', txt2: '#A3AFB7', txt3: '#6B7880', label: '#7E8B94',
  puls: '#3EE6A8', pulsDeep: '#0B7E54', pulsDark: '#1E4536', alarm: '#E24B4A', warn: '#E8B04A', blue: '#6CB4FF',
  gridMinor: 'rgba(62,230,168,.06)', gridMajor: 'rgba(62,230,168,.15)',
  fontMono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
  fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  fontText: 'Inter, ui-sans-serif, system-ui, sans-serif',
} as const;

/* ─────────── DOM ─────────── */

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'text') e.textContent = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

const NS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') e.textContent = String(v);
    else e.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(e);
  return e;
}
export function setA(e: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) e.removeAttribute(k);
    else e.setAttribute(k, String(v));
  }
}

/** Korzeń wstawki z nagłówkiem. Zwraca korzeń i kontener na treść. */
export function shell(host: HTMLElement, o: { label: string; title: string; intro?: string }): { root: HTMLElement; body: HTMLElement; live: (msg: string) => void } {
  ensureStyle();
  const live = h('p', { class: 'hw-sr', 'aria-live': 'polite' });
  const body = h('div', { class: 'hw-stack' });
  const root = h('section', { class: 'hw', 'aria-label': o.title },
    h('div', { class: 'hw-stack' },
      h('div', { class: 'hw-top' },
        h('header', { class: 'hw-head' },
          h('p', { class: 'hw-label hw-label--g', text: o.label }),
          h('h3', { class: 'hw-title', text: o.title }),
          o.intro ? h('p', { class: 'hw-intro', text: o.intro }) : null,
        ),
        przyciskDzwieku(),
      ),
      body,
    ),
    live,
  );
  host.replaceChildren(root);
  let t: ReturnType<typeof setTimeout> | undefined;
  return {
    root, body,
    live: (msg: string) => { clearTimeout(t); t = setTimeout(() => { live.textContent = msg; }, 350); },
  };
}

export interface ChipGroup<T extends string> {
  el: HTMLElement;
  value: T;
  set(v: T, emit?: boolean): void;
  disable(on: boolean): void;
}

/** Grupa przełączników (jeden wybrany). */
export function chips<T extends string>(
  items: ReadonlyArray<{ v: T; label: string; title?: string }>,
  value: T,
  onChange: (v: T) => void,
  o: { label: string; small?: boolean } = { label: 'Wybór' },
): ChipGroup<T> {
  const el = h('div', { class: 'hw-chips', role: 'group', 'aria-label': o.label });
  const btns = items.map((it) => {
    const b = h('button', { class: 'hw-chip' + (o.small ? ' hw-chip--sm' : ''), type: 'button', 'aria-pressed': it.v === value ? 'true' : 'false', title: it.title, text: it.label });
    b.addEventListener('click', () => { g.set(it.v, true); });
    el.append(b);
    return b;
  });
  const g: ChipGroup<T> = {
    el, value,
    set(v, emit = false) {
      g.value = v;
      btns.forEach((b, i) => b.setAttribute('aria-pressed', items[i]?.v === v ? 'true' : 'false'));
      if (emit) onChange(v);
    },
    disable(on) { btns.forEach((b) => { b.disabled = on; }); },
  };
  return g;
}

export function button(label: string, onClick: () => void, variant: '' | 'ghost' | 'alarm' = ''): HTMLButtonElement {
  const b = h('button', { class: 'hw-btn' + (variant ? ` hw-btn--${variant}` : ''), type: 'button', text: label });
  b.addEventListener('click', onClick);
  return b;
}

export interface Slider { el: HTMLElement; input: HTMLInputElement; value: number; set(v: number, emit?: boolean): void }

/** Suwak z etykietą i wartością. `fmt` formatuje wartość do wyświetlenia. */
export function slider(o: {
  label: string; min: number; max: number; step: number; value: number;
  fmt?: (v: number) => string; onInput: (v: number) => void; id?: string;
}): Slider {
  const id = o.id ?? `hw-${Math.random().toString(36).slice(2, 9)}`;
  const out = h('output', { for: id });
  const input = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step, value: o.value });
  const fmt = o.fmt ?? ((v: number) => String(v));
  const paint = (v: number) => {
    out.textContent = fmt(v);
    input.style.setProperty('--hw-fill', `${((v - o.min) / (o.max - o.min)) * 100}%`);
    input.setAttribute('aria-valuetext', fmt(v));
  };
  const el = h('div', { class: 'hw-field' }, h('label', { for: id }, h('span', { text: o.label }), out), input);
  const sl: Slider = {
    el, input, value: o.value,
    set(v, emit = false) { sl.value = v; input.value = String(v); paint(v); if (emit) o.onInput(v); },
  };
  input.addEventListener('input', () => { sl.value = Number(input.value); paint(sl.value); o.onInput(sl.value); });
  paint(o.value);
  return sl;
}

/* ─────────── ruch ─────────── */

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

/**
 * Pętla animacji, która sama staje, gdy wstawka zniknie z ekranu albo karta przestanie być widoczna.
 * `frame` dostaje czas w sekundach od startu (ciągły, bez skoków po pauzie) i krok dt.
 */
export function loop(target: Element, frame: (t: number, dt: number) => void): { stop(): void; running(): boolean } {
  let raf = 0, last = 0, clock = 0, onScreen = true, dead = false;
  const tick = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now; clock += dt;
    frame(clock, dt);
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && !dead && onScreen && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  const pause = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  const io = new IntersectionObserver((e) => { onScreen = e[0]?.isIntersecting ?? true; if (onScreen) start(); else pause(); });
  io.observe(target);
  const vis = () => { if (document.hidden) pause(); else start(); };
  document.addEventListener('visibilitychange', vis);
  start();
  return {
    stop() { dead = true; pause(); io.disconnect(); document.removeEventListener('visibilitychange', vis); },
    running: () => raf !== 0,
  };
}

/** Płynne przejście wartości (bez odbicia). Przy „Ogranicz ruch” skok od razu. */
export function tween(from: number, to: number, ms: number, step: (v: number) => void, done?: () => void): () => void {
  if (reducedMotion() || ms <= 0) { step(to); done?.(); return () => {}; }
  let raf = 0; const t0 = performance.now();
  const f = (now: number) => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    step(from + (to - from) * e);
    if (k < 1) raf = requestAnimationFrame(f); else done?.();
  };
  raf = requestAnimationFrame(f);
  return () => cancelAnimationFrame(raf);
}

/** Nazwy trybów wspólne dla wszystkich wstawek (decyzja JK, 20.10.2026). */
export const TRYB_UCZ = 'Ucz się';
export const TRYB_SPRAWDZ = 'Sprawdź się';

/**
 * Sprężyna krytycznie tłumiona (bez odbicia) w stylu Apple: parametry „response” (s) i „damping” (1 = bez odbicia).
 * Przerywalna: `retarget` zmienia cel w locie i zachowuje bieżącą prędkość, więc ruch nie ma szwu.
 * Przy „Ogranicz ruch” wartość skacze od razu do celu.
 */
export interface Spring { retarget(to: number, velocity?: number): void; stop(): void; value(): number; velocity(): number }
export function spring(from: number, to: number, step: (v: number) => void, o: { response?: number; damping?: number; velocity?: number; done?: () => void } = {}): Spring {
  let x = from, v = o.velocity ?? 0, target = to, raf = 0, last = 0;
  const response = o.response ?? 0.35, zeta = o.damping ?? 1;
  const k = (2 * Math.PI / response) ** 2, c = 4 * Math.PI * zeta / response;
  const tick = (now: number) => {
    const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
    last = now;
    // kilka kroków półjawnego Eulera na klatkę: stabilne także przy sztywnych sprężynach
    for (let i = 0; i < 4; i++) { const a = -k * (x - target) - c * v; v += a * dt / 4; x += v * dt / 4; }
    if (Math.abs(x - target) < 1e-3 && Math.abs(v) < 1e-2) { x = target; v = 0; step(x); raf = 0; o.done?.(); return; }
    step(x);
    raf = requestAnimationFrame(tick);
  };
  const run = () => { if (reducedMotion()) { x = target; v = 0; step(x); o.done?.(); return; } if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
  run();
  return {
    retarget(t, vel) { target = t; if (vel !== undefined) v = vel; run(); },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    value: () => x,
    velocity: () => v,
  };
}

/** Rzut pędu jak przy przewijaniu (funkcja z „Designing Fluid Interfaces”): gdzie gest by się zatrzymał. */
export const projekcja = (v: number, decel = 0.998): number => (v / 1000) * decel / (1 - decel);

/** Gumowa granica: za krańcem element podąża coraz słabiej zamiast stawać twardo. */
export function guma(x: number, min: number, max: number, wymiar = 200, c = 0.55): number {
  if (x < min) { const d = min - x; return min - (d * wymiar * c) / (wymiar + c * d); }
  if (x > max) { const d = x - max; return max + (d * wymiar * c) / (wymiar + c * d); }
  return x;
}

/* ─────────── gesty ─────────── */

/** Przeciąganie z przechwyceniem wskaźnika; współrzędne w układzie elementu (px CSS) lub SVG (viewBox). */
export function drag(el: Element, h0: {
  start?: (p: { x: number; y: number }, e: PointerEvent) => boolean | void;
  move?: (p: { x: number; y: number }, e: PointerEvent) => void;
  /** `v` — prędkość w chwili puszczenia (jednostki współrzędnych na sekundę), do przekazania sprężynie. */
  end?: (p: { x: number; y: number }, e: PointerEvent, v: { x: number; y: number }) => void;
  /** Próg w px ekranu, zanim ruch zostanie uznany za przeciąganie (krótkie dotknięcie to wtedy zwykły klik). */
  prog?: number;
}): () => void {
  let active = false, ruszyl = false, sx = 0, sy = 0;
  const hist: Array<{ x: number; y: number; t: number }> = [];
  const pos = (e: PointerEvent) => {
    if (el instanceof SVGSVGElement) {
      const m = el.getScreenCTM();
      if (m) { const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return { x: pt.x, y: pt.y }; }
    }
    const r = (el as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: Event) => {
    const pe = e as PointerEvent;
    if (pe.button !== 0 && pe.pointerType === 'mouse') return;
    if (h0.start?.(pos(pe), pe) === false) return;
    active = true; ruszyl = !h0.prog; sx = pe.clientX; sy = pe.clientY;
    hist.length = 0; const p0 = pos(pe); hist.push({ ...p0, t: pe.timeStamp });
    (el as Element & { setPointerCapture(id: number): void }).setPointerCapture?.(pe.pointerId);
    pe.preventDefault();
  };
  const mv = (e: Event) => {
    if (!active) return;
    const pe = e as PointerEvent;
    if (!ruszyl) { if (Math.hypot(pe.clientX - sx, pe.clientY - sy) < (h0.prog ?? 0)) return; ruszyl = true; }
    const p = pos(pe);
    hist.push({ ...p, t: pe.timeStamp }); while (hist.length > 6) hist.shift();
    h0.move?.(p, pe);
  };
  const up = (e: Event) => {
    if (!active) return;
    active = false;
    const pe = e as PointerEvent, p = pos(pe);
    // prędkość z ostatnich ~80 ms ruchu
    // palec stał przed puszczeniem (> 60 ms bez ruchu) → bez pędu
    const ost = hist[hist.length - 1];
    const stal = !ost || pe.timeStamp - ost.t > 60;
    const a = hist.find((q) => pe.timeStamp - q.t < 80) ?? hist[0];
    const dt = a ? Math.max(0.008, (pe.timeStamp - a.t) / 1000) : 1;
    const v = a && ruszyl && !stal ? { x: (p.x - a.x) / dt, y: (p.y - a.y) / dt } : { x: 0, y: 0 };
    h0.end?.(p, pe, v);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', mv);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return () => {
    el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', mv);
    el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
  };
}

/* ─────────── canvas ─────────── */

export interface Surface { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number }

/**
 * Canvas, który trzyma ostrość przy każdej szerokości. Wysokość: stała w px albo proporcja szerokości.
 * `onSize` woła się po każdej zmianie rozmiaru (np. żeby przerysować statyczny obraz).
 */
export function surface(parent: HTMLElement, o: { height?: number; ratio?: number; min?: number; max?: number; label?: string }, onSize?: (s: Surface) => void): { s: Surface; destroy(): void } {
  const canvas = h('canvas', { role: o.label ? 'img' : undefined, 'aria-label': o.label, 'aria-hidden': o.label ? undefined : 'true' });
  parent.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const sf: Surface = { canvas, ctx, w: 0, h: 0, dpr: 1 };
  const fit = () => {
    const w = Math.max(1, Math.round(parent.clientWidth || canvas.clientWidth || 600));
    let hh = o.height ?? Math.round(w * (o.ratio ?? 0.3));
    if (o.min) hh = Math.max(o.min, hh);
    if (o.max) hh = Math.min(o.max, hh);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === sf.w && hh === sf.h && dpr === sf.dpr) return;
    sf.w = w; sf.h = hh; sf.dpr = dpr;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr);
    canvas.style.height = `${hh}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onSize?.(sf);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(parent);
  fit();
  return { s: sf, destroy: () => ro.disconnect() };
}

/** Siatka papieru EKG: 1 mm i 5 mm. `mm` = ile px na milimetr. */
export function paper(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, mm: number, o: { minor?: string; major?: string; bg?: string; y0?: number } = {}): void {
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(x, y, w, hh); }
  const y0 = o.y0 ?? y;
  ctx.lineWidth = 1;
  for (const [step, col] of [[mm, o.minor ?? C.gridMinor], [mm * 5, o.major ?? C.gridMajor]] as const) {
    if (step < 2.5 && col === (o.minor ?? C.gridMinor)) continue;
    ctx.strokeStyle = col;
    ctx.beginPath();
    for (let gx = x; gx <= x + w + 0.5; gx += step) { const px = Math.round(gx) + 0.5; ctx.moveTo(px, y); ctx.lineTo(px, y + hh); }
    const first = y0 - Math.floor((y0 - y) / step) * step;
    for (let gy = first; gy <= y + hh + 0.5; gy += step) { const py = Math.round(gy) + 0.5; ctx.moveTo(x, py); ctx.lineTo(x + w, py); }
    ctx.stroke();
  }
}

/** Rysuje przebieg v(t) [mV] na odcinku czasu. Nadpróbkowanie zachowuje szczyty R. */
export function trace(ctx: CanvasRenderingContext2D, f: (t: number) => number, o: {
  x: number; w: number; t0: number; t1: number; y0: number; pxPerMv: number; color?: string; width?: number; sub?: number;
}): void {
  const sub = o.sub ?? 3;
  ctx.strokeStyle = o.color ?? C.puls;
  ctx.lineWidth = o.width ?? 1.6;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  const n = Math.max(2, Math.round(o.w));
  for (let i = 0; i <= n; i++) {
    let ex = 0;
    for (let k = 0; k < sub; k++) {
      const t = o.t0 + ((i + k / sub) / n) * (o.t1 - o.t0);
      const v = f(t);
      if (k === 0 || Math.abs(v) > Math.abs(ex)) ex = v;
    }
    const px = o.x + (i / n) * o.w, py = o.y0 - ex * o.pxPerMv;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/* ─────────── liczby ─────────── */

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const rad = (d: number): number => (d * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;
/** Kąt sprowadzony do (−180, 180]. */
export const normDeg = (d: number): number => { const x = ((d + 180) % 360 + 360) % 360 - 180; return x === -180 ? 180 : x; };
/** „+60°”, „−30°” z prawdziwym minusem. */
export const fmtDeg = (d: number): string => { const x = Math.round(normDeg(d)); return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x) + '°'; };
export const fmtNum = (v: number, digits = 0): string => v.toFixed(digits).replace('-', '−').replace('.', ',');

/** Generator liczb pseudolosowych z ziarnem (powtarzalne zadania). */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle<T>(arr: T[], r: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j] as T, a[i] as T]; }
  return a;
}

/* ─────────── ćwiczenia ─────────── */

/**
 * Wspólny przebieg ćwiczenia: N rund, sprawdzenie, wyjaśnienie, wynik.
 * Wstawka dostarcza tylko: jak przygotować rundę i jak ją ocenić.
 */
export interface Ocena {
  ok: boolean;
  near?: boolean;
  /** Pełny werdykt (stary sposób). Gdy go nie ma, werdykt składa się z `prawidlowo` i `szczegol` według wspólnego wzoru. */
  verdict?: string;
  /** Prawidłowa odpowiedź, np. „blok AV II stopnia Mobitz I”. */
  prawidlowo?: string;
  /** Krótki dopisek po werdykcie, np. „różnica 8°”. */
  szczegol?: string;
  why: string;
}

/** Wspólny wzór werdyktu w całym kursie: „Dobrze.” / „Blisko.” / „Nie. Prawidłowo: …”. */
export function werdykt(r: Pick<Ocena, 'ok' | 'near' | 'prawidlowo' | 'szczegol'>): string {
  const dop = r.szczegol ? ` ${r.szczegol}` : '';
  if (r.ok) return `Dobrze.${dop}`;
  if (r.near) return `Blisko.${r.prawidlowo ? ` Prawidłowo: ${r.prawidlowo}.` : ''}${dop}`;
  return `Nie.${r.prawidlowo ? ` Prawidłowo: ${r.prawidlowo}.` : ''}${dop}`;
}

/**
 * Wspólny przebieg ćwiczenia: N rund, sprawdzenie, wyjaśnienie, wynik.
 * Układ: licznik → polecenie → `miejsce` (tu wstawka wkłada swoje odpowiedzi) → werdykt i wyjaśnienie → przyciski.
 * `gotowe()` mówi, czy kursant już coś wybrał (inaczej „Sprawdź” jest nieaktywne); po wyborze zawołaj `odswiez()`.
 */
export function exercise<R>(o: {
  rounds: number;
  make: (i: number) => R;
  /** Wywoływane przy starcie rundy — wstawka ustawia swój stan. */
  show: (round: R, i: number) => void;
  check: (round: R) => Ocena;
  prompt: string | ((round: R) => string);
  checkLabel?: string;
  gotowe?: (round: R) => boolean;
  live?: (msg: string) => void;
}): { el: HTMLElement; miejsce: HTMLElement; start(): void; isChecked(): boolean; current(): R | null; checkNow(): void; odswiez(): void } {
  const round = h('p', { class: 'hw-score' });
  const prompt = h('p', { class: 'hw-why', style: 'color:var(--hw-txt)' });
  const miejsce = h('div', { class: 'hw-grid' });
  const verdict = h('p', { class: 'hw-verdict' });
  const why = h('p', { class: 'hw-why' });
  const result = h('div', { class: 'hw-grid', role: 'status', 'aria-live': 'polite' }, verdict, why);
  const check = button(o.checkLabel ?? 'Sprawdź', () => doCheck());
  const next = button('Następne zadanie', () => advance(), 'ghost');
  const koniec = h('div', { class: 'hw-grid' });
  const el = h('div', { class: 'hw-read' }, round, prompt, miejsce, result, h('div', { class: 'hw-row' }, check, next), koniec);
  let i = 0, score = 0, checked = false, cur: R | null = null;

  const odswiez = () => { check.disabled = !!(cur && o.gotowe && !o.gotowe(cur)); };
  const render = () => {
    round.textContent = `ZADANIE ${i + 1} Z ${o.rounds} · WYNIK ${score}`;
    result.hidden = !checked; check.hidden = checked; next.hidden = !checked;
    next.textContent = i === o.rounds - 1 ? 'Zobacz wynik' : 'Następne zadanie';
    if (cur) prompt.textContent = typeof o.prompt === 'function' ? o.prompt(cur) : o.prompt;
    odswiez();
  };
  const begin = () => { checked = false; koniec.replaceChildren(); koniec.hidden = true; cur = o.make(i); o.show(cur, i); render(); };
  const doCheck = () => {
    if (!cur || checked || check.disabled) return;
    const r = o.check(cur);
    checked = true;
    if (r.ok) { score++; dzwiekDla(el).dobrze(); }
    verdict.className = 'hw-verdict ' + (r.ok ? 'hw-ok' : r.near ? 'hw-warn' : 'hw-bad');
    verdict.textContent = r.verdict ?? werdykt(r);
    why.innerHTML = r.why;
    o.live?.(verdict.textContent ?? '');
    render();
    next.focus({ preventScroll: true });
  };
  const advance = () => {
    if (i === o.rounds - 1) {
      // osobny stan końca: wynik i powrót do początku
      const again = button('Zacznij od nowa', () => { i = 0; score = 0; begin(); });
      koniec.replaceChildren(h('p', { class: 'hw-verdict', text: `Wynik: ${score} z ${o.rounds}.` }), h('div', { class: 'hw-row' }, again));
      koniec.hidden = false; next.hidden = true;
      o.live?.(`Wynik: ${score} z ${o.rounds}.`);
      again.focus({ preventScroll: true });
      return;
    }
    i++;
    begin();
  };
  return { el, miejsce, start: () => { i = 0; score = 0; begin(); }, isChecked: () => checked, current: () => cur, checkNow: doCheck, odswiez };
}

/** Opcje ćwiczenia „wybierz jedną odpowiedź” w stylu kursu. */
export function options(items: ReadonlyArray<{ v: string; label: string }>, onPick: (v: string) => void): { el: HTMLElement; reveal(right: string, picked: string | null): void; reset(): void; picked(): string | null } {
  const el = h('div', { class: 'hw-grid', role: 'group' });
  let sel: string | null = null;
  const keys = 'ABCDEFGH';
  const btns = items.map((it, i) => {
    const b = h('button', { class: 'hw-opt', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'hw-k', text: keys[i] ?? '' }), h('span', { text: it.label, style: 'flex:1' }), h('span', { class: 'hw-mark', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => { sel = it.v; btns.forEach((x, j) => x.setAttribute('aria-pressed', items[j]?.v === it.v ? 'true' : 'false')); onPick(it.v); });
    el.append(b);
    return b;
  });
  return {
    el,
    picked: () => sel,
    reveal(right, picked) {
      btns.forEach((b, j) => {
        const v = items[j]?.v;
        b.disabled = true;
        b.classList.toggle('is-right', v === right);
        b.classList.toggle('is-wrong', v === picked && v !== right);
        b.classList.toggle('is-dim', v !== right && v !== picked);
        // stan nie tylko kolorem: znak i opis dla czytnika ekranu
        const mark = b.querySelector('.hw-mark');
        if (mark) mark.textContent = v === right ? '✓ prawidłowa' : v === picked ? '✕ twój wybór' : '';
      });
    },
    reset() { sel = null; btns.forEach((b) => { b.disabled = false; b.className = 'hw-opt'; b.setAttribute('aria-pressed', 'false'); const m = b.querySelector('.hw-mark'); if (m) m.textContent = ''; }); },
  };
}

/** Typ wspólny wszystkich wstawek. */
export type WstawkaOpts = Readonly<Record<string, string>>;
export type MountFn = (host: HTMLElement, opts: WstawkaOpts) => () => void;
