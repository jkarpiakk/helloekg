#!/bin/bash
# Lokalny podgląd aplikacji na kopii bazy z VPS (helloekg_kurs_dev) przez tunel SSH.
# Dane dostępowe w .env.preview (poza gitem). Konta testowe: patrz scripts/preview-seed.md
set -e
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
lsof -i :15432 >/dev/null 2>&1 || ssh -f -N -o ExitOnForwardFailure=yes -L 15432:127.0.0.1:5432 helloekg-studio
set -a; . ./.env.preview; set +a
export NODE_ENV=development
export CONTENT_ASSETS_DIR="$PWD/.preview-assets"
exec npx tsx server/index.ts
