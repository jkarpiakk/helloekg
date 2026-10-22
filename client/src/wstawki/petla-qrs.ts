/**
 * Pętla QRS — przekrój poprzeczny klatki (raster GPT, widok od stóp), wektor pobudzenia komór zatacza pętlę, a sześć kamer V1–V6
 * rysuje jej rzut. Skąd rS w V1 i qR w V6, i co zmienia blok odnogi, przerost i zawał ściany tylnej.
 * Wykłady: S2_03 (progresja R, przegroda), S4_05 (RBBB, LBBB), S3_01 (LVH), S3_02 (RVH, wysoki R w V1),
 * S3_05 (ściana tylna), S1_01 (płaszczyzna pozioma, papier).
 *
 * Opcje: wariant=normal|rbbb|lbbb|lvh|rvh|posterior, tryb=progresja|cwiczenie, kamera=V1…V6.
 */
import {
  C, TRYB_SPRAWDZ, TRYB_UCZ, chips, clamp, drag, exercise, guma, h, options, projekcja, reducedMotion, loop, rng, s, setA, shell, slider, spring, surface, trace,
  type Spring, type Surface, type WstawkaOpts,
} from './core/ui.js';
import { LEADS } from './core/model.js';
import { OBRAZY, svgNaRastrze } from './core/obrazy.js';
import {
  ELEKTRODY_PX, JAK_ODROZNIC, KAMERY, KOLEJNOSC, LK_PX, OPIS_KAMERY, PK_PX, PRZEGRODA_PX, SRODEK_PX, naEkran, osKamery, rzut, PROGRESJA_MM, T0, T1, WARIANTY, WYJASNIENIE, WYSOKIE_R,
  kod, loopXZ, ocena, v, zadania, type Kamera, type WariantId, type Zadanie,
} from './petla-qrs.dane.js';

type Mode = 'zobacz' | 'progresja' | 'cwiczenie';

/** Prędkość odtwarzania: ile sekund modelu na sekundę ekranu (zwolnione ok. 22 razy). */
const SPEED = 0.045;
const HOLD = 1.1;
/** Przygaszenie pętli i śladu przed ponownym startem (ostatnie 0,25 s przerwy). */
const ZANIK = 0.25;
const FADE_MS = 500;

/** Największa długość wektora we wszystkich wariantach (wspólna skala pętli). */
const MAXMAG = (() => {
  let m = 0;
  for (const id of KOLEJNOSC) for (let t = T0; t <= T1; t += 0.001) { const [x, z] = loopXZ(id, t); m = Math.max(m, Math.hypot(x, z)); }
  return m;
})();

/** Zakres napięć [mV] w danym odprowadzeniu we wszystkich wariantach (stała wysokość wiersza). */
const RANGE = new Map<Kamera, { hi: number; lo: number }>();
for (const l of KAMERY) {
  let hi = 0, lo = 0;
  for (const id of KOLEJNOSC) for (let t = T0; t <= T1; t += 0.001) { const x = v(id, l, t); hi = Math.max(hi, x); lo = Math.min(lo, x); }
  RANGE.set(l, { hi, lo });
}

export function mountPetlaQrs(host: HTMLElement, opts: WstawkaOpts): () => void {
  const { body, live } = shell(host, {
    label: 'Wstawka · pętla QRS',
    title: 'Skąd kształt zespołu QRS w V1 i V6',
    intro: 'Wektor pobudzenia komór zatacza pętlę w przekroju klatki, a każda elektroda przedsercowa jest kamerą, która rysuje rzut tej pętli. Zmień obraz i porównaj, jak zmieniają się V1 i V6.',
  });
  const cleanups: Array<() => void> = [];
  const still = reducedMotion();

  const isW = (x: string | undefined): x is WariantId => !!x && (KOLEJNOSC as readonly string[]).includes(x);
  const isK = (x: string | undefined): x is Kamera => !!x && (KAMERY as readonly string[]).includes(x);
  let wariant: WariantId = isW(opts.wariant) ? opts.wariant : 'normal';
  let kamera: Kamera = isK(opts.kamera) ? opts.kamera : 'V1';
  let mode: Mode = opts.tryb === 'cwiczenie' ? 'cwiczenie' : opts.tryb === 'progresja' ? 'progresja' : 'zobacz';
  let t = still ? T1 : T0;
  let playing = !still;
  let hold = 0;
  /** Krycie pętli i śladu przy ponownym starcie odtwarzania (1 = pełne). */
  let zanik = 1;
  /** Przenikanie: poprzedni wariant i postęp 0..1. */
  let fade: { from: WariantId; k: number; t0: number } | null = null;
  /** Ćwiczenie: co jest ukryte przed odpowiedzią. */
  let hideLoop = false, hideTraces = false;
  /** Ćwiczenie: odpowiedź sprawdzona (cechy wariantu i nazwy faz widoczne dopiero wtedy). */
  let odkryte = false;
  /** Rysowanie dopiero po zbudowaniu całego układu. */
  let ready = false;

  /* ─────────── sterowanie ─────────── */

  const modeChips = chips([
    { v: 'zobacz', label: TRYB_UCZ }, { v: 'progresja', label: 'Progresja R' }, { v: 'cwiczenie', label: TRYB_SPRAWDZ },
  ] as const, mode, (m) => setMode(m), { label: 'Tryb' });
  const varChips = chips(KOLEJNOSC.map((id) => ({ v: id, label: WARIANTY[id].chip, title: WARIANTY[id].nazwa })), wariant, (id) => setWariant(id), { label: 'Obraz', small: true });
  const camChips = chips(KAMERY.map((k) => ({ v: k, label: k })), kamera, (k) => setKamera(k), { label: 'Wybrana kamera', small: true });

  const playBtn = h('button', { class: 'hw-chip hw-chip--sm', type: 'button' });
  const paintPlay = () => { playBtn.textContent = playing ? 'Pauza' : 'Graj'; playBtn.setAttribute('aria-label', playing ? 'Zatrzymaj pętlę' : 'Odtwórz pętlę'); };
  playBtn.addEventListener('click', () => {
    stopT();
    playing = !playing; zanik = 1;
    if (playing && t >= T1 - 1e-6) { t = T0; hold = 0; }
    paintPlay(); syncSlider(); draw();
  });
  paintPlay();

  const phaseLabel = (tt: number): string => {
    const w = WARIANTY[wariant];
    if (tt < 0) return 'przed QRS';
    // w ćwiczeniu przed odpowiedzią opis neutralny: nazwy faz zdradzałyby przyczynę
    if (mode === 'cwiczenie' && !odkryte) return `QRS, ${Math.round(tt * 1000)} ms`;
    if (tt > w.j) return 'po QRS';
    return w.fazy.find((f) => tt <= f.until)?.label ?? 'po QRS';
  };
  const SL = 1000;
  const tSlider = slider({
    label: 'Kursor czasu', min: 0, max: SL, step: 1, value: Math.round(((t - T0) / (T1 - T0)) * SL),
    fmt: (x) => phaseLabel(T0 + (x / SL) * (T1 - T0)),
    onInput: (x) => { stopT(); playing = false; zanik = 1; paintPlay(); t = T0 + (x / SL) * (T1 - T0); draw(); },
  });
  const syncSlider = () => tSlider.set(Math.round((clamp(t, T0, T1) - T0) / (T1 - T0) * SL));
  /** Sprężyna kursora czasu po puszczeniu albo stuknięciu w zapis (przerywalna). */
  let tSpring: Spring | null = null;
  const stopT = () => { tSpring?.stop(); tSpring = null; };

  const camLabel = h('span', { class: 'hw-note', text: 'Trzecia kamera:' });
  const camRow = h('div', { class: 'hw-row', style: 'gap:6px 12px' }, camLabel, camChips.el);
  body.append(h('div', { class: 'hw-bar' }, modeChips.el), varChips.el);

  /* ─────────── przekrój (raster GPT, widok od stóp) ─────────── */

  const NS = 'http://www.w3.org/2000/svg';
  const { svg: secSvg, nakladka } = svgNaRastrze('przekrojKlatki', { label: 'Przekrój poprzeczny klatki widziany od stóp, z kamerami V1-V6 i pętlą QRS', crop: { x: -10, y: -70, w: 1290, h: 930 } });
  const secBox = h('div', { class: 'hw-screen' }, secSvg);
  const SEC_CAP = 'Przekrój od stóp: mostek u góry, P i L to prawa i lewa strona pacjenta.';
  const secCap = h('p', { class: 'hw-note', style: 'margin-top:6px' });
  const [CX, CY] = SRODEK_PX;
  /** px rastra na jednostkę wektora: najdłuższy wektor (przerost LK) ok. 320 px, prawidłowa pętla ok. 160 px. */
  const K = 320 / MAXMAG;
  const ptsD = (pts: Array<[number, number]>) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');

  // warstwa cech wariantu (pod pętlą): przerost, spóźniona komora, ściana tylna; delikatnie, na rastrze
  const cechy = s('g', {}, nakladka);
  const cechyStare = s('g', {}, nakladka);
  const drawCechy = (g: SVGGElement, id: WariantId) => {
    g.replaceChildren();
    const r = WARIANTY[id].rysunek;
    if (r.lkGruba) s('path', { d: ptsD(LK_PX.obrys), fill: 'none', stroke: C.txt, 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 }, g);
    if (r.pkGruba) s('path', { d: ptsD(PK_PX.obrys), fill: 'none', stroke: C.txt, 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 }, g);
    if (r.blok) s('path', { d: ptsD(r.blok === 'prawa' ? PK_PX.obrys : LK_PX.obrys), fill: 'none', stroke: C.alarm, 'stroke-width': 5, 'stroke-dasharray': '16 12', 'stroke-linecap': 'round' }, g);
    if (r.tylnaZawal) s('path', { d: 'M862 432 Q 830 488 700 500', fill: 'none', stroke: C.alarm, 'stroke-width': 9, 'stroke-linecap': 'round' }, g);
  };

  // kamery na ścianie klatki, obiektywem ku sercu (zasób kamery ma obiektyw po lewej, na 61,5% wysokości)
  const CAM_W = 96, CAM_H = (CAM_W * OBRAZY.kamera.h) / OBRAZY.kamera.w, LENS = 0.615;
  const camEls = new Map<Kamera, { ring: SVGCircleElement; dot: SVGCircleElement; label: SVGTextElement }>();
  /** Kamera pod palcem / kursorem w chwili naciśnięcia (pierścień od razu, wybór po puszczeniu). */
  let pressedCam: Kamera | null = null;
  const camLayer = s('g', {}, nakladka);
  for (const l of KAMERY) {
    const [ex, ey] = ELEKTRODY_PX[l];
    const ang = Math.atan2(CY - ey, CX - ex), deg = (ang * 180) / Math.PI;
    const lx = ex - 14 * Math.cos(ang), ly = ey - 14 * Math.sin(ang);
    const g = s('g', { style: 'cursor:pointer' }, camLayer);
    const left = Math.cos(ang) <= 1e-9;
    const cg = s('g', { transform: `translate(${lx.toFixed(1)} ${ly.toFixed(1)}) rotate(${(left ? deg - 180 : deg).toFixed(1)})` }, g);
    const img = document.createElementNS(NS, 'image');
    img.setAttribute('href', OBRAZY.kamera.url); img.setAttribute('width', String(CAM_W)); img.setAttribute('height', CAM_H.toFixed(1));
    img.setAttribute('y', (-CAM_H * LENS).toFixed(1)); img.setAttribute('class', 'hw-raster');
    if (!left) img.setAttribute('transform', 'scale(-1 1)');
    cg.append(img);
    const ring = s('circle', { cx: ex, cy: ey, r: 17, fill: 'none', 'stroke-width': 4 }, g);
    const dot = s('circle', { cx: ex, cy: ey, r: 8 }, g);
    // podpis: V1-V4 za kamerą (na zewnątrz), V5-V6 nad kamerą, żeby zmieściły się w kadrze
    const side = l === 'V5' || l === 'V6';
    const bx = ex - Math.cos(ang) * (side ? 62 : CAM_W + 40), by = ey - Math.sin(ang) * (side ? 62 : CAM_W + 40);
    // podpis ≥ 12 px przy 375 px (48 j. przy kadrze 1290 j.)
    const label = s('text', { x: bx.toFixed(1), y: (side ? by - 48 : by + 16).toFixed(1), 'text-anchor': 'middle', 'font-size': 48, 'font-weight': 600, text: l }, g);
    // pole trafienia ok. 44 px średnicy przy 375 px
    s('circle', { cx: ex - Math.cos(ang) * 40, cy: ey - Math.sin(ang) * 40, r: 84, fill: 'transparent' }, g);
    g.addEventListener('click', () => { pressedCam = null; if (mode !== 'cwiczenie') setKamera(l); else draw(); });
    g.addEventListener('pointerdown', () => { if (mode !== 'cwiczenie') { pressedCam = l; draw(); } });
    for (const ev of ['pointerleave', 'pointercancel'] as const) g.addEventListener(ev, () => { if (pressedCam === l) { pressedCam = null; draw(); } });
    camEls.set(l, { ring, dot, label });
  }
  for (const [t0, x, y] of [['P', 22, 470], ['L', 1250, 520]] as const) s('text', { x, y, 'text-anchor': 'middle', 'font-size': 46, 'font-weight': 700, fill: C.txt, text: t0 }, nakladka);

  // oś wybranej kamery, przegroda, pętla (dwie warstwy do przenikania), wektor, rzut
  const axisL = s('line', { stroke: C.txt2, 'stroke-width': 2.5, 'stroke-dasharray': '10 10', opacity: 0.7 }, nakladka);
  const septum = s('g', {}, nakladka);
  const septLine = s('line', { 'stroke-width': 7, 'stroke-linecap': 'round' }, septum);
  const septHead = s('path', {}, septum);
  interface LoopEls { g: SVGGElement; dyn: SVGGElement; id: WariantId | null; full: SVGPathElement; trail: SVGPathElement; sept: SVGPathElement; vec: SVGLineElement; head: SVGPathElement; drop: SVGLineElement; proj: SVGLineElement }
  const mkLoop = (): LoopEls => {
    const g = s('g', {}, nakladka);
    const full = s('path', { fill: 'none', stroke: C.txt, 'stroke-width': 3, 'stroke-dasharray': '4 9', opacity: 0.55, 'stroke-linecap': 'round' }, g);
    // ślad, przegroda, wektor i rzut przygasają razem przed ponownym startem; obrys pętli zostaje
    const dyn = s('g', {}, g);
    return {
      g, dyn, id: null, full,
      trail: s('path', { fill: 'none', stroke: C.puls, 'stroke-width': 9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, dyn),
      sept: s('path', { fill: 'none', stroke: C.txt, 'stroke-width': 12, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, dyn),
      drop: s('line', { stroke: C.txt2, 'stroke-width': 2.5, 'stroke-dasharray': '6 8' }, dyn),
      proj: s('line', { 'stroke-width': 16, 'stroke-linecap': 'round', opacity: 0.9 }, dyn),
      vec: s('line', { x1: CX, y1: CY, stroke: C.txt, 'stroke-width': 5, 'stroke-linecap': 'round' }, dyn),
      head: s('path', { fill: C.txt }, dyn),
    };
  };
  const loopOld = mkLoop(), loopCur = mkLoop();
  s('circle', { cx: CX, cy: CY, r: 7, fill: C.txt }, nakladka);
  const hiddenTxt = s('text', { x: CX, y: CY - 230, 'text-anchor': 'middle', 'font-size': 48, fill: C.txt, visibility: 'hidden', text: 'Pętlę zobaczysz po sprawdzeniu' }, nakladka);

  const P = (id: WariantId, tt: number): [number, number] => { const [x, z] = loopXZ(id, tt); const [dx, dy] = naEkran(x, z, K); return [CX + dx, CY + dy]; };
  /**
   * Pełna ścieżka pętli raz na wariant, z długością narastającą w próbkach czasu. Ślad i przegroda to ta sama ścieżka
   * odsłaniana przez `stroke-dasharray`, więc co klatkę nie powstają nowe ciągi ścieżek.
   */
  const PROBKI = Math.round((T1 - T0) / 0.0008);
  const fullCache = new Map<WariantId, { d: string; cum: Float64Array }>();
  const pelna = (id: WariantId) => {
    let c = fullCache.get(id);
    if (!c) {
      let d = '', len = 0, px0 = 0, py0 = 0;
      const cum = new Float64Array(PROBKI + 1);
      for (let i = 0; i <= PROBKI; i++) {
        const [x, y] = P(id, T0 + (i / PROBKI) * (T1 - T0));
        if (i) len += Math.hypot(x - px0, y - py0);
        cum[i] = len; px0 = x; py0 = y;
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      c = { d, cum }; fullCache.set(id, c);
    }
    return c;
  };
  /** Długość ścieżki od T0 do chwili tt. */
  const dlugosc = (cum: Float64Array, tt: number) => {
    const f = clamp((tt - T0) / (T1 - T0), 0, 1) * PROBKI, i = Math.floor(f), a = cum[i] ?? 0, b = cum[Math.min(PROBKI, i + 1)] ?? a;
    return a + (b - a) * (f - i);
  };
  const odslon = (el: SVGPathElement, cum: Float64Array, tt: number) => {
    const L = dlugosc(cum, tt), total = cum[PROBKI] ?? 0;
    if (L < 0.5) { setA(el, { visibility: 'hidden' }); return; }
    setA(el, { visibility: 'visible', 'stroke-dasharray': `${L.toFixed(1)} ${(total + 50).toFixed(0)}` });
  };

  function drawLoopEls(L: LoopEls, id: WariantId, tt: number, alpha: number, sel: Kamera | null) {
    const show = alpha > 0.01 && !hideLoop;
    setA(L.g, { opacity: alpha, visibility: show ? 'visible' : 'hidden' });
    if (!show) return;
    const full = pelna(id);
    if (L.id !== id) { L.id = id; for (const el of [L.full, L.trail, L.sept]) el.setAttribute('d', full.d); }
    setA(L.dyn, { opacity: zanik });
    odslon(L.trail, full.cum, tt);
    odslon(L.sept, full.cum, Math.min(tt, WARIANTY[id].przegrodaDo));
    const [x, y] = P(id, tt), dx = x - CX, dy = y - CY, len = Math.hypot(dx, dy);
    if (len > 8) {
      const ux = dx / len, uy = dy / len;
      setA(L.vec, { x2: x - ux * 10, y2: y - uy * 10, visibility: 'visible' });
      setA(L.head, { d: `M${x + ux * 8} ${y + uy * 8}L${x - ux * 18 - uy * 14} ${y - uy * 18 + ux * 14}L${x - ux * 18 + uy * 14} ${y - uy * 18 - ux * 14}Z`, visibility: 'visible' });
    } else { setA(L.vec, { visibility: 'hidden' }); setA(L.head, { visibility: 'hidden' }); }
    if (sel) {
      const [ax, ay] = osKamery(sel), pr = rzut(id, sel, tt) * K;
      const qx = CX + ax * pr, qy = CY + ay * pr;
      setA(L.proj, { x1: CX, y1: CY, x2: qx, y2: qy, stroke: pr >= 0 ? C.puls : C.txt2, visibility: 'visible' });
      setA(L.drop, { x1: x, y1: y, x2: qx, y2: qy, visibility: 'visible' });
    } else { setA(L.proj, { visibility: 'hidden' }); setA(L.drop, { visibility: 'hidden' }); }
  }

  let cechyDla: WariantId | null = null, cechyStareDla: WariantId | null = null;
  function drawSection() {
    const sel = mode === 'cwiczenie' ? null : kamera;
    const k = fade ? fade.k : 1;
    if (cechyDla !== wariant) { drawCechy(cechy, wariant); cechyDla = wariant; }
    const old = fade && k < 1 ? fade.from : null;
    if (old && cechyStareDla !== old) { drawCechy(cechyStare, old); cechyStareDla = old; }
    const ukryj = mode === 'cwiczenie' && !odkryte;
    setA(cechy, { opacity: ukryj ? 0 : k }); setA(cechyStare, { opacity: old && !ukryj ? 1 - k : 0 });
    for (const l of KAMERY) {
      const c = camEls.get(l)!, on = l === sel || l === pressedCam || (mode === 'cwiczenie' && l === 'V1');
      setA(c.ring, { stroke: on ? C.puls : 'none' });
      setA(c.dot, { fill: on ? C.puls : C.txt2 });
      setA(c.label, { fill: on ? C.puls : C.txt2 });
    }
    if (sel) {
      const [ax, ay] = osKamery(sel), R = 330;
      setA(axisL, { x1: CX - ax * R, y1: CY - ay * R, x2: CX + ax * R, y2: CY + ay * R, visibility: 'visible' });
    } else setA(axisL, { visibility: 'hidden' });
    // przegroda: strzałka od LK ku PK (z lewa na prawo) albo odwrotnie (LBBB), wyróżniona w pierwszej fazie
    const mid = PRZEGRODA_PX[2]!;
    let dx = PK_PX.srodek[0] - LK_PX.srodek[0], dy = PK_PX.srodek[1] - LK_PX.srodek[1]; const n = Math.hypot(dx, dy); dx /= n; dy /= n;
    if (WARIANTY[wariant].przegroda !== 'z lewa na prawo') { dx = -dx; dy = -dy; }
    const act = !hideLoop && t >= T0 && t <= WARIANTY[wariant].przegrodaDo;
    const x1 = mid[0] - dx * 42, y1 = mid[1] - dy * 42, x2 = mid[0] + dx * 42, y2 = mid[1] + dy * 42;
    setA(septum, { opacity: hideLoop ? 0 : act ? 1 : 0.45 });
    setA(septLine, { x1, y1, x2, y2, stroke: C.txt });
    setA(septHead, { d: `M${x2 + dx * 16} ${y2 + dy * 16}L${x2 - dy * 15 - dx * 8} ${y2 + dx * 15 - dy * 8}L${x2 + dy * 15 - dx * 8} ${y2 - dx * 15 - dy * 8}Z`, fill: C.txt });
    setA(hiddenTxt, { visibility: hideLoop ? 'visible' : 'hidden' });
    if (old) drawLoopEls(loopOld, old, t, 1 - k, sel); else setA(loopOld.g, { visibility: 'hidden' });
    drawLoopEls(loopCur, wariant, t, k, sel);
  }

  /* ─────────── zapisy ─────────── */

  const trBox = h('div', { class: 'hw-screen', style: 'cursor:ew-resize;touch-action:pan-y' });
  const trCap = h('p', { class: 'hw-note', style: 'margin-top:6px', text: 'Sam zespół QRS, 10 mm/mV. Czas jest rozciągnięty, znaczniki u dołu co 0,04 s. Przeciągnij po zapisie, żeby przesunąć kursor.' });
  let TS: Surface | null = null;
  const LABEL_W = 58;
  const rowsFor = (): Kamera[] => {
    if (mode === 'progresja') return [kamera];
    if (mode === 'cwiczenie') return ['V1', 'V6'];
    return kamera === 'V1' || kamera === 'V6' ? ['V1', 'V6'] : ['V1', 'V6', kamera];
  };
  /** px na 1 mm w pionie (stałe, żeby wysokość wiersza nie zależała od szerokości). */
  const PX_MM = 4.4;
  const rowH = (l: Kamera, px: number) => { const r = RANGE.get(l)!; return (r.hi - r.lo) * 10 * px + 26; };
  const traceHeight = () => {
    return Math.round(rowsFor().reduce((s, l) => s + rowH(l, PX_MM), 0) + 8);
  };
  let tr = surface(trBox, { height: traceHeight(), label: 'Zapis QRS w wybranych odprowadzeniach' }, (s) => { TS = s; draw(); });
  const rebuildTraces = () => { tr.destroy(); trBox.replaceChildren(); TS = null; tr = surface(trBox, { height: traceHeight(), label: 'Zapis QRS w wybranych odprowadzeniach' }, (s) => { TS = s; draw(); }); bindDrag(); };
  cleanups.push(() => tr.destroy());

  const xOf = (w: number, tt: number) => LABEL_W + ((tt - T0) / (T1 - T0)) * (w - LABEL_W - 8);
  const tOf = (w: number, x: number) => clamp(T0 + ((x - LABEL_W) / (w - LABEL_W - 8)) * (T1 - T0), T0, T1);

  function drawTraces() {
    const s = TS; if (!s || !s.w) return;
    const { ctx, w } = s; ctx.clearRect(0, 0, w, s.h);
    const px = PX_MM, pw = w - LABEL_W - 8;
    let y = 4;
    const k = fade ? fade.k : 1;
    for (const l of rowsFor()) {
      const r = RANGE.get(l)!, H = rowH(l, px), y0 = y + 14 + r.hi * 10 * px;
      // tylko kratka pozioma 1 mm / 5 mm (amplituda); czas rozciągnięty, więc w poziomie same znaczniki co 0,04 s
      ctx.lineWidth = 1;
      for (let mm = Math.ceil((y0 - (y + H - 4)) / px); mm <= Math.floor((y0 - (y + 4)) / px); mm++) {
        const yy = Math.round(y0 - mm * px) + 0.5;
        ctx.strokeStyle = mm % 5 === 0 ? 'rgba(62,230,168,.12)' : 'rgba(62,230,168,.045)';
        ctx.beginPath(); ctx.moveTo(LABEL_W, yy); ctx.lineTo(LABEL_W + pw, yy); ctx.stroke();
      }
      ctx.strokeStyle = C.txt3; ctx.lineWidth = 1;
      for (let tt = 0; tt <= T1 + 1e-9; tt += 0.04) {
        const xx = Math.round(xOf(w, tt)) + 0.5; ctx.beginPath(); ctx.moveTo(xx, y + H - 4); ctx.lineTo(xx, y + H - 11); ctx.stroke();
      }
      ctx.fillStyle = l === kamera && mode !== 'cwiczenie' ? C.puls : C.txt; ctx.font = `500 15px ${C.fontDisplay}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(l, 8, y + 22);
      if (hideTraces) {
        ctx.fillStyle = C.txt2; ctx.font = `500 13px ${C.fontText}`; ctx.textAlign = 'center';
        ctx.fillText('Zapis zobaczysz po sprawdzeniu', LABEL_W + pw / 2, y0 + 4);
      } else {
        const one = (id: WariantId, a: number) => {
          ctx.save(); ctx.globalAlpha = a;
          trace(ctx, (q) => v(id, l, q), { x: LABEL_W, w: pw, t0: T0, t1: T1, y0, pxPerMv: 10 * px, color: 'rgba(163,175,183,.38)', width: 1.7 });
          const xc = xOf(w, t);
          ctx.globalAlpha = a * zanik;
          if (xc > LABEL_W + 1) trace(ctx, (q) => v(id, l, q), { x: LABEL_W, w: xc - LABEL_W, t0: T0, t1: t, y0, pxPerMv: 10 * px, color: C.puls, width: 2.1 });
          ctx.restore();
        };
        if (fade && k < 1) one(fade.from, 1 - k);
        one(wariant, k);
        ctx.fillStyle = C.txt2; ctx.font = `500 12px ${C.fontMono}`; ctx.textAlign = 'left';
        // kod kształtu (rSR′, qrS…) w ćwiczeniu dopiero po odpowiedzi, bo zdradza przyczynę
        if (mode !== 'cwiczenie' || odkryte) { ctx.globalAlpha = k; ctx.fillText(kod(wariant, l), 8, y + 40); ctx.globalAlpha = 1; }
      }
      y += H;
    }
    // opis dla czytnika ekranu: bez kodu kształtu w ćwiczeniu przed odpowiedzią
    const aria = mode === 'cwiczenie' && !odkryte
      ? `Zapis QRS w ${rowsFor().join(' i ')}`
      : `Zapis QRS: ${rowsFor().map((l) => `${l} ${hideTraces ? 'ukryty' : kod(wariant, l)}`).join(', ')}`;
    if (s.canvas.getAttribute('aria-label') !== aria) s.canvas.setAttribute('aria-label', aria);
    // kursor czasu
    const xc = Math.round(xOf(w, t)) + 0.5;
    ctx.strokeStyle = C.txt2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xc, 2); ctx.lineTo(xc, s.h - 2); ctx.stroke();
  }

  let undrag = () => {};
  const settleT = (to: number, vel: number) => {
    stopT();
    tSpring = spring(t, to, (x) => { t = x; syncSlider(); draw(); }, { response: 0.4, damping: 1, velocity: vel, done: () => { tSpring = null; } });
  };
  cleanups.push(stopT);
  const bindDrag = () => {
    undrag();
    // próg 10 px: przewijanie strony palcem po zapisie nie pauzuje i nie przestawia kursora;
    // kursor idzie za palcem względnie (trzyma miejsce chwytu), za krańcami gumowo, po puszczeniu sprężyną z pędem
    let grab: { x0: number; t0: number } | null = null, moved = false;
    const pxPerT = () => Math.max(1, tr.s.w - LABEL_W - 8) / (T1 - T0);
    undrag = drag(tr.s.canvas, {
      prog: 10,
      start: (p) => { stopT(); grab = { x0: p.x, t0: clamp(t, T0, T1) }; moved = false; },
      move: (p) => {
        if (!grab) return;
        if (!moved) { moved = true; playing = false; zanik = 1; paintPlay(); }
        t = guma(grab.t0 + (p.x - grab.x0) / pxPerT(), T0, T1, (T1 - T0) * 0.05);
        syncSlider(); draw();
      },
      end: (p, e, vel) => {
        if (!grab) return;
        grab = null;
        if (!moved) {
          if (e.type === 'pointercancel') return;
          // stuknięcie w zapis: kursor jedzie w to miejsce
          playing = false; zanik = 1; paintPlay();
          settleT(tOf(tr.s.w, p.x), 0);
          return;
        }
        const vt = vel.x / pxPerT();
        settleT(clamp(t + projekcja(vt), T0, T1), vt);
      },
    });
  };
  bindDrag();
  cleanups.push(() => undrag());

  /* ─────────── progresja: sześć kamer ─────────── */

  const progBox = h('div', { class: 'hw-screen' });
  let PS: Surface | null = null;
  const prog = surface(progBox, { ratio: 0.5, min: 220, max: 300, label: 'Progresja załamka R od V1 do V6' }, (s) => { PS = s; draw(); });
  cleanups.push(prog.destroy);
  let pressedCell: Kamera | null = null;
  const progCells = (w: number, hh: number) => KAMERY.map((l, i) => ({ l, x: (i % 3) * (w / 3), y: Math.floor(i / 3) * (hh / 2), w: w / 3, h: hh / 2 }));
  function drawProg() {
    const s = PS; if (!s || !s.w || mode !== 'progresja') return;
    const { ctx, w } = s; ctx.clearRect(0, 0, w, s.h);
    for (const c of progCells(w, s.h)) {
      const sel = c.l === kamera, held = c.l === pressedCell;
      ctx.strokeStyle = sel || held ? C.puls : C.line; ctx.lineWidth = sel ? 1.5 : 1; ctx.strokeRect(c.x + 3.5, c.y + 3.5, c.w - 7, c.h - 7);
      const px = (c.h - 44) / 22, y0 = c.y + 16 + 11 * px + 4;
      ctx.strokeStyle = C.gridMinor; ctx.beginPath(); ctx.moveTo(c.x + 8, Math.round(y0) + 0.5); ctx.lineTo(c.x + c.w - 8, Math.round(y0) + 0.5); ctx.stroke();
      trace(ctx, (q) => v('normal', c.l, q), { x: c.x + 30, w: c.w - 40, t0: T0, t1: 0.11, y0, pxPerMv: 10 * px, color: sel ? C.puls : C.txt2, width: 1.6 });
      ctx.fillStyle = sel ? C.puls : C.txt; ctx.font = `500 14px ${C.fontDisplay}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(c.l, c.x + 10, c.y + 22);
      const mm = PROGRESJA_MM[c.l];
      ctx.font = `12px ${C.fontMono}`; ctx.fillStyle = mm ? C.txt : C.txt3; ctx.textAlign = 'center';
      ctx.fillText(mm ? `R ${mm.r} · S ${mm.s} mm` : 'poglądowo', c.x + c.w / 2, c.y + c.h - 12);
    }
  }
  cleanups.push((() => {
    const cell = (e: MouseEvent) => {
      if (!PS) return undefined;
      const r = PS.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      return progCells(PS.w, PS.h).find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
    };
    const onClick = (e: MouseEvent) => { pressedCell = null; const c = cell(e); if (c) setKamera(c.l); else draw(); };
    // reakcja od razu przy naciśnięciu: ramka komórki zielona, wybór po puszczeniu
    const onDown = (e: PointerEvent) => { pressedCell = cell(e)?.l ?? null; draw(); };
    const onOut = () => { if (pressedCell) { pressedCell = null; draw(); } };
    const c0 = prog.s.canvas;
    c0.addEventListener('click', onClick); c0.addEventListener('pointerdown', onDown);
    c0.addEventListener('pointerleave', onOut); c0.addEventListener('pointercancel', onOut);
    return () => { c0.removeEventListener('click', onClick); c0.removeEventListener('pointerdown', onDown); c0.removeEventListener('pointerleave', onOut); c0.removeEventListener('pointercancel', onOut); };
  })());

  /* ─────────── odczyt ─────────── */

  const vName = h('p', { class: 'hw-cat' });
  const vTags = h('div', { class: 'hw-tags' });
  const vWhy = h('p', { class: 'hw-why' });
  const vNote = h('p', { class: 'hw-note' });
  const read = h('div', { class: 'hw-read' }, vName, vTags, vWhy, vNote);

  const paintRead = () => {
    if (mode === 'progresja') {
      vName.textContent = `Kamera ${kamera}`;
      const mm = PROGRESJA_MM[kamera];
      vTags.innerHTML = `<span class="hw-tag">kształt <b>${kod('normal', kamera)}</b></span>`
        + (mm ? `<span class="hw-tag">R <b>${mm.r} mm</b> · S <b>${mm.s} mm</b></span>` : '<span class="hw-tag">wartości: kształt poglądowy</span>')
        + '<span class="hw-tag">strefa przejściowa <b>V3-V4</b></span>';
      vWhy.textContent = OPIS_KAMERY[kamera];
      vNote.textContent = 'Wartości w milimetrach są tylko tam, gdzie podaje je wykład. W pozostałych kamerach widzisz sam kształt. Każda kamera widzi aktywność całego serca, więc V1 nie jest zapisem wyłącznie prawej komory.';
      return;
    }
    const w = WARIANTY[wariant];
    vName.textContent = w.nazwa;
    vTags.innerHTML = w.cechy.map((c) => `<span class="hw-tag"><b>${c}</b></span>`).join('')
      + `<span class="hw-tag">przegroda <b>${w.przegroda}</b></span>`;
    vWhy.textContent = w.dlaczego;
    vNote.textContent = wariant === 'posterior'
      ? 'Widzisz tu sam zespół QRS. Na początku zawału wysokiego R może jeszcze nie być, a podejrzenie budzi obniżenie ST w V1, V2 lub V3.'
      : 'Biały odcinek pętli to pierwsza faza, czyli pobudzenie przegrody. Odcinek na osi kamery to rzut wektora: zielony, gdy wektor biegnie ku kamerze (wychylenie w górę), szary, gdy od niej (w dół).';
  };

  /* ─────────── ćwiczenie ─────────── */

  const opt = options(WYSOKIE_R.map((id) => ({ v: id, label: WARIANTY[id].nazwa })), () => ex.odswiez());
  let plan: Zadanie[] = [];
  const ex = exercise<Zadanie>({
    rounds: 5,
    make: (i) => { if (i === 0 || plan.length < 5) plan = zadania(rng((Date.now() ^ (Math.random() * 1e9)) >>> 0)); return plan[i]!; },
    show: (z) => {
      opt.reset(); odkryte = false;
      fade = null; wariant = z.wariant; varChips.set(z.wariant);
      hideLoop = z.typ === 'zapis'; hideTraces = z.typ === 'petla';
      stopT(); t = T1; zanik = 1; playing = false; paintPlay(); syncSlider(); draw();
    },
    prompt: (z) => z.typ === 'zapis'
      ? 'Ten zapis ma wysoki R w V1. Obejrzyj V1 i V6, porównaj szerokość QRS ze znacznikami co 0,04 s i wybierz przyczynę.'
      : 'Ta pętla daje wysoki R w V1. Prześledź, kiedy i dokąd biegnie wektor, i wybierz przyczynę.',
    gotowe: () => opt.picked() !== null,
    check: (z) => {
      const picked = opt.picked();
      opt.reveal(z.wariant, picked);
      hideLoop = false; hideTraces = false; odkryte = true; syncSlider(); draw();
      const id = z.wariant as 'rbbb' | 'rvh' | 'posterior';
      const jak = JAK_ODROZNIC[id];
      const why = WYJASNIENIE[id] + (jak ? `<span class="hw-pearl" style="display:block;margin-top:10px"><span class="hw-label">Jak odróżnić</span>${jak}</span>` : '');
      return { ...ocena(z.wariant, picked), why };
    },
    live,
  });
  ex.miejsce.append(opt.el);
  const exBox = ex.el;

  /* ─────────── układ ─────────── */

  const ctrl = h('div', { class: 'hw-row', style: 'gap:10px 14px;align-items:end' }, playBtn, h('div', { style: 'flex:1 1 220px;min-width:0' }, tSlider.el));
  const left = h('div', { class: 'hw-grid' }, secBox, secCap);
  const right = h('div', { class: 'hw-grid' }, ctrl, trBox, trCap, progBox, camRow, read, exBox);
  // przekrój jest głównym obrazem, więc dostaje szerszą kolumnę
  body.append(h('div', { class: 'hw-2col hw-2col--wide-l', style: 'align-items:start' }, left, right));

  function draw() { if (!ready) return; drawSection(); drawTraces(); drawProg(); }

  /* ─────────── zmiany stanu ─────────── */

  function setWariant(id: WariantId) {
    if (id === wariant) return;
    // nowe przenikanie przejmuje bieżące krycie warstw (bez skoku, gdy poprzednie jeszcze trwa)
    if (!still) { const k0 = fade ? 1 - fade.k : 0; fade = { from: wariant, k: k0, t0: performance.now() - k0 * FADE_MS }; }
    wariant = id; varChips.set(id);
    if (!playing) syncSlider();
    paintRead(); draw();
    if (mode !== 'cwiczenie') live(`${WARIANTY[id].nazwa}. V1: ${kod(id, 'V1')}, V6: ${kod(id, 'V6')}.`);
  }
  function setKamera(k: Kamera) {
    kamera = k; camChips.set(k);
    if (TS && traceHeight() !== TS.h) rebuildTraces();
    paintRead(); draw();
    if (mode !== 'cwiczenie') live(mode === 'progresja' ? OPIS_KAMERY[k] : `Kamera ${k}: ${kod(wariant, k)}.`);
  }
  function setMode(m: Mode) {
    mode = m; modeChips.set(m);
    hideLoop = false; hideTraces = false; fade = null; pressedCam = null; pressedCell = null;
    secCap.textContent = m === 'cwiczenie' ? SEC_CAP : `${SEC_CAP} Wybierz kamerę, żeby zobaczyć jej oś.`;
    varChips.el.hidden = m !== 'zobacz';
    camRow.hidden = m === 'cwiczenie';
    progBox.hidden = m !== 'progresja';
    camLabel.textContent = m === 'progresja' ? 'Kamera:' : 'Trzecia kamera:';
    read.hidden = m === 'cwiczenie';
    exBox.hidden = m !== 'cwiczenie';
    if (m === 'progresja') { wariant = 'normal'; varChips.set('normal'); }
    // płótno zapisu tylko przy zmianie wysokości (bez błysku przy zmianie trybu)
    if (!TS || traceHeight() !== TS.h) rebuildTraces();
    if (m === 'cwiczenie') ex.start();
    else { paintRead(); draw(); }
    live(m === 'progresja' ? 'Progresja R. Wybierz kamerę od V1 do V6.' : m === 'cwiczenie' ? `${TRYB_SPRAWDZ}: wysoki R w V1.` : `${TRYB_UCZ}.`);
  }

  /* ─────────── animacja ─────────── */

  const anim = loop(host, (_clock, dt) => {
    let dirty = false;
    if (fade) {
      fade.k = clamp((performance.now() - fade.t0) / FADE_MS, 0, 1);
      if (fade.k >= 1) fade = null;
      dirty = true;
    }
    if (playing) {
      if (t < T1) { t = Math.min(T1, t + dt * SPEED); syncSlider(); }
      else {
        // przerwa na końcu: przez ostatnie 0,25 s pętla i ślad przygasają, potem start od T0 z pełnym kryciem
        hold += dt;
        zanik = clamp((HOLD - hold) / ZANIK, 0, 1);
        if (hold > HOLD) { hold = 0; t = T0; zanik = 1; }
      }
      dirty = true;
    }
    if (dirty) draw();
  });
  cleanups.push(anim.stop);

  ready = true;
  setMode(mode);
  syncSlider();

  return () => { cleanups.forEach((f) => f()); host.replaceChildren(); };
}
