import type { Karta } from './core/zrodla.js';

const VF = 'Migotanie komór: chaos bez QRS';
const START = 'Trzy minuty, które są egzaminem z całego kursu';
const PRZ = 'Przypomnij sobie';
const ICD1 = 'Strażak, nie dyrygent';
const SZER = 'Szerokie QRS: tu się nie ryzykuje';

export const KARTA: Karta = {
  id: 'nzk',
  miejsca: [
    { wyklad: 'S6_05', plansza: VF },
    { wyklad: 'S6_05', plansza: START },
  ],
  zrodla: [
    { wartosc: 'Pacjent: nieprzytomny, nie oddycha prawidłowo', wyklad: 'S6_05', plansza: START, cytat: 'Nie reaguje, nie oddycha prawidłowo' },
    { wartosc: 'Pytanie: jaki rytm i czy do defibrylacji', wyklad: 'S6_05', plansza: START, cytat: 'jaki rytm ma to serce i czy jest to rytm do defibrylacji?' },
    { wartosc: 'VF: brak P, QRS i powtarzalności; chaotyczna fala o zmiennej amplitudzie i kształcie', wyklad: 'S6_05', plansza: VF, cytat: 'Na zapisie nie znajdziesz ani załamków P, ani zespołów QRS, ani żadnej powtarzalności, tylko nieregularną, chaotyczną falę o zmiennej amplitudzie i kształcie.' },
    { wartosc: 'VF grubofaliste i drobnofaliste', wyklad: 'S6_05', plansza: VF, cytat: 'Fale bywają duże, czyli grubofaliste, albo drobne, czyli drobnofaliste' },
    { wartosc: 'VF: brak punktu do mierzenia RR', wyklad: 'S6_05', plansza: VF, cytat: 'W VF nie ma powtarzalnych zespołów ani punktu, od którego dałoby się mierzyć kolejny odstęp RR' },
    { wartosc: 'VF u nieprzytomnego bez oddechu = rytm do defibrylacji', wyklad: 'S6_05', plansza: VF, cytat: 'U nieprzytomnego pacjenta bez prawidłowego oddechu taki obraz oznacza rytm do defibrylacji.' },
    { wartosc: 'Wysokość fal nie jest zegarem', wyklad: 'S6_05', plansza: VF, cytat: 'Wysokość fal nie jest jednak zegarem zatrzymania krążenia' },
    { wartosc: 'Drobne VF to nadal rytm do defibrylacji', wyklad: 'S6_05', plansza: VF, cytat: 'rozpoznane VF defibrylujesz także wtedy, gdy fale są drobne' },
    { wartosc: 'pVT jednokształtny: równy, szeroki, podobne zespoły', wyklad: 'S6_05', plansza: VF, cytat: 'Zapis pokazuje zwykle równy, szeroki częstoskurcz, który znasz z wcześniejszych wykładów, z zespołami o podobnym kształcie, czyli częstoskurcz jednokształtny.' },
    { wartosc: 'pVT wielokształtny: zmienny wygląd, wysokość i kierunek', wyklad: 'S6_05', plansza: VF, cytat: 'Bywa też wielokształtny, gdy kolejne zespoły zmieniają wygląd, wysokość i kierunek.' },
    { wartosc: 'Wielokształtny VT: QRS zmienia kształt z pobudzenia na pobudzenie', wyklad: 'S6_03', plansza: SZER, cytat: 'Do tej samej szuflady trafia też wielokształtny VT, w którym QRS zmienia kształt z pobudzenia na pobudzenie.' },
    { wartosc: 'VF i pVT: „rytmy do defibrylacji”', wyklad: 'S6_05', plansza: VF, cytat: 'Stąd zbiorcza nazwa „rytmy do defibrylacji”.' },
    { wartosc: 'Klasyfikacja jedno- i wielokształtnego pVT', wyklad: 'S6_05', plansza: PRZ, cytat: 'Defibrylacji wymagają migotanie komór i częstoskurcz komorowy bez tętna, zarówno jednokształtny, jak i wielokształtny.' },
    { wartosc: 'Szerokie zespoły nie mówią, czy jest krążenie (panel tętna)', wyklad: 'S6_05', plansza: VF, cytat: 'Szerokie zespoły na monitorze nie mówią jednak, czy serce pompuje krew.' },
    { wartosc: 'Podział „do defibrylacji / nie do defibrylacji”', wyklad: 'S6_05', plansza: VF, cytat: 'Rozróżnienie „do defibrylacji / nie do defibrylacji” to pierwsza decyzja każdego zatrzymania krążenia.' },
    { wartosc: 'Asystolia i PEA: rytmy niedefibrylacyjne', wyklad: 'S6_05', plansza: VF, cytat: 'asystolia i PEA (aktywność elektryczna bez tętna: zapis wygląda znośnie, ale serce nie pompuje) to rytmy niedefibrylacyjne' },
    { wartosc: 'Asystolia: brak aktywności elektrycznej komór', wyklad: 'S6_05', plansza: VF, cytat: 'Asystolia to brak uchwytnej aktywności elektrycznej komór.' },
    { wartosc: 'Płaska linia: elektrody, wzmocnienie, inne odprowadzenie; odłączony przewód', wyklad: 'S6_05', plansza: VF, cytat: 'Zanim uwierzysz płaskiej linii, sprawdź połączenia elektrod, wzmocnienie sygnału i inne odprowadzenie, bo odłączony przewód da dokładnie taki sam obraz.' },
    { wartosc: 'Sprawdzanie płaskiej linii sprawnie, w krótkiej przerwie', wyklad: 'S6_05', plansza: VF, cytat: 'Robisz to sprawnie, przy trwającej RKO, w możliwie krótkiej przerwie potrzebnej do oceny rytmu.' },
    { wartosc: 'PEA: zorganizowany rytm inny niż VT, bez krążenia', wyklad: 'S6_05', plansza: VF, cytat: 'W PEA widzisz zorganizowany rytm inny niż częstoskurcz komorowy, a mimo to krążenia nie ma.' },
    { wartosc: 'PEA: wąskie albo szerokie, wolne albo szybkie', wyklad: 'S6_05', plansza: VF, cytat: 'QRS bywają wąskie albo szerokie, rytm wolny albo szybki.' },
    { wartosc: 'PEA: prąd płynie, przepływu brak', wyklad: 'S6_05', plansza: VF, cytat: 'Prąd płynie, impuls pobudza komory, ale skurcz nie daje przepływu.' },
    { wartosc: 'QRS w PEA nie oznaczają krążenia', wyklad: 'S6_05', plansza: PRZ, cytat: 'Obecność QRS w PEA nie oznacza zachowanego krążenia.' },
    { wartosc: 'Artefakt rysuje „migotanie” u przytomnego', wyklad: 'S6_05', plansza: VF, cytat: 'Odklejona elektroda, szczotkowanie zębów, drżenia mięśniowe, ruch pacjenta potrafią narysować „migotanie” u kogoś, kto rozmawia z tobą przytomnie' },
    { wartosc: 'Rytm oceniasz razem z pacjentem', wyklad: 'S6_05', plansza: VF, cytat: 'dlatego rytm zawsze oceniasz razem z pacjentem, nigdy osobno' },
    { wartosc: 'Narzędzia: elektrody i inne odprowadzenie', wyklad: 'S6_05', plansza: VF, cytat: 'Sprawdź elektrody i inne odprowadzenie.' },
    { wartosc: 'Narzędzie: zaznacz szczyty QRS pod zakłóceniami', wyklad: 'S6_05', plansza: VF, cytat: 'Czasem spod zakłóceń wyglądają regularnie powtarzające się własne QRS: zaznacz ich szczyty i sprawdź, czy odstępy są podobne.' },
    { wartosc: 'VF w EKG: nieregularne wychylenia o zmiennej amplitudzie', wyklad: 'S5_04', plansza: ICD1, cytat: 'W EKG nie rozpoznasz powtarzalnych zespołów QRS, tylko nieregularne wychylenia o zmiennej amplitudzie.' },
    { wartosc: 'Przytomny z „VF”: w innym odprowadzeniu prawidłowe QRS', wyklad: 'S5_04', plansza: ICD1, cytat: 'w innym odprowadzeniu odnajdziesz wtedy prawidłowe QRS, które powtarzają się pod zakłóceniami' },
  ],
  noweMorfologie: [
    'Migotanie komór grubofaliste i drobnofaliste: lokalna fala (5 składowych 3-8 Hz z dryfem częstości i zmienną obwiednią), amplituda poglądowa.',
    'Częstoskurcz komorowy jednokształtny (vent, ~180/min, bez podpisu częstością).',
    'Częstoskurcz komorowy wielokształtny: zespoły vent obracane w płaszczyźnie czołowej o pół obrotu na 9 pobudzeń, z amplitudą malejącą przy zmianie kierunku; ~220/min. Wygląda jak skręcanie wokół linii (torsade de pointes), ale podpisany tylko jako wielokształtny.',
    'PEA z wąskimi QRS (prawidłowe pobudzenia z P, ~95/min) i PEA z szerokimi QRS (vent bez P, ~36/min).',
    'Asystolia: linia z dryfem poniżej 0,02 mV.',
    'Artefakt ruchowy w II (3-7 Hz, do ~0,9 mV) nałożony na rytm zatokowy ~80/min; w I prawie niewidoczny.',
  ],
  doOkaJK: [
    'Wstawka pokazuje wyłącznie rozpoznanie i klasyfikację z tekstu; żadnych kroków RKO, energii, leków ani sekwencji leczenia. Jedyna wzmianka o RKO to dosłowne zdanie z S6_05 przy asystolii i odłączonym przewodzie (sprawdzanie w krótkiej przerwie). Etykiety VT brzmią „VT bez tętna, …”, bo klasyfikacja dotyczy VT bez tętna.',
    'Częstości i amplitudy rytmów są poglądowe (tekst ich nie podaje) i nie są podpisane liczbami; na monitorze stoi o tym notka.',
    'Pułapka „Odłączony przewód”: płaska linia, a po „Sprawdź elektrody” migotanie komór. Tekst mówi tylko, że odłączony przewód daje obraz jak asystolia; wybór VF jako rytmu „pod spodem” to decyzja dydaktyczna. W karcie rytm ma rozpoznanie VF; nie ma go w ćwiczeniu.',
    '„Zwiększ wzmocnienie” podwaja amplitudę na ekranie, bez podpisu liczbą. Drobne VF po wzmocnieniu wyraźnie odróżnia się od asystolii.',
    'Artefakt: pacjent przytomny, z tętnem; wstawka nazywa to „nie rytm zatrzymania krążenia, tylko zakłócenia” (wniosek z planszy, nie dosłowna klasyfikacja).',
    'Ćwiczenie: 6 monitorów, każde z pięciu rozpoznań co najmniej raz. W PEA i pVT o rozpoznaniu decyduje panel „Tętno: brak”.',
  ],
  stanKanoniczny: 'Tryb „Ucz się”, VF grubofaliste, odprowadzenie II, zwykłe wzmocnienie; pacjent nieprzytomny, nie oddycha prawidłowo, tętno: brak; klasyfikacja „Rytm do defibrylacji”. Przy „Ogranicz ruch” monitor zatrzymany na pełnym ekranie.',
};
