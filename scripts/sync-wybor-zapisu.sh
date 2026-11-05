#!/bin/bash
# Kopia „Wybierz zapis” (image_choice) ze studia — kod bez zmian, ten sam komponent i ta sama logika:
#   studio shared/src/wyborZapisu.ts   → shared/wyborZapisu.ts (ocena, losowanie, alt; serwer i klient)
#   studio web/src/wybor-zapisu/       → client/src/components/quiz/wybor-zapisu/ (karty)
# Nie kopiuje się zrodlo.ts: w kursie wskazuje na @shared/wyborZapisu, w studiu na @helloekg/shared.
set -euo pipefail
cd "$(dirname "$0")/.."
STUDIO="${STUDIO:-$HOME/Projects/helloekg-studio}"
DST=client/src/components/quiz/wybor-zapisu
mkdir -p "$DST"
rsync -a --delete --exclude zrodlo.ts --exclude '*.test.ts' "$STUDIO/web/src/wybor-zapisu/" "$DST/"
cp "$STUDIO/shared/src/wyborZapisu.ts" shared/wyborZapisu.ts
( cd "$STUDIO" && git rev-parse --short HEAD ) > "$DST/.wersja-studia"
echo "Wybierz zapis skopiowane ze studia ($(cat $DST/.wersja-studia))."
