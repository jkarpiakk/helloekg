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
  onExit?: () => void;
}

export default function QuizInterface({ sectionId, mode = "learn", onExit }: QuizInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch current question
  const { data: question, isLoading: questionLoading } = useQuery({
    queryKey: ["/api/quiz/question", sectionId, mode, currentQuestionIndex],
    queryFn: async () => {
      const url = mode === "review" 
        ? `/api/quiz/question?mode=${mode}`
        : `/api/quiz/question?sectionId=${sectionId}&mode=${mode}`;
      const response = await apiRequest("GET", url);
      return response.json() as Promise<QuizQuestion>;
    },
    enabled: mode === "review" || !!sectionId,
  });

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: async (data: { questionId: string; selectedIndex: number; timeMs: number; mode: string }) => {
      const response = await apiRequest("POST", "/api/quiz/answer", data);
      return response.json() as Promise<QuizResult>;
    },
    onSuccess: (result) => {
      setShowExplanation(true);
      if (result.isCorrect) {
        toast({
          title: t("quiz.correct"),
          description: "Świetna robota!",
          variant: "default",
        });
      }
      // Invalidate progress queries
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
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
        mode,
      });
    }
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex(prev => prev + 1);
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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExit}
                data-testid="exit-quiz"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="font-semibold text-foreground">Moduł EKG</h2>
                <p className="text-sm text-muted-foreground">
                  {t("quiz.question")} {currentQuestionIndex + 1}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-48 h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / 10) * 100}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground font-mono">
                {Math.round(((currentQuestionIndex + 1) / 10) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
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
        <div className="flex justify-between items-center mt-8">
          <Button
            variant="outline"
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            data-testid="previous-question"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("quiz.previousQuestion")}
          </Button>

          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={handleMarkForReview}
              data-testid="mark-for-review"
            >
              <Bookmark className="h-4 w-4 mr-2" />
              {t("quiz.markForReview")}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowReportDialog(true)}
              data-testid="report-error-button"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Zgłoś błąd
            </Button>

            {showExplanation && (
              <Button
                onClick={handleNextQuestion}
                data-testid="next-question"
              >
                {t("quiz.nextQuestion")}
                <ArrowRight className="h-4 w-4 ml-2" />
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
