// Stripe z kluczy w konfiguracji serwera. Dwa serwery podglądu:
//  - BEZ (domyślnie :5055) bez kluczy: płatności wyłączone, czytelne 503, webhook nieaktywny;
//  - Z (domyślnie :5056) z fałszywymi kluczami testowymi (sk_test_…, whsec_…): klucz publiczny, podpis webhooka,
//    aktywacja dostępu po checkout.session.completed (raz, także przy ponownym doręczeniu);
//    pakiet płatności 29.10: sesja nie daje dni drugi raz (także po wygaśnięciu), przedłużenie dodaje dni
//    od końca dostępu, konto gościa dopiero po płatności, zakup gościa odbiera niepotwierdzone konto,
//    ustawienie hasła z maila potwierdza adres, certyfikat wymaga potwierdzonego adresu.
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
const post = (url, body, headers = {}) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(url).origin, ...headers }, body });
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

    const nowaSesja = () => `cs_test_${crypto.randomBytes(8).toString("hex")}`;
    const zdarzenie = (typ, paid = true, sesja = nowaSesja(), metadata = { userId, planId, durationDays: "30" }) => JSON.stringify({
      id: `evt_test_${crypto.randomBytes(6).toString("hex")}`, object: "event", type: typ,
      data: { object: { id: sesja, object: "checkout.session", mode: "payment", payment_status: paid ? "paid" : "unpaid", customer: "cus_test_e2e", metadata } },
    });
    const wyslij = (b) => post(`${Z}/api/stripe/webhook/manual`, b, { "stripe-signature": podpisz(b) });
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

    // 3. ponowne użycie sesji po wygaśnięciu dostępu
    const wszystkie = () => Number(sql(`SELECT count(*) FROM subscriptions WHERE user_id='${userId}'`));
    sql(`UPDATE subscriptions SET end_date = now() - interval '1 day' WHERE user_id='${userId}'`);
    r = await wyslij(body);
    const trwa = () => Number(sql(`SELECT count(*) FROM subscriptions WHERE user_id='${userId}' AND status='active' AND end_date > now()`));
    ok("ta sama sesja po wygaśnięciu: bez nowych dni", r.status === 200 && wszystkie() === 1 && trwa() === 0, `zapisów ${wszystkie()}, trwających ${trwa()}`);
    const sesjaPierwsza = JSON.parse(body).data.object.id;
    const fin = await post(`${Z}/api/stripe/finalize-payment`, JSON.stringify({ sessionId: "nie-sesja" }));
    ok("strona powrotu: zły numer sesji odrzucony (400)", fin.status === 400, `status ${fin.status}`);
    ok("numer sesji zapisany przy subskrypcji", sql(`SELECT stripe_checkout_session_id FROM subscriptions WHERE user_id='${userId}'`) === sesjaPierwsza);

    // 4. przedłużenie, gdy dostęp jeszcze trwa: +30 dni od końca obecnego
    sql(`UPDATE subscriptions SET end_date = now() + interval '10 days' WHERE user_id='${userId}'`);
    r = await wyslij(zdarzenie("checkout.session.completed"));
    const doKonca = Number(sql(`SELECT round(extract(epoch FROM max(end_date) - now())/86400) FROM subscriptions WHERE user_id='${userId}' AND status='active'`));
    ok("przedłużenie: 10 dni zostało + 30 = 40", r.status === 200 && doKonca === 40, `dni do końca ${doKonca}`);

    // 5. gość: konto dopiero po płatności
    const gosc = `stripe-e2e-gosc-${Date.now()}@helloekg.test`;
    r = await post(`${Z}/api/stripe/guest-checkout`, JSON.stringify({ email: gosc, planId }));
    ok("zakup gościa przed płatnością: konto nie powstaje", sql(`SELECT count(*) FROM users WHERE email='${gosc}'`) === "0", `status ${r.status}`);
    r = await wyslij(zdarzenie("checkout.session.completed", true, nowaSesja(), { guestEmail: gosc, planId, durationDays: "30" }));
    const g = sql(`SELECT u.email_verified, count(s.id) FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id AND s.status='active' WHERE u.email='${gosc}' GROUP BY u.email_verified`);
    ok("po płatności gościa: konto niepotwierdzone z dostępem", r.status === 200 && g === "f|1", g);
    const tok = crypto.randomBytes(16).toString("hex");
    sql(`UPDATE users SET password_reset_token='${crypto.createHash("sha256").update(tok).digest("hex")}', password_reset_expiry=now()+interval '1 hour' WHERE email='${gosc}'`);
    const noweHaslo = crypto.randomBytes(12).toString("base64url");
    r = await post(`${Z}/api/auth/reset-password`, JSON.stringify({ token: tok, password: noweHaslo, confirmPassword: noweHaslo }));
    ok("ustawienie hasła z maila potwierdza adres", r.status === 200 && sql(`SELECT email_verified FROM users WHERE email='${gosc}'`) === "t", `status ${r.status}`);
    sql(`DELETE FROM users WHERE email='${gosc}'`);

    // 6. przejęcie: ktoś zakłada konto na cudzy adres (niepotwierdzone), właściciel kupuje jako gość
    const ofiara = `stripe-e2e-ofiara-${Date.now()}@helloekg.test`, hasloNapastnika = crypto.randomBytes(12).toString("base64url");
    const napastnik = await (await br.newContext()).newPage(); await napastnik.goto(Z + "/");
    const zalogowany = await napastnik.evaluate(async ({ email, haslo }) => {
      await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true }) });
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo }) });
      return r.ok;
    }, { email: ofiara, haslo: hasloNapastnika });
    sql(`UPDATE users SET email_verified=false WHERE email='${ofiara}'`);
    r = await wyslij(zdarzenie("checkout.session.completed", true, nowaSesja(), { guestEmail: ofiara, planId, durationDays: "30" }));
    const me = await napastnik.evaluate(async () => (await fetch("/api/auth/me")).status);
    const loginStary = await napastnik.evaluate(async ({ email, haslo }) => (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo }) })).status, { email: ofiara, haslo: hasloNapastnika });
    ok("zakup gościa na niepotwierdzone konto: napastnik wylogowany i bez hasła", zalogowany && r.status === 200 && me === 401 && loginStary === 401, `zalogowany ${zalogowany}, me ${me}, login ${loginStary}`);
    ok("dostęp przypisany do adresu (hasło ustawi właściciel z maila)", sql(`SELECT count(*) FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE u.email='${ofiara}' AND s.status='active'`) === "1");
    sql(`DELETE FROM users WHERE email='${ofiara}'`);

    // 7. certyfikat: stan potwierdzenia adresu w uprawnieniach
    sql(`UPDATE users SET email_verified=false WHERE id='${userId}'`);
    const el = await pg.evaluate(async () => (await fetch("/api/certificates/eligibility")).json());
    ok("certyfikat: uprawnienia mówią o niepotwierdzonym adresie", el.emailVerified === false && typeof el.email === "string" && el.email.length > 0, JSON.stringify(el).slice(0, 120));
  } catch (e) {
    ok("przebieg", false, e.message.split("\n")[0]);
  } finally {
    if (userId) sql(`DELETE FROM users WHERE id='${userId}'`); else sql(`DELETE FROM users WHERE email='${email}'`);
    sql(`DELETE FROM users WHERE email LIKE 'stripe-e2e-%@helloekg.test'`);
    if (planId) sql(`DELETE FROM subscriptions WHERE plan_id='${planId}'; DELETE FROM plans WHERE id='${planId}'`);
    await br.close();
  }
  console.log(wyn.join("\n"));
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
