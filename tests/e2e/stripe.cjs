// Stripe z kluczy w konfiguracji serwera. Dwa serwery podglądu:
//  - BEZ (domyślnie :5055) bez kluczy: płatności wyłączone, czytelne 503, webhook nieaktywny;
//  - Z (domyślnie :5056) z fałszywymi kluczami testowymi (sk_test_…, whsec_…): klucz publiczny, podpis webhooka,
//    aktywacja dostępu po checkout.session.completed (raz, także przy ponownym doręczeniu).
// Z serwerem Stripe nic się nie łączy: podpis webhooka liczony lokalnie tym samym sekretem.
// Konto i plan tymczasowe w helloekg_kurs_dev, kasowane na końcu.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const crypto = require("crypto");
const Stripe = require(require.resolve("stripe", { paths: [process.cwd()] }));
const BEZ = process.env.BEZ || "http://localhost:5055", Z = process.env.Z || "http://localhost:5056";
const WHSEC = process.env.WHSEC || "whsec_lokalny_test_000";
const DB = process.env.DB || "helloekg_kurs_dev";
const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();
const stripe = new Stripe("sk_test_lokalnyFalszywy000");
const post = (url, body, headers = {}) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
const podpisz = (payload, secret = WHSEC) => stripe.webhooks.generateTestHeaderString({ payload, secret });

(async () => {
  const email = `stripe-e2e-${Date.now()}@helloekg.test`, haslo = crypto.randomBytes(12).toString("base64url");
  let userId = null, planId = null;
  sql("DELETE FROM rate_limit_store");
  const br = await chromium.launch();
  try {
    // 1. bez kluczy
    let r = await fetch(`${BEZ}/api/stripe/config`);
    ok("bez kluczy: /api/stripe/config 503 „Płatności nie są jeszcze włączone”", r.status === 503 && /nie są jeszcze włączone/.test(await r.text()), `status ${r.status}`);
    r = await post(`${BEZ}/api/stripe/webhook/manual`, "{}", { "stripe-signature": "t=1,v1=x" });
    ok("bez kluczy: webhook nieskonfigurowany (500, bez przetwarzania)", r.status === 500, `status ${r.status}`);
    r = await post(`${BEZ}/api/stripe/webhook/abc`, "{}", { "stripe-signature": "t=1,v1=x" });
    ok("bez kluczy: zarządzany webhook Replita 404", r.status === 404, `status ${r.status}`);

    // 2. z kluczami testowymi
    r = await fetch(`${Z}/api/stripe/config`); const j = await r.json().catch(() => ({}));
    ok("z kluczami: klucz publiczny testowy", r.status === 200 && /^pk_test_/.test(j.publishableKey || ""), `status ${r.status}`);
    r = await post(`${Z}/api/stripe/webhook/abc`, "{}", { "stripe-signature": "t=1,v1=x" });
    ok("z kluczami: zarządzany webhook Replita 404 (poza Replitem)", r.status === 404, `status ${r.status}`);

    // konto i plan tymczasowe
    const pg = await (await br.newContext()).newPage(); await pg.goto(Z + "/");
    userId = await pg.evaluate(async ({ email, haslo }) => {
      await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true }) });
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo }) });
      return (await r.json()).user?.id ?? null;
    }, { email, haslo });
    ok("konto tymczasowe", !!userId);
    planId = sql("INSERT INTO plans (name, price, duration_days, currency, is_active) VALUES ('E2E Stripe (tymczasowy)', 1.00, 30, 'PLN', true) RETURNING id").split("\n")[0];

    const zdarzenie = (typ, paid = true) => JSON.stringify({
      id: `evt_test_${crypto.randomBytes(6).toString("hex")}`, object: "event", type: typ,
      data: { object: { id: `cs_test_${crypto.randomBytes(6).toString("hex")}`, object: "checkout.session", payment_status: paid ? "paid" : "unpaid", customer: "cus_test_e2e", metadata: { userId, planId, durationDays: "30", email } } },
    });
    const ileSub = () => Number(sql(`SELECT count(*) FROM subscriptions WHERE user_id='${userId}' AND status='active'`));

    let body = zdarzenie("checkout.session.completed");
    r = await post(`${Z}/api/stripe/webhook/manual`, body);
    ok("webhook bez podpisu odrzucony (400)", r.status === 400, `status ${r.status}`);
    r = await post(`${Z}/api/stripe/webhook/manual`, body, { "stripe-signature": podpisz(body, "whsec_inny_sekret") });
    ok("webhook z cudzym podpisem odrzucony (400)", r.status === 400 && ileSub() === 0, `status ${r.status}`);
    const niezaplacone = zdarzenie("checkout.session.completed", false);
    r = await post(`${Z}/api/stripe/webhook/manual`, niezaplacone, { "stripe-signature": podpisz(niezaplacone) });
    ok("płatność nieopłacona: bez dostępu", r.status === 200 && ileSub() === 0, `status ${r.status}, subskrypcji ${ileSub()}`);
    r = await post(`${Z}/api/stripe/webhook/manual`, body, { "stripe-signature": podpisz(body) });
    ok("podpisany checkout.session.completed: dostęp aktywny 30 dni", r.status === 200 && ileSub() === 1, `status ${r.status}, subskrypcji ${ileSub()}`);
    const dni = sql(`SELECT round(extract(epoch FROM end_date - start_date)/86400) FROM subscriptions WHERE user_id='${userId}'`);
    ok("okres dostępu z planu", dni === "30", `dni ${dni}`);
    r = await post(`${Z}/api/stripe/webhook/manual`, body, { "stripe-signature": podpisz(body) });
    ok("ponowne doręczenie: nadal jedna subskrypcja", r.status === 200 && ileSub() === 1, `subskrypcji ${ileSub()}`);
    const cus = sql(`SELECT stripe_customer_id FROM users WHERE id='${userId}'`);
    ok("klient Stripe zapisany przy koncie", cus === "cus_test_e2e", cus);
    const st = await pg.evaluate(async () => (await fetch("/api/subscription/status")).json().catch(() => null));
    ok("kursant ma dostęp (w otwartej becie także, płatność zapisana obok)", !!st && st.hasActiveSubscription === true, JSON.stringify(st).slice(0, 80));
  } catch (e) {
    ok("przebieg", false, e.message.split("\n")[0]);
  } finally {
    if (userId) sql(`DELETE FROM users WHERE id='${userId}'`); else sql(`DELETE FROM users WHERE email='${email}'`);
    if (planId) sql(`DELETE FROM subscriptions WHERE plan_id='${planId}'; DELETE FROM plans WHERE id='${planId}'`);
    await br.close();
  }
  console.log(wyn.join("\n"));
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
