// Otwarcie bety (10.11.2026), bez przeglądarki: zamknięte ścieżki bez konta, rejestracja (zgody, pułapka,
// ta sama odpowiedź dla zajętego adresu), potwierdzenie e-mail (jednorazowe, 24 h), reset hasła (1 h, unieważnia
// sesje, mail „hasło zmienione”), argon2id i przeliczenie starego bcrypt, przełączniki w panelu (rejestracja,
// dokumenty, wyjątki limitów), usunięcie konta przez admina, płatności wyłączone.
//
// Podgląd z MAIL_OUTBOX_DIR (maile jako pliki JSON) i kopią bazy: BASE, DB, OUTBOX, ADMIN_EMAIL, ADMIN_HASLO.
//   BASE=http://localhost:5065 DB=helloekg_kurs_otwarcie OUTBOX=… node tests/e2e/otwarcie.cjs
const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const B = process.env.BASE || "http://localhost:5065";
const DB = process.env.DB || "helloekg_kurs_otwarcie";
const OUTBOX = process.env.OUTBOX;
const ADMIN = { email: process.env.ADMIN_EMAIL || "podglad-admin@helloekg.test", password: process.env.ADMIN_HASLO };
if (!OUTBOX || !ADMIN.password) {
  console.error("Ustaw OUTBOX (MAIL_OUTBOX_DIR podglądu) i ADMIN_HASLO (scripts/preview-seed.md)");
  process.exit(2);
}

const wyn = [];
const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n}${d ? `  (${d})` : ""}`);
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();
const esc = (s) => s.replace(/'/g, "''");
let ipNr = 0;
const noweIp = () => `10.77.${Math.floor(++ipNr / 250)}.${ipNr % 250 + 1}`;
const req = (method, p, { body, cookie, ip = noweIp(), headers = {} } = {}) =>
  fetch(B + p, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: B, "X-Forwarded-For": ip, ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ciastko = (r) => (r.headers.get("set-cookie") || "").split(";")[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Najnowszy mail do adresu (z katalogu MAIL_OUTBOX_DIR) */
function mail(do_, tematRe, poMs) {
  const pliki = fs.readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
  for (const f of pliki.reverse()) {
    if (Number(f.split("-")[0]) < poMs) break;
    const m = JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf8"));
    if (m.to.toLowerCase() === do_.toLowerCase() && tematRe.test(m.subject)) return m;
  }
  return null;
}
const czekajNaMail = async (do_, tematRe, poMs) => {
  for (let i = 0; i < 30; i++) {
    const m = mail(do_, tematRe, poMs);
    if (m) return m;
    await sleep(200);
  }
  return null;
};
const tokenZMaila = (m) => (m && /token=([0-9a-f]{64})/.exec(m.text)?.[1]) || null;

(async () => {
  fs.mkdirSync(OUTBOX, { recursive: true });
  sql("DELETE FROM rate_limit_store");
  const start = Date.now();
  const email = `otwarcie-${start}@helloekg.test`;
  const haslo = `Test-${crypto.randomBytes(9).toString("base64url")}`;
  let adminCookie = "";
  const ustaw = (klucz, wartosc) => req("PUT", "/api/admin/ustawienia", { cookie: adminCookie, body: { klucz, wartosc } });

  try {
    // ── 1. Bez konta: treść zamknięta ────────────────────────────────────────────────────────────
    const plik = sql("SELECT 1"); void plik;
    const grafika = fs.readdirSync(path.join(__dirname, "../../.preview-assets")).find((f) => f.endsWith(".png"));
    const zamkniete = [
      "/api/modules", "/api/sections", "/api/quiz/question?sectionId=x", "/api/progress", "/api/review-queue",
      "/api/lecture-reads", "/api/certificates/my", "/api/certificates/eligibility", "/api/gamification/stats",
      "/api/gamification/achievements", "/api/sections/00000000-0000-0000-0000-000000000000/chapters",
      "/api/exam/question?sessionId=x&index=0", "/api/feedback/mine", "/api/auth/me", "/api/subscription/status",
      "/api/admin/users", "/api/admin/ustawienia", "/api/admin/questions", "/api/admin/feedback", "/api/admin/analytics/learning",
      `/content-assets/${grafika}`,
    ];
    const zle = [];
    for (const p of zamkniete) {
      const r = await req("GET", p);
      if (r.status !== 401) zle.push(`${p}=${r.status}`);
    }
    ok(`bez konta: ${zamkniete.length} ścieżek treści, API i grafik → 401`, zle.length === 0, zle.join(", "));

    const nieMa = ["/api/plans", "/api/stripe/config", "/api/blog", "/api/demo-questions", "/api/home-page-content",
      "/public-objects/x", "/objects/x", "/api/nie-istnieje", "/api/dokumenty/regulamin_bety"];
    const zle2 = [];
    for (const p of nieMa) {
      const r = await req("GET", p);
      const html = (r.headers.get("content-type") || "").includes("text/html");
      // /public-objects i /objects to dziś zwykłe adresy aplikacji (strona 404 w przeglądarce), nie pliki
      if (p.startsWith("/api") ? r.status !== 404 : !html) zle2.push(`${p}=${r.status}`);
    }
    ok("usunięte i wyłączone: API 404 (blog, demo, cennik, Stripe, dokumenty przed publikacją)", zle2.length === 0, zle2.join(", "));

    let r = await req("POST", "/api/support/tickets", { body: { subject: "x", message: "y" } });
    ok("anonimowe zgłoszenie do supportu usunięte → 404", r.status === 404, `status ${r.status}`);
    r = await req("POST", "/api/stripe/checkout", { body: { planId: "x" } });
    ok("checkout przy wyłączonych płatnościach → 404", r.status === 404, `status ${r.status}`);
    r = await req("POST", "/api/stripe/webhook/manual", { body: {}, headers: { "Stripe-Signature": "t=1,v1=x" } });
    ok("webhook bez sekretu (płatności nieskonfigurowane) → 503", r.status === 503, `status ${r.status}`);

    r = await req("GET", "/");
    ok("strona startowa: X-Robots-Tag noindex", /noindex/.test(r.headers.get("x-robots-tag") || ""), r.headers.get("x-robots-tag"));
    r = await req("GET", "/robots.txt");
    ok("robots.txt: Disallow /", /Disallow: \//.test(await r.text()));
    r = await req("GET", "/.well-known/security.txt");
    const st = await r.text();
    ok("security.txt: kontakt i ważność", /Contact: mailto:kontakt@helloekg.pl/.test(st) && /Expires: 20\d\d-/.test(st));

    // ── 2. Admin: przełączniki ───────────────────────────────────────────────────────────────────
    r = await req("POST", "/api/auth/login", { body: ADMIN });
    adminCookie = ciastko(r);
    ok("logowanie właściciela", r.status === 200 && !!adminCookie, `status ${r.status}`);
    r = await req("GET", "/api/dokumenty/regulamin_bety", { cookie: adminCookie });
    const dok = await r.json().catch(() => ({}));
    ok("właściciel czyta projekt regulaminu przed publikacją", r.status === 200 && /Regulamin/.test(dok.tresc || ""), `status ${r.status}`);

    await ustaw("dokumenty_opublikowane", false);
    await ustaw("rejestracja_otwarta", true);
    r = await req("GET", "/api/config");
    let cfg = await r.json();
    ok("config: bez opublikowanych dokumentów rejestracja zamknięta", cfg.rejestracjaOtwarta === false && cfg.platnosci === false);
    const dobre = { firstName: "Ola", email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true };
    r = await req("POST", "/api/auth/register", { body: dobre });
    ok("rejestracja przy nieopublikowanych dokumentach → 403 REGISTRATION_CLOSED", r.status === 403 && (await r.json()).code === "REGISTRATION_CLOSED", `status ${r.status}`);

    await ustaw("dokumenty_opublikowane", true);
    r = await req("GET", "/api/dokumenty/polityka_prywatnosci");
    ok("po publikacji polityka prywatności publiczna", r.status === 200, `status ${r.status}`);
    await ustaw("rejestracja_otwarta", false);
    r = await req("POST", "/api/auth/register", { body: dobre });
    ok("REJESTRACJA_OTWARTA wyłączona → 403", r.status === 403, `status ${r.status}`);
    r = await req("POST", "/api/auth/login", { body: ADMIN });
    ok("…a istniejące konto loguje się dalej", r.status === 200, `status ${r.status}`);
    await ustaw("rejestracja_otwarta", true);
    r = await req("PUT", "/api/admin/ustawienia", { cookie: adminCookie, body: { klucz: "limit_wyjatki_ip", wartosc: ["to-nie-ip"] } });
    ok("ustawienia: zły adres IP odrzucony", r.status === 400, `status ${r.status}`);

    // ── 3. Rejestracja ───────────────────────────────────────────────────────────────────────────
    r = await req("POST", "/api/auth/register", { body: { ...dobre, password: "Krotkie-1", confirmPassword: "Krotkie-1" } });
    ok("hasło 9 znaków → 400", r.status === 400, `status ${r.status}`);
    r = await req("POST", "/api/auth/register", { body: { ...dobre, termsAccepted: false } });
    ok("bez zgody na regulamin → 400", r.status === 400, `status ${r.status}`);
    r = await req("POST", "/api/auth/register", { body: { ...dobre, privacyAccepted: undefined } });
    ok("bez zgody na politykę → 400", r.status === 400, `status ${r.status}`);
    r = await req("POST", "/api/auth/register", { body: { ...dobre, firstName: "" } });
    ok("bez imienia → 400", r.status === 400, `status ${r.status}`);
    const dlugie = "Długie hasło z polskimi znakami żółć ".repeat(8); // ~300 znaków, ponad 72 bajty bcrypt
    const pulapka = `pulapka-${start}@helloekg.test`;
    r = await req("POST", "/api/auth/register", { body: { ...dobre, email: pulapka, website: "http://spam" } });
    ok("pole-pułapka: 201 jak zwykle, ale konta brak", r.status === 201 && sql(`SELECT count(*) FROM users WHERE email='${pulapka}'`) === "0", `status ${r.status}`);

    r = await req("POST", "/api/auth/register", { body: { ...dobre, password: dlugie, confirmPassword: dlugie } });
    const odp1 = await r.json();
    ok("rejestracja → 201, bez sesji", r.status === 201 && !ciastko(r).startsWith("connect.sid"), `status ${r.status}`);
    const u = sql(`SELECT role||'|'||tester_bety||'|'||email_verified||'|'||left(password,10)||'|'||length(email_verification_token)||'|'||round(extract(epoch from email_verification_expiry - timezone('utc', now()))/3600) FROM users WHERE email='${email}'`);
    ok("konto: kursant (student), tester bety, niepotwierdzone, argon2id, token jako skrót, ważny 24 h", u === "student|true|false|$argon2id$|64|24", u);
    const zgody = sql(`SELECT string_agg(document||':'||version, ',' ORDER BY document) FROM user_consents c JOIN users u ON u.id=c.user_id WHERE u.email='${email}'`);
    ok("zgody zapisane z wersją", zgody === "polityka_prywatnosci:1.0,regulamin_bety:1.0", zgody);
    const m1 = await czekajNaMail(email, /Potwierdź adres/, start);
    const t1 = tokenZMaila(m1);
    ok("mail z linkiem potwierdzającym (https adres kursu, token 64 znaki)", !!t1 && m1.text.includes(`${B}/verify-email?token=`) && !/beta=/.test(m1.text));
    ok("token w bazie to skrót, nie jawny token", sql(`SELECT email_verification_token FROM users WHERE email='${email}'`) === crypto.createHash("sha256").update(t1 || "").digest("hex"));

    const przed = Date.now();
    r = await req("POST", "/api/auth/register", { body: { ...dobre, email: email.toUpperCase(), firstName: "Inna" } });
    const odp2 = await r.json();
    ok("zajęty adres (inna wielkość liter): ta sama odpowiedź", r.status === 201 && JSON.stringify(odp1) === JSON.stringify(odp2), `status ${r.status}`);
    ok("…i jedno konto w bazie", sql(`SELECT count(*) FROM users WHERE lower(email)=lower('${email}')`) === "1");
    ok("…a właściciel adresu dostaje „Masz już konto”", !!(await czekajNaMail(email, /Masz już konto/, przed)));

    // ── 4. Niepotwierdzone konto ─────────────────────────────────────────────────────────────────
    r = await req("POST", "/api/auth/login", { body: { email, password: dlugie } });
    let sesja = ciastko(r);
    const lj = await r.json();
    ok("logowanie hasłem dłuższym niż 72 bajty", r.status === 200 && lj.user?.emailVerified === false, `status ${r.status}`);
    r = await req("POST", "/api/auth/login", { body: { email, password: dlugie.slice(0, 72) } });
    ok("…a jego pierwsze 72 znaki nie wystarczą (brak obcięcia bcrypt)", r.status === 401, `status ${r.status}`);
    r = await req("GET", "/api/modules", { cookie: sesja });
    ok("niepotwierdzone: /api/modules → 403 EMAIL_NOT_VERIFIED", r.status === 403 && (await r.json()).code === "EMAIL_NOT_VERIFIED", `status ${r.status}`);
    r = await req("GET", `/content-assets/${grafika}`, { cookie: sesja });
    ok("niepotwierdzone: grafika kursu → 403", r.status === 403, `status ${r.status}`);
    r = await req("GET", "/api/auth/me", { cookie: sesja });
    ok("niepotwierdzone: /api/auth/me działa (ekran „potwierdź e-mail”)", r.status === 200, `status ${r.status}`);

    // ponowne wysłanie: nowy token, stary przestaje działać
    const przed2 = Date.now();
    r = await req("POST", "/api/auth/resend-verification", { body: { email } });
    const t2 = tokenZMaila(await czekajNaMail(email, /Potwierdź adres/, przed2));
    r = await req("POST", "/api/auth/verify-email", { body: { token: t1 } });
    ok("stary link po ponownym wysłaniu → 400", r.status === 400, `status ${r.status}`);
    sql(`UPDATE users SET email_verification_expiry = timezone('utc', now()) - interval '1 minute' WHERE email='${email}'`);
    r = await req("POST", "/api/auth/verify-email", { body: { token: t2 } });
    ok("link po 24 h → 400", r.status === 400, `status ${r.status}`);
    sql(`UPDATE users SET email_verification_expiry = timezone('utc', now()) + interval '1 hour' WHERE email='${email}'`);
    r = await req("POST", "/api/auth/verify-email", { body: { token: t2 } });
    ok("potwierdzenie ważnym linkiem → 200", r.status === 200, `status ${r.status}`);
    r = await req("GET", "/api/auth/me", { cookie: sesja });
    ok("potwierdzenie wylogowuje inne sesje konta (ktoś zalogowany na cudzy adres)", r.status === 401, `status ${r.status}`);
    r = await req("GET", `/api/auth/verify-email?token=${t2}`);
    ok("GET z tokenem niczego nie potwierdza (skaner poczty) → 404", r.status === 404, `status ${r.status}`);
    r = await req("POST", "/api/auth/verify-email", { body: { token: t2 } });
    ok("ten sam link drugi raz → 400 (jednorazowy)", r.status === 400, `status ${r.status}`);
    ok("data potwierdzenia zapisana", sql(`SELECT email_verified_at IS NOT NULL FROM users WHERE email='${email}'`) === "t");
    r = await req("POST", "/api/auth/login", { body: { email, password: dlugie } });
    sesja = ciastko(r);

    r = await req("GET", "/api/modules", { cookie: sesja });
    ok("potwierdzone: kurs otwarty", r.status === 200, `status ${r.status}`);
    r = await req("GET", `/content-assets/${grafika}`, { cookie: sesja });
    ok("potwierdzone: grafika 200, Cache-Control private", r.status === 200 && /private/.test(r.headers.get("cache-control") || ""), `${r.status} ${r.headers.get("cache-control")}`);

    // ── 5. Reset hasła ──────────────────────────────────────────────────────────────────────────
    const nieznany = await (await req("POST", "/api/auth/forgot-password", { body: { email: `nikt-${start}@helloekg.test` } })).json();
    const przed3 = Date.now();
    const znany = await (await req("POST", "/api/auth/forgot-password", { body: { email } })).json();
    ok("reset: ta sama odpowiedź dla nieznanego i znanego adresu", JSON.stringify(nieznany) === JSON.stringify(znany));
    const tr = tokenZMaila(await czekajNaMail(email, /Ustaw nowe hasło/, przed3));
    ok("mail z linkiem do ustawienia hasła", !!tr);
    ok("token resetu ważny 1 h", sql(`SELECT round(extract(epoch from password_reset_expiry - timezone('utc', now()))/60) FROM users WHERE email='${email}'`) === "60");
    r = await req("POST", "/api/auth/reset-password", { body: { token: tr, password: "krotkie", confirmPassword: "krotkie" } });
    ok("reset: hasło za krótkie → 400", r.status === 400, `status ${r.status}`);
    const nowe = `Nowe-${crypto.randomBytes(9).toString("base64url")}`;
    const przed4 = Date.now();
    r = await req("POST", "/api/auth/reset-password", { body: { token: tr, password: nowe, confirmPassword: nowe } });
    ok("reset → 200", r.status === 200, `status ${r.status}`);
    r = await req("GET", "/api/modules", { cookie: sesja });
    ok("po resecie stara sesja nie działa", r.status === 401, `status ${r.status}`);
    ok("mail „hasło zmienione”", !!(await czekajNaMail(email, /zostało zmienione/, przed4)));
    r = await req("POST", "/api/auth/reset-password", { body: { token: tr, password: nowe, confirmPassword: nowe } });
    ok("ten sam link resetu drugi raz → 400", r.status === 400, `status ${r.status}`);
    const przed5 = Date.now();
    await req("POST", "/api/auth/forgot-password", { body: { email } });
    const tr2 = tokenZMaila(await czekajNaMail(email, /Ustaw nowe hasło/, przed5));
    sql(`UPDATE users SET password_reset_expiry = timezone('utc', now()) - interval '1 minute' WHERE email='${email}'`);
    r = await req("POST", "/api/auth/reset-password", { body: { token: tr2, password: nowe, confirmPassword: nowe } });
    ok("link resetu po 1 h → 400", r.status === 400, `status ${r.status}`);
    r = await req("POST", "/api/auth/login", { body: { email, password: nowe } });
    ok("logowanie nowym hasłem", r.status === 200, `status ${r.status}`);

    // ── 6. Stary skrót bcrypt przeliczany na argon2id przy logowaniu ─────────────────────────────
    const bcrypt = require(path.join(__dirname, "../../node_modules/bcrypt"));
    sql(`UPDATE users SET password='${esc(bcrypt.hashSync(nowe, 12))}' WHERE email='${email}'`);
    r = await req("POST", "/api/auth/login", { body: { email, password: nowe } });
    await sleep(300);
    ok("stary bcrypt: logowanie działa i skrót przechodzi na argon2id", r.status === 200 && sql(`SELECT left(password,10) FROM users WHERE email='${email}'`) === "$argon2id$", `status ${r.status}`);

    // ── 7. Wyjątki limitów (pentest) ─────────────────────────────────────────────────────────────
    const ipFirmy = "10.66.6.6";
    await ustaw("limit_wyjatki_ip", [ipFirmy]);
    await ustaw("limit_wyjatki_wlaczone", false);
    let ost = 0;
    for (let i = 0; i < 12; i++) ost = (await req("POST", "/api/auth/login", { body: { email, password: "zle-haslo-xx" }, ip: ipFirmy })).status;
    ok("wyjątki wyłączone: 10 złych haseł blokuje (429)", ost === 429, `ostatni ${ost}`);
    sql("DELETE FROM rate_limit_store");
    await ustaw("limit_wyjatki_wlaczone", true);
    for (let i = 0; i < 25; i++) ost = (await req("POST", "/api/auth/login", { body: { email, password: "zle-haslo-xx" }, ip: ipFirmy })).status;
    ok("wyjątki włączone: 25 prób z IP firmy bez 429", ost === 401, `ostatni ${ost}`);
    for (let i = 0; i < 12; i++) ost = (await req("POST", "/api/auth/login", { body: { email, password: "zle-haslo-xx" }, ip: "10.66.6.7" })).status;
    ok("…a inny adres dalej ma limit", ost === 429, `ostatni ${ost}`);
    await ustaw("limit_wyjatki_wlaczone", false);
    await ustaw("limit_wyjatki_ip", []);
    sql("DELETE FROM rate_limit_store");

    // ── 8. Usunięcie konta przez admina (RODO) ───────────────────────────────────────────────────
    const id = sql(`SELECT id FROM users WHERE email='${email}'`);
    sql(`INSERT INTO support_tickets (user_id, user_email, user_name, subject, message, kind) VALUES ('${id}', '${email}', 'Ola', 'test', 'test', 'feedback')`);
    const przed6 = Date.now();
    r = await req("DELETE", `/api/admin/users/${id}`, { cookie: adminCookie, body: { powiadom: true } });
    ok("admin usuwa konto → 200", r.status === 200, `status ${r.status}`);
    ok("konto, zgody i sesje usunięte", sql(`SELECT (SELECT count(*) FROM users WHERE id='${id}')||'|'||(SELECT count(*) FROM user_consents WHERE user_id='${id}')||'|'||(SELECT count(*) FROM session WHERE sess::jsonb->>'userId'='${id}')`) === "0|0|0");
    ok("zgłoszenie zostaje bez danych osobowych", sql(`SELECT count(*) FROM support_tickets WHERE user_email='${email}'`) === "0");
    ok("mail z potwierdzeniem usunięcia", !!(await czekajNaMail(email, /usunięte/, przed6)));
    const adminId = sql(`SELECT id FROM users WHERE email='${ADMIN.email}'`);
    r = await req("DELETE", `/api/admin/users/${adminId}`, { cookie: adminCookie, body: {} });
    ok("admin nie usuwa własnego konta → 403", r.status === 403, `status ${r.status}`);
  } catch (e) {
    ok("wyjątek w teście", false, e.stack);
  } finally {
    sql(`DELETE FROM users WHERE email LIKE 'otwarcie-%@helloekg.test' OR email LIKE 'pulapka-%@helloekg.test'`);
    sql(`DELETE FROM support_tickets WHERE user_email LIKE 'otwarcie-%@helloekg.test' OR (subject='test' AND user_email LIKE 'usuniete-konto@%')`);
    sql("DELETE FROM rate_limit_store");
    if (adminCookie) {
      await ustaw("dokumenty_opublikowane", false).catch(() => {});
      await ustaw("limit_wyjatki_wlaczone", false).catch(() => {});
    }
    console.log(wyn.join("\n"));
    const zle = wyn.filter((w) => w.startsWith("FAIL")).length;
    console.log(`\n${wyn.length - zle}/${wyn.length} OK`);
    process.exit(zle ? 1 : 0);
  }
})();
