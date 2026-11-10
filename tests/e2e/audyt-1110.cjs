// Regresje z audytu bezpieczeństwa 10.11.2026 (bez przeglądarki, podgląd :5065 z MAIL_OUTBOX_DIR i bazą testową):
// zmiana hasła (obecne hasło, inne sesje wylogowane, mail), ostatni właściciel nie usuwa sam siebie, ocena tylko
// opublikowanych pytań, zgłoszenie błędu w pytaniu (uuid, istniejące pytanie), zgłoszenie uwagi (jedno naraz,
// ścieżka z tabulatorem odrzucona), ogólny limit API jednym kluczem na adres (losowe ścieżki nie mnożą wierszy).
//   BASE=… DB=… OUTBOX=… ADMIN_HASLO=… node tests/e2e/audyt-1110.cjs
const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const B = process.env.BASE || "http://localhost:5065";
const DB = process.env.DB || "helloekg_kurs_otwarcie";
const OUTBOX = process.env.OUTBOX;
const ADMIN = { email: process.env.ADMIN_EMAIL || "podglad-admin@helloekg.test", password: process.env.ADMIN_HASLO };
if (!OUTBOX || !ADMIN.password) { console.error("Ustaw OUTBOX i ADMIN_HASLO"); process.exit(2); }

const wyn = [];
const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n}${d ? `  (${d})` : ""}`);
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const noweIp = () => `198.51.100.${(n++ % 200) + 20}`;
const req = (method, p, { body, cookie, ip = noweIp(), headers = {} } = {}) =>
  fetch(B + p, {
    method,
    headers: { "Content-Type": "application/json", Origin: B, "X-Forwarded-For": ip, ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const ciastko = (r) => (r.headers.get("set-cookie") || "").split(";")[0];
async function mail(do_, wzor, po) {
  for (let i = 0; i < 40; i++) {
    for (const f of fs.readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort().reverse()) {
      if (Number(f.split("-")[0]) < po) break;
      const m = JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf8"));
      if (m.to === do_ && wzor.test(m.subject + m.text)) return m;
    }
    await sleep(250);
  }
  return null;
}

(async () => {
  const start = Date.now();
  const email = `audyt-${start}@helloekg.test`;
  const haslo = `Audyt-${crypto.randomBytes(9).toString("base64url")}`;
  sql("DELETE FROM rate_limit_store");
  sql(`INSERT INTO app_settings(key,value) VALUES ('dokumenty_opublikowane','true') ON CONFLICT (key) DO UPDATE SET value='true'`);
  await sleep(11000); // ustawienia serwer trzyma w pamięci 10 s
  try {
    // konto
    const przed = Date.now();
    await req("POST", "/api/auth/register", { body: { firstName: "Audyt", email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true } });
    const m = await mail(email, /Potwierdź/, przed);
    const token = /token=([0-9a-f]{64})/.exec(m?.text || "")?.[1];
    let r = await req("POST", "/api/auth/verify-email", { body: { token } });
    ok("konto potwierdzone (POST)", r.status === 200, `status ${r.status}`);
    r = await req("POST", "/api/auth/login", { body: { email, password: haslo } });
    const s1 = ciastko(r);
    r = await req("POST", "/api/auth/login", { body: { email, password: haslo } });
    const s2 = ciastko(r);

    // zmiana hasła
    r = await req("POST", "/api/auth/change-password", { cookie: s1, body: { currentPassword: "zle-haslo-123", newPassword: "Nowe-haslo-1234" } });
    ok("zmiana hasła: złe obecne → 403", r.status === 403, `status ${r.status}`);
    r = await req("POST", "/api/auth/change-password", { cookie: s1, body: { currentPassword: haslo, newPassword: "krotkie" } });
    ok("zmiana hasła: nowe < 10 znaków → 400", r.status === 400, `status ${r.status}`);
    const nowe = `Nowe-${crypto.randomBytes(9).toString("base64url")}`;
    const przed2 = Date.now();
    r = await req("POST", "/api/auth/change-password", { cookie: s1, body: { currentPassword: haslo, newPassword: nowe } });
    ok("zmiana hasła → 200", r.status === 200, `status ${r.status}`);
    ok("ta sesja zostaje", (await req("GET", "/api/auth/me", { cookie: s1 })).status === 200);
    ok("druga sesja wylogowana", (await req("GET", "/api/auth/me", { cookie: s2 })).status === 401);
    ok("mail „hasło zmienione”", !!(await mail(email, /hasło/i, przed2)));
    r = await req("POST", "/api/auth/login", { body: { email, password: nowe } });
    ok("logowanie nowym hasłem", r.status === 200, `status ${r.status}`);

    // ocena tylko opublikowanych pytań
    const szkic = sql("SELECT id FROM questions WHERE status <> 'published' LIMIT 1");
    if (szkic) {
      r = await req("POST", "/api/quiz/answer", { cookie: s1, body: { questionId: szkic, selectedIndex: 0, timeMs: 1000 } });
      ok("kursant: odpowiedź na szkic pytania → 404 (bez poprawnej odpowiedzi)", r.status === 404, `status ${r.status}`);
    } else ok("brak szkicu w bazie testowej (pominięte)", true);

    // zgłoszenie błędu w pytaniu
    r = await req("POST", "/api/report-error", { cookie: s1, body: { questionId: "nie-uuid", message: "test" } });
    ok("report-error: zły identyfikator → 400 (nie 500)", r.status === 400, `status ${r.status}`);
    r = await req("POST", "/api/report-error", { cookie: s1, body: { questionId: crypto.randomUUID(), message: "test" } });
    ok("report-error: nieistniejące pytanie → 404", r.status === 404, `status ${r.status}`);

    // zgłoszenie uwagi: ścieżka z tabulatorem
    const fb = (pagePath) => req("POST", "/api/feedback", { cookie: s1, body: { description: "Test audytu 10.11, proszę zignorować.", area: "inne", type: "dzialanie", pagePath }, headers: { "Content-Type": "application/vnd.helloekg.feedback+json" } });
    r = await fb("/\t/evil.example");
    const zapis = sql(`SELECT coalesce(page_path,'NULL') FROM support_tickets WHERE user_email='${email}' ORDER BY created_at DESC LIMIT 1`);
    ok("zgłoszenie przyjęte, „/\\t/host” nie zostaje zapisane jako ścieżka", r.status === 201 && zapis === "NULL", `status ${r.status}, zapis ${zapis}`);
    // dwa naraz z jednego konta: drugie 429 (zanim serwer przeczyta treść)
    const [a, b] = await Promise.all([fb("/modules"), fb("/modules")]);
    ok("dwa zgłoszenia naraz z jednego konta: jedno 429", [a.status, b.status].includes(429), `${a.status}, ${b.status}`);

    // ogólny limit API: jeden klucz na adres
    const ip = "203.0.113.77";
    for (let i = 0; i < 5; i++) await req("GET", `/api/losowa-${crypto.randomBytes(4).toString("hex")}`, { ip });
    const klucze = sql(`SELECT count(*) FROM rate_limit_store WHERE key LIKE 'api:${ip}%'`);
    ok("losowe ścieżki API: jeden wiersz limitu na adres", klucze === "1", `wierszy ${klucze}`);
    for (let i = 0; i < 3; i++) await req("GET", `/api/losowa-${i}`, { ip: `2001:db8:abcd:12:${i}::1` });
    const v6 = sql(`SELECT count(*) FROM rate_limit_store WHERE key LIKE 'api:2001:db8:abcd:12::/64%'`);
    ok("IPv6: adresy z jednej sieci /64 liczą się razem", v6 === "1", `wierszy ${v6}`);

    // ostatni właściciel
    const wlascicieli = sql("SELECT count(*) FROM users WHERE role='owner'");
    if (wlascicieli === "1" && sql(`SELECT role FROM users WHERE email='${ADMIN.email}'`) === "owner") {
      r = await req("POST", "/api/auth/login", { body: ADMIN });
      const sa = ciastko(r);
      r = await req("DELETE", "/api/auth/account", { cookie: sa, body: { password: ADMIN.password } });
      ok("jedyny właściciel nie usuwa sam siebie → 409", r.status === 409, `status ${r.status}`);
    } else ok(`ostatni właściciel: w bazie ${wlascicieli} właścicieli (pominięte, żeby niczego nie usunąć)`, true);
  } catch (e) {
    ok("wyjątek w teście", false, e.stack);
  } finally {
    sql(`DELETE FROM support_tickets WHERE user_email='${email}'`);
    sql(`DELETE FROM users WHERE email LIKE 'audyt-%@helloekg.test'`);
    sql("DELETE FROM app_settings WHERE key='dokumenty_opublikowane'");
    console.log(wyn.join("\n"));
    const zle = wyn.filter((w) => w.startsWith("FAIL")).length;
    console.log(`\n${wyn.length - zle}/${wyn.length} OK`);
    process.exit(zle ? 1 : 0);
  }
})();
