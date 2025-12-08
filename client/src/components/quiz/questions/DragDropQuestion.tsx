import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical, Check, X, RotateCcw } from "lucide-react";
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
  isInDropZone?: boolean;
}

function DraggableItem({ id, content, imageUrl, disabled, isCorrect, isIncorrect, isInDropZone }: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id, disabled });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  };

  let borderClass = "border-slate-300 dark:border-slate-600 hover:border-primary/50";
  let bgClass = "bg-white dark:bg-slate-800 hover:bg-primary/5";
  let shadowClass = "hover:shadow-md";
  
  if (isCorrect) {
    borderClass = "border-green-500";
    bgClass = "bg-green-50 dark:bg-green-950/30";
    shadowClass = "shadow-md shadow-green-500/20";
  } else if (isIncorrect) {
    borderClass = "border-red-500";
    bgClass = "bg-red-50 dark:bg-red-950/30";
    shadowClass = "shadow-md shadow-red-500/20";
  } else if (disabled) {
    borderClass = "border-slate-200 dark:border-slate-700";
    bgClass = "bg-slate-100 dark:bg-slate-800/50";
    shadowClass = "";
  } else if (isInDropZone) {
    borderClass = "border-primary";
    bgClass = "bg-primary/10";
    shadowClass = "shadow-sm";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`draggable-item-${id}`}
      className={`
        flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 
        ${borderClass} ${bgClass} ${shadowClass}
        ${isDragging ? "opacity-90 shadow-xl scale-105 z-50" : ""}
        ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing active:scale-[0.98]"}
        touch-manipulation transition-all duration-200
      `}
      {...attributes}
      {...listeners}
    >
      {!disabled && (
        <GripVertical className="h-5 w-5 text-primary/60 flex-shrink-0" />
      )}
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt={content} 
          className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded border border-border"
        />
      )}
      <span className="text-sm sm:text-base flex-1 font-medium text-slate-900 dark:text-white">{content}</span>
      {isCorrect && <Check className="h-5 w-5 text-green-600 dark:text-green-400" />}
      {isIncorrect && <X className="h-5 w-5 text-red-600 dark:text-red-400" />}
    </div>
  );
}

interface DropZoneProps {
  id: string;
  label: string;
  children?: React.ReactNode;
  isEmpty: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
  onRemove?: () => void;
  disabled?: boolean;
}

function DropZone({ id, label, children, isEmpty, isCorrect, isIncorrect, onRemove, disabled }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id });
  
  let borderClass = "border-dashed border-slate-400 dark:border-slate-500";
  let bgClass = "bg-slate-100 dark:bg-slate-800/50";
  let shadowClass = "";
  
  if (isOver) {
    borderClass = "border-dashed border-primary border-[3px]";
    bgClass = "bg-primary/15";
    shadowClass = "shadow-lg shadow-primary/20";
  } else if (!isEmpty) {
    if (isCorrect) {
      borderClass = "border-solid border-green-500";
      bgClass = "bg-green-50 dark:bg-green-950/30";
      shadowClass = "shadow-md shadow-green-500/20";
    } else if (isIncorrect) {
      borderClass = "border-solid border-red-500";
      bgClass = "bg-red-50 dark:bg-red-950/30";
      shadowClass = "shadow-md shadow-red-500/20";
    } else {
      borderClass = "border-solid border-primary/50";
      bgClass = "bg-primary/5";
      shadowClass = "shadow-sm";
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`drop-zone-${id}`}
      className={`
        min-h-[70px] sm:min-h-[80px] p-2 sm:p-3 rounded-lg border-2
        ${borderClass} ${bgClass} ${shadowClass}
        flex items-center justify-center transition-all duration-200 relative
      `}
    >
      {!isEmpty && !disabled && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors z-10"
          data-testid={`remove-from-zone-${id}`}
          title="Usuń element"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {isEmpty ? (
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center">
            <span className="text-slate-400 dark:text-slate-500 text-lg">+</span>
          </div>
          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">{label}</span>
        </div>
      ) : (
        <div className="w-full">
          {children}
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getPlacedItems = () => {
    return new Set(Array.from(placements.values()));
  };

  const availableSources = config.sources.filter(
    source => !getPlacedItems().has(source.id)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const sourceId = active.id as string;
    const targetId = over.id as string;

    // Check if dropping on a valid target
    if (config.targets.some(t => t.id === targetId)) {
      const newPlacements = new Map(placements);
      
      // Remove this source from any previous placement
      Array.from(newPlacements.entries()).forEach(([key, value]) => {
        if (value === sourceId) {
          newPlacements.delete(key);
        }
      });
      
      // If target already has something, move it back to available
      // (just delete the placement, it will appear in availableSources)
      if (newPlacements.has(targetId)) {
        // The old item will automatically become available again
      }
      
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
    }
  }, [placements, config.targets, onChange]);

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
    <div className="space-y-4 sm:space-y-6">
      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
        Przeciągnij elementy do odpowiednich miejsc. Kliknij <X className="inline h-4 w-4 text-red-500" /> aby usunąć element.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Left side - available items */}
          <div className="space-y-3" data-testid="drag-sources">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Elementy do przeciągnięcia
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
            </div>
            {availableSources.length === 0 && !showResult && (
              <div className="text-sm text-slate-600 dark:text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                ✓ Wszystkie elementy rozmieszczone
              </div>
            )}
          </div>

          {/* Right side - drop zones */}
          <div className="space-y-3" data-testid="drop-targets">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Miejsca docelowe
            </h4>
            <div className="space-y-3">
              {config.targets.map(target => {
                const placedSourceId = placements.get(target.id);
                const placedSource = placedSourceId 
                  ? config.sources.find(s => s.id === placedSourceId)
                  : undefined;

                const isCorrect = result?.feedback?.correctItems?.includes(placedSourceId || '');
                const isIncorrect = result?.feedback?.incorrectItems?.includes(placedSourceId || '');

                return (
                  <div key={target.id} className="space-y-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                      {target.label}
                    </span>
                    <DropZone
                      id={target.id}
                      label="Upuść tutaj"
                      isEmpty={!placedSource}
                      isCorrect={isCorrect}
                      isIncorrect={isIncorrect}
                      onRemove={() => handleRemoveFromZone(target.id)}
                      disabled={disabled}
                    >
                      {placedSource && (
                        <DraggableItem
                          id={placedSource.id}
                          content={placedSource.content}
                          imageUrl={placedSource.imageUrl}
                          disabled={disabled}
                          isCorrect={isCorrect}
                          isIncorrect={isIncorrect}
                          isInDropZone={true}
                        />
                      )}
                    </DropZone>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeSource && (
            <div className="flex items-center gap-2 p-3 sm:p-4 rounded-lg border-2 border-primary bg-white dark:bg-slate-800 shadow-xl">
              <GripVertical className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              {activeSource.imageUrl && (
                <img 
                  src={activeSource.imageUrl} 
                  alt={activeSource.content} 
                  className="w-10 h-10 object-cover rounded"
                />
              )}
              <span className="text-sm sm:text-base text-slate-900 dark:text-white">{activeSource.content}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <div className="mt-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm sm:text-base text-amber-800 dark:text-amber-200">
            Poprawne umieszczenia: {Math.round(result.partialScore * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}
