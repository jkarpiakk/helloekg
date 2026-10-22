import type { Karta } from './core/zrodla.js';

const P_DP = 'Ściana dolna i przednia';
const P_BT = 'Ściana boczna i tylna';
const P_PK = 'Prawa komora, odprowadzenia dodatkowe i nawyk mapowania';
const P_MAPA = 'Mapa zamiast listy: po co lokalizujemy zawał';
const P_EWO = 'Ewolucja zawału i pułapka „normalnego” EKG';

export const KARTA: Karta = {
  id: 'mapa-zawalu',
  miejsca: [
    { wyklad: 'S3_05', plansza: P_DP },
    { wyklad: 'S3_05', plansza: P_BT },
    { wyklad: 'S3_05', plansza: P_PK },
    { wyklad: 'S3_04', plansza: P_EWO },
    { wyklad: 'S2_04', plansza: 'Lokalizacja i nawyk czytania repolaryzacji' },
  ],
  zrodla: [
    /* zasada mapy i progi */
    { wartosc: 'Zgodne uniesienie ST w grupie wskazuje ścianę; mapa ściana → tętnica orientacyjna', wyklad: 'S3_05', plansza: P_MAPA, cytat: 'zgodne uniesienie ST w grupie odprowadzeń wskazuje ścianę, na którą ta grupa patrzy' },
    { wartosc: 'Ograniczenie: mapa „ściana → tętnica” jest orientacyjna, miejsce przeszkody ustala koronarografia', wyklad: 'S3_05', plansza: P_MAPA, cytat: 'mapa „ściana → tętnica” jest orientacyjna: przebieg naczyń i zakres ich ukrwienia różnią się między ludźmi, a miejsce przeszkody ustala dopiero koronarografia' },
    { wartosc: 'Zmiany lustrzane: ten sam kierunek daje uniesienie w kamerze zwróconej ku niemu, obniżenie po przeciwnej stronie', wyklad: 'S3_05', plansza: P_MAPA, cytat: 'ten sam kierunek zmian elektrycznych daje wychylenie dodatnie w kamerze zwróconej ku niemu, a ujemne w kamerze patrzącej z przeciwnej strony' },
    { wartosc: 'Prąd uszkodzenia: jego kierunek decyduje o uniesieniu albo obniżeniu ST', wyklad: 'S2_04', plansza: 'Uniesienie odcinka ST', cytat: 'Ich kierunek decyduje, czy dana kamera zobaczy uniesienie, czy obniżenie ST.' },
    { wartosc: 'Pomiar w punkcie J, w co najmniej dwóch sąsiadujących odprowadzeniach', wyklad: 'S3_05', plansza: P_MAPA, cytat: 'Nowego uniesienia ST szukasz w co najmniej dwóch takich odprowadzeniach i mierzysz je w punkcie J' },
    { wartosc: 'Próg ST↑ ≥ 1 mm poza V2-V3; V2-V3 ≥ 2 mm u mężczyzn od 40 lat', wyklad: 'S3_05', plansza: P_MAPA, cytat: 'W standardowych odprowadzeniach poza V2-V3 próg wynosi ≥ 1 mm. W V2-V3 wynosi ≥ 2,5 mm u mężczyzn przed 40. rokiem życia, ≥ 2 mm u mężczyzn w wieku co najmniej 40 lat' },
    { wartosc: 'Pacjent: mężczyzna, 58 lat (próg 2 mm w V2-V3, 1 mm w V4)', wyklad: 'S3_05', plansza: P_DP, cytat: 'Weźmy 58-letniego mężczyznę z bólem w klatce piersiowej' },
    { wartosc: 'Pacjent 58 lat: próg 2 mm w V2-V3, 1 mm w V4', wyklad: 'S3_05', plansza: P_DP, cytat: 'W V2 i V3 stosujesz próg 2 mm, a w V4 próg 1 mm' },
    { wartosc: '10 mm/mV: 1 mm = 0,1 mV', wyklad: 'S3_05', plansza: P_MAPA, cytat: 'Przy cesze 10 mm/mV jedna mała kratka w pionie to 1 mm, czyli 0,1 mV.' },
    { wartosc: 'Obniżenie ST oznaczane od 0,5 mm', wyklad: 'S3_03', plansza: 'Obniżenie ST: niedokrwienie podwsierdziowe', cytat: 'nowe poziome albo skośne ku dołowi obniżenie ST ≥ 0,5 mm' },
    { wartosc: 'Grupy kamer: II, III, aVF dolna; I, aVL, V5-V6 boczna; V1-V4 przegroda i przód', wyklad: 'S6_02', plansza: 'Czytasz zapis: czego szukasz najpierw', cytat: 'II, III i aVF patrzą na ścianę dolną, I, aVL oraz V5-V6 na ścianę boczną, a V1-V4 na przegrodę i ścianę przednią.' },

    /* ściana dolna, RCA, prawa komora */
    { wartosc: 'Zawał dolny: II, III, aVF', wyklad: 'S3_05', plansza: P_DP, cytat: 'Zawał ściany dolnej rozpoznajemy po uniesieniu ST w grupie dolnej: II, III i aVF.' },
    { wartosc: 'Zawał dolny: najczęściej RCA, rzadziej LCx', wyklad: 'S3_05', plansza: P_DP, cytat: 'Najczęściej odpowiada za niego prawa tętnica wieńcowa (RCA), rzadziej gałąź okalająca lewej tętnicy wieńcowej (LCx).' },
    { wartosc: 'RCA a węzeł AV: bradykardia i bloki AV', wyklad: 'S3_05', plansza: P_DP, cytat: 'zawał dolny może wiązać się z bradykardią i blokami przedsionkowo-komorowymi' },
    { wartosc: 'Zmiany lustrzane przy zawale dolnym: I, aVL', wyklad: 'S3_05', plansza: P_DP, cytat: 'Typowo towarzyszą mu zmiany recyprokalne w odprowadzeniach bocznych wysokich (I, aVL).' },
    { wartosc: 'III > II z obniżeniem w I i aVL podpowiada RCA', wyklad: 'S3_05', plansza: P_DP, cytat: 'Uniesienie większe w III niż w II, zwłaszcza z obniżeniem w I i aVL, dodatkowo podpowiada RCA.' },
    { wartosc: 'Opis: prawdopodobny obszar RCA, bez pewności', wyklad: 'S3_05', plansza: P_DP, cytat: 'W opisie możesz więc podać lokalizację dolną i prawdopodobny obszar RCA, nie przypisując tętnicy z pewnością.' },
    { wartosc: 'Wskazania: zawał dolny → V3R-V4R; obniżenie ST w V1-V3 → V7-V9', wyklad: 'S3_05', plansza: P_DP, cytat: 'Przy zawale dolnym zarejestruj odprowadzenia prawokomorowe V3R-V4R, a gdy równocześnie widzisz obniżenie ST w V1-V3, podejrzewaj zajęcie ściany tylnej i dołącz V7-V9.' },
    { wartosc: 'RCA proksymalnie, przed gałęziami prawej komory: dolna + prawa komora', wyklad: 'S3_05', plansza: P_PK, cytat: 'proksymalne zamknięcie RCA, przed odejściem gałęzi zaopatrujących prawą komorę, więc jedna przeszkoda odcina dopływ krwi zarówno do części ściany dolnej, jak i do prawej komory' },
    { wartosc: 'Uniesienie ST w V1 jako wskazówka zajęcia prawej komory', wyklad: 'S3_05', plansza: P_PK, cytat: 'uniesienie ST w V1 bywa wskazówką jej zajęcia' },
    { wartosc: 'V3R-V4R: próg ≥ 0,5 mm (mężczyźni przed 30. rokiem życia ≥ 1 mm)', wyklad: 'S3_05', plansza: P_PK, cytat: 'Uniesienie ST ≥ 0,5 mm w V3R-V4R wspiera rozpoznanie zajęcia prawej komory, a u mężczyzn przed 30. rokiem życia próg wynosi ≥ 1 mm.' },

    /* ściana przednia, LAD */
    { wartosc: 'V1-V2 przegroda, V3-V4 ściana przednia, LAD', wyklad: 'S3_05', plansza: P_DP, cytat: 'Zawał ściany przedniej i przegrodowej daje uniesienie ST w odprowadzeniach przedsercowych: V1-V2 (przegroda) i V3-V4 (ściana przednia), a odpowiada za niego zwykle gałąź międzykomorowa przednia (LAD).' },
    { wartosc: 'LAD proksymalnie: rozległy zawał przedni', wyklad: 'S3_05', plansza: P_DP, cytat: 'zwykle powoduje rozległy zawał przedni' },
    { wartosc: 'Uniesienia w V5-V6, I, aVL: przednio-boczny lub rozległy przedni', wyklad: 'S3_05', plansza: P_DP, cytat: 'Rozszerzenie uniesień na V5-V6, I, aVL przemawia za zawałem przednio-bocznym lub rozległym przednim.' },
    { wartosc: 'Im bardziej proksymalne zamknięcie, tym większy obszar', wyklad: 'S3_05', plansza: P_DP, cytat: 'im bardziej proksymalne zamknięcie, tym większy zwykle obszar zagrożenia' },
    { wartosc: 'LAD dalszy odcinek: mniejszy obszar niż proksymalnie', wyklad: 'S3_05', plansza: P_DP, cytat: 'dlatego zwykle zagraża większemu obszarowi mięśnia niż zamknięcie dalszego odcinka' },
    { wartosc: 'Rozległość uniesień nie wyznacza pewnie poziomu zamknięcia', wyklad: 'S3_05', plansza: P_DP, cytat: 'Rozległość uniesień pomaga ocenić zagrożony obszar, ale nie wyznacza pewnie poziomu zamknięcia.' },

    /* ściana boczna, D1, okalająca */
    { wartosc: 'Ściana boczna: I, aVL, V5-V6; LCx lub gałąź diagonalna D1', wyklad: 'S3_05', plansza: P_BT, cytat: 'Zawał ściany bocznej objawia się uniesieniem ST w grupie bocznej: I, aVL (boczna wysoka) oraz V5-V6 (boczna) i wiąże się zwykle z gałęzią okalającą (LCx) lub gałęzią przekątną (diagonalną) LAD.' },
    { wartosc: 'Przebieg LCx i gałęzi diagonalnej D1', wyklad: 'S3_05', plansza: P_BT, cytat: 'LCx biegnie w bruździe przedsionkowo-komorowej i oddaje gałęzie do ściany bocznej, a gałąź przekątna odchodzi od LAD i karmi część przednio-boczną lewej komory.' },
    { wartosc: 'Obniżenie w III przy uniesieniu w I i aVL: zmiany lustrzane', wyklad: 'S3_05', plansza: P_BT, cytat: 'uniesienie w I i aVL z obniżeniem w III może tworzyć układ zmian lustrzanych' },
    { wartosc: 'Nazwa ściany z kamer, w których widać zmiany', wyklad: 'S3_05', plansza: P_BT, cytat: 'Nazwa powinna wynikać z tych kamer, w których rzeczywiście widzisz zmiany.' },
    { wartosc: 'Okalająca: część mięśnia z tyłu, obniżenia w V1-V3, dołącz V7-V9', wyklad: 'S3_05', plansza: P_BT, cytat: 'poszukaj obniżeń ST w V1-V3, które kierują uwagę na ścianę tylną, a wtedy dołącz odprowadzenia V7-V9' },
    { wartosc: 'Okalająca: część mięśnia leży z tyłu', wyklad: 'S3_05', plansza: P_BT, cytat: 'część zaopatrywanego przez nią mięśnia leży z tyłu, w słabo widocznym kącie kamer' },

    /* ściana tylna */
    { wartosc: 'Ściana tylna: 12 odprowadzeń nie patrzy na nią bezpośrednio', wyklad: 'S3_05', plansza: P_BT, cytat: 'bo standardowe 12 odprowadzeń nie patrzy na nią bezpośrednio' },
    { wartosc: 'Obniżenie ST ≥ 1 mm w V1, V2 lub V3; R dominuje nad S', wyklad: 'S3_05', plansza: P_BT, cytat: 'podejrzenie budzi obniżenie ST ≥ 1 mm w V1, V2 lub V3, szczególnie gdy R dominuje nad S w V1 lub V2' },
    { wartosc: 'Końcowa część T w V1-V3 dodatnia', wyklad: 'S3_05', plansza: P_BT, cytat: 'obniżenie jest często poziome, a końcowa część załamka T dodatnia' },
    { wartosc: 'Kamery przednie widzą zawał tylny odwrócony', wyklad: 'S3_05', plansza: P_BT, cytat: 'kamery przednie widzą odwrócony do góry nogami' },
    { wartosc: 'Zawał tylny: okalająca lub RCA', wyklad: 'S3_05', plansza: P_BT, cytat: 'Za zawał tylny odpowiada zwykle gałąź okalająca lub prawa tętnica wieńcowa, zależnie od budowy naczyń' },
    { wartosc: 'Reguła: obniżenie ST w V1-V3 = szukaj zawału tylnego', wyklad: 'S3_05', plansza: P_BT, cytat: 'obniżenie ST w V1-V3, zwłaszcza z dominującym R = szukaj zawału tylnego' },
    { wartosc: 'Wysoki R jako lustrzany odpowiednik Q, na początku może go nie być', wyklad: 'S3_05', plansza: P_BT, cytat: 'wysoki i szeroki R uzupełnia ten obraz jako lustrzany odpowiednik załamka Q widzianego od tyłu, ale na początku może go jeszcze nie być' },
    { wartosc: 'V7-V9: próg ≥ 0,5 mm (mężczyźni przed 40. rokiem życia ≥ 1 mm)', wyklad: 'S3_05', plansza: P_BT, cytat: 'Próg wynosi ≥ 0,5 mm w co najmniej dwóch sąsiadujących odprowadzeniach tylnych, a u mężczyzn przed 40. rokiem życia ≥ 1 mm.' },

    /* pień / aVR */
    { wartosc: 'Rozlane obniżenia ST z uniesieniem w aVR: pień lub choroba trójnaczyniowa, nieswoiste', wyklad: 'S6_05', plansza: 'STEMI: powtórka, która ratuje życie', cytat: 'Mogą odpowiadać chorobie pnia lewej tętnicy wieńcowej albo zrównoważonej chorobie trójnaczyniowej, ale nie są swoiste dla zawału' },
    { wartosc: 'Obniżenia w wielu grupach z uniesieniem w aVR: rozległe niedokrwienie podwsierdziowe', wyklad: 'S3_03', plansza: 'Obniżenie ST: niedokrwienie podwsierdziowe', cytat: 'Taki obraz kieruje uwagę na rozległe niedokrwienie podwsierdziowe i może odpowiadać chorobie pnia lewej tętnicy wieńcowej albo zrównoważonej chorobie trójnaczyniowej' },
    { wartosc: 'Obraz rozlany nie układa się w terytorium jednej tętnicy', wyklad: 'S6_02', plansza: 'Gdy pierwszy zapis niczego nie pokazuje', cytat: 'Nie układają się w terytorium jednej tętnicy, tylko obejmują wiele odprowadzeń' },

    /* ewolucja */
    { wartosc: 'Kolejność faz: nadostre T → ST↑ → Q → ST wraca → T odwrócone → utrwalone Q', wyklad: 'S3_04', plansza: P_EWO, cytat: 'najpierw pojawiają się nadostre, wysokie załamki T, potem uniesienie odcinka ST, następnie mogą zacząć się formować patologiczne załamki Q (ślad martwicy), odcinek ST stopniowo wraca do linii bazowej, a załamki T odwracają się; w fazie przewlekłej mogą pozostać utrwalone załamki Q' },
    { wartosc: 'Szybkie udrożnienie może zapobiec Q', wyklad: 'S3_04', plansza: P_EWO, cytat: 'Szybkie udrożnienie tętnicy potrafi zmienić ten przebieg i zapobiec powstaniu Q.' },
    { wartosc: 'Bez osi godzin: sekwencja nie określa wieku zawału', wyklad: 'S3_04', plansza: P_EWO, cytat: 'nie pozwala precyzyjnie oszacować „wieku” zawału' },
    { wartosc: 'Ciąg klasyczny nie jest stałą kolejnością każdego zawału', wyklad: 'S3_03', plansza: 'Zmiany załamka T, wzorce szczególne i dynamika', cytat: 'nie jest jednak stałą kolejnością, przez którą przechodzi każdy zawał' },
    { wartosc: 'Nadostre T: symetryczne, szerokie, nieproporcjonalnie duże względem QRS', wyklad: 'S3_04', plansza: P_EWO, cytat: 'Hiperostre T są symetryczne, szerokie i nieproporcjonalnie duże względem poprzedzającego QRS w dwóch sąsiadujących odprowadzeniach.' },
    { wartosc: 'Patologiczny Q: ≥ 40 ms lub ≥ 25% R, w dwóch sąsiadujących odprowadzeniach', wyklad: 'S3_04', plansza: P_EWO, cytat: 'Patologiczny Q trwa ≥ 40 ms lub ma głębokość ≥ 25% wysokości R w tym samym odprowadzeniu, albo spełnia oba warunki, a zmiana musi występować w dwóch sąsiadujących odprowadzeniach.' },
    { wartosc: '25 mm/s: jedna mała kratka to 40 ms', wyklad: 'S3_04', plansza: P_EWO, cytat: 'przy przesuwie 25 mm/s jedna mała kratka to 40 ms' },
    { wartosc: 'Mechanizm Q: martwy mięsień zmienia początkowy kierunek pobudzenia', wyklad: 'S6_02', plansza: 'Czytasz zapis: czego szukasz najpierw', cytat: 'Q powstaje, bo martwy mięsień przestaje być czynny elektrycznie i zmienia początkowy kierunek pobudzenia.' },
    { wartosc: 'Q nie jest zegarem, może się zmniejszyć albo zniknąć', wyklad: 'S3_04', plansza: P_EWO, cytat: 'Q nie jest też dokładnym zegarem: może pojawić się wcześnie, a po latach zmniejszyć się albo zniknąć.' },
    { wartosc: 'T ujemne ≥ 1 mm', wyklad: 'S3_03', plansza: 'Zmiany załamka T, wzorce szczególne i dynamika', cytat: 'Nowe lub dynamiczne odwrócenie T o głębokości ≥ 1 mm w co najmniej dwóch sąsiadujących odprowadzeniach sugeruje niedokrwienie' },
    { wartosc: 'Ujemny T w aVR prawidłowy (pomijany na liście T ujemnych)', wyklad: 'S3_03', plansza: 'Zmiany załamka T, wzorce szczególne i dynamika', cytat: 'Od lat ujemny T w aVR jest natomiast zwykłą cechą prawidłowego zapisu.' },
  ],
  noweMorfologie: [
    'Ewolucja zawału w sześciu stanach dyskretnych (nadostre T, uniesienie ST, Q, ST wraca z początkiem odwracania T, T ujemne, utrwalone Q) dla sześciu miejsc zamknięcia, liczona z jednego wektora: nadostre T, prąd uszkodzenia, utrata sił (Q) i odwrócenie T wzdłuż tego samego kierunku.',
    'Obraz przeciwstronny T w fazie nadostrej i w fazie T ujemnych (np. ujemne T w aVL przy nadostrych T dolnych) wychodzi z modelu sam; wykład go nie opisuje.',
    'Uniesienie ST w V7-V9 (okalająca, ściana tylna) i w V3R-V4R (RCA proksymalnie), rysowane w osobnym panelu.',
    'Ściana tylna: obniżenie ST w V1-V5 z dodatnią końcową częścią T w V1-V3, w fazie Q wysoki R w V1-V3 (R > S w V2).',
    'Rozlane obniżenia ST z uniesieniem w aVR (pień lub choroba trójnaczyniowa), bez ewolucji.',
    'Q i zespoły QS w V1-V3 przy LAD proksymalnie (osobny wektor utraty sił z większą składową przednią), QS w V1-V3 i Q w V4 przy LAD za odejściem D1 (osobny wektor utraty sił ku przodowi), Q w III i aVF w zawale dolnym, Q w I, aVL, V5-V6 w zawale bocznym.',
  ],
  doOkaJK: [
    'Kierunki wektorów uszkodzenia (x lewo, y dół, z przód) i ST [mV], dostrojone tak, żeby listy kamer zgadzały się z wykładem, a najwyższe uniesienie miało 2-4,5 mm: RCA (−0,25; 0,94; −0,04) 0,28, V4R 0,29 mm; RCA z prawą komorą (−0,44; 0,89; 0,12) 0,29; okalająca (0,77; −0,23; −0,59) 0,24; tylna (0; 0,21; −0,98) 0,17; LAD proksymalnie (0,59; −0,52; 0,62) 0,24; LAD za odejściem D1 (0,05; 0,08; 0,98) 0,095, V1 niższe niż V2-V4; gałąź diagonalna D1 (0,78; −0,59; 0,21) 0,17; pień (−0,56; −0,82; −0,05) 0,20. „LAD owijający koniuszek” pominięty: wykład go nie opisuje. Zapis rysowany w prawdziwej skali 10 mm/mV względem kratki.',
    'Ograniczenie modelu jednego wektora: V1 i V4R są prawie współliniowe, a I i V6 leżą na tej samej osi. Skutki: w zawale przednim V4R byłby uniesiony, więc odprowadzenia dodatkowe pokazuję tylko przy wskazaniach z S3_05 (zawał dolny → V3R-V4R, obniżenie ST ≥ 1 mm w V1-V3 → V7-V9); przy RCA obniżeniu w I towarzyszy obniżenie w V3-V6, którego wykład nie wymienia. To artefakt modelu, nie wzorzec Aslangera (ten ma uniesienie tylko w III).',
    'Gałąź diagonalna D1: znaku „flagi RPA” (I, aVL, V2 bez V3-V5) nie da się uzyskać jednym wektorem. D1 daje tu uniesienia w I, aVL, V4-V6 z obniżeniem w III; w ćwiczeniu przy tym obrazie okalająca też jest trafieniem (S3_05: zawał boczny wiąże się zwykle z okalającą lub gałęzią diagonalną D1).',
    '„LAD za odejściem D1” → V1-V4 (V1 najniżej): wykład wiąże V1-V4 z LAD ogólnie i mówi, że rozległość uniesień nie wyznacza pewnie poziomu zamknięcia. Proszę o akceptację nazwy i rozkładu.',
    'Obrazy przeciwstronne spoza list z wykładu, wynikające z modelu: III, aVF i aVR przy LAD proksymalnie i D1; aVR przy okalającej; V4-V5 przy ścianie tylnej; aVR i V3-V6 przy RCA (artefakt modelu). Wykład dla LAD nie podaje odprowadzeń z obniżeniem.',
    'Ściana tylna: dodatnią końcową część T w V1-V3 model daje przez odwrócenie T w kierunku ściany tylnej już w fazie ST; skutkiem jest płaski lub ujemny T w V9. X zamknięcia stoi na dalszej okalającej, a podpis mówi „okalająca lub RCA”.',
    'Pień: rozlane niedokrwienie podwsierdziowe modelowane jako prąd uszkodzenia skierowany ku aVR. Uniesienie w aVR oznaczam progiem 1 mm jak dla odprowadzeń standardowych (wykład nie podaje progu dla aVR). Na schemacie przerywany pierścień na pniu zamiast X.',
    'Faza 4 („ST wraca”) ma resztkowe ST poniżej progów i początek odwracania T (wykład: „ST stopniowo wraca do linii bazowej, a załamki T odwracają się”); faza 6 ma T dodatnie, wykład mówi tylko, że Q mogą pozostać. Kolejność faz z S3_04; S3_03 podaje inną (odwrócenie T przed normalizacją ST).',
    'Uniesienia w V3R-V4R w modelu nie ustępują szybciej niż reszta, choć wykład mówi, że potrafią szybko ustąpić.',
    'Pacjent stały: mężczyzna, 58 lat (progi 2 mm w V2-V3, 1 mm gdzie indziej, 0,5 mm w V7-V9 i V3R-V4R). Obniżenie ST oznaczam od 0,5 mm (kryterium obniżenia z S3_03) także jako zmianę lustrzaną.',
    'Patologiczne Q, R > S i T ujemne liczone z zapisu modelu (Q: ≥ 40 ms lub ≥ 25% R, tylko gdy spełniają je co najmniej dwa sąsiednie odprowadzenia w grupie). Odczyt Q wypisuje tylko kamery patrzące na obszar; Q w innych odprowadzeniach (np. aVL z małym R) to artefakt modelu.',
    'Ćwiczenie: 5 miejsc losowanych bez powtórzeń, zawsze faza uniesienia ST. Trafienie także dla odpowiedzi, których zapis nie rozstrzyga według S3_05: D1 ↔ okalająca (ściana boczna), LAD proksymalnie ↔ LAD dalej, ściana tylna ↔ okalająca lub RCA. „Blisko” = ta sama tętnica, inny odcinek.',
    'Faza nadostra: hyperT dla RCA 0,75, dla RCA z prawą komorą 0,70 mV, żeby T w III i aVF było co najmniej tak wysokie jak R.',
  ],
  stanKanoniczny: 'RCA za gałęziami prawej komory, faza „Uniesienie ST”, bez odprowadzeń dodatkowych, tryb „Ucz się”.',
};
