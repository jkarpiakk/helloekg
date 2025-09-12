#!/usr/bin/env tsx

import { storage } from "../storage";

// Admin user ID from the database
const ADMIN_USER_ID = "24c103e0-1e0a-4ca2-9e88-b6d243cfffbb";

const blogPosts = [
  {
    slug: "migotanie-przedsionkow-ekg-przewodnik",
    title: "Jak rozpoznać migotanie przedsionków na EKG - Przewodnik dla medyków",
    excerpt: "Kompleksowy przewodnik rozpoznawania migotania przedsionków na zapisie EKG. Poznaj charakterystyczne cechy, kryteria diagnostyczne i przypadki kliniczne.",
    contentMd: `# Jak rozpoznać migotanie przedsionków na EKG - Przewodnik dla medyków

Migotanie przedsionków (atrial fibrillation, AF) to najczęstsza arytmia sercowa spotykana w praktyce klinicznej. Umiejętność jej rozpoznania na zapisie EKG jest kluczowa dla każdego medyka.

## Definicja i epidemiologia

Migotanie przedsionków charakteryzuje się **całkowicie nieregularną aktywnością elektryczną przedsionków**, która prowadzi do:
- Braku synchronicznej czynności skurczowej przedsionków
- Nieregularnego rytmu komór
- Zwiększonego ryzyka zakrzepowo-zatorowego

AF dotyka około **2-3% populacji** i jego częstość wzrasta z wiekiem, osiągając nawet 15% u osób po 80. roku życia.

## Charakterystyczne cechy EKG

### 1. Brak załamków P
Najważniejszą cechą AF jest **całkowity brak prawidłowych załamków P**. Zamiast nich obserwujemy:
- **Fale f** (fibrillation waves) - nieregularne, małe oscylacje linii izoelektrycznej
- Częstotliwość fal f: 300-600/min
- Amplituda zmiennie od ledwie widocznych do wyraźnych

### 2. Nieregularny rytm QRS
- **Całkowicie nieregularne odstępy R-R**
- Brak jakiejkolwiek regularności rytmu
- QRS zazwyczaj wąskie (< 120 ms), chyba że współistnieje blok śródkomorowy

### 3. Częstotliwość rytmu komór
- **Nieregularna częstotliwość QRS**: 100-180/min (bez leczenia)
- Może być kontrolowana farmakologicznie (60-100/min)
- W bradykardiach może wskazywać na dysfunkcję węzła AV

## Klasyfikacja kliniczna

### Migotanie przedsionków pierwotnie wykryte
- Pierwszy rozpoznany epizod AF
- Może być objawowe lub bezobjawowe

### Napadowe migotanie przedsionków
- **Samoistnie ustępuje** w ciągu 48 godzin (zwykle < 24h)
- Może nawracać

### Przetrwałe migotanie przedsionków
- Trwa **> 7 dni** lub wymaga interwencji (kardiowersja)
- Podzielone na krótko- (7 dni - 12 miesięcy) i długotrwale przetrwałe (> 12 miesięcy)

### Permanentne migotanie przedsionków
- **Akceptowane** przez pacjenta i lekarza
- Rezygnacja z prób przywrócenia rytmu zatokowego

## Interpretacja systematyczna

### Algorytm rozpoznawania:
1. **Sprawdź regularność rytmu** - czy odstępy R-R są całkowicie nieregularne?
2. **Poszukaj załamków P** - czy są widoczne prawidłowe załamki P?
3. **Ocena szerokości QRS** - wąskie czy szerokie kompleksy?
4. **Określ częstotliwość komór** - bradykardii, normokardii czy tachykardii?

## Przypadek kliniczny

**Pacjent:** 72-letni mężczyzna zgłasza się z kołataniem serca i dusznością wysiłkową od 3 dni.

**EKG:** 
- Nieregularny rytm z częstotliwością 140-160/min
- Brak widocznych załamków P
- Wąskie kompleksy QRS
- Delikatne fale f w odprowadzeniach V1-V2

**Rozpoznanie:** Migotanie przedsionków z szybką odpowiedzią komór

**Postępowanie:**
1. Kontrola częstotliwości (beta-blokery, werapamil/diltiazem)
2. Ocena ryzyka zakrzepowo-zatorowego (CHA₂DS₂-VASc)
3. Rozważenie antykoagulacji
4. Plan dalszego leczenia (kontrola rytmu vs. częstotliwości)

## Diagnostyka różnicowa

### Flutter przedsionków
- **Regularne fale F** z częstotliwością 250-350/min
- Przewodzenie zwykle 2:1, 3:1 lub 4:1
- Klasyczny obraz "zębów piły" w odprowadzeniach dolnych

### Tachykardia przedsionkowa wieloogniskowa
- **Różne morfologie załamków P** (≥3 różne)
- Nieregularny rytm
- Częstotliwość przedsionków < 250/min

## Powikłania i rokowanie

### Następstwa hemodynamiczne:
- **Utrata "kopnięcia przedsionkowego"** - spadek rzutu serca o 15-20%
- Pogorszenie tolerancji wysiłku
- Dekompensacja niewydolności serca

### Ryzyko zakrzepowo-zatorowe:
- **Udar mózgu** - ryzyko wzrasta 5-krotnie
- Zatory obwodowe
- Konieczność oceny według skali CHA₂DS₂-VASc

## Praktyczne wskazówki

1. **Zawsze sprawdź regularność rytmu** przed oceną innych parametrów
2. **Użyj długiego paska rytmu** dla potwierdzenia nieregularności
3. **Zwróć uwagę na odprowadzenia V1-V2** - najlepiej widać fale f
4. **Dokumentuj częstotliwość** i odpowiedź na leczenie
5. **Ocen szerokość QRS** - wyklucz aberrację przewodzenia

## Podsumowanie

Migotanie przedsionków to częsta arytmia wymagająca szybkiej diagnozy i odpowiedniego postępowania. Kluczowe cechy EKG to nieregularny rytm i brak załamków P. Wczesne rozpoznanie pozwala na skuteczną profilaktykę powikłań zakrzepowo-zatorowych.

---

**Chcesz pogłębić swoją wiedzę o interpretacji EKG?** Zapisz się na nasz [Kompleksowy Kurs EKG](/) i naucz się profesjonalnej analizy wszystkich arytmii sercowych. Praktyczne przypadki kliniczne, interaktywne quizy i certyfikat ukończenia czekają na Ciebie!`,
    featuredImage: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=400&fit=crop",
    tags: ["Arytmie", "Podstawy EKG", "Kardiologia"],
    seoMeta: {
      title: "Migotanie przedsionków na EKG - Rozpoznawanie AF | Przewodnik",
      description: "Naucz się rozpoznawać migotanie przedsionków na EKG. Charakterystyczne cechy, kryteria diagnostyczne i przypadki kliniczne dla medyków.",
      keywords: ["migotanie przedsionków", "AF EKG", "arytmia sercowa", "interpretacja EKG", "kardiologia"]
    },
    status: "published" as const,
    publishedAt: new Date()
  },

  {
    slug: "podstawy-czytania-ekg-interpretacja",
    title: "Podstawy czytania EKG - Od zera do interpretacji",
    excerpt: "Poznaj fundamenty interpretacji EKG. Systematyczne podejście do analizy zapisu, anatomia przewodnictwa serca i praktyczne wskazówki dla początkujących.",
    contentMd: `# Podstawy czytania EKG - Od zera do interpretacji

Elektrokardiografia (EKG) to podstawowe narzędzie diagnostyczne w kardiologii. Umiejętność prawidłowej interpretacji EKG jest niezbędna dla każdego medyka. W tym przewodniku poznasz systematyczne podejście do czytania EKG.

## Anatomia układu przewodzącego serca

### Struktura przewodzenia impulsu

Prawidłowy impuls elektryczny serca wędruje według ścisłej hierarchii:

1. **Węzeł zatokowy (SA)** - naturalny rozrusznik serca (60-100/min)
2. **Przewodzenie międzyprzedsionkowe** - rozprzestrzenienie po przedsionkach
3. **Węzeł przedsionkowo-komorowy (AV)** - fizjologiczne opóźnienie (0,12-0,20s)
4. **Pęczek Hisa** - główny trakt przewodzący do komór
5. **Odnogi pęczka** - prawa i lewa odnoga
6. **Włókna Purkiniego** - końcowa dystrybucja impulsu

### Korelacja anatomiczno-elektryczna

Każdy element anatomiczny ma swoje **odbicie w zapisie EKG**:
- Węzeł SA → załamek P
- Węzeł AV → odcinek PR
- Kompleks His-Purkinje → zespół QRS
- Repolaryzacja komór → odcinek ST i załamek T

## System odprowadzeń EKG

### Odprowadzenia kończynowe
- **I, II, III** - odprowadzenia dwubiegunowe
- **aVR, aVL, aVF** - odprowadzenia jednobiegunowe wzmocnione

### Odprowadzenia przedsercowe
- **V1-V2** - ściana przegrody
- **V3-V4** - ściana przednia
- **V5-V6** - ściana boczna

### Geometria elektryczna serca
Każde odprowadzenie **"patrzy" na serce z innej perspektywy**, co pozwala na:
- Lokalizację zmian patologicznych
- Określenie osi elektrycznej serca
- Identyfikację regionów niedokrwienia

## Systematyczna interpretacja EKG

### Algorytm RATE-RHYTHM-AXIS-CHAMBERS

#### 1. RATE (Częstotliwość)
- **Liczenie**: 300 ÷ liczba dużych kratek między QRS
- **Norma**: 60-100/min
- **Bradykardia**: < 60/min
- **Tachykardia**: > 100/min

#### 2. RHYTHM (Rytm)
- **Regularność**: czy odstępy R-R są równe?
- **Pochodzenie**: zatokowy, przedsionkowy, komorowy?
- **Związek P-QRS**: czy każdy P ma swój QRS?

#### 3. AXIS (Oś elektryczna)
- **Norma**: -30° do +90°
- **Odchylenie w lewo**: -30° do -90°
- **Odchylenie w prawo**: +90° do +180°

#### 4. CHAMBERS (Komory)
- **Hipertrofia prawej komory** (RVH)
- **Hipertrofia lewej komory** (LVH)
- **Poszerzenie przedsionków**

## Podstawowe parametry EKG

### Załamek P
- **Czas trwania**: < 0,12s
- **Amplituda**: < 2,5mm (II, III, aVF), < 1,5mm (V1)
- **Morfologia**: dodatni w I, II, ujemny w aVR

### Odstęp PR
- **Czas trwania**: 0,12-0,20s (3-5 małych kratek)
- **Znaczenie**: przewodzenie AV
- **Patologia**: wydłużenie (blok AV I°), skrócenie (WPW)

### Zespół QRS
- **Czas trwania**: < 0,10s (< 2,5 kratki)
- **Amplituda**: zmienna w zależności od odprowadzenia
- **Morfologia**: rs, rS, qRs, itd.

### Odcinek ST
- **Pozycja**: na linii izoelektrycznej
- **Patologie**: uniesienie (zawał STEMI), obniżenie (niedokrwienie)

### Załamek T
- **Kierunek**: zgodny z głównym załamkiem QRS
- **Morfologia**: asymetryczny, zaokrąglony szczyt
- **Patologie**: inwersja, wysokie, spłaszczone

## Najczęstsze błędy interpretacji

### 1. Nieprawidłowe umieszczenie elektrod
- **Objawy**: nietypowe morfologie QRS
- **Rozwiązanie**: sprawdzenie prawidłowego położenia elektrod

### 2. Artefakty techniczne
- **Drżenie mięśni**: nieregularna linia podstawowa
- **Ruch pacjenta**: zniekształcenia wszystkich załamków
- **Zakłócenia sieciowe**: regularne oscylacje 50/60 Hz

### 3. Błędy w pomiarach
- **Nieprawidłowa prędkość**: zwykle 25 mm/s
- **Błędne wzmocnienie**: standardowo 10 mm/mV
- **Filtry**: mogą maskować drobne zmiany

## Przypadek praktyczny

**Analiza systematyczna EKG 45-letniego mężczyzny:**

1. **RATE**: 72/min (regularne R-R, 300÷4 kratki = 75/min)
2. **RHYTHM**: Rytm zatokowy (P-QRS-T, P dodatnie w I, II)
3. **AXIS**: Normalnie (I i aVF dodatnie)
4. **CHAMBERS**: Brak cech hipertrofii

**Szczegółowa analiza:**
- **P**: 0,08s, dodatnie I, II, aVF
- **PR**: 0,16s (w normie)
- **QRS**: 0,08s, prawidłowa progresja R w V1-V6
- **ST**: na linii izoelektrycznej
- **T**: dodatnie we wszystkich odprowadzeniach oprócz aVR

**Wniosek**: EKG prawidłowe

## Praktyczne wskazówki

### Dla początkujących:
1. **Zawsze używaj systematycznego podejścia** - nie przeskakuj kroków
2. **Sprawdzaj jakość zapisu** przed interpretacją
3. **Porównuj z poprzednimi EKG** jeśli dostępne
4. **Koreluj z obrazem klinicznym** pacjenta

### Najważniejsze pytania:
- Czy rytm jest regularny?
- Czy są widoczne załamki P?
- Jaki jest stosunek P:QRS?
- Czy szerokość QRS jest prawidłowa?
- Czy ST jest na linii izoelektrycznej?

## Zaawansowana interpretacja

### Przygotowanie do kolejnych etapów:
Po opanowaniu podstaw możesz przejść do:
- **Diagnostyki arytmii** - AF, VT, SVT
- **Rozpoznawania zawałów** - STEMI, NSTEMI
- **Zaburzeń elektrolitowych** - hiperkaliemia, hipokaliemia
- **Farmakoterapii** - wpływ leków na EKG

## Podsumowanie

Interpretacja EKG to umiejętność wymagająca systematycznego podejścia i ciągłej praktyki. Pamiętaj o algorytmie RATE-RHYTHM-AXIS-CHAMBERS i zawsze koreluj wyniki z obrazem klinicznym pacjenta.

Kluczowe zasady:
1. **Systematyczność** w interpretacji
2. **Jakość zapisu** przed oceną
3. **Korelacja kliniczna** zawsze
4. **Ciągła praktyka** i edukacja

---

**Chcesz opanować interpretację EKG na poziomie eksperta?** Dołącz do naszej [EKG Academy](/) i naucz się rozpoznawać wszystkie rodzaje arytmii, zawałów i zaburzeń przewodzenia. Interaktywne przypadki kliniczne, quizy i certyfikat profesjonalny!`,
    featuredImage: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=400&fit=crop",
    tags: ["Podstawy EKG", "Edukacja medyczna"],
    seoMeta: {
      title: "Podstawy EKG - Jak czytać elektrokardiogram | Przewodnik",
      description: "Kompleksowy przewodnik interpretacji EKG od podstaw. Systematyczne podejście, anatomia przewodzenia i praktyczne wskazówki dla medyków.",
      keywords: ["podstawy EKG", "jak czytać EKG", "interpretacja EKG", "elektrokardiografia", "edukacja medyczna"]
    },
    status: "published" as const,
    publishedAt: new Date()
  },

  {
    slug: "zawal-serca-ekg-stemi-nstemi",
    title: "Zawał serca na EKG - Rozpoznawanie STEMI i NSTEMI",
    excerpt: "Naucz się rozpoznawać zawał serca na EKG. Kryteria diagnostyczne STEMI i NSTEMI, ewolucja zmian, lokalizacja zawału i postępowanie w ostrym zespole wieńcowym.",
    contentMd: `# Zawał serca na EKG - Rozpoznawanie STEMI i NSTEMI

Zawał serca (zawał mięśnia sercowego, MI - myocardial infarction) to stan nagłego zagrożenia życia wymagający natychmiastowej diagnozy i leczenia. EKG jest kluczowym narzędziem w rozpoznawaniu i klasyfikacji zawału.

## Podstawy patofizjologii

### Mechanizm niedokrwienia
**Zawał serca** powstaje w wyniku:
1. **Nagłego zamknięcia** tętnicy wieńcowej (najczęściej pęknięcie blaszki miażdżycowej)
2. **Formowania skrzepu** w miejscu uszkodzenia
3. **Niedokrwienia mięśnia sercowego** w obszarze unaczynienia
4. **Martwicy** kardiomiocytów (po 20-40 minutach)

### Ewolucja zmian EKG
Zmiany w EKG rozwijają się według **charakterystycznej sekwencji czasowej**:
- **Minuty**: wysokie, zaostrzzone załamki T
- **Godziny**: uniesienie ST, patologiczny Q
- **Dni**: inwersja T, normalizacja ST
- **Tygodnie**: trwały Q (blizna)

## Klasyfikacja zawałów według EKG

### STEMI (ST-Elevation Myocardial Infarction)
**Definicja**: Zawał z uniesieniem odcinka ST

**Kryteria EKG**:
- **Uniesienie ST ≥ 1mm** w ≥2 sąsiadujących odprowadzeniach kończynowych
- **Uniesienie ST ≥ 2mm** w ≥2 sąsiadujących odprowadzeniach przedsercowych (mężczyźni ≥40 lat)
- **Uniesienie ST ≥ 2,5mm** w V2-V3 (mężczyźni <40 lat)
- **Uniesienie ST ≥ 1,5mm** w V2-V3 (kobiety)

### NSTEMI (Non-ST-Elevation Myocardial Infarction)
**Definicja**: Zawał bez uniesienia odcinka ST

**Cechy EKG**:
- **Obniżenie ST ≥ 0,5mm** w ≥2 sąsiadujących odprowadzeniach
- **Inwersja załamków T**
- **Przejściowe uniesienie ST** (<20 minut)
- **EKG może być prawidłowe** (!!!)

## Lokalizacja zawału według EKG

### Zawał przedni (LAD - Left Anterior Descending)
**Odprowadzenia**: V1-V6, I, aVL

**Podtypy**:
- **Przegrodzowy**: V1-V2 (septalne)
- **Przedni rozległy**: V1-V6, I, aVL
- **Szczytowy**: V3-V4

**Zmiany EKG**:
- Uniesienie ST w V2-V6
- Załamki Q w V2-V6 (później)
- Często współistnienie z blokiem LBBB

### Zawał dolny (RCA - Right Coronary Artery)
**Odprowadzenia**: II, III, aVF

**Cechy charakterystyczne**:
- **Uniesienie ST** w II, III, aVF
- **Obniżenie ST** w I, aVL (obraz lustrzany)
- Często **bradykardia** i bloki AV

**Rozszerzenie**:
- **V7-V9**: ściana tylno-boczna
- **V1-V2**: prawa komora (RCA)

### Zawał boczny (LCX - Left Circumflex)
**Odprowadzenia**: I, aVL, V5-V6

**Cechy**:
- Uniesienie ST w I, aVL, V5-V6
- Obniżenie ST w II, III, aVF
- Często **"cichy" elektrycznie**

### Zawał tylny (PDA - Posterior Descending Artery)
**Odprowadzenia**: V7-V9 (dodatkowe) lub V1-V2 (lustrzany obraz)

**Cechy lustrzane w V1-V2**:
- **Wysokie załamki R** (zamiast Q)
- **Obniżenie ST** (zamiast uniesienia)
- **Dodatnie załamki T** (zamiast inwersji)

## Kryteria diagnostyczne szczegółowe

### Uniesienie odcinka ST - pomiar
1. **Punkt J** - koniec QRS, początek ST
2. **Pomiar 60-80ms** po punkcie J
3. **Linia odniesienia** - odcinek TP lub PR
4. **Minimalna amplituda** według lokalizacji

### Załamek Q patologiczny
**Kryteria patologii**:
- **Szerokość ≥ 0,04s** (1 mała kratka)
- **Głębokość ≥ 25%** amplitudy załamka R
- **Obecność w ≥2** sąsiadujących odprowadzeniach

**Wyjątki fizjologiczne**:
- Q w III (może być fizjologiczny)
- q w V1 (septalny)
- Q w aVR (zawsze obecny)

## Przypadki kliniczne

### Przypadek 1: STEMI przedni rozległy
**Prezentacja**: 58-letni mężczyzna, ból w klatce piersiowej od 2 godzin

**EKG**:
- Uniesienie ST 3-5mm w V1-V6, I, aVL
- Obniżenie ST w II, III, aVF
- Załamki Q w V2-V4

**Diagnoza**: Zawał przedni rozległy (LAD proksymalna)
**Postępowanie**: Natychmiastowa PCI

### Przypadek 2: NSTEMI
**Prezentacja**: 72-letnia kobieta, duszność, nietypowy ból

**EKG**:
- Obniżenie ST 1-2mm w V4-V6, I, aVL
- Inwersja T w tych samych odprowadzeniach
- Brak załamków Q

**Troponina**: znacząco podwyższona
**Diagnoza**: NSTEMI boczny
**Postępowanie**: Strategia inwazyjna w 24h

## Rozpoznawanie różnicowe

### Zespół Brugada
- **Uniesienie ST** w V1-V3
- **Charakterystyczny kształt** - "siodełko" lub "łuk"
- **Brak objawów klinicznych** zawału

### Ostre zapalenie osierdzia
- **Rozproszone uniesienie ST** (wszystkie odprowadzenia)
- **Uniesienie PR** w aVR
- **Obniżenie PR** w pozostałych odprowadzeniach
- **Brak objiazuu lustrzengo**

### Wczesna repolaryzacja
- **Uniesienie ST** w V2-V5
- **Charakterystyczny kształt J** - "haczyk"
- **Młodzi, sportowcy**
- **Bez objawów klinicznych**

## Powikłania EKG w zawale

### Mechaniczne
- **Pęknięcie przegrody** - nowy szmer + NF
- **Niewydolność mitralnej** - regurgitacja ostra
- **Tamponada** - niskie QRS, alternans elektryczny

### Rytmiczne
- **VT/VF** - szczególnie w pierwszych godzinach
- **Bloki AV** - częściej w zawale dolnym
- **AF** - szczególnie w dużych zawałach

## Farmakoterapia a EKG

### Reperfuzja farmakologiczna
**Kryteria skuteczności**:
- **Spadek ST o ≥50%** w ciągu 60-90 minut
- **Ustąpienie bólu**
- **Arytmie reperfuzyjne**

### Nitrogliceryna
- **Może maskować** uniesienie ST
- **Ostrożnie w zawale dolnym** (preload)

## Stratyfikacja ryzyka

### Wysokie ryzyko (natychmiastowa PCI):
- **Uniesienie ST** w ≥2 odprowadzeniach
- **Nowy LBBB**
- **Zawał tylny** (V1-V2 lustrzanie)
- **Niestabilność hemodynamiczna**

### Umiarkowane ryzyko (PCI w 24h):
- **Dynamiczne zmiany ST**
- **Inwersja T**
- **Podwyższona troponina**

## Praktyczne wskazówki

### Algorytm diagnostyczny:
1. **Sprawdź jakość EKG** - czy dobra rozdzielczość?
2. **Oceń odcinek ST** systematycznie we wszystkich odprowadzeniach
3. **Poszukaj zmian lustrzanych** - wzmacniają rozpoznanie
4. **Sprawdź obecność Q** - czy nowy czy stary?
5. **Oceń szerokość QRS** - wyklucz LBBB

### Najczęstsze pułapki:
- **LBBB może maskować** uniesienie ST
- **Stymulacja serca** utrudnia interpretację
- **AF może współistnieć** z zawałem
- **Wczesna repolaryzacja** u młodych

## Postępowanie kliniczne

### STEMI - "Time is muscle"
- **Pierwsza pomoc medyczna < 10 minut**
- **Door-to-balloon < 90 minut**
- **Door-to-needle < 30 minut** (tromboliza)

### NSTEMI/UA
- **Stratyfikacja ryzyka** (GRACE score)
- **Podwójne leczenie przeciwpłytkowe**
- **Antykoagulacja**
- **Koronarografia w 24-72h**

## Podsumowanie

Rozpoznawanie zawału serca na EKG wymaga:
1. **Systematycznej oceny** odcinka ST
2. **Znajomości kryteriów** STEMI/NSTEMI
3. **Umiejętności lokalizacji** zawału
4. **Szybkiej korelacji klinicznej**

Pamiętaj: **EKG może być prawidłowe** w ostrym zawale (szczególnie NSTEMI)!

---

**Chcesz zostać ekspertem w rozpoznawaniu zawałów na EKG?** Zapisz się na nasz [Zaawansowany Kurs EKG](/) i naucz się wszystkich subtelności diagnozy ostrego zespołu wieńcowego. Praktyczne przypadki, symulacje i certyfikat specjalisty!`,
    featuredImage: "https://images.unsplash.com/photo-1628348068998-59d178207d8b?w=800&h=400&fit=crop",
    tags: ["Przypadki kliniczne", "Kardiologia", "Ostry zespół wieńcowy"],
    seoMeta: {
      title: "Zawał serca na EKG - STEMI i NSTEMI | Rozpoznawanie zawału",
      description: "Naucz się rozpoznawać zawał serca na EKG. Kryteria STEMI i NSTEMI, ewolucja zmian, lokalizacja i postępowanie w ostrym zespole wieńcowym.",
      keywords: ["zawał serca EKG", "STEMI", "NSTEMI", "ostry zespół wieńcowy", "zawał mięśnia sercowego"]
    },
    status: "published" as const,
    publishedAt: new Date()
  },

  {
    slug: "bloki-przewodzenia-ekg-przewodnik",
    title: "Bloki przewodzenia w EKG - Kompletny przewodnik",
    excerpt: "Poznaj wszystkie typy bloków przewodzenia w EKG. Bloki AV, bloki odnóg pęczka Hisa, kryteria diagnostyczne i wskazania do elektroterapii serca.",
    contentMd: `# Bloki przewodzenia w EKG - Kompletny przewodnik

Bloki przewodzenia to grupa zaburzeń polegających na opóźnieniu lub przerwaniu przewodzenia impulsu elektrycznego przez układ przewodzący serca. Znajomość ich rozpoznawania jest kluczowa w codziennej praktyce kardiologicznej.

## Anatomia układu przewodzącego

### Hierarchia przewodzenia
1. **Węzeł zatokowy** (60-100/min)
2. **Węzeł AV** - fizjologiczne opóźnienie
3. **Pęczek Hisa** - wspólny trakt
4. **Odnogi pęczka**: prawa (RBBB) i lewa (LBBB)
5. **Włókna Purkiniego** - dystrybucja końcowa

### Strefy krytyczne
- **Węzeł AV** - najczęstsze miejsce bloków
- **Bifurkacja pęczka Hisa** - bloki dwu- i trójwiązkowe
- **Odnogi** - bloki śródkomorowe

## Bloki przedsionkowo-komorowe (AV)

### Blok AV I stopnia
**Definicja**: Wydłużenie przewodzenia AV bez przerwania

**Kryteria EKG**:
- **PR > 0,20s** (>5 małych kratek)
- **Każdy załamek P** ma swój QRS
- **Stała długość PR** (w przeciwieństwie do Wenckebacha)

**Etiologia**:
- Fizjologicznie u sportowców
- Leki (beta-blokery, werapamil, digoksyna)
- Choroba węzła AV (wieku, niedokrwienie)

**Postępowanie**: Zwykle obserwacja, modyfikacja farmakoterapii

### Blok AV II stopnia typ I (Wenckebach)
**Definicja**: Progresywne wydłużenie PR z okresowym wypadaniem QRS

**Kryteria EKG**:
- **Progresywne wydłużenie PR** przed wypadnięciem QRS
- **Skrócenie PR** po wypadnięciu (reset)
- **Grupowanie QRS** - wzór powtarzających się sekwencji
- **Stosunek P:QRS** - np. 3:2, 4:3, 5:4

**Charakterystyka**:
- Zazwyczaj **blok na poziomie węzła AV**
- Dobrze tolerowany hemodynamicznie
- Może być fizjologiczny (sen, sportowcy)

### Blok AV II stopnia typ II (Mobitz II)
**Definicja**: Nagłe wypadanie QRS bez wydłużenia PR

**Kryteria EKG**:
- **Stała długość PR** przed wypadnięciem
- **Nagłe wypadnięcie QRS** bez ostrzeżenia
- **Stosunek P:QRS** - zwykle 2:1, 3:1
- **Szeroki QRS** (często współistnieje blok odnóg)

**Znaczenie kliniczne**:
- **Wysokie ryzyko** progresji do bloku III°
- **Często objawowy** (omdlenia, zawroty głowy)
- **Wskazanie do stymulatora** w większości przypadków

### Blok AV III stopnia (całkowity)
**Definicja**: Całkowite przerwanie przewodzenia AV

**Kryteria EKG**:
- **Całkowita dysocjacja AV** - niezależne P i QRS
- **Regularna częstotliwość QRS** (rytm zastępczy)
- **Częstotliwość**: 40-60/min (węzłowy) lub 20-40/min (komorowy)
- **Szerokość QRS**: wąski (węzłowy) lub szeroki (komorowy)

**Postępowanie**: **Pilna stymulacja** tymczasowa/stała

## Bloki śródkomorowe

### Blok prawej odnogi pęczka (RBBB)
**Definicja**: Opóźnienie aktywacji prawej komory

**Kryteria EKG**:
- **QRS ≥ 0,12s** (≥3 małe kratki)
- **rsR' w V1-V2** - charakterystyczny kształt "ucha królika"
- **Szerokie S w I, V5-V6** - opóźniona aktywacja prawej komory
- **Oś serca** - zwykle prawidłowa lub odchylenie w prawo

**Znaczenie kliniczne**:
- Często **bezobjawowy**
- Może towarzyszyć wadą serca, chorobom płuc
- **Zapis nieodwracalny** (w przeciwieństwie do LBBB)

### Blok lewej odnogi pęczka (LBBB)
**Definicja**: Opóźnienie aktywacji lewej komory

**Kryteria EKG**:
- **QRS ≥ 0,12s**
- **Brak załamka Q** w I, V5-V6
- **Szerokie R w I, V5-V6** - opóźniona aktywacja lewej komory
- **rS lub QS w V1-V2**
- **Odchylenie osi w lewo** (zwykle)

**Znaczenie prognostyczne**:
- **Zawsze patologiczny** (w przeciwieństwie do RBBB)
- Może maskować zawał serca
- **CRT** (resynchronizacja) przy niewydolności serca

### Blok przedni lewej fascykuły (LAFB)
**Definicja**: Blok przedniej fascykuły lewej odnogi

**Kryteria EKG**:
- **Odchylenie osi w lewo** (<-30°)
- **QRS 0,08-0,11s** (graniczne wydłużenie)
- **qR w I, aVL**
- **rS w II, III, aVF**

### Blok tylny lewej fascykuły (LPFB)
**Definicja**: Blok tylnej fascykuły lewej odnogi (rzadki)

**Kryteria EKG**:
- **Odchylenie osi w prawo** (>+90°)
- **rS w I, aVL**
- **qR w II, III, aVF**
- **Wykluczenie innych przyczyn** odchylenia w prawo

## Bloki wielopoziomowe

### Blok dwuwiązkowy
**Kombinacje**:
1. **RBBB + LAFB** - najczęstsza
2. **RBBB + LPFB** - rzadka
3. **LBBB** (blok obu fascykuł lewej odnogi)

**Znaczenie**:
- **Wysokie ryzyko** progresji do bloku całkowitego
- Monitorowanie wskazane

### Blok trójwiązkowy
**Definicja**: Uszkodzenie wszystkich trzech fascykuł

**Warianty**:
- **Alternujący LBBB/RBBB**
- **RBBB + alternujący blok fascykuł**
- **Blok AV II° typu II + blok odnogi**

**Postępowanie**: **Wskazanie do stymulatora**

## Przypadki kliniczne

### Przypadek 1: Blok AV I stopnia
**Pacjent**: 68-letni mężczyzna, przyjmuje bisoprolol

**EKG**:
- PR = 0,24s
- Regularny rytm zatokowy 65/min
- QRS wąski

**Postępowanie**: Monitorowanie, ewentualna redukcja beta-blokera

### Przypadek 2: Blok AV II stopnia typ I
**Pacjent**: 45-letni sportowiec, nocne zawroty głowy

**EKG**:
- Progresywne wydłużenie PR: 0,16s → 0,20s → 0,24s → wypadnięcie
- Grupowanie QRS w sekwencjach 3:2

**Postępowanie**: Obserwacja, Holter EKG

### Przypadek 3: LBBB nowy
**Pacjent**: 72-letnia kobieta, duszność, obrzęki

**EKG**:
- QRS = 0,16s
- Brak Q w I, V5-V6
- Szerokie R w I, V5-V6

**Postępowanie**: Echo serca, ocena funkcji LV, ewentualna CRT

## Wskazania do elektroterapii

### Klasa I (jednoznacznie wskazane):
- **Blok AV III°** objawowy lub bezobjawowy z HR <40/min
- **Blok AV II° typ II**
- **Alternujące bloki odnóg**
- **Blok AV I° z PR >0,30s + objawy**

### Klasa IIa (prawdopodobnie wskazane):
- **Blok AV II° typ I** objawowy
- **LBBB + niewydolność serca** (CRT-D)
- **Blok dwuwiązkowy** z objawami

### Klasa III (niewskazane):
- **Blok AV I°** bezobjawowy
- **RBBB** bezobjawowy
- **Blok AV II° typ I** bezobjawowy i nocny

## Diagnostyka różnicowa

### RBBB vs. aberracja przewodzenia
**RBBB**:
- Stały kształt QRS
- rsR' w V1 typowy
- Zespoły szerokie zawsze

**Aberracja**:
- Zmienny kształt QRS
- Zależy od częstotliwości
- Może ustępować

### LBBB vs. rytm stymulowany
**LBBB**:
- Brak artefaktów stymulacji
- Typowa morfologia
- Synchroniczny z P

**Stymulacja**:
- Widoczne artefakty
- Może być asynchroniczna
- Programowalne parametry

## Farmakoterapia a bloki

### Leki powodujące bloki:
- **Beta-blokery** - głównie węzeł AV
- **Antagoniści wapnia** (verapamil, diltiazem)
- **Digoksyna** - węzeł AV
- **Antiarytmiki** klasy I i III

### Postępowanie:
1. **Identyfikacja przyczyny** farmakologicznej
2. **Redukcja/odstawienie** leku przyczynowego
3. **Monitorowanie** poprawy przewodzenia
4. **Stymulacja** jeśli nieodwracalne

## Monitorowanie ambulatoryjne

### Wskazania do Holtera:
- **Bloki II° okresowe**
- **Objawy suggestive** bloku wyższego stopnia
- **Ocena progresji** bloku
- **Kontrola po implantacji** stymulatora

## Rokowanie

### Bloki AV:
- **I stopień** - zwykle łagodny
- **II stopień typ I** - dobry przy lokalizacji na węźle AV
- **II stopień typ II** - złe rokowanie
- **III stopień** - wymaga stymulacji

### Bloki śródkomorowe:
- **RBBB** - zwykle łagodny
- **LBBB** - gorsze rokowanie (dysfunkcja LV)
- **Bloki wielopoziomowe** - wysokie ryzyko

## Podsumowanie

Bloki przewodzenia wymagają:
1. **Systematycznej klasyfikacji** według anatomii
2. **Oceny lokalizacji** bloku
3. **Stratyfikacji ryzyka** progresji
4. **Właściwej kwalifikacji** do elektroterapii

Kluczowe zasady:
- **Blok AV II° typ II** = stymulator
- **Nowy LBBB** = pilna diagnostyka
- **Objawy + blok** = rozważyć stymulator
- **Leki** mogą być przyczyną odwracalną

---

**Chcesz zostać ekspertem w rozpoznawaniu bloków przewodzenia?** Dołącz do [EKG Academy](/) i opanuj interpretację wszystkich zaburzeń przewodzenia. Interaktywne przypadki, algorytmy diagnostyczne i certyfikat specjalisty czekają na Ciebie!`,
    featuredImage: "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=800&h=400&fit=crop",
    tags: ["Zaburzenia przewodzenia", "Podstawy EKG"],
    seoMeta: {
      title: "Bloki przewodzenia EKG - Bloki AV, LBBB, RBBB | Przewodnik",
      description: "Kompletny przewodnik po blokach przewodzenia w EKG. Bloki AV, bloki odnóg pęczka, kryteria diagnostyczne i wskazania do elektroterapii.",
      keywords: ["bloki przewodzenia", "blok AV", "LBBB", "RBBB", "stymulator serca", "zaburzenia przewodzenia"]
    },
    status: "published" as const,
    publishedAt: new Date()
  },

  {
    slug: "hipertrofia-lewej-komory-ekg-kryteria",
    title: "Hipertrofia lewej komory na EKG - Kryteria i interpretacja",
    excerpt: "Poznaj wszystkie kryteria rozpoznawania hipertrofii lewej komory na EKG. Indeks Sokolova-Lyona, kryteria Cornell, zaburzenia repolaryzacji i znaczenie kliniczne LVH.",
    contentMd: `# Hipertrofia lewej komory na EKG - Kryteria i interpretacja

Hipertrofia lewej komory (LVH - Left Ventricular Hypertrophy) to przerost mięśnia sercowego lewej komory będący odpowiedzią na przewlekłe przeciążenie. Rozpoznanie LVH na EKG ma istotne znaczenie prognostyczne i terapeutyczne.

## Podstawy patofizjologii

### Mechanizmy adaptacyjne
**Hipertrofia** powstaje w odpowiedzi na:
1. **Przeciążenie ciśnieniowe** - nadciśnienie tętnicze, zwężenie aorty
2. **Przeciążenie objętościowe** - niedomykalność aortalna/mitralna
3. **Czynniki metaboliczne** - cukrzyca, otyłość
4. **Predyspozycja genetyczna** - kardiomiopatia przerostowa

### Rodzaje hipertrofii:
- **Koncentryczna** - zwiększenie grubości ściany z prawidłowym lub zmniejszonym wymiarem jam
- **Ekscentryczna** - zwiększenie wymiarów jam z proporcjonalnym zwiększeniem grubości ściany

### Zmiany elektryczne
Przerost mięśnia powoduje:
- **Zwiększenie masy** komórek mięśniowych
- **Wydłużenie czasu depolaryzacji**
- **Zmiany w przewodzeniu śródkomorowym**
- **Zaburzenia repolaryzacji**

## Kryteria elektrokardiograficzne

### Indeks Sokolova-Lyona
**Formuła**: S(V1) + R(V5 lub V6) ≥ 35mm

**Charakterystyka**:
- **Najpopularniejsze kryterium** w praktyce klinicznej
- **Wysoka swoistość** (~85-90%)
- **Niska czułość** (~20-30%)
- **Częste fałszywie ujemne** u kobiet, osób starszych

**Modyfikacje**:
- **U kobiet**: ≥28mm
- **U osób >35 lat**: ≥30mm

### Kryteria Cornell
**Formuła**:
- **Mężczyźni**: R(aVL) + S(V3) ≥28mm
- **Kobiety**: R(aVL) + S(V3) ≥20mm

**Zalety**:
- **Lepsza czułość** niż Sokolov-Lyon
- **Mniej wpływu wieku** i płci
- **Dobra korelacja z echokardiografią**

### Kryteria punktowe (Romhilt-Estes)
**System punktowy** (≥5 punktów = LVH):

**Amplituda QRS (3 punkty)**:
- R lub S w odprowadzeniach kończynowych ≥20mm
- S(V1-V2) ≥30mm lub R(V5-V6) ≥30mm

**Odchylenie osi w lewo** ≥-15° (2 punkty)

**Czas trwania QRS** ≥0,09s (1 punkt)

**Czas załamka R** w V5-V6 ≥0,05s (1 punkt)

**Zaburzenia repolaryzacji** (3 punkty):
- Bez digitalizacji: 3 punkty
- Z digitalizacją: 1 punkt

**Poszerzenie P** w V1 ≥0,04s (3 punkty)

### Inne kryteria

#### Lewis Index
**Formuła**: (R(I) + S(III)) - (R(III) + S(I)) ≥17mm

#### Gubner-Ungerleider
**Formuła**: R(I) + S(III) ≥25mm

#### Peguero-Lo Presti
**Formuła**: Najgłębsze S w dowolnym odprowadzeniu + S(V4) ≥28mm (mężczyźni), ≥23mm (kobiety)

## Zaburzenia repolaryzacji w LVH

### Strain pattern (wzór przeciążenia)
**Definicja**: Charakterystyczne zmiany ST-T w LVH

**Cechy**:
- **Obniżenie ST** w I, aVL, V5-V6
- **Inwersja załamków T** asymetryczna
- **Kształt "kostki hokejowej"** - stromy opadający ST, inwersja T

**Znaczenie**:
- **Wskaźnik zaawansowania** LVH
- **Gorsze rokowanie**
- **Zwiększone ryzyko** incydentów sercowo-naczyniowych

### Mechanizmy zaburzeń repolaryzacji:
1. **Wydłużenie depolaryzacji** w hipertroficznym mięśniu
2. **Niedokrwienie relatywne** podwsierdziowe
3. **Zmiany w kanałach jonowych**
4. **Włóknienie śródmiąższowe**

## Różnicowanie według etiologii

### LVH w nadciśnieniu tętniczym
**Cechy**:
- **Postępujące narastanie** kryteriów
- **Strain pattern** w zaawansowanych stadiach
- **Odpowiedź na leczenie hipotensyjne**

### Kardiomiopatia przerostowa (HCM)
**Cechy charakterystyczne**:
- **Bardzo wysokie amplitudy** QRS (>50mm)
- **Głębokie załamki Q** w I, aVL, V5-V6
- **Załamki T gigantyczne** ujemne w V2-V6
- **Młody wiek** pacjenta

### Zwężenie aortalne
**Cechy**:
- **LVH z strain pattern**
- **Możliwy blok AV I°**
- **Progresja objawów** (duszność, omdlenia, dławica)

### Niedomykalność aortalna
**Cechy**:
- **Wysokie amplitudy** bez strain pattern (początkowo)
- **Odchylenie osi w lewo**
- **Wydłużenie QRS**

## Przypadki kliniczne

### Przypadek 1: LVH w nadciśnieniu
**Pacjent**: 58-letni mężczyzna, RR 180/110 mmHg

**EKG**:
- Sokolov-Lyon: S(V1) 25mm + R(V5) 28mm = 53mm
- Strain pattern: obniżenie ST i inwersja T w V5-V6
- Oś serca: -20° (lekkie odchylenie w lewo)

**Interpretacja**: LVH z przeciążeniem, wskazana optymalizacja leczenia hipotensyjnego

### Przypadek 2: Kardiomiopatia przerostowa
**Pacjent**: 32-letnia kobieta, omdlenia po wysiłku

**EKG**:
- Gigantyczne amplitudy: R(V5) 45mm, S(V2) 35mm
- Głębokie Q w I, aVL
- Inwersja T w V2-V6 (gigantyczne, asymetryczne)

**Interpretacja**: Podejrzenie HCM, konieczne echo serca i badania genetyczne

## Diagnostyka różnicowa

### LVH vs. LBBB
**LVH**:
- **Załamek Q** może być obecny w I, aVL
- **Strain pattern** charakterystyczny
- **QRS zwykle <0,12s**

**LBBB**:
- **Brak Q** w I, V5-V6
- **QRS ≥0,12s**
- **Charakterystyczna morfologia** (szerokie R)

### LVH vs. zawał tylny
**LVH**:
- **Symetryczne zmiany** w odprowadzeniach bocznych
- **Brak załamków Q** patologicznych
- **Stopniowa progresja** zmian

**Zawał tylny**:
- **Wysokie R w V1-V2** (obraz lustrzany)
- **Historia kliniczna** ostrego epizodu
- **Markery biochemiczne** zawału

## Znaczenie prognostyczne

### Ryzyko sercowo-naczyniowe
LVH na EKG wiąże się z **zwiększonym ryzykiem**:
- **Zawał serca** (2-4x większe ryzyko)
- **Udar mózgu** (2-3x większe ryzyko)
- **Niewydolność serca** (3-6x większe ryzyko)
- **Śmierć sercowo-naczyniowa** (2-5x większe ryzyko)

### Czynniki wpływające na rokowanie:
- **Obecność strain pattern** - gorsze rokowanie
- **Nasilenie LVH** - większe amplitudy = większe ryzyko
- **Wiek pacjenta** - gorsze rokowanie u starszych
- **Współistniejące choroby** - cukrzyca, CAD

## Monitorowanie i leczenie

### Echokardiografia
**Wskazania do echo**:
- **Potwierdzenie LVH** stwierdzonej w EKG
- **Ocena funkcji skurczowej** lewej komory
- **Różnicowanie typu hipertrofii**
- **Monitorowanie odpowiedzi** na leczenie

### Strategie terapeutyczne

#### Leczenie przyczynowe:
- **ACE-I/ARB** - pierwsza linia w nadciśnieniu z LVH
- **Antagoniści wapnia** - szczególnie w HCM
- **Diuretyki** - w przeciążeniu objętościowym
- **Beta-blokery** - w HCM, po zawale

#### Cele leczenia:
- **Regresja LVH** - zmniejszenie masy LV
- **Poprawa rokowaniA** - redukcja ryzyka CV
- **Kontrola objawów** - duszność, dławica

## Regresja LVH

### Kryteria regresji w EKG:
- **Zmniejszenie amplitud** QRS >10%
- **Poprawa strain pattern**
- **Skrócenie czasu QRS**

### Czynniki wpływające na regresję:
- **Skuteczność leczenia hipotensyjnego**
- **Czas trwania terapii** - widoczna po 6-12 miesiącach
- **Typ leku** - ACE-I/ARB najskuteczniejsze
- **Współpraca pacjenta**

## Ograniczenia EKG w diagnostyce LVH

### Przyczyny fałszywie ujemnych wyników:
- **Otyłość** - tłumienie amplitud
- **Choroba płuc** - zmiana położenia serca
- **Wiek** - zmiany w przewodzeniu
- **Płeć żeńska** - niższe amplitudy fizjologicznie

### Przyczyny fałszywie dodatnich:
- **Młody wiek** - fizjologicznie wyższe amplitudy
- **Astenik** - cienka klatka piersiowa
- **Sportowcy** - fizjologiczna hipertrofia
- **Błędy techniczne** - nieprawidłowe wzmocnienie

## Praktyczne zalecenia

### Algorytm diagnostyczny:
1. **Oceń amplitudy** QRS według różnych kryteriów
2. **Sprawdź strain pattern**
3. **Uwzględnij wiek i płeć** pacjenta
4. **Koreluj z obrazem klinicznym**
5. **Potwierdź echo serca** jeśli wskazane

### Najważniejsze zasady:
- **Używaj wielu kryteriów** jednocześnie
- **Strain pattern** = większe znaczenie prognostyczne
- **Echokardiografia** = złoty standard
- **Monitoruj regresję** w trakcie leczenia

## Podsumowanie

Rozpoznawanie LVH na EKG wymaga:
1. **Znajomości wielu kryteriów** diagnostycznych
2. **Oceny strain pattern** dla rokowania
3. **Korelacji z echo** dla potwierdzenia
4. **Monitorowania odpowiedzi** na leczenie

Kluczowe punkty:
- **Sokolov-Lyon** - najprostsze, ale mało czułe
- **Cornell** - lepsze dla kobiet i starszych
- **Strain pattern** - gorsze rokowanie
- **Echo serca** - potwierdzenie diagnozy

---

**Chcesz opanować interpretację hipertrofii na EKG?** Zapisz się na [Zaawansowany Kurs EKG](/) i naucz się wszystkich kryteriów diagnostycznych LVH. Praktyczne przypadki, korelacje z echokardiografią i certyfikat specjalisty!`,
    featuredImage: "https://images.unsplash.com/photo-1530026186672-2cd00ffc50fe?w=800&h=400&fit=crop",
    tags: ["Kardiologia", "Interpretacja EKG"],
    seoMeta: {
      title: "Hipertrofia lewej komory EKG - LVH kryteria Sokolova | Przewodnik",
      description: "Poznaj kryteria rozpoznawania hipertrofii lewej komory na EKG. Indeks Sokolova-Lyona, Cornell, strain pattern i znaczenie prognostyczne LVH.",
      keywords: ["hipertrofia lewej komory", "LVH EKG", "kryteria Sokolova", "Cornell", "strain pattern", "nadciśnienie"]
    },
    status: "published" as const,
    publishedAt: new Date()
  }
];

async function createBlogPosts() {
  console.log("Creating blog posts...");

  try {
    for (let i = 0; i < blogPosts.length; i++) {
      const post = blogPosts[i];
      console.log(`Creating post ${i + 1}: ${post.title}`);

      const createdPost = await storage.createBlogPost({
        ...post,
        authorId: ADMIN_USER_ID
      });

      console.log(`✅ Created: ${createdPost.slug}`);

      // Create audit log
      await storage.createAuditLog({
        actorId: ADMIN_USER_ID,
        action: "blog_post_created",
        entityType: "blog_post",
        entityId: createdPost.id,
        diff: { post: post },
        ipAddress: "127.0.0.1",
        userAgent: "Blog Creation Script"
      });
    }

    console.log(`\n🎉 Successfully created ${blogPosts.length} blog posts!`);

    // Verify posts were created
    const allPosts = await storage.getBlogPosts({
      status: 'published',
      page: 1,
      pageSize: 10
    });

    console.log(`\n📊 Total published posts: ${allPosts.total}`);
    allPosts.items.forEach((post: any) => {
      console.log(`- ${post.title} (${post.slug})`);
    });

  } catch (error) {
    console.error("Error creating blog posts:", error);
    process.exit(1);
  }
}

// Run the script
createBlogPosts().then(() => {
  console.log("\n✅ Blog posts creation completed!");
  process.exit(0);
});