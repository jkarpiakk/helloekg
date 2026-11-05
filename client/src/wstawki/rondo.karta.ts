import type { Karta } from './core/zrodla.js';

const P1 = 'Krążenie nawrotne: fala na rondzie';
const P2 = 'Rondo z murowaną wyspą i rondo z pachołków';

export const KARTA: Karta = {
  id: 'rondo',
  miejsca: [{ wyklad: 'S7_01', plansza: P1 }],
  zrodla: [
    { wartosc: 'Fala w jednym kierunku, za nią pas zamknięty (okres refrakcji)', wyklad: 'S7_01', plansza: P1, cytat: 'Fala pobudzenia jedzie po nim w jednym kierunku, a za nią zostaje pas jezdni, który przez chwilę jest zamknięty' },
    { wartosc: 'Dogoni ogon za wcześnie: gaśnie; ogon się oddali: obieg trwa, jedno okrążenie = jedno pobudzenie', wyklad: 'S7_01', plansza: P1, cytat: 'Jeśli dogoni go za wcześnie, wpada na tkankę jeszcze niepobudliwą i gaśnie; jeśli ogon zdąży się oddalić, obieg trwa i każde okrążenie daje jedno pobudzenie serca.' },
    { wartosc: 'Dwie drogi połączone na obu końcach', wyklad: 'S7_01', plansza: P1, cytat: 'W klasycznym modelu rondo tworzą dwie drogi połączone na obu końcach.' },
    { wartosc: 'Szlaban: opuszczony, gdy podjeżdżasz, podniesiony, gdy wracasz', wyklad: 'S7_01', plansza: P1, cytat: 'jak szlaban, który jest opuszczony, gdy podjeżdżasz, i podniesiony, gdy wracasz' },
    { wartosc: 'Czas obiegu dłuższy niż refrakcja', wyklad: 'S7_01', plansza: P1, cytat: 'Trzeci to czas obiegu dłuższy niż refrakcja' },
    { wartosc: 'Refrakcja 250 ms', wyklad: 'S7_01', plansza: P1, cytat: 'odcinek właśnie pobudzony pozostaje niepobudliwy przez 250 ms' },
    { wartosc: 'Powrót po 200 ms gaśnie, po 300 ms następny obieg', wyklad: 'S7_01', plansza: P1, cytat: 'Fala, która wróci po 200 ms, zgaśnie, a ta, która wróci po 300 ms, zastanie tkankę gotową i rozpocznie następny obieg.' },
    { wartosc: 'Czasy przykładowe', wyklad: 'S7_01', plansza: P1, cytat: 'To przykładowe czasy, nie progi rozpoznania.' },
    { wartosc: 'Bez bloku dwie fale zderzają się i gasną', wyklad: 'S7_01', plansza: P1, cytat: 'Dwie drogi bez bloku nie wystarczą: pobudzenie przejdzie obiema, a dwie fale zderzą się i zgasną na tkance świeżo pobudzonej przez drugą.' },
    { wartosc: 'Krótki obwód: fala wjeżdża we własny ogon', wyklad: 'S7_01', plansza: P1, cytat: 'Szybkie przewodzenie w krótkim obwodzie też nie zadziała, jeśli fala wjedzie we własny ogon' },
    { wartosc: 'Napad rusza z miejsca, równy od pierwszego okrążenia', wyklad: 'S7_01', plansza: P1, cytat: 'napad zwykle nie rozkręca się stopniowo, tylko rusza z miejsca, równy od pierwszego okrążenia' },
    { wartosc: 'Rondo napędza się samo', wyklad: 'S7_01', plansza: P1, cytat: 'Węzeł zatokowy nie musi dostarczać impulsu na każde okrążenie; rondo napędza się samo.' },
    { wartosc: 'Pobudzenie przedwczesne: jedna droga otwarta, druga w refrakcji', wyklad: 'S7_01', plansza: P1, cytat: 'Trafia na dwie drogi w różnym stanie: jedna odzyskała już pobudliwość, druga wciąż jest w refrakcji.' },
    { wartosc: 'Później obie drogi gotowe, decyduje chwila nadejścia', wyklad: 'S7_01', plansza: P1, cytat: 'Pobudzenie, które przyszłoby później, zastałoby obie drogi gotowe, więc o wszystkim decyduje chwila nadejścia impulsu.' },
    { wartosc: 'Typowy AVNRT: blok w drodze szybkiej (dłuższa refrakcja), zejście wolną, powrót szybką', wyklad: 'S7_01', plansza: P1, cytat: 'Przedwczesne pobudzenie przedsionkowe trafia na drogę szybką, która ma zwykle dłuższą refrakcję, blokuje się w niej i schodzi drogą wolną.' },
    { wartosc: 'Na zapisie: przedwczesne P, wydłużone PQ, nagły miarowy częstoskurcz, P w QRS', wyklad: 'S7_01', plansza: P1, cytat: 'Na zapisie szukasz przedwczesnego P w II lub V1, często odkształcającego poprzedni załamek T, po nim wydłużonego PQ, bo impuls jechał drogą wolną, a potem nagłego, miarowego częstoskurczu, w którym P zwykle chowa się w QRS.' },
    { wartosc: 'Ćwiczenie: okrążenie 250 ms, refrakcja 200 ms, potem 280 ms', wyklad: 'S7_01', plansza: P2, cytat: 'pełne okrążenie trwa 250 ms, a tkanka w danym punkcie odzyskuje pobudliwość po 200 ms' },
    { wartosc: 'Ćwiczenie: refrakcja 280 ms, fala gaśnie', wyklad: 'S7_01', plansza: P2, cytat: 'Jeśli refrakcja w tym punkcie wydłuży się do 280 ms przy tym samym czasie okrążenia, fala wróci na tkankę jeszcze niepobudliwą i zgaśnie.' },
    { wartosc: 'Monitor w napadzie: 150/min (dolna granica AVNRT)', wyklad: 'S6_03', plansza: 'Wąskie QRS: rodzina nadkomorowa', cytat: 'częstość 150-220/min' },
    { wartosc: 'Monitor przed napadem: rytm zatokowy 75/min', wyklad: 'S1_02', plansza: 'Liczenie częstości w rytmie miarowym: reguła 300 i reguła 1500', cytat: 'Jeśli mijasz cztery duże kratki, odstęp RR trwa 0,80 s, a częstość wynosi 300 ÷ 4, czyli 75/min.' },
  ],
  noweMorfologie: [
    'Początek napadu AVNRT na jednym pasku II: przedwczesne P, wydłużone PQ, potem miarowy wąski częstoskurcz z wstecznym P na końcu QRS. Zapis powstaje ze zdarzeń ronda, nie z gotowego scenariusza.',
  ],
  doOkaJK: [
    'Etap „Zapalnik”: czasy dróg i refrakcji są poglądowe i tekst ich nie podaje. Same czasy są ukryte, ale ich skutek widać: HR 75 i 150 oraz długość PQ. Droga szybka ma dłuższą refrakcję, zgodnie z planszą. Okno zapalnika wynika z modelu.',
    'Tekst nie opisuje bodźca zbyt wczesnego (obie drogi zamknięte). Wynika to z reguły refrakcji; wstawka mówi: „obie drogi są jeszcze zamknięte i impuls nie wchodzi”.',
    'Wniosek modelu, nie cytat: w rytmie podstawowym impuls schodzi do komór drogą szybką, a w drodze wolnej fale zderzają się i gasną. Mówi o tym status etapu „Zapalnik”.',
    'Liczby 250/200/280 ms i zdanie o zmianie właściwości elektrycznych pochodzą z opisu krążenia czynnościowego (pachołki), a w ćwiczeniu scena ma murowaną wyspę.',
    'Przedwczesne P ma kształt zatokowego. Okno zapalnika wypada przed T, więc P pada na ST albo tuż przed T, a wykład mówi „często odkształcającego poprzedni załamek T”. Późniejsze okno musiałoby być węższe, bo refrakcja drogi szybkiej nie może przekroczyć czasu okrążenia.',
    'Dźwięki (tylko brzmienia z projektu z 28.10): tyk na start fali i przy powrocie na start, ton QRS na każde pobudzenie, zatrzask szlabanu przy opuszczeniu i podniesieniu, głuchy stuk, gdy fala gaśnie. Stuk to zjawisko, nie ocena; bodziec za wczesny, który nie wchodzi, jest cichy.',
    'Tekst nie opisuje jednej drogi bez drugiej. Wstawka mówi: „Przy jednej drodze impuls przejeżdża i nie ma którędy wrócić”, jako wniosek z definicji dwóch dróg.',
    'Fala krąży przeciwnie do ruchu wskazówek zegara, jak na polskim rondzie. Plan grafiki S7_01-N1 opisywał ruch zgodnie ze wskazówkami, więc grafikę warto ustawić tak samo.',
    'W czasie napadu model nie pokazuje pobudzeń zatokowych. Przerwania napadu jednym pobudzeniem wstawka nie pokazuje, choć plansza o nim wspomina; jest przycisk „Zacznij od nowa”.',
    'Wyspa ronda jest murowana także w etapie „Zapalnik”, choć węzeł AV to inny obwód niż pierścień; raster jest scenografią metafory, a pachołki należą do następnej planszy.',
  ],
  stanKanoniczny: 'Etap „Fala i ogon”, refrakcja 250 ms, powrót po 300 ms, fala tuż przed powrotem do startu, tryb „Ucz się”.',
};
