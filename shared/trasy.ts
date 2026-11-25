/**
 * Trasy aplikacji kursu (client/src/App.tsx), żeby serwer znał kod odpowiedzi strony: znana trasa 200,
 * nieznana 404 z tą samą stroną (aplikacja pokaże „Ten adres nie przewodzi”). Dotąd każdy adres dawał 200.
 * Test tests/unit/trasy.test.ts pilnuje, żeby lista zgadzała się z <Route path> w App.tsx.
 */
export const TRASY_SPA = [
  "/", "/quiz", "/dashboard", "/modules", "/lecture/:sectionId", "/lecture", "/module3-lecture", "/simulator",
  "/blog", "/blog/*", "/pricing", "/checkout", "/payment-success", "/regulamin-bety", "/polityka-prywatnosci",
  "/potwierdz-email", "/admin", "/verify-email", "/reset-password", "/forgot-password", "/zgloszenie",
  "/szkolenie", "/szkolenie/test", "/szkolenie/ankieta", "/modul/:id", "/program-szkolenia", "/regulamin-szkolenia",
  "/zaswiadczenie/:klucz", "/certificate/preview", "/certificate/:certificateId",
] as const;

const WZORCE = TRASY_SPA.map((t) => {
  const r = t
    .split("/")
    .map((seg) => (seg === "*" ? ".*" : seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${r}/?$`);
});

/** Czy ścieżka (bez zapytania) to strona aplikacji */
export function znanaTrasa(sciezka: string): boolean {
  const s = sciezka.split("?")[0] || "/";
  return WZORCE.some((w) => w.test(s));
}
