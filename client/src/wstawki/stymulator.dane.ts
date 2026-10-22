/**
 * Logika wstawki „stymulator” bez DOM: zegar stymulatora (AAI, VVI, DDD, magnes), własny rytm pacjenta,
 * usterki z S5_03 i scenariusze ICD z S5_04. Wszystko liczone zdarzeniami w czasie bezwzględnym [s].
 *
 * Wartości pokazywane kursantowi (źródła w `stymulator.karta.ts`):
 *  - 60/min → 1 s, 75/min → 0,8 s, 30/min → 2 s (wzór 60/częstość),
 *  - opóźnienie AV 180 ms (S5_01, przykład ustawienia), PQ 0,16 s (S5_02),
 *  - czułość 1 mV / 2 mV wobec sygnału 1,5 mV (S5_03),
 *  - VT 180/min ≈ 0,33 s, ATP ≈ 0,28 s, 90/min liczone jako 180/min (S5_04).
 * Wartości wewnętrzne modelu (NIE pokazywane jako liczby): opóźnienie wykrycia, okresy refrakcji,
 * liczba pobudzeń do rozpoznania w ICD, granica strefy leczenia, liczba impulsów ATP.
 */

/* ─────────── wartości z tekstu ─────────── */

/** Odstęp między pobudzeniami przy danej częstości [s] (wzór 60/częstość). */
export const odstep = (naMin: number): number => 60 / naMin;
/** Częstość przy danym odstępie [/min]. */
export const czestosc = (s: number): number => 60 / s;

export const DOLNA_KANON = 60;
export const OPOZNIENIE_AV = 0.18;
export const PQ = 0.16;
export const ZASTEPCZY = 30;
export const SYGNAL_MV = 1.5;
export const CZULOSCI = [1, 2] as const;
export type Czulosc = (typeof CZULOSCI)[number];

/** Czy urządzenie wykryje sygnał: mniejsza liczba mV = lepszy słuch (S5_03). */
export const wykrywa = (sygnalMv: number, czuloscMv: number): boolean => sygnalMv >= czuloscMv;

export const VT_CZESTOSC = 180;
export const ATP_ODSTEP = 0.28;
/** Ile sygnałów policzy urządzenie przy danej częstości rzeczywistej, gdy liczy też załamek T (S5_04). */
export const liczonaCzestosc = (rzeczywista: number, liczyT: boolean): number => rzeczywista * (liczyT ? 2 : 1);
/** Kratki przy 25 mm/s: 1 s = 5 dużych kratek, 1 mała = 0,04 s. */
export const duzeKratki = (s: number): number => s / 0.2;
export const maleKratki = (s: number): number => s / 0.04;

/* ─────────── wartości wewnętrzne modelu ─────────── */

/** Wykrycie przez elektrodę następuje chwilę po początku pobudzenia w EKG. */
export const OPOZN_WYKRYCIA = 0.01;
/** Zdarzenia bliżej niż EPS traktujemy jako jednoczesne (błędy zaokrągleń nie mogą dać fałszywej iglicy). */
const EPS = 1e-6;
/** Komora po pobudzeniu nie odpowiada na impuls aż do końca T (w modelu bez zjawiska R na T). */
export const REFRAKCJA_V = 0.42;
export const REFRAKCJA_A = 0.25;

/* ─────────── typy ─────────── */

export type Tryb = 'AAI' | 'VVI' | 'DDD';
export type Jama = 'A' | 'V';

export interface Ustawienia {
  tryb: Tryb;
  /** Dolna częstość stymulacji [/min]. */
  dolna: number;
  /** Amplituda impulsu i próg wychwytu w jednostkach umownych (bez woltów: tekst nie podaje liczb). */
  amplituda: number;
  prog: number;
  czulosc: number;
  magnes: boolean;
  /** Usterka „brak stymulacji”: urządzenie liczy czas, ale impuls nie wychodzi. */
  brakImpulsu: boolean;
}

export interface Pacjent {
  /** Częstość rytmu zatokowego [/min]; 0 = brak załamków P. */
  zatoka: number;
  av: 'sprawne' | 'blok';
  /** Rytm zastępczy komór przy bloku [/min]; 0 = brak (pacjent zależny od stymulatora). */
  zastepczy: number;
  /** Okna potencjałów mięśniowych [od, do] w czasie bezwzględnym. */
  szum: Array<[number, number]>;
  /** Dodatkowe własne pobudzenia komór w podanych chwilach (do testów i przykładów). */
  wstrzykniete?: number[];
}

export type Zd =
  | { typ: 'P'; at: number; zrodlo: 'zatoka' | 'stym' }
  | { typ: 'QRS'; at: number; zrodlo: 'przewiedziony' | 'zastepczy' | 'wstrzykniety' | 'stym' }
  | { typ: 'iglica'; at: number; jama: Jama; wychwyt: boolean; /** impuls w okresie refrakcji: jama już pobudzona (nie brak wychwytu) */ refrakcja: boolean }
  | { typ: 'wykrycie'; at: number; jama: Jama; co: 'P' | 'QRS' | 'szum' }
  | { typ: 'pominiecie'; at: number; jama: Jama }
  | { typ: 'brak'; at: number; jama: Jama }
  | { typ: 'okno'; jama: 'A' | 'V' | 'AV'; od: number; do: number; koniec: 'iglica' | 'wykrycie' | 'szum' | 'brak' };

export interface OknoOtwarte { jama: 'A' | 'V' | 'AV'; od: number; planowo: number }

export const USTAWIENIA_KANON: Ustawienia = { tryb: 'VVI', dolna: DOLNA_KANON, amplituda: 0.7, prog: 0.4, czulosc: 1, magnes: false, brakImpulsu: false };
export const PACJENT_KANON: Pacjent = { zatoka: 50, av: 'sprawne', zastepczy: ZASTEPCZY, szum: [] };

/* ─────────── symulacja stymulatora ─────────── */

const INF = Number.POSITIVE_INFINITY;

/** Rytm szumu: kolejne „pobudzenia” rzekome w oknie potencjałów mięśniowych (nieregularnie, co ~0,2 s). */
function czasySzumu(od: number, doT: number): number[] {
  const out: number[] = [];
  let t = od + 0.08, k = 0;
  while (t < doT) { out.push(t); t += 0.17 + 0.09 * ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1; k++; }
  return out;
}

export class Stymulator {
  u: Ustawienia;
  p: Pacjent;
  t: number;
  private nextSinus: number;
  private pending: number[] = [];
  private lastVdep: number;
  private lastAdep: number;
  private vTimer: number;
  private aTimer: number;
  private avStart: number | null = null;
  private vSenseAt: number | null = null;
  private aSenseAt: number | null = null;
  private szumUzyte = new Set<number>();
  private wstrzUzyte = new Set<number>();
  /** Zdarzenia od ostatniego `odbierz()`. */
  private out: Zd[] = [];
  /** Wszystkie zdarzenia (do testów; przycinane przez `przytnij`). */
  historia: Zd[] = [];

  constructor(u: Ustawienia, p: Pacjent, t0 = 0) {
    this.u = { ...u }; this.p = { ...p, szum: [...p.szum] };
    this.t = t0;
    this.nextSinus = t0 + 0.35;
    this.lastVdep = t0 - 0.63; this.lastAdep = t0 - 0.63; // faza startowa bez przypadkowego zrównania rytmu zastępczego z impulsami
    this.vTimer = t0; this.aTimer = t0;
  }

  /** Okna odliczania, które trwają w tej chwili. */
  otwarte(): OknoOtwarte[] {
    const I = odstep(this.u.dolna), out: OknoOtwarte[] = [];
    const { tryb } = this.u;
    if (tryb === 'VVI') out.push({ jama: 'V', od: this.vTimer, planowo: this.vTimer + I });
    if (tryb === 'AAI' || tryb === 'DDD') out.push({ jama: 'A', od: this.aTimer, planowo: this.aTimer + I });
    if (tryb === 'DDD' && this.avStart !== null) out.push({ jama: 'AV', od: this.avStart, planowo: this.avStart + OPOZNIENIE_AV });
    return out;
  }

  odbierz(): Zd[] { const o = this.out; this.out = []; return o; }
  /** Zmiana trybu w trakcie zapisu: odliczanie zaczyna się od tej chwili. */
  zmienTryb(tryb: Tryb): void {
    this.u = { ...this.u, tryb };
    this.vTimer = this.t; this.aTimer = this.t; this.avStart = null; this.vSenseAt = null; this.aSenseAt = null;
  }
  przytnij(przed: number): void {
    let k = 0;
    while (k < this.historia.length) { const e = this.historia[k]!; const at = e.typ === 'okno' ? e.do : e.at; if (at >= przed) break; k++; }
    if (k > 0) this.historia.splice(0, k);
  }

  private emit(e: Zd): void { this.out.push(e); this.historia.push(e); }

  private get slyszyV(): boolean { return !this.u.magnes && (this.u.tryb === 'VVI' || this.u.tryb === 'DDD'); }
  private get slyszyA(): boolean { return !this.u.magnes && (this.u.tryb === 'AAI' || this.u.tryb === 'DDD'); }
  private get kanalSzumu(): Jama | null { if (this.u.magnes) return null; return this.u.tryb === 'AAI' ? 'A' : 'V'; }
  private get wychwytOk(): boolean { return this.u.amplituda > this.u.prog; }

  private nextSzum(): number {
    if (this.kanalSzumu === null) return INF;
    let best = INF;
    for (const [od, doT] of this.p.szum) for (const s of czasySzumu(od, doT)) if (s >= this.t - 1e-9 && !this.szumUzyte.has(s) && s < best) best = s;
    return best;
  }
  private nextWstrz(): number {
    let best = INF;
    for (const s of this.p.wstrzykniete ?? []) if (!this.wstrzUzyte.has(s) && s >= this.t - 1e-9 && s < best) best = s;
    return best;
  }

  private dueV(): number {
    const I = odstep(this.u.dolna);
    if (this.u.tryb === 'VVI') return this.vTimer + I;
    if (this.u.tryb === 'DDD' && this.avStart !== null) return this.avStart + OPOZNIENIE_AV;
    return INF;
  }
  private dueA(): number {
    if (this.u.tryb === 'VVI') return INF;
    return this.aTimer + odstep(this.u.dolna);
  }

  /** Dopisuje zdarzenia do chwili `until` włącznie. */
  advance(until: number): void {
    for (let guard = 0; guard < 10000; guard++) {
      const cands: Array<[number, number, () => void]> = [];
      const T = this.t;
      const c = (at: number, prio: number, f: () => void) => { if (at < INF) cands.push([Math.max(at, T), prio, f]); };
      // priorytet przy równym czasie: zjawiska serca (0) → wykrycie (1) → impuls (2)
      if (this.p.zatoka > 0) c(this.nextSinus, 0, () => this.sinusP());
      const pmin = this.pending.length ? Math.min(...this.pending) : INF;
      c(pmin, 0, () => this.przewiedziony(pmin));
      if (this.p.av === 'blok' && this.p.zastepczy > 0) c(this.lastVdep + odstep(this.p.zastepczy), 0, () => this.depV(this.t, 'zastepczy'));
      const w = this.nextWstrz();
      c(w, 0, () => { this.wstrzUzyte.add(w); this.depV(this.t, 'wstrzykniety'); });
      if (this.vSenseAt !== null) c(this.vSenseAt, 1, () => this.senseV());
      if (this.aSenseAt !== null) c(this.aSenseAt, 1, () => this.senseA());
      const sz = this.nextSzum();
      c(sz, 1, () => { this.szumUzyte.add(sz); this.szum(); });
      c(this.dueV(), 2, () => this.paceV());
      c(this.dueA(), 2, () => this.paceA());
      if (!cands.length) { this.t = until; return; }
      cands.sort((a, b) => (Math.abs(a[0] - b[0]) < EPS ? 0 : a[0] - b[0]) || a[1] - b[1]);
      const [at, , f] = cands[0]!;
      if (at > until) { this.t = until; return; }
      this.t = at;
      f();
    }
  }

  private sinusP(): void {
    const p = this.t;
    this.nextSinus = p + odstep(this.p.zatoka);
    if (p - this.lastAdep < REFRAKCJA_A) return;
    this.emit({ typ: 'P', at: p, zrodlo: 'zatoka' });
    this.lastAdep = p;
    if (this.p.av === 'sprawne') this.pending.push(p + PQ);
    if (this.slyszyA) this.aSenseAt = p + OPOZN_WYKRYCIA;
  }

  private przewiedziony(q: number): void {
    this.pending.splice(this.pending.indexOf(q), 1);
    if (q - this.lastVdep < REFRAKCJA_V) return; // komora jeszcze pobudzona: P bez QRS
    this.depV(q, 'przewiedziony');
  }

  private depV(q: number, zrodlo: 'przewiedziony' | 'zastepczy' | 'wstrzykniety'): void {
    if (q - this.lastVdep < REFRAKCJA_V) return;
    this.emit({ typ: 'QRS', at: q, zrodlo });
    this.lastVdep = q;
    if (this.slyszyV) {
      if (wykrywa(SYGNAL_MV, this.u.czulosc)) this.vSenseAt = q + OPOZN_WYKRYCIA;
      else this.emit({ typ: 'pominiecie', at: q + OPOZN_WYKRYCIA, jama: 'V' });
    }
  }

  private senseV(): void {
    const s = this.t;
    this.vSenseAt = null;
    if (!this.slyszyV) return;
    this.emit({ typ: 'wykrycie', at: s, jama: 'V', co: 'QRS' });
    this.restartV(s, 'wykrycie');
  }
  private restartV(s: number, koniec: 'wykrycie' | 'szum'): void {
    if (this.u.tryb === 'VVI') { this.emit({ typ: 'okno', jama: 'V', od: this.vTimer, do: s, koniec }); this.vTimer = s; }
    if (this.u.tryb === 'DDD' && this.avStart !== null) { this.emit({ typ: 'okno', jama: 'AV', od: this.avStart, do: s, koniec }); this.avStart = null; }
  }

  private senseA(): void {
    const s = this.t;
    this.aSenseAt = null;
    if (!this.slyszyA) return;
    this.emit({ typ: 'wykrycie', at: s, jama: 'A', co: 'P' });
    this.restartA(s, 'wykrycie');
    if (this.u.tryb === 'DDD') this.avStart = s;
  }
  private restartA(s: number, koniec: 'wykrycie' | 'szum' | 'iglica' | 'brak'): void {
    this.emit({ typ: 'okno', jama: 'A', od: this.aTimer, do: s, koniec });
    this.aTimer = s;
  }

  private szum(): void {
    const s = this.t, k = this.kanalSzumu;
    if (k === null) return;
    this.emit({ typ: 'wykrycie', at: s, jama: k, co: 'szum' });
    if (k === 'A') this.restartA(s, 'szum'); else this.restartV(s, 'szum');
  }

  private paceV(): void {
    const s = this.t;
    const koniec = this.u.brakImpulsu ? 'brak' : 'iglica';
    if (this.u.tryb === 'VVI') { this.emit({ typ: 'okno', jama: 'V', od: this.vTimer, do: s, koniec }); this.vTimer = s; }
    else if (this.avStart !== null) { this.emit({ typ: 'okno', jama: 'AV', od: this.avStart, do: s, koniec }); this.avStart = null; }
    if (this.u.brakImpulsu) { this.emit({ typ: 'brak', at: s, jama: 'V' }); return; }
    const refrakcja = s - this.lastVdep < REFRAKCJA_V;
    const wychwyt = this.wychwytOk && !refrakcja;
    this.emit({ typ: 'iglica', at: s, jama: 'V', wychwyt, refrakcja });
    this.vSenseAt = null; // po własnym impulsie urządzenie nie liczy trwającego pobudzenia drugi raz
    if (wychwyt) { this.emit({ typ: 'QRS', at: s, zrodlo: 'stym' }); this.lastVdep = s; this.pending = []; }
  }

  private paceA(): void {
    const s = this.t;
    this.restartA(s, this.u.brakImpulsu ? 'brak' : 'iglica');
    if (this.u.tryb === 'DDD') this.avStart = s;
    if (this.u.brakImpulsu) { this.emit({ typ: 'brak', at: s, jama: 'A' }); return; }
    const refrakcja = s - this.lastAdep < REFRAKCJA_A;
    const wychwyt = this.wychwytOk && !refrakcja;
    this.emit({ typ: 'iglica', at: s, jama: 'A', wychwyt, refrakcja });
    this.aSenseAt = null;
    if (wychwyt) {
      this.emit({ typ: 'P', at: s, zrodlo: 'stym' });
      this.lastAdep = s;
      if (this.p.zatoka > 0) this.nextSinus = s + odstep(this.p.zatoka); // pobudzenie przedsionków przestawia węzeł zatokowy
      if (this.p.av === 'sprawne') this.pending.push(s + PQ);
    }
  }
}

/* ─────────── usterki (S5_03) ─────────── */

export type Usterka = 'wychwyt' | 'stymulacja' | 'niedoczulosc' | 'nadczulosc';
export const USTERKI: ReadonlyArray<{ v: Usterka; label: string }> = [
  { v: 'wychwyt', label: 'Brak wychwytu' },
  { v: 'stymulacja', label: 'Brak stymulacji' },
  { v: 'niedoczulosc', label: 'Niedoczułość' },
  { v: 'nadczulosc', label: 'Nadczułość' },
];

/** Okna szumu mięśniowego powtarzane co `co` s (od chwili t0). */
export function oknaSzumu(t0: number, t1: number, co = 7, dlugo = 2.6, start = 2): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let t = t0 + start; t < t1; t += co) out.push([t, t + dlugo]);
  return out;
}

/** Stan startowy scenariusza usterki: ustawienia i pacjent. */
export function scenariuszUsterki(u: Usterka): { ust: Ustawienia; pac: Pacjent } {
  const ust: Ustawienia = { ...USTAWIENIA_KANON };
  switch (u) {
    case 'wychwyt': // pacjent z blokiem całkowitym i rytmem zastępczym, zbyt mała zaprogramowana siła impulsu
      return { ust: { ...ust, amplituda: 0.25 }, pac: { zatoka: 70, av: 'blok', zastepczy: ZASTEPCZY, szum: [] } };
    case 'stymulacja':
      return { ust: { ...ust, brakImpulsu: true }, pac: { zatoka: 70, av: 'blok', zastepczy: ZASTEPCZY, szum: [] } };
    case 'niedoczulosc':
      return { ust: { ...ust, czulosc: 2 }, pac: { zatoka: 75, av: 'sprawne', zastepczy: ZASTEPCZY, szum: [] } };
    case 'nadczulosc': // osoba zależna od stymulatora: bez własnego rytmu komór
      return { ust, pac: { zatoka: 70, av: 'blok', zastepczy: 0, szum: [] } };
  }
}

/** Czy obecne ustawienia usuwają usterkę (tam, gdzie tekst opisuje naprawę ustawieniem). */
export function naprawione(u: Usterka, ust: Ustawienia): boolean | null {
  switch (u) {
    case 'wychwyt': return ust.amplituda > ust.prog;
    case 'niedoczulosc': return wykrywa(SYGNAL_MV, ust.czulosc);
    case 'nadczulosc': return ust.magnes;
    case 'stymulacja': return null; // ustawieniem tego nie naprawisz: rozstrzyga kontrola programatorem
  }
}

/* ─────────── ćwiczenie „Co się psuje?” ─────────── */

export type Odpowiedz = Usterka | 'prawidlowo';
export const ODPOWIEDZI: ReadonlyArray<{ v: Odpowiedz; label: string }> = [
  { v: 'wychwyt', label: 'Brak wychwytu' },
  { v: 'stymulacja', label: 'Brak stymulacji' },
  { v: 'niedoczulosc', label: 'Niedoczułość' },
  { v: 'nadczulosc', label: 'Nadczułość' },
  { v: 'prawidlowo', label: 'Prawidłowa praca urządzenia' },
];

export interface Zadanie { id: string; odp: Odpowiedz; ust: Ustawienia; pac: Pacjent; opis: string; szum: boolean }

/** Pula zadań: cztery usterki i dwa obrazy prawidłowej pracy, które łatwo wziąć za awarię. */
export function pulaZadan(): Zadanie[] {
  const z = (id: string, odp: Odpowiedz, opis: string, szum = false): Zadanie => {
    const s = odp === 'prawidlowo' ? null : scenariuszUsterki(odp);
    return { id, odp, opis, szum, ust: s?.ust ?? { ...USTAWIENIA_KANON }, pac: s?.pac ?? { ...PACJENT_KANON } };
  };
  const vviCisza = z('vvi-cisza', 'prawidlowo', 'VVI 60/min, własny rytm 75/min');
  vviCisza.pac = { zatoka: 75, av: 'sprawne', zastepczy: ZASTEPCZY, szum: [] };
  const dddBlok = z('ddd-blok', 'prawidlowo', 'DDD, rytm zatokowy 75/min, blok całkowity');
  dddBlok.ust = { ...USTAWIENIA_KANON, tryb: 'DDD' };
  dddBlok.pac = { zatoka: 75, av: 'blok', zastepczy: ZASTEPCZY, szum: [] };
  return [
    z('wychwyt', 'wychwyt', 'VVI 60/min, blok całkowity'),
    z('stymulacja', 'stymulacja', 'VVI 60/min, blok całkowity'),
    z('niedoczulosc', 'niedoczulosc', 'VVI 60/min, własny rytm 75/min'),
    z('nadczulosc', 'nadczulosc', 'VVI 60/min, pacjent zależny od stymulatora', true),
    vviCisza, dddBlok,
  ];
}

/* ─────────── ICD (S5_04) ─────────── */

export type IcdScen = 'atp' | 'szok' | 'vf' | 'wolny' | 'qrst';
export const ICD_SCEN: ReadonlyArray<{ v: IcdScen; label: string }> = [
  { v: 'atp', label: 'VT, ATP skuteczna' },
  { v: 'szok', label: 'VT, ATP bez efektu' },
  { v: 'vf', label: 'Migotanie komór' },
  { v: 'wolny', label: 'VT poniżej strefy' },
  { v: 'qrst', label: 'Liczenie załamka T' },
];

/** Wewnętrzne liczby ICD (umowne, NIE pokazywane: tekst mówi tylko o „zaprogramowanej” liczbie i strefie). */
export const ICD_N = 8;
export const ICD_STREFA_S = 0.4;
export const ATP_IMPULSY = 8;
const ZATOKA_ICD = 75;
const VT_WOLNY_S = 0.5;

export type IcdFaza = 'czuwa' | 'liczy' | 'atp' | 'ocena' | 'wyladowanie' | 'po' | 'zawieszone' | 'poza';

export type IcdZd =
  | { typ: 'P'; at: number }
  | { typ: 'QRS'; at: number; zrodlo: 'przewiedziony' | 'vt' | 'stym' }
  | { typ: 'iglica'; at: number }
  | { typ: 'detekcja'; at: number; wStrefie: boolean; n: number; co: 'QRS' | 'T' | 'VF' }
  | { typ: 'vf'; od: number; do: number }
  | { typ: 'wyladowanie'; at: number }
  | { typ: 'faza'; at: number; faza: IcdFaza };

/** Odstępy wykrywania w VF: bardzo krótkie i nieregularne (umowne). */
const vfOdstep = (k: number): number => 0.17 + 0.07 * (((Math.sin(k * 78.233) * 12345.678) % 1 + 1) % 1);

export class Icd {
  scen: IcdScen;
  liczyT: boolean;
  magnes: boolean;
  t: number;
  faza: IcdFaza = 'czuwa';
  /** Ostatnio mierzona częstość sygnałów, które liczy urządzenie [/min] albo null. */
  liczona: number | null = null;
  licznik = 0;
  private start: number;
  private next: number;
  private lastDet: number | null = null;
  private atpLeft = 0;
  private atpDone = false;
  private vfK = 0;
  private vfOd: number | null = null;
  private shockAt: number | null = null;
  private out: IcdZd[] = [];
  historia: IcdZd[] = [];

  /** `onset` — po ilu sekundach od t0 zaczyna się arytmia. */
  constructor(scen: IcdScen, t0 = 0, o: { liczyT?: boolean; magnes?: boolean; onset?: number } = {}) {
    this.scen = scen; this.liczyT = o.liczyT ?? false; this.magnes = o.magnes ?? false;
    this.t = t0; this.start = t0; this.next = t0 + 0.3; this.onset = o.onset ?? 3.2;
  }
  private onset: number;
  odbierz(): IcdZd[] { const o = this.out; this.out = []; return o; }
  private emit(e: IcdZd): void { this.out.push(e); this.historia.push(e); }
  private setFaza(f: IcdFaza, at: number): void { if (this.faza !== f) { this.faza = f; this.emit({ typ: 'faza', at, faza: f }); } }

  /** Chwila początku arytmii. */
  get poczatek(): number { return this.start + this.onset; }

  private wykryj(at: number, co: 'QRS' | 'T' | 'VF'): void {
    const odst = this.lastDet === null ? null : at - this.lastDet;
    this.lastDet = at;
    if (odst === null) return;
    this.liczona = czestosc(odst);
    const wStrefie = odst < ICD_STREFA_S;
    if (wStrefie) this.licznik++; else this.licznik = 0;
    this.emit({ typ: 'detekcja', at, wStrefie, n: this.licznik, co });
  }

  private zatoka(at: number): void {
    this.emit({ typ: 'P', at: at - PQ });
    this.emit({ typ: 'QRS', at, zrodlo: 'przewiedziony' });
    this.wykryj(at + OPOZN_WYKRYCIA, 'QRS');
    if (this.liczyT) this.wykryj(at + 0.3, 'T');
    this.next = at + odstep(this.scen === 'qrst' ? 90 : ZATOKA_ICD);
  }

  advance(until: number): void {
    for (let g = 0; g < 10000 && this.next <= until; g++) {
      const at = this.next;
      this.t = at;
      const arytmia = this.scen !== 'qrst' && at >= this.poczatek && this.faza !== 'po';
      if (!arytmia) { this.zatoka(at); continue; }
      if (this.faza === 'czuwa') { this.licznik = 0; this.setFaza(this.scen === 'wolny' ? 'poza' : this.magnes ? 'zawieszone' : 'liczy', at); }

      if (this.faza === 'atp') { // seria impulsów szybszych niż częstoskurcz
        this.emit({ typ: 'iglica', at });
        this.emit({ typ: 'QRS', at, zrodlo: 'stym' });
        this.atpLeft--;
        this.next = at + ATP_ODSTEP;
        if (this.atpLeft === 0) {
          this.atpDone = true; this.lastDet = null; this.licznik = 0;
          if (this.scen === 'atp') { this.setFaza('po', at); this.next = at + 1.0; }
          else { this.setFaza('ocena', at); this.next = at + odstep(VT_CZESTOSC) + 0.04; }
        }
        continue;
      }
      if (this.faza === 'wyladowanie') {
        if (this.scen !== 'vf') this.emit({ typ: 'QRS', at: at - 0.01, zrodlo: 'vt' });
        this.emit({ typ: 'wyladowanie', at });
        if (this.vfOd !== null) { this.emit({ typ: 'vf', od: this.vfOd, do: at }); this.vfOd = null; }
        this.setFaza('po', at); this.next = at + 1.4; this.lastDet = null;
        continue;
      }

      if (this.scen === 'vf') {
        if (this.vfOd === null) this.vfOd = at;
        this.wykryj(at, 'VF');
        this.next = at + vfOdstep(this.vfK++);
      } else {
        this.emit({ typ: 'QRS', at, zrodlo: 'vt' });
        this.wykryj(at + OPOZN_WYKRYCIA, 'QRS');
        this.next = at + (this.scen === 'wolny' ? VT_WOLNY_S : odstep(VT_CZESTOSC));
      }
      if (this.faza !== 'poza') {
        if (this.magnes) this.setFaza('zawieszone', at);
        else if (this.faza === 'zawieszone') { this.licznik = 0; this.setFaza(this.atpDone ? 'ocena' : 'liczy', at); }
      }
      if ((this.faza === 'liczy' || this.faza === 'ocena') && this.licznik >= ICD_N) {
        if (this.scen === 'vf' || this.atpDone) {
          this.setFaza('wyladowanie', at);
          // kardiowersja w VT: zsynchronizowana z pobudzeniem komór; defibrylacja w VF
          this.next = this.scen === 'vf' ? at + 0.12 : this.next + 0.01;
          this.shockAt = this.next;
        } else {
          this.setFaza('atp', at);
          this.atpLeft = ATP_IMPULSY;
          this.next = at + ATP_ODSTEP;
        }
      }
    }
    this.t = Math.max(this.t, until);
  }

  /** Trwający odcinek VF (do rysowania tła), jeśli jest. */
  vfTrwa(): number | null { return this.vfOd; }
  get wyladowanieO(): number | null { return this.shockAt; }
}
