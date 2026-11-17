/**
 * „Wskaż na zapisie”: trafienie i ocena. Wierna kopia studia (`shared/src/grading.ts`: hitsHotspot,
 * gradeHotspot, stan e88d6b0), żeby kurs i studio liczyły tak samo (Z-101, Z-100, Z-130, weryfikacja 17.11).
 *
 * Współrzędne obszarów i wskazań są w procentach obrazu (0-100). Trafienie liczone w pikselach obrazu:
 * promień koła to procent SZEROKOŚCI, więc koło zostaje kołem (wcześniej kurs liczył elipsę).
 * Prostokąt i wielokąt nie zależą od proporcji obrazu, koło tak.
 */

export interface ObszarHotspot {
  id: string;
  shape: "rect" | "circle" | "polygon";
  coords: number[];
  isCorrect?: boolean;
}
export interface WymiaryObrazu { width: number; height: number }
export interface Punkt { x: number; y: number }

/** Obraz o nieznanych wymiarach liczymy jako kwadrat (koło zostaje kołem w procentach) */
export const BEZ_WYMIAROW: WymiaryObrazu = { width: 1000, height: 1000 };

export function trafiaObszar(h: ObszarHotspot, point: Punkt, img: WymiaryObrazu): boolean {
  const px = (v: number) => (v / 100) * img.width;
  const py = (v: number) => (v / 100) * img.height;
  const c = Array.isArray(h.coords) ? h.coords : [];
  const p = { x: px(point.x), y: py(point.y) };
  if (h.shape === "rect") {
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = c;
    const left = Math.min(px(x1), px(x2)), right = Math.max(px(x1), px(x2));
    const top = Math.min(py(y1), py(y2)), bottom = Math.max(py(y1), py(y2));
    return p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
  }
  if (h.shape === "circle") {
    const [cx = 0, cy = 0, r = 0] = c;
    const dx = p.x - px(cx);
    const dy = p.y - py(cy);
    const rp = px(r);
    return dx * dx + dy * dy <= rp * rp;
  }
  if (h.shape === "polygon") {
    let inside = false;
    const n = Math.floor(c.length / 2);
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = px(c[i * 2] ?? 0), yi = py(c[i * 2 + 1] ?? 0);
      const xj = px(c[j * 2] ?? 0), yj = py(c[j * 2 + 1] ?? 0);
      const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || Number.EPSILON) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
  return false;
}

export interface OcenaHotspot {
  isCorrect: boolean;
  /** 0-1: przy jednym miejscu 1 albo 0; przy wielu max(0, (trafione − błędne) / poprawne), jak w studiu */
  partialScore: number;
  /** Trafione poprawne obszary */
  correctItems: string[];
  /** Wskazane niepoprawne obszary (do narysowania po odpowiedzi) */
  incorrectItems: string[];
  /** Ile wskazań nie trafiło w żaden poprawny obszar (także poza obszarami) */
  bledne: number;
}

/**
 * Ocena ze współrzędnych wskazań. Jedno miejsce: liczy się ostatnie wskazanie.
 * Wiele miejsc: każde wskazanie poza poprawnym obszarem to błąd (także poza wszystkimi obszarami),
 * więc „klikanie wszędzie” nie daje kompletu. Najwyżej 50 wskazań.
 */
export function ocenHotspot(
  cfg: { hotspots: ObszarHotspot[]; allowMultiple?: boolean },
  wskazania: ReadonlyArray<Punkt> | undefined,
  img: WymiaryObrazu,
): OcenaHotspot {
  const punkty = (Array.isArray(wskazania) ? wskazania : [])
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .slice(-50);
  const klikniecia = cfg.allowMultiple ? punkty : punkty.slice(-1);
  const poprawne = cfg.hotspots.filter((h) => h.isCorrect);
  const trafione = new Set<string>();
  const zle = new Set<string>();
  let bledne = 0;
  for (const p of klikniecia) {
    const hit = cfg.hotspots.find((h) => trafiaObszar(h, p, img));
    if (!hit) { bledne++; continue; }
    if (hit.isCorrect) trafione.add(hit.id);
    else { bledne++; zle.add(hit.id); }
  }
  const hits = trafione.size;
  if (!cfg.allowMultiple) {
    const ok = hits >= 1 && bledne === 0;
    return { isCorrect: ok, partialScore: ok ? 1 : 0, correctItems: [...trafione], incorrectItems: [...zle], bledne };
  }
  const total = poprawne.length;
  const partialScore = total === 0 ? 0 : Math.max(0, (hits - bledne) / total);
  return { isCorrect: total > 0 && hits === total && bledne === 0, partialScore, correctItems: [...trafione], incorrectItems: [...zle], bledne };
}
