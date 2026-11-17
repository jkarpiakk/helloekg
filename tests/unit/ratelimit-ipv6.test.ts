import { describe, it, expect, vi } from "vitest";

// moduł limitów importuje bazę; sama funkcja klucza jej nie używa
vi.mock("../../server/db", () => ({ db: {}, pool: {} }));
import { kluczAdresu } from "../../server/middleware/rateLimit";

/** Z-119 (2): licznik nieudanych logowań liczy sieć IPv6 /64 tak samo dla skróconego i pełnego zapisu */
describe("kluczAdresu", () => {
  it("skrócony i pełny zapis tej samej sieci /64 dają jeden klucz", () => {
    expect(kluczAdresu("2a01:110::5")).toBe(kluczAdresu("2a01:0110:0000:0000:abcd:1:2:3"));
    expect(kluczAdresu("2a01:110::5")).toBe("2a01:110:0:0::/64");
  });
  it("IPv4 i IPv4 w IPv6 bez zmian; brak adresu", () => {
    expect(kluczAdresu("::ffff:10.0.0.7")).toBe("10.0.0.7");
    expect(kluczAdresu("10.0.0.7")).toBe("10.0.0.7");
    expect(kluczAdresu(undefined)).toBe("brak");
  });
});
