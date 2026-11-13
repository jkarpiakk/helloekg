/**
 * Fala na rondzie — krążenie nawrotne (S7_01). Raster ronda z biblioteki GPT, fala i pas w refrakcji liczone
 * w `rondo.dane.ts`; w etapie „Zapalnik” kardiomonitor pisze zapis z tych samych zdarzeń.
 *
 * Opcje: etap=fala|warunki|zapalnik, tryb=cwiczenie.
 */
import { C, TRYB_SPRAWDZ, TRYB_UCZ, button, chips, exercise, h, loop, options, reducedMotion, s, setA, shell, shuffle, spring, uklad, type Spring, type WstawkaOpts } from './core/ui.js';
import { svgNaRastrze } from './core/obrazy.js';
import { kardiomonitor, type Kardiomonitor, type Scenariusz } from './core/kardiomonitor.js';
import { pComps, vBeat } from './core/rytm.js';
import type { Comp } from './core/model.js';
import type { Generator, Pisak } from './core/rytmy.js';
import { dzwiekDla } from './core/dzwiek.js';
import {
  AVNRT, CYKL, DO_KOMOR, N, ODPOWIEDZI, POWROTY, REFRAKCJA, Rondo, WARUNKI, ZADANIA, jednolite, odpowiedz, przygotuj, stanDrog,
  type Powrot, type Uklad, type Warunek, type Wynik, type Zadanie, type Zdarzenie,
} from './rondo.dane.js';

type Etap = 'fala' | 'warunki' | 'zapalnik';

/** Geometria rastra: środek ronda, oś pasa i jego szerokość, koniec jezdni wyjazdu. */
const CX = 419.5, CY = 419, RP = 228, SZ = 104, R_ZEW = 305, DOL_RAST = 838;
const TEMPO = 0.1, TEMPO_ZAPALNIK = 0.25;
/** Szlaban na prawej drodze, tuż pod jej wspólnym początkiem z lewą. */
const U_SZLABAN = 0.93, KAT_GORA = -78;
const P_ZAT = pComps('normal');
/** Wsteczne P jak w scenariuszu AVNRT kardiomonitora. */
const P_WSTECZNY: Comp[] = [{ t: 0.035, w: 0.016, v: [-0.03, -0.13, 0.09] }];

const pkt = (u: number, r = RP): [number, number] => [CX - r * Math.sin(2 * Math.PI * u), CY - r * Math.cos(2 * Math.PI * u)];
const f1 = (v: number) => v.toFixed(1);
/** Łuk pasa od u0 do u1 (rosnące u = przeciwnie do wskazówek zegara). */
function luk(u0: number, u1: number): string {
  const [x0, y0] = pkt(u0), [x1, y1] = pkt(u1 >= u0 + 0.999 ? u0 + 0.5 : u1);
  const czesc = `A${RP} ${RP} 0 0 0 ${f1(x1)} ${f1(y1)}`;
  if (u1 >= u0 + 0.999) return `M${f1(x0)} ${f1(y0)}${czesc}A${RP} ${RP} 0 0 0 ${f1(x0)} ${f1(y0)}`;
  return `M${f1(x0)} ${f1(y0)}A${RP} ${RP} 0 ${u1 - u0 > 0.5 ? 1 : 0} 0 ${f1(x1)} ${f1(y1)}`;
}
const zMalej = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

let kolejnyWzor = 0;

export function mountRondo(host: HTMLElement, opts: WstawkaOpts): () => void {
  const { body, live } = shell(host, {
    label: 'Wstawka · krążenie nawrotne',
    title: 'Fala na rondzie: kiedy krąży, a kiedy gaśnie',
    intro: 'Puść falę po rondzie i sprawdź, czy dogoni własny ogon. Potem zdejmuj warunki i wyślij zapalnik.',
  });
  const cleanups: Array<() => void> = [];

  /* ─── scena ─── */
  const rs = svgNaRastrze('rondo', { label: 'Rondo widziane z góry. Fala pobudzenia jedzie po jezdni, za nią zostaje pas w refrakcji.' });
  const svg = rs.svg, g = rs.nakladka;
  const wzorId = `hw-rondo-pasy-${++kolejnyWzor}`;
  const defs = s('defs', {}, svg);
  const wzor = s('pattern', { id: wzorId, width: 26, height: 26, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  s('rect', { width: 26, height: 26, fill: 'rgba(255,255,255,.1)' }, wzor);
  s('rect', { width: 11, height: 26, fill: 'rgba(255,255,255,.3)' }, wzor);

  const brakDrogi = s('path', { d: luk(0.53, 0.97), fill: 'none', stroke: C.screen, 'stroke-width': SZ + 34, 'stroke-linecap': 'butt', opacity: 0.86, visibility: 'hidden' }, g);
  const pasZam = s('path', { fill: 'none', stroke: `url(#${wzorId})`, 'stroke-width': SZ }, g);
  const [sx0, sy0] = pkt(0, RP - SZ / 2), [sx1, sy1] = pkt(0, RP + SZ / 2);
  s('line', { x1: sx0, y1: sy0, x2: sx1, y2: sy1, stroke: C.txt2, 'stroke-width': 4 }, g);
  const sTekst = s('text', { x: CX + 66, y: 62, fill: C.txt, 'font-size': 30, 'font-weight': 500 }, g);
  sTekst.textContent = 'Start';
  // dwa czoła fal i dwie kropki pobudzeń na wyjeździe
  const czola = [0, 1].map(() => {
    const gr = s('g', { visibility: 'hidden' }, g);
    const ogon = s('path', { fill: 'none', stroke: C.puls, 'stroke-width': 26, 'stroke-linecap': 'butt' }, gr);
    const grot = s('polygon', { points: '-20,-40 26,0 -20,40', fill: C.puls }, gr);
    return { gr, ogon, grot };
  });
  const kropki = [0, 1].map(() => s('circle', { r: 19, cx: CX, fill: C.puls, visibility: 'hidden' }, g));
  const znakGasniecia = s('g', { visibility: 'hidden' }, g);
  s('path', { d: 'M-32 -32L32 32M32 -32L-32 32', stroke: C.alarm, 'stroke-width': 13, 'stroke-linecap': 'round', fill: 'none' }, znakGasniecia);

  const [spx, spy] = pkt(U_SZLABAN, R_ZEW - 8), [skx, sky] = pkt(U_SZLABAN, RP - SZ / 2 - 4);
  const szl = s('g', { visibility: 'hidden' }, g);
  const szlRamie = s('g', {}, szl);
  s('line', { x1: spx, y1: spy, x2: skx, y2: sky, stroke: C.txt, 'stroke-width': 15, 'stroke-linecap': 'round' }, szlRamie);
  s('line', { x1: spx, y1: spy, x2: skx, y2: sky, stroke: C.alarm, 'stroke-width': 15, 'stroke-dasharray': '24 24' }, szlRamie);
  s('circle', { cx: spx, cy: spy, r: 15, fill: C.txt2 }, szl);

  const podpisL = [0, 1, 2].map((i) => s('text', { x: 18, y: 42 + i * 36, fill: i === 2 ? C.puls : C.txt, 'font-size': 30 }, g));
  const podpisP = [0, 1, 2].map((i) => s('text', { x: 822, y: 42 + i * 36, 'text-anchor': 'end', fill: i === 2 ? C.puls : C.txt, 'font-size': 30 }, g));
  const scena = h('div', {}, svg);
  // tor całej wstawki, nie ciągły: w „Zapalniku” ton QRS daje kardiomonitor, jedyne źródło ciągłe
  const snd = dzwiekDla(body);

  /* ─── oś czasu ─── */
  const osZam = h('i', { style: 'position:absolute;inset:0 auto 0 0;background:repeating-linear-gradient(45deg,rgba(255,255,255,.34) 0 4px,rgba(255,255,255,.1) 4px 9px)' });
  const osPowrot = h('i', { style: `position:absolute;top:-4px;bottom:-4px;width:3px;margin-left:-1px;background:${C.txt}` });
  const osTeraz = h('i', { style: `position:absolute;top:0;bottom:0;width:3px;margin-left:-1px;background:${C.puls}` });
  const osPasek = h('div', { style: 'position:relative;height:14px;border:1px solid var(--hw-line2);border-radius:3px;margin:4px 0' }, osZam, osPowrot, osTeraz);
  const osRef = h('b'), osPow = h('b'), osOkr = h('b', { text: '0' });
  const os = h('div', { class: 'hw-grid', style: 'gap:6px' }, osPasek,
    h('div', { class: 'hw-tags' }, h('span', { class: 'hw-tag' }, 'Refrakcja ', osRef), h('span', { class: 'hw-tag' }, 'Powrót po ', osPow), h('span', { class: 'hw-tag' }, 'Okrążenia ', osOkr)),
    h('p', { class: 'hw-note', text: 'To przykładowe czasy, nie progi rozpoznania. Ruch 10 razy wolniejszy.' }));

  const monBox = h('div', { hidden: true });
  const notaMon = h('p', { class: 'hw-note', hidden: true, text: 'Ruch i zapis 4 razy wolniejsze, częstości przykładowe. Na zapisie szukasz przedwczesnego P, po nim wydłużonego PQ, a potem nagłego, miarowego częstoskurczu, w którym P zwykle chowa się w QRS.' });

  /* ─── stan ─── */
  let etap: Etap = opts.etap === 'warunki' || opts.etap === 'zapalnik' ? opts.etap : 'fala';
  let task = opts.tryb === 'cwiczenie';
  let powrot: Powrot = 'wolny', warunek: Warunek = 'wszystkie';
  let rondo = new Rondo(jednolite(POWROTY.wolny, REFRAKCJA));
  let czas = 0, gra = false, tempo = TEMPO, okrazenia = 0, koniecPo = Infinity;
  let wyjazdy: number[] = [];
  let gasniecie: { i: number; at: number } | null = null;
  let szlabanJest = false, szlabanGora = false;
  let katSzl = 0, sprSzl: Spring | null = null, ostatniStuk = -Infinity;
  let m: Kardiomonitor | null = null;
  let wObiegu = false, wyslany = false, nastZat = 0, ostatniBodziec = -Infinity;

  const ramie = () => setA(szlRamie, { transform: `rotate(${katSzl.toFixed(1)} ${spx} ${spy})` });
  function szlaban(gora: boolean, odRazu = false) {
    if (!odRazu && gora !== szlabanGora) snd.zatrzask();
    szlabanGora = gora;
    const cel = gora ? KAT_GORA : 0;
    if (odRazu || reducedMotion()) { sprSzl?.stop(); sprSzl = null; katSzl = cel; ramie(); return; }
    if (sprSzl) sprSzl.retarget(cel);
    else sprSzl = spring(katSzl, cel, (v) => { katSzl = v; ramie(); }, { response: 0.32, done: () => { sprSzl = null; } });
  }
  function pokazSzlaban(on: boolean) {
    szlabanJest = on;
    setA(szl, { visibility: on ? 'visible' : 'hidden' });
    if (on) szlaban(false, true);
  }
  function podpisy(l: readonly string[], p: readonly string[]) {
    podpisL.forEach((e, i) => { e.textContent = l[i] ?? ''; });
    podpisP.forEach((e, i) => { e.textContent = p[i] ?? ''; });
  }
  /** Stan obu dróg w rogach sceny (zapalnik). */
  function lampy(t: number) {
    const wolna = !rondo.zamknieta(1, t) && !rondo.zamknieta(0, t), szybka = !rondo.zamknieta(N - 1, t);
    podpisL[0]!.textContent = 'Droga'; podpisL[1]!.textContent = 'wolna'; podpisL[2]!.textContent = wolna ? 'otwarta' : 'zamknięta';
    podpisP[0]!.textContent = 'Droga'; podpisP[1]!.textContent = 'szybka'; podpisP[2]!.textContent = szybka ? 'otwarta' : 'zamknięta';
    setA(podpisL[2]!, { fill: wolna ? C.puls : C.txt2 });
    setA(podpisP[2]!, { fill: szybka ? C.puls : C.txt2 });
  }

  function rysuj(t: number) {
    setA(pasZam, { d: rondo.odcinkiZamkniete(t).map(([a, b]) => luk(a, b)).join('') });
    const cz = rondo.czola(t);
    czola.forEach((c, i) => {
      const f = cz[i];
      if (!f) { setA(c.gr, { visibility: 'hidden' }); return; }
      const [x, y] = pkt(f.u);
      const w = 2 * Math.PI * f.u, kat = Math.atan2(Math.sin(w) * f.kierunek, -Math.cos(w) * f.kierunek) * 180 / Math.PI;
      setA(c.gr, { visibility: 'visible' });
      setA(c.ogon, { d: f.kierunek > 0 ? luk(f.u - 0.05, f.u) : luk(f.u, f.u + 0.05) });
      setA(c.grot, { transform: `translate(${f1(x)} ${f1(y)}) rotate(${f1(kat)})` });
      // szlaban podnosi się przed falą wracającą prawą drogą
      if (szlabanJest && !szlabanGora && f.kierunek > 0 && f.u > 0.72) szlaban(true);
    });
    kropki.forEach((k, i) => {
      const t0 = wyjazdy[i];
      const p = t0 === undefined ? 2 : (t - t0) / 0.14;
      if (p < 0 || p > 1) { setA(k, { visibility: 'hidden' }); return; }
      setA(k, { visibility: 'visible', cy: f1(CY + R_ZEW + p * (DOL_RAST - CY - R_ZEW)) });
    });
    if (gasniecie) {
      const [x, y] = pkt(gasniecie.i / N);
      setA(znakGasniecia, { visibility: 'visible', transform: `translate(${f1(x)} ${f1(y)})` });
    } else setA(znakGasniecia, { visibility: 'hidden' });
    if (!os.hidden) {
      const T = rondo.uklad.lewa + rondo.uklad.prawa, skala = Math.max(T, rondo.uklad.rLewa) + 0.04;
      const teraz = okrazenia > 0 || t <= T ? t % T : T;
      osZam.style.width = `${(rondo.uklad.rLewa / skala) * 100}%`;
      osPowrot.style.left = `${(T / skala) * 100}%`;
      osTeraz.style.left = `${(Math.min(teraz, T) / skala) * 100}%`;
    }
    if (task ? biezace?.zaplon !== undefined : etap === 'zapalnik') lampy(t);
  }

  /* ─── status i przebieg ─── */
  const status = h('p', { class: 'hw-why' });
  const glowny = button('Puść falę', () => { if (etap === 'zapalnik') wyslij(); else restart(true); });
  const pauza = h('button', { class: 'hw-chip hw-chip--sm', type: 'button', 'aria-pressed': 'false', text: 'Pauza' });
  const odNowa = h('button', { class: 'hw-chip hw-chip--sm', type: 'button', text: 'Zacznij od nowa' });
  odNowa.addEventListener('click', () => startZapalnik());
  const malujPauze = () => { pauza.textContent = gra ? 'Pauza' : 'Graj'; pauza.setAttribute('aria-pressed', gra ? 'false' : 'true'); };
  pauza.addEventListener('click', () => { gra = !gra; malujPauze(); });

  const tekstFali = (obieg: boolean) => obieg
    ? 'Fala wróciła po 300 ms i zastała tkankę gotową. Ogon zdążył się oddalić, więc obieg trwa, a każde okrążenie daje jedno pobudzenie serca.'
    : 'Fala wróciła po 200 ms, a pas jest zamknięty przez 250 ms. Dogoniła ogon za wcześnie, wpadła na tkankę jeszcze niepobudliwą i zgasła.';
  function podsumuj(obieg: boolean) {
    if (task) return;
    const tekst = etap === 'fala' ? tekstFali(obieg) : WARUNKI[warunek].tekst;
    status.textContent = tekst; live(tekst);
  }
  /** Głuchy stuk gaśnięcia; dwie zderzone fale gasną razem, więc jeden stuk. */
  function stukGasniecia(at: number) {
    if (at - ostatniStuk > 0.1) snd.stuk();
    ostatniStuk = at;
  }
  /** Dźwięki: ton QRS na każde pobudzenie, tyk przy powrocie na start, zatrzask szlabanu, stuk gaśnięcia. */
  function obsluz(zd: Zdarzenie[], cicho = false) {
    for (const z of zd) {
      if (z.typ === 'dol') { wyjazdy = [z.at, ...wyjazdy].slice(0, 2); if (!cicho) snd.qrs(); }
      else if (z.typ === 'gora' && z.kierunek > 0) {
        okrazenia++; osOkr.textContent = String(okrazenia);
        if (!cicho) snd.tik(false);
        if (okrazenia === 1) podsumuj(true);
      } else if (z.typ === 'gasnie') {
        gasniecie = { i: z.i, at: z.at }; koniecPo = z.at + 0.3;
        if (!cicho) stukGasniecia(z.at);
        if (rondo.zywe() === 0) podsumuj(false);
      } else if (z.typ === 'koniec') { koniecPo = z.at + 0.3; podsumuj(false); }
      else if (z.typ === 'szlaban') { if (!szlabanJest) pokazSzlaban(true); if (!cicho) snd.zatrzask(); }
    }
  }

  function zaladuj(u: Uklad, t0: number) {
    rondo = new Rondo(u);
    czas = t0; okrazenia = 0; koniecPo = Infinity; wyjazdy = []; gasniecie = null; ostatniStuk = -Infinity;
    osOkr.textContent = '0';
    osRef.textContent = `${Math.round(u.rLewa * 1000)} ms`;
    osPow.textContent = `${Math.round((u.lewa + u.prawa) * 1000)} ms`;
    setA(brakDrogi, { visibility: u.jednaDroga ? 'visible' : 'hidden' });
    pokazSzlaban(!!u.szlaban);
  }
  const ukladEtapu = (): Uklad => etap === 'warunki' ? WARUNKI[warunek].uklad : jednolite(POWROTY[powrot], REFRAKCJA);
  /** Rusza falę od początku. `gest`: kursant nacisnął przycisk, więc można grać także przy „Ogranicz ruch”. */
  function restart(gest: boolean) {
    tempo = TEMPO;
    zaladuj(ukladEtapu(), 0);
    rondo.bodziec(0, { tylkoLewa: etap === 'fala' });
    gra = gest || !reducedMotion();
    if (gra) snd.tik(true);
    obsluz(rondo.odbierz(), !gra);
    if (etap === 'warunki') podpisy([], szlabanJest ? ['Szlaban'] : WARUNKI[warunek].uklad.jednaDroga ? ['Brak', 'drogi'] : []);
    else podpisy([], []);
    if (!gra) {
      // stan kanoniczny przy „Ogranicz ruch”: fala tuż przed powrotem, widać ogon i pas
      czas = (rondo.uklad.lewa + rondo.uklad.prawa) * 0.93;
      rondo.doCzasu(czas); obsluz(rondo.odbierz(), true);
      glowny.textContent = 'Puść falę';
    } else glowny.textContent = 'Puść falę jeszcze raz';
    status.textContent = etap === 'fala'
      ? 'Fala jedzie w jednym kierunku, a za nią zostaje pas, który przez chwilę jest zamknięty: tkanka nie przyjmie kolejnego impulsu, dopóki nie skończy się okres refrakcji.'
      : 'Patrz, co stanie się z falą po starcie.';
    pauza.hidden = false;
    malujPauze();
    rysuj(czas);
  }

  /* ─── zapalnik: kardiomonitor pisze zapis ze zdarzeń ronda ─── */
  const bPrawidlowy = vBeat(), bCzestoskurcz = vBeat({ qt: 0.28 });
  function zapiszZdarzenia(p: Pisak, zd: Zdarzenie[]) {
    for (const z of zd) {
      if (z.typ === 'dol') {
        p.add({ kind: 'QRS', at: z.at + DO_KOMOR, beat: wObiegu ? bCzestoskurcz : bPrawidlowy, tag: 'qrs' });
        wyjazdy = [z.at, ...wyjazdy].slice(0, 2);
      } else if (z.typ === 'gora' && z.kierunek > 0) {
        p.add({ kind: 'P', at: z.at, comps: P_WSTECZNY, tag: 'p' });
        if (wyslany && !wObiegu) {
          wObiegu = true; szlaban(true);
          const t = 'Fala wróciła drogą szybką i wjechała znów do wolnej. Napad zwykle nie rozkręca się stopniowo, tylko rusza z miejsca, równy od pierwszego okrążenia. Węzeł zatokowy nie musi dostarczać impulsu na każde okrążenie: rondo napędza się samo.';
          status.textContent = t; live(t);
        }
      } else if (z.typ === 'gasnie') {
        // w rytmie podstawowym zderzenie fal to norma: znak tylko po bodźcu kursanta
        if (z.at - ostatniBodziec < 0.5) { gasniecie = { i: z.i, at: z.at }; stukGasniecia(z.at); }
      } else if (z.typ === 'szlaban' && z.at === ostatniBodziec) { pokazSzlaban(true); snd.zatrzask(); }
    }
  }
  /** Zdarzenie dzieje się teraz, a nie w zapisie wypełnianym przy starcie monitora. */
  const terazSie = (at: number) => !!m && !m.paused() && m.now() - at < 0.1;
  const scenariuszZapalnika = (): Scenariusz => ({
    id: 'rondo-zapalnik', nazwa: 'Zapis z odprowadzenia II', odprowadzenia: ['II'], pleth: false, spo2: null, okno: 6,
    opis: 'Kardiomonitor: rytm zatokowy, a po pobudzeniu przedwczesnym, które zastało otwartą drogę wolną, nagły, miarowy częstoskurcz.',
    rytm: () => {
      rondo = new Rondo(AVNRT); nastZat = 0.3;
      const gen: Generator = (p, until) => {
        const teraz = until - 3;
        while (!wObiegu && nastZat <= teraz) {
          p.add({ kind: 'P', at: nastZat, comps: P_ZAT, tag: 'p' });
          rondo.bodziec(nastZat);
          if (terazSie(nastZat)) snd.tik(false);
          nastZat += CYKL;
        }
        rondo.doCzasu(teraz);
        const zd = rondo.odbierz();
        zapiszZdarzenia(p, zd);
        if (gasniecie && teraz - gasniecie.at > 0.3) gasniecie = null;
        pisak = p;
      };
      return gen;
    },
  });
  let pisak: Pisak | null = null;
  function startZapalnik() {
    wObiegu = false; wyslany = false; ostatniBodziec = -Infinity; gasniecie = null; wyjazdy = [];
    pokazSzlaban(false);
    glowny.textContent = 'Wyślij pobudzenie przedwczesne'; glowny.hidden = false;
    setA(brakDrogi, { visibility: 'hidden' });
    if (!m) m = kardiomonitor(monBox, scenariuszZapalnika(), { wariant: 'kompakt', przyciskDzwieku: false, tempo: TEMPO_ZAPALNIK });
    else { m.ustaw(scenariuszZapalnika()); if (!reducedMotion()) m.setPaused(false); }
    status.textContent = 'Rytm podstawowy schodzi do komór drogą szybką, a w drodze wolnej fale zderzają się i gasną. Patrz na stan dróg i wyślij pobudzenie przedwczesne w chwili, gdy jedna jest otwarta, a druga zamknięta.';
  }
  function wyslij() {
    if (!m) return;
    const t = m.now();
    rondo.doCzasu(t);
    const stan = stanDrog(rondo, t);
    if (stan !== 'obie-zamkniete') {
      pisak?.add({ kind: 'P', at: t, comps: P_ZAT, tag: 'p' });
      wyslany = stan === 'okno';
      ostatniBodziec = t; gasniecie = null; pokazSzlaban(false);
      snd.tik(true);
      rondo.bodziec(t);
      nastZat = t + CYKL;
      glowny.hidden = wyslany;
    }
    const tekst = stan === 'okno'
      ? 'Pobudzenie trafia na dwie drogi w różnym stanie. Droga szybka przewodzi szybko, ale ma dłuższą refrakcję. Wciąż jest zamknięta, więc impuls blokuje się w niej i schodzi drogą wolną. Patrz, czy droga szybka zdąży się otworzyć.'
      : stan === 'obie-otwarte'
        ? 'Za późno: obie drogi są gotowe. Impuls przechodzi obiema, fale się zderzają i rondo się nie otwiera. Spróbuj wcześniej.'
        : 'Za wcześnie: obie drogi są jeszcze zamknięte i impuls nie wchodzi. Spróbuj chwilę później.';
    status.textContent = tekst; live(tekst);
  }

  /* ─── ćwiczenie ─── */
  let biezace: Zadanie | null = null;
  let start: ReturnType<typeof przygotuj> | null = null;
  const opt = options(ODPOWIEDZI, () => ex.odswiez());
  const zestaw = (): Zadanie[] => {
    for (;;) {
      const z = shuffle(ZADANIA).slice(0, 5);
      if (new Set(z.map(odpowiedz)).size === 3) return z;
    }
  };
  let zad: Zadanie[] = [];
  const ex = exercise<Zadanie>({
    rounds: 5,
    make: (i) => { if (i === 0 || !zad.length) zad = zestaw(); return zad[i % zad.length]!; },
    show: (z) => {
      opt.reset();
      biezace = z;
      start = przygotuj(z);
      tempo = z.zaplon === undefined ? TEMPO : TEMPO_ZAPALNIK;
      gra = false;
      zaladuj(z.uklad, z.zaplon ?? 0);
      rondo = start.r;
      os.hidden = true;
      podpisy([], z.uklad.szlaban ? ['Szlaban'] : []);
      rysuj(czas);
    },
    prompt: (z) => z.polecenie,
    gotowe: () => opt.picked() !== null,
    check: (z) => {
      const picked = opt.picked() as Wynik | null;
      const right = odpowiedz(z);
      opt.reveal(right, picked);
      snd.tik(true);
      start?.odpal();
      obsluz(rondo.odbierz());
      gra = true;
      if (z.czasy) os.hidden = false;
      const lbl = ODPOWIEDZI.find((o) => o.v === right)?.label ?? '';
      return { ok: picked === right, prawidlowo: zMalej(lbl), why: z.dlaczego };
    },
    live,
  });
  ex.miejsce.append(opt.el);

  /* ─── sterowanie ─── */
  const etapCh = chips([{ v: 'fala', label: 'Fala i ogon' }, { v: 'warunki', label: 'Trzy warunki' }, { v: 'zapalnik', label: 'Zapalnik' }] as const, etap, (v) => { etap = v; ustaw(); }, { label: 'Etap wstawki' });
  const powrotCh = chips([{ v: 'wolny', label: 'Powrót po 300 ms' }, { v: 'szybki', label: 'Powrót po 200 ms' }] as const, powrot, (v) => { powrot = v; restart(true); live(`${v === 'wolny' ? 'Powrót po 300 ms' : 'Powrót po 200 ms'}.`); }, { label: 'Czas powrotu fali', small: true });
  const warCh = chips((Object.keys(WARUNKI) as Warunek[]).map((k) => ({ v: k, label: WARUNKI[k].label })), warunek, (v) => { warunek = v; restart(true); live(`Warunki: ${WARUNKI[v].label}.`); }, { label: 'Które warunki są spełnione', small: true });
  const przyciski = h('div', { class: 'hw-row', style: 'gap:8px;align-items:center;flex-wrap:wrap' }, glowny, odNowa, pauza);
  const panelUcz = h('div', { class: 'hw-grid', style: 'gap:12px' }, powrotCh.el, warCh.el, status, przyciski);
  const modeCh = chips([{ v: 'ucz', label: TRYB_UCZ }, { v: 'task', label: TRYB_SPRAWDZ }] as const, task ? 'task' : 'ucz', (v) => { task = v === 'task'; ustaw(); }, { label: 'Tryb wstawki' });

  function ustaw() {
    const zap = etap === 'zapalnik' && !task;
    panelUcz.hidden = task; etapCh.el.hidden = task; ex.el.hidden = !task; glowny.hidden = false;
    powrotCh.el.hidden = etap !== 'fala'; warCh.el.hidden = etap !== 'warunki';
    monBox.hidden = !zap; notaMon.hidden = !zap;
    pauza.hidden = zap; odNowa.hidden = !zap;
    os.hidden = task || etap !== 'fala';
    gra = false;
    podpisy([], []);
    setA(podpisL[2]!, { fill: C.puls }); setA(podpisP[2]!, { fill: C.puls });
    if (!zap) m?.setPaused(true);
    if (task) { biezace = null; ex.start(); return; }
    biezace = null;
    if (zap) startZapalnik(); else restart(false);
  }

  const lp = loop(svg, (_t, dt) => {
    if (etap === 'zapalnik' && !task && m) {
      czas = m.now();
      rysuj(czas);
      return;
    }
    if (!gra || dt <= 0) return;
    czas += dt * tempo;
    rondo.doCzasu(czas);
    obsluz(rondo.odbierz());
    rysuj(czas);
    if (czas >= koniecPo) { gra = false; pauza.hidden = true; }
  });
  cleanups.push(() => lp.stop());

  // scena: rondo, a pod nim kardiomonitor i oś czasu; na telefonie na pełnym ekranie przypięte zostaje samo rondo
  const podRondem = h('div', { class: 'hw-grid', style: 'gap:10px' }, monBox, notaMon, os);
  const podRondemSlot = h('div', { hidden: true });
  body.append(uklad({
    gora: [h('div', { class: 'hw-bar' }, modeCh.el), etapCh.el],
    scena: [scena, podRondem],
    ster: [podRondemSlot, panelUcz, ex.el],
    dwieKolumny: true,
    naWaskim: (waski) => {
      // puste gniazdo ukryte, żeby nie dokładało odstępu w siatce
      podRondemSlot.hidden = !waski;
      if (waski) podRondemSlot.append(podRondem); else scena.after(podRondem);
    },
  }));
  ustaw();
  return () => {
    cleanups.forEach((f) => f());
    sprSzl?.stop();
    m?.destroy();
    host.replaceChildren();
  };
}
