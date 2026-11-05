/**
 * Logika wstawki „Fala na rondzie” bez DOM: pierścień komórek, każda z własną refrakcją.
 * Fala wchodzi do kolejnej komórki albo gaśnie, gdy ta jest jeszcze niepobudliwa. Gaśnięcie na własnym
 * ogonie, zderzenie dwóch fal i trwały obieg wynikają z tej jednej reguły, nie ze skryptu.
 *
 * Komórka 0 to górny koniec obu dróg, N/2 dolny. Lewa droga: komórki 1…N/2−1, prawa: N/2+1…N−1.
 * Kierunek +1 biegnie w dół lewą drogą i w górę prawą, czyli przeciwnie do ruchu wskazówek zegara,
 * jak na polskim rondzie. Czasy w sekundach.
 */

export const N = 240;
export const GORA = 0;
export const DOL = N / 2;

export interface Uklad {
  /** Czas przejazdu lewą i prawą drogą [s]; ich suma to czas okrążenia. */
  lewa: number;
  prawa: number;
  /** Refrakcja komórek lewej i prawej drogi [s]; oba końce mają refrakcję lewej. */
  rLewa: number;
  rPrawa: number;
  /** Blok jednokierunkowy: szlaban przy wjeździe w prawą drogę, powrót tą drogą przechodzi. */
  szlaban?: boolean;
  /** Tylko lewa droga: fala kończy jazdę na dolnym końcu. */
  jednaDroga?: boolean;
}

/** Rondo o jednakowych właściwościach: czas okrążenia T i refrakcja R. */
export const jednolite = (T: number, R: number, o: Pick<Uklad, 'szlaban' | 'jednaDroga'> = {}): Uklad => ({ lewa: T / 2, prawa: T / 2, rLewa: R, rPrawa: R, ...o });

export type Zdarzenie =
  | { typ: 'gora' | 'dol'; at: number; kierunek: 1 | -1 }
  | { typ: 'gasnie'; at: number; i: number }
  | { typ: 'szlaban'; at: number }
  | { typ: 'odmowa'; at: number }
  | { typ: 'koniec'; at: number };

interface Front { i: number; kierunek: 1 | -1; nast: number }

export class Rondo {
  readonly uklad: Uklad;
  private ostatnio = new Float64Array(N).fill(-Infinity);
  private refrakcja = new Float64Array(N);
  private fronty: Front[] = [];
  /** Zdarzenia, których jeszcze nikt nie odebrał. */
  private kolejka: Zdarzenie[] = [];
  czas = 0;

  constructor(u: Uklad) {
    this.uklad = u;
    for (let i = 0; i < N; i++) this.refrakcja[i] = i <= DOL ? u.rLewa : u.rPrawa;
  }

  /** Czas przejścia do komórki `c`. */
  private krok(c: number): number {
    return (c >= 1 && c <= DOL ? this.uklad.lewa : this.uklad.prawa) / (N / 2);
  }
  zamknieta(i: number, t: number): boolean {
    return t - this.ostatnio[i]! < this.refrakcja[i]! - 1e-9;
  }
  private ruszaj(i: number, kierunek: 1 | -1, t: number): void {
    const c = (i + kierunek + N) % N;
    if (this.zamknieta(c, t)) { this.kolejka.push({ typ: 'gasnie', at: t, i: c }); return; }
    this.fronty.push({ i, kierunek, nast: t + this.krok(c) });
  }

  /**
   * Impuls na górnym końcu obu dróg. `tylkoLewa` to fala puszczona w jednym kierunku.
   * Zwraca false, gdy górny koniec jest jeszcze niepobudliwy.
   */
  bodziec(t: number, o: { tylkoLewa?: boolean } = {}): boolean {
    this.doCzasu(t);
    if (this.zamknieta(GORA, t)) { this.kolejka.push({ typ: 'odmowa', at: t }); return false; }
    this.ostatnio[GORA] = t;
    this.ruszaj(GORA, 1, t);
    if (this.uklad.szlaban) this.kolejka.push({ typ: 'szlaban', at: t });
    else if (this.zamknieta(N - 1, t)) this.kolejka.push({ typ: 'szlaban', at: t });
    else if (!this.uklad.jednaDroga && !o.tylkoLewa) this.ruszaj(GORA, -1, t);
    return true;
  }

  /** Przesuwa fale do chwili `t`, zdarzenie po zdarzeniu, w porządku czasu. */
  doCzasu(t: number): void {
    for (;;) {
      let f: Front | null = null;
      for (const x of this.fronty) if (x.nast <= t && (!f || x.nast < f.nast)) f = x;
      if (!f) break;
      const c = (f.i + f.kierunek + N) % N;
      const at = f.nast;
      if (this.uklad.jednaDroga && c > DOL) { this.usun(f); this.kolejka.push({ typ: 'koniec', at }); continue; }
      if (this.zamknieta(c, at)) { this.usun(f); this.kolejka.push({ typ: 'gasnie', at, i: c }); continue; }
      this.ostatnio[c] = at;
      f.i = c;
      if (c === DOL) this.kolejka.push({ typ: 'dol', at, kierunek: f.kierunek });
      if (c === GORA) this.kolejka.push({ typ: 'gora', at, kierunek: f.kierunek });
      f.nast = at + this.krok((c + f.kierunek + N) % N);
    }
    this.czas = t;
  }
  private usun(f: Front): void { this.fronty.splice(this.fronty.indexOf(f), 1); }

  /** Odbiera zdarzenia od ostatniego wywołania. */
  odbierz(): Zdarzenie[] { const z = this.kolejka; this.kolejka = []; return z; }

  /** Czoła fal jako ułamek okrążenia (0 = góra, rośnie w dół lewą drogą) z kierunkiem. */
  czola(t: number): Array<{ u: number; kierunek: 1 | -1 }> {
    return this.fronty.map((f) => {
      const c = (f.i + f.kierunek + N) % N;
      const czesc = 1 - (f.nast - t) / this.krok(c);
      return { u: (((f.i + f.kierunek * Math.max(0, Math.min(1, czesc))) / N) % 1 + 1) % 1, kierunek: f.kierunek };
    });
  }

  /** Spójne odcinki w refrakcji jako [od, do] w ułamkach okrążenia, w kierunku +1; `do` może przekroczyć 1. */
  odcinkiZamkniete(t: number): Array<[number, number]> {
    const z = (i: number) => this.zamknieta(i, t);
    let start = -1;
    for (let i = 0; i < N; i++) if (!z(i)) { start = i; break; }
    if (start < 0) return [[0, 1]];
    const out: Array<[number, number]> = [];
    let od = -1;
    for (let k = 1; k <= N; k++) {
      const i = (start + k) % N;
      if (z(i)) { if (od < 0) od = start + k; } else if (od >= 0) { out.push([od / N, (start + k) / N]); od = -1; }
    }
    return out;
  }
  zywe(): number { return this.fronty.length; }
}

export type Wynik = 'obieg' | 'ogon' | 'zderzenie' | 'wyjazd';

/** Czym kończy się bodziec w danym układzie (fala widziana przez `horyzont` sekund). */
export function wynik(r: Rondo, odT: number, horyzont = 3): Wynik {
  r.doCzasu(odT + horyzont);
  if (r.zywe() > 0) return 'obieg';
  const gasnie = r.odbierz().filter((z) => z.typ === 'gasnie').length;
  return gasnie >= 2 ? 'zderzenie' : gasnie === 1 ? 'ogon' : 'wyjazd';
}

/* ─────────── etap „Fala i ogon”: liczby z wykładu ─────────── */

/** Odcinek właśnie pobudzony pozostaje niepobudliwy przez 250 ms. */
export const REFRAKCJA = 0.25;
export const POWROTY = { szybki: 0.2, wolny: 0.3 } as const;
export type Powrot = keyof typeof POWROTY;

/* ─────────── etap „Trzy warunki” ─────────── */

export type Warunek = 'wszystkie' | 'bez-drogi' | 'bez-bloku' | 'krotki';

export const WARUNKI: Record<Warunek, { label: string; uklad: Uklad; tekst: string }> = {
  wszystkie: {
    label: 'Wszystkie trzy', uklad: jednolite(POWROTY.wolny, REFRAKCJA, { szlaban: true }),
    tekst: 'Szlaban jest opuszczony, gdy podjeżdżasz, więc fala wchodzi tylko do jednej drogi. Wraca drugą drogą z przeciwnej strony. Szlaban jest podniesiony, a czas obiegu dłuższy niż refrakcja, więc obieg trwa.',
  },
  'bez-drogi': {
    label: 'Bez drugiej drogi', uklad: jednolite(POWROTY.wolny, REFRAKCJA, { jednaDroga: true }),
    tekst: 'Rondo tworzą dwie drogi połączone na obu końcach. Przy jednej drodze impuls przejeżdża i nie ma którędy wrócić.',
  },
  'bez-bloku': {
    label: 'Bez bloku', uklad: jednolite(POWROTY.wolny, REFRAKCJA),
    tekst: 'Dwie drogi bez bloku nie wystarczą: pobudzenie przechodzi obiema, a dwie fale zderzają się i gasną na tkance świeżo pobudzonej przez drugą.',
  },
  krotki: {
    label: 'Obieg krótszy niż refrakcja', uklad: jednolite(POWROTY.szybki, REFRAKCJA, { szlaban: true }),
    tekst: 'Szybkie przewodzenie w krótkim obwodzie też nie zadziała, jeśli fala wjedzie we własny ogon: wraca po 200 ms, a pas jest zamknięty przez 250 ms. To przykładowe czasy.',
  },
};

/* ─────────── etap „Zapalnik”: typowy AVNRT ─────────── */

/**
 * Kształt zjawiska z planszy, liczby poglądowe (tekst ich nie podaje, kursant ich nie widzi): droga wolna
 * po lewej, szybka po prawej, szybka ma dłuższą refrakcję. Okrążenie 0,40 s to 150/min, dolna granica
 * AVNRT z S6_03; rytm podstawowy 0,8 s to 75/min. Z tych czasów wynika okno, w którym bodziec otwiera rondo.
 */
export const AVNRT: Uklad = { lewa: 0.3, prawa: 0.1, rLewa: 0.2, rPrawa: 0.38 };
export const CYKL = 0.8;
/** Od dołu ronda do początku QRS: fala schodzi do komór, a wstecznie zdąża do przedsionków 0,04 s po QRS. */
export const DO_KOMOR = 0.06;

export type StanDrog = 'obie-zamkniete' | 'okno' | 'obie-otwarte';

/** Stan dróg w chwili nadejścia bodźca: wolna to pierwsza komórka lewej, szybka pierwsza komórka prawej. */
export function stanDrog(r: Rondo, t: number): StanDrog {
  const wolna = !r.zamknieta(GORA, t) && !r.zamknieta(1, t);
  const szybka = !r.zamknieta(N - 1, t);
  return !wolna ? 'obie-zamkniete' : szybka ? 'obie-otwarte' : 'okno';
}

/* ─────────── ćwiczenie ─────────── */

export const ODPOWIEDZI: ReadonlyArray<{ v: Wynik; label: string }> = [
  { v: 'obieg', label: 'Fala okrąża rondo i obieg trwa' },
  { v: 'ogon', label: 'Fala wjeżdża we własny ogon i gaśnie' },
  { v: 'zderzenie', label: 'Dwie fale zderzają się i gasną' },
];

export interface Zadanie {
  id: string;
  polecenie: string;
  uklad: Uklad;
  /** Bodziec w chwili `zaplon` po pobudzeniu rytmu podstawowego (etap „Zapalnik”). */
  zaplon?: number;
  tylkoLewa?: boolean;
  /** Pokazywane czasy: [czas powrotu, refrakcja] w ms. */
  czasy?: [number, number];
  dlaczego: string;
}

export const ZADANIA: Zadanie[] = [
  {
    id: 'powrot-300', tylkoLewa: true, uklad: jednolite(0.3, 0.25), czasy: [300, 250],
    polecenie: 'Przykładowe czasy: odcinek właśnie pobudzony pozostaje niepobudliwy przez 250 ms, a fala wraca po 300 ms. Co się stanie?',
    dlaczego: 'Fala, która wróci po 300 ms, zastanie tkankę gotową i rozpocznie następny obieg.',
  },
  {
    id: 'powrot-200', tylkoLewa: true, uklad: jednolite(0.2, 0.25), czasy: [200, 250],
    polecenie: 'Przykładowe czasy: odcinek właśnie pobudzony pozostaje niepobudliwy przez 250 ms, a fala wraca po 200 ms. Co się stanie?',
    dlaczego: 'Fala, która wróci po 200 ms, zgaśnie: dogoniła własny ogon za wcześnie.',
  },
  {
    id: 'okrazenie-200', tylkoLewa: true, uklad: jednolite(0.25, 0.2), czasy: [250, 200],
    polecenie: 'Przykładowe czasy: pełne okrążenie trwa 250 ms, a tkanka w danym punkcie odzyskuje pobudliwość po 200 ms. Co się stanie?',
    dlaczego: 'Tkanka jest gotowa przed powrotem fali, więc powracająca fala może ją pobudzić ponownie.',
  },
  {
    id: 'okrazenie-280', tylkoLewa: true, uklad: jednolite(0.25, 0.28), czasy: [250, 280],
    polecenie: 'Przykładowe czasy: okrążenie trwa 250 ms, a refrakcja w danym punkcie wydłuża się do 280 ms. Co się stanie?',
    dlaczego: 'Fala wraca na tkankę jeszcze niepobudliwą i gaśnie. Zmiana właściwości elektrycznych mięśnia może zatrzymać krążenie bez żadnej zmiany anatomii.',
  },
  {
    id: 'bez-bloku', uklad: WARUNKI['bez-bloku'].uklad,
    polecenie: 'Masz dwie drogi połączone na obu końcach, ale bez bloku jednokierunkowego. Impuls dochodzi do ich wspólnego początku. Co się stanie?',
    dlaczego: 'Pobudzenie przechodzi obiema drogami, a dwie fale zderzają się i gasną na tkance świeżo pobudzonej przez drugą.',
  },
  {
    id: 'trzy-warunki', uklad: WARUNKI.wszystkie.uklad,
    polecenie: 'Dwie drogi, opuszczony szlaban przy wjeździe do jednej z nich i czas obiegu dłuższy niż refrakcja. Co się stanie?',
    dlaczego: 'Spełnione są wszystkie trzy warunki: fala wchodzi jedną drogą, wraca drugą i rondo napędza się samo.',
  },
  {
    id: 'krotki-obwod', uklad: WARUNKI.krotki.uklad,
    polecenie: 'Dwie drogi i opuszczony szlaban, ale czas obiegu jest krótszy niż refrakcja. Co się stanie?',
    dlaczego: 'Blok nie wystarczy, gdy czas obiegu jest krótszy niż refrakcja: fala wjeżdża we własny ogon.',
  },
  {
    id: 'zapalnik-okno', uklad: AVNRT, zaplon: 0.28,
    polecenie: 'Pobudzenie przedwczesne przychodzi, gdy droga wolna odzyskała już pobudliwość, a szybka wciąż jest w refrakcji. Co się stanie?',
    dlaczego: 'Droga szybka ma dłuższą refrakcję. Impuls blokuje się w niej i schodzi wolną. Zanim dotrze do jej końca, szybka zdąży się otworzyć i fala wraca nią wstecznie.',
  },
  {
    id: 'zapalnik-pozno', uklad: AVNRT, zaplon: 0.55,
    polecenie: 'Pobudzenie przychodzi, gdy obie drogi odzyskały już pobudliwość. Co się stanie?',
    dlaczego: 'Bez bloku impuls przechodzi obiema drogami i fale się zderzają. O wszystkim decyduje chwila nadejścia impulsu.',
  },
];

/** Układa rondo w stanie zadania: tuż przed bodźcem, który kursant ma ocenić. */
export function przygotuj(z: Zadanie): { r: Rondo; t: number; odpal(): void } {
  const r = new Rondo(z.uklad);
  if (z.zaplon === undefined) return { r, t: 0, odpal: () => { r.bodziec(0, { tylkoLewa: z.tylkoLewa }); } };
  r.bodziec(0);
  r.doCzasu(z.zaplon);
  r.odbierz();
  return { r, t: z.zaplon, odpal: () => { r.bodziec(z.zaplon!); } };
}

/** Prawidłowa odpowiedź zadania wprost z modelu. */
export function odpowiedz(z: Zadanie): Wynik {
  const p = przygotuj(z);
  p.odpal();
  return wynik(p.r, p.t);
}
