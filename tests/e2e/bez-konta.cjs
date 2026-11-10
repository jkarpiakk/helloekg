// Bez konta żadna treść kursu się nie otwiera. Tylko żądania GET/HEAD bez sesji: bezpieczne także na produkcji.
// Lista tras API z kodu serwera (server/*.ts), parametry podstawione atrapami; grafiki kursu: próbka plików z katalogu
// assets (ASSETS_LIST: plik z nazwami, jedna w linii) albo z podanej listy. Wynik: tabela ścieżka → status.
//   BASE=https://kurs.helloekg.pl ASSETS_LIST=/tmp/assets.txt node tests/e2e/bez-konta.cjs [--md raport.md]
const fs = require("fs");
const path = require("path");
const B = process.env.BASE || "http://localhost:5065";
const root = path.join(__dirname, "../..");

// Publiczne z założenia: strona startowa i strony aplikacji (sam szkielet SPA, dane idą z API), dokumenty, security.txt
const PUBLICZNE = new Set(["/health", "/ready", "/robots.txt", "/.well-known/security.txt", "/api/config", "/api/dokumenty/:id"]);
// Trasy, które bez konta mają inną odpowiedź niż 401 (opis w raporcie)
const OCZEKIWANE = {
  "/api/dokumenty/:id": [404, 200], // 404 przed publikacją, 200 po
  "/api/plans": [404], "/api/stripe/config": [404], // płatności wyłączone
};

function trasyZKodu() {
  const pliki = ["server/routes.ts", "server/feedbackRoutes.ts", "server/learningAnalyticsRoutes.ts"];
  const out = [];
  for (const p of pliki) {
    const s = fs.readFileSync(path.join(root, p), "utf8");
    for (const m of s.matchAll(/app\.get\("([^"]+)"/g)) out.push(m[1]);
  }
  return [...new Set(out)];
}
const podstaw = (p) => p
  .replace(/:sectionId/g, "00000000-0000-0000-0000-000000000000")
  .replace(/:id/g, p.startsWith("/api/dokumenty") ? "regulamin_bety" : "00000000-0000-0000-0000-000000000000")
  .replace(/:n/g, "0").replace(/:certificateId/g, "EKG-00000000-00000000").replace(/:[A-Za-z]+(\(\*\))?/g, "x");

(async () => {
  const wiersze = [];
  const zle = [];
  for (const t of trasyZKodu()) {
    const url = podstaw(t);
    const r = await fetch(B + url, { redirect: "manual" });
    const ok = PUBLICZNE.has(t)
      ? (OCZEKIWANE[t] ?? [200]).includes(r.status)
      : (OCZEKIWANE[t] ?? [401]).includes(r.status);
    wiersze.push([url, r.status, PUBLICZNE.has(t) ? "publiczne" : "zamknięte", ok]);
    if (!ok) zle.push(`${url}=${r.status}`);
  }
  // grafiki kursu
  const lista = process.env.ASSETS_LIST ? fs.readFileSync(process.env.ASSETS_LIST, "utf8").split("\n").filter(Boolean) : [];
  let graf401 = 0;
  for (const f of lista) {
    const r = await fetch(`${B}/content-assets/${f}`, { redirect: "manual" });
    if (r.status === 401) graf401++; else zle.push(`/content-assets/${f}=${r.status}`);
  }
  // strony aplikacji: szkielet SPA bez treści (treść tylko z API)
  for (const p of ["/", "/modules", "/dashboard", "/quiz", "/lecture/00000000-0000-0000-0000-000000000000", "/admin", "/regulamin-bety", "/polityka-prywatnosci"]) {
    const r = await fetch(B + p);
    const html = await r.text();
    const bezTresci = !/rozdzia[łl]|załamek P|odprowadzenie/i.test(html.replace(/<script[\s\S]*?<\/script>/g, ""));
    wiersze.push([p, r.status, "szkielet aplikacji (bez treści)", r.status === 200 && bezTresci]);
    if (!(r.status === 200 && bezTresci)) zle.push(`${p}: treść w HTML?`);
  }
  const zamkniete = wiersze.filter((w) => w[2] === "zamknięte");
  console.log(wiersze.map(([u, s, k, ok]) => `${ok ? "OK  " : "FAIL"} ${s} ${k.padEnd(10)} ${u}`).join("\n"));
  console.log(`\nAPI zamknięte: ${zamkniete.filter((w) => w[3]).length}/${zamkniete.length}, grafiki 401: ${graf401}/${lista.length}`);
  if (process.argv[2] === "--md" && process.argv[3]) {
    const md = [
      `Sprawdzone bez konta na ${B} (${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC), tests/e2e/bez-konta.cjs.`,
      "",
      "| Ścieżka | Status | Rodzaj | Wynik |",
      "|---|---|---|---|",
      ...wiersze.map(([u, s, k, ok]) => `| \`${u}\` | ${s} | ${k} | ${ok ? "zgodnie z oczekiwaniem" : "**NIEZGODNE**"} |`),
      `| \`/content-assets/…\` (${lista.length} plików kursu) | 401: ${graf401} | zamknięte | ${graf401 === lista.length ? "zgodnie z oczekiwaniem" : "**NIEZGODNE**"} |`,
      "",
    ].join("\n");
    fs.writeFileSync(process.argv[3], md);
  }
  if (zle.length) console.log("\nNIEZGODNE: " + zle.join(", "));
  process.exit(zle.length ? 1 : 0);
})();
