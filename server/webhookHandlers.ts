import { getStripeSync } from './stripeClient';
import { aktywujPlatnosc } from './platnosci';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);

    const event = JSON.parse(payload.toString());
    console.log(`Processing Stripe webhook event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      await WebhookHandlers.handleCheckoutCompleted(event.data.object);
    }
  }

  // Wołane przez zarządzany webhook Replita (wyżej) i webhook z podpisem STRIPE_WEBHOOK_SECRET (index.ts).
  // Cała logika aktywacji (idempotencja po numerze sesji, przedłużenia, konto gościa) w server/platnosci.ts.
  static async handleCheckoutCompleted(session: any): Promise<void> {
    const wynik = await aktywujPlatnosc(session);
    if (!wynik) console.log(`Webhook: sesja ${session?.id} bez aktywacji (nieopłacona albo spoza koszyka)`);
    else if (wynik.juzAktywowana) console.log(`Webhook: sesja ${session.id} już aktywowana, pomijam`);
  }
}
