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
    const baseClass = "quiz-option p-3 sm:p-4 lg:p-6 border-2 rounded-xl cursor-pointer transition-all";
    
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
                className="relative group cursor-pointer mb-4 sm:mb-6"
                onClick={() => onImageClick(question.imageUrl!)}
                data-testid="question-image"
              >
                <img
                  src={question.imageUrl}
                  alt="Zapis EKG"
                  className="w-full h-48 sm:h-56 lg:h-64 object-cover rounded-lg border border-border"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base">
                    <ZoomIn className="h-4 w-4 mr-2 inline" />
                    {t("quiz.enlargeImage")}
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
          <CardContent className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-start space-x-5 sm:space-x-6">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                quizResult.isCorrect 
                  ? 'bg-gradient-to-br from-green-400 to-green-600' 
                  : 'bg-gradient-to-br from-red-400 to-red-600'
              }`}>
                {quizResult.isCorrect ? (
                  <Check className="h-8 w-8 sm:h-10 sm:w-10 text-white stroke-[3]" />
                ) : (
                  <X className="h-8 w-8 sm:h-10 sm:w-10 text-white stroke-[3]" />
                )}
              </div>
              <div className="flex-1">
                <h4 className={`text-2xl sm:text-3xl font-extrabold mb-5 sm:mb-6 ${
                  quizResult.isCorrect 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-red-700 dark:text-red-400'
                }`} data-testid="result-title">
                  {quizResult.isCorrect ? t("quiz.correct") : t("quiz.incorrect")}
                </h4>
                <div 
                  className="prose prose-lg sm:prose-xl prose-slate dark:prose-invert max-w-none leading-relaxed text-foreground [&>p]:text-base [&>p]:sm:text-lg [&>p]:leading-relaxed [&>ul]:text-base [&>ul]:sm:text-lg [&>ol]:text-base [&>ol]:sm:text-lg [&>h1]:text-xl [&>h1]:sm:text-2xl [&>h2]:text-lg [&>h2]:sm:text-xl [&>h3]:text-base [&>h3]:sm:text-lg"
                  dangerouslySetInnerHTML={sanitizeHtml(quizResult.explanation)}
                  data-testid="explanation-content"
                />
                <div className="mt-6 sm:mt-7 flex items-center space-x-3">
                  <Badge variant="outline" className={`text-base sm:text-lg py-2 px-4 ${
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
