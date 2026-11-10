import crypto from "crypto";
import bcrypt from "bcrypt";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db";
import { subscriptions, plans, type Subscription, type User } from "@shared/schema";
import { storage } from "./storage";
import { authService } from "./auth";
import { emailService } from "./services/emailService";
import { linkZMaila } from "./mailLinks";
import { getUncachableStripeClient } from "./stripeClient";

/**
 * Jedno miejsce, które zamienia opłaconą sesję Stripe Checkout w dostęp do kursu.
 * Wołają je: podpisany webhook, strona powrotu po płatności (payment-success, tylko zalogowany kursant)
 * i stary webhook Replita. Sesję zawsze bierzemy od Stripe (webhook z podpisem albo sessions.retrieve
 * naszym kluczem), nigdy z treści żądania.
 *
 * Zasady:
 * - jedna sesja = jedna subskrypcja (kolumna stripe_checkout_session_id z UNIQUE): ponowne wysłanie
 *   tego samego numeru sesji, także po wygaśnięciu dostępu, nie daje kolejnych dni;
 * - zakup, gdy dostęp jeszcze trwa, dodaje dni od końca obecnego dostępu;
 * - zakup gościa zakłada konto dopiero po płatności;
 * - zwrot całej płatności (charge.refunded) odbiera dostęp z tej płatności (obsluzZwrot niżej);
 * - plan z interval (od 10.11.2026: 49 zł miesięcznie) to subskrypcja Stripe: jeden zapis na subskrypcję
 *   (stripe_subscription_id UNIQUE), dostęp do końca opłaconego okresu plus DOBA_ZAPASU; odnowienie (invoice.paid)
 *   przesuwa koniec, anulowanie (customer.subscription.deleted) go ucina; plan bez interval (499 zł za rok) to
 *   jednorazowa płatność za durationDays dni, jak dotąd;
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
/** Zapas po końcu okresu subskrypcji: odnowienie kartą bywa obciążane z kilkugodzinnym opóźnieniem */
const DOBA_ZAPASU = 2 * DZIEN;

/** Id ze Stripe: napis albo rozwinięty obiekt z polem id */
function idStripe(x: unknown): string | null {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && typeof (x as any).id === "string") return (x as any).id;
  return null;
}

async function subskrypcjaStripe(stripeSubscriptionId: string): Promise<Subscription | undefined> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  return sub;
}

/** Koniec pierwszego okresu subskrypcji przed odczytem ze Stripe: miesiąc (albo rok) kalendarzowy od teraz */
function koniecOkresu(od: Date, interval: string): Date {
  const d = new Date(od);
  if (interval === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

function bladUnikalnosci(e: any): boolean {
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function subskrypcjaZSesji(sessionId: string): Promise<Subscription | undefined> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeCheckoutSessionId, sessionId));
  return sub;
}

/** Identyfikator płatności (payment_intent) ze Stripe */
const idPlatnosci = idStripe;

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
  if (!session?.id || !["payment", "subscription"].includes(session.mode) || session.payment_status !== "paid") return null;
  const m = session.metadata || {};
  if (!m.planId) return null;
  const stripeSubId = session.mode === "subscription" ? idStripe(session.subscription) : null;
  if (session.mode === "subscription" && !stripeSubId) return null;

  const juz = (await subskrypcjaZSesji(session.id)) ?? (stripeSubId ? await subskrypcjaStripe(stripeSubId) : undefined);
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
  let endDate: Date;
  if (stripeSubId) {
    // subskrypcja: Stripe obciąża od dziś, więc okres liczymy od teraz; dokładny koniec przychodzi z invoice.paid
    endDate = new Date(koniecOkresu(teraz, plan.interval || "month").getTime() + DOBA_ZAPASU);
  } else {
    const obecna = await storage.getStoredActiveSubscription(user.id);
    const od = obecna && new Date(obecna.endDate) > teraz ? new Date(obecna.endDate) : teraz;
    endDate = new Date(od.getTime() + dni * DZIEN);
  }

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
      stripePaymentIntentId: idPlatnosci(session.payment_intent),
      stripeSubscriptionId: stripeSubId,
    });
  } catch (e) {
    // ta sama sesja aktywowana równolegle innym kanałem: zapis już jest, maile wysłał tamten
    if (!bladUnikalnosci(e)) throw e;
    const sub = (await subskrypcjaZSesji(session.id)) ?? (stripeSubId ? await subskrypcjaStripe(stripeSubId) : undefined);
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

/**
 * Zwrot pieniędzy (zdarzenie charge.refunded): przy zwrocie całej kwoty subskrypcja z tej płatności
 * dostaje status „refunded” i kończy się teraz, więc dostęp znika. Zwrot częściowy niczego nie odbiera
 * (decyzja przy włączaniu płatności). Subskrypcję szukamy po payment_intent, a dla starszych zapisów
 * przez sesję Checkout tej płatności.
 */
export async function obsluzZwrot(charge: any, powod: "zwrot" | "spór" = "zwrot"): Promise<string> {
  const pi = idPlatnosci(charge?.payment_intent);
  if (!pi) return "zwrot bez payment_intent, pomijam";
  if (powod === "zwrot" && !charge.refunded) return `zwrot częściowy (${charge.amount_refunded} z ${charge.amount}), dostęp bez zmian`;

  let [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripePaymentIntentId, pi));
  if (!sub) {
    const stripe = await getUncachableStripeClient();
    const sesje = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 });
    const sesja = sesje.data[0];
    if (sesja) sub = (await subskrypcjaZSesji(sesja.id)) as Subscription;
    if (!sub) {
      // płatność faktury subskrypcji: payment_intent -> faktura -> subskrypcja
      const platnosci = await stripe.invoicePayments.list({
        payment: { type: "payment_intent", payment_intent: pi },
        limit: 1,
        expand: ["data.invoice"],
      } as any);
      const subStripe = subskrypcjaFaktury((platnosci.data[0] as any)?.invoice);
      if (subStripe) sub = (await subskrypcjaStripe(subStripe)) as Subscription;
    }
  }
  if (!sub) return "zwrot płatności bez subskrypcji w kursie, pomijam";
  if (sub.status === "refunded" || sub.status === "disputed") return "subskrypcja już odebrana";

  // zwrot za subskrypcję odnawianą kończy ją też w Stripe (bez kolejnych obciążeń); najpierw Stripe, potem baza:
  // nieudane anulowanie rzuca wyjątek, zdarzenie nie jest zapisane i Stripe ponowi je z tym samym skutkiem
  if (sub.stripeSubscriptionId) {
    try {
      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    } catch (e: any) {
      if (e?.code !== "resource_missing") throw e;
    }
  }
  const teraz = new Date();
  await db.update(subscriptions)
    .set({ status: powod === "spór" ? "disputed" : "refunded", endDate: teraz, stripePaymentIntentId: pi })
    .where(eq(subscriptions.id, sub.id));
  // Dostęp dokupiony później liczył dni od końca tej subskrypcji: przesuwamy go o dni, które właśnie zwrócono
  const zwroconeMs = Math.max(0, new Date(sub.endDate).getTime() - Math.max(teraz.getTime(), new Date(sub.startDate).getTime()));
  if (zwroconeMs > 0) {
    const pozniejsze = await db.select().from(subscriptions).where(and(
      eq(subscriptions.userId, sub.userId),
      eq(subscriptions.status, "active"),
      gt(subscriptions.endDate, new Date(sub.endDate)),
    ));
    for (const p of pozniejsze) {
      await db.update(subscriptions)
        .set({ endDate: new Date(new Date(p.endDate).getTime() - zwroconeMs) })
        .where(eq(subscriptions.id, p.id));
    }
  }
  await storage.createAuditLog({
    actorId: sub.userId,
    action: powod === "spór" ? "subscription_disputed" : "subscription_refunded",
    entityType: "subscription",
    entityId: sub.id,
    diff: { payment_intent: pi },
  });
  return powod === "spór" ? "spór (chargeback): dostęp z tej płatności odebrany" : "zwrot całej kwoty: dostęp z tej płatności odebrany";
}

/** Okres opłacony fakturą: najpóźniejszy koniec z pozycji faktury (sekundy Unix) */
function koniecZFaktury(invoice: any): Date | null {
  const konce = (invoice?.lines?.data ?? []).map((l: any) => Number(l?.period?.end)).filter((x: number) => x > 0);
  return konce.length ? new Date(Math.max(...konce) * 1000) : null;
}

/** Subskrypcja, której dotyczy faktura (API od 2025: parent.subscription_details, wcześniej invoice.subscription) */
function subskrypcjaFaktury(invoice: any): string | null {
  return idStripe(invoice?.parent?.subscription_details?.subscription) ?? idStripe(invoice?.subscription);
}

/**
 * Opłacona faktura subskrypcji (invoice.paid): pierwsza i każde odnowienie. Przesuwa koniec dostępu do końca
 * opłaconego okresu plus zapas; nigdy go nie skraca. Pierwszy zapis zakłada checkout.session.completed;
 * jeśli faktura przyjdzie przed nim, nic nie robimy (koniec z sesji to i tak koniec pierwszego okresu).
 */
export async function obsluzOplaconaFakture(invoice: any): Promise<string> {
  const subId = subskrypcjaFaktury(invoice);
  if (!subId) return "faktura bez subskrypcji, pomijam";
  const sub = await subskrypcjaStripe(subId);
  if (!sub) return "subskrypcja jeszcze bez zapisu (czeka na checkout.session.completed)";
  const koniec = koniecZFaktury(invoice);
  if (!koniec) return "faktura bez okresu, pomijam";
  if (sub.status !== "active") return `subskrypcja w kursie ma status ${sub.status}, bez zmian`;
  const nowyKoniec = new Date(koniec.getTime() + DOBA_ZAPASU);
  if (nowyKoniec <= new Date(sub.endDate)) return "okres już opłacony";
  await db.update(subscriptions).set({ endDate: nowyKoniec }).where(eq(subscriptions.id, sub.id));
  await storage.createAuditLog({
    actorId: sub.userId,
    action: "subscription_renewed",
    entityType: "subscription",
    entityId: sub.id,
    diff: { endDate: nowyKoniec.toISOString() },
  });
  return "odnowienie: dostęp przedłużony";
}

/**
 * Koniec subskrypcji w Stripe (customer.subscription.deleted): anulowanie na koniec okresu, nieudane
 * odnowienie po wszystkich próbach albo anulowanie od razu. Dostęp kończy się z chwilą zakończenia w Stripe.
 */
export async function obsluzKoniecSubskrypcji(stripeSub: any): Promise<string> {
  const subId = idStripe(stripeSub);
  if (!subId) return "zdarzenie bez subskrypcji, pomijam";
  const sub = await subskrypcjaStripe(subId);
  if (!sub) return "subskrypcja spoza kursu, pomijam";
  if (sub.status !== "active") return `subskrypcja już ma status ${sub.status}`;
  const koniecStripe = Number(stripeSub?.ended_at) > 0 ? new Date(Number(stripeSub.ended_at) * 1000) : new Date();
  const koniec = koniecStripe < new Date(sub.endDate) ? koniecStripe : new Date(sub.endDate);
  await db.update(subscriptions).set({ status: "canceled", endDate: koniec }).where(eq(subscriptions.id, sub.id));
  await storage.createAuditLog({
    actorId: sub.userId,
    action: "subscription_ended",
    entityType: "subscription",
    entityId: sub.id,
  });
  return "subskrypcja zakończona: dostęp do chwili zakończenia w Stripe";
}

/**
 * Usunięcie konta: subskrypcje odnawiane w Stripe anulujemy od razu, żeby nie obciążać karty osoby,
 * której konta już nie ma. Odczyt teraz (zapisy znikną razem z kontem), anulowanie w zwróconej funkcji,
 * którą wołamy po udanym usunięciu. Błąd Stripe nie blokuje usunięcia konta (trafia do dziennika serwera).
 */
export async function anulujSubskrypcjeKonta(userId: string): Promise<() => Promise<void>> {
  const odnawiane = await db.select().from(subscriptions).where(and(
    eq(subscriptions.userId, userId),
    eq(subscriptions.status, "active"),
  ));
  const doAnulowania = odnawiane.filter((s) => s.stripeSubscriptionId);
  return () => anulujWStripe(doAnulowania.map((s) => s.stripeSubscriptionId!));
}

/** Anulowanie od razu podanych subskrypcji Stripe; błędy tylko w dzienniku */
export async function anulujWStripe(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const stripe = await getUncachableStripeClient();
    for (const id of ids) {
      try {
        await stripe.subscriptions.cancel(id);
      } catch (e: any) {
        if (e?.code !== "resource_missing") console.error(`Anulowanie subskrypcji ${id} w Stripe:`, e?.message);
      }
    }
  } catch (e: any) {
    console.error("Anulowanie subskrypcji w Stripe: brak klienta Stripe:", e?.message);
  }
}
