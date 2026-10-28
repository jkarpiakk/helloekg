// Regresje bezpieczeństwa (przegląd 28.10): limity zapytań niezależne od wielkości liter i „/” na końcu,
// CSRF także dla „/API/…”, blokada logowania na e-mail + sieć (napastnik nie zablokuje właściciela z innej sieci),
// limit maili na adres, rozmiar odpowiedzi w quizie, zgłoszenia do supportu, uploady obiektów tylko dla recenzentów,
// błędy bazy bez szczegółów. Konto tymczasowe w helloekg_kurs_dev, kasowane na końcu.
const { execSync } = require("child_process");
const crypto = require("crypto");
const B = process.env.BASE || "http://localhost:5055";
const DB = process.env.DB || "helloekg_kurs_dev";
const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();
const H = (xff, extra = {}) => ({ "Content-Type": "application/json", Origin: B, "X-Forwarded-For": xff, ...extra });
const post = (path, body, xff = "10.9.0.1", extra = {}) => fetch(B + path, { method: "POST", headers: H(xff, extra), body: JSON.stringify(body) });

(async () => {
  const email = `bezp-e2e-${Date.now()}@helloekg.test`, haslo = crypto.randomBytes(12).toString("base64url");
  sql("DELETE FROM rate_limit_store");
  try {
    // konto tymczasowe + sesja
    let r = await post("/api/auth/register", { email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true }, "10.9.0.2");
    const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
    ok("konto tymczasowe", r.status === 201 && !!cookie, `status ${r.status}`);

    // 1. limit zapytań: wariant ścieżki dzieli licznik
    const a = await post("/api/auth/forgot-password", { email: "nikt-1@helloekg.test" }, "10.9.1.1");
    const b = await post("/API/Auth/Forgot-Password/", { email: "nikt-2@helloekg.test" }, "10.9.1.1");
    const ra = Number(a.headers.get("x-ratelimit-remaining")), rb = Number(b.headers.get("x-ratelimit-remaining"));
    ok("limit: „/API/Auth/Forgot-Password/” liczy się razem z „/api/auth/forgot-password”", rb === ra - 1, `pozostało ${ra} → ${rb}`);

    // 2. CSRF dla wielkich liter: POST bez Origin odrzucony
    r = await fetch(B + "/API/auth/logout", { method: "POST", headers: { Cookie: cookie } });
    ok("CSRF: „/API/auth/logout” bez Origin → 403", r.status === 403, `status ${r.status}`);

    // 3. blokada logowania na e-mail + sieć
    for (let i = 0; i < 10; i++) await post("/api/auth/login", { email, password: "zle-haslo-123" }, "10.9.2.1");
    r = await post("/api/auth/login", { email, password: haslo }, "10.9.2.1");
    ok("10 złych haseł z jednej sieci blokuje tę sieć", r.status === 429, `status ${r.status}`);
    r = await post("/api/auth/login", { email, password: haslo }, "10.9.3.1");
    ok("właściciel z innej sieci loguje się mimo ataku", r.status === 200, `status ${r.status}`);

    // 4. limit maili na adres: 4. prośba o reset nie nadpisuje tokenu
    const tok = () => sql(`SELECT coalesce(password_reset_token,'') FROM users WHERE email='${email}'`);
    for (let i = 0; i < 3; i++) await post("/api/auth/forgot-password", { email }, `10.9.4.${i + 1}`);
    const t3 = tok();
    r = await post("/api/auth/forgot-password", { email }, "10.9.4.9");
    const j = await r.json();
    ok("4. reset w godzinie: ta sama odpowiedź, token bez zmian", r.status === 200 && /Jeśli konto/.test(j.message) && tok() === t3 && t3 !== "", `status ${r.status}`);

    // 5. odpowiedź w quizie: rozmiar
    const q = sql("SELECT id FROM questions WHERE status='published' LIMIT 1");
    r = await post("/api/quiz/answer", { questionId: q, timeMs: 1000, answerData: { values: ["x".repeat(5000)] } }, "10.9.5.1", { Cookie: cookie });
    ok("quiz: zbyt duża odpowiedź → 400", r.status === 400, `status ${r.status}`);
    r = await post("/api/quiz/answer", { questionId: "nie-uuid", timeMs: 1000, selectedIndex: 0 }, "10.9.5.1", { Cookie: cookie });
    const tx = await r.text();
    ok("quiz: błąd bazy bez szczegółów", !/invalid input syntax|uuid/i.test(tx), `${r.status} ${tx.slice(0, 80)}`);

    // 6. support: typy i długości
    r = await post("/api/support/tickets", { subject: "x".repeat(300), message: "test" }, "10.9.6.1");
    ok("support: temat ponad 200 znaków → 400", r.status === 400, `status ${r.status}`);
    r = await post("/api/support/tickets", { subject: ["a"], message: { x: 1 } }, "10.9.6.1");
    ok("support: nie-tekst → 400", r.status === 400, `status ${r.status}`);

    // 7. uploady obiektów: kursant nie może
    r = await post("/api/objects/upload", {}, "10.9.7.1", { Cookie: cookie });
    ok("upload obiektu przez kursanta → 403", r.status === 403, `status ${r.status}`);
    r = await fetch(B + "/api/lecture-images", { method: "PUT", headers: H("10.9.7.1", { Cookie: cookie }), body: JSON.stringify({ imageURL: "x" }) });
    ok("publikacja obrazu przez kursanta → 403", r.status === 403, `status ${r.status}`);
  } catch (e) {
    ok("przebieg", false, e.message.split("\n")[0]);
  } finally {
    sql(`DELETE FROM users WHERE email='${email}'; DELETE FROM rate_limit_store`);
  }
  console.log(wyn.join("\n"));
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
