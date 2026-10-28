/**
 * Laboratorium węzła AV — pasek z odprowadzenia II zsynchronizowany z diagramem drabinkowym
 * (przedsionki / brama AV z odźwiernym i pasem pęczka Hisa / komory), odtwarzanie cykl po cyklu,
 * odczyt PQ wybranego cyklu, przeciąganie paska z pędem i cyrkiel do „przemaszerowania” załamków P.
 * Wykłady: S2_02, S4_01, S4_02, S4_03, S4_04 (oraz S6_01, przypadek 7).
 *
 * Opcje dyrektywy: tryb=norma|i|wenckebach|mobitz2|2:1|zaawansowany|iii|cwiczenie (domyślnie wenckebach).
 *
 * Braki w core obejście lokalne: monitor nie umie przewinąć do zadanej chwili, więc krok cykl po cyklu
 * przesuwa czas sygnału (`off`) przy zatrzymanym monitorze; `playToggle` nie odświeża napisu po pauzie
 * włączonej z kodu (stąd `syncPlay`). Kratka paska jest tłem CSS (monitor z `grid: false`), bo monitor
 * rysuje kratkę co klatkę. Przenikanie zmiany stanu (migawka paska i diagramu + scena odźwiernego) jest
 * lokalne: jedna warstwa na płótno, start od bieżącego widoku, ten sam czas i krzywa co scena.
 */
import {
  C, chips, clamp, drag, exercise, fmtNum, guma, h, options, projekcja, reducedMotion, s, shell, shuffle, spring, surface,
  TRYB_SPRAWDZ, TRYB_UCZ, type Spring, type WstawkaOpts,
} from './core/ui.js';
import { scena, type ObrazId } from './core/obrazy.js';
import { dzwiekDla, tor } from './core/dzwiek.js';
import { Strip, monitor, pComps, playToggle, vBeat, type Monitor, type MonitorMap } from './core/rytm.js';
import type { Beat } from './core/model.js';
import {
  KRATKA, OPCJE, WARIANT0, ZADANIA, odzwierny, opisCyklu, opisTrybu, scen, trybZOpcji,
  type Scen, type Tryb, type Wariant, type Zadanie,
} from './wezel-av.dane.js';

/** Jeden czas przenikania dla paska, diagramu i sceny odźwiernego [ms]. */
const FADE_MS = 400;

const CSS = `
.wav [hidden]{display:none!important}
.wav-strip{position:relative;touch-action:pan-y;cursor:grab}
.wav-ladder{position:relative;border-top:1px solid var(--hw-line);touch-action:pan-y;cursor:grab}
.wav-fade{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;opacity:0}
.wav-scene{margin:0;display:grid;gap:4px;transition:opacity ${FADE_MS}ms var(--hw-ease)}
.wav-cap{font:12px/1.45 var(--hw-f-m);color:var(--hw-txt2);text-align:center;margin:0}
.wav-h{position:absolute;width:44px;height:44px;margin-left:-22px;padding:0;border:0;background:transparent;cursor:ew-resize;touch-action:none;display:grid;place-items:center;color:inherit;z-index:2}
.wav-h i{display:block;width:18px;height:18px;border-radius:50%;background:#070A0D;border:2px solid var(--hw-txt)}
.wav-h:active i,.wav-h:focus-visible i{background:var(--hw-txt)}
.wav-h:focus-visible{outline-offset:-4px}
.wav-h--a{bottom:2px}
.wav-h--b{bottom:50px}
.wav-h--m{top:0;cursor:grab}
.wav-h--m i{width:30px;height:14px;border-radius:7px}
.wav-ctrl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.wav-sub{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.wav-sub .hw-label{margin-right:4px}
.wav-legend svg{display:inline-block;vertical-align:-1px;margin-right:6px}
@media (prefers-reduced-motion:reduce){.wav-scene,.wav-scene img{transition:none!important}}
`;
let styled = false;
function ensureLocalStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.setAttribute('data-hw-wav', '');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/**
 * Scena odźwiernego z przenikaniem: warstwy w jednej komórce siatki, przejście CSS startuje od bieżącego
 * krycia (przerwane przejście nie skacze), stara warstwa znika po `transitionend`, bez timerów.
 */
function scenaZPrzenikaniem(start: ObrazId, maxH: number): { el: HTMLElement; set(id: ObrazId): void } {
  const el = h('div', { style: 'position:relative;display:grid' });
  const warstwy = new Map<ObrazId, HTMLImageElement>();
  let cur: ObrazId = start, z = 1;
  const dodaj = (id: ObrazId): HTMLImageElement => {
    const img = scena(id, { maxH });
    img.style.gridArea = '1/1';
    img.style.transition = `opacity ${FADE_MS}ms var(--hw-ease)`;
    img.addEventListener('transitionend', () => {
      if (id !== cur && getComputedStyle(img).opacity === '0') { img.remove(); warstwy.delete(id); }
    });
    warstwy.set(id, img);
    el.append(img);
    return img;
  };
  dodaj(start);
  return {
    el,
    set(id) {
      if (id === cur) return;
      cur = id;
      if (reducedMotion()) {
        for (const [k, img] of warstwy) if (k !== id) { img.remove(); warstwy.delete(k); }
        const img = warstwy.get(id) ?? dodaj(id);
        img.style.opacity = '1'; img.removeAttribute('aria-hidden');
        return;
      }
      let img = warstwy.get(id);
      if (!img) { img = dodaj(id); img.style.opacity = '0'; void img.offsetWidth; }
      img.style.zIndex = String(++z);
      img.style.opacity = '1'; img.removeAttribute('aria-hidden');
      for (const [k, o] of warstwy) if (k !== id) { o.style.opacity = '0'; o.setAttribute('aria-hidden', 'true'); }
    },
  };
}

/**
 * Migawka płótna do przenikania stanów: jedna warstwa nad płótnem. Przy przerwaniu w połowie migawka
 * dostaje dokładnie to, co widać (płótno + migawka w bieżącym kryciu), więc obraz nie skacze.
 */
function migawka(box: HTMLElement, src: () => HTMLCanvasElement | null, przed: Element | null): () => void {
  const snap = h('canvas', { class: 'wav-fade', 'aria-hidden': 'true' });
  box.insertBefore(snap, przed);
  let tmp: HTMLCanvasElement | null = null;
  return () => {
    if (reducedMotion()) return;
    const cv = src();
    if (!cv || !cv.width || !cv.height) return;
    const a = Number(getComputedStyle(snap).opacity) || 0;
    tmp ??= document.createElement('canvas');
    tmp.width = cv.width; tmp.height = cv.height;
    const t = tmp.getContext('2d');
    if (!t) return;
    t.drawImage(cv, 0, 0);
    if (a > 0.01 && snap.width === cv.width && snap.height === cv.height) { t.globalAlpha = a; t.drawImage(snap, 0, 0); t.globalAlpha = 1; }
    snap.width = cv.width; snap.height = cv.height;
    snap.getContext('2d')?.drawImage(tmp, 0, 0);
    snap.style.transition = 'none'; snap.style.opacity = '1';
    void snap.offsetWidth;
    snap.style.transition = `opacity ${FADE_MS}ms var(--hw-ease)`; snap.style.opacity = '0';
  };
}

/** Pasy diagramu drabinkowego [y0, y1] w px. */
const LAD_H = 132;
/** Wysokość paska [px] i linia bazowa (ułamek wysokości), wspólne dla monitora i kratki w tle. */
const STRIP_H = 150, BASE = 0.6;
/** Granice ramion cyrkla (ułamek szerokości); poza nimi gumowy opór, po puszczeniu powrót sprężyną. */
const CAL_LO = 0.02, CAL_HI = 0.98;
const L = { A: [6, 32], N: [32, 80], H: [80, 102], V: [102, 128] } as const;
/** Czas pobudzenia przedsionków i pęczka Hisa na diagramie (stały; zmienna część PQ jest w bramie). */
const T_A = 0.05, T_H = 0.05;
/** Początek widoku przy zmianie stanu [s czasu paska]. */
const VIEW0 = -0.4;

const SCEN_ITEMS: ReadonlyArray<{ v: Tryb; label: string }> = [
  { v: 'norma', label: 'Prawidłowo' },
  { v: 'i', label: 'Blok I°' },
  { v: 'wenckebach', label: 'Mobitz I' },
  { v: 'mobitz2', label: 'Mobitz II' },
  { v: '2:1', label: 'Blok 2:1' },
  { v: 'zaawansowany', label: 'Zaawansowany 3:1' },
  { v: 'iii', label: 'Blok III°' },
];

const f2 = (v: number) => fmtNum(v, 2);

export function mountWezelAv(host: HTMLElement, opts: WstawkaOpts): () => void {
  ensureLocalStyle();
  const startOpt = trybZOpcji(opts.tryb);
  const { root, body, live } = shell(host, {
    label: 'Wstawka · węzeł AV',
    title: 'Laboratorium węzła AV: gdzie i kiedy impuls zostaje zatrzymany',
    intro: 'Pasek z odprowadzenia II i diagram drabinkowy pod nim pokazują ten sam zapis. Przechodź cykl po cyklu, wybieraj pobudzenia i mierz cyrklem odstępy P-P.',
  });
  root.classList.add('wav');

  let tryb: Tryb = startOpt === 'cwiczenie' ? 'wenckebach' : startOpt;
  let w: Wariant = { ...WARIANT0 };
  let sc: Scen = scen(tryb, w);
  let mode: 'play' | 'task' = startOpt === 'cwiczenie' ? 'task' : 'play';
  /** Czy pokazać diagram, znaczniki P i odczyt PQ (w ćwiczeniu dopiero po sprawdzeniu). */
  let reveal = mode === 'play';
  let sel: number | null = null;
  /** Cykl, do którego zmierza krok (kolejne naciśnięcia dodają się do niego, także w trakcie ruchu). */
  let cel: number | null = null;
  let off = 0;
  let lastVs = VIEW0;
  const SEC = (root.clientWidth || 700) < 560 ? 4.4 : 6;
  const cleanups: Array<() => void> = [];
  /** Sprężyna przesuwu czasu paska (krok cyklu, zatrzask po rzucie). */
  let offSpr: Spring | null = null;
  const stopOff = () => { offSpr?.stop(); offSpr = null; };
  /** Numer stanu: zmienia się przy każdej zmianie scenariusza (diagram rysuje się tylko po zmianie). */
  let gen = 0;
  let ladKey = '';

  /* ─────────── zdarzenia paska ─────────── */
  const strip = new Strip();
  const P_KSZT = pComps('normal');
  const makeBeat = (x: Scen): Beat => vBeat({ qrs: x.qrs === 'odnoga' ? 'rbbb' : x.qrs === 'komorowy' ? 'vent' : 'normal', qrsAmp: x.qrs === 'komorowy' ? 1.35 : 1, qt: x.qt, tSharp: x.tSharp });
  let beatQ = makeBeat(sc);
  let built: [number, number] = [Infinity, -Infinity];
  const ensure = (t0: number, t1: number) => {
    if (t0 >= built[0] && t1 <= built[1]) return;
    const a = t0 - 3, b = t1 + 6;
    strip.clear();
    for (let k = Math.floor(a / sc.pp); k * sc.pp < b; k++) strip.add({ kind: 'P', at: k * sc.pp, comps: P_KSZT });
    for (const v of sc.komory(a, b)) strip.add({ kind: 'QRS', at: v.at, beat: beatQ, tag: v.zrodlo });
    built = [a, b];
  };

  /* ─────────── opis ─────────── */
  const tTitle = h('h4', { class: 'hw-cat' });
  const tText = h('p', { class: 'hw-why' });
  const tags = h('div', { class: 'hw-tags' });
  const cyc = h('p', { class: 'hw-why' });
  const gateNote = h('p', { class: 'hw-note' });
  const pearl = h('p', { class: 'hw-pearl' });
  const info = h('div', { class: 'hw-read' }, tTitle, tText, tags, cyc, gateNote, pearl);

  /** Klucz ostatnio narysowanej postawy odźwiernego (żeby nie dotykać SVG co klatkę). */
  let gateKey = '';

  /* ─────────── ekran: pasek + diagram ─────────── */
  const pqOut = h('b', { 'aria-hidden': 'true' });
  const scr = h('div', { class: 'hw-screen wav-screen' },
    h('div', { class: 'hw-mbar' }, h('span', {}, h('span', { class: 'hw-dot' }), 'Odprowadzenie II · 25 mm/s'), pqOut));
  const stripBox = h('div', { class: 'wav-strip' });
  const ladderBox = h('div', { class: 'wav-ladder' });
  scr.append(stripBox, ladderBox);

  /* scena odźwiernego z rastra marki (nad paskiem i diagramem), podpis dosłownie z wykładu */
  const scene = scenaZPrzenikaniem('odzwiernySpokojny', 170);
  const sceneCap = h('figcaption', { class: 'wav-cap' });
  const sceneWrap = h('figure', { class: 'wav-scene' }, scene.el, sceneCap);
  let m: Monitor | null = null;
  // dźwięk w odtwarzaniu: cichy takt każdego P, stuk przewiedzionego QRS; zablokowany P bez stuku (słychać „dziurę”)
  const snd = tor(stripBox, { ciagly: true });
  let prevT = NaN;
  function dzwiekAv(t: number, dt: number) {
    // tylko płynne odtwarzanie (krok pętli ≤ 0,06 s); skoki osi czasu i wypełnianie na starcie bez dźwięku
    const plynnie = dt > 0 && dt <= 0.06 && t > prevT && t - prevT < 0.2;
    const t0 = prevT; prevT = t;
    if (!plynnie || !snd.aktywny()) return;
    for (let k = Math.floor(t0 / sc.pp); k <= Math.floor(t / sc.pp) + 1; k++) {
      const at = sc.cykl(k).at;
      if (at > t0 && at <= t) snd.tik(false);
    }
    for (const v of sc.komory(t0, t)) if (v.at > t0 && v.at <= t) snd.stuk();
  }
  const lad = surface(ladderBox, { height: LAD_H, label: 'Diagram drabinkowy: przedsionki, brama AV z pęczkiem Hisa i komory' }, () => m?.redraw());

  /* cyrkiel: ramiona w ułamku szerokości ekranu (cyrkiel stoi, papier może się przesuwać).
     Ten sam wygląd i układ uchwytów co w `pomiary`: lewe ramię niżej, prawe wyżej, cały cyrkiel na poprzeczce. */
  const cal = { on: false, a: 0.3, b: 0.3 + 0.8 / SEC };
  const ramie = (k: 'a' | 'b' | 'm', label: string) => h('button', {
    type: 'button', class: `wav-h wav-h--${k}`, 'data-cal': k, role: 'slider', 'aria-orientation': 'horizontal',
    'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': Math.round(SEC * 1000),
  }, h('i', {}));
  const legA = ramie('a', 'Lewe ramię cyrkla');
  const legB = ramie('b', 'Prawe ramię cyrkla');
  const legM = ramie('m', 'Cały cyrkiel');
  const calOut = h('p', { class: 'hw-note', hidden: true });

  m = monitor(stripBox, {
    seconds: SEC, mode: 'scroll', height: STRIP_H, scale: 'fit', base: BASE, fitMv: 1.45, grid: false,
    signal: (t) => strip.volt(t + off, 'II'),
    overlay: (ctx, map) => drawOverlay(ctx, map),
    label: 'Pasek EKG z odprowadzenia II',
    tick: (now, dt) => { ensure(now + off - SEC - 1, now + off + 1); dzwiekAv(now + off, dt); },
  });
  const mon: Monitor = m;
  const przenikPasek = migawka(stripBox, () => stripBox.querySelector('canvas'), null);
  const przenikDiagram = migawka(ladderBox, () => lad.s.canvas, null);
  stripBox.append(legA, legB, legM);
  off = VIEW0 + SEC - mon.now();
  /** Przenikanie paska, diagramu i (przez `paintGate`) sceny w jednej klatce. */
  const przenik = () => { przenikPasek(); przenikDiagram(); };

  /* kratka 1 i 5 mm jako tło paska (rysowana raz na rozmiar, nie co klatkę) */
  const kratka = () => {
    const w = stripBox.clientWidth || 600, mm = w / SEC / 25, y0 = STRIP_H * BASE;
    const g = (c: string, deg: number) => `linear-gradient(${deg}deg,${c} 1px,transparent 1px)`;
    const big = mm * 5, py = (st: number) => `${(y0 % st).toFixed(2)}px`;
    const layers = [[g(C.gridMajor, 90), `${big.toFixed(2)}px 100%`, '0 0'], [g(C.gridMajor, 180), `100% ${big.toFixed(2)}px`, `0 ${py(big)}`]];
    if (mm >= 2.5) layers.push([g(C.gridMinor, 90), `${mm.toFixed(2)}px 100%`, '0 0'], [g(C.gridMinor, 180), `100% ${mm.toFixed(2)}px`, `0 ${py(mm)}`]);
    stripBox.style.backgroundImage = layers.map((l) => l[0]).join(',');
    stripBox.style.backgroundSize = layers.map((l) => l[1]).join(',');
    stripBox.style.backgroundPosition = layers.map((l) => l[2]).join(',');
  };
  const roK = new ResizeObserver(kratka);
  roK.observe(stripBox);
  cleanups.push(() => roK.disconnect());
  kratka();

  const redraw = () => { const n = mon.now(); ensure(n + off - SEC - 1, n + off + 1); mon.redraw(); };

  function drawOverlay(ctx: CanvasRenderingContext2D, map: MonitorMap) {
    const vs = map.now + off - SEC;
    lastVs = vs;
    const W = map.w, Hh = map.h;
    const X = (T: number) => ((T - vs) / SEC) * W;
    const yBase = map.y(0);
    if (reveal) {
      // znaczniki P: kształt + kolor (kolor nigdy sam)
      for (let k = Math.floor(vs / sc.pp) - 1; k * sc.pp <= vs + SEC + 0.1; k++) {
        const c = sc.cykl(k);
        const x = X(c.at + 0.05), y = Hh - 10;
        if (x < -6 || x > W + 6) continue;
        ctx.lineWidth = 1.5;
        if (c.niezalezny) { ctx.strokeStyle = C.txt2; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.stroke(); }
        else if (c.pq === null) {
          ctx.strokeStyle = C.alarm; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke();
        } else { ctx.fillStyle = C.puls; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
      }
      if (sel !== null) drawSelection(ctx, X, W, yBase);
    }
    if (cal.on) drawCaliper(ctx, W, Hh);
    // diagram tylko po zmianie: przesunięcie o ≥ 1 px, wybór, odsłonięcie, stan albo rozmiar
    const lk = `${Math.round((vs / SEC) * lad.s.w)}|${reveal}|${sel}|${gen}|${lad.s.w}x${lad.s.dpr}`;
    if (lk !== ladKey) { ladKey = lk; drawLadder(vs); }
    paintGate(vs);
  }

  function drawSelection(ctx: CanvasRenderingContext2D, X: (t: number) => number, W: number, yBase: number) {
    if (sel === null) return;
    const c = sc.cykl(sel);
    const lab = opisCyklu(sc, sel).krotko;
    ctx.font = `500 12px ${C.fontMono}`;
    ctx.textBaseline = 'alphabetic';
    const x1 = X(c.at);
    let x2: number | null = null;
    if (c.pq !== null) x2 = X(c.at + c.pq);
    else if (c.niezalezny) { const n = sc.komory(c.at, c.at + 4)[0]; if (n) x2 = X(n.at); }
    const col = c.pq !== null ? C.puls : c.niezalezny ? C.txt2 : C.alarm;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.4;
    const yb = 30;
    if (x2 !== null) {
      ctx.setLineDash(c.pq !== null ? [] : [4, 3]);
      ctx.beginPath(); ctx.moveTo(x1, yb); ctx.lineTo(x2, yb); ctx.moveTo(x1, yb - 5); ctx.lineTo(x1, yb + 5); ctx.moveTo(x2, yb - 5); ctx.lineTo(x2, yb + 5); ctx.stroke();
      ctx.setLineDash([2, 3]); ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(x1, yb + 5); ctx.lineTo(x1, yBase); ctx.moveTo(x2, yb + 5); ctx.lineTo(x2, yBase); ctx.stroke();
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    } else {
      ctx.beginPath(); ctx.moveTo(x1, yb - 5); ctx.lineTo(x1, yBase); ctx.stroke();
    }
    const tw = ctx.measureText(lab).width;
    const cx = x2 !== null ? (x1 + x2) / 2 : x1;
    const tx = clamp(cx - tw / 2, 4, W - tw - 4);
    ctx.fillStyle = 'rgba(7,10,13,.85)'; ctx.fillRect(tx - 3, yb - 21, tw + 6, 16);
    ctx.fillStyle = col; ctx.fillText(lab, tx, yb - 9);
  }

  function drawCaliper(ctx: CanvasRenderingContext2D, W: number, Hh: number) {
    const a = cal.a * W, b = cal.b * W, d = b - a;
    // ramiona schodzą do swoich uchwytów (lewe niżej, prawe wyżej), poprzeczka u góry z uchwytem całego cyrkla
    ctx.strokeStyle = C.txt; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(a, 22); ctx.lineTo(a, Hh - 24 - 11); ctx.moveTo(b, 22); ctx.lineTo(b, Hh - 72 - 11);
    ctx.moveTo(a, 22); ctx.lineTo(b, 22);
    ctx.stroke();
    if (Math.abs(d) > 6) {
      ctx.setLineDash([3, 4]); ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let n = -60; n <= 60; n++) {
        if (n === 0 || n === 1) continue;
        const x = a + n * d;
        if (x < 0 || x > W) continue;
        ctx.moveTo(x, 22); ctx.lineTo(x, Hh - 22);
      }
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }

  function drawLadder(vs: number) {
    const { ctx, w: W, h: Hh } = lad.s;
    if (!W) return;
    ctx.clearRect(0, 0, W, Hh);
    const X = (T: number) => ((T - vs) / SEC) * W;
    // pionowe linie co 0,2 s, w tym samym miejscu co duże kratki paska
    const step = (W / SEC) * 0.2;
    ctx.strokeStyle = C.gridMinor; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= W; x += step) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, Hh); }
    ctx.stroke();
    // pasy
    ctx.strokeStyle = C.line2; ctx.beginPath();
    for (const y of [L.A[1], L.H[1]]) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
    ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(0, L.N[1] + 0.5); ctx.lineTo(W, L.N[1] + 0.5); ctx.stroke(); ctx.setLineDash([]);

    if (reveal) {
      ctx.lineCap = 'round';
      for (let k = Math.floor((vs - 1) / sc.pp); k * sc.pp <= vs + SEC; k++) drawCycleLines(ctx, X, k);
      for (const v of sc.komory(vs - 1, vs + SEC + 0.1)) {
        if (v.zrodlo === 'przewiedzione') continue;
        ctx.strokeStyle = C.txt; ctx.fillStyle = C.txt; ctx.lineWidth = 1.6;
        if (v.zrodlo === 'lacze') {
          const x0 = X(v.at - 0.04);
          ctx.beginPath(); ctx.arc(x0, L.H[0] + 6, 3, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x0, L.H[0] + 6); ctx.lineTo(X(v.at), L.H[1]); ctx.moveTo(X(v.at), L.V[0]); ctx.lineTo(X(v.at + 0.04), L.V[1]); ctx.stroke();
        } else {
          const x0 = X(v.at);
          ctx.beginPath(); ctx.arc(x0, L.V[0] + 9, 3, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x0, L.V[0] + 9); ctx.lineTo(X(v.at + 0.12), L.V[1]); ctx.moveTo(x0, L.V[0] + 9); ctx.lineTo(X(v.at + 0.03), L.V[0] + 1); ctx.stroke();
        }
      }
    } else {
      ctx.font = `12px ${C.fontMono}`; ctx.fillStyle = C.txt3; ctx.textAlign = 'center';
      ctx.fillText('Diagram pojawi się po sprawdzeniu', W / 2 + 24, L.N[0] + 28);
      ctx.textAlign = 'left';
    }
    // podpisy pasów (na tle, żeby kreski ich nie przecinały)
    const label = (t: string, x: number, y: number) => {
      ctx.font = `500 12px ${C.fontMono}`;
      const tw = ctx.measureText(t).width;
      ctx.fillStyle = 'rgba(7,10,13,.85)'; ctx.fillRect(x - 3, y - 11, tw + 6, 15);
      ctx.fillStyle = C.label; ctx.fillText(t, x, y);
    };
    label('PRZEDSIONKI', 6, L.A[0] + 16);
    label('BRAMA AV', 6, L.N[0] + 16);
    label('PĘCZEK HISA', 6, L.H[0] + 16);
    label('KOMORY', 6, L.V[0] + 17);
  }

  function drawCycleLines(ctx: CanvasRenderingContext2D, X: (t: number) => number, k: number) {
    const c = sc.cykl(k);
    const isSel = sel === k;
    const lw = isSel ? 3 : 1.6;
    const p = c.at;
    // przedsionki
    ctx.strokeStyle = C.puls; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(X(p), L.A[0] + 1); ctx.lineTo(X(p + T_A), L.A[1]); ctx.stroke();
    const n0 = p + T_A;
    if (c.pq !== null) {
      const q = p + c.pq;
      const vd = sc.qrs === 'waski' ? 0.04 : 0.1;
      ctx.beginPath();
      ctx.moveTo(X(n0), L.N[0]); ctx.lineTo(X(q - T_H), L.N[1]);
      ctx.lineTo(X(q), L.H[1]);
      ctx.moveTo(X(q), L.V[0]); ctx.lineTo(X(q + vd), L.V[1]);
      ctx.stroke();
      return;
    }
    // zablokowany: dokąd dotarł + poprzeczka
    ctx.strokeStyle = C.alarm;
    let ex: number, ey: number;
    ctx.beginPath(); ctx.moveTo(X(n0), L.N[0]);
    if (c.stop === 'brama') {
      ex = X(n0 + 0.14); ey = L.N[0] + (L.N[1] - L.N[0]) * 0.62;
      ctx.lineTo(ex, ey);
    } else {
      // przez bramę tak jak przewiedzione, zatrzymany w pęczku Hisa
      // PQ sąsiedniego przewiedzionego cyklu (impuls przeszedł bramę tak jak one), bez zgadywania
      let pqTyp = 0.16;
      for (let d = 1; d <= 6; d++) { const n = sc.cykl(k - d).pq ?? sc.cykl(k + d).pq; if (n !== null) { pqTyp = n; break; } }
      const xn = X(p + pqTyp - T_H);
      ctx.lineTo(xn, L.N[1]);
      ex = X(p + pqTyp - T_H * 0.4); ey = L.H[0] + (L.H[1] - L.H[0]) * 0.6;
      ctx.lineTo(ex, ey);
    }
    ctx.stroke();
    ctx.lineWidth = isSel ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(ex - 7, ey); ctx.lineTo(ex + 7, ey); ctx.stroke();
  }

  /**
   * Scena odźwiernego dla cyklu wybranego albo ostatniego na ekranie. Przy „Ogranicz ruch” zmienia się
   * tylko po kroku, kliknięciu albo zmianie stanu (wtedy `gateKey` jest zerowany).
   */
  function paintGate(vs: number) {
    if (reducedMotion() && gateKey !== '') return;
    const k = sel ?? Math.floor((vs + SEC - 0.1) / sc.pp);
    const o = odzwierny(sc, k);
    const key = `${reveal}|${o.scena}|${o.podpis}|${o.opis}`;
    if (key === gateKey) return;
    gateKey = key;
    // w ćwiczeniu scena zdradziłaby odpowiedź, więc pojawia się dopiero po sprawdzeniu (wtedy wchodzi przenikaniem)
    if (sceneWrap.hidden && reveal && !reducedMotion()) {
      sceneWrap.style.opacity = '0'; sceneWrap.hidden = false; void sceneWrap.offsetWidth; sceneWrap.style.opacity = '1';
    }
    sceneWrap.hidden = !reveal;
    if (reveal) { scene.set(o.scena); sceneCap.textContent = `„${o.podpis}”`; }
    gateNote.textContent = reveal ? o.opis : '';
  }

  /* ─────────── sterowanie ─────────── */
  const modeChips = chips([{ v: 'play', label: TRYB_UCZ }, { v: 'task', label: TRYB_SPRAWDZ }] as const, mode, (v) => setMode(v), { label: 'Tryb wstawki' });
  const scenChips = chips(SCEN_ITEMS, tryb, (v) => { w = { ...WARIANT0 }; syncSub(); setScenario(v, w, true); }, { label: 'Rodzaj przewodzenia', small: true });

  const poziomChips = chips([{ v: 'wezel', label: 'w węźle AV' }, { v: 'his', label: 'poniżej węzła' }] as const, w.poziom, (v) => { w = { ...w, poziom: v }; setScenario(tryb, w, true); }, { label: 'Gdzie leży blok', small: true });
  const wysilekChips = chips([{ v: 'nie', label: 'Spoczynek' }, { v: 'tak', label: 'Przyspiesz przedsionki' }] as const, 'nie', (v) => { w = { ...w, wysilek: v === 'tak' }; setScenario(tryb, w, true); }, { label: 'Tempo przedsionków jak w próbie wysiłkowej', small: true });
  const zastChips = chips([{ v: 'komory', label: 'z komór' }, { v: 'lacze', label: 'z łącza AV' }] as const, w.zastepczy, (v) => { w = { ...w, zastepczy: v }; setScenario(tryb, w, true); }, { label: 'Skąd pochodzi rytm zastępczy', small: true });
  const sub21 = h('div', { class: 'wav-sub' },
    h('span', { class: 'wav-sub' }, h('span', { class: 'hw-label', text: 'Blok leży' }), poziomChips.el),
    h('span', { class: 'wav-sub' }, h('span', { class: 'hw-label', text: 'Przedsionki' }), wysilekChips.el));
  const subIII = h('div', { class: 'wav-sub' }, h('span', { class: 'hw-label', text: 'Rytm zastępczy' }), zastChips.el);
  const syncSub = () => {
    sub21.hidden = mode !== 'play' || tryb !== '2:1';
    subIII.hidden = mode !== 'play' || tryb !== 'iii';
    poziomChips.set(w.poziom); wysilekChips.set(w.wysilek ? 'tak' : 'nie'); zastChips.set(w.zastepczy);
  };

  const playBtn = playToggle(mon, (paused) => { if (!paused) { stopOff(); sel = null; cel = null; paintCycle(); } });
  const syncPlay = () => { playBtn.textContent = mon.paused() ? 'Graj' : 'Pauza'; playBtn.setAttribute('aria-label', mon.paused() ? 'Wznów zapis' : 'Zatrzymaj zapis'); };
  const pause = () => { mon.setPaused(true); syncPlay(); };
  const back = h('button', { class: 'hw-chip hw-chip--sm', type: 'button', 'aria-label': 'Poprzedni cykl', text: '◀ Cykl' });
  const fwd = h('button', { class: 'hw-chip hw-chip--sm', type: 'button', 'aria-label': 'Następny cykl', text: 'Cykl ▶' });
  back.addEventListener('click', () => step(-1));
  fwd.addEventListener('click', () => step(1));
  const calBtn = h('button', { class: 'hw-chip hw-chip--sm', type: 'button', 'aria-pressed': 'false', text: 'Cyrkiel' });
  calBtn.addEventListener('click', () => setCal(!cal.on));
  const ctrl = h('div', { class: 'wav-ctrl' }, back, playBtn, fwd, calBtn);

  const legend = h('div', { class: 'hw-legend wav-legend' },
    h('span', {}, icon('dot'), 'P przewiedzione'),
    h('span', {}, icon('x'), 'P bez QRS'),
    h('span', {}, icon('ring'), 'P niezależne od QRS'),
    h('span', {}, icon('esc'), 'muzyk zastępczy'));

  /* ─────────── ćwiczenie ─────────── */
  let order: Zadanie[] = [];
  const opt = options(OPCJE, () => ex.odswiez());
  const ex = exercise<Zadanie>({
    rounds: ZADANIA.length,
    make: (i) => { if (i === 0 || order.length === 0) order = shuffle([...ZADANIA]); return order[i] ?? ZADANIA[0]!; },
    show: (z) => {
      opt.reset(); reveal = false; sel = null; cel = null;
      legend.hidden = true;
      setScenario(z.tryb, z.w, true);
      pause();
    },
    prompt: 'Rozpoznaj zaburzenie przewodzenia. Włącz cyrkiel, przenieś odstęp P-P wzdłuż paska i poszukaj P schowanych w T.',
    gotowe: () => opt.picked() !== null,
    check: (z) => {
      const p = opt.picked();
      opt.reveal(z.dobra, p);
      // diagram, znaczniki i scena wchodzą tym samym przenikaniem co zmiana stanu
      przenik();
      reveal = true; gateKey = ''; legend.hidden = false;
      redraw();
      const right = OPCJE.find((o) => o.v === z.dobra)?.label ?? '';
      const ok = p === z.dobra;
      const zablokowany = Array.from({ length: 12 }, (_, k) => sc.cykl(k)).some((c) => c.pq === null && !c.niezalezny);
      return {
        ok,
        prawidlowo: right,
        szczegol: ok ? `${right}.` : undefined,
        why: z.dlaczego + ' Pod paskiem widzisz teraz diagram drabinkowy tego zapisu. '
          + (zablokowany ? 'Wybierz zablokowany P na diagramie, żeby zobaczyć, gdzie zatrzymał się impuls.' : 'Wybierz pobudzenie na diagramie, żeby zobaczyć jego PQ.'),
      };
    },
    live,
  });
  ex.miejsce.append(opt.el);

  body.append(
    h('div', { class: 'hw-bar' }, modeChips.el),
    h('div', { class: 'hw-bar' }, scenChips.el),
    sub21, subIII,
    sceneWrap, scr, legend, ctrl, calOut,
    info, ex.el,
  );

  /* ─────────── logika ─────────── */
  function paintInfo() {
    const o = opisTrybu(tryb, w);
    tTitle.textContent = o.tytul;
    tText.textContent = o.tekst;
    tags.replaceChildren(...o.tagi.map(([k, v]) => h('span', { class: 'hw-tag' }, `${k} `, h('b', { text: v }))));
    pearl.hidden = !o.perla;
    pearl.textContent = o.perla ?? '';
    paintCycle();
    gateKey = '';
  }
  function paintCycle() {
    if (sel === null) {
      cyc.textContent = 'Wybierz pobudzenie na pasku lub diagramie albo przechodź przyciskami ◀ Cykl i Cykl ▶, żeby zobaczyć jego PQ.';
      pqOut.textContent = mode === 'play' ? opisTrybu(tryb, w).tagi[0]?.join(' ') ?? '' : '';
      return;
    }
    const o = opisCyklu(sc, sel);
    cyc.textContent = o.zdanie;
    pqOut.textContent = reveal ? o.krotko : '';
  }

  function setScenario(t: Tryb, nw: Wariant, fade: boolean) {
    // stan od razu (tekst, chipy, komunikat); stary obraz zanika migawką w tym samym czasie co scena odźwiernego
    if (fade) przenik();
    stopOff();
    tryb = t; w = nw; sc = scen(t, w); beatQ = makeBeat(sc); gen++;
    built = [Infinity, -Infinity]; sel = null; cel = null;
    off = VIEW0 + SEC - mon.now();
    scenChips.set(t); syncSub();
    paintInfo(); redraw();
    if (mode === 'play') {
      const o = opisTrybu(t, w);
      live(`${o.tytul}. ${o.tagi.map(([k, v]) => `${k} ${v}`).join(', ')}.`);
    }
  }

  function select(k: number, announce = true) {
    if (!reveal) return;
    sel = k;
    paintCycle();
    gateKey = '';
    redraw();
    if (announce) live(opisCyklu(sc, k).zdanie);
  }
  /** Przesunięcie czasu, przy którym P cyklu `k` stoi w stałym miejscu ekranu. */
  const offDla = (k: number) => sc.cykl(k).at + 0.2 - 0.6 * SEC + SEC - mon.now();
  /** Cykl, którego P stoi najbliżej tego miejsca przy danym przesunięciu. */
  const cyklPrzy = (o: number) => Math.round((mon.now() + o - SEC + 0.6 * SEC - 0.2) / sc.pp);
  /** Ruch do cyklu sprężyną: przerywalny, z zachowaniem prędkości, bez odbicia (odbicie tylko po rzucie). */
  function jedzDo(k: number, v0?: number, damping = 1) {
    cel = k;
    const to = offDla(k);
    if (offSpr) offSpr.retarget(to, v0);
    else offSpr = spring(off, to, (v) => { off = v; redraw(); }, { response: 0.35, damping, velocity: v0, done: () => { offSpr = null; } });
    if (reveal) select(k); else { sel = null; redraw(); }
  }
  function step(d: number) {
    pause();
    jedzDo((cel ?? sel ?? cyklPrzy(off)) + d);
  }

  /* przeciąganie paska i diagramu: próg 10 px (krótkie dotknięcie = wybór cyklu), potem papier 1:1,
     po puszczeniu rzut pędu i zatrzask na najbliższym P */
  const timeAt = (x: number, width: number) => lastVs + (x / Math.max(1, width)) * SEC;
  const cyklPod = (x: number, box: HTMLElement) => Math.floor((timeAt(x, box.clientWidth) + 0.05) / sc.pp);
  let rafId = 0;
  const naKlatke = () => { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; placeCal(); }); };
  cleanups.push(() => cancelAnimationFrame(rafId));
  let pan: { off0: number; x0: number; k: number | null; prevSel: number | null; ruszyl: boolean } | null = null;
  const przesuwPaska = (box: HTMLElement) => drag(box, {
    prog: 10,
    start: (p, e) => {
      if ((e.target as Element | null)?.closest?.('[data-cal]')) return false;
      stopOff();   // dotknięcie łapie papier w ruchu
      const k = reveal ? cyklPod(p.x, box) : null;
      pan = { off0: off, x0: p.x, k, prevSel: sel, ruszyl: false };
      // stan wciśnięcia: cykl pod palcem podświetla się od razu, zatwierdzenie po puszczeniu
      if (k !== null) { sel = k; redraw(); }
      return true;
    },
    move: (p) => {
      if (!pan) return;
      if (!pan.ruszyl) { pan.ruszyl = true; pause(); cel = null; sel = pan.prevSel; }
      off = pan.off0 - ((p.x - pan.x0) / Math.max(1, box.clientWidth)) * SEC;
      naKlatke();
    },
    end: (_p, e, v) => {
      const pp = pan; pan = null;
      if (!pp) return;
      if (!pp.ruszyl) {
        if (e.type === 'pointercancel') { sel = pp.prevSel; redraw(); return; }
        if (!reveal) { live('PQ i diagram zobaczysz po sprawdzeniu.'); return; }
        pause();
        if (pp.k !== null) { cel = pp.k; select(pp.k); }
        return;
      }
      const W = Math.max(1, box.clientWidth);
      const vx = e.type === 'pointercancel' ? 0 : v.x;
      const k = cyklPrzy(off - (projekcja(vx) / W) * SEC);
      jedzDo(k, -(vx / W) * SEC, Math.abs(vx) > 300 ? 0.8 : 1);
    },
  });
  cleanups.push(przesuwPaska(stripBox), przesuwPaska(ladderBox));

  /* cyrkiel */
  const kw = (v: number) => Math.round((v * SEC) / 0.02) * 0.02 / SEC;
  const snap = (v: number) => clamp(kw(v), CAL_LO, CAL_HI);
  const kratekOpis = (sec: number) => {
    const boxes = Math.round((sec / KRATKA) * 2) / 2;
    const kratek = boxes % 1 ? 'małej kratki' : boxes === 1 ? 'mała kratka' : [2, 3, 4].includes(boxes % 10) && ![12, 13, 14].includes(boxes % 100) ? 'małe kratki' : 'małych kratek';
    return `${fmtNum(boxes, boxes % 1 ? 1 : 0)} ${kratek} = ${f2(sec)} s`;
  };
  const calMsg = () => `Cyrkiel: ${kratekOpis(Math.abs(cal.b - cal.a) * SEC)}.`;
  /* dźwięk cyrkla: cichy tyk co mała kratka (0,04 s), mocniejszy co duża */
  let tikMale: number | null = null;
  function tikCal() {
    const n = cal.on ? Math.round(Math.abs(cal.b - cal.a) * SEC / KRATKA) : null;
    if (n !== null && tikMale !== null && n !== tikMale) {
      let mocny = false;
      for (let k = Math.min(n, tikMale) + 1; k <= Math.max(n, tikMale); k++) if (k % 5 === 0) mocny = true;
      dzwiekDla(body).tik(mocny);
    }
    tikMale = n;
  }
  function placeCal() {
    tikCal();
    for (const [el, v] of [[legA, cal.a], [legB, cal.b], [legM, (cal.a + cal.b) / 2]] as const) {
      el.hidden = !cal.on;
      el.style.left = `${v * 100}%`;
    }
    calOut.hidden = !cal.on;
    const sec = Math.abs(cal.b - cal.a) * SEC;
    calOut.textContent = `Cyrkiel: ${kratekOpis(sec)}. Kreski przerywane odmierzają ten sam krok wzdłuż zapisu.`;
    const roz = `rozstaw ${f2(sec)} s`;
    legA.setAttribute('aria-valuenow', String(Math.round(cal.a * SEC * 1000)));
    legB.setAttribute('aria-valuenow', String(Math.round(cal.b * SEC * 1000)));
    legM.setAttribute('aria-valuenow', String(Math.round(Math.min(cal.a, cal.b) * SEC * 1000)));
    legA.setAttribute('aria-valuetext', `Lewe ramię: ${f2(cal.a * SEC)} s, ${roz}`);
    legB.setAttribute('aria-valuetext', `Prawe ramię: ${f2(cal.b * SEC)} s, ${roz}`);
    legM.setAttribute('aria-valuetext', `Cały cyrkiel: od ${f2(Math.min(cal.a, cal.b) * SEC)} s, ${roz}`);
    if (!mon.paused()) return;
    redraw();
  }
  function setCal(on: boolean) {
    cal.on = on;
    calBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) pause();
    placeCal();
    live(on ? 'Cyrkiel włączony. Postaw ramiona na dwóch kolejnych P.' : 'Cyrkiel wyłączony.');
  }
  let calSpr: Spring | null = null;
  const stopCal = () => { calSpr?.stop(); calSpr = null; };
  /** Ruch cyrkla po puszczeniu: przesunięcie obu ramion (albo jednego) o `d` sprężyną, potem komunikat. */
  function cyrkielDo(which: 'a' | 'b' | 'm', d: number, v0: number, damping: number) {
    stopCal();
    if (Math.abs(d) < 1e-6 && Math.abs(v0) < 1e-6) { placeCal(); live(calMsg()); return; }
    const a1 = cal.a, b1 = cal.b;
    calSpr = spring(0, d, (x) => {
      if (which !== 'b') cal.a = a1 + x;
      if (which !== 'a') cal.b = b1 + x;
      placeCal();
    }, { response: 0.35, damping, velocity: v0, done: () => { calSpr = null; live(calMsg()); } });
  }
  let dragging: 'a' | 'b' | 'm' | null = null, gx = 0, a0 = 0, b0 = 0;
  cleanups.push(drag(stripBox, {
    start: (p, e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-cal]');
      if (!t || !cal.on) return false;
      stopCal();
      // chwyt z przesunięciem: ramię nie przeskakuje środkiem pod palec
      dragging = (t.dataset.cal as 'a' | 'b' | 'm') ?? null; gx = p.x; a0 = cal.a; b0 = cal.b;
      t.focus({ preventScroll: true });
      return true;
    },
    move: (p) => {
      if (!dragging) return;
      const Wpx = Math.max(1, stripBox.clientWidth);
      const dx = (p.x - gx) / Wpx;
      // poza granicami gumowy opór zamiast twardego stopu
      const g = (v: number) => guma(v * Wpx, CAL_LO * Wpx, CAL_HI * Wpx, Wpx) / Wpx;
      const wGranicach = (v: number) => v >= CAL_LO && v <= CAL_HI;
      if (dragging === 'a') { const r = a0 + dx; cal.a = wGranicach(r) ? kw(r) : g(r); }
      else if (dragging === 'b') { const r = b0 + dx; cal.b = wGranicach(r) ? kw(r) : g(r); }
      else {
        const lo = Math.min(a0, b0), hi = Math.max(a0, b0);
        const d = lo + dx < CAL_LO ? g(lo + dx) - lo : hi + dx > CAL_HI ? g(hi + dx) - hi : kw(dx);
        cal.a = a0 + d; cal.b = b0 + d;
      }
      naKlatke();
    },
    end: (_p, _e, v) => {
      const which = dragging; dragging = null;
      if (!which) return;
      const Wpx = Math.max(1, stripBox.clientWidth), vx = v.x / Wpx;
      if (which === 'm') {
        // rzut pędu: cyrkiel jedzie tam, gdzie zatrzymałby się rzucony, w granicach paska
        const lo = Math.min(cal.a, cal.b), span = Math.abs(cal.b - cal.a);
        const to = clamp(kw(lo + projekcja(v.x) / Wpx), CAL_LO, CAL_HI - span);
        cyrkielDo('m', to - lo, vx, Math.abs(v.x) > 300 ? 0.8 : 1);
      } else {
        const x = cal[which];
        cyrkielDo(which, snap(x) - x, x < CAL_LO || x > CAL_HI ? vx : 0, 1);
      }
    },
  }));
  const calKey = (which: 'a' | 'b' | 'm') => (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    stopCal();
    const dv = (d * (e.shiftKey ? 0.2 : 0.02)) / SEC;
    if (which === 'a') cal.a = snap(cal.a + dv);
    else if (which === 'b') cal.b = snap(cal.b + dv);
    else if (Math.min(cal.a, cal.b) + dv >= CAL_LO && Math.max(cal.a, cal.b) + dv <= CAL_HI) { cal.a = snap(cal.a + dv); cal.b = snap(cal.b + dv); }
    placeCal();
    live(calMsg());
  };
  legA.addEventListener('keydown', calKey('a'));
  legB.addEventListener('keydown', calKey('b'));
  legM.addEventListener('keydown', calKey('m'));

  function setMode(md: 'play' | 'task') {
    mode = md; modeChips.set(md);
    info.hidden = md !== 'play';
    ex.el.hidden = md !== 'task';
    scenChips.el.hidden = md !== 'play';
    syncSub();
    if (md === 'task') ex.start();
    else { reveal = true; legend.hidden = false; w = { ...WARIANT0 }; setScenario(tryb, w, true); }
  }

  placeCal();
  setMode(mode);

  return () => {
    stopOff(); stopCal();
    cleanups.forEach((fn) => fn());
    mon.destroy(); lad.destroy();
    host.replaceChildren();
  };
}

function icon(kind: 'dot' | 'x' | 'ring' | 'esc'): SVGSVGElement {
  const svg = s('svg', { viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true' });
  if (kind === 'dot') s('circle', { cx: 6, cy: 6, r: 4, fill: C.puls }, svg);
  else if (kind === 'ring') s('circle', { cx: 6, cy: 6, r: 4, fill: 'none', stroke: C.txt2, 'stroke-width': 1.5 }, svg);
  else if (kind === 'x') {
    s('circle', { cx: 6, cy: 6, r: 4.5, fill: 'none', stroke: C.alarm, 'stroke-width': 1.4 }, svg);
    s('path', { d: 'M3.5 3.5L8.5 8.5M8.5 3.5L3.5 8.5', stroke: C.alarm, 'stroke-width': 1.4 }, svg);
  } else {
    s('circle', { cx: 4, cy: 4, r: 2.5, fill: C.txt }, svg);
    s('path', { d: 'M4 4L9 11', stroke: C.txt, 'stroke-width': 1.5 }, svg);
  }
  return svg;
}

