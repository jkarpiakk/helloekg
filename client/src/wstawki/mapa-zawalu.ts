/**
 * Mapa zawału — zamykasz tętnicę na schemacie serca, a 12 odprowadzeń liczy się z jednego wektora uszkodzenia.
 * Wykłady: S3_05 (topografia), S3_04 (ewolucja, odpowiedniki STEMI), S3_03, S2_04, S6_02, S6_05.
 *
 * Opcje dyrektywy:
 *   tetnica=<rca | rca-pk | okalajaca | tylna | lad-prox | lad-dal | d1 | pien>  (domyślnie rca)
 *   faza=<nadostre-t | st | q | st-wraca | t-ujemne | q-utrwalone>                       (domyślnie st)
 *   dodatkowe=tak   — od razu pokazuje odprowadzenia dodatkowe (gdy obraz daje do nich wskazanie)
 *   tryb=cwiczenie  — start w ćwiczeniu odwrotnym (dostajesz zapis, wskazujesz miejsce zamknięcia)
 * Nieznane opcje są ignorowane.
 */
import { C, TRYB_SPRAWDZ, TRYB_UCZ, button, chips, exercise, h, reducedMotion, s, setA, shell, werdykt, type WstawkaOpts } from './core/ui.js';
import { LEADS_12, type Beat, type LeadName } from './core/model.js';
import { twelve } from './core/dwunastka.js';
import { svgNaRastrze } from './core/obrazy.js';
import {
  KONTUR_KOMOR, OBSZARY, ODCINKI, PHASES, PODPISY, PRAWE, PUNKTY, RASTER_KADR, SITES, TYLNE, analiza, beatFor, isPhaseId, isSiteId, kameryObszaru, lista, malaPierwsza, markOf, patQObszaru,
  phase, qrsPomiar, rundy, site, tUjemneLeads, werdyktMapy,
  type PhaseId, type RegionId, type Runda, type SegId, type SiteId,
} from './mapa-zawalu.dane.js';

/* ─────────── schemat: raster marki „serce od przodu” + nakładka w pikselach rastra ─────────── */

/** Nazwa obszaru bez dopływu krwi (pod rysunkiem). */
const AREA: Record<SiteId, string> = {
  rca: 'ściana dolna (dolny brzeg)',
  'rca-pk': 'ściana dolna i prawa komora',
  okalajaca: 'ściana boczna i tylna (pas za brzegiem)',
  tylna: 'ściana tylna (pas za brzegiem)',
  'lad-prox': 'przegroda, przód i bok',
  'lad-dal': 'przegroda i ściana przednia',
  d1: 'część przednio-boczna',
  pien: 'warstwa podwsierdziowa',
};

interface HeartView { el: HTMLElement; show(o: { site: SiteId | null; reveal: boolean; picked: SiteId | null }): void }

const FONT = 32; // px rastra; przy kadrze 840 px: 13 px CSS przy wstawce 375 px, ≥ 12 px od szerokości rysunku 315 px
/** Najmniejszy promień strefy trafienia w px rastra; na węższym rysunku rośnie tak, żeby cel miał ≥ 44 px CSS średnicy. */
const HIT_MIN = 60;
const HIT_CSS = 22;
const FADE = 'transition:opacity .4s var(--hw-ease)';
const EASE = 'cubic-bezier(.2,.7,.2,1)';

function heart(uid: string, onPick: (id: SiteId) => void): HeartView {
  const { svg, nakladka: g } = svgNaRastrze('sercePrzod', { label: 'Serce od przodu z tętnicami wieńcowymi', crop: RASTER_KADR });
  const defs = s('defs', {}, svg);
  const clip = s('clipPath', { id: `${uid}-clip` }, defs);
  s('path', { d: KONTUR_KOMOR }, clip);
  const inside = s('g', { 'clip-path': `url(#${uid}-clip)` }, g);

  const RED = 'rgba(226,75,74,.42)';
  const over = new Map<RegionId, SVGPathElement>();
  for (const [id, r] of Object.entries(OBSZARY) as Array<[RegionId, (typeof OBSZARY)[RegionId]]>) {
    const parent = r.poza ? g : inside;
    const p = r.kreska
      ? s('path', { d: r.d, fill: 'none', stroke: RED, 'stroke-width': r.kreska, 'stroke-linecap': r.poza ? 'butt' : 'round', 'stroke-dasharray': r.poza ? '16 14' : undefined, opacity: 0, style: FADE }, parent)
      : s('path', { d: r.d, fill: RED, opacity: 0, style: FADE }, parent);
    over.set(id, p);
  }

  const segs = new Map<SegId, SVGPathElement>();
  for (const [id, sg] of Object.entries(ODCINKI) as Array<[SegId, (typeof ODCINKI)[SegId]]>) {
    segs.set(id, s('path', { d: sg.d, fill: 'none', stroke: C.txt, 'stroke-width': sg.cienki ? 3 : 4.5, 'stroke-linecap': 'round', opacity: 0.6, 'stroke-dasharray': sg.tyl ? '14 10' : undefined, style: 'transition:opacity .4s var(--hw-ease),stroke .4s var(--hw-ease)' }, g));
  }

  for (const l of PODPISY) {
    const [ax, ay] = l.at, [tx, ty] = l.to;
    s('line', { x1: ax, y1: ay, x2: tx, y2: ty, stroke: C.txt3, 'stroke-width': 2 }, g);
    s('circle', { cx: ax, cy: ay, r: 4, fill: C.txt2 }, g);
    s('text', { x: tx + (l.anchor === 'start' ? 8 : -8), y: ty + 10, fill: C.txt2, 'font-size': FONT, 'text-anchor': l.anchor, text: l.t }, g);
  }

  // każdy element stanu ma swoją warstwę, więc przy zmianie miejsca stare gaśnie, a nowe się pojawia w tym samym czasie
  const lmRing = s('circle', { cx: PUNKTY.pien[0], cy: PUNKTY.pien[1], r: 26, fill: 'none', stroke: C.alarm, 'stroke-width': 4, 'stroke-dasharray': '7 6', opacity: 0, style: FADE }, g);
  const pinG = new Map<SiteId, { dot: SVGCircleElement; ring: SVGCircleElement; cross: SVGGElement | null }>();
  for (const st of SITES) {
    const [x, y] = PUNKTY[st.id];
    const pg = s('g', { transform: `translate(${x} ${y})`, 'aria-hidden': 'true' }, g);
    const ring = s('circle', { r: 22, fill: 'none', stroke: C.txt, 'stroke-width': 4, opacity: 0, style: 'transition:opacity .12s var(--hw-ease)' }, pg);
    const dot = s('circle', { r: 9, fill: C.ink, stroke: C.txt, 'stroke-width': 3.5, style: FADE }, pg);
    let cross: SVGGElement | null = null;
    if (st.zamkniecie) {
      cross = s('g', { opacity: 0, style: FADE }, pg);
      s('line', { x1: -16, y1: -16, x2: 16, y2: 16, stroke: C.alarm, 'stroke-width': 7, 'stroke-linecap': 'round' }, cross);
      s('line', { x1: -16, y1: 16, x2: 16, y2: -16, stroke: C.alarm, 'stroke-width': 7, 'stroke-linecap': 'round' }, cross);
    }
    pinG.set(st.id, { dot, ring, cross });
  }
  // podpisy obszarów (po jednym na miejsce), pod sercem
  const labels = new Map<SiteId, SVGGElement>();
  for (const st of SITES) {
    const t = AREA[st.id];
    const w = t.length * FONT * 0.6 + 50, x0 = RASTER_KADR.x + RASTER_KADR.w / 2 - w / 2, y = RASTER_KADR.y + RASTER_KADR.h - 30;
    const lab = s('g', { opacity: 0, style: FADE, 'aria-hidden': 'true' }, g);
    s('rect', { x: x0, y: y - 26, width: 34, height: 34, fill: 'rgba(226,75,74,.42)', stroke: C.alarm, 'stroke-width': 2 }, lab);
    s('text', { x: x0 + 50, y: y + 2, fill: C.alarm, 'font-size': FONT, text: t }, lab);
    labels.set(st.id, lab);
  }

  /* stan wciśnięcia: pierścień od razu na pointerdown, wybór na pointerup w tej samej strefie */
  const rings = new Set<SiteId>();
  let pressed: SiteId | null = null;
  const paintRings = () => {
    for (const [sid, pg] of pinG) {
      setA(pg.ring, { opacity: rings.has(sid) ? 1 : sid === pressed ? 0.7 : 0 });
      setA(pg.dot, { fill: sid === pressed ? C.txt : C.ink });
    }
  };
  const nearest = (e: PointerEvent): SiteId | null => {
    const m = svg.getScreenCTM?.();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const skala = Math.hypot(m.a, m.b) || 1; // px CSS na px rastra
    let best: SiteId | null = null, bd = Math.max(HIT_MIN, HIT_CSS / skala);
    for (const st of SITES) { const [x, y] = PUNKTY[st.id]; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = st.id; } }
    return best;
  };
  const release = () => { if (pressed) { pressed = null; paintRings(); } };
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pressed = nearest(e); paintRings();
  });
  svg.addEventListener('pointerup', (e) => {
    const id = pressed && nearest(e) === pressed ? pressed : null;
    release();
    if (id) onPick(id);
  });
  svg.addEventListener('pointercancel', release);
  svg.addEventListener('pointerleave', release);
  svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') svg.style.cursor = nearest(e) ? 'pointer' : 'default'; });

  const el = h('div', {}, svg, h('p', { class: 'hw-note', style: 'text-align:center;margin-top:2px', text: 'Widok od przodu, lewa strona pacjenta po prawej. Przerywana linia: naczynie z tyłu serca lub za pniem płucnym. Kropka: miejsce, które możesz zamknąć.' }));
  return {
    el,
    show({ site: id, reveal, picked }) {
      const st = id ? site(id) : null;
      const on = reveal && st ? st : null;
      for (const [rid, p] of over) p.setAttribute('opacity', on && on.regiony.includes(rid) ? '1' : '0');
      for (const [sid, p] of segs) {
        const hit = on?.zaZamknieciem.includes(sid);
        setA(p, { stroke: hit ? C.alarm : C.txt, opacity: hit ? 0.95 : 0.6, 'stroke-width': hit ? (ODCINKI[sid].cienki ? 5 : 7) : (ODCINKI[sid].cienki ? 3 : 4.5) });
      }
      setA(lmRing, { opacity: on?.rozlany ? 1 : 0 });
      rings.clear();
      for (const [sid, pg] of pinG) {
        const jest = !!on && sid === on.id;
        setA(pg.dot, { opacity: jest && on?.zamkniecie ? 0 : 1 });
        if (pg.cross) setA(pg.cross, { opacity: jest ? 1 : 0 });
        const lab = labels.get(sid);
        if (lab) setA(lab, { opacity: jest ? 1 : 0 });
        if (sid === picked || jest) rings.add(sid);
      }
      paintRings();
    },
  };
}

/** Pojawienie się elementu przez krycie: od bieżącego krycia, gdy poprzednie przejście jeszcze trwa. */
function pojaw(el: HTMLElement): void {
  if (reducedMotion() || typeof el.animate !== 'function') return;
  const trwa = el.getAnimations();
  const od = trwa.length ? Number(getComputedStyle(el).opacity) || 0 : 0;
  trwa.forEach((a) => a.cancel());
  el.animate([{ opacity: od }, { opacity: 1 }], { duration: 400, easing: EASE });
}

/*
 * Skala zapisu: okno 1,1 s przy 25 mm/s daje pole o wysokości ok. 26 mm, a halfMv = 1 wymusza
 * prawdziwe 10 mm/mV względem kratki (twelve bierze mniejszą z dwóch skal). Dzięki temu 1 mm
 * uniesienia ST to dokładnie jedna mała kratka, jak w progach z wykładu.
 */
const SKALA = { t0: -0.26, t1: 0.84, halfMv: 1 } as const;

/* ─────────── przenikanie zapisu ─────────── */

/*
 * Jedna warstwa migawki na ekran. Przy zmianie w trakcie przejścia nowa migawka to dokładnie to, co widać
 * w tej chwili (bieżący zapis + poprzednia migawka z jej bieżącym kryciem), więc obraz nie skacze.
 * Bez setTimeout: migawka znika po zakończeniu animacji. (Do przeniesienia do core, gdy będzie wspólny pomocnik.)
 */
const warstwy = new WeakMap<HTMLElement, { snap: HTMLCanvasElement; anim: Animation }>();
function crossfade(screen: HTMLElement, redraw: () => void): void {
  const cv = screen.querySelector<HTMLCanvasElement>('canvas:not([data-snap])');
  const prev = warstwy.get(screen);
  if (!cv || reducedMotion() || !cv.width || !cv.clientWidth || typeof cv.animate !== 'function') {
    if (prev) { prev.anim.cancel(); prev.snap.remove(); warstwy.delete(screen); }
    redraw();
    return;
  }
  const snap = document.createElement('canvas');
  snap.width = cv.width; snap.height = cv.height;
  const ctx = snap.getContext('2d');
  if (ctx) {
    ctx.drawImage(cv, 0, 0);
    const a = prev ? Number(getComputedStyle(prev.snap).opacity) || 0 : 0;
    if (prev && a > 0) { ctx.globalAlpha = a; ctx.drawImage(prev.snap, 0, 0, snap.width, snap.height); }
  }
  if (prev) { prev.anim.cancel(); prev.snap.remove(); }
  snap.setAttribute('aria-hidden', 'true');
  snap.setAttribute('data-snap', '');
  snap.style.cssText = `position:absolute;left:${cv.offsetLeft}px;top:${cv.offsetTop}px;width:${cv.clientWidth}px;height:${cv.clientHeight}px;pointer-events:none`;
  screen.append(snap);
  redraw();
  const anim = snap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: EASE, fill: 'forwards' });
  warstwy.set(screen, { snap, anim });
  anim.onfinish = () => { if (warstwy.get(screen)?.snap === snap) warstwy.delete(screen); snap.remove(); };
}

/* ─────────── wstawka ─────────── */

export function mountMapaZawalu(host: HTMLElement, opts: WstawkaOpts): () => void {
  const { body, live } = shell(host, {
    label: 'Wstawka · lokalizacja zawału',
    title: 'Zamykasz tętnicę i widzisz, co pokaże dwanaście odprowadzeń',
    intro: 'Wybierz miejsce zamknięcia na schemacie albo na liście. Zapis liczy się z jednego kierunku prądu uszkodzenia, a pola z uniesieniem i obniżeniem ST oznaczają się same.',
  });
  const uid = `mz${Math.random().toString(36).slice(2, 8)}`;

  let siteId: SiteId = isSiteId(opts.tetnica) ? opts.tetnica : 'rca';
  let phaseId: PhaseId = isPhaseId(opts.faza) && site(siteId).fazy.includes(opts.faza) ? opts.faza : 'st';
  let extras = opts.dodatkowe === 'tak';
  let mode: 'play' | 'task' = opts.tryb === 'cwiczenie' ? 'task' : 'play';
  let answer: SiteId | null = null;
  let revealed = true;
  let cur: Beat = beatFor(site(siteId), phaseId);

  /* pasek trybów i miejsc */
  const modeChips = chips([{ v: 'play', label: TRYB_UCZ }, { v: 'task', label: TRYB_SPRAWDZ }] as const, mode, (v) => setMode(v), { label: 'Tryb' });
  const siteChips = chips(SITES.map((x) => ({ v: x.id, label: x.chip, title: x.nazwa })), siteId, (v) => pickSite(v), { label: 'Miejsce zamknięcia' });
  const sitesBox = h('div', { class: 'hw-grid', style: 'gap:6px' }, h('p', { class: 'hw-label', text: 'Miejsce zamknięcia' }), siteChips.el);
  body.append(h('div', { class: 'hw-bar' }, modeChips.el));

  /* lewa kolumna: schemat i opis miejsca */
  const hv = heart(uid, (id) => pickSite(id));
  const siteName = h('p', { class: 'hw-cat' });
  const siteOpis = h('p', { class: 'hw-why' });
  const pearl = h('p', { class: 'hw-pearl' }, h('span', { class: 'hw-label', text: 'Ograniczenie' }),
    'Mapa „ściana → tętnica” jest orientacyjna: przebieg naczyń różni się między ludźmi, a miejsce przeszkody ustala dopiero koronarografia.');
  const siteBox = h('div', { class: 'hw-grid' }, siteName, siteOpis, pearl);
  const left = h('div', { class: 'hw-grid', style: 'align-content:start' }, hv.el, siteBox);

  /* prawa kolumna: 12 odprowadzeń, dodatkowe, odczyt */
  const face = () => kameryObszaru(site(siteId));
  const stPhase = () => phaseId === 'st' || phaseId === 'q';
  const markFor = (l: LeadName) => {
    if (!revealed) return null;
    const m = markOf(cur, l);
    if (m) return m;
    return !stPhase() && face().includes(l) ? 'focus' as const : null;
  };
  const t12 = twelve(h('div'), () => cur, { ...SKALA, label: 'Dwanaście odprowadzeń', mark: markFor });
  const extrasBtn = h('button', { class: 'hw-chip', type: 'button', 'aria-pressed': 'false', text: 'Dołącz V3R-V4R i V7-V9' });
  extrasBtn.addEventListener('click', () => {
    extras = !extras; render(false);
    if (extras) pojaw(extrasHost);
    live(extras ? 'Odprowadzenia dodatkowe włączone.' : 'Odprowadzenia dodatkowe wyłączone.');
  });
  const extrasHost = h('div', { class: 'hw-grid', style: 'gap:6px' });
  let tx: { el: HTMLElement; redraw(): void; destroy(): void; key: string } | null = null;
  const legendDown = h('span', {});
  const legend = h('div', { class: 'hw-legend' },
    h('span', {}, h('i', { style: `background:${C.alarm}` }), 'ST↑ ≥ progu'),
    legendDown,
    h('span', {}, h('i', { style: `background:${C.puls}` }), 'kamery patrzące na obszar'));
  const tags = h('div', { class: 'hw-tags' });
  const readWhy = h('p', { class: 'hw-why' });
  const progi = h('p', { class: 'hw-note', text: 'Pacjent: mężczyzna, 58 lat. Uniesienie ST w punkcie J: ≥ 1 mm, w V2-V3 ≥ 2 mm, w V7-V9 i V3R-V4R ≥ 0,5 mm. Obniżenie ST oznaczone od 0,5 mm. 25 mm/s, 10 mm/mV.' });
  const read = h('div', { class: 'hw-read' }, tags, readWhy);
  const right = h('div', { class: 'hw-grid', style: 'align-content:start' }, t12.el, legend, h('div', { class: 'hw-row' }, extrasBtn), extrasHost, progi, read);

  const scena = h('div', { class: 'hw-2col', style: 'align-items:start' }, left, right);
  // w „Ucz się” lista miejsc jest nad schematem; w „Sprawdź się” schemat, zapis i lista idą pod polecenie (ex.miejsce)
  const main = h('div', { class: 'hw-stack' }, sitesBox, scena);
  body.append(main);

  /* oś ewolucji: stany dyskretne */
  const phaseBtns = PHASES.map((p) => {
    const b = h('button', { class: 'hw-chip', type: 'button', 'aria-pressed': 'false', text: p.chip });
    b.addEventListener('click', () => pickPhase(p.id));
    return b;
  });
  const nextBtn = button('Pokaż następną fazę', () => {
    const f = site(siteId).fazy, i = f.indexOf(phaseId);
    pickPhase(f[(i + 1) % f.length] ?? 'st');
  }, 'ghost');
  const phaseName = h('p', { class: 'hw-cat' });
  const phaseOpis = h('p', { class: 'hw-why' });
  const phaseNote = h('p', { class: 'hw-note' });
  const timeline = h('div', { class: 'hw-read' },
    h('p', { class: 'hw-label', text: 'Ewolucja zawału · kolejność z wykładu, bez zegara' }),
    h('div', { class: 'hw-chips', role: 'group', 'aria-label': 'Faza ewolucji zawału' }, ...phaseBtns),
    phaseName, phaseOpis, phaseNote,
    h('div', { class: 'hw-row' }, nextBtn),
    h('p', { class: 'hw-pearl' }, h('span', { class: 'hw-label', text: 'Uwaga' }),
      'To klasyczny ciąg, nie stała kolejność każdego zawału. Szybkie udrożnienie tętnicy potrafi zmienić ten przebieg i zapobiec powstaniu Q, a sekwencja nie pozwala precyzyjnie oszacować „wieku” zawału.'),
  );
  body.append(timeline);

  /* ćwiczenie odwrotne */
  let plan: Runda[] = [];
  const ex = exercise<Runda>({
    rounds: 5,
    make: (i) => { if (i === 0 || plan.length === 0) plan = rundy(Math.random); return plan[i] ?? { site: 'rca' }; },
    show: (r) => {
      siteId = r.site; phaseId = 'st'; answer = null; revealed = false;
      siteChips.set('' as SiteId); siteChips.disable(false);
      render(true);
    },
    prompt: 'Odczytaj zapis i wskaż miejsce zamknięcia na schemacie albo na liście. Możesz dołączyć odprowadzenia dodatkowe.',
    gotowe: () => answer !== null,
    check: (r) => {
      const s0 = site(r.site), w = werdyktMapy(r.site, answer);
      revealed = true;
      siteChips.set(r.site); siteChips.disable(true);
      render(true);
      const a = analiza(cur);
      const ext = [a.prawe ? `V3R-V4R: ST↑ w ${lista(a.upPrawe)}` : '', a.tylne ? `V7-V9: ST↑ w ${lista(a.upTylne)}` : ''].filter(Boolean).join('; ');
      const picked = answer ? site(answer) : null;
      return {
        ...w,
        why: `${s0.dlaczego}<br><br>W tym zapisie: ST↑ w ${lista(a.up)}, ST↓ w ${lista(a.down)}${ext ? `; ${ext}` : ''}.`
          + (picked && !w.ok ? ` Twój wybór: ${picked.nazwa}.` : '')
          + (s0.rozlany ? ' Na schemacie widzisz teraz warstwę podwsierdziową objętą niedokrwieniem.' : ' Na schemacie widzisz teraz miejsce zamknięcia i obszar bez dopływu krwi.'),
      };
    },
    live,
  });
  body.append(ex.el);

  /* ─────────── stan ─────────── */

  function pickSite(id: SiteId) {
    if (mode === 'task') {
      if (revealed) return;
      answer = id; siteChips.set(id); hv.show({ site: siteId, reveal: false, picked: id });
      ex.odswiez();
      live(`Twój wybór: ${site(id).nazwa}.`);
      return;
    }
    siteId = id; siteChips.set(id);
    if (!site(id).fazy.includes(phaseId)) phaseId = 'st';
    render(true);
    announce();
  }
  function pickPhase(id: PhaseId) {
    if (mode === 'task' || !site(siteId).fazy.includes(id)) return;
    phaseId = id;
    render(true);
    announce();
  }
  function announce() {
    const a = analiza(cur), p = phase(phaseId);
    const st = a.up.length || a.down.length ? ` ST uniesiony w ${lista(a.up)}, obniżony w ${lista(a.down)}.` : '';
    live(`${site(siteId).chip}, ${malaPierwsza(p.nazwa)}.${st}`);
  }

  function extrasView(a: ReturnType<typeof analiza>) {
    const rows: LeadName[][] = [];
    // w zadaniu przed sprawdzeniem zawsze oba wiersze: sam dobór wierszy zdradzałby ścianę
    if (!revealed || a.prawe) rows.push([...PRAWE]);
    if (!revealed || a.tylne) rows.push([...TYLNE]);
    extrasBtn.setAttribute('aria-pressed', extras ? 'true' : 'false');
    const key = extras ? rows.map((r) => r.join(',')).join('|') : '';
    if (tx && tx.key === key) return { fresh: false };
    tx?.destroy(); tx = null;
    extrasHost.replaceChildren();
    if (!extras) return { fresh: true };
    if (!rows.length) {
      extrasHost.append(h('p', { class: 'hw-note', text: revealed && site(siteId).rozlany
        ? 'Przy obrazie rozlanym wykład nie wskazuje odprowadzeń dodatkowych.'
        : 'Ten zapis nie daje wskazań do odprowadzeń dodatkowych. V3R-V4R zakładasz przy zawale dolnym, V7-V9 przy obniżeniu ST w V1-V3.' }));
      return { fresh: true };
    }
    const t = twelve(extrasHost, () => cur, { ...SKALA, leads: rows, label: 'Odprowadzenia dodatkowe', mark: markFor });
    extrasHost.append(h('p', { class: 'hw-note', text: !revealed ? 'Odprowadzenia dodatkowe dołączone do zapisu.' : [a.prawe ? 'V3R-V4R: zawał dolny, szukasz zajęcia prawej komory.' : '', a.tylne ? 'V7-V9: obniżenie ST ≥ 1 mm w V1-V3, szukasz zawału tylnego.' : ''].filter(Boolean).join(' ') }));
    tx = { ...t, key };
    return { fresh: true };
  }

  function readout(a: ReturnType<typeof analiza>) {
    const items: string[] = [];
    const tag = (k: string, v: string) => `<span class="hw-tag">${k} <b>${v}</b></span>`;
    const p = phaseId;
    const st0 = site(siteId);
    if (stPhase()) {
      items.push(tag('ST↑ ≥ progu', lista(a.up)), tag('ST↓ ≥ 0,5 mm', lista(a.down)));
      if (a.iiiWiecejNizII !== null) items.push(tag('uniesienie', a.iiiWiecejNizII ? 'III > II' : 'II ≥ III'));
      if (a.sciany.length) items.push(tag(a.rozlany ? 'obraz' : 'ściana z kamer', a.sciany.join(' + ')));
      const ind = [a.prawe ? 'V3R-V4R' : '', a.tylne ? 'V7-V9' : ''].filter(Boolean);
      items.push(tag('dołącz', ind.length ? ind.join(', ') : 'brak wskazań'));
    } else {
      items.push(tag('kamery patrzące na obszar', lista(face().filter((l) => (LEADS_12 as readonly string[]).includes(l)))));
    }
    if (p !== 'nadostre-t' && p !== 'st' && !st0.rozlany) {
      const q = patQObszaru(st0, cur);
      if (st0.id === 'tylna') {
        const v2 = qrsPomiar(cur, 'V2');
        items.push(tag('V2', v2.r > v2.s ? 'R > S: dominuje R' : 'R < S'));
      } else items.push(tag('patologiczne Q', lista(q)));
    }
    if (p === 'st-wraca' || p === 't-ujemne') items.push(tag('T ujemne ≥ 1 mm', lista(tUjemneLeads(cur).filter((l) => l !== 'aVR'))));
    tags.innerHTML = items.join('');
    const why: Record<PhaseId, string> = {
      'nadostre-t': 'Zielone pola to kamery, które za chwilę pokażą uniesienie ST. T jest w nich <b>szeroki, symetryczny i nieproporcjonalnie duży względem QRS</b>, a ST jeszcze nie jest uniesiony.',
      st: a.rozlany
        ? 'Uniesienie tylko w aVR, a obniżenia w wielu grupach odprowadzeń. To nie jest terytorium jednej tętnicy.'
        : 'Czerwone pola to kamery patrzące na obszar bez dopływu krwi. Bursztynowe to kamery z przeciwnej strony: ten sam prąd uszkodzenia widzą jako obniżenie ST.',
      q: st0.id === 'tylna'
        ? 'Wysoki R w V1-V2 to lustrzany odpowiednik załamka Q widzianego od tyłu. Na początku może go jeszcze nie być.'
        : 'Martwy mięsień przestaje być czynny elektrycznie i zmienia początkowy kierunek pobudzenia: kamery patrzące na obszar rejestrują Q.',
      'st-wraca': 'ST jest już poniżej progów. Q zostaje, T zaczyna się odwracać.',
      't-ujemne': 'T odwraca się w kamerach patrzących na obszar zawału. Ujemny T w aVR jest cechą prawidłowego zapisu, więc go tu nie liczysz.',
      'q-utrwalone': 'ST i T wróciły, a Q zostało. Q nie jest dokładnym zegarem: może się z czasem zmniejszyć albo zniknąć.',
    };
    readWhy.innerHTML = why[p];
  }

  function render(fade: boolean) {
    const st0 = site(siteId);
    cur = beatFor(st0, phaseId);
    const a = analiza(cur);
    hv.show({ site: siteId, reveal: revealed, picked: mode === 'task' && !revealed ? answer : null });
    siteName.textContent = st0.nazwa;
    siteOpis.textContent = st0.opis;
    siteBox.hidden = !revealed;
    read.hidden = !revealed;
    legend.hidden = !revealed;
    legendDown.replaceChildren(h('i', { style: `background:${C.warn}` }),
      st0.rozlany ? 'ST↓ ≥ 0,5 mm: obniżenia w wielu grupach (niedokrwienie podwsierdziowe)' : 'ST↓ ≥ 0,5 mm: zmiany lustrzane');
    if (fade) crossfade(t12.el, t12.redraw); else t12.redraw();
    const xv = extrasView(a);
    if (fade && xv.fresh && extras) pojaw(extrasHost);
    if (tx && !xv.fresh) { if (fade) crossfade(tx.el, tx.redraw); else tx.redraw(); }
    if (revealed) readout(a);
    const canvas = t12.el.querySelector('canvas');
    canvas?.setAttribute('aria-label', revealed
      ? `Dwanaście odprowadzeń: ${malaPierwsza(phase(phaseId).nazwa)}. ST uniesiony w ${lista(a.up)}, obniżony w ${lista(a.down)}.`
      : 'Dwanaście odprowadzeń do odczytania.');
    // oś czasu
    timeline.hidden = mode === 'task';
    phaseBtns.forEach((b, i) => {
      const p = PHASES[i];
      if (!p) return;
      b.setAttribute('aria-pressed', p.id === phaseId ? 'true' : 'false');
      b.disabled = !st0.fazy.includes(p.id);
    });
    nextBtn.disabled = st0.fazy.length < 2;
    const ph = phase(phaseId);
    phaseName.textContent = ph.nazwa;
    phaseOpis.textContent = ph.opis;
    phaseNote.textContent = st0.fazyUwaga ?? '';
    phaseNote.hidden = !st0.fazyUwaga;
  }

  function setMode(m: 'play' | 'task', anim = true) {
    mode = m; modeChips.set(m);
    ex.el.hidden = m !== 'task';
    main.hidden = m === 'task';
    if (m === 'task') {
      ex.miejsce.replaceChildren(scena, sitesBox);
      ex.start();
      if (anim) pojaw(ex.el);
    } else {
      main.replaceChildren(sitesBox, scena);
      revealed = true; answer = null;
      siteChips.disable(false); siteChips.set(siteId);
      render(false);
      if (anim) pojaw(main);
    }
  }

  setMode(mode, false);
  return () => {
    t12.destroy(); tx?.destroy();
    host.replaceChildren();
  };
}
