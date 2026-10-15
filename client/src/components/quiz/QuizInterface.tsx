import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { spring, springSnappy } from "@/lib/motion";
import QuestionCard from "./QuestionCard";
import ImageLightbox from "./ImageLightbox";
import ReportErrorDialog from "./ReportErrorDialog";
import { isTypingTarget } from "./questions/gesture";
import type { QuizQuestion, QuizResult, AnswerData, QuestionType } from "@/types";

interface QuizInterfaceProps {
  sectionId?: string;
  mode?: "learn" | "review" | "exam";
  examQuestionCount?: number;
  onExit?: () => void;
}

/** Sesja nauki / powtórki: tyle pytań, potem podsumowanie (egzamin ma własną liczbę) */
const SESSION_LENGTH = 10;

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Wybór",
  drag_drop: "Przeciąganie",
  fill_blank: "Uzupełnianie",
  matching: "Dopasowanie",
  sorting: "Kolejność",
  hotspot: "Wskaż na zapisie",
};

const MODE_LABEL = { learn: "Nauka", review: "Powtórka", exam: "Egzamin próbny" } as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** 1 pytanie, 2 pytania, 5 pytań */
function pytan(n: number) {
  if (n === 1) return "pytanie";
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "pytania" : "pytań";
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${pad(s % 60)} s` : `${s} s`;
}

/* Przejście między pytaniami: stare odjeżdża w lewo, nowe wjeżdża z prawej (spójność przestrzenna) */
const stage = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: spring },
  exit: { opacity: 0, x: -20, transition: springSnappy },
};

export default function QuizInterface({ sectionId, mode = "learn", examQuestionCount, onExit }: QuizInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [currentAnswerData, setCurrentAnswerData] = useState<AnswerData | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [lightbox, setLightbox] = useState<{ url: string; origin?: HTMLElement } | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [examSessionId, setExamSessionId] = useState<string | null>(null);
  const [examTotalQuestions, setExamTotalQuestions] = useState<number>(0);
  const [examFinished, setExamFinished] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  // Wyniki tej sesji (z odpowiedzi serwera) — do podsumowania
  const [tally, setTally] = useState<Record<number, { isCorrect: boolean; timeMs: number }>>({});
  const nextRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();
  const { toast } = useToast();

  // Initialize exam session
  useEffect(() => {
    if (mode === "exam" && examQuestionCount && !examSessionId) {
      const initExam = async () => {
        try {
          const response = await apiRequest("POST", "/api/exam/initialize", { count: examQuestionCount });
          const data = (await response.json()) as { sessionId: string; totalQuestions: number };
          setExamSessionId(data.sessionId);
          setExamTotalQuestions(data.totalQuestions);
        } catch (error: any) {
          toast({
            title: "Nie udało się rozpocząć egzaminu",
            description: error.message || "Sprawdź połączenie i spróbuj ponownie.",
            variant: "destructive",
          });
        }
      };
      initExam();
    }
  }, [mode, examQuestionCount, examSessionId, toast]);

  // Fetch current question
  const { data: question, isLoading: questionLoading } = useQuery({
    queryKey:
      mode === "exam"
        ? ["/api/exam/question", examSessionId, currentQuestionIndex]
        : ["/api/quiz/question", sectionId, mode, currentQuestionIndex],
    queryFn: async () => {
      let url = "";
      if (mode === "exam" && examSessionId) {
        url = `/api/exam/question?sessionId=${examSessionId}&index=${currentQuestionIndex}`;
      } else if (mode === "review") {
        url = `/api/quiz/question?mode=${mode}`;
      } else {
        url = `/api/quiz/question?sectionId=${sectionId}&mode=${mode}`;
      }
      const response = await apiRequest("GET", url);
      return response.json() as Promise<QuizQuestion>;
    },
    enabled: mode === "exam" ? !!examSessionId : mode === "review" || !!sectionId,
  });

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async (data: {
      questionId: string;
      selectedIndex: number;
      timeMs: number;
      sessionId?: string;
      answerData?: AnswerData;
    }) => {
      if (mode === "exam" && examSessionId) {
        const response = await apiRequest("POST", "/api/exam/answer", {
          sessionId: examSessionId,
          questionId: data.questionId,
          selectedIndex: data.selectedIndex,
          timeMs: data.timeMs,
          answerData: data.answerData,
        });
        return response.json() as Promise<QuizResult>;
      } else {
        const response = await apiRequest("POST", "/api/quiz/answer", {
          questionId: data.questionId,
          selectedIndex: data.selectedIndex,
          timeMs: data.timeMs,
          mode,
          answerData: data.answerData,
        });
        return response.json() as Promise<QuizResult>;
      }
    },
    onSuccess: (result) => {
      setQuizResult(result);

      // Invalidate progress queries (not for exam mode)
      if (mode !== "exam") {
        queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się zapisać odpowiedzi",
        description: error.message || "Sprawdź połączenie i spróbuj ponownie.",
        variant: "destructive",
      });
    },
  });

  const record = (index: number) => (result: QuizResult) =>
    setTally((prev) => ({ ...prev, [index]: { isCorrect: result.isCorrect, timeMs: result.timeMs } }));

  const isInteractive =
    !!question && !!question.questionType && question.questionType !== "multiple_choice" && !!question.questionConfig;

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null || submitAnswerMutation.isPending) return;

    setSelectedAnswer(answerIndex);
    const timeMs = Date.now() - startTime;

    if (question) {
      const optimisticResult: QuizResult = {
        isCorrect: answerIndex === question.correctIndex,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        timeMs,
      };

      setQuizResult(optimisticResult);
      setShowExplanation(true);

      submitAnswerMutation.mutate(
        {
          questionId: question.id,
          selectedIndex: answerIndex,
          timeMs,
        },
        { onSuccess: record(currentQuestionIndex) },
      );
    }
  };

  const handleAnswerChange = (answerData: AnswerData) => {
    setCurrentAnswerData(answerData);
  };

  const handleSubmitInteractiveAnswer = () => {
    if (!question || !currentAnswerData || submitAnswerMutation.isPending) return;

    const timeMs = Date.now() - startTime;
    setShowExplanation(true);

    submitAnswerMutation.mutate(
      {
        questionId: question.id,
        selectedIndex: -1,
        timeMs,
        answerData: currentAnswerData,
      },
      { onSuccess: record(currentQuestionIndex) },
    );
  };

  const scrollToTop = () => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;

    // Check if exam is finished
    if (mode === "exam" && nextIndex >= examTotalQuestions) {
      setExamFinished(true);
      scrollToTop();
      return;
    }
    if (mode !== "exam" && nextIndex >= SESSION_LENGTH) {
      setShowSummary(true);
      scrollToTop();
      return;
    }

    setCurrentQuestionIndex(nextIndex);
    setSelectedAnswer(null);
    setCurrentAnswerData(null);
    setShowExplanation(false);
    setQuizResult(null);
    setStartTime(Date.now());

    setTimeout(scrollToTop, 60);
  };

  const answeredCount = Object.keys(tally).length;

  const handleExit = () => {
    if (mode === "exam" && !examFinished) {
      if (answeredCount === 0 || confirm(t("quiz.confirmExit"))) onExit?.();
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

  useEffect(() => {
    setStartTime(Date.now());
  }, [question]);

  // Po odpowiedzi fokus na „Dalej” — Enter od razu prowadzi dalej
  useEffect(() => {
    if (showExplanation && quizResult) nextRef.current?.focus({ preventScroll: true });
  }, [showExplanation, quizResult]);

  // Klawiatura: 1–4 / A–D wybiera odpowiedź, Enter = sprawdź / dalej
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (!question || lightbox || showReportDialog || showSummary || examFinished) return;
    if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const target = e.target as HTMLElement | null;
    if (!showExplanation && !isInteractive) {
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
      if (showExplanation && quizResult) {
        e.preventDefault();
        handleNextQuestion();
      } else if (isInteractive && currentAnswerData && !showExplanation) {
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

  // Exam summary query
  const { data: examSummary } = useQuery({
    queryKey: ["/api/exam/summary", examSessionId],
    queryFn: async () => {
      if (!examSessionId) return null;
      const response = await apiRequest("GET", `/api/exam/summary?sessionId=${examSessionId}`);
      return response.json() as Promise<{ totalQuestions: number; correctAnswers: number; totalTime: number }>;
    },
    enabled: examFinished && !!examSessionId,
  });

  const retryWrong = useCallback(() => {
    window.location.assign("/quiz?mode=review");
  }, []);

  /* ───────── Podsumowanie ───────── */
  if (examFinished) {
    if (!examSummary) return <QuietLoader label="Liczę wynik…" />;
    const rate = examSummary.totalQuestions > 0 ? examSummary.correctAnswers / examSummary.totalQuestions : 0;
    return (
      <Summary
        modeLabel={MODE_LABEL.exam}
        correct={examSummary.correctAnswers}
        total={examSummary.totalQuestions}
        timeMs={examSummary.totalTime}
        message={
          rate >= 0.7
            ? "Zaliczone — próg to 70% poprawnych odpowiedzi."
            : "Tym razem poniżej progu 70%. Powtórz pytania, w których był błąd, i podejdź jeszcze raz."
        }
        onRetryWrong={examSummary.correctAnswers < examSummary.totalQuestions ? retryWrong : undefined}
        onBack={() => onExit?.()}
      />
    );
  }

  if (showSummary) {
    const results = Object.values(tally);
    const correct = results.filter((r) => r.isCorrect).length;
    const wrong = results.length - correct;
    return (
      <Summary
        modeLabel={MODE_LABEL[mode]}
        correct={correct}
        total={results.length}
        timeMs={results.reduce((s, r) => s + r.timeMs, 0)}
        message={
          results.length === 0
            ? "Nie udzielono jeszcze żadnej odpowiedzi."
            : wrong === 0
              ? "Wszystkie odpowiedzi poprawne."
              : `Do powtórki: ${wrong} ${pytan(wrong)}.`
        }
        onRetryWrong={wrong > 0 ? retryWrong : undefined}
        onBack={() => onExit?.()}
      />
    );
  }

  const total = mode === "exam" ? examTotalQuestions : SESSION_LENGTH;
  const done = currentQuestionIndex + (showExplanation ? 1 : 0);
  const progress = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const typeLabel = question ? TYPE_LABEL[question.questionType || "multiple_choice"] : null;

  if (!questionLoading && !question && (mode !== "exam" || examSessionId)) {
    return (
      <div className="wrap wrap--narrow py-16">
        <section className="grid gap-4 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-[clamp(24px,4vw,48px)]">
          <p className="label">{MODE_LABEL[mode]}</p>
          <h1 className="h2">Brak pytań do pokazania</h1>
          <p className="lead">
            {mode === "review"
              ? "Nie masz teraz pytań do powtórki. Wróć do kursu i rozwiąż kolejną sekcję."
              : "W tej sekcji nie ma jeszcze pytań. Wybierz inną sekcję w kursie."}
          </p>
          <div className="pt-2">
            <Button onClick={() => onExit?.()} data-testid="back-to-dashboard">
              Wróć do kursu
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // Klucz = pozycja w sesji: ładowanie i treść dzielą jedno wejście, bez podwójnego przesunięcia
  const stageKey = `stage-${currentQuestionIndex}`;

  return (
    <div className="min-h-screen bg-[var(--ink)]">
      {/* Górna belka: zakończ · pozycja i typ · postęp */}
      <div className="material-bar sticky top-16 z-40 border-b border-[var(--line)]">
        <div className="wrap wrap--narrow flex h-14 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            data-testid="exit-quiz"
            className="-ml-3 gap-1.5 px-3"
          >
            <X aria-hidden />
            Zakończ
          </Button>
          <p className="label num ml-auto truncate" aria-live="polite" data-testid="quiz-position">
            {total > 0 ? `Pytanie ${pad(currentQuestionIndex + 1)} / ${pad(total)}` : `Pytanie ${pad(currentQuestionIndex + 1)}`}
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
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="wrap wrap--narrow safe-bottom py-7 sm:py-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={stageKey} variants={stage} initial="initial" animate="animate" exit="exit">
            {question && !questionLoading ? (
              <motion.div key={question.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: springSnappy }}>
                <QuestionCard
                  question={question}
                  selectedAnswer={selectedAnswer}
                  showExplanation={showExplanation}
                  quizResult={quizResult || undefined}
                  onAnswerSelect={handleAnswerSelect}
                  onAnswerChange={handleAnswerChange}
                  onImageClick={openLightbox}
                  isSubmitting={submitAnswerMutation.isPending}
                />

                {/* Nawigacja: jedno główne działanie na ekranie */}
                <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Nawigacja quizu">
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

                  {showExplanation ? (
                    <Button
                      ref={nextRef}
                      onClick={handleNextQuestion}
                      disabled={!quizResult}
                      data-testid="next-question"
                      className="gap-2"
                    >
                      {(mode === "exam" && currentQuestionIndex + 1 >= examTotalQuestions) ||
                      (mode !== "exam" && currentQuestionIndex + 1 >= SESSION_LENGTH)
                        ? "Pokaż wynik"
                        : "Dalej"}
                      <ArrowRight aria-hidden />
                    </Button>
                  ) : isInteractive ? (
                    <Button
                      onClick={handleSubmitInteractiveAnswer}
                      disabled={!currentAnswerData || submitAnswerMutation.isPending}
                      data-testid="submit-interactive-answer"
                    >
                      {submitAnswerMutation.isPending ? "Sprawdzam…" : "Sprawdź"}
                    </Button>
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

      {lightbox && (
        <ImageLightbox imageUrl={lightbox.url} origin={lightbox.origin} onClose={() => setLightbox(null)} />
      )}

      {question && (
        <ReportErrorDialog questionId={question.id} open={showReportDialog} onOpenChange={setShowReportDialog} />
      )}
    </div>
  );
}

/* ───────── Elementy pomocnicze ───────── */

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

function Summary({
  modeLabel,
  correct,
  total,
  timeMs,
  message,
  onRetryWrong,
  onBack,
}: {
  modeLabel: string;
  correct: number;
  total: number;
  timeMs: number;
  message: string;
  onRetryWrong?: () => void;
  onBack: () => void;
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
        <p className="lead">{message}</p>

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

        <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row">
          {onRetryWrong && (
            <Button onClick={onRetryWrong} data-testid="retry-wrong">
              Powtórz błędne
            </Button>
          )}
          <Button variant={onRetryWrong ? "outline" : "default"} onClick={onBack} data-testid="exit-exam">
            Wróć do kursu
          </Button>
        </div>
      </motion.section>
    </div>
  );
}
