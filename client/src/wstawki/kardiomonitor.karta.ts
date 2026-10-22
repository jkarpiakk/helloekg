import type { Karta } from './core/zrodla.js';
import { ZRODLA_BAZOWE } from './kardiomonitor.scenariusze.js';
import { DO_OKA_A, MIEJSCA_A, NOWE_MORFOLOGIE_A, ZRODLA_A } from './kardiomonitor.scenariusze-a.js';
import { DO_OKA_B, MIEJSCA_B, NOWE_MORFOLOGIE_B, ZRODLA_B } from './kardiomonitor.scenariusze-b.js';

/** Karta wspólna dla wszystkich scenariuszy monitora (części a i b dopisują swoje źródła). */
export const KARTA: Karta = {
  id: 'kardiomonitor',
  miejsca: [...MIEJSCA_A, ...MIEJSCA_B],
  zrodla: [...ZRODLA_BAZOWE, ...ZRODLA_A, ...ZRODLA_B],
  noweMorfologie: [
    'Wszystkie zapisy monitora liczone z modelu wektorowego zamiast dawnego silnika `::ekg` (inne kształty niż wcześniej).',
    ...NOWE_MORFOLOGIE_A, ...NOWE_MORFOLOGIE_B,
  ],
  doOkaJK: [
    'HR monitor liczy z dwóch ostatnich QRS, jak aparat; przy niemiarowym rytmie liczba skacze.',
    'Fala SpO₂ tylko po pobudzeniach z tętnem: przy PEA i VT bez tętna pletyzmogram jest płaski.',
    'Scenariusze bazowe i ogólne nie pokazują ciśnienia ani liczby SpO₂ (wykłady ich nie podają); fala tętna bez liczby zostaje.',
    'Okienko ST pokazuje odchylenia zmierzone na zapisie modelu, a nie liczby z wykładu; kolor według progów z S3_05 (V2-V3 2 mm jak u mężczyzn od 40. roku życia, V3R-V4R i V7-V9 0,5 mm, pozostałe 1 mm). W trybie pytania okienko jest bez kolorów.',
    'Częstość w torsade de pointes, VF i blok III° ze STEMI (40/min, zakres łącza z S1_00) wynika z modelu; wykład nie podaje częstości torsade.',
    ...DO_OKA_A, ...DO_OKA_B,
  ],
  stanKanoniczny: 'Rytm zatokowy, monitor zatrzymany przy „Ogranicz ruch”, w ruchu bez niego.',
};
