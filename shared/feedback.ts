/**
 * Zgłoszenia testerów (beta) — słowniki wspólne dla klienta i serwera.
 * Zapisywane w tabeli support_tickets (kind = "feedback"); zgłoszenia z quizu
 * („Zgłoś błąd” przy pytaniu) to kind = "question" w tej samej tabeli.
 */

export const FEEDBACK_DAILY_LIMIT = 20;
export const FEEDBACK_MAX_FILES = 3;
export const FEEDBACK_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_MIN_DESCRIPTION = 10;
export const FEEDBACK_MAX_DESCRIPTION = 5000;
/** Typ treści żądania POST /api/feedback — własny, żeby ominąć globalny limit express.json (100 kB) */
export const FEEDBACK_CONTENT_TYPE = "application/vnd.helloekg.feedback+json";

export const FEEDBACK_AREAS = [
  { value: "wyklad", label: "Wykład" },
  { value: "pytania", label: "Pytania" },
  { value: "kurs", label: "Kurs i moduły" },
  { value: "postep", label: "Postęp" },
  { value: "konto", label: "Konto" },
  { value: "inne", label: "Inne" },
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number]["value"];

export const FEEDBACK_TYPES = [
  { value: "merytoryczny", label: "Błąd merytoryczny", description: "coś jest nieprawdą w treści lub odpowiedzi" },
  { value: "dzialanie", label: "Błąd działania", description: "coś nie działa, zawiesza się, źle liczy" },
  { value: "pomysl", label: "Pomysł", description: "przydałoby się…" },
  { value: "niejasne", label: "Niejasne", description: "nie wiem, co kliknąć albo co to znaczy" },
  { value: "pochwala", label: "Pochwała", description: "to działa dobrze — też warto wiedzieć" },
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]["value"];

export const FEEDBACK_STATUSES = [
  { value: "nowe", label: "Nowe" },
  { value: "w_analizie", label: "W analizie" },
  { value: "wdrozone", label: "Wdrożone" },
  { value: "odrzucone", label: "Odrzucone" },
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]["value"];

export const FEEDBACK_PRIORITIES = ["P0", "P1", "P2"] as const;
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

/** Statusy, przy których notatka zespołu jest wymagana */
export const FEEDBACK_NOTE_REQUIRED: readonly FeedbackStatus[] = ["wdrozone", "odrzucone"];

export const isFeedbackArea = (v: unknown): v is FeedbackArea =>
  typeof v === "string" && FEEDBACK_AREAS.some((a) => a.value === v);
export const isFeedbackType = (v: unknown): v is FeedbackType =>
  typeof v === "string" && FEEDBACK_TYPES.some((t) => t.value === v);
export const isFeedbackStatus = (v: unknown): v is FeedbackStatus =>
  typeof v === "string" && FEEDBACK_STATUSES.some((s) => s.value === v);

/** Stare statusy zgłoszeń (open/in_progress/resolved/closed) → słownik zgłoszeń testerów */
export function normalizeFeedbackStatus(raw: string): FeedbackStatus {
  if (isFeedbackStatus(raw)) return raw;
  switch (raw) {
    case "in_progress":
      return "w_analizie";
    case "resolved":
      return "wdrozone";
    case "closed":
      return "odrzucone";
    default:
      return "nowe";
  }
}

export function normalizeFeedbackPriority(raw: string | null | undefined): FeedbackPriority | null {
  return FEEDBACK_PRIORITIES.includes(raw as FeedbackPriority) ? (raw as FeedbackPriority) : null;
}

export const feedbackAreaLabel = (v: string | null | undefined) =>
  FEEDBACK_AREAS.find((a) => a.value === v)?.label ?? "Inne";
export const feedbackTypeLabel = (v: string | null | undefined) =>
  FEEDBACK_TYPES.find((t) => t.value === v)?.label ?? "Błąd w pytaniu";
export const feedbackStatusLabel = (v: string) =>
  FEEDBACK_STATUSES.find((s) => s.value === normalizeFeedbackStatus(v))?.label ?? v;

/** Obszar aplikacji z adresu strony (ścieżka + query) */
export function feedbackAreaForPath(pathWithQuery: string): FeedbackArea {
  const path = pathWithQuery.split("?")[0];
  if (path.startsWith("/lecture") || path.startsWith("/module3-lecture")) return "wyklad";
  if (path.startsWith("/quiz")) return "pytania";
  if (path.startsWith("/modules")) return "kurs";
  if (path.startsWith("/dashboard") || path.startsWith("/certificate")) return "postep";
  if (
    path.startsWith("/account") ||
    path.startsWith("/profile") ||
    path.startsWith("/pricing") ||
    path.startsWith("/checkout") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/verify-email")
  )
    return "konto";
  return "inne";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** sectionId / questionId z adresu, z którego otwarto formularz (wykład, quiz) */
export function feedbackIdsFromPath(pathWithQuery: string): { sectionId?: string; questionId?: string } {
  const [path, query = ""] = pathWithQuery.split("?");
  const params = new URLSearchParams(query);
  const out: { sectionId?: string; questionId?: string } = {};
  const lecture = path.match(/^\/lecture\/([^/]+)/);
  const section = lecture?.[1] ?? params.get("sectionId") ?? params.get("section") ?? undefined;
  if (isUuid(section)) out.sectionId = section;
  const question = params.get("questionId") ?? params.get("question") ?? undefined;
  if (isUuid(question)) out.questionId = question;
  return out;
}

/** Odpowiedź GET /api/feedback/mine */
export type MyFeedbackReport = {
  id: string;
  createdAt: string;
  kind: "feedback" | "question";
  description: string;
  area: FeedbackArea | null;
  type: FeedbackType | null;
  status: FeedbackStatus;
  adminNote: string | null;
  attachmentCount: number;
};

/** Wiersz GET /api/admin/feedback */
export type AdminFeedbackReport = MyFeedbackReport & {
  updatedAt: string;
  userEmail: string;
  userName: string;
  priority: FeedbackPriority | null;
  pagePath: string | null;
  context: {
    userAgent?: string;
    viewport?: string;
    appVersion?: string;
    sectionId?: string;
    questionId?: string;
  } | null;
  questionId: string | null;
  questionTitle: string | null;
  attachments: Array<{ n: number; mime: string; size: number; name: string }>;
};

export type AdminFeedbackResponse = {
  counts: Record<FeedbackStatus, number> & { total: number };
  items: AdminFeedbackReport[];
};
