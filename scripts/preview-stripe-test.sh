#!/bin/bash
# Podgląd kursu z FAŁSZYWYMI kluczami testowymi Stripe (tylko format sk_test_/pk_test_, nic nie płaci) na porcie 5056.
set -e
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
lsof -i :15432 >/dev/null 2>&1 || ssh -f -N -o ExitOnForwardFailure=yes -L 15432:127.0.0.1:5432 helloekg-studio
set -a; . ./.env.preview; set +a
export NODE_ENV=development PORT=5056 APP_BASE_URL=http://localhost:5056 FRONTEND_URL=http://localhost:5056
export STRIPE_SECRET_KEY=sk_test_lokalnyFalszywy000 STRIPE_PUBLISHABLE_KEY=pk_test_lokalnyFalszywy000 STRIPE_WEBHOOK_SECRET=whsec_lokalny_test_000
export CONTENT_ASSETS_DIR="$PWD/.preview-assets"
exec npx tsx server/index.ts
