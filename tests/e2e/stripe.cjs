// Stripe (stan po 10.11.2026), bez przeglądarki i bez łączenia się ze Stripe: podpis webhooka liczony lokalnie.
// Dwa podglądy na tej samej bazie:
//  - BEZ (domyślnie :5065, scripts/preview.sh): płatności wyłączone, bez kluczy: trasy zakupu 404, webhook 503;
//  - Z (domyślnie :5066, scripts/preview-stripe-test.sh): PLATNOSCI_WLACZONE=1 i fałszywe klucze testowe.
// Sprawdza: podpis, przyznanie dostępu po checkout.session.completed, idempotencję po event.id (to samo zdarzenie
// drugi raz nic nie zmienia, zapis w stripe_events), jedną subskrypcję na sesję, zwrot częściowy (dostęp zostaje)
// i całkowity (dostęp znika), błąd obsługi → 500 bez zapisu zdarzenia (Stripe ponowi), tester bety przy
// włączonych płatnościach bez darmowego dostępu, blokadę klucza sk_live_.
// Od 10.11.2026 także subskrypcja miesięczna: zgoda na dostęp od razu wymagana przed Checkout, sesja w trybie
// subscription daje dostęp, invoice.paid przedłuża (nigdy nie skraca), customer.subscription.deleted kończy.
//   BEZ=… Z=… DB=helloekg_kurs_otwarcie OUTBOX=… node tests/e2e/stripe.cjs
const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Stripe = require(require.resolve("stripe", { paths: [process.cwd()] }));

const BEZ = process.env.BEZ || "http://localhost:5065";
const Z = process.env.Z || "http://localhost:5066";
const WHSEC = process.env.WHSEC || "whsec_lokalny_test_000";
const DB = process.env.DB || "helloekg_kurs_otwarcie";
const OUTBOX = process.env.OUTBOX;
if (!OUTBOX) { console.error("Ustaw OUTBOX (MAIL_OUTBOX_DIR podglądu)"); process.exit(2); }

const wyn = [];
const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n}${d ? `  (${d})` : ""}`);
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();
const stripe = new Stripe("sk_test_lokalnyFalszywy000");
const podpisz = (payload, secret = WHSEC) => stripe.webhooks.generateTestHeaderString({ payload, secret });
const req = (base, method, p, { body, cookie, headers = {} } = {}) =>
  fetch(base + p, {
    method,
    headers: { "Content-Type": "application/json", Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tokenZMaila(do_, poMs) {
  for (let i = 0; i < 30; i++) {
    for (const f of fs.readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort().reverse()) {
      if (Number(f.split("-")[0]) < poMs) break;
      const m = JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf8"));
      const t = m.to === do_ && /token=([0-9a-f]{64})/.exec(m.text)?.[1];
      if (t) return t;
    }
    await sleep(200);
  }
  return null;
}

(async () => {
  const start = Date.now();
  const email = `stripe-e2e-${start}@helloekg.test`;
  const haslo = `Stripe-${crypto.randomBytes(9).toString("base64url")}`;
  let planId = null;
  let planMies = null;
  sql("DELETE FROM rate_limit_store");
  sql(`INSERT INTO app_settings(key,value) VALUES ('dokumenty_opublikowane','true') ON CONFLICT (key) DO UPDATE SET value='true'`);
  try {
    // ── 1. Płatności wyłączone ─────────────────────────────────────────────────────────────────
    for (const [m, p] of [["GET", "/api/stripe/config"], ["GET", "/api/plans"], ["POST", "/api/stripe/checkout"], ["POST", "/api/stripe/payment-success"]]) {
      const r = await req(BEZ, m, p, { body: m === "POST" ? {} : undefined });
      ok(`wyłączone: ${m} ${p} → 404`, r.status === 404, `status ${r.status}`);
    }
    let r = await req(BEZ, "POST", "/api/stripe/webhook/manual", { body: "{}", headers: { "stripe-signature": "t=1,v1=x" } });
    ok("wyłączone, bez sekretu: webhook → 503", r.status === 503, `status ${r.status}`);

    // ── 2. Płatności włączone (klucze testowe) ─────────────────────────────────────────────────
    r = await req(Z, "GET", "/api/stripe/config");
    const cfg = await r.json().catch(() => ({}));
    ok("włączone: klucz publiczny testowy", r.status === 200 && /^pk_test_/.test(cfg.publishableKey || ""), `status ${r.status}`);
    planId = sql("INSERT INTO plans (name, price, duration_days, currency, is_active) VALUES ('E2E Stripe (tymczasowy)', 1.00, 30, 'PLN', true) RETURNING id").split("\n")[0];
    r = await req(Z, "GET", "/api/plans");
    const plany = await r.json();
    ok("cennik: plan testowy jest, „Manual” nie", plany.some((p) => p.id === planId) && !plany.some((p) => p.name === "Manual"));
    r = await req(Z, "POST", "/api/stripe/webhook/manual", { body: "{}", headers: { "stripe-signature": "t=1,v1=zly" } });
    ok("webhook: zły podpis → 400", r.status === 400, `status ${r.status}`);

    // konto: rejestracja + potwierdzenie z maila (ustawienia serwer trzyma w pamięci 10 s)
    await sleep(11000);
    const przed = Date.now();
    await req(Z, "POST", "/api/auth/register", { body: { firstName: "Stripe", email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true } });
    const tok = await tokenZMaila(email, przed);
    await req(Z, "POST", "/api/auth/verify-email", { body: { token: tok } });
    r = await req(Z, "POST", "/api/auth/login", { body: { email, password: haslo } });
    const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
    const userId = sql(`SELECT id FROM users WHERE email='${email}'`);
    ok("konto tymczasowe (potwierdzone, tester bety)", r.status === 200 && !!userId && sql(`SELECT tester_bety FROM users WHERE id='${userId}'`) === "t");
    const dostep = async () => (await (await req(Z, "GET", "/api/subscription/status", { cookie })).json()).hasActiveSubscription;
    ok("płatności włączone: tester bety bez opłaconego dostępu nie ma darmowego dostępu", (await dostep()) === false);

    // zdarzenia
    const pi = `pi_test_${crypto.randomBytes(6).toString("hex")}`;
    const sesja = `cs_test_${crypto.randomBytes(8).toString("hex")}`;
    const zdarzenie = (typ, obiekt, id = `evt_test_${crypto.randomBytes(6).toString("hex")}`) =>
      JSON.stringify({ id, object: "event", type: typ, data: { object: obiekt } });
    const sesjaObj = { id: sesja, object: "checkout.session", mode: "payment", payment_status: "paid", customer: "cus_test_e2e", payment_intent: pi, metadata: { userId, planId, durationDays: "30" } };
    const wyslij = (b) => req(Z, "POST", "/api/stripe/webhook/manual", { body: b, headers: { "stripe-signature": podpisz(b) } });
    const ileAktywnych = () => Number(sql(`SELECT count(*) FROM subscriptions WHERE user_id='${userId}' AND status='active'`));

    const e1 = zdarzenie("checkout.session.completed", sesjaObj);
    r = await wyslij(e1);
    ok("checkout.session.completed → 200 i dostęp", r.status === 200 && ileAktywnych() === 1 && (await dostep()) === true, `status ${r.status}`);
    ok("subskrypcja pamięta payment_intent", sql(`SELECT stripe_payment_intent_id FROM subscriptions WHERE user_id='${userId}'`) === pi);
    const e1id = JSON.parse(e1).id;
    ok("zdarzenie zapisane w stripe_events", sql(`SELECT type FROM stripe_events WHERE event_id='${e1id}'`) === "checkout.session.completed");
    r = await wyslij(e1);
    ok("to samo zdarzenie (event.id) drugi raz → 200, nic nowego", r.status === 200 && ileAktywnych() === 1, `status ${r.status}`);
    r = await wyslij(zdarzenie("checkout.session.completed", sesjaObj));
    ok("inne zdarzenie z tą samą sesją → jedna subskrypcja", r.status === 200 && ileAktywnych() === 1);

    // zwrot częściowy, potem całkowity
    const charge = (refunded) => ({ id: `ch_test_${crypto.randomBytes(5).toString("hex")}`, object: "charge", payment_intent: pi, amount: 100, amount_refunded: refunded ? 100 : 40, refunded });
    r = await wyslij(zdarzenie("charge.refunded", charge(false)));
    ok("zwrot częściowy → dostęp zostaje", r.status === 200 && (await dostep()) === true, `status ${r.status}`);
    const zwrot = zdarzenie("charge.refunded", charge(true));
    r = await wyslij(zwrot);
    ok("zwrot całej kwoty → dostęp odebrany", r.status === 200 && (await dostep()) === false && sql(`SELECT status FROM subscriptions WHERE user_id='${userId}'`) === "refunded", `status ${r.status}`);
    r = await wyslij(zwrot);
    ok("ten sam zwrot drugi raz → 200 bez zmian", r.status === 200 && sql(`SELECT count(*) FROM subscriptions WHERE user_id='${userId}' AND status='refunded'`) === "1");
    r = await req(Z, "GET", "/api/quiz/question?sectionId=x", { cookie });
    ok("po zwrocie pytania kursu zamknięte (SUBSCRIPTION_REQUIRED)", r.status === 403 && (await r.json()).code === "SUBSCRIPTION_REQUIRED", `status ${r.status}`);
    ok("audyt: subscription_refunded", sql(`SELECT count(*) FROM audit_log WHERE action='subscription_refunded' AND actor_id='${userId}'`) === "1");

    // błąd obsługi: 500 i zdarzenie nie zapisane (Stripe ponowi)
    const zly = zdarzenie("checkout.session.completed", { ...sesjaObj, id: `cs_test_${crypto.randomBytes(8).toString("hex")}`, metadata: { userId, planId: "to-nie-uuid", durationDays: "30" } });
    r = await wyslij(zly);
    ok("błąd obsługi → 500, zdarzenie nie zapisane", r.status === 500 && sql(`SELECT count(*) FROM stripe_events WHERE event_id='${JSON.parse(zly).id}'`) === "0", `status ${r.status}`);
    r = await wyslij(zdarzenie("customer.created", { id: "cus_x" }));
    ok("zdarzenie bez obsługi → 200", r.status === 200, `status ${r.status}`);

    // ── 3. Subskrypcja miesięczna ──────────────────────────────────────────────────────────────
    planMies = sql(`INSERT INTO plans (name, price, duration_days, currency, "interval", is_active) VALUES ('E2E miesięczny (tymczasowy)', 1.00, 30, 'PLN', 'month', true) RETURNING id`).split("\n")[0];
    for (const p of ["/api/stripe/guest-checkout", "/api/stripe/finalize-payment"]) {
      r = await req(Z, "POST", p, { body: { email: `gosc-${start}@helloekg.test`, planId: planMies, sessionId: "cs_test_aaaaaaaaaaaa" } });
      ok(`zakup bez konta usunięty: ${p} → 404`, r.status === 404, `status ${r.status}`);
    }
    r = await req(Z, "POST", "/api/stripe/checkout", { cookie, body: { planId: planMies } });
    ok("Checkout bez zgody na dostęp od razu → 400", r.status === 400 && /zgod/i.test((await r.json()).error || ""), `status ${r.status}`);
    const subId = `sub_test_${crypto.randomBytes(6).toString("hex")}`;
    const sesjaSub = { id: `cs_test_${crypto.randomBytes(8).toString("hex")}`, object: "checkout.session", mode: "subscription", payment_status: "paid", customer: "cus_test_e2e", subscription: subId, payment_intent: null, metadata: { userId, planId: planMies, durationDays: "30" } };
    r = await wyslij(zdarzenie("checkout.session.completed", sesjaSub));
    const koniec = () => Number(sql(`SELECT extract(epoch from end_date) FROM subscriptions WHERE stripe_subscription_id='${subId}'`));
    const teraz = Date.now() / 1000;
    ok("subskrypcja: sesja w trybie subscription → dostęp ~miesiąc + 2 dni", r.status === 200 && (await dostep()) === true && koniec() > teraz + 29 * 86400 && koniec() < teraz + 34 * 86400, `status ${r.status}`);
    const st = await (await req(Z, "GET", "/api/subscription/status", { cookie })).json();
    ok("status: odnawiana = true", st.subscription?.odnawiana === true);
    r = await req(Z, "POST", "/api/stripe/checkout", { cookie, body: { planId: planMies, zgodaNatychmiast: true } });
    ok("druga subskrypcja przy aktywnej → 409", r.status === 409, `status ${r.status}`);
    r = await req(Z, "POST", "/api/stripe/checkout", { cookie, body: { planId, zgodaNatychmiast: true } });
    ok("zakup jednorazowy przy aktywnej subskrypcji → 409", r.status === 409, `status ${r.status}`);
    const faktura = (konieczSek) => ({ id: `in_test_${crypto.randomBytes(5).toString("hex")}`, object: "invoice", parent: { type: "subscription_details", subscription_details: { subscription: subId, metadata: {} } }, lines: { data: [{ period: { start: Math.floor(teraz), end: konieczSek } }] } });
    const odnowienieDo = Math.floor(teraz + 62 * 86400);
    r = await wyslij(zdarzenie("invoice.paid", faktura(odnowienieDo)));
    ok("invoice.paid (odnowienie) → koniec = koniec okresu + 2 dni", r.status === 200 && Math.abs(koniec() - (odnowienieDo + 2 * 86400)) < 5, `status ${r.status}`);
    r = await wyslij(zdarzenie("invoice.paid", faktura(Math.floor(teraz + 10 * 86400))));
    ok("invoice.paid za wcześniejszy okres → koniec bez zmian", r.status === 200 && Math.abs(koniec() - (odnowienieDo + 2 * 86400)) < 5);
    r = await wyslij(zdarzenie("invoice.paid", { ...faktura(odnowienieDo), parent: { subscription_details: { subscription: "sub_test_obcy" } } }));
    ok("invoice.paid obcej subskrypcji → 200, nic", r.status === 200);
    r = await wyslij(zdarzenie("customer.subscription.deleted", { id: subId, object: "subscription", ended_at: Math.floor(Date.now() / 1000) }));
    ok("customer.subscription.deleted → status canceled, dostęp znika", r.status === 200 && sql(`SELECT status FROM subscriptions WHERE stripe_subscription_id='${subId}'`) === "canceled" && (await dostep()) === false, `status ${r.status}`);
    r = await wyslij(zdarzenie("invoice.paid", faktura(Math.floor(teraz + 90 * 86400))));
    ok("invoice.paid po zakończeniu → nie przywraca dostępu", r.status === 200 && (await dostep()) === false);

    // klucz produkcyjny zablokowany bez STRIPE_LIVE_DOZWOLONE
    const status = execSync(`npx tsx -e 'import("./server/stripeClient.ts").then(m => console.log(m.stripeStatus()))'`, {
      env: { ...process.env, STRIPE_SECRET_KEY: "sk_live_niePrawdziwy000", STRIPE_PUBLISHABLE_KEY: "pk_live_niePrawdziwy000" },
    }).toString();
    ok("klucz sk_live_ zablokowany (tylko tryb testowy)", /zablokowany/.test(status), status.trim());
  } catch (e) {
    ok("wyjątek w teście", false, e.stack);
  } finally {
    sql(`DELETE FROM users WHERE email LIKE 'stripe-e2e-%@helloekg.test'`);
    for (const p of [planId, planMies].filter(Boolean)) sql(`DELETE FROM subscriptions WHERE plan_id='${p}'; DELETE FROM plans WHERE id='${p}'`);
    sql("DELETE FROM stripe_events WHERE event_id LIKE 'evt_test_%'");
    sql("DELETE FROM app_settings WHERE key='dokumenty_opublikowane'");
    console.log(wyn.join("\n"));
    const zle = wyn.filter((w) => w.startsWith("FAIL")).length;
    console.log(`\n${wyn.length - zle}/${wyn.length} OK`);
    process.exit(zle ? 1 : 0);
  }
})();
