/**
 * Droga impulsu — serce i zapis w jednym kadrze. Schemat układu bodźcoprzewodzącego (SVG)
 * i odprowadzenie II (canvas, model wektorowy) mają wspólny zegar: kursor czasu na zapisie
 * ustawia chwilę, a schemat pokazuje, co jest wtedy pobudzone i gdzie jest czoło fali.
 * Wykład: S1_00 (plansze 3, 5, 6, 7, 8); dodatkowo S4_04 i S4_05.
 *
 * Rysunek: raster marki „sercePrzod” (`core/obrazy.ts`) z nakładką SVG w pikselach rastra (układ przewodzący jak
 * prześwietlenie, fala jako półprzezroczyste obszary). Metafory to sceny rastrowe nad schematem (przenikanie).
 *
 * Tryby: „Ucz się” (tematy: Mapa zapisu, Brama AV, Autostrady, Hierarchia, Automatyzm) i „Sprawdź się”.
 * Opcje dyrektywy: tryb=mapa | brama | autostrady | hierarchia | automatyzm | cwiczenie
 * (domyślnie mapa; cwiczenie otwiera „Sprawdź się”). Nieznane opcje są ignorowane.
 */
import {
  C, TRYB_SPRAWDZ, TRYB_UCZ, chips, clamp, drag, exercise, fmtNum, guma, h, loop, options, paper, projekcja, reducedMotion, s, setA, shell, shuffle, slider,
  spring, surface, trace, type Spring, type Surface, type WstawkaOpts,
} from './core/ui.js';
import {
  DO_AV, HV, OKNO, postojAV, P_DUR, PROG, W, faza, granice, hrZCyklu, kratki, plany, potencjal, pqBlokI, pqWNormie, scenAutomatyzm,
  scenHierarchia, scenZastepczy, scenZatokowy, stan, sygnal, zaplonySA, zatrzask,
  SCIEZKI, STOP, STREFY,
  type Blok, type Czolo, type Faza, type Hier, type Plan, type Scen, type Sciezka, type Seg, type Stan, type Strefa, type Tryb, type Zrodlo,
} from './droga-impulsu.dane.js';
import { scenaPrzenikana, svgNaRastrze, type ObrazId } from './core/obrazy.js';
import { dzwiekDla } from './core/dzwiek.js';

type Widok = Tryb | 'cwiczenie';
type Str = 'sa' | 'przedsionki' | 'av' | 'his' | 'odnogi' | 'purkinje' | 'komory';

/* ─────────── geometria: raster „sercePrzod” (1000 × 1000 px), układ przewodzący jak prześwietlenie ─────────── */

/** Kadr rastra z marginesami na podpisy (w pikselach rastra). */
const KADR = { x: -60, y: 80, w: 1120, h: 850 };
/** Rozmiar napisów w pikselach rastra: 12 px CSS przy szerokości 345 px. */
const FS = Math.ceil((12 * KADR.w) / 345);
const pts = (a: ReadonlyArray<readonly [number, number]>) => a.map(([x, y]) => `${x} ${y}`).join('L');
/** Prawy przedsionek (z uszkiem) i uszko lewego przedsionka, dopasowane do konturu na rastrze. */
const PP_PTS = [[330, 300], [388, 304], [430, 338], [446, 362], [430, 386], [385, 445], [345, 505], [310, 556], [300, 612], [284, 634], [268, 584], [262, 480], [268, 410], [286, 360], [306, 330]] as const;
const LP_PTS = [[606, 330], [640, 322], [670, 344], [690, 380], [696, 410], [676, 422], [646, 402], [616, 372]] as const;
const PRZEDS_D = `M${pts(PP_PTS)}ZM${pts(LP_PTS)}Z`;
/** Komory: od bruzdy przedsionkowo-komorowej (prawej) pod pniem płucnym do koniuszka. */
const KOM_PTS = [[486, 336], [530, 350], [575, 352], [606, 372], [640, 395], [672, 418], [702, 442], [735, 500], [752, 580], [757, 650], [752, 720], [740, 780], [722, 826], [705, 848], [650, 822], [560, 792], [470, 752], [400, 712], [350, 664], [316, 622], [302, 604], [310, 556], [345, 505], [385, 445], [430, 386], [446, 362]] as const;
const KOM_D = `M${pts(KOM_PTS)}Z`;
/** Bruzda międzykomorowa przednia (przegroda w tym rzucie): granica komory prawej i lewej. */
const LAD: ReadonlyArray<[number, number]> = [[640, 395], [632, 430], [625, 480], [620, 530], [618, 600], [625, 650], [640, 700], [660, 760], [680, 810], [705, 850]];
const KP_CLIP = `M0 0L640 0L${pts(LAD)}L705 1000L0 1000Z`;
const KL_CLIP = `M640 0L1000 0L1000 1000L705 1000L${pts([...LAD].reverse())}Z`;
const ladX = (y: number): number => {
  for (let i = 1; i < LAD.length; i++) {
    const [x0, y0] = LAD[i - 1]!, [x1, y1] = LAD[i]!;
    if (y <= y1) return x0 + (x1 - x0) * clamp((y - y0) / (y1 - y0), 0, 1);
  }
  return 705;
};

const SA_P: [number, number] = [335, 318];
const AV_P: [number, number] = [450, 372];
/** Drogi przewodzenia w kierunku impulsu (piksele rastra). */
const DROGI = {
  doAV: 'M335 318C360 352 410 372 450 372',
  doLP: 'M335 318C420 296 540 300 640 360',
  his: 'M450 372C500 386 552 400 600 420',
  odnP: 'M600 420C596 480 590 560 592 640C570 672 520 682 460 664',
  odnL: 'M600 420C632 460 655 520 668 590C678 650 686 700 692 760',
  purP: ['M460 664C420 640 380 600 352 560', 'M460 664C520 712 600 760 655 796', 'M592 640C602 700 626 752 662 800'],
  purL: ['M692 760C698 790 700 815 700 836', 'M692 760C720 700 740 620 742 540', 'M668 590C690 560 712 520 722 478'],
} as const;
const DROGI_SCI: Record<Sciezka, readonly string[]> = {
  doAV: [DROGI.doAV], doLP: [DROGI.doLP], his: [DROGI.his], odnP: [DROGI.odnP], odnL: [DROGI.odnL], purP: DROGI.purP, purL: DROGI.purL,
};
const SZER: Record<Sciezka, number> = { doAV: 5, doLP: 5, his: 10, odnP: 8, odnL: 8, purP: 4.5, purL: 4.5 };
/** Skąd fala rozlewa się po mięśniu: węzeł zatokowy, łącze, końce dróg Purkinjego, przegroda (objazd), ośrodek komorowy. */
const ZRODLA: Record<Zrodlo, [number, number]> = {
  sa: SA_P, av: AV_P,
  przegrodaL: [632, 470], koniuszekL: [700, 832], scianaL: [740, 560],
  koniuszekP: [655, 796], scianaP: [460, 664],
  przegrodaDoP: [612, 560], przegrodaDoL: [628, 560],
  ognisko: [400, 640], ogniskoDoL: [630, 650],
};
const STREFA_PTS: Record<Strefa, ReadonlyArray<readonly [number, number]>> = {
  przedsionki: [...PP_PTS, ...LP_PTS],
  kp: [...KOM_PTS.filter(([x, y]) => x <= ladX(y) + 2), ...LAD],
  kl: [...KOM_PTS.filter(([x, y]) => x >= ladX(y) - 2), ...LAD],
};
/** Objazd przez przegrodę: strzałka z komory pobudzonej do spóźnionej. */
const OBJAZD = { lewa: { d: 'M560 610Q620 572 690 612', end: [690, 612] }, prawa: { d: 'M690 610Q630 572 560 612', end: [560, 612] } } as const;
/** Szerokość napisu (Inter, ~0,53 em). */
const textW = (t: string): number => t.length * FS * 0.53;

/* ─────────── teksty (z wykładu S1_00) ─────────── */

const FAZA_TXT: Record<Faza, string> = {
  P: 'załamek P', odcinekPQ: 'odcinek PQ', QRS: 'zespół QRS', ST: 'odcinek ST', T: 'załamek T',
  spoczynek: 'linia izoelektryczna', przerwa: 'przerwa',
};
const CZOLO_TXT: Record<Czolo, string> = {
  spoczynek: 'brak', przedsionki: 'przedsionki', brama: 'czeka u odźwiernego w bramie AV', his: 'pęczek Hisa',
  odnogi: 'odnogi, czyli autostrady', purkinje: 'sieć Purkinjego', komory: 'mięsień komór',
  objazd: 'objazd przez mięsień komór', lacze: 'łącze, tu rodzi się impuls', ognisko: 'ośrodek w komorach',
};
const STR: Record<Str, { nazwa: string; seg: Seg[]; txt: string }> = {
  sa: { nazwa: 'Węzeł zatokowy', seg: ['P'], txt: 'Fala rodzi się w węźle zatokowym, ale sam węzeł jest niewidoczny na EKG. O jego pracy wnioskujesz po prawidłowo ukształtowanych załamkach P.' },
  przedsionki: { nazwa: 'Przedsionki', seg: ['P'], txt: 'Fala rozchodzi się po przedsionkach: to załamek P. Repolaryzacja przedsionków chowa się w obrębie zespołu QRS.' },
  av: { nazwa: 'Węzeł AV, brama', seg: ['PQ'], txt: 'Impuls przystaje w węźle AV, a ten przystanek mieści się w odstępie PQ. Sam węzeł jest zbyt mały, by dać własny wychył.' },
  his: { nazwa: 'Pęczek Hisa', seg: ['PQ'], txt: 'Pęczek Hisa przebija włóknistą barierę. Jego pobudzenia nie widać na standardowym zapisie. Odstęp PQ obejmuje także tę część drogi.' },
  odnogi: { nazwa: 'Prawa i lewa odnoga', seg: ['PQ', 'QRS'], txt: 'Dwie autostrady prowadzą sygnał do obu komór. Przejazd autostradą mieści się jeszcze w PQ; o drożności odnóg mówi szerokość QRS. Zespół QRS „pyta” o komory i układ Hisa-Purkinjego. Wąski QRS to dowód, że impuls zszedł prawidłową, szybką drogą.' },
  purkinje: { nazwa: 'Sieć Purkinjego', seg: ['QRS'], txt: 'Włókna Purkinjego wnikają w mięsień komór od strony wsierdzia. Błyskawiczną, zsynchronizowaną depolaryzację komór rejestrujemy jako wąski zespół QRS.' },
  komory: { nazwa: 'Komory', seg: ['QRS', 'ST', 'T'], txt: 'Pobudzenie komór to zespół QRS. W odcinku ST duża część mięśnia komór jest już pobudzona, a załamek T to główna widoczna część ich repolaryzacji.' },
};
const SEG_TXT: Record<Seg, { str: Str[]; txt: string }> = {
  P: { str: ['sa', 'przedsionki'], txt: 'Załamek P „pyta” o przedsionki i węzeł zatokowy.' },
  PQ: { str: ['przedsionki', 'av', 'his', 'odnogi'], txt: 'Odstęp PQ „pyta” o drogę od przedsionków przez węzeł AV do komór. Węzła AV ani pęczka Hisa nie widać. W czasie płaskiego odcinka PQ impuls właśnie przechodzi przez bramę.' },
  QRS: { str: ['odnogi', 'purkinje', 'komory'], txt: 'Zespół QRS „pyta” o komory i układ Hisa-Purkinjego.' },
  ST: { str: ['komory'], txt: 'W odcinku ST duża część mięśnia komór jest już pobudzona, więc prawidłowy ST leży blisko linii izoelektrycznej.' },
  T: { str: ['komory'], txt: 'Załamek T to główna widoczna część repolaryzacji komór.' },
};

/** Tematy trybu „Ucz się” (ćwiczenie to osobny tryb „Sprawdź się”). */
const TEMATY: ReadonlyArray<{ v: Tryb; label: string }> = [
  { v: 'mapa', label: 'Mapa zapisu' }, { v: 'brama', label: 'Brama AV' }, { v: 'autostrady', label: 'Autostrady' },
  { v: 'hierarchia', label: 'Hierarchia' }, { v: 'automatyzm', label: 'Automatyzm' },
];

/** Kursor w odcinku PQ, gdy impuls czeka u odźwiernego (przed wyjściem z bramy w at − HV). */
const BRAMA_DT = HV + 0.007;
const sek = (v: number, d = 2) => `${fmtNum(v, d)} s`;
/** Odmiana liczebnika: 1 kratka, 2-4 (bez 12-14) kratki, reszta kratek; także 22, 23, 24 itd. */
const odmiana = (n: number, [jeden, kilka, wiele]: readonly [string, string, string]): string => {
  const d = Math.abs(n) % 10, s100 = Math.abs(n) % 100;
  return n === 1 ? jeden : d >= 2 && d <= 4 && (s100 < 12 || s100 > 14) ? kilka : wiele;
};
const krat = (n: number) => `<b>${fmtNum(n)}</b> ${odmiana(n, ['mała kratka', 'małe kratki', 'małych kratek'])}`;

let styled = false;
function localStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.setAttribute('data-hw-droga', '');
  st.textContent = `
.hw-di-grid{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@container hw (min-width:760px){.hw-di-grid{grid-template-columns:minmax(345px,.95fr) minmax(0,1.15fr);align-items:start}}
.hw-di-col{display:grid;gap:12px;min-width:0}
.hw-di-svg{display:block;width:100%;height:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.hw-di-svg text{font-family:var(--hw-f-t)}
.hw-di-hit{cursor:pointer;outline:none}
.hw-di-strip canvas{touch-action:pan-y;cursor:ew-resize}
.hw .hw-di-root .hw-chip--sm{min-height:44px}
.hw .hw-di-root input[type=range]{height:44px}
.hw-di-modes{display:grid;gap:10px}
.hw-di-now{display:flex;flex-wrap:wrap;gap:4px 16px;font:12px/1.5 var(--hw-f-m);color:var(--hw-txt3)}
.hw-di-now b{color:var(--hw-txt);font-weight:500}
.hw-di-small{font:12px/1.5 var(--hw-f-m);color:var(--hw-txt3)}
.hw-di-cover{position:absolute;left:0;right:0;bottom:10px;text-align:center;font:12px/1.4 var(--hw-f-m);color:var(--hw-txt2)}
.hw-di-tr{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
`;
  document.head.appendChild(st);
}

export function mountDrogaImpulsu(host: HTMLElement, opts: WstawkaOpts): () => void {
  const { body, live } = shell(host, {
    label: 'Wstawka · droga impulsu',
    title: 'Przesuń kursor i śledź impuls na sercu i w zapisie',
    intro: 'Schemat i odprowadzenie II mają wspólny zegar: fala na sercu biegnie w tym samym tempie, w którym rysuje się zapis. Przeciągnij kursor po zapisie albo odtwórz go w zwolnionym tempie.',
  });
  localStyle();
  body.classList.add('hw-di-root');
  const uid = Math.random().toString(36).slice(2, 8);
  const cleanups: Array<() => void> = [];
  const rm = reducedMotion();

  /* ─────────── stan ─────────── */
  let refreshPanel = () => {};
  const start: Widok = opts.tryb === 'cwiczenie' ? 'cwiczenie' : (TEMATY.find((c) => c.v === opts.tryb)?.v ?? 'mapa');
  let widok: Widok = start;
  let temat: Tryb = start === 'cwiczenie' ? 'mapa' : start; // ostatni temat „Ucz się”, do powrotu ze „Sprawdź się”
  let pq: number = W.pqMapa;
  let blok: Blok = 'brak';
  let hier: Hier = 'gra';
  let cykl = 1;
  let sel: { k: 'str'; id: Str } | { k: 'seg'; id: Seg } | null = null;
  let scen: Scen = scenZatokowy();
  let pl: Plan[] = plany(scen);
  let sig = sygnal(scen);
  let zap: number[] = zaplonySA(scen);
  let tCur = 1.2 + W.qrsWaski / 2; // kanoniczny: środek QRS drugiego pobudzenia
  let playing = !rm;
  let speed = 0.25;
  let ukryj = false; // ćwiczenie: schemat zakryty do sprawdzenia
  let exRound: ExRound | null = null;

  /* ─────────── pasek trybów: „Ucz się” z tematami, „Sprawdź się” ─────────── */
  const trybChips = chips([{ v: 'ucz', label: TRYB_UCZ }, { v: 'sprawdz', label: TRYB_SPRAWDZ }] as const, start === 'cwiczenie' ? 'sprawdz' : 'ucz',
    (v) => setWidok(v === 'sprawdz' ? 'cwiczenie' : temat), { label: 'Tryb wstawki' });
  const tematChips = chips(TEMATY, temat, (v) => setWidok(v), { label: 'Temat', small: true });
  tematChips.el.hidden = start === 'cwiczenie';
  body.append(h('div', { class: 'hw-di-modes' }, trybChips.el, tematChips.el));

  /* ─────────── schemat: raster serca + nakładka (prześwietlenie układu przewodzącego) ─────────── */
  const rs = svgNaRastrze('sercePrzod', { label: 'Serce od przodu z układem bodźcoprzewodzącym', crop: KADR });
  const svg = rs.svg;
  setA(svg, { class: 'hw-di-svg', role: 'group', 'aria-label': 'Serce od przodu z układem bodźcoprzewodzącym; prawa strona pacjenta jest po lewej' });
  const defs = s('defs', {});
  svg.insertBefore(defs, svg.firstChild);
  const ov = rs.nakladka;
  const clip = (id: string, d: string) => { const c = s('clipPath', { id: `${id}-${uid}` }, defs); s('path', { d }, c); return `url(#${id}-${uid})`; };
  const cPrz = clip('prz', PRZEDS_D), cKom = clip('kom', KOM_D), cKp = clip('kp', KP_CLIP), cKl = clip('kl', KL_CLIP);
  const zasiegC = new Map<string, number>();
  const zasieg = (z: Zrodlo, st: Strefa): number => {
    const k = `${z}:${st}`;
    let r = zasiegC.get(k);
    if (r === undefined) { const [x, y] = ZRODLA[z]; r = Math.max(...STREFA_PTS[st].map(([a, b]) => Math.hypot(a - x, b - y))) + 10; zasiegC.set(k, r); }
    return r;
  };

  // fala: półprzezroczyste obszary przedsionków i komór, rosnące od źródeł
  const waveG = s('g', {}, ov);
  const zoneLayer = (cp: string, inner?: string) => {
    const outer = s('g', { 'clip-path': cp }, waveG);
    const g = inner ? s('g', { 'clip-path': inner }, outer) : outer;
    return { fill: s('g', { opacity: 0 }, g), front: s('g', {}, g) };
  };
  const layers: Record<Strefa, { fill: SVGGElement; front: SVGGElement }> = {
    przedsionki: zoneLayer(cPrz), kp: zoneLayer(cKom, cKp), kl: zoneLayer(cKom, cKl),
  };
  const outPrz = s('path', { d: PRZEDS_D, fill: 'none', stroke: C.puls, 'stroke-width': 3, 'stroke-linejoin': 'round', opacity: 0 }, waveG);
  const outKom = s('path', { d: KOM_D, fill: 'none', stroke: C.puls, 'stroke-width': 3, 'stroke-linejoin': 'round', opacity: 0 }, waveG);
  /** Koła fali (wypełnienie + czoło) dla par strefa:źródło; `klatka` mówi, w której klatce były ostatnio użyte. */
  interface Kolo { f: SVGCircleElement; c: SVGCircleElement; klatka: number }
  const circ = new Map<string, Kolo>();
  const kola: Kolo[] = [];
  let klatka = 0;
  const circle = (st: Strefa, z: Zrodlo) => {
    const k = `${st}:${z}`;
    let e = circ.get(k);
    if (!e) {
      const [x, y] = ZRODLA[z];
      e = { f: s('circle', { cx: x, cy: y, r: 0, fill: C.puls }, layers[st].fill), c: s('circle', { cx: x, cy: y, r: 0, fill: 'none', stroke: C.puls, 'stroke-width': 4 }, layers[st].front), klatka: -1 };
      circ.set(k, e); kola.push(e);
    }
    return e;
  };

  // autostrady: odnogi jako jezdnia z dwiema krawędziami (w trybie Autostrady i przy zaznaczeniu)
  const drog = s('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ov);
  const road = s('g', { visibility: 'hidden' }, drog);
  const roadEdges = [DROGI.odnP, DROGI.odnL].map((d) => s('path', { d, stroke: C.txt, 'stroke-width': 30, opacity: 0.85 }, road));
  for (const d of [DROGI.odnP, DROGI.odnL]) s('path', { d, stroke: C.ink, 'stroke-width': 22 }, road);
  const detour = s('path', { d: '', stroke: C.txt, 'stroke-width': 4.5, 'stroke-dasharray': '14 10', visibility: 'hidden' }, drog);
  const detourHead = s('path', { d: '', fill: C.txt, stroke: 'none', visibility: 'hidden' }, drog);

  // drogi: ciemna obwódka + jasna linia (czytelne na szarym rastrze), na wierzchu przejechany odcinek
  for (const k of SCIEZKI) for (const d of DROGI_SCI[k]) {
    const dash = k === 'doAV' || k === 'doLP' ? '3 12' : undefined;
    s('path', { d, stroke: C.ink, 'stroke-width': SZER[k] + 6, opacity: 0.55, 'stroke-dasharray': dash }, drog);
    s('path', { d, stroke: C.txt, 'stroke-width': SZER[k], opacity: 0.7, 'stroke-dasharray': dash }, drog);
  }
  const SCI = Object.fromEntries(SCIEZKI.map((k) => [k, DROGI_SCI[k].map((d) => s('path', { d, stroke: C.puls, 'stroke-width': SZER[k] + 2, pathLength: 1, 'stroke-dasharray': '0 1', opacity: 0 }, drog))])) as Record<Sciezka, SVGPathElement[]>;
  const top = s('g', {}, ov);
  const heads = Object.fromEntries(SCIEZKI.map((k) => [k, s('circle', { r: SZER[k] + 5, fill: C.puls, stroke: C.ink, 'stroke-width': 3, visibility: 'hidden' }, top)])) as Record<Sciezka, SVGCircleElement>;

  // węzły
  const saRing = s('circle', { cx: SA_P[0], cy: SA_P[1], r: 16, fill: 'none', stroke: C.puls, 'stroke-width': 4, opacity: 0 }, top);
  s('ellipse', { cx: SA_P[0], cy: SA_P[1], rx: 15, ry: 11, fill: C.ink, stroke: C.txt, 'stroke-width': 3.5 }, top);
  const saDot = s('ellipse', { cx: SA_P[0], cy: SA_P[1], rx: 10, ry: 7, fill: C.puls, opacity: 0 }, top);
  s('ellipse', { cx: AV_P[0], cy: AV_P[1], rx: 14, ry: 10, fill: C.ink, stroke: C.txt, 'stroke-width': 3.5 }, top);
  const avNode = s('ellipse', { cx: AV_P[0], cy: AV_P[1], rx: 9, ry: 6.5, fill: C.puls, opacity: 0 }, top);
  const avDot = s('circle', { cx: AV_P[0], cy: AV_P[1], r: 9, fill: C.puls, visibility: 'hidden' }, top);
  const avBurst = s('circle', { cx: AV_P[0], cy: AV_P[1], r: 14, fill: 'none', stroke: C.puls, 'stroke-width': 4, opacity: 0 }, top);
  const vBurst = s('circle', { cx: ZRODLA.ognisko[0], cy: ZRODLA.ognisko[1], r: 14, fill: 'none', stroke: C.puls, 'stroke-width': 4, opacity: 0 }, top);
  const vFocus = s('circle', { cx: ZRODLA.ognisko[0], cy: ZRODLA.ognisko[1], r: 10, fill: C.ink, stroke: C.txt, 'stroke-width': 3.5, visibility: 'hidden' }, top);

  // zamknięta autostrada: znak ✕
  const closed = s('g', { visibility: 'hidden' }, top);
  const closedC = s('circle', { r: 19, fill: C.ink, stroke: C.alarm, 'stroke-width': 4.5 }, closed);
  const closedX = s('path', { d: '', stroke: C.alarm, 'stroke-width': 5, 'stroke-linecap': 'round' }, closed);

  // podpisy z liniami odniesienia, poza konturem serca
  type LabId = 'sa' | 'przedsionki' | 'brama' | 'his' | 'odnP' | 'odnL' | 'purk' | 'komory' | 'zamkP' | 'zamkL' | 'objazdP' | 'objazdL' | 'komorowy';
  interface Lab { g: SVGGElement; t: SVGTextElement; l: SVGPathElement; x: number; y: number; anchor: 'start' | 'end'; ax: number; ay: number }
  const labels = {} as Record<LabId, Lab>;
  const LX = KADR.x + 12, RX = KADR.x + KADR.w - 12;
  const lab = (id: LabId, side: 'L' | 'R', y: number, ax: number, ay: number) => {
    const g = s('g', { visibility: 'hidden' }, top);
    const l = s('path', { d: '', stroke: C.txt2, 'stroke-width': 2, fill: 'none' }, g);
    s('circle', { cx: ax, cy: ay, r: 4, fill: C.txt2 }, g);
    const anchor = side === 'L' ? 'start' : 'end';
    const t = s('text', { x: side === 'L' ? LX : RX, y, 'text-anchor': anchor, fill: C.txt2, 'font-size': FS }, g);
    labels[id] = { g, t, l, x: side === 'L' ? LX : RX, y, anchor, ax, ay };
  };
  lab('sa', 'L', 214, SA_P[0] - 12, SA_P[1] - 8);
  lab('brama', 'L', 400, AV_P[0] - 14, AV_P[1] + 4);
  lab('przedsionki', 'L', 506, 284, 530);
  lab('zamkP', 'L', 540, 0, 0);
  lab('odnP', 'L', 640, 508, 678);
  lab('komorowy', 'L', 716, ZRODLA.ognisko[0] - 10, ZRODLA.ognisko[1] + 6);
  lab('objazdP', 'L', 790, 600, 590);
  lab('his', 'R', 300, 540, 402);
  lab('zamkL', 'R', 478, 0, 0);
  lab('odnL', 'R', 566, 668, 594);
  lab('komory', 'R', 676, 748, 662);
  lab('objazdL', 'R', 772, 650, 590);
  lab('purk', 'R', 912, 700, 834);
  const setLab = (id: LabId, text: string, on: boolean, color: string = C.txt2, anchorPt?: readonly [number, number]) => {
    const L = labels[id];
    if (anchorPt) { L.ax = anchorPt[0]; L.ay = anchorPt[1]; setA(L.g.querySelector('circle')!, { cx: L.ax, cy: L.ay }); }
    L.t.textContent = text;
    L.t.setAttribute('fill', color);
    const tx = L.anchor === 'start' ? L.x + textW(text) + 10 : L.x - textW(text) - 10;
    setA(L.l, { d: `M${tx} ${L.y - FS * 0.33}L${L.ax} ${L.ay}`, stroke: color === C.txt2 ? C.txt3 : color });
    L.g.setAttribute('visibility', on ? 'visible' : 'hidden');
  };

  // podświetlenia i pola kliknięć (tryb „Mapa zapisu”)
  const hlG = s('g', { fill: 'none', stroke: C.puls, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'none' }, ov);
  const hl = {} as Record<Str, SVGGElement>;
  const mkHl = (id: Str, f: (g: SVGGElement) => void) => { const g = s('g', { visibility: 'hidden' }, hlG); f(g); hl[id] = g; };
  mkHl('sa', (g) => s('circle', { cx: SA_P[0], cy: SA_P[1], r: 30 }, g));
  mkHl('przedsionki', (g) => s('path', { d: PRZEDS_D }, g));
  mkHl('av', (g) => s('circle', { cx: AV_P[0], cy: AV_P[1], r: 30 }, g));
  mkHl('his', (g) => s('path', { d: DROGI.his, 'stroke-width': 26, opacity: 0.45 }, g));
  mkHl('odnogi', () => {});
  mkHl('purkinje', (g) => { for (const d of [...DROGI.purP, ...DROGI.purL]) s('path', { d, 'stroke-width': 18, opacity: 0.4 }, g); });
  mkHl('komory', (g) => s('path', { d: KOM_D }, g));

  const hitG = s('g', {}, ov);
  const hits: Array<{ id: Str; g: SVGGElement }> = [];
  const mkHit = (id: Str, f: (g: SVGGElement) => void) => {
    const g = s('g', { class: 'hw-di-hit', role: 'button', tabindex: 0, 'aria-label': `${STR[id].nazwa}: pokaż na zapisie` }, hitG);
    f(g);
    g.addEventListener('click', () => pick({ k: 'str', id }));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick({ k: 'str', id }); } });
    // reakcja na naciśnięcie: podświetlenie od razu na dotyku, nie dopiero po kliknięciu
    const wcisnij = () => { hl[id].setAttribute('visibility', 'visible'); if (id === 'odnogi') paintRoad(true); };
    g.addEventListener('focus', wcisnij);
    g.addEventListener('blur', () => paintHl());
    g.addEventListener('pointerdown', wcisnij);
    g.addEventListener('pointerup', () => { if (document.activeElement !== g) paintHl(); });
    g.addEventListener('pointercancel', () => { if (document.activeElement !== g) paintHl(); });
    g.addEventListener('pointerleave', () => { if (document.activeElement !== g) paintHl(); });
    hits.push({ id, g });
  };
  const tr = { fill: 'transparent', stroke: 'transparent' };
  mkHit('komory', (g) => s('path', { d: KOM_D, ...tr }, g));
  mkHit('przedsionki', (g) => s('path', { d: PRZEDS_D, ...tr }, g));
  mkHit('purkinje', (g) => { for (const d of [...DROGI.purP, ...DROGI.purL]) s('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 48 }, g); });
  mkHit('odnogi', (g) => { for (const d of [DROGI.odnP, DROGI.odnL]) s('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 56 }, g); });
  mkHit('his', (g) => s('path', { d: DROGI.his, fill: 'none', stroke: 'transparent', 'stroke-width': 60 }, g));
  mkHit('av', (g) => s('circle', { cx: AV_P[0], cy: AV_P[1], r: 52, ...tr }, g));
  mkHit('sa', (g) => s('circle', { cx: SA_P[0], cy: SA_P[1], r: 66, ...tr }, g));

  // scena metafory (raster marki) nad schematem, z podpisem z wykładu
  let scene: ReturnType<typeof scenaPrzenikana> | null = null; // tworzona przy pierwszej scenie, od razu z właściwym rastrem
  const sceneCap = h('figcaption', { class: 'hw-di-small', style: 'text-align:center;margin-top:4px' });
  const sceneBox = h('figure', { class: 'hw-di-scene', style: 'margin:0', hidden: true }, sceneCap);

  const cover = h('p', { class: 'hw-di-cover', hidden: true, text: 'Schemat zobaczysz po sprawdzeniu.' });
  const svgWrap = h('div', { style: 'position:relative' }, svg, cover);
  const fadeBox = h('div', {}, svgWrap);
  const left = h('div', { class: 'hw-di-col' }, sceneBox, fadeBox,
    h('p', { class: 'hw-di-small', style: 'text-align:center', text: 'Widok od przodu: prawa strona pacjenta jest po lewej. Zielony obszar to mięsień pobudzony w tej chwili.' }));

  // długości ścieżek (do kropki na czole fali)
  const lens = new Map<SVGPathElement, number>();
  const ptAt = (p: SVGPathElement, f: number): [number, number] | null => {
    try {
      let L = lens.get(p);
      if (L === undefined) { L = p.getTotalLength(); lens.set(p, L); }
      const q = p.getPointAtLength(clamp(f, 0, 1) * L);
      return [q.x, q.y];
    } catch { return null; }
  };

  /* ─────────── pasek EKG ─────────── */
  const warstwy: { jasna: HTMLCanvasElement | null; ciemna: HTMLCanvasElement | null; klucz: string } = { jasna: null, ciemna: null, klucz: '' };
  let stripDirty = true;
  const geom = (sf: Surface) => {
    const sc = curScen();
    const ok = sc.okno, pps = sf.w / ok, mm = pps / 25;
    const topH = widok === 'automatyzm' ? 80 : 0;
    const eT = topH, eH = sf.h - topH;
    return { sc, ok, pps, mm, topH, eT, eH, y0: eT + eH * 0.66, ppm: Math.min(10 * mm, (eH * 0.58) / 1.2), X: (t: number) => t * pps };
  };
  /** Pasma: wybrany element zapisu albo mierzony odstęp. */
  const pasma = (): Array<{ seg: Seg; label: string }> => {
    const bands: Array<{ seg: Seg; label: string }> = [];
    if (widok === 'mapa' && sel) {
      const segs = sel.k === 'seg' ? [sel.id] : STR[sel.id].seg;
      for (const sg of segs) bands.push({ seg: sg, label: sg === 'PQ' ? `PQ ${sek(W.pqMapa)}` : sg === 'QRS' ? `QRS ${sek(W.qrsWaski)}` : sg });
    }
    if (widok === 'brama') bands.push({ seg: 'PQ', label: `PQ ${sek(pq)}` });
    if (widok === 'autostrady') bands.push({ seg: 'QRS', label: `QRS ${sek(blok === 'brak' ? W.qrsWaski : W.qrsSzeroki)}` });
    return bands;
  };

  const stripMbar = h('div', { class: 'hw-mbar' }, h('span', {}, h('i', { class: 'hw-dot' }), 'Odprowadzenie II · 25 mm/s'), h('span', {}));
  const stripBox = h('div', { class: 'hw-di-strip' });
  const screen = h('div', { class: 'hw-screen' }, stripMbar, stripBox);
  let sfc = surface(stripBox, { height: 170, label: 'Zapis EKG z odprowadzenia II z kursorem czasu' }, (sf) => drawStrip(sf));
  const remakeSurface = (hh: number) => {
    ugiecieSp?.stop(); ugiecieSp = null; ugiecie = 0;
    sfc.destroy(); stripBox.replaceChildren();
    sfc = surface(stripBox, { height: hh, label: 'Zapis EKG z odprowadzenia II z kursorem czasu' }, (sf) => drawStrip(sf));
    bindStripDrag();
  };
  /*
   * Kursor czasu na zapisie. Gest rusza dopiero po 10 px (pionowy ruch zostaje przewijaniem strony, `pan-y`),
   * chwyt przy kursorze trzyma odległość od niego, stuknięcie ustawia kursor. Po puszczeniu kursor ma wybieg
   * (sprężyna do punktu rzutu), a za krańcem okna zapis ugina się jak guma i wraca sprężyną.
   */
  let stripDragOff = () => {};
  let chwyt = 0, ruszyl = false, ruchT = 0;
  let ugiecie = 0;
  let ugiecieSp: Spring | null = null;
  const ugnij = (px: number) => { ugiecie = px; sfc.s.canvas.style.transform = px ? `translateX(${px.toFixed(1)}px)` : ''; };
  const pusc = () => { ugiecieSp?.stop(); ugiecieSp = null; if (ugiecie) ugiecieSp = spring(ugiecie, 0, ugnij, { response: 0.35, damping: 1 }); };
  function bindStripDrag() {
    stripDragOff();
    const cv = sfc.s.canvas;
    const okno = () => curScen().okno;
    const pps = () => Math.max(1, sfc.s.w) / okno();
    /** Pozycja palca → czas; poza zapisem kursor stoi na krańcu, a zapis ugina się z oporem. */
    const doT = (x: number) => {
      const w = Math.max(1, sfc.s.w);
      const g = guma(x, 0, w, w * 0.5);
      ugnij(g - clamp(g, 0, w));
      return clamp(x, 0, w) / pps();
    };
    stripDragOff = drag(cv, {
      prog: 10,
      start: (p) => {
        stopKursor(); ugiecieSp?.stop(); ugiecieSp = null;
        const xc = tCur * pps();
        chwyt = Math.abs(p.x - xc) <= 24 ? xc - p.x : 0; // chwyt przy kursorze: bez przeskoku środkiem pod palec
        ruszyl = false;
      },
      move: (p, e) => {
        if (!ruszyl) { ruszyl = true; setPlaying(false); }
        ruchT = e.timeStamp;
        setT(doT(p.x + chwyt));
      },
      end: (p, e, v) => {
        if (e.type === 'pointercancel') { pusc(); if (ruszyl) announcePhase(); return; } // strona przewinęła się zamiast gestu
        if (!ruszyl) {
          // stuknięcie: kursor w to miejsce, w „Mapie zapisu” także wybór elementu zapisu
          setPlaying(false);
          const t = doT(p.x);
          ugnij(0);
          setT(t);
          if (widok === 'mapa') {
            const f = faza(scen, t).faza;
            const seg: Seg | null = f === 'odcinekPQ' ? 'PQ' : f === 'P' || f === 'QRS' || f === 'ST' || f === 'T' ? f : null;
            if (seg) pick({ k: 'seg', id: seg }, false);
          }
          announcePhase();
          return;
        }
        pusc();
        const vt = v.x / pps(); // s zapisu na sekundę
        // wybieg tylko po rzucie; palec, który stanął przed puszczeniem (> 60 ms bez ruchu), zostawia kursor w miejscu
        if (Math.abs(v.x) > 120 && e.timeStamp - ruchT <= 60) {
          const cel = clamp(tCur + projekcja(v.x) / pps(), 0, okno() - 0.001);
          goT(cel, vt, announcePhase);
        } else announcePhase();
      },
    });
  }
  bindStripDrag();
  cleanups.push(() => { stripDragOff(); sfc.destroy(); });

  const cursor = slider({
    label: 'Kursor czasu', min: 0, max: scen.okno, step: 0.01, value: tCur,
    fmt: () => FAZA_TXT[faza(curScen(), tCur).faza],
    onInput: (v) => { setPlaying(false); setT(v); announcePhase(); },
  });
  const playBtn = h('button', { class: 'hw-chip hw-chip--sm', type: 'button' });
  playBtn.addEventListener('click', () => setPlaying(!playing));
  const speedChips = chips([{ v: '0.1', label: '1/10' }, { v: '0.25', label: '1/4' }, { v: '1', label: '1×' }] as const, '0.25', (v) => { speed = Number(v); paintMbar(); live(`Tempo ${v === '1' ? 'rzeczywiste' : v === '0.25' ? 'jedna czwarta' : 'jedna dziesiąta'}.`); }, { label: 'Tempo odtwarzania', small: true });
  const stepBtn = (dir: -1 | 1) => {
    const b = h('button', { class: 'hw-chip hw-chip--sm', type: 'button', text: dir < 0 ? '◀ kratka' : 'kratka ▶', 'aria-label': dir < 0 ? 'Cofnij kursor o jedną małą kratkę, 0,04 s' : 'Przesuń kursor o jedną małą kratkę, 0,04 s' });
    b.addEventListener('click', () => { setPlaying(false); setT(((tCur + dir * W.kratka) % scen.okno + scen.okno) % scen.okno); announcePhase(); });
    return b;
  };
  const transport = h('div', { class: 'hw-di-tr' }, playBtn, speedChips.el, stepBtn(-1), stepBtn(1));
  const nowFaza = h('b'), nowCzolo = h('b');
  const now = h('p', { class: 'hw-di-now', 'aria-hidden': 'true' }, h('span', {}, 'Kursor: ', nowFaza), h('span', {}, 'Czoło fali: ', nowCzolo));

  const panel = h('div', { class: 'hw-grid', style: 'gap:12px' });
  const right = h('div', { class: 'hw-di-col' }, screen, cursor.el, transport, now, panel);
  body.append(h('div', { class: 'hw-di-grid' }, left, right));

  /* ─────────── rysowanie schematu ─────────── */
  function drawSchematic(st: Stan) {
    klatka++;
    for (const f of st.fale) {
      const e = circle(f.strefa, f.zrodlo);
      const r = f.r * zasieg(f.zrodlo, f.strefa);
      setA(e.f, { r });
      setA(e.c, { r, opacity: f.czolo, 'stroke-dasharray': f.wolna ? '16 12' : undefined });
      e.klatka = klatka;
    }
    for (const e of kola) if (e.klatka !== klatka && e.klatka !== -2) { setA(e.f, { r: 0 }); setA(e.c, { r: 0, opacity: 0 }); e.klatka = -2; }
    for (const z of STREFY) setA(layers[z].fill, { opacity: 0.26 * st.strefy[z] });
    setA(outPrz, { opacity: 0.6 * st.strefy.przedsionki });
    setA(outKom, { opacity: 0.6 * Math.max(st.strefy.kp, st.strefy.kl) });
    for (const k of SCIEZKI) {
      const v = st.sciezki[k];
      for (const p of SCI[k]) setA(p, { 'stroke-dasharray': `${v.p} 1`, opacity: v.p > 0 ? v.a : 0 });
      const first = SCI[k][0];
      const pt = v.glowa && first ? ptAt(first, v.p) : null;
      setA(heads[k], pt ? { cx: pt[0], cy: pt[1], visibility: 'visible' } : { visibility: 'hidden' });
    }
    setA(saDot, { opacity: st.sa });
    setA(saRing, { r: 16 + 34 * (1 - st.sa), opacity: st.sa > 0 && st.sa < 1 ? st.sa * 0.7 : 0 });
    const puls = Math.sin(tCur * 60) ** 2;
    setA(avNode, { opacity: st.av.czeka ? 0.5 + 0.4 * puls : st.av.a * 0.7 });
    if (st.av.czeka) setA(avDot, { r: 8 + 4 * puls, visibility: 'visible' });
    else setA(avDot, { visibility: 'hidden' });
    setA(avBurst, { r: 14 + 40 * (1 - st.av.zaplon), opacity: st.av.zaplon > 0 ? st.av.zaplon * 0.9 : 0 });
    setA(vBurst, { r: 14 + 44 * (1 - st.komoryZaplon), opacity: st.komoryZaplon > 0 ? st.komoryZaplon * 0.9 : 0 });
    paintScene(st);
  }

  /** Scena metafory zależna od trybu i od chwili (brama, autostrady, orkiestra); przenikanie przy zmianie. */
  function paintScene(st: Stan) {
    const sc = curScen();
    let id: ObrazId | null = null, cap = '';
    if (widok === 'brama') {
      // impuls czeka: brama zamknięta, pod koniec postoju uchylona; od wyjścia impulsu do końca T otwarta, odźwierny obok
      const pob = sc.pob.find((p) => tCur >= p.at - HV && tCur < (granice(p).T?.[1] ?? p.at + 0.4));
      // blok I stopnia: odźwierny spokojny, brama otwiera się wolniej (uchylona przez drugą połowę postoju)
      const czek = sc.pob.find((p) => tCur >= p.at - p.pq + DO_AV && tCur < p.at - HV);
      const wolno = !!czek && pqBlokI(pq) && (tCur - (czek.at - czek.pq + DO_AV)) / postojAV(czek.pq) > 0.5;
      id = st.av.czeka ? (st.av.otwarcie > 0 || wolno ? 'bramaUchylona' : 'bramaZamknieta') : pob ? 'odzwiernySpokojny' : 'bramaZamknieta';
      cap = pqBlokI(pq) ? '„odźwierny dłużej przytrzymuje go w bramie”' : '„Tej bramy pilnuje odźwierny”';
    } else if (widok === 'autostrady') {
      id = blok === 'brak' ? 'autostrady' : 'autostradaObjazd';
      cap = blok === 'brak' ? '„sieci szybkich autostrad”' : '„impuls musi jechać objazdem przez mięsień”';
    } else if (widok === 'hierarchia') {
      const gra = sc.dyrygent(tCur);
      id = gra ? 'orkiestraGra' : 'dyrygentMilczy';
      cap = gra ? '„Węzeł zatokowy to dyrygent”' : hier === 'cisza' ? '„ostatnią linią obrony są komory”' : '„muzyk wchodzi, bo dyrygent milczy”';
    }
    sceneBox.hidden = id === null;
    if (id) {
      if (!scene) { scene = scenaPrzenikana(id, { maxH: 150 }); sceneBox.insertBefore(scene.el, sceneCap); } else scene.set(id);
      if (sceneCap.textContent !== cap) sceneCap.textContent = cap;
    }
  }

  /** Odnogi jako jezdnia (dwie krawędzie): w trybie Autostrady, przy zamkniętej odnodze i przy zaznaczeniu odnóg. */
  function paintRoad(zazn: boolean) {
    const t = !ukryj && widok === 'cwiczenie' ? exRound?.kind : null;
    const on = zazn || widok === 'autostrady' || t === 'odnoga';
    setA(road, { visibility: on ? 'visible' : 'hidden' });
    for (const e of roadEdges) e.setAttribute('stroke', zazn ? C.puls : C.txt);
  }

  /** Elementy zależne od trybu: podpisy, zamknięta autostrada, objazd, ośrodek komorowy. */
  function paintStatic() {
    stripDirty = true; // pasma i podpisy zależą od trybu i zaznaczenia
    const sc = curScen();
    const t = ukryj ? null : widok === 'cwiczenie' ? exRound?.kind ?? null : null;
    const bl: Blok = widok === 'autostrady' ? blok : t === 'odnoga' ? exRound?.blok ?? 'brak' : 'brak';
    const odsl = widok === 'cwiczenie' && !ukryj;
    const lacze = (widok === 'hierarchia' && hier !== 'gra') || (odsl && (t === 'lacze' || t === 'komory'));
    const sel1 = (k: Str) => widok === 'mapa' && !!sel && (sel.k === 'str' ? sel.id === k : SEG_TXT[sel.id].str.includes(k));
    const col = (k: Str) => (sel1(k) ? C.puls : C.txt2);
    const mapa = widok === 'mapa';
    setLab('sa', 'węzeł zatokowy', mapa || widok === 'automatyzm' || widok === 'brama' || widok === 'hierarchia' || odsl, col('sa'));
    setLab('przedsionki', 'przedsionki', mapa || widok === 'automatyzm', col('przedsionki'));
    setLab('brama', mapa ? 'węzeł AV' : lacze ? (sc.laczeMilczy ? 'łącze milczy' : 'łącze') : 'brama AV', mapa || widok === 'brama' || widok === 'hierarchia' || odsl, col('av'));
    setLab('his', 'pęczek Hisa', mapa || widok === 'brama' || widok === 'autostrady', col('his'));
    setLab('odnP', 'prawa odnoga', mapa || widok === 'autostrady' || (odsl && t === 'odnoga'), col('odnogi'));
    setLab('odnL', 'lewa odnoga', mapa || widok === 'autostrady' || (odsl && t === 'odnoga'), col('odnogi'));
    setLab('purk', 'sieć Purkinjego', mapa || widok === 'autostrady', col('purkinje'));
    setLab('komory', 'komory', mapa || widok === 'automatyzm', col('komory'));
    const komorowy = sc.pob.some((p) => p.rodzaj === 'komorowy') && !ukryj;
    setLab('komorowy', 'rytm komorowy', komorowy);
    setA(vFocus, { visibility: komorowy ? 'visible' : 'hidden' });
    if (bl !== 'brak') {
      const path = SCI[bl === 'prawa' ? 'odnP' : 'odnL'][0]!;
      const pt = ptAt(path, bl === 'prawa' ? STOP.odnP : STOP.odnL) ?? (bl === 'prawa' ? [594, 522] : [646, 500]);
      setA(closed, { visibility: 'visible' });
      setA(closedC, { cx: pt[0], cy: pt[1] });
      setA(closedX, { d: `M${pt[0] - 9} ${pt[1] - 9}L${pt[0] + 9} ${pt[1] + 9}M${pt[0] + 9} ${pt[1] - 9}L${pt[0] - 9} ${pt[1] + 9}` });
      setLab(bl === 'prawa' ? 'zamkP' : 'zamkL', 'zamknięta', true, C.alarm, [pt[0] + (bl === 'prawa' ? -20 : 20), pt[1]]);
      setLab(bl === 'prawa' ? 'zamkL' : 'zamkP', 'zamknięta', false);
      const o = OBJAZD[bl];
      setA(detour, { d: o.d, visibility: 'visible' });
      const [x2, y2] = o.end, dx = bl === 'lewa' ? 1 : -1;
      setA(detourHead, { d: `M${x2 + 6 * dx} ${y2 + 4}L${x2 - 16 * dx} ${y2 - 16}L${x2 - 18 * dx} ${y2 + 10}Z`, visibility: 'visible' });
      setLab(bl === 'lewa' ? 'objazdL' : 'objazdP', 'objazd', true, C.txt, bl === 'lewa' ? [668, 600] : [582, 600]);
      setLab(bl === 'lewa' ? 'objazdP' : 'objazdL', 'objazd', false);
    } else {
      setA(closed, { visibility: 'hidden' }); setA(detour, { visibility: 'hidden' }); setA(detourHead, { visibility: 'hidden' });
      for (const k of ['zamkP', 'zamkL', 'objazdP', 'objazdL'] as const) setLab(k, '', false);
    }
    setA(hitG, { 'pointer-events': mapa ? undefined : 'none' });
    for (const x of hits) x.g.setAttribute('tabindex', mapa ? '0' : '-1');
    paintHl();
  }

  function paintHl() {
    const on = new Set<Str>();
    if (widok === 'mapa' && sel) { if (sel.k === 'str') on.add(sel.id); else SEG_TXT[sel.id].str.forEach((x) => on.add(x)); }
    for (const [k, g] of Object.entries(hl) as Array<[Str, SVGGElement]>) g.setAttribute('visibility', on.has(k) ? 'visible' : 'hidden');
    paintRoad(on.has('odnogi'));
  }

  /* ─────────── rysowanie paska ─────────── */
  /*
   * Kratka, pasma i oba przebiegi (jasny do kursora, przygaszony za nim) rysują się raz na scenę do dwóch płócien
   * poza ekranem. W klatce zostaje tylko złożenie ich z przycięciem w miejscu kursora, podpis pasma i sam kursor.
   */
  function warstwa(sf: Surface, jasna: boolean): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(sf.w * sf.dpr)); cv.height = Math.max(1, Math.round(sf.h * sf.dpr));
    const ctx = cv.getContext('2d');
    if (!ctx) return cv;
    ctx.setTransform(sf.dpr, 0, 0, sf.dpr, 0, 0);
    const { w, h: hh } = sf;
    const { sc, ok, pps, mm, topH, eT, eH, y0, ppm, X } = geom(sf);
    ctx.fillStyle = C.screen; ctx.fillRect(0, 0, w, hh);
    paper(ctx, 0, eT, w, eH, mm, { y0 });
    ctx.font = `12px ${C.fontMono}`;
    ctx.textBaseline = 'alphabetic';
    for (const b of pasma()) for (const p of sc.pob) {
      const r = granice(p)[b.seg];
      if (!r || r[1] < 0 || r[0] > ok) continue;
      const a = X(Math.max(0, r[0])), z = X(Math.min(ok, r[1]));
      ctx.fillStyle = 'rgba(62,230,168,.11)';
      ctx.fillRect(a, eT, z - a, eH);
    }
    // przerwa przed rytmem zastępczym
    if (sc.przerwa && widok === 'hierarchia') {
      const [a, z] = sc.przerwa.map(X) as [number, number];
      const y = eT + 18;
      ctx.strokeStyle = C.txt2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(z, y); ctx.moveTo(a, y - 4); ctx.lineTo(a, y + 4); ctx.moveTo(z, y - 4); ctx.lineTo(z, y + 4); ctx.stroke();
      ctx.fillStyle = C.txt2; ctx.textAlign = 'center'; ctx.fillText('przerwa', (a + z) / 2, y - 6);
    }
    // zapis: w warstwie jasnej zielony, w przygaszonej szary
    trace(ctx, sig, { x: 0, w, t0: 0, t1: ok, y0, pxPerMv: ppm, color: jasna ? C.puls : C.txt3, width: jasna ? 1.8 : 1.3 });
    // podziałka 1 s i nazwa odprowadzenia
    ctx.fillStyle = C.txt2; ctx.textAlign = 'left';
    ctx.font = `500 13px ${C.fontDisplay}`; ctx.fillText('II', 8, eT + eH - 10);
    ctx.font = `12px ${C.fontMono}`;
    const sb = pps;
    if (sb < w * 0.55) {
      const x1 = w - 10 - sb, yb = eT + eH - 8;
      ctx.strokeStyle = C.txt3; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1, yb); ctx.lineTo(x1 + sb, yb); ctx.moveTo(x1, yb - 4); ctx.lineTo(x1, yb); ctx.moveTo(x1 + sb, yb - 4); ctx.lineTo(x1 + sb, yb); ctx.stroke();
      ctx.fillStyle = C.txt3; ctx.textAlign = 'center'; ctx.fillText('1 s', x1 + sb / 2, yb - 5);
    }
    // potencjał komórki rozrusznikowej (automatyzm)
    if (topH) {
      const yT = 22, yB = topH - 8;
      const Y = (v: number) => yB - v * (yB - yT);
      ctx.strokeStyle = C.line2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, topH + 0.5); ctx.lineTo(w, topH + 0.5); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = C.txt3;
      ctx.beginPath(); ctx.moveTo(0, Y(PROG)); ctx.lineTo(w, Y(PROG)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.txt3; ctx.textAlign = 'right'; ctx.fillText('próg', w - 6, Y(PROG) - 5);
      ctx.textAlign = 'left'; ctx.fillText('potencjał komórki węzła zatokowego', 8, 14);
      trace(ctx, (t: number) => potencjal(zap, t), { x: 0, w, t0: 0, t1: ok, y0: yB, pxPerMv: yB - yT, color: jasna ? C.txt : C.txt3, width: jasna ? 1.5 : 1.2, sub: 1 });
      const fires = zap.filter((z) => z >= 0 && z <= ok);
      for (const z of fires) { ctx.fillStyle = jasna ? C.puls : C.txt3; ctx.beginPath(); ctx.arc(X(z), Y(PROG), 3.2, 0, Math.PI * 2); ctx.fill(); }
      const [f1, f2] = fires;
      if (f1 !== undefined && f2 !== undefined) {
        const a = X(f1), z = X(f2), y = yT - 2;
        ctx.strokeStyle = C.txt2; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(z, y); ctx.moveTo(a, y - 3); ctx.lineTo(a, y + 3); ctx.moveTo(z, y - 3); ctx.lineTo(z, y + 3); ctx.stroke();
        ctx.fillStyle = C.txt2; ctx.textAlign = 'center'; ctx.fillText(`T = ${sek(cykl)}`, (a + z) / 2, y + 14);
      }
    }
    return cv;
  }

  function drawStrip(sf: Surface = sfc.s) {
    const { ctx, w, h: hh, dpr } = sf;
    if (!w) return;
    const klucz = `${w}x${hh}@${dpr}`;
    if (stripDirty || warstwy.klucz !== klucz || !warstwy.jasna || !warstwy.ciemna) {
      warstwy.jasna = warstwa(sf, true); warstwy.ciemna = warstwa(sf, false); warstwy.klucz = klucz; stripDirty = false;
    }
    const { jasna, ciemna } = warstwy as { jasna: HTMLCanvasElement; ciemna: HTMLCanvasElement };
    const { sc, ok, eT, eH, y0, ppm, X } = geom(sf);
    const xc = X(tCur);
    ctx.clearRect(0, 0, w, hh);
    ctx.drawImage(ciemna, 0, 0, ciemna.width, ciemna.height, 0, 0, w, hh);
    const sx = Math.min(jasna.width, Math.round(xc * dpr));
    if (sx > 0) ctx.drawImage(jasna, 0, 0, sx, jasna.height, 0, 0, sx / dpr, hh);
    // podpis pasma przy pobudzeniu najbliższym kursorowi
    ctx.font = `12px ${C.fontMono}`; ctx.textBaseline = 'alphabetic';
    pasma().forEach((b, bi) => {
      let best: [number, number] | null = null, bd = Infinity;
      for (const p of sc.pob) {
        const r = granice(p)[b.seg];
        if (!r || r[0] < 0 || r[1] > ok) continue;
        const d = Math.abs((r[0] + r[1]) / 2 - tCur);
        if (d < bd) { bd = d; best = [X(r[0]), X(r[1])]; }
      }
      if (best) {
        ctx.fillStyle = C.puls; ctx.textAlign = 'center';
        ctx.fillText(b.label, clamp((best[0] + best[1]) / 2, 34, w - 34), eT + 15 + 15 * bi);
      }
    });
    // kursor
    ctx.strokeStyle = C.txt; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(Math.round(xc) + 0.5, 0); ctx.lineTo(Math.round(xc) + 0.5, hh); ctx.stroke();
    ctx.fillStyle = C.txt;
    ctx.beginPath(); ctx.roundRect?.(xc - 6, eT + eH - 30, 12, 20, 4); ctx.fill();
    ctx.strokeStyle = C.screen; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xc - 2, eT + eH - 25); ctx.lineTo(xc - 2, eT + eH - 15); ctx.moveTo(xc + 2, eT + eH - 25); ctx.lineTo(xc + 2, eT + eH - 15); ctx.stroke();
    ctx.fillStyle = C.puls;
    ctx.beginPath(); ctx.arc(xc, y0 - sig(tCur) * ppm, 3.4, 0, Math.PI * 2); ctx.fill();
  }

  /* ─────────── odczyty ─────────── */
  function paintNow(st: Stan) {
    const f = faza(curScen(), tCur).faza;
    nowFaza.textContent = FAZA_TXT[f];
    let cz = CZOLO_TXT[st.czolo];
    if (st.czolo === 'spoczynek') cz = f === 'T' ? 'brak, komory wracają do spoczynku' : st.strefy.kl > 0.6 && f === 'ST' ? 'brak, komory są pobudzone' : 'brak, spoczynek';
    nowCzolo.textContent = ukryj ? 'odsłoni się po sprawdzeniu' : cz;
    cursor.set(Number(tCur.toFixed(2)));
    cursor.input.style.setProperty('--hw-fill', `${(tCur / curScen().okno) * 100}%`);
  }
  let lastPhase = '';
  function announcePhase() {
    const f = faza(curScen(), tCur).faza;
    const st = stan(curPlans(), tCur);
    const msg = `Kursor: ${FAZA_TXT[f]}. ${ukryj ? '' : `Czoło fali: ${st.czolo === 'spoczynek' ? 'brak' : CZOLO_TXT[st.czolo]}.`}`;
    if (msg !== lastPhase) { lastPhase = msg; live(msg); }
  }
  function paintMbar() {
    const r = stripMbar.lastElementChild as HTMLElement;
    r.innerHTML = playing ? `Tempo <b>${speed === 1 ? '1×' : speed === 0.25 ? '1/4' : '1/10'}</b>` : 'Pauza';
    playBtn.textContent = playing ? 'Pauza' : 'Graj';
    playBtn.setAttribute('aria-label', playing ? 'Zatrzymaj zapis' : 'Wznów zapis');
  }

  /* ─────────── panele trybów ─────────── */
  const tag = (html: string) => h('span', { class: 'hw-tag', html });
  const why = (html: string) => h('p', { class: 'hw-why', html });

  function panelMapa() {
    const segChips = chips(([...['P', 'PQ', 'QRS', 'ST', 'T']] as Seg[]).map((v) => ({ v, label: v })), (sel?.k === 'seg' ? sel.id : '') as Seg, (v) => pick({ k: 'seg', id: v }), { label: 'Element zapisu', small: true });
    const info = h('div', { class: 'hw-pearl' });
    const fill = () => {
      segChips.set((sel?.k === 'seg' ? sel.id : '') as Seg);
      if (!sel) { info.innerHTML = '<span class="hw-label">Co z czym</span>Wybierz strukturę na schemacie albo fragment zapisu, a jego odpowiednik podświetli się sam.'; return; }
      if (sel.k === 'str') {
        const x = STR[sel.id];
        info.innerHTML = `<span class="hw-label">${x.nazwa}</span>${x.txt}`;
      } else {
        info.innerHTML = `<span class="hw-label">${sel.id === 'PQ' ? 'Odstęp PQ' : sel.id === 'ST' ? 'Odcinek ST' : sel.id === 'QRS' ? 'Zespół QRS' : `Załamek ${sel.id}`}</span>${SEG_TXT[sel.id].txt}`;
      }
    };
    fill();
    panel.replaceChildren(
      h('div', { class: 'hw-tags' }, tag(`PQ <b>${sek(W.pqMapa)}</b>`), tag(`QRS <b>${sek(W.qrsWaski)}</b>`), tag(`RR <b>4 duże kratki</b> · <b>${W.hrMapa}/min</b>`)),
      h('div', { class: 'hw-field' }, h('span', { class: 'hw-flabel', text: 'Element zapisu' }), segChips.el),
      info,
    );
    refreshPanel = fill;
  }

  function panelBrama() {
    const big = h('span', { class: 'hw-big' }), cat = h('span', { class: 'hw-cat' });
    const tags = h('div', { class: 'hw-tags' }), w1 = why('');
    const pqChips = chips(W.pqWybor.map((v) => ({ v: String(v), label: sek(v) })), String(pq), (v) => { pq = Number(v); rebuild(true); fill(); live(`PQ ${sek(pq)}. ${cat.textContent ?? ''}.`); }, { label: 'Odstęp PQ' });
    const fill = () => {
      big.textContent = `PQ ${sek(pq)}`;
      const blokI = pqBlokI(pq);
      cat.textContent = blokI ? 'blok AV I stopnia' : pq === W.pqNorma[1] ? 'granica, jeszcze norma' : 'norma';
      cat.className = 'hw-cat ' + (blokI ? 'hw-bad' : 'hw-ok');
      tags.replaceChildren(tag(krat(kratki(pq))), tag(`norma <b>0,12-0,20 s</b>`), tag(pqWNormie(pq) ? 'PQ w normie' : 'odstęp wydłużony'));
      w1.innerHTML = ({
        '0.12': 'PQ 0,12 s to trzy małe kratki, czyli dolna granica normy 0,12-0,20 s.',
        '0.16': 'Cztery małe kratki to <b>0,16 s</b>, czyli norma. W spoczynku impuls zatrzymuje się w węźle AV na około jedną dziesiątą sekundy, zanim ruszy dalej.',
        '0.2': 'Pięć małych kratek, czyli dokładnie 0,20 s, to jeszcze wynik prawidłowy. Blok I stopnia rozpoznajesz dopiero przy PQ <b>powyżej 0,20 s</b>.',
        '0.24': 'Sześć małych kratek to już 0,24 s, czyli odstęp wydłużony: impuls dociera do komór później niż zwykle, bo odźwierny dłużej przytrzymuje go w bramie. Każde P przewodzi do komór, więc to <b>blok AV I stopnia</b>.',
      } as Record<string, string>)[String(pq)] ?? '';
    };
    fill();
    panel.replaceChildren(
      h('div', { class: 'hw-field' }, h('span', { class: 'hw-flabel', text: 'Odstęp PQ' }), pqChips.el),
      h('div', { class: 'hw-row', style: 'align-items:baseline;gap:6px 16px' }, big, cat), tags, w1,
      h('p', { class: 'hw-pearl', html: '<span class="hw-label">Po co odźwierny</span>Te ułamki sekundy dają przedsionkom czas, by dokończyły skurcz i dopełniły komory krwią, zanim komory się skurczą. PQ obejmuje całą drogę: przedsionki, węzeł AV i dalszą część układu przewodzącego.' }),
    );
    refreshPanel = fill;
  }

  function panelAutostrady() {
    const big = h('span', { class: 'hw-big' }), cat = h('span', { class: 'hw-cat' });
    const tags = h('div', { class: 'hw-tags' }), w1 = why('');
    const bChips = chips([{ v: 'brak', label: 'Obie drożne' }, { v: 'prawa', label: 'Prawa zamknięta' }, { v: 'lewa', label: 'Lewa zamknięta' }] as const, blok, (v) => {
      blok = v; rebuild(true); tCur = 1.2 + (blok === 'brak' ? W.qrsWaski : W.qrsSzeroki) / 2; render(); fill();
      live(blok === 'brak' ? 'Obie autostrady drożne. QRS 0,08 s, wąski.' : `${blok === 'prawa' ? 'Prawa' : 'Lewa'} autostrada zamknięta, impuls jedzie objazdem. QRS 0,16 s, szeroki.`);
    }, { label: 'Autostrady Hisa-Purkinjego' });
    const fill = () => {
      const q = blok === 'brak' ? W.qrsWaski : W.qrsSzeroki;
      big.textContent = `QRS ${sek(q)}`;
      cat.textContent = blok === 'brak' ? 'wąski' : 'szeroki'; cat.className = 'hw-cat ' + (blok === 'brak' ? 'hw-ok' : 'hw-bad');
      tags.replaceChildren(tag(krat(kratki(q))), tag(`PQ <b>${sek(W.pqMapa)}</b> bez zmian`), tag('norma: poniżej <b>0,11 s</b>'), tag('szeroki: od <b>0,12 s</b>'));
      w1.innerHTML = blok === 'brak'
        ? 'Impuls błyskawicznie dociera autostradami do najdalszych części komór i dopiero na miejscu rozchodzi się po mięśniu. <b>Wąski QRS</b> to dowód, że zszedł do komór prawidłową, szybką drogą.'
        : `${blok === 'prawa' ? 'Prawa' : 'Lewa'} autostrada jest zamknięta i impuls musi jechać <b>objazdem przez mięsień</b>: część komory dostaje pobudzenie później, od strony komory już pobudzonej. Depolaryzacja trwa dłużej, więc QRS się poszerza i zmienia kształt. Brama przepuściła impuls na czas, więc PQ się nie zmienił.`;
    };
    fill();
    panel.replaceChildren(h('div', { class: 'hw-field' }, h('span', { class: 'hw-flabel', text: 'Odnogi, czyli autostrady' }), bChips.el), h('div', { class: 'hw-row', style: 'align-items:baseline;gap:6px 16px' }, big, cat), tags, w1);
    refreshPanel = fill;
  }

  function panelHierarchia() {
    const big = h('span', { class: 'hw-cat' }), cat = h('span', { class: 'hw-why' });
    const tags = h('div', { class: 'hw-tags' }), w1 = why('');
    const hChips = chips([{ v: 'gra', label: 'Dyrygent gra' }, { v: 'milczy', label: 'Dyrygent milczy' }, { v: 'cisza', label: 'Milczy też łącze' }] as const, hier, (v) => {
      hier = v; rebuild(true); tCur = 0; render(); fill();
      live(v === 'gra' ? 'Dyrygent gra: rytm zatokowy 60-100/min.' : v === 'milczy' ? 'Dyrygent milczy. Po przerwie rytm przejmuje łącze, około 40-60/min, wąskie QRS.' : 'Milczy też łącze. Po przerwie rytm komorowy zastępczy, około 20-40/min, szerokie QRS.');
    }, { label: 'Kto nadaje rytm' });
    const fill = () => {
      const d = {
        gra: { n: 'Rytm zatokowy', r: '60-100/min', q: 'wąskie', p: 'przed każdym QRS', w: 'Węzeł zatokowy pobudza się najszybciej i normalnie przejmuje dowodzenie. Zanim wolniejsze ośrodki dojdą do progu, dociera do nich impuls z góry i zeruje ich odliczanie.' },
        milczy: { n: 'Rytm zastępczy z łącza', r: 'około 40-60/min', q: 'wąskie', p: 'niewidoczne przed QRS', w: 'Pobudzenie zastępcze przychodzi z opóźnieniem, po przerwie: muzyk wchodzi, bo dyrygent milczy. Impuls rodzi się przy bramie, ale do komór jedzie dalej sprawną autostradą Hisa-Purkinjego, więc QRS jest wąski. Przedsionki pobudzają się wstecznie, a P może schować się w QRS.' },
        cisza: { n: 'Rytm komorowy zastępczy', r: 'około 20-40/min', q: 'szerokie', p: 'brak', w: 'Gdy zamilkło też łącze, ostatnią linią obrony są komory. QRS jest szeroki, bo pobudzenie obejmuje komory inną drogą niż prawidłowy impuls nadkomorowy. Im niżej położony ośrodek, tym wolniejszy i mniej pewny, ale wciąż lepszy niż brak rytmu.' },
      }[hier];
      big.textContent = d.n; cat.innerHTML = `<b>${d.r}</b>`;
      tags.replaceChildren(tag(`QRS <b>${d.q}</b>`), tag(`P <b>${d.p}</b>`));
      w1.textContent = d.w;
    };
    fill();
    panel.replaceChildren(
      h('div', { class: 'hw-field' }, h('span', { class: 'hw-flabel', text: 'Kto nadaje rytm' }), hChips.el),
      h('div', { class: 'hw-row', style: 'align-items:baseline;gap:6px 14px' }, big, cat), tags, w1,
      h('p', { class: 'hw-di-small', text: 'Podane zakresy są orientacyjne: leki, niedokrwienie i inne warunki mogą zmieniać częstość każdego ośrodka.' }),
    );
    refreshPanel = fill;
  }

  function panelAutomatyzm() {
    const big = h('span', { class: 'hw-big' }), cat = h('span', { class: 'hw-cat', text: 'częstość = 60 / T' });
    const sl = slider({
      label: 'Czas jednego cyklu T', min: W.cykl.min, max: W.cykl.max, step: 0.01, value: cykl, fmt: (v) => sek(v),
      // w trakcie przeciągania wartość ciągła (kciuk nie przeskakuje pod palcem); zatrzask dopiero po puszczeniu
      onInput: (v) => setCykl(Math.round(v * 100) / 100, false),
    });
    const quick = chips(W.cykl.zatrzaski.map((v) => ({ v: String(v), label: `${sek(v, v === 1 ? 0 : 1)} → ${fmtNum(hrZCyklu(v))}/min` })), String(cykl), (v) => { sl.set(Number(v)); setCykl(Number(v), true); }, { label: 'Wartości z wykładu', small: true });
    const fill = () => {
      big.textContent = `${fmtNum(hrZCyklu(cykl))}/min`;
      quick.set(String(cykl));
    };
    const setCykl = (v: number, say: boolean) => {
      cykl = v; rebuild(false); fill(); render();
      if (say) live(`Cykl ${sek(v)}, częstość ${fmtNum(hrZCyklu(v))} na minutę.`);
    };
    sl.input.addEventListener('change', () => {
      const z = zatrzask(cykl);
      if (z !== cykl) { sl.set(z); setCykl(z, false); }
      live(`Cykl ${sek(cykl)}, częstość ${fmtNum(hrZCyklu(cykl))} na minutę.`);
    });
    fill();
    panel.replaceChildren(sl.el, quick.el, h('div', { class: 'hw-row', style: 'align-items:baseline;gap:6px 16px' }, big, cat),
      why('Komórka rozrusznikowa sama, powoli dochodzi do progu. Ten dryf nazywamy <b>powolną spontaniczną depolaryzacją rozkurczową</b>. Gdy potencjał osiągnie próg, komórka wyzwala impuls. Częstość rytmu nie zależy od siły skurczu, lecz od szybkości, z jaką komórka dochodzi do progu.'),
      h('p', { class: 'hw-di-small', text: 'Na zapisie tego dryfu nie zobaczysz. Widzisz jego skutek: cykle serca powtarzają się częściej albo rzadziej.' }),
    );
    refreshPanel = fill;
  }

  /* ─────────── ćwiczenie ─────────── */
  type ExKind = 'norma' | 'pq' | 'odnoga' | 'lacze' | 'komory';
  interface ExRound { kind: ExKind; blok: Blok; scen: Scen; pl: Plan[] }
  const OPTS: ReadonlyArray<{ v: ExKind; label: string }> = [
    { v: 'norma', label: 'Nic się nie zmieniło, impuls przeszedł zwykłą drogą' },
    { v: 'pq', label: 'Odźwierny dłużej trzyma impuls w bramie AV' },
    { v: 'odnoga', label: 'Jedna autostrada jest zamknięta, impuls jedzie objazdem' },
    { v: 'lacze', label: 'Dyrygent milczy, rytm przejął muzyk z łącza' },
    { v: 'komory', label: 'Dyrygent milczy, rytm przejęły komory' },
  ];
  const WHY: Record<ExKind, string> = {
    norma: 'PQ 0,16 s (cztery małe kratki), QRS 0,08 s (dwie małe kratki), przed każdym QRS stoi P. Impuls przeszedł zwykłą drogą.',
    pq: 'PQ trwa <b>0,24 s</b>, czyli sześć małych kratek. To odstęp wydłużony. Impuls długo czekał przy bramie, bo odźwierny dłużej go przytrzymał. Potem pojechał autostradą, dlatego QRS 0,08 s jest wąski.',
    odnoga: 'PQ 0,16 s, a QRS również <b>0,16 s</b>. Brama przepuściła impuls na czas, a wydłużył się etap rozchodzenia się pobudzenia po komorach. Jedna autostrada jest zamknięta i impuls jedzie objazdem przez mięsień.',
    lacze: 'Przed QRS nie widać P, zespoły są wąskie, a rytm wolny, około <b>40-60/min</b>. Impuls rodzi się przy bramie i do komór jedzie sprawną autostradą, dlatego QRS jest wąski.',
    komory: 'Nie ma P, QRS są szerokie, a rytm bardzo wolny, około <b>20-40/min</b>. To rytm komorowy zastępczy. Pobudzenie obejmuje komory inną drogą niż prawidłowy impuls nadkomorowy. Rytm z łącza też może mieć szerokie QRS, jeśli współistnieje blok odnogi. Dlatego o komorach rozstrzyga także bardzo wolna częstość.',
  };
  let order: ExKind[] = [];
  let opt: ReturnType<typeof options> | null = null;
  const ex = exercise<ExRound>({
    rounds: 5,
    make: (i) => {
      if (i === 0) order = shuffle(['norma', 'pq', 'odnoga', 'lacze', 'komory'] as ExKind[]);
      const kind = order[i] ?? 'norma';
      const bl: Blok = kind === 'odnoga' ? (Math.random() < 0.5 ? 'prawa' : 'lewa') : 'brak';
      const sc = kind === 'lacze' ? scenZastepczy('lacze') : kind === 'komory' ? scenZastepczy('komorowy')
        : scenZatokowy({ okno: OKNO.cwiczenie, pq: kind === 'pq' ? 0.24 : W.pqMapa, blok: bl });
      return { kind, blok: bl, scen: sc, pl: plany(sc) };
    },
    show: (r) => {
      exRound = r; ukryj = true;
      opt = options(OPTS, () => ex.odswiez());
      opt.el.setAttribute('aria-label', 'Odpowiedzi');
      ex.miejsce.replaceChildren(opt.el);
      stopKursor(); tCur = 0; cover.hidden = false;
      setA(svg, { opacity: 0.45 });
      afterScenChange();
    },
    prompt: 'Obejrzyj zapis z odprowadzenia II (możesz go odtworzyć i przewijać). Co zmieniło się na drodze impulsu albo kto przejął rytm?',
    gotowe: () => (opt?.picked() ?? null) !== null,
    check: (r) => {
      const picked = opt?.picked() ?? null;
      opt?.reveal(r.kind, picked);
      ukryj = false; cover.hidden = true; setA(svg, { opacity: 1 });
      afterScenChange();
      const ok = picked === r.kind;
      const right = OPTS.find((o) => o.v === r.kind)?.label ?? '';
      const male = right.charAt(0).toLowerCase() + right.slice(1);
      // wspólny wzór: „Dobrze. <odpowiedź>.” / „Nie. Prawidłowo: <odpowiedź>.”
      return { ok, prawidlowo: ok ? undefined : male, szczegol: ok ? `${right}.` : undefined, why: WHY[r.kind] + ' Schemat pokazuje teraz drogę impulsu w tym zapisie.' };
    },
    live,
  });
  function panelCwiczenie() { panel.replaceChildren(ex.el); refreshPanel = () => {}; ex.start(); }

  /* ─────────── sterowanie ─────────── */
  function curScen(): Scen { return widok === 'cwiczenie' && exRound ? exRound.scen : scen; }
  function curPlans(): Plan[] { return widok === 'cwiczenie' && exRound ? exRound.pl : pl; }

  function rebuild(keepT: boolean) {
    scen = widok === 'automatyzm' ? scenAutomatyzm(cykl) : widok === 'hierarchia' ? scenHierarchia(hier)
      : scenZatokowy({ pq: widok === 'brama' ? pq : W.pqMapa, blok: widok === 'autostrady' ? blok : 'brak' });
    pl = plany(scen); sig = sygnal(scen); zap = zaplonySA(scen);
    if (!keepT) tCur = Math.min(tCur, scen.okno - 0.01);
    afterScenChange();
  }
  function afterScenChange() {
    stopKursor();
    const sc = curScen();
    sig = sygnal(sc); zap = zaplonySA(sc);
    cursor.input.max = String(sc.okno);
    tCur = clamp(tCur, 0, sc.okno - 0.01);
    paintStatic(); render();
  }

  /**
   * Zmiana stanu o innej treści: nowy stan od razu (wejście nie czeka), a schemat i zapis wyłaniają się z przygaszenia.
   * Gdy poprzednie przenikanie jeszcze trwa, nowe startuje od bieżącego krycia.
   */
  function crossfade(apply: () => void) {
    apply();
    if (rm) return;
    for (const el of [fadeBox, screen]) {
      if (typeof el.animate !== 'function') continue;
      const trwa = el.getAnimations?.() ?? [];
      const od = trwa.length ? Number(getComputedStyle(el).opacity) || 0.15 : 0.15;
      trwa.forEach((a) => a.cancel());
      el.animate([{ opacity: od }, { opacity: 1 }], { duration: 250, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
  }

  function setWidok(v: Widok) {
    crossfade(() => {
      stopKursor();
      widok = v; sel = null; ukryj = false; exRound = null; cover.hidden = true; setA(svg, { opacity: 1 });
      if (v !== 'cwiczenie') temat = v;
      trybChips.set(v === 'cwiczenie' ? 'sprawdz' : 'ucz'); tematChips.set(temat); tematChips.el.hidden = v === 'cwiczenie';
      const hh = v === 'automatyzm' ? 250 : 170;
      if (sfc.s.h !== hh) remakeSurface(hh);
      if (v === 'cwiczenie') { scen = scenZatokowy(); pl = plany(scen); panelCwiczenie(); live(`${TRYB_SPRAWDZ}.`); return; }
      rebuild(true);
      tCur = v === 'mapa' ? 1.2 + W.qrsWaski / 2 : v === 'brama' ? 1.2 - BRAMA_DT : v === 'autostrady' ? 1.2 + (blok === 'brak' ? W.qrsWaski : W.qrsSzeroki) / 2 : v === 'hierarchia' ? 0 : 0.2 + P_DUR / 2;
      ({ mapa: panelMapa, brama: panelBrama, autostrady: panelAutostrady, hierarchia: panelHierarchia, automatyzm: panelAutomatyzm } as const)[v]();
      afterScenChange();
      live(`${TEMATY.find((c) => c.v === v)?.label ?? ''}.`);
    });
  }

  function pick(x: { k: 'str'; id: Str } | { k: 'seg'; id: Seg }, moveCursor = true) {
    if (widok !== 'mapa') return;
    sel = x;
    if (moveCursor) {
      setPlaying(false);
      // kursor na ten element w pobudzeniu, w którym już stoi (albo najbliższym)
      const seg: Seg = x.k === 'seg' ? x.id : (STR[x.id].seg[0] ?? 'QRS');
      const p = scen.pob.reduce((b, q) => (Math.abs(q.at - tCur) < Math.abs(b.at - tCur) && q.at > 0.3 && q.at < scen.okno - 0.5 ? q : b), scen.pob.find((q) => q.at > 0.3)!);
      const g = granice(p);
      const r = g[seg];
      const target = x.k === 'str' && x.id === 'sa' ? p.at - p.pq + 0.008
        : x.k === 'str' && x.id === 'his' ? p.at - 0.037
        : x.k === 'str' && x.id === 'odnogi' ? p.at - 0.02 // odnogi przewodzą jeszcze w PQ
        : x.k === 'str' && x.id === 'purkinje' ? p.at + 0.006
        : seg === 'PQ' ? p.at - BRAMA_DT
        : r ? (r[0] + r[1]) / 2 : tCur;
      goT(clamp(target, 0, scen.okno - 0.01)); // kursor dojeżdża do elementu sprężyną
    }
    paintStatic(); refreshPanel(); render();
    const txt = x.k === 'str' ? `${STR[x.id].nazwa}. ${STR[x.id].seg.length ? `Na zapisie: ${STR[x.id].seg.join(', ')}.` : ''}` : SEG_TXT[x.id].txt;
    live(txt);
  }

  function setT(v: number) { stopKursor(); tCur = clamp(v, 0, curScen().okno - 0.001); render(); }
  function setPlaying(p: boolean) { if (p) stopKursor(); playing = p; paintMbar(); }
  /** Ruch kursora wywołany przez kursanta (wybór elementu, wybieg po rzucie): sprężyna, przerywalna. */
  let kursorSp: Spring | null = null;
  function stopKursor() { kursorSp?.stop(); kursorSp = null; }
  function goT(cel: number, v = 0, done?: () => void) {
    stopKursor();
    const ok = curScen().okno;
    kursorSp = spring(tCur, cel, (x) => { tCur = clamp(x, 0, ok - 0.001); render(); }, { response: 0.4, damping: 1, velocity: v, done });
  }

  function render() {
    const st = ukryj ? stan([], 0) : stan(curPlans(), tCur);
    drawSchematic(st);
    drawStrip();
    paintNow(st);
  }

  // dźwięk w odtwarzaniu: takt dyrygenta na początku P, stuk na początku QRS (w zwolnionym tempie słychać postój w bramie AV)
  const snd = dzwiekDla(body);
  const lp = loop(body, (_t, dt) => {
    if (!playing || dt <= 0) return;
    const ok = curScen().okno;
    const f0 = faza(curScen(), tCur).faza;
    tCur += dt * speed;
    if (tCur >= ok) tCur -= ok;
    const f1 = faza(curScen(), tCur).faza;
    if (f1 !== f0) { if (f1 === 'P') snd.tik(true); else if (f1 === 'QRS') snd.stuk(); }
    render();
  });
  cleanups.push(() => lp.stop());

  // start
  paintMbar();
  if (start === 'cwiczenie') { widok = 'cwiczenie'; panelCwiczenie(); }
  else {
    widok = start;
    ({ mapa: panelMapa, brama: panelBrama, autostrady: panelAutostrady, hierarchia: panelHierarchia, automatyzm: panelAutomatyzm } as const)[start]();
    if (start === 'automatyzm') remakeSurface(250);
    if (start === 'brama') tCur = 1.2 - BRAMA_DT;
    if (start === 'hierarchia') tCur = 0;
    if (start === 'automatyzm') tCur = 0.2 + P_DUR / 2;
    rebuild(true);
    afterScenChange();
  }

  return () => { stopKursor(); ugiecieSp?.stop(); cleanups.forEach((f) => f()); host.replaceChildren(); };
}
