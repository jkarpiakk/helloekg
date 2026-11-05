// Wykłady S7 po synchronizacji: każda grafika ładuje się, „Fala na rondzie” działa, CSP niczego nie blokuje.
// Uruchamiać na zbudowanej aplikacji (scripts/preview-prod.sh, :5057). EKS = katalog rozpakowanego eksportu studia.
const { chromium, devices } = require("playwright");
const fs = require("fs");
const { execSync } = require("child_process");
const B = process.env.BASE || "http://localhost:5057";
const lectures = JSON.parse(fs.readFileSync(`${process.env.EKS}/lectures.json`, "utf8")).filter((l) => /^S7_0/.test(l.externalId));
const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);

(async () => {
  execSync(`ssh helloekg-studio "sudo -u postgres psql -d helloekg_kurs_dev -Atq"`, { input: "DELETE FROM rate_limit_store" });
  const br = await chromium.launch();
  for (const [nazwa, opt] of [["telefon", devices["iPhone 13"]], ["komputer", { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await br.newContext({ ...opt, extraHTTPHeaders: { "X-Forwarded-Proto": "https" } });
    await ctx.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => { (window.__csp = window.__csp || []).push(`${e.violatedDirective} ${e.blockedURI}`); });
    });
    const pg = await ctx.newPage();
    const bledy = []; pg.on("pageerror", (e) => bledy.push(e.message));
    await pg.goto(B + "/");
    await pg.evaluate(async () => {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "podglad@helloekg.test", password: "Podglad-2026-lokalnie" }) });
      const j = await r.json(); localStorage.setItem("hk:feedback-hint-seen", "1"); localStorage.setItem("hk-tour-v1:" + j.user.id, "done");
    });
    const sekcje = (await pg.evaluate(async () => (await fetch("/api/modules")).json())).flatMap((m) => m.sections);
    for (const l of lectures) {
      const s = sekcje.find((x) => x.title === l.title);
      if (!s) { ok(`${nazwa}: ${l.externalId} jest w kursie`, false); continue; }
      const oczekiwane = new Set((l.contentMdApp.match(/assets\/[0-9a-f]{64}\.png/g) || [])).size;
      // wykład pokazuje jeden rozdział naraz: przechodzimy po wszystkich
      const rozdzialy = (l.contentMdApp.match(/^## /gm) || []).length;
      const st = { obrazy: 0, puste: 0, bezAlt: 0, surowe: false, szerzej: false, wstawki: [] };
      const zrodla = new Set();
      let rondoNr = 0;
      for (let r = 1; r <= rozdzialy; r++) {
        await pg.goto("about:blank");
        await pg.goto(`${B}/lecture/${s.id}#rozdzial-${r}`, { waitUntil: "networkidle" });
        await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((q) => setTimeout(q, 100)); } });
        await pg.waitForTimeout(700);
        const t = await pg.evaluate(() => {
          const im = [...document.querySelectorAll("main img")].filter((i) => i.src.includes("/content-assets/"));
          return {
            src: im.map((i) => i.src), puste: im.filter((i) => !i.complete || !i.naturalWidth).length, bezAlt: im.filter((i) => !i.alt).length,
            surowe: /::grafika|::wstawka|GFX-\d{4}/.test(document.querySelector("main")?.innerText || ""),
            szerzej: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            wstawki: [...document.querySelectorAll('[data-testid="wstawka-otwarta"]')].map((e) => e.dataset.wstawka),
          };
        });
        t.src.forEach((x) => zrodla.add(x));
        st.puste += t.puste; st.bezAlt += t.bezAlt; st.surowe ||= t.surowe; st.szerzej ||= t.szerzej; st.wstawki.push(...t.wstawki);
        if (t.wstawki.includes("rondo")) rondoNr = r;
      }
      st.obrazy = zrodla.size;
      ok(`${nazwa}: ${l.externalId} grafiki ${st.obrazy}/${oczekiwane}`, st.obrazy === oczekiwane && st.puste === 0 && st.bezAlt === 0, st.puste ? `puste ${st.puste}` : "");
      ok(`${nazwa}: ${l.externalId} bez surowych dyrektyw, bez przewijania w bok`, !st.surowe && !st.szerzej);
      if (l.externalId === "S7_01") {
        ok(`${nazwa}: S7_01 ma wstawkę rondo`, st.wstawki.includes("rondo"), JSON.stringify(st.wstawki));
        await pg.goto("about:blank");
        await pg.goto(`${B}/lecture/${s.id}#rozdzial-${rondoNr}`, { waitUntil: "networkidle" });
        const w = pg.locator('[data-wstawka="rondo"]');
        await w.scrollIntoViewIfNeeded(); await pg.waitForTimeout(1500);
        ok(`${nazwa}: rondo zamontowane`, await w.locator(".hw").count() > 0);
        await w.getByRole("button", { name: "Puść falę" }).click(); await pg.waitForTimeout(1500);
        await w.getByRole("button", { name: "Trzy warunki" }).click(); await pg.waitForTimeout(600);
        await w.getByRole("button", { name: "Zapalnik" }).click(); await pg.waitForTimeout(600);
        ok(`${nazwa}: rondo przełącza etapy bez błędu`, bledy.length === 0, bledy[0] || "");
        await w.screenshot({ path: `${process.env.WYN || "."}/rondo-${nazwa}.png` });
      }
    }
    const csp = await pg.evaluate(() => window.__csp || []);
    ok(`${nazwa}: brak naruszeń CSP i błędów strony`, csp.length === 0 && bledy.length === 0, [...csp, ...bledy].slice(0, 3).join(" | "));
    await ctx.close();
  }
  await br.close();
  console.log(wyn.join("\n"));
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
