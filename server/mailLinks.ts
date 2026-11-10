/**
 * Linki z maili (potwierdzenie adresu, ustawienie hasła): zawsze na adres kursu z konfiguracji serwera
 * (FRONTEND_URL), nigdy z nagłówka Host żądania. Token jest jednorazowy i wygasa (24 h / 1 h, server/auth.ts).
 */
export function linkZMaila(sciezka: "/verify-email" | "/reset-password", token: string): string {
  const base = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
  const url = new URL(base + sciezka);
  url.searchParams.set("token", token);
  return url.toString();
}
