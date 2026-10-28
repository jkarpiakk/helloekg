import { Wyjasnienie } from "./Wyjasnienie";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Flag, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { sanitizeHtml, sanitizeMarkdown } from "@/lib/sanitize";
import { spring, springSnappy } from "@/lib/motion";
import QuestionCard, { type AnswerStatus } from "./QuestionCard";
import ImageLightbox from "./ImageLightbox";
import ReportErrorDialog from "./ReportErrorDialog";
import { isTypingTarget } from "./questions/gesture";
import { pytania } from "@/lib/i18n";
import type { QuizQuestion, QuizResult, AnswerData, QuestionType } from "@/types";

interface QuizInterfaceProps {
  sectionId?: string;
  mode?: "learn" | "review" | "exam";
  examQuestionCount?: number;
  /** Powtórka tylko tych pytań (np. błędne z właśnie skończonej sesji) */
  reviewIds?: string[];
  onExit?: () => void;
}

/** Sesja nauki / powtórki: najwyżej tyle pytań, bez powtórzeń w sesji (egzamin ma własną liczbę) */
const SESSION_LENGTH = 10;
/** „Sprawdzam…” dopiero, gdy serwer odpowiada dłużej — szybka odpowiedź nie mruga napisem */
const PENDING_HINT_MS = 300;
/** Egzamin: „Zapisano” zostaje na chwilę, potem następne pytanie */
const EXAM_ADVANCE_MS = 650;

// clinical_case jeszcze nie ma w QuestionType (@/types) — klucz dopisany obok
const TYPE_LABEL: Record<QuestionType | "clinical_case", string> = {
  multiple_choice: "Wybór",
  drag_drop: "Przeciąganie",
  fill_blank: "Uzupełnianie",
  matching: "Dopasowanie",
  sorting: "Kolejność",
  hotspot: "Wskaż na zapisie",
  clinical_case: "Przypadek",
};

/** Etykieta trybu; quiz tematu dostaje „Moduł 01 · Temat 04” (numeracja jak na liście w Kursie) */
const MODE_LABEL = { learn: "Temat", review: "Powtórka", exam: "Egzamin próbny" } as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Nauka/powtórka zatwierdzają odpowiedź od razu po dotknięciu — mówimy o tym raz, przy pierwszym pytaniu */
const INSTANT_HINT_KEY = "hk-hint-instant-v1";
function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(INSTANT_HINT_KEY) === "1";
  } catch {
    return false;
  }
}
function saveHintSeen() {
  try {
    window.localStorage.setItem(INSTANT_HINT_KEY, "1");
  } catch {
    /* tryb prywatny — podpowiedź pokaże się jeszcze raz, nic się nie psuje */
  }
}

/**
 * Ile miejsc w pytaniu interaktywnym jest wypełnionych — do licznika obok „Sprawdź”.
 * Kolejność (sorting) i wskazanie (hotspot) są zawsze „kompletne”, więc bez licznika.
 */
function filledCount(question: QuizQuestion | undefined, answer: AnswerData | null): { filled: number; total: number; noun: string } | null {
  const cfg = question?.questionConfig as any;
  if (!cfg?.config) return null;
  const a = answer as any;
  switch (cfg.type) {
    case "drag_drop": {
      const total = cfg.config.targets?.length ?? 0;
      const filled = new Set((a?.placements ?? []).map((p: { targetId: string }) => p.targetId)).size;
      return total > 1 ? { filled: Math.min(filled, total), total, noun: "miejsc wypełnionych" } : null;
    }
    case "fill_blank": {
      const total = cfg.config.blanks?.length ?? 0;
      const filled = (a?.filledBlanks ?? []).filter((b: { value?: string }) => (b.value ?? "").trim() !== "").length;
      return total > 1 ? { filled: Math.min(filled, total), total, noun: "luk uzupełnionych" } : null;
    }
    case "matching": {
      const total = cfg.config.leftColumn?.length ?? 0;
      const filled = new Set((a?.pairs ?? []).map((p: { leftId: string }) => p.leftId)).size;
      return total > 1 ? { filled: Math.min(filled, total), total, noun: "par połączonych" } : null;
    }
    default:
      return null;
  }
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${pad(s % 60)} s` : `${s} s`;
}

/*
 * Przejście między pytaniami: nowe wjeżdża z prawej OD RAZU (AnimatePresence mode="popLayout"),
 * stare w tym czasie krótko odpływa w lewo nad nim — bez czekania na koniec wyjścia (spójność przestrzenna,
 * zero opóźnienia na ścieżce „Dalej”).
 */
const stage = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: spring },
  exit: { opacity: 0, x: -20, transition: { duration: 0.14, ease: "easeOut" } },
};

/** Przewiń na górę natychmiast — płynne przewijanie po skosie w trakcie wejścia nowej karty męczy wzrok */
function jumpToTop() {
  if (window.scrollY > 0) window.scrollTo({ top: 0, left: window.scrollX, behavior: "instant" as ScrollBehavior });
}

interface CourseSection {
  id: string;
  title: string;
  order: number;
  isLocked?: boolean;
  completionPercentage: number;
  questionCount?: number;
}
interface CourseModule {
  id: string;
  order: number;
  isLocked?: boolean;
  sections: CourseSection[];
}

interface ExamReviewItem {
  questionId: string;
  title: string;
  bodyMd: string;
  imageUrl?: string;
  questionType: string;
  answers: Array<{ text: string; index: number }>;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  partialScore?: number;
  explanation: string;
}
interface ExamSummaryData {
  totalQuestions: number;
  answered?: number;
  /** Serwer podaje dopiero po zakończeniu egzaminu */
  correctAnswers?: number;
  totalTime: number;
  finished?: boolean;
  review?: ExamReviewItem[];
}

type Payload = { questionId: string; selectedIndex: number; timeMs: number; answerData?: AnswerData };
/** Pobranie następnego pytania w tle; key = JSON klucza zapytania, dla którego jest */
type Prefetch = { key: string; promise: Promise<QuizQuestion>; data?: QuizQuestion; failed?: boolean };

/** Brak pytania (404) to nie błąd — sesja się skończyła albo nie ma pytań */
class NoQuestion extends Error {}

/**
 * Pełne dane do pokazania wyniku pytania interaktywnego przychodzą dopiero z oceną.
 * Dokładamy tylko pola z odpowiedzią — reszta konfiguracji (kolejność elementów)
 * zostaje, żeby nic na ekranie nie przeskoczyło.
 */
function withRevealedConfig(question: QuizQuestion, result: QuizResult | null): QuizQuestion {
  const full = result?.questionConfig as any;
  const current = question.questionConfig as any;
  if (!full || !current || full.type !== current.type || !full.config || !current.config) return question;
  if (current.type === "hotspot") {
    return { ...question, questionConfig: { type: "hotspot", config: { ...current.config, hotspots: full.config.hotspots } } };
  }
  if (current.type === "matching") {
    return { ...question, questionConfig: { type: "matching", config: { ...current.config, correctPairs: full.config.correctPairs } } };
  }
  return question;
}

export default function QuizInterface({ sectionId, mode = "learn", examQuestionCount, reviewIds, onExit }: QuizInterfaceProps) {
  const [, setLocation] = useLocation();
  const isExam = mode === "exam";

  const [sessionNo, setSessionNo] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [currentAnswerData, setCurrentAnswerData] = useState<AnswerData | null>(null);
  const [status, setStatus] = useState<AnswerStatus>("idle");
  const [slow, setSlow] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [lightbox, setLightbox] = useState<{ url: string; origin?: HTMLElement } | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [examSessionId, setExamSessionId] = useState<string | null>(null);
  const [examTotalQuestions, setExamTotalQuestions] = useState<number>(0);
  const [examInitError, setExamInitError] = useState<string | null>(null);
  const [examInitNonce, setExamInitNonce] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  /** Długość sesji nauki/powtórki — ustalana raz, na początku sesji */
  const [sessionTotal, setSessionTotal] = useState<number | null>(isExam ? null : reviewIds ? Math.min(SESSION_LENGTH, reviewIds.length) : null);
  // Wyniki tej sesji (z odpowiedzi serwera) — do podsumowania
  const [tally, setTally] = useState<Record<number, { questionId: string; isCorrect: boolean; timeMs: number }>>({});
  /** Pierwsze pytanie nauki/powtórki: podpowiedź, że dotknięcie od razu zatwierdza odpowiedź */
  const [instantHint, setInstantHint] = useState(() => !isExam && !readHintSeen());
  /** Pytania pokazane w tej sesji — serwer ich nie powtórzy */
  const shownRef = useRef<string[]>([]);
  /** Następne pytanie pobrane w tle, gdy widać wyjaśnienie / „Zapisano” — „Dalej” pokazuje je od razu */
  const prefetchRef = useRef<Prefetch | null>(null);
  const lastPayload = useRef<Payload | null>(null);
  const requestNo = useRef(0);
  const advanceTimer = useRef<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => {
    requestNo.current++;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    prefetchRef.current = null;
    // Pytania z tej sesji (także wstawione z pobrania w tle) nie mogą wrócić przy następnym wejściu
    queryClient.removeQueries({ queryKey: ["/api/quiz/question"] });
    queryClient.removeQueries({ queryKey: ["/api/exam/question"] });
  }, []);

  /* ───────── Dane kursu: długość sesji nauki i „Następny temat” ───────── */
  const modulesQuery = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json() as Promise<CourseModule[]>;
    },
    enabled: mode === "learn",
  });

  const orderedSections = useMemo(
    () =>
      (modulesQuery.data ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .flatMap((m) =>
          m.sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => ({ ...s, isLocked: Boolean(m.isLocked || s.isLocked) })),
        ),
    [modulesQuery.data],
  );
  const currentSection = sectionId ? orderedSections.find((s) => s.id === sectionId) : undefined;

  // „Moduł 01 · Temat 04” — te same numery co na liście w Kursie
  const topicLabel = useMemo(() => {
    const mods = (modulesQuery.data ?? []).slice().sort((a, b) => a.order - b.order);
    for (let mi = 0; mi < mods.length; mi++) {
      const si = mods[mi].sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .findIndex((s) => s.id === sectionId);
      if (si >= 0) return `Moduł ${pad(mi + 1)} · Temat ${pad(si + 1)}`;
    }
    return MODE_LABEL.learn;
  }, [modulesQuery.data, sectionId]);
  const modeLabel = mode === "learn" ? topicLabel : MODE_LABEL[mode];

  /** Wyjście z sesji: temat wraca do Kursu, powtórka i egzamin do Postępu (onExit w pages/quiz.tsx) */
  const exitLabel = mode === "learn" ? "Wróć do kursu" : "Wróć do postępu";

  /* ───────── Kolejka powtórki: długość sesji i pusty stan ───────── */
  const queueQuery = useQuery({
    queryKey: ["/api/review-queue", "session", sessionNo],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/review-queue");
      return response.json() as Promise<{ questionIds?: string[] }>;
    },
    enabled: mode === "review" && !reviewIds,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (sessionTotal !== null || isExam) return;
    if (mode === "learn" && modulesQuery.data) {
      const count = currentSection?.questionCount;
      setSessionTotal(Math.min(SESSION_LENGTH, count && count > 0 ? count : SESSION_LENGTH));
    }
    if (mode === "review" && !reviewIds && queueQuery.data) {
      setSessionTotal(Math.min(SESSION_LENGTH, queueQuery.data.questionIds?.length ?? 0));
    }
  }, [sessionTotal, isExam, mode, modulesQuery.data, currentSection, reviewIds, queueQuery.data]);

  /* ───────── Egzamin: start sesji ───────── */
  useEffect(() => {
    if (!isExam || !examQuestionCount || examSessionId) return;
    let cancelled = false;
    setExamInitError(null);
    (async () => {
      try {
        const response = await apiRequest("POST", "/api/exam/initialize", { count: examQuestionCount });
        const data = (await response.json()) as { sessionId: string; totalQuestions: number };
        if (cancelled) return;
        setExamSessionId(data.sessionId);
        setExamTotalQuestions(data.totalQuestions);
      } catch {
        if (!cancelled) setExamInitError("Nie udało się rozpocząć egzaminu. Sprawdź połączenie i spróbuj jeszcze raz.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isExam, examQuestionCount, examSessionId, examInitNonce]);

  /* ───────── Bieżące pytanie ───────── */
  const questionKey = (index: number) =>
    isExam
      ? (["/api/exam/question", examSessionId, index] as const)
      : (["/api/quiz/question", mode, sectionId ?? null, reviewIds?.join(",") ?? null, sessionNo, index] as const);

  /**
   * Nauka/powtórka: serwer wybiera następne pytanie z pominięciem pokazanych (exclude).
   * Egzamin: pytanie po indeksie — serwer wydaje najwyżej bieżące, a pytanie nie niesie odpowiedzi,
   * więc pobranie index+1 po zapisaniu odpowiedzi niczego nie zdradza.
   */
  const fetchQuestion = async (index: number): Promise<QuizQuestion> => {
    let url: string;
    if (isExam) {
      url = `/api/exam/question?sessionId=${encodeURIComponent(examSessionId!)}&index=${index}`;
    } else {
      const p = new URLSearchParams({ mode });
      if (mode === "learn" && sectionId) p.set("sectionId", sectionId);
      if (reviewIds?.length) p.set("ids", reviewIds.join(","));
      if (shownRef.current.length) p.set("exclude", shownRef.current.join(","));
      url = `/api/quiz/question?${p.toString()}`;
    }
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 404) throw new NoQuestion();
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as QuizQuestion;
  };

  const questionQuery = useQuery({
    queryKey: questionKey(currentQuestionIndex),
    queryFn: ({ queryKey }) => {
      const index = queryKey[queryKey.length - 1] as number;
      // Pobranie w tle jeszcze trwa (albo skończyło się 404 = koniec sesji) — czekamy na nie, bez drugiego zapytania
      const pre = prefetchRef.current;
      if (pre && pre.key === JSON.stringify(queryKey) && !pre.failed) {
        prefetchRef.current = null;
        return pre.promise;
      }
      return fetchQuestion(index);
    },
    enabled: isExam ? !!examSessionId : mode === "review" || !!sectionId,
    // Pytanie nie może się podmienić w trakcie odpowiadania (np. po powrocie do karty)
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (count, error) => !(error instanceof NoQuestion) && count < 1,
  });
  const question = questionQuery.data;
  const noMoreQuestions = questionQuery.error instanceof NoQuestion;
  const loadError = questionQuery.isError && !noMoreQuestions;

  useEffect(() => {
    if (question && !shownRef.current.includes(question.id)) shownRef.current.push(question.id);
  }, [question]);

  useEffect(() => {
    setStartTime(Date.now());
  }, [question]);

  // Brak kolejnego pytania w środku sesji = koniec sesji (np. sekcja ma mniej pytań)
  useEffect(() => {
    if (noMoreQuestions && !isExam && currentQuestionIndex > 0) setShowSummary(true);
    if (noMoreQuestions && isExam && currentQuestionIndex > 0) setExamFinished(true);
  }, [noMoreQuestions, isExam, currentQuestionIndex]);

  const shownQuestion = useMemo(
    () => (question ? withRevealedConfig(question, status === "result" ? quizResult : null) : undefined),
    [question, quizResult, status],
  );

  /* ───────── Wysłanie odpowiedzi ───────── */
  const total = isExam ? examTotalQuestions : sessionTotal ?? SESSION_LENGTH;
  const isLast = currentQuestionIndex + 1 >= total;

  const scrollToTop = jumpToTop;

  // Odpowiedź oceniona (nauka/powtórka) albo zapisana (egzamin) → w tle pobierz następne pytanie.
  // W nauce serwer wybiera kolejne z uwzględnieniem właśnie zapisanej odpowiedzi, więc wynik jest
  // ten sam, co przy pobraniu po „Dalej” — tylko bez czekania.
  useEffect(() => {
    if (status !== "result" && status !== "saved") return;
    if (isLast || (isExam && !examSessionId)) return;
    const key = JSON.stringify(questionKey(currentQuestionIndex + 1));
    if (prefetchRef.current?.key === key) return;
    const entry: Prefetch = { key, promise: fetchQuestion(currentQuestionIndex + 1) };
    entry.promise.then(
      (data) => {
        entry.data = data;
      },
      (error) => {
        // 404 (koniec pytań) zostaje — „Dalej” od razu pokaże podsumowanie; inny błąd = pobierz jeszcze raz
        entry.failed = !(error instanceof NoQuestion);
      },
    );
    prefetchRef.current = entry;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isLast, isExam, examSessionId, currentQuestionIndex, sessionNo]);

  const handleNextQuestion = () => {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    if (isLast) {
      if (isExam) setExamFinished(true);
      else setShowSummary(true);
      scrollToTop();
      return;
    }

    // Pobrane w tle — wstaw do pamięci zapytań, nowa karta rysuje się w tej samej klatce
    const nextKey = questionKey(currentQuestionIndex + 1);
    const pre = prefetchRef.current;
    if (pre && pre.key === JSON.stringify(nextKey) && pre.data) {
      queryClient.setQueryData(nextKey, pre.data);
      prefetchRef.current = null;
    }

    scrollToTop();
    setCurrentQuestionIndex((i) => i + 1);
    setSelectedAnswer(null);
    setCurrentAnswerData(null);
    setStatus("idle");
    setQuizResult(null);
    lastPayload.current = null;
    setStartTime(Date.now());
  };
  const nextRefFn = useRef(handleNextQuestion);
  nextRefFn.current = handleNextQuestion;

  const submit = async (payload: Payload) => {
    const myRequest = ++requestNo.current;
    const index = currentQuestionIndex;
    lastPayload.current = payload;
    setStatus("pending");
    setSlow(false);
    const hint = window.setTimeout(() => {
      if (requestNo.current === myRequest) setSlow(true);
    }, PENDING_HINT_MS);

    const markSaved = () => {
      setStatus("saved");
      setTally((prev) => ({ ...prev, [index]: { questionId: payload.questionId, isCorrect: false, timeMs: payload.timeMs } }));
      advanceTimer.current = window.setTimeout(() => nextRefFn.current(), EXAM_ADVANCE_MS);
    };

    try {
      if (isExam) {
        await apiRequest("POST", "/api/exam/answer", { sessionId: examSessionId, ...payload });
        if (requestNo.current !== myRequest) return;
        markSaved();
      } else {
        const response = await apiRequest("POST", "/api/quiz/answer", { ...payload, mode });
        const result = (await response.json()) as QuizResult;
        if (requestNo.current !== myRequest) return;
        setQuizResult(result);
        setStatus("result");
        setTally((prev) => ({
          ...prev,
          [index]: { questionId: payload.questionId, isCorrect: result.isCorrect, timeMs: result.timeMs },
        }));
        queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
        queryClient.invalidateQueries({ queryKey: ["/api/review-queue"], exact: true });
      }
    } catch (error: any) {
      if (requestNo.current !== myRequest) return;
      // Egzamin: odpowiedź doszła, tylko potwierdzenie zginęło po drodze — ponowienie to wykrywa
      if (isExam && /już odpowiedziano/i.test(String(error?.message ?? ""))) {
        markSaved();
        return;
      }
      setStatus("error");
    } finally {
      window.clearTimeout(hint);
      if (requestNo.current === myRequest) setSlow(false);
    }
  };

  const isInteractive =
    !!question && !!question.questionType && question.questionType !== "multiple_choice" && !!question.questionConfig;
  const canAnswer = status === "idle" || status === "error";
  /**
   * Wybór w egzaminie: dotknięcie zaznacza, „Zapisz odpowiedź” zatwierdza. W egzaminie nie ma wyniku
   * ani powtórki pytania, więc pomyłka palca byłaby nieodwracalna. W nauce/powtórce dotknięcie od razu
   * pokazuje wynik — to sedno nauki, a błąd i tak wraca w powtórce (jedna podpowiedź przy pierwszym pytaniu).
   */
  const confirmChoice = isExam && !isInteractive;

  const handleAnswerSelect = (position: number) => {
    if (!question || !canAnswer) return;
    const answer = question.answers[position];
    if (!answer) return;
    setSelectedAnswer(position); // stan „naciśnięte” od razu
    if (confirmChoice) {
      if (status === "error") setStatus("idle");
      return;
    }
    if (instantHint) {
      setInstantHint(false);
      saveHintSeen();
    }
    // Serwer zna odpowiedzi po indeksie z bazy, nie po pozycji na ekranie (odpowiedzi są tasowane)
    submit({ questionId: question.id, selectedIndex: answer.index, timeMs: Date.now() - startTime });
  };

  const handleConfirmChoice = () => {
    if (!question || selectedAnswer === null || !canAnswer) return;
    const answer = question.answers[selectedAnswer];
    if (!answer) return;
    submit({ questionId: question.id, selectedIndex: answer.index, timeMs: Date.now() - startTime });
  };

  const handleAnswerChange = (answerData: AnswerData) => {
    setCurrentAnswerData(answerData);
  };

  const handleSubmitInteractiveAnswer = () => {
    if (!question || !currentAnswerData || !canAnswer) return;
    submit({ questionId: question.id, selectedIndex: -1, timeMs: Date.now() - startTime, answerData: currentAnswerData });
  };

  const retrySave = () => {
    if (lastPayload.current && status === "error") submit(lastPayload.current);
  };

  const answeredCount = Object.keys(tally).length;

  const handleExit = () => {
    if (isExam && !examFinished) {
      if (answeredCount === 0) onExit?.();
      else setConfirmLeave(true);
      return;
    }
    if (answeredCount > 0 && !showSummary) {
      setShowSummary(true);
      scrollToTop();
      return;
    }
    onExit?.();
  };

  const openLightbox = (imageUrl: string, origin?: HTMLElement) => {
    setLightbox({ url: imageUrl, origin });
  };

  // Po wyniku fokus na „Dalej” — Enter od razu prowadzi dalej
  useEffect(() => {
    if (status === "result") nextRef.current?.focus({ preventScroll: true });
  }, [status]);

  // Klawiatura: 1–4 / A–D wybiera odpowiedź, Enter = sprawdź / dalej
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (!question || lightbox || showReportDialog || confirmLeave || showSummary || examFinished) return;
    if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const target = e.target as HTMLElement | null;
    if (canAnswer && !isInteractive) {
      let idx = "1234".indexOf(e.key);
      if (idx < 0 && e.key.length === 1) idx = "abcd".indexOf(e.key.toLowerCase());
      if (idx >= 0 && idx < question.answers.length) {
        e.preventDefault();
        handleAnswerSelect(idx);
        return;
      }
    }
    if (e.key === "Enter") {
      // Przyciski i linki obsługują Enter same
      if (target && target.closest("button, a, [role=button]")) return;
      if (status === "result" || status === "saved") {
        e.preventDefault();
        handleNextQuestion();
      } else if (confirmChoice && selectedAnswer !== null && canAnswer) {
        e.preventDefault();
        handleConfirmChoice();
      } else if (isInteractive && currentAnswerData && canAnswer) {
        e.preventDefault();
        handleSubmitInteractiveAnswer();
      }
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ───────── Podsumowania ───────── */
  const examSummaryQuery = useQuery({
    queryKey: ["/api/exam/summary", examSessionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/exam/summary?sessionId=${encodeURIComponent(examSessionId!)}`);
      return response.json() as Promise<ExamSummaryData>;
    },
    enabled: examFinished && !!examSessionId,
    staleTime: Infinity,
  });

  // Po sesji nauki postęp sekcji się zmienił — odśwież, żeby wybrać „Następne pytania” albo „Następny temat”
  useEffect(() => {
    if (showSummary || examFinished) {
      queryClient.invalidateQueries({ queryKey: ["/api/modules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
    }
  }, [showSummary, examFinished]);

  const reviewThese = useCallback(
    (ids: string[]) => setLocation(`/quiz?mode=review&ids=${ids.map(encodeURIComponent).join(",")}`),
    [setLocation],
  );

  const restartSession = () => {
    requestNo.current++;
    prefetchRef.current = null;
    shownRef.current = [];
    lastPayload.current = null;
    setTally({});
    setShowSummary(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setCurrentAnswerData(null);
    setStatus("idle");
    setQuizResult(null);
    setSessionTotal(reviewIds ? Math.min(SESSION_LENGTH, reviewIds.length) : null);
    setSessionNo((n) => n + 1);
    scrollToTop();
  };

  if (examFinished) {
    if (examSummaryQuery.isError) {
      return (
        <StateCard
          label={MODE_LABEL.exam}
          title="Nie udało się policzyć wyniku"
          lead="Sprawdź połączenie i spróbuj jeszcze raz."
          primary={{ label: "Spróbuj ponownie", onClick: () => examSummaryQuery.refetch() }}
          secondary={{ label: exitLabel, onClick: () => onExit?.() }}
        />
      );
    }
    const summary = examSummaryQuery.data;
    if (!summary) return <QuietLoader label="Liczę wynik…" />;
    const correctAnswers = summary.correctAnswers ?? 0;
    const pct = summary.totalQuestions > 0 ? Math.round((correctAnswers / summary.totalQuestions) * 100) : 0;
    const wrongIds = (summary.review ?? []).filter((r) => !r.isCorrect).map((r) => r.questionId);
    return (
      <Summary
        modeLabel={MODE_LABEL.exam}
        correct={correctAnswers}
        total={summary.totalQuestions}
        timeMs={summary.totalTime}
        message={`Wynik: ${correctAnswers}/${summary.totalQuestions} (${pct}%)`}
        primary={wrongIds.length > 0 ? { label: "Powtórz błędne", onClick: () => reviewThese(wrongIds), testId: "retry-wrong" } : undefined}
        secondary={{ label: exitLabel, onClick: () => onExit?.(), testId: "exit-exam" }}
      >
        {summary.review && summary.review.length > 0 && <ExamReview items={summary.review} onImageClick={openLightbox} />}
        {lightbox && <ImageLightbox imageUrl={lightbox.url} origin={lightbox.origin} onClose={() => setLightbox(null)} />}
      </Summary>
    );
  }

  if (showSummary) {
    const results = Object.values(tally);
    const correct = results.filter((r) => r.isCorrect).length;
    const wrongIds = results.filter((r) => !r.isCorrect).map((r) => r.questionId);
    const wrong = wrongIds.length;

    const message =
      results.length === 0
        ? "Nie udzielono jeszcze żadnej odpowiedzi."
        : wrong === 0
          ? "Wszystkie odpowiedzi poprawne."
          : `Do powtórki: ${pytania(wrong)}.`;

    let primary: SummaryAction | undefined;
    const extra: SummaryAction[] = [];
    const backToCourse: SummaryAction = { label: exitLabel, onClick: () => onExit?.(), testId: "exit-exam" };

    if (mode === "learn") {
      const refreshing = modulesQuery.isFetching;
      const fresh = sectionId ? orderedSections.find((s) => s.id === sectionId) : undefined;
      const unmasteredLeft = !fresh || (fresh.completionPercentage ?? 0) < 100;
      const from = orderedSections.findIndex((s) => s.id === sectionId);
      const nextSection = orderedSections
        .slice(from + 1)
        .find((s) => (s.questionCount === undefined || s.questionCount > 0) && !s.isLocked);
      if (refreshing) {
        primary = { label: "Sprawdzam postęp…", onClick: () => {}, disabled: true, testId: "summary-next" };
      } else if (unmasteredLeft) {
        primary = { label: "Następne pytania", onClick: restartSession, testId: "summary-next" };
      } else if (nextSection) {
        primary = {
          label: "Następny temat",
          onClick: () => setLocation(`/quiz?sectionId=${nextSection.id}`),
          testId: "summary-next-topic",
        };
      }
      if (wrong > 0) extra.push({ label: "Powtórz błędne", onClick: () => reviewThese(wrongIds), testId: "retry-wrong" });
    } else {
      if (wrong > 0) primary = { label: "Powtórz błędne", onClick: () => reviewThese(wrongIds), testId: "retry-wrong" };
      else if (!reviewIds) primary = { label: "Dalej powtarzaj", onClick: restartSession, testId: "summary-next" };
    }

    return (
      <Summary
        modeLabel={modeLabel}
        correct={correct}
        total={results.length}
        timeMs={results.reduce((s, r) => s + r.timeMs, 0)}
        message={message}
        primary={primary}
        extra={extra}
        secondary={backToCourse}
      />
    );
  }

  /* ───────── Stany brzegowe ───────── */
  if (isExam && examInitError) {
    return (
      <StateCard
        label={MODE_LABEL.exam}
        title="Nie udało się rozpocząć egzaminu"
        lead={examInitError}
        primary={{ label: "Spróbuj ponownie", onClick: () => setExamInitNonce((n) => n + 1) }}
        secondary={{ label: exitLabel, onClick: () => onExit?.() }}
      />
    );
  }

  const reviewQueueEmpty = mode === "review" && !reviewIds && queueQuery.data && (queueQuery.data.questionIds?.length ?? 0) === 0;
  if (reviewQueueEmpty || (mode === "review" && noMoreQuestions && currentQuestionIndex === 0)) {
    return (
      <StateCard
        label={MODE_LABEL.review}
        title="Nic do powtórki"
        lead="Nic do powtórki. Wszystkie błędne pytania już poprawione."
        primary={{ label: "Przejdź do kursu", onClick: () => setLocation("/modules"), testId: "back-to-course" }}
      />
    );
  }

  if (noMoreQuestions && currentQuestionIndex === 0) {
    return (
      <StateCard
        label={modeLabel}
        title="Brak pytań do pokazania"
        lead={isExam ? "Nie udało się wczytać pytań egzaminu. Rozpocznij egzamin od nowa." : "Ten temat nie ma jeszcze pytań. Wybierz inny temat w Kursie."}
        primary={{ label: exitLabel, onClick: () => onExit?.(), testId: "back-to-dashboard" }}
      />
    );
  }

  if (loadError || (mode === "review" && !reviewIds && queueQuery.isError)) {
    return (
      <StateCard
        label={modeLabel}
        title="Nie udało się wczytać pytania"
        lead="Sprawdź połączenie i spróbuj jeszcze raz. Twoje dotychczasowe odpowiedzi są zapisane."
        primary={{
          label: "Spróbuj ponownie",
          onClick: () => {
            if (queueQuery.isError) queueQuery.refetch();
            questionQuery.refetch();
          },
          testId: "retry-load",
        }}
        secondary={{ label: exitLabel, onClick: () => onExit?.() }}
      />
    );
  }

  const done = currentQuestionIndex + (status === "result" || status === "saved" ? 1 : 0);
  const progress = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const typeLabel = question
    ? TYPE_LABEL[(question.questionType || "multiple_choice") as keyof typeof TYPE_LABEL] ?? null
    : null;

  // Klucz = pozycja w sesji: ładowanie i treść dzielą jedno wejście, bez podwójnego przesunięcia
  const stageKey = `stage-${sessionNo}-${currentQuestionIndex}`;
  const filled = isInteractive && canAnswer ? filledCount(question, currentAnswerData) : null;

  return (
    <div className="min-h-screen bg-[var(--ink)]">
      {/* Górna belka: zakończ · pozycja i typ · postęp */}
      <div className="material-bar sticky top-16 z-40 border-b border-[var(--line)]">
        <div className="wrap wrap--narrow flex h-14 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleExit} data-testid="exit-quiz" className="-ml-3 gap-1.5 px-3">
            <X aria-hidden />
            {isExam ? "Przerwij" : "Zakończ"}
          </Button>
          <p className="label num ml-auto truncate" aria-live="polite" data-testid="quiz-position">
            {total > 0 ? `Pytanie ${currentQuestionIndex + 1} z ${total}` : `Pytanie ${currentQuestionIndex + 1}`}
            {typeLabel && <span className="hidden sm:inline"> · {typeLabel}</span>}
          </p>
        </div>
        <div className="wrap wrap--narrow pb-3">
          <div
            className="progress"
            role="progressbar"
            aria-label="Postęp sesji"
            aria-valuemin={0}
            aria-valuemax={total || undefined}
            aria-valuenow={done}
          >
            <span style={{ "--w": progress / 100 } as React.CSSProperties} />
          </div>
        </div>
      </div>

      <div className="wrap wrap--narrow safe-bottom relative py-7 sm:py-10">
        {/* popLayout: nowa karta wchodzi od razu, stara wychodzi nad nią (bez czekania na koniec wyjścia) */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={stageKey} variants={stage} initial="initial" animate="animate" exit="exit">
            {shownQuestion && !questionQuery.isFetching ? (
              <motion.div key={shownQuestion.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: springSnappy }}>
                <QuestionCard
                  question={shownQuestion}
                  selectedAnswer={selectedAnswer}
                  status={status}
                  showPending={slow}
                  examMode={isExam}
                  answerHint={
                    instantHint && !isInteractive ? "Odpowiedź liczy się po dotknięciu." : undefined
                  }
                  quizResult={quizResult || undefined}
                  onAnswerSelect={handleAnswerSelect}
                  onAnswerChange={handleAnswerChange}
                  onImageClick={openLightbox}
                />

                {/* Telefon: licznik wypełnionych miejsc nad przyciskami — w jednym wierszu się nie mieści */}
                {filled && (
                  <p className="mt-4 text-right text-[14px] text-[var(--txt2)] sm:hidden" aria-live="polite">
                    <FilledText {...filled} />
                  </p>
                )}

                {/* Nawigacja: jedno główne działanie na ekranie */}
                <nav className={`${filled ? "mt-3 sm:mt-5" : "mt-5"} flex items-center justify-between gap-3`} aria-label="Nawigacja quizu">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReportDialog(true)}
                    data-testid="report-error-button"
                    className="-ml-3 gap-1.5 px-3"
                  >
                    <Flag aria-hidden />
                    Zgłoś błąd
                  </Button>

                  {status === "result" || status === "saved" ? (
                    <Button ref={nextRef} onClick={handleNextQuestion} data-testid="next-question" className="gap-2">
                      {isLast ? "Pokaż wynik" : "Dalej"}
                      <ArrowRight aria-hidden />
                    </Button>
                  ) : confirmChoice ? (
                    // Egzamin, wybór: zatwierdzenie zaznaczonej odpowiedzi (po błędzie zapisu — ta sama akcja)
                    <Button
                      onClick={handleConfirmChoice}
                      disabled={selectedAnswer === null || status === "pending"}
                      data-testid="confirm-answer"
                    >
                      {status === "pending" && slow ? "Zapisuję…" : "Zapisz odpowiedź"}
                    </Button>
                  ) : status === "error" && (!isInteractive ? selectedAnswer !== null : !!currentAnswerData) ? (
                    <Button onClick={retrySave} data-testid="retry-save" className="gap-2">
                      <RotateCcw aria-hidden />
                      Spróbuj ponownie
                    </Button>
                  ) : isInteractive ? (
                    <div className="flex items-center gap-3">
                      {filled && (
                        <p className="hidden text-[14px] text-[var(--txt2)] sm:block" aria-live="polite" data-testid="filled-count">
                          <FilledText {...filled} />
                        </p>
                      )}
                      <Button
                        onClick={handleSubmitInteractiveAnswer}
                        disabled={!currentAnswerData || status === "pending"}
                        data-testid="submit-interactive-answer"
                      >
                        {status === "pending" && slow ? (isExam ? "Zapisuję…" : "Sprawdzam…") : isExam ? "Zapisz odpowiedź" : "Sprawdź"}
                      </Button>
                    </div>
                  ) : (
                    <p className="label hidden sm:block" aria-hidden>
                      Klawisze 1–4 lub A–D
                    </p>
                  )}
                </nav>
              </motion.div>
            ) : (
              <QuestionSkeleton />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {lightbox && <ImageLightbox imageUrl={lightbox.url} origin={lightbox.origin} onClose={() => setLightbox(null)} />}

      {question && (
        <ReportErrorDialog questionId={question.id} open={showReportDialog} onOpenChange={setShowReportDialog} />
      )}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent data-testid="exam-leave-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Przerwać egzamin?</AlertDialogTitle>
            <AlertDialogDescription>Wynik nie zostanie policzony.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="exam-leave-cancel">Wróć do egzaminu</AlertDialogCancel>
            <AlertDialogAction onClick={() => onExit?.()} data-testid="exam-leave-confirm">
              Przerwij egzamin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────── Elementy pomocnicze ───────── */

/** „2 z 5 miejsc wypełnionych” */
function FilledText({ filled, total, noun }: { filled: number; total: number; noun: string }) {
  return (
    <>
      <span className="num text-[var(--txt)]">{filled}</span> z <span className="num">{total}</span> {noun}
    </>
  );
}

function QuietLoader({ label }: { label: string }) {
  return (
    <div className="wrap wrap--narrow grid min-h-[50vh] place-items-center">
      <p className="label" role="status">
        {label}
      </p>
    </div>
  );
}

/** Spokojny zarys pytania na czas ładowania — bez migającego spinnera */
function QuestionSkeleton() {
  return (
    <div
      className="grid gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-[clamp(22px,3vw,40px)]"
      role="status"
      aria-label="Ładuję pytanie"
    >
      <div className="mb-3 h-7 w-3/4 rounded-[8px] bg-[var(--line)]" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-[10px] border border-[var(--line)]" />
      ))}
    </div>
  );
}

type SummaryAction = { label: string; onClick: () => void; testId?: string; disabled?: boolean };

/** Pusty stan / błąd: etykieta, tytuł, jedno zdanie, działanie */
function StateCard({
  label,
  title,
  lead,
  primary,
  secondary,
}: {
  label: string;
  title: string;
  lead: string;
  primary: SummaryAction;
  secondary?: SummaryAction;
}) {
  return (
    <div className="wrap wrap--narrow py-16">
      <section className="grid gap-4 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-[clamp(24px,4vw,48px)]" data-testid="quiz-state">
        <p className="label">{label}</p>
        <h1 className="h2">{title}</h1>
        <p className="lead">{lead}</p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button onClick={primary.onClick} data-testid={primary.testId}>
            {primary.label}
          </Button>
          {secondary && (
            <Button variant="outline" onClick={secondary.onClick} data-testid={secondary.testId}>
              {secondary.label}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function Summary({
  modeLabel,
  correct,
  total,
  timeMs,
  message,
  primary,
  extra = [],
  secondary,
  children,
}: {
  modeLabel: string;
  correct: number;
  total: number;
  timeMs: number;
  message: string;
  primary?: SummaryAction;
  extra?: SummaryAction[];
  secondary: SummaryAction;
  children?: React.ReactNode;
}) {
  const wrong = Math.max(0, total - correct);
  return (
    <div className="wrap wrap--narrow py-12 sm:py-16">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: spring }}
        className="grid gap-5 rounded-[20px] border border-[var(--puls-dark)] bg-[var(--panel)] p-[clamp(24px,4vw,48px)]"
        data-testid="quiz-summary"
      >
        <p className="label">Podsumowanie · {modeLabel}</p>
        <p
          className="num flex items-baseline gap-3"
          style={{ font: "500 clamp(4rem, 3rem + 5vw, 7.5rem)/1 var(--font-heading)", letterSpacing: "-.04em" }}
          aria-label={`${correct} poprawnych z ${total}`}
        >
          {correct}
          <span className="text-[.32em] tracking-[-.01em] text-[var(--label)]">/ {total}</span>
        </p>
        <p className="lead" data-testid="summary-message">
          {message}
        </p>

        <dl className="grid grid-cols-3 border-t border-[var(--line)]">
          {[
            ["Poprawne", String(correct)],
            ["Błędne", String(wrong)],
            ["Czas", formatTime(timeMs)],
          ].map(([k, v], i) => (
            <div key={k} className={i > 0 ? "border-l border-[var(--line)] pl-4 pt-4 sm:pl-6" : "pr-4 pt-4"}>
              <dt className="label">{k}</dt>
              <dd className="num mt-1.5 text-[clamp(1.25rem,1.1rem+.6vw,1.625rem)] text-[var(--txt)]">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:flex-wrap">
          {primary && (
            <Button onClick={primary.onClick} disabled={primary.disabled} data-testid={primary.testId} className="gap-2">
              {primary.label}
              {!primary.disabled && <ArrowRight aria-hidden />}
            </Button>
          )}
          {extra.map((a) => (
            <Button key={a.label} variant="outline" onClick={a.onClick} data-testid={a.testId}>
              {a.label}
            </Button>
          ))}
          <Button variant={primary ? (extra.length ? "ghost" : "outline") : "default"} onClick={secondary.onClick} data-testid={secondary.testId}>
            {secondary.label}
          </Button>
        </div>
      </motion.section>
      {children}
    </div>
  );
}

/** Przegląd po egzaminie: każde pytanie, twoja odpowiedź, poprawna i wyjaśnienie */
function ExamReview({ items, onImageClick }: { items: ExamReviewItem[]; onImageClick: (url: string, origin?: HTMLElement) => void }) {
  return (
    <section className="mt-12 grid gap-4" aria-labelledby="exam-review-title" data-testid="exam-review">
      <h2 id="exam-review-title" className="label">
        Przegląd odpowiedzi
      </h2>
      <ol className="grid border-t border-[var(--line)]">
        {items.map((item, i) => {
          const isChoice = item.questionType === "multiple_choice" && item.answers.length > 0;
          const yours = isChoice ? item.answers.find((a) => a.index === item.selectedIndex) : undefined;
          const right = isChoice ? item.answers.find((a) => a.index === item.correctIndex) : undefined;
          return (
            <li key={item.questionId} className="grid gap-3 border-b border-[var(--line)] py-6" data-testid={`exam-review-${i}`}>
              <div className="flex items-start gap-3">
                <span className="label num shrink-0 pt-1">{pad(i + 1)}</span>
                <div className="grid min-w-0 gap-3">
                  {item.title && <p className="text-[17px] font-medium leading-snug text-[var(--txt)]">{item.title}</p>}
                  {item.bodyMd && (
                    <div
                      className="prose-hk max-w-[46em] text-[16px] text-[var(--txt)]"
                      dangerouslySetInnerHTML={sanitizeHtml(item.bodyMd)}
                    />
                  )}
                  {item.imageUrl && (
                    <button
                      type="button"
                      onClick={(e) => onImageClick(item.imageUrl!, e.currentTarget)}
                      className="block w-full max-w-[420px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--ink)] active:scale-[.99]"
                      aria-label="Powiększ zapis EKG"
                    >
                      <img src={item.imageUrl} alt="Zapis EKG" className="block max-h-[220px] w-full object-contain" />
                    </button>
                  )}

                  <p className="flex items-center gap-2 text-[15px] text-[var(--txt)]">
                    {item.isCorrect ? (
                      <Check className="h-4 w-4 shrink-0 text-[var(--puls)]" strokeWidth={2.25} aria-hidden />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-[var(--alarm)]" strokeWidth={2.25} aria-hidden />
                    )}
                    {item.isCorrect
                      ? "Poprawnie"
                      : !isChoice && item.partialScore !== undefined && item.partialScore > 0
                        ? `Częściowo: ${Math.round(item.partialScore * 100)}%`
                        : "Błędnie"}
                  </p>

                  {isChoice && (
                    <dl className="grid gap-1.5 text-[15px]">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="label">Twoja odpowiedź</dt>
                        <dd className={item.isCorrect ? "text-[var(--txt)]" : "text-[var(--txt2)]"}>
                          {yours ? yours.text : "brak"}
                        </dd>
                      </div>
                      {!item.isCorrect && right && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="label">Poprawna</dt>
                          <dd className="text-[var(--txt)]">{right.text}</dd>
                        </div>
                      )}
                    </dl>
                  )}

                  {item.explanation && (
                    <details className="group">
                      <summary className="label cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-[var(--txt)]">
                        Wyjaśnienie
                      </summary>
                      <div className="mt-2">
                        <Wyjasnienie md={item.explanation} className="prose-hk max-w-[46em] text-[16px]" />
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
