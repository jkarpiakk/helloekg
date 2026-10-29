import { useMemo, useState } from "react";
import type { MatchingConfig, AnswerData, QuizResult } from "@/types";
import PlacementBoard, { type BoardSlot } from "./PlacementBoard";
import PartialScore from "./PartialScore";

interface MatchingQuestionProps {
  config: MatchingConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

/**
 * Dopasowanie par: elementy z kolumny B trafiają do miejsc obok elementów z kolumny A.
 * Odpowiedź ma ten sam kształt co wcześniej: pary { leftId, rightId }.
 */
export default function MatchingQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: MatchingQuestionProps) {
  // leftId -> rightId
  const [pairs, setPairs] = useState<Record<string, string>>({});

  const pieces = useMemo(
    () => config.rightColumn.map((r) => ({ id: r.id, content: r.text, imageUrl: r.imageUrl })),
    [config.rightColumn],
  );

  const slots: BoardSlot[] = config.leftColumn.map((left) => {
    const isCorrect = showResult && result?.feedback?.correctItems?.includes(left.id);
    const isIncorrect = showResult && result?.feedback?.incorrectItems?.includes(left.id);
    const correctRightId =
      result?.correctAnswer?.type === "matching"
        ? result.correctAnswer.pairs.find((p) => p.leftId === left.id)?.rightId
        : config.correctPairs.find((p) => p.leftId === left.id)?.rightId;
    return {
      id: left.id,
      label: left.text,
      imageUrl: left.imageUrl,
      result: isCorrect ? "right" : isIncorrect ? "wrong" : undefined,
      correctText: config.rightColumn.find((r) => r.id === correctRightId)?.text,
    };
  });

  const handleChange = (next: Record<string, string>) => {
    setPairs(next);
    onChange({
      type: "matching",
      pairs: Object.entries(next).map(([leftId, rightId]) => ({ leftId, rightId })),
    });
  };

  return (
    <div className="grid gap-5">
      <PlacementBoard
        pieces={pieces}
        slots={slots}
        placements={pairs}
        onPlacementsChange={handleChange}
        disabled={disabled}
        showResult={showResult}
        poolLabel="Kolumna B"
        slotsLabel="Kolumna A: dopasuj"
        pieceTestId={(id) => `right-item-${id}`}
        slotTestId={(id) => `left-item-${id}`}
        poolTestId="matching-right"
        slotsTestId="matching-left"
        poolLast
      />
      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <PartialScore
          score={result.partialScore}
          correct={result.feedback?.correctItems?.length}
          total={config.correctPairs.length}
          noun="par poprawnie"
        />
      )}
    </div>
  );
}
