import { describe, it, expect } from "vitest";
import { etykietaJednostki } from "../../client/src/lib/courseOrder";

/** Z-127: jedna etykieta jednostki; słowo i numeracja do decyzji JK */
describe("etykietaJednostki", () => {
  const mods = [
    { id: "m2", title: "Drugi", order: 2, sections: [{ id: "c", title: "c", order: 1, chapterCount: 3 }] },
    {
      id: "m1", title: "Pierwszy", order: 1,
      sections: [
        { id: "a", title: "a", order: 1, chapterCount: 4 },
        { id: "p", title: "p", order: 2, chapterCount: 0, questionCount: 10 },
        { id: "b", title: "b", order: 3, chapterCount: 2 },
      ],
    },
  ];
  it("numeracja jak na liście", () => {
    expect(etykietaJednostki(mods, "b", { slowo: "Wykład", numeracja: "lista" })).toBe("Moduł 01 · Wykład 03");
    expect(etykietaJednostki(mods, "c", { slowo: "Temat", numeracja: "lista" })).toBe("Moduł 02 · Temat 01");
  });
  it("numeracja wykładów: temat bez wykładu to „Pytania utrwalające”", () => {
    expect(etykietaJednostki(mods, "b", { slowo: "Wykład", numeracja: "wyklady" })).toBe("Moduł 01 · Wykład 02");
    expect(etykietaJednostki(mods, "p", { slowo: "Wykład", numeracja: "wyklady" })).toBe("Moduł 01 · Pytania utrwalające");
    expect(etykietaJednostki(mods, "x", { slowo: "Wykład", numeracja: "wyklady" })).toBeNull();
  });
});
