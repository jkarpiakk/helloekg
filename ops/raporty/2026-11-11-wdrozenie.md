# Wdrożenie 11.11.2026 (po audycie całości, decyzje JK z 11.11)

Decyzje JK: beta działa na treści niezatwierdzonej (przegląd równolegle), pula testu bez zmian, pomiar czasu później jako opcja,
poprawki terminologii wprowadzić, organizator Cardiomind sp. z o.o. (dane później, szkolenie z punktami to osobne zadanie),
dokumenty szkolenia do akceptacji przy starcie pełnej wersji, płatności: raczej PayU (przygotowanie w poniedziałek).

## Studio (create.helloekg.pl)
- `main` = gałąź `punkty-edukacyjne`, wypchnięte; `npm run deploy` (znacznik deploy-20261111-1455): migracja schematu 0002 (pula, nie tasuj, wyklucza, S8, teksty modułów, program).
- Kopia bazy przed migracjami treści: `/var/lib/helloekg-studio/db/studio.przed-paczka-1111-20261111-1455.sqlite`.
- Migracje treści (zwykły Node, każda z kontrolną powtórką bez zmian): `paczka-1111` (88 kart grafik, 102 pytania), `paczka-1111-b` (192 pytania S8, 50 pytań testu, 7 modułów i program, 5 wykładów, 4 grafiki, Q-IC-12), `poprawki-1111` (4 wykłady, 35 pytań: progi ST bez bloku odnogi, brak wychwytu, bez nazwy producenta; notatka GFX-0440). Raporty: studio `ops/raporty/2026-11-11-*-zastosowana.md`.
- Stan: 1375 pytań (pula testu 50, S8 192), karty grafik do GFX-0635.

## Kurs (kurs.helloekg.pl)
- Kopie: baza `/var/backups/helloekg-kurs/kurs-przed-punkty-20261111-1456.dump` i `kurs-przed-import-1111-*.dump`, kod `/opt/helloekg-kurs/dist.przed-punkty-20261111-1456`, `package*.json.przed-punkty-20261111-1456`, Caddy `/root/kurs.caddy.przed-punkty-20261111-1456`.
- Migracje `2026-11-11-punkty.sql` i `-punkty-2.sql` (dodające), nowy kod (gałąź `deploy/kurs-beta` = `punkty-edukacyjne`, wypchnięte), `npm ci --omit=dev` (pdfkit, qrcode, DejaVu), Caddy z filtrem klucza weryfikacji (`caddy validate` OK).
- Import ze studia (eksport v0.2, `--all-published` jak dotąd): +1 moduł (S8), +344 pytania, 1031 zaktualizowane, 1164 opublikowane, 211 szkiców (głównie bez plików grafik); przeliczenie postępów.
- **Szkolenie z punktami wyłączone** (`szkolenie_wlaczone` nieustawione = wyłączone). Regulamin szkolenia nieopublikowany.

## Sprawdzenie na produkcji
- Bez konta: API zamknięte 33/33, grafiki 420/420, nowe trasy szkolenia 28/28 → 401; regulamin szkolenia 404 (nieopublikowany), weryfikacja nieznanego klucza 404, skrót testowy 404.
- Konfiguracja publiczna bez zmian: rejestracja otwarta, dokumenty opublikowane, płatności wyłączone.

## Wycofanie
- Kurs: `dist`, `package*.json` z kopii, `sudo -u kurs npm ci --omit=dev`, `kurs.caddy` z `/root`, restart; migracje są dodające (zostają). Treść: `pg_restore` z `kurs-przed-import-1111-*.dump` tylko w razie potrzeby.
- Studio: baza z kopii `studio.przed-paczka-1111-*` (zatrzymać usługę), kod z poprzedniego znacznika deploy.
