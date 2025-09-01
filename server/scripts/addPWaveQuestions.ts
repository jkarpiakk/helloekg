import { db } from "../db";
import { questions, sections, users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Pytania dla sekcji 2.1: Załamek P i ocena przedsionków
const pWaveQuestions = [
  {
    title: "Co oznacza szeroki i dwugarbny załamek P w odprowadzeniu II?",
    bodyMd: "**Morfologia załamka P**\n\nNa zapisie EKG w odprowadzeniu II widzisz szeroki, dwugarbny załamek P. Co to może oznaczać w kontekście oceny przedsionków?",
    answers: [
      { text: "Przerost lewego przedsionka", isCorrect: true },
      { text: "Przerost prawego przedsionka", isCorrect: false },
      { text: "Blok AV I stopnia", isCorrect: false },
      { text: "Zespół preekscytacji", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Przerost lewego przedsionka**

Dwugarbny załamek P w odprowadzeniu II to jak widok przedsionków, które są "zmęczone" i powiększone. Lewy przedsionek, przeciążony przez długotrwałe nadciśnienie, wysyła impuls wolniej, co wydłuża załamek i nadaje mu charakterystyczny kształt.

**Mechanizm:**
- Normalnie oba przedsionki depolaryzują się razem
- W przerostach lewy przedsionek potrzebuje więcej czasu
- Powstaje dwufazowy (dwugarbny) załamek P
- Pierwszy "garb" = prawy przedsionek
- Drugi "garb" = opóźniony lewy przedsionek`,
    tags: ["załamek-P", "przerost-lewego-przedsionka", "morfologia", "dwugarbny"],
    difficulty: "medium"
  },
  {
    title: "Co oznacza wysoki, wąski załamek P (>2,5 mm) w odprowadzeniu II?",
    bodyMd: "**Amplituda załamka P**\n\nW odprowadzeniu II widzisz nietypowo wysoki i wąski załamek P o amplitudzie przekraczającej 2,5 mm. Co to sugeruje?",
    answers: [
      { text: "Przerost prawego przedsionka", isCorrect: true },
      { text: "Przerost lewego przedsionka", isCorrect: false },
      { text: "Zahamowanie zatokowe", isCorrect: false },
      { text: "Bradykardia zatokowa", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Przerost prawego przedsionka**

Wysoki i spiczasty załamek P przypomina sygnał wysyłany przez przedsionek, który jest przeciążony – najczęściej prawy. Dzieje się tak w chorobach płuc, takich jak przewlekła obturacyjna choroba płuc (POChP), które zwiększają ciśnienie w prawej części serca.

**Charakterystyka P-pulmonale:**
- Wysokość >2,5 mm w odprowadzeniu II
- Wąski, spiczasty kształt  
- Często towarzyszy chorobom płuc
- Związany z przeciążeniem prawego przedsionka

**Przyczyny:**
- Przewlekła obturacyjna choroba płuc (POChP)
- Nadciśnienie płucne
- Zwężenie zastawki trójdzielnej`,
    tags: ["załamek-P", "przerost-prawego-przedsionka", "P-pulmonale", "amplituda"],
    difficulty: "medium"
  },
  {
    title: "Co sugeruje brak załamków P na zapisie EKG?",
    bodyMd: "**Brak załamków P**\n\nPrzeglądając zapis EKG nie widzisz żadnych załamków P, tylko nieregularne zespoły QRS. Co to najprawdopodobniej oznacza?",
    answers: [
      { text: "Migotanie przedsionków", isCorrect: true },
      { text: "Rytm zatokowy", isCorrect: false },
      { text: "Przerost prawego przedsionka", isCorrect: false },
      { text: "Blok AV I stopnia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Migotanie przedsionków**

Brak załamków P na zapisie EKG wskazuje na chaos w przedsionkach – migotanie przedsionków. Impulsy elektryczne powstają w wielu miejscach, ale żaden nie jest wystarczająco silny, aby zainicjować depolaryzację przedsionków w sposób skoordynowany.

**Mechanizm migotania przedsionków:**
- Wieloogniskowe pobudzenia w przedsionkach
- Brak synchronizacji depolaryzacji
- Chaotyczne impulsy elektryczne
- Nieregularne przewodzenie do komór

**Obraz EKG:**
- Brak załamków P
- Niemiarowe odstępy R-R
- Może być obecna falista linia podstawowa`,
    tags: ["migotanie-przedsionków", "brak-załamków-P", "arytmia", "chaos-elektryczny"],
    difficulty: "easy"
  },
  {
    title: "Jak długo powinien trwać załamek P w prawidłowym rytmie zatokowym?",
    bodyMd: "**Czas trwania załamka P**\n\nOceniasz prawidłowość załamka P w rytmie zatokowym. Jaki jest normalny zakres czasu trwania tego załamka?",
    answers: [
      { text: "0,08–0,12 sekundy", isCorrect: true },
      { text: "0,12–0,20 sekundy", isCorrect: false },
      { text: "Mniej niż 0,08 sekundy", isCorrect: false },
      { text: "Ponad 0,12 sekundy", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: 0,08–0,12 sekundy**

Prawidłowy załamek P trwa 0,08–0,12 sekundy. To czas, w którym przedsionki depolaryzują się, przygotowując do skurczu. Gdy trwa dłużej, może to sugerować przerost przedsionków lub zaburzenia przewodzenia.

**Interpretacja czasu trwania:**
- **<0,08 s** = skrócony (rzadko spotykane)
- **0,08-0,12 s** = prawidłowy
- **>0,12 s** = wydłużony (podejrzenie przerostu)

**Praktyczne znaczenie:**
Wydłużenie załamka P jest wczesnym wskaźnikiem przerostu przedsionków, jeszcze zanim pojawi się dwugarbny kształt.`,
    tags: ["załamek-P", "czas-trwania", "normy", "depolaryzacja-przedsionków"],
    difficulty: "easy"
  },
  {
    title: "Czym różni się załamek P w rytmie zatokowym od tego w rytmie przedsionkowym?",
    bodyMd: "**Rytmy przedsionkowe**\n\nPorównujesz załamki P w różnych rytmach. Jaka jest główna różnica między załamkiem P w rytmie zatokowym a rytmie przedsionkowym?",
    answers: [
      { text: "W rytmie przedsionkowym załamek P jest często odwrócony", isCorrect: true },
      { text: "W rytmie zatokowym załamek P jest zawsze ujemny", isCorrect: false },
      { text: "W rytmie przedsionkowym załamek P jest szeroki", isCorrect: false },
      { text: "W rytmie zatokowym nie występują załamki P", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: W rytmie przedsionkowym załamek P jest często odwrócony**

W rytmie przedsionkowym impuls nie pochodzi z węzła zatokowego, ale z innego miejsca w przedsionkach. Powoduje to zmianę kierunku przepływu impulsu, co może prowadzić do odwrócenia załamka P w odprowadzeniu II.

**Rytm zatokowy:**
- Impuls z węzła zatokowego (prawa górna część)
- Załamek P dodatni w odprowadzeniu II
- Prawidłowy kierunek depolaryzacji

**Rytm przedsionkowy:**
- Impuls z innego miejsca w przedsionkach
- Często odwrócony załamek P w odprowadzeniu II
- Zmieniony kierunek depolaryzacji
- Może wystąpić przy uszkodzeniu węzła zatokowego`,
    tags: ["rytm-przedsionkowy", "załamek-P", "odwrócenie", "kierunek-depolaryzacji"],
    difficulty: "medium"
  },
  {
    title: "Co oznacza niska amplituda załamka P w odprowadzeniu II?",
    bodyMd: "**Niska amplituda załamka P**\n\nNa zapisie EKG załamki P są bardzo niskie, ledwo widoczne w odprowadzeniu II. Co może być przyczyną tego zjawiska?",
    answers: [
      { text: "Hiperkaliemia", isCorrect: true },
      { text: "Przerost prawego przedsionka", isCorrect: false },
      { text: "Migotanie przedsionków", isCorrect: false },
      { text: "Zawał przedsionków", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Hiperkaliemia**

Niska amplituda załamka P może być skutkiem hiperkaliemii, która zmniejsza różnicę potencjałów w przedsionkach, osłabiając ich depolaryzację. Wyobraź sobie to jak przyciemnienie światła – impuls elektryczny jest obecny, ale mniej wyraźny.

**Mechanizm działania hiperkaliemii:**
- Podwyższone stężenie K+ w osoczu
- Zmniejszenie różnicy potencjałów przez błonę komórkową
- Osłabienie procesu depolaryzacji
- Zmniejszenie amplitudy załamka P

**Inne przyczyny niskiej amplitudy P:**
- Otyłość (tłumienie sygnału)
- Płyn w osierdziu
- Rozedma płuc
- Nieprawidłowe ustawienie elektrod`,
    tags: ["załamek-P", "niska-amplituda", "hiperkaliemia", "zaburzenia-elektrolitowe"],
    difficulty: "medium"
  },
  {
    title: "Jakie załamki P wskazują na ektopowe pobudzenia przedsionkowe?",
    bodyMd: "**Ektopowe pobudzenia przedsionkowe**\n\nW zapisie EKG widzisz załamki P, które różnią się od normalnych. Jak rozpoznać ektopowe pobudzenia przedsionkowe?",
    answers: [
      { text: "P o zmienionym kształcie i czasie", isCorrect: true },
      { text: "P o zwiększonej amplitudzie", isCorrect: false },
      { text: "Brak załamków P", isCorrect: false },
      { text: "Załamki P o dwugarbnym kształcie", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: P o zmienionym kształcie i czasie**

Ektopowe pobudzenia przedsionkowe to impulsy pochodzące z innych miejsc niż węzeł zatokowy. Powoduje to zmiany w kształcie i czasie trwania załamków P, które różnią się od tych generowanych w rytmie zatokowym.

**Charakterystyka ektopowych P:**
- Odmienny kształt od zatokowych
- Inny czas trwania
- Mogą być odwrócone
- Często przedwczesne

**Przyczyny:**
- Ektopia przedsionkowa
- Podrażnienie przedsionków
- Zaburzenia elektrolitowe
- Leki (np. digitalis)

**Znaczenie kliniczne:**
Pojedyncze ektopie są często łagodne, ale częste mogą prowadzić do arytmii przedsionkowych.`,
    tags: ["ektopia-przedsionkowa", "załamek-P", "zmieniony-kształt", "pobudzenia-przedwczesne"],
    difficulty: "medium"
  },
  {
    title: "Co oznacza wydłużony czas trwania załamka P?",
    bodyMd: "**Wydłużony załamek P**\n\nMierzysz czas trwania załamka P i stwierdzasz, że jest on dłuższy niż normalnie. Co to może oznaczać?",
    answers: [
      { text: "Przerost przedsionków", isCorrect: true },
      { text: "Tachykardia przedsionkowa", isCorrect: false },
      { text: "Blok AV III stopnia", isCorrect: false },
      { text: "Częstoskurcz zatokowy", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Przerost przedsionków**

Wydłużony załamek P sugeruje, że przedsionki potrzebują więcej czasu na depolaryzację. Może to być wynikiem ich przerostu spowodowanego zwiększonym obciążeniem, np. nadciśnieniem.

**Mechanizm wydłużenia:**
- Powiększona masa mięśnia przedsionków
- Dłuższa droga przewodzenia impulsu
- Opóźniona depolaryzacja części przedsionków
- Wydłużenie całkowitego czasu P

**Kryteria:**
- Normalny załamek P: 0,08-0,12 s
- Wydłużony załamek P: >0,12 s

**Przyczyny przerostów:**
- Nadciśnienie tętnicze (lewy przedsionek)
- Choroby płuc (prawy przedsionek)
- Wady zastawek serca`,
    tags: ["załamek-P", "wydłużenie", "przerost-przedsionków", "czas-trwania"],
    difficulty: "easy"
  },
  {
    title: "Co sugerują zmienne załamki P w kolejnych cyklach serca?",
    bodyMd: "**Zmienne załamki P**\n\nObserwujesz zapis EKG, gdzie załamki P w kolejnych cyklach mają różny kształt i wielkość. Co to oznacza?",
    answers: [
      { text: "Wieloogniskowy częstoskurcz przedsionkowy", isCorrect: true },
      { text: "Migotanie przedsionków", isCorrect: false },
      { text: "Rytm zatokowy", isCorrect: false },
      { text: "Blok AV I stopnia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Wieloogniskowy częstoskurcz przedsionkowy**

W wieloogniskowym częstoskurczu przedsionkowym impulsy powstają w różnych miejscach przedsionków, co powoduje zmiany w kształcie załamków P w kolejnych cyklach. To jak różni muzycy grający różne melodie w tej samej orkiestrze – brak spójności.

**Charakterystyka:**
- Co najmniej 3 różne kształty załamków P
- Różne odstępy P-P
- Częstość przedsionków >100/min
- Nieregularne RR (często)

**Mechanizm:**
- Wieloogniskowe automatyczne ogniska w przedsionkach
- Każde ognisko generuje impulsy o innej morfologii
- Konkurencja między ogniskami

**Znaczenie kliniczne:**
Często występuje u pacjentów z chorobami płuc, może prowadzić do migotania przedsionków.`,
    tags: ["wieloogniskowy-częstoskurcz", "zmienne-załamki-P", "multifokal-tachykardia", "arytmia-przedsionkowa"],
    difficulty: "medium"
  },
  {
    title: "Co oznacza odwrócony załamek P w odprowadzeniu II?",
    bodyMd: "**Odwrócony załamek P**\n\nW odprowadzeniu II widzisz załamki P, które są odwrócone (skierowane w dół). Co to sugeruje o pochodzeniu impulsu?",
    answers: [
      { text: "Pobudzenie z dolnej części przedsionków", isCorrect: true },
      { text: "Rytm zatokowy", isCorrect: false },
      { text: "Tachykardia przedsionkowa", isCorrect: false },
      { text: "Blok AV II stopnia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Pobudzenie z dolnej części przedsionków**

Odwrócony załamek P wskazuje, że impuls pochodzi z dolnej części przedsionków i rozchodzi się w kierunku przeciwnym do normalnego. To jak cofanie się impulsu w kierunku węzła zatokowego, zamiast jego naturalnego rozchodzenia się.

**Mechanizm:**
- Impuls z dolnej części przedsionków (np. okolica węzła AV)
- Depolaryzacja w kierunku "do góry"
- Przeciwny kierunek do normalnego
- Ujemny załamek P w odprowadzeniu II

**Przyczyny:**
- Rytm węzłowy (junctional rhythm)
- Ektopia z dolnej części przedsionków
- Zastępcze ognisko przedsionkowe
- Uszkodzenie węzła zatokowego

**Rozpoznanie:**
Odwrócone P w II, III, aVF przy dodatnich w aVR.`,
    tags: ["odwrócony-załamek-P", "rytm-węzłowy", "dolna-część-przedsionków", "kierunek-depolaryzacji"],
    difficulty: "medium"
  },
  {
    title: "Na poniższym zapisie EKG widzisz brak załamków P oraz niemiarowe odstępy R-R. Co jest najbardziej prawdopodobnym rozpoznaniem?",
    bodyMd: "**Analiza zapisu EKG**\n\nAnalizujesz zapis EKG, na którym nie ma załamków P, a odstępy R-R są całkowicie niemiarowe. Jaka jest najprawdopodobniejsza diagnoza?",
    answers: [
      { text: "Migotanie przedsionków", isCorrect: true },
      { text: "Rytm zatokowy", isCorrect: false },
      { text: "Tachykardia zatokowa", isCorrect: false },
      { text: "Wieloogniskowy częstoskurcz przedsionkowy", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Migotanie przedsionków**

Na EKG z migotaniem przedsionków załamki P są niewidoczne, ponieważ przedsionki tracą swoją synchronizację – impulsy elektryczne pojawiają się chaotycznie. Niemiarowość odstępów R-R to dodatkowy kluczowy element diagnostyczny. To jak tłum ludzi, którzy wszyscy krzyczą jednocześnie – brak lidera i porządku.

**Klasyczne cechy migotania przedsionków:**
1. **Brak załamków P** - chaotyczna aktywność przedsionków
2. **Niemiarowe odstępy R-R** - nieregularne przewodzenie
3. **Falista linia podstawowa** (nie zawsze widoczna)
4. **Wąskie zespoły QRS** (jeśli nie ma aberracji)

**Mechanizm:**
- Wieloogniskowe re-entry w przedsionkach
- Brak skutecznego skurczu przedsionków
- Nieregularne pobudzenie węzła AV`,
    tags: ["migotanie-przedsionków", "brak-załamków-P", "niemiarowe-RR", "analiza-EKG"],
    difficulty: "easy"
  },
  {
    title: "Jakie cechy załamka P na poniższym zapisie EKG sugerują przerost lewego przedsionka?",
    bodyMd: "**Przerost lewego przedsionka**\n\nOceniasz zapis EKG pod kątem cech przerostu lewego przedsionka. Na które cechy załamka P powinieneś zwrócić uwagę?",
    answers: [
      { text: "Dwugarbny kształt załamka P w odprowadzeniu II", isCorrect: true },
      { text: "Wysoki, wąski załamek P w odprowadzeniu II", isCorrect: false },
      { text: "Brak załamków P w odprowadzeniu II", isCorrect: false },
      { text: "Skrócenie załamka P poniżej 0,08 sekundy", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Dwugarbny kształt załamka P w odprowadzeniu II**

Dwugarbny kształt załamka P w odprowadzeniu II to charakterystyczny znak przerostu lewego przedsionka. Wynika to z wydłużonego czasu depolaryzacji obu przedsionków, gdzie lewy "opóźnia" impuls elektryczny. Wyobraź sobie to jak dwa pociągi jadące tą samą trasą, ale jeden z nich jedzie wolniej.

**Kryteria przerostu lewego przedsionka (P-mitrale):**
- **Dwugarbny załamek P** w odprowadzeniu II
- **Czas trwania P >0,12 s**
- **Dwufazowy P w V1** z głęboką fazą ujemną
- **Międzyszczytowa odległość >0,04 s**

**Mechanizm:**
1. Pierwszy "garb" = depolaryzacja prawego przedsionka
2. Drugi "garb" = opóźniona depolaryzacja lewego przedsionka
3. Powiększony lewy przedsionek potrzebuje więcej czasu`,
    tags: ["przerost-lewego-przedsionka", "dwugarbny-załamek-P", "P-mitrale", "kryteria-EKG"],
    difficulty: "medium"
  },
  {
    title: "Na zapisie EKG widzisz wysoki, wąski załamek P w odprowadzeniu II oraz dodatni załamek w odprowadzeniu aVR. Co sugeruje ten obraz?",
    bodyMd: "**Analiza załamka P w różnych odprowadzeniach**\n\nW odprowadzeniu II załamek P jest wysoki i wąski (>2,5 mm), a w aVR również dodatni. Jaka jest interpretacja tych zmian?",
    answers: [
      { text: "Przerost prawego przedsionka", isCorrect: true },
      { text: "Przerost lewej komory", isCorrect: false },
      { text: "Migotanie przedsionków", isCorrect: false },
      { text: "Blok AV II stopnia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Przerost prawego przedsionka**

Wysoki i spiczasty załamek P wskazuje na przerost prawego przedsionka, który może wynikać z przewlekłego przeciążenia, np. w nadciśnieniu płucnym. To jak balon, który staje się coraz bardziej napięty, gdy ciśnienie rośnie. Dodanie do tego dodatniego załamka P w aVR dodatkowo potwierdza tę diagnozę.

**Kryteria przerostu prawego przedsionka (P-pulmonale):**
- **Wysoki załamek P >2,5 mm** w odprowadzeniu II, III, aVF
- **Wąski, spiczasty kształt** załamka P
- **Dodatni P w aVR** >1,5 mm
- **Czas trwania P <0,12 s**

**Przyczyny:**
- Przewlekła obturacyjna choroba płuc (POChP)
- Nadciśnienie płucne
- Zwężenie zastawki trójdzielnej
- Zespół Eisenmengera`,
    tags: ["przerost-prawego-przedsionka", "P-pulmonale", "wysoki-załamek-P", "aVR"],
    difficulty: "medium"
  },
  {
    title: "Na poniższym zapisie widzisz zmienne kształty załamków P w kolejnych cyklach serca. Co to sugeruje?",
    bodyMd: "**Zmienność morfologii załamka P**\n\nPrzeglądając kolejne cykle sercowe zauważasz, że załamki P mają różne kształty, amplitudy i czasy trwania. Jaka jest interpretacja?",
    answers: [
      { text: "Wieloogniskowy częstoskurcz przedsionkowy", isCorrect: true },
      { text: "Migotanie przedsionków", isCorrect: false },
      { text: "Przerost lewego przedsionka", isCorrect: false },
      { text: "Zahamowanie zatokowe", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Wieloogniskowy częstoskurcz przedsionkowy**

Zmienne kształty załamków P w wieloogniskowym częstoskurczu przedsionkowym wynikają z tego, że impulsy powstają w różnych miejscach przedsionków. To jak różne osoby próbujące przejąć rolę lidera w grupie – każdy ma swój własny pomysł, co powoduje brak spójności.

**Kryteria MAT (Multifocal Atrial Tachycardia):**
- **≥3 różne kształty P** w tym samym odprowadzeniu
- **Zmienne odstępy P-P**
- **Częstość przedsionków >100/min**
- **Nieregularne odstępy R-R**

**Mechanizm:**
- Wiele automatycznych ognisk w przedsionkach
- Każde ognisko ma swoją morfologię P
- Konkurencja między ogniskami
- Często związane z chorobami płuc`,
    tags: ["wieloogniskowy-częstoskurcz", "MAT", "zmienne-załamki-P", "multifocal-atrial-tachycardia"],
    difficulty: "medium"
  },
  {
    title: "Dlaczego załamki P w rytmie zatokowym są dodatnie w odprowadzeniu II?",
    bodyMd: "**Kierunek depolaryzacji w rytmie zatokowym**\n\nW normalnym rytmie zatokowym załamki P są zawsze dodatnie w odprowadzeniu II. Jaki jest mechanizm tego zjawiska?",
    answers: [
      { text: "Impuls rozchodzi się od węzła zatokowego w dół i w lewo", isCorrect: true },
      { text: "Węzeł AV przejmuje kontrolę nad rytmem", isCorrect: false },
      { text: "Oś elektryczna serca jest przesunięta w prawo", isCorrect: false },
      { text: "Rytm zatokowy jest nieregularny", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Impuls rozchodzi się od węzła zatokowego w dół i w lewo**

W rytmie zatokowym impuls płynie z węzła zatokowego w prawym przedsionku w dół i w lewo, co jest zgodne z kierunkiem odprowadzenia II. To jak rzeka płynąca wzdłuż wyznaczonego koryta – widzimy wyraźny, dodatni załamek P w tym odprowadzeniu.

**Mechanizm:**
- **Węzeł zatokowy** - lokalizacja w prawym górnym przedsionku
- **Kierunek depolaryzacji** - w dół i w lewo
- **Odprowadzenie II** - patrzy w tym samym kierunku
- **Rezultat** - dodatni załamek P

**Znaczenie kliniczne:**
Dodatni P w odprowadzeniu II to podstawowe kryterium rytmu zatokowego. Jeśli P jest ujemne w II, należy podejrzewać inny rytm (np. węzłowy, przedsionkowy dolny).`,
    tags: ["rytm-zatokowy", "kierunek-depolaryzacji", "dodatni-załamek-P", "odprowadzenie-II"],
    difficulty: "easy"
  },
  {
    title: "Na poniższym zapisie widzisz odwrócone załamki P w odprowadzeniu II. Co sugeruje ten obraz?",
    bodyMd: "**Odwrócone załamki P**\n\nW odprowadzeniu II załamki P są konsekwentnie odwrócone (ujemne). Przed każdym QRS jest widoczny ujemny załamek P. Co to oznacza?",
    answers: [
      { text: "Pobudzenia pochodzą z dolnej części przedsionków", isCorrect: true },
      { text: "Rytm zatokowy", isCorrect: false },
      { text: "Wieloogniskowy częstoskurcz przedsionkowy", isCorrect: false },
      { text: "Blok AV III stopnia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Pobudzenia pochodzą z dolnej części przedsionków**

Odwrócone załamki P w odprowadzeniu II wskazują, że impuls elektryczny pochodzi z miejsca w dolnej części przedsionków. To tak, jakby lider zespołu próbował dyrygować od tyłu – impuls rozchodzi się w kierunku przeciwnym do normalnego.

**Mechanizm:**
- Ognisko ektopowe w dolnej części przedsionków
- Depolaryzacja w kierunku "do góry"
- Przeciwny kierunek do rytmu zatokowego
- Ujemne P w odprowadzeniach II, III, aVF

**Możliwe przyczyny:**
- **Rytm węzłowy** (junctional rhythm)
- **Rytm przedsionkowy dolny**
- **Zastępcze ognisko przedsionkowe**
- **Uszkodzenie węzła zatokowego**`,
    tags: ["odwrócony-załamek-P", "dolna-część-przedsionków", "rytm-węzłowy", "ektopia"],
    difficulty: "medium"
  },
  {
    title: "Co oznacza obecność załamka P przed każdym zespołem QRS i jego prawidłowy kształt w odprowadzeniu II?",
    bodyMd: "**Ocena relacji P-QRS**\n\nNa zapisie EKG przed każdym zespołem QRS występuje załamek P o prawidłowym kształcie w odprowadzeniu II. Co to oznacza?",
    answers: [
      { text: "Rytm zatokowy", isCorrect: true },
      { text: "Tachykardia przedsionkowa", isCorrect: false },
      { text: "Migotanie przedsionków", isCorrect: false },
      { text: "Blok AV II stopnia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Rytm zatokowy**

Załamek P poprzedzający każdy QRS o prawidłowym kształcie to znak rytmu zatokowego, co oznacza, że serce działa zgodnie z naturalnym rytmem generowanym przez węzeł zatokowy. To jak idealnie zgrana orkiestra, gdzie każdy instrument gra zgodnie z zaplanowaną partyturą.

**Kryteria rytmu zatokowego:**
1. **Załamek P przed każdym QRS**
2. **Dodatni P w odprowadzeniu II**
3. **Stały kształt załamków P**
4. **Prawidłowy odstęp PQ (0,12-0,20 s)**
5. **Częstość 60-100/min**

**Znaczenie kliniczne:**
Rytm zatokowy to złoty standard normalnej czynności serca. Wszystkie inne rytmy są odchyleniem od tej normy.`,
    tags: ["rytm-zatokowy", "relacja-P-QRS", "prawidłowy-kształt", "norma"],
    difficulty: "easy"
  },
  {
    title: "Na poniższym zapisie w odprowadzeniu V1 załamki P mają dwufazowy kształt. Co sugeruje ten obraz?",
    bodyMd: "**Załamek P w odprowadzeniu V1**\n\nW odprowadzeniu V1 załamki P mają charakterystyczny dwufazowy kształt z dodatnią pierwszą fazą i ujemną drugą fazą. Jak interpretować ten obraz?",
    answers: [
      { text: "Przerost lewego przedsionka", isCorrect: true },
      { text: "Przerost prawego przedsionka", isCorrect: false },
      { text: "Migotanie przedsionków", isCorrect: false },
      { text: "Blok AV II stopnia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Przerost lewego przedsionka**

Dwufazowy załamek P w odprowadzeniu V1 jest charakterystyczny dla przerostu lewego przedsionka. Pierwsza faza załamka odzwierciedla depolaryzację prawego przedsionka, a druga faza (negatywna) – opóźnioną depolaryzację lewego przedsionka. To jak dwa kroki w tańcu – pierwszy jest szybki, drugi opóźniony.

**Kryteria Morris Index dla przerostu lewego przedsionka:**
- **Dwufazowy P w V1** (+/-)
- **Głębokość ujemnej fazy ≥1 mm**
- **Szerokość ujemnej fazy ≥0,04 s**
- **Współczynnik Morris >0,04**

**Mechanizm:**
1. **Faza dodatnia** = depolaryzacja prawego przedsionka
2. **Faza ujemna** = opóźniona depolaryzacja powiększonego lewego przedsionka
3. **Odprowadzenie V1** idealnie pokazuje tę sekwencję`,
    tags: ["przerost-lewego-przedsionka", "dwufazowy-załamek-P", "V1", "Morris-Index"],
    difficulty: "medium"
  }
];

async function addPWaveQuestions() {
  try {
    console.log("🔍 Szukam sekcji 'Załamek P i ocena przedsionków'...");
    
    // Find section 2.1: Załamek P i ocena przedsionków  
    const pWaveSection = await db.select()
      .from(sections)
      .where(eq(sections.title, "Załamek P i ocena przedsionków"))
      .limit(1);

    if (pWaveSection.length === 0) {
      console.error("❌ Nie znaleziono sekcji 'Załamek P i ocena przedsionków'");
      return;
    }

    const sectionId = pWaveSection[0].id;
    console.log(`✅ Znaleziono sekcję: ${pWaveSection[0].title} (ID: ${sectionId})`);

    // Get a reviewer user (admin or reviewer role)
    const reviewer = await db.select()
      .from(users)
      .where(eq(users.role, "reviewer"))
      .limit(1);

    if (reviewer.length === 0) {
      console.error("❌ Nie znaleziono użytkownika reviewer");
      return;
    }

    const reviewerId = reviewer[0].id;
    console.log(`✅ Znaleziono recenzenta: ${reviewer[0].firstName} ${reviewer[0].lastName}`);

    // Prepare questions for insertion
    const questionsToInsert = pWaveQuestions.map(q => ({
      sectionId,
      title: q.title,
      bodyMd: q.bodyMd,
      imageUrl: null,
      answers: q.answers,
      explanationMd: q.explanationMd,
      tags: q.tags,
      difficulty: q.difficulty as "easy" | "medium" | "hard",
      status: "published" as const,
      createdBy: reviewerId,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    }));

    console.log(`📝 Dodaję ${questionsToInsert.length} pytań o załamku P do bazy danych...`);

    // Insert questions
    const result = await db.insert(questions).values(questionsToInsert).returning();

    console.log(`✅ Pomyślnie dodano ${result.length} pytań o załamku P!`);
    
    // Display added questions
    result.forEach((question, index) => {
      console.log(`   ${index + 1}. ${question.title}`);
    });

  } catch (error) {
    console.error("❌ Błąd podczas dodawania pytań:", error);
  }
}

// Run the script
addPWaveQuestions()
  .then(() => {
    console.log("\n🎉 Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });