import { describe, it, expect } from "vitest";
import { obrazyPytania, opisBrakuObrazu, kodStudia } from "@shared/brakObrazu";

/** Obrazy pytań: co odtwarzacz, importer i e2e uznają za „obraz przypisany”, i treść zgłoszenia automatycznego. */
describe("obrazyPytania", () => {
  const plik = "/content-assets/" + "a".repeat(64) + ".png";

  it("pytanie zamknięte: obraz tylko z imageUrl", () => {
    expect(obrazyPytania({ questionType: "multiple_choice", imageUrl: plik })).toEqual([{ miejsce: "pytanie", url: plik }]);
    expect(obrazyPytania({ questionType: "multiple_choice", imageUrl: null })).toEqual([]);
    expect(obrazyPytania({ questionType: "sorting", imageUrl: plik, questionConfig: { type: "sorting", config: {} } })).toEqual([{ miejsce: "pytanie", url: plik }]);
  });

  it("przypadek: kod bez pliku to brak (Q-0040), przypadek bez zapisu niczego nie wymaga", () => {
    expect(obrazyPytania({ questionType: "clinical_case", questionConfig: { config: { imageGfx: "GFX-0225", steps: [] } } }))
      .toEqual([{ miejsce: "przypadek", kod: "GFX-0225" }]);
    expect(obrazyPytania({ questionType: "clinical_case", questionConfig: { config: { imageGfx: "GFX-0225", imageUrl: plik } } }))
      .toEqual([{ miejsce: "przypadek", kod: "GFX-0225", url: plik }]);
    expect(obrazyPytania({ questionType: "clinical_case", questionConfig: { config: { steps: [{ kind: "single" }] } } })).toEqual([]);
    expect(obrazyPytania({ questionType: "clinical_case", questionConfig: { config: { steps: [{ kind: "hotspot" }] } } })).toEqual([{ miejsce: "przypadek" }]);
  });

  it("hotspot i wybierz zapis wymagają obrazu zawsze", () => {
    expect(obrazyPytania({ questionType: "hotspot", questionConfig: { config: { hotspots: [] } } })).toEqual([{ miejsce: "plansza" }]);
    expect(obrazyPytania({ questionType: "image_choice", questionConfig: { config: { options: [{ id: "A1", imageUrl: plik }, { id: "A2", imageGfx: "GFX-0531" }] } } }))
      .toEqual([{ miejsce: "zapis", url: plik }, { miejsce: "zapis", kod: "GFX-0531" }]);
  });
});

describe("opisBrakuObrazu", () => {
  const pytanie = { tags: ["NOWE", "studio:Q-0040"], questionType: "clinical_case" };

  it("składa treść z kodu studia, miejsca, grafiki i pliku", () => {
    expect(kodStudia(pytanie.tags)).toBe("Q-0040");
    expect(opisBrakuObrazu(pytanie, { powod: "brak-obrazu", stan: "brak-adresu", miejsce: "przypadek", kod: "GFX-0225" }))
      .toBe("Obraz się nie wyświetla: pytanie ma przypisaną grafikę, ale nie ma adresu pliku. Pytanie Q-0040 (clinical_case), zapis przypadku klinicznego, grafika GFX-0225. Zgłoszenie automatyczne z odtwarzacza.");
    const url = "/content-assets/" + "b".repeat(64) + ".png";
    expect(opisBrakuObrazu({ tags: [], questionType: null }, { powod: "brak-obrazu", stan: "blad-ladowania", miejsce: "pytanie", url }))
      .toContain(`plik obrazu nie wczytał się. Pytanie (bez kodu studia) (multiple_choice), obraz pytania, plik ${url}.`);
  });

  it("odrzuca dowolny tekst od klienta", () => {
    const ok = { powod: "brak-obrazu", stan: "brak-adresu", miejsce: "plansza" };
    expect(opisBrakuObrazu(pytanie, ok)).not.toBeNull();
    expect(opisBrakuObrazu(pytanie, { ...ok, powod: "inne" })).toBeNull();
    expect(opisBrakuObrazu(pytanie, { ...ok, stan: "cokolwiek" })).toBeNull();
    expect(opisBrakuObrazu(pytanie, { ...ok, miejsce: "toString" })).toBeNull();
    expect(opisBrakuObrazu(pytanie, { ...ok, kod: "<script>" })).toBeNull();
    expect(opisBrakuObrazu(pytanie, { ...ok, url: "https://zly.example/x.png" })).toBeNull();
    expect(opisBrakuObrazu(pytanie, { ...ok, url: "/content-assets/../../etc/passwd" })).toBeNull();
  });
});
