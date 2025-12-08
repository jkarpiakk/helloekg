import { useState, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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
  isBeingDragged?: boolean;
}

function DraggableItem({ id, content, imageUrl, disabled, isCorrect, isIncorrect, isBeingDragged }: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id, disabled });

  const style: React.CSSProperties = transform ? {
    transform: CSS.Translate.toString(transform),
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

  const showAsGhost = isDragging || isBeingDragged;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`draggable-item-${id}`}
      className={`
        flex items-center gap-3 p-4 rounded-xl border-2 shadow-sm
        ${borderClass} ${bgClass}
        ${showAsGhost ? "opacity-30" : ""}
        ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
        touch-manipulation select-none
      `}
      {...attributes}
      {...listeners}
    >
      {!disabled && (
        <GripVertical className="h-5 w-5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
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
  isOver: boolean;
  children?: React.ReactNode;
  isEmpty: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
}

function DropZone({ id, isOver, children, isEmpty, isCorrect, isIncorrect }: DropZoneProps) {
  const { setNodeRef } = useDroppable({ id });
  
  let containerClass = "border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/30";
  
  if (isOver) {
    containerClass = "border-2 border-dashed border-primary bg-primary/10 ring-2 ring-primary/30";
  } else if (!isEmpty) {
    if (isCorrect) {
      containerClass = "border-2 border-solid border-green-500 bg-green-50 dark:bg-green-950/30";
    } else if (isIncorrect) {
      containerClass = "border-2 border-solid border-red-500 bg-red-50 dark:bg-red-950/30";
    } else {
      containerClass = "border-2 border-solid border-primary/50 bg-white dark:bg-slate-800";
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`drop-zone-${id}`}
      className={`min-h-[80px] p-2 rounded-xl transition-all duration-150 ${containerClass}`}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[64px] gap-1">
          <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center">
            <span className="text-slate-500 dark:text-slate-400 text-xl font-light">+</span>
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Upuść tutaj</span>
        </div>
      ) : (
        children
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
  const dragOriginTargetRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getTargetForSource = (sourceId: string): string | undefined => {
    const entries = Array.from(placements.entries());
    for (let i = 0; i < entries.length; i++) {
      const [targetId, sId] = entries[i];
      if (sId === sourceId) return targetId;
    }
    return undefined;
  };

  const placedSourceIds = new Set(Array.from(placements.values()));
  const availableSources = config.sources.filter(source => !placedSourceIds.has(source.id));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const sourceId = event.active.id as string;
    setActiveDragId(sourceId);
    dragOriginTargetRef.current = getTargetForSource(sourceId) || null;
  }, [placements]);

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
    const sourceId = active.id as string;
    const originTarget = dragOriginTargetRef.current;
    
    setActiveDragId(null);
    setOverTargetId(null);
    dragOriginTargetRef.current = null;

    if (!over) return;

    const targetId = over.id as string;
    const isValidTarget = config.targets.some(t => t.id === targetId);
    
    if (!isValidTarget) return;

    const newPlacements = new Map(placements);
    
    if (originTarget && originTarget !== targetId) {
      newPlacements.delete(originTarget);
    }
    
    const existingSourceInTarget = newPlacements.get(targetId);
    if (existingSourceInTarget && existingSourceInTarget !== sourceId) {
      if (originTarget) {
        newPlacements.set(originTarget, existingSourceInTarget);
      }
    }
    
    newPlacements.set(targetId, sourceId);
    setPlacements(newPlacements);

    const answerData: AnswerData = {
      type: 'drag_drop',
      placements: Array.from(newPlacements.entries()).map(([tId, sId]) => ({
        sourceId: sId,
        targetId: tId,
      })),
    };
    onChange(answerData);
  }, [placements, config.targets, onChange]);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setOverTargetId(null);
    dragOriginTargetRef.current = null;
  }, []);

  const handleRemoveFromZone = useCallback((targetId: string) => {
    const newPlacements = new Map(placements);
    newPlacements.delete(targetId);
    setPlacements(newPlacements);

    const answerData: AnswerData = {
      type: 'drag_drop',
      placements: Array.from(newPlacements.entries()).map(([tId, sId]) => ({
        sourceId: sId,
        targetId: tId,
      })),
    };
    onChange(answerData);
  }, [placements, onChange]);

  const activeSource = activeDragId 
    ? config.sources.find(s => s.id === activeDragId)
    : null;

  return (
    <div className="space-y-6">
      <p className="text-base text-slate-700 dark:text-slate-300">
        Przeciągnij elementy do odpowiednich miejsc
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3" data-testid="drag-sources">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
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
                  isBeingDragged={activeDragId === source.id}
                />
              ))}
              {availableSources.length === 0 && !showResult && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl text-center">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">Wszystkie elementy rozmieszczone</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3" data-testid="drop-targets">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
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
                const isDraggingFromThisZone = activeDragId === placedSourceId;

                return (
                  <div key={target.id} className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                      {target.label}
                    </label>
                    <DropZone
                      id={target.id}
                      isOver={overTargetId === target.id}
                      isEmpty={!placedSource || isDraggingFromThisZone}
                      isCorrect={isCorrect}
                      isIncorrect={isIncorrect}
                    >
                      {placedSource && !isDraggingFromThisZone && (
                        <div className="relative">
                          <DraggableItem
                            id={placedSource.id}
                            content={placedSource.content}
                            imageUrl={placedSource.imageUrl}
                            disabled={disabled}
                            isCorrect={isCorrect}
                            isIncorrect={isIncorrect}
                          />
                          {!disabled && !showResult && (
                            <button
                              onClick={() => handleRemoveFromZone(target.id)}
                              className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-10"
                              data-testid={`remove-btn-${target.id}`}
                              title="Usuń"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </DropZone>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeSource && (
            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-white dark:bg-slate-800 shadow-2xl pointer-events-none">
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
