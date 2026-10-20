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
      ADD_ATTR: ["data-ekg", "data-height", "data-gfx-pending", "data-widget"],
      FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "iframe"],
      FORBID_ATTR: ["style"],
    });
  } catch {
    return DOMPurify.sanitize(md ?? "", { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
}

/** Czy rozdział ma już własny obraz albo zapis EKG (wtedy nie dokładamy ozdobnika) */
export const chapterHasVisual = (md: string) => /!\[[^\]]*\]\(|<img\b|data-ekg\s*=|data-widget\s*=/i.test(md ?? "");

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
 * Pasek EKG w nagłówku wykładu z podpisem „tak wygląda rytm, o którym jest ten wykład”.
 * To twierdzenie merytoryczne, więc tylko przy jednoznacznym dopasowaniu tytułu SEKCJI
 * (tytuł modułu się nie liczy). Zasady:
 *  - wykluczenia wygrywają: bloki odnóg/wiązek (odnog, LBBB, RBBB, BBB, wiązk, hemiblok, śródkomor),
 *    Mobitz II, rytmy komorowe (migotanie/trzepotanie komór, częstoskurcz, VT/VF), stymulatory —
 *    silnik ich nie rysuje, a podobne słowa („całkowity”, „blok”, „II stopnia”) myliłyby się z blokiem AV;
 *  - blok AV wymaga słów „AV” albo „przedsionkowo-komorowy” razem ze stopniem (sam „całkowity” nie wystarcza);
 *  - pasuje dokładnie jeden wzorzec — dwa lub więcej (np. „migotanie i trzepotanie”) = brak paska.
 * Zwraca `exact: false`, gdy nie ma pewności — wtedy nagłówek nie pokazuje paska ani podpisu.
 */
const RHYTHM_EXCLUDE =
  /odnog|\b[lr]?bbb\b|wiązk|hemiblok|śródkomor|mobitz\s*(ii|2)\b|ii\s+stopnia\s+typu\s+(2|ii)\b|(migotani|trzepotani)[a-zęą]*\s+komór|częstoskurcz|\bv[tf]\b|torsade|stymul|kardiowerter|\bicd\b|preekscytac|wpw/i;

const AV_BLOCK = /\bav\b|przedsionkowo[-\s]?komorow/;

const RHYTHM_PATTERNS: Array<[Rhythm, (t: string) => boolean]> = [
  ["avb1", (t) => AV_BLOCK.test(t) && /\bi\s+stopnia|pierwszego\s+stopnia/.test(t)],
  ["wenckebach", (t) => /wenckebach/.test(t) || (AV_BLOCK.test(t) && /mobitz\s*(i|1)\b/.test(t))],
  ["avb3", (t) => AV_BLOCK.test(t) && /\biii\s+stopnia|trzeciego\s+stopnia|całkowit/.test(t)],
  // „Migotanie i trzepotanie przedsionków” trafia w oba → niejednoznaczne → brak paska
  ["af", (t) => /migotani[ea]\s+(i\s+trzepotani[ea]\s+)?przedsionk/.test(t)],
  ["aflutter", (t) => /trzepotani[ea]\s+(i\s+migotani[ea]\s+)?przedsionk/.test(t)],
  ["brady", (t) => /bradykardi[aię]\s+zatokow/.test(t)],
  ["tachy", (t) => /tachykardi[aię]\s+zatokow/.test(t)],
  ["sinus", (t) => /\brytm\s+zatokow/.test(t)],
];

export function pickRhythm(_moduleTitle: string, sectionTitle: string): { rhythm: Rhythm; exact: boolean } {
  const t = (sectionTitle ?? "").toLowerCase().replace(/\s+/g, " ");
  const none = { rhythm: "sinus" as Rhythm, exact: false };
  if (!t || RHYTHM_EXCLUDE.test(t)) return none;
  const hits = RHYTHM_PATTERNS.filter(([, test]) => test(t)).map(([r]) => r);
  return hits.length === 1 ? { rhythm: hits[0], exact: true } : none;
}

/** Role, które widzą luki w treści (grafiki w przygotowaniu) */
export const GAP_ROLES = ["owner", "admin", "reviewer"];
