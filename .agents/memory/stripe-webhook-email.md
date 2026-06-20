---
name: Stripe webhook guest email
description: How post-payment emails differ between guest and registered users in the checkout.session.completed handler.
---

In `WebhookHandlers.handleCheckoutCompleted`:

1. Idempotency check first — if user already has an active subscription, return early.
2. Create subscription, update stripeCustomerId.
3. Audit log with actorId = userId.
4. Check audit log for action `user_registered_via_guest_checkout` to determine if the user is a guest.
5. **Guest**: call `authService.initiatePasswordReset(email)` to get a one-time set-password token, then send `emailService.sendGuestPaymentConfirmation(email, planName, endDate, setPasswordUrl)`.
6. **Registered user**: send `emailService.sendSubscriptionConfirmation(email, firstName, planName, endDate)`.

The manual webhook endpoint (`POST /api/stripe/webhook/manual`) uses `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` for explicit signature verification — configure this URL in the Stripe Dashboard as a fallback to the managed stripe-replit-sync webhook.

**Why:** Guests have no password yet; they need a set-password link alongside their payment confirmation or they can't log in.
