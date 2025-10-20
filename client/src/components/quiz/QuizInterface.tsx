import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Bookmark, X, AlertTriangle } from "lucide-react";
import QuestionCard from "./QuestionCard";
import ImageLightbox from "./ImageLightbox";
import ReportErrorDialog from "./ReportErrorDialog";
import type { QuizQuestion, QuizResult } from "@/types";

interface QuizInterfaceProps {
  sectionId?: string;
  mode?: "learn" | "review" | "exam";
  examQuestionCount?: number;
  onExit?: () => void;
}

export default function QuizInterface({ sectionId, mode = "learn", examQuestionCount, onExit }: QuizInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [examSessionId, setExamSessionId] = useState<string | null>(null);
  const [examTotalQuestions, setExamTotalQuestions] = useState<number>(0);
  const [examFinished, setExamFinished] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  // Initialize exam session
  useEffect(() => {
    if (mode === "exam" && examQuestionCount && !examSessionId) {
      const initExam = async () => {
        try {
          const response = await apiRequest("POST", "/api/exam/initialize", { count: examQuestionCount });
          const data = await response.json() as { sessionId: string; totalQuestions: number };
          setExamSessionId(data.sessionId);
          setExamTotalQuestions(data.totalQuestions);
        } catch (error: any) {
          toast({
            title: "Błąd",
            description: error.message || "Nie udało się zainicjalizować egzaminu",
            variant: "destructive",
          });
        }
      };
      initExam();
    }
  }, [mode, examQuestionCount, examSessionId, toast]);

  // Fetch current question
  const { data: question, isLoading: questionLoading } = useQuery({
    queryKey: mode === "exam" 
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
    enabled: mode === "exam" ? !!examSessionId : (mode === "review" || !!sectionId),
  });

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async (data: { questionId: string; selectedIndex: number; timeMs: number; sessionId?: string }) => {
      if (mode === "exam" && examSessionId) {
        const response = await apiRequest("POST", "/api/exam/answer", {
          sessionId: examSessionId,
          questionId: data.questionId,
          selectedIndex: data.selectedIndex,
          timeMs: data.timeMs
        });
        return response.json() as Promise<QuizResult>;
      } else {
        const response = await apiRequest("POST", "/api/quiz/answer", {
          questionId: data.questionId,
          selectedIndex: data.selectedIndex,
          timeMs: data.timeMs,
          mode
        });
        return response.json() as Promise<QuizResult>;
      }
    },
    onSuccess: (result) => {
      setShowExplanation(true);

      // Invalidate progress queries (not for exam mode)
      if (mode !== "exam") {
        queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać odpowiedzi",
        variant: "destructive",
      });
    },
  });

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null || submitAnswerMutation.isPending) return;

    setSelectedAnswer(answerIndex);
    const timeMs = Date.now() - startTime;

    if (question) {
      submitAnswerMutation.mutate({
        questionId: question.id,
        selectedIndex: answerIndex,
        timeMs,
      });
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    
    // Check if exam is finished
    if (mode === "exam" && nextIndex >= examTotalQuestions) {
      setExamFinished(true);
      return;
    }
    
    setCurrentQuestionIndex(nextIndex);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setStartTime(Date.now());
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setStartTime(Date.now());
    }
  };

  const handleMarkForReview = async () => {
    // TODO: Implement mark for review functionality
    toast({
      title: "Oznaczono do powtórki",
      description: "Pytanie zostało dodane do listy powtórek",
    });
  };

  const handleExit = () => {
    if (confirm(t("quiz.confirmExit"))) {
      onExit?.();
    }
  };

  const openLightbox = (imageUrl: string) => {
    setLightboxImage(imageUrl);
  };

  useEffect(() => {
    setStartTime(Date.now());
  }, [question]);

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

  // Show exam summary
  if (examFinished && examSummary) {
    const successRate = (examSummary.correctAnswers / examSummary.totalQuestions) * 100;
    const passed = successRate >= 70;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-card rounded-lg border border-border p-4 sm:p-6 lg:p-8 text-center">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
              passed ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
            }`}>
              <span className="text-4xl sm:text-5xl font-bold">{Math.round(successRate)}%</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {passed ? "Gratulacje!" : "Egzamin niezaliczony"}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
              {passed 
                ? "Udało Ci się zaliczyć egzamin próbny!" 
                : "Niestety nie udało się osiągnąć wymaganego progu 70%."}
            </p>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                  {examSummary.totalQuestions}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Pytań</div>
              </div>
              <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                <div className="text-2xl sm:text-3xl font-bold text-green-500 mb-1">
                  {examSummary.correctAnswers}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Poprawnych</div>
              </div>
              <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                <div className="text-2xl sm:text-3xl font-bold text-red-500 mb-1">
                  {examSummary.totalQuestions - examSummary.correctAnswers}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Błędnych</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button onClick={onExit} variant="outline" className="w-full sm:w-auto" data-testid="exit-exam">
                Wróć do panelu
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto"
                data-testid="retry-exam"
              >
                Spróbuj ponownie
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (questionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Brak dostępnych pytań</h2>
          <p className="text-muted-foreground mb-6">Nie znaleziono pytań dla tej sekcji</p>
          <Button onClick={onExit} data-testid="back-to-dashboard">
            Wróć do panelu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Quiz Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExit}
                data-testid="exit-quiz"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-foreground">Moduł EKG</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("quiz.question")} {currentQuestionIndex + 1}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="w-24 sm:w-32 lg:w-48 h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ 
                    width: `${mode === "exam" && examTotalQuestions > 0 
                      ? ((currentQuestionIndex + 1) / examTotalQuestions) * 100 
                      : ((currentQuestionIndex + 1) / 10) * 100}%` 
                  }}
                />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground font-mono">
                {mode === "exam" && examTotalQuestions > 0 
                  ? `${currentQuestionIndex + 1}/${examTotalQuestions}`
                  : `${Math.round(((currentQuestionIndex + 1) / 10) * 100)}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <QuestionCard
          question={question}
          selectedAnswer={selectedAnswer}
          showExplanation={showExplanation}
          quizResult={submitAnswerMutation.data}
          onAnswerSelect={handleAnswerSelect}
          onImageClick={openLightbox}
          isSubmitting={submitAnswerMutation.isPending}
        />

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6 sm:mt-8 gap-2">
          <Button
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            data-testid="previous-question"
            size="sm"
            className="h-11 sm:h-auto min-w-[44px]"
            aria-label={t("quiz.previousQuestion")}
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("quiz.previousQuestion")}</span>
          </Button>

          <div className="flex items-center gap-2 sm:space-x-4">
            <Button
              variant="outline"
              onClick={handleMarkForReview}
              data-testid="mark-for-review"
              size="sm"
              className="h-11 sm:h-auto min-w-[44px]"
              aria-label={t("quiz.markForReview")}
            >
              <Bookmark className="h-4 w-4 sm:mr-2" />
              <span className="hidden md:inline">{t("quiz.markForReview")}</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowReportDialog(true)}
              data-testid="report-error-button"
              size="sm"
              className="h-11 sm:h-auto min-w-[44px]"
              aria-label="Zgłoś błąd"
            >
              <AlertTriangle className="h-4 w-4 sm:mr-2" />
              <span className="hidden md:inline">Zgłoś błąd</span>
            </Button>

            {showExplanation && (
              <Button
                onClick={handleNextQuestion}
                data-testid="next-question"
                size="sm"
                className="h-11 sm:h-auto min-w-[44px]"
                aria-label={t("quiz.nextQuestion")}
              >
                <span className="hidden sm:inline">{t("quiz.nextQuestion")}</span>
                <ArrowRight className="h-4 w-4 sm:ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Report Error Dialog */}
      {question && (
        <ReportErrorDialog
          questionId={question.id}
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
        />
      )}
    </div>
  );
}
