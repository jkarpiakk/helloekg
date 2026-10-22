/**
 * Dane i czysta logika wstawki „mapa-zawalu” (bez DOM).
 *
 * Każde miejsce zamknięcia to jeden wektor uszkodzenia w układzie modelu (x — lewa ręka pacjenta,
 * y — w dół, z — do przodu). Zapis 12 odprowadzeń liczy `beat({ injury })` z `core/model.ts`,
 * a oznaczenia pól („up” / „down”) wynikają wyłącznie ze znaku i wielkości `stAt()` względem progów
 * z wykładów (S3_03, S3_04, S3_05). Listy odprowadzeń z wykładu stoją w testach, nie tutaj:
 * test sprawdza, że to, co wychodzi z modelu, zgadza się z tekstem.
 *
 * Kierunki wektorów dostrojono do list z wykładu (start: propozycja z zamówienia, potem
 * najmniejsza zmiana, przy której wszystkie progi są spełnione z zapasem). Szczegóły w karcie.
 */
import { LEADS_12, beat, norm3, stAt, volt, type Beat, type LeadName, type V3 } from './core/model.js';

/* ─────────── progi (pacjent: mężczyzna, 58 lat) ─────────── */

/** Próg uniesienia ST w punkcie J [mV] dla mężczyzny w wieku co najmniej 40 lat (0,1 mV = 1 mm). */
export function progUp(lead: LeadName): number {
  if (lead === 'V2' || lead === 'V3') return 0.2; // ≥ 2 mm u mężczyzn w wieku co najmniej 40 lat
  if (lead === 'V7' || lead === 'V8' || lead === 'V9') return 0.05; // ≥ 0,5 mm (mężczyźni od 40 lat)
  if (lead === 'V3R' || lead === 'V4R') return 0.05; // ≥ 0,5 mm (mężczyźni od 30 lat)
  return 0.1; // ≥ 1 mm poza V2-V3
}
/** Obniżenie ST ≥ 0,5 mm w punkcie J. */
export const PROG_DOWN = 0.05;
/** Obniżenie ST ≥ 1 mm w V1, V2 lub V3: podejrzenie ściany tylnej. */
export const PROG_TYLNA = 0.1;
/** Odwrócenie T o głębokości ≥ 1 mm. */
export const PROG_T_UJEMNE = 0.1;

export type Mark = 'up' | 'down' | null;
export function markOf(b: Beat, lead: LeadName): Mark {
  const v = stAt(b, lead);
  if (v >= progUp(lead) - 1e-9) return 'up';
  if (v <= -PROG_DOWN + 1e-9) return 'down';
  return null;
}

/* ─────────── fazy ewolucji (S3_04, kolejność z tekstu) ─────────── */

export type PhaseId = 'nadostre-t' | 'st' | 'q' | 'st-wraca' | 't-ujemne' | 'q-utrwalone';

export interface Phase {
  id: PhaseId;
  chip: string;
  nazwa: string;
  opis: string;
  /** Mnożniki amplitud wektora uszkodzenia miejsca (ST, nadostre T, Q, odwrócenie T) i szerokość T. */
  k: { st: number; hyperT: number; q: number; tInv: number; tSharp: number };
}

export const PHASES: readonly Phase[] = [
  { id: 'nadostre-t', chip: '1 · Nadostre T', nazwa: 'Nadostre, wysokie załamki T',
    opis: 'Najpierw pojawiają się nadostre, wysokie T: symetryczne, szerokie i nieproporcjonalnie duże względem poprzedzającego QRS. ST jeszcze nie jest uniesiony.',
    k: { st: 0, hyperT: 1, q: 0, tInv: 0, tSharp: 0.8 } },
  { id: 'st', chip: '2 · Uniesienie ST', nazwa: 'Uniesienie odcinka ST',
    opis: 'Potem pojawia się uniesienie odcinka ST w kamerach patrzących na zagrożony obszar. Mierzysz je w punkcie J.',
    k: { st: 1, hyperT: 0, q: 0, tInv: 0, tSharp: 1 } },
  { id: 'q', chip: '3 · Załamki Q', nazwa: 'Patologiczne załamki Q',
    opis: 'Następnie mogą zacząć się formować patologiczne załamki Q, ślad martwicy. ST nadal jest uniesiony.',
    k: { st: 1, hyperT: 0, q: 1, tInv: 0, tSharp: 1 } },
  { id: 'st-wraca', chip: '4 · ST wraca', nazwa: 'ST wraca do linii',
    opis: 'Odcinek ST stopniowo wraca do linii bazowej, a załamki T zaczynają się odwracać. Załamki Q zostają.',
    k: { st: 0.1, hyperT: 0, q: 1, tInv: 0.4, tSharp: 1 } },
  { id: 't-ujemne', chip: '5 · T ujemne', nazwa: 'Załamki T odwracają się',
    opis: 'Załamki T odwracają się w kamerach patrzących na obszar zawału.',
    k: { st: 0, hyperT: 0, q: 1, tInv: 1, tSharp: 1 } },
  { id: 'q-utrwalone', chip: '6 · Utrwalone Q', nazwa: 'Utrwalone załamki Q',
    opis: 'W fazie przewlekłej mogą pozostać utrwalone załamki Q.',
    k: { st: 0, hyperT: 0, q: 1, tInv: 0, tSharp: 1 } },
];
export const phase = (id: PhaseId): Phase => PHASES.find((p) => p.id === id) ?? (PHASES[1] as Phase);

/* ─────────── miejsca zamknięcia ─────────── */

export type SiteId = 'lad-prox' | 'lad-dal' | 'd1' | 'okalajaca' | 'tylna' | 'rca' | 'rca-pk' | 'pien';
export type RegionId = 'przegroda' | 'przednia' | 'koniuszek' | 'boczna-wysoka' | 'boczna' | 'dolna' | 'pk' | 'tylna' | 'podwsierdzie';
export type SegId = 'lm' | 'lad1' | 'lad2' | 'sept1' | 'sept2' | 'd1' | 'lcx1' | 'lcx2' | 'rca1' | 'rvb' | 'rca2' | 'pda';
export type Rodzina = 'lad' | 'lcx' | 'rca' | 'pien';

export interface Site {
  id: SiteId;
  chip: string;
  nazwa: string;
  /** Nazwa w werdykcie ćwiczenia („Prawidłowo: …”), z małej litery poza skrótami. */
  odp: string;
  rodzina: Rodzina;
  /** Kierunek wektora uszkodzenia (x lewo, y dół, z przód). */
  dir: V3;
  /** Uniesienie ST w kierunku obszaru [mV] w fazie uniesienia. */
  st: number;
  /** Amplitudy nadostrego T, Q i odwrócenia T [mV] wzdłuż tego samego kierunku. */
  hyperT: number; q: number; tInv: number;
  /** Odwrócenie T już w fazie uniesienia ST i Q (ściana tylna: dodatnia końcowa część T w V1-V3). */
  tPrzyST?: number;
  /** Osobny kierunek utraty sił (Q), gdy martwica obejmuje przegrodę bardziej niż wynika z wektora ST. */
  qDir?: V3;
  /** Fazy, które wykład opisuje dla tego obrazu. */
  fazy: readonly PhaseId[];
  /** Dlaczego część faz jest niedostępna. */
  fazyUwaga?: string;
  regiony: readonly RegionId[];
  /** Miejsce zamknięcia na schemacie i odcinki za nim (bez przepływu). */
  zamkniecie: SegId | null;
  zaZamknieciem: readonly SegId[];
  /** Obraz rozlany (pień): bez zamknięcia jednej tętnicy. */
  rozlany?: boolean;
  /** Krótko, z wykładu. */
  opis: string;
  /** Wyjaśnienie w ćwiczeniu: co w zapisie wskazuje to miejsce. */
  dlaczego: string;
}

const ALL_PHASES: readonly PhaseId[] = PHASES.map((p) => p.id);

export const SITES: readonly Site[] = [
  {
    id: 'rca', chip: 'RCA', nazwa: 'Prawa tętnica wieńcowa (RCA), za gałęziami prawej komory', odp: 'RCA za gałęziami prawej komory', rodzina: 'rca',
    dir: [-0.25, 0.94, -0.04], st: 0.28, hyperT: 0.75, q: 0.42, tInv: 0.55, fazy: ALL_PHASES,
    regiony: ['dolna'], zamkniecie: 'rca2', zaZamknieciem: ['rca2', 'pda'],
    opis: 'Zawał ściany dolnej najczęściej wynika z zamknięcia RCA. RCA zwykle zaopatruje węzeł AV, więc patrz też na rytm: bradykardia i bloki AV.',
    dlaczego: 'Uniesienie ST w II, III i aVF wskazuje ścianę dolną. <b>Uniesienie większe w III niż w II, z obniżeniem w I i aVL, podpowiada RCA</b>. Zawał dolny może jednak wynikać także z zamknięcia okalającej, więc piszesz o prawdopodobnym obszarze RCA, bez pewności.',
  },
  {
    id: 'rca-pk', chip: 'RCA z prawą komorą', nazwa: 'RCA proksymalnie, przed gałęziami prawej komory', odp: 'RCA proksymalnie, przed gałęziami prawej komory', rodzina: 'rca',
    dir: [-0.44, 0.89, 0.12], st: 0.29, hyperT: 0.7, q: 0.4, tInv: 0.5, fazy: ALL_PHASES,
    regiony: ['dolna', 'pk'], zamkniecie: 'rca1', zaZamknieciem: ['rca1', 'rvb', 'rca2', 'pda'],
    opis: 'Jedna przeszkoda odcina dopływ krwi do części ściany dolnej i do prawej komory. Uniesienie ST w V1 bywa wskazówką; uniesienie ≥ 0,5 mm w V3R-V4R wspiera rozpoznanie zajęcia prawej komory.',
    dlaczego: 'Widzisz zawał dolny (II, III, aVF) z uniesieniem ST w V1, które bywa wskazówką zajęcia prawej komory. <b>Uniesienie ST ≥ 0,5 mm w V3R-V4R wspiera rozpoznanie zajęcia prawej komory</b>, a to przemawia za proksymalnym zamknięciem RCA, przed gałęziami prawej komory.',
  },
  {
    id: 'okalajaca', chip: 'Okalająca', nazwa: 'Gałąź okalająca (LCx)', odp: 'gałąź okalająca (LCx)', rodzina: 'lcx',
    dir: [0.77, -0.23, -0.59], st: 0.24, hyperT: 0.4, q: 0.4, tInv: 0.45, fazy: ALL_PHASES,
    regiony: ['boczna', 'tylna'], zamkniecie: 'lcx1', zaZamknieciem: ['lcx1', 'lcx2'],
    opis: 'LCx biegnie w bruździe przedsionkowo-komorowej i oddaje gałęzie do ściany bocznej. Część zaopatrywanego przez nią mięśnia leży z tyłu, więc szukasz obniżeń ST w V1-V3 i dołączasz V7-V9.',
    dlaczego: 'Uniesienia w I, aVL i V5-V6 to ściana boczna, którą zaopatruje zwykle okalająca albo gałąź diagonalna D1. <b>Obniżenia ST w V1-V3 kierują uwagę na ścianę tylną</b>: część mięśnia zaopatrywanego przez okalającą leży z tyłu, a V7-V9 pokazują tam uniesienie.',
  },
  {
    id: 'tylna', chip: 'Ściana tylna', nazwa: 'Ściana tylna (okalająca lub RCA)', odp: 'ściana tylna (okalająca lub RCA)', rodzina: 'lcx',
    dir: [0, 0.21, -0.98], st: 0.17, hyperT: 0, q: 0.42, tInv: 0, tPrzyST: 0.2, fazy: ['st', 'q'],
    fazyUwaga: 'Dla ściany tylnej wykład opisuje obniżenie ST z przodu i wysoki R jako lustrzany odpowiednik Q, bez pełnej ewolucji T.',
    regiony: ['tylna'], zamkniecie: 'lcx2', zaZamknieciem: ['lcx2'],
    opis: 'Standardowe 12 odprowadzeń nie patrzy na ścianę tylną bezpośrednio. Kamery przednie widzą ją odwróconą: obniżenie ST ≥ 1 mm w V1-V3. Za zawał tylny odpowiada zwykle okalająca lub RCA, zależnie od budowy naczyń.',
    dlaczego: '<b>Obniżenie ST w V1-V3 = szukaj zawału tylnego.</b> Kamery przednie widzą go odwrócony do góry nogami, a prawdziwe uniesienie ST pokazują dopiero V7-V9 (próg ≥ 0,5 mm). Za zawał tylny odpowiada zwykle gałąź okalająca lub prawa tętnica wieńcowa, zależnie od budowy naczyń: obie odpowiedzi są trafne.',
  },
  {
    id: 'lad-prox', chip: 'LAD proksymalnie', nazwa: 'Gałąź międzykomorowa przednia (LAD), odcinek proksymalny', odp: 'LAD proksymalnie', rodzina: 'lad',
    dir: [0.59, -0.52, 0.62], st: 0.24, hyperT: 0.26, q: 0.4, tInv: 0.45, qDir: [0.2, -0.3, 0.93], fazy: ALL_PHASES,
    regiony: ['przegroda', 'przednia', 'koniuszek', 'boczna-wysoka'], zamkniecie: 'lad1', zaZamknieciem: ['lad1', 'lad2', 'sept1', 'sept2', 'd1'],
    opis: 'Zamknięcie proksymalnej LAD zwykle powoduje rozległy zawał przedni. Uniesienia sięgają V5-V6, I i aVL: zawał przednio-boczny lub rozległy przedni.',
    dlaczego: 'Uniesienia w V1-V4 to przód serca, czyli LAD. <b>Rozszerzenie uniesień na V5-V6, I i aVL przemawia za zawałem przednio-bocznym lub rozległym przednim</b>, a im bardziej proksymalne zamknięcie, tym większy zwykle obszar zagrożenia. Rozległość uniesień nie wyznacza jednak pewnie poziomu zamknięcia, więc „LAD dalej” też uznajesz za trafienie.',
  },
  {
    id: 'lad-dal', chip: 'LAD dalej', nazwa: 'LAD za odejściem D1', odp: 'LAD za odejściem D1', rodzina: 'lad',
    dir: [0.05, 0.08, 0.98], st: 0.095, hyperT: 0.26, q: 0.36, tInv: 0.35, qDir: [-0.1, 0, 1], fazy: ALL_PHASES,
    regiony: ['przednia', 'koniuszek', 'przegroda'], zamkniecie: 'lad2', zaZamknieciem: ['lad2', 'sept2'],
    opis: 'Grupa V1-V4 to przód serca, czyli LAD: V1-V2 przegroda, V3-V4 ściana przednia. Zamknięcie dalszego odcinka zwykle zagraża mniejszemu obszarowi niż proksymalne.',
    dlaczego: 'Uniesienia w V1-V4: przegroda i ściana przednia, obszar LAD. <b>Bez uniesień w I, aVL i V5-V6</b> zagrożony obszar jest zwykle mniejszy niż przy zamknięciu proksymalnym. Rozległość uniesień nie wyznacza jednak pewnie poziomu zamknięcia, więc „LAD proksymalnie” też uznajesz za trafienie.',
  },
  {
    id: 'd1', chip: 'Diagonalna D1', nazwa: 'Gałąź diagonalna D1 (od LAD)', odp: 'gałąź diagonalna D1', rodzina: 'lad',
    dir: [0.78, -0.59, 0.21], st: 0.17, hyperT: 0.36, q: 0.36, tInv: 0.45, fazy: ALL_PHASES,
    regiony: ['boczna-wysoka'], zamkniecie: 'd1', zaZamknieciem: ['d1'],
    opis: 'Gałąź diagonalna D1 odchodzi od LAD i karmi część przednio-boczną lewej komory. Uniesienia w I, aVL i V5-V6 to ściana boczna; obniżenie w III może być zmianą lustrzaną.',
    dlaczego: 'Uniesienia w I, aVL i V5-V6 (tu sięgają też V4) to ściana boczna, a <b>za zawał boczny odpowiada zwykle gałąź okalająca albo gałąź diagonalna D1</b>: obie odpowiedzi są trafne. Obniżenie w III tworzy z uniesieniem w I i aVL układ zmian lustrzanych. Samego zapisu nie wystarczy, żeby rozstrzygnąć między tymi tętnicami: zamknięcie okalającej czasem daje niewielkie zmiany.',
  },
  {
    id: 'pien', chip: 'Pień · aVR', nazwa: 'Pień lewej tętnicy lub choroba trójnaczyniowa', odp: 'pień lewej tętnicy lub choroba trójnaczyniowa', rodzina: 'pien',
    dir: [-0.56, -0.82, -0.05], st: 0.2, hyperT: 0, q: 0, tInv: 0, fazy: ['st'], rozlany: true,
    fazyUwaga: 'To obraz rozlanego niedokrwienia, nie zawału jednej ściany: wykład nie opisuje dla niego ewolucji ST, T i Q.',
    regiony: ['podwsierdzie'], zamkniecie: null, zaZamknieciem: [],
    opis: 'Rozlane obniżenia ST z uniesieniem w aVR mogą odpowiadać chorobie pnia lewej tętnicy wieńcowej albo zrównoważonej chorobie trójnaczyniowej. Nie układają się w terytorium jednej tętnicy i nie są swoiste dla zawału.',
    dlaczego: '<b>Rozlane obniżenia ST z uniesieniem w aVR</b> nie układają się w terytorium jednej tętnicy. Kierują uwagę na rozległe niedokrwienie podwsierdziowe: chorobę pnia lewej tętnicy wieńcowej albo zrównoważoną chorobę trójnaczyniową. Obraz nie jest swoisty dla zawału.',
  },
];
export const site = (id: SiteId): Site => SITES.find((s) => s.id === id) ?? (SITES[0] as Site);
export const isSiteId = (v: string | undefined): v is SiteId => SITES.some((s) => s.id === v);
export const isPhaseId = (v: string | undefined): v is PhaseId => PHASES.some((p) => p.id === v);

/* ─────────── zapis z modelu ─────────── */

export function beatFor(s: Site, ph: PhaseId): Beat {
  const k = phase(ph).k;
  const tInv = s.tInv * k.tInv + (s.tPrzyST !== undefined && (ph === 'st' || ph === 'q') ? s.tPrzyST : 0);
  const q = s.q * k.q;
  const b = beat({
    tSharp: k.tSharp,
    injury: { dir: s.dir, st: s.st * k.st, hyperT: s.hyperT * k.hyperT, q: s.qDir ? 0 : q, tInv },
  });
  // utrata sił w osobnym kierunku: ta sama składowa co w modelu (t = 22 ms), tylko inny wektor
  if (s.qDir && q) { const d = norm3(s.qDir); b.qrs.push({ t: 0.022, w: 0.011, v: [-d[0] * q, -d[1] * q, -d[2] * q] }); }
  return b;
}

export const GRUPY = {
  dolna: ['II', 'III', 'aVF'],
  przegroda: ['V1', 'V2'],
  przednia: ['V3', 'V4'],
  boczna: ['I', 'aVL', 'V5', 'V6'],
} as const satisfies Record<string, readonly LeadName[]>;
export const PRAWE: readonly LeadName[] = ['V3R', 'V4R'];
export const TYLNE: readonly LeadName[] = ['V7', 'V8', 'V9'];
const V1_3: readonly LeadName[] = ['V1', 'V2', 'V3'];

export interface Analiza {
  up: LeadName[];
  down: LeadName[];
  /** Wskazania do odprowadzeń dodatkowych (S3_05): zawał dolny → V3R-V4R, obniżenie ST ≥ 1 mm w V1-V3 → V7-V9. */
  prawe: boolean;
  tylne: boolean;
  upPrawe: LeadName[];
  upTylne: LeadName[];
  /** Ściany nazwane z kamer, w których widać zmiany. */
  sciany: string[];
  /** Uniesienie w III większe niż w II (gdy oba uniesione). */
  iiiWiecejNizII: boolean | null;
  rozlany: boolean;
}

const count = (leads: readonly LeadName[], set: readonly LeadName[]) => leads.filter((l) => set.includes(l)).length;

export function analiza(b: Beat): Analiza {
  const up = LEADS_12.filter((l) => markOf(b, l) === 'up');
  const down = LEADS_12.filter((l) => markOf(b, l) === 'down');
  const upPrawe = PRAWE.filter((l) => markOf(b, l) === 'up');
  const upTylne = TYLNE.filter((l) => markOf(b, l) === 'up');
  const dolna = count(up, GRUPY.dolna) >= 2;
  const przod = count(up, ['V1', 'V2', 'V3', 'V4']) >= 2;
  const boczna = count(up, GRUPY.boczna) >= 2;
  const tylneObn = V1_3.some((l) => stAt(b, l) <= -PROG_TYLNA + 1e-9);
  const rozlany = up.length === 1 && up[0] === 'aVR' && down.length >= 6;
  const sciany: string[] = [];
  if (rozlany) sciany.push('niedokrwienie rozlane, uniesienie tylko w aVR');
  else {
    if (dolna) sciany.push('dolna');
    if (przod) {
      const sept = count(up, GRUPY.przegroda) > 0, ant = count(up, GRUPY.przednia) > 0;
      sciany.push(sept && ant ? 'przednia i przegroda' : sept ? 'przegroda' : 'przednia');
    }
    if (boczna) sciany.push('boczna');
    if (tylneObn) sciany.push('tylna (obraz lustrzany w V1-V3)');
  }
  const ii = stAt(b, 'II'), iii = stAt(b, 'III');
  return {
    up, down, upPrawe, upTylne, sciany, rozlany,
    prawe: !rozlany && dolna,
    tylne: !rozlany && tylneObn,
    iiiWiecejNizII: up.includes('II') && up.includes('III') ? iii > ii : null,
  };
}

/* ─────────── pomiary kształtu (Q, R/S, T) z zapisu modelu ─────────── */

export interface QrsPomiar { qMs: number; qDepth: number; r: number; s: number; patQ: boolean }

/** Mierzy początkowe ujemne wychylenie QRS (Q), R i S w odprowadzeniu, próbkując zapis co 0,5 ms. */
export function qrsPomiar(b: Beat, lead: LeadName): QrsPomiar {
  const dt = 0.0005, f = (t: number) => volt(b, lead, t);
  // P kończy się przed −0,02 s; ST zaczyna się w punkcie J
  let t = -0.02;
  while (t < b.j && Math.abs(f(t)) < 0.01) t += dt;
  const on = t;
  let qEnd = on, qDepth = 0;
  if (f(on) < 0) {
    while (qEnd < b.j && f(qEnd) < 0) { qDepth = Math.max(qDepth, -f(qEnd)); qEnd += dt; }
  }
  let r = 0, tR = qEnd;
  for (let x = qEnd; x <= b.j; x += dt) { const v = f(x); if (v > r) { r = v; tR = x; } }
  let s = 0;
  for (let x = tR; x <= b.j; x += dt) s = Math.max(s, -f(x));
  const qMs = Math.round((qEnd - on) * 1000);
  const patQ = qDepth > 0.02 && (qMs >= 40 || r < 0.02 || qDepth >= 0.25 * r);
  return { qMs, qDepth, r, s, patQ };
}

/** Załamek T w szczycie [mV]. */
export const tAmp = (b: Beat, lead: LeadName): number => volt(b, lead, b.tPeak);

/** Grupy sąsiadujących kamer do kryterium „w dwóch sąsiadujących odprowadzeniach”. */
const SASIEDZI: readonly (readonly LeadName[])[] = [GRUPY.dolna, ['V1', 'V2', 'V3', 'V4'], GRUPY.boczna];

/** Odprowadzenia z patologicznym Q (≥ 40 ms lub ≥ 25% R), tylko gdy spełnia je co najmniej dwóch sąsiadów w grupie. */
export function patQLeads(b: Beat): LeadName[] {
  const q = new Set(LEADS_12.filter((l) => qrsPomiar(b, l).patQ));
  const out = new Set<LeadName>();
  for (const g of SASIEDZI) { const hit = g.filter((l) => q.has(l)); if (hit.length >= 2) hit.forEach((l) => out.add(l)); }
  return LEADS_12.filter((l) => out.has(l));
}
/** Odprowadzenia z T ujemnym o głębokości ≥ 1 mm. */
export const tUjemneLeads = (b: Beat): LeadName[] => LEADS_12.filter((l) => tAmp(b, l) <= -PROG_T_UJEMNE);

/**
 * Patologiczne Q wypisywane kursantowi: tylko w kamerach patrzących na obszar tego miejsca.
 * Pozostałe (np. aVL z małym R w prawidłowym zapisie modelu) to artefakty i nie mają znaczenia dla lokalizacji.
 */
export function patQObszaru(s: Site, b: Beat): LeadName[] {
  const face = kameryObszaru(s);
  return patQLeads(b).filter((l) => face.includes(l));
}

/** Kamery patrzące na obszar: te, które w fazie uniesienia ST mają ST ≥ progu (12 + wskazane dodatkowe). */
export function kameryObszaru(s: Site): LeadName[] {
  const b = beatFor(s, 'st'), a = analiza(b);
  return [...a.up, ...(a.prawe ? a.upPrawe : []), ...(a.tylne ? a.upTylne : [])];
}

/* ─────────── ćwiczenie ─────────── */

export interface Runda { site: SiteId }

/** 5 różnych miejsc w losowej kolejności. */
export function rundy(rand: () => number, n = 5): Runda[] {
  const ids = SITES.map((s) => s.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j] as SiteId, ids[i] as SiteId]; }
  return ids.slice(0, n).map((id) => ({ site: id }));
}

/**
 * Odpowiedzi uznawane za trafienie, gdy wykład nie pozwala rozstrzygnąć z samego zapisu (S3_05):
 * ściana boczna → okalająca lub gałąź diagonalna D1; LAD proksymalnie / dalej → rozległość nie wyznacza pewnie
 * poziomu zamknięcia; ściana tylna → okalająca lub prawa tętnica wieńcowa.
 */
export const TEZ_TRAFNE: Readonly<Partial<Record<SiteId, readonly SiteId[]>>> = {
  d1: ['okalajaca'],
  'lad-prox': ['lad-dal'],
  'lad-dal': ['lad-prox'],
  tylna: ['okalajaca', 'rca'],
};

export function ocena(right: SiteId, picked: SiteId | null): { ok: boolean; near: boolean } {
  if (!picked) return { ok: false, near: false };
  if (picked === right || TEZ_TRAFNE[right]?.includes(picked)) return { ok: true, near: false };
  return { ok: false, near: site(picked).rodzina === site(right).rodzina && site(right).rodzina !== 'pien' };
}

/** Pierwsza litera wielka / mała, bez ruszania skrótów w dalszej części („ST”, „T”, „Q”, „LAD”). */
export const wielkaPierwsza = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
export const malaPierwsza = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * Pola werdyktu dla wspólnego wzoru `werdykt()` z `core/ui.ts`:
 * „Dobrze. RCA za gałęziami prawej komory.” · „Dobrze. Pasuje też: gałąź diagonalna D1, …” ·
 * „Blisko. Prawidłowo: LAD proksymalnie. Ta sama tętnica, inny odcinek.” · „Nie. Prawidłowo: RCA ….”
 */
export function werdyktMapy(right: SiteId, picked: SiteId | null): { ok: boolean; near: boolean; prawidlowo?: string; szczegol?: string } {
  const o = ocena(right, picked), odp = site(right).odp;
  if (o.ok) return picked === right
    ? { ...o, szczegol: `${wielkaPierwsza(odp)}.` }
    : { ...o, szczegol: `Pasuje też: ${odp}, z tego miejsca zbudowano ten zapis.` };
  if (o.near) return { ...o, prawidlowo: odp, szczegol: 'Ta sama tętnica, inny odcinek.' };
  return { ...o, prawidlowo: odp };
}

/** Lista odprowadzeń po polsku: „II, III i aVF”. */
export function lista(leads: readonly string[]): string {
  if (leads.length === 0) return 'brak';
  if (leads.length === 1) return leads[0] ?? '';
  return `${leads.slice(0, -1).join(', ')} i ${leads[leads.length - 1]}`;
}

/* ─────────── nakładka na raster `OBRAZY.sercePrzod` (1000 × 1000 px, widok od przodu) ─────────── */
/*
 * Współrzędne w pikselach rastra, odczytane z naczyń widocznych na obrazie (siatka 50 px na powiększeniu).
 * Prawa strona pacjenta po lewej stronie obrazu: prawy przedsionek z uszkiem po lewej, uszko lewego
 * przedsionka u góry po prawej, LAD w bruździe przedniej, koniuszek w dół w prawo (ok. 701, 845).
 */
export const RASTER_KADR = { x: 120, y: 70, w: 840, h: 880 } as const;

/** Obrys komór na rastrze (do przycięcia obszaru bez dopływu krwi). */
export const KONTUR_KOMOR = 'M300 520C296 560 298 610 310 645C340 700 420 760 500 790C570 815 640 835 701 845C735 820 756 760 757 690C758 620 748 560 728 510C715 475 705 450 690 430L640 405L607 380C580 368 520 360 490 342L470 360C440 375 405 410 385 460C360 480 320 495 300 520Z';

export const ODCINKI: Record<SegId, { d: string; tyl?: boolean; cienki?: boolean }> = {
  // pień: za pniem płucnym, niewidoczny na rastrze (przerywana)
  lm: { d: 'M496 344C530 356 575 368 607 382', tyl: true },
  lad1: { d: 'M607 382C620 400 630 420 634 452' },
  lad2: { d: 'M634 452C632 505 624 560 630 615C636 668 652 725 668 780C674 800 680 812 686 822' },
  sept1: { d: 'M630 430L612 446', cienki: true },
  sept2: { d: 'M626 560L606 572', cienki: true },
  d1: { d: 'M636 458C650 470 668 487 684 505C702 528 718 560 728 592' },
  lcx1: { d: 'M607 382C630 398 652 414 676 428C700 442 718 462 732 490' },
  lcx2: { d: 'M732 490C752 540 762 610 758 680C754 730 744 770 730 800', tyl: true },
  rca1: { d: 'M490 336C462 350 432 372 410 400C396 420 388 442 384 462' },
  rvb: { d: 'M384 462C385 480 386 498 394 512C405 526 430 540 459 549C478 557 494 574 508 598', cienki: true },
  rca2: { d: 'M384 462C370 478 350 486 336 496C320 510 308 534 304 560C300 585 300 605 304 625' },
  pda: { d: 'M304 625C330 680 390 735 470 770C540 800 600 820 660 836', tyl: true },
};

/** Punkty zamknięcia na naczyniach rastra. */
export const PUNKTY: Record<SiteId, [number, number]> = {
  pien: [556, 366], 'lad-prox': [622, 410], 'lad-dal': [627, 570], d1: [690, 514],
  okalajaca: [680, 431], tylna: [759, 640], rca: [312, 528], 'rca-pk': [440, 370],
};

export const OBSZARY: Record<RegionId, { d: string; kreska?: number; poza?: boolean }> = {
  pk: { d: 'M260 300L607 300L607 382C632 440 630 505 624 560C628 615 640 670 652 725C660 760 668 790 690 880L260 880Z' },
  przegroda: { d: 'M607 382C632 440 630 505 624 560C628 615 640 670 652 725C660 760 668 790 686 822', kreska: 44 },
  przednia: { d: 'M634 430C660 470 680 560 690 650C696 710 700 760 702 800L660 800C650 740 640 680 632 610C626 540 626 480 634 430Z' },
  'boczna-wysoka': { d: 'M640 400C690 420 730 470 748 540C752 580 748 610 740 630C720 600 700 560 680 520C662 486 648 446 640 400Z' },
  boczna: { d: 'M690 430C740 480 762 580 758 690C756 740 746 780 730 810C722 760 718 700 712 640C706 560 700 490 690 430Z' },
  koniuszek: { d: 'M600 760C640 770 680 760 730 740C745 780 730 830 701 846C660 836 620 820 590 805Z' },
  dolna: { d: 'M296 590C300 640 330 690 380 725C450 775 560 815 703 850L692 800C580 782 470 742 400 692C350 656 320 628 300 580Z' },
  tylna: { d: 'M752 470C794 540 802 680 762 806', kreska: 22, poza: true },
  podwsierdzie: { d: 'M684 470C716 470 734 560 730 650C726 740 706 790 690 776C668 760 662 680 664 600C666 530 670 472 684 470Z', kreska: 16 },
};

/** Podpisy stałe z liniami odniesienia: punkt na naczyniu → miejsce podpisu poza sercem. */
export const PODPISY: ReadonlyArray<{ t: string; at: [number, number]; to: [number, number]; anchor: 'start' | 'end' }> = [
  { t: 'aorta', at: [440, 220], to: [290, 120], anchor: 'end' },
  { t: 'pień', at: [556, 366], to: [650, 120], anchor: 'start' },
  { t: 'LCx', at: [706, 450], to: [800, 380], anchor: 'start' },
  { t: 'D1', at: [712, 548], to: [790, 500], anchor: 'start' },
  { t: 'LAD', at: [646, 700], to: [800, 720], anchor: 'start' },
  { t: 'RCA', at: [302, 590], to: [250, 620], anchor: 'end' },
];
