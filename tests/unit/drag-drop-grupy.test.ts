import { describe, it, expect } from "vitest";
import { czyGrupy, grupaKarty, ocenGrupy } from "@shared/dragDropGrupy";

/** Przeciąganie „do grup” (studio: acceptsSourceIds, flaga dd_many), np. Q-INT-…-DD „Wydłuża / Skraca QT”. */
const qt = {
  sources: ["S1", "S2", "S3", "S4", "S5", "S6"].map((id) => ({ id, content: id })),
  targets: [
    { id: "T1", label: "Wydłuża QT", acceptsSourceId: "S1", acceptsSourceIds: ["S1", "S2", "S3", "S4"] },
    { id: "T2", label: "Skraca QT", acceptsSourceId: "S5", acceptsSourceIds: ["S5", "S6"] },
  ],
};
const pary = (m: Record<string, string>) => Object.entries(m).map(([sourceId, targetId]) => ({ sourceId, targetId }));

describe("czyGrupy", () => {
  it("rozpoznaje pole przyjmujące kilka kart albo znacznik z konfiguracji kursanta", () => {
    expect(czyGrupy(qt)).toBe(true);
    expect(czyGrupy({ targets: [{ id: "a", label: "a", acceptsSourceId: "x" }] })).toBe(false);
    expect(czyGrupy({ targets: [{ id: "a", label: "a", acceptsSourceId: "x", acceptsSourceIds: ["x"] }] })).toBe(false);
    expect(czyGrupy({ targets: [{ id: "a", label: "a", acceptsSourceId: "" }], grupy: true })).toBe(true);
  });
});

describe("ocenGrupy", () => {
  it("wszystkie karty we właściwych grupach: dobrze", () => {
    const r = ocenGrupy(qt, pary({ S1: "T1", S2: "T1", S3: "T1", S4: "T1", S5: "T2", S6: "T2" }));
    expect(r).toMatchObject({ isCorrect: true, partialScore: 1, incorrectItems: [] });
  });

  it("punkty częściowe po kartach; karta poza grupą jest błędna", () => {
    const r = ocenGrupy(qt, pary({ S1: "T1", S2: "T2", S3: "T1", S5: "T2", S6: "T2" }));
    expect(r.isCorrect).toBe(false);
    expect(r.correctItems).toEqual(["S1", "S3", "S5", "S6"]);
    expect(r.incorrectItems).toEqual(["S2", "S4"]);
    expect(r.partialScore).toBeCloseTo(4 / 6);
  });

  it("pusta albo zepsuta odpowiedź: zero, bez wyjątku", () => {
    expect(ocenGrupy(qt, []).partialScore).toBe(0);
    expect(ocenGrupy(qt, undefined as any).isCorrect).toBe(false);
  });

  it("karta-pułapka (bez grupy) jest dobrze, gdy zostaje w puli", () => {
    const cfg = { ...qt, sources: [...qt.sources, { id: "X", content: "pułapka" }] };
    const wszystkie = { S1: "T1", S2: "T1", S3: "T1", S4: "T1", S5: "T2", S6: "T2" };
    expect(ocenGrupy(cfg, pary(wszystkie)).isCorrect).toBe(true);
    expect(ocenGrupy(cfg, pary({ ...wszystkie, X: "T1" })).incorrectItems).toEqual(["X"]);
  });

  it("grupaKarty: wzorcowa odpowiedź dla każdej karty", () => {
    expect(Object.fromEntries(grupaKarty(qt))).toEqual({ S1: "T1", S2: "T1", S3: "T1", S4: "T1", S5: "T2", S6: "T2" });
  });
});
