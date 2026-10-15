import type { QuizQuestion, QuizResult, AnswerData } from "@/types";

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
  /** Zostawione dla zgodności — obraz pytania pokazuje QuestionCard */
  onImageClick?: (imageUrl: string) => void;
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
}: QuestionRendererProps) {
  if (!question.questionConfig) return null;

  switch (question.questionConfig.type) {
    case "drag_drop":
      return (
        <DragDropQuestion
          config={question.questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "fill_blank":
      return (
        <FillBlankQuestion
          config={question.questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "matching":
      return (
        <MatchingQuestion
          config={question.questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "sorting":
      return (
        <SortingQuestion
          config={question.questionConfig.config}
          onChange={onAnswerChange}
          disabled={disabled}
          showResult={showResult}
          result={result}
        />
      );
    case "hotspot":
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
}
