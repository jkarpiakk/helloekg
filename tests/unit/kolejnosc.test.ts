import { describe, it, expect } from "vitest";
import { ukladPozaWzorcem } from "@shared/kolejnosc";

/** Z-122 (C2b): układ startowy kolejności bez elementu na pozycji ze wzorca, także przy 2 i 3 elementach */
describe("ukladPozaWzorcem", () => {
  const el = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i}` }));
  for (const n of [2, 3, 4, 6]) {
    it(`${n} elementy: 500 losowań, żaden element na swoim miejscu, ten sam zbiór`, () => {
      const items = el(n), wzor = items.map((x) => x.id);
      for (let k = 0; k < 500; k++) {
        const u = ukladPozaWzorcem(items, wzor);
        expect(u.map((x) => x.id).sort()).toEqual([...wzor].sort());
        expect(u.some((x, i) => x.id === wzor[i])).toBe(false);
      }
    });
  }
  it("2 elementy: jedyny możliwy układ to zamiana", () => {
    expect(ukladPozaWzorcem(el(2), ["e0", "e1"]).map((x) => x.id)).toEqual(["e1", "e0"]);
  });
  it("los, który zawsze daje wzorzec: awaryjnie przesunięcie o jedno miejsce", () => {
    expect(ukladPozaWzorcem(el(3), ["e0", "e1", "e2"], () => 0.9999).map((x) => x.id)).toEqual(["e1", "e2", "e0"]);
  });
  it("1 element bez zmian", () => {
    expect(ukladPozaWzorcem(el(1), ["e0"]).map((x) => x.id)).toEqual(["e0"]);
  });
});
