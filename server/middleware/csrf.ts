import type { Request, Response, NextFunction } from "express";

/**
 * Ochrona CSRF dla API: każde żądanie zmieniające stan (nie GET/HEAD/OPTIONS) do /api
 * musi pochodzić z naszej strony.
 *
 *  - Sec-Fetch-Site (jeśli przeglądarka go wysyła): dozwolone tylko "same-origin" i "none".
 *  - Origin (albo Referer, gdy brak Origin): host musi być jednym z naszych hostów —
 *    APP_BASE_URL, FRONTEND_URL albo host, na który przyszło żądanie (Host za Caddy jest zachowany).
 *  - Brak Origin i Referer: odrzucamy, wyjątek tylko dla webhooków Stripe
 *    (wywołania serwer–serwer, weryfikowane podpisem).
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const WEBHOOK_PREFIX = "/api/stripe/webhook/";

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function allowedHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  for (const u of [process.env.APP_BASE_URL, process.env.FRONTEND_URL]) {
    const h = hostOf(u);
    if (h) hosts.add(h);
  }
  const reqHost = req.get("host");
  if (reqHost) hosts.add(reqHost.toLowerCase());
  return hosts;
}

const reject = (res: Response) =>
  res.status(403).json({ error: "Żądanie odrzucone (nieprawidłowe pochodzenie). Odśwież stronę i spróbuj ponownie." });

export function csrfOriginCheck(req: Request, res: Response, next: NextFunction) {
  // Express dopasowuje trasy bez względu na wielkość liter, więc „/API/…” też musi przejść kontrolę
  const sciezka = req.path.toLowerCase();
  if (SAFE_METHODS.has(req.method) || !sciezka.startsWith("/api")) return next();

  const isWebhook = sciezka.startsWith(WEBHOOK_PREFIX);

  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    console.warn(`[csrf] rejected ${req.method} ${req.path}: Sec-Fetch-Site=${fetchSite}`);
    return reject(res);
  }

  const origin = req.get("origin");
  const referer = req.get("referer");
  if (!origin && !referer) {
    if (isWebhook) return next();
    console.warn(`[csrf] rejected ${req.method} ${req.path}: no Origin/Referer`);
    return reject(res);
  }

  // "Origin: null" (sandbox, przekierowania) → hostOf zwraca null → odrzucone
  const sourceHost = hostOf(origin || referer);
  if (!sourceHost || !allowedHosts(req).has(sourceHost)) {
    console.warn(`[csrf] rejected ${req.method} ${req.path}: origin=${origin ?? "-"} referer=${referer ? "set" : "-"}`);
    return reject(res);
  }

  next();
}
