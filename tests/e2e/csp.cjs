// Egzekwowana CSP (produkcja): przejście przez ekrany kursu i panelu bez naruszeń polityki.
// Uruchamiać na zbudowanej aplikacji (scripts/preview-prod.sh, :5057), bo dev (Vite) ma tylko raport.
// Konta z scripts/preview-seed.md (baza helloekg_kurs_dev). Zbiera zdarzenia securitypolicyviolation
// i komunikaty konsoli o CSP; każde naruszenie = FAIL z adresem zablokowanego zasobu.
const { chromium, devices } = require("playwright");
const { execSync } = require("child_process");
const B = process.env.BASE || "http://localhost:5057";
const DB = process.env.DB || "helloekg_kurs_dev";
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();
const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);

async function zaloguj(pg, email, password) {
  await pg.goto(B + "/");
  return pg.evaluate(async ({ email, password }) => {
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const j = await r.json(); localStorage.setItem("hk:feedback-hint-seen", "1"); localStorage.setItem("hk-tour-v1:" + j.user.id, "done"); return j.user.id;
  }, { email, password });
}

(async () => {
  sql("DELETE FROM rate_limit_store");
  const br = await chromium.launch();
  const naruszenia = [];
  const nowa = async (opt = {}) => {
    // ciasteczko sesji w produkcji jest Secure: express wysyła je tylko za „https” od pośrednika (jak Caddy)
    const ctx = await br.newContext({ ...opt, extraHTTPHeaders: { "X-Forwarded-Proto": "https" } });
    await ctx.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(`${e.violatedDirective} ${e.blockedURI || "inline"} @${location.pathname}`);
      });
    });
    const pg = await ctx.newPage();
    pg.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) naruszenia.push(`konsola: ${m.text().slice(0, 160)} @${pg.url()}`); });
    return pg;
  };
  const zbierz = async (pg) => { const v = await pg.evaluate(() => window.__csp || []).catch(() => []); naruszenia.push(...v); await pg.evaluate(() => { window.__csp = []; }).catch(() => {}); };
  const idz = async (pg, path, czekaj = 1200) => { await pg.goto(B + path, { waitUntil: "networkidle" }); await pg.waitForTimeout(czekaj); await zbierz(pg); };

  try {
    // nagłówek
    const r = await fetch(B + "/");
    const csp = r.headers.get("content-security-policy") || "";
    ok("nagłówek Content-Security-Policy egzekwowany (nie Report-Only)", /script-src 'self' 'sha256-/.test(csp) && !r.headers.get("content-security-policy-report-only"), csp.slice(0, 80));

    // gość: strona główna, logowanie, motyw jasny (skrypt w kodzie strony musi zadziałać)
    let pg = await nowa();
    await idz(pg, "/");
    await pg.evaluate(() => localStorage.setItem("ekg-theme", "light"));
    await idz(pg, "/");
    ok("skrypt motywu działa przy CSP (jasny bez mignięcia)", await pg.evaluate(() => !document.documentElement.classList.contains("dark")));
    await idz(pg, "/forgot-password");

    // kursant: panel, kurs, wszystkie wykłady, pytania wszystkich typów
    pg = await nowa(devices["iPhone 13"]);
    await zaloguj(pg, "podglad@helloekg.test", "Podglad-2026-lokalnie");
    for (const p of ["/dashboard", "/modules", "/zgloszenie", "/certificate/preview"]) await idz(pg, p);
    const sekcje = (await pg.evaluate(async () => (await fetch("/api/modules")).json()))
      .flatMap((m) => m.sections).filter((s) => s.chapterCount > 0).map((s) => s.id);
    for (const id of sekcje) {
      await idz(pg, `/lecture/${id}`, 600);
      // przewinięcie do końca: leniwie ładowane grafiki i wstawki
      await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 900) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
      await pg.waitForTimeout(400); await zbierz(pg);
    }
    ok(`wykłady przejrzane (${sekcje.length})`, sekcje.length > 0);
    const typy = sql("SELECT DISTINCT ON (question_type) id FROM questions WHERE status='published' ORDER BY question_type, id").split("\n").filter(Boolean);
    for (const id of typy) await idz(pg, `/quiz?mode=review&ids=${id}`, 2000);
    ok(`pytania po jednym z każdego typu (${typy.length})`, typy.length > 0);

    // admin: zakładki panelu
    pg = await nowa({ viewport: { width: 1280, height: 900 } });
    await zaloguj(pg, "podglad-admin@helloekg.test", "Podglad-Admin-2026-lokalnie");
    await idz(pg, "/admin", 2000);
    const zakladki = await pg.locator('[role="tab"]').count();
    for (let i = 0; i < zakladki; i++) { await pg.locator('[role="tab"]').nth(i).click().catch(() => {}); await pg.waitForTimeout(900); await zbierz(pg); }
    ok(`panel admina: zakładki (${zakladki})`, zakladki > 0);

    const unikalne = [...new Set(naruszenia)];
    ok("brak naruszeń CSP", unikalne.length === 0, unikalne.slice(0, 8).join("\n      "));
  } catch (e) {
    ok("przebieg", false, e.message.split("\n")[0]);
  } finally {
    await br.close();
  }
  console.log(wyn.join("\n"));
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
