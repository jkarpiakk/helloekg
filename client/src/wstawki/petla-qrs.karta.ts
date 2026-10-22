import type { Karta } from './core/zrodla.js';

const PROG = 'Progresja załamka R i depolaryzacja przegrody';
const RB = 'Blok prawej odnogi (RBBB)';
const LB = 'Blok lewej odnogi (LBBB)';
const WYS = 'Jak nie pomylić RVH z innymi przyczynami wysokiego R w V1';

export const KARTA: Karta = {
  id: 'petla-qrs',
  miejsca: [
    { wyklad: 'S2_03', plansza: PROG },
    { wyklad: 'S4_05', plansza: RB },
    { wyklad: 'S4_05', plansza: LB },
    { wyklad: 'S3_02', plansza: WYS },
  ],
  zrodla: [
    /* układ i kamery */
    { wartosc: 'Przekrój poprzeczny: przedsercowe oglądają serce w płaszczyźnie poprzecznej', wyklad: 'S1_01', plansza: 'Odprowadzenia przedsercowe: V1-V6', cytat: 'oglądają serce w płaszczyźnie poprzecznej, jakby w przekroju, od strony klatki ku plecom' },
    { wartosc: 'Podpisy P / L: strony pacjenta (kierunki opisujemy względem pacjenta)', wyklad: 'S1_01', plansza: 'Odprowadzenia dwubiegunowe Einthovena: I, II, III', cytat: 'Kierunki opisujemy zawsze względem pacjenta.' },
    { wartosc: 'Odprowadzenia = kamery; ku kamerze wychylenie dodatnie, od niej ujemne', wyklad: 'S2_03', plansza: 'Anatomia jednego zespołu: Q, R, S', cytat: 'Odprowadzenia działają jak kamery ustawione wokół serca: aktywność skierowana ku dodatniemu biegunowi odprowadzenia daje wychylenie dodatnie, a skierowana od niego, ujemne.' },
    { wartosc: 'rS w V1 i qR w V6 z tej samej depolaryzacji', wyklad: 'S2_03', plansza: 'Anatomia jednego zespołu: Q, R, S', cytat: 'Ta sama depolaryzacja może więc wyglądać jak rS w V1 i jak qR w V6.' },
    { wartosc: 'Nazwy q, r, R, S, R′ (małe i wielkie litery, prim)', wyklad: 'S2_03', plansza: 'Anatomia jednego zespołu: Q, R, S', cytat: 'Wielkimi literami oznaczamy załamki duże, małymi małe' },
    { wartosc: 'Kratka: 0,04 s w poziomie, 1 mm = 0,1 mV w pionie', wyklad: 'S1_01', plansza: 'Gdy elektrody są źle podłączone', cytat: 'mała kratka o szerokości 1 mm odpowiada 0,04 s, a jej wysokość 1 mm napięciu 0,1 mV' },
    /* norma i progresja */
    { wartosc: 'V1: mały r i głębszy S', wyklad: 'S2_03', plansza: PROG, cytat: 'W V1, przy prawym brzegu mostka, zwykle dominuje załamek ujemny (mały r i głębszy S)' },
    { wartosc: 'V5-V6: przeważnie dodatni; R w V6 nie musi być wyższy niż w V5', wyklad: 'S2_03', plansza: PROG, cytat: 'w V5-V6 zespół staje się przeważnie dodatni (choć R w V6 nie musi być wyższy niż w V5)' },
    { wartosc: 'Strefa przejściowa w okolicy V3-V4', wyklad: 'S2_03', plansza: PROG, cytat: 'Gdzieś w okolicy V3-V4 leży zwykle "strefa przejściowa"' },
    { wartosc: 'Przewaga lewej komory: pobudzenie ku V5-V6', wyklad: 'S2_03', plansza: PROG, cytat: 'znaczna część pobudzenia kieruje się ku lewej stronie serca, czyli ku V5-V6' },
    { wartosc: 'V2: R 3 mm, S 10 mm, przeważa ujemne', wyklad: 'S2_03', plansza: PROG, cytat: 'Jeśli w V2 R ma 3 mm, a S 10 mm, nadal przeważa wychylenie ujemne.' },
    { wartosc: 'V4: R 7 mm, S 7 mm, strefa przejściowa', wyklad: 'S2_03', plansza: PROG, cytat: 'Jeśli w V4 oba mają po 7 mm, tam znajduje się strefa przejściowa.' },
    { wartosc: 'V1 nie jest zapisem wyłącznie prawej komory', wyklad: 'S2_03', plansza: PROG, cytat: 'każda widzi aktywność całego serca, więc V1 nie jest zapisem wyłącznie prawej komory' },
    { wartosc: 'Przegroda pierwsza, z lewa na prawo', wyklad: 'S2_03', plansza: PROG, cytat: 'Komory zaczynają się depolaryzować od przegrody międzykomorowej, i to zwykle z lewa na prawo.' },
    { wartosc: 'Pierwszy wektor ku V1 i od odprowadzeń lewych: q w V5-V6, r w V1', wyklad: 'S2_03', plansza: PROG, cytat: 'biegnie ku V1 i od odprowadzeń lewych' },
    { wartosc: 'Potem większa masa komór z przewagą lewej: S w V1, duży R po lewej', wyklad: 'S2_03', plansza: PROG, cytat: 'Potem pobudza się większa masa komór, z przewagą lewej, i kierunek się odwraca: w V1 powstaje S, a w lewych odprowadzeniach duży R.' },
    { wartosc: 'qR w V6: q = przegroda, R = większa masa komór', wyklad: 'S2_03', plansza: PROG, cytat: 'dwie kolejne fazy tego samego pobudzenia, aktywacja przegrody i aktywacja większej masy komór, oglądane przez jedną kamerę' },
    { wartosc: 'LBBB: przegroda inaczej, q po lewej znika', wyklad: 'S2_03', plansza: PROG, cytat: 'W LBBB przegroda pobudza się inaczej, dlatego q w lewych odprowadzeniach zwykle znika' },
    /* RBBB */
    { wartosc: 'RBBB: początek zwyczajny, spóźnia się końcówka', wyklad: 'S4_05', plansza: RB, cytat: 'Początek wygląda zwyczajnie, bo przegroda i lewa komora pobudzają się zachowaną lewą odnogą; spóźnia się dopiero końcówka.' },
    { wartosc: 'RBBB: późny wektor ku przodowi i w prawo, ku V1', wyklad: 'S4_05', plansza: RB, cytat: 'Ponieważ późny wektor kieruje się ku prawej komorze (czyli ku przodowi i w prawo, ku V1)' },
    { wartosc: 'RBBB: QRS ≥ 0,12 s, późne R′ w V1-V2 (rsr′, rsR′, rSR′)', wyklad: 'S4_05', plansza: RB, cytat: 'Kryteria to: QRS ≥ 0,12 s, czyli 120 ms, oraz późne dodatnie wychylenie R′ w V1-V2, najczęściej w zespole rsr′, rsR′ albo rSR′' },
    { wartosc: 'RBBB: szeroki S w I, V5, V6', wyklad: 'S4_05', plansza: RB, cytat: 'szeroki, zamaszysty załamek S w odprowadzeniach lewych (I, V5, V6)' },
    { wartosc: 'RBBB: S w V6 szerszy od R albo > 40 ms (sprawdza test)', wyklad: 'S4_05', plansza: RB, cytat: 'W I i V6 załamek S jest szerszy od R w tym samym odprowadzeniu albo trwa ponad 40 ms' },
    { wartosc: 'RBBB: szczyt R′ w V1 > 50 ms (sprawdza test)', wyklad: 'S4_05', plansza: RB, cytat: 'Czas od początku QRS do szczytu późnego R′ w V1 przekracza 50 ms.' },
    { wartosc: 'Blok odnogi: impuls jedzie objazdem, przez mięsień', wyklad: 'S4_05', plansza: 'Gdy jedna z odnóg zawodzi', cytat: 'Impuls jedzie objazdem.' },
    /* LBBB */
    { wartosc: 'LBBB: przegroda w przeciwnym kierunku, lewa komora później przez mięsień', wyklad: 'S4_05', plansza: LB, cytat: 'przegroda pobudza się w przeciwnym kierunku, a lewa komora dostaje pobudzenie później, przez mięsień od strony prawej komory' },
    { wartosc: 'LBBB: QRS ≥ 0,12 s', wyklad: 'S4_05', plansza: LB, cytat: 'Kryteria to: QRS ≥ 0,12 s (120 ms)' },
    { wartosc: 'LBBB: szeroki, jednofazowy lub zazębiony R w V5-V6', wyklad: 'S4_05', plansza: LB, cytat: 'szeroki, jednofazowy lub zazębiony (notched) załamek R w odprowadzeniach lewych i bocznych (I, aVL, V5-V6)' },
    { wartosc: 'LBBB: brak q w I, V5, V6', wyklad: 'S4_05', plansza: LB, cytat: 'brak prawidłowych "przegrodowych" załamków q w I, V5 i V6' },
    { wartosc: 'LBBB: QS lub rS w V1', wyklad: 'S4_05', plansza: LB, cytat: 'zespół QS lub rS w V1, czyli przeważająco ujemny' },
    { wartosc: 'LBBB: szczyt R w V5-V6 > 60 ms (sprawdza test)', wyklad: 'S4_05', plansza: LB, cytat: 'czas od początku QRS do szczytu R w V5-V6 przekracza 60 ms' },
    /* LVH */
    { wartosc: 'LVH: więcej masy, wyższe napięcie w kierunku tej masy', wyklad: 'S3_01', plansza: 'Dlaczego gruba ściana może dawać wysokie zespoły', cytat: 'przerost = więcej masy = wyższe napięcie w kierunku tej masy' },
    { wartosc: 'LVH: wysoki R w V5-V6, głęboki S w V1-V2', wyklad: 'S3_01', plansza: 'Dlaczego gruba ściana może dawać wysokie zespoły', cytat: 'W odprowadzeniach lewych i bocznych (I, aVL, V5-V6) rośnie załamek R, a w prawych przedsercowych (V1-V2) pogłębia się załamek S.' },
    /* RVH */
    { wartosc: 'RVH: wektor w prawo i ku przodowi', wyklad: 'S3_02', plansza: 'Gdy prawa komora przejmuje głos', cytat: 'przesunąć wypadkowy wektor komór w prawo oraz ku przodowi' },
    { wartosc: 'RVH: R/S > 1 w V1', wyklad: 'S3_02', plansza: 'Gdy prawa komora przejmuje głos', cytat: '(R/S > 1 w V1)' },
    { wartosc: 'RVH: głębszy S w V5-V6', wyklad: 'S3_02', plansza: 'Gdy prawa komora przejmuje głos', cytat: 'w odprowadzeniach lewych (V5-V6, I) pogłębia się załamek S' },
    { wartosc: 'RVH: QRS poniżej 110 ms', wyklad: 'S3_02', plansza: WYS, cytat: 'W RVH bez zaburzeń przewodzenia wysoki R może stać w zespole o prawidłowej szerokości, poniżej 110 ms.' },
    /* wysoki R w V1: różnicowanie */
    { wartosc: 'RBBB: prawa autostrada zamknięta, objazd przez mięsień', wyklad: 'S3_02', plansza: WYS, cytat: 'Prawa autostrada jest zamknięta, więc impuls dociera do prawej komory objazdem przez mięsień i pobudza ją później.' },
    { wartosc: 'R′ po r i S, szeroki QRS: opóźnione przewodzenie', wyklad: 'S3_02', plansza: WYS, cytat: 'Jeśli dodatnie wychylenie w V1 pojawia się dopiero po wcześniejszych r i S, a cały QRS jest szeroki, myśl przede wszystkim o opóźnionym przewodzeniu.' },
    { wartosc: 'Ściana tylna: od przodu dodatni R zamiast Q; bywa szeroki', wyklad: 'S3_02', plansza: WYS, cytat: 'Te odprowadzenia patrzą z przodu, więc zmiana, która od tyłu daje ujemny załamek Q, od przodu widoczna jest jako dodatni R; bywa on szeroki' },
    { wartosc: 'Ściana tylna: 12 odprowadzeń nie patrzy na nią bezpośrednio', wyklad: 'S3_05', plansza: 'Ściana boczna i tylna', cytat: 'standardowe 12 odprowadzeń nie patrzy na nią bezpośrednio' },
    { wartosc: 'Ściana tylna: podejrzenie budzi obniżenie ST w V1, V2 lub V3', wyklad: 'S3_05', plansza: 'Ściana boczna i tylna', cytat: 'podejrzenie budzi obniżenie ST ≥ 1 mm w V1, V2 lub V3' },
    { wartosc: 'Ściana tylna: R dominuje nad S w V1 lub V2', wyklad: 'S3_05', plansza: 'Ściana boczna i tylna', cytat: 'szczególnie gdy R dominuje nad S w V1 lub V2' },
    { wartosc: 'Ściana tylna: wysoki R może pojawić się później niż obniżenie ST', wyklad: 'S3_05', plansza: 'Ściana boczna i tylna', cytat: 'wysoki i szeroki R uzupełnia ten obraz jako lustrzany odpowiednik załamka Q widzianego od tyłu, ale na początku może go jeszcze nie być' },
    { wartosc: 'Różnicowanie: w bloku szeroki QRS i końcowe R′, w przeroście prawogram', wyklad: 'S3_05', plansza: 'Ściana boczna i tylna', cytat: 'w bloku szukasz poszerzonego QRS i końcowego R′ w V1, a w przeroście także odchylenia osi w prawo' },
  ],
  noweMorfologie: [
    'Pętla QRS w płaszczyźnie poziomej (wektorokardiogram) dla sześciu stanów: norma, RBBB, LBBB, LVH, RVH, przebyty zawał ściany tylnej. Kurs dotąd nie pokazywał pętli.',
    'Własne składowe QRS (lokalnie, nie w core): norma dopasowana tak, by V2 miało R 3 mm i S 10 mm, a V4 R 7 mm i S 7 mm (S2_03). V1 rS, V3 z przewagą S, V5 RS (R 9,9 mm, S 3,7 mm), V6 qR.',
    'RBBB: rSR′ w V1 i V2, qRS w V6 z szerokim S (S szerszy od R, ponad 40 ms), szczyt R′ w V1 ok. 104 ms, QRS ok. 150 ms. W V4 R′ zlewa się z R (jeden szeroki R z drugim garbem).',
    'LBBB: QS w V1-V3, w V5-V6 szeroki, zazębiony R bez q, szczyt R w V6 ok. 114 ms, QRS ok. 156 ms (od ok. 4 do 160 ms). Wybrano QS (tekst dopuszcza QS lub rS).',
    'RVH: Rs w V1 (R ok. 13 mm, S ok. 1 mm), qrS w V6 z głębokim S, QRS ok. 97 ms.',
    'Zawał ściany tylnej (obraz przebyty, sam QRS): w V1 RS z R > S i szerszym R, w V2 Rs, V6 qR bez zmian.',
    'LVH: rS w V1 z głębokim S (ok. 23 mm), qR w V6 z wysokim R (ok. 17 mm). Liczb nie pokazujemy.',
  ],
  doOkaJK: [
    'Gotowe morfologie z core/model.ts nie spełniały tekstu: w RVH V6 było całkiem ujemne (QS zamiast głębokiego S po R), w zawale tylnym V1 miało S > R, w normie V2 i V4 nie dawały wartości z S2_03. Poprawione lokalnie w petla-qrs.dane.ts.',
    'Przekrój to raster GPT z GFX-0039 w konwencji „od stóp”: mostek (przód) u góry, kręgosłup u dołu, prawa strona pacjenta po lewej (podpisy P / L). S1_01 (plansza 2) mówi „jakby w przekroju, patrząc od góry”; zostawiamy konwencję grafik studia (decyzja z GFX-0039).',
    'Kamery stoją w miejscach elektrod z GFX-0039, a oś rzutu biegnie pod kątem odprowadzenia z modelu (V1 115°, V2 94°, V3 70°, V4 50°, V5 28°, V6 0°). Środek pętli wybrano w sercu tak, by kierunek do kamery różnił się od osi o najwyżej 8° (sprawdza test).',
    'Zapis pokazuje sam QRS (bez ST i T), czas rozciągnięty w poziomie. W wariancie zawału tylnego brak obniżeń ST, jest tylko notka tekstowa.',
    'Progresja R: milimetry tylko w V2 (3/10) i V4 (7/7) z S2_03; w S1_01 jest inny przykład (V1 2/10, V3 5/5, V5 15/2), którego nie łączyliśmy, bo wskazuje inną strefę przejściową.',
    'Kursor czasu opisuje fazy słowami z wykładów (przegroda, spóźniona prawa / lewa komora); granice faz wynikają z modelu.',
    'Ćwiczenie: 5 zadań z trzech przyczyn wysokiego R w V1 (RBBB, RVH, ściana tylna), na zmianę „zapis V1 i V6” albo „sama pętla”. Opisy pętli w wyjaśnieniach (np. wolna końcówka ku przodowi i w prawo w RBBB) to przełożenie zdań z wykładu na rysunek.',
    'Zieleń na osi kamery = rzut ku kamerze, szarość = od kamery; przerywana czerwień na obrysie komory (z GFX-0039) = spóźniona komora w bloku odnogi; czerwony łuk na tylnej ścianie LK = zawał ściany tylnej; jasny, gruby obrys LK / PK = przerost. Elipsy LK i PK usunięte, komory widać na rastrze.',
  ],
  stanKanoniczny: 'Tryb „Ucz się”, norma, kamera V1, kursor na końcu QRS (cała pętla narysowana), odtwarzanie zatrzymane.',
};
