import { describe, it, expect } from "vitest";
import { ocenLuki, lukaPoprawna, parseNumberPl, normalizeAnswer, type Luka } from "@shared/luki";

/** Z-117: luki oceniane jak w studiu (shared/src/grading.ts: normalizeAnswer, parseNumberPl, gradeFillBlank) */
describe("luki", () => {
  const zakres: Luka = { id: "qt", correctAnswers: ["440"], validationType: "numeric_range", numericRange: { min: 400, max: 480 } };
  const pq: Luka = { id: "pq", correctAnswers: ["0,12"], validationType: "numeric_range", numericRange: { min: 0.11, max: 0.13 } };
  const slowo: Luka = { id: "w", correctAnswers: ["węźle zatokowym"], validationType: "exact" };

  it("zakres: liczba z przecinkiem tak, dopiski nie (dawniej parseFloat zaliczał)", () => {
    expect(lukaPoprawna(zakres, "440")).toBe(true);
    expect(lukaPoprawna(zakres, " 4 40 ")).toBe(true);
    expect(lukaPoprawna(zakres, "75abc")).toBe(false);
    expect(lukaPoprawna(zakres, "440ms")).toBe(false);
    expect(lukaPoprawna(pq, "0,12")).toBe(true);
    expect(lukaPoprawna(pq, "0,12 s")).toBe(false);
    expect(parseNumberPl(",5")).toBe(0.5);
  });

  it("exact: wielkość liter i spacje bez znaczenia, polskie znaki tak", () => {
    expect(lukaPoprawna(slowo, "  Węźle   zatokowym ")).toBe(true);
    expect(lukaPoprawna(slowo, "wezle zatokowym")).toBe(false);
    expect(normalizeAnswer(" A  B ")).toBe("a b");
  });

  it("regex z flagą u (polskie litery w klasach znaków)", () => {
    expect(lukaPoprawna({ id: "r", correctAnswers: [], validationType: "regex", regex: "^wąski\\w*$" }, "Wąskimi")).toBe(true);
    expect(lukaPoprawna({ id: "r", correctAnswers: [], validationType: "regex", regex: "(" }, "x")).toBe(false);
  });

  it("pusta albo nieprzysłana luka jest błędna, obce identyfikatory pomijane", () => {
    const r = ocenLuki([zakres, slowo], [{ blankId: "qt", value: "440" }, { blankId: "obca", value: "x" }]);
    expect(r).toEqual({ isCorrect: false, partialScore: 0.5, correctItems: ["qt"], incorrectItems: ["w"] });
    expect(ocenLuki([], undefined)).toMatchObject({ isCorrect: false, partialScore: 0 });
  });
});
