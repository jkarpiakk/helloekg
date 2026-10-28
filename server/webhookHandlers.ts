import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { auditLog } from '@shared/schema';
import { authService } from './auth';
import { emailService } from './services/emailService';
import { linkZMaila } from './mailLinks';

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

  // Called by both the managed webhook handler above and the manual
  // STRIPE_WEBHOOK_SECRET-verified endpoint in index.ts.
  static async handleCheckoutCompleted(session: any): Promise<void> {
    console.log('Processing checkout.session.completed:', session.id);

    if (session.payment_status !== 'paid') {
      console.log('Payment not yet complete, skipping');
      return;
    }

    const metadata = session.metadata;
    if (!metadata?.userId || !metadata?.planId) {
      console.log('Missing required metadata (userId/planId), skipping');
      return;
    }

    const { userId, planId, durationDays } = metadata;

    try {
      // Idempotency guard — if a subscription already exists do nothing.
      // This ensures repeated webhook deliveries produce no side effects.
      // Tylko prawdziwa subskrypcja z bazy: w otwartej becie każdy ma też dostęp „beta”, a płatność ma go zastąpić
      const existingSubscription = await storage.getStoredActiveSubscription(userId);
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
        status: 'active',
        paymentProvider: 'stripe',
      });

      if (session.customer) {
        await storage.updateUserStripeCustomerId(userId, session.customer);
      }

      console.log(`Subscription created for user ${userId}, expires ${endDate.toISOString()}`);

      await storage.createAuditLog({
        actorId: userId,
        action: 'subscription_activated',
        entityType: 'subscription',
        entityId: userId,
      });

      // ── Post-activation email ──────────────────────────────────────────────
      // Detect whether this account was created via guest checkout (no user-set
      // password exists yet) by checking the audit log for the guest-creation
      // action.  This is idempotent: email is only sent when the subscription
      // is freshly created (the early-return above handles re-deliveries).
      const guestEntry = await db
        .select({ id: auditLog.id })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.actorId, userId),
            eq(auditLog.action, 'user_registered_via_guest_checkout')
          )
        )
        .limit(1);

      const user = await storage.getUser(userId);
      if (!user) return;

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      const endDateStr = endDate.toLocaleDateString('pl-PL');

      if (guestEntry.length > 0) {
        // Guest user: generate a one-time set-password link so they can access
        // their new account.  Link uses the same 60-min reset flow as Fix 2.
        const plainToken = await authService.initiatePasswordReset(user.email);
        if (plainToken) {
          const setPasswordUrl = linkZMaila("/reset-password", plainToken);
          try {
            await emailService.sendGuestPaymentConfirmation(
              user.email,
              plan.name,
              endDateStr,
              setPasswordUrl
            );
          } catch (emailErr) {
            console.error('Failed to send guest payment confirmation email:', emailErr);
          }
        }
      } else {
        // Registered user: send a standard subscription confirmation.
        try {
          await emailService.sendSubscriptionConfirmation(
            user.email,
            user.firstName || 'Użytkowniku',
            plan.name,
            endDateStr
          );
        } catch (emailErr) {
          console.error('Failed to send subscription confirmation email:', emailErr);
        }
      }
    } catch (error) {
      console.error('Error processing checkout completion:', error);
      throw error;
    }
  }
}
