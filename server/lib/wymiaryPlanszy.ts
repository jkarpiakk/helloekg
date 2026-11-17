import fs from "node:fs";
import path from "node:path";
import type { WymiaryObrazu } from "@shared/hotspot";

/**
 * Wymiary planszy „wskaż na zapisie” z pliku w CONTENT_ASSETS_DIR (nagłówek PNG albo WebP, bez zależności).
 * Potrzebne tylko do koła: jego promień to procent szerokości (Z-101). Wynik w pamięci na czas życia procesu.
 */
const pamiec = new Map<string, WymiaryObrazu | null>();

function czytajNaglowek(plik: string): WymiaryObrazu | null {
  const fd = fs.openSync(plik, "r");
  try {
    const b = Buffer.alloc(32);
    const n = fs.readSync(fd, b, 0, 32, 0);
    if (n >= 24 && b.readUInt32BE(0) === 0x89504e47) {
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    }
    if (n >= 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const rodzaj = b.toString("ascii", 12, 16);
      if (rodzaj === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      if (rodzaj === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      if (rodzaj === "VP8L") {
        const v = b.readUInt32LE(21);
        return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 };
      }
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

export function wymiaryPlanszy(url: string | undefined | null): WymiaryObrazu | null {
  const dir = process.env.CONTENT_ASSETS_DIR;
  const m = /^\/content-assets\/([0-9a-f]{64}\.[a-z0-9]+)$/.exec(url ?? "");
  if (!dir || !m) return null;
  if (pamiec.has(m[1])) return pamiec.get(m[1])!;
  let w: WymiaryObrazu | null = null;
  try {
    const r = czytajNaglowek(path.join(dir, m[1]));
    if (r && r.width > 0 && r.height > 0) w = r;
  } catch {
    w = null;
  }
  pamiec.set(m[1], w);
  return w;
}

/** Wymiary podane przez przeglądarkę (naturalWidth, naturalHeight): tylko gdy pliku nie da się odczytać */
export function wymiaryOdKlienta(o: { width?: unknown; height?: unknown } | undefined | null): WymiaryObrazu | null {
  const w = Number(o?.width), h = Number(o?.height);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 && w < 20000 && h < 20000 ? { width: w, height: h } : null;
}
