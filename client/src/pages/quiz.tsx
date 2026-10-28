import { useEffect, useMemo, useState } from "react";
import OrderHint from "@/components/course/OrderHint";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { plural, pytania } from "@/lib/i18n";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import QuizInterface from "@/components/quiz/QuizInterface";
import { Button } from "@/components/ui/button";
import ExamCountDialog, { isExamCount } from "@/components/dashboard/ExamCountDialog";
import { rise, stagger } from "@/lib/motion";

type Mode = "learn" | "review" | "exam";

interface CourseModule {
  id: string;
  order: number;
  sections: Array<{ id: string }>;
}

/** Sesja powtórki ma najwyżej tyle pytań (QuizInterface → SESSION_LENGTH) */
const REVIEW_SESSION = 10;

export default function Quiz() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAuthenticated } = useAuth();

  // Adres jest jedynym źródłem prawdy o tym, co się teraz dzieje:
  //   /quiz?sectionId=X            → pytania tematu (stary parametr ?section= też działa) — część Kursu
  //   /quiz, /quiz?mode=review     → ekran Powtórki: ile pytań czeka + „Zacznij powtórkę”
  //   /quiz?mode=review&start=1    → sesja powtórki (kolejka błędnych)
  //   /quiz?mode=review&ids=…      → sesja powtórki tylko tych pytań (np. błędne z ostatniej sesji)
  //   /quiz?mode=exam              → ekran Powtórki z otwartym wyborem liczby pytań egzaminu
  //   /quiz?mode=exam&count=N      → egzamin próbny
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const urlMode = params.get("mode");
  const sectionId = params.get("sectionId") ?? params.get("section");
  const reviewIds = useMemo(() => {
    const raw = params.get("ids");
    const ids = raw ? raw.split(",").map((x) => x.trim()).filter(Boolean) : [];
    return ids.length ? Array.from(new Set(ids)).slice(0, 50) : undefined;
  }, [params]);
  const startReview = params.get("start") === "1";
  const countParam = Number(params.get("count"));
  const examCount = isExamCount(countParam) ? countParam : null;

  const runningMode: Mode | null = sectionId
    ? "learn"
    : urlMode === "review" && (reviewIds || startReview)
      ? "review"
      : urlMode === "exam" && examCount
        ? "exam"
        : null;

  const [showExamDialog, setShowExamDialog] = useState(urlMode === "exam" && !examCount);

  // Zmiana adresu przy otwartym ekranie (np. „Egzamin próbny” gdzie indziej) — dialog idzie za nim
  useEffect(() => {
    if (urlMode === "exam" && !examCount) setShowExamDialog(true);
  }, [urlMode, examCount]);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);

  const { data: modules } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json() as Promise<CourseModule[]>;
    },
    enabled: isAuthenticated && runningMode === "learn",
  });

  const {
    data: reviewQueue,
    isLoading: reviewLoading,
    isError: reviewError,
    refetch: refetchQueue,
  } = useQuery({
    queryKey: ["/api/review-queue"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/review-queue");
      return response.json() as Promise<{ questionIds?: string[] }>;
    },
    enabled: isAuthenticated && !runningMode,
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (!isAuthenticated) return null;

  if (runningMode) {
    const moduleId = sectionId ? modules?.find((m) => m.sections.some((s) => s.id === sectionId))?.id : undefined;
    return (
      <>
      {runningMode === "learn" && sectionId && (
        <div className="wrap wrap--narrow pt-6">
          <OrderHint sectionId={sectionId} />
        </div>
      )}
      <QuizInterface
        key={`${runningMode}-${sectionId ?? ""}-${examCount ?? ""}-${reviewIds?.join(",") ?? ""}`}
        sectionId={runningMode === "learn" ? sectionId || undefined : undefined}
        mode={runningMode}
        examQuestionCount={runningMode === "exam" ? examCount ?? undefined : undefined}
        reviewIds={runningMode === "review" ? reviewIds : undefined}
        // Nazwy przycisków wyjścia w QuizInterface: temat → „Wróć do kursu”, reszta → „Wróć do postępu”
        onExit={() => setLocation(runningMode === "learn" ? (moduleId ? `/modules#m-${moduleId}` : "/modules") : "/dashboard")}
      />
      </>
    );
  }

  const queueSize = reviewQueue?.questionIds?.length ?? 0;

  const setExamDialog = (open: boolean) => {
    setShowExamDialog(open);
    // Zamknięty wybór egzaminu: adres wraca do Powtórki (odświeżenie nie otworzy dialogu znowu)
    if (!open && urlMode === "exam") setLocation("/quiz?mode=review", { replace: true });
  };

  return (
    <motion.div className="wrap wrap--narrow pt-12 pb-24 sm:pt-16" variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.header className="grid gap-4 mb-10" variants={rise}>
        <p className="label">Pytania</p>
        <h1 className="h1">Powtórka</h1>
        <p className="lead">
          Wracają tu pytania, w których ostatnia odpowiedź była błędna. Dobra odpowiedź zdejmuje pytanie z powtórki.
        </p>
      </motion.header>

      <motion.section
        variants={rise}
        className="border-t border-[var(--line)] pt-8 grid gap-6 justify-items-start"
        aria-label="Kolejka powtórki"
        aria-busy={reviewLoading || undefined}
      >
        {reviewLoading ? (
          <LoadingSpinner size="lg" />
        ) : reviewError ? (
          <>
            <p className="muted">Nie udało się sprawdzić kolejki powtórki. Sprawdź połączenie i spróbuj jeszcze raz.</p>
            <Button variant="outline" onClick={() => refetchQueue()} data-testid="button-retry-queue">
              Spróbuj ponownie
            </Button>
          </>
        ) : queueSize > 0 ? (
          <>
            <div className="grid gap-1">
              <p className="num text-[clamp(2.5rem,2rem+2vw,3.5rem)] leading-none text-[var(--txt)]" data-testid="review-count">
                {queueSize}
              </p>
              <p className="muted">
                {plural(queueSize, "pytanie czeka", "pytania czekają", "pytań czeka")} na powtórkę
                {queueSize > REVIEW_SESSION && ` · jedna sesja to ${pytania(REVIEW_SESSION)}`}
              </p>
            </div>
            <Button onClick={() => setLocation("/quiz?mode=review&start=1")} data-testid="button-start-review">
              Zacznij powtórkę
              <ArrowRight aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <p className="muted max-w-[34em]" data-testid="review-empty">
              Nic do powtórki. Wszystkie błędne pytania już poprawione.
            </p>
            <Button variant="outline" onClick={() => setLocation("/modules")} data-testid="button-switch-to-learn">
              Przejdź do kursu
            </Button>
          </>
        )}
      </motion.section>

      {/* Egzamin — poziom niżej: rzadszy cel niż codzienna powtórka */}
      <motion.section
        variants={rise}
        className="mt-16 border-t border-[var(--line)] pt-8 grid gap-4 justify-items-start"
        aria-labelledby="exam-title"
      >
        <h2 id="exam-title" className="h3">Egzamin próbny</h2>
        <p className="muted max-w-[34em]">
          Losowe pytania z całego kursu. W trakcie nie widzisz, czy odpowiedź jest dobra. Wynik i wyjaśnienia dostajesz na końcu.
        </p>
        <Button variant="outline" onClick={() => setExamDialog(true)} data-testid="button-open-exam">
          Rozpocznij egzamin próbny
        </Button>
      </motion.section>

      <ExamCountDialog open={showExamDialog} onOpenChange={setExamDialog} />
    </motion.div>
  );
}
