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
    const baseClass = "quiz-option !min-h-[48px] py-3 px-4 sm:p-4 lg:p-6 border-2 rounded-xl cursor-pointer transition-all touch-manipulation flex items-center";
    
    if (!showExplanation) {
      return `${baseClass} border-border hover:shadow-lg hover:-translate-y-1`;
    }

    if (selectedAnswer === index) {
      return quizResult?.isCorrect 
        ? `${baseClass} correct border-green-500 bg-green-500 text-white`
        : `${baseClass} incorrect border-red-500 bg-red-500 text-white`;
    }

    if (quizResult && index === quizResult.correctIndex) {
      return `${baseClass} correct border-green-500 bg-green-500 text-white`;
    }

    return `${baseClass} neutral border-muted-foreground bg-muted-foreground text-white`;
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Question Card */}
      <Card className="shadow-lg">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground" data-testid="question-title">
                {question.title}
              </h3>
              {isInteractiveType && (
                <Badge 
                  variant="secondary" 
                  className={`flex items-center gap-1 text-xs shrink-0 ${typeInfo.color}`}
                >
                  {typeInfo.icon}
                  <span className="hidden sm:inline">{typeInfo.label}</span>
                </Badge>
              )}
            </div>
            
            {/* EKG Image - only for non-hotspot questions */}
            {question.imageUrl && questionType !== 'hotspot' && (
              <div 
                className="relative group cursor-pointer mb-4 sm:mb-6 touch-manipulation"
                onClick={() => onImageClick(question.imageUrl!)}
                data-testid="question-image"
              >
                <img
                  src={question.imageUrl}
                  alt="Zapis EKG"
                  className="w-full h-40 sm:h-48 md:h-56 lg:h-64 object-contain bg-slate-50 dark:bg-slate-900 rounded-lg border-2 border-border"
                />
                <div className="absolute inset-0 bg-black/0 active:bg-black/20 sm:group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                  <div className="opacity-0 active:opacity-100 sm:group-hover:opacity-100 transition-opacity bg-black/80 text-white px-4 py-2 sm:px-4 sm:py-2 rounded-lg text-base sm:text-base pointer-events-none">
                    <ZoomIn className="h-5 w-5 sm:h-4 sm:w-4 mr-2 inline" />
                    <span className="hidden sm:inline">{t("quiz.enlargeImage")}</span>
                    <span className="sm:hidden">Powiększ</span>
                  </div>
                </div>
              </div>
            )}

            {/* Question Body */}
            {question.bodyMd && (
              <div 
                className="prose prose-sm sm:prose prose-slate max-w-none mb-4 sm:mb-6"
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

          {/* Multiple Choice Answer Options */}
          {!isInteractiveType && (
            <div className="space-y-4" data-testid="answer-options">
              {question.answers.map((answer, index) => (
                <div
                  key={index}
                  className={getOptionClassName(index)}
                  onClick={() => !showExplanation && !isSubmitting && onAnswerSelect(index)}
                  data-testid={`answer-option-${index}`}
                >
                  <div className="flex items-center">
                    <span className="font-bold text-base sm:text-lg mr-2 sm:mr-4 w-6 sm:w-8">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span className="text-sm sm:text-base">{answer.text}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Explanation Panel */}
      {showExplanation && quizResult && (
        <Card className={`shadow-2xl border-2 overflow-hidden ${
          quizResult.isCorrect 
            ? 'border-green-500 bg-gradient-to-br from-green-50 via-white to-green-50/50 dark:from-green-950/20 dark:via-background dark:to-green-950/10' 
            : 'border-red-500 bg-gradient-to-br from-red-50 via-white to-red-50/50 dark:from-red-950/20 dark:via-background dark:to-red-950/10'
        }`} data-testid="explanation-panel">
          <div className={`h-1 sm:h-2 w-full ${quizResult.isCorrect ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`} />
          <CardContent className="p-2 sm:p-5 md:p-7">
            <div className="flex items-start space-x-2 sm:space-x-4 md:space-x-5">
              <div className={`w-8 h-8 sm:w-14 sm:h-14 md:w-18 md:h-18 rounded-md sm:rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                quizResult.isCorrect 
                  ? 'bg-gradient-to-br from-green-400 to-green-600' 
                  : 'bg-gradient-to-br from-red-400 to-red-600'
              }`}>
                {quizResult.isCorrect ? (
                  <Check className="h-4 w-4 sm:h-7 sm:w-7 md:h-9 md:w-9 text-white stroke-[3]" />
                ) : (
                  <X className="h-4 w-4 sm:h-7 sm:w-7 md:h-9 md:w-9 text-white stroke-[3]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-base sm:text-xl md:text-2xl font-extrabold mb-1.5 sm:mb-3 md:mb-4 ${
                  quizResult.isCorrect 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-red-700 dark:text-red-400'
                }`} data-testid="result-title">
                  {quizResult.isCorrect ? t("quiz.correct") : t("quiz.incorrect")}
                </h4>
                <div 
                  className="bg-white dark:bg-slate-900 p-2 sm:p-3.5 md:p-4.5 rounded sm:rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner"
                  data-testid="explanation-content"
                >
                  <div 
                    className="prose prose-sm sm:prose-base md:prose-lg max-w-none [&>p]:text-slate-900 [&>p]:dark:text-slate-100 [&>p]:text-xs [&>p]:sm:text-base [&>p]:md:text-lg [&>p]:leading-snug [&>p]:sm:leading-relaxed [&>p]:font-medium [&>ul]:text-slate-900 [&>ul]:dark:text-slate-100 [&>ul]:text-xs [&>ul]:sm:text-base [&>ul]:md:text-lg [&>ol]:text-slate-900 [&>ol]:dark:text-slate-100 [&>ol]:text-xs [&>ol]:sm:text-base [&>ol]:md:text-lg [&>h1]:text-slate-900 [&>h1]:dark:text-slate-100 [&>h2]:text-slate-900 [&>h2]:dark:text-slate-100 [&>h3]:text-slate-900 [&>h3]:dark:text-slate-100 [&>strong]:text-slate-900 [&>strong]:dark:text-slate-100"
                    dangerouslySetInnerHTML={sanitizeHtml(quizResult.explanation)}
                  />
                </div>
                <div className="mt-1.5 sm:mt-3 md:mt-4 flex items-center flex-wrap gap-1 sm:gap-2">
                  <Badge variant="outline" className={`text-xs sm:text-sm md:text-base py-0.5 sm:py-1.5 px-1.5 sm:px-3 ${
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
