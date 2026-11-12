# Jednorazowy przegląd obrazów pytań (2026-11-12, przed wdrożeniem strażnika)

Lustro produkcji `helloekg_kurs_lustro`, aplikacja `http://localhost:5068` (dist, tryb produkcyjny), czas 59 s.

- Opublikowane pytania: 1191, z obrazem: 170 (obrazów: 206).
- API jako kursant: 170 pytań, pula testu sprawdzona z bazy (0); plików: 166.
- Widok kursanta (375 i 1280 px): 10 pytań, typy: clinical_case, multiple_choice, fill_blank, image_choice, drag_drop, hotspot, matching, sorting.
- **Pytania z obrazem przypisanym, które dziś pokazują się bez obrazu: 0.**

## Widok kursanta

| Pytanie | Typ | Widok | Wynik |
|---|---|---|---|
| Q-0040 | clinical_case | 375 | ok |
| Q-0053 | multiple_choice | 375 | ok |
| Q-0080 | fill_blank | 375 | ok |
| Q-IC-01 | image_choice | 375 | ok |
| Q-INT-00-DD-01 | drag_drop | 375 | ok |
| Q-INT-00-HS-01 | hotspot | 375 | ok |
| Q-INT-00-MA-01 | matching | 375 | ok |
| Q-INT-00-SO-01 | sorting | 375 | ok |
| Q-0063 | clinical_case | 375 | ok |
| Q-INT-00-HS-02 | hotspot | 375 | ok |
| Q-0040 | clinical_case | 1280 | ok |
| Q-0053 | multiple_choice | 1280 | ok |
| Q-0080 | fill_blank | 1280 | ok |
| Q-IC-01 | image_choice | 1280 | ok |
| Q-INT-00-DD-01 | drag_drop | 1280 | ok |
| Q-INT-00-HS-01 | hotspot | 1280 | ok |
| Q-INT-00-MA-01 | matching | 1280 | ok |
| Q-INT-00-SO-01 | sorting | 1280 | ok |
| Q-0063 | clinical_case | 1280 | ok |
| Q-INT-00-HS-02 | hotspot | 1280 | ok |
| Q-0040 | clinical_case | 1280, plik 404 | ok |
| Q-0053 | multiple_choice | 1280, plik 404 | ok |
| Q-0040 | clinical_case | API zgłoszenia (zapis, powtórka, śmieci) | ok |
