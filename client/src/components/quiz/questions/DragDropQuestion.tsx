import { useMemo, useState } from "react";
import type { DragDropConfig, AnswerData, QuizResult } from "@/types";
import PlacementBoard, { type BoardSlot } from "./PlacementBoard";
import PartialScore from "./PartialScore";

interface DragDropQuestionProps {
  config: DragDropConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

export default function DragDropQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: DragDropQuestionProps) {
  // targetId -> sourceId (jak wcześniej)
  const [placements, setPlacements] = useState<Record<string, string>>({});

  const pieces = useMemo(
    () =>
      config.sources.map((s) => ({
        id: String(s.id),
        content: s.content,
        imageUrl: s.imageUrl,
      })),
    [config.sources],
  );

  const slots: BoardSlot[] = config.targets.map((target) => {
    const id = String(target.id);
    const isCorrect = showResult && result?.feedback?.correctItems?.includes(target.id);
    const isIncorrect = showResult && result?.feedback?.incorrectItems?.includes(target.id);
    const correctSourceId =
      result?.correctAnswer?.type === "drag_drop"
        ? result.correctAnswer.placements.find((p) => String(p.targetId) === id)?.sourceId
        : target.acceptsSourceId;
    const correctSource = config.sources.find((s) => String(s.id) === String(correctSourceId));
    return {
      id,
      label: target.label,
      imageUrl: target.imageUrl,
      result: isCorrect ? "right" : isIncorrect ? "wrong" : undefined,
      correctText: correctSource?.content,
    };
  });

  const handleChange = (next: Record<string, string>) => {
    setPlacements(next);
    onChange({
      type: "drag_drop",
      placements: Object.entries(next).map(([targetId, sourceId]) => ({ sourceId, targetId })),
    });
  };

  return (
    <div className="grid gap-5">
      <PlacementBoard
        pieces={pieces}
        slots={slots}
        placements={placements}
        onPlacementsChange={handleChange}
        disabled={disabled}
        showResult={showResult}
        poolLabel="Elementy"
        slotsLabel="Miejsca docelowe"
        pieceTestId={(id) => `draggable-item-${id}`}
        slotTestId={(id) => `drop-zone-${id}`}
        poolTestId="drag-sources"
        slotsTestId="drop-targets"
      />
      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <PartialScore
          score={result.partialScore}
          correct={result.feedback?.correctItems?.length}
          total={config.targets.length}
        />
      )}
    </div>
  );
}
