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
    const baseClass = "quiz-option p-6 border-2 rounded-xl cursor-pointer transition-all";
    
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
    <div className="space-y-8">
      {/* Question Card */}
      <Card className="shadow-lg">
        <CardContent className="p-8">
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-foreground mb-6" data-testid="question-title">
              {question.title}
            </h3>
            
            {/* EKG Image */}
            {question.imageUrl && (
              <div 
                className="relative group cursor-pointer mb-6"
                onClick={() => onImageClick(question.imageUrl!)}
                data-testid="question-image"
              >
                <img
                  src={question.imageUrl}
                  alt="Zapis EKG"
                  className="w-full h-64 object-cover rounded-lg border border-border"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white px-4 py-2 rounded-lg">
                    <ZoomIn className="h-4 w-4 mr-2 inline" />
                    {t("quiz.enlargeImage")}
                  </div>
                </div>
              </div>
            )}

            {/* Question Body */}
            {question.bodyMd && (
              <div 
                className="prose prose-slate max-w-none mb-6"
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
                  <span className="font-bold text-lg mr-4 w-8">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <span>{answer.text}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Explanation Panel */}
      {showExplanation && quizResult && (
        <Card className="shadow-lg" data-testid="explanation-panel">
          <CardContent className="p-8">
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                quizResult.isCorrect 
                  ? 'bg-green-100 dark:bg-green-900' 
                  : 'bg-red-100 dark:bg-red-900'
              }`}>
                {quizResult.isCorrect ? (
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <X className="h-6 w-6 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-semibold mb-4" data-testid="result-title">
                  {quizResult.isCorrect ? t("quiz.correct") : t("quiz.incorrect")}
                </h4>
                <div 
                  className="prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={sanitizeHtml(quizResult.explanation)}
                  data-testid="explanation-content"
                />
                <div className="mt-4 flex items-center space-x-4 text-sm text-muted-foreground">
                  <Badge variant="outline">
                    {t("quiz.timeSpent")} {Math.round(quizResult.timeMs / 1000)}s
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
