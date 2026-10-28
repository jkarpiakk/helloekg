/**
 * Linki z maili (weryfikacja adresu, reset i ustawienie hasła). W zamkniętej becie link niesie klucz bety:
 * Caddy wpuszcza za bramkę tylko takie linki, więc samo `?token=` nie otwiera kursu obcym.
 */
export function linkZMaila(sciezka: "/verify-email" | "/reset-password", token: string): string {
  const base = (process.env.FRONTEND_URL || "http://localhost:5000").replace(/\/+$/, "");
  const url = new URL(base + sciezka);
  url.searchParams.set("token", token);
  if (process.env.BETA_LINK_KEY) url.searchParams.set("beta", process.env.BETA_LINK_KEY);
  return url.toString();
}
