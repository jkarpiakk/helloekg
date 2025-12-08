import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { sanitizeMarkdown, sanitizeHtml } from "@/lib/sanitize";
import { Check, X, ZoomIn, GripVertical, Type, Link2, ArrowUpDown, Target } from "lucide-react";
import type { QuizQuestion, QuizResult, AnswerData, QuestionType } from "@/types";
import { QuestionRenderer } from "./questions";

interface QuestionCardProps {
  question: QuizQuestion;
  selectedAnswer: number | null;
  showExplanation: boolean;
  quizResult?: QuizResult;
  onAnswerSelect: (index: number) => void;
  onAnswerChange?: (answer: AnswerData) => void;
  onImageClick: (imageUrl: string) => void;
  isSubmitting: boolean;
}

const questionTypeInfo: Record<QuestionType, { label: string; icon: JSX.Element; color: string }> = {
  multiple_choice: {
    label: "Wybór odpowiedzi",
    icon: <Type className="h-3 w-3" />,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  },
  drag_drop: {
    label: "Przeciągnij i upuść",
    icon: <GripVertical className="h-3 w-3" />,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
  },
  fill_blank: {
    label: "Uzupełnij luki",
    icon: <Type className="h-3 w-3" />,
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
  },
  matching: {
    label: "Dopasuj pary",
    icon: <Link2 className="h-3 w-3" />,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  sorting: {
    label: "Ułóż w kolejności",
    icon: <ArrowUpDown className="h-3 w-3" />,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
  },
  hotspot: {
    label: "Zaznacz na obrazku",
    icon: <Target className="h-3 w-3" />,
    color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200"
  }
};

export default function QuestionCard({
  question,
  selectedAnswer,
  showExplanation,
  quizResult,
  onAnswerSelect,
  onAnswerChange,
  onImageClick,
  isSubmitting,
}: QuestionCardProps) {
  const { t } = useTranslation();
  const questionType = question.questionType || 'multiple_choice';
  const isInteractiveType = questionType !== 'multiple_choice' && question.questionConfig;
  const typeInfo = questionTypeInfo[questionType];

  const getOptionClassName = (index: number): string => {
    const baseClass = "min-h-[52px] py-4 px-4 border-2 rounded-2xl cursor-pointer touch-manipulation flex items-center motion-safe:transition-all motion-safe:duration-200";
    
    if (!showExplanation) {
      if (selectedAnswer === index) {
        return `${baseClass} bg-white dark:bg-slate-800 border-primary ring-2 ring-primary ring-offset-2 shadow-app-lg text-slate-900 dark:text-white`;
      }
      return `${baseClass} bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-primary/50 hover:shadow-app-lg active:scale-[0.97] shadow-app text-slate-900 dark:text-white`;
    }

    if (selectedAnswer === index) {
      return quizResult?.isCorrect 
        ? `${baseClass} correct border-green-500 bg-green-500 text-white shadow-glow-success`
        : `${baseClass} incorrect border-red-500 bg-red-500 text-white shadow-lg shadow-red-500/30`;
    }

    if (quizResult && index === quizResult.correctIndex) {
      return `${baseClass} correct border-green-500 bg-green-500 text-white shadow-glow-success`;
    }

    return `${baseClass} border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 opacity-60`;
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      {/* Question Card - Premium glass styling */}
      <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-app-lg rounded-2xl overflow-hidden motion-safe:animate-slide-up border border-border/50 dark:border-slate-700/50">
        <CardContent className="p-5 sm:p-6 lg:p-8">
          <div className="mb-5 sm:mb-6 lg:mb-8">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-snug" data-testid="question-title">
                {question.title}
              </h3>
              {isInteractiveType && (
                <Badge 
                  variant="secondary" 
                  className={`flex items-center gap-1.5 text-sm shrink-0 rounded-xl px-3 py-1 ${typeInfo.color}`}
                >
                  {typeInfo.icon}
                  <span className="hidden sm:inline">{typeInfo.label}</span>
                </Badge>
              )}
            </div>
            
            {/* EKG Image - only for non-hotspot questions */}
            {question.imageUrl && questionType !== 'hotspot' && (
              <div 
                className="relative group cursor-pointer mb-5 sm:mb-6 touch-manipulation rounded-2xl overflow-hidden"
                onClick={() => onImageClick(question.imageUrl!)}
                data-testid="question-image"
              >
                <img
                  src={question.imageUrl}
                  alt="Zapis EKG"
                  className="w-full h-44 sm:h-52 md:h-60 lg:h-72 object-contain bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-border/50"
                />
                <div className="absolute inset-0 bg-black/0 active:bg-black/20 sm:group-hover:bg-black/10 motion-safe:transition-colors rounded-2xl flex items-center justify-center">
                  <div className="opacity-0 active:opacity-100 sm:group-hover:opacity-100 motion-safe:transition-opacity bg-black/80 text-white px-4 py-2.5 rounded-xl text-base pointer-events-none flex items-center gap-2">
                    <ZoomIn className="h-5 w-5" />
                    <span>Powiększ</span>
                  </div>
                </div>
              </div>
            )}

            {/* Question Body */}
            {question.bodyMd && (
              <div 
                className="prose prose-base prose-slate dark:prose-invert max-w-none mb-5 sm:mb-6 [&>p]:text-base [&>p]:leading-relaxed"
                dangerouslySetInnerHTML={sanitizeMarkdown(question.bodyMd)}
                data-testid="question-body"
              />
            )}
          </div>

          {/* Interactive Question Types */}
          {isInteractiveType && onAnswerChange && (
            <QuestionRenderer
              question={question}
              onAnswerChange={onAnswerChange}
              disabled={showExplanation}
              showResult={showExplanation}
              result={quizResult}
              onImageClick={onImageClick}
            />
          )}

          {/* Multiple Choice Answer Options - Premium touch targets */}
          {!isInteractiveType && (
            <div className="space-y-3" data-testid="answer-options">
              {question.answers.map((answer, index) => (
                <div
                  key={index}
                  className={getOptionClassName(index)}
                  onClick={() => !showExplanation && !isSubmitting && onAnswerSelect(index)}
                  data-testid={`answer-option-${index}`}
                >
                  <div className="flex items-center w-full">
                    <span className="font-bold text-base mr-3 w-7 shrink-0">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span className="text-base leading-snug">{answer.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explanation Panel - Premium mobile styling */}
      {showExplanation && quizResult && (
        <Card className={`shadow-app-lg border-2 overflow-hidden rounded-2xl motion-safe:animate-slide-up ${
          quizResult.isCorrect 
            ? 'border-green-500 bg-gradient-to-br from-green-50 via-white to-green-50/50 dark:from-green-950/20 dark:via-background dark:to-green-950/10' 
            : 'border-red-500 bg-gradient-to-br from-red-50 via-white to-red-50/50 dark:from-red-950/20 dark:via-background dark:to-red-950/10'
        }`} data-testid="explanation-panel">
          <div className={`h-1.5 w-full ${quizResult.isCorrect ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`} />
          <CardContent className="p-4 sm:p-5 md:p-7">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                quizResult.isCorrect 
                  ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-glow-success' 
                  : 'bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/30'
              }`}>
                {quizResult.isCorrect ? (
                  <Check className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white stroke-[3]" />
                ) : (
                  <X className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-white stroke-[3]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-lg sm:text-xl md:text-2xl font-extrabold mb-3 ${
                  quizResult.isCorrect 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-red-700 dark:text-red-400'
                }`} data-testid="result-title">
                  {quizResult.isCorrect ? t("quiz.correct") : t("quiz.incorrect")}
                </h4>
                <div 
                  className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl shadow-app border border-slate-200 dark:border-slate-600"
                  data-testid="explanation-content"
                >
                  <div 
                    className="prose prose-base sm:prose-lg max-w-none prose-slate dark:prose-invert [&>*]:text-slate-800 dark:[&>*]:text-slate-100 [&>p]:text-base [&>p]:sm:text-lg [&>p]:leading-relaxed [&>p]:font-medium [&>strong]:text-slate-900 dark:[&>strong]:text-white [&>strong]:font-bold"
                    dangerouslySetInnerHTML={sanitizeMarkdown(quizResult.explanation)}
                  />
                </div>
                <div className="mt-4 flex items-center flex-wrap gap-2">
                  <Badge variant="outline" className={`text-sm py-1.5 px-3 rounded-xl ${
                    quizResult.isCorrect 
                      ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400' 
                      : 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                  }`}>
                    ⏱️ {Math.round(quizResult.timeMs / 1000)}s
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
