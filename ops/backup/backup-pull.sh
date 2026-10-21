#!/usr/bin/env bash
# Ściąga kopię bazy kursu z serwera na Maca — kopia poza serwerem (launchd: pl.helloekg.kurs-backup-pull, 9:05).
set -euo pipefail
HOST=${HOST:-helloekg-studio}
DEST=${DEST:-$HOME/Backups/helloekg-kurs}
mkdir -p "$DEST"
ssh "$HOST" 'sudo /usr/local/bin/helloekg-kurs-backup.sh >/dev/null && sudo tar -C /var/backups -cf - helloekg-kurs' | tar -C "$(dirname "$DEST")" -xf -
chmod -R go-rwx "$DEST"
echo "Kopia kursu w $DEST"; ls -lh "$DEST" | tail -3
