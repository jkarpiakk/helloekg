/**
 * Karta wartości wstawki: każda liczba, próg i nazwa pokazywane kursantowi muszą mieć źródło
 * w tekście wykładu. Test `web/test/wstawki/cytaty.test.ts` sprawdza, że każdy `cytat` występuje
 * dosłownie (po zdjęciu pogrubień i ujednoliceniu odstępów) w podanym wykładzie.
 *
 * Plik bez DOM — importuje go test w środowisku node.
 */

export interface Zrodlo {
  /** Co wstawka pokazuje, np. „PQ w Wenckebachu: 0,16 / 0,28 / 0,36 s”. */
  wartosc: string;
  /** Kod wykładu, np. „S4_02”. */
  wyklad: string;
  /** Tytuł planszy (nagłówek `## `), w której stoi cytat. */
  plansza: string;
  /** Fragment tekstu wykładu, dosłownie. Wystarczy jedno zdanie albo jego część. */
  cytat: string;
}

export interface Karta {
  id: string;
  /** Wykłady i plansze, w których wstawka może stanąć. */
  miejsca: Array<{ wyklad: string; plansza: string }>;
  zrodla: Zrodlo[];
  /** Morfologie, których silnik dotąd nie rysował — wymagają oka JK przed publikacją. */
  noweMorfologie: string[];
  /** Co jeszcze wymaga oka kardiologa (uproszczenia modelu, decyzje dydaktyczne). */
  doOkaJK: string[];
  /** Stan pokazywany przy „Ogranicz ruch” i jako punkt startu. */
  stanKanoniczny: string;
}
