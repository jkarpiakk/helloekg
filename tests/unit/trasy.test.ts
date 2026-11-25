import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TRASY_SPA, znanaTrasa } from "@shared/trasy";

/** Strony błędów 25.11: serwer daje 404 dla adresu spoza tras aplikacji */
describe("trasy aplikacji", () => {
  it("lista zgadza się z <Route path> w App.tsx", () => {
    const app = fs.readFileSync(path.join(__dirname, "../../client/src/App.tsx"), "utf8");
    const wApp = [...new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]))].sort();
    expect(wApp).toEqual([...TRASY_SPA].sort());
  });
  it("znane i nieznane adresy", () => {
    for (const s of ["/", "/modules", "/modules/", "/lecture/abc-123", "/quiz?mode=review&ids=1", "/blog/stary-wpis/x", "/certificate/preview", "/zaswiadczenie/K1"]) expect(znanaTrasa(s)).toBe(true);
    for (const s of ["/nie-ma-takiej-strony", "/lecture/a/b", "/modulesx", "/admin/cos", "/.env", "/wp-login.php"]) expect(znanaTrasa(s)).toBe(false);
  });
});
