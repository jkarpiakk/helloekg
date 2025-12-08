import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import { GripVertical, Check, X } from "lucide-react";
import type { DragDropConfig, AnswerData, QuizResult } from "@/types";

interface DragDropQuestionProps {
  config: DragDropConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

interface DraggableItemProps {
  id: string;
  content: string;
  imageUrl?: string;
  disabled: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
}

function DraggableItem({ id, content, imageUrl, disabled, isCorrect, isIncorrect }: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id, disabled });

  const style: React.CSSProperties = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : undefined,
  } : {};

  let borderClass = "border-slate-300 dark:border-slate-600";
  let bgClass = "bg-white dark:bg-slate-800";
  
  if (isCorrect) {
    borderClass = "border-green-500";
    bgClass = "bg-green-50 dark:bg-green-950/30";
  } else if (isIncorrect) {
    borderClass = "border-red-500";
    bgClass = "bg-red-50 dark:bg-red-950/30";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`draggable-item-${id}`}
      className={`
        flex items-center gap-3 p-4 rounded-xl border-2 shadow-sm
        ${borderClass} ${bgClass}
        ${isDragging ? "opacity-50 shadow-2xl" : ""}
        ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
        touch-manipulation select-none
      `}
      {...attributes}
      {...listeners}
    >
      {!disabled && (
        <GripVertical className="h-5 w-5 text-slate-400 flex-shrink-0" />
      )}
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt={content} 
          className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
        />
      )}
      <span className="text-base font-medium text-slate-900 dark:text-white flex-1">{content}</span>
      {isCorrect && <Check className="h-5 w-5 text-green-600 dark:text-green-400" />}
      {isIncorrect && <X className="h-5 w-5 text-red-600 dark:text-red-400" />}
    </div>
  );
}

interface DropZoneProps {
  id: string;
  label: string;
  placedItem?: { id: string; content: string; imageUrl?: string };
  isOver: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
  onRemove?: () => void;
  disabled?: boolean;
  showResult?: boolean;
}

function DropZone({ id, label, placedItem, isOver, isCorrect, isIncorrect, onRemove, disabled, showResult }: DropZoneProps) {
  const { setNodeRef } = useDroppable({ id });
  
  let containerClass = "border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/30";
  
  if (isOver) {
    containerClass = "border-2 border-dashed border-primary bg-primary/10 ring-2 ring-primary/30";
  } else if (placedItem) {
    if (isCorrect) {
      containerClass = "border-2 border-solid border-green-500 bg-green-50 dark:bg-green-950/30";
    } else if (isIncorrect) {
      containerClass = "border-2 border-solid border-red-500 bg-red-50 dark:bg-red-950/30";
    } else {
      containerClass = "border-2 border-solid border-primary/60 bg-primary/5";
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`drop-zone-${id}`}
      className={`min-h-[80px] p-3 rounded-xl ${containerClass} relative`}
    >
      {placedItem ? (
        <div className="flex items-center gap-3">
          {placedItem.imageUrl && (
            <img 
              src={placedItem.imageUrl} 
              alt={placedItem.content} 
              className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
            />
          )}
          <span className="text-base font-medium text-slate-900 dark:text-white flex-1">
            {placedItem.content}
          </span>
          {showResult && isCorrect && <Check className="h-5 w-5 text-green-600 dark:text-green-400" />}
          {showResult && isIncorrect && <X className="h-5 w-5 text-red-600 dark:text-red-400" />}
          {!disabled && !showResult && onRemove && (
            <button
              onClick={onRemove}
              className="w-8 h-8 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center transition-colors"
              data-testid={`remove-btn-${id}`}
              title="Usuń i wybierz ponownie"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[56px] gap-1">
          <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center">
            <span className="text-slate-400 dark:text-slate-500 text-xl font-light">+</span>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">Upuść tutaj</span>
        </div>
      )}
    </div>
  );
}

export default function DragDropQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: DragDropQuestionProps) {
  const [placements, setPlacements] = useState<Map<string, string>>(new Map());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overTargetId, setOverTargetId] = useState<string | null>(null);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  const placedSourceIds = new Set(Array.from(placements.values()));
  const availableSources = config.sources.filter(source => !placedSourceIds.has(source.id));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const overId = event.over?.id as string | null;
    if (overId && config.targets.some(t => t.id === overId)) {
      setOverTargetId(overId);
    } else {
      setOverTargetId(null);
    }
  }, [config.targets]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setOverTargetId(null);

    if (!over) return;

    const sourceId = active.id as string;
    const targetId = over.id as string;

    const isValidTarget = config.targets.some(t => t.id === targetId);
    if (!isValidTarget) return;

    const newPlacements = new Map(placements);
    
    // If this target already has something, that item goes back to available
    // (we just overwrite it in the map)
    
    newPlacements.set(targetId, sourceId);
    setPlacements(newPlacements);

    const answerData: AnswerData = {
      type: 'drag_drop',
      placements: Array.from(newPlacements.entries()).map(([targetId, sourceId]) => ({
        sourceId,
        targetId,
      })),
    };
    onChange(answerData);
  }, [placements, config.targets, onChange]);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setOverTargetId(null);
  }, []);

  const handleRemoveFromZone = useCallback((targetId: string) => {
    const newPlacements = new Map(placements);
    newPlacements.delete(targetId);
    setPlacements(newPlacements);

    const answerData: AnswerData = {
      type: 'drag_drop',
      placements: Array.from(newPlacements.entries()).map(([targetId, sourceId]) => ({
        sourceId,
        targetId,
      })),
    };
    onChange(answerData);
  }, [placements, onChange]);

  const activeSource = activeDragId 
    ? config.sources.find(s => s.id === activeDragId)
    : null;

  return (
    <div className="space-y-6">
      <p className="text-base text-slate-600 dark:text-slate-300">
        Przeciągnij elementy do odpowiednich miejsc
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available items */}
          <div className="space-y-3" data-testid="drag-sources">
            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Elementy
            </h4>
            <div className="space-y-2">
              {availableSources.map(source => (
                <DraggableItem
                  key={source.id}
                  id={source.id}
                  content={source.content}
                  imageUrl={source.imageUrl}
                  disabled={disabled}
                />
              ))}
              {availableSources.length === 0 && !showResult && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl text-center">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                  <p className="text-sm text-green-700 dark:text-green-300">Wszystkie elementy rozmieszczone</p>
                </div>
              )}
            </div>
          </div>

          {/* Drop zones */}
          <div className="space-y-3" data-testid="drop-targets">
            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Miejsca docelowe
            </h4>
            <div className="space-y-4">
              {config.targets.map(target => {
                const placedSourceId = placements.get(target.id);
                const placedSource = placedSourceId 
                  ? config.sources.find(s => s.id === placedSourceId)
                  : undefined;

                const isCorrect = showResult && result?.feedback?.correctItems?.includes(target.id);
                const isIncorrect = showResult && result?.feedback?.incorrectItems?.includes(target.id);

                return (
                  <div key={target.id} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">
                      {target.label}
                    </label>
                    <DropZone
                      id={target.id}
                      label="Upuść tutaj"
                      placedItem={placedSource ? {
                        id: placedSource.id,
                        content: placedSource.content,
                        imageUrl: placedSource.imageUrl,
                      } : undefined}
                      isOver={overTargetId === target.id}
                      isCorrect={isCorrect}
                      isIncorrect={isIncorrect}
                      onRemove={() => handleRemoveFromZone(target.id)}
                      disabled={disabled}
                      showResult={showResult}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeSource && (
            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-white dark:bg-slate-800 shadow-2xl">
              <GripVertical className="h-5 w-5 text-primary" />
              {activeSource.imageUrl && (
                <img 
                  src={activeSource.imageUrl} 
                  alt={activeSource.content} 
                  className="w-12 h-12 object-cover rounded-lg"
                />
              )}
              <span className="text-base font-medium text-slate-900 dark:text-white">{activeSource.content}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-base text-amber-800 dark:text-amber-200">
            Poprawne: {Math.round(result.partialScore * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}
