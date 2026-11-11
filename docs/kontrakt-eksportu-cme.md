# Kontrakt eksportu studio → kurs: rozszerzenia CME (11.11.2026)

Uzgodnienie między studiem (`~/Projects/helloekg-studio`, `server/src/services/export.ts`) a importerem kursu
(`server/scripts/importStudioExport.ts`). Pola nieobecne w starszych paczkach = wartości domyślne.

## questions.json (każde pytanie)
| Pole | Typ | Domyślnie | Znaczenie |
|---|---|---|---|
| `pula` | `"cwiczenia" \| "test"` | `"cwiczenia"` | `test` = pytanie testu zaliczeniowego: nigdy w nauce, powtórce, egzaminie próbnym, statystykach ani warunku opanowania |
| `bezTasowania` | boolean | false | odpowiedzi pytania zamkniętego w zapisanej kolejności (także w teście) |
| `wyklucza` | string[] (externalId pytań) | [] | w jednym losowaniu testu nie mogą wystąpić razem |
| `explanationMdApp` | string (opcjonalnie) | brak | tylko dla wyjaśnień z ramkami: ramki (`:::zasada`, `:::rada`…) i „przypomnij” przetłumaczone jak w wykładach; linie `::wstawka`, `::ekg` i `::grafika` zostają bez zmian (kurs obsługuje je sam). Kurs używa go zamiast `explanationMd`, gdy jest |

## sections.json (każda sekcja)
| Pole | Typ | Znaczenie |
|---|---|---|
| `podsumowanieMd` | string \| null | podsumowanie modułu (Markdown, dyrektywy jak w wykładach); null, gdy puste albo (w trybie tylko zatwierdzone) niezatwierdzone |
| `bibliografiaMd` | string \| null | bibliografia modułu |
| `podsumowanieMdApp`, `bibliografiaMdApp` | string \| null | te same teksty przetłumaczone dla kursu (`toAppMarkdown`, jak `contentMdApp` wykładów); kurs używa ich w pierwszej kolejności |
| `szkolenie` | boolean | czy moduł wchodzi do szkolenia z punktami (S1–S7 tak, S8 nie) |

## program.json (nowy plik, opcjonalny)
`{ "programMd": string | null, "programMdApp": string | null, "wersja": number }` (`programMdApp` jak wyżej). Program szkolenia (tytuł, cel, adresaci, moduły, efekty, warunki zaliczenia, godziny).

## Sekcja S8
Kod `S8`, tytuł „EKG na LEK”, `order` 8, `szkolenie: false`. Wykłady S8 (jeśli powstaną) mają kody `S8_NN`.

## manifest.json
`contractVersion: "studio-v0.2"` (było `studio-v0.1`).
