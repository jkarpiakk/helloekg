import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { trafiaObszar, ocenHotspot, BEZ_WYMIAROW } from "@shared/hotspot";

/**
 * Kurs liczy „wskaż na zapisie” tak samo jak studio (Z-101, Z-100, Z-130, weryfikacja 17.11).
 * Wektory policzył kod studia (shared/src/grading.ts: hitsHotspot, gradeHotspot) na prawdziwych
 * planszach kursu i ich wymiarach w pikselach: tests/unit/fixtures/hotspot-studio.json.
 */
const F = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/hotspot-studio.json"), "utf8"));

describe("hotspot: zgodność ze studiem", () => {
  it(`trafienie w obszar (${F.trafienia.length} punktów, w tym przy krawędziach kół)`, () => {
    const rozne = F.trafienia.filter((t: any) => trafiaObszar(t.h, t.p, t.img) !== t.wynik);
    expect(rozne).toEqual([]);
  });

  it(`ocena odpowiedzi (${F.oceny.length} zestawów wskazań)`, () => {
    const rozne = F.oceny.filter((o: any) => {
      const r = ocenHotspot(o.cfg, o.clicks, o.img);
      return r.isCorrect !== o.correct || Math.abs(r.partialScore - o.score) > 1e-9;
    });
    expect(rozne).toEqual([]);
  });
});

describe("hotspot: zachowanie", () => {
  const rect = { id: "a", shape: "rect" as const, coords: [10, 10, 30, 30], isCorrect: true };
  const zly = { id: "b", shape: "rect" as const, coords: [50, 50, 70, 70], isCorrect: false };
  const kolo = { id: "c", shape: "circle" as const, coords: [50, 50, 10], isCorrect: true };

  it("koło to koło w pikselach: przy obrazie 1000×400 punkt 20 px nad środkiem trafia (dawniej elipsa nie trafiała)", () => {
    const img = { width: 1000, height: 400 };
    // 20 px w pionie = 5% wysokości; promień 10% szerokości = 100 px
    expect(trafiaObszar(kolo, { x: 50, y: 45 }, img)).toBe(true);
    // 120 px w pionie = 30% wysokości: poza kołem o promieniu 100 px
    expect(trafiaObszar(kolo, { x: 50, y: 20 }, img)).toBe(false);
  });

  it("jedno miejsce: liczy się ostatnie wskazanie", () => {
    const cfg = { hotspots: [rect, zly] };
    expect(ocenHotspot(cfg, [{ x: 60, y: 60 }, { x: 20, y: 20 }], BEZ_WYMIAROW).isCorrect).toBe(true);
    expect(ocenHotspot(cfg, [{ x: 20, y: 20 }, { x: 60, y: 60 }], BEZ_WYMIAROW)).toMatchObject({ isCorrect: false, incorrectItems: ["b"] });
  });

  it("wiele miejsc: komplet i jedno błędne to nie 100% (Z-130), wskazanie poza obszarami też jest błędem", () => {
    const cfg = { allowMultiple: true, hotspots: [rect, kolo, zly] };
    const r = ocenHotspot(cfg, [{ x: 20, y: 20 }, { x: 50, y: 50 }, { x: 90, y: 90 }], BEZ_WYMIAROW);
    expect(r.isCorrect).toBe(false);
    expect(r.partialScore).toBeCloseTo(0.5);
    expect(ocenHotspot(cfg, [{ x: 20, y: 20 }, { x: 50, y: 50 }], BEZ_WYMIAROW)).toMatchObject({ isCorrect: true, partialScore: 1 });
  });

  it("brak poprawnych obszarów albo brak wskazań: 0, bez dzielenia przez zero", () => {
    expect(ocenHotspot({ allowMultiple: true, hotspots: [zly] }, [{ x: 1, y: 1 }], BEZ_WYMIAROW).partialScore).toBe(0);
    expect(ocenHotspot({ hotspots: [rect] }, undefined, BEZ_WYMIAROW)).toMatchObject({ isCorrect: false, partialScore: 0 });
    expect(ocenHotspot({ hotspots: [rect] }, [{ x: NaN, y: 3 }] as any, BEZ_WYMIAROW).isCorrect).toBe(false);
  });
});
