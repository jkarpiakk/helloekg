/**
 * Co kryje się za wąskim częstoskurczem — kardiomonitor z wąskim, miarowym częstoskurczem, próba Valsalvy
 * i adenozyna jako narzędzie diagnostyczne (przejściowe zwolnienie przewodzenia przez węzeł AV),
 * schemat pętli (droga wolna i szybka, droga dodatkowa, tor trzepotania, ognisko) i wydruk odpowiedzi.
 * Wykłady: S6_03 („Wąskie QRS: rodzina nadkomorowa”), S6_01 (przypadki 4 i 5).
 *
 * Opcje dyrektywy: rytm=avnrt|avrt|trzepotanie|przedsionkowy|zatokowa (domyślnie avnrt), tryb=cwiczenie.
 *
 * Pokazujemy zjawisko diagnostyczne, nie instrukcję leczenia: bez dawek, bez algorytmu.
 */
import { C, TRYB_SPRAWDZ, TRYB_UCZ, chips, exercise, h, loop, options, paper, reducedMotion, s, setA, shell, shuffle, surface, trace, type Surface, type WstawkaOpts } from './core/ui.js';
import { scenaPrzenikana } from './core/obrazy.js';
import { tor } from './core/dzwiek.js';
import { Strip, bgFlutter, monitor, pComps, playToggle, vBeat, type Monitor, type StripEvent } from './core/rytm.js';
import type { Beat, Comp, LeadName } from './core/model.js';
import {
  CYKL, F_OKRES, OPCJE, OPIS, P_AVNRT, ZADANIA, faza, scena, maFaleF, maOpisOdpowiedzi, odpowiedz, okno, petlaPrzezWezel, rytmZOpcji, zdarzenia,
  type Interwencja, type KsztaltP, type Manewr, type Rytm, type Zadanie, type Zd,
} from './adenozyna.dane.js';

const CSS = `
.ade [hidden]{display:none!important}
.ade .hw-chip--sm{min-height:44px}
.ade .hw-chip{white-space:normal;line-height:1.2;text-align:center}
.ade-ctrl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ade-resp{display:grid;gap:6px}
.ade-scene{margin:0;display:grid;gap:4px}
.ade-cap{font:12px/1.45 var(--hw-f-m);color:var(--hw-txt2);text-align:center;margin:0}
.ade-hold{font:12px/1.5 var(--hw-f-m);color:var(--hw-txt3);text-align:center;padding:40px 12px}
`;
let styled = false;
function ensureLocalStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.setAttribute('data-hw-ade', '');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/**
 * Przenikanie bez timera: stan zmienia się od razu, a ekran przygasa i wraca, zaczynając od bieżącego krycia.
 * Nowe wywołanie przerywa poprzednie, więc szybkie klikanie niczego nie blokuje i niczego nie nakłada.
 */
function przenikanie(els: HTMLElement[]): { run(fn: () => void, animuj?: boolean): void; stop(): void } {
  let anims: Animation[] = [];
  const krycie = (el: HTMLElement): number => {
    if (typeof getComputedStyle !== 'function') return 1;
    const v = parseFloat(getComputedStyle(el).opacity);
    return Number.isFinite(v) ? v : 1;
  };
  return {
    run(fn, animuj = true) {
      const od = els.map(krycie);
      anims.forEach((a) => a.cancel()); anims = [];
      fn();
      if (!animuj || reducedMotion()) return;
      els.forEach((el, i) => {
        if (typeof el.animate !== 'function') return;
        anims.push(el.animate([{ opacity: od[i] ?? 1 }, { opacity: 0.2, offset: 0.25 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' }));
      });
    },
    stop() { anims.forEach((a) => a.cancel()); anims = []; },
  };
}

/** Nazwa rytmu w środku zdania: małą literą, skróty (AVNRT) bez zmian. */
const wZdaniu = (t: string): string => (/^\p{Lu}{2}/u.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));

const RYTM_ITEMS: ReadonlyArray<{ v: Rytm; label: string }> = [
  { v: 'avnrt', label: 'AVNRT' },
  { v: 'avrt', label: 'AVRT' },
  { v: 'trzepotanie', label: 'Trzepotanie 2:1' },
  { v: 'przedsionkowy', label: 'Częstoskurcz przedsionkowy' },
  { v: 'zatokowa', label: 'Tachykardia zatokowa' },
];
/** Pokrętła T w modelu: krótszy QT przy szybkim rytmie, żeby T nie wchodził w następny QRS. */
const T_PARAM: Record<Rytm, { qt: number; tSharp: number }> = {
  avnrt: { qt: 0.26, tSharp: 1.3 }, avrt: { qt: 0.25, tSharp: 1.3 }, trzepotanie: { qt: 0.3, tSharp: 1.2 },
  przedsionkowy: { qt: 0.28, tSharp: 1.2 }, zatokowa: { qt: 0.32, tSharp: 1.1 },
};
const NAZWA_M: Record<Manewr, string> = { valsalva: 'Próba Valsalvy', adenozyna: 'Adenozyna' };

export function mountAdenozyna(host: HTMLElement, opts: WstawkaOpts): () => void {
  ensureLocalStyle();
  const { root, body, live } = shell(host, {
    label: 'Wstawka · wąski częstoskurcz',
    title: 'Przymknij bramę AV i zobacz, co kryje wąski częstoskurcz.',
    intro: 'Przejściowe zwolnienie przewodzenia przez węzeł AV potrafi przerwać napad albo odsłonić przedsionki. Wybierz rytm i sprawdź, co robi próba Valsalvy, a co adenozyna.',
  });
  root.classList.add('ade');

  let rytm: Rytm = rytmZOpcji(opts.rytm);
  let mode: 'play' | 'task' = opts.tryb === 'cwiczenie' ? 'task' : 'play';
  let reveal = mode === 'play';
  let iv: Interwencja | null = null;
  let lead: LeadName = 'II';
  let printPending = false;
  let mounted = false;
  // układ wąski/szeroki: długość okna monitora i liczba rzędów wydruku; przebudowa przy obrocie telefonu
  let narrow = (root.clientWidth || 700) < 560;
  let SEC = narrow ? 5 : 7;
  let ROWS = narrow ? 2 : 1;
  const cleanups: Array<() => void> = [];

  /* ─────────── zdarzenia ─────────── */
  const P_K: Record<KsztaltP, Comp[]> = { normal: pComps('normal'), retro: pComps('retro', 1.5), 'retro-avnrt': P_AVNRT.map((c) => ({ ...c, v: c.v })), 'ectopic-low': pComps('ectopic-low', 2) };
  const sinusBeat = vBeat({});
  let tachy: Beat = vBeat(T_PARAM[rytm]);
  const toEvent = (e: Zd): StripEvent => e.kind === 'P'
    ? { kind: 'P', at: e.at, comps: P_K[e.ksztalt] }
    : { kind: 'QRS', at: e.at, beat: e.typ === 'zatokowy' ? sinusBeat : tachy };
  const flutterBg = bgFlutter(300, 0.17);
  const strip = new Strip();
  let gen = -Infinity;
  const fill = (now: number) => {
    const from = Math.max(gen, now - SEC - 1), to = now + 1;
    if (to <= from) return;
    for (const e of zdarzenia(rytm, iv, from, to)) strip.add(toEvent(e));
    gen = to;
    strip.prune(now - 40);
  };

  /* ─────────── schemat pętli ─────────── */
  const sch = schemat();
  const schHold = h('p', { class: 'ade-hold', text: 'Schemat pojawi się po sprawdzeniu.' });
  const scene = scenaPrzenikana('bramaOtwarta', { maxH: 150 });
  const sceneCap = h('figcaption', { class: 'ade-cap' });
  const sceneWrap = h('figure', { class: 'ade-scene' }, scene.el, sceneCap);
  const schBox = h('div', { class: 'hw-panel hw-stack' }, sceneWrap, sch.svg, schHold);

  /** Klucz ostatniego stanu schematu i paska HR (żeby nie dotykać DOM co klatkę). */
  let lastKey = '';

  /* ─────────── monitor ─────────── */
  const hrOut = h('b');
  const leadOut = h('span');
  const scr = h('div', { class: 'hw-screen' }, h('div', { class: 'hw-mbar' }, h('span', {}, h('span', { class: 'hw-dot' }), leadOut), hrOut));
  const monBox = h('div');
  scr.append(monBox);
  /**
   * Zegar zapisu = zegar monitora + przesunięcie. Po przebudowie monitora (inne okno w sekundach)
   * przesunięcie trzyma ciągłość czasu, więc trwający manewr i wydruk zostają.
   */
  let off = 0;
  // ton QRS w odtwarzaniu: słychać częstoskurcz, pauzę po adenozynie i powrót rytmu zatokowego
  const snd = tor(monBox, { ciagly: true });
  let prevT = NaN;
  const dzwiekQrs = (t: number, dt: number) => {
    // tylko płynne odtwarzanie (krok pętli ≤ 0,06 s); przebudowa i wypełnianie na starcie bez dźwięku
    const plynnie = dt > 0 && dt <= 0.06 && t > prevT && t - prevT < 0.2;
    const t0 = prevT; prevT = t;
    if (!plynnie || !snd.aktywny()) return;
    for (const e of strip.inRange(t0, t)) if (e.kind === 'QRS' && e.at > t0 && e.at <= t) snd.qrs();
  };
  const makeMon = (): Monitor => monitor(monBox, {
    seconds: SEC, mode: 'sweep', height: 150, scale: 'fit', base: 0.6, fitMv: 1.5,
    signal: (t) => strip.volt(t + off, lead),
    label: 'Kardiomonitor z wąskim częstoskurczem',
    tick: (now, dt) => { fill(now + off); dzwiekQrs(now + off, dt); onTick(now + off); },
  });
  let mon = makeMon();
  const clock = () => mon.now() + off;

  /* ─────────── wydruk ─────────── */
  const printLabel = h('span');
  const printBox = h('div');
  const printWrap = h('div', { class: 'hw-screen', hidden: true }, h('div', { class: 'hw-mbar' }, printLabel, h('span', { text: '25 mm/s' })), printBox);
  const makePrint = () => surface(printBox, { height: ROWS === 2 ? 250 : 140, label: 'Wydruk EKG z chwili zwolnienia przewodzenia przez węzeł AV' }, (sf) => drawPrint(sf));
  let pr = makePrint();

  /* ─────────── sterowanie ─────────── */
  const modeChips = chips([{ v: 'play', label: TRYB_UCZ }, { v: 'task', label: TRYB_SPRAWDZ }] as const, mode, (v) => setMode(v), { label: 'Tryb wstawki' });
  const rytmChips = chips(RYTM_ITEMS, rytm, (v) => setRytm(v, true), { label: 'Rytm na monitorze', small: true });
  const leadChips = chips([{ v: 'II', label: 'II' }, { v: 'V1', label: 'V1' }] as const, 'II', (v) => { lead = v; paintLead(); mon.redraw(); drawPrint(); live(`Odprowadzenie ${v}.`); }, { label: 'Odprowadzenie', small: true });
  let playBtn = playToggle(mon);
  // dwie równorzędne próby: żadna nie jest „główna”, więc obie w wariancie ghost
  const valBtn = h('button', { class: 'hw-btn hw-btn--ghost', type: 'button', text: 'Wykonaj próbę Valsalvy' });
  const adeBtn = h('button', { class: 'hw-btn hw-btn--ghost', type: 'button', text: 'Podaj adenozynę' });
  const resetBtn = h('button', { class: 'hw-btn hw-btn--ghost', type: 'button', text: 'Wróć do częstoskurczu' });
  valBtn.addEventListener('click', () => apply('valsalva', 0.15));
  adeBtn.addEventListener('click', () => apply('adenozyna', 0.15));
  resetBtn.addEventListener('click', () => { resetRytm(); live(`${OPIS[rytm].nazwa} od nowa.`); });
  const actNote = h('p', { class: 'hw-note' });
  const actions = h('div', { class: 'ade-ctrl' }, valBtn, adeBtn, resetBtn);

  /* ─────────── opis ─────────── */
  const tName = h('h4', { class: 'hw-cat' });
  const tText = h('p', { class: 'hw-why' });
  const tags = h('div', { class: 'hw-tags' });
  const rTitle = h('p', { class: 'hw-verdict' });
  const rText = h('p', { class: 'hw-why' });
  const rNote = h('p', { class: 'hw-pearl' });
  const resp = h('div', { class: 'ade-resp', hidden: true }, rTitle, rText, rNote);
  const pearl = h('p', { class: 'hw-note', text: 'Adenozynę podajesz przy monitorowanym EKG i w gotowości do resuscytacji. Nie podajesz jej w migotaniu z preekscytacją.' });
  const info = h('div', { class: 'hw-read' }, tName, tText, tags, resp, pearl);

  /* ─────────── ćwiczenie ─────────── */
  let order: Zadanie[] = [];
  const opt = options(OPCJE, () => ex.odswiez());
  const ex = exercise<Zadanie>({
    rounds: ZADANIA.length,
    make: (i) => { if (i === 0 || order.length === 0) order = shuffle([...ZADANIA]); return order[i] ?? ZADANIA[0]!; },
    show: (z) => {
      opt.reset(); reveal = false;
      setRytm(z.rytm, false);
      apply(z.co, 1.5, true);
    },
    prompt: 'Odczytaj wydruk: porównaj zapis przed zwolnieniem przewodzenia AV, w trakcie i po nim. Co odsłoniło to zwolnienie?',
    gotowe: () => opt.picked() !== null,
    check: (z) => {
      const p = opt.picked();
      opt.reveal(z.rytm, p);
      reveal = true; paintAll();
      const nazwa = wZdaniu(OPIS[z.rytm].nazwa);
      const ok = p === z.rytm;
      // werdykt z nazwą rozpoznania: „Dobrze. To AVNRT.” / „Nie. Prawidłowo: trzepotanie przedsionków 2:1.”
      return { ok, prawidlowo: nazwa, szczegol: ok ? `To ${nazwa}.` : undefined, why: z.dlaczego };
    },
    live,
  });
  ex.miejsce.append(opt.el);

  const left = h('div', { class: 'hw-stack' }, scr, h('div', { class: 'ade-ctrl' }, leadChips.el, playBtn), actions, actNote);
  const right = h('div', { class: 'hw-stack' }, schBox, info);
  body.append(
    h('div', { class: 'hw-bar' }, modeChips.el),
    h('div', { class: 'hw-bar' }, rytmChips.el),
    h('div', { class: 'hw-2col hw-2col--wide-l', style: 'align-items:start' }, left, right),
    printWrap,
    ex.el,
  );

  /* ─────────── logika ─────────── */
  function paintLead() { leadOut.textContent = `Odprowadzenie ${lead} · 25 mm/s`; printLabel.textContent = `Wydruk z chwili zwolnienia · ${lead}`; }

  function onTick(now: number) {
    const ph = faza(rytm, iv, now);
    const closed = iv !== null && maOpisOdpowiedzi(rytm) && now >= okno(iv, rytm)[0] && now < okno(iv, rytm)[1];
    const sc = scena(rytm, iv, now);
    const key = `${rytm}|${ph}|${closed}|${reveal}|${sc.scena}|${sc.podpis}`;
    if (key !== lastKey) {
      lastKey = key;
      sch.set(rytm, ph, closed);
      // w ćwiczeniu scena zdradziłaby rytm (np. skrót w murze), więc pojawia się po sprawdzeniu
      sceneWrap.hidden = !reveal;
      if (reveal) { scene.set(sc.scena); sceneCap.textContent = `„${sc.podpis}”`; }
      hrOut.textContent = !reveal ? '' : ph === 'ustapil' ? 'rytm zatokowy' : closed ? 'komory zwalniają' : OPIS[rytm].hr;
    }
    if (printPending && iv && now > okno(iv, rytm)[1] + 1.2) showPrint();
  }

  function resetRytm() {
    iv = null; printPending = false;
    tachy = vBeat(T_PARAM[rytm]);
    strip.clear(); strip.backgrounds = maFaleF(rytm) ? [flutterBg] : [];
    gen = -Infinity; fill(clock());
    printWrap.hidden = true; resp.hidden = true;
    lastKey = ''; onTick(clock()); mon.redraw();
    paintActions();
  }
  function paintActions() {
    const can = maOpisOdpowiedzi(rytm);
    valBtn.disabled = !can || iv !== null || mode === 'task';
    adeBtn.disabled = !can || iv !== null || mode === 'task';
    resetBtn.disabled = iv === null || mode === 'task';
    actions.hidden = mode === 'task';
    actNote.hidden = mode === 'task';
    actNote.textContent = !can
      ? odpowiedz(rytm, 'adenozyna').tekst
      : iv ? 'Patrz na monitor. Wydruk z tej chwili pojawi się pod spodem.' : 'Zwolnienie przewodzenia przez węzeł AV pokazuje, czym jest ten częstoskurcz.';
    if (iv && !printPending) actNote.textContent = 'Wydruk z tej chwili masz pod spodem. Możesz wrócić do częstoskurczu i spróbować drugiej próby.';
  }
  function paintInfo() {
    const o = OPIS[rytm];
    tName.textContent = o.nazwa; tText.textContent = o.tekst;
    tags.replaceChildren(...o.tagi.map(([k, v]) => h('span', { class: 'hw-tag' }, `${k} `, h('b', { text: v }))));
  }
  function paintAll() {
    info.hidden = !reveal;
    sch.svg.style.display = reveal ? '' : 'none';
    schHold.hidden = reveal;
    paintInfo(); paintLead(); paintActions();
    lastKey = ''; onTick(clock());
    if (iv && reveal && !printPending) paintResp();
  }
  function paintResp() {
    if (!iv) return;
    const o = odpowiedz(rytm, iv.co);
    rTitle.textContent = o.tytul; rText.textContent = o.tekst;
    rNote.hidden = !o.uwaga; rNote.textContent = o.uwaga ?? '';
    resp.hidden = !reveal;
  }

  function apply(co: Manewr, lead0: number, printNow = false) {
    if (!maOpisOdpowiedzi(rytm) || iv) return;
    const now = clock();
    iv = { co, at: now + lead0 };
    strip.events = strip.events.filter((e) => e.at <= now + 0.1);
    gen = now + 0.1; fill(now);
    printPending = true;
    if (printNow || mon.paused() || reducedMotion()) showPrint();
    paintActions();
    if (mode === 'play') live(`${NAZWA_M[co]}. Patrz na monitor${mon.paused() ? ' i na wydruk' : ''}.`);
  }
  function showPrint() {
    printPending = false;
    printWrap.hidden = false;
    drawPrint();
    paintActions();
    if (reveal) {
      paintResp();
      if (iv) live(`${odpowiedz(rytm, iv.co).tytul}. ${odpowiedz(rytm, iv.co).tekst}`);
    }
  }
  function drawPrint(sf?: Surface) {
    if (!iv) return;
    const { ctx, w, h: H } = sf ?? pr.s;
    if (!w) return;
    ctx.clearRect(0, 0, w, H);
    const [e0, e1] = okno(iv, rytm);
    const tA = iv.at - 1.5, tB = e1 + 2.5, per = (tB - tA) / ROWS, rowH = H / ROWS;
    const ps = new Strip();
    for (const e of zdarzenia(rytm, iv, tA - 1, tB + 0.5)) ps.add(toEvent(e));
    ps.backgrounds = maFaleF(rytm) ? [flutterBg] : [];
    const pxPerSec = w / per, pxPerMm = pxPerSec / 25;
    ctx.font = `500 12px ${C.fontMono}`;
    for (let r = 0; r < ROWS; r++) {
      const y0 = r * rowH, t0 = tA + r * per, t1 = t0 + per;
      const base = y0 + rowH * 0.62;
      const X = (t: number) => (t - t0) * pxPerSec;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y0, w, rowH); ctx.clip();
      paper(ctx, 0, y0, w, rowH, pxPerMm, { y0: base });
      // okno zwolnienia przewodzenia AV (bez podpisu czasem)
      const a = Math.max(e0, t0), b = Math.min(e1, t1);
      if (b > a) {
        ctx.fillStyle = 'rgba(108,180,255,.08)'; ctx.fillRect(X(a), y0, X(b) - X(a), rowH);
        if (e0 >= t0 && e0 < t1) { ctx.fillStyle = C.blue; ctx.fillText(iv.co === 'adenozyna' ? 'brama AV zamknięta' : 'brama AV przymknięta', X(e0) + 6, y0 + rowH - 9); }
      }
      trace(ctx, (t) => ps.volt(t, lead), { x: 0, w, t0, t1, y0: base, pxPerMv: (rowH * 0.55) / 1.5, color: C.puls, width: 1.5 });
      if (iv.at >= t0 && iv.at < t1) {
        const x = X(iv.at);
        ctx.strokeStyle = C.txt; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x, y0 + 20); ctx.lineTo(x, y0 + rowH - 4); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.txt; ctx.beginPath(); ctx.moveTo(x - 5, y0 + 6); ctx.lineTo(x + 5, y0 + 6); ctx.lineTo(x, y0 + 14); ctx.fill();
        ctx.fillText(NAZWA_M[iv.co], x + 8, y0 + 15);
      }
      ctx.restore();
    }
  }

  const fade = przenikanie([scr, schBox]);
  function setRytm(v: Rytm, animuj: boolean) {
    // nowy rytm od razu; przenikanie tylko jako tło, bez czekania na timer
    fade.run(() => {
      rytm = v; rytmChips.set(v);
      resetRytm(); paintAll();
      if (mode === 'play') live(`${OPIS[v].nazwa}. ${OPIS[v].tekst}`);
    }, animuj && mounted);
  }

  /** Przebudowa monitora i wydruku po przekroczeniu 560 px (obrót telefonu, zmiana szerokości kolumny). */
  function rebuild(n: boolean) {
    narrow = n; SEC = n ? 5 : 7; ROWS = n ? 2 : 1;
    const prevNow = clock(), paused = mon.paused();
    mon.destroy(); monBox.replaceChildren();
    off = prevNow - (SEC + 0.001);
    mon = makeMon();
    off = prevNow - mon.now(); // przy „Ogranicz ruch” monitor wypełnia ekran na starcie, więc wyrównaj zegar jeszcze raz
    mon.setPaused(paused);
    mon.redraw();
    const nb = playToggle(mon);
    playBtn.replaceWith(nb); playBtn = nb;
    pr.destroy(); printBox.replaceChildren();
    pr = makePrint();
    drawPrint();
  }
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { const w = root.clientWidth; if (w && (w < 560) !== narrow) rebuild(w < 560); })
    : null;
  ro?.observe(root);
  cleanups.push(() => ro?.disconnect());

  function setMode(md: 'play' | 'task') {
    mode = md; modeChips.set(md);
    rytmChips.el.hidden = md !== 'play';
    ex.el.hidden = md !== 'task';
    if (md === 'task') ex.start();
    else { reveal = true; setRytm(rytm, true); }
  }

  /* animacja schematu: zegar monitora, więc stoi razem z pauzą */
  const lp = loop(sch.svg, () => sch.tick(clock(), rytm, iv));
  cleanups.push(() => lp.stop());

  paintLead();
  strip.backgrounds = maFaleF(rytm) ? [flutterBg] : [];
  setMode(mode);
  mounted = true;
  sch.tick(clock(), rytm, iv);

  return () => {
    fade.stop();
    cleanups.forEach((fn) => fn());
    mon.destroy(); pr.destroy();
    host.replaceChildren();
  };
}

/* ─────────── schemat: przedsionki, brama AV z odźwiernym, komory, pętle ─────────── */

const PATH: Partial<Record<Rytm, string>> = {
  // mała pętla w węźle: w dół lewą stroną (droga wolna), w górę prawą (droga szybka)
  avnrt: 'M124 100C110 104 110 128 124 132C138 128 138 104 124 100Z',
  // duża pętla: w dół przez bramę i pęczek Hisa, w górę drogą dodatkową
  avrt: 'M124 66V172L84 204H22V66H124',
  // tor w prawym przedsionku (po lewej stronie rysunku: widok od przodu)
  trzepotanie: 'M24 58A46 24 0 1 0 116 58A46 24 0 1 0 24 58Z',
};

function schemat() {
  const svg = s('svg', { viewBox: '0 0 240 250', class: 'hw-svg', role: 'img', 'aria-label': 'Schemat: przedsionki, brama AV, komory' });
  const txt = (t: string, x: number, y: number, o: Record<string, string | number> = {}) =>
    s('text', { x, y, fill: C.label, 'font-size': 12, 'letter-spacing': '.04em', text: t, ...o }, svg);
  s('rect', { x: 10, y: 8, width: 220, height: 88, rx: 12, fill: 'none', stroke: C.line2 }, svg);
  s('rect', { x: 10, y: 170, width: 220, height: 72, rx: 12, fill: 'none', stroke: C.line2 }, svg);
  txt('PRZEDSIONKI', 18, 26); txt('KOMORY', 18, 234);
  s('path', { d: 'M124 136V172M124 172L84 204M124 172L164 204', stroke: C.txt3, 'stroke-width': 2, fill: 'none' }, svg);

  /* pętle (pod bramą, żeby słupki je przykrywały) */
  const loops = {} as Record<'avnrt' | 'avrt' | 'trzepotanie', SVGPathElement>;
  for (const k of ['avnrt', 'avrt', 'trzepotanie'] as const) {
    loops[k] = s('path', { d: PATH[k], fill: 'none', stroke: C.puls, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
  }
  const gAvnrt = s('g', {}, svg);
  txt('droga wolna', 104, 154, { 'text-anchor': 'end' }); gAvnrt.append(svg.lastChild!);
  txt('droga szybka', 144, 154); gAvnrt.append(svg.lastChild!);
  const arrows: SVGElement[] = [];
  arrows.push(s('path', { d: 'M110 114l3 6 3-6z', fill: C.puls }, gAvnrt));
  arrows.push(s('path', { d: 'M132 120l3-6 3 6z', fill: C.puls }, gAvnrt));
  // z kółka pobudzenie rozchodzi się jednocześnie w górę (przedsionki) i w dół (komory)
  arrows.push(s('path', { d: 'M124 98V84M120 89l4-6 4 6M124 134V160M120 155l4 6 4-6', stroke: C.puls, 'stroke-width': 1.6, fill: 'none' }, gAvnrt));
  const gAvrt = s('g', {}, svg);
  txt('droga', 28, 140); gAvrt.append(svg.lastChild!);
  txt('dodatkowa', 28, 154); gAvrt.append(svg.lastChild!);
  arrows.push(s('path', { d: 'M19 126l3-7 3 7z', fill: C.puls }, gAvrt));
  arrows.push(s('path', { d: 'M121 150l3 7 3-7z', fill: C.puls }, gAvrt));
  const gFl = s('g', {}, svg);
  txt('duży tor', 70, 62, { 'text-anchor': 'middle' }); gFl.append(svg.lastChild!);
  s('path', { d: 'M104 80L117 97', stroke: C.puls, 'stroke-width': 1.4, 'stroke-dasharray': '3 3' }, gFl);
  s('path', { d: 'M73 31l-7 3 7 3z', fill: C.puls }, gFl);
  const gAT = s('g', {}, svg);
  const atRing = s('circle', { cx: 168, cy: 52, r: 6, fill: 'none', stroke: C.puls, 'stroke-width': 1.4 }, gAT);
  s('circle', { cx: 168, cy: 52, r: 4.5, fill: C.puls }, gAT);
  txt('ognisko', 178, 56); gAT.append(svg.lastChild!);
  const gSin = s('g', {}, svg);
  const sinRing = s('circle', { cx: 40, cy: 52, r: 6, fill: 'none', stroke: C.puls, 'stroke-width': 1.4 }, gSin);
  s('circle', { cx: 40, cy: 52, r: 4.5, fill: C.puls }, gSin);
  txt('dyrygent', 50, 56); gSin.append(svg.lastChild!);

  /* brama (czysty schemat, bez postaci; metaforę niesie scena z rastra nad schematem) */
  s('rect', { x: 107, y: 98, width: 3, height: 38, fill: C.txt3 }, svg);
  s('rect', { x: 138, y: 98, width: 3, height: 38, fill: C.txt3 }, svg);
  const wing = s('g', {}, svg);
  s('rect', { x: 110, y: 102, width: 28, height: 28, fill: 'none', stroke: C.txt2, 'stroke-width': 1.3 }, wing);
  for (const x of [119.3, 128.6]) s('line', { x1: x, y1: 102, x2: x, y2: 130, stroke: C.txt2 }, wing);
  txt('BRAMA AV', 100, 121, { 'text-anchor': 'end' });

  const brk = s('path', { d: 'M117 109L131 123M131 109L117 123', stroke: C.alarm, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, svg);
  const dot = s('circle', { r: 4.2, fill: C.puls }, svg);

  let cur: { r: Rytm; ph: string } = { r: 'avnrt', ph: '' };
  const len: Partial<Record<Rytm, number>> = {};
  const lenOf = (r: 'avnrt' | 'avrt' | 'trzepotanie') => {
    if (len[r] === undefined) { try { len[r] = loops[r].getTotalLength(); } catch { len[r] = 0; } }
    return len[r] ?? 0;
  };

  return {
    svg,
    set(r: Rytm, ph: 'trwa' | 'brama' | 'ustapil', closed: boolean) {
      cur = { r, ph };
      const broken = ph === 'ustapil';
      for (const k of ['avnrt', 'avrt', 'trzepotanie'] as const) {
        const on = k === r;
        loops[k].style.display = on ? '' : 'none';
        setA(loops[k], { 'stroke-dasharray': on && broken ? '4 5' : undefined, stroke: on && broken ? C.txt3 : C.puls });
      }
      gAvnrt.style.display = r === 'avnrt' ? '' : 'none';
      gAvrt.style.display = r === 'avrt' ? '' : 'none';
      gFl.style.display = r === 'trzepotanie' ? '' : 'none';
      gAT.style.display = r === 'przedsionkowy' ? '' : 'none';
      gSin.style.display = r === 'zatokowa' || broken ? '' : 'none';
      brk.style.display = broken && petlaPrzezWezel(r) ? '' : 'none';
      for (const a of arrows) a.style.display = broken ? 'none' : '';
      dot.style.display = PATH[r] && !broken ? '' : 'none';
      setA(wing, { transform: closed ? undefined : 'matrix(0.22 0 0 1 85.8 0)' });
      const opis = broken ? 'Pętla pękła w węźle AV, wrócił rytm zatokowy.'
        : closed ? 'Brama AV przymknięta: mniej impulsów dociera do komór.'
          : { avnrt: 'Impuls krąży w małej pętli w węźle AV: w dół drogą wolną, w górę drogą szybką.', avrt: 'Impuls schodzi przez bramę AV, a wraca drogą dodatkową.', trzepotanie: 'Pobudzenie krąży po dużym torze w prawym przedsionku, brama wpuszcza co drugi impuls.', przedsionkowy: 'Jedno ognisko w przedsionku narzuca tempo.', zatokowa: 'Dyrygent wybija szybsze tempo.' }[r];
      svg.setAttribute('aria-label', `Schemat. ${opis}`);
    },
    tick(now: number, r: Rytm, iv: Interwencja | null) {
      void iv;
      if (cur.r !== r) return;
      const k = r === 'avnrt' || r === 'avrt' || r === 'trzepotanie' ? r : null;
      if (k && cur.ph !== 'ustapil') {
        const per = k === 'trzepotanie' ? F_OKRES : CYKL[k];
        const L = lenOf(k);
        if (L > 0) {
          const pt = loops[k].getPointAtLength((((now % per) + per) % per / per) * L);
          setA(dot, { cx: pt.x, cy: pt.y });
        }
      }
      const pulse = (ring: SVGCircleElement, per: number) => {
        const f = (((now % per) + per) % per) / per;
        setA(ring, { r: 6 + 14 * f, opacity: (1 - f).toFixed(2) });
      };
      if (r === 'przedsionkowy') pulse(atRing, CYKL.przedsionkowy);
      if (r === 'zatokowa') pulse(sinRing, CYKL.zatokowa);
      else if (cur.ph === 'ustapil') pulse(sinRing, 0.8);
    },
  };
}

