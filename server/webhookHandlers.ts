import { eq } from "drizzle-orm";
import { db } from "./db";
import { stripeEvents } from "@shared/schema";
import { aktywujPlatnosc, obsluzKoniecSubskrypcji, obsluzOplaconaFakture, obsluzZwrot } from "./platnosci";

/**
 * Zdarzenie z podpisanego webhooka Stripe (podpis sprawdza index.ts). Każde zdarzenie (event.id) obsługujemy raz:
 * po udanej obsłudze trafia do stripe_events, a ponowne doręczenie tego samego zdarzenia niczego nie zmienia.
 * Błąd obsługi rzuca wyjątek: zdarzenie nie jest zapisane, a Stripe ponowi wysyłkę.
 * Aktywacja dostępu ma dodatkowo własną idempotencję po numerze sesji Checkout (server/platnosci.ts).
 */
export async function obsluzZdarzenieStripe(event: { id: string; type: string; data: { object: any } }): Promise<string> {
  const [juz] = await db.select().from(stripeEvents).where(eq(stripeEvents.eventId, event.id));
  if (juz) return "już obsłużone wcześniej, pomijam";

  let wynik: string;
  switch (event.type) {
    // płatność kartą lub BLIK: completed od razu jako paid; metody odroczone (np. Przelewy24): async_payment_succeeded
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const w = await aktywujPlatnosc(event.data.object);
      wynik = !w ? "bez aktywacji (nieopłacona albo spoza koszyka)" : w.juzAktywowana ? "sesja już aktywowana" : "dostęp przyznany";
      break;
    }
    // subskrypcja miesięczna: pierwsza faktura i odnowienia
    case "invoice.paid":
      wynik = await obsluzOplaconaFakture(event.data.object);
      break;
    case "customer.subscription.deleted":
      wynik = await obsluzKoniecSubskrypcji(event.data.object);
      break;
    case "charge.refunded":
      wynik = await obsluzZwrot(event.data.object);
      break;
    // spór w banku (chargeback): dostęp i odnawianie kończą się jak przy zwrocie; wygrany spór przywraca admin
    case "charge.dispute.created":
      wynik = await obsluzZwrot(event.data.object, "spór");
      break;
    default:
      wynik = "zdarzenie bez obsługi, pomijam";
  }

  await db.insert(stripeEvents).values({ eventId: event.id, type: event.type }).onConflictDoNothing();
  return wynik;
}
