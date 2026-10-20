/**
 * Kolejność kursu — jedno źródło prawdy dla „Następnego kroku” (Postęp), oznaczeń na liście
 * Kursu i miękkiej podpowiedzi „ten temat zakłada wcześniejsze”.
 *
 * Wszystko jest dostępne od razu (decyzja JK, beta): kurs tylko PROWADZI po kolei.
 * Temat „przerobiony” = wykład przeczytany do ostatniego rozdziału (jeśli jest)
 * i pytania tematu rozpoczęte (jeśli są) — błędy wracają w Powtórce, więc nie blokujemy
 * dalszej drogi do 100% opanowania.
 */

export interface OrderSection {
  id: string;
  title: string;
  order: number;
  chapterCount?: number;
  questionCount?: number;
  completionPercentage?: number | string;
  lastActivity?: string | null;
  lastChapter?: number | null;
  isLocked?: boolean;
}

export interface OrderModule {
  id: string;
  title: string;
  order: number;
  isLocked?: boolean;
  sections: OrderSection[];
}

export interface OrderItem<S extends OrderSection = OrderSection, M extends OrderModule = OrderModule> {
  section: S;
  module: M;
  moduleNo: number;
  sectionNo: number;
}

const pct = (s: OrderSection) => Number(s.completionPercentage) || 0;
export const hasLecture = (s: OrderSection) => (s.chapterCount ?? 0) > 0;
export const hasQuestions = (s: OrderSection) => (s.questionCount ?? 0) > 0;
export const hasContent = (s: OrderSection) => hasLecture(s) || hasQuestions(s);

/** Wykład przeczytany do ostatniego rozdziału (albo temat bez wykładu) */
export const lectureFinished = (s: OrderSection) => !hasLecture(s) || (s.lastChapter ?? 0) >= (s.chapterCount ?? 0);
/** Pytania tematu rozpoczęte (albo temat bez pytań) */
export const questionsStarted = (s: OrderSection) => !hasQuestions(s) || !!s.lastActivity || pct(s) > 0;
export const isPassed = (s: OrderSection) => lectureFinished(s) && questionsStarted(s);
/** Wszystkie pytania tematu opanowane */
export const isMastered = (s: OrderSection) => hasQuestions(s) && pct(s) >= 100;

/** Tematy z treścią w kolejności kursu (moduł → temat), z numeracją jak na liście w Kursie */
export function courseItems<M extends OrderModule>(modules: M[] | undefined): OrderItem<M["sections"][number], M>[] {
  const sorted = (modules ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((m) => ({ ...m, sections: m.sections.slice().sort((a, b) => a.order - b.order) }));
  return sorted.flatMap((m, mi) =>
    m.sections.map((s, si) => ({ section: s as M["sections"][number], module: m as M, moduleNo: mi + 1, sectionNo: si + 1 })),
  ).filter((x) => hasContent(x.section) && !x.module.isLocked && !x.section.isLocked);
}

/** Następny krok: pierwszy nieprzerobiony temat; gdy wszystko przerobione — pierwszy nieopanowany */
export function nextStep<T extends OrderItem>(items: T[]): T | null {
  return items.find((x) => !isPassed(x.section)) ?? items.find((x) => hasQuestions(x.section) && !isMastered(x.section)) ?? null;
}

/** Wcześniejsze tematy, które czekają, zanim kursant wszedł w ten (do miękkiej podpowiedzi) */
export function earlierUnpassed<T extends OrderItem>(items: T[], sectionId: string): T[] {
  const i = items.findIndex((x) => x.section.id === sectionId);
  if (i <= 0) return [];
  return items.slice(0, i).filter((x) => !isPassed(x.section));
}
