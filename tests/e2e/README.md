# Testy E2E kursu (Playwright)

Uruchamiane na lokalnym podglądzie (`scripts/preview.sh`, port 5055, baza `helloekg_kurs_dev`, konto z `scripts/preview-seed.md`).
Playwright nie jest zależnością projektu, żeby nie obciążać instalacji na serwerze:

    mkdir -p /tmp/e2e && cd /tmp/e2e && npm i playwright@1.61.0 @axe-core/playwright@4.10.2
    NODE_PATH=/tmp/e2e/node_modules node tests/e2e/wstawki-wyklady-pytania.cjs

- `wstawki-wyklady-pytania.cjs`: wstawki w wykładach (S1_00 pl.8, S2_02 pl.1 i pl.3), monitor w treści pytania Q-INT (nie zdradza rozpoznania), telefon i komputer.
- `dzwiek.cjs`: dźwięk wstawek (domyślnie cisza, przełącznik pamiętany między wykładami, droga impulsu, cyrkiel w pomiarach, monitor w pytaniu: ton QRS bez alarmu), telefon i komputer. Przechwytuje Web Audio w przeglądarce testowej.

Dawny pełny zestaw (`ux.js`, 43/38 kroków) żył w katalogu tymczasowym sesji i zginął przy czyszczeniu systemu 27.10; do odtworzenia tutaj.
- `luki.cjs`: pytania „Uzupełnij luki” (Q-0044, Q-0034 i po jednym z każdej sekcji): pole w miejscu znacznika `{{blank:id}}`, tekst nierozcięty, „Poprawnie” przy swojej luce, „0,3” i „0.3” uznane; `BASE`/`DB` zmieniają adres i bazę.
- `certyfikat.cjs`: postęp „X z Y tematów” w Postępie, formularz imienia i nazwiska po opanowaniu wszystkich tematów (walidacja), odbiór, arkusz z nazwiskiem, druk na 1 stronie A4. Zakłada i kasuje konto tymczasowe. Po zmianie kodu serwera zrestartuj podgląd (serwer nie przeładowuje się sam).
