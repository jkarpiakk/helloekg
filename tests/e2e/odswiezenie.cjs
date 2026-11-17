/**
 * npm run e2e:odswiezenie — Z-123: odświeżenie strony w połowie zestawu nauki/powtórki zachowuje
 * numer pytania, wynik i kolejność odpowiedzi A-D (sessionStorage + cache zapytań, QuizInterface).
 * Scenariusz (lustro, konto tymczasowe, 390 px): powtórka z 4 pytań wyboru, odpowiedź na 1 i 2, na 3 nic;
 * zapamiętaj pozycję i teksty A-D, odśwież, porównaj; odpowiedz do końca i sprawdź licznik w podsumowaniu.
 * Zakłada konto tymczasowe, dlatego odmawia pracy na bazie produkcyjnej.
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const crypto = require("crypto");

const BASE = process.env.BASE || "http://localhost:5068";
const DB = process.env.DB || "helloekg_kurs_lustro";
if (DB === "helloekg_kurs" || /kurs\.helloekg\.pl/.test(BASE)) {
  console.error("Ten test zakłada konto tymczasowe: tylko na lustrze (scripts/lustro-prod.sh), nigdy na produkcji.");
  process.exit(2);
}
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();
const H = { "X-Forwarded-Proto": "https", Origin: BASE };

(async () => {
  const ids = sql(`select string_agg(id::text, ',') from (select id from questions where status='published' and pool='practice'
    and coalesce(question_type,'multiple_choice')='multiple_choice' and body_md not like '%::wstawka%' and image_url is null order by id limit 4) x`).split(",");
  const email = `e2e-odsw-${Date.now()}@helloekg.test`, haslo = `E2e-${crypto.randomBytes(6).toString("hex")}`;
  sql("DELETE FROM rate_limit_store");
  const rej = await fetch(`${BASE}/api/auth/register`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ firstName: "Test", email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true }) });
  if (!rej.ok) throw new Error(`rejestracja: ${rej.status}`);
  const uid = sql(`UPDATE users SET email_verified = true, tester_bety = true WHERE email = '${email}' RETURNING id`);
  sql(`INSERT INTO attempts (user_id, question_id, selected_index, is_correct, time_ms, mode) SELECT '${uid}', id, 0, false, 1000, 'learn' FROM questions WHERE id IN (${ids.map((i) => `'${i}'`).join(",")})`);
  const bledy = [];
  const br = await chromium.launch();
  try {
    const page = await (await br.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "X-Forwarded-Proto": "https" } })).newPage();
    await page.goto(`${BASE}/`);
    await page.evaluate(async ([e, h]) => { await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: h }) }); }, [email, haslo]);
    sql("DELETE FROM rate_limit_store");
    await page.goto(`${BASE}/quiz?mode=review&ids=${ids.join(",")}`);
    const pozycja = () => page.locator('[data-testid="quiz-position"]').innerText();
    const odpowiedzi = () => page.locator('[data-testid^="answer-option-"]').allInnerTexts();
    const odpowiedz = async () => {
      await page.waitForSelector('[data-testid="answer-option-0"]');
      await page.click('[data-testid="answer-option-0"]');
      await page.waitForSelector('[data-testid="next-question"]');
      await page.click('[data-testid="next-question"]');
      await page.waitForTimeout(900);
    };
    await odpowiedz();
    await odpowiedz();
    await page.waitForSelector('[data-testid="answer-option-0"]');
    const przed = { poz: await pozycja(), odp: await odpowiedzi(), tytul: await page.locator('[data-testid="question-title"], [data-testid="question-body"]').first().innerText() };
    await page.reload();
    await page.waitForSelector('[data-testid="answer-option-0"]', { timeout: 20000 });
    const po = { poz: await pozycja(), odp: await odpowiedzi(), tytul: await page.locator('[data-testid="question-title"], [data-testid="question-body"]').first().innerText() };
    if (po.poz !== przed.poz) bledy.push(`pozycja: przed „${przed.poz}”, po „${po.poz}”`);
    if (po.tytul !== przed.tytul) bledy.push("po odświeżeniu inne pytanie");
    if (JSON.stringify(po.odp) !== JSON.stringify(przed.odp)) bledy.push("kolejność A-D zmieniona");
    await odpowiedz();
    await odpowiedz();
    await page.waitForSelector("dl dd", { timeout: 15000 });
    const pola = await page.locator("dl dt").allInnerTexts(), wart = await page.locator("dl dd").allInnerTexts();
    const suma = pola.reduce((n, p, i) => (/poprawne|błędne|częściowo/i.test(p) ? n + Number(wart[i]) : n), 0);
    if (suma !== 4) bledy.push(`podsumowanie liczy ${suma} odpowiedzi zamiast 4 (${pola.map((p, i) => `${p} ${wart[i]}`).join(", ")})`);
    console.log(`pozycja ${przed.poz} → ${po.poz}; A-D ${JSON.stringify(po.odp) === JSON.stringify(przed.odp) ? "bez zmian" : "ZMIENIONE"}; podsumowanie: ${suma} z 4`);
  } finally {
    await br.close();
    try { sql(`DELETE FROM users WHERE id='${uid}'`); } catch { /* konto zostaje w lustrze */ }
  }
  if (bledy.length) { console.error("BŁĘDY:\n- " + bledy.join("\n- ")); process.exit(1); }
  console.log("OK: odświeżenie zachowuje stan zestawu");
})().catch((e) => { console.error(e); process.exit(2); });
