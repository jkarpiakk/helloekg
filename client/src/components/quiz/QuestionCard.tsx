import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { sanitizeMarkdown, sanitizeHtml } from "@/lib/sanitize";
import { Check, X, ZoomIn } from "lucide-react";
import type { QuizQuestion, QuizResult } from "@/types";

interface QuestionCardProps {
  question: QuizQuestion;
  selectedAnswer: number | null;
  showExplanation: boolean;
  quizResult?: QuizResult;
  onAnswerSelect: (index: number) => void;
  onImageClick: (imageUrl: string) => void;
  isSubmitting: boolean;
}

export default function QuestionCard({
  question,
  selectedAnswer,
  showExplanation,
  quizResult,
  onAnswerSelect,
  onImageClick,
  isSubmitting,
}: QuestionCardProps) {
  const { t } = useTranslation();

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
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-4 sm:mb-6" data-testid="question-title">
              {question.title}
            </h3>
            
            {/* EKG Image */}
            {question.imageUrl && (
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

          {/* Answer Options */}
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
        </CardContent>
      </Card>

      {/* Explanation Panel */}
      {showExplanation && quizResult && (
        <Card className={`shadow-2xl border-2 overflow-hidden ${
          quizResult.isCorrect 
            ? 'border-green-500 bg-gradient-to-br from-green-50 via-white to-green-50/50 dark:from-green-950/20 dark:via-background dark:to-green-950/10' 
            : 'border-red-500 bg-gradient-to-br from-red-50 via-white to-red-50/50 dark:from-red-950/20 dark:via-background dark:to-red-950/10'
        }`} data-testid="explanation-panel">
          <div className={`h-2 w-full ${quizResult.isCorrect ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`} />
          <CardContent className="p-4 sm:p-6 md:p-8">
            <div className="flex items-start space-x-3 sm:space-x-4 md:space-x-5">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                quizResult.isCorrect 
                  ? 'bg-gradient-to-br from-green-400 to-green-600' 
                  : 'bg-gradient-to-br from-red-400 to-red-600'
              }`}>
                {quizResult.isCorrect ? (
                  <Check className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white stroke-[3]" />
                ) : (
                  <X className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white stroke-[3]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-xl sm:text-2xl md:text-3xl font-extrabold mb-3 sm:mb-4 md:mb-5 ${
                  quizResult.isCorrect 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-red-700 dark:text-red-400'
                }`} data-testid="result-title">
                  {quizResult.isCorrect ? t("quiz.correct") : t("quiz.incorrect")}
                </h4>
                <div 
                  className="bg-white dark:bg-slate-900 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-inner"
                  data-testid="explanation-content"
                >
                  <div 
                    className="prose prose-sm sm:prose-base md:prose-lg max-w-none [&>p]:text-slate-900 [&>p]:dark:text-slate-100 [&>p]:text-sm [&>p]:sm:text-base [&>p]:md:text-lg [&>p]:leading-relaxed [&>p]:font-medium [&>ul]:text-slate-900 [&>ul]:dark:text-slate-100 [&>ul]:text-sm [&>ul]:sm:text-base [&>ul]:md:text-lg [&>ol]:text-slate-900 [&>ol]:dark:text-slate-100 [&>ol]:text-sm [&>ol]:sm:text-base [&>ol]:md:text-lg [&>h1]:text-slate-900 [&>h1]:dark:text-slate-100 [&>h2]:text-slate-900 [&>h2]:dark:text-slate-100 [&>h3]:text-slate-900 [&>h3]:dark:text-slate-100 [&>strong]:text-slate-900 [&>strong]:dark:text-slate-100"
                    dangerouslySetInnerHTML={sanitizeHtml(quizResult.explanation)}
                  />
                </div>
                <div className="mt-3 sm:mt-4 md:mt-5 flex items-center flex-wrap gap-2">
                  <Badge variant="outline" className={`text-sm sm:text-base md:text-lg py-1.5 sm:py-2 px-3 sm:px-4 ${
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
