import type { Karta } from './core/zrodla.js';

const S401 = 'Brama, która otwiera się za wolno';
const S402a = 'Zmęczona brama: narastające opóźnienie aż do wypadnięcia';
const S402b = 'Subtelne cechy: skracające się odstępy RR i „grupowanie” uderzeń';
const S403a = 'Nagłe wypadnięcie bez ostrzeżenia';
const S403c = 'Blok 2:1 i blok zaawansowany: pułapki klasyfikacji';
const S404a = 'Dwa serca w jednym: całkowita dysocjacja';
const S404b = 'Rytm zastępczy decyduje o stabilności';
const S202 = 'Co mierzy odstęp PQ';

export const KARTA: Karta = {
  id: 'wezel-av',
  miejsca: [
    { wyklad: 'S4_01', plansza: S401 },
    { wyklad: 'S4_02', plansza: S402a },
    { wyklad: 'S4_02', plansza: S402b },
    { wyklad: 'S4_03', plansza: S403a },
    { wyklad: 'S4_03', plansza: S403c },
    { wyklad: 'S4_04', plansza: S404a },
  ],
  zrodla: [
    /* podpisy scen odźwiernego (raster marki nad paskiem) */
    { wartosc: 'Scena Mobitz I po pauzie: odźwierny rozbudzony', wyklad: 'S4_02', plansza: S402a, cytat: 'i wtedy „odpoczywa”, by następnego znów wpuścić szybko' },
    { wartosc: 'Scena Mobitz II: spokojny, przy wypadnięciu nagle zamknięta brama', wyklad: 'S4_03', plansza: S403a, cytat: 'przełącznik, który przez większość czasu przepuszcza sygnał punktualnie, po czym bez zapowiedzi „przeskakuje” i jedno pobudzenie ginie' },
    { wartosc: 'Scena 2:1: co drugi P', wyklad: 'S4_03', plansza: S403c, cytat: 'gdy co drugi załamek P jest przewiedziony' },
    { wartosc: 'Scena 2:1 przy wysiłku: odźwierny rozbudzony', wyklad: 'S4_01', plansza: 'Skąd się bierze i czy jest groźny', cytat: 'Gdy podczas wysiłku wpływ nerwu błędnego maleje, odźwierny się rozbudza' },
    { wartosc: 'Scena III°: brama zamknięta', wyklad: 'S4_04', plansza: S404a, cytat: 'Żaden impuls przedsionkowy nie dociera do komór' },
    /* metafora i pomiar */
    { wartosc: 'Węzeł AV = brama, której pilnuje odźwierny', wyklad: 'S2_02', plansza: S202, cytat: 'Węzeł AV to brama, której pilnuje odźwierny: każe każdemu impulsowi chwilę poczekać przed wejściem do komór.' },
    { wartosc: 'Norma PQ 0,12-0,20 s', wyklad: 'S2_02', plansza: S202, cytat: 'Prawidłowy odstęp PQ u dorosłych trwa 0,12-0,20 s' },
    { wartosc: 'Mała kratka 0,04 s (przeliczenie kratek i cyrkla)', wyklad: 'S2_02', plansza: S202, cytat: 'Przy przesuwie 25 mm/s jedna mała kratka to 0,04 s' },
    { wartosc: 'PQ 0,16 s = 4 małe kratki (stan prawidłowy)', wyklad: 'S2_02', plansza: S202, cytat: 'Cztery małe kratki przy 25 mm/s oznaczają 0,16 s.' },
    { wartosc: 'P-P 0,80 s = 75/min', wyklad: 'S4_03', plansza: S403a, cytat: 'Przy odstępach P-P wynoszących 0,80 s przedsionki pracują z częstością 75/min' },
    /* I° */
    { wartosc: 'Blok I°: PQ powyżej 0,20 s, przewodzenie 1:1', wyklad: 'S4_01', plansza: S401, cytat: 'wydłużenie odstępu PQ powyżej 0,20 s, czyli 200 ms (ponad 5 małych kratek), przy zachowanej relacji 1:1' },
    { wartosc: 'Blok I°: PQ 0,24 s = 6 kratek', wyklad: 'S4_01', plansza: S401, cytat: 'Sześć kratek to 6 × 0,04 s, czyli PQ 0,24 s: to już blok I stopnia.' },
    { wartosc: 'Blok I° przy częstości 75/min', wyklad: 'S4_01', plansza: S401, cytat: 'PQ 0,24 s może więc współistnieć ze zwyczajną częstością 75/min.' },
    { wartosc: 'Brama otwiera się leniwiej', wyklad: 'S4_01', plansza: S401, cytat: 'po prostu otwiera się leniwiej, przepuszczając każde uderzenie z opóźnieniem' },
    { wartosc: 'Odźwierny w I° przetrzymuje impuls dłużej', wyklad: 'S4_01', plansza: S401, cytat: 'W bloku I stopnia odźwierny przetrzymuje impuls dłużej niż zwykle, ale w końcu wpuszcza każdy.' },
    { wartosc: 'Odźwierny daje przedsionkom czas na dopełnienie komór', wyklad: 'S4_01', plansza: S401, cytat: 'Pilnuje jej odźwierny, który każe każdemu impulsowi chwilę poczekać, żeby przedsionki zdążyły dopełnić komory krwią przed ich skurczem.' },
    { wartosc: 'Długie PQ + każdy P ma swój QRS', wyklad: 'S4_01', plansza: S401, cytat: 'Cecha do zapamiętania: długie PQ + każdy P ma swój QRS.' },
    { wartosc: 'Blok I° nie zwalnia rytmu komór', wyklad: 'S4_01', plansza: S401, cytat: 'nie zwalnia rytmu komór, skoro każdy impuls nadal do nich dociera' },
    /* Mobitz I */
    { wartosc: 'Wenckebach: PQ 0,16 / 0,28 / 0,36 s (4, 7, 9 kratek)', wyklad: 'S4_02', plansza: S402a, cytat: 'Od początku P do początku kolejnych QRS liczysz cztery, siedem i dziewięć małych kratek, więc PQ wynosi kolejno 0,16 s, 0,28 s i 0,36 s.' },
    { wartosc: 'Wenckebach: po pauzie PQ 0,16 s', wyklad: 'S4_02', plansza: S402a, cytat: 'Następny P nie ma po sobie QRS, a po pauzie PQ wraca do 0,16 s.' },
    { wartosc: 'Wenckebach: przewodzenie 4:3', wyklad: 'S4_02', plansza: S402a, cytat: 'Na cztery pobudzenia przedsionków przypadają trzy pobudzenia komór, czyli przewodzenie wynosi 4:3.' },
    { wartosc: 'Zmęczony odźwierny, który odpoczywa', wyklad: 'S4_02', plansza: S402a, cytat: 'to jak coraz bardziej zmęczony odźwierny, który każdemu kolejnemu gościowi otwiera coraz wolniej, aż w końcu jednego nie wpuszcza w ogóle, i wtedy „odpoczywa”' },
    { wartosc: 'Rdzeń Wenckebacha', wyklad: 'S4_02', plansza: S402a, cytat: 'PQ rośnie, rośnie, rośnie, wypada QRS, reset' },
    { wartosc: 'Dla zablokowanego P nie podajesz PQ', wyklad: 'S4_02', plansza: S402a, cytat: 'Dla zablokowanego P nie zapisujesz wartości PQ' },
    { wartosc: 'Wenckebach zwykle w węźle AV (blok „w bramie” na diagramie)', wyklad: 'S4_02', plansza: S402a, cytat: 'przewodzenie, najczęściej w węźle AV, stopniowo się pogarsza z uderzenia na uderzenie' },
    { wartosc: 'Wenckebach: RR 0,92 s przy P-P 0,80 s', wyklad: 'S4_02', plansza: S402b, cytat: 'Jeśli przedsionki pobudzają się co 0,80 s, pierwszy RR wynosi 0,92 s' },
    { wartosc: 'Wenckebach: RR 0,88 s', wyklad: 'S4_02', plansza: S402b, cytat: 'Następny RR wynosi 0,88 s' },
    { wartosc: 'Wenckebach: pauza 1,40 s, krótsza niż 2 × PP', wyklad: 'S4_02', plansza: S402b, cytat: 'Przy stałym PP i jednym zablokowanym impulsie trwa krócej niż dwa odstępy PP: w naszym przykładzie 1,40 s' },
    { wartosc: 'Wenckebach: komory ok. 56/min', wyklad: 'S4_02', plansza: S402b, cytat: 'Przedsionki w naszym przykładzie pracują z częstością 75/min, ale przy utrzymującym się przewodzeniu 4:3 średnia częstość komór wynosi około 56/min.' },
    { wartosc: 'Zablokowany P chowa się w T', wyklad: 'S4_02', plansza: S402b, cytat: 'Zajrzyj też do załamków T, bo zablokowany P lubi się w nich chować' },
    { wartosc: 'Cyrkiel: przenieś odstęp P-P', wyklad: 'S4_02', plansza: S402b, cytat: 'Odmierz odstęp między dobrze widocznymi P i przenieś go na fragment z pauzą' },
    /* Mobitz II */
    { wartosc: 'Mobitz II: PQ stałe', wyklad: 'S4_03', plansza: S403a, cytat: 'odstęp PQ pozostaje stały w kolejnych przewiedzionych pobudzeniach' },
    { wartosc: 'Mobitz II: PQ 0,16 s w dwóch kolejnych przewiedzionych', wyklad: 'S4_03', plansza: S403a, cytat: 'W dwóch kolejnych przewiedzionych pobudzeniach od początku P do początku QRS liczysz cztery kratki, czyli 0,16 s.' },
    { wartosc: 'Mobitz II: pauza 1,60 s', wyklad: 'S4_03', plansza: S403a, cytat: 'a przerwa między QRS obejmująca jeden zablokowany P trwa 1,60 s' },
    { wartosc: 'Mobitz II: pauza = 2 × RR', wyklad: 'S4_03', plansza: S403a, cytat: 'pauza dokładnie dwa razy dłuższa od wcześniejszego RR' },
    { wartosc: 'Mobitz II: brak zmęczenia bramy', wyklad: 'S4_03', plansza: S403a, cytat: 'Nie ma „narastającego zmęczenia bramy” jak w Wenckebachu' },
    { wartosc: 'Mobitz II: blok poniżej węzła (na diagramie w pasie pęczka Hisa)', wyklad: 'S4_03', plansza: S403a, cytat: 'poniżej niego, w układzie Hisa-Purkinjego, czyli w pęczku Hisa lub dalszych drogach rozprowadzających impuls po komorach' },
    { wartosc: 'Mobitz II: szeroki QRS (blok odnogi)', wyklad: 'S4_03', plansza: S403a, cytat: 'Mobitz II często wiąże się z szerokim zespołem QRS (współistniejący blok odnogi)' },
    { wartosc: 'Szeroki QRS ≥ 120 ms', wyklad: 'S4_03', plansza: S403a, cytat: 'Szeroki QRS trwa co najmniej 120 ms.' },
    { wartosc: 'Mobitz II: co najmniej dwa kolejne przewiedzione P', wyklad: 'S4_03', plansza: S403a, cytat: 'Do rozpoznania potrzebujesz co najmniej dwóch kolejnych przewiedzionych P' },
    /* 2:1 i zaawansowany */
    { wartosc: '2:1: przedsionki 80/min, komory 40/min, pułapka „bradykardii zatokowej”', wyklad: 'S4_03', plansza: S403c, cytat: 'Przy częstości przedsionków 80/min komory w bloku 2:1 pracują z częstością 40/min i jeśli przeoczysz nieprzewiedzione P, opiszesz zapis jako bradykardię zatokową.' },
    { wartosc: '2:1: P chowa się w T', wyklad: 'S4_03', plansza: S403c, cytat: 'Zajrzyj do załamków T i na odcinki między QRS, bo tam lubi chować się dodatkowy P.' },
    { wartosc: '2:1: przeniesienie odstępu P-P', wyklad: 'S4_03', plansza: S403c, cytat: 'Przenieś odległość między dwoma widocznymi P na dalszy fragment zapisu' },
    { wartosc: '2:1: spoczynkowy zapis taki sam przy obu poziomach', wyklad: 'S4_03', plansza: S403c, cytat: 'tak samo wygląda to przy bloku węzłowym i podwęzłowym' },
    { wartosc: '2:1: wąski QRS i długie PQ raczej węzłowy', wyklad: 'S4_03', plansza: S403c, cytat: 'wąski QRS i wydłużone PQ przemawiają raczej za blokiem węzłowym' },
    { wartosc: '2:1: PQ 0,24 s nie rozstrzyga', wyklad: 'S4_03', plansza: S403c, cytat: 'Samo PQ równe 0,24 s albo sam QRS równy 0,14 s nie wystarczą' },
    { wartosc: 'Wysiłek: węzeł przewodzi sprawniej', wyklad: 'S4_03', plansza: S403c, cytat: 'Podczas wysiłku słabnie wpływ nerwu błędnego i węzeł AV zwykle przewodzi sprawniej, więc poprawa przewodzenia przemawia za poziomem węzłowym.' },
    { wartosc: 'Wysiłek: Hisa-Purkinje nie nadąża', wyklad: 'S4_03', plansza: S403c, cytat: 'Chory układ Hisa-Purkinjego może natomiast nie nadążać za szybszym napływem impulsów z przedsionków i pogorszenie przewodzenia podczas wysiłku przemawia za poziomem podwęzłowym.' },
    { wartosc: 'Próba wysiłkowa pod nadzorem u stabilnego pacjenta', wyklad: 'S4_03', plansza: S403c, cytat: 'u stabilnego pacjenta wykorzystuje się próbę wysiłkową pod nadzorem' },
    { wartosc: 'Nazwa: blok AV II stopnia z przewodzeniem 2:1', wyklad: 'S4_03', plansza: S403c, cytat: 'Nazwij to, co widzisz: „blok AV II stopnia z przewodzeniem 2:1”' },
    { wartosc: 'Zaawansowany: przedsionki 90/min, 3:1, komory 30/min', wyklad: 'S4_03', plansza: S403c, cytat: 'Przy częstości przedsionków 90/min przewodzenie 3:1 daje częstość komór 30/min' },
    { wartosc: 'Zaawansowany: dwa kolejne P bez QRS', wyklad: 'S4_03', plansza: S403c, cytat: 'W przewodzeniu 3:1 jeden P wywołuje QRS, a dwa następne pozostają bez odpowiedzi komór' },
    { wartosc: 'Zaawansowany: powtarzalne PQ', wyklad: 'S4_03', plansza: S403c, cytat: 'zaznacz, które P rzeczywiście poprzedzają QRS z powtarzalnym odstępem PQ' },
    { wartosc: '2:1 nie jest blokiem wysokiego stopnia', wyklad: 'S4_03', plansza: S403c, cytat: 'sam blok 2:1 nie jest „blokiem wysokiego stopnia”' },
    /* III° */
    { wartosc: 'III°: P-P 0,80 s = 75/min', wyklad: 'S4_04', plansza: S404a, cytat: 'odstęp P-P równy 20 małym kratkom trwa 0,80 s i oznacza 75/min' },
    { wartosc: 'III°: R-R 2 s = 30/min', wyklad: 'S4_04', plansza: S404a, cytat: 'R-R równy 50 małym kratkom trwa 2 s, więc komory pracują z częstością 30/min' },
    { wartosc: 'III°: brak stałej zależności P-QRS', wyklad: 'S4_04', plansza: S404a, cytat: 'między P a QRS nie ma żadnej stałej zależności' },
    { wartosc: 'III°: pozorne PQ 0,16 s', wyklad: 'S4_04', plansza: S404a, cytat: 'Szczególnie uważnie obejrzyj fragment, w którym odległość między P a QRS wygląda prawidłowo, na przykład wynosi 0,16 s.' },
    { wartosc: 'III°: cyrkiel, maszerujące P', wyklad: 'S4_04', plansza: S404a, cytat: 'postaw na kartce dwie kreski w odstępie odpowiadającym P-P i przesuwaj je wzdłuż zapisu, odmierzając krok maszerujących P' },
    { wartosc: 'III°: dyrygent i muzyk zastępczy', wyklad: 'S4_04', plansza: S404a, cytat: 'przedsionki dalej słuchają dyrygenta, a komory, odcięte od jego batuty, grają w tempie muzyka zastępczego' },
    { wartosc: 'Rytm z łącza: 40-60/min, wąskie QRS', wyklad: 'S4_04', plansza: S404b, cytat: 'częstość jest względnie „szybsza” (około 40-60/min)' },
    { wartosc: 'Scena I°: brama uchylona, otwiera się leniwiej', wyklad: 'S4_01', plansza: S401, cytat: 'brama AV nie jest zamknięta ani nie „gubi” pobudzeń; po prostu otwiera się leniwiej' },
    { wartosc: 'Wysiłek, blok podwęzłowy: PQ powtarzalne, przewodzenie gorsze', wyklad: 'S4_03', plansza: S403c, cytat: 'pogorszenie przewodzenia podczas wysiłku przemawia za poziomem podwęzłowym' },
    { wartosc: 'Rytm komorowy: QRS np. 0,16 s, 20-40/min', wyklad: 'S4_04', plansza: S404b, cytat: 'zespoły QRS są szerokie (np. 0,16 s, czyli przy przesuwie 25 mm/s cztery małe kratki), a częstość bardzo wolna (około 20-40/min)' },
    { wartosc: 'Szerokie QRS + wolny rytm = groźniej', wyklad: 'S4_04', plansza: S404b, cytat: 'szerokie QRS, wolny rytm to sytuacja znacznie groźniejsza, bo rozrusznik komorowy bywa zawodny' },
    { wartosc: 'Szerokość QRS nie wskazuje pewnie miejsca bloku', wyklad: 'S4_04', plansza: S404b, cytat: 'Szerokość QRS podpowiada, skąd pochodzi rytm zastępczy, ale nie wskazuje pewnie miejsca bloku.' },
    { wartosc: 'Rytm z łącza częściej przy bloku w węźle, komorowy przy podwęzłowym (poziom poprzeczki na diagramie)', wyklad: 'S4_04', plansza: S404b, cytat: 'Taki obraz częściej towarzyszy blokom w węźle AV' },
    { wartosc: 'III° z łącza: P-P 0,80 s (75/min), RR 1,50 s (40/min)', wyklad: 'S6_01', plansza: 'Przypadki 6-10: wyższa stawka', cytat: 'PP równe 0,80 s to 75/min w przedsionkach, RR równe 1,50 s to 40/min w komorach' },
    { wartosc: 'III°: zamknięte w bramie albo niżej', wyklad: 'S6_01', plansza: 'Przypadki 6-10: wyższa stawka', cytat: 'Przejście do komór jest tu zamknięte na głucho, w samej bramie AV albo niżej, na autostradach.' },
  ],
  noweMorfologie: [
    'Diagram drabinkowy (przedsionki / brama AV z pasem pęczka Hisa / komory) zsynchronizowany z paskiem II: pierwszy taki rysunek w kursie.',
    'Mobitz II z szerokim QRS z modelu RBBB (QRS 140 ms) w odprowadzeniu II.',
    'Blok III° z komorowym rytmem zastępczym (morfologia „vent”, QRS 160 ms) i wariant z łącza (wąski QRS).',
    'Blok 2:1 z P zlewającym się z końcówką T (QT w modelu 0,50 s, szersze T; bez podpisu), jako „bradykardia zatokowa” w ćwiczeniu.',
    'Blok zaawansowany 3:1 przy 90/min.',
  ],
  doOkaJK: [
    'Mobitz II: tekst nie podaje proporcji. Wypadnięcia ustawione nieregularnie (3:2, 5:4, 4:3), zawsze co najmniej dwa przewiedzione P przed i po pauzie.',
    'Mobitz II: szeroki QRS narysowany jako RBBB; tekst mówi tylko „współistniejący blok odnogi”, bez strony. Na etykiecie tylko „szeroki, ≥ 120 ms”.',
    '2:1 „przyspiesz przedsionki”: tempo przedsionków przy wysiłku (wewnętrznie 100/min) i PQ (0,20 s) bez podpisu liczbą. Węzłowy pokazany jako 1:1, podwęzłowy jako 3:1; tekst mówi tylko „poprawa” i „pogorszenie przewodzenia”.',
    '2:1 spoczynek: oba poziomy mają ten sam zapis (wąski QRS, PQ 0,24 s); różni się tylko miejsce poprzeczki na diagramie i stan bramy.',
    'Blok zaawansowany: PQ (wewnętrznie 0,16 s) bez podpisu, wąski QRS, poprzeczka w pasie pęczka Hisa. Tekst nie podaje poziomu ani PQ.',
    'III°: poziom poprzeczki dobrany do rytmu zastępczego (komorowy → niżej, z łącza → w bramie) zgodnie z „częściej towarzyszy”; obok zastrzeżenie z tekstu. Pierwszy QRS ustawiony 0,16 s po P, żeby pokazać przypadkowe „PQ”.',
    'Diagram: pas przedsionków skrócony (0,05 s), pas pęczka Hisa ma stały czas 0,05 s, a zmienna część PQ jest rysowana w bramie. Uproszczenie: PQ obejmuje też przedsionki i drogi poniżej węzła.',
    'Scena odźwiernego (rastry marki, przenikanie): prawidłowo spokojny; I° brama uchylona („po prostu otwiera się leniwiej”); Mobitz I spokojny (pierwsza sekwencja) albo rozbudzony po pauzie → zmęczony → senny przy zablokowanym P; 2:1 przy wysiłku rozbudzony; zamknięta brama tylko przy bloku w węźle (2:1 „w węźle AV”) i w III° z rytmem z łącza.',
    'Bloki podwęzłowe (Mobitz II, 2:1 i 3:1 poniżej węzła, III° z rytmem komorowym): scena pokazuje otwartą bramę i spokojnego odźwiernego, który wpuścił impuls; miejsce zatrzymania pokazują diagram drabinkowy i opis pod sceną. Raster bramy uchylonej (I°) nie ma postaci odźwiernego.',
    'Scena odźwiernego w ćwiczeniu jest ukryta do sprawdzenia (zdradzałaby odpowiedź). Przy „Ogranicz ruch” zmienia się tylko po kroku, wyborze cyklu albo zmianie stanu.',
    'Cyrkiel podaje rozstaw w małych kratkach i sekundach (× 0,04 s), z dokładnością do pół kratki.',
    'Pasek w skali „fit” (amplituda dopasowana do wysokości), więc pionowe kratki nie odpowiadają 0,1 mV; opisany tylko przesuw 25 mm/s.',
  ],
  stanKanoniczny: 'Mobitz I (Wenckebach), pierwsza sekwencja 4:3 od początku zapisu, zapis zatrzymany przy „Ogranicz ruch”, cyrkiel wyłączony.',
};
