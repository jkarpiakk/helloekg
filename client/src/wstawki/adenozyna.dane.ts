/**
 * Co kryje się za wąskim częstoskurczem: czysta logika bez DOM.
 *
 * Wąski, miarowy częstoskurcz i jego odpowiedź na przejściowe zwolnienie przewodzenia przez węzeł AV
 * (próba Valsalvy, adenozyna). Zjawiska wyłącznie w zakresie opisanym w S6_03 i S6_01:
 * AVNRT i ortodromowy AVRT się urywają, trzepotanie odsłania fale F, w częstoskurczu przedsionkowym
 * P biegną dalej. Tachykardia zatokowa: tekst nie opisuje odpowiedzi, więc jej nie pokazujemy.
 *
 * Czasy działania (opóźnienie, czas trwania) i tempo częstoskurczów w zakresie 150-220/min to wartości
 * robocze modelu, nigdy podpisywane liczbą.
 */

export type Rytm = 'avnrt' | 'avrt' | 'trzepotanie' | 'przedsionkowy' | 'zatokowa';
export const RYTMY: readonly Rytm[] = ['avnrt', 'avrt', 'trzepotanie', 'przedsionkowy', 'zatokowa'];
export type Manewr = 'valsalva' | 'adenozyna';
export interface Interwencja { co: Manewr; at: number }

export type KsztaltP = 'normal' | 'retro' | 'retro-avnrt' | 'ectopic-low';

/**
 * Wsteczny P w AVNRT (własny kształt, czas od początku P). Szczyt wypada przy końcu QRS, a wektor ma
 * składową przednią: w V1 daje końcowy dodatni ząbek (pseudo-r′), w II pogłębia koniec QRS (pseudo-S).
 * Sprawdzone liczbowo w teście (V1 ≥ 0,05 mV przy końcu QRS).
 */
export const P_AVNRT: ReadonlyArray<{ t: number; w: number; v: readonly [number, number, number] }> = [{ t: 0.045, w: 0.02, v: [-0.03, -0.2, 0.09] }];
export type Zd =
  | { kind: 'P'; at: number; ksztalt: KsztaltP }
  | { kind: 'QRS'; at: number; typ: 'czestoskurcz' | 'zatokowy' };

/** Długość cyklu komór w częstoskurczu [s]. AVNRT/AVRT robocze (w zakresie 150-220/min). */
export const CYKL: Record<Rytm, number> = {
  avnrt: 60 / 170,
  avrt: 60 / 180,
  trzepotanie: 0.4, // 150/min (S6_03)
  przedsionkowy: 60 / 160, // tekst nie podaje częstości: bez podpisu
  zatokowa: 0.5, // 120/min (S6_03, przykład z gorączką)
};
/** Fale F trzepotania: 300/min. */
export const F_OKRES = 0.2;
/** Wsteczny P po początku QRS: AVNRT na końcu QRS (pseudo-S / pseudo-r′), AVRT oddzielnie za QRS. */
export const RP: Partial<Record<Rytm, number>> = { avnrt: 0.05, avrt: 0.09 };
/** PQ w rytmach z P przed QRS (robocze, bez podpisu). */
const PQ_AT = 0.14, PQ_ZAT = 0.16;
/** Rytm zatokowy po ustąpieniu napadu (robocze, bez podpisu). */
const PP_PO = 0.8;

/** Kiedy zaczyna działać i jak długo trwa zwolnienie przewodzenia AV [s] — skrócone, bez podpisu. */
export const CZAS: Record<Manewr, { start: number; trwa: number; pauza: number }> = {
  valsalva: { start: 1.2, trwa: 3.0, pauza: 0.9 },
  adenozyna: { start: 2.0, trwa: 3.6, pauza: 1.5 },
};
/**
 * Okno przymkniętej bramy AV. Przy pętli przez węzeł (AVNRT, AVRT) kończy się z powrotem rytmu zatokowego,
 * żeby żadne pobudzenie zatokowe nie przechodziło przez „zamkniętą” bramę.
 */
export const okno = (iv: Interwencja, r: Rytm): [number, number] => {
  const c = CZAS[iv.co], e0 = iv.at + c.start;
  return [e0, e0 + (r === 'avnrt' || r === 'avrt' ? c.pauza : c.trwa)];
};

/** Czy tekst opisuje odpowiedź tego rytmu na zwolnienie przewodzenia AV. */
export const maOpisOdpowiedzi = (r: Rytm): boolean => r !== 'zatokowa';
/** Pętla przechodzi przez węzeł AV (przejściowe zwolnienie węzła ją przerywa). */
export const petlaPrzezWezel = (r: Rytm): boolean => r === 'avnrt' || r === 'avrt';

/** Chwila urwania się częstoskurczu (AVNRT, AVRT) albo Infinity. */
export function koniecNapadu(r: Rytm, iv: Interwencja | null): number {
  if (!iv || !petlaPrzezWezel(r)) return Infinity;
  return okno(iv, r)[0];
}

/**
 * Zdarzenia w oknie [t0, t1). Czysta funkcja czasu bezwzględnego: te same argumenty dają te same zdarzenia,
 * więc pasek można dopisywać kawałkami i odtworzyć wydruk z dowolnej chwili.
 */
export function zdarzenia(r: Rytm, iv: Interwencja | null, t0: number, t1: number): Zd[] {
  const out: Zd[] = [];
  const push = (e: Zd) => { if (e.at >= t0 && e.at < t1) out.push(e); };
  const ivOk = iv && maOpisOdpowiedzi(r) ? iv : null;
  const [e0, e1] = ivOk ? okno(ivOk, r) : [Infinity, Infinity];

  if (petlaPrzezWezel(r)) {
    const cl = CYKL[r], rp = RP[r] ?? 0;
    const stop = koniecNapadu(r, ivOk);
    for (let n = Math.floor((t0 - 0.2) / cl); n * cl < Math.min(t1, stop); n++) {
      const a = n * cl;
      if (a >= stop) break;
      push({ kind: 'QRS', at: a, typ: 'czestoskurcz' });
      push({ kind: 'P', at: a + rp, ksztalt: r === 'avnrt' ? 'retro-avnrt' : 'retro' });
    }
    if (ivOk && stop < t1) {
      const s0 = stop + CZAS[ivOk.co].pauza;
      for (let j = Math.max(0, Math.floor((t0 - s0 - 0.3) / PP_PO)); s0 + j * PP_PO < t1; j++) {
        const p = s0 + j * PP_PO;
        push({ kind: 'P', at: p, ksztalt: 'normal' });
        push({ kind: 'QRS', at: p + PQ_ZAT, typ: 'zatokowy' });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }

  if (r === 'trzepotanie') {
    // QRS po co drugiej fali F; w oknie działania mniej impulsów przechodzi przez bramę
    for (let n = Math.floor((t0 - 0.2) / F_OKRES); n * F_OKRES < t1; n++) {
      if (n % 2 !== 0) continue;
      const at = n * F_OKRES + 0.08;
      if (at >= e0 && at < e1) {
        const k = (at - e0) / (e1 - e0);
        if (ivOk?.co === 'adenozyna' && k < 0.55) continue;
        if (((n % 4) + 4) % 4 !== 0) continue;
      }
      push({ kind: 'QRS', at, typ: 'czestoskurcz' });
    }
    return out;
  }

  const pp = CYKL[r];
  const ksztalt: KsztaltP = r === 'przedsionkowy' ? 'ectopic-low' : 'normal';
  const pq = r === 'przedsionkowy' ? PQ_AT : PQ_ZAT;
  for (let n = Math.floor((t0 - 0.3) / pp); n * pp < t1; n++) {
    const p = n * pp;
    push({ kind: 'P', at: p, ksztalt });
    let przewodzi = true;
    if (p >= e0 && p < e1) {
      const k = (p - e0) / (e1 - e0);
      przewodzi = ivOk?.co === 'adenozyna' && k < 0.5 ? false : ((n % 2) + 2) % 2 === 0;
    }
    if (przewodzi) push({ kind: 'QRS', at: p + pq, typ: 'czestoskurcz' });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Tło fali F (tylko trzepotanie). */
export const maFaleF = (r: Rytm): boolean => r === 'trzepotanie';

export type Faza = 'trwa' | 'brama' | 'ustapil';
/** Co dzieje się w chwili t: częstoskurcz trwa, brama AV przymknięta, napad ustąpił. */
export function faza(r: Rytm, iv: Interwencja | null, t: number): Faza {
  if (!iv || !maOpisOdpowiedzi(r)) return 'trwa';
  if (t >= koniecNapadu(r, iv)) return 'ustapil';
  const [e0, e1] = okno(iv, r);
  return t >= e0 && t < e1 ? 'brama' : 'trwa';
}

/* ─────────── scena z rastra marki ─────────── */

/** Klucze `OBRAZY` z core/obrazy.ts (tu jako napisy, żeby plik był bez DOM). */
export type Scena = 'bramaOtwarta' | 'bramaUchylona' | 'bramaZamknieta' | 'bramaSkrot' | 'orkiestraGra';

/** Podpisy scen: dosłowne fragmenty S6_03, ≤ 8 słów (cytaty w karcie). */
export const PODPIS = {
  zatokowa: 'dyrygent, węzeł zatokowy, po prostu wybija szybsze tempo',
  avnrt: 'pętla mieści się w samym węźle',
  avrt: 'tylne wejście, które omija bramę AV',
  trzepotanie: 'wpuszcza do komór co drugi impuls',
  przedsionkowy: 'wychodzić z jednego miejsca w przedsionku',
  valsalva: 'odźwierny przymyka bramę AV',
  adenozyna: 'Lek na kilka chwil zamyka bramę AV',
  ustapil: 'pętla pęka i napad się kończy',
} as const;

/** Scena w chwili t: brama otwarta → przymknięta/zamknięta na chwilę → otwarta; skrót w murze przy AVRT. */
export function scena(r: Rytm, iv: Interwencja | null, t: number): { scena: Scena; podpis: string } {
  if (r === 'zatokowa') return { scena: 'orkiestraGra', podpis: PODPIS.zatokowa };
  const baza: Scena = r === 'avrt' ? 'bramaSkrot' : 'bramaOtwarta';
  if (iv) {
    const [e0, e1] = okno(iv, r);
    if (t >= e0 && t < e1) return iv.co === 'adenozyna' ? { scena: 'bramaZamknieta', podpis: PODPIS.adenozyna } : { scena: 'bramaUchylona', podpis: PODPIS.valsalva };
    if (faza(r, iv, t) === 'ustapil') return { scena: baza, podpis: PODPIS.ustapil };
  }
  return { scena: baza, podpis: PODPIS[r] };
}

/* ─────────── teksty ─────────── */

export interface OpisRytmu { nazwa: string; krotka: string; tekst: string; tagi: Array<[string, string]>; hr: string }

export const OPIS: Record<Rytm, OpisRytmu> = {
  avnrt: {
    nazwa: 'AVNRT', krotka: 'AVNRT',
    tekst: 'Pętla mieści się w samym węźle AV i jego otoczeniu. Impuls schodzi do komór drogą wolną, a wraca drogą szybką. Przedsionki i komory pobudzają się niemal równocześnie, więc P najczęściej ginie w QRS.',
    tagi: [['częstość', '150-220/min'], ['P', 'w QRS'], ['II', 'pseudo-S'], ['V1', 'pseudo-r′']],
    hr: '150-220/min',
  },
  avrt: {
    nazwa: 'Ortodromowy AVRT', krotka: 'AVRT',
    tekst: 'Pętla jest większa. Impuls schodzi do komór przez węzeł AV i układ Hisa-Purkinjego, więc QRS jest wąski. Do przedsionków wraca dodatkową drogą. Ta podróż trwa dłużej, więc wsteczny P częściej widać oddzielnie, za QRS.',
    tagi: [['częstość', '150-220/min'], ['P', 'wsteczny, za QRS'], ['QRS', 'wąski']],
    hr: '150-220/min',
  },
  trzepotanie: {
    nazwa: 'Trzepotanie przedsionków 2:1', krotka: 'trzepotanie 2:1',
    tekst: 'Pobudzenie krąży jak bolid po dużym torze w prawym przedsionku. Przedsionki pobudzają się około 300/min, a odźwierny w bramie AV wpuszcza do komór co drugi impuls. Jedna fala chowa się w QRS albo w T.',
    tagi: [['komory', 'ok. 150/min'], ['RR', '0,40 s'], ['fale F', 'ok. 300/min'], ['II', 'zęby piły ujemne']],
    hr: 'komory ok. 150/min',
  },
  przedsionkowy: {
    nazwa: 'Ogniskowy częstoskurcz przedsionkowy', krotka: 'częstoskurcz przedsionkowy',
    tekst: 'Jeden z muzyków przejął batutę i gra szybciej niż dyrygent. P ma inny kształt niż w rytmie zatokowym, a między kolejnymi P znajdziesz odcinki linii izoelektrycznej, także w obrębie T.',
    tagi: [['P', 'inny kształt'], ['między P', 'linia izoelektryczna'], ['QRS', 'wąski']],
    hr: '', // wykład nie podaje częstości, więc pasek HR zostaje pusty
  },
  zatokowa: {
    nazwa: 'Tachykardia zatokowa', krotka: 'tachykardia zatokowa',
    tekst: 'Dyrygent, węzeł zatokowy, po prostu wybija szybsze tempo. P jest dodatni w II i stoi przed każdym QRS. Częstość zwykle stopniowo narasta i opada. To zwykle odpowiedź na coś, więc leczysz przyczynę, nie zapis.',
    tagi: [['częstość', '120/min'], ['P', 'dodatni w II, przed QRS'], ['próg', 'powyżej 100/min']],
    hr: '120/min',
  },
};

/** Co widać po zwolnieniu przewodzenia AV (z tekstu S6_03). */
export function odpowiedz(r: Rytm, m: Manewr): { tytul: string; tekst: string; uwaga?: string } {
  if (r === 'zatokowa') return {
    tytul: 'Tu szukasz przyczyny',
    tekst: 'Przy tachykardii zatokowej wstawka nie pokazuje próby Valsalvy ani adenozyny, bo wykład tego nie opisuje. Szukaj przyczyny przyspieszenia.',
  };
  const wstep = m === 'valsalva'
    ? 'Odruchowo rośnie napięcie nerwu błędnego i odźwierny przymyka bramę AV.'
    : 'Adenozyna na kilka chwil zamyka bramę AV.';
  if (petlaPrzezWezel(r)) return {
    tytul: 'Napad urwał się nagle',
    tekst: `${wstep} Węzeł jest częścią pętli, więc pętla pęka i napad się kończy. Potem wraca rytm zatokowy.`,
    uwaga: m === 'adenozyna'
      ? 'Niektóre ogniskowe częstoskurcze przedsionkowe też ustępują po adenozynie, więc samo zakończenie napadu nie dowodzi AVNRT ani AVRT.'
      : 'Próba Valsalvy nie zawsze się udaje. Gdy zawiedzie, lekarz może podać adenozynę.',
  };
  if (r === 'trzepotanie') return {
    tytul: 'Komory zwolniły, piła zostaje',
    tekst: m === 'adenozyna'
      ? `${wstep} W trzepotaniu adenozyna najczęściej tylko zmniejsza liczbę impulsów docierających do komór i na moment odsłania piłę fal przedsionkowych. Arytmia trwa dalej.`
      : `${wstep} Przy trzepotaniu zwolnienie węzła zwykle odsłania fale przedsionkowe, nie przerywając arytmii.`,
  };
  return {
    tytul: 'Komory zwolniły, P biegną dalej',
    tekst: `${wstep} Część impulsów nie przechodzi do komór, a P dalej powtarzają się we własnym rytmie: zwolnienie odsłoniło aktywność przedsionków.`,
    uwaga: m === 'adenozyna' ? 'Niektóre ogniskowe częstoskurcze przedsionkowe po adenozynie ustępują, więc samo zakończenie napadu nie dowodzi AVNRT ani AVRT.' : undefined,
  };
}

/* ─────────── ćwiczenie ─────────── */

export type Odp = 'avnrt' | 'avrt' | 'trzepotanie' | 'przedsionkowy';
export const OPCJE: ReadonlyArray<{ v: Odp; label: string }> = [
  { v: 'avnrt', label: 'Napad się urwał, P ginęło w QRS: najpewniej AVNRT' },
  { v: 'avrt', label: 'Napad się urwał, P stał za QRS: najpewniej ortodromowy AVRT' },
  { v: 'trzepotanie', label: 'Komory zwolniły, widać zęby piły: trzepotanie przedsionków' },
  { v: 'przedsionkowy', label: 'Komory zwolniły, P biegną dalej: częstoskurcz przedsionkowy' },
];

export interface Zadanie { id: string; rytm: Odp; co: Manewr; dlaczego: string }

export const ZADANIA: readonly Zadanie[] = [
  {
    id: 'avnrt-adenozyna', rytm: 'avnrt', co: 'adenozyna',
    dlaczego: 'Po adenozynie napad <b>urwał się nagle</b> i wrócił rytm zatokowy. W częstoskurczu P ginęło w QRS, zostawiając tylko rąbek na końcu zespołu (pseudo-S w II, pseudo-r′ w V1). To pasuje do AVNRT. Samo zakończenie napadu nie dowodzi jednak AVNRT ani AVRT, bo niektóre ogniskowe częstoskurcze przedsionkowe też ustępują po adenozynie.',
  },
  {
    id: 'avrt-valsalva', rytm: 'avrt', co: 'valsalva',
    dlaczego: 'Próba Valsalvy przymknęła bramę AV, pętla pękła i napad się skończył. W częstoskurczu <b>wsteczny P stał oddzielnie za QRS</b>, bo powrót dodatkową drogą trwa dłużej. To pasuje do ortodromowego AVRT.',
  },
  {
    id: 'trzepotanie-adenozyna', rytm: 'trzepotanie', co: 'adenozyna',
    dlaczego: 'Adenozyna zmniejszyła liczbę impulsów docierających do komór i <b>na moment odsłoniła piłę</b> fal przedsionkowych około 300/min. Arytmia trwa dalej, a komory wracają do około 150/min. Przy każdym „miarowym 150” szukaj zębów piły.',
  },
  {
    id: 'przedsionkowy-adenozyna', rytm: 'przedsionkowy', co: 'adenozyna',
    dlaczego: 'Komory na chwilę zwolniły, a <b>P o innym kształcie biegły dalej</b> we własnym rytmie, z linią izoelektryczną między nimi. To ogniskowy częstoskurcz przedsionkowy.',
  },
  {
    id: 'trzepotanie-valsalva', rytm: 'trzepotanie', co: 'valsalva',
    dlaczego: 'Odźwierny przymknął bramę i przez chwilę przepuszczał mniej impulsów. W przerwach między QRS widać <b>regularne zęby piły</b>, ujemne w II. Zwolnienie węzła zwykle odsłania fale przedsionkowe, nie przerywając trzepotania.',
  },
];

export function rytmZOpcji(v: string | undefined): Rytm {
  return (RYTMY as readonly string[]).includes(v ?? '') ? (v as Rytm) : 'avnrt';
}
