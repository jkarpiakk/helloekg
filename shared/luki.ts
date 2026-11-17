/**
 * Ocena luk („uzupełnij”), wierna kopia studia (`shared/src/grading.ts`: normalizeAnswer, parseNumberPl,
 * gradeFillBlank, stan e88d6b0), żeby kurs i studio dawały ten sam wynik (Z-117, weryfikacja 17.11).
 * Dawniej kurs liczył zakres przez parseFloat, więc „75abc” albo „0,12 s” było zaliczane.
 */

/** Porównanie „exact”: bez wielkości liter, ze znormalizowanymi spacjami. Polskie znaki muszą się zgadzać. */
export function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl-PL");
}

/** Akceptuje przecinek dziesiętny: „0,12” → 0.12; cokolwiek poza liczbą → null */
export function parseNumberPl(s: string): number | null {
  const cleaned = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface Luka {
  id: string;
  correctAnswers: string[];
  validationType: "exact" | "regex" | "numeric_range";
  regex?: string;
  numericRange?: { min: number; max: number };
}

export function lukaPoprawna(b: Luka, raw: string): boolean {
  if (b.validationType === "exact") return b.correctAnswers.some((c) => normalizeAnswer(c) === normalizeAnswer(raw));
  if (b.validationType === "regex") {
    if (!b.regex) return false;
    try {
      return new RegExp(b.regex, "iu").test(raw.trim());
    } catch {
      return false;
    }
  }
  const n = parseNumberPl(raw);
  return n !== null && !!b.numericRange && n >= b.numericRange.min && n <= b.numericRange.max;
}

/** Wszystkie luki z konfiguracji; pusta albo nieprzysłana luka jest błędna. Identyfikatory spoza konfiguracji pomijamy. */
export function ocenLuki(
  blanks: Luka[],
  filled: ReadonlyArray<{ blankId: string; value: string }> | undefined,
): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
  const dane = new Map((Array.isArray(filled) ? filled : []).map((f) => [String(f?.blankId), String(f?.value ?? "")]));
  const correctItems: string[] = [];
  const incorrectItems: string[] = [];
  for (const b of blanks) (lukaPoprawna(b, dane.get(b.id) ?? "") ? correctItems : incorrectItems).push(b.id);
  const total = blanks.length;
  return { isCorrect: total > 0 && correctItems.length === total, partialScore: total === 0 ? 0 : correctItems.length / total, correctItems, incorrectItems };
}
