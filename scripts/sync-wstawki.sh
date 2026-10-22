#!/bin/bash
# Kopia wstawek interaktywnych ze studia (web/src/wstawki) do kursu — kod bez zmian.
# '@helloekg/shared' wskazuje w kursie na client/src/wstawki-shared.ts = wierna kopia shared/src/directives.ts
# ze studia (plik bez zależności: parser dyrektyw, lista wstawek, domyślne zaproszenia).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${STUDIO:-$HOME/Projects/helloekg-studio}/web/src/wstawki"
DST=client/src/wstawki
rsync -a --delete --exclude dev.ts --exclude '*.test.ts' "$SRC/" "$DST/"
cp "${STUDIO:-$HOME/Projects/helloekg-studio}/shared/src/directives.ts" client/src/wstawki-shared.ts
( cd "${STUDIO:-$HOME/Projects/helloekg-studio}" && git rev-parse --short HEAD ) > "$DST/.wersja-studia"
echo "Wstawki skopiowane ze studia ($(cat $DST/.wersja-studia))."
