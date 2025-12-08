import { useState, useEffect, useRef } from "react";
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
import type { QuizQuestion, QuizResult, AnswerData } from "@/types";

interface QuizInterfaceProps {
  sectionId?: string;
  mode?: "learn" | "review" | "exam";
  examQuestionCount?: number;
  onExit?: () => void;
}

export default function QuizInterface({ sectionId, mode = "learn", examQuestionCount, onExit }: QuizInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [currentAnswerData, setCurrentAnswerData] = useState<AnswerData | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [startTime, setStartTime] = useState(Date.now());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [examSessionId, setExamSessionId] = useState<string | null>(null);
  const [examTotalQuestions, setExamTotalQuestions] = useState<number>(0);
  const [examFinished, setExamFinished] = useState(false);
  const quizContentRef = useRef<HTMLDivElement>(null);
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
    mutationFn: async (data: { questionId: string; selectedIndex: number; timeMs: number; sessionId?: string; answerData?: AnswerData }) => {
      if (mode === "exam" && examSessionId) {
        const response = await apiRequest("POST", "/api/exam/answer", {
          sessionId: examSessionId,
          questionId: data.questionId,
          selectedIndex: data.selectedIndex,
          timeMs: data.timeMs,
          answerData: data.answerData
        });
        return response.json() as Promise<QuizResult>;
      } else {
        const response = await apiRequest("POST", "/api/quiz/answer", {
          questionId: data.questionId,
          selectedIndex: data.selectedIndex,
          timeMs: data.timeMs,
          mode,
          answerData: data.answerData
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
      const optimisticResult: QuizResult = {
        isCorrect: answerIndex === question.correctIndex,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        timeMs,
      };
      
      setQuizResult(optimisticResult);
      setShowExplanation(true);

      submitAnswerMutation.mutate({
        questionId: question.id,
        selectedIndex: answerIndex,
        timeMs,
      });
    }
  };

  const handleAnswerChange = (answerData: AnswerData) => {
    setCurrentAnswerData(answerData);
  };

  const handleSubmitInteractiveAnswer = () => {
    if (!question || !currentAnswerData || submitAnswerMutation.isPending) return;

    const timeMs = Date.now() - startTime;
    setShowExplanation(true);

    submitAnswerMutation.mutate({
      questionId: question.id,
      selectedIndex: -1,
      timeMs,
      answerData: currentAnswerData,
    });
  };

  const scrollToTop = () => {
    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    });
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
    setCurrentAnswerData(null);
    setShowExplanation(false);
    setQuizResult(null);
    setStartTime(Date.now());
    
    setTimeout(scrollToTop, 100);
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setSelectedAnswer(null);
      setCurrentAnswerData(null);
      setShowExplanation(false);
      setQuizResult(null);
      setStartTime(Date.now());
      
      setTimeout(scrollToTop, 100);
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4 safe-bottom">
        <div className="max-w-2xl w-full">
          <div className="glass-card-light dark:glass-card rounded-2xl shadow-app-lg p-5 sm:p-6 lg:p-8 text-center motion-safe:animate-slide-up">
            <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl mx-auto mb-6 flex items-center justify-center ${
              passed ? "bg-green-500/15 text-green-500 shadow-glow-success" : "bg-red-500/15 text-red-500"
            }`}>
              <span className="text-4xl sm:text-5xl font-bold">{Math.round(successRate)}%</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              {passed ? "Gratulacje!" : "Egzamin niezaliczony"}
            </h2>
            <p className="text-base text-muted-foreground mb-6 sm:mb-8">
              {passed 
                ? "Udało Ci się zaliczyć egzamin próbny!" 
                : "Niestety nie udało się osiągnąć wymaganego progu 70%."}
            </p>

            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="glass-card-light dark:glass-card p-4 sm:p-5 rounded-2xl shadow-app">
                <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                  {examSummary.totalQuestions}
                </div>
                <div className="text-sm text-muted-foreground">Pytań</div>
              </div>
              <div className="stat-card-teal p-4 sm:p-5 rounded-2xl shadow-app">
                <div className="text-2xl sm:text-3xl font-bold text-green-500 mb-1">
                  {examSummary.correctAnswers}
                </div>
                <div className="text-sm text-muted-foreground">Poprawnych</div>
              </div>
              <div className="glass-card-light dark:glass-card p-4 sm:p-5 rounded-2xl shadow-app border-red-500/30">
                <div className="text-2xl sm:text-3xl font-bold text-red-500 mb-1">
                  {examSummary.totalQuestions - examSummary.correctAnswers}
                </div>
                <div className="text-sm text-muted-foreground">Błędnych</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button 
                onClick={onExit} 
                variant="outline" 
                className="w-full sm:w-auto min-h-[48px] rounded-xl active:scale-[0.97] motion-safe:transition-transform" 
                data-testid="exit-exam"
              >
                Wróć do panelu
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto min-h-[48px] rounded-xl shadow-glow-primary active:scale-[0.97] motion-safe:transition-transform"
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
      {/* Quiz Header - Premium glass styling */}
      <div className="sticky top-0 z-40 glass-card-light dark:glass-card shadow-app safe-top">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={handleExit}
                data-testid="exit-quiz"
                className="min-h-[44px] min-w-[44px] rounded-xl active:scale-[0.97] motion-safe:transition-transform"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-base font-semibold text-foreground">Moduł EKG</h2>
                <p className="text-sm text-muted-foreground">
                  {t("quiz.question")} {currentQuestionIndex + 1}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-20 sm:w-32 lg:w-48 h-2.5 bg-secondary/50 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full motion-safe:transition-all motion-safe:duration-300"
                  style={{ 
                    width: `${mode === "exam" && examTotalQuestions > 0 
                      ? ((currentQuestionIndex + 1) / examTotalQuestions) * 100 
                      : ((currentQuestionIndex + 1) / 10) * 100}%` 
                  }}
                />
              </div>
              <span className="text-sm text-muted-foreground font-mono min-w-[3rem] text-right">
                {mode === "exam" && examTotalQuestions > 0 
                  ? `${currentQuestionIndex + 1}/${examTotalQuestions}`
                  : `${Math.round(((currentQuestionIndex + 1) / 10) * 100)}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Content */}
      <div ref={quizContentRef} className="max-w-4xl mx-auto px-4 py-5 sm:py-8 safe-bottom">
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

        {/* Submit button for interactive question types */}
        {question.questionType && question.questionType !== 'multiple_choice' && question.questionConfig && !showExplanation && (
          <div className="mt-5 sm:mt-6 flex justify-center">
            <Button
              onClick={handleSubmitInteractiveAnswer}
              disabled={!currentAnswerData || submitAnswerMutation.isPending}
              className="w-full sm:w-auto min-w-[200px] min-h-[52px] rounded-xl text-base font-semibold shadow-glow-primary active:scale-[0.97] motion-safe:transition-transform"
              size="lg"
              data-testid="submit-interactive-answer"
            >
              {submitAnswerMutation.isPending ? "Sprawdzam..." : "Sprawdź odpowiedź"}
            </Button>
          </div>
        )}

        {/* Navigation - Premium touch-friendly buttons */}
        <div className="flex justify-between items-center mt-6 sm:mt-8 gap-3">
          <Button
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            data-testid="previous-question"
            className="min-h-[48px] px-4 min-w-[48px] rounded-xl active:scale-[0.97] motion-safe:transition-transform shadow-app"
            aria-label={t("quiz.previousQuestion")}
          >
            <ArrowLeft className="h-5 w-5 sm:mr-2" />
            <span className="hidden sm:inline text-base">{t("quiz.previousQuestion")}</span>
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleMarkForReview}
              data-testid="mark-for-review"
              className="min-h-[48px] px-4 min-w-[48px] rounded-xl active:scale-[0.97] motion-safe:transition-transform shadow-app"
              aria-label={t("quiz.markForReview")}
            >
              <Bookmark className="h-5 w-5 md:mr-2" />
              <span className="hidden md:inline text-base">{t("quiz.markForReview")}</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowReportDialog(true)}
              data-testid="report-error-button"
              className="min-h-[48px] px-4 min-w-[48px] rounded-xl active:scale-[0.97] motion-safe:transition-transform shadow-app"
              aria-label="Zgłoś błąd"
            >
              <AlertTriangle className="h-5 w-5 md:mr-2" />
              <span className="hidden md:inline text-base">Zgłoś błąd</span>
            </Button>

            {showExplanation && (
              <Button
                onClick={handleNextQuestion}
                data-testid="next-question"
                className="min-h-[48px] px-4 min-w-[48px] rounded-xl shadow-glow-primary active:scale-[0.97] motion-safe:transition-transform"
                aria-label={t("quiz.nextQuestion")}
              >
                <span className="hidden sm:inline text-base">{t("quiz.nextQuestion")}</span>
                <ArrowRight className="h-5 w-5 sm:ml-2" />
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
