/**
 * Kompas osi — układ heksaksjalny z wektorem, sześć odprowadzeń kończynowych liczonych na żywo.
 * Wykłady: S1_01 (odprowadzenia kończynowe), S1_03 (oś), S3_02 (przerost PK), S4_05 (bloki wiązek).
 *
 * Opcje: start=<stopnie> (np. -60), tryb=cwiczenie.
 */
import {
  C, TRYB_SPRAWDZ, TRYB_UCZ, chips, deg, drag, exercise, fmtDeg, h, normDeg, rad, reducedMotion, s, setA, shell, spring,
  type Spring, type WstawkaOpts,
} from './core/ui.js';
import { LEADS, LIMB, axisCategory, beat, frontalAxis, qrsNet, volt, type Beat, type LeadName, type V3 } from './core/model.js';
import { OBRAZY } from './core/obrazy.js';
import { dzwiekDla } from './core/dzwiek.js';

const R = 132, VL = 112;
const P = (d: number, r: number): [number, number] => [r * Math.cos(rad(d)), r * Math.sin(rad(d))];
/** Napisy na kole: 14 jednostek viewBox 384, czyli ≥ 12 px przy kole szerokim na 330 px. */
const FS = 14;

let styled = false;
function localStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.setAttribute('data-hw-kompas', '');
  st.textContent = `
.hw-ko-panel{transition:transform .12s var(--hw-ease),border-color .2s}
.hw-ko-panel:active{transform:scale(.97)}
.hw-ko-knob{transform-box:fill-box;transform-origin:center;transition:transform .15s var(--hw-ease)}
.hw-ko-grab .hw-ko-knob{transform:scale(1.15)}
.hw-ko-grab{cursor:grabbing}
.hw .hw-ko-presets .hw-chip--sm{min-height:44px}
`;
  document.head.appendChild(st);
}

/** Przenikanie do nowej treści: od bieżącego krycia, gdy poprzednie jeszcze trwa; niczego nie blokuje. */
function przenikanie(el: HTMLElement): void {
  if (reducedMotion() || typeof el.animate !== 'function') return;
  const trwa = el.getAnimations?.() ?? [];
  const od = trwa.length ? Number(getComputedStyle(el).opacity) || 0.3 : 0.3;
  trwa.forEach((a) => a.cancel());
  el.animate([{ opacity: od }, { opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)' });
}

export function mountKompasOsi(host: HTMLElement, opts: WstawkaOpts): () => void {
  const { body, live } = shell(host, {
    label: 'Wstawka · oś elektryczna',
    title: 'Obróć wektor osi, a sześć odprowadzeń przeliczy się samo',
    intro: 'Każdy zespół QRS to rzut wektora pobudzenia na oś odprowadzenia. Przeciągnij strzałkę albo wybierz odprowadzenie, żeby zobaczyć jego rzut.',
  });
  localStyle();

  let theta = Number.isFinite(Number(opts.start)) && opts.start !== undefined ? normDeg(Number(opts.start)) : 60;
  let sel: LeadName = 'II';
  let mode: 'play' | 'task' = opts.tryb === 'cwiczenie' ? 'task' : 'play';
  let target: number | null = null;
  let locked = false;
  let ruszony = false; // ćwiczenie: kursant już ustawił wektor w tej rundzie
  type Morf = 'norma' | 'lafb';
  let morf: Morf = 'norma';
  const cleanups: Array<() => void> = [];
  /** Kąt pokazywany i oceniany: całe stopnie (−30° to jeszcze oś prawidłowa, więc kategoria idzie z tej samej liczby co napis). */
  const kat = () => Math.round(normDeg(theta));

  /* ruch wektora: sprężyna (przykłady, rzut po puszczeniu), przerywalna chwytem */
  let sp: Spring | null = null;
  const stopSp = () => { sp?.stop(); sp = null; };
  let raf = 0;
  const draw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawNow(); }); };

  /* pasek trybów */
  const modeChips = chips([{ v: 'play', label: TRYB_UCZ }, { v: 'task', label: TRYB_SPRAWDZ }] as const, mode, (v) => setMode(v), { label: 'Tryb' });
  // Przykłady: zwykłe kąty obracają prawidłowy zespół, a „blok przedniej wiązki lewej odnogi” bierze
  // prawdziwą morfologię z modelu (qR w aVL i rS w II, III, aVF). Najpierw obrót, potem przenikanie zespołów.
  const presets = chips([
    { v: '60', label: 'Prawidłowa +60°' }, { v: 'lafb', label: 'Blok przedniej wiązki lewej odnogi' },
    { v: '120', label: 'Odchylenie w prawo +120°' }, { v: '-150', label: 'Skrajna −150°' },
  ] as const, '' as never, (v) => {
    stopSp();
    const nowaMorf: Morf = v === 'lafb' ? 'lafb' : 'norma';
    const cel = nowaMorf === 'norma' ? Number(v) : frontalAxis(beat({ qrs: nowaMorf }));
    setMorf('norma');
    // `done` nie przychodzi po `stop()`, więc przerwany obrót nie zmieni już morfologii
    sp = spring(theta, theta + normDeg(cel - theta), (x) => { theta = normDeg(x); drawNow(); }, {
      response: 0.4, damping: 1,
      done: () => { theta = normDeg(cel); setMorf(nowaMorf); drawNow(); },
    });
  }, { label: 'Przykłady', small: true });
  presets.el.classList.add('hw-ko-presets');
  presets.set('' as never);
  body.append(h('div', { class: 'hw-bar' }, modeChips.el, presets.el));

  /* koło */
  const svg = s('svg', { viewBox: '-192 -192 384 384', class: 'hw-svg', style: 'touch-action:none', role: 'group', 'aria-label': 'Układ heksaksjalny z wektorem osi elektrycznej serca' });
  // serce marki w środku koła (jak płaszczyzna czołowa w GFX-0039): wektor wychodzi z serca
  const HS = 210;
  s('image', { href: OBRAZY.sercePrzod.url, x: -HS / 2 - 4, y: -HS / 2 + 6, width: HS, height: HS, class: 'hw-raster', opacity: 0.6, 'aria-hidden': 'true' }, svg);
  const deko = s('g', { 'aria-hidden': 'true' }, svg);
  const [ax1, ay1] = P(-30, R), [ax2, ay2] = P(90, R);
  s('path', { d: `M0 0L${ax1} ${ay1}A${R} ${R} 0 0 1 ${ax2} ${ay2}Z`, fill: 'rgba(62,230,168,.06)' }, deko);
  s('circle', { r: R, fill: 'none', stroke: C.line2 }, deko);
  // nazwy kategorii jak w wykładzie („oś prawidłowa”, odchylenie w lewo / w prawo, oś skrajna), w środku koła
  for (const [a, r, t] of [[30, 88, 'PRAWIDŁOWA'], [-60, 104, 'W LEWO'], [135, 104, 'W PRAWO'], [-135, 104, 'SKRAJNA']] as const) {
    const [x, y] = P(a, r);
    s('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: a === 30 ? C.puls : C.txt3, 'font-size': FS, 'letter-spacing': '.03em', text: t }, deko);
  }
  const axes = new Map<LeadName, SVGLineElement>();
  for (const n of LIMB) {
    const a = LEADS[n].angle;
    const [x1, y1] = P(a, R), [x2, y2] = P(a + 180, R);
    s('line', { x1: 0, y1: 0, x2, y2, stroke: C.line2, 'stroke-dasharray': '3 4' }, deko);
    axes.set(n, s('line', { x1: 0, y1: 0, x2: x1, y2: y1, stroke: C.txt3, 'stroke-width': 1.2 }, deko));
  }
  for (let a = -150; a <= 180; a += 30) {
    const [a1, b1] = P(a, R), [a2, b2] = P(a, R - 6);
    s('line', { x1: a1, y1: b1, x2: a2, y2: b2, stroke: C.txt3 }, deko);
    const lead = LIMB.find((n) => normDeg(LEADS[n].angle) === normDeg(a));
    if (lead) {
      // kamera na dodatnim biegunie, obiektywem do środka (na rastrze obiektyw jest po lewej, czyli w stronę 180°)
      const [cx, cy] = P(a, R + 13);
      const KW = 34, KH = KW * OBRAZY.kamera.h / OBRAZY.kamera.w;
      const g = s('g', { transform: `translate(${cx} ${cy}) rotate(${a})` }, deko);
      s('image', { href: OBRAZY.kamera.url, x: -KW / 2, y: -KH / 2, width: KW, height: KH, class: 'hw-raster' }, g);
    }
    const [tx, ty] = P(a, lead ? 166 : 154);
    if (lead) {
      s('text', { x: tx, y: ty - 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: C.txt, 'font-size': 16, 'font-weight': 500, style: `font-family:${C.fontDisplay}`, text: lead }, deko);
      s('text', { x: tx, y: ty + 15, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: C.txt3, 'font-size': FS, text: fmtDeg(a) }, deko);
    } else {
      s('text', { x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: C.txt3, 'font-size': FS, text: a === 180 ? '±180°' : fmtDeg(a) }, deko);
    }
  }
  const dropL = s('line', { stroke: C.txt3, 'stroke-dasharray': '2 3', 'aria-hidden': 'true' }, svg);
  const proj = s('line', { 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.9, 'aria-hidden': 'true' }, svg);
  const ghost = s('line', { x1: 0, y1: 0, stroke: C.txt2, 'stroke-width': 2, 'stroke-dasharray': '5 5', visibility: 'hidden', 'aria-hidden': 'true' }, svg);
  const ghostT = s('text', { fill: C.txt2, 'font-size': FS, 'text-anchor': 'middle', visibility: 'hidden', 'aria-hidden': 'true', text: 'oś z zapisu' }, svg);
  const vec = s('line', { x1: 0, y1: 0, stroke: C.txt, 'stroke-width': 3, 'stroke-linecap': 'round', 'aria-hidden': 'true' }, svg);
  const head = s('path', { fill: C.txt, 'aria-hidden': 'true' }, svg);
  s('circle', { r: 4, fill: C.txt, 'aria-hidden': 'true' }, svg);
  const handle = s('g', { tabindex: 0, role: 'slider', 'aria-label': 'Kierunek osi elektrycznej', 'aria-valuemin': -180, 'aria-valuemax': 180, style: 'cursor:grab' }, svg);
  const knob = s('g', { class: 'hw-ko-knob' }, handle);
  s('circle', { r: 20, fill: 'rgba(62,230,168,.10)', stroke: C.puls, 'stroke-width': 1.5 }, knob);
  s('circle', { r: 6, fill: C.puls }, knob);

  const wheel = h('div', {}, svg, h('p', { class: 'hw-note', style: 'text-align:center;margin-top:4px', text: 'Widok od przodu: prawa strona pacjenta jest po lewej' }));

  /* panele odprowadzeń */
  const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px' });
  const panels = (['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] as const).map((n) => {
    const svgL = s('svg', { viewBox: '0 -12 18 24', class: 'hw-svg', 'aria-hidden': 'true' });
    s('rect', { x: 0, y: -12, width: 18, height: 24, fill: C.screen }, svgL);
    for (let x = 0; x <= 18; x++) s('line', { x1: x, y1: -12, x2: x, y2: 12, stroke: x % 5 === 0 ? C.gridMajor : C.gridMinor, 'stroke-width': x % 5 === 0 ? 0.14 : 0.07 }, svgL);
    for (let y = -12; y <= 12; y++) s('line', { x1: 0, y1: y, x2: 18, y2: y, stroke: y % 5 === 0 ? C.gridMajor : C.gridMinor, 'stroke-width': y % 5 === 0 ? 0.14 : 0.07 }, svgL);
    const path = s('path', { fill: 'none', stroke: C.puls, 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, svgL);
    const sign = h('span', { class: 'hw-note' });
    const b = h('button', { type: 'button', class: 'hw-panel hw-ko-panel', style: 'display:grid;gap:4px;padding:7px;cursor:pointer;text-align:left;color:inherit', 'aria-pressed': n === sel ? 'true' : 'false', 'aria-label': `Odprowadzenie ${n}` },
      h('span', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:6px' }, h('span', { style: `font:500 15px/1 ${C.fontDisplay}`, text: n }), sign),
      svgL);
    b.addEventListener('click', () => { sel = n; drawNow(); });
    grid.append(b);
    return { n, b, path, sign };
  });
  const cap = h('div', { class: 'hw-note', style: 'display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px;margin-top:6px' },
    h('span', { text: '25 mm/s · 10 mm/mV' }), h('span', { text: 'Zielony podpis „QRS ≈ 0” wskazuje odprowadzenie najbardziej równofazowe.' }));

  /* odczyt i ćwiczenie */
  const big = h('span', { class: 'hw-big' });
  const cat = h('span', { class: 'hw-cat' });
  const tags = h('div', { class: 'hw-tags' });
  const why = h('p', { class: 'hw-why' });
  const read = h('div', { class: 'hw-read' }, h('div', { class: 'hw-row', style: 'align-items:baseline;gap:6px 16px' }, big, cat), tags, why);

  /**
   * Pobudzenie dla kąta `a`. Pętla czołowa ma szerokość: siły główne idą w dwóch fazach (−35° i +35° od osi,
   * zgodnie z ruchem wskazówek zegara), więc odprowadzenie prostopadłe ma R i podobne S, a nie płaską kreskę
   * (S1_03: „Równofazowy nie znaczy przy tym płaski”). Oś netto zostaje równa `a`.
   */
  const bt = (a: number, m: Morf = morf): Beat => {
    if (m !== 'norma') return beat({ qrs: m });
    const b = beat({ axis: a });
    const v = (d: number, amp: number, z: number): V3 => [amp * Math.cos(rad(d)), amp * Math.sin(rad(d)), z];
    // Kierunek pętli: przy osi pionowej zgodnie z ruchem wskazówek zegara, przy poziomej przeciwnie
    // (stąd qR w I i aVL oraz rS w odprowadzeniach dolnych przy osi około 0°); przejście płynne między 0° a +60°.
    const x = normDeg(a);
    const roz = x > -90 && x < 90 ? 28 * Math.max(-1, Math.min(1, (x - 30) / 30)) : 28;
    b.qrs = [
      { t: 0.012, w: 0.007, v: v(a + (roz >= 0 ? 150 : -150), 0.11, 0.1) },
      { t: 0.036, w: 0.011, v: v(a - roz, 0.82, -0.2) },
      { t: 0.056, w: 0.011, v: v(a + roz, 0.82, -0.2) },
      { t: 0.078, w: 0.008, v: v(a + 180, 0.12, -0.1) },
    ];
    return b;
  };

  const pathFor = (b: Beat, n: LeadName) => {
    let d = '';
    for (let t = -0.18; t <= 0.54 + 1e-9; t += 0.003) {
      const x = (t + 0.18) * 25, y = -volt(b, n, t) * 10;
      d += (d ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    return d;
  };
  const maxNet = new Map<LeadName, number>();
  const signOfB = (b: Beat, n: LeadName) => {
    let max = maxNet.get(n);
    if (max === undefined) { max = qrsNet(bt(LEADS[n].angle, 'norma'), n); maxNet.set(n, max); }
    const v = qrsNet(b, n);
    if (Math.abs(v) / max < 0.14) return '≈ 0';
    return v > 0 ? '+' : '−';
  };
  const signOf = (a: number, n: LeadName) => signOfB(bt(a), n);
  const isoLeadB = (b: Beat): LeadName => {
    let best: LeadName = 'I', bv = Infinity;
    for (const n of LIMB) { const v = Math.abs(qrsNet(b, n)); if (v < bv) { bv = v; best = n; } }
    return best;
  };
  const isoLead = (a: number): LeadName => isoLeadB(bt(a));
  const reasoning = (a: number) => {
    const iso = isoLead(a), ia = LEADS[iso].angle;
    const c1 = normDeg(ia + 90), c2 = normDeg(ia - 90);
    const pick = Math.abs(normDeg(a - c1)) <= Math.abs(normDeg(a - c2)) ? c1 : c2;
    const other = pick === c1 ? c2 : c1;
    let dec: LeadName = 'I', dv = -1;
    for (const n of LIMB) { const v = Math.abs(Math.cos(rad(pick - LEADS[n].angle))); if (v > dv) { dv = v; dec = n; } }
    const pos = qrsNet(bt(a), dec) > 0;
    const kat = axisCategory(a), katPick = axisCategory(pick);
    let s = `Najbardziej równofazowe jest ${iso} (${fmtDeg(ia)}), więc oś leży blisko ${fmtDeg(pick)} albo ${fmtDeg(other)}. `
      + `QRS jest ${pos ? 'dodatni' : 'ujemny'} w ${dec}, dlatego wybierasz <b>około ${fmtDeg(pick)}</b>.`;
    if (kat.label === katPick.label) s += ` To ${kat.label}.`;
    else {
      // granica najbliższa osi i odprowadzenie do niej prostopadłe, którego znak rozstrzyga
      const GR: Array<{ g: number; n: LeadName; plus: string; minus: string }> = [
        { g: -30, n: 'II', plus: 'jeszcze norma', minus: 'odchylenie w lewo' },
        { g: 90, n: 'I', plus: 'jeszcze norma', minus: 'odchylenie w prawo' },
        { g: -90, n: 'I', plus: 'odchylenie w lewo', minus: 'oś skrajna' },
        { g: 180, n: 'aVF', plus: 'odchylenie w prawo', minus: 'oś skrajna' },
      ];
      const gr = GR.reduce((m, q) => (Math.abs(normDeg(a - q.g)) < Math.abs(normDeg(a - m.g)) ? q : m));
      const dod = qrsNet(bt(a), gr.n) > 0;
      s += ` Oś leży tuż przy granicy ${fmtDeg(gr.g)}, a dokładny kąt (${fmtDeg(a)}) to ${kat.label}. Rozstrzyga ${gr.n}: QRS ${dod ? 'dodatni' : 'ujemny'}, więc ${dod ? gr.plus : gr.minus}.`;
    }
    if (morf === 'lafb') s += ' Mały q i wysoki R w aVL oraz małe r i głębokie S w II, III i aVF to obraz bloku przedniej wiązki lewej odnogi.';
    return s;
  };

  /** Zmiana morfologii (norma ↔ blok przedniej wiązki): stany dyskretne, zespoły przenikają się zamiast morfingu. */
  function setMorf(m: Morf) {
    if (m === morf) return;
    morf = m;
    drawNow();
    przenikanie(grid);
  }

  const rnd = (a: number, b: number) => a + 5 * Math.floor(Math.random() * ((b - a) / 5 + 1));
  const ustawB = h('b');
  const ex = exercise<number>({
    rounds: 5,
    make: (i) => {
      const kinds = ['n', 'l', 'r', 'n', 'x'];
      const k = kinds[(i + Math.floor(Math.random() * 5)) % 5];
      // bez kątów w odległości do 15° od granic −30°, +90°, −90° i ±180° (tam rozstrzyga dopiero II albo dokładny pomiar)
      return k === 'n' ? rnd(-10, 70) : k === 'l' ? rnd(-70, -50) : k === 'r' ? rnd(110, 160) : rnd(-160, -110);
    },
    show: (t) => {
      stopSp(); morf = 'norma'; target = t; locked = false; ruszony = false; theta = 0; tikTheta = null;
      setA(ghost, { visibility: 'hidden' }); setA(ghostT, { visibility: 'hidden' }); drawNow();
    },
    prompt: 'Odczytaj oś z sześciu zespołów QRS. Ustaw wektor tak, żeby do nich pasował, i naciśnij „Sprawdź”.',
    gotowe: () => ruszony,
    check: (t) => {
      locked = true; stopSp();
      const a = kat();
      const err = Math.abs(normDeg(a - t));
      const taSama = axisCategory(a).label === axisCategory(t).label;
      const [gx, gy] = P(t, VL), [lx, ly] = P(t, VL + 22);
      setA(ghost, { x2: gx, y2: gy, visibility: 'visible' }); setA(ghostT, { x: lx, y: ly, visibility: 'visible' });
      drawNow();
      const ok = err <= 15 && taSama;
      return {
        ok, near: !ok && err <= 30,
        prawidlowo: ok ? undefined : fmtDeg(t),
        szczegol: ok ? `Oś z zapisu ${fmtDeg(t)}, twoje ustawienie ${fmtDeg(a)}.` : `Twoje ustawienie ${fmtDeg(a)}.`,
        why: (err <= 30 && !taSama ? `Kąt jest blisko, ale wypada już w innej kategorii: ${axisCategory(t).label}. ` : '') + reasoning(t),
      };
    },
    live,
  });
  ex.miejsce.append(h('div', { class: 'hw-tags' }, h('span', { class: 'hw-tag' }, 'Twoje ustawienie ', ustawB)));
  /** Kursant ruszył wektor: w ćwiczeniu odblokuj „Sprawdź”. */
  /* dźwięk: trzask przy każdym odprowadzeniu kończynowym (co 30°), mocniejszy przy I, II i aVF (0°, +60°, +90°) */
  const snd = dzwiekDla(body);
  let tikTheta: number | null = null;
  const tikKompas = () => {
    const p = tikTheta; tikTheta = theta;
    if (p === null) return;
    const d = normDeg(theta - p);
    if (!d || Math.abs(d) > 120) return;
    const lo = Math.min(p, p + d), hi = Math.max(p, p + d);
    let ile = 0, mocny = false;
    for (let k = Math.ceil(lo / 30) * 30; k <= hi; k += 30) {
      if (k === p) continue;
      ile++;
      if ([0, 60, 90].includes(normDeg(k))) mocny = true;
    }
    if (ile) snd.tik(mocny);
  };

  const zmienil = () => { if (mode === 'task' && !ruszony) { ruszony = true; ex.odswiez(); } };

  const right = h('div', {}, grid, cap, read, ex.el);
  body.append(h('div', { class: 'hw-2col hw-2col--wide-l', style: 'align-items:start' }, wheel, right));

  function drawNow() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    tikKompas();
    const a = kat();
    const shown = mode === 'task' && target !== null ? target : theta;
    const [vx, vy] = P(theta, VL);
    setA(vec, { x2: vx, y2: vy });
    const [hx, hy] = P(theta, VL + 12), [l1x, l1y] = P(theta + 90, 7), [l2x, l2y] = P(theta - 90, 7), [bx, by] = P(theta, VL - 4);
    setA(head, { d: `M${hx} ${hy}L${bx + l1x} ${by + l1y}L${bx + l2x} ${by + l2y}Z` });
    setA(handle, { transform: `translate(${P(theta, VL - 10).join(' ')})`, 'aria-valuenow': a, 'aria-valuetext': `${fmtDeg(a)}, ${axisCategory(a).label}` });
    const La = LEADS[sel].angle, p = VL * Math.cos(rad(theta - La)), [px, py] = P(La, p);
    setA(proj, { x1: 0, y1: 0, x2: px, y2: py, stroke: p >= 0 ? C.puls : C.txt2 });
    setA(dropL, { x1: vx, y1: vy, x2: px, y2: py });
    for (const [n, l] of axes) setA(l, { stroke: n === sel ? C.puls : C.txt3, 'stroke-width': n === sel ? 2 : 1.2 });
    const b = bt(shown);
    const iso = isoLeadB(b);
    const hide = mode === 'task' && !locked;
    for (const pn of panels) {
      pn.path.setAttribute('d', pathFor(b, pn.n));
      pn.b.setAttribute('aria-pressed', pn.n === sel ? 'true' : 'false');
      pn.b.style.borderColor = pn.n === sel ? C.puls : '';
      const zn = pn.n === iso ? '≈ 0' : signOfB(b, pn.n);
      pn.sign.textContent = hide ? '' : `QRS ${zn}`;
      pn.sign.style.color = !hide && pn.n === iso ? C.puls : '';
      const slowo = zn === '+' ? 'dodatni' : zn === '−' ? 'ujemny' : 'równofazowy';
      pn.b.setAttribute('aria-label', hide ? `Odprowadzenie ${pn.n}` : `Odprowadzenie ${pn.n}, QRS ${slowo}`);
    }
    ustawB.textContent = fmtDeg(a);
    if (mode === 'play') {
      const c = axisCategory(a);
      big.textContent = fmtDeg(a);
      cat.textContent = c.label; cat.className = 'hw-cat ' + (c.ok ? 'hw-ok' : 'hw-bad');
      tags.innerHTML = (['I', 'aVF', 'II'] as const).map((n) => `<span class="hw-tag">${n} <b>${signOf(a, n)}</b></span>`).join('')
        + `<span class="hw-tag">rzut na ${sel} <b>${Math.round(Math.cos(rad(theta - La)) * 100)}%</b></span>`;
      why.innerHTML = reasoning(a);
      live(`Oś ${fmtDeg(a)}, ${c.label}.`);
    }
  }

  function setMode(m: 'play' | 'task') {
    stopSp();
    mode = m; modeChips.set(m);
    read.hidden = m !== 'play'; ex.el.hidden = m !== 'task';
    presets.el.hidden = m !== 'play';
    setA(ghost, { visibility: 'hidden' }); setA(ghostT, { visibility: 'hidden' });
    if (m === 'task') ex.start(); else { target = null; locked = false; drawNow(); }
  }

  /* gest: obrót wektora z miejscem chwytu, pęd po puszczeniu, zatrzask na znacznikach co 30° (tylko „Ucz się”) */
  const ang = (p: { x: number; y: number }) => deg(Math.atan2(p.y, p.x));
  let off = 0, palec = 0, ruchT = 0;
  let dociag: Spring | null = null; // chwyt daleko od wektora: wektor dojeżdża pod palec sprężyną
  const stopDociag = () => { dociag?.stop(); dociag = null; };
  cleanups.push(drag(svg, {
    start: (p) => {
      if (locked) return false;
      if (Math.hypot(p.x, p.y) < 36) return false; // przy środku kąt palca jest niestabilny
      stopSp(); stopDociag();
      palec = ang(p);
      off = normDeg(theta - palec);
      if (Math.abs(off) > 30) {
        // chwyt z dala od strzałki: wektor płynnie dojeżdża pod palec, dalej podąża za nim
        dociag = spring(off, 0, (x) => { off = x; theta = normDeg(palec + off); drawNow(); }, { response: 0.3, damping: 1 });
      }
      setMorf('norma'); presets.set('' as never);
      svg.classList.add('hw-ko-grab');
      handle.focus({ preventScroll: true });
      zmienil();
    },
    move: (p, e) => { palec = ang(p); theta = normDeg(palec + off); ruchT = e.timeStamp; draw(); },
    end: (p, e, v) => {
      svg.classList.remove('hw-ko-grab');
      const r2 = p.x * p.x + p.y * p.y;
      // prędkość kątowa (°/s), ograniczona: wybieg najwyżej o ~110°, żeby szybkie puszczenie nie kręciło kołem
      // palec stanął przed puszczeniem (> 60 ms bez ruchu): bez wybiegu
      const stal = e.timeStamp - ruchT > 60;
      const w = stal ? 0 : Math.max(-720, Math.min(720, r2 > 1 ? deg((p.x * v.y - p.y * v.x) / r2) : 0));
      const rzut = theta + w * 0.15;
      const znak = Math.round(rzut / 30) * 30;
      const zatrzask = mode === 'play' && Math.abs(normDeg(rzut - znak)) <= 6;
      if (!zatrzask && Math.abs(w) < 40) { draw(); return; } // spokojne puszczenie: wektor zostaje (dociąg kończy się sam)
      stopDociag();
      const cel = zatrzask ? theta + normDeg(znak - theta) : rzut;
      sp = spring(theta, cel, (x) => { theta = normDeg(x); drawNow(); }, { response: 0.35, damping: 1, velocity: w });
    },
  }));
  handle.addEventListener('keydown', (e) => {
    if (locked) return;
    const step = e.shiftKey ? 15 : 5;
    let d = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step;
    else return;
    e.preventDefault();
    stopSp(); stopDociag();
    setMorf('norma'); presets.set('' as never);
    theta = normDeg(kat() + d);
    zmienil();
    drawNow();
  });

  setMode(mode);
  return () => { stopSp(); stopDociag(); if (raf) cancelAnimationFrame(raf); cleanups.forEach((f) => f()); host.replaceChildren(); };
}
