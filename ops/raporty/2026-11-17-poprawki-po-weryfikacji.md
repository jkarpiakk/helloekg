# Poprawki kodu kursu po weryfikacji hurtowej (17.11.2026)

Zadanie: `~/Projects/helloekg-studio/ops/raporty/weryfikacja-2026-11-15/cc/PROMPT_1_kurs_kod.md`.
Gałąź: `punkty-edukacyjne`, od 2e138ea (stan produkcji).
Nic nie jest wdrożone na kurs.helloekg.pl: wdrożenie czeka na „tak” od JK.

Wszystko sprawdzone na lustrze produkcji, czyli kopii treści kursu na VPS. Używałem kont tymczasowych na lustrze, nie na produkcji.

Dowody leżą w `ops/raporty/2026-11-17-dowody/`:
- pliki JSON są w repo;
- zrzuty PNG zostają lokalnie, bo `*.png` jest w `.gitignore`.

## Wynik testów (na ostatnim commicie)

| Sprawdzenie | Wynik |
|---|---|
| `npx tsc` | bez błędów |
| `npx vitest run` | 8 plików, 112 testów, wszystkie przechodzą (było 90) |
| `npm run e2e:obrazy` (lustro odświeżone z produkcji) | 1256 opublikowanych pytań, 226 obrazów, 0 błędów |
| `npm run e2e:odswiezenie` (nowy) | pytanie 3 z 4 przed i po odświeżeniu, A-D bez zmian, podsumowanie 4 z 4 |

## Zgłoszenia

| Zgłoszenie | Commit | Co sprawdzone w przeglądarce (lustro) | Testy |
|---|---|---|---|
| Z-102 (test bez wstawek) | 1447bd2 | Nie dotyczy przeglądarki. Pula testu na produkcji ma 0 pytań z `::wstawka`, więc zmiana jej nie zmniejsza. | tsc, vitest |
| Z-101 (koło jak w studiu) | d914812 | Q-INT-01-HS-02 i Q-INT-03-HS-03: kliknięcie w piksel krzywej, który leży w kole, ale poza dawną elipsą, daje „Dobrze.”. W 8 pytaniach z kołami (25 kół) nowa geometria nie nachodzi na sąsiednie obszary. | `tests/unit/hotspot.test.ts`: 2652 punkty i 312 zestawów wskazań policzone kodem studia (`hitsHotspot`, `gradeHotspot`) na planszach kursu; kurs daje ten sam wynik |
| Z-100, Z-130 (1) (ocena na serwerze) | dc53db7 | API przed odpowiedzią: `hotspots: []`, bez etykiet i identyfikatorów. Q-INT-00-HS-05 i Q-INT-04-HS-03 (wiele miejsc): ponowne dotknięcie znacznika go zdejmuje, komplet daje „Dobrze.”. Status przed odpowiedzią jest neutralny (dawne „poza obszarami” zdradzało trafienie). | jak wyżej; ocena wielu miejsc to (trafione − błędne) / poprawne, bez dzielenia przez 0 |
| Z-102 (zaciemnienie scenariusza) | 097f3a5 | Powtórka i egzamin próbny: w odpowiedzi API nie ma nazwy scenariusza (przed: `mobitz-2-szerokie-qrs`, po: skrót z solą). W DOM też jej nie ma, a monitor rysuje się normalnie. Nauka używa tej samej funkcji serwera (`formatQuestionForQuiz`). | `tests/unit/zaciemnienie.test.ts` |
| Z-122 (C2a, C2b) | de2b83b | 375 px, dopasowanie z 5 parami: „Sprawdź” jest nieaktywny przy 0 i 1 parze, aktywny przy komplecie. Kolejność 3 i 4: start bez elementu na swoim miejscu, „Sprawdź” dopiero po przestawieniu. Podsumowanie ma 4 pola w układzie 2 × 2 (Poprawne, Częściowo, Błędne, Czas). | `tests/unit/kolejnosc.test.ts` (2, 3, 4 i 6 elementów, po 500 losowań) |
| Z-106 (blokada na serwerze) | 7fb0286 | Na produkcji nic nie jest zablokowane ani ukryte, więc nikt nie traci dostępu. Lustro, konto kursanta: temat odblokowany daje 200/200/200; temat zablokowany na chwilę daje 404 na pytania, 403 na rozdziały, a egzamin próbny losuje bez tego tematu. | tsc |
| Z-123 (stan po odświeżeniu) | f30ecd8 | Jak w teście e2e obok. | `npm run e2e:odswiezenie` |
| Z-117 (luki jak w studiu) | 837b30d | Nie dotyczy przeglądarki. Wszystkie 466 wzorcowych odpowiedzi w 63 opublikowanych pytaniach z lukami nadal są przyjmowane. | `tests/unit/luki.test.ts` („75abc”, „0,12 s”, spacje, regex z flagą u) |
| Z-119 (2) (IPv6) | 5a4f2ee | Nie dotyczy przeglądarki. | `tests/unit/ratelimit-ipv6.test.ts` |
| Z-127 (C7, napisy) | d84c000 | „Powiększ” stoi pod obrazem i podpis „25 mm/s · 10 mm/mV” jest widoczny (375 px). Podgląd obrazu się otwiera. | tsc |
| Z-130 (2) (etykieta pełnego ekranu) | 559ab16 | Przy planszy: „Pełny ekran: zapis do wskazania”. | tsc |
| Z-119 (3) (schemat zgłoszenia) | 0a5036e | Lustro, konto recenzenta: poprawna zmiana daje 200; zły status, obce pole i odpowiedź dłuższa niż 5000 znaków dają 400; zły identyfikator daje 404. | tsc |

## Czeka na JK

1. **Wdrożenie** 12 commitów z tabeli. Przed wdrożeniem robię kopię bazy, jak zwykle.
   - Wdrażać razem: C2b zmienia serwer i przeglądarkę.
   - Hotspot zmienia zachowanie: przy wielu miejscach znacznik zdejmuje się dotknięciem, a stary przycisk „Wyczyść” zostaje.
2. **C8 i C6 (Z-128, Z-126), gałąź `wizualne-c6-c8`** (470840b). Zrzuty przed i po przy 375, 935 i 1456 px są w dowodach (`C6-C8-…`).

   | Wstawka | Szerokość | Wysokość |
   |---|---|---|
   | Elektrody, 935 px | 714 → 834 px | 2324 → 1354 px (sylwetka obok odprowadzeń) |
   | Elektrody, 1456 px | 714 → 880 px | 2324 → 1322 px |
   | Elektrody, telefon | bez zmian | bez zmian |

   „Zapis EKG” w wykładzie zmienia się z gołego paska 90 px w kompaktowy monitor z siatką, HR, Pauzą i pełnym ekranem (147–181 px).
   Po „tak” scalam do `punkty-edukacyjne`.
3. **C2c (wybór w dwóch krokach):** nie zastosowany, odwraca decyzję „odpowiedź liczy się po dotknięciu”.
4. **„Temat” czy „Wykład” (Z-127):** funkcja `etykietaJednostki` w `lib/courseOrder.ts` jest gotowa na gałęzi `decyzja-z127-etykieta` (ec99b99), z testem, jeszcze niepodłączona.
   - Dziś „Temat 04” liczy pozycję na liście modułu, a „Wykład 3” tylko tematy z wykładem.
   - Do wyboru jest słowo i numeracja. Rekomendacja z weryfikacji: „Wykład” z numeracją pozycji, „Pytania utrwalające” bez numeru.
   - Po decyzji podłączę ją w 3 miejscach: QuizInterface, OrderHint, dynamic-lecture.
5. **Ślad czytania wykładu (Z-119 pkt 4):** minimalny odstęp między rozdziałami. Nie ruszałem.
6. **Alt obrazu pytania po odpowiedzi (Z-127):** wymaga zmiany importera. Nie ruszałem.
7. **Z-102, wersja docelowa: szacunek, nie robione.** Dziś monitor w pytaniu składa zapis w przeglądarce z kodu scenariusza, więc lista scenariuszy z nazwami jest w paczce JS. Docelowo serwer wysyła gotowy zapis bez nazwy.
   - **Studio, `core/kardiomonitor.ts`** (0,5–1 dnia): tryb „zapis z danych”, czyli monitor odtwarza przysłane pobudzenia zamiast generatora scenariusza.
   - **Kurs, serwer** (około 0,5 dnia): generator rytmu (`core/rytm.ts`, `core/model.ts`, scenariusze; czysty TS bez DOM) uruchamiany w Node. Serwer generuje 20–30 s zapisu dla pytania i wysyła go w odpowiedzi. Nazwa i parametry zostają na serwerze.
   - **Kurs, przeglądarka** (około 0,5 dnia): pytanie z monitorem nie ładuje listy scenariuszy (osobny kawałek paczki tylko dla wykładu i wyjaśnienia), do tego testy e2e.
   - **Razem:** 1,5–2,5 dnia. Rekomendacja z weryfikacji: przed włączeniem szkolenia z punktami.
   - **Ryzyko:** pętla zapisu powtarza się co 20–30 s, a rytmy z rzadkimi zdarzeniami (pauzy, pobudzenia przedwczesne) trzeba wygenerować tak, żeby zdarzenie wypadło w oknie.

## Uwagi

- Diffy z weryfikacji nałożyłem z poprawkami:
  - **BEZP-hotspot-ocena-na-serwerze:** dopisana geometria koła ze studia. Serwer bierze wymiary planszy z nagłówka pliku PNG/WebP, a wymiary z przeglądarki są tylko zapasem.
  - **BEZP-scenariusz-zaciemnienie:** konflikt z importem w `quizService.ts`, nałożone ręcznie.
  - **C2b:** losowanie przeniesione do `shared/kolejnosc.ts`, żeby dało się je przetestować.
- W „wskaż na zapisie” przed odpowiedzią przeglądarka nie zna już obszarów, więc status mówi tylko „Wskazano miejsce.” albo „Wskazane miejsca: N”. Krok „wskaż” w przypadku klinicznym działa po staremu, bo przypadek w nauce dostaje pełną konfigurację (świadoma decyzja, Z-119 pkt 1).
- Katalogu `client/src/wstawki/` nie ruszałem. Treści pytań i wykładów nie zmieniałem.
