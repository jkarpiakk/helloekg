import type { Karta } from './core/zrodla.js';

const ST_T = 'Obniżenie odcinka ST i zmiany załamka T';
const U = 'Krótki QT, załamek U i nawyk oceny';
const T3 = 'Zmiany załamka T, wzorce szczególne i dynamika';
const P9 = 'Przypadki 6-10: wyższa stawka';

export const KARTA: Karta = {
  id: 'potas',
  miejsca: [
    { wyklad: 'S2_04', plansza: ST_T },
    { wyklad: 'S2_05', plansza: U },
    { wyklad: 'S3_03', plansza: T3 },
    { wyklad: 'S6_01', plansza: P9 },
  ],
  zrodla: [
    // hipokaliemia
    { wartosc: 'Hipokaliemia: spłaszczenie T, obniżenie ST, fala U', wyklad: 'S2_04', plansza: ST_T, cytat: 'Przy hipokaliemii, czyli obniżonym stężeniu potasu, może mu towarzyszyć obniżenie ST i wyraźna fala U, osobne, zwykle niewielkie wychylenie po T.' },
    { wartosc: 'Spłaszczenie T mało swoiste', wyklad: 'S2_04', plansza: ST_T, cytat: 'Spłaszczenie T jest mniej swoiste.' },
    { wartosc: 'Hipokaliemia: spłaszczone T i wyraźna fala U za T', wyklad: 'S3_03', plansza: 'Obniżenie ST: niedokrwienie podwsierdziowe', cytat: 'Hipokaliemii, czyli zbyt małemu stężeniu potasu, mogą towarzyszyć spłaszczone T i wyraźna fala U za T' },
    { wartosc: 'Niski T i duży U jak jeden dwugarbny załamek', wyklad: 'S2_05', plansza: U, cytat: 'Wydatny załamek U często towarzyszy hipokaliemii, w której T jednocześnie się spłaszcza; niski T i duży U potrafią wtedy wyglądać jak jeden długi, dwugarbny załamek.' },
    { wartosc: 'U najlepiej w przedsercowych, często V2-V3 (wybór odprowadzeń II, V2, V3)', wyklad: 'S2_05', plansza: U, cytat: 'najlepiej widoczny w odprowadzeniach przedsercowych, często w V2-V3' },
    { wartosc: 'Pomiar do końca U to QU', wyklad: 'S2_05', plansza: U, cytat: 'Pomiar do końca U daje bowiem odstęp QU' },
    { wartosc: 'Hipokaliemia spłaszcza T i uwydatnia U; QU zamiast QT', wyklad: 'S2_05', plansza: 'Wydłużony QT i torsade de pointes', cytat: 'hipokaliemia może spłaszczać T i uwydatniać U; długi odstęp do końca ostatniego wychylenia może wtedy oznaczać QU, a nie QT' },
    // hiperkaliemia: T
    { wartosc: 'T w hiperkaliemii: wąskie, ostro zakończone, symetryczne', wyklad: 'S2_04', plansza: ST_T, cytat: 'W hiperkaliemii T są częściej wąskie, ostro zakończone i symetryczne.' },
    { wartosc: 'Zmiany rozlane vs niedokrwienne w jednym obszarze', wyklad: 'S2_04', plansza: ST_T, cytat: 'Potas zmienia właściwości elektryczne komórek w całym sercu, więc zmiany bywają bardziej rozlane, podczas gdy niedokrwienne skupiają się zwykle w odprowadzeniach jednego obszaru.' },
    { wartosc: 'Hiperostre T: szerokie u podstawy', wyklad: 'S2_04', plansza: ST_T, cytat: 'Hiperostre T we wczesnym niedokrwieniu są symetryczne, szerokie u podstawy i nieproporcjonalnie duże względem poprzedzającego QRS' },
    { wartosc: 'Obok wysokich T: spłaszczenie P i poszerzenie QRS', wyklad: 'S2_04', plansza: ST_T, cytat: 'Obok wysokich T mogą pojawić się spłaszczenie P i poszerzenie QRS.' },
    { wartosc: 'T jak namiot: wąska podstawa, szpiczasty wierzchołek', wyklad: 'S3_03', plansza: T3, cytat: 'W hiperkaliemii, czyli nadmiarze potasu, T też bywają wysokie, ale częściej mają wąską podstawę i szpiczasty wierzchołek, jak namiot.' },
    { wartosc: 'Spłaszczenie P, wydłużenie PQ, poszerzenie QRS', wyklad: 'S3_03', plansza: T3, cytat: 'Poszukaj wtedy spłaszczenia P, wydłużenia PQ albo poszerzenia QRS i oznacz potas.' },
    { wartosc: 'Kształt T to tylko wskazówka', wyklad: 'S3_03', plansza: T3, cytat: 'Kształt T jest wskazówką' },
    // hiperkaliemia: przypadek 9
    { wartosc: 'Namiotowate T, szerokie QRS, znikające P, sinusoida', wyklad: 'S6_01', plansza: P9, cytat: 'namiotowate T, szerokie QRS, znikające P; w skrajnej postaci zapis przechodzi w sinusoidę' },
    { wartosc: 'Metafora: fala w gęstniejącym miodzie', wyklad: 'S6_01', plansza: P9, cytat: 'pobudzenie rozchodzi się wolniej, jak fala w gęstniejącym miodzie' },
    { wartosc: 'Wolniejsze przewodzenie, szeroki QRS; QRS zlewa się z T w sinusoidę', wyklad: 'S6_01', plansza: P9, cytat: 'Na zapisie widzisz to jako wydłużone przewodzenie i poszerzony QRS, a w ciężkich przypadkach QRS zlewa się z T w jedną falującą sinusoidę.' },
    { wartosc: 'Zastrzeżenie: kolejność niepewna, prawidłowy zapis możliwy, T nie mówi o stężeniu', wyklad: 'S6_01', plansza: P9, cytat: 'Zmiany nie zawsze pojawiają się w tym porządku, prawidłowy zapis może towarzyszyć nawet ciężkiej hiperkaliemii, a z wysokości T nie odczytasz stężenia potasu.' },
    { wartosc: 'T wąskie i spiczaste, zmiany w wielu odprowadzeniach', wyklad: 'S6_01', plansza: P9, cytat: 'W hiperkaliemii T są wąskie i spiczaste, a towarzyszą im zaburzenia przewodzenia, często widoczne w wielu odprowadzeniach.' },
    { wartosc: 'Z długości PQ nie odczytasz potasu', wyklad: 'S4_01', plansza: 'Skąd się bierze i czy jest groźny', cytat: 'jego wartości nie odczytasz z długości PQ' },
    { wartosc: 'Znaczna hiperkaliemia wydłuża QRS', wyklad: 'S2_03', plansza: 'Wąski czy szeroki: co mówi czas trwania', cytat: 'Przy znacznej hiperkaliemii, czyli dużym wzroście stężenia potasu we krwi, komórki gorzej przewodzą pobudzenie i QRS może się wydłużać.' },
  ],
  noweMorfologie: [
    'Hipokaliemia: T obniżone do 30%, rozlane obniżenie ST (prąd „uszkodzenia” o ujemnym znaku skierowany w dół, w lewo i do przodu): 0,2-0,4 mm w I, II, III, aVF, 0,6-0,9 mm w V2-V5, 0,3-0,4 mm w V1 i V6; aVR +0,3 mm to nieunikniony skutek uboczny wektora (obraz przeciwstronny), tekst go nie opisuje, fala U 0,1 mV w II i 0,25-0,3 mV w V2-V4; w V2-V3 niski T z dużym U.',
    'Hiperkaliemia, szpiczaste T: T × 2,3, zwężone (tSharp 1,9) i symetryczne (obie połówki równej szerokości). W V3 T ok. 0,85 mV przy R 0,2 mV.',
    'Hiperkaliemia, zmiany P i PQ: jak wyżej + P do 40% amplitudy, PQ 0,24 s.',
    'Hiperkaliemia, szeroki QRS: jak wyżej, bez P, QRS rozciągnięty 1,7 raza (ok. 150 ms w modelu) przy zachowanym kształcie.',
    'Obraz sinusoidalny zbudowany lokalnie: szerokie wychylenie QRS i T przeciwnej polarności w równych odstępach (RR 1,00 s, szerokości proporcjonalne do RR), tak że zapis tworzy ciągłą falę; w widoku 12 odprowadzeń z dołożonymi sąsiednimi pobudzeniami. Kierunek fali dobrany tak, by była widoczna w II, V2 i V3 (w V4 prawie płaska).',
  ],
  doOkaJK: [
    'Wykłady nie podają stężeń potasu, więc suwak nie ma żadnych liczb, tylko „niższy / wyższy potas” i stałe zastrzeżenie z S6_01.',
    'Kolejność czterech obrazów hiperkaliemii na suwaku (T → P i PQ → szeroki QRS z zanikiem P → sinusoida) to kolejność z polecenia; tekst wymienia zmiany P/PQ i poszerzenie QRS obok siebie („albo”), bez jednoznacznej kolejności między nimi. Ćwiczenie „ułóż w kolejności” ocenia więc tylko trzy obrazy: szpiczaste T → szeroki QRS → sinusoida.',
    'Szpiczaste T w modelu mają ten sam czas szczytu co w normie, więc są węższe i kończą się wcześniej (QT na rysunku nieco krótszy). Tekst nie mówi o zmianie QT w hiperkaliemii.',
    'W hipokaliemii QT nie zostało wydłużone ponad normę modelu; tekst wymienia hipokaliemię wśród przyczyn wydłużenia QT, ale obraz pokazuje przede wszystkim płaski T, obniżony ST i U.',
    'Obraz sinusoidalny ma częstość 60/min (RR 1,00 s), bez podpisu częstości; tekst nie podaje częstości sinusoidy.',
    'Ćwiczenie: 4 zadania „rozpoznaj obraz” (losowe odprowadzenie II, V2 lub V3) + 1 „ułóż w kolejności”. „Blisko”, gdy wybrano inny obraz tej samej grupy (np. inny obraz hiperkaliemii).',
    'Ostrzeżenie o leczeniu bez czekania na wynik potasu (S6_01) celowo pominięte: wstawka pokazuje zjawisko, nie decyzję terapeutyczną.',
  ],
  stanKanoniczny: 'Tryb „Ucz się”, zapis prawidłowy, jedno odprowadzenie V3, 25 mm/s, 10 mm/mV, zastrzeżenie widoczne pod paskiem.',
};
