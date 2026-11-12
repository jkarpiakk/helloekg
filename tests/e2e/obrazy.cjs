/**
 * Strażnik „pytanie bez obrazu” (zgłoszenie JK 11.11: przypadek Q-0040 w kursie bez paska EKG).
 * Uruchamiaj przez `npm run e2e:obrazy` (scripts/e2e-obrazy.sh: lustro produkcji + dist na :5068).
 *
 * 1. Baza (tylko odczyt treści): każde opublikowane pytanie, które ma obraz przypisany
 *    (shared/brakObrazu.ts: obrazyPytania), musi mieć adres pliku.
 * 2. API jako kursant (konto tymczasowe w lustrze): każde takie pytanie przychodzi z adresem,
 *    a adres zwraca 200 i typ image/*.
 * 3. Widok kursanta przy 375 i 1280 px: próbka po jednym pytaniu z każdego typu (do 10),
 *    element img widoczny, wczytany, z niezerowymi wymiarami, bez ramki „chwilowo niedostępny”.
 * 4. Próba ramki: plik przypadku i pytania zamkniętego podmieniony na 404 → ramka i zgłoszenie
 *    automatyczne (przechwycone, bez zapisu).
 * Raport: ops/raporty/<data>-e2e-obrazy.md. Kod wyjścia 1, gdy którykolwiek obraz nie działa.
 *
 * Zakłada konto tymczasowe i jego odpowiedzi, dlatego odmawia pracy na bazie produkcyjnej.
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:5068";
const DB = process.env.DB || "helloekg_kurs_lustro";
const SHOTS = process.env.SHOTS || "";
const KOREN = path.resolve(__dirname, "../..");
const dzis = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const RAPORT = process.env.RAPORT || path.join(KOREN, "ops/raporty", `${dzis}-e2e-obrazy.md`);
if (DB === "helloekg_kurs" || /kurs\.helloekg\.pl/.test(BASE)) {
  console.error("Ten test zakłada konto tymczasowe: tylko na lustrze (scripts/lustro-prod.sh), nigdy na produkcji.");
  process.exit(2);
}

const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d ${DB} -Atq"`, { input: q }).toString().trim();
const NAGLOWKI = { "X-Forwarded-Proto": "https", Origin: BASE };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Typ → selektor obrazu w widoku kursanta */
const SELEKTOR = {
  clinical_case: '[data-testid="case-image"] img',
  hotspot: '[data-testid="hotspot-image"]',
  image_choice: '[data-testid="wz-karta"] img.wz-obraz',
};
const selektor = (typ) => SELEKTOR[typ] || '[data-testid="question-image"] img';

(async () => {
  const { obrazyPytania, kodStudia } = await import(path.join(KOREN, "shared/brakObrazu.ts"));
  const start = Date.now();

  // 1. Baza: co ma obraz przypisany
  const wiersze = JSON.parse(sql(`select coalesce(json_agg(json_build_object('id', id, 'tags', tags, 'questionType', question_type,
    'imageUrl', image_url, 'questionConfig', question_config, 'pool', pool)), '[]') from questions where status = 'published'`));
  const zObrazem = wiersze
    .map((q) => ({ ...q, kod: kodStudia(q.tags) ?? q.id, typ: q.questionType || "multiple_choice", obrazy: obrazyPytania(q) }))
    .filter((q) => q.obrazy.length)
    .sort((a, b) => a.kod.localeCompare(b.kod));
  const bledy = []; // { kod, typ, miejsce, obraz, problem }
  const blad = (q, m, problem) => bledy.push({ kod: q.kod, typ: q.typ, miejsce: m?.miejsce ?? "", obraz: m?.kod ?? m?.url ?? "", problem });
  for (const q of zObrazem) for (const m of q.obrazy) if (!m.url) blad(q, m, "obraz przypisany, brak adresu pliku");
  console.log(`opublikowanych pytań ${wiersze.length}, z obrazem ${zObrazem.length}, obrazów ${zObrazem.reduce((n, q) => n + q.obrazy.length, 0)}`);

  // 2. Konto tymczasowe w lustrze (tester bety, adres @helloekg.test)
  const email = `e2e-obrazy-${Date.now()}@helloekg.test`;
  const haslo = `E2e-obrazy-${crypto.randomBytes(6).toString("hex")}`;
  sql("DELETE FROM rate_limit_store");
  const rej = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", headers: { ...NAGLOWKI, "Content-Type": "application/json" },
    body: JSON.stringify({ firstName: "Test", email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true }),
  });
  if (!rej.ok) throw new Error(`rejestracja w lustrze: ${rej.status} ${await rej.text()}`);
  const uid = sql(`UPDATE users SET email_verified = true, tester_bety = true WHERE email = '${email}' RETURNING id`);
  const log = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { ...NAGLOWKI, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo }),
  });
  if (!log.ok) throw new Error(`logowanie w lustrze: ${log.status}`);
  const ciastko = (log.headers.get("set-cookie") || "").split(";")[0];
  // Powtórka podaje wskazane pytanie tylko wtedy, gdy kursant już na nie odpowiadał
  const doPowtorki = zObrazem.filter((q) => q.pool !== "test");
  sql(`INSERT INTO attempts (user_id, question_id, selected_index, is_correct, time_ms, mode)
    SELECT '${uid}', id, 0, false, 1000, 'learn' FROM questions WHERE id IN (${doPowtorki.map((q) => `'${q.id}'`).join(",") || "NULL"})`);

  let zapytan = 0;
  const zapytaj = async (url) => {
    if (++zapytan % 200 === 0) sql("DELETE FROM rate_limit_store"); // limit API 300/min na adres
    return fetch(url, { headers: { ...NAGLOWKI, Cookie: ciastko } });
  };
  const pliki = new Map(); // url → problem | null
  const sprawdzPlik = async (url) => {
    if (!pliki.has(url)) {
      const r = await zapytaj(`${BASE}${url}`);
      const typ = r.headers.get("content-type") || "";
      const bajty = r.ok ? (await r.arrayBuffer()).byteLength : 0;
      pliki.set(url, r.status !== 200 ? `plik zwraca ${r.status}` : !typ.startsWith("image/") ? `plik ma typ ${typ || "brak"}` : bajty === 0 ? "plik pusty" : null);
    }
    return pliki.get(url);
  };

  for (const q of zObrazem) {
    let obrazy = q.obrazy;
    if (q.pool !== "test") {
      const r = await zapytaj(`${BASE}/api/quiz/question?mode=review&ids=${q.id}`);
      if (!r.ok) { blad(q, null, `API nie podało pytania (${r.status})`); continue; }
      const api = await r.json();
      obrazy = obrazyPytania(api);
      if (obrazy.length < q.obrazy.length) blad(q, null, `API podaje ${obrazy.length} z ${q.obrazy.length} obrazów`);
      for (const m of obrazy) if (!m.url && q.obrazy.some((x) => x.url)) blad(q, m, "API bez adresu pliku");
    }
    for (const m of obrazy) {
      if (!m.url) continue;
      const problem = await sprawdzPlik(m.url);
      if (problem) blad(q, m, problem);
    }
  }
  console.log(`API: ${zapytan} zapytań, ${pliki.size} różnych plików, błędów ${bledy.length}`);

  // 3. Widok kursanta: po jednym z każdego typu (do 10), Q-0040 zawsze, gdy jest
  const zle = new Set(bledy.map((b) => b.kod));
  const dobre = doPowtorki.filter((q) => !zle.has(q.kod));
  const probka = [];
  const dodaj = (q) => { if (q && !probka.includes(q) && probka.length < 10) probka.push(q); };
  dodaj(dobre.find((q) => q.kod === "Q-0040"));
  for (const typ of [...new Set(dobre.map((q) => q.typ))]) dodaj(dobre.find((q) => q.typ === typ));
  for (const typ of ["clinical_case", "hotspot", "multiple_choice", "image_choice"]) {
    for (const q of dobre.filter((x) => x.typ === typ)) { if (probka.length >= 10) break; if (!probka.includes(q)) { dodaj(q); break; } }
  }
  for (const q of dobre) { if (probka.length >= 10) break; dodaj(q); }

  const przegladarka = await chromium.launch();
  const widoki = [];
  for (const [nazwa, viewport] of [["375", { width: 375, height: 812 }], ["1280", { width: 1280, height: 900 }]]) {
    const ctx = await przegladarka.newContext({ viewport, extraHTTPHeaders: { "X-Forwarded-Proto": "https" } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.evaluate(async ([e, h]) => {
      await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: h }) });
    }, [email, haslo]);
    for (const q of probka) {
      sql("DELETE FROM rate_limit_store");
      let wynik = "ok";
      try {
        await page.goto(`${BASE}/quiz?mode=review&ids=${q.id}`);
        const sel = selektor(q.typ);
        await page.waitForSelector(`${sel}, [data-testid="brak-obrazu"]`, { timeout: 15000 });
        if (await page.locator('[data-testid="brak-obrazu"]').count()) throw new Error("ramka „chwilowo niedostępny”");
        const obrazy = page.locator(sel);
        const n = await obrazy.count();
        for (let i = 0; i < n; i++) {
          const img = obrazy.nth(i);
          await img.scrollIntoViewIfNeeded();
          await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, await img.elementHandle(), { timeout: 15000 });
          const box = await img.boundingBox();
          if (!(await img.isVisible()) || !box || box.width < 1 || box.height < 1) throw new Error(`obraz ${i + 1}: niewidoczny albo 0×0`);
        }
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `obrazy-${nazwa}-${q.kod}.png`) });
      } catch (e) {
        wynik = String(e.message || e).split("\n")[0];
        blad(q, null, `widok ${nazwa} px: ${wynik}`);
      }
      widoki.push({ kod: q.kod, typ: q.typ, widok: nazwa, wynik });
    }

    // 4. Próba ramki (raz, na komputerze): plik 404 → ramka + zgłoszenie automatyczne
    if (nazwa === "1280") {
      for (const q of [probka.find((x) => x.typ === "clinical_case"), probka.find((x) => x.typ === "multiple_choice")].filter(Boolean)) {
        const url = q.obrazy[0].url;
        const zgloszenia = [];
        await page.route(`**${url}`, (r) => r.fulfill({ status: 404, body: "" }));
        await page.route("**/api/report-error", async (r) => { zgloszenia.push(r.request().postDataJSON()); await r.fulfill({ status: 201, json: { success: true } }); });
        let wynik = "ok";
        try {
          await page.goto(`${BASE}/quiz?mode=review&ids=${q.id}`);
          await page.waitForSelector('[data-testid="brak-obrazu"]', { timeout: 15000 });
          const tekst = await page.locator('[data-testid="brak-obrazu"]').first().innerText();
          if (!tekst.includes("Zapis EKG chwilowo niedostępny, zgłosiliśmy to")) throw new Error(`tekst ramki: ${tekst}`);
          for (let i = 0; i < 20 && !zgloszenia.length; i++) await sleep(100);
          const z = zgloszenia[0];
          if (!z || z.questionId !== q.id || z.automatyczne?.powod !== "brak-obrazu" || z.automatyczne?.stan !== "blad-ladowania") {
            throw new Error(`zgłoszenie: ${JSON.stringify(z)}`);
          }
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `obrazy-ramka-${q.kod}.png`) });
        } catch (e) {
          wynik = String(e.message || e).split("\n")[0];
          blad(q, null, `próba ramki: ${wynik}`);
        }
        widoki.push({ kod: q.kod, typ: q.typ, widok: "1280, plik 404", wynik });
        await page.unrouteAll();
      }
    }
    await ctx.close();
  }
  await przegladarka.close();

  // 5. Trasa zgłoszeń automatycznych naprawdę (w lustrze): zapis, powtórka odsiana, śmieci odrzucone
  const q0 = probka[0];
  if (q0) {
    const wyslij = (automatyczne) => fetch(`${BASE}/api/report-error`, {
      method: "POST", headers: { ...NAGLOWKI, Cookie: ciastko, "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q0.id, automatyczne }),
    });
    const dane = { powod: "brak-obrazu", stan: "blad-ladowania", miejsce: q0.obrazy[0].miejsce, url: q0.obrazy[0].url };
    const [a, b, c] = [await wyslij(dane), await wyslij(dane), await wyslij({ ...dane, url: "https://zly.example/x.png" })];
    const bJson = await b.json();
    const tresc = sql(`SELECT message FROM support_tickets WHERE question_id = '${q0.id}' AND user_id = '${uid}'`);
    const wynik = a.status === 201 && b.status === 200 && bJson.duplikat === true && c.status === 400 && tresc.includes(q0.kod)
      ? "ok" : `201/200/400 oczekiwane, jest ${a.status}/${b.status}/${c.status}; treść: ${tresc.slice(0, 120)}`;
    if (wynik !== "ok") blad(q0, null, `zgłoszenie automatyczne: ${wynik}`);
    widoki.push({ kod: q0.kod, typ: q0.typ, widok: "API zgłoszenia (zapis, powtórka, śmieci)", wynik });
    sql(`DELETE FROM support_tickets WHERE user_id = '${uid}'`);
  }
  sql(`DELETE FROM users WHERE id = '${uid}'`); // odpowiedzi kasują się kaskadowo

  // Raport
  const sek = Math.round((Date.now() - start) / 1000);
  const md = [
    `# Test e2e obrazów pytań (${dzis})`,
    "",
    `Lustro produkcji \`${DB}\`, aplikacja \`${BASE}\` (dist, tryb produkcyjny), czas ${sek} s.`,
    "",
    `- Opublikowane pytania: ${wiersze.length}, z obrazem: ${zObrazem.length} (obrazów: ${zObrazem.reduce((n, q) => n + q.obrazy.length, 0)}).`,
    `- API jako kursant: ${doPowtorki.length} pytań, pula testu sprawdzona z bazy (${zObrazem.length - doPowtorki.length}); plików: ${pliki.size}.`,
    `- Widok kursanta (375 i 1280 px): ${probka.length} pytań, typy: ${[...new Set(probka.map((q) => q.typ))].join(", ")}.`,
    `- **Pytania z obrazem przypisanym, które dziś pokazują się bez obrazu: ${new Set(bledy.map((b) => b.kod)).size}.**`,
    "",
  ];
  if (bledy.length) {
    md.push("## Błędy", "", "| Pytanie | Typ | Miejsce | Obraz | Problem |", "|---|---|---|---|---|");
    for (const b of bledy) md.push(`| ${b.kod} | ${b.typ} | ${b.miejsce} | ${b.obraz} | ${b.problem} |`);
    md.push("");
  }
  md.push("## Widok kursanta", "", "| Pytanie | Typ | Widok | Wynik |", "|---|---|---|---|");
  for (const w of widoki) md.push(`| ${w.kod} | ${w.typ} | ${w.widok} | ${w.wynik} |`);
  fs.mkdirSync(path.dirname(RAPORT), { recursive: true });
  fs.writeFileSync(RAPORT, md.join("\n") + "\n");
  console.log(`raport: ${path.relative(KOREN, RAPORT)}`);
  console.log(bledy.length ? `BŁĘDY: ${bledy.length} (pytań: ${new Set(bledy.map((b) => b.kod)).size})` : "OK: każdy obraz działa");
  process.exit(bledy.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
