#!/bin/bash
# Synchronizacja studio → kurs (npm run sync:studio). Kroki jak dotąd ręcznie, plus strażnik obrazów (12.11):
#   1. eksport ze studia (buildExport jako użytkownik studio): pytania bez obrazu studio zatrzymuje
#      i wypisuje w raport-eksportu.md,
#   2. kopia bazy kursu (/var/backups/helloekg-kurs/kurs-przed-sync-<czas>.dump),
#   3. nowe pliki do /var/lib/helloekg-kurs/assets (--ignore-existing),
#   4. import --all-published + kontrola obrazów po imporcie (kod 3 = opublikowane pytanie bez pliku),
#   5. przeliczenie postępu,
#   6. npm run e2e:obrazy na lustrze produkcji (API + widok kursanta 375/1280).
# Kod wyjścia ≠ 0, gdy import albo test obrazów nie przeszedł.
#   --proba     tylko import --dry-run (bez kopii, plików, przeliczenia i testu)
#   --bez-e2e   bez kroku 6 (np. gdy Playwright nie jest zainstalowany; wtedy uruchom go osobno)
set -uo pipefail
cd "$(dirname "$0")/.."
PROBA=0; E2E=1
for a in "$@"; do case "$a" in --proba) PROBA=1 ;; --bez-e2e) E2E=0 ;; *) echo "nieznana opcja $a"; exit 2 ;; esac; done
CZAS=$(date +%Y%m%d-%H%M%S)

ssh helloekg-studio "CZAS=$CZAS PROBA=$PROBA bash -s" <<'EOF'
set -uo pipefail
cd /tmp
K=/var/tmp/eksport-$CZAS
Z=/tmp/eksport-$CZAS.zip
sudo -u studio bash -c "set -a; . /etc/helloekg-studio.env; set +a; cd /opt/helloekg-studio/server && node --input-type=module -e \"import {buildExport} from './dist/services/export.js'; import fs from 'node:fs'; import {pipeline} from 'node:stream/promises'; await pipeline(buildExport(false), fs.createWriteStream('$Z'));\"" \
  || { echo "BŁĄD: eksport ze studia"; exit 2; }
sudo mkdir -p "$K" && sudo python3 -m zipfile -e "$Z" "$K" && sudo chown -R kurs:kurs "$K" || { echo "BŁĄD: rozpakowanie"; exit 2; }
echo "== Raport eksportu"; sudo cat "$K/raport-eksportu.md" 2>/dev/null || echo "(paczka bez raportu: starsze studio)"
URUCHOM="sudo systemd-run --quiet --uid=kurs --gid=kurs -p EnvironmentFile=/etc/helloekg-kurs.env -p WorkingDirectory=/opt/helloekg-kurs --wait --pipe /usr/bin/node"
if [ "$PROBA" = 1 ]; then
  $URUCHOM dist/import-studio.js "$K" --all-published --dry-run; KOD=$?
else
  sudo -u postgres pg_dump -Fc helloekg_kurs -f "/var/backups/helloekg-kurs/kurs-przed-sync-$CZAS.dump" || { echo "BŁĄD: kopia bazy"; exit 2; }
  echo "kopia: /var/backups/helloekg-kurs/kurs-przed-sync-$CZAS.dump"
  sudo rsync -a --ignore-existing "$K/assets/" /var/lib/helloekg-kurs/assets/ && sudo chown -R kurs:kurs /var/lib/helloekg-kurs/assets
  echo "== Import"
  $URUCHOM dist/import-studio.js "$K" --all-published; KOD=$?
  $URUCHOM dist/recompute-progress.js | tail -1
fi
sudo rm -rf "$K" "$Z"
exit $KOD
EOF
IMPORT=$?
case $IMPORT in
  0) echo "import: OK" ;;
  3) echo "import: zapisany, ale KONTROLA OBRAZÓW wykazała opublikowane pytania bez pliku (lista wyżej)" ;;
  *) echo "import: BŁĄD (kod $IMPORT)"; exit $IMPORT ;;
esac
[ $PROBA = 1 ] && exit $IMPORT

E2E_KOD=0
if [ $E2E = 1 ]; then
  echo "== Test obrazów (npm run e2e:obrazy)"
  bash scripts/e2e-obrazy.sh; E2E_KOD=$?
  [ $E2E_KOD = 0 ] || echo "SYNCHRONIZACJA: test obrazów NIE przeszedł (kod $E2E_KOD), raport w ops/raporty/"
fi
[ $IMPORT = 0 ] && [ $E2E_KOD = 0 ] && echo "SYNCHRONIZACJA: OK" || exit 1
