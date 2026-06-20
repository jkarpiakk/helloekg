---
name: Guest checkout webhook activation
description: Why guest accounts must be created before the Stripe redirect, not after
---

The Stripe webhook (`handleCheckoutCompleted`) only activates a subscription when the
checkout session `metadata` contains a non-empty `userId`. It does NOT create user
accounts — it bails out early when `userId` is missing.

**Rule:** Any checkout flow must create (or resolve) the user account and put its id
into the Stripe session metadata BEFORE redirecting to Stripe.

**Why:** The original guest checkout sent buyers to Stripe with an empty `userId` and
relied on the frontend `finalize-payment` call (on `/payment-success`) to create the
account and activate access. If the buyer closed the browser after paying, the webhook
ignored the event and the subscription was never activated — money taken, no access.

**How to apply:** In `/api/stripe/guest-checkout`, new guests get an account created
up front (random password, `emailVerified: true`, role `student`). Guard `createUser`
against the unique-email race by falling back to `getUserByEmail` on insert failure.
`finalize-payment` stays idempotent (checks for an existing active subscription) so the
webhook and the frontend path never double-activate.
