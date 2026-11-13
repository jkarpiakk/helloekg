# Pełny ekran elementów interaktywnych i przegląd ergonomii (13.11.2026)

Zgłoszenie JK: elementy interaktywne mają się otwierać na cały ekran jak grafiki. Dziś, żeby kliknąć coś na dole, trzeba przewinąć, a potem wracać do kardiomonitora. Za długie elementy przebudować.

## Co było (pomiar na lustrze, wstawka w wyjaśnieniu)

| Ekran | Wysokość wstawek | Mieści się w oknie |
|---|---|---|
| 375×812 (wstawka miała 285 px szerokości) | 1255–2889 px (mapa zawału 2889, elektrody 2371, rozrusznik 2246) | tylko kardiomonitor |
| 1280×800 | 733–1787 px | kardiomonitor i rondo |

W 11 z 13 wstawek sterowanie (programator, wybór tętnicy, faza zawału, suwaki) leżało pod sceną albo nad nią, poza ekranem. To łamało zasadę „sterowanie przy tym, czym steruje”.

W pytaniu z kardiomonitorem na telefonie odpowiedzi były pod monitorem. Na komputerze były widoczne razem.

## Co jest teraz

**Pytanie na pełnym ekranie.** Działa w pytaniach z monitorem w treści, w przypadkach z zapisem i w pytaniach „wskaż na zapisie”. Otwiera się na trzy sposoby: przycisk ⤢ w pasku quizu, przycisk przy monitorze albo dotknięcie zapisu.
- **Telefon:** treść, pod nią monitor przypięty pod paskiem, potem odpowiedzi. „Sprawdź” / „Dalej” są przyklejone do dołu, w strefie kciuka.
- **Komputer i telefon w poziomie:** monitor po lewej, pytanie i odpowiedzi po prawej.
- **Kolejne pytania:** jeśli następne pytanie też ma scenę, pełny ekran zostaje. Jeśli nie ma, widok wraca na stronę.

**Wstawki w wykładzie i w wyjaśnieniu.** Przycisk „Pełny ekran” stoi obok „Dźwięk”. Wszystkie 13 wstawek ma wspólny układ: zakładki, scena i sterowanie.
- **Szeroko:** scena przypięta po lewej, sterowanie po prawej.
- **Telefon:** scena przypięta u góry. Gdzie scena była za wysoka, druga ilustracja schodzi pod nią. Przykłady: w mapie zawału przypięty jest zapis 12 odprowadzeń, a serce jest pod nim. W kompasie osi przypięte jest 6 odprowadzeń, a koło jest pod nimi.
- **Ćwiczenie „Sprawdź się”:** scena zostaje w tym samym miejscu (mapa zawału, pomiary, potas). Pod polecenie przechodzą tylko odpowiedzi.

**Ruch (Apple, „Designing Fluid Interfaces”):**
- Widok wyrasta ze sceny: scena leci z miejsca na stronie, a reszta odsłania się od jej prostokąta.
- Sprężyna ma damping 1 i response 0,42 s. Zamykanie idzie tą samą drogą wstecz i można je przerwać w połowie.
- Esc zamyka. Po zamknięciu strona jest przewinięta tam, gdzie była, a fokus wraca na przycisk.
- Przy „Ogranicz ruch” zostaje samo przenikanie. Przy „Ogranicz przezroczystość” paski są pełne, bez rozmycia.

**Wynik na lustrze:**

| Co | Wynik |
|---|---|
| Wstawki | 13 × 3 ekrany (375×812, 812×375, 1280×800): scena przypięta i mieści się w oknie. Nic nie wystaje w poziomie. Esc zamyka. |
| Pytania | 3 rodzaje × 3 ekrany: scena przypięta, „Dalej” widoczny bez przewijania, pełny ekran zostaje przy kolejnym pytaniu z monitorem, przewinięcie strony wraca. |
| Przodkowie widoku | Żaden nie ma transformacji, która psułaby `position: fixed`. |
| Wykład | Pełny ekran działa (375 i 1280). Otwarcie, zamknięcie i przewinięcie OK. |

## Przebudowy przy okazji

- **Kardiomonitor na wąskim ekranie** jest niższy o ok. 40 px:
  - zegar chowa się poniżej 480 px szerokości,
  - „Dźwięk” stoi w linii skali,
  - HR ma 34 px zamiast 44 px.
- **Pytanie na pełnym ekranie:** treść ma rozmiar tekstu czytanego, a nie tytułu. Na telefonie zajmuje o połowę mniej miejsca.
- **NZK:** poprawiony błąd. Wybór „VT bez tętna, wielokształtny” rzucał wyjątek na początku zapisu (ujemny indeks).

## Co zostaje do decyzji albo na później

1. **Przeciąganie na telefonie przy długiej puli.** Pula jest nad polami. Przy 6 kartach i 3 grupach przeciąganie z góry na dół wymaga automatycznego przewijania. Działa też dotknięcie karty, a potem grupy, i jest podpowiedziane. Propozycja: przypięta pula na telefonie. Zrobię, jeśli chcesz.
2. **Pełny ekran nie więzi klawisza Tab.** Klawiatura może przejść do strony pod spodem. Czytnik ekranu dostaje `aria-modal`. Pułapkę fokusu można dodać.
3. **Monitor na stronie, wąski ekran:** pasek monitora łamie się na 3 linie przy szerokości karty 295 px. Na pełnym ekranie są 2.
4. **Pomiary, ćwiczenie:** przełączniki PQ/QRS/QT/RR zostały nad papierem, bo tak mówi polecenie („przyciskami nad papierem”). Przez to scena ma 408 px i nadal mieści się w progu przypięcia (55% ekranu). Przeniesienie ich pod papier wymaga zmiany tekstu polecenia w studiu.
