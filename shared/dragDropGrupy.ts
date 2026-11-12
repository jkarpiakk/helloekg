import type { DragDropConfig } from "./schema";

/**
 * Przeciąganie „do grup” (studio: acceptsSourceIds, flaga eksportu dd_many; prośba JK 12.11:
 * 20 pytań Q-INT-…-DD wchodzi do bety). Pole docelowe jest grupą i przyjmuje kilka kart;
 * każda karta ma dokładnie jedną właściwą grupę. Ocena i punkty częściowe liczą się po kartach.
 */

/** Czy pytanie jest „do grup”: którekolwiek pole przyjmuje więcej niż jedną kartę */
export function czyGrupy(cfg: Pick<DragDropConfig, "targets" | "grupy">): boolean {
  return cfg.grupy === true || cfg.targets.some((t) => (t.acceptsSourceIds?.length ?? 0) > 1);
}

/** Karta → właściwa grupa (pierwsza, która ją przyjmuje) */
export function grupaKarty(cfg: Pick<DragDropConfig, "targets">): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of cfg.targets) {
    for (const s of t.acceptsSourceIds?.length ? t.acceptsSourceIds : [t.acceptsSourceId]) {
      if (s && !m.has(String(s))) m.set(String(s), String(t.id));
    }
  }
  return m;
}

/**
 * Ocena „do grup”: correctItems / incorrectItems = identyfikatory KART. Karta zostawiona poza grupą
 * jest błędna, chyba że nie należy do żadnej (karta-pułapka: wtedy dobrze jest jej nie wstawiać).
 * Przy kilku wpisach dla tej samej karty liczy się ostatni.
 */
export function ocenGrupy(
  cfg: Pick<DragDropConfig, "sources" | "targets">,
  placements: Array<{ sourceId: string; targetId: string }>,
): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
  const wlasciwa = grupaKarty(cfg);
  const gdzie = new Map<string, string>();
  for (const p of Array.isArray(placements) ? placements : []) gdzie.set(String(p?.sourceId), String(p?.targetId));
  const correctItems: string[] = [];
  const incorrectItems: string[] = [];
  for (const s of cfg.sources) {
    const id = String(s.id);
    const cel = wlasciwa.get(id);
    if (cel === undefined ? !gdzie.has(id) : gdzie.get(id) === cel) correctItems.push(id);
    else incorrectItems.push(id);
  }
  const total = cfg.sources.length;
  return {
    isCorrect: total > 0 && incorrectItems.length === 0,
    partialScore: total === 0 ? 0 : correctItems.length / total,
    correctItems,
    incorrectItems,
  };
}
