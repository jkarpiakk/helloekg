/**
 * Scenariusze kardiomonitora, część B (wykłady S4_01–S4_05, S5_01–S5_04, S6_01–S6_05).
 * Wzór scenariusza: `kardiomonitor.scenariusze.ts`.
 * Każda liczba pokazywana kursantowi ma cytat w ZRODLA_B (test cytatów).
 *
 * Generatory, których brakuje w `core/rytmy.ts` (rytm zatokowy z gotowym pobudzeniem komór, DDD,
 * nadczułość VVI, ATP, migotanie przedsionków o stałym wzorze RR, AVNRT z wstecznym P), są tutaj, lokalnie.
 */
import type { Scenariusz } from './core/kardiomonitor.js';
import type { Zrodlo } from './core/zrodla.js';
import { blokAV, migotanieKomor, rozkojarzenie, stymulacjaVVI, zatokowy, type Generator, type Pisak } from './core/rytmy.js';
import { bgAF, bgMyo, pComps, vBeat, type Background } from './core/rytm.js';
import type { Beat, Comp } from './core/model.js';
import { site } from './mapa-zawalu.dane.js';

/* ─────────── klocki lokalnych generatorów ─────────── */

const P_ZATOKOWY = pComps('normal');
/** Wsteczne pobudzenie przedsionków w AVNRT: w górę (ujemne w II, III, aVF) i lekko do przodu (dodatnie w V1). */
export const P_WSTECZNY: Comp[] = [{ t: 0.035, w: 0.016, v: [-0.03, -0.13, 0.09] }];
/** Odstęp od początku QRS do początku wstecznego P w AVNRT: szczyt P wypada na końcu QRS (pseudo-r′, pseudo-S). */
export const AVNRT_P_PO_QRS = 0.04;

const dodajP = (s: Pisak, at: number, blok = false, comps: Comp[] = P_ZATOKOWY) =>
  s.add({ kind: 'P', at, comps, tag: blok ? 'p-blok' : 'p' });
const dodajQRS = (s: Pisak, at: number, b: Beat, tetno = true) => s.add({ kind: 'QRS', at, beat: b, tag: tetno ? 'qrs' : 'qrs-bt' });
const dodajIglice = (s: Pisak, at: number) => s.add({ kind: 'spike', at, chamber: 'V', amp: 1.6, tag: 'iglica' });
/** Od iglicy do początku stymulowanego QRS (jak w `stymulacjaVVI`). */
const ZA_IGLICA = 0.004;

/** Powtarzalny obieg długości L (s): `obieg` dopisuje zdarzenia jednego obiegu od chwili t0. */
function cyklicznie(L: number, obieg: (s: Pisak, t0: number) => void, tla: Background[] = []): Generator {
  let c = 0, init = false;
  return (s, until) => {
    if (!init) { for (const b of tla) s.backgrounds.push(b); init = true; }
    while (c * L < until) { obieg(s, c * L); c++; }
  };
}

/** Dokłada tła do istniejącego generatora. */
function zTlem(g: Generator, ...tla: Background[]): Generator {
  let init = false;
  return (s, until) => {
    if (!init) { for (const b of tla) s.backgrounds.push(b); init = true; }
    g(s, until);
  };
}

/** Tło włączone tylko w oknie [od, doo) każdego obiegu długości L. */
export const wOknie = (b: Background, L: number, od: number, doo: number): Background => (t, lead) => {
  const f = ((t % L) + L) % L;
  return f >= od && f < doo ? b(t, lead) : 0;
};

/**
 * Rytm zatokowy z gotowym pobudzeniem komór (np. RBBB + LAFB). `przewodzi(n)` mówi, czy n-ty P
 * (od zera) dociera do komór; P zablokowane zostają na pasku z tagiem 'p-blok'.
 */
function zatoka(o: { pp: number; pq: number; beat: Beat; przewodzi?: (n: number) => boolean }): Generator {
  let n = 0, tp = 0.25;
  return (s, until) => {
    while (tp < until) {
      const ok = o.przewodzi?.(n) ?? true;
      dodajP(s, tp, !ok);
      if (ok) dodajQRS(s, tp + o.pq, o.beat);
      n++; tp += o.pp;
    }
  };
}

/* ─────────── pobudzenia ─────────── */

/**
 * Blok dwuwiązkowy RBBB + LAFB: początek i główne siły z bloku przedniej wiązki (małe r w II, q w aVL,
 * oś w lewo i w górę), końcówka z bloku prawej odnogi (późne R′ w V1, szerokie S w I i V6). T jak w RBBB.
 */
export function beatRbbbLafb(): Beat {
  const rb = vBeat({ qrs: 'rbbb' }), la = vBeat({ qrs: 'lafb' });
  return { ...rb, qrs: [la.qrs[0]!, la.qrs[1]!, rb.qrs[2]!, rb.qrs[3]!] };
}

const RCA = site('rca');

/* ─────────── wartości z tekstu (cytaty w ZRODLA_B) ─────────── */

/** Migotanie przedsionków: 22 odstępy RR, razem dokładnie 10 s (22 QRS w 10 s = 132/min). */
export const AF_RR: number[] = (() => {
  const rr = [0.41, 0.56, 0.37, 0.48, 0.53, 0.39, 0.44, 0.58, 0.35, 0.51, 0.43, 0.52, 0.38, 0.47, 0.36, 0.55, 0.42, 0.50, 0.40, 0.54, 0.34];
  rr.push(10 - rr.reduce((a, b) => a + b, 0));
  return rr;
})();

/** Nadczułość VVI: obieg 12 s, zakłócenia mięśniowe od 4,6 do 7,4 s, iglice co 1 s poza przerwą. */
export const NADCZULOSC = { L: 12, od: 4.6, doo: 7.4, iglice: [0.4, 1.4, 2.4, 3.4, 4.4, 8.4, 9.4, 10.4, 11.4] } as const;

/** ICD: VT 180/min (18 pobudzeń), ATP 8 impulsów co 0,28 s, potem własny rytm 75/min; obieg 16 s. */
export const ICD = { L: 16, vtStart: 0.3, vtN: 18, vtRR: 60 / 180, atpN: 8, atpRR: 0.28, rytmRR: 60 / 75, pq: 0.16 } as const;

/** DDD: elektroda przedsionkowa wykrywa P chwilę po jego początku w EKG; opóźnienie AV 180 ms liczy się od wykrycia. */
export const DDD_WYKRYCIE = 0.03;

/* ─────────── scenariusze ─────────── */

/**
 * `start`: sekunda, od której monitor pokazuje pierwszy ekran (przy „Ogranicz ruch” stoi na nim zjawisko z pytania).
 * `okno`: najkrótsze okno zapisu (s), w którym zjawisko (pauza, napad bloku, ATP, nadczułość, 10 s do liczenia QRS)
 * mieści się w całości; `start` stoi wtedy na 30% szerokości ekranu.
 */
export const SCENARIUSZE_B: Array<Scenariusz & { start?: number }> = [
  {
    id: 'mobitz-2-szerokie-qrs', grupa: 'Przewodzenie i bloki', nazwa: 'Blok AV II stopnia typu Mobitz II', miejsce: 'Łóżko 5 · Kardiologia',
    opis: 'PQ stale 0,16 s przy P co 0,80 s, potem nagle P bez QRS i pauza 1,60 s, a zespoły QRS są szerokie.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => blokAV({ pp: 0.8, pq: [0.16, 0.16, 0.16, null], beat: { qrs: 'rbbb' } }),
  },
  {
    id: 'blok-av-2-1', grupa: 'Przewodzenie i bloki', nazwa: 'Blok AV II stopnia z przewodzeniem 2:1', miejsce: 'Łóżko 2 · Interna', okno: 6,
    opis: 'P 80/min i QRS 40/min: co drugi P zostaje bez QRS, a gdy go przeoczysz, weźmiesz zapis za bradykardię zatokową.',
    odprowadzenia: ['II'],
    rytm: () => blokAV({ pp: 60 / 80, pq: [0.24, null] }),
  },
  {
    id: 'blok-calkowity-waskie-qrs', grupa: 'Przewodzenie i bloki', nazwa: 'Blok AV III stopnia, wąskie QRS', miejsce: 'Łóżko 1 · SOR',
    opis: 'Zasłabnięcia u starszej pacjentki: P 75/min i wąskie QRS 40/min idą każde swoim tempem, bez stałego PQ.',
    odprowadzenia: ['II'],
    rytm: () => rozkojarzenie({ pp: 0.8, rr: 1.5, beat: {} }),
  },
  {
    id: 'wenckebach-zawal-dolny', grupa: 'Przewodzenie i bloki', nazwa: 'Wenckebach w zawale ściany dolnej', miejsce: 'Łóżko 4 · SOR',
    opis: 'Ból w klatce piersiowej: PQ 0,16, 0,28 i 0,36 s, potem P bez QRS, a w II, III i aVF uniesiony odcinek ST.',
    odprowadzenia: ['II', 'III', 'aVF'],
    rytm: () => blokAV({ pp: 0.8, pq: [0.16, 0.28, 0.36, null], beat: { injury: { dir: RCA.dir, st: RCA.st } } }),
  },
  {
    id: 'blok-dwuwiazkowy-po-omdleniu', grupa: 'Przewodzenie i bloki', nazwa: 'Blok dwuwiązkowy po omdleniu', miejsce: 'Łóżko 3 · SOR',
    opis: 'Rytm zatokowy 70/min po omdleniu: PQ 0,24 s, w V1 późne R′, w II rS, a w aVL qR.',
    odprowadzenia: ['V1', 'II', 'aVL'],
    rytm: () => zatoka({ pp: 60 / 70, pq: 0.24, beat: beatRbbbLafb() }),
  },
  {
    id: 'napadowy-blok-av', grupa: 'Przewodzenie i bloki', nazwa: 'Napadowy blok AV', miejsce: 'Łóżko 7 · Interna', pleth: true, start: 8.2, okno: 7,
    opis: 'Rytm zatokowy 70/min z blokiem dwuwiązkowym, potem kilka regularnych P bez QRS i powrót przewodzenia.',
    odprowadzenia: ['II', 'V1'],
    // obieg 14 P (12 s): 9 przewiedzionych, 5 zablokowanych
    rytm: () => zatoka({ pp: 60 / 70, pq: 0.24, beat: beatRbbbLafb(), przewodzi: (n) => n % 14 < 9 }),
  },
  {
    id: 'pauza-zatokowa', grupa: 'Rytm i częstość', nazwa: 'Pauza zatokowa dłuższa niż 3 s', miejsce: 'Łóżko 6 · Interna', pleth: true, start: 6.4, okno: 6,
    opis: 'Rytm zatokowy 70/min, potem przerwa dłuższa niż 3 s, w której nie pojawia się żaden załamek P.',
    odprowadzenia: ['II'],
    rytm: () => zatokowy({ hr: 70, pauza: { co: 8, s: 2.6 } }),
  },
  {
    id: 'ddd-blok-calkowity', grupa: 'Stymulatory i ICD', nazwa: 'DDD przy bloku całkowitym', miejsce: 'Łóżko 8 · Kardiologia', pleth: true,
    opis: 'Po każdym własnym P 75/min urządzenie odlicza opóźnienie AV 180 ms i pobudza komorę, więc szerokie QRS też idą 75/min.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => {
      const b = vBeat({ qrs: 'paced-rv', qrsAmp: 2.2 });
      let tp = 0.25;
      return (s, until) => {
        while (tp < until) { dodajP(s, tp); dodajIglice(s, tp + DDD_WYKRYCIE + 0.18); dodajQRS(s, tp + DDD_WYKRYCIE + 0.18 + ZA_IGLICA, b); tp += 0.8; }
      };
    },
  },
  {
    id: 'vvi-brak-wychwytu', grupa: 'Stymulatory i ICD', nazwa: 'VVI: brak wychwytu', miejsce: 'Łóżko 3 · SOR', pleth: true,
    opis: 'Stymulator VVI 60/min wysyła iglicę co 1 s: po dwóch iglicach pojawia się szeroki QRS, po trzeciej komora się nie pobudza.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => zTlem(stymulacjaVVI({ hr: 60, bezWychwytu: 3 }), bgAF(0.03)),
  },
  {
    id: 'vvi-nadczulosc', grupa: 'Stymulatory i ICD', nazwa: 'VVI: nadczułość na potencjały mięśniowe', miejsce: 'Łóżko 3 · SOR', pleth: true, start: 5, okno: 6,
    opis: 'VVI 60/min u chorego zależnego od stymulatora: podczas zakłóceń z mięśni iglice i QRS znikają na kilka sekund.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => {
      const b = vBeat({ qrs: 'paced-rv', qrsAmp: 2.2 });
      const { L, od, doo, iglice } = NADCZULOSC;
      return cyklicznie(L, (s, t0) => { for (const t of iglice) { dodajIglice(s, t0 + t); dodajQRS(s, t0 + t + ZA_IGLICA, b); } },
        [bgAF(0.03), wOknie(bgMyo(0.09), L, od, doo)]);
    },
  },
  {
    id: 'icd-atp', grupa: 'Stymulatory i ICD', nazwa: 'ICD przerywa VT stymulacją ATP', miejsce: 'Łóżko 2 · Kardiologia', start: 6.2, okno: 6,
    opis: 'Częstoskurcz komorowy 180/min, potem seria pobudzeń stymulowanych co 0,28 s i powrót wolniejszego, własnego rytmu 75/min.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => {
      const vt = vBeat({ qrs: 'vent', qt: 0.3 });
      const st = vBeat({ qrs: 'paced-rv', qrsAmp: 2.2, qt: 0.3 });
      const wl = vBeat({});
      const { L, vtStart, vtN, vtRR, atpN, atpRR, rytmRR, pq } = ICD;
      return cyklicznie(L, (s, t0) => {
        let t = t0 + vtStart;
        for (let i = 0; i < vtN; i++) { dodajQRS(s, t, vt); if (i < vtN - 1) t += vtRR; }
        for (let i = 0; i < atpN; i++) { t += atpRR; dodajIglice(s, t); dodajQRS(s, t + ZA_IGLICA, st); }
        t += ZA_IGLICA + rytmRR;
        // własny rytm do końca obiegu (następny obieg zaczyna się nagle od VT)
        while (t < t0 + L + vtStart - 0.5) { dodajP(s, t - pq); dodajQRS(s, t, wl); t += rytmRR; }
      });
    },
  },
  {
    id: 'af-szybka-czynnosc-komor', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'Migotanie przedsionków z szybką czynnością komór', miejsce: 'Izba przyjęć', okno: 10,
    opis: 'Brak P, fala f i całkowicie niemiarowe RR: 22 QRS w 10 s, czyli średnio 132/min.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => {
      const b = vBeat({ qt: 0.31 });
      return cyklicznie(10, (s, t0) => { let t = t0 + 0.3; for (const rr of AF_RR) { dodajQRS(s, t, b); t += rr; } }, [bgAF(0.05)]);
    },
  },
  {
    id: 'avnrt-pseudo-r', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'AVNRT: nawrotny częstoskurcz węzłowy', miejsce: 'SOR',
    opis: 'Miarowy wąski częstoskurcz 150/min, P schowane w QRS: pseudo-r′ w V1 i pseudo-S w II.',
    odprowadzenia: ['II', 'V1'],
    rytm: () => {
      const b = vBeat({ qt: 0.28 });
      let t = 0.3;
      return (s, until) => { while (t < until) { dodajQRS(s, t, b); dodajP(s, t + AVNRT_P_PO_QRS, false, P_WSTECZNY); t += 60 / 150; } };
    },
  },
  {
    id: 'vf-drobnofaliste', grupa: 'Częstoskurcze i zatrzymanie krążenia', nazwa: 'Migotanie komór drobnofaliste', miejsce: 'Siłownia · monitor defibrylatora', alarm: { tekst: 'VF' },
    opis: 'Drobna, chaotyczna fala bez żadnego QRS i bez fali tętna u nieprzytomnego pacjenta bez prawidłowego oddechu.',
    odprowadzenia: ['II', 'V1'], spo2: null, pleth: true,
    rytm: () => migotanieKomor({ grube: false }),
  },
];

/** Plansza, do której przypięty jest każdy scenariusz (opis zgodny z jej tekstem). */
export const PRZYPIECIA_B: Record<string, { wyklad: string; plansza: string }> = {
  'mobitz-2-szerokie-qrs': { wyklad: 'S4_03', plansza: 'Nagłe wypadnięcie bez ostrzeżenia' },
  'blok-av-2-1': { wyklad: 'S4_03', plansza: 'Blok 2:1 i blok zaawansowany: pułapki klasyfikacji' },
  'blok-calkowity-waskie-qrs': { wyklad: 'S6_01', plansza: 'Przypadki 6-10: wyższa stawka' },
  'wenckebach-zawal-dolny': { wyklad: 'S4_02', plansza: 'Umiejscowienie, przyczyny i rokowanie' },
  'blok-dwuwiazkowy-po-omdleniu': { wyklad: 'S6_04', plansza: 'Czego szukasz w EKG między omdleniami' },
  'napadowy-blok-av': { wyklad: 'S6_04', plansza: 'Złapać winowajcę: monitorowanie i decyzje' },
  'pauza-zatokowa': { wyklad: 'S6_04', plansza: 'Czego szukasz w EKG między omdleniami' },
  'ddd-blok-calkowity': { wyklad: 'S5_01', plansza: 'Co z tego wynika przy łóżku pacjenta' },
  'vvi-brak-wychwytu': { wyklad: 'S5_03', plansza: 'Gdy zawodzi stymulacja: iglica bez echa albo cisza' },
  'vvi-nadczulosc': { wyklad: 'S5_03', plansza: 'Gdy zawodzi słuch: niedoczułość i nadczułość' },
  'icd-atp': { wyklad: 'S5_04', plansza: 'Jak ICD gasi pożar: ATP i wyładowanie' },
  'af-szybka-czynnosc-komor': { wyklad: 'S6_01', plansza: 'Przypadki 1-5: fundamenty' },
  'avnrt-pseudo-r': { wyklad: 'S6_01', plansza: 'Przypadki 1-5: fundamenty' },
  'vf-drobnofaliste': { wyklad: 'S6_05', plansza: 'Migotanie komór: chaos bez QRS' },
};

export const MIEJSCA_B: Array<{ wyklad: string; plansza: string }> = Object.values(PRZYPIECIA_B)
  .filter((m, i, a) => a.findIndex((x) => x.wyklad === m.wyklad && x.plansza === m.plansza) === i);

const z = (wartosc: string, wyklad: string, plansza: string, cytat: string): Zrodlo => ({ wartosc, wyklad, plansza, cytat });
const S4_02_P1 = 'Zmęczona brama: narastające opóźnienie aż do wypadnięcia';
const S4_02_P2 = 'Subtelne cechy: skracające się odstępy RR i „grupowanie” uderzeń';
const S4_03_P1 = 'Nagłe wypadnięcie bez ostrzeżenia';
const S4_03_P3 = 'Blok 2:1 i blok zaawansowany: pułapki klasyfikacji';
const S6_04_P2 = 'Czego szukasz w EKG między omdleniami';
const S6_01_P2 = 'Przypadki 1-5: fundamenty';
const S6_01_P3 = 'Przypadki 6-10: wyższa stawka';

export const ZRODLA_B: Zrodlo[] = [
  // Mobitz II
  z('Mobitz II: PQ stale 0,16 s', 'S4_03', S4_03_P1, 'W dwóch kolejnych przewiedzionych pobudzeniach od początku P do początku QRS liczysz cztery kratki, czyli 0,16 s.'),
  z('Mobitz II: P-P 0,80 s (75/min), pauza 1,60 s', 'S4_03', S4_03_P1, 'Przy odstępach P-P wynoszących 0,80 s przedsionki pracują z częstością 75/min, a przerwa między QRS obejmująca jeden zablokowany P trwa 1,60 s'),
  z('Mobitz II: szerokie QRS (≥ 120 ms)', 'S4_03', S4_03_P1, 'Szeroki QRS trwa co najmniej 120 ms.'),
  // blok 2:1
  z('Blok 2:1: P 80/min, QRS 40/min', 'S4_03', S4_03_P3, 'Przy częstości przedsionków 80/min komory w bloku 2:1 pracują z częstością 40/min'),
  z('Blok 2:1: PQ 0,24 s', 'S4_03', S4_03_P3, 'Samo PQ równe 0,24 s'),
  z('Blok 2:1: wąski QRS i wydłużone PQ', 'S4_03', S4_03_P3, 'wąski QRS i wydłużone PQ przemawiają raczej za blokiem węzłowym'),
  // blok III° z wąskimi QRS (S6_01, przypadek 7)
  z('Blok III°: P 75/min (PP 0,80 s), QRS 40/min (RR 1,50 s)', 'S6_01', S6_01_P3, 'PP równe 0,80 s to 75/min w przedsionkach, RR równe 1,50 s to 40/min w komorach'),
  z('Blok III°: wąskie QRS rytmu z łącza', 'S6_01', S6_01_P3, 'Wąskie zespoły sugerują rytm z łącza AV, zwykle 40-60/min.'),
  // Wenckebach w zawale dolnym
  z('Wenckebach: PQ 0,16, 0,28 i 0,36 s', 'S4_02', S4_02_P1, 'PQ wynosi kolejno 0,16 s, 0,28 s i 0,36 s'),
  z('Wenckebach: P bez QRS, po pauzie PQ 0,16 s, przewodzenie 4:3', 'S4_02', S4_02_P1, 'Następny P nie ma po sobie QRS, a po pauzie PQ wraca do 0,16 s. Na cztery pobudzenia przedsionków przypadają trzy pobudzenia komór, czyli przewodzenie wynosi 4:3.'),
  z('Wenckebach: P co 0,80 s, pierwszy RR 0,92 s', 'S4_02', S4_02_P2, 'Jeśli przedsionki pobudzają się co 0,80 s, pierwszy RR wynosi 0,92 s'),
  z('Wenckebach: drugi RR 0,88 s', 'S4_02', S4_02_P2, 'Następny RR wynosi 0,88 s'),
  z('Wenckebach: pauza 1,40 s', 'S4_02', S4_02_P2, 'w naszym przykładzie 1,40 s'),
  z('Wenckebach: P 75/min, komory średnio 56/min', 'S4_02', S4_02_P2, 'Przedsionki w naszym przykładzie pracują z częstością 75/min, ale przy utrzymującym się przewodzeniu 4:3 średnia częstość komór wynosi około 56/min.'),
  z('Ból i Wenckebach: ST w II, III i aVF', 'S4_02', 'Umiejscowienie, przyczyny i rokowanie', 'U pacjenta z bólem w klatce piersiowej obejrzyj więc odprowadzenia II, III i aVF pod kątem zmian ST.'),
  // omdlenia: blok dwuwiązkowy, napadowy blok AV, pauza zatokowa
  z('Po omdleniu: rytm 70/min', 'S6_04', S6_04_P2, 'pacjent przytomny, czuje się „już dobrze”, rytm 70/min'),
  z('PQ 0,24 s, każde P przewiedzione: blok AV I stopnia', 'S6_04', S6_04_P2, 'Przy 25 mm/s sześć małych kratek to 0,24 s; jeśli każde P przewodzi do komór, rozpoznajesz blok AV I stopnia.'),
  z('QRS szeroki (0,12 s)', 'S6_04', S6_04_P2, 'trzy małe kratki to 0,12 s, czyli zespół szeroki'),
  z('RBBB: późne R′ w V1, szerokie S w I i V6', 'S6_04', S6_04_P2, 'RBBB daje zwykle końcowe dodatnie wychylenie QRS w V1 oraz szeroki S w I i V6.'),
  z('LAFB: oś od −45° do −90°, qR w aVL, rS w II', 'S6_04', S6_04_P2, 'Blok przedniej wiązki lewej odnogi to oś od −45° do −90°, układ qR w aVL i rS w II, III i aVF.'),
  z('Napadowy blok AV: kilka P bez QRS, potem powrót przewodzenia', 'S6_04', 'Złapać winowajcę: monitorowanie i decyzje', 'Kilka regularnych P bez QRS, a potem powrót przewodzenia: to napadowy blok AV'),
  z('Pauza zatokowa dłuższa niż 3 s', 'S6_04', S6_04_P2, 'pauzy zatokowe > 3 s w czasie czuwania'),
  z('3 s = 15 dużych kratek', 'S6_04', S6_04_P2, 'Przy 25 mm/s trzy sekundy to 15 dużych kratek.'),
  // stymulatory
  z('DDD: P 75/min, blok całkowity, komory 75/min', 'S5_01', 'Co z tego wynika przy łóżku pacjenta', 'Przy DDD, rytmie przedsionków 75/min i bloku całkowitym urządzenie może prawidłowo stymulować komory z częstością 75/min'),
  z('DDD: opóźnienie AV 180 ms', 'S5_01', 'Kod literowy: jak czytać „język” stymulatorów', 'Załóżmy, że opóźnienie AV po wykrytym pobudzeniu przedsionka ustawiono na 180 ms.'),
  z('VVI przy utrwalonym migotaniu przedsionków (fala f w tle)', 'S5_01', 'Kod literowy: jak czytać „język” stymulatorów', 'VVI lub VVIR stosuje się między innymi przy utrwalonym migotaniu przedsionków'),
  z('VVI 60/min: iglica co 1 s', 'S5_03', 'Gdy zawodzi stymulacja: iglica bez echa albo cisza', 'Przy ustawieniu 60/min, bez funkcji wydłużających odstępy, oczekiwany odstęp do następnego pobudzenia stymulowanego wynosi 1 s'),
  z('Brak wychwytu: po dwóch iglicach QRS, po trzeciej nie', 'S5_03', 'Gdy zawodzi stymulacja: iglica bez echa albo cisza', 'Jeśli po dwóch widać QRS, a po następnej nie, wychwyt może być przerywany.'),
  z('HR 30/min przy przerwie 2 s (iglica bez QRS)', 'S5_01', 'Po co komu rozrusznik', 'Przy 30/min między kolejnymi zespołami QRS mijają aż 2 s'),
  z('Nadczułość: potencjały mięśnia piersiowego', 'S5_03', 'Gdy zawodzi słuch: niedoczułość i nadczułość', 'potencjały mięśnia piersiowego'),
  z('Nadczułość: pauzy bez iglic', 'S5_03', 'Gdy zawodzi słuch: niedoczułość i nadczułość', 'pauzy i brak iglic dokładnie wtedy, gdy pacjent stymulacji potrzebuje'),
  // ICD
  z('ICD: VT 180/min (0,33 s), ATP co 0,28 s', 'S5_04', 'Jak ICD gasi pożar: ATP i wyładowanie', 'Przy częstoskurczu 180/min odstęp między pobudzeniami wynosi około 0,33 s; podczas ATP może się skrócić np. do 0,28 s.'),
  z('ICD: po ATP powrót wolniejszego, własnego rytmu', 'S5_04', 'Jak ICD gasi pożar: ATP i wyładowanie', 'powrót wolniejszego, własnego rytmu'),
  z('Własny rytm 75/min po ATP (częstość zapożyczona z S5_01)', 'S5_01', 'Co z tego wynika przy łóżku pacjenta', 'własny rytm komór 75/min'),
  // kołatanie
  z('Pan Henryk, 74 lata', 'S6_01', S6_01_P2, 'Pan Henryk, 74 lata'),
  z('AF: 22 QRS w 10 s = 132/min', 'S6_01', S6_01_P2, 'Przykładowe 22 zespoły QRS w 10 s to średnio 132/min.'),
  z('AF: fale f w II i V1', 'S6_01', S6_01_P2, 'Fale f najlepiej widać w II i V1'),
  z('Student, 21 lat, nagłe kołatanie', 'S6_01', S6_01_P2, 'Student, 21 lat, nagłe kołatanie na egzaminie'),
  z('AVNRT: pseudo-r′ w V1, pseudo-S w II', 'S6_01', S6_01_P2, 'W V1 wsteczne pobudzenie przedsionków wygląda wtedy jak małe dodatnie wychylenie na końcu QRS, nazywane pseudo-r′, a w II, III i aVF jak niewielki załamek S, czyli pseudo-S.'),
  z('AVNRT: 150/min (dolna granica zakresu)', 'S6_03', 'Wąskie QRS: rodzina nadkomorowa', 'częstość 150-220/min'),
  // stany zagrożenia
  z('VF: alarm „VF”', 'S6_05', 'Migotanie komór: chaos bez QRS', 'Migotanie komór (VF) to elektryczny chaos'),
  z('VF drobnofaliste', 'S6_05', 'Migotanie komór: chaos bez QRS', 'Fale bywają duże, czyli grubofaliste, albo drobne, czyli drobnofaliste'),
];

export const NOWE_MORFOLOGIE_B: string[] = [
  'Blok dwuwiązkowy RBBB + LAFB złożony z dwóch morfologii modelu (początek i oś z LAFB, końcówka z RBBB), oś z pola QRS −86°.',
  'AVNRT: wsteczny P na końcu QRS (własny wektor: pseudo-r′ w V1, pseudo-S w II).',
  'Mobitz II z szerokimi QRS (morfologia RBBB) i Wenckebach z uniesieniem ST ściany dolnej (wektor RCA z mapy zawału).',
  'Napadowy blok AV: seria pięciu regularnych P bez QRS na tle bloku dwuwiązkowego.',
  'DDD przy bloku całkowitym: własny P, iglica komorowa, szeroki QRS stymulowany.',
  'Nadczułość VVI: zakłócenia mięśniowe na linii i przerwa bez iglic, pierwsza iglica 1 s po ustaniu zakłóceń.',
  'ICD: VT, seria ATP (pobudzenia stymulowane co 0,28 s) i powrót rytmu zatokowego.',
  'Migotanie przedsionków o stałym wzorze 22 odstępów RR (10 s) zamiast losowania.',
  'Migotanie komór drobnofaliste (generator `migotanieKomor` z `grube: false`).',
];

export const DO_OKA_B: string[] = [
  'Żaden z przypadków części B nie podaje ciśnienia ani SpO₂, więc te okienka są schowane; fala tętna (bez liczby) tylko tam, gdzie ważna jest przerwa w krążeniu.',
  'Okienko ST mm wyłączone we wszystkich scenariuszach B: tekst nie podaje uniesień w mm dla tych zapisów (Wenckebach z zawałem dolnym ma wektor RCA z mapy zawału, ok. 2-3 mm, bez podpisu).',
  'Mobitz II: przewodzenie 4:3 i morfologia RBBB nie pochodzą z tekstu, który mówi tylko „co pewien czas” i „często szeroki QRS”.',
  'Blok 2:1: PQ 0,24 s wzięte ze zdania, że samo takie PQ nie rozstrzyga o typie bloku; QRS wąski.',
  'Blok dwuwiązkowy i napadowy blok AV: PQ 0,24 s i 70/min z planszy S6_04 o EKG między omdleniami; w napadzie blokuje się 5 kolejnych P („kilka”), przerwa komór ok. 5,1 s.',
  'Blok III° z wąskimi QRS bez imienia pani Barbary: w S6_04 miała ona blok dwuwiązkowy, a S6_01 opisuje wąskie QRS tylko warunkowo („Jeśli QRS są wąskie”).',
  'Pauza zatokowa trwa ok. 3,5 s; tekst podaje tylko próg > 3 s.',
  'DDD: opóźnienie AV 180 ms liczone od wykrycia P, które przyjąłem 30 ms po początku P w EKG (iglica 210 ms od początku P); wartości 30 ms tekst nie podaje.',
  'VVI (brak wychwytu, nadczułość): pacjent zależny od stymulatora, w tle drobna fala f (VVI przy utrwalonym AF), bez własnych QRS; przy braku wychwytu monitor chwilowo pokazuje 30/min.',
  'Nadczułość: zakłócenia mięśniowe widać na monitorze, choć tekst mówi, że mogą być niewidoczne w EKG; długość przerwy (4 s) poglądowa.',
  'ICD: liczba impulsów ATP (8) i własny rytm 75/min po ATP nie stoją w S5_04 (75/min zapożyczone z S5_01); podczas ATP monitor chwilowo liczy ok. 214/min (0,28 s).',
  'ICD: w czasie VT monitor nie rysuje niezależnych P (rozkojarzenia), żeby nie zgadywać częstości przedsionków.',
  'AVNRT 150/min to dolna granica zakresu 150-220/min z S6_03; ta sama częstość co w trzepotaniu 2:1, celowo (pytanie o różnicowanie).',
  'AF: wzór RR powtarza się co 10 s; monitor pokazuje częstość chwilową, która skacze wokół średniej 132/min.',
  'Częstości bez zmienności RR (hrv = 0), żeby monitor pokazywał dokładnie wartość z tekstu.',
  'Okno zapisu: migotanie z szybką czynnością komór pokazuje 10 s (22 QRS do policzenia na jednym ekranie), napadowy blok AV 7 s, pauza zatokowa, nadczułość VVI, ATP i blok 2:1 po 6 s; na telefonie kratka jest wtedy gęstsza.',
];
