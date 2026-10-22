import type { Karta } from './core/zrodla.js';

const MAPA = 'Od układu przewodzącego do zapisu EKG';
const BRAMA = 'Przez przedsionki do węzła AV: dlaczego potrzebne jest opóźnienie';
const AUTO = 'Pęczek Hisa, odnogi i włókna Purkinjego: szybka sieć rozprowadzająca';
const HIER = 'Hierarchia rozruszników: wbudowany system bezpieczeństwa';
const AUTOM = 'Serce, które bije samo: zjawisko automatyzmu';
const SA = 'Węzeł zatokowo-przedsionkowy: naturalny rozrusznik';
const PAPIER = 'Cień na papierze: jak czytać to, co rejestruje aparat';

export const KARTA: Karta = {
  id: 'droga-impulsu',
  miejsca: [
    { wyklad: 'S1_00', plansza: MAPA },
    { wyklad: 'S1_00', plansza: BRAMA },
    { wyklad: 'S1_00', plansza: AUTO },
    { wyklad: 'S1_00', plansza: HIER },
    { wyklad: 'S1_00', plansza: AUTOM },
    { wyklad: 'S4_04', plansza: 'Rytm zastępczy decyduje o stabilności' },
    { wyklad: 'S4_05', plansza: 'Gdy jedna z odnóg zawodzi' },
  ],
  zrodla: [
    /* papier */
    { wartosc: 'Przesuw 25 mm/s, mała kratka 0,04 s', wyklad: 'S1_00', plansza: PAPIER, cytat: 'Przy przesuwie 25 mm/s jedna mała kratka, szeroka na 1 mm, odpowiada 0,04 s' },
    { wartosc: 'Duża kratka 0,20 s (siatka paska)', wyklad: 'S1_00', plansza: PAPIER, cytat: 'duża kratka, szeroka na 5 mm, odpowiada 0,20 s' },
    { wartosc: 'Odprowadzenia jako kamery (opis zapisu)', wyklad: 'S1_00', plansza: PAPIER, cytat: 'Wyobraź sobie kamery ustawione wokół serca' },

    /* tryb Mapa zapisu */
    { wartosc: 'Kolejność: węzeł zatokowy (niewidoczny), przedsionki = P, węzeł AV = PQ, Hisa-Purkinje = QRS', wyklad: 'S1_00', plansza: MAPA, cytat: 'Fala pobudzenia rodzi się w węźle zatokowym (niewidoczna na EKG), rozchodzi się po przedsionkach (załamek P), przystaje w węźle AV (odstęp PQ, choć sam węzeł pozostaje niewidoczny)' },
    { wartosc: 'Węzłów i pęczka Hisa nie widać na zapisie', wyklad: 'S1_00', plansza: MAPA, cytat: 'pobudzenia samych węzłów (zatokowego i AV) ani pęczka Hisa nie widać na standardowym zapisie' },
    { wartosc: 'Repolaryzacja przedsionków chowa się w QRS (wygaszanie przedsionków w czasie QRS)', wyklad: 'S1_00', plansza: MAPA, cytat: 'repolaryzacja przedsionków jest wprawdzie obecna, lecz „chowa się” w obrębie znacznie większego zespołu QRS' },
    { wartosc: 'Załamek T = główna widoczna część repolaryzacji komór', wyklad: 'S1_00', plansza: MAPA, cytat: 'Po depolaryzacji następuje powrót komór do stanu spoczynku, czyli repolaryzacja, której główną widoczną część widzimy jako załamek T' },
    { wartosc: 'Odcinek ST: duża część komór pobudzona', wyklad: 'S1_00', plansza: MAPA, cytat: 'Duża część mięśnia komór jest już wtedy pobudzona' },
    { wartosc: 'PQ 0,16 s (cztery małe kratki)', wyklad: 'S1_00', plansza: MAPA, cytat: 'są cztery małe, więc PQ wynosi 0,16 s' },
    { wartosc: 'QRS 0,08 s (dwie kratki)', wyklad: 'S1_00', plansza: MAPA, cytat: 'QRS zajmuje dwie kratki, czyli 0,08 s' },
    { wartosc: 'RR cztery duże kratki, 75/min (300 / 4)', wyklad: 'S1_00', plansza: MAPA, cytat: 'każda zajmuje cztery duże kratki, rytm komór jest miarowy i ma częstość 75/min: 300 podzielone przez cztery' },
    { wartosc: 'P ↔ przedsionki i węzeł zatokowy', wyklad: 'S1_00', plansza: MAPA, cytat: 'Załamek P „pyta” o przedsionki i węzeł zatokowy.' },
    { wartosc: 'PQ ↔ droga od przedsionków przez węzeł AV do komór', wyklad: 'S1_00', plansza: MAPA, cytat: 'Odstęp PQ „pyta” o drogę od przedsionków przez węzeł AV do komór.' },
    { wartosc: 'QRS ↔ komory i układ Hisa-Purkinjego', wyklad: 'S1_00', plansza: MAPA, cytat: 'Zespół QRS „pyta” o komory i układ Hisa-Purkinjego.' },
    { wartosc: 'Węzeł zatokowy = dyrygent; o jego pracy wnioskujesz po P', wyklad: 'S1_00', plansza: SA, cytat: 'Węzeł zatokowy to dyrygent' },
    { wartosc: 'Praca węzła zatokowego widoczna pośrednio, po P', wyklad: 'S1_00', plansza: SA, cytat: 'Wnioskujemy o jego pracy pośrednio: po prawidłowo ukształtowanych załamkach P' },
    { wartosc: 'Inne ośrodki = muzycy', wyklad: 'S1_00', plansza: SA, cytat: 'Pozostałe ośrodki automatyzmu to muzycy' },
    { wartosc: 'Impuls z góry zeruje odliczanie wolniejszych ośrodków', wyklad: 'S1_00', plansza: SA, cytat: 'dociera do nich impuls z węzła zatokowego i „zeruje” ich odliczanie' },

    /* tryb Brama AV */
    { wartosc: 'Brama AV i odźwierny', wyklad: 'S1_00', plansza: BRAMA, cytat: 'Tej bramy pilnuje odźwierny' },
    { wartosc: 'Brama jedyna: bariera włóknista na schemacie', wyklad: 'S1_00', plansza: BRAMA, cytat: 'węzeł AV jest jedynym połączeniem elektrycznym między przedsionkami a komorami' },
    { wartosc: 'Pęczek Hisa przebija włóknistą barierę', wyklad: 'S1_00', plansza: BRAMA, cytat: 'pęczkiem Hisa, który przebija tę włóknistą barierę' },
    { wartosc: 'Postój w węźle AV około 0,1 s', wyklad: 'S1_00', plansza: BRAMA, cytat: 'W spoczynku impuls zatrzymuje się w nim na około jedną dziesiątą sekundy' },
    { wartosc: 'Po co opóźnienie: przedsionki dopełniają komory', wyklad: 'S1_00', plansza: BRAMA, cytat: 'Te ułamki sekundy dają przedsionkom czas, by dokończyły skurcz i dopełniły komory krwią, zanim komory się skurczą' },
    { wartosc: 'Węzeł AV bez własnego wychylenia', wyklad: 'S1_00', plansza: BRAMA, cytat: 'Sam węzeł AV, podobnie jak zatokowy, jest zbyt mały, by dać własny wychył' },
    { wartosc: 'PQ obejmuje całą drogę', wyklad: 'S1_00', plansza: BRAMA, cytat: 'odstęp PQ obejmuje całą drogę, przewodzenie przez przedsionki, węzeł AV i dalszą część układu przewodzącego' },
    { wartosc: 'Norma PQ 0,12-0,20 s', wyklad: 'S1_00', plansza: BRAMA, cytat: 'Prawidłowy odstęp PQ u dorosłego trwa 0,12-0,20 s' },
    { wartosc: 'Norma PQ: od trzech do pięciu małych kratek (0,12 s = 3 kratki)', wyklad: 'S1_00', plansza: BRAMA, cytat: 'co przy przesuwie papieru 25 mm/s daje od trzech do pięciu małych kratek' },
    { wartosc: 'PQ 0,16 s (4 kratki) i 0,24 s (6 kratek, wydłużony)', wyklad: 'S1_00', plansza: BRAMA, cytat: 'Cztery małe kratki to 0,16 s, sześć to już 0,24 s, czyli odstęp wydłużony' },
    { wartosc: 'Wydłużenie PQ: odźwierny dłużej przytrzymuje impuls', wyklad: 'S1_00', plansza: BRAMA, cytat: 'najczęściej dlatego, że odźwierny dłużej przytrzymuje go w bramie' },
    { wartosc: 'Nazwa: blok AV I stopnia', wyklad: 'S1_00', plansza: BRAMA, cytat: 'Jeśli mimo to każde P przewodzi do komór, taki obraz odpowiada blokowi AV I stopnia' },
    { wartosc: 'Granica 0,20 s (5 kratek) w normie; blok I° powyżej 0,20 s', wyklad: 'S1_00', plansza: BRAMA, cytat: 'dokładnie 0,20 s, czyli pięć małych kratek, to jeszcze wynik prawidłowy, a blok I stopnia rozpoznajemy dopiero przy PQ powyżej 0,20 s' },
    { wartosc: 'Odcinek PQ: impuls przechodzi przez bramę', wyklad: 'S1_00', plansza: BRAMA, cytat: 'impuls właśnie przechodzi przez bramę' },

    /* tryb Autostrady */
    { wartosc: 'Dwie odnogi: prawa i lewa', wyklad: 'S1_00', plansza: AUTO, cytat: 'Tam dzieli się na dwie odnogi, prawą i lewą' },
    { wartosc: 'Sieć Purkinjego od strony wsierdzia', wyklad: 'S1_00', plansza: AUTO, cytat: 'Odnogi rozgałęziają się wreszcie w gęstą sieć włókien Purkinjego, które wnikają w mięsień komór od strony wsierdzia' },
    { wartosc: 'Autostrady', wyklad: 'S1_00', plansza: AUTO, cytat: 'Pomyśl o włóknach Purkinjego jak o sieci szybkich autostrad' },
    { wartosc: 'Wąski QRS = prawidłowa, szybka droga', wyklad: 'S1_00', plansza: AUTO, cytat: 'wąski QRS to dowód, że impuls zszedł do komór prawidłową, szybką drogą' },
    { wartosc: 'Zamknięta autostrada, objazd przez mięsień, QRS się poszerza', wyklad: 'S1_00', plansza: AUTO, cytat: 'Jedna z autostrad zostaje zamknięta i impuls musi jechać objazdem przez mięsień: część komory dostaje pobudzenie później, od strony komory już pobudzonej. Cała depolaryzacja trwa dłużej, więc QRS się poszerza' },
    { wartosc: 'Norma QRS: mniej niż 110 ms', wyklad: 'S1_00', plansza: AUTO, cytat: 'W kursie za prawidłowy czas u dorosłego przyjmujemy mniej niż 110 ms' },
    { wartosc: 'Szeroki QRS od 120 ms', wyklad: 'S1_00', plansza: AUTO, cytat: 'a od 120 ms QRS jest szeroki' },
    { wartosc: 'QRS 0,16 s = cztery małe kratki', wyklad: 'S1_00', plansza: AUTO, cytat: 'QRS trwający 0,16 s rozciąga się na cztery małe kratki' },
    { wartosc: 'QRS 0,08 s = dwie małe kratki (80 ms)', wyklad: 'S1_00', plansza: AUTO, cytat: 'dwie małe kratki to 80 ms' },
    { wartosc: 'PQ 0,16 s i QRS 0,16 s: brama na czas, wydłużony etap komorowy', wyklad: 'S1_00', plansza: AUTO, cytat: 'W innym zapisie PQ wynosi 0,16 s, a QRS również 0,16 s. Tym razem brama przepuściła impuls na czas, a wydłużył się etap rozchodzenia się pobudzenia po komorach.' },
    { wartosc: 'PQ 0,24 s i QRS 0,08 s: długo przy bramie, potem autostradą (ćwiczenie)', wyklad: 'S1_00', plansza: AUTO, cytat: 'Pacjent może mieć PQ wynoszący 0,24 s i QRS wynoszący 0,08 s: impuls długo czekał przy bramie, ale potem pojechał autostradą' },
    { wartosc: 'Impuls na miejscu rozchodzi się po mięśniu', wyklad: 'S1_00', plansza: AUTO, cytat: 'impuls błyskawicznie dociera do najdalszych dzielnic, zamiast wlec się lokalnymi uliczkami, i dopiero na miejscu rozchodzi się po okolicznym mięśniu' },
    { wartosc: 'Blok odnogi nie zamyka bramy (PQ bez zmian)', wyklad: 'S4_05', plansza: 'Gdy jedna z odnóg zawodzi', cytat: 'Blok odnogi nie zamyka bramy.' },
    { wartosc: 'Objazd', wyklad: 'S4_05', plansza: 'Gdy jedna z odnóg zawodzi', cytat: 'Impuls jedzie objazdem.' },

    /* tryb Hierarchia */
    { wartosc: 'Rytm zatokowy 60-100/min', wyklad: 'S1_00', plansza: HIER, cytat: 'Węzeł zatokowy pobudza się najszybciej (60-100/min)' },
    { wartosc: 'Rytm zastępczy z łącza około 40-60/min', wyklad: 'S1_00', plansza: HIER, cytat: 'rytm zastępczy z łącza, typowo około 40-60/min' },
    { wartosc: 'Rytm komorowy zastępczy około 20-40/min', wyklad: 'S1_00', plansza: HIER, cytat: 'rytm komorowy zastępczy około 20-40/min' },
    { wartosc: 'Zakresy orientacyjne', wyklad: 'S1_00', plansza: HIER, cytat: 'Podane zakresy są orientacyjne: leki, niedokrwienie i inne warunki mogą zmieniać częstość każdego ośrodka.' },
    { wartosc: 'Zastępcze po przerwie: muzyk wchodzi, bo dyrygent milczy', wyklad: 'S1_00', plansza: HIER, cytat: 'Zastępcze przychodzi z opóźnieniem, po przerwie, gdy następny spodziewany impuls nie nadszedł: muzyk wchodzi, bo dyrygent milczy.' },
    { wartosc: 'Łącze: wąskie QRS, impuls rodzi się przy bramie', wyklad: 'S1_00', plansza: HIER, cytat: 'Rytm z łącza ma zwykle wąskie QRS, bo impuls rodzi się wprawdzie przy bramie, ale do komór jedzie dalej sprawną autostradą Hisa-Purkinjego.' },
    { wartosc: 'Łącze: P może schować się w QRS, przedsionki pobudzane wstecznie', wyklad: 'S1_00', plansza: HIER, cytat: 'Przedsionki mogą bowiem pobudzać się wstecznie, czyli od łącza w ich stronę, i wtedy P wypada przed QRS, chowa się w nim albo pojawia się po nim' },
    { wartosc: 'Komorowy: szeroki QRS, inna droga', wyklad: 'S1_00', plansza: HIER, cytat: 'Jego QRS jest zwykle szeroki, bo pobudzenie obejmuje komory inną drogą niż prawidłowy impuls nadkomorowy.' },
    { wartosc: 'Komory ostatnią linią obrony', wyklad: 'S1_00', plansza: HIER, cytat: 'Gdyby i ten poziom zamilkł, ostatnią linią obrony są komory' },
    { wartosc: 'Im niżej, tym wolniej i mniej pewnie, ale lepiej niż brak rytmu', wyklad: 'S1_00', plansza: HIER, cytat: 'im niżej położony ośrodek, tym wolniejszy i mniej pewny, ale wciąż lepszy niż brak rytmu w ogóle' },
    { wartosc: 'Rytm komorowy na pasku: 30/min (QRS co 2 s), wewnątrz zakresu około 20-40/min', wyklad: 'S1_00', plansza: HIER, cytat: 'rytm komorowy zastępczy około 20-40/min' },
    { wartosc: 'Zastrzeżenie: rytm z łącza może mieć szerokie QRS przy bloku odnogi (ćwiczenie, zadanie o komorach)', wyklad: 'S1_00', plansza: HIER, cytat: 'Rytm z łącza może przecież mieć szerokie QRS, jeśli współistnieje blok odnogi' },
    { wartosc: 'PQ obejmuje drogę aż do początku pobudzenia komór (odnogi przewodzą jeszcze w PQ)', wyklad: 'S1_00', plansza: BRAMA, cytat: 'aż do chwili, gdy zaczyna się pobudzenie komór' },
    { wartosc: 'Łącze: wąskie QRS 0,08 s (dwie małe kratki)', wyklad: 'S4_04', plansza: 'Rytm zastępczy decyduje o stabilności', cytat: 'QRS trwający 0,08 s zajmuje przy przesuwie 25 mm/s dwie małe kratki' },
    { wartosc: 'Komory: szerokie QRS 0,16 s (cztery małe kratki)', wyklad: 'S4_04', plansza: 'Rytm zastępczy decyduje o stabilności', cytat: 'zespoły QRS są szerokie (np. 0,16 s, czyli przy przesuwie 25 mm/s cztery małe kratki)' },

    /* tryb Automatyzm */
    { wartosc: 'Wzór: częstość = 60 / T', wyklad: 'S1_00', plansza: AUTOM, cytat: 'Częstość to po prostu odwrotność czasu jednego cyklu.' },
    { wartosc: 'Zatrzaski: 1 s → 60/min, 0,5 s → 120/min', wyklad: 'S1_00', plansza: AUTOM, cytat: 'Jeśli od pobudzenia do pobudzenia mija sekunda, powstaje 60 impulsów na minutę; jeśli 0,5 s, powstaje ich 120.' },
    { wartosc: 'Powolna spontaniczna depolaryzacja rozkurczowa', wyklad: 'S1_00', plansza: AUTOM, cytat: 'Ten dryf nazywamy powolną spontaniczną depolaryzacją rozkurczową' },
    { wartosc: 'Próg: komórka wyzwala impuls', wyklad: 'S1_00', plansza: AUTOM, cytat: 'Gdy potencjał osiągnie próg, komórka wyzwala kolejny impuls.' },
    { wartosc: 'Częstość zależy od szybkości dochodzenia do progu', wyklad: 'S1_00', plansza: AUTOM, cytat: 'częstość rytmu nie zależy od siły skurczu, lecz od szybkości, z jaką komórka rozrusznikowa dochodzi do progu' },
    { wartosc: 'Dryfu nie widać na EKG, widać skutek', wyklad: 'S1_00', plansza: AUTOM, cytat: 'Na zapisie tego dryfu nie zobaczysz' },
    { wartosc: 'Skutek: cykle częściej albo rzadziej', wyklad: 'S1_00', plansza: AUTOM, cytat: 'Zobaczysz jego skutek: cykle serca, które powtarzają się częściej albo rzadziej.' },
  ],
  noweMorfologie: [
    'Rytm zastępczy z łącza w II: wąskie QRS 0,08 s bez widocznego P (P schowane w QRS), częstość 50/min na pasku (pokazujemy tylko zakres „około 40-60/min”).',
    'Rytm komorowy zastępczy w II: szeroki QRS 0,16 s z kształtu modelu „vent” (dodatni, zazębiony, T przeciwstawne), 30/min, bez P.',
    'QRS „objazdem” w II: kształty „rbbb” (0,14 s) i „lbbb” (0,15 s) z modelu rozciągnięte w czasie do 0,16 s; PQ 0,16 s. Bez nazwy bloku.',
    'Przejście na pasku: dwa pobudzenia zatokowe, przerwa, rytm zastępczy (pierwsze pobudzenie zastępcze po czasie własnego cyklu ośrodka, liczonym od ostatniego QRS).',
    'Krzywa potencjału komórki węzła zatokowego nad zapisem (tylko kształt: narastanie do progu, szybki wzrost, powrót; bez wartości w mV).',
  ],
  doOkaJK: [
    'Czasy przewodzenia na schemacie (kształt, bez podpisu): z węzła zatokowego do bramy 0,035 s, od pęczka Hisa do początku QRS 0,045 s. Postój w bramie = PQ − 0,08 s: 0,08 s przy PQ 0,16 s (tekst: „około jedną dziesiątą sekundy”). Całe wydłużenie PQ do 0,24 s idzie w postój u odźwiernego.',
    'Sceny metafor (rastry marki, przenikanie 0,5 s). Brama: zamknięta brama, gdy impuls czeka, uchylona w chwili wyjścia, otwarta z odźwiernym po przejściu; Autostrady: sieć autostrad / zamknięta jezdnia z objazdem; Hierarchia: orkiestra gra, potem „dyrygent milczy”. Dla „milczy też łącze” ta sama scena „dyrygent milczy” (gra pojedynczy muzyk), z podpisem „ostatnią linią obrony są komory”. Mapa i Automatyzm bez sceny.',
    'Fala na przedsionkach trwa tyle, ile załamek P w modelu (~0,10 s); wykład podaje 0,08 s tylko jako przykład. Wygaszanie przedsionków w czasie QRS, komór w czasie T.',
    'Zamknięta autostrada: komora z drożną odnogą kończy pobudzenie po 0,08 s, druga po 0,16 s, pobudzana przez przegrodę (objazd). Czoło przerwane = wolne szerzenie przez mięsień. Na schemacie pokazujemy też, która odnoga jest zamknięta (prawa / lewa), kształt w II z modelu; nazw RBBB / LBBB nie podajemy, bo S1_00 ich nie używa.',
    'Rytm z łącza: na schemacie przedsionki pobudzają się wstecznie, a na zapisie P pomijamy (chowa się w QRS). Tekst dopuszcza też P przed lub po QRS albo niezależne P zatokowe; tego wariantu nie pokazujemy.',
    'Rysunek: raster „sercePrzod”, układ przewodzący jak prześwietlenie w pikselach rastra: węzeł zatokowy u ujścia żyły głównej górnej, drogi przez przedsionki (przerywane, poglądowe; do lewego przedsionka ponad korzeniem aorty), węzeł AV na prawej bruździe przedsionkowo-komorowej (anatomicznie leży w dolnej części przegrody międzyprzedsionkowej, po stronie prawego przedsionka; na rastrze widzianym od przodu to tylko rzut), pęczek Hisa do szczytu przegrody, odnogi wzdłuż bruzdy międzykomorowej przedniej (prawa przez pasmo do ściany wolnej PK), Purkinje w ścianach komór. Granica PK/LK = bruzda międzykomorowa przednia. Fala: półprzezroczyste obszary przedsionków i komór (krycie 0,26) rosnące od węzła zatokowego i od końców dróg Purkinjego; ✕ na odnodze (prawa w 30%, lewa w 45% drogi) i strzałka objazdu przez przegrodę.',
    'Rytm komorowy: ośrodek narysowany w ścianie prawej komory (pasuje do kształtu „vent”); tekst nie wskazuje miejsca. Przedsionki się nie pobudzają (milczy dyrygent i łącze).',
    'Częstości na paskach: zatokowy 75/min, łącze 50/min (środek zakresu), komory 30/min (w zakresie około 20-40/min). Liczbą pokazujemy tylko zakresy z tekstu.',
    'Automatyzm: węzeł zatokowy wyzwala impuls dokładnie na początku P (czas przejścia z węzła na przedsionki pominięty). QT skraca się z cyklem jako kształt (pierwiastek z RR), bez podpisu. Suwak cyklu 0,5-1,5 s, krok 0,01 s, zatrzaski 1 s i 0,5 s; częstość z 60 / T zaokrąglona do całości.',
    'Tryb Brama zawiera też PQ 0,12 s (dolna granica normy, 3 kratki). O krótkim PQ i preekscytacji wstawka nie mówi.',
    'Skala pionowa paska: 10 mm/mV tylko przy wąskim ekranie; na szerokim amplituda jest mniejsza, dlatego podpisujemy tylko 25 mm/s. Podziałka „1 s” pod zapisem.',
    'Normy QRS w panelu Autostrady w sekundach („poniżej 0,11 s”, „od 0,12 s”), jak reszta panelu; wykład podaje 110 ms i 120 ms (cytat w karcie bez zmian). Do decyzji, czy zostawić sekundy.',
    'Kursor czasu: po puszczeniu ma wybieg (sprężyna do punktu rzutu), za krańcem okna zapis ugina się jak guma i wraca. Na dotyku gest rusza dopiero po 10 px w poziomie, więc przewijanie strony nie zatrzymuje zapisu.',
    'Ćwiczenie („Sprawdź się”): 5 zadań (norma, PQ 0,24 s, zamknięta autostrada, rytm z łącza, rytm komorowy), każde raz, w losowej kolejności; strona zamkniętej odnogi losowa. Schemat odsłania się dopiero po sprawdzeniu.',
  ],
  stanKanoniczny: 'Tryb „Ucz się”, temat „Mapa zapisu”: rytm zatokowy 75/min, PQ 0,16 s, QRS 0,08 s, kursor na środku QRS drugiego pobudzenia (komory w trakcie pobudzenia), nic nie zaznaczone, zapis zatrzymany (bez „Ogranicz ruch” rusza w tempie 1/4).',
};
