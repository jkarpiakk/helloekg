#!/bin/bash
# Zbudowana aplikacja (dist) w trybie produkcyjnym na kopii bazy (helloekg_kurs_dev) na porcie 5057:
# do sprawdzenia rzeczy, których dev (Vite) nie pokazuje, np. egzekwowanej CSP. Najpierw: NODE_ENV=production npm run build
set -e
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
lsof -i :15432 >/dev/null 2>&1 || ssh -f -N -o ExitOnForwardFailure=yes -L 15432:127.0.0.1:5432 helloekg-studio
set -a; . ./.env.preview; set +a
export NODE_ENV=production PORT=5057 APP_BASE_URL=http://localhost:5057 FRONTEND_URL=http://localhost:5057
export CONTENT_ASSETS_DIR="$PWD/.preview-assets"
exec node dist/index.js
