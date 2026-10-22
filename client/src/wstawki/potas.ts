/**
 * Potas na suwaku — hipokaliemia, zapis prawidłowy i kolejne obrazy hiperkaliemii jako stany dyskretne.
 * Wykłady: S2_04 (T i ST), S2_05 (fala U, QU), S3_03 (T w hiperkaliemii), S6_01 (przypadek 9: hiperkaliemia).
 *
 * Opcje: stan=hipo|norma|hiper-t|hiper-p|hiper-qrs|sinus (domyślnie norma), tryb=cwiczenie,
 * widok=12 (start w widoku 12 odprowadzeń), odpr=II|V2|V3 (odprowadzenie dużego paska, domyślnie V3).
 * Nieznane opcje są ignorowane.
 *
 * Stężenie potasu nie ma wzoru na kształt EKG: suwak skacze między obrazami (przenikanie 0,4 s), bez morfingu.
 */
import { C, TRYB_SPRAWDZ, TRYB_UCZ, button, chips, clamp, exercise, h, options, paper, reducedMotion, shell, shuffle, slider, surface, trace, type Surface, type WstawkaOpts } from './core/ui.js';
import { volt, type Beat, type LeadName } from './core/model.js';
import { twelve } from './core/dwunastka.js';
import { CECHY, KOLEJNOSC, KOLEJNOSC_CWICZENIA, ODPROWADZENIA, STANY, miejscaCech, ocenKolejnosc, pobudzenie, werdyktKolejnosci, werdyktRozpoznania, type StanK } from './potas.dane.js';

const LOCAL_CSS = `
.hw-ka [hidden]{display:none!important}
.hw-ka-wrap{position:relative}
.hw-ka-ends{display:flex;justify-content:space-between;font:12px/1.3 var(--hw-f-m);color:var(--hw-txt3);margin-top:-2px}
.hw-ka-thumbs{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.hw-ka-thumb{appearance:none;display:grid;gap:6px;padding:8px;text-align:left;color:inherit;cursor:pointer;font:inherit;transition:transform .12s var(--hw-ease),border-color .2s}
.hw-ka-thumb:active{transform:scale(.97)}
.hw-ka-thumb[disabled]{cursor:default}
.hw-ka-thumb[disabled]:active{transform:none}
.hw-ka-thumb[aria-pressed="true"]{border-color:var(--hw-puls)}
.hw-ka-thumb .hw-ka-badge{font:500 13px/1 var(--hw-f-m);color:var(--hw-txt2)}
.hw-ka-thumb[aria-pressed="true"] .hw-ka-badge{color:var(--hw-puls)}
`;
let localStyled = false;
function ensureLocal(): void {
  if (localStyled) return;
  localStyled = true;
  const el = document.createElement('style');
  el.setAttribute('data-hw-potas', '');
  el.textContent = LOCAL_CSS;
  document.head.appendChild(el);
}

/* ─────────── przenikanie ─────────── */
const EASE = 'cubic-bezier(.2,.7,.2,1)';
/*
 * Jedna warstwa migawki na ekran. Przy kolejnym kroku suwaka w trakcie przejścia nowa migawka to dokładnie to,
 * co widać w tej chwili (bieżący obraz + poprzednia migawka z jej bieżącym kryciem), więc szybkie przesuwanie
 * suwaka nie nakłada warstw i obraz nie miga. Bez setTimeout. (Do przeniesienia do core jako wspólny pomocnik.)
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
/** Pojawienie się elementu przez krycie: od bieżącego krycia, gdy poprzednie przejście jeszcze trwa. */
function pojaw(el: HTMLElement): void {
  if (reducedMotion() || typeof el.animate !== 'function') return;
  const trwa = el.getAnimations();
  const od = trwa.length ? Number(getComputedStyle(el).opacity) || 0 : 0;
  trwa.forEach((a) => a.cancel());
  el.animate([{ opacity: od }, { opacity: 1 }], { duration: 400, easing: EASE });
}

/** Pasek kilku pobudzeń w jednym odprowadzeniu. */
const T1 = 0.55;
function napiecie(stan: StanK, lead: LeadName, t: number): number {
  const b = pobudzenie(stan), rr = STANY[stan].rr;
  let v = 0;
  for (let k = -1; k < 8; k++) {
    const d = t - (T1 + k * rr);
    if (d > -0.6 && d < 1.4) v += volt(b, lead, d);
  }
  return v;
}

/** Zakres napięć odprowadzenia we wszystkich stanach (żeby skala nie skakała przy zmianie stanu). */
const zakresy = new Map<LeadName, { mx: number; mn: number }>();
function zakres(lead: LeadName): { mx: number; mn: number } {
  const z = zakresy.get(lead);
  if (z) return z;
  let mx = 1, mn = -0.2;
  for (const s0 of KOLEJNOSC) for (let t = 0.3; t < 3.6; t += 0.004) { const v = napiecie(s0, lead, t); mx = Math.max(mx, v); mn = Math.min(mn, v); }
  const r = { mx, mn };
  zakresy.set(lead, r);
  return r;
}

export function mountPotas(host: HTMLElement, opts: WstawkaOpts): () => void {
  ensureLocal();
  const { root, body, live } = shell(host, {
    label: 'Wstawka · potas',
    title: 'Potas na suwaku: jak hipo- i hiperkaliemia zmieniają zapis',
    intro: 'Przesuń suwak od niskiego do wysokiego potasu. Każdy krok to osobny obraz z wykładu, bo z kształtu EKG nie odczytasz stężenia.',
  });
  root.classList.add('hw-ka');
  const cleanups: Array<() => void> = [];

  const st = {
    stan: (KOLEJNOSC as readonly string[]).includes(opts.stan ?? '') ? (opts.stan as StanK) : 'norma' as StanK,
    lead: (ODPROWADZENIA as readonly string[]).includes(opts.odpr ?? '') ? (opts.odpr as LeadName) : 'V3' as LeadName,
    widok: opts.widok === '12' ? '12' : '1' as '1' | '12',
    tryb: opts.tryb === 'cwiczenie' ? 'task' : 'play' as 'play' | 'task',
    cechy: true,
  };

  /* ─────────── sterowanie ─────────── */
  const trybChips = chips([{ v: 'play', label: TRYB_UCZ }, { v: 'task', label: TRYB_SPRAWDZ }] as const, st.tryb, (v) => setTryb(v), { label: 'Tryb' });
  const widokChips = chips([{ v: '1', label: 'Jedno odprowadzenie' }, { v: '12', label: '12 odprowadzeń' }] as const, st.widok, (v) => {
    st.widok = v; syncWidok(); redraw(false); pojaw(st.widok === '1' ? strip : box12);
  }, { label: 'Widok', small: true });
  body.append(h('div', { class: 'hw-bar' }, trybChips.el, widokChips.el));

  const sl = slider({
    label: 'Potas', min: 0, max: KOLEJNOSC.length - 1, step: 1, value: KOLEJNOSC.indexOf(st.stan),
    fmt: (i) => STANY[KOLEJNOSC[i] ?? 'norma'].krotko,
    onInput: (i) => setStan(KOLEJNOSC[i] ?? 'norma'),
  });
  const ends = h('div', { class: 'hw-ka-ends', 'aria-hidden': 'true' }, h('span', { text: '← niższy potas' }), h('span', { text: 'wyższy potas →' }));
  const leadChips = chips(ODPROWADZENIA.map((l) => ({ v: l, label: l })), st.lead, (v) => { st.lead = v; redraw(true); live(`Odprowadzenie ${v}.`); }, { label: 'Odprowadzenie', small: true });
  const ctl = h('div', { class: 'hw-grid' }, h('div', {}, sl.el, ends), leadChips.el);
  body.append(ctl);

  /* ─────────── pasek ─────────── */
  const mLead = h('span', {}), mState = h('b', {});
  const strip = h('div', { class: 'hw-screen' }, h('div', { class: 'hw-mbar' }, h('span', {}, mLead, ' · 25 mm/s · 10 mm/mV'), mState));
  const stripWrap = h('div', { class: 'hw-ka-wrap' });
  strip.append(stripWrap);
  const box12 = h('div', { class: 'hw-ka-wrap' });
  // scena: pasek, 12 odprowadzeń i opis; w „Sprawdź się” idzie pod polecenie (ex.miejsce)
  const stage = h('div', { class: 'hw-stack' }, strip, box12);
  body.append(stage);

  let S: Surface | null = null;
  let geo = { mm: 5, yBase: 100, top: 40, H: 200 };
  const so = { height: 220, label: 'Pasek EKG w wybranym odprowadzeniu' };
  const layout = () => {
    const W = Math.max(280, stripWrap.clientWidth || 600);
    const mm = clamp(W / (3.2 * 25), 3.5, 8);
    const z = zakres(st.lead);
    const top = 50;
    const yBase = top + (z.mx * 10 + 2) * mm;
    const H = Math.round(yBase + (-z.mn * 10 + 3) * mm);
    geo = { mm, yBase, top, H };
    if (so.height !== H) { so.height = H; stripWrap.style.height = `${H}px`; }
  };
  const sf = surface(stripWrap, so, (x) => { S = x; draw(); });
  cleanups.push(() => sf.destroy());
  const ro = new ResizeObserver(() => { layout(); draw(); });
  ro.observe(strip);
  cleanups.push(() => ro.disconnect());

  const t12 = twelve(box12, () => pobudzenie(st.stan, true), { label: 'Dwanaście odprowadzeń w wybranym stanie' });
  cleanups.push(() => t12.destroy());

  function draw() {
    if (!S || !S.w) return;
    const { ctx, w } = S;
    const { mm, yBase, top } = geo;
    const H = S.h;
    ctx.clearRect(0, 0, w, H);
    paper(ctx, 0, 0, w, H, mm, { bg: C.screen, y0: yBase });
    // cecha 1 mV
    ctx.strokeStyle = C.txt2; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(0, yBase); ctx.lineTo(mm, yBase); ctx.lineTo(mm, yBase - 10 * mm); ctx.lineTo(6 * mm, yBase - 10 * mm); ctx.lineTo(6 * mm, yBase); ctx.lineTo(7 * mm, yBase); ctx.stroke();
    const xOf = (t: number) => t * 25 * mm;
    const t0 = 8 / 25, t1 = w / (25 * mm);
    trace(ctx, (t) => napiecie(st.stan, st.lead, t), { x: xOf(t0), w: w - xOf(t0), t0, t1, y0: yBase, pxPerMv: 10 * mm, color: C.puls, width: 1.7 });
    ctx.fillStyle = C.txt2; ctx.font = `500 13px ${C.fontMono}`; ctx.textAlign = 'left';
    ctx.fillText(st.lead, 8 * mm + 4, 16);
    if (!st.cechy) return;
    // numerowane znaczniki cech na drugim pobudzeniu
    const tq = T1 + STANY[st.stan].rr;
    const m = miejscaCech(st.stan).sort((a, b) => a.t - b.t);
    m.forEach((c, i) => {
      const num = STANY[st.stan].cechy.indexOf(c.cecha) + 1;
      const yM = i % 2 ? 31 : 12;
      if (c.do !== undefined) {
        const xa = xOf(tq + c.t), xb = xOf(tq + c.do), y = top - 6;
        ctx.save(); ctx.strokeStyle = C.alarm; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.moveTo(xa, y - 4); ctx.lineTo(xa, y + 4); ctx.moveTo(xb, y - 4); ctx.lineTo(xb, y + 4); ctx.stroke();
        ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo((xa + xb) / 2, y); ctx.lineTo((xa + xb) / 2, yM + 8); ctx.stroke();
        ctx.restore();
        marker(ctx, (xa + xb) / 2, yM, num);
      } else {
        const x = xOf(tq + c.t), yv = yBase - napiecie(st.stan, st.lead, tq + c.t) * 10 * mm;
        ctx.save(); ctx.strokeStyle = C.alarm; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yM + 8); ctx.lineTo(x, yv - 4); ctx.stroke(); ctx.restore();
        marker(ctx, x, yM, num);
      }
    });
  }
  function marker(ctx: CanvasRenderingContext2D, x: number, y: number, n: number) {
    ctx.save();
    ctx.fillStyle = C.screen; ctx.strokeStyle = C.alarm; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.txt; ctx.font = `500 12px ${C.fontMono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x, y + 0.5);
    ctx.restore();
  }

  /* ─────────── opis ─────────── */
  const big = h('span', { class: 'hw-cat' });
  const list = h('ul', { class: 'hw-list' });
  const why = h('p', { class: 'hw-why' });
  const pearl = h('p', { class: 'hw-pearl', html: '<span class="hw-label">Zastrzeżenie</span>Zmiany nie zawsze pojawiają się w tej kolejności, a prawidłowy zapis może towarzyszyć nawet ciężkiej hiperkaliemii. Z wysokości T nie odczytasz stężenia potasu: oznacz potas.' });
  const read = h('div', { class: 'hw-read' }, big, list, why, pearl);
  stage.append(read);

  function texts() {
    const s0 = STANY[st.stan];
    big.textContent = s0.nazwa;
    big.className = 'hw-cat ' + (s0.grupa === 'norma' ? '' : 'hw-bad');
    list.innerHTML = s0.cechy.length
      ? s0.cechy.map((c, i) => `<li><span>${st.widok === '1' ? `znacznik ${i + 1}` : `cecha ${i + 1}`}</span><b>${CECHY[c]}</b></li>`).join('')
      : '<li><span>Cechy</span><b>brak cech zaburzeń potasu</b></li>';
    why.innerHTML = s0.opis + (st.stan === 'hipo' ? ' Falę U najlepiej widać w odprowadzeniach przedsercowych, często w V2-V3.' : '');
    mLead.textContent = st.widok === '1' ? st.lead : '12 odprowadzeń';
    mState.textContent = s0.krotko;
  }

  /* ─────────── przejścia ─────────── */
  function redraw(withFade: boolean) {
    if (st.widok === '1') { const run = () => { layout(); draw(); }; if (withFade) crossfade(stripWrap, run); else run(); }
    else if (withFade) crossfade(t12.el, t12.redraw); else t12.redraw();
    texts();
  }
  function setStan(s0: StanK) {
    if (s0 === st.stan) return;
    st.stan = s0;
    redraw(true);
    live(`${STANY[s0].nazwa}.`);
  }
  function syncWidok() {
    widokChips.set(st.widok);
    strip.hidden = st.widok !== '1';
    box12.hidden = st.widok !== '12';
    leadChips.el.hidden = st.widok !== '1' || st.tryb === 'task';
  }

  /* ─────────── ćwiczenie ─────────── */
  type Runda = { typ: 'rozpoznaj'; stan: StanK; lead: LeadName } | { typ: 'kolejnosc'; uklad: StanK[] };
  const exBox = h('div', { class: 'hw-grid' });
  const lit = (i: number) => 'ABC'[i] ?? '';
  let pool: StanK[] = [];
  let opt: ReturnType<typeof options> | null = null;
  let ulozone: StanK[] = [];
  let thumbs: Array<{ stan: StanK; litera: string; btn: HTMLButtonElement; badge: HTMLElement; destroy: () => void }> = [];
  const clearThumbs = () => { thumbs.forEach((t) => t.destroy()); thumbs = []; };
  cleanups.push(clearThumbs);

  const ex = exercise<Runda>({
    rounds: 5,
    make: (i) => {
      if (i === 0) pool = shuffle([...KOLEJNOSC]);
      if (i === 4) {
        let u = shuffle([...KOLEJNOSC_CWICZENIA]);
        while (ocenKolejnosc(u)) u = shuffle(u);
        return { typ: 'kolejnosc', uklad: u };
      }
      return { typ: 'rozpoznaj', stan: pool[i] ?? 'norma', lead: ODPROWADZENIA[Math.floor(Math.random() * ODPROWADZENIA.length)] ?? 'V3' };
    },
    show: (r) => {
      clearThumbs(); exBox.replaceChildren(); opt = null; ulozone = [];
      st.cechy = false;
      if (r.typ === 'rozpoznaj') {
        const bylUkryty = strip.hidden;
        st.widok = '1'; st.stan = r.stan; st.lead = r.lead; leadChips.set(r.lead);
        syncWidok(); strip.hidden = false; read.hidden = true;
        opt = options(KOLEJNOSC.map((s0) => ({ v: s0, label: STANY[s0].nazwa })), () => ex.odswiez());
        exBox.append(opt.el);
        // pasek wcześniej ukryty ma stary obraz, więc zamiast migawki pojawia się w całości
        redraw(!bylUkryty);
        if (bylUkryty) pojaw(strip);
      } else {
        strip.hidden = true; box12.hidden = true; read.hidden = true;
        const grid = h('div', { class: 'hw-ka-thumbs', role: 'group', 'aria-label': 'Obrazy do ułożenia' });
        r.uklad.forEach((s0, i) => {
          const badge = h('span', { class: 'hw-ka-badge', text: `${lit(i)} · wybierz` });
          const cv = h('div', {});
          const btn = h('button', { type: 'button', class: 'hw-panel hw-ka-thumb', 'aria-pressed': 'false' }, badge, cv);
          grid.append(btn);
          const surf = surface(cv, { height: 92, label: `Obraz ${lit(i)}, odprowadzenie II` }, (x) => drawThumb(x, s0));
          btn.addEventListener('click', () => pickThumb(s0));
          thumbs.push({ stan: s0, litera: lit(i), btn, badge, destroy: () => surf.destroy() });
        });
        const clear = button('Wyczyść kolejność', () => { ulozone = []; syncThumbs(); ex.odswiez(); live('Kolejność wyczyszczona.'); }, 'ghost');
        exBox.append(grid, h('div', { class: 'hw-row' }, clear));
        syncThumbs();
        pojaw(grid);
      }
    },
    prompt: (r) => r.typ === 'rozpoznaj'
      ? `Który obraz widzisz w ${r.lead}? Wybierz odpowiedź i naciśnij „Sprawdź”.`
      : 'Ułóż trzy obrazy hiperkaliemii od najmniej do najbardziej zaawansowanego: wybieraj je po kolei. Potem naciśnij „Sprawdź”.',
    gotowe: (r) => r.typ === 'rozpoznaj' ? (opt?.picked() ?? null) !== null : ulozone.length === KOLEJNOSC_CWICZENIA.length,
    check: (r) => {
      if (r.typ === 'rozpoznaj') {
        const picked = (opt?.picked() ?? null) as StanK | null;
        opt?.reveal(r.stan, picked);
        st.cechy = true; read.hidden = false; redraw(false); pojaw(read);
        const s0 = STANY[r.stan];
        const cechy = s0.cechy.length ? `Na pasku widzisz: ${s0.cechy.map((c) => CECHY[c]).join(', ')}. ` : '';
        return {
          ...(picked ? werdyktRozpoznania(r.stan, picked) : { ok: false, prawidlowo: STANY[r.stan].nazwa }),
          why: cechy + s0.opis + (s0.cechy.length ? ' Numery na pasku pokazują, gdzie szukać tych cech.' : ''),
        };
      }
      thumbs.forEach((t) => {
        const k = KOLEJNOSC_CWICZENIA.indexOf(t.stan);
        t.badge.textContent = `${k + 1} · ${STANY[t.stan].krotko}`; t.btn.disabled = true;
        t.btn.setAttribute('aria-label', `Obraz ${t.litera}: ${STANY[t.stan].krotko}, w wykładzie miejsce ${k + 1}`);
      });
      return {
        ...werdyktKolejnosci(ulozone),
        why: 'Wykład opisuje najpierw wysokie, wąskie T. Gdy stężenie rośnie bardzo, pobudzenie rozchodzi się wolniej, QRS się poszerza, a P może zniknąć. W skrajnej postaci QRS zlewa się z T w sinusoidę. '
          + '<b>Zmiany nie zawsze pojawiają się w tym porządku</b>, a prawidłowy zapis może towarzyszyć nawet ciężkiej hiperkaliemii. Na kafelkach widzisz teraz miejsce każdego obrazu w wykładzie.',
      };
    },
    live,
  });
  body.append(ex.el);

  function drawThumb(x: Surface, s0: StanK) {
    const { ctx, w, h: H } = x;
    const mm = clamp(w / (1.7 * 25), 2.6, 6), yBase = H * 0.62;
    ctx.clearRect(0, 0, w, H);
    paper(ctx, 0, 0, w, H, mm, { bg: C.screen, y0: yBase });
    const off = T1 + STANY[s0].rr - 0.45;
    trace(ctx, (t) => napiecie(s0, 'II', t + off), { x: 0, w, t0: 0, t1: w / (25 * mm), y0: yBase, pxPerMv: Math.min(10 * mm, (H * 0.55) / 1.3), color: C.puls, width: 1.5 });
  }
  function pickThumb(s0: StanK) {
    if (ex.isChecked()) return;
    const i = ulozone.indexOf(s0);
    if (i >= 0) ulozone.splice(i, 1); else ulozone.push(s0);
    syncThumbs();
    ex.odswiez();
    live(ulozone.length ? `Ułożone: ${ulozone.length} z 3.` : 'Kolejność wyczyszczona.');
  }
  function syncThumbs() {
    thumbs.forEach((t) => {
      const k = ulozone.indexOf(t.stan);
      t.btn.setAttribute('aria-pressed', k >= 0 ? 'true' : 'false');
      t.btn.setAttribute('aria-label', k >= 0 ? `Obraz ${t.litera}, miejsce ${k + 1}` : `Obraz ${t.litera}, jeszcze nie ułożony`);
      t.badge.textContent = k >= 0 ? `${t.litera} · miejsce ${k + 1}` : `${t.litera} · wybierz`;
    });
  }

  function setTryb(m: 'play' | 'task', anim = true) {
    st.tryb = m; trybChips.set(m);
    ctl.hidden = m === 'task';
    widokChips.disable(m === 'task');
    ex.el.hidden = m !== 'task';
    if (m === 'task') {
      ex.miejsce.replaceChildren(stage, exBox);
      ex.start();
      if (anim) pojaw(ex.el);
    } else {
      clearThumbs(); exBox.replaceChildren(); st.cechy = true; read.hidden = false;
      ctl.after(stage);
      st.stan = KOLEJNOSC[sl.value] ?? 'norma';
      st.widok = widokChips.value; syncWidok(); redraw(false);
      if (anim) pojaw(stage);
    }
  }

  syncWidok();
  setTryb(st.tryb, false);
  return () => { cleanups.forEach((f) => f()); host.replaceChildren(); };
}
