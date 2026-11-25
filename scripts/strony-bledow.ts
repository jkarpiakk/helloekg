/**
 * Statyczna strona przerwy serwera (502, 503, 504) dla Caddy: ops/bledy/przerwa.html.
 * Gdy aplikacja kursu nie odpowiada (restart przy wdrożeniu, awaria), Caddy nie ma do czego się odwołać,
 * więc strona jest samowystarczalna: style i skrypt w środku, czcionki systemowe, ten sam pasek EKG
 * co w aplikacji (client/src/components/bledy/pasek.ts, wbudowany przez esbuild).
 * Uruchom po zmianie paska albo tekstów: npx tsx scripts/strony-bledow.ts
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const KOREN = path.resolve(import.meta.dirname, "..");
const js = await build({
  stdin: {
    contents: `import { pasek } from "./client/src/components/bledy/pasek.ts"; window.hkPasek = pasek;`,
    resolveDir: KOREN,
    loader: "ts",
  },
  bundle: true,
  minify: true,
  format: "iife",
  write: false,
  target: "es2019",
});
const pasekJs = js.outputFiles[0].text.trim();

const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Chwilowa przerwa · helloEKG</title>
<style>
:root{--ink:#F8FAF9;--panel:#FFFFFF;--line:#E2E8E5;--line2:#CFD9D4;--puls:#0B7E54;--txt:#0C1210;--txt2:#46534F;--label:#5F6D68;--on:#FFFFFF;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--ink:#0B0F14;--panel:#0E141A;--line:#1A222B;--line2:#223040;--puls:#3EE6A8;--txt:#F2F6F4;--txt2:#9BA7AF;--label:#84919A;--on:#07130E;color-scheme:dark}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--txt);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:40rem;margin:0 auto;padding:clamp(40px,10vh,96px) max(16px,env(safe-area-inset-right)) 48px max(16px,env(safe-area-inset-left));display:grid;gap:28px}
.logo{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:17px;letter-spacing:-.01em;color:var(--txt);text-decoration:none}
.logo svg{color:var(--puls)}
figure{margin:0;border:1px solid var(--line);border-radius:14px;background:var(--panel);overflow:hidden}
.bar{display:flex;justify-content:space-between;gap:12px;padding:8px 12px;border-bottom:1px solid var(--line);font:500 12px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.07em;text-transform:uppercase;color:var(--label)}
.bar b{color:var(--puls);font-weight:500}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--puls);margin-right:8px;vertical-align:1px}
.ekg{position:relative;height:116px}
.ekg svg{display:block}
.label{font:400 12px/1.4 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--label);margin:0}
h1{margin:0;font:500 clamp(1.75rem,1.2rem + 2.2vw,2.75rem)/1.08 ui-sans-serif,system-ui,sans-serif;letter-spacing:-.025em;text-wrap:balance}
.lead{margin:0;font-size:clamp(1.0625rem,1rem + .3vw,1.25rem);color:var(--txt2);max-width:34em;text-wrap:pretty}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px}
button{appearance:none;min-height:44px;padding:0 22px;border-radius:999px;border:1px solid var(--puls);background:var(--puls);color:var(--on);font:500 15px/1 inherit;cursor:pointer;transition:transform .1s ease-out}
button:active{transform:scale(.97)}
.uwaga{font-size:14px;color:var(--txt2)}
.sweep{stroke-dasharray:1 1;animation:hk 3.5s linear infinite}
@keyframes hk{0%{stroke-dashoffset:1;opacity:1}78%{stroke-dashoffset:0;opacity:1}95%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
@media (prefers-reduced-motion:reduce){.sweep{animation:none;stroke-dasharray:none}button{transition:none}}
</style>
</head>
<body>
<main>
  <a class="logo" href="/" aria-label="helloEKG"><svg width="26" height="18" viewBox="0 0 26 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 10h5l2-6 3 12 3-14 2.5 8H25"/></svg>helloEKG</a>
  <figure role="img" aria-label="Zapis EKG: prostokąty cechy 10 mm/mV, jak przy kalibracji aparatu.">
    <div class="bar"><span><span class="dot"></span>II · 25 mm/s · 10 mm/mV</span><b data-kod>{{placeholder "http.error.status_code"}}</b></div>
    <div class="ekg" id="ekg"></div>
  </figure>
  <div style="display:grid;gap:16px">
    <p class="label">Chwilowa przerwa</p>
    <h1>Kalibrujemy aparat</h1>
    <p class="lead">Kurs na moment zniknął z monitora: właśnie go aktualizujemy albo uruchamiamy ponownie. Zwykle trwa to kilka sekund. Zatwierdzone odpowiedzi i postęp są bezpieczne.</p>
  </div>
  <div class="row">
    <button type="button" id="teraz">Spróbuj teraz</button>
    <span class="uwaga" id="licznik" aria-live="polite">Sami spróbujemy ponownie za 10 s.</span>
  </div>
  <p class="uwaga">Trwa to dłużej niż kilka minut? Napisz na kontakt@helloekg.pl.</p>
</main>
<script>${pasekJs}</script>
<script>
(function () {
  var kod = document.querySelector("[data-kod]");
  if (!kod || /^\\s*\\{\\{/.test(kod.textContent)) kod.textContent = "502";
  var host = document.getElementById("ekg");
  function rysuj() {
    var w = Math.round(host.clientWidth), px = w < 480 ? 3.4 : 4, p = window.hkPasek("cecha", w, px);
    var mm = px.toFixed(2), big = (px * 5).toFixed(2), kol = getComputedStyle(document.documentElement).getPropertyValue("--puls").trim();
    host.style.height = p.wysokosc + "px";
    host.style.backgroundImage = ["linear-gradient(" + kol + "22 1px,transparent 1px)", "linear-gradient(90deg," + kol + "22 1px,transparent 1px)", "linear-gradient(" + kol + "0d 1px,transparent 1px)", "linear-gradient(90deg," + kol + "0d 1px,transparent 1px)"].join(",");
    host.style.backgroundSize = big + "px " + big + "px," + big + "px " + big + "px," + mm + "px " + mm + "px," + mm + "px " + mm + "px";
    host.innerHTML = '<svg width="' + w + '" height="' + p.wysokosc + '" viewBox="0 0 ' + w + " " + p.wysokosc + '" aria-hidden="true"><path class="sweep" pathLength="1" d="' + p.d + '" fill="none" stroke="var(--puls)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" style="animation-duration:' + (p.sekundy / 0.78).toFixed(2) + 's"/></svg>';
  }
  rysuj();
  var t; addEventListener("resize", function () { clearTimeout(t); t = setTimeout(rysuj, 150); });
  // Ponowna próba: co 10 s pytamy, czy kurs już odpowiada; jeśli tak, wracamy na tę samą stronę
  var zostalo = 10, licz = document.getElementById("licznik");
  function sprobuj() {
    licz.textContent = "Sprawdzam…";
    fetch("/", { method: "HEAD", cache: "no-store" }).then(function (r) {
      if (r.status < 500) location.reload(); else { zostalo = 10; }
    }).catch(function () { zostalo = 10; });
  }
  document.getElementById("teraz").addEventListener("click", sprobuj);
  setInterval(function () {
    zostalo -= 1;
    if (zostalo <= 0) { sprobuj(); return; }
    licz.textContent = "Sami spróbujemy ponownie za " + zostalo + " s.";
  }, 1000);
})();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(KOREN, "ops/bledy/przerwa.html"), html);
console.log(`ops/bledy/przerwa.html: ${(html.length / 1024).toFixed(1)} kB`);
