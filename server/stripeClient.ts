import Stripe from 'stripe';

/**
 * Klucze Stripe ze zmiennych serwera (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET w
 * /etc/helloekg-kurs.env; wpisuje je właściciel). Bez klucza tajnego płatności są wyłączone ('env' | null).
 * Stary konektor Replita usunięty 10.11.2026 (kurs nie działa już na Replicie).
 */
export type StripeSource = 'env' | null;

export function stripeSource(): StripeSource {
  return process.env.STRIPE_SECRET_KEY ? 'env' : null;
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
  // Dopóki płatności nie są uruchomione na żywo, tylko klucze testowe (checklista w ops/raporty, decyzja JK)
  if (keyMode(secretKey) === 'live' && process.env.STRIPE_LIVE_DOZWOLONE !== '1') {
    throw new Error('Klucz produkcyjny Stripe (sk_live_) jest zablokowany: na razie tylko tryb testowy (STRIPE_LIVE_DOZWOLONE=1 to zdejmuje)');
  }
  if (publishableKey) {
    if (!/^pk_(test|live)_/.test(publishableKey)) throw new Error('STRIPE_PUBLISHABLE_KEY ma zły format (oczekiwano pk_test_… albo pk_live_…)');
    if (keyMode(publishableKey) !== keyMode(secretKey)) {
      throw new Error('Klucze Stripe z różnych trybów: tajny i publiczny muszą być oba testowe albo oba produkcyjne');
    }
  }
  return { publishableKey, secretKey };
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const source = stripeSource();
  if (source === 'env') return envCredentials();
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
  if (!source) return 'Stripe disabled (brak STRIPE_SECRET_KEY)';
  try {
    const { secretKey, publishableKey } = envCredentials();
    const webhook = process.env.STRIPE_WEBHOOK_SECRET ? 'ustawiony' : 'BRAK (dostęp aktywuje wtedy tylko strona powrotu po płatności)';
    return `Stripe: klucze z konfiguracji serwera, tryb ${keyMode(secretKey)}, klucz publiczny ${publishableKey ? 'jest' : 'BRAK'}, sekret webhooka ${webhook}`;
  } catch (e: any) {
    return `Stripe: BŁĄD konfiguracji: ${e.message}`;
  }
}
