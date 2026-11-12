#!/bin/bash
# npm run e2e:obrazy — czy każde pytanie, które ma obraz, naprawdę go pokazuje (zgłoszenie JK 11.11).
#   1. odświeża lustro produkcji (scripts/lustro-prod.sh; BEZ_LUSTRA=1 pomija),
#   2. uruchamia zbudowaną aplikację (dist, tryb produkcyjny) na lustrze, port E2E_PORT (5068),
#   3. tests/e2e/obrazy.cjs: API po wszystkich pytaniach z obrazem + widok kursanta 375 i 1280 px,
#   4. raport w ops/raporty/, kod wyjścia ≠ 0, gdy którykolwiek obraz nie działa.
# Wymaga zbudowanego dist (NODE_ENV=production npm run build) i Playwright (tests/e2e/README.md).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
[ -f dist/index.js ] || { echo "Brak dist/index.js: najpierw NODE_ENV=production npm run build"; exit 2; }
[ "${BEZ_LUSTRA:-}" = 1 ] || bash scripts/lustro-prod.sh

lsof -i :15432 >/dev/null 2>&1 || ssh -f -N -o ExitOnForwardFailure=yes -L 15432:127.0.0.1:5432 helloekg-studio
P=${E2E_PORT:-5068}
LOG=$(mktemp -t e2e-obrazy-serwer)
(
  set -a; . ./.env.preview; set +a
  export NODE_ENV=production PORT=$P APP_BASE_URL=http://localhost:$P FRONTEND_URL=http://localhost:$P
  export DATABASE_URL="${DATABASE_URL%/*}/helloekg_kurs_lustro"
  export CONTENT_ASSETS_DIR="$PWD/.lustro-assets"
  # żaden mail z lustra nie wychodzi (konto testowe ma adres @helloekg.test, ale na wszelki wypadek)
  export SMTP_HOST=127.0.0.1 SMTP_PORT=9 SENDGRID_API_KEY=
  exec node dist/index.js
) >"$LOG" 2>&1 &
SERWER=$!
trap 'kill $SERWER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$P/" && break; sleep 0.5; done
curl -s -o /dev/null "http://localhost:$P/" || { echo "Serwer lustra nie wstał:"; tail -20 "$LOG"; exit 2; }

PW=${E2E_NODE_PATH:-/tmp/e2e/node_modules}
BASE=http://localhost:$P DB=helloekg_kurs_lustro NODE_PATH="$PW" node tests/e2e/obrazy.cjs "$@"
