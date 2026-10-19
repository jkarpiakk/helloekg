import type { QuizQuestion, QuizResult, AnswerData } from "@/types";

import DragDropQuestion from "./DragDropQuestion";
import FillBlankQuestion from "./FillBlankQuestion";
import MatchingQuestion from "./MatchingQuestion";
import SortingQuestion from "./SortingQuestion";
import HotspotQuestion from "./HotspotQuestion";
import ClinicalCaseQuestion from "./ClinicalCaseQuestion";
import type { AnyQuestionConfig } from "@shared/clinicalCase";

interface QuestionRendererProps {
  question: QuizQuestion;
  onAnswerChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
  /** Obraz pytania pokazuje QuestionCard; przypadek kliniczny rysuje swój zapis sam */
  onImageClick?: (imageUrl: string, origin?: HTMLElement) => void;
}

/**
 * Część interaktywna pytania. Tytuł, treść i obraz pytania rysuje QuestionCard
 * (wcześniej renderer powielał je we własnej karcie).
 */
export default function QuestionRenderer({
  question,
  onAnswerChange,
  disabled,
  showResult,
  result,
  onImageClick,
}: QuestionRendererProps) {
  if (!question.questionConfig) return null;
  // Unia QuestionConfig w schema.ts nie zna jeszcze clinical_case — szersza z @shared/clinicalCase
  const questionConfig = question.questionConfig as AnyQuestionConfig;

  switch (questionConfig.type) {
    case "drag_drop":
      return (
        <DragDropQuestion
          config={questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "fill_blank":
      return (
        <FillBlankQuestion
          config={questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "matching":
      return (
        <MatchingQuestion
          config={questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "sorting":
      return (
        <SortingQuestion
          config={questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "hotspot":
      return (
        <HotspotQuestion
          config={questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "clinical_case":
      return (
        <ClinicalCaseQuestion
          // Nowe pytanie = nowy stan kroków
          key={question.id}
          config={questionConfig.config}
          questionId={question.id}
          fallbackImageUrl={question.imageUrl}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
          onImageClick={onImageClick}
        />
      );
    default:
      return null;
  }
}
