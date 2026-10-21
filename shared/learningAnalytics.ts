/**
 * Panel nauki (admin → Statystyki): kształt odpowiedzi GET /api/admin/analytics/learning
 * i progi, według których pytanie lub tester trafia na listę „do reakcji”.
 */

/** Okresy do wyboru w panelu (dni wstecz) */
export const LEARNING_RANGES = [7, 30, 90] as const;
export type LearningRange = (typeof LEARNING_RANGES)[number];

/**
 * Odpowiedzi sprzed wdrożenia fali 1 (ocenianie na serwerze) mają błędne isCorrect
 * przy tasowanych odpowiedziach — statystyki pytań liczymy od tej chwili.
 */
export const GRADING_FIXED_AT = "2026-10-20T00:00:00+02:00";

/** Ile różnych osób musi odpowiedzieć, żeby pytanie oceniać (mniej = przypadek) */
export const MIN_ANSWERS_PER_QUESTION = 3;

/** Bez aktywności dłużej niż tyle dni = „zniknął” */
export const GONE_AFTER_DAYS = 5;

/** Role zespołu — domyślnie poza statystykami, żeby testy JK nie zaburzały wyników */
export const STAFF_ROLES = ["owner", "admin", "reviewer", "support"] as const;

/** Aktywność w ciągu tylu dni = „na bieżąco” */
export const ACTIVE_WITHIN_DAYS = 2;

/** Kolejność = pilność reakcji (lista testerów sortuje się po niej) */
export const TESTER_STATUSES = ["bez_startu", "przerwa", "rzadziej", "na_biezaco"] as const;
export type TesterStatus = (typeof TESTER_STATUSES)[number];

export const TESTER_STATUS_LABEL: Record<TesterStatus, string> = {
  bez_startu: "Bez startu",
  przerwa: `Przerwa ${GONE_AFTER_DAYS}+ dni`,
  rzadziej: "Wraca rzadziej",
  na_biezaco: "Na bieżąco",
};

export function testerStatus(lastActiveAt: Date | null, now: Date): TesterStatus {
  if (!lastActiveAt) return "bez_startu";
  const days = (now.getTime() - lastActiveAt.getTime()) / 86_400_000;
  if (days > GONE_AFTER_DAYS) return "przerwa";
  return days <= ACTIVE_WITHIN_DAYS ? "na_biezaco" : "rzadziej";
}

export interface LearningTester {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  lastActiveAt: string | null;
  status: TesterStatus;
  activeDays: number;
  answersTotal: number;
  answersInRange: number;
  /** Odsetek poprawnych w okresie (0–1), null bez odpowiedzi */
  correctRate: number | null;
  lecturesOpened: number;
  lecturesFinished: number;
}

export interface LearningQuestion {
  id: string;
  /** Id pytania w studiu (z tagu studio:<id>), do linku „Otwórz w studiu” */
  studioId: string | null;
  text: string;
  type: string;
  moduleTitle: string;
  sectionTitle: string;
  /** Liczba osób (pierwsze podejście każdej osoby) */
  answers: number;
  correctRate: number;
  medianTimeMs: number;
  reports: number;
  /** Tylko ABCD: najczęściej wybierana błędna odpowiedź */
  topWrong: { text: string; picks: number } | null;
  correctText: string | null;
  correctPicks: number | null;
}

export interface LearningLecture {
  sectionId: string;
  moduleTitle: string;
  title: string;
  chapters: number;
  opened: number;
  finished: number;
  /** Rozdział, na którym najwięcej osób się zatrzymało (bez tych, które doczytały) */
  commonStopChapter: number | null;
  commonStopCount: number;
  /** Osoby, które odpowiedziały na co najmniej jedno pytanie tematu */
  quizzers: number;
  /** Średnie opanowanie tematu wśród nich (0–100) */
  avgMastery: number | null;
}

export interface LearningAnalytics {
  rangeDays: number;
  since: string;
  includeStaff: boolean;
  questionsSince: string;
  summary: {
    testers: number;
    activeToday: number;
    activeInRange: number;
    newInRange: number;
    answersInRange: number;
    correctRate: number | null;
    lectureOpensInRange: number;
    reportsInRange: number;
  };
  testers: LearningTester[];
  questions: {
    hard: LearningQuestion[];
    suspicious: LearningQuestion[];
    slow: LearningQuestion[];
    reported: LearningQuestion[];
  };
  lectures: LearningLecture[];
}
