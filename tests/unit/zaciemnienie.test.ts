import { describe, it, expect } from "vitest";
import { zaciemnijScenariusze, odkryjScenariusz, skrotScenariusza } from "@shared/zaciemnienieScenariusza";
import { rozbierzOpcjeWstawki } from "../../client/src/wstawki-shared";

/** Z-102: nazwa scenariusza kardiomonitora nie idzie do przeglądarki jawnie (nazywa rozpoznanie) */
describe("zaciemnienie scenariusza", () => {
  const md = "Pacjent pod monitorem.\n\n::wstawka kardiomonitor scenariusz=mobitz-2-szerokie-qrs pytanie=tak\n\nCo widzisz?";

  it("serwer zamienia id na skrót z solą; w treści nie ma nazwy", () => {
    const z = zaciemnijScenariusze(md, "a1b2c3d4");
    expect(z).not.toContain("mobitz");
    expect(z).toContain(`scenariusz=${skrotScenariusza("a1b2c3d4", "mobitz-2-szerokie-qrs")} sol=a1b2c3d4`);
    expect(z.startsWith("Pacjent pod monitorem.")).toBe(true);
  });

  it("przeglądarka odnajduje scenariusz z listy; parser opcji przyjmuje sól", () => {
    const linia = zaciemnijScenariusze(md, "ff00ee11").split("\n").find((l) => l.startsWith("::wstawka"))!;
    const { opts, nieznane } = rozbierzOpcjeWstawki(linia.replace(/^::wstawka\s+kardiomonitor/, ""));
    expect(nieznane).toEqual([]);
    expect(odkryjScenariusz(opts, ["vf", "mobitz-2-szerokie-qrs", "af"])).toEqual({ scenariusz: "mobitz-2-szerokie-qrs", pytanie: "tak" });
  });

  it("inna sól = inny skrót; linie bez pytanie=tak (wykład, wyjaśnienie) bez zmian", () => {
    expect(zaciemnijScenariusze(md, "1")).not.toEqual(zaciemnijScenariusze(md, "2"));
    const wyklad = "::wstawka kardiomonitor scenariusz=vf";
    expect(zaciemnijScenariusze(wyklad, "1")).toBe(wyklad);
  });
});
