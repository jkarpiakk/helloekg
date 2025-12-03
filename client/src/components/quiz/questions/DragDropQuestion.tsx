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

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  };

  let borderClass = "border-border hover:border-primary/50";
  let bgClass = "bg-card hover:bg-primary/5";
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
    borderClass = "border-muted";
    bgClass = "bg-muted/30";
    shadowClass = "";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`draggable-item-${id}`}
      className={`
        flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 
        ${borderClass} ${bgClass} ${shadowClass}
        ${isDragging ? "opacity-70 shadow-xl scale-105 z-50" : ""}
        ${disabled ? "cursor-default opacity-80" : "cursor-grab active:cursor-grabbing active:scale-[0.98]"}
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
      <span className="text-sm sm:text-base flex-1 font-medium">{content}</span>
      {isCorrect && <Check className="h-5 w-5 text-green-600 dark:text-green-400" />}
      {isIncorrect && <X className="h-5 w-5 text-red-600 dark:text-red-400" />}
    </div>
  );
}

interface DropZoneProps {
  id: string;
  label: string;
  placedItem?: { id: string; content: string; imageUrl?: string };
  isCorrect?: boolean;
  isIncorrect?: boolean;
}

function DropZone({ id, label, placedItem, isCorrect, isIncorrect }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id });
  
  let borderClass = "border-dashed border-muted-foreground/40";
  let bgClass = "bg-muted/20";
  let shadowClass = "";
  
  if (isOver) {
    borderClass = "border-dashed border-primary border-[3px]";
    bgClass = "bg-primary/15";
    shadowClass = "shadow-lg shadow-primary/20";
  } else if (placedItem) {
    if (isCorrect) {
      borderClass = "border-solid border-green-500";
      bgClass = "bg-green-50 dark:bg-green-950/30";
      shadowClass = "shadow-md shadow-green-500/20";
    } else if (isIncorrect) {
      borderClass = "border-solid border-red-500";
      bgClass = "bg-red-50 dark:bg-red-950/30";
      shadowClass = "shadow-md shadow-red-500/20";
    } else {
      borderClass = "border-solid border-primary";
      bgClass = "bg-primary/10";
      shadowClass = "shadow-sm";
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`drop-zone-${id}`}
      className={`
        min-h-[60px] sm:min-h-[72px] p-3 sm:p-4 rounded-lg border-2
        ${borderClass} ${bgClass} ${shadowClass}
        flex items-center justify-center transition-all duration-200
      `}
    >
      {placedItem ? (
        <div className="flex items-center gap-2" data-testid={`placed-item-${placedItem.id}`}>
          {placedItem.imageUrl && (
            <img 
              src={placedItem.imageUrl} 
              alt={placedItem.content} 
              className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded border border-border"
            />
          )}
          <span className="text-sm sm:text-base font-medium">{placedItem.content}</span>
          {isCorrect && <Check className="h-5 w-5 text-green-600 dark:text-green-400" />}
          {isIncorrect && <X className="h-5 w-5 text-red-600 dark:text-red-400" />}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <span className="text-muted-foreground/50 text-lg">+</span>
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground font-medium">{label}</span>
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
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const availableSources = config.sources.filter(
    source => !Array.from(placements.values()).includes(source.id)
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

    if (config.targets.some(t => t.id === targetId)) {
      const newPlacements = new Map(placements);
      
      Array.from(newPlacements.entries()).forEach(([key, value]) => {
        if (value === sourceId) {
          newPlacements.delete(key);
        }
      });
      
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

  const activeSource = activeDragId 
    ? config.sources.find(s => s.id === activeDragId)
    : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-sm sm:text-base text-muted-foreground">
        Przeciągnij elementy do odpowiednich miejsc
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-3" data-testid="drag-sources">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
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
              <p className="text-sm text-muted-foreground italic p-3">
                Wszystkie elementy zostały rozmieszczone
              </p>
            )}
          </div>

          <div className="space-y-3" data-testid="drop-targets">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Miejsca docelowe
            </h4>
            <div className="space-y-2">
              {config.targets.map(target => {
                const placedSourceId = placements.get(target.id);
                const placedSource = placedSourceId 
                  ? config.sources.find(s => s.id === placedSourceId)
                  : undefined;

                const isCorrect = result?.feedback?.correctItems?.includes(placedSourceId || '');
                const isIncorrect = result?.feedback?.incorrectItems?.includes(placedSourceId || '');

                return (
                  <div key={target.id} className="space-y-1">
                    <span className="text-xs sm:text-sm font-medium">{target.label}</span>
                    <DropZone
                      id={target.id}
                      label="Upuść tutaj"
                      placedItem={placedSource ? {
                        id: placedSource.id,
                        content: placedSource.content,
                        imageUrl: placedSource.imageUrl,
                      } : undefined}
                      isCorrect={isCorrect}
                      isIncorrect={isIncorrect}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeSource && (
            <div className="flex items-center gap-2 p-3 sm:p-4 rounded-lg border-2 border-primary bg-card shadow-xl">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
              {activeSource.imageUrl && (
                <img 
                  src={activeSource.imageUrl} 
                  alt={activeSource.content} 
                  className="w-10 h-10 object-cover rounded"
                />
              )}
              <span className="text-sm sm:text-base">{activeSource.content}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
