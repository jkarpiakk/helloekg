import DOMPurify from "dompurify";
import { marked } from "marked";
import { apiRequest } from "@/lib/queryClient";
import type { Rhythm } from "@/components/ekg/EkgCanvas";

export interface LectureChapter {
  id: string;
  title: string;
  contentMd: string;
  analogy?: string | null;
  keyPoints?: string[] | null;
  visual?: string | null;
  order: number;
}

/** Wspólne zapytanie o rozdziały — nagłówek wykładu i nawigacja dzielą jedną odpowiedź z pamięci podręcznej */
export const chaptersQuery = (sectionId: string) => ({
  queryKey: ["/api/sections", sectionId, "chapters"] as const,
  queryFn: () => apiRequest("GET", `/api/sections/${sectionId}/chapters`).then((res) => res.json()),
  retry: false as const,
});

export const sortChapters = (data: unknown): LectureChapter[] =>
  Array.isArray(data) ? (data as LectureChapter[]).slice().sort((a, b) => a.order - b.order) : [];

/**
 * Markdown → bezpieczny HTML. Domyślny profil DOMPurify (bez skryptów, handlerów, ramek),
 * plus <details>/<summary> i znaczniki-wstawki: data-ekg (żywy zapis), data-height,
 * data-gfx-pending (grafika w przygotowaniu). Atrybut style wycinamy — wygląd daje .prose-hk.
 */
export function renderMarkdown(md: string): string {
  try {
    const raw = marked.parse(md ?? "", { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["details", "summary"],
      ADD_ATTR: ["data-ekg", "data-height", "data-gfx-pending"],
      FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "iframe"],
      FORBID_ATTR: ["style"],
    });
  } catch {
    return DOMPurify.sanitize(md ?? "", { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
}

/** Czy rozdział ma już własny obraz albo zapis EKG (wtedy nie dokładamy ozdobnika) */
export const chapterHasVisual = (md: string) => /!\[[^\]]*\]\(|<img\b|data-ekg\s*=/i.test(md ?? "");

/** Liczba słów do szacowania czasu czytania (bez składni markdown, znaczników i obrazów) */
export function countWords(chapters: LectureChapter[]): number {
  let n = 0;
  for (const c of chapters) {
    const text = [c.contentMd, c.analogy ?? "", ...(c.keyPoints ?? [])]
      .join(" ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\]\([^)]*\)/g, " ");
    n += text.split(/\s+/).filter((w) => /[0-9A-Za-zÀ-ž]/.test(w)).length;
  }
  return n;
}

/** Minuty czytania przy 200 słowach na minutę */
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 200));

export function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

/**
 * Rytm ozdobnego zapisu dobrany do tematu. `exact` = rysunek odpowiada tematowi,
 * więc wolno pokazać podpis rytmu; w przeciwnym razie linia jest tylko ozdobnikiem marki.
 * Silnik nie ma np. Mobitz II, BBB, częstoskurczów z szerokimi QRS — wtedy zostaje rytm zatokowy.
 */
export function pickRhythm(moduleTitle: string, sectionTitle: string): { rhythm: Rhythm; exact: boolean } {
  const s = (sectionTitle ?? "").toLowerCase();
  const m = (moduleTitle ?? "").toLowerCase();
  const pick = (t: string): Rhythm | null => {
    if (/mobitz\s*(ii|2)\b/.test(t)) return null;
    if (/wenckebach|mobitz\s*(i|1)\b/.test(t)) return "wenckebach";
    if (/iii\s*stopnia|całkowit/.test(t)) return "avb3";
    if (/\bi\s*stopnia/.test(t)) return "avb1";
    if (/trzepotan/.test(t) && !/migotan/.test(t)) return "aflutter";
    if (/migotani[ea]\s+(i\s+trzepotani[ea]\s+)?przedsionk/.test(t)) return "af";
    if (/bradykardi|bradyarytmi/.test(t)) return "brady";
    return null;
  };
  const exact = pick(s);
  if (exact) return { rhythm: exact, exact: true };
  if (/arytmi|zaburzenia rytmu/.test(m) && !/mobitz/.test(s)) return { rhythm: "af", exact: false };
  // Podpis „rytm zatokowy” tylko tam, gdzie temat dotyczy rytmu; gdzie indziej (STEMI, BBB…)
  // prawidłowy zapis z podpisem mógłby sugerować, że tak wygląda omawiany obraz
  return { rhythm: "sinus", exact: /rytm|częstoś/.test(s) };
}

/** Role, które widzą luki w treści (grafiki w przygotowaniu) */
export const GAP_ROLES = ["owner", "admin", "reviewer"];
