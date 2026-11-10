#!/usr/bin/env python3
"""Lista endpointów kursu (docs/pentest/openapi.yaml) wygenerowana z definicji tras Express.
Dostęp wynika z middleware w definicji trasy: requireKonto (sesja + potwierdzony e-mail), requireAuth (sesja),
role (requireReviewer/Admin/Owner/SubscriptionManager/FeedbackAdmin/LearningAdmin), requireActiveSubscription,
tylkoGdyPlatnosci (404 przy wyłączonych płatnościach). Uruchom ponownie po zmianie tras."""
import re, pathlib, json
root = pathlib.Path(__file__).resolve().parent.parent
pliki = ["server/index.ts", "server/routes.ts", "server/feedbackRoutes.ts", "server/learningAnalyticsRoutes.ts"]
ROLE = {
    "requireReviewer": ["owner", "reviewer"], "requireAdmin": ["owner", "admin"], "requireOwner": ["owner"],
    "requireSubscriptionManager": ["owner", "support"], "requireUserViewer": ["owner", "admin", "reviewer"],
    "requireFeedbackAdmin": ["owner", "admin", "reviewer"], "requireLearningAdmin": ["owner", "admin", "reviewer"],
}
trasy = []
for p in pliki:
    s = (root / p).read_text()
    for m in re.finditer(r'app\.(get|post|put|patch|delete)\(\s*"([^"]+)",([^\n]*)', s):
        metoda, sciezka, reszta = m.group(1), m.group(2), m.group(3)
        mw = re.findall(r'\b(require\w+|tylkoGdyPlatnosci|authRateLimit|paymentRateLimit|accountDeleteRateLimit|apiRateLimit|parseFeedbackBody)\b', reszta)
        trasy.append((metoda, sciezka, mw, p))
def dostep(mw, sciezka):
    if sciezka.startswith("/api/stripe/webhook"): return "publiczny, podpis Stripe-Signature (STRIPE_WEBHOOK_SECRET)"
    role = [r for k in mw if k in ROLE for r in ROLE[k]]
    if "requireKonto" in mw: base = "sesja + potwierdzony e-mail"
    elif "requireAuth" in mw: base = "sesja (także niepotwierdzony e-mail)"
    else: base = "publiczny"
    if role: base += f"; role: {', '.join(dict.fromkeys(role))}"
    if "requireActiveSubscription" in mw: base += "; aktywny dostęp (tester bety albo opłacony; role zespołu bez ograniczeń)"
    if "tylkoGdyPlatnosci" in mw: base += "; 404 gdy PLATNOSCI_WLACZONE nie jest ustawione (dziś: 404)"
    lim = [k for k in mw if k.endswith("RateLimit")]
    if lim: base += f"; limit: {', '.join(lim)}"
    return base
out = ["openapi: 3.0.3", "info:", "  title: helloEKG kurs (kurs.helloekg.pl) API", "  version: \"2026-11-10\"",
       "  description: |", "    Wygenerowane z kodu tras (scripts/openapi-z-tras.py). Każda operacja ma w opisie warunek dostępu.",
       "    Uwierzytelnienie: ciasteczko sesji connect.sid (HttpOnly, Secure, SameSite=Lax) po POST /api/auth/login.",
       "    Żądania zmieniające stan (POST/PUT/PATCH/DELETE na /api) wymagają nagłówka Origin albo Referer z tej samej domeny (CSRF).",
       "    Wszystkie /api mają limit 100 żądań na minutę na IP i ścieżkę; nieznana ścieżka /api zwraca 404 JSON.",
       "servers:", "  - url: https://kurs.helloekg.pl", "components:", "  securitySchemes:",
       "    sesja:", "      type: apiKey", "      in: cookie", "      name: connect.sid", "paths:"]
grupy = {}
for metoda, sciezka, mw, p in trasy:
    oas = re.sub(r':(\w+)(\(\*\))?', r'{\1}', sciezka)
    grupy.setdefault(oas, []).append((metoda, sciezka, mw, p))
for oas in sorted(grupy):
    out.append(f"  {json.dumps(oas)}:")
    for metoda, sciezka, mw, p in grupy[oas]:
        d = dostep(mw, sciezka)
        out.append(f"    {metoda}:")
        out.append(f"      summary: {json.dumps(sciezka)}")
        out.append(f"      description: {json.dumps(d + f' (kod: {p})', ensure_ascii=False)}")
        params = re.findall(r':(\w+)', sciezka)
        if params:
            out.append("      parameters:")
            for prm in params:
                out.append(f"        - {{name: {prm}, in: path, required: true, schema: {{type: string}}}}")
        if "publiczny" not in d.split(";")[0]:
            out.append("      security: [{sesja: []}]")
        out.append("      responses:")
        out.append("        \"200\": {description: OK}")
        if "sesja" in d: out.append("        \"401\": {description: brak sesji}")
        if "potwierdzony" in d: out.append("        \"403\": {description: \"EMAIL_NOT_VERIFIED, rola albo SUBSCRIPTION_REQUIRED\"}")
# trasy spoza Express Router: statyczne
out += ["  \"/content-assets/{plik}\":", "    get:", "      summary: grafiki kursu (pliki ze studia)",
        "      description: \"sesja + potwierdzony e-mail; Cache-Control: private\"", "      security: [{sesja: []}]",
        "      parameters:", "        - {name: plik, in: path, required: true, schema: {type: string}}",
        "      responses: {\"200\": {description: obraz}, \"401\": {description: brak sesji}}",
]
(root / "docs/pentest/openapi.yaml").write_text("\n".join(out) + "\n")
print(f"{len(trasy)} operacji")
