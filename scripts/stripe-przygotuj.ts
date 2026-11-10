/**
 * Przygotowanie konta Stripe (TYLKO tryb testowy, chyba że STRIPE_LIVE_DOZWOLONE=1) pod cennik z 10.11.2026:
 * 49 zł miesięcznie (subskrypcja, karta) i 499 zł za rok (jednorazowo: karta, BLIK, Przelewy24).
 * Ceny są w tabeli plans (migracja 2026-11-10-subskrypcja.sql), a sesje Checkout dostają je jako price_data,
 * więc w Stripe nie trzeba zakładać produktów. Skrypt:
 *  - pokazuje plany z bazy;
 *  - zakłada konfigurację portalu klienta (zmiana karty, faktury, anulowanie na koniec okresu), jeśli konto nie ma
 *    domyślnej; bez niej przycisk „Płatności” w menu konta nie zadziała;
 *  - wypisuje zdarzenia, które musi wysyłać webhook.
 * Na serwerze:
 *   sudo systemd-run --quiet --uid=kurs --gid=kurs -p EnvironmentFile=/etc/helloekg-kurs.env \
 *     -p WorkingDirectory=/opt/helloekg-kurs --wait --pipe /usr/bin/node dist/stripe-przygotuj.js [--zapisz]
 * Bez --zapisz tylko pokazuje, co by zrobił.
 */
import Stripe from "stripe";
import { db, pool } from "../server/db";
import { plans } from "@shared/schema";

const ZDARZENIA = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "invoice.paid",
  "customer.subscription.deleted",
  "charge.refunded",
];

async function main() {
  const zapisz = process.argv.includes("--zapisz");
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!/^(sk|rk)_test_/.test(key) && process.env.STRIPE_LIVE_DOZWOLONE !== "1") {
    throw new Error("Potrzebny klucz testowy (sk_test_…) w STRIPE_SECRET_KEY");
  }
  const stripe = new Stripe(key, { apiVersion: "2025-11-17.clover" as any });

  for (const p of await db.select().from(plans)) {
    console.log(`plan: ${p.name}, ${p.price} ${p.currency}, ${p.interval ? `odnawiany co ${p.interval}` : `${p.durationDays} dni jednorazowo`}, ${p.isActive ? "aktywny" : "nieaktywny"}`);
  }

  const konfiguracje = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  if (konfiguracje.data[0]) {
    console.log(`portal klienta: jest domyślna konfiguracja ${konfiguracje.data[0].id}`);
  } else if (zapisz) {
    const k = await stripe.billingPortal.configurations.create({
      business_profile: { headline: "helloEKG: płatności i subskrypcja" },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
        subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "unused", "other"] } },
      },
    });
    console.log(`portal klienta: założona konfiguracja ${k.id}`);
  } else {
    console.log("portal klienta: brak domyślnej konfiguracji (do założenia z --zapisz)");
  }

  console.log(`webhook musi wysyłać: ${ZDARZENIA.join(", ")}`);
  await pool.end();
}
main().catch(async (e) => { console.error("błąd:", e?.message); await pool.end().catch(() => {}); process.exit(1); });
