import type { Karta } from './core/zrodla.js';

const W = 'Wąskie QRS: rodzina nadkomorowa';
const P15 = 'Przypadki 1-5: fundamenty';

export const KARTA: Karta = {
  id: 'adenozyna',
  miejsca: [
    { wyklad: 'S6_03', plansza: W },
    { wyklad: 'S6_01', plansza: P15 },
  ],
  zrodla: [
    /* podpisy scen z rastra marki nad schematem */
    { wartosc: 'Scena AVNRT: brama otwarta, pętla w węźle', wyklad: 'S6_03', plansza: W, cytat: 'pętla mieści się w samym węźle i jego otoczeniu' },
    { wartosc: 'Scena AVRT: skrót w murze obok bramy (droga dodatkowa)', wyklad: 'S6_03', plansza: 'Szerokie QRS: tu się nie ryzykuje', cytat: 'Dodatkowa droga to tylne wejście, które omija bramę AV razem z jej odźwiernym' },
    /* narzędzie i jego mechanizm */
    { wartosc: 'Zabiegi na nerw błędny i adenozyna jako narzędzie przy wąskim, miarowym częstoskurczu', wyklad: 'S6_03', plansza: W, cytat: 'Przy wąskich, miarowych częstoskurczach masz też narzędzie diagnostyczno-terapeutyczne: zabiegi zwiększające napięcie nerwu błędnego, a w warunkach monitorowanych adenozynę.' },
    { wartosc: 'Zwolnienie węzła AV przerywa AVNRT i ortodromowy AVRT, w trzepotaniu odsłania fale', wyklad: 'S6_03', plansza: W, cytat: 'przejściowe zwolnienie węzła AV przerywa częstoskurcze, których pętla przechodzi przez węzeł (AVNRT, ortodromowy AVRT), a przy trzepotaniu zwykle odsłania fale przedsionkowe, nie przerywając arytmii' },
    { wartosc: 'Próba Valsalvy u stabilnego pacjenta', wyklad: 'S6_03', plansza: W, cytat: 'U stabilnego pacjenta zaczynasz od próby Valsalvy' },
    { wartosc: 'Valsalva: odźwierny przymyka bramę AV, pętla pęka', wyklad: 'S6_03', plansza: W, cytat: 'Odruchowo rośnie napięcie nerwu błędnego, odźwierny przymyka bramę AV, a jeśli węzeł jest częścią pętli, pętla pęka i napad się kończy.' },
    { wartosc: 'Adenozynę podaje lekarz, monitorowane EKG, gotowość do resuscytacji', wyklad: 'S6_03', plansza: W, cytat: 'Gdy próba Valsalvy zawiedzie, lekarz może podać adenozynę, przy monitorowanym EKG i w gotowości do resuscytacji.' },
    { wartosc: 'Adenozyna na kilka chwil zamyka bramę AV', wyklad: 'S6_03', plansza: W, cytat: 'Lek na kilka chwil zamyka bramę AV.' },
    { wartosc: 'AVNRT i AVRT ustępują po adenozynie', wyklad: 'S6_03', plansza: W, cytat: 'AVNRT i ortodromowy AVRT zwykle ustępują, bo tracą fragment pętli.' },
    { wartosc: 'Trzepotanie: adenozyna zmniejsza liczbę impulsów i odsłania piłę', wyklad: 'S6_03', plansza: W, cytat: 'W trzepotaniu adenozyna najczęściej tylko zmniejsza liczbę impulsów docierających do komór i na moment odsłania piłę fal przedsionkowych.' },
    { wartosc: 'Zakończenie napadu nie dowodzi AVNRT ani AVRT', wyklad: 'S6_03', plansza: W, cytat: 'niektóre ogniskowe częstoskurcze przedsionkowe też ustępują po adenozynie, więc samo zakończenie napadu nie dowodzi AVNRT ani AVRT' },
    { wartosc: 'Wydruk z chwili podania', wyklad: 'S6_03', plansza: W, cytat: 'krótki fragment ze zwolnieniem komór często najlepiej pokazuje, co robią przedsionki' },
    { wartosc: 'Adenozyny nie stosuje się w migotaniu z preekscytacją', wyklad: 'S6_03', plansza: W, cytat: 'Adenozyny nie stosuje się w migotaniu z preekscytacją' },
    { wartosc: 'Zwolnienie przewodzenia AV odsłania aktywność przedsionków', wyklad: 'S6_03', plansza: 'Przypomnij sobie', cytat: 'Może przerwać AVNRT lub ortodromowy AVRT albo odsłonić aktywność przedsionków, na przykład fale trzepotania.' },
    { wartosc: 'Po ustąpieniu: zakończenie napadu i powrót rytmu zatokowego', wyklad: 'S6_03', plansza: 'Gdy zapis w napadzie się nie udał', cytat: 'Zachowaj też fragment jej zakończenia i EKG po powrocie rytmu zatokowego' },
    /* AVNRT / AVRT */
    { wartosc: 'Częstoskurcz nawrotny: 150-220/min, P w QRS albo tuż za nim', wyklad: 'S6_03', plansza: W, cytat: 'start jak pstryknięcie przełącznika, częstość 150-220/min, P schowane w QRS albo tuż za nim' },
    { wartosc: 'AVNRT: w dół drogą wolną, w górę drogą szybką', wyklad: 'S6_03', plansza: W, cytat: 'W typowej postaci impuls schodzi do komór drogą wolną, a wraca drogą szybką.' },
    { wartosc: 'AVNRT: P ginie w QRS', wyklad: 'S6_03', plansza: W, cytat: 'Przedsionki i komory pobudzają się niemal równocześnie, więc P najczęściej ginie w QRS.' },
    { wartosc: 'AVNRT: rąbek P w V1 dodatni, w dolnych ujemny', wyklad: 'S6_03', plansza: W, cytat: 'w V1 jako drobne dodatnie wychylenie na końcu zespołu, w odprowadzeniach dolnych jako niewielkie ujemne wychylenie przy jego końcu' },
    { wartosc: 'AVNRT: małe kółko w okolicy węzła, dwie drogi', wyklad: 'S6_01', plansza: P15, cytat: 'W typowym AVNRT impuls krąży w małym kółku w okolicy węzła AV, wykorzystując dwie drogi przewodzenia: jedną biegnie w stronę komór, drugą wraca.' },
    { wartosc: 'AVNRT: z kółka jednocześnie w górę i w dół (strzałki na schemacie)', wyklad: 'S6_01', plansza: P15, cytat: 'Z tego kółka pobudzenie rozchodzi się jednocześnie w górę, do przedsionków, i w dół, do komór, więc P ginie w QRS.' },
    { wartosc: 'Nazwa pseudo-r′ (V1)', wyklad: 'S6_01', plansza: P15, cytat: 'W V1 wsteczne pobudzenie przedsionków wygląda wtedy jak małe dodatnie wychylenie na końcu QRS, nazywane pseudo-r′' },
    { wartosc: 'Nazwa pseudo-S (II, III, aVF)', wyklad: 'S6_01', plansza: P15, cytat: 'a w II, III i aVF jak niewielki załamek S, czyli pseudo-S' },
    { wartosc: 'Ortodromowy AVRT: w dół przez węzeł, w górę drogą dodatkową, wąski QRS', wyklad: 'S6_03', plansza: W, cytat: 'impuls schodzi do komór przez węzeł AV i układ Hisa-Purkinjego, dlatego QRS jest zwykle wąski, a wraca do przedsionków dodatkową drogą' },
    { wartosc: 'AVRT: wsteczny P za QRS', wyklad: 'S6_03', plansza: W, cytat: 'Ta podróż trwa dłużej, więc wsteczny P częściej widać oddzielnie, za QRS.' },
    { wartosc: 'AVRT: pętla przez drogę dodatkową', wyklad: 'S6_01', plansza: P15, cytat: 'Podobny obraz da nawrotny częstoskurcz przedsionkowo-komorowy (AVRT), w którym pętla biegnie przez drogę dodatkową.' },
    { wartosc: 'AVRT bez fali delta w rytmie zatokowym (droga tylko wsteczna)', wyklad: 'S6_03', plansza: 'Gdy zapis w napadzie się nie udał', cytat: 'Brak fali delta nie wyklucza jednak AVRT, bo dodatkowa droga może przewodzić wyłącznie wstecznie.' },
    /* trzepotanie */
    { wartosc: 'Trzepotanie 2:1: komory ok. 150/min', wyklad: 'S6_03', plansza: W, cytat: 'trzepotanie 2:1 z komorami około 150/min' },
    { wartosc: 'Miarowe 150: szukaj zębów piły', wyklad: 'S6_03', plansza: W, cytat: 'dlatego przy każdym „miarowym 150” szukaj zębów piły' },
    { wartosc: 'Trzepotanie: przedsionki ok. 300/min, odźwierny wpuszcza co drugi', wyklad: 'S6_03', plansza: W, cytat: 'Przy trzepotaniu przedsionki pobudzają się zwykle około 300/min, a odźwierny w bramie AV wpuszcza do komór co drugi impuls.' },
    { wartosc: 'RR 0,40 s = 150/min', wyklad: 'S6_03', plansza: W, cytat: 'Dwie duże kratki między R to 0,40 s, czyli 150/min.' },
    { wartosc: 'Jedna fala F chowa się w QRS albo T', wyklad: 'S6_03', plansza: W, cytat: 'jedna fala trzepotania stoi na widoku między QRS, druga chowa się w QRS albo w T' },
    { wartosc: 'Zęby piły ujemne w dolnych', wyklad: 'S6_03', plansza: W, cytat: 'regularne fale przedsionkowe przypominają zęby piły i w odprowadzeniach dolnych są zwykle ujemne' },
    { wartosc: 'Tor w prawym przedsionku (schemat)', wyklad: 'S6_01', plansza: P15, cytat: 'pobudzenie krąży jak bolid po dużym torze w prawym przedsionku' },
    { wartosc: 'Zwolnienie AV odsłania fale F', wyklad: 'S6_01', plansza: P15, cytat: 'fale trzepotania około 300/min, a zwolnienie przewodzenia AV potrafi odsłonić je jeszcze wyraźniej' },
    /* częstoskurcz przedsionkowy */
    { wartosc: 'Ogniskowy częstoskurcz przedsionkowy: jedno miejsce w przedsionku', wyklad: 'S6_03', plansza: W, cytat: 'Wąski i miarowy częstoskurcz może też wychodzić z jednego miejsca w przedsionku, poza węzłem zatokowym' },
    { wartosc: 'Muzyk przejął batutę', wyklad: 'S6_03', plansza: W, cytat: 'Jakby jeden z muzyków przejął batutę i zaczął grać szybciej niż dyrygent.' },
    { wartosc: 'P o innym kształcie, linia izoelektryczna między P', wyklad: 'S6_03', plansza: W, cytat: 'P ma wtedy zwykle inny kształt niż w rytmie zatokowym, a między kolejnymi P znajdziesz odcinki linii izoelektrycznej.' },
    { wartosc: 'Przy nieprzewodzeniu P biegną dalej we własnym rytmie', wyklad: 'S6_03', plansza: W, cytat: 'Gdy część impulsów nie przechodzi do komór, P dalej powtarzają się we własnym rytmie' },
    { wartosc: 'P także w obrębie T', wyklad: 'S6_03', plansza: W, cytat: 'szukasz odrębnych załamków przedsionkowych, także w obrębie T' },
    /* tachykardia zatokowa */
    { wartosc: 'Tachykardia zatokowa: powyżej 100/min', wyklad: 'S6_03', plansza: W, cytat: 'tachykardia zatokowa, czyli rytm zatokowy szybszy niż 100/min' },
    { wartosc: 'Tachykardia zatokowa: stopniowo narasta i opada, P na miejscu', wyklad: 'S6_03', plansza: W, cytat: 'częstość zwykle stopniowo narasta i opada, załamki P zatokowe są na miejscu' },
    { wartosc: 'Leczysz przyczynę, nie zapis', wyklad: 'S6_03', plansza: W, cytat: 'więc leczysz przyczynę, nie zapis' },
    { wartosc: 'Przykład: 120/min, dodatnie P w II', wyklad: 'S6_03', plansza: W, cytat: 'Przykład: pacjent z gorączką, częstość 120/min, dodatnie P w II' },
    { wartosc: 'Dyrygent wybija szybsze tempo', wyklad: 'S6_03', plansza: W, cytat: 'W tachykardii zatokowej dyrygent, węzeł zatokowy, po prostu wybija szybsze tempo.' },
    { wartosc: 'P przed każdym QRS', wyklad: 'S6_03', plansza: W, cytat: 'P jest dodatni w II i ujemny w aVR, stoi przed każdym QRS' },
  ],
  noweMorfologie: [
    'AVNRT: wsteczny P o własnym wektorze [−0,03; −0,2; 0,09] mV, początek 0,05 s po początku QRS, szczyt przy końcu QRS: w V1 końcowy ząbek ok. +0,17 mV (pseudo-r′), w II pogłębiony koniec QRS (pseudo-S). Tempo w modelu 170/min, podpis tylko „150-220/min”.',
    'Ortodromowy AVRT: wsteczny P ujemny w II w odcinku ST, oddzielnie za QRS. Tempo w modelu 180/min, podpis „150-220/min”.',
    'Ogniskowy częstoskurcz przedsionkowy: P ujemne w II (model „ectopic-low”, ×2), 160/min w modelu bez podpisu, przewodzenie 1:1, potem przejściowe nieprzewodzenie z P biegnącymi dalej.',
    'Trzepotanie 2:1 z przejściowym zwolnieniem przewodzenia AV: odsłonięte fale F (tło „flutter” 0,17 mV).',
    'Nagłe zakończenie częstoskurczu, pauza i powrót rytmu zatokowego.',
    'Tachykardia zatokowa 120/min.',
  ],
  doOkaJK: [
    'Luka w tekście: wykład nie opisuje odpowiedzi tachykardii zatokowej na próbę Valsalvy ani adenozynę. Przyciski są dla niej wyłączone z krótkim wyjaśnieniem.',
    'Częstoskurcz przedsionkowy + próba Valsalvy: odpowiedź (komory zwalniają, P biegną dalej) wyprowadzona z ogólnego zdania „może odsłonić aktywność przedsionków”. Wariant „ustępuje po adenozynie” jest tylko w tekście ostrzeżenia, nie w symulacji.',
    'AVNRT i AVRT w symulacji ustępują zawsze (tekst: „zwykle”), także po próbie Valsalvy; opis odpowiedzi dopowiada, że Valsalva nie zawsze się udaje (tekst: „Gdy próba Valsalvy zawiedzie”).',
    'Czasy działania skrócone dla wstawki i bez podpisu: Valsalva po 1,2 s, adenozyna po 2 s; przymknięcie bramy 3 s / 3,6 s (przy AVNRT i AVRT tylko do powrotu rytmu zatokowego). Pauza po ustąpieniu 0,9 s / 1,5 s, rytm zatokowy potem 75/min, bez podpisu.',
    'Trzepotanie po adenozynie: przez pierwszą część okna żadna fala F nie przechodzi, potem co czwarta; po Valsalvie co czwarta. Bez podpisu proporcji.',
    'AVRT z drogą przewodzącą tylko wstecznie (bez fali delta w rytmie zatokowym po ustąpieniu).',
    'Schemat: droga dodatkowa narysowana umownie po lewej stronie. Tor trzepotania obiega przeciwnie do ruchu wskazówek zegara w widoku od przodu (typowe trzepotanie); tekst nie podaje kierunku.',
    'Sceny z rastra marki: brama otwarta → po Valsalvie uchylona („przymyka”), po adenozynie zamknięta („zamyka”) na czas okna → otwarta; AVRT ze skrótem w murze (metafora „tylnego wejścia” z planszy o szerokich QRS); tachykardia zatokowa: orkiestra z dyrygentem. Brama zamknięta ma odźwiernego, otwarta i uchylona nie (takie są rastry). W ćwiczeniu scena ukryta do sprawdzenia. Schemat pętli bez postaci.',
    'Masaż zatoki szyjnej pominięty (tekst podkreśla kwalifikację i przeciwwskazania, nie opisuje osobnego obrazu EKG).',
    'QT i szerokość T skrócone w modelu przy szybkich rytmach, żeby T nie wchodził w następny QRS.',
    'Ćwiczenie: rozróżnienie AVNRT i AVRT opiera się na położeniu wstecznego P przed podaniem, ze słowem „najpewniej”.',
  ],
  stanKanoniczny: 'AVNRT na kardiomonitorze, odprowadzenie II, przed podaniem czegokolwiek; przy „Ogranicz ruch” monitor zatrzymany, a wydruk odpowiedzi pojawia się od razu po wybraniu próby Valsalvy lub adenozyny.',
};
