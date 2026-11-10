/**
 * Propozycja cen w Stripe (TYLKO tryb testowy) i w tabeli plans (nieaktywne, do decyzji JK).
 * Ceny jak w EKGQuiz (jednorazowo, dostęp na okres): 60 zł / 30 dni, 100 zł / 90 dni, 169 zł / 365 dni.
 * Idempotentne: produkty i ceny szukane po lookup_key, plany po nazwie. Nic nie aktywuje: plany zostają is_active=false,
 * a cennik i tak jest niewidoczny, dopóki PLATNOSCI_WLACZONE nie jest ustawione.
 * Na serwerze (klucze z konfiguracji, nic nie jest wypisywane poza identyfikatorami):
 *   sudo systemd-run --quiet --uid=kurs --gid=kurs -p EnvironmentFile=/etc/helloekg-kurs.env \
 *     -p WorkingDirectory=/opt/helloekg-kurs --wait --pipe /usr/bin/node dist/stripe-test-ceny.js [--zapisz]
 * Bez --zapisz tylko pokazuje, co by zrobił.
 */
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { plans } from "@shared/schema";

const PROPOZYCJA = [
  { klucz: "helloekg_dostep_30", nazwa: "Dostęp do kursu: 30 dni", cena: 60, dni: 30 },
  { klucz: "helloekg_dostep_90", nazwa: "Dostęp do kursu: 90 dni", cena: 100, dni: 90 },
  { klucz: "helloekg_dostep_365", nazwa: "Dostęp do kursu: 365 dni", cena: 169, dni: 365 },
];

async function main() {
  const zapisz = process.argv.includes("--zapisz");
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!/^(sk|rk)_test_/.test(key)) throw new Error("Potrzebny klucz testowy (sk_test_…) w STRIPE_SECRET_KEY");
  const stripe = new Stripe(key, { apiVersion: "2025-11-17.clover" as any });

  for (const p of PROPOZYCJA) {
    const istniejace = await stripe.prices.list({ lookup_keys: [p.klucz], limit: 1 });
    let priceId = istniejace.data[0]?.id;
    if (!priceId && zapisz) {
      const produkt = await stripe.products.create({ name: p.nazwa, metadata: { helloekg: "propozycja", dni: String(p.dni) } });
      const cena = await stripe.prices.create({
        product: produkt.id, currency: "pln", unit_amount: p.cena * 100, lookup_key: p.klucz,
        metadata: { helloekg: "propozycja", dni: String(p.dni) },
      });
      priceId = cena.id;
    }
    const [plan] = await db.select().from(plans).where(eq(plans.name, p.nazwa));
    if (!plan && zapisz) {
      await db.insert(plans).values({ name: p.nazwa, price: p.cena.toFixed(2), durationDays: p.dni, currency: "PLN", stripePriceId: priceId ?? null, isActive: false });
    } else if (plan && zapisz && priceId && plan.stripePriceId !== priceId) {
      await db.update(plans).set({ stripePriceId: priceId }).where(eq(plans.id, plan.id));
    }
    console.log(`${p.nazwa}: ${p.cena} zł, Stripe ${priceId ?? (zapisz ? "?" : "(do założenia)")}, plan w bazie ${plan ? "jest" : zapisz ? "założony (nieaktywny)" : "(do założenia)"}`);
  }
  await pool.end();
}
main().catch(async (e) => { console.error("błąd:", e?.message); await pool.end().catch(() => {}); process.exit(1); });
