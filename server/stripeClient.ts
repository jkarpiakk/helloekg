import Stripe from 'stripe';

/**
 * Skąd biorą się klucze Stripe:
 * - 'env': zmienne STRIPE_SECRET_KEY i STRIPE_PUBLISHABLE_KEY w konfiguracji serwera (VPS, każde środowisko poza Replitem);
 * - 'replit': konektor Stripe na Replicie (stary sposób, zostaje dla zgodności);
 * - null: płatności wyłączone.
 * Zmienne serwera mają pierwszeństwo, więc ten sam kod działa w obu miejscach.
 */
export type StripeSource = 'env' | 'replit' | null;

export function stripeSource(): StripeSource {
  if (process.env.STRIPE_SECRET_KEY) return 'env';
  if (process.env.REPLIT_CONNECTORS_HOSTNAME) return 'replit';
  return null;
}

/** Tryb klucza: testowy albo produkcyjny (z prefiksu, bez ujawniania klucza). */
export function keyMode(key: string): 'test' | 'live' | null {
  const m = /^(?:sk|rk|pk)_(test|live)_/.exec(key);
  return m ? (m[1] as 'test' | 'live') : null;
}

/** Klucze ze zmiennych serwera, sprawdzone: format i zgodny tryb (test z test, live z live). */
function envCredentials(): { publishableKey: string; secretKey: string } {
  const secretKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();
  const publishableKey = (process.env.STRIPE_PUBLISHABLE_KEY ?? '').trim();
  if (!/^(sk|rk)_(test|live)_/.test(secretKey)) {
    throw new Error('STRIPE_SECRET_KEY ma zły format (oczekiwano sk_test_…, sk_live_… albo klucza ograniczonego rk_…)');
  }
  if (publishableKey) {
    if (!/^pk_(test|live)_/.test(publishableKey)) throw new Error('STRIPE_PUBLISHABLE_KEY ma zły format (oczekiwano pk_test_… albo pk_live_…)');
    if (keyMode(publishableKey) !== keyMode(secretKey)) {
      throw new Error('Klucze Stripe z różnych trybów: tajny i publiczny muszą być oba testowe albo oba produkcyjne');
    }
  }
  return { publishableKey, secretKey };
}

async function replitCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const source = stripeSource();
  if (source === 'env') return envCredentials();
  if (source === 'replit') return replitCredentials();
  throw new Error('Stripe nie jest skonfigurowany (brak STRIPE_SECRET_KEY)');
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();

  return new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  if (!publishableKey) throw new Error('Brak STRIPE_PUBLISHABLE_KEY');
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

/** Opis konfiguracji do logu przy starcie: źródło, tryb i czy jest sekret webhooka. Bez wartości kluczy. */
export function stripeStatus(): string {
  const source = stripeSource();
  if (!source) return 'Stripe disabled (brak STRIPE_SECRET_KEY i konektora Replit)';
  if (source === 'replit') return 'Stripe: konektor Replit';
  try {
    const { secretKey, publishableKey } = envCredentials();
    const webhook = process.env.STRIPE_WEBHOOK_SECRET ? 'ustawiony' : 'BRAK (dostęp aktywuje wtedy tylko strona powrotu po płatności)';
    return `Stripe: klucze z konfiguracji serwera, tryb ${keyMode(secretKey)}, klucz publiczny ${publishableKey ? 'jest' : 'BRAK'}, sekret webhooka ${webhook}`;
  } catch (e: any) {
    return `Stripe: BŁĄD konfiguracji: ${e.message}`;
  }
}

let stripeSync: any = null;

/** Synchronizacja danych Stripe z bazą przez stripe-replit-sync: tylko na Replicie (zarządzany webhook). */
export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
