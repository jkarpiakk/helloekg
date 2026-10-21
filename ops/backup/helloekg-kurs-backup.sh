#!/usr/bin/env bash
# Nocna kopia bazy kursu (kurs.helloekg.pl): pg_dump w formacie custom + przesłane pliki. Retencja 14 dni.
# Odtworzenie: pg_restore --clean --if-exists -d helloekg_kurs db-YYYY-MM-DD.dump
set -euo pipefail
DEST=/var/backups/helloekg-kurs
STAMP=$(date +%F)
mkdir -p "$DEST"
sudo -u postgres pg_dump -Fc helloekg_kurs > "$DEST/db-$STAMP.dump.tmp"
mv "$DEST/db-$STAMP.dump.tmp" "$DEST/db-$STAMP.dump"
if [ -d /var/lib/helloekg-kurs/assets ]; then
  mkdir -p "$DEST/assets"
  rsync -a --delete /var/lib/helloekg-kurs/assets/ "$DEST/assets/"
fi
find "$DEST" -maxdepth 1 -name 'db-*.dump' -mtime +14 -delete
chmod -R go-rwx "$DEST"
echo "Kopia kursu z $STAMP gotowa."
