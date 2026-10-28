/**
 * Zamienione elektrody — sylwetka z czterema klipsami kończynowymi; zapis 12 odprowadzeń liczony fizycznie
 * z potencjałów miejsc, na których leżą kable. Zamiana rąk: I odwrócone, II↔III, aVR↔aVL, aVF i V1–V6 bez zmian.
 * Wykład: S1_01 („Gdy elektrody są źle podłączone”, odprowadzenia Einthovena i Goldbergera).
 *
 * Opcje: zamiana=brak|rece|lr-ln|pr-ln|pr-pn|lr-pn|ln-pn, tryb=cwiczenie.
 */
import { C, TRYB_SPRAWDZ, TRYB_UCZ, chips, drag, exercise, h, options, rng, s, setA, shell, spring, type Spring, type WstawkaOpts } from './core/ui.js';
import type { Beat, LeadName } from './core/model.js';
import { svgNaRastrze } from './core/obrazy.js';
import { dzwiekDla } from './core/dzwiek.js';
import {
  MIEJSCA, NAZWA, ODPOWIEDZI, POPRAWNE, WIDOK, WYJASNIENIE, ZAMIANY, jakaZamiana, kablNa, napiecie, obraz, ocena, opisObrazu,
  podlaczenieZ, sasiednie, serce, stanZadania, zadania, zamien, type Miejsce, type Odpowiedz, type Podlaczenie, type ZamianaId, type Zadanie,
} from './elektrody.dane.js';

/**
 * Miejsca na rastrze `sylwetka` (900 × 1200 px; z GFX-0039: oryginał 1086 × 1448 × 0,8287, sprawdzone na rastrze):
 * nadgarstki i kostki. Widok od przodu: prawa strona pacjenta po lewej.
 */
const POS: Record<Miejsce, [number, number]> = { PR: [233, 550], LR: [667, 550], PN: [356, 1028], LN: [542, 1028] };
const SITE_LABEL: Record<Miejsce, [number, number, 'start' | 'end' | 'middle']> = {
  PR: [118, 720, 'middle'], LR: [782, 720, 'middle'], PN: [268, 1040, 'end'], LN: [630, 1040, 'start'],
};
/** Promień kółka miejsca (wokół klipsa ≥ 44 px) i zasięg upuszczenia [px rastra]. */
const SITE_R = 80, DROP_R = 130;
const T0 = -0.24, T1 = 0.6;
const WZOR: Partial<Record<LeadName, [string, Miejsce[]]>> = {
  I: ['LR − PR', ['LR', 'PR']], II: ['LN − PR', ['LN', 'PR']], III: ['LN − LR', ['LN', 'LR']],
  aVR: ['PR − (LR + LN)/2', ['PR', 'LR', 'LN']], aVL: ['LR − (PR + LN)/2', ['LR', 'PR', 'LN']], aVF: ['LN − (PR + LR)/2', ['LN', 'PR', 'LR']],
};

export function mountElektrody(host: HTMLElement, opts: WstawkaOpts): () => void {
  const { body, live } = shell(host, {
    label: 'Wstawka · zamienione elektrody',
    title: 'Zamień przewody kończynowe i zobacz, co zrobi aparat',
    intro: 'Aparat nie wie, gdzie leży kabel, i liczy odprowadzenia z tego, co dostaje. Przeciągnij klips na inną kończynę albo wybierz gotową zamianę pod rysunkiem.',
  });
  const cleanups: Array<() => void> = [];

  const isZ = (x: string | undefined): x is ZamianaId => !!x && ZAMIANY.some((z) => z.id === x);
  let p: Podlaczenie = podlaczenieZ(isZ(opts.zamiana) ? opts.zamiana : 'brak');
  let mode: 'play' | 'task' = opts.tryb === 'cwiczenie' ? 'task' : 'play';
  let heart: Beat = serce();

  /* ─────────── sterowanie ─────────── */

  const modeChips = chips([{ v: 'play', label: TRYB_UCZ }, { v: 'task', label: TRYB_SPRAWDZ }] as const, mode, (m) => setMode(m), { label: 'Tryb' });
  const swapChips = chips(ZAMIANY.map((z) => ({ v: z.id, label: z.label })), (jakaZamiana(p) ?? 'brak') as ZamianaId, (id) => { p = podlaczenieZ(id); moveClips(true); update(true, true); }, { label: 'Gotowe zamiany przewodów', small: true });
  body.append(h('div', { class: 'hw-bar' }, modeChips.el));

  /* ─────────── sylwetka ─────────── */

  const VB = { x: 0, y: 20, w: 900, h: 1120 };
  // sylwetka przewija stronę jak zwykły obraz (touch-action z rdzenia); gest przechwytują tylko klipsy
  const { svg, nakladka: ov } = svgNaRastrze('sylwetka', { label: 'Sylwetka pacjenta od przodu z klipsami elektrod kończynowych', crop: VB });
  const sites = new Map<Miejsce, SVGCircleElement>();
  for (const m of MIEJSCA) {
    const [x, y] = POS[m];
    sites.set(m, s('circle', { cx: x, cy: y, r: SITE_R, fill: 'none', stroke: C.txt2, 'stroke-width': 3, 'stroke-dasharray': '10 9' }, ov));
    const [lx, ly, a] = SITE_LABEL[m];
    s('text', { x: lx, y: ly, 'text-anchor': a, fill: C.txt, 'font-size': 36, 'font-weight': 600, text: NAZWA[m] }, ov);
  }
  const hideCover = s('g', { visibility: 'hidden' }, ov);
  s('rect', { x: VB.x, y: VB.y, width: VB.w, height: VB.h, fill: C.ink, opacity: 0.86 }, hideCover);
  s('text', { x: 450, y: 600, 'text-anchor': 'middle', fill: C.txt2, 'font-size': 44, text: 'Podłączenie zobaczysz po sprawdzeniu' }, hideCover);

  // klipsy: przyciski HTML nad rastrem (fokus, klawiatura, cel dotyku ≥ 44 px), położone w procentach kadru
  const clipCss = h('style', { text: '.hw-el-stage{position:relative}.hw-el-clips{position:absolute;inset:0;pointer-events:none}'
    + '.hw-el-clip{position:absolute;width:max(44px,9.4%);aspect-ratio:1;margin:0;padding:0;border-radius:50%;appearance:none;pointer-events:auto;'
    + 'display:grid;place-items:center;touch-action:none;cursor:grab;background:var(--hw-ink);color:var(--hw-txt);border:3px solid var(--hw-puls);'
    + 'font:600 13px/1 var(--hw-f-m);letter-spacing:.02em;transform:translate(-50%,-50%) scale(var(--hw-s,1));transition:transform .14s var(--hw-ease),border-color .2s;'
    + '-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}'
    + '.hw-el-clip.is-wrong{border-color:var(--hw-warn);border-style:dashed}.hw-el-clip.is-held{--hw-s:1.08;cursor:grabbing;z-index:2}'
    + '.hw-el-clip:active:not([disabled]){--hw-s:1.08}.hw-el-clip[disabled]{cursor:default}' });
  const clipLayer = h('div', { class: 'hw-el-clips' });
  const stage = h('div', { class: 'hw-el-stage' }, clipCss, svg, clipLayer);
  /** Bieżące (wyświetlane) położenie klipsów w układzie kadru; cel to zawsze POS[p[k]]. */
  const cur = {} as Record<Miejsce, { x: number; y: number }>;
  const clips = new Map<Miejsce, HTMLButtonElement>();
  const springs = new Map<Miejsce, [Spring, Spring]>();
  const render = (k: Miejsce) => {
    const b = clips.get(k)!, q = cur[k];
    b.style.left = `${((q.x - VB.x) / VB.w) * 100}%`;
    b.style.top = `${((q.y - VB.y) / VB.h) * 100}%`;
  };
  const stopSpring = (k: Miejsce) => { const sp = springs.get(k); if (sp) { sp[0].stop(); sp[1].stop(); springs.delete(k); } };
  /** Klips jedzie sprężyną (bez odbicia) z bieżącego miejsca do celu; przy „Ogranicz ruch” skok. */
  const glide = (k: Miejsce, to: [number, number], v = { x: 0, y: 0 }) => {
    stopSpring(k);
    const q = cur[k];
    const o = { response: 0.35, damping: 1 };
    springs.set(k, [
      spring(q.x, to[0], (x) => { q.x = x; render(k); }, { ...o, velocity: v.x }),
      spring(q.y, to[1], (y) => { q.y = y; render(k); }, { ...o, velocity: v.y }),
    ]);
  };
  const snap = (k: Miejsce) => { stopSpring(k); const [x, y] = POS[p[k]]; cur[k] = { x, y }; render(k); };
  /** Ustawia klipsy na miejscach z `p`: sprężyną (działanie kursanta) albo od razu (nowe zadanie, zmiana trybu). */
  const moveClips = (animate: boolean) => { for (const k of MIEJSCA) { if (animate) glide(k, POS[p[k]]); else snap(k); } };
  cleanups.push(() => { for (const k of MIEJSCA) stopSpring(k); });

  const nearestSite = (q: { x: number; y: number }): Miejsce | null => {
    let site: Miejsce | null = null, bd = DROP_R;
    for (const m of MIEJSCA) { const [x, y] = POS[m]; const d = Math.hypot(x - q.x, y - q.y); if (d < bd) { bd = d; site = m; } }
    return site;
  };
  /** Podświetlenie miejsca, na które klips spadnie po puszczeniu. */
  const highlight = (m: Miejsce | null) => {
    for (const [site, c] of sites) setA(c, site === m ? { stroke: C.puls, 'stroke-width': 5, 'stroke-dasharray': null } : { stroke: C.txt2, 'stroke-width': 3, 'stroke-dasharray': '10 9' });
  };
  /** Zamiana: klips `k` ląduje na `site`, a klips, który tam leżał, przejeżdża na zwolnione miejsce. */
  const dropOn = (k: Miejsce, site: Miejsce, v?: { x: number; y: number }) => {
    const other = kablNa(p, site);
    p = zamien(p, k, other);
    glide(k, POS[p[k]], v);
    if (other !== k) glide(other, POS[p[other]]);
    update(true, true);
    // zatrzask tylko na właściwym miejscu; zła pozycja bez dźwięku (żeby nie podpowiadać)
    if (p[k] === k || (other !== k && p[other] === other)) dzwiekDla(svg).zatrzask();
  };
  const toVb = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return { x: VB.x + ((e.clientX - r.left) / (r.width || 1)) * VB.w, y: VB.y + ((e.clientY - r.top) / (r.height || 1)) * VB.h };
  };

  for (const k of MIEJSCA) {
    const b = h('button', { class: 'hw-el-clip', type: 'button', text: k });
    clipLayer.append(b);
    clips.set(k, b);
    const [x, y] = POS[p[k]]; cur[k] = { x, y }; render(k);
    // chwyt trzyma miejsce, za które złapano klips (offset), zamiast przeskoczyć środkiem pod palec
    let off = { x: 0, y: 0 };
    const hist: Array<{ x: number; y: number; t: number }> = [];
    cleanups.push(drag(b, {
      prog: 4,
      start: (_pt, e) => {
        if (mode === 'task') return false;
        stopSpring(k);
        const q = toVb(e); off = { x: q.x - cur[k].x, y: q.y - cur[k].y };
        hist.length = 0; hist.push({ ...cur[k], t: e.timeStamp });
        b.classList.add('is-held');
      },
      move: (_pt, e) => {
        const q = toVb(e); cur[k] = { x: q.x - off.x, y: q.y - off.y }; render(k);
        hist.push({ ...cur[k], t: e.timeStamp }); while (hist.length > 6) hist.shift();
        highlight(nearestSite(cur[k]));
      },
      end: (_pt, e) => {
        b.classList.remove('is-held'); highlight(null);
        const a = hist.find((h0) => e.timeStamp - h0.t < 80) ?? hist[0];
        const dt = a ? Math.max(0.008, (e.timeStamp - a.t) / 1000) : 1;
        const v = a ? { x: (cur[k].x - a.x) / dt, y: (cur[k].y - a.y) / dt } : { x: 0, y: 0 };
        const site = e.type === 'pointercancel' ? null : nearestSite(cur[k]);
        if (site && site !== p[k]) dropOn(k, site, v);
        else glide(k, POS[p[k]], v);
      },
    }));
    const onKey = (e: KeyboardEvent) => {
      if (mode === 'task') return;
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      dropOn(k, sasiednie(p[k], dir));
    };
    b.addEventListener('keydown', onKey);
    cleanups.push(() => b.removeEventListener('keydown', onKey));
  }

  /** Kolor, kreska i opis klipsów oraz sylwetki (bez ruszania położenia). */
  const paintClips = () => {
    const covered = hideCover.getAttribute('visibility') === 'visible';
    clipLayer.hidden = covered;
    for (const k of MIEJSCA) {
      const b = clips.get(k)!, wrong = p[k] !== k;
      b.classList.toggle('is-wrong', wrong);
      b.disabled = mode === 'task';
      b.setAttribute('aria-label', `Klips ${k}: ${NAZWA[p[k]]}. Strzałki przenoszą go na inną kończynę.`);
    }
    setA(svg, { 'aria-label': covered ? 'Sylwetka pacjenta. Podłączenie zobaczysz po sprawdzeniu.' : 'Sylwetka pacjenta. ' + MIEJSCA.map((m) => `${NAZWA[m]}: kabel ${kablNa(p, m)}`).join(', ') + '.' });
  };

  const formulas = h('ul', { class: 'hw-list' });
  const figure = h('div', { class: 'hw-grid' }, stage, h('p', { class: 'hw-note', style: 'text-align:center', text: 'Widok od przodu: prawa strona pacjenta jest po lewej. PN nie tworzy własnego odprowadzenia.' }));

  /* ─────────── 12 odprowadzeń ─────────── */

  // pola 3:2 dla kończynowych (21 × 14 mm), węższe i wyższe dla przedsercowych w jednym rzędzie
  const WL = 21, HL = 14, HV = 22;
  const style = h('style', { text: '.hw-el-v{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}@container hw (min-width:640px){.hw-el-v{grid-template-columns:repeat(6,minmax(0,1fr))}}' });
  const grid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px' });
  const vGrid = h('div', { class: 'hw-el-v' });
  const panels = WIDOK.map((n) => {
    const limbLead = !n.startsWith('V');
    const H = limbLead ? HL : HV;
    const svgL = s('svg', { viewBox: `0 ${-H / 2} ${WL} ${H}`, class: 'hw-svg', 'aria-hidden': 'true' });
    s('rect', { x: 0, y: -H / 2, width: WL, height: H, fill: C.screen }, svgL);
    for (let x = 0; x <= WL; x += 1) s('line', { x1: x, y1: -H / 2, x2: x, y2: H / 2, stroke: x % 5 === 0 ? C.gridMajor : C.gridMinor, 'stroke-width': x % 5 === 0 ? 0.12 : 0.06 }, svgL);
    for (let y = -Math.floor(H / 2); y <= H / 2; y++) s('line', { x1: 0, y1: y, x2: WL, y2: y, stroke: y % 5 === 0 ? C.gridMajor : C.gridMinor, 'stroke-width': y % 5 === 0 ? 0.12 : 0.06 }, svgL);
    // dwie warstwy (zapis + wzorzec) do przenikania przy zmianie podłączenia; bez morfingu kształtu
    const mk = () => {
      const g = s('g', {}, svgL);
      const ghost = s('path', { fill: 'none', stroke: C.txt3, 'stroke-width': 1.1, 'stroke-dasharray': '3 3', 'vector-effect': 'non-scaling-stroke' }, g);
      const path = s('path', { fill: 'none', stroke: C.puls, 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, g);
      return { g, ghost, path };
    };
    const layers = [mk(), mk()] as const;
    const tag = h('span', { class: 'hw-note', style: 'text-align:right;font-size:12px' });
    const box = h('div', { class: 'hw-panel', style: `display:grid;gap:3px;padding:${limbLead ? 6 : 4}px` },
      h('span', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:4px' }, h('span', { style: `font:500 ${limbLead ? 14 : 13}px/1 ${C.fontDisplay}`, text: n }), limbLead ? tag : null),
      svgL);
    (limbLead ? grid : vGrid).append(box);
    return { n, H, box, layers, front: 0, tag };
  });
  const vCap = h('p', { class: 'hw-note', style: 'font-size:12px' });
  const gridCap = h('p', { class: 'hw-note', text: '25 mm/s · 10 mm/mV · linia przerywana: zapis przy prawidłowym podłączeniu' });

  const pathFor = (b: Beat, pp: Podlaczenie, n: LeadName) => {
    let d = '';
    for (let t = T0; t <= T1 + 1e-9; t += 0.003) {
      const x = (t - T0) * 25, y = -napiecie(b, pp, n, t) * 10;
      d += (d ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    return d;
  };
  /** Zakres napięć [mV] zapisu (do wyśrodkowania linii w polu). */
  const zakres = (b: Beat, pp: Podlaczenie, n: LeadName): [number, number] => {
    let hi = 0, lo = 0;
    for (let t = T0; t <= T1; t += 0.003) { const v = napiecie(b, pp, n, t); if (v > hi) hi = v; if (v < lo) lo = v; }
    return [lo, hi];
  };

  /* ─────────── odczyt ─────────── */

  const verdict = h('p', { class: 'hw-cat' });
  const why = h('p', { class: 'hw-why' });
  const read = h('div', { class: 'hw-read' }, verdict, why, h('p', { class: 'hw-label', text: 'Co liczy aparat (kabel → miejsce)' }), formulas);

  const paintRead = () => {
    const z = jakaZamiana(p);
    const zz = z ? ZAMIANY.find((q) => q.id === z) : null;
    if (z === 'brak') {
      verdict.textContent = 'Podłączenie prawidłowe'; verdict.className = 'hw-cat hw-ok';
      why.innerHTML = WYJASNIENIE.prawidlowe;
    } else if (z === 'rece') {
      verdict.textContent = 'Zamiana elektrod rąk'; verdict.className = 'hw-cat hw-warn';
      why.innerHTML = WYJASNIENIE.rece;
    } else {
      verdict.textContent = zz ? `Zamiana ${zz.label}` : 'Kilka zamian naraz'; verdict.className = 'hw-cat hw-warn';
      const zm = WIDOK.filter((n) => obraz(heart, p, n).typ !== 'bez zmian');
      const v = WIDOK.filter((n) => n.startsWith('V'));
      const vZm = v.some((n) => zm.includes(n));
      why.innerHTML = 'Tego układu wykład nie omawia. Aparat liczy zapis z tych samych definicji odprowadzeń. '
        + (zm.length ? `Zmienione: <b>${zm.filter((n) => !n.startsWith('V')).join(', ') || 'brak'}</b>` : 'Żadne odprowadzenie się nie zmieniło')
        + (zm.length ? `; przedsercowe ${vZm ? 'zmienione, bo zmieniła się średnia potencjałów kabli PR, LR i LN' : 'bez zmian'}.` : '.');
    }
    formulas.replaceChildren(...(['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] as const).map((n) => {
      const [f, ks] = WZOR[n]!;
      const now = ks.map((k) => `${k}→${NAZWA[p[k]]}`).join(', ');
      return h('li', {}, h('span', { html: `<b>${n}</b> = ${f}` }), h('span', { class: 'hw-note', style: 'text-align:right;font-size:12px', text: ks.every((k) => p[k] === k) ? 'kable na swoich miejscach' : now }));
    }));
  };

  /* ─────────── rysowanie ─────────── */

  /** Rysuje 12 odprowadzeń; `fade` = nowy zapis przenika się ze starym (0,3 s), od bieżącego krycia warstw. */
  function drawLeads(fade = false) {
    const task = mode === 'task';
    for (const pn of panels) {
      const showGhost = !task;
      // linia izoelektryczna przesunięta tak, żeby zapis (i wzorzec) mieścił się w polu; co do 1 mm, zgodnie z kratką
      const [lo1, hi1] = zakres(heart, p, pn.n), [lo2, hi2] = showGhost ? zakres(heart, POPRAWNE, pn.n) : [lo1, hi1];
      const lo = Math.min(lo1, lo2), hi = Math.max(hi1, hi2);
      const shift = Math.max(-pn.H / 2 + 1, Math.min(pn.H / 2 - 1, Math.round(((hi + lo) / 2) * 10)));
      const inc = fade ? 1 - pn.front : pn.front, out = 1 - inc;
      const L = pn.layers[inc]!, O = pn.layers[out]!;
      L.path.setAttribute('d', pathFor(heart, p, pn.n));
      L.ghost.setAttribute('d', showGhost ? pathFor(heart, POPRAWNE, pn.n) : '');
      setA(L.g, { transform: `translate(0 ${shift})` });
      L.g.style.transition = O.g.style.transition = fade ? 'opacity .3s var(--hw-ease)' : 'none';
      L.g.style.opacity = '1'; O.g.style.opacity = '0';
      pn.front = inc;
      const o = obraz(heart, p, pn.n);
      const changed = !task && o.typ !== 'bez zmian';
      pn.tag.textContent = task ? '' : opisObrazu(o, pn.n);
      pn.tag.style.color = changed ? C.warn : '';
      pn.box.style.borderColor = changed ? C.warn : '';
    }
    const vZm = panels.filter((x) => x.n.startsWith('V') && obraz(heart, p, x.n).typ !== 'bez zmian');
    vCap.textContent = task ? 'Odprowadzenia przedsercowe V1-V6' : vZm.length ? `V1-V6: zmienione (${vZm.map((x) => x.n).join(', ')})` : 'V1-V6: bez zmian';
    vCap.style.color = !task && vZm.length ? C.warn : '';
  }

  function update(announce: boolean, fade = false) {
    paintClips();
    const z = jakaZamiana(p);
    swapChips.set((z ?? '') as ZamianaId);
    drawLeads(fade); paintRead();
    if (announce) {
      if (z === 'rece') live('Zamiana rąk: I odwrócone, II i III oraz aVR i aVL zamieniają się obrazami, aVF i przedsercowe bez zmian.');
      else if (z === 'brak') live('Podłączenie prawidłowe.');
      else live(MIEJSCA.map((m) => `${NAZWA[m]}: kabel ${kablNa(p, m)}`).join(', ') + '.');
    }
  }

  /* ─────────── ćwiczenie ─────────── */

  const opt = options(ODPOWIEDZI, () => ex.odswiez());
  let plan: Zadanie[] = [];
  const ex = exercise<Zadanie>({
    rounds: 5,
    make: (i) => { if (i === 0 || plan.length < 5) plan = zadania(rng((Date.now() ^ (Math.random() * 1e9)) >>> 0)); return plan[i]!; },
    show: (z) => {
      opt.reset();
      const st = stanZadania(z); heart = st.b; p = st.p;
      setA(hideCover, { visibility: 'visible' });
      moveClips(false); paintClips(); drawLeads();
    },
    prompt: 'Co się stało? Obejrzyj I, aVR i progresję R w V1-V6 i wybierz, co wyjaśnia ten zapis.',
    gotowe: () => opt.picked() !== null,
    check: (z) => {
      const picked = opt.picked() as Odpowiedz | null;
      opt.reveal(z.odp, picked);
      setA(hideCover, { visibility: 'hidden' }); paintClips();
      return { ...ocena(z.odp, picked), why: WYJASNIENIE[z.odp] };
    },
    live,
  });
  ex.miejsce.append(opt.el);

  /* ─────────── układ ─────────── */

  const left = h('div', { class: 'hw-grid' }, figure, swapChips.el);
  const right = h('div', { class: 'hw-grid' }, style, grid, vCap, vGrid, gridCap, read, ex.el);
  body.append(h('div', { class: 'hw-2col hw-2col--wide-r', style: 'align-items:start' }, left, right));

  function setMode(m: 'play' | 'task') {
    mode = m; modeChips.set(m);
    read.hidden = m !== 'play'; ex.el.hidden = m !== 'task';
    swapChips.el.hidden = m !== 'play';
    if (m === 'task') ex.start();
    else {
      heart = serce();
      setA(hideCover, { visibility: 'hidden' });
      moveClips(false);
      update(false);
    }
  }

  setMode(mode);
  return () => { cleanups.forEach((f) => f()); host.replaceChildren(); };
}
