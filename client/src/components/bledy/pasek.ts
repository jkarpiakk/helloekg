/**
 * Pasek EKG na stronach błędów (prośba JK 25.11: „fajne, w temacie”). Każdy błąd to zjawisko z zapisu:
 *  - 404: załamek P bez zespołu QRS (pobudzenie zablokowane: impuls nie dotarł dalej),
 *  - awaria widoku: artefakt (zakłócenie linii izoelektrycznej, potem znów czysty rytm),
 *  - przerwa serwera (502-504): prostokąty cechy 10 mm/mV, jak przy kalibracji aparatu.
 *
 * Czysta funkcja bez DOM: tę samą ścieżkę rysuje React (StronaBledu) i statyczna strona przerwy
 * (ops/bledy/przerwa.html, budowana skryptem scripts/strony-bledow.ts). Skala jak na papierze:
 * 25 mm/s, 10 mm/mV; `px` = pikseli na milimetr.
 */

export type RodzajPaska = "blok" | "artefakt" | "cecha";

export interface Pasek {
  /** Ścieżka SVG (atrybut d) */
  d: string;
  szerokosc: number;
  wysokosc: number;
  /** Czas zapisu w sekundach (do tempa animacji: 25 mm/s) */
  sekundy: number;
  /** Miejsce podpisu nad zjawiskiem (px) i jego szerokość, np. zablokowany P */
  znacznik: { x: number; szer: number; podpis: string };
}

const g = (t: number, srodek: number, szer: number, amp: number) => amp * Math.exp(-(((t - srodek) / szer) ** 2));

/** Jedno pobudzenie zatokowe od chwili `t0` (s): P, QRS, T; `bezQrs` = sam załamek P */
function pobudzenie(t: number, t0: number, bezQrs = false): number {
  const u = t - t0;
  let v = g(u, 0.05, 0.028, 0.14); // P
  if (bezQrs) return v;
  v += g(u, 0.17, 0.008, -0.1); // q
  v += g(u, 0.195, 0.011, 1.15); // R
  v += g(u, 0.222, 0.01, -0.28); // S
  v += g(u, 0.46, 0.06, 0.3); // T
  return v;
}

/** Ziarno, żeby artefakt wyglądał tak samo przy każdym rysowaniu (bez migotania między klatkami) */
function los(ziarno: number) {
  let s = ziarno >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function pasek(rodzaj: RodzajPaska, szerokosc: number, px = 4): Pasek {
  const mmNaS = 25;
  const sekundy = szerokosc / px / mmNaS;
  const wysMm = 29;
  const wysokosc = Math.round(wysMm * px);
  const linia = rodzaj === "cecha" ? 21 : 20; // linia izoelektryczna (mm od góry); nad zapisem miejsce na podpis
  const rr = 0.8; // 75/min
  const pierwszy = 0.25;
  const zablokowany = 2; // trzecie pobudzenie: sam P
  const r = los(404);
  const szum: number[] = [];

  const v = (t: number): number => {
    if (rodzaj === "cecha") {
      // prostokąt 1 mV przez 0,2 s co 1,2 s, zbocza 8 ms
      const okres = 1.2, start = 0.3, dl = 0.2, zb = 0.008;
      const u = ((t - start) % okres + okres) % okres;
      if (t < start) return 0;
      if (u < zb) return u / zb;
      if (u < dl) return 1;
      if (u < dl + zb) return 1 - (u - dl) / zb;
      return 0;
    }
    let s = 0;
    for (let k = 0; ; k++) {
      const t0 = pierwszy + k * rr;
      if (t0 > t + 0.1) break;
      if (t0 < t - 0.8) continue;
      s += pobudzenie(t, t0, rodzaj === "blok" && k === zablokowany);
    }
    if (rodzaj === "artefakt") {
      // drżenie mięśniowe: od 1,15 s do 2,55 s, narasta i gaśnie
      const a = 1.15, b = 2.55;
      if (t > a && t < b) {
        const obw = Math.sin(((t - a) / (b - a)) * Math.PI);
        const i = Math.floor(t * 250);
        while (szum.length <= i) szum.push(r() * 2 - 1);
        s += obw * (0.22 * szum[i] + 0.12 * Math.sin(t * 2 * Math.PI * 37) + 0.08 * Math.sin(t * 2 * Math.PI * 61));
      }
    }
    return s;
  };

  const krok = rodzaj === "artefakt" ? 0.004 : 0.006;
  const pkt: string[] = [];
  for (let t = 0; t <= sekundy + 1e-9; t += krok) {
    const x = t * mmNaS * px;
    const y = (linia - v(t) * 10) * px;
    pkt.push(`${pkt.length ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  const tZnacznika = rodzaj === "blok" ? pierwszy + zablokowany * rr + 0.05 : rodzaj === "artefakt" ? 1.85 : 0.4;
  const szerZnacznika = rodzaj === "blok" ? 0.34 : rodzaj === "artefakt" ? 1.4 : 0.2;
  const podpis = rodzaj === "blok" ? "P bez QRS" : rodzaj === "artefakt" ? "artefakt" : "cecha 10 mm/mV";
  return {
    d: pkt.join(""),
    szerokosc,
    wysokosc,
    sekundy,
    znacznik: { x: tZnacznika * mmNaS * px, szer: szerZnacznika * mmNaS * px, podpis },
  };
}
