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
    color: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary"
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
        ? `${baseClass} correct border-[#0B7E54] dark:border-[#3EE6A8] bg-[#3EE6A8]/[0.06] text-foreground`
        : `${baseClass} incorrect border-[#223040] bg-transparent text-foreground`;
    }

    if (quizResult && index === quizResult.correctIndex) {
      return `${baseClass} correct border-[#0B7E54] dark:border-[#3EE6A8] bg-[#3EE6A8]/[0.06] text-foreground`;
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
              {question.title && (
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-snug" data-testid="question-title">
                  {question.title}
                </h3>
              )}
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
            
            {/* EKG Image - above question text (default) */}
            {question.imageUrl && questionType !== 'hotspot' && ((question as any).imagePosition === 'above' || !(question as any).imagePosition) && (
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
                className="prose prose-base prose-slate dark:prose-invert max-w-none mb-5 sm:mb-6 [&>p]:text-base [&>p]:leading-relaxed [&>h2]:text-lg [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:text-base [&>h3]:font-semibold"
                dangerouslySetInnerHTML={sanitizeHtml(question.bodyMd)}
                data-testid="question-body"
              />
            )}
            
            {/* EKG Image - below question text */}
            {question.imageUrl && questionType !== 'hotspot' && (question as any).imagePosition === 'below' && (
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
                    <span className="text-base leading-snug flex-1">{answer.text}</span>
                    {showExplanation && quizResult && index === quizResult.correctIndex && (
                      <Check className="h-5 w-5 shrink-0 ml-2 text-[#0B7E54] dark:text-[#3EE6A8]" />
                    )}
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
            ? 'border-[#0B7E54] dark:border-[#3EE6A8] bg-[#3EE6A8]/[0.06]' 
            : 'border-[#223040] bg-transparent'
        }`} data-testid="explanation-panel">
          <CardContent className="p-4 sm:p-5 md:p-7">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
                quizResult.isCorrect 
                  ? 'border-[#0B7E54] dark:border-[#3EE6A8] bg-[#3EE6A8]/10' 
                  : 'border-[#223040] bg-transparent'
              }`}>
                {quizResult.isCorrect ? (
                  <Check className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-[#0B7E54] dark:text-[#3EE6A8] stroke-[3]" />
                ) : (
                  <X className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-muted-foreground stroke-[3]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-lg sm:text-xl md:text-2xl font-heading font-semibold mb-3 ${
                  quizResult.isCorrect 
                    ? 'text-[#0B7E54] dark:text-[#3EE6A8]' 
                    : 'text-foreground'
                }`} data-testid="result-title">
                  {quizResult.isCorrect ? t("quiz.correct") : t("quiz.incorrect")}
                </h4>
                <div 
                  className="bg-card p-4 sm:p-5 rounded-xl shadow-app border border-border"
                  data-testid="explanation-content"
                >
                  <div 
                    className="prose prose-base sm:prose-lg max-w-none prose-slate dark:prose-invert [&>*]:text-foreground [&>p]:text-base [&>p]:sm:text-lg [&>p]:leading-relaxed [&>p]:font-medium [&>strong]:font-bold"
                    dangerouslySetInnerHTML={sanitizeMarkdown(quizResult.explanation)}
                  />
                </div>
                <div className="mt-4 flex items-center flex-wrap gap-2">
                  <Badge variant="outline" className="text-label text-xs py-1.5 px-3 rounded-xl border-border text-muted-foreground">
                    {Math.round(quizResult.timeMs / 1000)}S
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
