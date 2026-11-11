# Audyt całości: punkty edukacyjne, paczka 11.11, spójność (11.11.2026)

Polecenie JK: sprawdzić, co jest jeszcze do zrobienia, naprawienia, czy wszystko jest spójne, także rzeczy, o których nikt nie pomyślał; w razie potrzeby niezależni audytorzy.
Audytorzy (niezależni, „świeże oczy”): prawny (źródła urzędowe), przegląd kodu studia, przegląd kodu kursu, spójność treści i liczb. Szczegóły poza repozytorium: `/private/tmp/claude-501/audyt-cme/PRAWO.md`, `review-studio/RAPORT.md`, `review-kurs/RAPORT.md`, `audyt-spojnosci/RAPORT.md`.

Nic z tego nie jest jeszcze na produkcji. Wszystko na gałęziach `punkty-edukacyjne` (studio i kurs), sprawdzone na kopiach baz.

## 1. Co jest zbudowane

| Część | Stan |
|---|---|
| Studio | pula testu, „nie tasuj”, wyklucza; sekcja S8 „EKG na LEK” (poza szkoleniem); podsumowania, bibliografie i program z ptaszkami i historią; eksport „tylko zatwierdzone” naprawiony (działa po ptaszkach); teksty dla kursu w wersji przekonwertowanej; 1419 testów |
| Paczka 11.11 (migracje) | 88 kart grafik, 102 pytania S4–S6 i „Wybierz zapis”, 192 pytania S8 (96 par), 50 pytań testu, 7 podsumowań i bibliografii, program, poprawki w 5 wykładach i 4 grafikach; idempotentne, działają na zwykłym Node (serwer), historia zmian w formacie aplikacji |
| Kurs | zapis na szkolenie z PWZ (walidacja wg NIL i NIPiP), dziennik, ukończenie modułów, test zaliczeniowy (losowanie z minimum na wykład, limit czasu, podejścia, przerwa), ankieta anonimowa, zaświadczenie PDF z QR i weryfikacją po losowym kluczu, reguły punktów per zawód z datami obowiązywania, ręczne sprawdzenie PWZ, eksporty CSV (lista obecności, raport do izby), retencja 5 lat; wszystko za przełącznikiem `szkolenie_wlaczone` (domyślnie wyłączony) |
| Przejście studio → kurs | prawdziwy eksport z kopii po imporcie paczki przechodzi przez importer kursu (próba): +1 moduł (S8), +360 pytań, 1164 opublikowane, 211 szkiców |

## 2. Znalezione i naprawione w trakcie audytu

| Skąd | Co | Naprawa |
|---|---|---|
| przegląd studia | migracje nie ruszyłyby na serwerze (brak tsx) | importy z pakietu zbudowanego, sprawdzone zwykłym Node |
| przegląd studia | historia zmian po migracji psuła „Przywróć” i „Pokaż zmiany” | migawki w formacie aplikacji, nowe encje bez fałszywych wpisów |
| przegląd studia | podsumowania szłyby do kursu z surowymi dyrektywami | pola `…MdApp` w eksporcie, kurs ich używa |
| przegląd studia | pytanie gubiło wykład w „tylko zatwierdzone”; wyklucza wskazywało pytania spoza paczki; pula testu możliwa w S8 | naprawione |
| spójność | liczby w programie (913 pytań) nieaktualne | 922 opublikowane pytania ćwiczeniowe, 2400,3 min, nadal **53 h** |
| spójność | nazwy modułów w programie inne niż w kursie; brak położnych wśród adresatów | jak w kursie; położne dopisane |
| spójność | losowanie gubiło wykład S3_02 w co czwartym teście | najpierw po jednym pytaniu z każdego wykładu, potem reszta |
| spójność | 4 pary pytań testu o tym samym sensie wypadały razem | dopisane do „wyklucza” |
| spójność | 13 bliźniaków S8 wskazuje literę odpowiedzi w wyjaśnieniu, a odpowiedzi byłyby tasowane | te pytania „nie tasuj” |
| spójność | 7 pytań z kardiomonitorem oznaczonych „wymaga grafiki” bez grafiki | flaga z obecności grafiki |
| prawny | format PWZ pielęgniarki: 7 cyfr i **obowiązkowa** litera P/A; lekarz: twarda cyfra kontrolna (algorytm NIL) | wdrożone |
| prawny | test: limit czasu, wgląd w ocenione podejście, tylko pytania z 5 odpowiedziami | 90 min, wgląd pełny po zaliczeniu albo po ostatnim podejściu |
| prawny | punkty lekarzy i pielęgniarek z decyzji, nie z godzin; podstawy prawne uzupełnione (Dz.U. 2024 poz. 637, uchwała NRPiP 195/VIII/2026) | wdrożone |
| prawny | retencja 5 lat od końca roku wydania zaświadczenia; ręczne sprawdzenie PWZ w rejestrze przed punktami; raport do izby lekarskiej | wdrożone |
| przegląd kursu | klucz testu widoczny po oblanym podejściu; punkty „wstecz” po włączeniu reguły; weryfikacja nie pokazywała, czy zaświadczenie jest z punktami | naprawione (sekcja 6) |
| własne | kolejne numery zaświadczeń pozwalałyby przejrzeć wszystkich uczestników | weryfikacja po losowym kluczu, numer tylko na wydruku |

## 3. Najważniejsze rzeczy, o których nikt wcześniej nie pomyślał

1. **Treść niezatwierdzona.** Zasada „do kursu tylko zatwierdzone” do dziś nie działała (studio filtrowało po starej kolumnie). Po naprawie widać stan: z ptaszkami merytorycznym i językowym jest **2 z 1375 pytań i 5 z 33 wykładów**, zaakceptowanych grafik z plikiem 10. Kurs z punktami na niezatwierdzonej treści jest trudny do obrony. To największe zadanie przed startem szkolenia (decyzja 1).
2. **Lekarze: potrzebna uchwała NRL, nie tylko wpis do rejestru OIL.** Kolejność: uchwała NRL, wpis w izbie właściwej dla siedziby organizatora (500 zł), „informacja o formie kształcenia” co najmniej 30 dni przed startem. Pielęgniarki i położne: wniosek do NRPiP 30 dni przed startem (e-learning najpewniej 1 pkt/h, maks. 30 pkt w okresie). Ratownicy: bez wpisu, ale lista obecności obowiązkowa (jest).
3. **Godzina dla lekarza nie jest zdefiniowana.** 53 godziny po 45 min to 53 pkt albo około 40 pkt, jeśli NRL przyjmie godziny zegarowe. Ustala się we wniosku.
4. **Pula testu za mała.** 50 pytań przy 40 losowanych: 15 pytań wypada w każdym teście, kolejne podejścia dzielą 30–39 pytań. Dwa pytania testu prawie powtarzają pytania ćwiczeniowe (Q-TEST-S1-06 ≈ Q-0072, Q-TEST-S3-06 ≈ Q-0095), a w 18 z 50 poprawna odpowiedź jest najdłuższa. Rekomendacja: pula co najmniej 100.
5. **Źródło przy każdym pytaniu testu** (rozp. 2024/637): ma je 11 z 50. Do uzupełnienia przez autorów.
6. **Pomiar czasu.** Decyzja „aplikacja nie mierzy czasu nauki” kłóci się z rekomendacją prawną (system śledzenia działań wymagany dla e-learningu lekarzy, ocena „zaangażowania” u pielęgniarek). Dziennik zdarzeń jest; czasu nie liczymy (decyzja 3).
7. **Te same błędy co dziś w wykładach są też gdzie indziej.** „Progi ST tylko bez LBBB” zostały w wykładach S3_04, S3_05, S6_01, S6_02, alcie GFX-0440 i 23 pytaniach (w tym 2 testu i 3 nowych Q-INT-06). „Utrata wychwytu” w 16 pytaniach. Niezweryfikowane kryterium patologicznego Q w 8 wykładach, podsumowaniu S2 i pytaniu testu Q-TEST-S2-04 (wypada w każdym teście).
8. **Nazwa producenta** („Medtronic”) w Q-ABCD-S5_03-09, a program deklaruje brak nazw handlowych.
9. **20 pytań „przeciągnij” (w tym 15 nowych z paczki) nie trafi do kursanta:** kurs nie obsługuje kilku elementów w jednym polu (rozszerzenie dd_many).
10. **Grafiki:** 57 pytań czeka na pliki (S8: 30), 89 nowych kart dla linii grafik.
11. **Pytania CEM w S8:** wg audytu prawnego najpewniej materiał urzędowy (bez ochrony prawa autorskiego, pewność średnia; ryciny lepiej odtwarzać, co robimy). Do testu zaliczeniowego się nie nadają i ich tam nie ma.
12. **Kod kursu nie jest na GitHubie** od 10.11 (otwarcie bety, audyt, ceny i całe punkty istnieją tylko na Macu i serwerze).
13. **Studio: `npm run backup:pull` otwiera kopie studia do odczytu dla wszystkich** (`chmod a+rX`) przy każdym uruchomieniu. Kurs ich nie widzi od 10.11, ale skrypt warto poprawić.
14. **Organizator „Cardiomind sp. z o.o.”** nie występuje w KRS pod tą nazwą (sprawdzone 10.11). Na zaświadczeniu muszą być nazwa, adres, KRS i NIP.

## 4. Decyzje JK

1. **Zatwierdzanie treści przed startem szkolenia:** przegląd i ptaszki dla 33 wykładów, pytań ćwiczeniowych modułów, 7 podsumowań, programu i puli testu; do tego czasu szkolenie wyłączone, a beta jedzie na obecnych zasadach („opublikuj wszystko”).
2. **Pula testu:** powiększyć do co najmniej 100 pytań, dopisać źródła, wymienić 2 pytania powtarzające ćwiczenia (zlecić autorom?).
3. **Pomiar czasu:** zostać przy „nie mierzymy” czy logować czas na treści jako dowód (bez blokad).
4. **Poprawki w pozostałych miejscach** (LBBB, „utrata wychwytu”, nazwa producenta): zrobić tak jak dziś w 5 wykładach (migracja, ptaszki zdejmą się same). Kryterium Q: najpierw sprawdzenie w pełnym tekście 5. definicji.
5. **Dane organizatora:** dokładna nazwa spółki z KRS, adres, KRS, NIP; kierownik naukowy (musi być lekarzem); osoba podpisująca; skany podpisów.
6. **Wnioski formalne:** NRL (lekarze), NRPiP (pielęgniarki i położne); liczba punktów dla lekarzy do ustalenia we wniosku.
7. **Teksty do akceptacji:** regulamin szkolenia (`docs/regulamin-szkolenia.md`), dodatek do polityki prywatności, oświadczenie o prawdziwości danych, ankieta.
8. **Płatności:** Stripe (gotowe) czy PayU (przebudowa; pytania do handlowca PayU mogę przygotować).
9. **Wypchnięcie kodu kursu na GitHub** (prywatne repo): zalecam od razu.

## 5. Wdrożenie (po „tak”)

1. Studio: scalenie `punkty-edukacyjne` z `main`, wypchnięcie, `npm run deploy` (migracja schematu 0002, sekcja S8, dokument programu).
2. Studio: kopia bazy, migracje `paczka-1111` i `paczka-1111-b` z `--apply` (na serwerze zwykłym Node), raporty do repo.
3. Kurs: kopia bazy, migracje `2026-11-11-punkty.sql` i `-punkty-2.sql`, nowy kod, `npm ci` (pdfkit, qrcode, czcionka DejaVu).
4. Kurs: eksport ze studia i import (`--all-published` jak dotąd); `szkolenie_wlaczone` zostaje wyłączone do decyzji 1, 5, 6, 7.
5. Sprawdzenie na produkcji: trasy bez konta, kursant testowy, weryfikacja zaświadczenia testowego.

## 6. Przegląd kodu kursu: poprawki (wdrożone na gałęzi, testy zielone)

| Waga | Znalezisko | Naprawa |
|---|---|---|
| wysokie | po oblanym podejściu widać klucz, a kolejne podejście ma prawie te same pytania | po podejściu niezaliczonym tylko wynik i udział poprawnych w modułach; pełny wgląd po zaliczeniu albo po ostatnim podejściu; panel ostrzega, gdy pula < 2 × liczba pytań |
| wysokie | punkty „wstecz” po włączeniu reguły | reguły mają „obowiązuje od/do”; punkty tylko, gdy całe szkolenie mieści się w okresie |
| wysokie | weryfikacja nie pokazywała rodzaju zaświadczenia | strona pokazuje rodzaj, punkty i zawód; zaświadczenie bez sprawdzonego PWZ nie drukuje PWZ; unieważnione z widocznym oznaczeniem |
| średnie | wyścig przy sprawdzaniu PWZ | zapis tylko, gdy dane się nie zmieniły (inaczej komunikat) |
| średnie | ankietę dało się powiązać z osobą w bazie | osobne zapisy; odpowiedzi opisowe w raporcie od 5 ankiet |
| średnie | zaświadczenia z punktami bez danych organizatora | z punktami dopiero po uzupełnieniu danych organizatora i kierownika naukowego |
| średnie | wykład „ukończony” jednym żądaniem | ukończony po otwarciu każdego rozdziału (zapis rozdziałów, bez pomiaru czasu) |
| średnie | usunięcie albo pełny reimport treści kasował postęp szkolenia; zmiana pytania zmieniała ocenę oddanego testu | kopie nazw i kodów w rekordach szkolenia, test oceniany z kopii pytań z chwili losowania; importer nie przenosi do puli testu pytania, które kursanci już ćwiczyli |
| średnie | dziennik gubił, kto sprawdził PWZ, po usunięciu konta admina | zapis e-maila, nazwiska i roli |
| niskie | m.in. moduły szkolenia widoczne mimo wyłączonego szkolenia, zespół mógł zdawać test, admin mógł zatwierdzić własny PWZ, znaki sterujące w nazwiskach, „45 min” u każdego zawodu, klucz weryfikacji w logach | naprawione; filtr logów Caddy sprawdzony (`caddy validate`) |

Wyniki: kurs `npm run check` czysty, 79/79 testów jednostkowych, e2e szkolenia 157/157 (telefon i komputer), regresje 62/62 i 16/16, build czysty; `npm audit` produkcyjny: 0 wysokich i krytycznych (2 średnie, znany edytor pytań w panelu). Studio: 1419/1419 (jeden test wstawki bywa niestabilny pod obciążeniem: przechodzi przy powtórzeniu).

Nowe zależności kursu: `pdfkit`, `qrcode`, `dejavu-fonts-ttf` (czcionka z polskimi znakami do PDF).
