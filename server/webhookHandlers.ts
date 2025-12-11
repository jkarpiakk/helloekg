import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import { db } from './db';
import { sql } from 'drizzle-orm';

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

  static async handleCheckoutCompleted(session: any): Promise<void> {
    console.log('Processing checkout.session.completed:', session.id);
    
    if (session.payment_status !== 'paid') {
      console.log('Payment not yet complete, skipping');
      return;
    }

    const metadata = session.metadata;
    if (!metadata?.userId || !metadata?.planId) {
      console.log('Missing required metadata, skipping');
      return;
    }

    const { userId, planId, durationDays } = metadata;

    try {
      const existingSubscription = await storage.getUserActiveSubscription(userId);
      if (existingSubscription) {
        console.log(`User ${userId} already has active subscription, skipping`);
        return;
      }

      const plan = await storage.getActivePlans().then(plans => 
        plans.find(p => p.id === planId)
      );

      if (!plan) {
        console.error(`Plan ${planId} not found`);
        return;
      }

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + parseInt(durationDays || plan.durationDays.toString()));

      await storage.createSubscription({
        userId,
        planId,
        startDate,
        endDate,
        status: "active",
        paymentProvider: "stripe"
      });

      if (session.customer) {
        await storage.updateUserStripeCustomerId(userId, session.customer);
      }

      console.log(`Subscription created for user ${userId}, expires ${endDate.toISOString()}`);

      await storage.createAuditLog({
        actorId: 'system',
        action: 'subscription_activated',
        targetType: 'subscription',
        details: {
          userId,
          planId,
          planName: plan.name,
          sessionId: session.id,
          endDate: endDate.toISOString()
        }
      });

    } catch (error) {
      console.error('Error processing checkout completion:', error);
      throw error;
    }
  }
}
