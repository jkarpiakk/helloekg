// Pytania „Uzupełnij luki”: pole stoi w miejscu znacznika {{blank:<id>}}, nie na początku tekstu,
// bez surowych znaczników; po sprawdzeniu „Poprawnie: …” przy swojej luce; „0,3” i „0.3” w zakresie uznane.
// Zrzuty: luki-<urządzenie>-<pytanie>.png w bieżącym katalogu.
const { chromium, devices } = require("playwright");
const { execSync } = require("child_process");
const B = process.env.BASE || "http://localhost:5055";
const DB = process.env.DB || "helloekg_kurs_dev";
const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);
// Q-0044 i Q-0034 z polecenia + po jednym z każdej sekcji
const KODY = ["Q-0044", "Q-0034", "Q-INT-00-FB-01", "Q-0100", "Q-0105", "Q-INT-03-FB-01", "Q-0130", "Q-0155", "Q-0175"];
const ZRZUTY = new Set(["Q-0044", "Q-0034", "Q-INT-00-FB-01"]);
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();

const pytania = KODY.map((k) => {
  const [id, cfg] = sql(`SELECT id || '|' || (question_config->'config')::text FROM questions WHERE tags::text LIKE '%"studio:${k}"%' AND status='published'`).split(/\|(.*)/s);
  return { kod: k, id, cfg: JSON.parse(cfg) };
});

(async () => {
  const br = await chromium.launch();
  for (const [nazwa, opt] of [["telefon", { ...devices["iPhone 13"] }], ["komputer", { viewport: { width: 1280, height: 900 } }]]) {
    const pg = await (await br.newContext(opt)).newPage(); const err = []; pg.on("pageerror", (e) => err.push(e.message));
    await pg.goto(B + "/");
    const me = await pg.evaluate(async () => {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "podglad@helloekg.test", password: "Podglad-2026-lokalnie" }) });
      const j = await r.json(); localStorage.setItem("hk:feedback-hint-seen", "1"); localStorage.setItem("hk-tour-v1:" + j.user.id, "done"); return j.user.id;
    });
    for (const p of pytania) {
      // tryb powtórki potrzebuje wcześniejszej próby
      sql(`INSERT INTO attempts (id,user_id,question_id,selected_index,is_correct,time_ms,mode,created_at) SELECT gen_random_uuid(),'${me}','${p.id}',0,false,1000,'learn',now() WHERE NOT EXISTS (SELECT 1 FROM attempts WHERE user_id='${me}' AND question_id='${p.id}')`);
      await pg.goto(`${B}/quiz?mode=review&ids=${p.id}`, { waitUntil: "networkidle" });
      const t = pg.locator('[data-testid="fill-blank-text"]'); await t.waitFor({ timeout: 15000 }).catch(() => {});
      const znaczniki = [...p.cfg.template.matchAll(/\{\{blank:([^}]+)\}\}/g)].map((m) => m[1]);
      const tekst = await t.innerText().catch(() => "");
      ok(`${nazwa} ${p.kod}: bez surowych {{blank:…}}`, !!tekst && !/\{\{blank/.test(tekst));
      const kolejnosc = await t.locator("input").evaluateAll((es) => es.map((e) => e.dataset.testid.replace("blank-input-", "")));
      ok(`${nazwa} ${p.kod}: pola w kolejności znaczników`, JSON.stringify(kolejnosc) === JSON.stringify(znaczniki), JSON.stringify(kolejnosc));
      const zwykly = await t.evaluate((el) => [...el.children].filter((c) => !c.querySelector("input")).map((c) => c.textContent).join(""));
      ok(`${nazwa} ${p.kod}: tekst wokół pól nierozcięty`, zwykly === p.cfg.template.replace(/\{\{blank:[^}]+\}\}/g, ""));
      const przed = await t.evaluate((el) => { const i = [...el.children].findIndex((c) => c.querySelector("input")); return [...el.children].slice(0, i).map((c) => c.textContent).join(""); });
      ok(`${nazwa} ${p.kod}: pierwsze pole po tekście, nie na początku`, przed === p.cfg.template.split(/\{\{blank:/)[0], JSON.stringify(przed.slice(-25)));

      // Q-0044: dobre odpowiedzi z kropką i przecinkiem; reszta: zła odpowiedź → „Poprawnie” przy luce
      const dobre = p.kod === "Q-0044" ? (nazwa === "telefon" ? { ii_mv: "0,3", ii_mm: "3" } : { ii_mv: "0.3", ii_mm: "3,0" }) : null;
      for (const id of znaczniki) await pg.fill(`[data-testid="blank-input-${id}"]`, dobre ? dobre[id] : p.cfg.blanks.find((b) => b.id === id).validationType === "numeric_range" ? "999" : "zzz");
      await pg.click('[data-testid="submit-interactive-answer"]'); await pg.waitForTimeout(1500);
      if (dobre) {
        ok(`${nazwa} Q-0044: „${dobre.ii_mv}” i „${dobre.ii_mm}” uznane`, (await pg.locator('[data-testid^="blank-correct-"]').count()) === 2);
      } else {
        const przy = await Promise.all(znaczniki.map((id) => pg.locator(`[data-testid="blank-answer-${id}"]`).evaluate((el, id) => !!el.parentElement.querySelector(`[data-testid="blank-input-${id}"]`), id).catch(() => false)));
        ok(`${nazwa} ${p.kod}: „Poprawnie” przy każdej swojej luce`, przy.every(Boolean), JSON.stringify(przy));
      }
      if (ZRZUTY.has(p.kod)) { await t.scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: `luki-${nazwa}-${p.kod}.png`, fullPage: false }); }
    }
    ok(`${nazwa}: brak przewijania w bok`, !(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    ok(`${nazwa}: bez błędów JS`, err.length === 0, err.slice(0, 2).join(" | "));
  }
  console.log(wyn.join("\n")); await br.close();
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
