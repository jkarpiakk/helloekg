/** Wszystkie karty wartości wstawek (czyta je test cytatów i strona Animacje). */
import type { Karta } from './core/zrodla.js';
import { KARTA as droga } from './droga-impulsu.karta.js';
import { KARTA as kompas } from './kompas-osi.karta.js';
import { KARTA as mapa } from './mapa-zawalu.karta.js';
import { KARTA as wezel } from './wezel-av.karta.js';
import { KARTA as petla } from './petla-qrs.karta.js';
import { KARTA as pomiary } from './pomiary.karta.js';
import { KARTA as stym } from './stymulator.karta.js';
import { KARTA as adeno } from './adenozyna.karta.js';
import { KARTA as potas } from './potas.karta.js';
import { KARTA as elektrody } from './elektrody.karta.js';
import { KARTA as nzk } from './nzk.karta.js';
import { KARTA as km } from './kardiomonitor.karta.js';

export const KARTY: Karta[] = [droga, kompas, mapa, wezel, petla, pomiary, stym, adeno, potas, elektrody, nzk, km];
