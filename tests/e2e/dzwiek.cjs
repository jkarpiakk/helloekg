// Dźwięk wstawek w kursie: domyślnie cisza, jeden przełącznik pamiętany między stronami, dźwięki w wykładzie
// (droga impulsu, cyrkiel w pomiarach) i monitor w treści pytania (ton QRS, bez alarmu). Przechwytuje Web Audio:
// częstotliwości oscylatorów, liczbę trzasków szumu i szczyt sygnału na wyjściu.
const { chromium, devices } = require("playwright");
const B = process.env.BASE || "http://localhost:5055";
const S1_00 = "9379701d-3afe-4dd6-91f8-cb95d6eba531", S2_02 = "a94a2de2-e338-4187-a880-52051beaa26c", QINT = "5ada2828-acdf-4f7d-9a2d-af609180a585";
const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);
const reset = (pg) => pg.evaluate(() => { window.__f = []; window.__szum = 0; });
const log = (pg) => pg.evaluate(() => ({ f: [...new Set(window.__f || [])], szum: window.__szum || 0 }));
const szczyt = (pg, ms) => pg.evaluate(async (ms) => {
  const an = window.__an; if (!an) return 0; const buf = new Float32Array(an.fftSize); let m = 0; const end = performance.now() + ms;
  while (performance.now() < end) { an.getFloatTimeDomainData(buf); for (const v of buf) m = Math.max(m, Math.abs(v)); await new Promise((r) => setTimeout(r, 20)); }
  return +m.toFixed(3);
}, ms);
(async () => {
  const br = await chromium.launch();
  for (const [nazwa, opt] of [["telefon", { ...devices["iPhone 13"] }], ["komputer", { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await br.newContext(opt);
    await ctx.addInitScript(() => {
      window.__f = []; window.__szum = 0;
      const AC = window.AudioContext;
      window.AudioContext = class extends AC {
        constructor(...a) { super(...a); const an = super.createAnalyser(); an.fftSize = 2048; an.connect(super.destination); this._an = an; window.__an = an; }
        get destination() { return this._an; }
        createOscillator() { const o = super.createOscillator(); const sv = o.frequency.setValueAtTime.bind(o.frequency); o.frequency.setValueAtTime = (v, t) => { window.__f.push(Math.round(v)); return sv(v, t); }; return o; }
        createBufferSource() { window.__szum++; return super.createBufferSource(); }
      };
    });
    const pg = await ctx.newPage(); const err = []; pg.on("pageerror", (e) => err.push(e.message));
    await pg.goto(B + "/");
    await pg.evaluate(async () => { const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "podglad@helloekg.test", password: "Podglad-2026-lokalnie" }) }); const j = await r.json(); localStorage.setItem("hk:feedback-hint-seen", "1"); localStorage.setItem("hk-tour-v1:" + j.user.id, "done"); localStorage.removeItem("hk:dzwiek"); });

    // wykład S1_00 pl.8: droga impulsu
    await pg.goto(`${B}/lecture/${S1_00}#rozdzial-8`, { waitUntil: "networkidle" }); await pg.waitForTimeout(1500);
    await pg.locator('[data-testid="wstawka-otwarta"][data-wstawka="droga-impulsu"]').first().scrollIntoViewIfNeeded(); await pg.waitForTimeout(2500);
    const di = pg.locator('[data-wstawka="droga-impulsu"] .hw');
    const t = di.locator(".hw-snd");
    ok(`${nazwa}: przełącznik „Dźwięk” w ramie wstawki`, (await t.count()) === 1 && (await t.innerText()).trim() === "Dźwięk");
    ok(`${nazwa}: domyślnie wyciszone`, (await t.getAttribute("aria-pressed")) === "false");
    await reset(pg); await pg.waitForTimeout(1500);
    ok(`${nazwa}: przed włączeniem cisza`, (await log(pg)).f.length === 0 && (await log(pg)).szum === 0);
    await t.click(); await pg.waitForTimeout(300);
    await pg.locator('[data-wstawka="droga-impulsu"] canvas').first().scrollIntoViewIfNeeded(); await reset(pg);
    const p1 = await szczyt(pg, 4500); const l1 = await log(pg);
    ok(`${nazwa}: droga impulsu gra (takt i stuk QRS)`, p1 > 0.01 && l1.szum > 0 && l1.f.includes(140), JSON.stringify(l1));

    // wykład S2_02 pl.1: cyrkiel w pomiarach, przełącznik już włączony (wspólny stan)
    await pg.goto(`${B}/lecture/${S2_02}#rozdzial-1`, { waitUntil: "networkidle" }); await pg.waitForTimeout(1500);
    await pg.locator('[data-testid="wstawka-otwarta"][data-wstawka="pomiary"]').first().scrollIntoViewIfNeeded(); await pg.waitForTimeout(2500);
    const pm = pg.locator('[data-wstawka="pomiary"] .hw');
    ok(`${nazwa}: stan przełącznika pamiętany na innym wykładzie`, (await pm.locator(".hw-snd").getAttribute("aria-pressed")) === "true");
    await pm.locator(".hw-snd").click(); await pm.locator(".hw-snd").click(); await pg.waitForTimeout(300); // gest po nawigacji
    const hb = pm.locator('.hw-pm-h[data-h="b"]'); await hb.scrollIntoViewIfNeeded(); await hb.focus(); await reset(pg);
    for (let i = 0; i < 5; i++) { await pg.keyboard.press("Shift+ArrowRight"); await pg.waitForTimeout(60); }
    const l2 = await log(pg); ok(`${nazwa}: cyrkiel tyka co kratkę`, l2.szum === 5, JSON.stringify(l2));

    // pytanie Q-INT: monitor w treści, przełącznik na pasku, ton QRS, alarm milczy
    await pg.goto(`${B}/quiz?mode=review&ids=${QINT}`, { waitUntil: "networkidle" }); await pg.waitForTimeout(2500);
    const km = pg.locator('[data-wstawka="kardiomonitor"]'); await km.scrollIntoViewIfNeeded().catch(() => {});
    const tk = km.locator(".hw-snd");
    ok(`${nazwa}: pytanie: przełącznik na pasku monitora, włączony`, (await tk.count()) === 1 && (await tk.getAttribute("aria-pressed")) === "true");
    await km.locator(".km").click({ position: { x: 20, y: 60 } }); await pg.waitForTimeout(200); await reset(pg);
    const p3 = await szczyt(pg, 3000); const l3 = await log(pg);
    ok(`${nazwa}: pytanie: ton QRS stały (880 Hz), bez alarmu`, p3 > 0.01 && l3.f.includes(880) && !l3.f.includes(660), JSON.stringify(l3));
    await tk.click(); await pg.waitForTimeout(300); await reset(pg); await pg.waitForTimeout(1500);
    ok(`${nazwa}: po wyciszeniu cisza`, (await log(pg)).f.length === 0 && (await tk.getAttribute("aria-pressed")) === "false");
    ok(`${nazwa}: brak przewijania w bok`, !(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    ok(`${nazwa}: bez błędów JS`, err.length === 0, err.slice(0, 2).join(" | "));
    await ctx.close();
  }
  console.log(wyn.join("\n")); await br.close();
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
