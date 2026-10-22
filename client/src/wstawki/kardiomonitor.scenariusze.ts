/**
 * Scenariusze kardiomonitora. Każdy ma id (do `::wstawka kardiomonitor scenariusz=<id>` i do pytań),
 * nazwę, jedno zdanie opisu, odprowadzenia, rytm i parametry. Wartości liczbowe pochodzą z wykładów,
 * cytaty są w `kardiomonitor.karta.ts`.
 *
 * Pierwsze osiem (BAZOWE) to rytmy z dyrektywy `::ekg` — monitor w wariancie kompaktowym zastępuje
 * dawne gołe krzywe w wykładach.
 */
import type { Scenariusz } from './core/kardiomonitor.js';
import type { Zrodlo } from './core/zrodla.js';
import { asystolia, blokAV, migotanie, migotanieKomor, miarowyBezP, rozkojarzenie, torsade, trzepotanie, zatokowy } from './core/rytmy.js';
import type { EkgRhythm } from '@helloekg/shared';
import { SCENARIUSZE_A } from './kardiomonitor.scenariusze-a.js';
import { SCENARIUSZE_B } from './kardiomonitor.scenariusze-b.js';

const RCA_DOLNY = { dir: [-0.25, 0.94, 0.02] as const, st: 0.3 };

export const BAZOWE: Record<EkgRhythm, Scenariusz> = {
  sinus: { id: 'sinus', grupa: 'Rytm i częstość', nazwa: 'Rytm zatokowy', opis: 'Rytm zatokowy miarowy, 75/min: przed każdym QRS załamek P.', odprowadzenia: ['II'], rytm: () => zatokowy({ hr: 75, hrv: 0.02 }), pleth: true },
  brady: { id: 'brady', grupa: 'Rytm i częstość', nazwa: 'Bradykardia zatokowa', opis: 'Rytm zatokowy 48/min, poniżej zakresu 60-100/min.', odprowadzenia: ['II'], rytm: () => zatokowy({ hr: 48, hrv: 0.01 }), pleth: true },
  tachy: { id: 'tachy', grupa: 'Rytm i częstość', nazwa: 'Tachykardia zatokowa', opis: 'Rytm zatokowy 120/min, powyżej zakresu 60-100/min.', odprowadzenia: ['II'], rytm: () => zatokowy({ hr: 120, hrv: 0.01, pr: 0.14 }), pleth: true },
  af: { id: 'af', grupa: 'Rytm i częstość', nazwa: 'Migotanie przedsionków', opis: 'Brak załamków P, fala f i zupełnie niemiarowe odstępy RR, około 80/min.', odprowadzenia: ['II'], rytm: () => migotanie({ hr: 80, seed: 9 }), pleth: true },
  aflutter: { id: 'aflutter', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'Trzepotanie przedsionków 2:1', opis: 'Fale F jak zęby piły około 300/min, komory około 150/min.', odprowadzenia: ['II'], rytm: () => trzepotanie({ fala: 300, ratio: 2 }), pleth: true },
  avb1: { id: 'avb1', grupa: 'Przewodzenie i bloki', nazwa: 'Blok AV I stopnia', opis: 'PQ 0,24 s, każde P przewiedzione.', odprowadzenia: ['II'], rytm: () => zatokowy({ hr: 75, pr: 0.24, hrv: 0.01 }), pleth: true },
  wenckebach: { id: 'wenckebach', grupa: 'Przewodzenie i bloki', nazwa: 'Blok AV II stopnia typu Mobitz I', opis: 'PQ 0,16, 0,28 i 0,36 s, potem P bez QRS i powrót do 0,16 s.', odprowadzenia: ['II'], rytm: () => blokAV({ pp: 0.8, pq: [0.16, 0.28, 0.36, null] }), pleth: true },
  avb3: { id: 'avb3', grupa: 'Przewodzenie i bloki', nazwa: 'Blok AV III stopnia', opis: 'P 75/min i QRS 30/min idą osobno.', odprowadzenia: ['II'], rytm: () => rozkojarzenie({ pp: 0.8, rr: 2.0 }), pleth: true },
};

/** Scenariusze do konkretnych plansz wykładów i do pytań. */
export const SCENARIUSZE: Scenariusz[] = [
  {
    id: 'stemi-dolny-blok', grupa: 'Niedokrwienie i zawał', nazwa: 'STEMI ściany dolnej z blokiem AV III stopnia', miejsce: 'Łóżko 4 · SOR', zegar: '03:12:40',
    opis: 'Załamki P 75/min i wąskie QRS 40/min bez związku z P, uniesienie ST w II i III z obniżeniem w aVL.',
    odprowadzenia: ['II', 'III', 'aVL'], st: true, pleth: true,
    rytm: () => rozkojarzenie({ pp: 0.8, rr: 1.5, beat: { injury: RCA_DOLNY } }),
  },
  {
    id: 'vf', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'Migotanie komór', miejsce: 'Łóżko 2 · OIOK', alarm: { tekst: 'VF' },
    opis: 'Chaotyczna fala bez zespołów QRS i bez tętna.', odprowadzenia: ['II', 'V1'], spo2: null,
    rytm: () => migotanieKomor({ grube: true }),
  },
  {
    id: 'vt', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'Częstoskurcz komorowy', miejsce: 'Łóżko 2 · OIOK', alarm: { tekst: 'VT' },
    opis: 'Szybki, miarowy rytm 180/min z szerokimi zespołami QRS.', odprowadzenia: ['II', 'V1'], pleth: true,
    rytm: () => miarowyBezP({ hr: 180, beat: { qrs: 'vent', qt: 0.3 } }),
  },
  {
    id: 'asystolia', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'Asystolia', miejsce: 'Łóżko 2 · OIOK', alarm: { tekst: 'Asystolia' },
    opis: 'Prawie płaska linia, brak zespołów QRS.', odprowadzenia: ['II', 'V1'], spo2: null,
    rytm: () => asystolia(),
  },
  {
    id: 'pea', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'Aktywność elektryczna bez tętna', miejsce: 'Łóżko 2 · OIOK',
    opis: 'Na monitorze zorganizowany rytm, ale fala SpO₂ jest płaska: pacjent nie ma tętna.', odprowadzenia: ['II'], spo2: null, pleth: true,
    rytm: () => zatokowy({ hr: 75, tetno: false }),
  },
  {
    id: 'tdp', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'Torsade de pointes', miejsce: 'Łóżko 6 · Kardiologia', alarm: { tekst: 'VT' },
    opis: 'Zespoły zmieniają kształt i kierunek: przez kilka pobudzeń przeważają wychylenia dodatnie, potem ujemne.', odprowadzenia: ['II'], spo2: null,
    rytm: () => torsade({ hr: 230 }),
  },
];

/** Źródła liczb ze scenariuszy bazowych i powyższych (część karty). */
export const ZRODLA_BAZOWE: Zrodlo[] = [
  { wartosc: 'Rytm zatokowy 75/min', wyklad: 'S1_02', plansza: 'Liczenie częstości w rytmie miarowym: reguła 300 i reguła 1500', cytat: 'Jeśli mijasz cztery duże kratki, odstęp RR trwa 0,80 s, a częstość wynosi 300 ÷ 4, czyli 75/min.' },
  { wartosc: 'Bradykardia zatokowa 48/min, tachykardia zatokowa 120/min', wyklad: 'S1_02', plansza: 'Czy to rytm zatokowy? Cztery pytania', cytat: 'przy 48/min mówimy o bradykardii zatokowej, a przy 120/min o tachykardii zatokowej' },
  { wartosc: 'Migotanie przedsionków około 80/min (8 QRS w 6 s)', wyklad: 'S1_02', plansza: 'Rytm niemiarowy: metoda sześciu sekund', cytat: 'Jeśli w takim odcinku widzisz osiem zespołów, średnia częstość w tym fragmencie wynosi około 80/min.' },
  { wartosc: 'Blok AV I stopnia z PQ 0,24 s', wyklad: 'S1_02', plansza: 'Czy to rytm zatokowy? Cztery pytania', cytat: 'a PQ trwa sześć małych kratek, czyli 0,24 s, opisujesz rytm zatokowy z blokiem AV I stopnia' },
  { wartosc: 'Torsade de pointes: na zmianę wychylenia dodatnie i ujemne', wyklad: 'S2_05', plansza: 'Wydłużony QT i torsade de pointes', cytat: 'przez kilka pobudzeń przeważają wychylenia dodatnie, potem ujemne, a ich wysokość stopniowo rośnie i maleje' },
  { wartosc: 'VT 180/min', wyklad: 'S5_04', plansza: 'Jak ICD gasi pożar: ATP i wyładowanie', cytat: 'Przy częstoskurczu 180/min odstęp między pobudzeniami wynosi około 0,33 s' },
];

/** Grupy galerii w kolejności wyświetlania; każdy scenariusz ma jedną z nich w `grupa`. */
export const GRUPY = [
  'Rytm i częstość',
  'Przewodzenie i bloki',
  'Niedokrwienie i zawał',
  'QT, elektrolity i przerosty',
  'Stymulatory i ICD',
  'Częstoskurcze i zatrzymanie krążenia',
] as const;
export type Grupa = (typeof GRUPY)[number];
const nrGrupy = (s: Scenariusz) => { const i = (GRUPY as readonly string[]).indexOf(s.grupa ?? ''); return i < 0 ? GRUPY.length : i; };

/** Wszystkie scenariusze ułożone według GRUPY (w grupie: bazowe, wzorcowe, A, B); pierwszy jest rytm zatokowy. */
export const WSZYSTKIE: Scenariusz[] = [...Object.values(BAZOWE), ...SCENARIUSZE, ...SCENARIUSZE_A, ...SCENARIUSZE_B]
  .map((s, i) => ({ s, i })).sort((a, b) => nrGrupy(a.s) - nrGrupy(b.s) || a.i - b.i).map((x) => x.s);
export const scenariusz = (id: string): Scenariusz | undefined => WSZYSTKIE.find((s) => s.id === id);
