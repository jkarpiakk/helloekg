#!/bin/bash
# Lustro produkcji do testów tylko do odczytu (npm run e2e:obrazy, zgłoszenie JK 11.11):
#   • baza helloekg_kurs_lustro na VPS: schemat produkcji + SAMA TREŚĆ kursu (moduły, tematy, rozdziały,
#     pytania, dokumenty, ustawienia, plany, osiągnięcia, reguły punktów); bez kont, odpowiedzi,
#     zgłoszeń i płatności,
#   • katalog .lustro-assets: kopia /var/lib/helloekg-kurs/assets (pliki /content-assets).
# Produkcja jest tylko czytana (pg_dump, rsync z serwera). Testy zakładają konto tymczasowe w lustrze,
# nigdy w helloekg_kurs.
set -euo pipefail
cd "$(dirname "$0")/.."
LUSTRO=helloekg_kurs_lustro
ROLA=kurs_dev
TRESC="modules sections lecture_chapters questions course_documents app_settings plans achievements cme_rules"

ssh helloekg-studio "LUSTRO=$LUSTRO ROLA=$ROLA TRESC='$TRESC' bash -s" <<'EOF'
set -euo pipefail
cd /tmp
sudo -u postgres dropdb --if-exists "$LUSTRO"
sudo -u postgres createdb -O "$ROLA" "$LUSTRO"
# schemat jako rola podglądu (obiekty należą do niej, podgląd może pisać)
{ echo "SET ROLE $ROLA;"; sudo -u postgres pg_dump --schema-only --no-owner --no-privileges helloekg_kurs; } \
  | sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$LUSTRO" >/dev/null
# treść bez kont: klucze obce do users (autor pytania) wyłączone na czas wczytania
TABS=""; for t in $TRESC; do TABS="$TABS -t public.$t"; done
sudo -u postgres pg_dump --data-only --disable-triggers $TABS helloekg_kurs \
  | sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$LUSTRO" >/dev/null
echo "lustro: $(sudo -u postgres psql -d "$LUSTRO" -Atc "select count(*) from questions where status='published'") opublikowanych pytań, kont: $(sudo -u postgres psql -d "$LUSTRO" -Atc 'select count(*) from users')"
EOF

mkdir -p .lustro-assets
rsync -a --delete --rsync-path="sudo rsync" helloekg-studio:/var/lib/helloekg-kurs/assets/ .lustro-assets/
echo "lustro: $(ls .lustro-assets | wc -l | tr -d ' ') plików w .lustro-assets"
