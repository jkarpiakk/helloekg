import type { Karta } from './core/zrodla.js';

const P1 = 'Papier EKG to linijka czasu i napięcia';
const P2 = 'Liczenie częstości w rytmie miarowym: reguła 300 i reguła 1500';
const P3 = 'Rytm niemiarowy: metoda sześciu sekund';
const PQ = 'Co mierzy odstęp PQ';
const QRS = 'Wąski czy szeroki: co mówi czas trwania';
const QT = 'Co mierzy odstęp QT';
const QTC = 'Dlaczego QT trzeba korygować: QTc';
const VOLT = 'Kryteria woltażowe: Sokolow-Lyon i Cornell';

export const KARTA: Karta = {
  id: 'pomiary',
  miejsca: [
    { wyklad: 'S1_02', plansza: P1 }, { wyklad: 'S1_02', plansza: P2 }, { wyklad: 'S1_02', plansza: P3 },
    { wyklad: 'S2_02', plansza: PQ }, { wyklad: 'S2_03', plansza: QRS },
    { wyklad: 'S2_05', plansza: QT }, { wyklad: 'S2_05', plansza: QTC },
    { wyklad: 'S3_01', plansza: VOLT },
  ],
  zrodla: [
    // papier
    { wartosc: 'Przesuw 25 mm/s', wyklad: 'S1_02', plansza: P1, cytat: 'Standardowo papier przesuwa się 25 mm na sekundę' },
    { wartosc: 'Mała kratka 1 mm = 0,04 s, duża 5 mm = 0,20 s', wyklad: 'S1_02', plansza: P1, cytat: 'Mała kratka ma 1 mm i odpowiada 0,04 s; duża kratka (5 małych, czyli 5 mm) odpowiada 0,20 s.' },
    { wartosc: '5 dużych kratek = 1 s', wyklad: 'S1_02', plansza: P1, cytat: 'Pięć dużych kratek to dokładnie 1 sekunda.' },
    { wartosc: 'Cecha 10 mm/mV, mała kratka w pionie 0,1 mV', wyklad: 'S1_02', plansza: P1, cytat: 'przy standardowej cesze 10 mm odpowiada 1 mV, więc jedna mała kratka w pionie to 0,1 mV' },
    { wartosc: 'Schodek kalibracyjny 1 mV = 10 mm', wyklad: 'S1_02', plansza: P1, cytat: 'Cecha ma znane napięcie, zwykle 1 mV, więc przy ustawieniu 10 mm/mV jej schodek ma wysokość 10 mm.' },
    { wartosc: '50 mm/s: mała kratka 0,02 s, duża 0,10 s', wyklad: 'S1_02', plansza: P1, cytat: 'Przy 50 mm/s mała kratka odpowiada 0,02 s, a duża 0,10 s' },
    { wartosc: '50 mm/s: reguły kratek dają częstość dwa razy za małą', wyklad: 'S1_02', plansza: P1, cytat: 'Wzór przeznaczony dla 25 mm/s da wtedy częstość dwa razy za małą' },
    { wartosc: '20 małych kratek = RR 0,80 s', wyklad: 'S1_02', plansza: P1, cytat: 'Jeśli między szczytami R widzisz 20 małych kratek, odstęp RR trwa 20 × 0,04 s, czyli 0,80 s.' },
    // częstość, miarowy
    { wartosc: 'Częstość = 60 s ÷ czas cyklu', wyklad: 'S1_02', plansza: P2, cytat: 'częstość otrzymujesz, dzieląc 60 s przez czas jednego cyklu serca' },
    { wartosc: 'Reguła 300: 300 ÷ duże kratki', wyklad: 'S1_02', plansza: P2, cytat: 'dzielimy 300 przez liczbę dużych kratek między dwoma sąsiednimi załamkami R' },
    { wartosc: 'Ciąg 300, 150, 100, 75, 60, 50', wyklad: 'S1_02', plansza: P2, cytat: 'Wystarczy zapamiętać ciąg 300, 150, 100, 75, 60, 50' },
    { wartosc: '4 duże kratki: RR 0,80 s, 75/min', wyklad: 'S1_02', plansza: P2, cytat: 'Jeśli mijasz cztery duże kratki, odstęp RR trwa 0,80 s, a częstość wynosi 300 ÷ 4, czyli 75/min.' },
    { wartosc: '4,5 dużej kratki: około 67/min', wyklad: 'S1_02', plansza: P2, cytat: 'Cztery i pół dużej kratki daje 300 ÷ 4,5, czyli około 67/min' },
    { wartosc: 'Reguła 1500, 21 małych kratek: około 71/min', wyklad: 'S1_02', plansza: P2, cytat: 'dzielimy 1500 (tyle małych kratek mieści minuta) przez liczbę małych kratek między dwoma R. Na przykład 21 małych kratek daje około 71/min.' },
    { wartosc: 'Trzy metody dają ten sam wynik', wyklad: 'S1_02', plansza: P2, cytat: 'powinny prowadzić do tej samej wartości' },
    { wartosc: 'Reguły zakładają miarowość', wyklad: 'S1_02', plansza: P2, cytat: 'Zwróć uwagę, że obie zakładają miarowość' },
    { wartosc: 'Pułapka: wysoki T liczony jako pobudzenie', wyklad: 'S1_02', plansza: P2, cytat: 'łatwo omyłkowo policzyć jako kolejne pobudzenie' },
    // częstość, niemiarowy
    { wartosc: 'Z jednego odstępu: raz 60, raz 120', wyklad: 'S1_02', plansza: P3, cytat: 'liczenie z jednego odstępu zawiodłoby: raz wyszłoby 60, raz 120' },
    { wartosc: 'Odstęp 0,50 s = 120/min, 1 s = 60/min, obok siebie', wyklad: 'S1_02', plansza: P3, cytat: 'Odstęp 0,50 s odpowiada częstości 120/min, a odstęp 1 s częstości 60/min, i oba mogą wystąpić tuż obok siebie.' },
    { wartosc: 'Rytm niemiarowy, np. migotanie przedsionków', wyklad: 'S1_02', plansza: P3, cytat: 'Gdy odstępy RR są nierówne (np. w migotaniu przedsionków)' },
    { wartosc: 'Okno 6 s = 30 dużych kratek, QRS × 10', wyklad: 'S1_02', plansza: P3, cytat: 'wyznaczamy na zapisie odcinek trwający 6 sekund (to 30 dużych kratek), liczymy w nim zespoły QRS i mnożymy ich liczbę przez 10' },
    { wartosc: '8 QRS w 6 s: około 80/min', wyklad: 'S1_02', plansza: P3, cytat: 'Jeśli w takim odcinku widzisz osiem zespołów, średnia częstość w tym fragmencie wynosi około 80/min.' },
    { wartosc: 'Okno 10 s = 50 dużych kratek, QRS × 6; 12 QRS: 72/min', wyklad: 'S1_02', plansza: P3, cytat: 'Dwanaście zespołów w 10 s daje średnio 72/min; przy 25 mm/s taki fragment zajmuje 50 dużych kratek.' },
    { wartosc: 'Jeden QRS więcej: ±10/min (6 s), ±6/min (10 s)', wyklad: 'S1_02', plansza: P3, cytat: 'w metodzie sześciu sekund jeden dodatkowo policzony QRS zmienia wynik o 10/min, a w metodzie dziesięciu sekund o 6/min' },
    { wartosc: 'Wzór ogólny: QRS × 60 ÷ czas', wyklad: 'S1_02', plansza: P3, cytat: 'liczba QRS × 60 ÷ czas zapisu w sekundach' },
    { wartosc: 'Wybór metody: miarowy 300/1500, niemiarowy 6 s', wyklad: 'S1_02', plansza: P3, cytat: 'miarowy: reguła 300 lub 1500; niemiarowy: metoda sześciu sekund albo, jeszcze lepiej, dłuższy odcinek o znanym czasie' },
    // PQ
    { wartosc: 'PQ od początku P do początku QRS', wyklad: 'S2_02', plansza: PQ, cytat: 'czas od początku załamka P do początku zespołu QRS' },
    { wartosc: 'Norma PQ 0,12-0,20 s z granicami', wyklad: 'S2_02', plansza: PQ, cytat: 'Prawidłowy odstęp PQ u dorosłych trwa 0,12-0,20 s, czyli 120-200 ms; obie wartości graniczne mieszczą się jeszcze w normie.' },
    { wartosc: 'PQ 0,16 s (4 kratki), 0,24 s (6 kratek) wydłużone', wyklad: 'S2_02', plansza: PQ, cytat: 'Cztery małe kratki przy 25 mm/s oznaczają 0,16 s. Sześć oznacza już 0,24 s, czyli wydłużone PQ.' },
    { wartosc: 'Błąd: pomiar od szczytu do szczytu', wyklad: 'S2_02', plansza: PQ, cytat: 'Najczęstszy błąd to pomiar od szczytu do szczytu.' },
    { wartosc: 'Początek P: odejście od linii izoelektrycznej', wyklad: 'S2_02', plansza: PQ, cytat: 'Znajdź miejsce, w którym P odchodzi od linii izoelektrycznej' },
    { wartosc: '50 mm/s: prawidłowy PQ 6-10 małych kratek', wyklad: 'S2_02', plansza: PQ, cytat: 'Przy 50 mm/s mała kratka odpowiada 0,02 s i ten sam prawidłowy odstęp zajmie od sześciu do dziesięciu małych kratek.' },
    { wartosc: 'PQ > 0,20 s przy przewodzeniu 1:1: blok AV I stopnia', wyklad: 'S2_02', plansza: 'Zbyt długie PQ: blok przedsionkowo-komorowy I stopnia', cytat: 'odstęp PQ wydłuża się ponad 0,20 s i mówimy o bloku przedsionkowo-komorowym I stopnia' },
    // QRS
    { wartosc: 'QRS prawidłowy < 110 ms', wyklad: 'S2_03', plansza: QRS, cytat: 'Za prawidłowy uznajemy czas QRS krótszy niż 110 ms.' },
    { wartosc: 'QRS 110-119 ms: opóźnienie przewodzenia śródkomorowego', wyklad: 'S2_03', plansza: QRS, cytat: 'Wartości 110-119 ms oznaczają już opóźnienie przewodzenia śródkomorowego' },
    { wartosc: 'QRS ≥ 120 ms szeroki', wyklad: 'S2_03', plansza: QRS, cytat: 'Od 120 ms, czyli 0,12 s, QRS jest szeroki.' },
    { wartosc: '115 ms to jeszcze zespół wąski', wyklad: 'S2_03', plansza: QRS, cytat: 'QRS trwający 115 ms należy do wąskich, choć przekracza normę' },
    { wartosc: 'Koniec QRS: punkt J', wyklad: 'S2_03', plansza: QRS, cytat: 'to miejsce nazywamy punktem J' },
    { wartosc: '3 kratki = 0,12 s, już szeroki', wyklad: 'S2_03', plansza: QRS, cytat: 'Zespół szeroki dokładnie na trzy kratki należy już do szerokich.' },
    { wartosc: 'RBBB: R′ w V1', wyklad: 'S2_03', plansza: QRS, cytat: 'W RBBB często zobaczysz drugie dodatnie wychylenie R′ w V1-V2' },
    { wartosc: 'Blok odnogi = zamknięta autostrada, objazd', wyklad: 'S2_03', plansza: QRS, cytat: 'Blok odnogi to zamknięta autostrada. Pobudzenie dociera do celu objazdem' },
    // QT
    { wartosc: 'QT od początku QRS do końca T', wyklad: 'S2_05', plansza: QT, cytat: 'Odstęp QT to czas od początku zespołu QRS do końca załamka T' },
    { wartosc: 'Metoda stycznej', wyklad: 'S2_05', plansza: QT, cytat: 'prowadzimy styczną do najbardziej stromego, zstępującego ramienia T, a punkt jej przecięcia z linią izoelektryczną przyjmujemy za koniec załamka' },
    { wartosc: '10 małych kratek = QT 0,40 s', wyklad: 'S2_05', plansza: QT, cytat: 'dziesięć małych kratek daje QT równy 0,40 s, czyli 400 ms' },
    // QTc
    { wartosc: 'Bazett: QTc = QT / √RR', wyklad: 'S2_05', plansza: QTC, cytat: 'formuła Bazetta: QTc = QT / √RR' },
    { wartosc: 'RR = 1 s: QTc = QT', wyklad: 'S2_05', plansza: QTC, cytat: 'przy RR = 1 s (czyli 60/min) QTc równa się QT' },
    { wartosc: 'Szybszy rytm: korekcja wydłuża, wolniejszy skraca', wyklad: 'S2_05', plansza: QTC, cytat: 'gdy RR jest krótszy niż 1 s, czyli przy szybszym rytmie, korekcja wydłuża wartość, przy wolniejszym skraca' },
    { wartosc: 'Przykład RR 0,80 s przy 75/min', wyklad: 'S2_05', plansza: QTC, cytat: 'przy 75/min RR wynosi 60 / 75 = 0,80 s' },
    { wartosc: 'RR 0,64 s, około 94/min', wyklad: 'S2_05', plansza: QTC, cytat: 'RR szesnaście, czyli 0,64 s, co odpowiada częstości około 94/min' },
    { wartosc: 'Bazett: QT 0,40 s, RR 0,64 s → 0,50 s', wyklad: 'S2_05', plansza: QTC, cytat: 'QTc według Bazetta wynosi 0,40 / 0,8 = 0,50 s, czyli 500 ms' },
    { wartosc: 'Bazett przecenia przy tachykardii, niedocenia przy bradykardii', wyklad: 'S2_05', plansza: QTC, cytat: 'przecenia QTc przy tachykardii, niedocenia przy bradykardii' },
    { wartosc: 'Fridericia: QTc = QT / ∛RR', wyklad: 'S2_05', plansza: QTC, cytat: 'Wzór Fridericii, QTc = QT / ∛RR' },
    { wartosc: 'Fridericia: QT 0,40 s, RR 0,64 s → około 0,464 s', wyklad: 'S2_05', plansza: QTC, cytat: 'Dla QT 0,40 s i RR 0,64 s daje około 0,464 s, czyli 464 ms' },
    { wartosc: 'QTc wydłużony ≥ 450 ms M, ≥ 460 ms K', wyklad: 'S2_05', plansza: QTC, cytat: 'za wydłużony przyjmujemy QTc ≥ 450 ms u mężczyzn i ≥ 460 ms u kobiet' },
    { wartosc: 'QTc ≥ 500 ms: wyraźnie większe ryzyko TdP', wyklad: 'S2_05', plansza: QTC, cytat: 'QTc ≥ 500 ms wiąże się z wyraźnie większym ryzykiem torsade de pointes' },
    { wartosc: 'Bez schodka: 499 a 500 ms', wyklad: 'S2_05', plansza: QTC, cytat: 'różnica między 499 a 500 ms nie jest nagłym przejściem od bezpieczeństwa do zagrożenia' },
    // woltaż
    { wartosc: 'Progi w mm dla 10 mm/mV', wyklad: 'S3_01', plansza: VOLT, cytat: 'Standardowo 10 mm odpowiada 1 mV i do tej skali odnoszą się wszystkie progi w milimetrach.' },
    { wartosc: '5 mm/mV: o połowę niżej, ten sam sygnał', wyklad: 'S3_01', plansza: VOLT, cytat: 'Przy cesze 5 mm/mV załamki są na papierze o połowę niższe, choć sygnał elektryczny jest dokładnie taki sam.' },
    { wartosc: '18 mm przy 5 mm/mV = 36 mm', wyklad: 'S3_01', plansza: VOLT, cytat: 'Suma 18 mm przy tej cesze odpowiada więc 36 mm przy cesze standardowej.' },
    { wartosc: 'Pułapka: 18 mm porównane wprost z 35 mm', wyklad: 'S3_01', plansza: VOLT, cytat: 'Jeśli przeoczysz zmianę skali i porównasz 18 mm wprost z progiem 35 mm, błędnie uznasz wynik za ujemny' },
    { wartosc: 'Sokolow-Lyon: S V1 + wyższy R V5/V6 ≥ 35 mm', wyklad: 'S3_01', plansza: VOLT, cytat: 'sumujemy głębokość załamka S w V1 i wysokość wyższego z załamków R w V5 lub V6, a wynik ≥ 35 mm przemawia za przerostem' },
    { wartosc: 'Nie dodajesz R z obu odprowadzeń', wyklad: 'S3_01', plansza: VOLT, cytat: 'Nie dodajesz do siebie załamków R z obu odprowadzeń: wybierasz jeden, wyższy.' },
    { wartosc: 'Przykład: S V1 19 mm, R V5 18 mm, R V6 15 mm', wyklad: 'S3_01', plansza: VOLT, cytat: 'W V1 załamek S schodzi 19 małych kratek poniżej linii izoelektrycznej. R w V5 ma 18 mm, a w V6 15 mm' },
    { wartosc: 'Suma 37 mm = 3,7 mV, spełnione', wyklad: 'S3_01', plansza: VOLT, cytat: 'Suma wynosi 37 mm, czyli przy standardowej cesze 3,7 mV, i kryterium jest spełnione.' },
    { wartosc: 'Cornell: R aVL + S V3, > 28 mm M, > 20 mm K', wyklad: 'S3_01', plansza: VOLT, cytat: 'sumujemy R w aVL i S w V3, a próg zależy od płci: > 28 mm u mężczyzn i > 20 mm u kobiet' },
    { wartosc: 'Przykład Cornella: 9 + 15 = 24 mm', wyklad: 'S3_01', plansza: VOLT, cytat: 'Jeśli R w aVL ma 9 mm, a S w V3 15 mm, suma wynosi 24 mm: u kobiety kryterium jest spełnione, u mężczyzny nie.' },
    { wartosc: 'Cornell: nierówność ostra', wyklad: 'S3_01', plansza: VOLT, cytat: 'dokładnie 28 mm u mężczyzny albo 20 mm u kobiety progu Cornella nie przekracza' },
    { wartosc: 'Pomocniczo R aVL ≥ 11 mm', wyklad: 'S3_01', plansza: VOLT, cytat: 'Pomocniczo używa się też prostego progu R w aVL ≥ 11 mm.' },
    { wartosc: 'Cornell i Sokolow patrzą przez inne kamery', wyklad: 'S3_01', plansza: VOLT, cytat: 'każde z nich patrzy przez inny zestaw kamer' },
  ],
  noweMorfologie: [
    'Pasek rytmu niemiarowego bez załamków P z drobną falą f (tło bgAF z core/rytm), 16 pobudzeń o odstępach 0,50-1,04 s. Służy tylko do liczenia częstości, bez podpisu „migotanie przedsionków” na papierze.',
    'Przerost lewej komory w V1, V5, V6, aVL, V3: kształt z modelu „lvh”, ale wysokość każdego odprowadzenia przeskalowana osobno do wartości z wykładu (S V1 19 mm, R V5 18 mm, R V6 15 mm, R aVL 9 mm, S V3 15 mm). Zmienia to też proporcjonalnie P i T w danym odprowadzeniu.',
  ],
  doOkaJK: [
    'Wzorzec pomiaru liczony z narysowanego sygnału: granica wychylenia tam, gdzie przekracza 0,03 mV (0,3 mm), koniec T metodą stycznej. W II model nie pokazuje q przegrodowego, więc widoczny QRS ma ok. 76 ms przy „deklarowanych” 90 ms (różnica w tolerancji ±20 ms).',
    'Zapis „Szeroki QRS (V1)” to blok prawej odnogi z modelu; zmierzony w V1 QRS ma ok. 160 ms. Model nie ma odrębnego obrazu nieswoistego zaburzenia przewodzenia 110-119 ms, więc tego zakresu nie pokazujemy na zapisie, tylko w ocenie pomiaru.',
    'QTc: QT trzymamy stałe 0,40 s przy zmianie RR (0,60-1,40 s). To konstrukcja dydaktyczna z wykładu; w rzeczywistości QT zmienia się z częstością.',
    'Skala QTc: cienka czerwona linia od 450 ms, znaczniki 450 M, 460 K i 500 bez zmiany koloru przy 500 ms, zgodnie z tekstem o stopniowym narastaniu ryzyka.',
    'Okno 6 s i 10 s liczy szczyty R w przedziale [początek, początek + czas). Okno można przesuwać; od 0,30 s daje 8 QRS (80/min) i 12 QRS (72/min) jak w wykładzie.',
    'Ćwiczenie: 4 zapisy; wartości zmierzone na zapisie w II: PQ ok. 136-270 ms, QRS 70-88 ms, QT 360-440 ms, RR 720-1120 ms. Zadanie zaliczone, gdy wszystkie 4 pomiary mieszczą się w ±20 ms; „blisko” przy 2-3.',
    'Luka w tekście: przykład „18 mm przy 5 mm/mV” nie podaje składowych, więc pokazujemy go tylko słownie; na papierze przy 5 mm/mV widać przykład 19 + 18 mm (na papierze 18,5 mm).',
    'Nazwa wzoru na przełączniku: „Fridericia” (wykład używa formy „Fridericii” w dopełniaczu).',
  ],
  stanKanoniczny: 'Tryb „Częstość”, rytm miarowy RR 0,80 s (4 duże kratki), 25 mm/s, cyrkiel od szczytu R do szczytu następnego R: 75/min trzema metodami.',
};
