// Certyfikat: postęp „X z Y tematów” → po opanowaniu wszystkich formularz imienia i nazwiska
// (walidacja) → odbiór → arkusz z nazwiskiem, druk na jednej stronie A4. Konto tymczasowe, kasowane na końcu.
const { chromium, devices } = require("playwright");
const { execSync } = require("child_process");
const crypto = require("crypto");
const B = process.env.BASE || "http://localhost:5055";
const DB = process.env.DB || "helloekg_kurs_dev";
const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();

(async () => {
  const email = `certyfikat-e2e-${Date.now()}@helloekg.test`;
  const haslo = crypto.randomBytes(12).toString("base64url");
  sql("DELETE FROM rate_limit_store");
  const br = await chromium.launch();
  try {
    for (const [nazwa, opt] of [["telefon", { ...devices["iPhone 13"] }], ["komputer", { viewport: { width: 1280, height: 900 } }]]) {
      const pg = await (await br.newContext(opt)).newPage(); const err = []; pg.on("pageerror", (e) => err.push(e.message));
      await pg.goto(B + "/");
      const id = await pg.evaluate(async ({ email, haslo, nowe }) => {
        if (nowe) await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true }) });
        const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo }) });
        const j = await r.json(); localStorage.setItem("hk:feedback-hint-seen", "1"); localStorage.setItem("hk-tour-v1:" + j.user.id, "done"); return j.user.id;
      }, { email, haslo, nowe: nazwa === "telefon" });

      if (nazwa === "telefon") {
        await pg.goto(`${B}/dashboard`, { waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
        const t = await pg.locator('[data-testid="certificate-progress"]').innerText().catch(() => "");
        ok(`${nazwa}: postęp do certyfikatu „0 z N”`, /^CERTYFIKAT\s+0 z \d+ tematów opanowanych/i.test(t.replace(/\n/g, " ")), t.slice(0, 50).replace(/\n/g, " "));
        // wszystkie tematy z pytaniami opanowane
        sql(`INSERT INTO progress (user_id, section_id, completion_percentage) SELECT '${id}', s.id, 100 FROM sections s WHERE EXISTS (SELECT 1 FROM questions q WHERE q.section_id = s.id AND q.status = 'published')`);
        await pg.goto(`${B}/dashboard`, { waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
        const widac = await pg.locator('[data-testid="certificate-claim"]').isVisible();
        ok(`${nazwa}: formularz odbioru po opanowaniu`, widac, widac ? "" : JSON.stringify(await pg.evaluate(async () => (await fetch("/api/certificates/eligibility")).json())));
        if (!widac) { await pg.screenshot({ path: "certyfikat-blad.png", fullPage: true }); throw new Error("brak formularza"); }
        await pg.fill('[data-testid="cert-first-name"]', "Z0fia"); await pg.fill('[data-testid="cert-last-name"]', "Wąsowicz-Żak");
        await pg.click('[data-testid="button-generate-certificate"]'); await pg.waitForTimeout(1000);
        const alert = await pg.locator('[data-testid="certificate-claim"] [role="alert"]').innerText().catch(() => "");
        ok(`${nazwa}: cyfra w imieniu odrzucona`, /Sprawdź imię/.test(alert), alert);
        await pg.fill('[data-testid="cert-first-name"]', "Zofia");
        await pg.click('[data-testid="button-generate-certificate"]'); await pg.waitForURL(/\/certificate\/EKG-/, { timeout: 10000 }).catch(() => {});
        ok(`${nazwa}: po odbiorze strona certyfikatu`, /\/certificate\/EKG-[0-9A-F]{8}-[0-9A-F]{8}$/.test(pg.url()), pg.url());
      } else {
        await pg.goto(`${B}/dashboard`, { waitUntil: "networkidle" }); await pg.waitForTimeout(1200);
        ok(`${nazwa}: w Postępie „Twój certyfikat jest gotowy”`, await pg.locator('[data-testid="button-view-certificate"]').isVisible());
        await pg.click('[data-testid="button-view-certificate"]'); await pg.waitForURL(/\/certificate\//);
      }
      await pg.waitForTimeout(1500);
      const imie = await pg.locator(".cert-sheet").first().evaluate((s) => [...s.querySelectorAll("text")].map((t) => t.textContent).includes("Zofia Wąsowicz-Żak"));
      ok(`${nazwa}: imię i nazwisko na arkuszu`, imie);
      await pg.screenshot({ path: `certyfikat-${nazwa}.png` });
      if (nazwa === "komputer") {
        await pg.emulateMedia({ media: "print" });
        await pg.pdf({ path: "certyfikat.pdf", preferCSSPageSize: true, printBackground: true });
        const strony = (require("fs").readFileSync("certyfikat.pdf", "latin1").match(/\/Count (\d+)/) || [])[1];
        ok(`${nazwa}: druk na jednej stronie`, strony === "1", `stron: ${strony}`);
      }
      ok(`${nazwa}: brak przewijania w bok`, !(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      ok(`${nazwa}: bez błędów JS`, err.length === 0, err.slice(0, 2).join(" | "));
    }
  } catch (e) {
    ok("przebieg", false, e.message.split("\n")[0]);
  } finally {
    sql(`DELETE FROM users WHERE email = '${email}'`);
    await br.close();
  }
  console.log(wyn.join("\n"));
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
