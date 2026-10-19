import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import QuizInterface from "@/components/quiz/QuizInterface";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProgressLine } from "@/components/dashboard/ProgressCard";
import { rise, stagger } from "@/lib/motion";

type Mode = "learn" | "review" | "exam";
type ExamCount = 10 | 20 | 40;
const EXAM_COUNTS: ExamCount[] = [10, 20, 40];

interface CourseSection {
  id: string;
  title: string;
  order: number;
  isLocked?: boolean;
  completionPercentage: number;
  /** Opublikowane pytania w sekcji (brak pola = starszy serwer, traktujemy jak „są”) */
  questionCount?: number;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
  isLocked?: boolean;
  completionPercentage: number;
  sections: CourseSection[];
}

const pad = (n: number) => String(n).padStart(2, "0");
function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

const cleanTitle = (title: string) => title.replace(/^\s*moduł\s*\d+\s*[:.–—-]\s*/i, "");

const MODE_COPY: Record<Mode, { label: string; lead: string }> = {
  learn: {
    label: "Nauka",
    lead: "Wybierz temat. Po każdej odpowiedzi od razu zobaczysz, czy masz rację, i dlaczego.",
  },
  review: {
    label: "Powtórka",
    lead: "Wracasz do pytań, które wcześniej sprawiły ci trudność — aż zaczną wchodzić same.",
  },
  exam: {
    label: "Egzamin",
    lead: "Losowe pytania z całego kursu, jak na egzaminie. Wynik zobaczysz na końcu.",
  },
};

export default function Quiz() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAuthenticated } = useAuth();

  // Adres jest jedynym źródłem prawdy o tym, co się teraz dzieje:
  //   /quiz?sectionId=X        → quiz tej sekcji (stary parametr ?section= też działa)
  //   /quiz?mode=review        → powtórka
  //   /quiz?mode=exam          → wybór liczby pytań, potem /quiz?mode=exam&count=N
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const urlMode = params.get("mode");
  const sectionId = params.get("sectionId") ?? params.get("section");
  const countParam = Number(params.get("count"));
  const examCount = EXAM_COUNTS.includes(countParam as ExamCount) ? (countParam as ExamCount) : null;

  const runningMode: Mode | null =
    urlMode === "review" ? "review" : urlMode === "exam" ? (examCount ? "exam" : null) : sectionId ? "learn" : null;

  const [pickerMode, setPickerMode] = useState<Mode>(urlMode === "exam" ? "exam" : urlMode === "review" ? "review" : "learn");
  const [showExamDialog, setShowExamDialog] = useState(urlMode === "exam" && !examCount);
  const [dialogCount, setDialogCount] = useState<ExamCount>(20);

  // Zmiana adresu przy otwartym ekranie (np. z nawigacji) — wybór trybu idzie za nim
  useEffect(() => {
    if (urlMode === "exam" && !examCount) {
      setPickerMode("exam");
      setShowExamDialog(true);
    }
  }, [urlMode, examCount]);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);

  const { data: modules, isLoading } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json() as Promise<CourseModule[]>;
    },
    enabled: isAuthenticated,
    refetchOnMount: "always",
  });

  const {
    data: reviewQueue,
    isLoading: reviewLoading,
    isError: reviewError,
  } = useQuery({
    queryKey: ["/api/review-queue"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/review-queue");
      return response.json() as Promise<{ questionIds?: string[] }>;
    },
    enabled: isAuthenticated && pickerMode === "review" && !runningMode,
    staleTime: 0,
  });

  const sorted = useMemo(
    () =>
      (modules ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((m) => ({ ...m, sections: m.sections.slice().sort((a, b) => a.order - b.order) })),
    [modules],
  );

  // W wyborze tematu tylko sekcje, w których naprawdę są pytania
  const withQuestions = useMemo(
    () =>
      sorted
        .map((m, mi) => ({
          ...m,
          no: mi + 1,
          sections: m.sections.filter((s) => s.questionCount === undefined || s.questionCount > 0),
        }))
        .filter((m) => m.sections.length > 0),
    [sorted],
  );

  if (!isAuthenticated) return null;

  if (runningMode) {
    const moduleId = sectionId ? sorted.find((m) => m.sections.some((s) => s.id === sectionId))?.id : undefined;
    return (
      <QuizInterface
        key={`${runningMode}-${sectionId ?? ""}-${examCount ?? ""}`}
        sectionId={runningMode === "learn" ? sectionId || undefined : undefined}
        mode={runningMode}
        examQuestionCount={runningMode === "exam" ? examCount ?? undefined : undefined}
        onExit={() => {
          if (runningMode === "learn") setLocation(moduleId ? `/modules#m-${moduleId}` : "/modules");
          else setLocation("/dashboard");
        }}
      />
    );
  }

  const chooseMode = (mode: Mode) => {
    setPickerMode(mode);
    if (mode === "exam") setShowExamDialog(true);
    // Adres bez parametrów — odświeżenie nie uruchomi niczego samo
    if (search) setLocation("/quiz", { replace: true });
  };

  const queueSize = reviewQueue?.questionIds?.length ?? 0;

  return (
    <div className="wrap wrap--narrow pt-12 pb-24 sm:pt-16">
      <header className="grid gap-4 mb-8">
        <p className="label">Pytania</p>
        <h1 className="h1">Sprawdź się</h1>
        <p className="lead">{MODE_COPY[pickerMode].lead}</p>
      </header>

      <div className="chips mb-10" role="group" aria-label="Tryb pytań">
        {(Object.keys(MODE_COPY) as Mode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className="chip min-h-[44px]"
            aria-pressed={pickerMode === mode}
            onClick={() => chooseMode(mode)}
            data-testid={`quiz-mode-${mode}`}
          >
            {MODE_COPY[mode].label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={pickerMode} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.12 } }} variants={rise}>
          {pickerMode === "learn" &&
            (isLoading ? (
              <div className="min-h-[30vh] grid place-items-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : withQuestions.length === 0 ? (
              <p className="muted border-t border-[var(--line)] pt-8">Nie masz jeszcze dostępu do żadnego tematu.</p>
            ) : (
              <motion.div className="grid gap-12" variants={stagger(0.04)} initial="hidden" animate="show">
                {withQuestions.map((module) => (
                  <motion.section key={module.id} variants={rise} aria-labelledby={`qm-${module.id}`}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="grid gap-1 min-w-0">
                        <span className="label label--g">Moduł {pad(module.no)}</span>
                        <h2 id={`qm-${module.id}`} className="h3">
                          {cleanTitle(module.title)}
                        </h2>
                      </div>
                    </div>
                    <ul className="rows">
                      {module.sections.map((section, si) => {
                        const pct = Math.round(section.completionPercentage || 0);
                        const locked = Boolean(module.isLocked || (section.isLocked && pct < 100));
                        const content = (
                          <>
                            <span className="row__n">
                              {pct >= 100 ? (
                                <span className="inline-flex text-[var(--puls)]">
                                  <Check className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">Ukończone</span>
                                </span>
                              ) : (
                                pad(si + 1)
                              )}
                            </span>
                            <span className="row__t gap-2">
                              <b className="!text-[1.0625rem] sm:!text-[1.1875rem] !leading-snug">{section.title}</b>
                              <span className="!text-[14px]">
                                {locked ? (
                                  "Zablokowane — ukończ poprzedni temat"
                                ) : (
                                  <>
                                    {section.questionCount !== undefined && (
                                      <>
                                        {section.questionCount} {plural(section.questionCount, "pytanie", "pytania", "pytań")}
                                        <span aria-hidden="true"> · </span>
                                      </>
                                    )}
                                    <span className="num">{pct}%</span>
                                  </>
                                )}
                              </span>
                              {!locked && <ProgressLine value={pct} label={`Postęp: ${section.title}`} className="max-w-[260px]" />}
                            </span>
                            <span />
                            <ChevronRight className="h-4 w-4 text-[var(--txt3)] transition-colors group-hover:text-[var(--txt)]" aria-hidden="true" />
                          </>
                        );
                        return (
                          <li key={section.id} className="contents">
                            {locked ? (
                              <div className="row py-4 sm:py-5 opacity-50" aria-disabled="true">
                                {content}
                              </div>
                            ) : (
                              <Link
                                href={`/quiz?sectionId=${section.id}`}
                                className="row group py-4 sm:py-5"
                                data-testid={`section-${section.id}`}
                              >
                                {content}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </motion.section>
                ))}
              </motion.div>
            ))}

          {pickerMode === "review" && (
            <section className="border-t border-[var(--line)] pt-8 grid gap-6 justify-items-start" aria-label="Powtórka">
              {reviewLoading ? (
                <LoadingSpinner size="lg" />
              ) : reviewError ? (
                <p className="muted">Nie udało się sprawdzić kolejki powtórek. Odśwież stronę i spróbuj jeszcze raz.</p>
              ) : queueSize > 0 ? (
                <>
                  <div className="grid gap-1">
                    <p className="num text-[clamp(2.5rem,2rem+2vw,3.5rem)] leading-none text-[var(--txt)]" data-testid="review-count">
                      {queueSize}
                    </p>
                    <p className="muted">
                      {queueSize === 1 ? "pytanie czeka" : "pytań czeka"} na powtórkę
                    </p>
                  </div>
                  <Button onClick={() => setLocation("/quiz?mode=review")} data-testid="button-start-review">
                    Zacznij powtórkę
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="muted max-w-[34em]">
                    Nie masz pytań do powtórki. Każde pytanie, na które odpowiesz źle, trafi tutaj.
                  </p>
                  <Button variant="outline" onClick={() => chooseMode("learn")} data-testid="button-switch-to-learn">
                    Wybierz temat
                  </Button>
                </>
              )}
            </section>
          )}

          {pickerMode === "exam" && (
            <section className="border-t border-[var(--line)] pt-8 grid gap-6 justify-items-start" aria-label="Egzamin próbny">
              <p className="muted max-w-[34em]">
                Wybierz, ile pytań chcesz rozwiązać: 10 to szybki sprawdzian, 40 to pełna próba.
              </p>
              <Button onClick={() => setShowExamDialog(true)} data-testid="button-open-exam">
                Wybierz liczbę pytań
              </Button>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <Dialog open={showExamDialog} onOpenChange={setShowExamDialog}>
        <DialogContent data-testid="exam-dialog">
          <DialogHeader>
            <DialogTitle>Egzamin próbny</DialogTitle>
            <DialogDescription>Pytania losujemy z całego kursu. Ile chcesz rozwiązać?</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 my-2" role="group" aria-label="Liczba pytań">
            {EXAM_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                className="chip justify-center min-h-[64px] flex-col gap-1"
                aria-pressed={dialogCount === count}
                onClick={() => setDialogCount(count)}
                data-testid={`exam-count-${count}`}
              >
                <span className="num text-[1.5rem] leading-none text-[var(--txt)]">{count}</span>
                <span className="text-[12px]">pytań</span>
              </button>
            ))}
          </div>

          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setShowExamDialog(false)} data-testid="exam-cancel">
              Anuluj
            </Button>
            <Button
              onClick={() => {
                setShowExamDialog(false);
                setLocation(`/quiz?mode=exam&count=${dialogCount}`);
              }}
              data-testid="exam-start"
            >
              Rozpocznij egzamin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
