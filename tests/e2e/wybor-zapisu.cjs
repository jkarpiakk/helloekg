// „Wybierz zapis” (image_choice) na becie, telefon 375 i komputer 1280:
// kolejność różna w dwóch podejściach, ocena po id (poprawna po zmianie kolejności), powiększenie
// nie zmienia zaznaczenia, alt przed odpowiedzią bez tekstu z rejestru, po sprawdzeniu kolory, opisy
// pod kartami, potem wyjaśnienie, w próbie zapisane wybrane id.
// Potrzebne opublikowane pytanie image_choice w bazie dev: KOD (domyślnie Q-0200) z poprawnym A1,
// jedyne w swoim temacie (pytanie bez wykładu → „Pytania utrwalające” modułu).
// BASE: :5055 (scripts/preview.sh) albo :5057 (scripts/preview-prod.sh, zbudowana aplikacja).
const { chromium, devices } = require("playwright");
const { execSync } = require("child_process");
const B = process.env.BASE || "http://localhost:5055";
const KOD = process.env.KOD || "Q-0200";
const WYN = process.env.WYN || ".";
const sql = (q) => execSync(`ssh helloekg-studio "sudo -u postgres psql -d helloekg_kurs_dev -Atq"`, { input: q }).toString().trim();
const wyn = []; const ok = (n, w, d = "") => wyn.push(`${w ? "OK  " : "FAIL"} ${n} ${d}`);

(async () => {
  sql("DELETE FROM rate_limit_store");
  const id = sql(`SELECT id FROM questions WHERE tags::jsonb ? 'studio:${KOD}' AND status = 'published'`);
  if (!id) { console.log(`FAIL brak opublikowanego pytania ${KOD} w bazie dev`); process.exit(1); }
  // Pytanie testowe bez wykładu jest jedynym w swoim temacie: nauka tematu podaje je za każdym razem
  // (powtórka po ids podaje tylko pytania już widziane)
  const sekcja = sql(`SELECT section_id FROM questions WHERE id = '${id}'`);
  const wTemacie = Number(sql(`SELECT count(*) FROM questions WHERE section_id = '${sekcja}' AND status = 'published'`));
  if (wTemacie !== 1) { console.log(`FAIL temat pytania ${KOD} ma ${wTemacie} opublikowanych pytań, test zakłada jedno`); process.exit(1); }
  const altRejestru = sql(`SELECT question_config->'config'->'options'->0->>'altText' FROM questions WHERE id = '${id}'`);

  const br = await chromium.launch();
  for (const [nazwa, opt] of [["telefon", devices["iPhone 13"]], ["komputer", { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await br.newContext({ ...opt, extraHTTPHeaders: { "X-Forwarded-Proto": "https" } });
    const pg = await ctx.newPage();
    const bledy = []; pg.on("pageerror", (e) => bledy.push(e.message));
    await pg.goto(B + "/");
    const userId = await pg.evaluate(async () => {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "podglad@helloekg.test", password: "Podglad-2026-lokalnie" }) });
      const j = await r.json(); localStorage.setItem("hk:feedback-hint-seen", "1"); localStorage.setItem("hk-tour-v1:" + j.user.id, "done");
      return j.user.id;
    });

    const karty = pg.locator('[data-testid="wz-karta"]');
    const sprawdz = pg.getByTestId("submit-interactive-answer");
    const podejscie = async () => {
      await pg.goto(`${B}/quiz?sectionId=${sekcja}`, { waitUntil: "networkidle" });
      await karty.first().waitFor();
      return karty.evaluateAll((els) => els.map((e) => e.dataset.opcja));
    };
    const wybierz = (idOpcji) => pg.locator(`[data-testid="wz-karta"][data-opcja="${idOpcji}"] [data-testid="wz-wybor"]`).click();

    // --- podejście 1 ---
    const k1 = await podejscie();
    ok(`${nazwa}: 4 karty z literami A–D`, k1.length === 4
      && (await karty.evaluateAll((els) => els.map((e) => e.dataset.litera).join(""))) === "ABCD");
    const alty = await pg.locator("img.wz-obraz").evaluateAll((els) => els.map((e) => e.alt));
    ok(`${nazwa}: alt przed odpowiedzią tylko „Zapis X”, bez tekstu z rejestru`,
      alty.every((a, i) => a === `Zapis ${"ABCD"[i]}`) && !alty.some((a) => altRejestru && a.includes(altRejestru.slice(0, 20))), JSON.stringify(alty));
    ok(`${nazwa}: „Sprawdź” nieaktywne przed wyborem`, await sprawdz.isDisabled());

    // powiększenie nie zaznacza i nie zmienia zaznaczenia
    await pg.getByTestId("wz-powieksz").nth(1).click();
    await pg.getByTestId("image-lightbox").waitFor();
    const altLightbox = await pg.getByTestId("lightbox-image").getAttribute("alt");
    await pg.keyboard.press("Escape");
    await pg.getByTestId("image-lightbox").waitFor({ state: "detached" });
    const zaznaczone = () => pg.locator('[data-testid="wz-wybor"][aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.closest("[data-opcja]").dataset.opcja));
    ok(`${nazwa}: powiększenie bez wyboru nie zaznacza karty`, (await zaznaczone()).length === 0 && await sprawdz.isDisabled());
    ok(`${nazwa}: alt w powiększeniu też tylko „Zapis B”`, altLightbox === "Zapis B", altLightbox);
    const pierwsza = k1.find((x) => x !== "A1");
    await wybierz(pierwsza);
    await pg.getByTestId("wz-powieksz").nth(k1.indexOf("A1")).click();
    await pg.getByTestId("image-lightbox").waitFor();
    await pg.getByTestId("close-lightbox").click();
    await pg.getByTestId("image-lightbox").waitFor({ state: "detached" });
    ok(`${nazwa}: powiększenie innej karty nie zmienia zaznaczenia`, JSON.stringify(await zaznaczone()) === JSON.stringify([pierwsza]));
    await wybierz("A1");
    ok(`${nazwa}: jeden wybór (karta zastępuje poprzednią)`, JSON.stringify(await zaznaczone()) === JSON.stringify(["A1"]));
    if (nazwa === "telefon") {
      ok(`${nazwa}: karty jedna pod drugą, bez przewijania w bok`,
        new Set(await karty.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))).size === 1
        && await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    } else {
      ok(`${nazwa}: dwie kolumny`, new Set(await karty.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))).size === 2);
    }
    await pg.screenshot({ path: `${WYN}/wz-${nazwa}-przed.png`, fullPage: true });
    await sprawdz.click();
    await pg.getByTestId("explanation-panel").waitFor();
    ok(`${nazwa}: podejście 1, poprawny A1 na pozycji ${"ABCD"[k1.indexOf("A1")]}: „Dobrze.”`,
      (await pg.getByTestId("result-title").innerText()).includes("Dobrze"));
    ok(`${nazwa}: po sprawdzeniu A1 zielony, opisy pod 4 kartami`,
      (await pg.locator('.wz-karta.is-poprawny[data-opcja="A1"]').count()) === 1 && (await pg.getByTestId("wz-opis").count()) === 4);
    const kolejnosc = await pg.evaluate(() => {
      const opis = document.querySelector('[data-testid="wz-opis"]'); const panel = document.querySelector('[data-testid="explanation-panel"]');
      return !!(opis && panel && (opis.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    ok(`${nazwa}: opisy kart przed ogólnym wyjaśnieniem`, kolejnosc);
    const altPo = await pg.locator('.wz-karta[data-opcja="A1"] img').getAttribute("alt");
    ok(`${nazwa}: alt po sprawdzeniu z rejestru`, !!altRejestru && (altPo || "").includes(altRejestru.slice(0, 30)), (altPo || "").slice(0, 60));
    await pg.screenshot({ path: `${WYN}/wz-${nazwa}-po.png`, fullPage: true });
    const zapis1 = sql(`SELECT answer_data::text FROM attempts WHERE user_id = '${userId}' AND question_id = '${id}' ORDER BY created_at DESC LIMIT 1`);
    ok(`${nazwa}: w próbie zapisane wybrane id`, zapis1 === '{"type":"image_choice","selectedIds":["A1"]}', zapis1);

    // --- kolejne podejścia: inna kolejność, ocena nadal po id ---
    let k2 = null;
    for (let i = 0; i < 8 && !k2; i++) { const k = await podejscie(); if (k.join() !== k1.join()) k2 = k; }
    ok(`${nazwa}: kolejność w drugim podejściu inna`, !!k2, `${k1.join()} → ${k2 ? k2.join() : "bez zmiany"}`);
    if (k2) {
      // stabilnie w obrębie podejścia: zaznaczenie i rerender nie tasują
      await wybierz(k2[0]);
      ok(`${nazwa}: kolejność stabilna w obrębie podejścia`, (await karty.evaluateAll((els) => els.map((e) => e.dataset.opcja))).join() === k2.join());
      await wybierz("A1");
      await sprawdz.click();
      await pg.getByTestId("explanation-panel").waitFor();
      ok(`${nazwa}: po zmianie kolejności A1 (teraz ${"ABCD"[k2.indexOf("A1")]}) nadal „Dobrze.”`,
        (await pg.getByTestId("result-title").innerText()).includes("Dobrze"));
    }
    // błędna odpowiedź: czerwona karta, „Nie tym razem.”
    const k3 = await podejscie();
    const zla = k3.find((x) => x !== "A1");
    await wybierz(zla);
    await sprawdz.click();
    await pg.getByTestId("explanation-panel").waitFor();
    ok(`${nazwa}: błędny wybór: „Nie tym razem.”, karta czerwona, poprawna zielona`,
      (await pg.getByTestId("result-title").innerText()).includes("Nie tym razem")
      && (await pg.locator(`.wz-karta.is-bledny[data-opcja="${zla}"]`).count()) === 1
      && (await pg.locator('.wz-karta.is-poprawny[data-opcja="A1"]').count()) === 1);
    const zapis3 = sql(`SELECT answer_data::text FROM attempts WHERE user_id = '${userId}' AND question_id = '${id}' ORDER BY created_at DESC LIMIT 1`);
    ok(`${nazwa}: w próbie zapisany błędny wybór`, zapis3 === `{"type":"image_choice","selectedIds":["${zla}"]}`, zapis3);
    await pg.screenshot({ path: `${WYN}/wz-${nazwa}-po-bledna.png`, fullPage: true });

    ok(`${nazwa}: bez błędów strony`, bledy.length === 0, bledy[0] || "");
    await ctx.close();
  }
  // ocena po stronie serwera: litera ani pozycja nic nie znaczą, śmieci = błąd
  const ctx = await br.newContext({ extraHTTPHeaders: { "X-Forwarded-Proto": "https" } });
  const pg = await ctx.newPage();
  await pg.goto(B + "/");
  const odp = await pg.evaluate(async (qid) => {
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "podglad@helloekg.test", password: "Podglad-2026-lokalnie" }) });
    const wyslij = async (answerData) => (await (await fetch("/api/quiz/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: qid, selectedIndex: -1, timeMs: 1000, mode: "review", answerData }) })).json());
    return {
      litera: await wyslij({ type: "image_choice", selectedIds: ["A"] }),
      smieci: await wyslij({ type: "image_choice", selectedIds: "A1" }),
      dwie: await wyslij({ type: "image_choice", selectedIds: ["A1", "A2"] }),
      dobra: await wyslij({ type: "image_choice", selectedIds: ["A1"] }),
    };
  }, id);
  ok("serwer: litera zamiast id = błąd", odp.litera.isCorrect === false);
  ok("serwer: śmieci zamiast tablicy = błąd", odp.smieci.isCorrect === false);
  ok("serwer: dwa wybory przy jednej poprawnej = błąd, bez punktów częściowych", odp.dwie.isCorrect === false && !(odp.dwie.partialScore > 0));
  ok("serwer: id poprawnej = dobrze, wynik z pełnymi opcjami", odp.dobra.isCorrect === true && odp.dobra.questionConfig?.config?.options?.length === 4);
  await ctx.close();
  await br.close();
  console.log(wyn.join("\n"));
  process.exit(wyn.some((w) => w.startsWith("FAIL")) ? 1 : 0);
})();
