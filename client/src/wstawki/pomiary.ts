/**
 * Pracownia pomiarów — prawdziwy papier EKG (kwadratowe kratki, 25 mm/s, 10 mm/mV) i cyrkiel elektroniczny.
 * Wykłady: S1_02 (papier, częstość), S2_02 (PQ), S2_03 (QRS), S2_05 (QT, QTc), S3_01 (cecha, woltaż).
 *
 * Opcje: tryb=czestosc|pq-qrs|qtc|cecha|cwiczenie (domyślnie czestosc). Nieznane opcje są ignorowane.
 *
 * Papier: px/mm liczone z szerokości tak, żeby mm były kwadratowe (3,5-8 px/mm). Dłuższy pasek przewija się
 * w poziomie we własnym kontenerze (uchwyty cyrkla mają touch-action:none, reszta paska przewija się palcem).
 *
 * Cyrkiel działa tak samo jak w `wezel-av`: ramiona z uchwytami rozsuniętymi w pionie (lewe niżej, prawe wyżej),
 * chwyt z przesunięciem, gumowe granice, powrót i przyciski „Pokaż…” / „Ustaw…” sprężyną, rzut pędu przy przesuwie
 * całego cyrkla (okno 6 s / 10 s). Przenikanie zmiany stanu: jedna migawka, start od bieżącego widoku.
 */
import {
  C, button, chips, clamp, drag, exercise, fmtNum, guma, h, paper, projekcja, reducedMotion, rng, s, shell, slider, spring, surface, trace,
  TRYB_SPRAWDZ, TRYB_UCZ, type Spring, type WstawkaOpts,
} from './core/ui.js';
import { beat, volt, type Beat, type LeadName } from './core/model.js';
import { dzwiekDla } from './core/dzwiek.js';
import {
  CIAG_300, CORNELL_PRZYKLAD, MIARY, OKNO_START, QTC_K, QTC_M, QTC_RYZYKO, SOKOLOW_PRZYKLAD, TOLERANCJA_S,
  bazett, cornell, czestosc60, czestoscZOkna, dlugosc, fridericia, kratki, liczQrs, losujZapis, napiecie, ocenaPQ, ocenaQRS,
  ocenaQTc, pasekMiarowy, pasekNiemiarowy, prOpcjaDla, qtOpcjaDla, regula1500, regula300, sokolow, szczytyR, zapisZ, zmierz,
  type Cecha, type Miara, type Pasek, type Przesuw, type Wzor, type Zapis,
} from './pomiary.dane.js';

type Tryb = 'czestosc' | 'pq-qrs' | 'qtc' | 'cecha' | 'cwiczenie';
type Temat = Exclude<Tryb, 'cwiczenie'>;
type Para = { a: number; b: number };
type VPara = { base: number; peak: number };
type Kolumna = { lead: LeadName; x: number; w: number; f: (t: number) => number; znak: 1 | -1; fala: 'R' | 'S'; wzorzec: number };

const LOCAL_CSS = `
.hw-pm [hidden]{display:none!important}
.hw-pm-scroll{overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:#223040 transparent}
.hw-pm-inner{position:relative}
.hw-pm-h{position:absolute;width:44px;height:44px;margin:0;padding:0;border:0;background:transparent;touch-action:none;cursor:ew-resize;display:grid;place-items:center;transform:translateX(-50%);z-index:2}
.hw-pm-h--v{cursor:ns-resize;transform:translate(-50%,-50%)}
.hw-pm-h i{display:block;width:18px;height:18px;border-radius:50%;background:#070A0D;border:2px solid var(--hw-txt)}
.hw-pm-h:active i,.hw-pm-h:focus-visible i{background:var(--hw-txt)}
.hw-pm-h:focus-visible{outline-offset:-4px}
.hw-pm-ctl{display:grid;gap:10px}
.hw-pm-fade{position:absolute;left:0;top:0;pointer-events:none;opacity:0;z-index:1}
.hw-pm-sub{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
`;
/** Czas przenikania stanów [ms] (ten sam co w pozostałych wstawkach tej rundy). */
const FADE_MS = 400;
/** Środki uchwytów ramion od dołu papieru [px]: lewe niżej, prawe wyżej, żeby przy krótkim odstępie nie zachodziły. */
const H_A = 24, H_B = 72;
/** Margines pod zapisem na uchwyty [px]. */
const POD = 98;
let localStyled = false;
function ensureLocal(): void {
  if (localStyled) return;
  localStyled = true;
  const el = document.createElement('style');
  el.setAttribute('data-hw-pomiary', '');
  el.textContent = LOCAL_CSS;
  document.head.appendChild(el);
}

const ms = (s0: number): number => Math.round(s0 * 1000);
const sek = (s0: number, d = 2): string => `${fmtNum(s0, d)} s`;
const ile = (v: number): string => (Math.abs(v - Math.round(v)) < 0.05 ? fmtNum(Math.round(v)) : `około ${fmtNum(Math.round(v))}`);
const kr = (v: number): string => (Math.abs(v - Math.round(v)) < 0.05 ? fmtNum(Math.round(v)) : fmtNum(v, 1));

/**
 * Migawka płótna do przenikania: jedna warstwa. Przy przerwaniu w połowie migawka dostaje dokładnie to,
 * co widać (płótno + migawka w bieżącym kryciu), więc obraz nie skacze.
 */
function migawka(box: HTMLElement, src: () => HTMLCanvasElement | null, przed: Element | null): () => void {
  const snap = h('canvas', { class: 'hw-pm-fade', 'aria-hidden': 'true' });
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
    snap.style.width = `${cv.clientWidth}px`; snap.style.height = `${cv.clientHeight}px`;
    snap.getContext('2d')?.drawImage(tmp, 0, 0);
    snap.style.transition = 'none'; snap.style.opacity = '1';
    void snap.offsetWidth;
    snap.style.transition = `opacity ${FADE_MS}ms var(--hw-ease)`; snap.style.opacity = '0';
  };
}

export function mountPomiary(host: HTMLElement, opts: WstawkaOpts): () => void {
  ensureLocal();
  const { root, body, live } = shell(host, {
    label: 'Wstawka · pomiary',
    title: 'Pracownia pomiarów: papier, cyrkiel i liczby z wykładu',
    intro: 'Przeciągnij ramiona cyrkla po prawdziwym papierze EKG albo przesuwaj je strzałkami. Odczyt w milisekundach i kratkach pojawia się od razu.',
  });
  root.classList.add('hw-pm');
  const cleanups: Array<() => void> = [];

  /* ─────────── stan ─────────── */
  const TRYBY: Tryb[] = ['czestosc', 'pq-qrs', 'qtc', 'cecha', 'cwiczenie'];
  const st = {
    tryb: (TRYBY as string[]).includes(opts.tryb ?? '') ? (opts.tryb as Tryb) : 'czestosc' as Tryb,
    rytm: 'miarowy' as 'miarowy' | 'niemiarowy',
    rr: 0.8,
    przesuw: 25 as Przesuw,
    okno: 'rr' as 'rr' | '6' | '10',
    cz: { a: 0, b: 0 } as Para,
    pqPreset: 'norma' as 'norma' | 'blok1' | 'szeroki',
    pqMiara: 'PQ' as 'PQ' | 'QRS',
    pqCal: { PQ: { a: 0, b: 0 }, QRS: { a: 0, b: 0 } } as Record<'PQ' | 'QRS', Para>,
    qtRR: 0.64,
    wzor: 'bazett' as Wzor,
    kryt: 'sokolow' as 'sokolow' | 'cornell',
    cecha: 10 as Cecha,
    plec: 'k' as 'm' | 'k',
    kol: 'V1' as LeadName,
    vcal: {} as Partial<Record<LeadName, VPara>>,
    zapis: null as Zapis | null,
    miara: 'PQ' as Miara,
    exCal: {} as Record<Miara, Para>,
    odkryte: false,
  };

  interface SceneH { kind: 'h'; W: number; H: number; mm: number; speed: Przesuw; dur: number; tStart: number; yBase: number; top: number; f: (t: number) => number; lead: LeadName }
  interface SceneV { kind: 'v'; W: number; H: number; mm: number; yBase: number; top: number; colDur: number; cols: Kolumna[] }
  let scene: SceneH | SceneV | null = null;

  /* ─────────── sygnały ─────────── */
  const QT_OPT = qtOpcjaDla(0.4, 'II');
  const PR_016 = prOpcjaDla(0.16, 'II');
  const PR_024 = prOpcjaDla(0.24, 'II');
  const pqZapis = (): Zapis => st.pqPreset === 'szeroki' ? zapisZ({ qrs: 'rbbb' }, 0.8, 'V1', 6)
    : zapisZ({ pr: st.pqPreset === 'blok1' ? PR_024 : PR_016 }, 0.8, 'II', 6);
  let pqZ = pqZapis();
  let pasekMiar = pasekMiarowy(st.rr, {}, 'II', 14);
  const pasekNiem = pasekNiemiarowy('II');
  const R_NIEM = szczytyR(pasekNiem);
  let pasekQtc = pasekMiarowy(st.qtRR, { qt: QT_OPT }, 'II', 8);

  const LVH: Beat = beat({ qrs: 'lvh' });
  /** Skala na odprowadzenie: model daje kształt, wysokość ustawiamy na wartości z wykładu. */
  const skala = new Map<LeadName, number>();
  const ekstremum = (lead: LeadName, znak: 1 | -1) => {
    let e = 0;
    for (let t = -0.03; t < 0.14; t += 0.0005) e = Math.max(e, znak * volt(LVH, lead, t));
    return e;
  };
  const kolumnyDef = (): Array<{ lead: LeadName; znak: 1 | -1; fala: 'R' | 'S'; wzorzec: number }> => st.kryt === 'sokolow'
    ? [{ lead: 'V1', znak: -1, fala: 'S', wzorzec: SOKOLOW_PRZYKLAD.V1 }, { lead: 'V5', znak: 1, fala: 'R', wzorzec: SOKOLOW_PRZYKLAD.V5 }, { lead: 'V6', znak: 1, fala: 'R', wzorzec: SOKOLOW_PRZYKLAD.V6 }]
    : [{ lead: 'aVL', znak: 1, fala: 'R', wzorzec: CORNELL_PRZYKLAD.aVL }, { lead: 'V3', znak: -1, fala: 'S', wzorzec: CORNELL_PRZYKLAD.V3 }];
  for (const k of [...[['V1', -1, 19], ['V5', 1, 18], ['V6', 1, 15], ['aVL', 1, 9], ['V3', -1, 15]] as const]) {
    skala.set(k[0], k[2] / 10 / ekstremum(k[0], k[1]));
  }
  const resetV = () => { for (const k of [...kolumnyDef()]) st.vcal[k.lead] = { base: 0, peak: (k.znak * k.wzorzec) / 10 }; };
  st.kryt = 'cornell'; resetV(); st.kryt = 'sokolow'; resetV();

  /* ─────────── sterowanie ─────────── */
  let temat: Temat = st.tryb === 'cwiczenie' ? 'czestosc' : st.tryb;
  const trybChips = chips([{ v: 'play', label: TRYB_UCZ }, { v: 'task', label: TRYB_SPRAWDZ }] as const,
    st.tryb === 'cwiczenie' ? 'task' : 'play', (v) => setTryb(v === 'task' ? 'cwiczenie' : temat), { label: 'Tryb wstawki' });
  const tematChips = chips([
    { v: 'czestosc', label: 'Częstość' }, { v: 'pq-qrs', label: 'PQ i QRS' }, { v: 'qtc', label: 'QTc' }, { v: 'cecha', label: 'Cecha i woltaż' },
  ] as const, temat, (v) => setTryb(v), { label: 'Temat pomiaru' });
  body.append(h('div', { class: 'hw-bar' }, trybChips.el), h('div', { class: 'hw-bar' }, tematChips.el));

  // częstość
  const rytmChips = chips([{ v: 'miarowy', label: 'Rytm miarowy' }, { v: 'niemiarowy', label: 'Rytm niemiarowy' }] as const, st.rytm, (v) => {
    st.rytm = v; resetCz(); syncCtl(); refresh(true);
  }, { label: 'Rytm', small: true });
  const rrChips = chips([
    { v: '0.8', label: '4 duże kratki' }, { v: '0.84', label: '21 małych kratek' }, { v: '0.9', label: '4,5 dużej kratki' },
  ] as const, '0.8', (v) => { st.rr = Number(v); pasekMiar = pasekMiarowy(st.rr, {}, 'II', 14); resetCz(); refresh(true); }, { label: 'Odstęp RR', small: true });
  const przesuwChips = chips([{ v: '25', label: '25 mm/s' }, { v: '50', label: '50 mm/s' }] as const, '25', (v) => {
    st.przesuw = Number(v) as Przesuw; refresh(true);
  }, { label: 'Przesuw papieru', small: true });
  const oknoChips = chips([{ v: 'rr', label: 'Jeden odstęp RR' }, { v: '6', label: 'Okno 6 s' }, { v: '10', label: 'Okno 10 s' }] as const, st.okno, (v) => {
    st.okno = v; resetCz(); syncCtl(); refresh(true);
  }, { label: 'Metoda', small: true });
  // przykładowe odstępy: ramiona dojeżdżają sprężyną z bieżącego miejsca
  const pokazOdstep = (i: number) => () => { jedzPara('cz', () => st.cz, { a: R_NIEM[i] ?? 0, b: R_NIEM[i + 1] ?? 0 }); };
  const rrNiemBtns = h('div', { class: 'hw-row', role: 'group', 'aria-label': 'Przykładowe odstępy' },
    button('Pokaż odstęp 0,50 s', pokazOdstep(1), 'ghost'), button('Pokaż odstęp 1,00 s', pokazOdstep(2), 'ghost'));
  const ctlCz = h('div', { class: 'hw-pm-ctl' }, h('div', { class: 'hw-bar' }, rytmChips.el, przesuwChips.el), rrChips.el, h('div', { class: 'hw-row' }, oknoChips.el, rrNiemBtns));

  // PQ i QRS
  const pqPresetChips = chips([
    { v: 'norma', label: 'Prawidłowy zapis' }, { v: 'blok1', label: 'Długie PQ' }, { v: 'szeroki', label: 'Szeroki QRS (V1)' },
  ] as const, st.pqPreset, (v) => { st.pqPreset = v; pqZ = pqZapis(); resetPq(); refresh(true); }, { label: 'Zapis', small: true });
  const pqMiaraChips = chips([{ v: 'PQ', label: 'PQ' }, { v: 'QRS', label: 'QRS' }] as const, st.pqMiara, (v) => {
    st.pqMiara = v; refresh(false);
  }, { label: 'Mierzysz', small: true });
  const pqWzorBtn = button('Ustaw na wzorzec', () => { const m = st.pqMiara; jedzPara(`pq.${m}`, () => st.pqCal[m], pqZ.wzorzec[m]); }, 'ghost');
  const ctlPq = h('div', { class: 'hw-pm-ctl' }, pqPresetChips.el,
    h('div', { class: 'hw-bar' }, h('div', { class: 'hw-pm-sub' }, h('span', { class: 'hw-label', text: 'Mierzysz' }), pqMiaraChips.el), pqWzorBtn));

  // QTc
  const rrSlider = slider({
    label: 'Odstęp RR (QT stałe 0,40 s)', min: 0.6, max: 1.4, step: 0.01, value: st.qtRR,
    fmt: (v) => `${fmtNum(v, 2)} s · ${ile(czestosc60(v))}/min`,
    onInput: (v) => { st.qtRR = v; pasekQtc = pasekMiarowy(v, { qt: QT_OPT }, 'II', 8); qtPresets.set('' as never); refresh(false); },
  });
  const qtPresets = chips([{ v: '1', label: 'RR 1,00 s' }, { v: '0.8', label: 'RR 0,80 s' }, { v: '0.64', label: 'RR 0,64 s' }] as const, '0.64', (v) => {
    rrSlider.set(Number(v), true); qtPresets.set(v);
  }, { label: 'Przykłady z wykładu', small: true });
  const wzorChips = chips([{ v: 'bazett', label: 'Bazett' }, { v: 'fridericia', label: 'Fridericia' }] as const, st.wzor, (v) => {
    st.wzor = v; refresh(false);
  }, { label: 'Wzór korekcji', small: true });
  const ctlQt = h('div', { class: 'hw-pm-ctl' }, rrSlider.el, h('div', { class: 'hw-bar' }, qtPresets.el, wzorChips.el));

  // cecha
  const krytChips = chips([{ v: 'sokolow', label: 'Sokolow-Lyon' }, { v: 'cornell', label: 'Cornell' }] as const, st.kryt, (v) => {
    st.kryt = v; st.kol = kolumnyDef()[0]?.lead ?? 'V1'; syncKol(); refresh(true);
  }, { label: 'Kryterium', small: true });
  const cechaChips = chips([{ v: '10', label: '10 mm/mV' }, { v: '5', label: '5 mm/mV' }] as const, '10', (v) => {
    st.cecha = Number(v) as Cecha; refresh(true);
  }, { label: 'Cecha', small: true });
  const plecChips = chips([{ v: 'k', label: 'Kobieta' }, { v: 'm', label: 'Mężczyzna' }] as const, st.plec, (v) => {
    st.plec = v; refresh(false);
  }, { label: 'Płeć', small: true });
  const kolBox = h('div', {});
  let kolChips = chips([{ v: 'V1' as LeadName, label: 'V1' }], 'V1' as LeadName, () => {}, { label: 'Mierzone odprowadzenie', small: true });
  function syncKol() {
    kolChips = chips(kolumnyDef().map((k) => ({ v: k.lead, label: `${k.fala} w ${k.lead}` })), st.kol, (v) => { st.kol = v; refresh(false); }, { label: 'Mierzone odprowadzenie', small: true });
    kolBox.replaceChildren(kolChips.el);
    plecChips.el.hidden = st.kryt !== 'cornell';
  }
  const wzorVBtn = button('Ustaw na wartości z wykładu', () => {
    for (const k of kolumnyDef()) {
      const vc = st.vcal[k.lead]; if (!vc) continue;
      jedz(`v.${k.lead}.base`, vc.base, 0, (x) => { vc.base = x; });
      jedz(`v.${k.lead}.peak`, vc.peak, (k.znak * k.wzorzec) / 10, (x) => { vc.peak = x; });
    }
  }, 'ghost');
  const ctlV = h('div', { class: 'hw-pm-ctl' }, h('div', { class: 'hw-bar' }, krytChips.el, cechaChips.el), h('div', { class: 'hw-bar' }, kolBox, plecChips.el), h('div', { class: 'hw-row' }, wzorVBtn));
  syncKol();

  // ćwiczenie
  const miaraChips = chips(MIARY.map((m) => ({ v: m, label: m === 'RR' ? 'RR (częstość)' : m })), st.miara, (v) => { st.miara = v; refresh(false); }, { label: 'Mierzony odstęp', small: true });
  const ctlEx = h('div', { class: 'hw-pm-ctl' }, miaraChips.el);

  body.append(ctlCz, ctlPq, ctlQt, ctlV, ctlEx);

  /* ─────────── papier ─────────── */
  const mLead = h('span', {}), mScale = h('span', {}), mRead = h('b', {});
  const screen = h('div', { class: 'hw-screen' }, h('div', { class: 'hw-mbar' }, h('span', {}, mLead, ' · ', mScale), mRead));
  const scroller = h('div', { class: 'hw-pm-scroll' });
  const inner = h('div', { class: 'hw-pm-inner' });
  scroller.append(inner);
  screen.append(scroller);
  const legend = h('p', { class: 'hw-note' });
  /** Ostrzeżenie w ćwiczeniu: które odstępy nie są jeszcze zmierzone (bez blokady). */
  const uwaga = h('p', { class: 'hw-note hw-warn', hidden: true });
  /** Miejsce papieru w trybie „Ucz się”; w ćwiczeniu papier przechodzi pod polecenie (`ex.miejsce`). */
  const kotwica = h('div', { hidden: true });
  body.append(kotwica, screen, legend);

  const so: { height: number; label: string } = { height: 200, label: 'Papier EKG z cyrklem' };
  let S: { ctx: CanvasRenderingContext2D; w: number; h: number } | null = null;
  const sf = surface(inner, so, (x) => { S = x; draw(); });
  cleanups.push(() => sf.destroy());

  const mkHandle = (v: boolean, key: string) => {
    const b = h('button', { type: 'button', class: 'hw-pm-h' + (v ? ' hw-pm-h--v' : ''), role: 'slider', 'data-h': key, 'aria-orientation': v ? 'vertical' : 'horizontal' }, h('i', {}));
    inner.append(b);
    return b;
  };
  const hA = mkHandle(false, 'a'), hB = mkHandle(false, 'b'), vBase = mkHandle(true, 'base'), vPeak = mkHandle(true, 'peak');
  hA.setAttribute('aria-label', 'Lewe ramię cyrkla'); hB.setAttribute('aria-label', 'Prawe ramię cyrkla');
  vBase.setAttribute('aria-label', 'Ramię cyrkla na linii izoelektrycznej'); vPeak.setAttribute('aria-label', 'Ramię cyrkla na wierzchołku załamka');
  const przenik = migawka(inner, () => sf.s.canvas, hA);

  /* ─────────── odczyt ─────────── */
  const tags = h('div', { class: 'hw-tags', 'aria-live': 'off' });
  const big = h('span', { class: 'hw-big' });
  const cat = h('span', { class: 'hw-cat' });
  const list = h('ul', { class: 'hw-list' });
  const why = h('p', { class: 'hw-why' });
  const pearl = h('p', { class: 'hw-pearl' });
  const scaleSvg = s('svg', { viewBox: '0 0 340 58', class: 'hw-svg', style: 'touch-action:auto', role: 'img', 'aria-label': 'Skala QTc z progami z wykładu' });
  const read = h('div', { class: 'hw-read' }, tags, h('div', { class: 'hw-row', style: 'align-items:baseline;gap:6px 16px' }, big, cat), scaleSvg, list, why, pearl);
  body.append(read);

  /* ─────────── ćwiczenie ─────────── */
  let seed0 = Math.floor(Math.random() * 1e6);
  /** Odstępy, których ramiona kursant już przesunął w bieżącym zadaniu. */
  const ruszone = new Set<Miara>();
  let zapisNr = 0;
  const ex = exercise<Zapis>({
    rounds: 4,
    make: (i) => { if (i === 0) seed0 = Math.floor(Math.random() * 1e6); return losujZapis(rng(seed0 + i * 7919)); },
    show: (z) => {
      st.zapis = z; st.odkryte = false; zapisNr++;
      ruszone.clear();
      const t1 = z.pasek.qrs[0] ?? 0;
      // ramiona w spokojnym odcinku TP, rozstawione na 2 mm (uchwyty nie startują w jednym punkcie): kursant sam rozkłada cyrkiel
      const tp = t1 + z.rr * 0.62, d = 2 / 25;
      st.exCal = { PQ: { a: tp, b: tp + d }, QRS: { a: tp, b: tp + d }, QT: { a: tp, b: tp + d }, RR: { a: tp, b: tp + d } };
      st.miara = 'PQ'; miaraChips.set('PQ');
      refresh(true);
    },
    prompt: 'Zmierz cyrklem PQ, QRS, QT i odstęp RR na drugim pobudzeniu. Przełączaj pomiar przyciskami nad papierem, potem naciśnij „Sprawdź”.',
    gotowe: () => ruszone.size > 0,
    check: (z) => {
      st.odkryte = true;
      const wynik = MIARY.map((m) => {
        const twoj = dlugosc(st.exCal[m]), wz = dlugosc(z.wzorzec[m]);
        return { m, twoj, wz, ok: Math.abs(twoj - wz) <= TOLERANCJA_S + 1e-9 };
      });
      refresh(false);
      const trafione = wynik.filter((w) => w.ok).length;
      const wz = (m: Miara) => dlugosc(z.wzorzec[m]);
      const qtcB = bazett(wz('QT'), wz('RR'));
      const oq = ocenaQTc(ms(qtcB));
      const linie = wynik.map((w) => `<b>${w.m}</b>: twój ${ms(w.twoj)} ms, wzorzec ${ms(w.wz)} ms (różnica ${ms(Math.abs(w.twoj - w.wz))} ms${w.ok ? '' : ', poza tolerancją'}).`).join('<br>');
      const ocena = `${ocenaPQ(wz('PQ')).tekst}. ${ocenaQRS(wz('QRS')).tekst}. Częstość 60 ÷ ${fmtNum(wz('RR'), 2)} s = ${ile(czestosc60(wz('RR')))}/min. `
        + `QTc według Bazetta: ${fmtNum(wz('QT'), 2)} ÷ √${fmtNum(wz('RR'), 2)} = ${ms(qtcB)} ms, ${oq.k ? 'wydłużony u obu płci' : oq.m ? 'wydłużony u mężczyzn (≥ 450 ms), u kobiet jeszcze nie (≥ 460 ms)' : 'poniżej progów wydłużenia'}.`
        + (oq.ryzyko ? ' QTc ≥ 500 ms wiąże się z wyraźnie większym ryzykiem torsade de pointes.' : '');
      return {
        ok: trafione === 4, near: trafione >= 2,
        szczegol: `${trafione} z 4 pomiarów w granicy ±20 ms.`,
        why: `${linie}<br><br>${ocena}<br><br>PQ i QT mierzysz od początku wychylenia, nie od szczytu. Koniec T wyznacza styczna do opadającego ramienia (na papierze linia przerywana). Zielone przerywane klamry pokazują wzorzec: porównaj je ze swoimi.`,
      };
    },
    live,
  });
  body.append(ex.el);

  /* ─────────── geometria ─────────── */

  const sceneH = (W: number, durNom: number, speed: Przesuw, p: Pasek, rows: number): SceneH => {
    const mm = clamp(W / (durNom * speed), 3.5, 8);
    const dur = Math.max(durNom, W / (speed * mm));
    const f = (t: number) => napiecie(p, t);
    const tStart = 8 / speed;
    let mx = 1, mn = 0;
    for (let t = tStart; t < dur; t += 0.003) { const v = f(t); if (v > mx) mx = v; if (v < mn) mn = v; }
    const top = 6 + rows * 22;
    const yBase = top + (mx * 10 + 3) * mm;
    return { kind: 'h', W: Math.max(W, Math.ceil(dur * speed * mm)), H: Math.round(yBase + (-mn * 10 + 3) * mm + POD), mm, speed, dur, tStart, yBase, top, f, lead: p.lead };
  };
  const sceneV = (W: number): SceneV => {
    const defs = kolumnyDef();
    const colW = W / defs.length;
    const mm = clamp(colW / 25, 3.5, 8);
    const colDur = colW / (25 * mm);
    const top = 30;
    const yBase = top + 23 * mm;           // miejsce na R do 18 mm i więcej
    const H = Math.round(yBase + 24 * mm + 6);
    const cols: Kolumna[] = defs.map((d, i) => {
      const k = skala.get(d.lead) ?? 1, tq = colDur * 0.34;
      return { ...d, x: i * colW, w: colW, f: (t: number) => k * volt(LVH, d.lead, t - tq) };
    });
    return { kind: 'v', W, H, mm, yBase, top, colDur, cols };
  };

  function layout() {
    const W = Math.max(280, scroller.clientWidth || 600);
    switch (st.tryb) {
      case 'czestosc': scene = st.rytm === 'miarowy' ? sceneH(W, 3.6, st.przesuw, pasekMiar, 2) : sceneH(W, 10.9, 25, pasekNiem, 2); break;
      case 'pq-qrs': scene = sceneH(W, 2.4, 25, pqZ.pasek, 2); break;
      case 'qtc': scene = sceneH(W, 2.6, 25, pasekQtc, 2); break;
      case 'cecha': scene = sceneV(W); break;
      case 'cwiczenie': {
        const z = st.zapis ?? losujZapis(rng(1));
        st.zapis = z;
        scene = sceneH(W, 0.6 + z.rr + 0.62, 25, z.pasek, 4);
        break;
      }
    }
    if (!scene) return;
    inner.style.width = `${scene.W}px`;
    inner.style.height = `${scene.H}px`;
    so.height = scene.H;
  }

  /* ─────────── cyrkiel ─────────── */
  const activeCal = (): Para | null => {
    if (st.tryb === 'czestosc') return st.cz;
    if (st.tryb === 'pq-qrs') return st.pqCal[st.pqMiara];
    if (st.tryb === 'cwiczenie') return st.exCal[st.miara] ?? null;
    return null;
  };
  const linked = () => st.tryb === 'czestosc' && st.rytm === 'niemiarowy' && st.okno !== 'rr';
  const locked = () => st.tryb === 'cwiczenie' && st.odkryte;
  function resetCz() {
    if (st.rytm === 'miarowy') { const R = szczytyR(pasekMiar); st.cz = { a: R[0] ?? 0, b: R[1] ?? 0 }; }
    else if (st.okno === 'rr') st.cz = { a: R_NIEM[1] ?? 0, b: R_NIEM[2] ?? 0 };
    else st.cz = { a: OKNO_START, b: OKNO_START + Number(st.okno) };
  }
  function resetPq() { st.pqCal = { PQ: { ...pqZ.wzorzec.PQ }, QRS: { ...pqZ.wzorzec.QRS } }; }
  resetCz(); resetPq();

  const xOf = (sc: SceneH, t: number) => t * sc.speed * sc.mm;
  const tOf = (sc: SceneH, x: number) => x / (sc.speed * sc.mm);
  /** `miekko`: w trakcie gestu gumowa granica zamiast twardego stopu (powrót sprężyną po puszczeniu). */
  const setT = (which: 'a' | 'b', t: number, miekko = false) => {
    const c = activeCal(); if (!c || !scene || scene.kind !== 'h') return;
    const sc = scene;
    const lo = sc.tStart, hi = sc.dur;
    const wid = Math.max(0.5, (scroller.clientWidth || 600) / (sc.speed * sc.mm));
    const g = (x: number, a: number, b: number) => (miekko ? guma(x, a, b, wid) : clamp(x, a, b));
    if (linked()) {
      const span = c.b - c.a;
      const a = g(which === 'a' ? t : t - span, lo, hi - span);
      c.a = a; c.b = a + span;
    } else c[which] = g(t, lo, hi);
    if (st.tryb === 'cwiczenie' && !ruszone.has(st.miara)) { ruszone.add(st.miara); ex.odswiez(); }
  };
  const activeCol = (): Kolumna | null => (scene && scene.kind === 'v' ? scene.cols.find((k) => k.lead === st.kol) ?? null : null);
  const V_LO = -2.6, V_HI = 2.4;
  const setV = (which: 'base' | 'peak', mv: number, miekko = false) => {
    const vc = st.vcal[st.kol]; if (!vc || !scene) return;
    vc[which] = miekko ? guma(mv, V_LO, V_HI, Math.max(0.5, scene.H / (st.cecha * scene.mm))) : clamp(mv, V_LO, V_HI);
  };

  /* sprężyny ramion: przerywalne, z zachowaniem prędkości; przy „Ogranicz ruch” skok */
  const sprezyny = new Map<string, Spring>();
  const stopSpr = () => { for (const sp of sprezyny.values()) sp.stop(); sprezyny.clear(); };
  function jedz(key: string, from: number, to: number, apply: (v: number) => void, o: { v?: number; damping?: number; done?: () => void } = {}) {
    const sp = sprezyny.get(key);
    if (sp) { sp.retarget(to, o.v); return; }
    const n = spring(from, to, (v) => { apply(v); zaplanuj(); }, {
      response: 0.35, damping: o.damping ?? 1, velocity: o.v, done: () => { sprezyny.delete(key); o.done?.(); },
    });
    if (!reducedMotion()) sprezyny.set(key, n);
  }
  function jedzPara(key: string, get: () => Para, to: Para) {
    const c = get();
    jedz(`${key}.a`, c.a, to.a, (v) => { get().a = v; });
    jedz(`${key}.b`, c.b, to.b, (v) => { get().b = v; }, { done: announce });
  }
  /** Aktualizacja raz na klatkę zamiast przy każdym zdarzeniu wskaźnika. */
  let rafId = 0;
  function zaplanuj() { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; update(); }); }
  cleanups.push(() => { cancelAnimationFrame(rafId); stopSpr(); });

  let grab: { which: string; off: number } | null = null;
  cleanups.push(drag(inner, {
    start: (p, e) => {
      const tgt = (e.target as Element | null)?.closest?.('[data-h]') as HTMLElement | null;
      if (!tgt || !scene || locked()) return false;
      stopSpr();   // dotknięcie łapie ramię w ruchu
      const which = tgt.dataset.h ?? '';
      if (scene.kind === 'h') {
        const c = activeCal(); if (!c || (which !== 'a' && which !== 'b')) return false;
        grab = { which, off: c[which] - tOf(scene, p.x) };
      } else {
        const vc = st.vcal[st.kol]; if (!vc || (which !== 'base' && which !== 'peak')) return false;
        grab = { which, off: vc[which] - (scene.yBase - p.y) / (st.cecha * scene.mm) };
      }
      tgt.focus({ preventScroll: true });
    },
    move: (p) => {
      if (!grab || !scene) return;
      if (scene.kind === 'h') setT(grab.which as 'a' | 'b', tOf(scene, p.x) + grab.off, true);
      else setV(grab.which as 'base' | 'peak', (scene.yBase - p.y) / (st.cecha * scene.mm) + grab.off, true);
      zaplanuj();
    },
    end: (_p, _e, v) => {
      const g = grab; grab = null;
      if (!g || !scene) return;
      if (scene.kind === 'h') {
        const c = activeCal(); if (!c) return;
        const sc = scene, pxS = sc.speed * sc.mm, lo = sc.tStart, hi = sc.dur;
        if (linked()) {
          // cały cyrkiel (okno): rzut pędu, w granicach paska; odbicie tylko po rzucie
          const span = c.b - c.a;
          const to = clamp(c.a + projekcja(v.x) / pxS, lo, hi - span);
          jedz('okno', c.a, to, (x) => { c.a = x; c.b = x + span; }, { v: v.x / pxS, damping: Math.abs(v.x) > 300 ? 0.8 : 1, done: announce });
          return;
        }
        const w = g.which as 'a' | 'b', x = c[w], to = clamp(x, lo, hi);
        if (to !== x) { jedz(`ramie.${w}`, x, to, (y) => { c[w] = y; }, { v: v.x / pxS, done: announce }); return; }
      } else {
        const vc = st.vcal[st.kol], w = g.which as 'base' | 'peak';
        if (vc) {
          const x = vc[w], to = clamp(x, V_LO, V_HI);
          if (to !== x) { jedz(`v.${st.kol}.${w}`, x, to, (y) => { vc[w] = y; }, { v: -v.y / (st.cecha * scene.mm), done: announce }); return; }
        }
      }
      zaplanuj(); announce();
    },
  }));
  const keyH = (which: 'a' | 'b') => (e: KeyboardEvent) => {
    const c = activeCal(); if (!c || locked()) return;
    stopSpr();
    const step = e.shiftKey ? 0.04 : 0.01;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setT(which, c[which] + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setT(which, c[which] - step);
    else return;
    e.preventDefault(); update(); announce();
  };
  const keyV = (which: 'base' | 'peak') => (e: KeyboardEvent) => {
    const vc = st.vcal[st.kol]; if (!vc) return;
    stopSpr();
    const step = (e.shiftKey ? 5 : 0.5) / st.cecha;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setV(which, vc[which] + step);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setV(which, vc[which] - step);
    else return;
    e.preventDefault(); update(); announce();
  };
  const kh: Array<[HTMLElement, (e: KeyboardEvent) => void]> = [[hA, keyH('a')], [hB, keyH('b')], [vBase, keyV('base')], [vPeak, keyV('peak')]];
  for (const [el, f] of kh) el.addEventListener('keydown', f);
  cleanups.push(() => { for (const [el, f] of kh) el.removeEventListener('keydown', f); });
  const onCanvasClick = (e: MouseEvent) => {
    if (!scene || scene.kind !== 'v') return;
    const r = inner.getBoundingClientRect(), x = e.clientX - r.left;
    const k = scene.cols.find((c) => x >= c.x && x < c.x + c.w);
    if (k && k.lead !== st.kol) { st.kol = k.lead; kolChips.set(k.lead); refresh(false); }
  };
  sf.s.canvas.addEventListener('click', onCanvasClick);
  cleanups.push(() => sf.s.canvas.removeEventListener('click', onCanvasClick));

  /* ─────────── rysowanie ─────────── */
  const font = (px: number, w = 500) => `${w} ${px}px ${C.fontMono}`;
  function bracket(ctx: CanvasRenderingContext2D, xa: number, xb: number, y: number, color: string, dashed: boolean, text?: string) {
    const x1 = Math.min(xa, xb), x2 = Math.max(xa, xb);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y + 4); ctx.moveTo(x2, y - 4); ctx.lineTo(x2, y + 4); ctx.stroke();
    if (text) {
      ctx.setLineDash([]); ctx.fillStyle = color; ctx.font = font(12); ctx.textBaseline = 'alphabetic';
      const tw = ctx.measureText(text).width;
      const room = x2 - x1;
      if (tw + 8 < room) { ctx.textAlign = 'center'; ctx.fillText(text, (x1 + x2) / 2, y - 6); }
      else { ctx.textAlign = 'left'; ctx.fillText(text, x2 + 6, y + 4); }
    }
    ctx.restore();
  }
  function calib(ctx: CanvasRenderingContext2D, x: number, yBase: number, mm: number, gain: Cecha) {
    ctx.save(); ctx.strokeStyle = C.txt2; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(x, yBase); ctx.lineTo(x + mm, yBase); ctx.lineTo(x + mm, yBase - gain * mm); ctx.lineTo(x + 6 * mm, yBase - gain * mm); ctx.lineTo(x + 6 * mm, yBase); ctx.lineTo(x + 7 * mm, yBase);
    ctx.stroke(); ctx.restore();
  }
  function vline(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, color: string, dashed = false, w = 1.4) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, y1); ctx.lineTo(Math.round(x) + 0.5, y2); ctx.stroke(); ctx.restore();
  }
  /** Ramiona cyrkla: każde schodzi do swojego uchwytu (lewe niżej, prawe wyżej). */
  function ramiona(ctx: CanvasRenderingContext2D, sc: SceneH, c: Para, y1: number) {
    vline(ctx, xOf(sc, c.a), y1, sc.H - H_A - 11, C.txt);
    vline(ctx, xOf(sc, c.b), y1, sc.H - H_B - 11, C.txt);
  }

  function draw() {
    if (!S || !scene || !S.w) return;
    const { ctx } = S;
    ctx.clearRect(0, 0, S.w, S.h);
    if (scene.kind === 'h') drawH(ctx, scene); else drawV(ctx, scene);
  }

  function drawH(ctx: CanvasRenderingContext2D, sc: SceneH) {
    const { mm, yBase, top, H } = sc;
    paper(ctx, 0, 0, sc.W, H, mm, { bg: C.screen, y0: yBase });
    calib(ctx, 0, yBase, mm, 10);
    ctx.save(); ctx.beginPath(); ctx.rect(7 * mm, 0, sc.W, H); ctx.clip();
    trace(ctx, sc.f, { x: xOf(sc, sc.tStart), w: sc.W - xOf(sc, sc.tStart), t0: sc.tStart, t1: tOf(sc, sc.W), y0: yBase, pxPerMv: 10 * mm, color: C.puls, width: 1.6 });
    ctx.restore();
    ctx.fillStyle = C.txt2; ctx.font = font(13); ctx.textAlign = 'left';
    ctx.fillText(sc.lead, 8 * mm + 4, top + 14);
    const yRow = (r: number) => 6 + r * 22 + 16;
    const lineTop = top, lineBot = H - POD + 2;
    const c = activeCal();

    if (st.tryb === 'czestosc' && c) {
      if (linked()) {
        ctx.fillStyle = 'rgba(62,230,168,.07)';
        ctx.fillRect(xOf(sc, c.a), lineTop, xOf(sc, c.b) - xOf(sc, c.a), lineBot - lineTop);
        const R = R_NIEM.filter((t) => t >= c.a && t < c.b);
        ctx.fillStyle = C.puls;
        for (const t of R) { ctx.beginPath(); ctx.arc(xOf(sc, t), lineTop + 6, 3.5, 0, Math.PI * 2); ctx.fill(); }
        bracket(ctx, xOf(sc, c.a), xOf(sc, c.b), yRow(0), C.txt, false, `${Number(st.okno)} s · ${R.length} QRS`);
      } else {
        bracket(ctx, xOf(sc, c.a), xOf(sc, c.b), yRow(0), C.txt, false, `${ms(c.b - c.a)} ms`);
        if (st.rytm === 'miarowy') {
          // ciąg 300-150-100-75-60-50 odliczany w dużych kratkach od lewego ramienia cyrkla
          ctx.font = font(12); ctx.textAlign = 'center';
          CIAG_300.forEach((v, i) => {
            const x = xOf(sc, c.a) + (i + 1) * 5 * mm;
            if (x > sc.W - 8) return;
            ctx.fillStyle = C.txt3; ctx.fillRect(Math.round(x), yRow(1) - 2, 1, 6);
            ctx.fillText(fmtNum(v), x, yRow(1) - 6);
          });
        }
      }
      ramiona(ctx, sc, c, lineTop);
    }

    if (st.tryb === 'pq-qrs' && c) {
      const w = pqZ.wzorzec[st.pqMiara];
      bracket(ctx, xOf(sc, w.a), xOf(sc, w.b), yRow(1), C.puls, true);
      bracket(ctx, xOf(sc, c.a), xOf(sc, c.b), yRow(0), C.txt, false, `${st.pqMiara} ${ms(dlugosc(c))} ms`);
      ramiona(ctx, sc, c, lineTop);
    }

    if (st.tryb === 'qtc') {
      const t1 = pasekQtc.qrs[0] ?? 0, t2 = pasekQtc.qrs[1] ?? 0;
      const m = zmierz(pasekQtc.beats[0]!, 'II');
      bracket(ctx, xOf(sc, t1 + m.rPeak), xOf(sc, t2 + m.rPeak), yRow(0), C.txt2, false, `RR ${ms(st.qtRR)} ms`);
      bracket(ctx, xOf(sc, t2 + m.qrsOn), xOf(sc, t2 + m.tEnd), yRow(1), C.txt, false, 'QT 400 ms');
      tangent(ctx, sc, t2, m);
      vline(ctx, xOf(sc, t2 + m.qrsOn), yRow(1), yBase, C.txt3, true, 1);
    }

    if (st.tryb === 'cwiczenie' && st.zapis) {
      const z = st.zapis;
      MIARY.forEach((mi, r) => {
        const u = st.exCal[mi]; if (!u) return;
        const on = mi === st.miara;
        bracket(ctx, xOf(sc, u.a), xOf(sc, u.b), yRow(r), on ? C.txt : C.txt3, false, `${mi} ${ms(dlugosc(u))}`);
        if (st.odkryte) bracket(ctx, xOf(sc, z.wzorzec[mi].a), xOf(sc, z.wzorzec[mi].b), yRow(r) + 6, C.puls, true);
      });
      if (st.odkryte) {
        const m = zmierz(z.pasek.beats[0]!, 'II');
        tangent(ctx, sc, z.pasek.qrs[1] ?? 0, m);
      }
      if (c) ramiona(ctx, sc, c, lineTop);
    }
  }

  function tangent(ctx: CanvasRenderingContext2D, sc: SceneH, tq: number, m: ReturnType<typeof zmierz>) {
    const k = 10 * sc.mm;
    const ta = tq + m.tang.t - 0.035, tb = tq + m.tEnd + 0.02;
    const vy = (t: number) => sc.yBase - (m.tang.v + m.tang.slope * (t - tq - m.tang.t)) * k;
    ctx.save(); ctx.strokeStyle = C.txt3; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(xOf(sc, ta), vy(ta)); ctx.lineTo(xOf(sc, tb), vy(tb)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = C.txt;
    ctx.beginPath(); ctx.arc(xOf(sc, tq + m.tEnd), sc.yBase, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawV(ctx: CanvasRenderingContext2D, sc: SceneV) {
    const { mm, yBase, H } = sc;
    paper(ctx, 0, 0, sc.W, H, mm, { bg: C.screen, y0: yBase });
    calib(ctx, 2, yBase, mm, st.cecha);
    for (const k of sc.cols) {
      const on = k.lead === st.kol;
      if (k.x > 0) vline(ctx, k.x, 0, H, C.line2);
      if (on) { ctx.fillStyle = 'rgba(62,230,168,.05)'; ctx.fillRect(k.x + 1, 0, k.w - 2, H); }
      ctx.save(); ctx.beginPath(); ctx.rect(k.x + (k.x === 0 ? 7 * mm + 2 : 0), 0, k.w, H); ctx.clip();
      trace(ctx, k.f, { x: k.x, w: k.w, t0: 0, t1: sc.colDur, y0: yBase, pxPerMv: st.cecha * mm, color: C.puls, width: 1.6 });
      ctx.restore();
      const vc = st.vcal[k.lead];
      const val = vc ? Math.abs(vc.peak - vc.base) * st.cecha : 0;
      ctx.font = font(12.5); ctx.textAlign = 'left'; ctx.fillStyle = on ? C.puls : C.txt2;
      ctx.fillText(`${k.lead} · ${k.fala} ${kr(Math.round(val * 2) / 2)} mm`, k.x + (k.x === 0 ? 7 * mm + 6 : 6), 18);
      if (!vc) continue;
      const yB = yBase - vc.base * st.cecha * mm, yP = yBase - vc.peak * st.cecha * mm;
      ctx.save(); ctx.strokeStyle = on ? C.txt : C.txt3; ctx.lineWidth = 1.3; ctx.setLineDash(on ? [] : [3, 3]);
      ctx.beginPath(); ctx.moveTo(k.x + 4, yB); ctx.lineTo(k.x + k.w - 4, yB); ctx.moveTo(k.x + 4, yP); ctx.lineTo(k.x + k.w - 4, yP);
      const xb = k.x + k.w * 0.62; ctx.moveTo(xb, yB); ctx.lineTo(xb, yP); ctx.stroke(); ctx.restore();
    }
  }

  /* ─────────── uchwyty i teksty ─────────── */
  function placeHandles() {
    const sc = scene;
    const hor = !!sc && sc.kind === 'h' && activeCal() !== null;
    const ver = !!sc && sc.kind === 'v';
    hA.hidden = hB.hidden = !hor; vBase.hidden = vPeak.hidden = !ver;
    if (sc && sc.kind === 'h' && hor) {
      const c = activeCal()!;
      for (const [el, t, nm, y] of [[hA, c.a, 'Lewe', H_A], [hB, c.b, 'Prawe', H_B]] as const) {
        el.style.left = `${xOf(sc, t)}px`; el.style.top = `${sc.H - y - 22}px`;
        el.setAttribute('aria-valuenow', String(ms(t))); el.setAttribute('aria-valuemin', String(ms(sc.tStart))); el.setAttribute('aria-valuemax', String(ms(sc.dur)));
        el.setAttribute('aria-valuetext', `${nm} ramię cyrkla: ${fmtNum(t, 2)} s, rozstaw ${ms(dlugosc(c))} ms`);
        el.toggleAttribute('disabled', locked());
      }
    }
    if (sc && sc.kind === 'v') {
      const k = activeCol(), vc = st.vcal[st.kol];
      if (k && vc) {
        const x = k.x + k.w - 24;
        for (const [el, v, nm] of [[vBase, vc.base, 'linia izoelektryczna'], [vPeak, vc.peak, `wierzchołek ${k.fala}`]] as const) {
          el.style.left = `${x}px`; el.style.top = `${sc.yBase - v * st.cecha * sc.mm}px`;
          // aria-valuenow musi być liczbą (kropka); tekst z przecinkiem zostaje w aria-valuetext
          el.setAttribute('aria-valuenow', String(Math.round(v * st.cecha * 10) / 10));
          el.setAttribute('aria-valuemin', String(V_LO * st.cecha)); el.setAttribute('aria-valuemax', String(V_HI * st.cecha));
          el.setAttribute('aria-valuetext', `${k.lead}, ${nm}; rozstaw ${kr(Math.round(Math.abs(vc.peak - vc.base) * st.cecha * 2) / 2)} mm na papierze`);
        }
      }
    }
  }

  const tag = (label: string, val: string) => `<span class="hw-tag">${label} <b>${val}</b></span>`;
  const li = (a: string, b: string) => `<li><span>${a}</span><b>${b}</b></li>`;

  /** Teksty piszemy tylko przy zmianie wartości (zaokrąglonej do 1 ms / 0,01 mm), nie przy każdym ruchu. */
  let textKey = '';
  function texts() {
    const key = JSON.stringify(st, (k, v: unknown) => (k === 'zapis' ? zapisNr : typeof v === 'number' ? Math.round(v * 1000) : v)) + [...ruszone].join();
    if (key === textKey) return;
    textKey = key;
    syncUwaga();
    scaleSvg.style.display = st.tryb === 'qtc' ? '' : 'none';
    read.hidden = st.tryb === 'cwiczenie';
    pearl.hidden = false;
    const c = activeCal();
    if (c && scene && scene.kind === 'h') {
      const dt = dlugosc(c), k = kratki(dt, scene.speed);
      tags.innerHTML = tag('rozstaw', `${ms(dt)} ms`) + tag('małe kratki', kr(k.male)) + tag('duże kratki', kr(k.duze))
        + (st.tryb !== 'pq-qrs' && !linked() && dt >= 0.2 ? tag('jako RR', `${ile(czestosc60(dt))}/min`) : '');
      mRead.textContent = `cyrkiel ${ms(dt)} ms`;
    } else { tags.innerHTML = ''; mRead.textContent = ''; }

    switch (st.tryb) {
      case 'czestosc': textCz(); break;
      case 'pq-qrs': textPq(); break;
      case 'qtc': textQt(); break;
      case 'cecha': textV(); break;
      case 'cwiczenie': {
        const u = st.exCal[st.miara];
        mLead.textContent = 'II'; mScale.textContent = '25 mm/s · 10 mm/mV';
        legend.textContent = st.odkryte ? 'Biała klamra: twój pomiar. Zielona przerywana: wzorzec. Kropka: koniec T metodą stycznej.' : `Mierzysz ${st.miara}${u ? `: ${ms(dlugosc(u))} ms` : ''}. Tolerancja ±20 ms.`;
        break;
      }
    }
  }

  function textCz() {
    const c = st.cz, dt = dlugosc(c);
    mLead.textContent = 'II';
    if (st.okno === 'rr' || st.rytm === 'miarowy') {
      if (dt < 0.2) {
        big.textContent = 'Rozłóż cyrkiel'; cat.textContent = ''; cat.className = 'hw-cat';
        list.innerHTML = ''; why.innerHTML = 'Postaw ramiona cyrkla na szczytach dwóch sąsiednich załamków R.'; pearl.innerHTML = '';
        legend.textContent = '';
        return;
      }
    } mScale.textContent = `${st.rytm === 'niemiarowy' ? 25 : st.przesuw} mm/s · 10 mm/mV`;
    if (st.rytm === 'miarowy') {
      const k = kratki(dt, st.przesuw);
      const r60 = czestosc60(dt), r300 = regula300(k.duze), r1500 = regula1500(k.male);
      big.textContent = `${ile(r60)}/min`;
      cat.textContent = st.przesuw === 25 ? 'trzy metody dają ten sam wynik' : 'reguły kratek zawodzą przy 50 mm/s';
      cat.className = 'hw-cat ' + (st.przesuw === 25 ? '' : 'hw-bad');
      list.innerHTML = li('60 ÷ RR', `60 ÷ ${fmtNum(dt, 2)} s = ${ile(r60)}/min`)
        + li('Reguła 300', `300 ÷ ${kr(k.duze)} = ${ile(r300)}/min`)
        + li('Reguła 1500', `1500 ÷ ${kr(k.male)} = ${ile(r1500)}/min`);
      why.innerHTML = st.przesuw === 25
        ? 'Postaw ramiona cyrkla na szczytach dwóch sąsiednich R. Reguła 300 liczy duże kratki, reguła 1500 małe, a obie dają ten sam wynik co 60 ÷ RR. Liczby nad papierem to ciąg <b>300, 150, 100, 75, 60, 50</b> odliczany od lewego ramienia.'
        : 'Przy 50 mm/s mała kratka to 0,02 s, a duża 0,10 s. Ten sam odstęp zajmuje dwa razy więcej kratek, więc reguły dla 25 mm/s dają częstość <b>dwa razy za małą</b>. 60 ÷ RR w sekundach nadal działa.';
      pearl.innerHTML = '<span class="hw-label">Pułapka</span>Obie reguły zakładają miarowość: mierzą jeden odstęp RR. Nie licz wysokiego T jako kolejnego pobudzenia.';
    } else if (st.okno === 'rr') {
      big.textContent = `${ile(czestosc60(dt))}/min`;
      cat.textContent = 'z jednego odstępu: niewiarygodne'; cat.className = 'hw-cat hw-warn';
      list.innerHTML = li('Ten odstęp', `60 ÷ ${fmtNum(dt, 2)} s = ${ile(czestosc60(dt))}/min`)
        + li('Odstęp 0,50 s', '120/min') + li('Odstęp 1,00 s', '60/min');
      why.innerHTML = 'Gdy odstępy RR są nierówne, na przykład w migotaniu przedsionków, liczenie z jednego odstępu zawodzi: raz wychodzi 60, raz 120. Przesuń cyrkiel na inny odstęp albo wybierz <b>okno 6 s</b>.';
      pearl.innerHTML = '<span class="hw-label">Wybór metody</span>Miarowy: reguła 300 lub 1500. Niemiarowy: metoda sześciu sekund albo dłuższy odcinek o znanym czasie.';
    } else {
      const sec = Number(st.okno), n = liczQrs(pasekNiem, c.a, sec), mult = 60 / sec;
      big.textContent = `${fmtNum(czestoscZOkna(n, sec))}/min`;
      cat.textContent = 'średnia częstość komór'; cat.className = 'hw-cat';
      list.innerHTML = li(`Okno ${sec} s`, `${sec * 5} dużych kratek`) + li('Zespoły QRS w oknie', fmtNum(n)) + li('Wynik', `${n} × ${mult} = ${fmtNum(n * mult)}/min`);
      why.innerHTML = sec === 6
        ? 'Odmierz 6 s, czyli 30 dużych kratek, policz w nich zespoły QRS i pomnóż przez 10. Przesuń okno: wynik opisuje tylko wybrany fragment.'
        : 'Ciągły zapis 10 s (50 dużych kratek): policz QRS i pomnóż przez 6. Dłuższy odcinek lepiej uwzględnia zmienność rytmu.';
      pearl.innerHTML = '<span class="hw-label">Czułość na pomyłkę</span>W metodzie sześciu sekund jeden dodatkowo policzony QRS zmienia wynik o 10/min, a w metodzie dziesięciu sekund o 6/min.';
    }
    legend.textContent = st.rytm === 'miarowy' ? `Kwadratowe kratki: 1 mm = ${st.przesuw === 25 ? '0,04' : '0,02'} s w poziomie przy ${st.przesuw} mm/s i 0,1 mV w pionie. Na początku zapisu cecha 1 mV.` : 'Zielone kropki: zespoły QRS policzone w oknie. Pasek przesuniesz w bok.';
  }

  function textPq() {
    const c = st.pqCal[st.pqMiara], dt = dlugosc(c), w = dlugosc(pqZ.wzorzec[st.pqMiara]);
    mLead.textContent = pqZ.pasek.lead; mScale.textContent = '25 mm/s · 10 mm/mV';
    const o = st.pqMiara === 'PQ' ? ocenaPQ(dt) : ocenaQRS(dt);
    big.textContent = `${fmtNum(dt, 2)} s`;
    cat.textContent = o.tekst; cat.className = 'hw-cat ' + (o.patologia ? 'hw-bad' : 'hw-ok');
    list.innerHTML = st.pqMiara === 'PQ'
      ? li('Norma PQ', '0,12-0,20 s') + li('Twój pomiar', `${ms(dt)} ms`) + li('Wzorzec', `${ms(w)} ms`)
      : li('Prawidłowy', 'krótszy niż 110 ms') + li('Opóźnienie przewodzenia', '110-119 ms') + li('Szeroki', 'od 120 ms') + li('Twój pomiar / wzorzec', `${ms(dt)} / ${ms(w)} ms`);
    why.innerHTML = st.pqMiara === 'PQ'
      ? 'PQ mierzysz <b>od początku P do początku QRS</b>, czyli od miejsca, w którym P odchodzi od linii izoelektrycznej, do pierwszego wychylenia QRS. Najczęstszy błąd to pomiar od szczytu do szczytu.'
      : 'QRS mierzysz od początku pierwszego wychylenia do końca ostatniego, czyli do <b>punktu J</b>. Przy 25 mm/s trzy małe kratki to 0,12 s, a zespół szeroki dokładnie na trzy kratki należy już do szerokich.';
    pearl.innerHTML = st.pqPreset === 'szeroki'
      ? '<span class="hw-label">Blok prawej odnogi</span>Blok odnogi to zamknięta autostrada. Pobudzenie dociera do celu objazdem. W V1 często zobaczysz drugie dodatnie wychylenie R′.'
      : '<span class="hw-label">Przesuw</span>Przy 50 mm/s mała kratka to 0,02 s i prawidłowy odstęp PQ zajmie od sześciu do dziesięciu małych kratek.';
    legend.textContent = 'Biała klamra: twój cyrkiel. Zielona przerywana: wzorzec zmierzony na tym zapisie.';
  }

  function textQt() {
    mLead.textContent = 'II'; mScale.textContent = '25 mm/s · 10 mm/mV';
    const rr = st.qtRR, qt = 0.4;
    const vB = bazett(qt, rr), vF = fridericia(qt, rr);
    const v = st.wzor === 'bazett' ? vB : vF, other = st.wzor === 'bazett' ? vF : vB;
    const o = ocenaQTc(ms(v));
    big.textContent = `QTc ${ms(v)} ms`;
    cat.textContent = o.k ? 'wydłużony u obu płci' : o.m ? 'wydłużony u mężczyzn, u kobiet jeszcze nie' : 'poniżej progów wydłużenia';
    cat.className = 'hw-cat ' + (o.m ? 'hw-bad' : '');
    const formula = st.wzor === 'bazett'
      ? `${fmtNum(qt, 2)} ÷ √${fmtNum(rr, 2)} = ${fmtNum(qt, 2)} ÷ ${fmtNum(Math.sqrt(rr), 3)} = ${fmtNum(v, 3)} s`
      : `${fmtNum(qt, 2)} ÷ ∛${fmtNum(rr, 2)} = ${fmtNum(qt, 2)} ÷ ${fmtNum(Math.cbrt(rr), 3)} = ${fmtNum(v, 3)} s`;
    list.innerHTML = li(st.wzor === 'bazett' ? 'Bazett: QT ÷ √RR' : 'Fridericia: QT ÷ ∛RR', formula)
      + li(st.wzor === 'bazett' ? 'Fridericia dla porównania' : 'Bazett dla porównania', `${ms(other)} ms`)
      + li('Progi wydłużenia', 'mężczyźni ≥ 450 ms, kobiety ≥ 460 ms');
    why.innerHTML = Math.abs(rr - 1) < 0.005
      ? 'Przy RR = 1 s (60/min) <b>QTc równa się QT</b>. Skróć RR suwakiem: ten sam QT po korekcji rośnie.'
      : rr < 1
        ? 'RR krótszy niż 1 s, czyli szybszy rytm: korekcja <b>wydłuża</b> wartość. Bazett bywa niedokładny przy skrajnych częstościach: przecenia QTc przy tachykardii.'
        : 'RR dłuższy niż 1 s, czyli wolniejszy rytm: korekcja <b>skraca</b> wartość. Przy bradykardii Bazett niedocenia QTc.';
    pearl.innerHTML = `<span class="hw-label">Próg 500 ms</span>QTc ≥ 500 ms wiąże się z wyraźnie większym ryzykiem torsade de pointes. Ryzyko narasta jednak stopniowo: różnica między 499 a 500 ms nie jest nagłym przejściem od bezpieczeństwa do zagrożenia.`;
    legend.textContent = 'QT mierzysz od początku QRS do końca T. Linia przerywana: styczna do opadającego ramienia T. Kółko na skali: drugi wzór.';
    drawScale(v, other);
  }

  function drawScale(v: number, other: number) {
    scaleSvg.replaceChildren();
    const lo = 320, hi = 580, X = (m: number) => 14 + ((clamp(m, lo, hi) - lo) / (hi - lo)) * 312;
    s('line', { x1: X(lo), y1: 30, x2: X(hi), y2: 30, stroke: C.line2, 'stroke-width': 2 }, scaleSvg);
    s('line', { x1: X(QTC_M), y1: 30, x2: X(hi), y2: 30, stroke: C.alarm, 'stroke-width': 2, opacity: 0.55 }, scaleSvg);
    for (const [m, t] of [[QTC_M, '450 M'], [QTC_K, '460 K'], [QTC_RYZYKO, '500']] as const) {
      s('line', { x1: X(m), y1: 24, x2: X(m), y2: 36, stroke: C.txt3 }, scaleSvg);
      s('text', { x: X(m) + (m === QTC_M ? -3 : m === QTC_K ? 3 : 0), y: 52, 'text-anchor': m === QTC_M ? 'end' : m === QTC_K ? 'start' : 'middle', fill: C.txt3, 'font-size': 12, text: t }, scaleSvg);
    }
    const o = ms(other);
    s('circle', { cx: X(o), cy: 30, r: 4, fill: 'none', stroke: C.txt3, 'stroke-width': 1.5 }, scaleSvg);
    const x = X(ms(v));
    s('path', { d: `M${x} 26L${x - 6} 14L${x + 6} 14Z`, fill: C.txt }, scaleSvg);
    s('text', { x: clamp(x, 40, 300), y: 10, 'text-anchor': 'middle', fill: C.txt, 'font-size': 12, text: `${ms(v)} ms` }, scaleSvg);
  }

  function textV() {
    const defs = kolumnyDef();
    mLead.textContent = defs.map((d) => d.lead).join(', '); mScale.textContent = `25 mm/s · ${st.cecha} mm/mV`;
    const val = (lead: LeadName) => { const vc = st.vcal[lead]; return vc ? Math.abs(vc.peak - vc.base) * 10 : 0; };   // mm przy 10 mm/mV
    const pap = (lead: LeadName) => (val(lead) * st.cecha) / 10;
    const r05 = (x: number) => Math.round(x * 2) / 2;
    const rows = defs.map((d) => li(`${d.fala} w ${d.lead}`, st.cecha === 10 ? `${kr(r05(val(d.lead)))} mm` : `${kr(r05(pap(d.lead)))} mm na papierze = ${kr(r05(val(d.lead)))} mm`)).join('');
    if (st.kryt === 'sokolow') {
      const so5 = sokolow(r05(val('V1')), r05(val('V5')), r05(val('V6')));
      const wyz = r05(val('V5')) >= r05(val('V6')) ? 'V5' : 'V6';
      const papSum = r05(pap('V1')) + Math.max(r05(pap('V5')), r05(pap('V6')));
      big.textContent = `${kr(so5.suma)} mm`;
      cat.textContent = so5.spelnione ? '≥ 35 mm: kryterium spełnione' : 'poniżej 35 mm: kryterium niespełnione';
      cat.className = 'hw-cat ' + (so5.spelnione ? 'hw-bad' : '');
      list.innerHTML = rows + li('Suma', `S w V1 + R w ${wyz} = ${kr(so5.suma)} mm (${fmtNum(so5.suma / 10, 1)} mV)`);
      why.innerHTML = 'Sumujesz głębokość S w V1 i wysokość <b>wyższego</b> z załamków R w V5 lub V6. Nie dodajesz R z obu odprowadzeń. Głębokość S mierzysz od linii izoelektrycznej do najniższego punktu.';
      pearl.innerHTML = st.cecha === 5
        ? `<span class="hw-label">Pułapka cechy</span>Na papierze suma ma tylko ${kr(papSum)} mm, choć sygnał jest ten sam. Porównana wprost z progiem 35 mm dałaby fałszywie ujemny wynik: przelicz na 10 mm/mV albo licz w mV. Na przykład 18 mm przy 5 mm/mV to 36 mm przy cesze standardowej.`
        : '<span class="hw-label">Najpierw cecha</span>Progi w milimetrach dotyczą cechy 10 mm/mV. Sprawdź schodek kalibracyjny na początku zapisu. Przełącz na 5 mm/mV i zobacz, jak schodek i załamki maleją o połowę.';
    } else {
      const co = cornell(r05(val('aVL')), r05(val('V3')), st.plec);
      const avl = r05(val('aVL'));
      big.textContent = `${kr(co.suma)} mm`;
      cat.textContent = co.spelnione ? `> ${co.prog} mm: kryterium spełnione` : `nie przekracza ${co.prog} mm: kryterium niespełnione`;
      cat.className = 'hw-cat ' + (co.spelnione ? 'hw-bad' : '');
      list.innerHTML = rows + li('Suma', `R w aVL + S w V3 = ${kr(co.suma)} mm`) + li('Próg Cornella', st.plec === 'm' ? '> 28 mm u mężczyzn' : '> 20 mm u kobiet')
        + li('Pomocniczo: R w aVL ≥ 11 mm', avl >= 11 ? 'spełnione' : 'niespełnione');
      why.innerHTML = 'Cornell sumuje R w aVL i S w V3, a próg zależy od płci. Nierówność jest ostra: dokładnie 28 mm u mężczyzny albo 20 mm u kobiety progu nie przekracza. Przełącz płeć: ta sama suma raz spełnia kryterium, raz nie.';
      pearl.innerHTML = st.cecha === 5
        ? '<span class="hw-label">Pułapka cechy</span>Przy 5 mm/mV załamki są na papierze o połowę niższe, choć sygnał jest dokładnie taki sam. Przed porównaniem z progiem przelicz na 10 mm/mV.'
        : '<span class="hw-label">Inne kamery</span>Ten sam zapis może spełnić kryterium Cornella, a nie spełnić Sokolowa-Lyona: każde patrzy przez inny zestaw kamer.';
    }
    legend.textContent = 'Wybierz odprowadzenie na papierze albo przyciskiem. Ramiona cyrkla postaw na linii izoelektrycznej i na wierzchołku załamka.';
  }

  function announce() {
    const c = activeCal();
    if (c && scene?.kind === 'h') { const k = kratki(dlugosc(c), scene.speed); live(`Cyrkiel ${ms(dlugosc(c))} ms, ${kr(k.male)} małych kratek.`); }
    else if (scene?.kind === 'v') { const vc = st.vcal[st.kol]; if (vc) live(`${st.kol}: ${kr(Math.round(Math.abs(vc.peak - vc.base) * st.cecha * 2) / 2)} mm na papierze.`); }
  }

  /* ─────────── odświeżanie ─────────── */
  function syncUwaga() {
    const brak = MIARY.filter((m) => !ruszone.has(m));
    uwaga.hidden = st.tryb !== 'cwiczenie' || st.odkryte || brak.length === 0;
    uwaga.textContent = `Jeszcze bez pomiaru: ${brak.join(', ')}.`;
  }
  /* dźwięk cyrkla: cichy tyk co mała kratka, mocniejszy co duża (5 małych); liczy się zmiana rozwarcia, nie przesuw */
  const snd = dzwiekDla(body);
  let tikCal: Para | null = null, tikMale = 0;
  function tikCyrkiel() {
    const c = activeCal();
    const n = c && scene?.kind === 'h' ? Math.round(kratki(dlugosc(c), scene.speed).male) : 0;
    if (c && c === tikCal && n !== tikMale) {
      let mocny = false;
      for (let k = Math.min(n, tikMale) + 1; k <= Math.max(n, tikMale); k++) if (k % 5 === 0) mocny = true;
      snd.tik(mocny);
    }
    tikCal = c; tikMale = n;
  }
  function update() { draw(); placeHandles(); texts(); tikCyrkiel(); }
  function refresh(withFade: boolean) {
    stopSpr();
    tikCal = null;
    if (withFade) przenik();
    layout(); update();
  }

  function setTryb(t: Tryb) {
    if (t !== 'cwiczenie') temat = t;
    if (st.tryb !== t && S) przenik();
    st.tryb = t;
    trybChips.set(t === 'cwiczenie' ? 'task' : 'play'); tematChips.set(temat);
    tematChips.el.hidden = t === 'cwiczenie';
    ctlCz.hidden = t !== 'czestosc'; ctlPq.hidden = t !== 'pq-qrs'; ctlQt.hidden = t !== 'qtc'; ctlV.hidden = t !== 'cecha'; ctlEx.hidden = t !== 'cwiczenie';
    ex.el.hidden = t !== 'cwiczenie';
    // w ćwiczeniu papier i wybór odstępu stoją pod poleceniem, nad werdyktem
    if (t === 'cwiczenie') ex.miejsce.append(ctlEx, screen, legend, uwaga);
    else { kotwica.after(screen, legend); uwaga.hidden = true; }
    syncCtl();
    scroller.scrollLeft = 0;
    if (t === 'cwiczenie') ex.start();
    else refresh(false);
    const nazwy: Record<Tryb, string> = { czestosc: 'Częstość', 'pq-qrs': 'PQ i QRS', qtc: 'QTc', cecha: 'Cecha i woltaż', cwiczenie: TRYB_SPRAWDZ };
    live(t === 'cwiczenie' ? `Tryb: ${TRYB_SPRAWDZ}.` : `Tryb: ${TRYB_UCZ}, ${nazwy[t]}.`);
  }
  function syncCtl() {
    const m = st.rytm === 'miarowy';
    rrChips.el.hidden = !m; przesuwChips.el.hidden = !m; oknoChips.el.hidden = m; rrNiemBtns.hidden = m || st.okno !== 'rr';
  }

  const ro = new ResizeObserver(() => { layout(); update(); });
  ro.observe(scroller);
  cleanups.push(() => ro.disconnect());

  setTryb(st.tryb);
  return () => { cleanups.forEach((f) => f()); host.replaceChildren(); };
}
