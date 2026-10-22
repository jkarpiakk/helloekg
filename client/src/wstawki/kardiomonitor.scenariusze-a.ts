/**
 * Scenariusze kardiomonitora, część A (wykłady S1_00-S3_05). Wzór scenariusza: `kardiomonitor.scenariusze.ts`.
 * Każda liczba pokazywana kursantowi ma cytat w ZRODLA_A (test cytatów), a testy
 * `web/test/wstawki/kardiomonitor-a.test.ts` sprawdzają, że zapis z generatora daje te same liczby.
 *
 * Plik bez DOM: importuje go karta (test cytatów w środowisku node).
 */
import type { Scenariusz } from './core/kardiomonitor.js';
import type { Zrodlo } from './core/zrodla.js';
import { LEADS, dot, norm3, type Beat, type BeatOpts, type LeadName, type V3 } from './core/model.js';
import { bgAF, pComps, vBeat } from './core/rytm.js';
import { blokAV, fazy, miarowyBezP, zatokowy, type Generator } from './core/rytmy.js';
import { site } from './mapa-zawalu.dane.js';

/* ─────────── wartości z tekstu (cytaty w ZRODLA_A) ─────────── */

/** Częstość tam, gdzie plansza jej nie podaje: przykład rytmu prawidłowego z S1_00 („75/min”). */
export const HR_TLO = 75;

/** S1_02: P co 0,60 s (100/min), co drugie przewiedzione, QRS co 1,20 s (50/min). */
export const PP_2_1 = 0.6;
/** PQ pobudzeń przewiedzionych w 2:1: tekst nie podaje, wartość prawidłowa (doOkaJK). */
export const PQ_2_1 = 0.16;

/**
 * S1_02: osiem zespołów w 6 s, czyli średnio około 80/min. Odstępy RR w s, suma 6,0:
 * wzór powtarza się co 6 s, więc każdy ciągły odcinek 6 s zawiera dokładnie osiem QRS.
 */
export const RR_AF = [0.55, 0.95, 0.62, 0.88, 1.02, 0.5, 0.83, 0.65] as const;
/** Po odstępie RR nie dłuższym niż ten (s) skurcz nie daje fali tętna: próg dydaktyczny (doOkaJK). */
export const RR_BEZ_TETNA = 0.55;

/** S1_00: QRS co sekundę (60/min), potem przerwa i rytm zastępczy z łącza (zakres 40-60/min, dolna granica). */
export const HR_ZATOKA = 60;
export const HR_LACZE = 40;
/** Fazy scenariusza z rytmem zastępczym (s): zatoka do 6 s, przerwa, łącze od 6,6 s, pętla 15 s. */
export const LACZE_FAZY = { zatokaDo: 6, laczeOd: 6.6, petla: 15 } as const;

/** S1_00: PQ 0,24 s z QRS 0,08 s oraz PQ 0,16 s z QRS 0,16 s. */
export const PQ_DLUGI = 0.24, QRS_WASKI = 0.08;
export const PQ_NORMA = 0.16, QRS_SZEROKI = 0.16;
/** Prawidłowy QRS w modelu trwa 0,09 s; `qrsWide` rozciąga go do zadanego czasu. */
const QRS_MODEL = 0.09;

/** S2_02: PQ 0,10 s do początku fali delta. W modelu delta zaczyna się 0,03 s przed t = 0, stąd `pr` 0,13 s. */
export const PQ_DELTA = 0.1;
export const PR_WPW_MODEL = 0.13;

/** S2_05: QT 0,40 s, RR 0,64 s (około 94/min), QTc Bazetta 0,50 s. `qt` w modelu dobrane tak, by qtMs = 400. */
export const QT_DLUGI = 0.4, RR_QT = 0.64;
export const QT_MODEL = 0.3895;

/** S1_02: tachykardia zatokowa 120/min (u pacjenta z podejrzeniem zatorowości, S3_02). */
export const HR_TACHY = 120;

/* ─────────── wektory uszkodzenia ─────────── */

/** Wielkość wektora uszkodzenia [mV], przy której odprowadzenie `lead` pokaże `mm` milimetrów ST. */
export const stNaMm = (dir: V3, lead: LeadName, mm: number): number =>
  mm / 10 / (dot(norm3(dir), LEADS[lead].u) * LEADS[lead].gain);

/**
 * Zawał dolny z prawą komorą (S3_05): kierunek „RCA z PK” z mapy zawału, skalowany tak, by III = 2 mm.
 * II wychodzi wtedy 1,1 mm, V4R 0,7 mm, a w I i aVL obniżenie.
 */
const RCA_PK = site('rca-pk').dir;
const RCA_PK_ST = stNaMm(RCA_PK, 'III', 2);

/**
 * Uniesienie po 2 mm w V2 i V3 (S3_03): kierunek w płaszczyźnie poziomej pod kątem ok. 74°,
 * między LAD proksymalną a dalszą z mapy zawału, jedyny, przy którym V2 = V3.
 */
const PRZOD: V3 = [
  LEADS.V2.gain * LEADS.V2.u[2] - LEADS.V3.gain * LEADS.V3.u[2],
  0,
  LEADS.V3.gain * LEADS.V3.u[0] - LEADS.V2.gain * LEADS.V2.u[0],
];
const PRZOD_ST = stNaMm(PRZOD, 'V2', 2);

/** Poziome obniżenie ST o 1 mm w V4 i V5 (S3_03): wektor uszkodzenia skierowany od tych kamer. */
const OD_V4V5: V3 = [-0.949, 0, -0.3153];
const OD_V4V5_ST = stNaMm(OD_V4V5, 'V4', -1);

/** Nadostre T (S2_04): faza „nadostre T” z mapy zawału dla dalszej LAD, ST jeszcze bez uniesienia. */
const LAD_DAL = site('lad-dal');

/* ─────────── generatory, których nie ma w core ─────────── */

/** Migotanie przedsionków o stałym wzorze RR; po krótkim RR pobudzenie bez fali tętna (deficyt tętna). */
export function migotanieZDeficytem(o: { rr: readonly number[]; bezTetna: number; beat?: BeatOpts }): Generator {
  const b = vBeat(o.beat ?? {});
  let next = 0.4, k = 0, init = false;
  return (strip, until) => {
    if (!init) { strip.backgrounds.push(bgAF(0.05)); init = true; }
    while (next < until) {
      const rr = o.rr[k % o.rr.length] ?? 1;
      const at = next + rr;
      strip.add({ kind: 'QRS', at, beat: b, tag: rr <= o.bezTetna + 1e-9 ? 'qrs-bt' : 'qrs' });
      next = at; k++;
    }
  };
}

/** Rytm zatokowy z gotowym pobudzeniem komór (gdy kształt trzeba poprawić poza `BeatOpts`). */
export function zatokowyZ(b: Beat, o: { hr: number; pr?: number }): Generator {
  const rr = 60 / o.hr, pr = o.pr ?? 0.16, pc = pComps('normal');
  let next = 0.4;
  return (strip, until) => {
    while (next < until) {
      strip.add({ kind: 'P', at: next - pr, comps: pc, tag: 'p' });
      strip.add({ kind: 'QRS', at: next, beat: b, tag: 'qrs' });
      next += rr;
    }
  };
}

/**
 * Nadostre T (S2_04): faza „nadostre T” z mapy zawału dla dalszej LAD, ST bez uniesienia.
 * Model rysuje T asymetrycznie (wolniejsze narastanie), a tekst opisuje T symetryczne, więc obie
 * połowy T dostają tę samą szerokość (średnią z modelu); `qt` 0,35 trzyma koniec T tam, gdzie był.
 */
export function beatNadostreT(): Beat {
  const b = vBeat({ qt: 0.35, tSharp: 0.8, injury: { dir: LAD_DAL.dir, st: 0, hyperT: LAD_DAL.hyperT } });
  const t0 = b.t[0]!;
  const w = (t0.w + (t0.w2 ?? t0.w)) / 2;
  return { ...b, t: [{ ...t0, w, w2: w }], qtMs: Math.round((b.tPeak + w * 1.9) * 1000) };
}

/**
 * Szeroki QRS bez kształtu bloku z wtórnymi zmianami repolaryzacji (S2_04): T przeciwny do głównego
 * wychylenia QRS (wektor T = minus średni wektor QRS), ST lekko przesunięty w tę samą stronę co T.
 */
export const T_WTORNY = 0.3, ST_WTORNY = 0.06;
export function beatSzerokiWtorny(qrsS: number): Beat {
  const b = vBeat({ qrsWide: qrsS / QRS_MODEL });
  const m = norm3(b.qrs.reduce<V3>((a, k) => [a[0] + k.v[0] * k.w, a[1] + k.v[1] * k.w, a[2] + k.v[2] * k.w], [0, 0, 0]));
  const t0 = b.t[0]!;
  return {
    ...b,
    t: [{ ...t0, v: [-m[0] * T_WTORNY, -m[1] * T_WTORNY, -m[2] * T_WTORNY] }],
    st: [-m[0] * ST_WTORNY, -m[1] * ST_WTORNY, -m[2] * ST_WTORNY],
  };
}

/**
 * Rytm zatokowy z pojedynczym dodatkowym pobudzeniem komorowym co `co` pobudzeń. Zatokowe P,
 * które wypada w czasie pobudzenia dodatkowego, zostaje narysowane (schowane w jego ST-T) i nie
 * przewodzi się do komór; następne P i QRS przychodzą we własnym rytmie (S1_02: szukaj P w T).
 */
export function zatokowyZPvc(o: { hr: number; co: number; sprzezenie: number; pvc: BeatOpts; pr?: number }): Generator {
  const rr = 60 / o.hr, pr = o.pr ?? 0.16, pc = pComps('normal');
  const b = vBeat({ pr }), bp = vBeat(o.pvc);
  let next = 0.4, n = 0;
  return (strip, until) => {
    while (next < until) {
      n++;
      if (n % o.co === 0) {
        strip.add({ kind: 'QRS', at: next - rr + o.sprzezenie, beat: bp, tag: 'qrs' });
        strip.add({ kind: 'P', at: next - pr, comps: pc, tag: 'p-blok' });
      } else {
        strip.add({ kind: 'P', at: next - pr, comps: pc, tag: 'p' });
        strip.add({ kind: 'QRS', at: next, beat: b, tag: 'qrs' });
      }
      next += rr;
    }
  };
}

/** Nic nie dopisuje: przerwa między fazami (dyrygent zamilkł, muzyk jeszcze nie wszedł). */
const cisza = (): Generator => () => {};

/* ─────────── scenariusze ─────────── */

export const SCENARIUSZE_A: Scenariusz[] = [
  {
    id: 'przewodzenie-2-1', grupa: 'Przewodzenie i bloki', nazwa: 'Blok AV 2:1, przedsionki 100/min', miejsce: 'Łóżko 3 · SOR', okno: 6,
    opis: 'P co 0,60 s, czyli 100/min, a QRS co 1,20 s, czyli 50/min: do komór przechodzi co drugie pobudzenie przedsionków.',
    odprowadzenia: ['II'],
    rytm: () => blokAV({ pp: PP_2_1, pq: [PQ_2_1, null] }),
  },
  {
    id: 'migotanie-deficyt-tetna', grupa: 'Rytm i częstość', nazwa: 'Migotanie przedsionków z deficytem tętna', miejsce: 'Łóżko 5 · Interna', okno: 6, start: 3,
    opis: 'Brak P i zupełnie niemiarowe RR: osiem QRS w 6 s, czyli średnio około 80/min, a po krótkich RR brak fali tętna.',
    odprowadzenia: ['II'], pleth: true,
    rytm: () => migotanieZDeficytem({ rr: RR_AF, bezTetna: RR_BEZ_TETNA }),
  },
  {
    id: 'rytm-zastepczy-z-lacza', grupa: 'Rytm i częstość', nazwa: 'Rytm zastępczy z łącza', miejsce: 'Łóżko 2 · Kardiologia',
    opis: 'QRS co sekundę, 60/min, potem przerwa i wąskie QRS 40/min bez P przed zespołem, z ujemnym P tuż za nim.',
    odprowadzenia: ['II'], start: 6, okno: 7,
    rytm: () => fazy([
      { od: 0, gen: () => zatokowy({ hr: HR_ZATOKA }) },
      { od: LACZE_FAZY.zatokaDo, gen: cisza },
      { od: LACZE_FAZY.laczeOd, gen: () => miarowyBezP({ hr: HR_LACZE, beat: { qrs: 'normal' }, ptyl: 'retro' }) },
    ], LACZE_FAZY.petla),
  },
  {
    id: 'pobudzenie-przedwczesne', grupa: 'Rytm i częstość', nazwa: 'Dodatkowe pobudzenie komorowe', miejsce: 'Łóżko 2 · Kardiologia',
    opis: 'Rytm zatokowy 60/min, QRS co sekundę, a pojedynczy szeroki zespół bez P wyprzedza zwykłą sekundę i po nim przychodzi dłuższa przerwa.',
    odprowadzenia: ['II', 'V1'], start: 4,
    rytm: () => zatokowyZPvc({ hr: HR_ZATOKA, co: 5, sprzezenie: 0.62, pvc: { qrs: 'pvc-rv' } }),
  },
  {
    id: 'dlugie-pq-waski-qrs', grupa: 'Przewodzenie i bloki', nazwa: 'Blok AV I stopnia z wąskim QRS', miejsce: 'Łóżko 6 · Kardiologia',
    opis: 'PQ 0,24 s, QRS 0,08 s, 75/min: impuls długo czeka przy bramie AV, a potem jedzie autostradą.',
    odprowadzenia: ['II'],
    rytm: () => zatokowy({ hr: HR_TLO, pr: PQ_DLUGI, beat: { qrsWide: QRS_WASKI / QRS_MODEL } }),
  },
  {
    id: 'prawidlowe-pq-szeroki-qrs', grupa: 'Przewodzenie i bloki', nazwa: 'Prawidłowe PQ, szeroki QRS', miejsce: 'Łóżko 6 · Kardiologia',
    opis: 'PQ 0,16 s i QRS 0,16 s, 75/min: brama przepuszcza impuls na czas, dłużej trwa pobudzanie komór.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => zatokowyZ(beatSzerokiWtorny(QRS_SZEROKI), { hr: HR_TLO, pr: PQ_NORMA }),
  },
  {
    id: 'preekscytacja', grupa: 'Przewodzenie i bloki', nazwa: 'Krótkie PQ i fala delta', miejsce: 'Łóżko 1 · SOR',
    opis: 'PQ 0,10 s, łagodnie narastający początek QRS, czyli fala delta, i poszerzony zespół, 75/min.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => zatokowy({ hr: HR_TLO, pr: PR_WPW_MODEL, beat: { qrs: 'wpw' } }),
  },
  {
    id: 'zawal-dolny-prawa-komora', grupa: 'Niedokrwienie i zawał', nazwa: 'Zawał dolny z zajęciem prawej komory', miejsce: 'Łóżko 4 · SOR', zegar: '05:41:10',
    opis: 'Ból w klatce piersiowej: ST uniesiony o 2 mm w III i o 1 mm w II, w V4R o 0,5 mm, 75/min.',
    odprowadzenia: ['II', 'III', 'V4R'], st: true,
    rytm: () => zatokowy({ hr: HR_TLO, beat: { injury: { dir: RCA_PK, st: RCA_PK_ST } } }),
  },
  {
    id: 'uniesienie-st-v2-v3', grupa: 'Niedokrwienie i zawał', nazwa: 'Uniesienie ST w V2 i V3', miejsce: 'Łóżko 1 · SOR', zegar: '22:07:35',
    opis: '55-letni mężczyzna z bólem w klatce piersiowej: ST uniesiony po 2 mm w V2 i V3, 75/min.',
    odprowadzenia: ['V2', 'V3'], st: true,
    rytm: () => zatokowy({ hr: HR_TLO, beat: { injury: { dir: PRZOD, st: PRZOD_ST } } }),
  },
  {
    id: 'obnizenie-st-v4-v5', grupa: 'Niedokrwienie i zawał', nazwa: 'Poziome obniżenie ST w V4 i V5', miejsce: 'Łóżko 3 · Interna',
    opis: 'Nowy ucisk w klatce piersiowej: w V4 i V5 punkt J leży 1 mm poniżej linii, a ST biegnie dalej poziomo, 75/min.',
    odprowadzenia: ['V4', 'V5'], st: true,
    rytm: () => zatokowy({ hr: HR_TLO, beat: { qt: 0.39, tSharp: 1.2, injury: { dir: OD_V4V5, st: OD_V4V5_ST } } }),
  },
  {
    id: 'nadostre-t', grupa: 'Niedokrwienie i zawał', nazwa: 'Nadostre załamki T', miejsce: 'Łóżko 1 · SOR', zegar: '04:55:20',
    opis: 'Trwający ból: w V2, V3 i V4 szerokie, symetryczne T, duże względem QRS, a ST jeszcze bez uniesienia, 75/min.',
    odprowadzenia: ['V2', 'V3', 'V4'],
    rytm: () => zatokowyZ(beatNadostreT(), { hr: HR_TLO }),
  },
  {
    id: 'qtc-500', grupa: 'QT, elektrolity i przerosty', nazwa: 'Wydłużony QTc', miejsce: 'Łóżko 7 · Kardiologia',
    opis: 'QT 0,40 s przy RR 0,64 s, około 94/min: po korekcji Bazetta QTc wynosi 500 ms.',
    odprowadzenia: ['II', 'V5'],
    rytm: () => zatokowy({ hr: 60 / RR_QT, beat: { qt: QT_MODEL } }),
  },
  {
    id: 'przerost-lk-przeciazenie', grupa: 'QT, elektrolity i przerosty', nazwa: 'Przerost lewej komory z przeciążeniem', miejsce: 'Łóżko 8 · Interna',
    opis: 'Wieloletnie nadciśnienie: w V5 i V6 wysokie R, skośne obniżenie ST i asymetrycznie ujemny T, 75/min.',
    odprowadzenia: ['V5', 'V6'],
    rytm: () => zatokowy({ hr: HR_TLO, beat: { qrs: 'lvh', axis: 0, strain: 0.3 } }),
  },
  {
    id: 'zatorowosc-tachykardia-rbbb', grupa: 'QT, elektrolity i przerosty', nazwa: 'Tachykardia zatokowa z nowym RBBB', miejsce: 'Łóżko 2 · SOR', zegar: '14:20:05',
    opis: 'Nagła duszność: tachykardia zatokowa 120/min, P przed każdym QRS, a w V1 szeroki zespół z końcowym R′.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => zatokowy({ hr: HR_TACHY, pr: 0.14, beat: { qrs: 'rbbb', qt: 0.3 } }),
  },
];

/* ─────────── miejsca i źródła ─────────── */

const S1_00_HIER = 'Hierarchia rozruszników: wbudowany system bezpieczeństwa';
const S1_00_HISA = 'Pęczek Hisa, odnogi i włókna Purkinjego: szybka sieć rozprowadzająca';
const S1_00_ZAPIS = 'Od układu przewodzącego do zapisu EKG';
const S1_02_SZESC = 'Rytm niemiarowy: metoda sześciu sekund';
const S1_02_ZATOKA = 'Czy to rytm zatokowy? Cztery pytania';
const S1_02_SLOWNIK = 'Miarowość, bradykardia, tachykardia i co dalej';
const S2_01_BRAK_P = 'Gdy załamka P brakuje albo wygląda inaczej';
const S2_02_KROTKIE = 'Zbyt krótkie PQ: preekscytacja';
const S2_04_T = 'Obniżenie odcinka ST i zmiany załamka T';
const S2_05_QTC = 'Dlaczego QT trzeba korygować: QTc';
const S2_05_TDP = 'Wydłużony QT i torsade de pointes';
const S3_01_STRAIN = 'Cechy towarzyszące: przeciążenie (strain) i powiększenie przedsionka';
const S3_02_ZATOR = 'Przyczyny przewlekłe i ostre, w tym zatorowość płucna';
const S3_03_OBN = 'Obniżenie ST: niedokrwienie podwsierdziowe';
const S3_03_UN = 'Uniesienie ST: niedokrwienie pełnościenne';
const S3_05_DOLNA = 'Ściana dolna i przednia';
const S3_05_PK = 'Prawa komora, odprowadzenia dodatkowe i nawyk mapowania';

export const MIEJSCA_A: Array<{ wyklad: string; plansza: string }> = [
  { wyklad: 'S1_02', plansza: S1_02_SZESC }, // przewodzenie-2-1, migotanie-deficyt-tetna
  { wyklad: 'S1_02', plansza: S1_02_SLOWNIK }, // przewodzenie-2-1 (opis 2:1)
  { wyklad: 'S1_00', plansza: S1_00_HIER }, // rytm-zastepczy-z-lacza, pobudzenie-przedwczesne
  { wyklad: 'S2_01', plansza: S2_01_BRAK_P }, // rytm-zastepczy-z-lacza (wsteczne P za QRS)
  { wyklad: 'S1_00', plansza: S1_00_HISA }, // dlugie-pq-waski-qrs, prawidlowe-pq-szeroki-qrs
  { wyklad: 'S2_02', plansza: S2_02_KROTKIE }, // preekscytacja
  { wyklad: 'S3_05', plansza: S3_05_PK }, // zawal-dolny-prawa-komora
  { wyklad: 'S3_05', plansza: S3_05_DOLNA }, // zawal-dolny-prawa-komora (II i III)
  { wyklad: 'S3_03', plansza: S3_03_UN }, // uniesienie-st-v2-v3
  { wyklad: 'S3_03', plansza: S3_03_OBN }, // obnizenie-st-v4-v5
  { wyklad: 'S2_04', plansza: S2_04_T }, // nadostre-t
  { wyklad: 'S2_05', plansza: S2_05_QTC }, // qtc-500
  { wyklad: 'S2_05', plansza: S2_05_TDP }, // qtc-500 (monitorowanie przy QTc ≥ 500 ms)
  { wyklad: 'S3_01', plansza: S3_01_STRAIN }, // przerost-lk-przeciazenie
  { wyklad: 'S3_02', plansza: S3_02_ZATOR }, // zatorowosc-tachykardia-rbbb
];

export const ZRODLA_A: Zrodlo[] = [
  // przewodzenie-2-1
  { wartosc: 'P co 0,60 s = 100/min', wyklad: 'S1_02', plansza: S1_02_SZESC, cytat: 'Wyobraź sobie miarowe P co 0,60 s, czyli 100 pobudzeń przedsionków na minutę.' },
  { wartosc: 'Co drugie P przewiedzione, QRS co 1,20 s = 50/min', wyklad: 'S1_02', plansza: S1_02_SZESC, cytat: 'Jeśli przez bramę do komór przechodzi co drugie z nich, QRS pojawiają się co 1,20 s, czyli 50/min.' },
  { wartosc: 'Przewodzenie AV 2:1', wyklad: 'S1_02', plansza: S1_02_SLOWNIK, cytat: 'częstość przedsionków 100/min, częstość komór 50/min i przewodzenie AV 2:1' },
  // migotanie-deficyt-tetna
  { wartosc: 'Osiem QRS w 6 s = około 80/min', wyklad: 'S1_02', plansza: S1_02_SZESC, cytat: 'Jeśli w takim odcinku widzisz osiem zespołów, średnia częstość w tym fragmencie wynosi około 80/min.' },
  { wartosc: 'Odcinek 6 s, liczba QRS × 10', wyklad: 'S1_02', plansza: S1_02_SZESC, cytat: 'wyznaczamy na zapisie odcinek trwający 6 sekund (to 30 dużych kratek), liczymy w nim zespoły QRS i mnożymy ich liczbę przez 10' },
  { wartosc: 'Po krótkim RR skurcz bez wyczuwalnej fali tętna', wyklad: 'S1_02', plansza: S1_02_SZESC, cytat: 'Po krótkim odstępie RR komory mają mniej czasu na napełnienie, więc część skurczów wyrzuca zbyt mało krwi, żeby wytworzyć wyczuwalną falę tętna.' },
  { wartosc: 'Deficyt tętna', wyklad: 'S1_02', plansza: S1_02_SZESC, cytat: 'Różnicę między częstością pracy serca a tętnem wyczuwalnym na obwodzie nazywamy deficytem tętna.' },
  { wartosc: 'Migotanie: brak P, RR zupełnie niemiarowe', wyklad: 'S1_02', plansza: S1_02_ZATOKA, cytat: 'w którym nie ma powtarzalnych załamków P, a odstępy RR są całkowicie niemiarowe' },
  // rytm-zastepczy-z-lacza, pobudzenie-przedwczesne
  { wartosc: 'QRS co sekundę, pobudzenie zastępcze po dłuższej przerwie', wyklad: 'S1_00', plansza: S1_00_HIER, cytat: 'Jeśli QRS występowały co sekundę, a kolejny zjawia się dopiero po wyraźnie dłuższej przerwie, szukasz mechanizmu zastępczego' },
  { wartosc: 'Cykl 1 s = 60/min', wyklad: 'S1_00', plansza: 'Serce, które bije samo: zjawisko automatyzmu', cytat: 'Jeśli od pobudzenia do pobudzenia mija sekunda, powstaje 60 impulsów na minutę' },
  { wartosc: 'Rytm zastępczy z łącza 40/min (zakres 40-60/min)', wyklad: 'S1_00', plansza: S1_00_HIER, cytat: 'rytm zastępczy z łącza, typowo około 40-60/min' },
  { wartosc: 'Rytm z łącza: wąskie QRS', wyklad: 'S1_00', plansza: S1_00_HIER, cytat: 'Rytm z łącza ma zwykle wąskie QRS' },
  { wartosc: 'P wsteczne po QRS, ujemne w II', wyklad: 'S1_00', plansza: S1_00_HIER, cytat: 'i wtedy P wypada przed QRS, chowa się w nim albo pojawia się po nim, często ujemne w odprowadzeniach dolnych' },
  { wartosc: 'Ujemne wychylenie tuż po każdym QRS: wsteczne pobudzenie przedsionków', wyklad: 'S2_01', plansza: S2_01_BRAK_P, cytat: 'Jeśli ujemne wychylenie powtarza się bezpośrednio po każdym QRS, rozważ wsteczne pobudzenie przedsionków.' },
  { wartosc: 'Zespół wyprzedzający zwykłą sekundę: pobudzenie przedwczesne', wyklad: 'S1_00', plansza: S1_00_HIER, cytat: 'jeśli dodatkowy zespół wyprzedza zwykłą sekundę, szukasz pobudzenia przedwczesnego' },
  { wartosc: 'Dodatkowe pobudzenie komorowe: szeroki zespół przed czasem, bez przewiedzionego P', wyklad: 'S1_00', plansza: 'Dlaczego to się opłaca zrozumieć: zapowiedź zastosowań klinicznych', cytat: 'Przy dodatkowym pobudzeniu komorowym impuls rodzi się natomiast w samej komorze, więc szeroki zespół może pojawić się przed czasem i bez poprzedzającego go przewiedzionego P.' },
  // dlugie-pq-waski-qrs, prawidlowe-pq-szeroki-qrs
  { wartosc: 'PQ 0,24 s i QRS 0,08 s: czekanie przy bramie, potem autostrada', wyklad: 'S1_00', plansza: S1_00_HISA, cytat: 'Pacjent może mieć PQ wynoszący 0,24 s i QRS wynoszący 0,08 s: impuls długo czekał przy bramie, ale potem pojechał autostradą' },
  { wartosc: 'PQ 0,16 s i QRS 0,16 s: wydłużone pobudzanie komór', wyklad: 'S1_00', plansza: S1_00_HISA, cytat: 'W innym zapisie PQ wynosi 0,16 s, a QRS również 0,16 s. Tym razem brama przepuściła impuls na czas, a wydłużył się etap rozchodzenia się pobudzenia po komorach.' },
  { wartosc: 'QRS szeroki od 120 ms', wyklad: 'S1_00', plansza: S1_00_HISA, cytat: 'a od 120 ms QRS jest szeroki' },
  { wartosc: 'PQ > 0,20 s, każde P przewiedzione: blok AV I stopnia', wyklad: 'S1_00', plansza: 'Przez przedsionki do węzła AV: dlaczego potrzebne jest opóźnienie', cytat: 'Jeśli mimo to każde P przewodzi do komór, taki obraz odpowiada blokowi AV I stopnia.' },
  { wartosc: 'Częstość 75/min (tło scenariuszy, w których plansza nie podaje częstości)', wyklad: 'S1_00', plansza: S1_00_ZAPIS, cytat: 'rytm komór jest miarowy i ma częstość 75/min' },
  // preekscytacja
  { wartosc: 'PQ 0,10 s, fala delta, poszerzony QRS', wyklad: 'S2_02', plansza: S2_02_KROTKIE, cytat: 'Przy 25 mm/s PQ wynoszące 0,10 s zajmuje dwie i pół małej kratki; jeśli obok widzisz falę delta i poszerzony QRS, masz przed sobą obraz preekscytacji komór.' },
  { wartosc: 'PQ mierzone do początku fali delta', wyklad: 'S2_02', plansza: S2_02_KROTKIE, cytat: 'PQ mierzysz do początku fali delta, bo to ona wyznacza początek pobudzenia komór' },
  // zawal-dolny-prawa-komora
  { wartosc: 'ST +2 mm w III, +1 mm w II, obniżenie w aVL', wyklad: 'S3_05', plansza: S3_05_DOLNA, cytat: 'Jeśli ST jest uniesiony o 2 mm w III i o 1 mm w II, a w aVL obniżony, układ wskazuje na ostre niedokrwienie ściany dolnej' },
  { wartosc: 'ST +0,5 mm w V4R przy zmianach dolnych', wyklad: 'S3_05', plansza: S3_05_PK, cytat: 'U 65-letniej osoby uniesienie o 0,5 mm w V4R przy jednoczesnych zmianach dolnych jest więc informacją o możliwym rozszerzeniu zawału na prawą komorę.' },
  { wartosc: 'Próg w V3R-V4R ≥ 0,5 mm', wyklad: 'S3_05', plansza: S3_05_PK, cytat: 'Uniesienie ST ≥ 0,5 mm w V3R-V4R wspiera rozpoznanie zajęcia prawej komory' },
  // uniesienie-st-v2-v3
  { wartosc: 'Mężczyzna 55 lat, ST +2 mm w V2 i V3 spełnia kryterium', wyklad: 'S3_03', plansza: S3_03_UN, cytat: 'U 55-letniego mężczyzny uniesienie po 2 mm w V2 i V3 spełnia kryterium.' },
  { wartosc: 'Próg w V2-V3 ≥ 2 mm u mężczyzn od 40. roku życia', wyklad: 'S3_03', plansza: S3_03_UN, cytat: '≥ 2 mm u mężczyzn od 40. roku życia' },
  // obnizenie-st-v4-v5
  { wartosc: 'Punkt J 1 mm poniżej linii w V4 i V5, ST poziomy', wyklad: 'S3_03', plansza: S3_03_OBN, cytat: 'W V4 i V5 punkt J leży 1 mm poniżej poziomu odniesienia, a ST biegnie dalej poziomo: kryterium jest spełnione.' },
  { wartosc: 'Próg obniżenia ST ≥ 0,5 mm', wyklad: 'S3_03', plansza: S3_03_OBN, cytat: 'nowe poziome albo skośne ku dołowi obniżenie ST ≥ 0,5 mm' },
  // nadostre-t
  { wartosc: 'Nadostre T: symetryczne, szerokie, duże względem QRS, przed uniesieniem ST', wyklad: 'S2_04', plansza: S2_04_T, cytat: 'Hiperostre T we wczesnym niedokrwieniu są symetryczne, szerokie u podstawy i nieproporcjonalnie duże względem poprzedzającego QRS; szukasz ich w co najmniej dwóch sąsiadujących odprowadzeniach, a mogą wyprzedzać uniesienie ST.' },
  { wartosc: 'Nadostre T w V2, V3 i V4', wyklad: 'S2_04', plansza: S2_04_T, cytat: 'Wyobraź sobie niewielki R w V3, po którym szeroki T zajmuje wyraźnie większą część zapisu niż we wcześniejszym EKG, i podobną zmianę w V2 i V4.' },
  // qtc-500
  { wartosc: 'QT 0,40 s, RR 0,64 s, około 94/min', wyklad: 'S2_05', plansza: S2_05_QTC, cytat: 'QT zajmuje dziesięć małych kratek, czyli 0,40 s, a RR szesnaście, czyli 0,64 s, co odpowiada częstości około 94/min.' },
  { wartosc: 'QTc Bazetta 500 ms', wyklad: 'S2_05', plansza: S2_05_QTC, cytat: 'QTc według Bazetta wynosi 0,40 / 0,8 = 0,50 s, czyli 500 ms.' },
  { wartosc: 'Wzór Bazetta QTc = QT / √RR', wyklad: 'S2_05', plansza: S2_05_QTC, cytat: 'formuła Bazetta: QTc = QT / √RR' },
  { wartosc: 'QTc ≥ 500 ms: większe ryzyko torsade de pointes', wyklad: 'S2_05', plansza: S2_05_QTC, cytat: 'a QTc ≥ 500 ms wiąże się z wyraźnie większym ryzykiem torsade de pointes' },
  { wartosc: 'QT mierzone w II lub V5', wyklad: 'S2_05', plansza: 'Co mierzy odstęp QT', cytat: 'zwykle w II lub V5, pomocniczo w V6' },
  { wartosc: 'QTc ≥ 500 ms: monitorowanie rytmu', wyklad: 'S2_05', plansza: S2_05_TDP, cytat: 'Potwierdzone QTc ≥ 500 ms, zwłaszcza z omdleniem lub komorowymi zaburzeniami rytmu, wymaga pilnej oceny, monitorowania rytmu i usunięcia możliwych przyczyn.' },
  // przerost-lk-przeciazenie
  { wartosc: 'Przeciążenie: skośne obniżenie ST i asymetrycznie ujemny T w I, aVL, V5-V6', wyklad: 'S3_01', plansza: S3_01_STRAIN, cytat: 'skośne ku dołowi obniżenie odcinka ST z asymetrycznie ujemnym załamkiem T' },
  { wartosc: 'V5: wysoki QRS, ST poniżej linii, T w dół', wyklad: 'S3_01', plansza: S3_01_STRAIN, cytat: 'Spójrz na odprowadzenie V5. Najpierw wysoki, dodatni QRS. Zaraz po nim odcinek ST schodzi poniżej linii izoelektrycznej, a załamek T kieruje się w dół' },
  // zatorowosc-tachykardia-rbbb
  { wartosc: 'Tachykardia zatokowa 120/min', wyklad: 'S1_02', plansza: S1_02_ZATOKA, cytat: 'a przy 120/min o tachykardii zatokowej' },
  { wartosc: 'Zatorowość: świeży RBBB i tachykardia zatokowa', wyklad: 'S3_02', plansza: S3_02_ZATOR, cytat: 'Mogą mu towarzyszyć świeży blok prawej odnogi pęczka Hisa (RBBB), ujemne załamki T w V1-V4 i tachykardia zatokowa' },
  { wartosc: 'Tachykardia zatokowa > 100/min, P przed każdym QRS', wyklad: 'S3_02', plansza: S3_02_ZATOR, cytat: 'Tachykardia zatokowa to rytm zatokowy szybszy niż 100/min: przed każdym QRS wciąż widzisz zatokowe P' },
  { wartosc: 'RBBB: R′ w V1', wyklad: 'S3_02', plansza: 'Jak nie pomylić RVH z innymi przyczynami wysokiego R w V1', cytat: 'W V1 widzisz małe r, potem S i końcowe dodatnie R′, a pełny blok ma QRS ≥ 120 ms' },
];

export const NOWE_MORFOLOGIE_A: string[] = [
  'Rytm zastępczy z łącza 40/min po zahamowaniu zatoki: wąskie QRS i wsteczne, ujemne w II P tuż za QRS (rytmy.miarowyBezP z ptyl: retro).',
  'Dodatkowe pobudzenie komorowe (pvc-rv) na tle rytmu zatokowego 60/min, z pauzą do następnego zatokowego QRS.',
  'Migotanie przedsionków z deficytem tętna: po krótkich RR pobudzenie bez fali pletyzmogramu.',
  'Szeroki QRS 0,16 s jako rozciągnięty prawidłowy zespół (jak w droga-impulsu przy „blok: brak”), bez kształtu bloku odnogi.',
  'Preekscytacja (wpw) na monitorze w II i V1.',
  'Uniesienie ST w V4R w zawale dolnym z zajęciem prawej komory, z okienkiem ST dla II, III i V4R.',
  'Poziome obniżenie ST o 1 mm w V4 i V5 jako wektor uszkodzenia skierowany od tych kamer.',
  'Nadostre T w V2-V4 bez uniesienia ST (faza 1 z mapy zawału) na monitorze.',
  'Przerost lewej komory z przeciążeniem (lvh, axis 0, strain 0,3) w V5 i V6.',
  'Tachykardia zatokowa 120/min z RBBB w V1.',
];

export const DO_OKA_A: string[] = [
  'Częstość 75/min (przykład z S1_00) we wszystkich scenariuszach, w których plansza nie podaje częstości: PQ i QRS z S1_00, preekscytacja, ST i T z S2_04, S3_03, S3_05, przerost z S3_01.',
  'Przewodzenie 2:1: PQ pobudzeń przewiedzionych 0,16 s, tekst go nie podaje. Zablokowane P wypada tuż za końcem T.',
  'Migotanie z deficytem tętna: stały wzór ośmiu RR powtarzany co 6 s (każde 6 s ma osiem QRS). Brak fali tętna po RR ≤ 0,55 s to próg dydaktyczny, tekst mówi tylko o „krótkim odstępie RR”. Bystre oko może dostrzec powtarzalność wzoru.',
  'Rytm zastępczy z łącza: 40/min to dolna granica zakresu 40-60/min. Pierwsze pobudzenie z łącza 1,5 s po ostatnim zatokowym, zatoka wraca w pętli co 15 s.',
  'Dodatkowe pobudzenie komorowe: sprzężenie 0,62 s. Zatokowe P wypada 0,22 s po pobudzeniu dodatkowym (schowane w jego ST-T) i nie przewodzi się; następny QRS zatokowy przychodzi we własnym rytmie.',
  'QRS 0,16 s: prawidłowy zespół rozciągnięty w czasie (nieswoiste zaburzenie przewodzenia), bez nazwy bloku. Zmiany wtórne (S2_04): wektor T = −0,3 mV wzdłuż średniego wektora QRS, ST −0,06 mV w tę samą stronę, więc T i ST są przeciwne do głównego wychylenia QRS w każdym odprowadzeniu.',
  'Preekscytacja: w modelu fala delta zaczyna się 0,03 s przed t = 0, więc pr = 0,13 s daje PQ do początku delty 0,10 s w II.',
  'Zawał dolny: kierunek „RCA z PK” z mapy zawału, skala III = 2 mm; II wychodzi 1,1 mm, V4R 0,7 mm. Okienko ST zaokrągla do 0,5 mm i pokazuje +1, +2, +0,5. Połączenie dwóch przykładów z S3_05 (II/III z planszy o ścianie dolnej, V4R z planszy o prawej komorze) w jednego pacjenta.',
  'Uniesienie po 2 mm w V2 i V3: model z jednym wektorem daje V2 = V3 tylko przy kierunku ok. 74° w płaszczyźnie poziomej; ten kierunek unosi też V1 (1,2 mm), V4 (1,7 mm) i V5 (1,1 mm). Przykład z S3_05 (3, 4 i 2 mm w V2, V3, V4) nie daje się odtworzyć jednym wektorem, dlatego go nie użyto.',
  'Obniżenie ST w V4 i V5: wektor dopasowany do −1 mm w obu; obniża też V3 i V6 (ok. 0,8 mm) oraz I (0,5 mm). Żeby poziomy odcinek trwał ok. 80 ms, T jest nieco węższy i późniejszy (qt 0,39, tSharp 1,2; QTc Bazetta < 450 ms).',
  'Nadostre T: obie połowy T wyrównane do tej samej szerokości (tekst: T symetryczne), qt 0,35, żeby koniec T się nie przesunął.',
  'Przerost z przeciążeniem: strain 0,3. W V5 ST od −1,4 mm w J schodzi skośnie do ujemnego T (ok. −3 mm), w V6 od −2,1 mm do T ok. −9 mm (głęboko). R w V6 wyższy niż w V5, więc przykładu „S w V1 + R w V5 = 39 mm” nie użyto.',
  'Tachykardia 120/min: QT skrócony w modelu (qt 0,30) i PQ 0,14 s, żeby P nie wchodziło w T; kształt poglądowy, bez liczb.',
  'QTc 500 ms: QT w modelu (qtMs) 400 ms przy qt = 0,3895; koniec T z modelu, nie z metody stycznej.',
  'NIBP i SpO₂ pominięte we wszystkich scenariuszach części A: wykłady S1-S3 nie podają tych wartości.',
  'Okno zapisu: rytm zastępczy z łącza 7 s (dwa zatokowe QRS, przerwa i trzy pobudzenia z łącza), migotanie z deficytem tętna 6 s (metoda sześciu sekund na jednym ekranie), przewodzenie 2:1 6 s.',
];
