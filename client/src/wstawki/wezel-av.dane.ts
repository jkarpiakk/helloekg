/**
 * Laboratorium węzła AV: czysta logika bez DOM (harmonogramy pobudzeń, opisy, zadania).
 *
 * Wszystkie liczby pokazywane kursantowi pochodzą z wykładów S2_02, S4_01-S4_04 i S6_01
 * (cytaty w `wezel-av.karta.ts`). Wartości robocze modelu, których tekst nie podaje
 * (np. tempo przedsionków przy „wysiłku”), są oznaczone komentarzem i nigdy nie trafiają
 * do etykiet.
 */

export type Tryb = 'norma' | 'i' | 'wenckebach' | 'mobitz2' | '2:1' | 'zaawansowany' | 'iii';
export const TRYBY: readonly Tryb[] = ['norma', 'i', 'wenckebach', 'mobitz2', '2:1', 'zaawansowany', 'iii'];

export type Poziom = 'wezel' | 'his';
export type Zastepczy = 'komory' | 'lacze';
export interface Wariant {
  /** 2:1 — gdzie naprawdę leży blok (na spoczynkowym zapisie nie widać). */
  poziom: Poziom;
  /** 2:1 — przedsionki przyspieszone jak w próbie wysiłkowej. */
  wysilek: boolean;
  /** III° — skąd pochodzi rytm zastępczy. */
  zastepczy: Zastepczy;
}
export const WARIANT0: Wariant = { poziom: 'wezel', wysilek: false, zastepczy: 'komory' };

/** Jedna mała kratka przy 25 mm/s (S2_02). */
export const KRATKA = 0.04;

/** Pobudzenie przedsionków i jego los. `at` = początek P [s]. */
export interface CyklP {
  k: number;
  at: number;
  /** Czas przewodzenia (PQ) albo null, gdy impuls nie dotarł do komór. */
  pq: number | null;
  /** Gdzie zatrzymał się impuls: w bramie (węzeł AV) czy niżej (pęczek Hisa). */
  stop: 'brama' | 'his' | null;
  /** P niezależne od QRS (blok całkowity). */
  niezalezny: boolean;
}

/** Pobudzenie komór. */
export interface PobV { at: number; zrodlo: 'przewiedzione' | 'lacze' | 'komory'; k: number | null }

export type KsztaltQRS = 'waski' | 'odnoga' | 'komorowy';

export interface Scen {
  tryb: Tryb;
  w: Wariant;
  /** Odstęp P-P [s]. */
  pp: number;
  qrs: KsztaltQRS;
  /** Pokrętła T w modelu (QT, smukłość). */
  qt: number;
  tSharp: number;
  /** Czy PQ tego stanu jest podane w tekście (wtedy wolno je podpisać liczbą). */
  pqZTekstu: boolean;
  cykl(k: number): CyklP;
  komory(t0: number, t1: number): PobV[];
}

const mod = (k: number, n: number): number => ((k % n) + n) % n;
/** 60/T z wykładu: częstość z odstępu. */
export const naMinute = (odstep: number): number => 60 / odstep;
export const odstep = (naMin: number): number => 60 / naMin;

/** Mobitz II: wypadnięcia nieregularne (3:2, 5:4, 4:3), zawsze ≥ 2 przewiedzione P przed i po. */
const M2_BLOK = new Set([2, 7, 11]);
const M2_OKRES = 12;

/** Odstęp P-P przy „wysiłku” — wartość robocza modelu, bez podpisu liczbą. */
const PP_WYSILEK = 0.6;
/** PQ przy „wysiłku” w bloku węzłowym — robocze, bez podpisu (tekst: PQ się skraca). */
const PQ_WYSILEK = 0.2;
/** PQ w bloku zaawansowanym — robocze, bez podpisu (tekst: „powtarzalny odstęp PQ”). */
const PQ_ZAAW = 0.16;
/** Pierwszy QRS rytmu zastępczego: przypadkowo 0,16 s po P (S4_04: „na przykład wynosi 0,16 s”). */
export const III_PRZESUNIECIE = 0.16;

export function scen(tryb: Tryb, w: Wariant = WARIANT0): Scen {
  const base = { tryb, w, qt: 0.38, tSharp: 1, pqZTekstu: true };
  const przewiedzione = (sc: Scen) => (t0: number, t1: number): PobV[] => {
    const out: PobV[] = [];
    for (let k = Math.floor((t0 - 0.6) / sc.pp); k <= Math.ceil(t1 / sc.pp); k++) {
      const c = sc.cykl(k);
      if (c.pq === null) continue;
      const at = c.at + c.pq;
      if (at >= t0 && at < t1) out.push({ at, zrodlo: 'przewiedzione', k });
    }
    return out;
  };
  const make = (o: Omit<Scen, 'komory' | 'tryb' | 'w' | 'qt' | 'tSharp' | 'pqZTekstu'> & Partial<Scen>): Scen => {
    const sc = { ...base, ...o } as Scen;
    if (!o.komory) sc.komory = przewiedzione(sc);
    return sc;
  };
  const c = (k: number, pp: number, pq: number | null, stop: CyklP['stop'] = null): CyklP =>
    ({ k, at: k * pp, pq, stop: pq === null ? stop : null, niezalezny: false });

  switch (tryb) {
    case 'norma':
      return make({ pp: 0.8, qrs: 'waski', cykl: (k) => c(k, 0.8, 0.16) });
    case 'i':
      return make({ pp: 0.8, qrs: 'waski', cykl: (k) => c(k, 0.8, 0.24) });
    case 'wenckebach': {
      const seq = [0.16, 0.28, 0.36, null] as const;
      return make({ pp: 0.8, qrs: 'waski', cykl: (k) => c(k, 0.8, seq[mod(k, 4)] ?? null, 'brama') });
    }
    case 'mobitz2':
      return make({ pp: 0.8, qrs: 'odnoga', cykl: (k) => c(k, 0.8, M2_BLOK.has(mod(k, M2_OKRES)) ? null : 0.16, 'his') });
    case '2:1': {
      const stop = w.poziom === 'wezel' ? 'brama' : 'his';
      if (!w.wysilek) {
        // spoczynek: przedsionki 80/min, co drugi P bez QRS; dłuższe QT i szersze T, żeby P zlewał się z T
        const pp = odstep(80);
        return make({ pp, qrs: 'waski', qt: 0.5, tSharp: 0.75, cykl: (k) => c(k, pp, mod(k, 2) === 0 ? 0.24 : null, stop) });
      }
      if (w.poziom === 'wezel') return make({ pp: PP_WYSILEK, qrs: 'waski', pqZTekstu: false, qt: 0.34, cykl: (k) => c(k, PP_WYSILEK, PQ_WYSILEK) });
      return make({ pp: PP_WYSILEK, qrs: 'waski', pqZTekstu: false, qt: 0.44, cykl: (k) => c(k, PP_WYSILEK, mod(k, 3) === 0 ? 0.24 : null, 'his') });
    }
    case 'zaawansowany': {
      const pp = odstep(90);
      return make({ pp, qrs: 'waski', pqZTekstu: false, qt: 0.44, cykl: (k) => c(k, pp, mod(k, 3) === 0 ? PQ_ZAAW : null, 'his') });
    }
    case 'iii': {
      const rr = w.zastepczy === 'komory' ? 2 : 1.5;
      const stop = w.zastepczy === 'komory' ? 'his' : 'brama';
      return make({
        pp: 0.8, qrs: w.zastepczy === 'komory' ? 'komorowy' : 'waski', pqZTekstu: false, qt: w.zastepczy === 'komory' ? 0.44 : 0.42,
        cykl: (k) => ({ k, at: k * 0.8, pq: null, stop, niezalezny: true }),
        komory: (t0, t1) => {
          const out: PobV[] = [];
          for (let j = Math.ceil((t0 - III_PRZESUNIECIE) / rr); III_PRZESUNIECIE + j * rr < t1; j++) {
            const at = III_PRZESUNIECIE + j * rr;
            if (at >= t0) out.push({ at, zrodlo: w.zastepczy, k: null });
          }
          return out;
        },
      });
    }
  }
}

/** Cykle przedsionków k0..k1 (włącznie). */
export function harmonogram(sc: Scen, k0: number, k1: number): CyklP[] {
  const out: CyklP[] = [];
  for (let k = k0; k <= k1; k++) out.push(sc.cykl(k));
  return out;
}

/** Odstępy RR w oknie czasu. */
export function odstepyRR(sc: Scen, t0: number, t1: number): number[] {
  const v = sc.komory(t0, t1).map((e) => e.at);
  return v.slice(1).map((x, i) => round3(x - (v[i] ?? x)));
}

/** Odległość od P do najbliższego następnego QRS (w III° to NIE jest PQ). */
export function doNastepnegoQRS(sc: Scen, k: number): number | null {
  const c = sc.cykl(k);
  const nxt = sc.komory(c.at, c.at + 4)[0];
  return nxt ? round3(nxt.at - c.at) : null;
}

export const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const f = (v: number, d = 2): string => v.toFixed(d).replace('.', ',');
const kratki = (pq: number): string => {
  const n = Math.round(pq / KRATKA);
  return `${n} ${n === 1 ? 'mała kratka' : n >= 2 && n <= 4 ? 'małe kratki' : 'małych kratek'}`;
};

/** Zdanie o wybranym cyklu (odczyt + komunikat dla czytnika ekranu). */
export function opisCyklu(sc: Scen, k: number): { krotko: string; zdanie: string } {
  const cy = sc.cykl(k);
  const t = sc.tryb;
  if (cy.niezalezny) {
    const d = doNastepnegoQRS(sc, k);
    if (d !== null && Math.abs(d - III_PRZESUNIECIE) < 0.005) {
      return { krotko: 'P-QRS 0,16 s, przypadkiem', zdanie: 'Odległość P od QRS wygląda prawidłowo, 0,16 s, ale w następnym cyklu P się przesuwa. To przypadkowe sąsiedztwo, nie przewodzenie.' };
    }
    return { krotko: 'P bez związku z QRS', zdanie: 'Ten P nie wywołuje QRS. Odległość od P do najbliższego QRS zmienia się z cyklu na cykl i nie jest odstępem PQ.' };
  }
  if (cy.pq === null) {
    const extra: Partial<Record<Tryb, string>> = {
      wenckebach: 'Przed pauzą PQ wynosiło 0,36 s, a po pauzie wraca do 0,16 s.',
      mobitz2: 'PQ przed zablokowanym P i po nim jest takie samo, 0,16 s.',
      '2:1': sc.w.wysilek ? 'Przy szybszym napływie impulsów chory układ Hisa-Purkinjego nie nadąża.' : 'Między zablokowanymi P jest tylko jedno przewiedzione pobudzenie: nie ma dwóch kolejnych PQ do porównania.',
      zaawansowany: 'Dwa kolejne P pozostają bez odpowiedzi komór.',
    };
    return { krotko: 'P bez QRS', zdanie: `P bez QRS. Dla zablokowanego P nie zapisujesz wartości PQ. ${extra[t] ?? ''}`.trim() };
  }
  if (!sc.pqZTekstu) {
    if (t === '2:1' && sc.w.poziom === 'wezel') return { krotko: 'PQ krótsze', zdanie: 'Każdy P przewiedziony: węzeł AV przewodzi sprawniej, a PQ się skraca.' };
    if (t === '2:1') return { krotko: 'PQ powtarzalne', zdanie: 'Ten P przeszedł z tym samym PQ, a kolejne giną poniżej bramy: przewodzenie jest gorsze niż w spoczynku.' };
    return { krotko: 'PQ powtarzalne', zdanie: 'PQ powtarzalne: ten P rzeczywiście wywołał QRS.' };
  }
  const base = `PQ ${f(cy.pq)} s, czyli ${kratki(cy.pq)}.`;
  const extra: Partial<Record<Tryb, string>> = {
    norma: 'Mieści się w normie 0,12-0,20 s.',
    i: 'Powyżej 0,20 s, a po każdym P jest QRS. To blok I stopnia.',
    wenckebach: ['Najkrótsze PQ w sekwencji, zaraz po pauzie.', 'Dłuższe niż poprzednie.', 'Najdłuższe. Następny P zostanie bez QRS.'][mod(k, 4)] ?? '',
    mobitz2: 'Takie samo w każdym przewiedzionym pobudzeniu.',
    '2:1': 'Wydłużone PQ i wąski QRS przemawiają raczej za blokiem węzłowym, ale nie rozstrzygają.',
  };
  return { krotko: `PQ ${f(cy.pq)} s`, zdanie: `${base} ${extra[t] ?? ''}`.trim() };
}

/** Raster sceny odźwiernego (klucze `OBRAZY` z core/obrazy.ts; tu jako napisy, żeby plik był bez DOM). */
export type Scena = 'odzwiernySpokojny' | 'odzwiernyZmeczony' | 'odzwiernySenny' | 'odzwiernyRozbudzony' | 'bramaZamknieta' | 'bramaUchylona';

/**
 * Stan odźwiernego w danym cyklu: scena z rastra marki, podpis (≤ 8 słów, dosłownie z wykładu)
 * i dłuższy opis do panelu. zm: 0 czujny … 3 nie wpuszcza (do testów przebiegu Wenckebacha).
 */
export interface Odzwierny { zm: 0 | 1 | 2 | 3; zamknieta: boolean; scena: Scena; podpis: string; opis: string }

/** Podpisy scen: dosłowne fragmenty wykładów (cytaty w karcie). */
export const PODPIS = {
  czeka: 'każe każdemu impulsowi chwilę poczekać',
  przetrzymuje: 'odźwierny przetrzymuje impuls dłużej niż zwykle',
  leniwiej: 'po prostu otwiera się leniwiej',
  wolniej: 'otwiera coraz wolniej',
  nieWpuszcza: 'aż w końcu jednego nie wpuszcza w ogóle',
  szybko: 'by następnego znów wpuścić szybko',
  punktualnie: 'przepuszcza sygnał punktualnie',
  ginie: 'bez zapowiedzi „przeskakuje” i jedno pobudzenie ginie',
  coDrugi: 'co drugi załamek P jest przewiedziony',
  rozbudza: 'odźwierny się rozbudza',
  nieNadaza: 'Chory układ Hisa-Purkinjego może natomiast nie nadążać',
  jedenP: 'jeden P wywołuje QRS',
  dwaNastepne: 'dwa następne pozostają bez odpowiedzi komór',
  zaden: 'Żaden impuls przedsionkowy nie dociera do komór',
} as const;

export function odzwierny(sc: Scen, k: number): Odzwierny {
  const cy = sc.cykl(k);
  const blok = cy.pq === null;
  const o = (zm: Odzwierny['zm'], zamknieta: boolean, scena: Scena, podpis: string, opis: string): Odzwierny => ({ zm, zamknieta, scena, podpis, opis });
  switch (sc.tryb) {
    case 'norma': return o(0, false, 'odzwiernySpokojny', PODPIS.czeka, 'Odźwierny każe każdemu impulsowi chwilę poczekać i wpuszcza każdy.');
    case 'i': return o(0, false, 'bramaUchylona', PODPIS.leniwiej, 'Brama nie gubi pobudzeń, tylko otwiera się wolniej: odźwierny przetrzymuje impuls dłużej niż zwykle, ale w końcu wpuszcza każdy.');
    case 'wenckebach': {
      const i = mod(k, 4) as 0 | 1 | 2 | 3;
      if (i === 0) return k === 0
        ? o(0, false, 'odzwiernySpokojny', PODPIS.czeka, 'Pierwszy impuls sekwencji: odźwierny wpuszcza go szybko.')
        : o(0, false, 'odzwiernyRozbudzony', PODPIS.szybko, 'Odźwierny odpoczął po pauzie i znów wpuszcza szybko.');
      if (i === 3) return o(3, true, 'odzwiernySenny', PODPIS.nieWpuszcza, 'Zmęczony odźwierny tego impulsu nie wpuszcza w ogóle.');
      return o(i, false, 'odzwiernyZmeczony', PODPIS.wolniej, i === 1 ? 'Odźwierny otwiera wolniej.' : 'Odźwierny jest coraz bardziej zmęczony i otwiera jeszcze wolniej.');
    }
    // blok podwęzłowy: odźwierny wpuścił impuls, brama otwarta; miejsce zatrzymania pokazuje diagram i podpis
    case 'mobitz2': return blok
      ? o(0, false, 'odzwiernySpokojny', PODPIS.ginie, 'Odźwierny wpuścił ten impuls, ale bez ostrzeżenia zginął niżej, w układzie Hisa-Purkinjego. Miejsce zatrzymania pokazuje diagram.')
      : o(0, false, 'odzwiernySpokojny', PODPIS.punktualnie, 'Przewodzenie działa sprawnie, bez narastającego zmęczenia.');
    case '2:1':
      if (sc.w.wysilek) return sc.w.poziom === 'wezel'
        ? o(0, false, 'odzwiernyRozbudzony', PODPIS.rozbudza, 'Przy wysiłku słabnie wpływ nerwu błędnego: odźwierny się rozbudza i wpuszcza każdy impuls.')
        : o(0, false, 'odzwiernyRozbudzony', PODPIS.nieNadaza, 'Odźwierny przepuszcza, ale chory układ Hisa-Purkinjego nie nadąża za szybszym napływem impulsów.');
      if (blok && sc.w.poziom === 'wezel') return o(0, true, 'bramaZamknieta', PODPIS.coDrugi, 'W tym wariancie odźwierny nie wpuszcza co drugiego impulsu.');
      return blok
        ? o(0, false, 'odzwiernySpokojny', PODPIS.coDrugi, 'W tym wariancie odźwierny wpuszcza każdy impuls, a co drugi ginie poniżej bramy, w układzie Hisa-Purkinjego.')
        : o(0, false, 'odzwiernySpokojny', PODPIS.coDrugi, 'Ten impuls przechodzi. Następny zostanie zatrzymany.');
    case 'zaawansowany': return blok
      ? o(0, false, 'odzwiernySpokojny', PODPIS.dwaNastepne, 'Odźwierny wpuszcza impulsy, ale dwa kolejne giną poniżej bramy, choć część nadal przechodzi przez układ AV.')
      : o(0, false, 'odzwiernySpokojny', PODPIS.jedenP, 'Ten impuls przechodzi z powtarzalnym PQ.');
    case 'iii': return sc.w.zastepczy === 'lacze'
      ? o(0, true, 'bramaZamknieta', PODPIS.zaden, 'Przejście do komór jest zamknięte na głucho, w samej bramie. Komory pobudza muzyk zastępczy z łącza AV.')
      : o(0, false, 'odzwiernySpokojny', PODPIS.zaden, 'Odźwierny wpuszcza impulsy, ale przejście jest zamknięte na głucho niżej, na autostradach. Komory pobudza wolny muzyk zastępczy z komór.');
  }
}

/** Opis stanu: nagłówek, krótkie wyjaśnienie, wartości (wszystko z tekstu). */
export interface OpisTrybu { tytul: string; tekst: string; tagi: Array<[string, string]>; perla?: string }

export function opisTrybu(tryb: Tryb, w: Wariant = WARIANT0): OpisTrybu {
  switch (tryb) {
    case 'norma': return {
      tytul: 'Prawidłowe przewodzenie',
      tekst: 'Każdy P ma swój QRS. Odźwierny każe impulsowi chwilę poczekać, żeby przedsionki zdążyły dopełnić komory krwią.',
      tagi: [['PQ', '0,16 s'], ['norma PQ', '0,12-0,20 s'], ['P-P', '0,80 s · 75/min'], ['przewodzenie', '1:1']],
    };
    case 'i': return {
      tytul: 'Blok AV I stopnia',
      tekst: 'Każdy impuls dociera do komór, ale z nadmiernym opóźnieniem. Brama nie gubi pobudzeń, po prostu otwiera się leniwiej.',
      tagi: [['PQ', '0,24 s · 6 kratek'], ['próg', 'powyżej 0,20 s'], ['przewodzenie', '1:1'], ['częstość', '75/min']],
      perla: 'Długie PQ + każdy P ma swój QRS. Blok I stopnia nie zwalnia rytmu komór.',
    };
    case 'wenckebach': return {
      tytul: 'Blok AV II stopnia, Mobitz I (Wenckebach)',
      tekst: 'PQ wydłuża się z pobudzenia na pobudzenie, aż jeden P nie zostaje przewiedziony. Po pauzie PQ wraca do najkrótszego. Przyrosty PQ maleją, więc RR przed pauzą się skracają.',
      tagi: [['PQ', '0,16 → 0,28 → 0,36 s'], ['przewodzenie', '4:3'], ['RR', '0,92 · 0,88 s'], ['pauza', '1,40 s < 2 × PP'], ['komory', 'ok. 56/min']],
      perla: 'PQ rośnie, rośnie, rośnie, wypada QRS, reset.',
    };
    case 'mobitz2': return {
      tytul: 'Blok AV II stopnia, Mobitz II',
      tekst: 'PQ pozostaje stałe, a co pewien czas P nagle nie przewodzi się do komór. Problem leży poniżej węzła, w układzie Hisa-Purkinjego. Często towarzyszy mu szeroki QRS.',
      tagi: [['PQ', 'stałe 0,16 s'], ['P-P', '0,80 s · 75/min'], ['pauza', '1,60 s = 2 × PP'], ['QRS', 'szeroki, ≥ 120 ms']],
      perla: 'Nie ma narastającego zmęczenia bramy. Do rozpoznania potrzebujesz co najmniej dwóch kolejnych przewiedzionych P.',
    };
    case '2:1':
      if (w.wysilek) return w.poziom === 'wezel'
        ? {
          tytul: 'Blok 2:1 przy przyspieszonych przedsionkach: poziom węzłowy',
          tekst: 'Podczas wysiłku słabnie wpływ nerwu błędnego i węzeł AV zwykle przewodzi sprawniej. Poprawa przewodzenia przemawia za poziomem węzłowym.',
          tagi: [['przedsionki', 'szybciej'], ['przewodzenie', '1:1, lepsze'], ['PQ', 'krótsze']],
          perla: 'U stabilnego pacjenta możesz wykorzystać próbę wysiłkową pod nadzorem.',
        }
        : {
          tytul: 'Blok 2:1 przy przyspieszonych przedsionkach: poziom podwęzłowy',
          tekst: 'Chory układ Hisa-Purkinjego może nie nadążać za szybszym napływem impulsów. Pogorszenie przewodzenia podczas wysiłku przemawia za poziomem podwęzłowym.',
          tagi: [['przedsionki', 'szybciej'], ['przewodzenie', 'gorsze niż 2:1'], ['PQ', 'powtarzalne']],
          perla: 'U stabilnego pacjenta możesz wykorzystać próbę wysiłkową pod nadzorem.',
        };
      return {
        tytul: 'Blok AV II stopnia z przewodzeniem 2:1',
        tekst: 'Co drugi P jest przewiedziony, więc nigdy nie widzisz dwóch kolejnych PQ. Tak samo wygląda to przy bloku węzłowym i podwęzłowym. Przeoczony P w T zamienia ten zapis w „bradykardię zatokową”.',
        tagi: [['przedsionki', '80/min'], ['komory', '40/min'], ['PQ', '0,24 s'], ['QRS', 'wąski']],
        perla: 'Przyspiesz przedsionki, żeby zobaczyć, co robi blok na każdym poziomie.',
      };
    case 'zaawansowany': return {
      tytul: 'Blok zaawansowany 3:1',
      tekst: 'Dwa kolejne P nie przewodzą się do komór, ale część impulsów nadal przechodzi przez układ AV. Szukasz P, które rzeczywiście poprzedzają QRS z powtarzalnym PQ.',
      tagi: [['przedsionki', '90/min'], ['komory', '30/min'], ['przewodzenie', '3:1'], ['PQ', 'powtarzalne']],
      perla: 'Sam blok 2:1 nie jest blokiem wysokiego stopnia: tu potrzeba co najmniej dwóch kolejnych zablokowanych P.',
    };
    case 'iii': return w.zastepczy === 'komory'
      ? {
        tytul: 'Blok AV III stopnia, rytm zastępczy z komór',
        tekst: 'Żaden impuls przedsionkowy nie dociera do komór. Przedsionki słuchają dyrygenta, komory grają w tempie muzyka zastępczego. Między P a QRS nie ma żadnej stałej zależności.',
        tagi: [['P-P', '0,80 s · 75/min'], ['R-R', '2 s · 30/min'], ['QRS', 'szeroki, np. 0,16 s'], ['rytm komorowy', 'około 20-40/min']],
        perla: 'Szerokie QRS i wolny rytm to sytuacja znacznie groźniejsza, bo rozrusznik komorowy bywa zawodny.',
      }
      : {
        tytul: 'Blok AV III stopnia, rytm zastępczy z łącza AV',
        tekst: 'Żaden impuls przedsionkowy nie dociera do komór. Rytm z łącza jedzie do komór drogą ekspresową Hisa-Purkinjego, więc QRS są wąskie.',
        tagi: [['P-P', '0,80 s · 75/min'], ['R-R', '1,50 s · 40/min'], ['QRS', 'wąski'], ['rytm z łącza', 'około 40-60/min']],
        perla: 'Szerokość QRS podpowiada, skąd pochodzi rytm zastępczy, ale nie wskazuje pewnie miejsca bloku.',
      };
  }
}

/* ─────────── ćwiczenie ─────────── */

export type Odp = 'norma' | 'bradykardia' | 'i' | 'mobitz1' | 'mobitz2' | '2:1' | 'zaawansowany' | 'iii';
export const OPCJE: ReadonlyArray<{ v: Odp; label: string }> = [
  { v: 'norma', label: 'Prawidłowe przewodzenie AV' },
  { v: 'bradykardia', label: 'Bradykardia zatokowa' },
  { v: 'i', label: 'Blok AV I stopnia' },
  { v: 'mobitz1', label: 'Blok II stopnia, Mobitz I (Wenckebach)' },
  { v: 'mobitz2', label: 'Blok II stopnia, Mobitz II' },
  { v: '2:1', label: 'Blok II stopnia z przewodzeniem 2:1' },
  { v: 'zaawansowany', label: 'Blok zaawansowany' },
  { v: 'iii', label: 'Blok III stopnia (całkowity)' },
];

export interface Zadanie { id: string; tryb: Tryb; w: Wariant; dobra: Odp; dlaczego: string }

export const ZADANIA: readonly Zadanie[] = [
  {
    id: 'i', tryb: 'i', w: WARIANT0, dobra: 'i',
    dlaczego: 'PQ zajmuje 6 małych kratek, czyli 0,24 s, więcej niż 0,20 s, a <b>każdy P ma swój QRS</b>. To blok AV I stopnia. Przewodzenie jest wolniejsze, ale żaden impuls nie ginie.',
  },
  {
    id: 'mobitz1', tryb: 'wenckebach', w: WARIANT0, dobra: 'mobitz1',
    dlaczego: 'PQ rośnie <b>0,16 → 0,28 → 0,36 s</b>, potem P bez QRS, a po pauzie PQ wraca do 0,16 s. Na cztery P przypadają trzy QRS (4:3), pauza 1,40 s jest krótsza niż dwa P-P. To periodyka Wenckebacha.',
  },
  {
    id: 'mobitz2', tryb: 'mobitz2', w: WARIANT0, dobra: 'mobitz2',
    dlaczego: '<b>PQ jest stałe, 0,16 s</b>, przed zablokowanym P i po nim. P-P 0,80 s się nie zmienia, a pauza trwa 1,60 s, dokładnie dwa razy dłużej niż RR. QRS jest szeroki. To Mobitz II, groźny blok podwęzłowy.',
  },
  {
    id: '2:1', tryb: '2:1', w: WARIANT0, dobra: '2:1',
    dlaczego: 'Wygląda na bradykardię zatokową 40/min, ale co drugi P <b>chowa się w końcówce T</b>. Przenieś cyrklem odstęp P-P: przedsionki pracują 80/min, komory 40/min. To blok 2:1. Bez dwóch kolejnych PQ nie rozstrzygniesz, czy to Mobitz I, czy II.',
  },
  {
    id: 'zaawansowany', tryb: 'zaawansowany', w: WARIANT0, dobra: 'zaawansowany',
    dlaczego: 'Przedsionki 90/min, komory 30/min: jeden P wywołuje QRS z powtarzalnym PQ, a <b>dwa kolejne</b> pozostają bez odpowiedzi komór. To blok zaawansowany 3:1. Część impulsów wciąż przechodzi, więc to jeszcze nie blok całkowity.',
  },
  {
    id: 'iii', tryb: 'iii', w: WARIANT0, dobra: 'iii',
    dlaczego: 'P-P 0,80 s (75/min), R-R 2 s (30/min), a <b>odległość P od QRS zmienia się z cyklu na cykl</b>. P raz stoi przed QRS, raz chowa się w T. Żaden P nie przewodzi się do komór. To blok całkowity z szerokim, wolnym rytmem zastępczym.',
  },
];

/** Opcja dyrektywy `tryb=` → stan startowy. */
export function trybZOpcji(v: string | undefined): Tryb | 'cwiczenie' {
  if (v === 'cwiczenie') return 'cwiczenie';
  return (TRYBY as readonly string[]).includes(v ?? '') ? (v as Tryb) : 'wenckebach';
}
