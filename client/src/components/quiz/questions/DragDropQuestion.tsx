import { useMemo, useState } from "react";
import type { DragDropConfig, AnswerData, QuizResult } from "@/types";
import PlacementBoard, { type BoardSlot, type PieceResult } from "./PlacementBoard";
import { czyGrupy } from "@shared/dragDropGrupy";
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
  // targetId -> sourceId; w pytaniu „do grup” sourceId -> targetId (grupa mieści kilka kart)
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const grupy = czyGrupy(config);

  const pieces = useMemo(
    () =>
      config.sources.map((s) => ({
        id: String(s.id),
        content: s.content,
        imageUrl: s.imageUrl,
      })),
    [config.sources],
  );

  // „Do grup”: wynik przy każdej karcie (correctItems = karty), przy błędzie nazwa właściwej grupy
  const pieceResults: Record<string, PieceResult> | undefined =
    grupy && showResult && result
      ? Object.fromEntries(
          config.sources.map((s) => {
            const id = String(s.id);
            const cel =
              result.correctAnswer?.type === "drag_drop"
                ? result.correctAnswer.placements.find((p) => String(p.sourceId) === id)?.targetId
                : undefined;
            const ok = result.feedback?.correctItems?.map(String).includes(id) ?? false;
            const grupa = config.targets.find((t) => String(t.id) === String(cel));
            return [id, { result: ok ? "right" : "wrong", correctText: grupa ? grupa.label : cel === undefined ? "poza grupami" : undefined }];
          }),
        )
      : undefined;

  const slots: BoardSlot[] = config.targets.map((target) => {
    const id = String(target.id);
    if (grupy) return { id, label: target.label, imageUrl: target.imageUrl };
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
      placements: grupy
        ? Object.entries(next).map(([sourceId, targetId]) => ({ sourceId, targetId }))
        : Object.entries(next).map(([targetId, sourceId]) => ({ sourceId, targetId })),
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
        pieceTestId={(id) => `draggable-item-${id}`}
        slotTestId={(id) => `drop-zone-${id}`}
        poolTestId="drag-sources"
        slotsTestId="drop-targets"
        grupy={grupy}
        pieceResults={pieceResults}
        slotsLabel={grupy ? "Grupy" : "Miejsca docelowe"}
      />
      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <PartialScore
          score={result.partialScore}
          correct={result.feedback?.correctItems?.length}
          total={grupy ? config.sources.length : config.targets.length}
        />
      )}
    </div>
  );
}
