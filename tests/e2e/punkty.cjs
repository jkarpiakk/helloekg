// Szkolenie z punktami edukacyjnymi (11.11.2026), telefon 375 px i komputer 1280 px, każdy na własnym koncie tymczasowym:
// zapis (fikcyjne PWZ: lekarz z błędną cyfrą kontrolną = ostrzeżenie, ratownik) → strona modułu (podsumowanie,
// napisz do prowadzącego) → moduły skrótem testowym → test (telefon: najpierw niezaliczony, potem zaliczony) → ankieta
// → zaświadczenia PDF (ratownik 10 pkt, lekarz bez punktów) → weryfikacja po kluczu (po numerze nie) → brak CTA.
// Komputer dodatkowo: panel admina (uczestnik, CSV), usunięcie konta (rejestr zostaje).
//
// Wymaga podglądu z CME_SKROT_TESTOWY=1 (skrót testowy istnieje tylko poza produkcją):
//   CME_SKROT_TESTOWY=1 scripts/preview.sh
//   OUTBOX=<MAIL_OUTBOX_DIR> ADMIN_HASLO=… SHOTS=<katalog zrzutów> NODE_PATH=… node tests/e2e/punkty.cjs
// Wstawia do bazy testowej fałszywe pytania puli testu (tag e2e-cme) i podsumowanie modułu oznaczone [E2E];
// na końcu wszystko sprząta i przywraca ustawienia. Tylko baza kopii (DB, domyślnie helloekg_kurs_otwarcie).
const { chromium, devices } = require("playwright");
const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const B = process.env.BASE || "http://localhost:5065";
const DB = process.env.DB || "helloekg_kurs_otwarcie";
const OUTBOX = process.env.OUTBOX;
const SHOTS = process.env.SHOTS || ".";
const ADMIN = { email: process.env.ADMIN_EMAIL || "podglad-admin@helloekg.test", password: process.env.ADMIN_HASLO };
if (!OUTBOX || !ADMIN.password) { console.error("Ustaw OUTBOX i ADMIN_HASLO"); process.exit(2); }
if (DB === "helloekg_kurs" || DB === "helloekg_kurs_dev") { console.error("Tylko baza testowa"); process.exit(2); }

const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -v ON_ERROR_STOP=1 -d ${DB} -Atq"`, { input: "SET ROLE kurs_dev;\n" + q }).toString().trim();
const czekaj = (ms) => new Promise((r) => setTimeout(r, ms));
const CTA = /\b(kup|kupuj|cennik|subskrypcj|promocj|rabat|zniżk|oferta|zamów)/i;

const USTAWIENIA = { dokumenty_opublikowane: "true", szkolenie_wlaczone: "true", cme_test_liczba_pytan: "10" };
const N_PYTAN = 14;

(async () => {
  const stamp = Date.now();
  const konta = [];
  const zapamietane = {};
  let ankietyPrzed = [];
  let modulZPodsumowaniem = null;
  let podsumowaniePrzed = null;
  const br = await chromium.launch();
  try {
    // ── Przygotowanie bazy testowej ─────────────────────────────────────────
    sql("DELETE FROM rate_limit_store");
    for (const k of Object.keys(USTAWIENIA)) zapamietane[k] = sql(`SELECT value::text FROM app_settings WHERE key='${k}'`) || null;
    for (const [k, v] of Object.entries(USTAWIENIA)) sql(`INSERT INTO app_settings(key,value) VALUES ('${k}','${v}') ON CONFLICT (key) DO UPDATE SET value='${v}'`);
    ankietyPrzed = sql("SELECT id FROM cme_survey_responses").split("\n").filter(Boolean);
    // po jednym wykładzie z każdego modułu szkolenia: 2 fałszywe pytania puli testu (tag e2e-cme)
    const wyklady = sql(`SELECT DISTINCT ON (m.id) s.id || '|' || m.id FROM modules m JOIN sections s ON s.module_id = m.id
      WHERE m.cme AND m.is_visible AND s.is_visible AND EXISTS (SELECT 1 FROM lecture_chapters c WHERE c.section_id = s.id AND c.is_published)
      ORDER BY m.id, s."order"`).split("\n").filter(Boolean).map((l) => l.split("|"));
    const autor = sql("SELECT id FROM users WHERE email = 'studio-import@helloekg.pl'") || sql("SELECT id FROM users ORDER BY created_at LIMIT 1");
    let n = 0;
    for (const [sekcja] of wyklady) {
      for (let k = 0; k < 2 && n < N_PYTAN; k++) {
        n++;
        // test: co najmniej 5 odpowiedzi, dokładnie 1 poprawna
        const odp = JSON.stringify([
          { text: `Błędna odpowiedź ${n}a`, isCorrect: false },
          { text: `Właściwa odpowiedź ${n}`, isCorrect: true },
          { text: `Błędna odpowiedź ${n}b`, isCorrect: false },
          { text: `Błędna odpowiedź ${n}c`, isCorrect: false },
          { text: `Błędna odpowiedź ${n}d`, isCorrect: false },
        ]);
        const wyklucza = n === 1 ? `'["E2E-CME-2"]'` : "'[]'";
        sql(`INSERT INTO questions (section_id, title, body_md, answers, explanation_md, tags, status, created_by, question_type, pool, no_shuffle, excludes)
          VALUES ('${sekcja}', 'E2E pytanie testu ${n}', 'Pytanie testowe E2E nr ${n} (fałszywe, do usunięcia).', '${odp}',
          'Uzasadnienie E2E ${n}: właściwa jest odpowiedź „Właściwa odpowiedź ${n}”.', '["e2e-cme","studio:E2E-CME-${n}"]', 'published', '${autor}',
          'multiple_choice', 'test', ${n === 3 ? "true" : "false"}, ${wyklucza})`);
      }
    }
    // pytanie puli testu z 4 odpowiedziami: nie kwalifikuje się (pominięte w losowaniu, widoczne w panelu)
    sql(`INSERT INTO questions (section_id, title, body_md, answers, explanation_md, tags, status, created_by, question_type, pool)
      VALUES ('${wyklady[0][0]}', 'E2E pytanie ABCD', 'Pytanie E2E z czterema odpowiedziami (fałszywe).', '[{"text":"a","isCorrect":true},{"text":"b","isCorrect":false},{"text":"c","isCorrect":false},{"text":"d","isCorrect":false}]',
      'x', '["e2e-cme","studio:E2E-CME-ABCD"]', 'published', '${autor}', 'multiple_choice', 'test')`);
    // podsumowanie modułu (oznaczone [E2E]); przywracane na końcu
    modulZPodsumowaniem = wyklady[0][1];
    podsumowaniePrzed = sql(`SELECT coalesce(summary_md, '<<NULL>>') FROM modules WHERE id = '${modulZPodsumowaniem}'`);
    sql(`UPDATE modules SET summary_md = '## [E2E] Podsumowanie testowe\n\nNajważniejsze: gałąź diagonalna, odstęp PQ, oś serca.' WHERE id = '${modulZPodsumowaniem}'`);
    await czekaj(11000); // ustawienia w pamięci serwera do 10 s

    // pytania testu nigdy w ćwiczeniach: liczniki /api/modules bez puli testu
    // konto admina (sprawdzenie PWZ, raporty): jeden kontekst na cały test
    const admCtx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const adm = await admCtx.newPage();
    await adm.goto(B + "/");
    const admLogin = await adm.evaluate(async (a) => (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) })).status, ADMIN);
    ok("admin: logowanie", admLogin === 200, String(admLogin));
    const pulaRaport = await adm.evaluate(async () => (await fetch("/api/admin/szkolenie/pula-testu")).json());
    ok("admin: pula testu: pytanie z 4 odpowiedziami pominięte z powodem", pulaRaport.odrzucone.some((o) => o.externalId === "E2E-CME-ABCD" && /co najmniej 5/.test(o.powod)) && pulaRaport.kwalifikuje >= N_PYTAN, JSON.stringify(pulaRaport).slice(0, 160));

    const praktyka = Number(sql(`SELECT count(*) FROM questions q JOIN sections s ON s.id=q.section_id WHERE s.id='${wyklady[0][0]}' AND q.status='published' AND q.pool='practice'`));

    for (const [nazwa, opt] of [["telefon", { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } }], ["komputer", { viewport: { width: 1280, height: 900 } }]]) {
      const email = `punkty-e2e-${nazwa}-${stamp}@helloekg.test`;
      const haslo = crypto.randomBytes(12).toString("base64url");
      konta.push(email);
      const ctx = await br.newContext({ ...opt, acceptDownloads: true });
      const pg = await ctx.newPage(); const err = []; pg.on("pageerror", (e) => err.push(e.message));
      await pg.goto(B + "/");
      const reg = await pg.evaluate(async ({ email, haslo }) => (await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: "Testowa", email, password: haslo, confirmPassword: haslo, termsAccepted: true, privacyAccepted: true }) })).status, { email, haslo });
      ok(`${nazwa}: rejestracja konta tymczasowego`, reg === 200 || reg === 201, String(reg));
      sql(`UPDATE users SET email_verified = true, tester_bety = true WHERE email = '${email}'`);
      const uid = await pg.evaluate(async ({ email, haslo }) => {
        const j = await (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: haslo }) })).json();
        localStorage.setItem("hk:feedback-hint-seen", "1"); localStorage.setItem("hk-tour-v1:" + j.user.id, "done"); return j.user.id;
      }, { email, haslo });

      // ── Kurs: link do szkolenia, liczniki bez puli testu ──
      await pg.goto(`${B}/modules`, { waitUntil: "networkidle" });
      ok(`${nazwa}: w kursie link „Szkolenie z punktami”`, await pg.locator('[data-testid="link-szkolenie"]').isVisible());
      const licznik = await pg.evaluate(async (sid) => (await (await fetch("/api/modules")).json()).flatMap((m) => m.sections).find((s) => s.id === sid)?.questionCount, wyklady[0][0]);
      ok(`${nazwa}: /api/modules liczy tylko pulę ćwiczeń`, licznik === praktyka || (praktyka === 0 && licznik === undefined), `${licznik} vs ${praktyka}`);
      const nauka = await pg.evaluate(async (sid) => {
        const ids = [];
        for (let i = 0; i < 60; i++) {
          const r = await fetch(`/api/quiz/question?sectionId=${sid}&exclude=${ids.join(",")}`);
          if (!r.ok) break;
          const q = await r.json(); if (ids.includes(q.id)) break; ids.push(q.id);
          if (/E2E/.test(q.title)) return "pytanie testu w nauce: " + q.title;
        }
        return "ok " + ids.length;
      }, wyklady[0][0]);
      ok(`${nazwa}: pytania testu nie trafiają do nauki`, nauka.startsWith("ok"), nauka);

      // ── Zapis ──
      await pg.goto(`${B}/szkolenie`, { waitUntil: "networkidle" });
      await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-1-szkolenie.png`), fullPage: true });
      await pg.click('[data-testid="chce-zaswiadczenie"]');
      await pg.check('[data-testid="zawod-ratownik"]'); await pg.check('[data-testid="zawod-lekarz"]');
      await pg.fill('[data-testid="pwz-lekarz"]', "4123456"); // fikcyjny, zła cyfra kontrolna
      if (nazwa === "telefon") await pg.check('[data-testid="pwz-ratownik-brak"]'); // „nie mam jeszcze numeru”
      else await pg.fill('[data-testid="pwz-ratownik"]', "RM1234"); // fikcyjny, bez formatu urzędowego
      await pg.fill('[data-testid="spec-lekarz"]', "choroby wewnętrzne");
      await pg.selectOption('[data-testid="izba-lekarz"]', "Łódzka");
      const uwaga = await pg.locator('[data-testid="pwz-lekarz-uwaga"]').innerText().catch(() => "");
      ok(`${nazwa}: PWZ lekarza z błędną cyfrą kontrolną: komunikat od razu`, /kontrolna/.test(uwaga), uwaga);
      await pg.fill('[data-testid="cme-imie"]', "Testowa"); await pg.fill('[data-testid="cme-nazwisko"]', "Uczestniczka-Próbna");
      await pg.click('[data-testid="cme-zapisz"]');
      ok(`${nazwa}: bez oświadczenia zapis odrzucony`, /oświadczenie/i.test(await pg.locator('[data-testid="cme-blad"]').innerText().catch(() => "")));
      await pg.check('[data-testid="cme-oswiadczenie"]');
      await pg.click('[data-testid="cme-zapisz"]');
      await pg.waitForTimeout(800);
      ok(`${nazwa}: zła cyfra kontrolna PWZ lekarza blokuje zapis (walidacja twarda)`, /kontrolna/.test(await pg.locator('[data-testid="cme-blad"]').innerText().catch(() => "")));
      await pg.fill('[data-testid="pwz-lekarz"]', "3123456"); // fikcyjny z poprawną cyfrą kontrolną
      await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-2-zapis.png`), fullPage: true });
      await pg.click('[data-testid="cme-zapisz"]');
      await pg.waitForSelector('[data-testid="zapis-ratownik"]', { timeout: 10000 }).catch(() => {});
      ok(`${nazwa}: zapis na dwa zawody`, (await pg.locator('[data-testid="zapis-ratownik"]').isVisible()) && (await pg.locator('[data-testid="zapis-lekarz"]').isVisible()));
      const zapisRat = await pg.locator('[data-testid="zapis-ratownik"]').innerText();
      ok(`${nazwa}: ratownik: 10 punktów`, /Punkty edukacyjne: 10/.test(zapisRat), zapisRat.replace(/\n/g, " "));
      ok(`${nazwa}: lekarz: bez punktów (brak uchwały NRL i wpisu)`, /Bez punktów/.test(await pg.locator('[data-testid="zapis-lekarz"]').innerText()));
      if (nazwa === "telefon") ok(`${nazwa}: ratownik bez numeru PWZ`, /Bez numeru PWZ/.test(zapisRat), zapisRat.replace(/\n/g, " "));
      ok(`${nazwa}: test zablokowany przed ukończeniem modułów`, await pg.locator('[data-testid="test-zablokowany"]').isVisible());
      const zly = await pg.evaluate(async () => (await fetch("/api/szkolenie/test/start", { method: "POST" })).status);
      ok(`${nazwa}: serwer nie otwiera testu przed modułami`, zly === 403, String(zly));

      // ── Strona modułu: podsumowanie, napisz do prowadzącego ──
      await pg.goto(`${B}/modul/${modulZPodsumowaniem}`, { waitUntil: "networkidle" });
      ok(`${nazwa}: podsumowanie modułu widać`, /\[E2E\] Podsumowanie testowe/.test(await pg.locator('[data-testid="modul-podsumowanie"]').innerText().catch(() => "")));
      await pg.waitForTimeout(800);
      ok(`${nazwa}: otwarcie podsumowania w dzienniku`, sql(`SELECT count(*) FROM cme_log WHERE participant_id='${uid}' AND type='podsumowanie_otwarte'`) === "1");
      if (nazwa === "telefon") {
        const plikiPrzed = new Set(fs.readdirSync(OUTBOX));
        await pg.fill('[data-testid="prowadzacy-tresc"]', "Pytanie testowe E2E do prowadzącego o oś serca.");
        await pg.click('[data-testid="prowadzacy-wyslij"]');
        await pg.waitForSelector('[data-testid="prowadzacy-wyslano"]', { timeout: 8000 }).catch(() => {});
        ok(`${nazwa}: napisz do prowadzącego: wysłane`, await pg.locator('[data-testid="prowadzacy-wyslano"]').isVisible());
        await pg.waitForTimeout(800);
        const mail = fs.readdirSync(OUTBOX).filter((f) => !plikiPrzed.has(f)).map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf8"))).find((m) => /Do prowadzącego/.test(m.subject));
        ok(`${nazwa}: mail do zespołu (kontakt@ albo FEEDBACK_NOTIFY_EMAIL)`, !!mail, mail ? mail.to : "brak");
        ok(`${nazwa}: wiadomość w panelu (support_tickets kind=prowadzacy)`, sql(`SELECT count(*) FROM support_tickets WHERE user_email='${email}' AND kind='prowadzacy'`) === "1");
      }
      await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-3-modul.png`), fullPage: true });

      // ── Moduły: skrót testowy (tylko poza produkcją) ──
      const skrot = await pg.evaluate(async () => { const r = await fetch("/api/szkolenie/_test/ukoncz-moduly", { method: "POST" }); return [r.status, r.ok ? (await r.json()).stan.every((m) => m.ukonczony) : null]; });
      ok(`${nazwa}: skrót testowy ukończył moduły`, skrot[0] === 200 && skrot[1] === true, JSON.stringify(skrot));
      ok(`${nazwa}: dziennik: wykłady i moduły ukończone`, Number(sql(`SELECT count(*) FROM cme_log WHERE participant_id='${uid}' AND type='modul_ukonczony'`)) === wyklady.length
        && Number(sql(`SELECT count(*) FROM cme_log WHERE participant_id='${uid}' AND type='wyklad_ukonczony'`)) > 0);

      // ── Test ──
      const podejscie = async (zaliczyc, przerwijPo = null) => {
        await pg.goto(`${B}/szkolenie`, { waitUntil: "networkidle" });
        await pg.click('[data-testid="do-testu"]');
        await pg.click('[data-testid="test-rozpocznij"]');
        await pg.waitForSelector('[data-testid="test-pytanie"]');
        const surowe = await pg.evaluate(async () => (await fetch("/api/szkolenie/test")).json());
        const pyt = surowe.otwarte?.pytania ?? [];
        ok(`${nazwa}: test: ${pyt.length} pytań, przeglądarka nie dostaje poprawnych odpowiedzi ani uzasadnień`,
          pyt.length === 10 && !/isCorrect|explanation|Uzasadnienie/.test(JSON.stringify(surowe)), String(pyt.length));
        ok(`${nazwa}: test: pytanie z 4 odpowiedziami nie wylosowane, każde ma 5 odpowiedzi`, pyt.every((p) => p.answers.length === 5) && !pyt.some((p) => /ABCD/.test(p.title)));
        ok(`${nazwa}: test: odliczanie czasu widoczne`, /\d+:\d{2}/.test(await pg.locator('[data-testid="test-czas"]').innerText().catch(() => "")));
        const ids = pyt.map((p) => p.id);
        const ext = sql(`SELECT string_agg(t, ',') FROM questions, json_array_elements_text(tags) t WHERE id IN (${ids.map((i) => `'${i}'`).join(",")}) AND t LIKE 'studio:%'`);
        const wylosowane = new Set(ext.split(",").map((t) => t.replace(/^studio:/, "")));
        ok(`${nazwa}: test: reguła „wyklucza” (E2E-CME-1 i E2E-CME-2 nie razem)`, !(wylosowane.has("E2E-CME-1") && wylosowane.has("E2E-CME-2")), Array.from(wylosowane).join(" "));
        for (let i = 0; i < pyt.length; i++) {
          const opcje = await pg.locator('[data-testid^="test-odp-"]').allInnerTexts();
          const k = opcje.findIndex((t) => (zaliczyc ? /Właściwa/ : /Błędna/).test(t));
          await pg.click(`[data-testid="test-odp-${Math.max(0, k)}"]`);
          if (i === 0) {
            await pg.waitForTimeout(400);
            ok(`${nazwa}: bez informacji zwrotnej w trakcie`, (await pg.locator(".opt.is-right, .opt.is-wrong").count()) === 0);
            if (zaliczyc) await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-4-test.png`), fullPage: true });
          }
          if (przerwijPo !== null && i + 1 >= przerwijPo) return null;
          if (i < pyt.length - 1) await pg.click('[data-testid="test-nastepne"]');
        }
        await pg.waitForTimeout(500);
        await pg.click('[data-testid="test-oddaj"]'); await pg.click('[data-testid="test-oddaj-potwierdz"]');
        await pg.waitForSelector('[data-testid="test-wynik"]', { timeout: 10000 });
        return pg.locator('[data-testid="test-wynik-procent"]').innerText();
      };
      if (nazwa === "telefon") {
        // podejście 1: trzy złe odpowiedzi, potem koniec czasu (termin przesunięty w bazie): serwer oddaje sam
        await podejscie(false, 3);
        sql(`UPDATE cme_test_attempts SET deadline_at = now() - interval '10 minutes' WHERE participant_id = '${uid}' AND submitted_at IS NULL`);
        const poCzasie = await pg.evaluate(async () => {
          const t = await (await fetch("/api/szkolenie/test")).json();
          return t.podejscia.map((p) => [p.automatycznie, p.procent]);
        });
        ok(`${nazwa}: po limicie czasu podejście oddane automatycznie (serwer)`, JSON.stringify(poCzasie) === "[[true,0]]", JSON.stringify(poCzasie));
        await pg.goto(`${B}/szkolenie`, { waitUntil: "networkidle" });
        await pg.locator('[data-testid="test-wglad-linki"] a').first().click();
        await pg.waitForSelector('[data-testid="test-wynik"]', { timeout: 10000 });
        const bledne = await pg.locator('[data-testid="test-bledna"]').count();
        const uzas = await pg.locator('[data-testid="test-bledna"]').first().innerText();
        ok(`${nazwa}: wgląd w całe ocenione podejście (pytania, klucz, uzasadnienia)`, bledne === 10 && /Uzasadnienie E2E/.test(uzas) && /oddane po czasie|Czas minął/.test(await pg.locator('[data-testid="test-wynik"]').innerText()), String(bledne));
        await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-5-wynik-niezaliczony.png`), fullPage: true });
        const p2 = await podejscie(true);
        ok(`${nazwa}: podejście 2 (nowe losowanie) zaliczone 100%`, p2.trim() === "100%", p2);
        ok(`${nazwa}: zaliczony: wgląd w całe podejście (10 dobrych, 0 błędnych)`, (await pg.locator('[data-testid="test-bledna"]').count()) === 0 && (await pg.locator('[data-testid="test-dobra"]').count()) === 10);
        const trzecie = await pg.evaluate(async () => (await fetch("/api/szkolenie/test/start", { method: "POST" })).status);
        ok(`${nazwa}: po zaliczeniu nie ma kolejnego podejścia`, trzecie === 409, String(trzecie));
      } else {
        const p = await podejscie(true);
        ok(`${nazwa}: podejście 1 zaliczone 100%`, p.trim() === "100%", p);
      }
      await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-6-wynik.png`), fullPage: true });

      // ── Ankieta ──
      const odbiorPrzedAnkieta = await pg.evaluate(async () => {
        const s = await (await fetch("/api/szkolenie")).json();
        return (await fetch("/api/szkolenie/zaswiadczenia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zapisId: s.zapisy[0].id }) })).status;
      });
      ok(`${nazwa}: zaświadczenie dopiero po ankiecie`, odbiorPrzedAnkieta === 403, String(odbiorPrzedAnkieta));
      await pg.click('[data-testid="po-tescie-ankieta"]');
      await pg.waitForSelector('[data-testid="ankieta"]');
      for (const id of ["nowa_wiedza", "oparta_na_faktach", "w_praktyce", "korzysc_pacjentow", "bez_reklamy", "polecenie"]) await pg.click(`[data-testid="ankieta-${id}-tak"]`);
      for (const id of ["ocena_ogolna", "organizacja", "materialy", "test"]) await pg.click(`[data-testid="ankieta-${id}-5"]`);
      ok(`${nazwa}: ankieta: pytanie NIL o reklamę i stronniczość`, /wolne od reklamy i stronniczości/.test(await pg.locator('[data-testid="ankieta"]').innerText()));
      await pg.fill('[data-testid="ankieta-uwagi-tekst"]', "Uwaga testowa E2E.");
      await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-7-ankieta.png`), fullPage: true });
      await pg.click('[data-testid="ankieta-wyslij"]');
      await pg.waitForSelector('[data-testid="ankieta-dziekujemy"]', { timeout: 8000 }).catch(() => {});
      ok(`${nazwa}: ankieta wysłana`, await pg.locator('[data-testid="ankieta-dziekujemy"]').isVisible());
      const kolumny = sql("SELECT string_agg(column_name, ',') FROM information_schema.columns WHERE table_name='cme_survey_responses'");
      ok(`${nazwa}: ankieta anonimowa (bez user_id), w dzienniku tylko fakt`, !/user|participant/.test(kolumny)
        && sql(`SELECT count(*) FROM cme_log WHERE participant_id='${uid}' AND type='ankieta_wypelniona'`) === "1"
        && !/Uwaga testowa/.test(sql(`SELECT coalesce(string_agg(details::text, ' '), '') FROM cme_log WHERE participant_id='${uid}'`)), kolumny);

      // ── Zaświadczenia: ratownik czeka na sprawdzenie PWZ (do tego czasu ukończenie bez punktów), lekarz bez punktów ──
      await pg.goto(`${B}/szkolenie`, { waitUntil: "networkidle" });
      const czeka = await pg.locator('[data-testid="czeka-ratownik"]').innerText().catch(() => "");
      ok(`${nazwa}: ratownik: „czeka na weryfikację danych”`, /czeka na weryfikację danych \(zwykle do \d+ dni roboczych\)/.test(czeka), czeka.replace(/\n/g, " "));
      const zaWczesnie = await pg.evaluate(async () => {
        const s = await (await fetch("/api/szkolenie")).json();
        const z = s.zapisy.find((x) => x.zawod === "ratownik");
        return (await fetch("/api/szkolenie/zaswiadczenia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zapisId: z.id, rodzaj: "punkty" }) })).status;
      });
      ok(`${nazwa}: serwer nie wydaje zaświadczenia z punktami przed sprawdzeniem PWZ`, zaWczesnie === 409, String(zaWczesnie));
      for (const z of ["ratownik", "lekarz"]) {
        await pg.click(`[data-testid="odbierz-${z}-ukonczenie"]`);
        await pg.waitForSelector(`[data-testid="pdf-${z}-ukonczenie"]`, { timeout: 10000 }).catch(() => {});
      }
      // admin: „PWZ sprawdzony w publicznym rejestrze” (dziennik), potem zaświadczenie z punktami
      const zapisRatId = sql(`SELECT id FROM cme_enrollments WHERE participant_id='${uid}' AND profession='ratownik'`);
      const spr = await adm.evaluate(async (id) => (await fetch(`/api/admin/szkolenie/zapisy/${id}/pwz-sprawdzony`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sprawdzony: true }) })).status, zapisRatId);
      ok(`${nazwa}: admin oznacza PWZ jako sprawdzony (kto i kiedy w dzienniku)`, spr === 200 && sql(`SELECT count(*) FROM cme_log WHERE participant_id='${uid}' AND type='pwz_sprawdzony' AND actor_id IS NOT NULL`) === "1", String(spr));
      await pg.goto(`${B}/szkolenie`, { waitUntil: "networkidle" });
      await pg.click('[data-testid="odbierz-ratownik-punkty"]');
      await pg.waitForSelector('[data-testid="pdf-ratownik-punkty"]', { timeout: 10000 }).catch(() => {});
      const certy = sql(`SELECT profession || '|' || kind || '|' || number || '|' || coalesce(points::text,'-') || '|' || verification_token FROM cme_certificates WHERE participant_id='${uid}' ORDER BY profession, kind`).split("\n").map((l) => l.split("|"));
      const rat = certy.find((c) => c[0] === "ratownik" && c[1] === "punkty").filter((_, i) => i !== 1);
      const ratUk = certy.find((c) => c[0] === "ratownik" && c[1] === "ukonczenie");
      const lek = certy.find((c) => c[0] === "lekarz" && c[1] === "ukonczenie");
      ok(`${nazwa}: zaświadczenia: ratownik z punktami (10) i ukończenie bez punktów, lekarz bez punktów, numery HE-RRRR-NNNNNN`,
        !!rat && !!ratUk && !!lek && /^HE-\d{4}-\d{6}$/.test(rat[1]) && Number(rat[2]) === 10 && ratUk[3] === "-" && lek[3] === "-" && certy.length === 3, JSON.stringify(certy.map((c) => c.slice(0, 4))));
      const [pobranie] = await Promise.all([pg.waitForEvent("download"), pg.click('[data-testid="pdf-ratownik-punkty"]')]);
      const plik = path.join(SHOTS, `punkty-${nazwa}-zaswiadczenie.pdf`);
      await pobranie.saveAs(plik);
      const pdf = fs.readFileSync(plik);
      ok(`${nazwa}: PDF pobrany`, pdf.slice(0, 5).toString() === "%PDF-" && pdf.length > 15000, `${pdf.length} B`);
      const [pobranie2] = await Promise.all([pg.waitForEvent("download"), pg.click('[data-testid="pdf-lekarz-ukonczenie"]')]);
      await pobranie2.saveAs(path.join(SHOTS, `punkty-${nazwa}-zaswiadczenie-lekarz-bez-punktow.pdf`));
      ok(`${nazwa}: dane zablokowane po zaświadczeniu`, (await pg.locator('[data-testid="zapis-ratownik"]').innerText()).includes("Dane są na zaświadczeniu"));
      const zmiana = await pg.evaluate(async () => (await fetch("/api/szkolenie/zapis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imie: "Inna", nazwisko: "Osoba", oswiadczenie: true, zawody: [{ zawod: "ratownik", pwz: "1234567" }] }) })).status);
      ok(`${nazwa}: zmiana nazwiska po zaświadczeniu odrzucona`, zmiana === 409, String(zmiana));
      await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-8-zaswiadczenia.png`), fullPage: true });

      // ── Weryfikacja: po kluczu tak, po numerze nie ──
      await pg.click('[data-testid="weryfikacja-link-ratownik-punkty"]');
      await pg.waitForSelector('[data-testid="weryfikacja-stan"]', { timeout: 8000 }).catch(() => {});
      const wer = await pg.locator('[data-testid="weryfikacja"]').innerText().catch(() => "");
      ok(`${nazwa}: weryfikacja: ważne, inicjały, bez PWZ i nazwiska`, /Zaświadczenie ważne/.test(wer) && wer.includes("T. U.-P.") && !wer.includes("RM1234") && !wer.includes("Uczestniczka"), wer.replace(/\n/g, " ").slice(0, 160));
      ok(`${nazwa}: adres weryfikacji to losowy klucz, nie numer`, pg.url().endsWith(`/zaswiadczenie/${rat[3]}`) && !pg.url().includes("HE-"), pg.url());
      await pg.screenshot({ path: path.join(SHOTS, `punkty-${nazwa}-9-weryfikacja.png`), fullPage: true });
      const anon = await br.newContext(opt); const ap = await anon.newPage();
      await ap.goto(`${B}/zaswiadczenie/${rat[3]}`, { waitUntil: "networkidle" });
      ok(`${nazwa}: weryfikacja działa bez logowania`, /Zaświadczenie ważne/.test(await ap.locator('[data-testid="weryfikacja"]').innerText()));
      const poNumerze = await ap.evaluate(async (nr) => (await fetch(`/api/zaswiadczenia/${nr}`)).status, rat[1]);
      ok(`${nazwa}: po samym numerze 404 (bez wyliczania)`, poNumerze === 404, String(poNumerze));
      await ap.goto(`${B}/zaswiadczenie/${rat[1]}`, { waitUntil: "networkidle" });
      ok(`${nazwa}: strona po numerze: „Nie znaleziono”`, /Nie znaleziono zaświadczenia/.test(await ap.locator('[data-testid="weryfikacja"]').innerText()));
      const cudzyPdf = await ap.evaluate(async (nr) => (await fetch(`/api/szkolenie/zaswiadczenia/${nr}/pdf`)).status, rat[1]);
      ok(`${nazwa}: PDF tylko dla właściciela`, cudzyPdf === 401, String(cudzyPdf));
      await anon.close();

      // ── Zero CTA sprzedażowych na stronach szkolenia ──
      for (const adres of ["/szkolenie", "/szkolenie/test", "/szkolenie/ankieta", `/modul/${modulZPodsumowaniem}`, `/zaswiadczenie/${rat[3]}`, "/program-szkolenia", "/regulamin-szkolenia"]) {
        await pg.goto(B + adres, { waitUntil: "networkidle" });
        const main = pg.locator("main");
        const linki = await main.locator('a[href*="pricing"], a[href*="checkout"], a[href*="cennik"], a[href*="stripe"], a[href*="helloekg.pl/kup"]').count();
        const tekst = await main.innerText();
        ok(`${nazwa}: ${adres}: bez CTA i linków do płatności`, linki === 0 && !CTA.test(tekst), linki ? `${linki} linków` : (tekst.match(CTA) || [""])[0]);
        ok(`${nazwa}: ${adres}: bez przewijania w bok`, !(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      }

      // ── Komputer: panel admina i usunięcie konta ──
      if (nazwa === "komputer") {
        const ad = adm;
        const csv = await ad.evaluate(async () => { const r = await fetch("/api/admin/szkolenie/lista-obecnosci.csv"); return [r.status, await r.text()]; });
        ok("admin: lista obecności CSV z uczestnikiem, PWZ i numerem zaświadczenia", csv[0] === 200 && csv[1].includes("Uczestniczka-Próbna") && csv[1].includes("RM1234") && csv[1].includes(rat[1]), String(csv[0]));
        const orl = await ad.evaluate(async () => { const r = await fetch(`/api/admin/szkolenie/raport-orl.csv?izba=${encodeURIComponent("Łódzka")}`); return [r.status, await r.text()]; });
        ok("admin: raport dla izby lekarskiej (filtr Łódzka): lekarz, PWZ, numer zaświadczenia", orl[0] === 200 && orl[1].includes("3123456") && orl[1].includes(lek[2]) && orl[1].includes("Łódzka"), String(orl[0]));
        await ad.goto(`${B}/admin?tab=szkolenie`, { waitUntil: "networkidle" });
        await ad.waitForSelector('[data-testid="admin-szkolenie"]', { timeout: 10000 }).catch(() => {});
        ok("admin: zakładka Szkolenie z uczestnikiem", (await ad.locator('[data-testid="admin-szkolenie"]').innerText().catch(() => "")).includes("Uczestniczka-Próbna"));
        await ad.screenshot({ path: path.join(SHOTS, "punkty-komputer-10-admin.png"), fullPage: false });
        const zapisId = sql(`SELECT id FROM cme_enrollments WHERE participant_id='${uid}' AND profession='ratownik'`);
        const zapisLekId = sql(`SELECT id FROM cme_enrollments WHERE participant_id='${uid}' AND profession='lekarz'`);
        const bezWyjatku = await ad.evaluate(async (id) => (await fetch(`/api/admin/szkolenie/zapisy/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pwz: "1234567", powod: "Test E2E" }) })).status, zapisLekId);
        ok("admin: zły PWZ lekarza bez wyjątku odrzucony", bezWyjatku === 400, String(bezWyjatku));
        const edycja = await ad.evaluate(async (id) => (await fetch(`/api/admin/szkolenie/zapisy/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pwz: "1234567", pominWalidacje: true, powod: "Test E2E: PWZ warunkowe" }) })).status, zapisLekId);
        ok("admin: wyjątek od walidacji PWZ z wpisem w dzienniku", edycja === 200 && sql(`SELECT count(*) FROM cme_log WHERE participant_id='${uid}' AND type='dane_zmienione_admin' AND details->>'pominWalidacje' = 'true'`) === "1", String(edycja));
        // usunięcie konta: rejestr szkolenia zostaje (5 lat), user_id = NULL
        const usun = await pg.evaluate(async (password) => (await fetch("/api/auth/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) })).status, haslo);
        ok("konto z zaświadczeniem usunięte: zapis, dziennik i zaświadczenia zostają (user_id NULL), treść odpowiedzi testu nie", usun === 200
          && sql(`SELECT count(*) FROM users WHERE id='${uid}'`) === "0"
          && sql(`SELECT count(*) FROM cme_enrollments WHERE participant_id='${uid}' AND user_id IS NULL`) === "2"
          && sql(`SELECT count(*) FROM cme_certificates WHERE participant_id='${uid}' AND user_id IS NULL`) === "3"
          && sql(`SELECT count(*) FROM cme_test_attempts WHERE participant_id='${uid}' AND (answers <> '{}'::jsonb OR grading IS NOT NULL)`) === "0"
          && sql(`SELECT count(*) FROM cme_test_attempts WHERE participant_id='${uid}' AND passed`) === "1"
          && Number(sql(`SELECT count(*) FROM cme_log WHERE participant_id='${uid}'`)) > 10, String(usun));
        const retencja = await ad.evaluate(async () => (await fetch("/api/admin/szkolenie/retencja", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json());
        ok("retencja (próba): konto usunięte w tym roku nie jest jeszcze do usunięcia", retencja.sprawdzone >= 1 && retencja.doUsuniecia === 0 && retencja.usunieto === 0, JSON.stringify(retencja));
        // konto bez zaświadczenia: dane szkolenia znikają razem z kontem
        const email3 = `punkty-e2e-bez-zasw-${stamp}@helloekg.test`; konta.push(email3);
        const h3 = crypto.randomBytes(12).toString("base64url");
        const c3 = await br.newContext(); const p3 = await c3.newPage(); await p3.goto(B + "/");
        await p3.evaluate(async ({ e, h }) => fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: "Testowa", email: e, password: h, confirmPassword: h, termsAccepted: true, privacyAccepted: true }) }), { e: email3, h: h3 });
        sql(`UPDATE users SET email_verified = true, tester_bety = true WHERE email = '${email3}'`);
        const uid3 = await p3.evaluate(async ({ e, h }) => {
          const j = await (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: h }) })).json();
          await fetch("/api/szkolenie/zapis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imie: "Testowa", nazwisko: "Bezzaswiadczenia", oswiadczenie: true, zawody: [{ zawod: "student" }] }) });
          await fetch("/api/auth/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: h }) });
          return j.user.id;
        }, { e: email3, h: h3 });
        ok("konto bez zaświadczenia usunięte: zapis i dziennik szkolenia znikają", sql(`SELECT count(*) FROM cme_enrollments WHERE participant_id='${uid3}'`) === "0" && sql(`SELECT count(*) FROM cme_log WHERE participant_id='${uid3}'`) === "0");
        await c3.close();
        const poUsunieciu = await pg.evaluate(async (k) => (await fetch(`/api/zaswiadczenia/${k}`)).status, rat[3]);
        ok("weryfikacja działa po usunięciu konta", poUsunieciu === 200, String(poUsunieciu));
      }
      ok(`${nazwa}: bez błędów JS`, err.length === 0, err.slice(0, 2).join(" | "));
      await ctx.close();
    }
  } catch (e) {
    ok("przebieg", false, e.message.split("\n")[0]);
  } finally {
    // ── Sprzątanie: konta tymczasowe, ich rejestr szkolenia, fałszywe pytania, podsumowanie, ustawienia ──
    try {
      const ucz = sql(`SELECT DISTINCT participant_id FROM cme_enrollments e WHERE first_name='Testowa' AND last_name='Uczestniczka-Próbna'
        UNION SELECT id FROM users WHERE email IN (${konta.map((e) => `'${e}'`).join(",") || "''"})`).split("\n").filter(Boolean).map((i) => `'${i}'`).join(",");
      if (ucz) {
        sql(`DELETE FROM cme_certificates WHERE participant_id IN (${ucz}); DELETE FROM cme_log WHERE participant_id IN (${ucz});
          DELETE FROM cme_test_attempts WHERE participant_id IN (${ucz}); DELETE FROM cme_lecture_progress WHERE participant_id IN (${ucz});
          DELETE FROM cme_module_progress WHERE participant_id IN (${ucz}); DELETE FROM cme_enrollments WHERE participant_id IN (${ucz});`);
      }
      // licznik numerów od zera, gdy w bazie testowej nie zostało żadne zaświadczenie
      sql("DELETE FROM cme_certificate_counters WHERE NOT EXISTS (SELECT 1 FROM cme_certificates)");
      const nowe = sql("SELECT id FROM cme_survey_responses").split("\n").filter((i) => i && !ankietyPrzed.includes(i));
      if (nowe.length) sql(`DELETE FROM cme_survey_responses WHERE id IN (${nowe.map((i) => `'${i}'`).join(",")})`);
      if (konta.length) {
        sql(`DELETE FROM support_tickets WHERE user_email IN (${konta.map((e) => `'${e}'`).join(",")})`);
        sql(`DELETE FROM users WHERE email IN (${konta.map((e) => `'${e}'`).join(",")})`);
      }
      sql(`DELETE FROM attempts WHERE question_id IN (SELECT id FROM questions WHERE tags::jsonb ? 'e2e-cme'); DELETE FROM questions WHERE tags::jsonb ? 'e2e-cme'`);
      if (modulZPodsumowaniem && podsumowaniePrzed !== null) {
        sql(podsumowaniePrzed === "<<NULL>>" ? `UPDATE modules SET summary_md = NULL WHERE id='${modulZPodsumowaniem}'`
          : `UPDATE modules SET summary_md = $e2e$${podsumowaniePrzed}$e2e$ WHERE id='${modulZPodsumowaniem}'`);
      }
      for (const [k, v] of Object.entries(zapamietane)) {
        sql(v === null ? `DELETE FROM app_settings WHERE key='${k}'` : `UPDATE app_settings SET value='${v}' WHERE key='${k}'`);
      }
      ok("sprzątanie bazy testowej", sql("SELECT count(*) FROM questions WHERE tags::jsonb ? 'e2e-cme'") === "0");
    } catch (e) {
      ok("sprzątanie bazy testowej", false, e.message.split("\n")[0]);
    }
    await br.close();
  }
  console.log(wyn.join("\n"));
  console.log(`\n${wyn.filter((w) => w.startsWith("OK")).length} OK, ${wyn.filter((w) => w.startsWith("FAIL")).length} FAIL`);
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();

