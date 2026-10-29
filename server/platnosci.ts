import crypto from "crypto";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { subscriptions, plans, type Subscription, type User } from "@shared/schema";
import { storage } from "./storage";
import { authService } from "./auth";
import { emailService } from "./services/emailService";
import { linkZMaila } from "./mailLinks";

/**
 * Jedno miejsce, które zamienia opłaconą sesję Stripe Checkout w dostęp do kursu.
 * Wołają je: podpisany webhook, strona powrotu po płatności (finalize-payment / payment-success)
 * i stary webhook Replita. Sesję zawsze bierzemy od Stripe (webhook z podpisem albo sessions.retrieve
 * naszym kluczem), nigdy z treści żądania.
 *
 * Zasady:
 * - jedna sesja = jedna subskrypcja (kolumna stripe_checkout_session_id z UNIQUE): ponowne wysłanie
 *   tego samego numeru sesji, także po wygaśnięciu dostępu, nie daje kolejnych dni;
 * - zakup, gdy dostęp jeszcze trwa, dodaje dni od końca obecnego dostępu;
 * - zakup gościa zakłada konto dopiero po płatności;
 * - zakup gościa na adres istniejącego, niepotwierdzonego konta: konto dostaje nowe losowe hasło,
 *   sesje są wylogowane, a link do ustawienia hasła idzie na ten adres. Kto założył konto na cudzy
 *   e-mail, traci do niego dostęp, zanim pojawi się w nim opłacony kurs.
 */

export type WynikAktywacji = {
  user: User;
  subscription: Subscription;
  /** Konto założone przy tej płatności albo odzyskane (niepotwierdzone): hasło ustawia się z maila */
  hasloZMaila: boolean;
  /** Ta sesja była już wcześniej zamieniona w subskrypcję: nic nie dodano */
  juzAktywowana: boolean;
};

const DZIEN = 24 * 3600 * 1000;

function bladUnikalnosci(e: any): boolean {
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function subskrypcjaZSesji(sessionId: string): Promise<Subscription | undefined> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeCheckoutSessionId, sessionId));
  return sub;
}

async function losoweHaslo(): Promise<string> {
  return bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
}

/** Konto dla zakupu gościa, ustalane dopiero po płatności. */
async function kontoGoscia(email: string): Promise<{ user: User; hasloZMaila: boolean }> {
  const istniejace = await storage.getUserByEmail(email);
  if (istniejace) {
    if (istniejace.emailVerified) return { user: istniejace, hasloZMaila: false };
    // Niepotwierdzone konto na ten adres: nie wiemy, kto je założył. Odbieramy je temu, kto zna hasło.
    await storage.updateUser(istniejace.id, { password: await losoweHaslo() });
    await storage.invalidateUserSessions(istniejace.id);
    await storage.createAuditLog({
      actorId: istniejace.id,
      action: "guest_purchase_reset_unverified_account",
      entityType: "user",
      entityId: istniejace.id,
    });
    return { user: istniejace, hasloZMaila: true };
  }
  try {
    const user = await storage.createUser({
      email,
      password: await losoweHaslo(),
      firstName: "",
      lastName: "",
      // potwierdzenie przychodzi z ustawieniem hasła z linku w mailu
      emailVerified: false,
      role: "student",
    });
    await storage.createAuditLog({
      actorId: user.id,
      action: "user_registered_via_guest_checkout",
      entityType: "user",
      entityId: user.id,
    });
    return { user, hasloZMaila: true };
  } catch (e) {
    // równoległa aktywacja tej samej płatności (webhook i strona powrotu) zdążyła założyć konto
    if (!bladUnikalnosci(e)) throw e;
    const user = await storage.getUserByEmail(email);
    if (!user) throw e;
    return { user, hasloZMaila: true };
  }
}

/**
 * Aktywuje dostęp z opłaconej sesji. Zwraca null, gdy sesja nie jest opłacona albo nie pochodzi
 * z naszego koszyka (brak planu / adresata w metadanych).
 */
export async function aktywujPlatnosc(session: any): Promise<WynikAktywacji | null> {
  if (!session?.id || session.mode !== "payment" || session.payment_status !== "paid") return null;
  const m = session.metadata || {};
  if (!m.planId) return null;

  const juz = await subskrypcjaZSesji(session.id);
  if (juz) {
    const user = await storage.getUser(juz.userId);
    if (!user) return null;
    return { user, subscription: juz, hasloZMaila: false, juzAktywowana: true };
  }

  // plan po id także nieaktywny: płatność przyszła za plan, który był w sprzedaży w chwili zakupu
  const [plan] = await db.select().from(plans).where(eq(plans.id, m.planId));
  if (!plan) {
    console.error(`Płatność ${session.id}: plan ${m.planId} nie istnieje`);
    return null;
  }

  let user: User | undefined;
  let hasloZMaila = false;
  if (m.userId) {
    // zakup zalogowanego kursanta (albo sesja sprzed 29.10, gdy konto gościa powstawało przed płatnością)
    user = await storage.getUser(m.userId);
  } else if (m.guestEmail) {
    ({ user, hasloZMaila } = await kontoGoscia(String(m.guestEmail)));
  }
  if (!user) {
    console.error(`Płatność ${session.id}: brak konta w metadanych`);
    return null;
  }

  const dni = parseInt(m.durationDays, 10) > 0 ? parseInt(m.durationDays, 10) : plan.durationDays;
  const teraz = new Date();
  const obecna = await storage.getStoredActiveSubscription(user.id);
  const od = obecna && new Date(obecna.endDate) > teraz ? new Date(obecna.endDate) : teraz;
  const endDate = new Date(od.getTime() + dni * DZIEN);

  let subscription: Subscription;
  try {
    subscription = await storage.createSubscription({
      userId: user.id,
      planId: plan.id,
      startDate: teraz,
      endDate,
      status: "active",
      paymentProvider: "stripe",
      stripeCheckoutSessionId: session.id,
    });
  } catch (e) {
    // ta sama sesja aktywowana równolegle innym kanałem: zapis już jest, maile wysłał tamten
    if (!bladUnikalnosci(e)) throw e;
    const sub = await subskrypcjaZSesji(session.id);
    if (!sub) throw e;
    return { user, subscription: sub, hasloZMaila: false, juzAktywowana: true };
  }

  if (session.customer && !user.stripeCustomerId) {
    await storage.updateUserStripeCustomerId(user.id, String(session.customer));
  }
  await storage.createAuditLog({
    actorId: user.id,
    action: "subscription_activated",
    entityType: "subscription",
    entityId: subscription.id,
  });
  console.log(`Płatność ${session.id}: dostęp dla ${user.id} do ${endDate.toISOString()}`);

  const doDnia = endDate.toLocaleDateString("pl-PL");
  try {
    if (hasloZMaila) {
      const token = await authService.initiatePasswordReset(user.email);
      if (token) {
        await emailService.sendGuestPaymentConfirmation(user.email, plan.name, doDnia, linkZMaila("/reset-password", token));
      }
    } else {
      await emailService.sendSubscriptionConfirmation(user.email, user.firstName || "", plan.name, doDnia);
    }
  } catch (e) {
    console.error(`Płatność ${session.id}: mail z potwierdzeniem nie wyszedł:`, e);
  }

  return { user, subscription, hasloZMaila, juzAktywowana: false };
}
