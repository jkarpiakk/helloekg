# Kurs pod punkty edukacyjne: rozpoznanie i plan (11.11.2026)

Prompt: „kurs helloEKG pod punkty edukacyjne”. Zasada 1: najpierw rozpoznanie i plan, kod po „tak” JK.
Na końcu: rozstrzygnięcia wątpliwości z paczki treści 11.11 (polecenie JK „napraw wszystkie wątpliwości”).

## 1. Rozpoznanie: co jest, czego brak

| Obszar | Jest dziś | Brakuje |
|---|---|---|
| Konto | rejestracja (imię, e-mail, hasło, zgody), kolumny `profession` i `pwz_number` puste, zmiana hasła, usunięcie konta | nazwisko, zawód, PWZ, oświadczenie, blokada danych po zaświadczeniu, edycja przez admina z dziennikiem |
| Moduły | 7 modułów (S1…S7) z wykładami (rozdziały) i pytaniami; S7 na 4. pozycji | podsumowanie, bibliografia, program szkolenia, kontakt z prowadzącym |
| Czytanie wykładów | `lecture_reads`: tylko ostatnio otwarty rozdział, nadpisywany | trwały znacznik „wykład przeczytany” z datą |
| Dziennik | `audit_log` (logowania, zmiany kont, płatności), bez podglądu w panelu | zdarzenia szkolenia (zapis, wykłady, moduły, test, ankieta, zaświadczenie), lista obecności CSV |
| Test | egzamin próbny (10/20/40 pytań ze wszystkich, wynik kasowany po 24 h) | osobna pula testu, losowanie z proporcjami, próg, podejścia i przerwa, trwały zapis podejść |
| Pytania | ABCD dowolnej liczby odpowiedzi (E wyświetla się), kurs zawsze tasuje odpowiedzi | „nie tasuj”, skróty klawiszowe dla E, pula „test” poza ćwiczeniami |
| Zaświadczenie | certyfikat ukończenia (arkusz A4 drukowany z przeglądarki, losowy numer, jeden na konto, bez weryfikacji od 27.10) | PDF z serwera, PWZ, punkty wg zawodu, godziny, organizator, kolejny numer, QR i strona weryfikacji, kopia reguły z chwili wydania |
| Ankieta | brak | ankieta anonimowa (tabela bez user_id), raport zbiorczy |
| Usunięcie konta | kasuje kaskadowo odpowiedzi, postęp i certyfikat | rejestr uczestnictwa zostaje 5 lat (osobne tabele bez kaskady) |
| Studio | kontrakt bez limitu odpowiedzi, odtwarzacz zawsze tasuje, sekcje S1–S7 zakodowane, ptaszki na wykładach i pytaniach | „nie tasuj”, pula testu z filtrem, S8, podsumowania/bibliografie/program z ptaszkami |
| **Studio: eksport „tylko zatwierdzone”** | **nie działa**: filtr patrzy na starą kolumnę `status`, której od ptaszków nie da się ustawić; kurs importuje wszystko (`--all-published`) | eksport po ptaszkach (oba aktualne + grafiki zaakceptowane); import wykładów i JSON-ów musi zdejmować ptaszki przy zmianie treści |
| Testy | kurs: e2e Playwright, brak testów jednostkowych; studio: vitest (~590 testów) | vitest w kursie dla logiki szkolenia |

## 2. Plan

### A. Studio (create.helloekg.pl)
1. **Pytania:** kolumny `bez_tasowania`, `pula` (`cwiczenia` | `test`), `wyklucza_json`. Przełączniki w metryczce edytora, filtr „Pula: test” na liście pytań, litery A–E w podglądzie „jak kursant”. Odtwarzacz nie tasuje pytań z „nie tasuj”.
2. **Sekcja S8 „EKG na LEK”** jako ósma sekcja (kontrakt i kody wykładów S1–S8). Poza ścieżką szkolenia z punktami: nie liczy się do ukończenia modułów ani do testu.
3. **Moduły:** pola `podsumowanie_md` i `bibliografia_md` w sekcjach, **Program szkolenia** jako jeden dokument. Edytor jak wykłady, historia wersji, ptaszki merytoryczny i językowy. Treść startowa z `MODULY.md` (migracja jako szkic).
4. **Eksport „tylko zatwierdzone” naprawiony** na ptaszkach; import wykładów i pytań z pliku zdejmuje ptaszki przy zmianie treści (dziś tego nie robi). Eksport niesie nowe pola: pula, „nie tasuj”, wyklucza, podsumowania, bibliografie, program.

### B. Kurs (kurs.helloekg.pl)
1. **Import:** nowe pola z eksportu; pytania puli testu nigdy nie trafiają do nauki, powtórek, egzaminu próbnego, statystyk ani warunku opanowania.
2. **Zapis na szkolenie** („Chcę zaświadczenie z punktami”): zawód (lekarz, lekarz dentysta, pielęgniarka, położna, ratownik medyczny, student, inny; kilka naraz), PWZ z walidacją, specjalizacja (lekarze), imię i nazwisko zgodne z PWZ, oświadczenie z datą. Po pierwszym zaświadczeniu dane zablokowane; zmiana tylko przez JK w panelu, z wpisem w dzienniku.
   - Walidacja PWZ: lekarz i lekarz dentysta 7 cyfr z cyfrą kontrolną (sprawdzę algorytm na prawdziwych numerach, zanim zrobię z niego twardą regułę). Pielęgniarka, położna, ratownik: formatu nie ma w przepisach, które znalazłem. Propozycja: 7 znaków, cyfry i opcjonalna litera P/A na końcu, ratownik: cyfry; ostrzeżenie zamiast blokady.
3. **Dziennik szkolenia** (osobna tabela, bez kaskady): zapis, otwarcie i ukończenie wykładu (ukończenie = dojście do ostatniego rozdziału), ukończenie modułu, otwarcie podsumowania, start i oddanie testu (wynik), ankieta wypełniona, zaświadczenie wydane. Data i godzina UTC, w raporcie strefa PL. Bez pomiaru czasu.
4. **Moduł ukończony** = wszystkie wykłady przeczytane + podsumowanie otwarte. Ćwiczenia: przełącznik w konfiguracji (patrz decyzja 1).
5. **Test zaliczeniowy:** po 7 modułach; losowanie 40 z 50 proporcjonalnie do sekcji, minimum 1 pytanie z każdego wykładu, z regułą „wyklucza”; pytania i odpowiedzi tasowane (poza „nie tasuj”); ocena na serwerze po identyfikatorze odpowiedzi; bez podpowiedzi; po oddaniu wynik i uzasadnienia tylko do błędnych. 3 podejścia, 24 h przerwy po drugim niezaliczonym, każde podejście nowy zestaw. Liczby w konfiguracji.
6. **Ankieta anonimowa** po zaliczeniu, przed zaświadczeniem (tabela bez user_id, w dzienniku tylko „ankieta wypełniona”); pytania z promptu, edytowalne w konfiguracji; raport zbiorczy w panelu.
7. **Zaświadczenie PDF** generowane na serwerze: dane z promptu, kolejny numer (np. `HE-2026-000001`), QR i strona `/zaswiadczenie/<numer>` (ważność + inicjały). Zapisuje kopię reguły i danych z chwili wydania. **Tabela reguł per zawód** w panelu z wartościami startowymi z promptu (lekarz nieaktywny do wpisu OIL, ratownik maks. 10 pkt / min. 4 h, pielęgniarka i położna nieaktywne do decyzji NRPiP, student i inny bez punktów). Reguła nieaktywna = zaświadczenie ukończenia bez punktów z jasnym komunikatem.
8. **W module:** podsumowanie, bibliografia, „Napisz do prowadzącego” (mail do JK + zakładka w panelu). Strony „Program szkolenia” i „Regulamin szkolenia” (szkic `docs/regulamin-szkolenia.md` z polami do uzupełnienia). Zero CTA sprzedażowych w modułach, teście, ankiecie i na zaświadczeniu (test e2e).
9. **Panel admina:** lista obecności CSV, edycja danych zawodowych z dziennikiem, reguły punktów, ustawienia testu i ankiety, raport ankiety.
10. **Przechowywanie 5 lat** po usunięciu konta: dziennik, zgłoszenie na szkolenie i zaświadczenia zostają (dane do listy obecności). Tekst do polityki prywatności (do akceptacji JK).

### C. Testy i wdrożenie
- vitest w kursie: losowanie (proporcje, min. 1 na wykład, tylko pula), ocena, podejścia i przerwa, anonimowość ankiety, numeracja i weryfikacja, reguły punktów. Studio: testy nowych pól i eksportu po ptaszkach.
- e2e 375 i 1280 px na koncie testowym: zapis z PWZ testowym → moduły (skrót testowy tylko poza produkcją) → test → ankieta → PDF → weryfikacja; test braku CTA.
- Kolejność wdrożenia: studio (A) → import paczki → kurs (B) na kopii bazy → produkcja po „tak”. Kopie baz przed każdą migracją.

## 3. Decyzje JK (w nawiasie domyślna, jeśli nie napiszesz inaczej)

1. **Liczba godzin i ćwiczenia** (wariant B, 53 h, ćwiczenia **wymagane** do ukończenia modułu). Opis paczki: B jest łatwiejszy do obrony, ale wymaga ćwiczeń jako warunku; prompt zakłada „zalecane”. Przełącznik w konfiguracji tak czy inaczej.
2. **Jeden kurs** (tak, jak w decyzji z 10.11): ratownik dostaje maks. 10 pkt.
3. **Próg i liczba pytań** (70%, 40 z 50, 3 podejścia, 24 h przerwy).
4. **Publiczna weryfikacja zaświadczeń** (tak: strona z numerem, ważnością i inicjałami). 27.10 zdecydowałeś „bez publicznej weryfikacji” dla certyfikatu ukończenia; przy punktach jest potrzebna. Dotychczasowy certyfikat ukończenia zostaje bez zmian.
5. **Organizator na zaświadczeniu:** Cardiomind sp. z o.o. z KRS i NIP (czekam na dane), kierownik naukowy (Ty?), adres do reklamacji.
6. **S8 „EKG na LEK”** (poza szkoleniem z punktami, osobny moduł dodatkowy w kursie).

**Formalnie po stronie JK:** wpis organizatora do rejestru OIL (bez tego lekarze dostają zaświadczenie bez punktów), decyzja NRPiP dla pielęgniarek i położnych, akceptacja: regulaminu szkolenia, zmian w polityce prywatności (5 lat), treści oświadczenia o prawdziwości danych i ankiety.

## 4. Paczka 11.11: rozstrzygnięcia wątpliwości (polecenie JK)

| Wątpliwość | Rozstrzygnięcie |
|---|---|
| S8 i „nie tasuj” bez dokumentu z 14.10 | robię sam w ramach A1–A2 (ten sam mechanizm dla testu i S8) |
| PSY 145 (też tag DUPLIKAT) | zostaje; pomijam PSY2 38 jako duplikat |
| RODZ2 67 „wadliwe w źródle” | zostaje jako szkic z tagiem i notatką do „Stanu wytycznych” (rekomendacja recenzji); bliźniak zostaje |
| RAT2 24 (C i E identyczne w PDF) | wstrzymane razem z bliźniakiem |
| RODZ 63 (bez rozumowania z EKG) | pominięte razem z bliźniakiem |
| INT 183 bez karty grafiki | nowa karta z opisu w `RYCINY_CEM.md`, flaga „rycina CEM do odtworzenia” |
| Q-IC-12: zaproszenie 169 znaków | skracam do 160 bez zmiany sensu; stary i nowy tekst w raporcie |
| `wymaga_grafiki` niezgodne z grafiką (13 pytań S8) | ustawiam wg obecności grafiki |
| Tagi dziedzin S8 różna wielkość liter | ujednolicam (wielka litera na początku) |
| GFX-0289, 0303, 0304 zdradzają odpowiedź w tytule | neutralne tytuły z propozycji recenzji (zmiana w rejestrze z historią) |
| BL-RAT-86 używa GFX-0019 bez pliku | zostaje, karta na liście dla linii grafik |
| Wykłady: „utrata wychwytu” → „brak wychwytu” (S5_03, S5_04, alt GFX-0477), „progi ST bez LBBB” (S2_04, S3_03, S6_05), zdanie ERC 2025 (S6_05) | poprawiam jako migrację z raportem różnic; ptaszki tych wykładów zdejmą się same, wrócą po Twoim przejrzeniu |
| Kryterium patologicznego Q (S2_03, S3_04) | nie ruszam: wymaga sprawdzenia w pełnym tekście 5. definicji zawału; zostaje na liście |
| Klucze CEM niepewne (RAT 102, RAT 149 „klucz sporny”, INT 7, INT 24, PSY 54) | import jako szkic z notatkami; rozstrzygasz przy ptaszkach |
| Pula testu (50 pytań) | importuję po A1 (flaga „pula: test”), nigdy do ćwiczeń |

Wszystko w trybie próbnym na kopii bazy; zapis na produkcji (studio i kurs) po jednym „tak”.
