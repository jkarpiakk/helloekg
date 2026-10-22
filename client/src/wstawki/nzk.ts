/**
 * Monitor zatrzymania krążenia: rozpoznanie rytmu na monitorze (VF grube i drobne, VT jedno- i wielokształtny,
 * asystolia, PEA) razem ze stanem pacjenta, oraz pułapki z tekstu: drobne VF a płaska linia, odłączony przewód,
 * artefakt u przytomnego pacjenta. Tylko rozpoznanie: bez algorytmu RKO i bez sekwencji leczenia.
 * Wykłady: S6_05 (plansza o migotaniu komór), S5_04, S6_03.
 *
 * Opcje: rytm=vf | vf-grube | vf-drobne | vt | vt-wielo | asystolia | pea | pea-waskie | pea-szerokie | artefakt | odlaczona,
 *        tryb=cwiczenie.
 */
import { C, TRYB_SPRAWDZ, TRYB_UCZ, chips, exercise, h, options, reducedMotion, shell, trace, type WstawkaOpts } from './core/ui.js';
import { Strip, monitor, pComps, playToggle, vBeat, type MonitorMap } from './core/rytm.js';
import { type Beat, type Comp, type LeadName, type V3 } from './core/model.js';
import { ODPOWIEDZI, RYTMY, WIELO_CYKL, artefakt, falaVF, liniaAsystolii, uderzenia, wielo, zestaw, type RytmId } from './nzk.dane.js';

const SEK = 6;

/** Styl lokalny: małe chipy też mają cel dotyku 44 px, długie etykiety się łamią; sprawdzone elektrody zostają czytelne. */
const CSS = `.nzk .hw-chip--sm{min-height:44px}.nzk .hw-chip{white-space:normal;line-height:1.2;text-align:center}.nzk .nzk-done[disabled]{opacity:.7}`;
let styled = false;
function ensureLocalStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.setAttribute('data-hw-nzk', '');
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

/** Nazwa w środku zdania: małą literą (skróty bez zmian). */
const wZdaniu = (t: string): string => (/^\p{Lu}{2}/u.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));

/** Bieżący przesuw (od lewej krawędzi do pióra) jeszcze raz, pełną zielenią i grubszą kreską. */
function jasnyPrzesuw(ctx: CanvasRenderingContext2D, m: MonitorMap, f: (t: number) => number): void {
  const ss = Math.floor(m.now / SEK) * SEK, xNow = (m.now - ss) * m.pxPerSec;
  if (xNow < 2) return;
  trace(ctx, f, { x: 0, w: xNow, t0: ss, t1: m.now, y0: m.y(0), pxPerMv: m.pxPerMv, color: C.puls, width: 2.2 });
}
const BEAT_N = vBeat();
const BEAT_V = vBeat({ qrs: 'vent' });
const BEAT_VT = vBeat({ qrs: 'vent', qt: 0.3 });
const P_N = pComps('normal');

/** Pobudzenie komorowe obrócone w płaszczyźnie czołowej i przeskalowane (wielokształtny VT). */
function obroc(b: Beat, deg: number, k: number): Beat {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const r = (v: V3): V3 => [k * (v[0] * c - v[1] * s), k * (v[0] * s + v[1] * c), k * v[2]];
  const m = (x: Comp[]) => x.map((q) => ({ ...q, v: r(q.v) }));
  return { ...b, qrs: m(b.qrs), t: m(b.t), u: m(b.u) };
}
const POLY: Beat[] = Array.from({ length: 2 * WIELO_CYKL }, (_, k) => { const w = wielo(k); return obroc(vBeat({ qrs: 'vent', qt: 0.28, qrsAmp: 1.5 }), w.obrot, w.skala); });

const OPIS: Record<RytmId, string> = {
  'vf-grube': 'Nieregularna, chaotyczna fala o zmiennej amplitudzie i kształcie, bez załamków P i zespołów QRS. Nie ma powtarzalnych zespołów ani punktu, od którego dałoby się mierzyć kolejny odstęp RR.',
  'vf-drobne': 'Fale są drobne, ale to nadal migotanie komór: chaotyczne, bez QRS. Wysokość fal nie jest zegarem zatrzymania krążenia. Gdy zwiększysz wzmocnienie, chaotyczna fala nadal jest widoczna.',
  vt: 'Równy, szeroki częstoskurcz z zespołami o podobnym kształcie, czyli częstoskurcz jednokształtny. Pacjent nie ma tętna, więc to częstoskurcz komorowy bez tętna (pVT).',
  'vt-wielo': 'Kolejne zespoły tego szerokiego częstoskurczu zmieniają wygląd, wysokość i kierunek. To VT wielokształtny. Pacjent nie ma tętna.',
  asystolia: 'Brak uchwytnej aktywności elektrycznej komór. Zanim uwierzysz płaskiej linii, sprawdź połączenia elektrod, wzmocnienie sygnału i inne odprowadzenie, bo odłączony przewód da dokładnie taki sam obraz. Robisz to sprawnie, przy trwającej RKO, w możliwie krótkiej przerwie potrzebnej do oceny rytmu.',
  'pea-waskie': 'Zorganizowany rytm z wąskimi QRS, inny niż częstoskurcz komorowy, ale bez tętna. To aktywność elektryczna bez tętna. Prąd płynie, impuls pobudza komory, ale skurcz nie daje przepływu.',
  'pea-szerokie': 'Wolny, zorganizowany rytm z szerokimi QRS, inny niż częstoskurcz komorowy, ale bez tętna. To aktywność elektryczna bez tętna. QRS bywają wąskie albo szerokie, rytm wolny albo szybki.',
  artefakt: 'Pacjent jest przytomny i rozmawia, a w II widać „migotanie”. Rytm oceniasz zawsze razem z pacjentem. Przełącz odprowadzenie i zaznacz szczyty: spod zakłóceń wyjdą regularne własne QRS.',
  odlaczona: 'Płaska linia wygląda jak asystolia. Odłączony przewód da jednak dokładnie taki sam obraz. Naciśnij „Sprawdź elektrody”, zanim uwierzysz płaskiej linii. Robisz to sprawnie, przy trwającej RKO, w możliwie krótkiej przerwie potrzebnej do oceny rytmu.',
};
const KLASA = {
  defib: 'Rytm do defibrylacji',
  niedefib: 'Rytm nie do defibrylacji',
  brak: 'To nie rytm zatrzymania krążenia, tylko zakłócenia',
} as const;
const klasaWhy = (id: RytmId): string => {
  const r = RYTMY[id];
  if (r.klasa === null) return 'Odklejona elektroda, drżenia mięśniowe czy ruch pacjenta potrafią narysować „migotanie” u kogoś, kto rozmawia z tobą przytomnie.';
  if (r.klasa === 'niedefib') return 'Asystolia i PEA to rytmy niedefibrylacyjne. Obecność QRS w PEA nie oznacza zachowanego krążenia.';
  if (r.rozp === 'vt') return 'Defibrylacji wymagają migotanie komór i częstoskurcz komorowy bez tętna, zarówno jednokształtny, jak i wielokształtny.';
  return 'U nieprzytomnego pacjenta bez prawidłowego oddechu taki obraz oznacza rytm do defibrylacji, także gdy fale są drobne.';
};

const RYTM_OPT: Record<string, RytmId> = {
  vf: 'vf-grube', 'vf-grube': 'vf-grube', 'vf-drobne': 'vf-drobne', vt: 'vt', 'vt-wielo': 'vt-wielo', asystolia: 'asystolia',
  pea: 'pea-waskie', 'pea-waskie': 'pea-waskie', 'pea-szerokie': 'pea-szerokie', artefakt: 'artefakt', odlaczona: 'odlaczona',
};

export function mountNzk(host: HTMLElement, opts: WstawkaOpts): () => void {
  ensureLocalStyle();
  const { root, body, live } = shell(host, {
    label: 'Wstawka · zatrzymanie krążenia',
    title: 'Monitor zatrzymania krążenia: rozpoznaj rytm w sekundę.',
    intro: 'Wybierz rytm i oceń go razem ze stanem pacjenta. Sprawdź pułapki: drobne migotanie, płaską linię i artefakt.',
  });
  root.classList.add('nzk');
  let mounted = false;
  let rytm: RytmId = RYTM_OPT[(opts.rytm ?? '').toLowerCase()] ?? 'vf-grube';
  let mode: 'zobacz' | 'zadanie' = opts.tryb === 'cwiczenie' ? 'zadanie' : 'zobacz';
  let lead: LeadName = 'II';
  let gain = false, podlaczone = false, szczyty = false, odkryte = true;
  let podlaczoneOd = Infinity;

  /* ─────────── pasek rytmu ─────────── */
  let strip = new Strip();
  let gen = 0;
  const beatsAt: number[] = [];
  const build = (now: number) => {
    strip = new Strip();
    beatsAt.length = 0;
    gen = now - SEK - 0.5;
    const r = rytm;
    if (r === 'vf-grube' || r === 'vf-drobne') strip.backgrounds.push((t, L) => falaVF(t, r === 'vf-grube', L.name === 'II' ? 1 : 1.6) * (L.name === 'II' ? 1 : 0.8));
    else if (r === 'odlaczona') strip.backgrounds.push((t, L) => (t >= podlaczoneOd ? falaVF(t, true, L.name === 'II' ? 3 : 3.6) : 0));
    else if (r === 'asystolia') strip.backgrounds.push((t) => liniaAsystolii(t));
    else if (r === 'artefakt') strip.backgrounds.push((t, L) => artefakt(t, L.name === 'II' ? 'II' : 'I'));
    feed(now);
  };
  const feed = (now: number) => {
    const until = now + 0.6;
    for (const u of uderzenia(rytm, gen, until)) {
      const beat = u.kind === 'vt' ? BEAT_VT : u.kind === 'vent' ? BEAT_V : u.kind === 'poly' ? POLY[u.k % POLY.length]! : BEAT_N;
      if (u.kind === 'n') strip.add({ kind: 'P', at: u.at - 0.16, comps: P_N });
      strip.add({ kind: 'QRS', at: u.at, beat });
      beatsAt.push(u.at);
    }
    gen = until;
    strip.prune(now - 12);
    while (beatsAt.length && beatsAt[0]! < now - 12) beatsAt.shift();
  };

  const mbarL = h('span');
  const mbarR = h('b');
  const screen = h('div', { class: 'hw-screen' }, h('div', { class: 'hw-mbar' }, mbarL, mbarR));
  let built = false;
  const mon = monitor(screen, {
    seconds: SEK, height: 200, scale: 'fit', base: 0.55, fitMv: 1.6,
    label: 'Kardiomonitor pacjenta w zatrzymaniu krążenia',
    signal: (t) => strip.volt(t, lead) * (gain ? 2 : 1),
    overlay: (ctx, m) => { jasnyPrzesuw(ctx, m, (t) => strip.volt(t, lead) * (gain ? 2 : 1)); drawPeaks(ctx, m); },
    tick: (now) => { if (!built) { built = true; build(now); } feed(now); },
  });
  const play = playToggle(mon);
  const restart = () => { build(mon.now()); mon.redraw(); };
  const fade = przenikanie([screen]);
  /** Zmiana stanu: od razu nowy zapis; przenikanie tylko jako tło, bez czekania. */
  const swap = (fn: () => void) => fade.run(() => { fn(); restart(); }, mounted);

  function drawPeaks(ctx: CanvasRenderingContext2D, m: MonitorMap) {
    if (!szczyty) return;
    ctx.font = `500 12px ${C.fontMono}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (!beatsAt.length) { ctx.fillStyle = C.txt2; ctx.fillText('brak powtarzalnych QRS do zaznaczenia', m.w / 2, 16); return; }
    let prev: number | null = null;
    for (const at of beatsAt) {
      const x = m.x(at + 0.045);
      if (x === null) { prev = null; continue; }
      ctx.fillStyle = C.puls;
      ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x + 5, 9); ctx.lineTo(x - 5, 9); ctx.closePath(); ctx.fill();
      if (prev !== null && x > prev) { ctx.strokeStyle = C.pulsDeep; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(prev + 6, 13.5); ctx.lineTo(x - 6, 13.5); ctx.stroke(); }
      prev = x;
    }
  }

  /* ─────────── stan pacjenta i klasyfikacja ─────────── */
  const pStan = h('p', { class: 'hw-cat' });
  const pTetno = h('p', { class: 'hw-cat' });
  const patient = h('div', { class: 'hw-panel hw-grid', style: 'gap:6px' }, h('p', { class: 'hw-label', text: 'Pacjent' }), pStan, pTetno);
  const name = h('p', { class: 'hw-verdict' });
  const klasa = h('p', { class: 'hw-cat' });
  const opis = h('p', { class: 'hw-why' });
  const klasaP = h('p', { class: 'hw-why' });
  const read = h('div', { class: 'hw-read' }, name, klasa, opis, klasaP);

  /* ─────────── narzędzia ─────────── */
  /** Przełącznik (aria-pressed) albo zwykły przycisk z etykietą zależną od stanu. */
  const tool = (label: () => string, on: (() => boolean) | null, f: () => void, cls = '') => {
    const b = h('button', { class: 'hw-chip hw-chip--sm' + cls, type: 'button', text: label() });
    const sync = () => {
      b.textContent = label();
      if (on) b.setAttribute('aria-pressed', String(on()));
    };
    b.addEventListener('click', () => { f(); sync(); paint(); mon.redraw(); });
    sync();
    return { b, sync };
  };
  const tLead = tool(() => (lead === 'II' ? 'Pokaż odprowadzenie I' : 'Wróć do odprowadzenia II'), null, () => { lead = lead === 'II' ? 'I' : 'II'; live(`Odprowadzenie ${lead}.`); });
  const tGain = tool(() => 'Zwiększ wzmocnienie', () => gain, () => { gain = !gain; live(gain ? 'Wzmocnienie zwiększone.' : 'Wzmocnienie zwykłe.'); });
  // jednokierunkowe: elektrod nie „odsprawdzisz”, więc po naciśnięciu przycisk staje się nieaktywny
  const tEl = tool(() => (podlaczone ? 'Elektrody sprawdzone' : 'Sprawdź elektrody'), null, () => {
    if (!podlaczone) podlaczoneOd = mon.now() + 0.05;
    podlaczone = true;
    tEl.b.disabled = true;
    live(rytm === 'odlaczona' ? 'Przewód był odłączony. Po podłączeniu widać migotanie komór.' : 'Elektrody podłączone prawidłowo.');
  }, ' nzk-done');
  const tPeak = tool(() => 'Zaznacz szczyty QRS', () => szczyty, () => { szczyty = !szczyty; live(szczyty ? (beatsAt.length ? 'Szczyty QRS zaznaczone.' : 'Brak powtarzalnych QRS do zaznaczenia.') : 'Znaczniki ukryte.'); });
  const tools = h('div', { class: 'hw-chips', role: 'group', 'aria-label': 'Sprawdź zapis' }, tLead.b, tGain.b, tEl.b, tPeak.b);
  const resetTools = () => { lead = 'II'; gain = false; podlaczone = false; podlaczoneOd = Infinity; szczyty = false; tEl.b.disabled = false; [tLead, tGain, tEl, tPeak].forEach((x) => x.sync()); };

  /* ─────────── wybór rytmu ─────────── */
  const rytmCh = chips((Object.keys(RYTMY) as RytmId[]).map((id) => ({ v: id, label: RYTMY[id].label })), rytm, (v) => {
    swap(() => { rytm = v; resetTools(); paint(); });
    live(`${RYTMY[v].label}.`);
  }, { label: 'Rytm na monitorze', small: true });

  /* ─────────── ćwiczenie ─────────── */
  let set: RytmId[] = [];
  const opt = options(ODPOWIEDZI, () => ex.odswiez());
  const ex = exercise<RytmId>({
    rounds: 6,
    make: (i) => { if (i === 0 || set.length === 0) set = zestaw(); return set[i % set.length]!; },
    show: (r) => {
      odkryte = false; opt.reset();
      swap(() => { rytm = r; resetTools(); paint(); });
    },
    prompt: 'Oceń monitor razem ze stanem pacjenta i wybierz rytm. Narzędzia pod zapisem pomogą przy pułapkach.',
    gotowe: () => opt.picked() !== null,
    check: (r) => {
      const picked = opt.picked();
      const right = RYTMY[r].rozp;
      opt.reveal(right, picked);
      odkryte = true; paint();
      const ok = picked === right;
      const lbl = wZdaniu(ODPOWIEDZI.find((o) => o.v === right)?.label ?? '');
      const kl = RYTMY[r].klasa;
      return {
        ok,
        prawidlowo: lbl,
        szczegol: ok ? `To ${lbl}.` : undefined,
        why: `${OPIS[r]} <b>${kl === 'defib' ? KLASA.defib : kl === 'niedefib' ? KLASA.niedefib : KLASA.brak}.</b> ${klasaWhy(r)}`,
      };
    },
    live,
  });
  ex.miejsce.append(opt.el);
  const exPanel = h('div', { class: 'hw-grid' }, ex.el);

  const modeCh = chips([{ v: 'zobacz', label: TRYB_UCZ }, { v: 'zadanie', label: TRYB_SPRAWDZ }] as const, mode, (v) => setMode(v), { label: 'Tryb wstawki' });
  body.append(
    h('div', { class: 'hw-bar' }, modeCh.el, play),
    rytmCh.el,
    h('div', { class: 'hw-2col hw-2col--wide-l', style: 'align-items:start' },
      h('div', { class: 'hw-grid' }, screen, tools, h('p', { class: 'hw-note', text: 'Częstość i wysokość fal są poglądowe. Patrz na kształt, powtarzalność i pacjenta.' })),
      patient),
    read, exPanel,
  );

  function paint() {
    const r = RYTMY[rytm];
    mbarL.replaceChildren(h('i', { class: 'hw-dot' }), `${lead} · 25 mm/s${gain ? ' · wzmocnienie zwiększone' : ''}`);
    mbarR.textContent = mode === 'zadanie' && !odkryte ? 'Monitor' : r.label;
    pStan.textContent = r.pacjent === 'nzk' ? 'Nieprzytomny, nie oddycha prawidłowo' : 'Przytomny, rozmawia z tobą';
    pTetno.textContent = r.tetno === 'brak' ? '○ Tętno: brak' : '● Tętno: wyczuwalne';
    pTetno.className = 'hw-cat ' + (r.tetno === 'brak' ? 'hw-bad' : '');
    if (mode === 'zadanie') return;
    name.textContent = rytm === 'odlaczona' ? (podlaczone ? 'Po podłączeniu: migotanie komór' : 'Płaska linia przy odłączonym przewodzie') : r.label;
    const kl = rytm === 'odlaczona' && !podlaczone ? null : r.klasa;
    klasa.textContent = rytm === 'odlaczona' && !podlaczone ? 'Najpierw sprawdź elektrody' : kl === 'defib' ? `▲ ${KLASA.defib}` : kl === 'niedefib' ? `■ ${KLASA.niedefib}` : KLASA.brak;
    klasa.className = 'hw-cat ' + (kl === 'defib' ? 'hw-bad' : rytm === 'odlaczona' || kl === null ? 'hw-warn' : '');
    opis.textContent = rytm !== 'odlaczona' ? OPIS[rytm] : podlaczone ? 'Przewód był odłączony. ' + OPIS['vf-grube'] : OPIS.odlaczona;
    klasaP.textContent = rytm === 'odlaczona' && !podlaczone ? '' : klasaWhy(rytm);
  }

  function setMode(m: 'zobacz' | 'zadanie') {
    mode = m; modeCh.set(m);
    rytmCh.el.hidden = m !== 'zobacz';
    read.hidden = m !== 'zobacz';
    exPanel.hidden = m !== 'zadanie';
    if (m === 'zadanie') ex.start();
    else { odkryte = true; swap(() => { resetTools(); paint(); }); }
    paint();
  }

  setMode(mode);
  mounted = true;
  return () => {
    fade.stop();
    mon.destroy();
    host.replaceChildren();
  };
}

