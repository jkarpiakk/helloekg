import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, GripVertical, Type, Link2, ArrowUpDown, Target } from "lucide-react";
import { sanitizeMarkdown } from "@/lib/sanitize";
import type { QuizQuestion, QuizResult, AnswerData, QuestionType } from "@/types";

import DragDropQuestion from "./DragDropQuestion";
import FillBlankQuestion from "./FillBlankQuestion";
import MatchingQuestion from "./MatchingQuestion";
import SortingQuestion from "./SortingQuestion";
import HotspotQuestion from "./HotspotQuestion";

interface QuestionRendererProps {
  question: QuizQuestion;
  onAnswerChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
  onImageClick?: (imageUrl: string) => void;
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

export default function QuestionRenderer({
  question,
  onAnswerChange,
  disabled,
  showResult,
  result,
  onImageClick
}: QuestionRendererProps) {
  const questionType = question.questionType || 'multiple_choice';
  const typeInfo = questionTypeInfo[questionType];
  const showPromptImage = question.imageUrl && questionType !== 'hotspot';

  const renderQuestionContent = () => {
    if (!question.questionConfig) {
      return null;
    }

    switch (question.questionConfig.type) {
      case 'drag_drop':
        return (
          <DragDropQuestion
            config={question.questionConfig.config}
            onChange={onAnswerChange}
            disabled={disabled}
            showResult={showResult}
            result={result}
          />
        );

      case 'fill_blank':
        return (
          <FillBlankQuestion
            config={question.questionConfig.config}
            onChange={onAnswerChange}
            disabled={disabled}
            showResult={showResult}
            result={result}
          />
        );

      case 'matching':
        return (
          <MatchingQuestion
            config={question.questionConfig.config}
            onChange={onAnswerChange}
            disabled={disabled}
            showResult={showResult}
            result={result}
          />
        );

      case 'sorting':
        return (
          <SortingQuestion
            config={question.questionConfig.config}
            onChange={onAnswerChange}
            disabled={disabled}
            showResult={showResult}
            result={result}
          />
        );

      case 'hotspot':
        return (
          <HotspotQuestion
            config={question.questionConfig.config}
            onChange={onAnswerChange}
            disabled={disabled}
            showResult={showResult}
            result={result}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="shadow-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white" data-testid="question-title">
                {question.title}
              </h3>
              {questionType !== 'multiple_choice' && (
                <Badge 
                  variant="secondary" 
                  className={`flex items-center gap-1 text-xs shrink-0 ${typeInfo.color}`}
                >
                  {typeInfo.icon}
                  <span className="hidden sm:inline">{typeInfo.label}</span>
                </Badge>
              )}
            </div>
            
            {showPromptImage && onImageClick && (
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
                    <span className="hidden sm:inline">Powiększ obraz</span>
                    <span className="sm:hidden">Powiększ</span>
                  </div>
                </div>
              </div>
            )}

            {question.bodyMd && (
              <div 
                className="prose prose-sm sm:prose prose-slate dark:prose-invert max-w-none mb-4 sm:mb-6 [&>*]:text-slate-700 dark:[&>*]:text-slate-200"
                dangerouslySetInnerHTML={sanitizeMarkdown(question.bodyMd)}
                data-testid="question-body"
              />
            )}
          </div>

          {renderQuestionContent()}
        </CardContent>
      </Card>
    </div>
  );
}
