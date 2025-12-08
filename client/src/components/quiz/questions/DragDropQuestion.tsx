import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  useDraggable,
  MeasuringStrategy,
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

const SOURCE_PREFIX = "source:";
const PLACED_PREFIX = "placed:";

function parseId(id: string): { type: 'source' | 'placed'; sourceId: string; targetId?: string } {
  if (id.startsWith(SOURCE_PREFIX)) {
    return { type: 'source', sourceId: id.slice(SOURCE_PREFIX.length) };
  }
  if (id.startsWith(PLACED_PREFIX)) {
    const rest = id.slice(PLACED_PREFIX.length);
    const [targetId, sourceId] = rest.split(':');
    return { type: 'placed', sourceId, targetId };
  }
  return { type: 'source', sourceId: id };
}

interface DraggableItemProps {
  dragId: string;
  content: string;
  imageUrl?: string;
  disabled: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
}

function DraggableItem({ dragId, content, imageUrl, disabled, isCorrect, isIncorrect }: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ 
    id: dragId,
    disabled,
  });

  const style: React.CSSProperties = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : 1,
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
      data-testid={`draggable-item-${parseId(dragId).sourceId}`}
      className={`
        flex items-center gap-3 p-4 rounded-xl border-2 shadow-sm
        ${borderClass} ${bgClass}
        ${isDragging ? "opacity-40 shadow-2xl" : ""}
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
  label: string;
  isOver: boolean;
  hasItem: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
  children?: React.ReactNode;
}

function DropZone({ id, label, isOver, hasItem, isCorrect, isIncorrect, children }: DropZoneProps) {
  const { setNodeRef, isOver: isOverThis } = useDroppable({ id });
  
  const isHighlighted = isOver || isOverThis;
  
  let containerClass = "border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/30";
  
  if (isHighlighted) {
    containerClass = "border-2 border-dashed border-primary bg-primary/10 ring-2 ring-primary/30";
  } else if (hasItem) {
    if (isCorrect) {
      containerClass = "border-2 border-solid border-green-500 bg-green-50 dark:bg-green-950/30";
    } else if (isIncorrect) {
      containerClass = "border-2 border-solid border-red-500 bg-red-50 dark:bg-red-950/30";
    } else {
      containerClass = "border-2 border-solid border-primary/50 bg-white dark:bg-slate-800";
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
        {label}
      </label>
      <div
        ref={setNodeRef}
        data-testid={`drop-zone-${id}`}
        className={`min-h-[80px] p-2 rounded-xl transition-colors duration-150 ${containerClass}`}
      >
        {children || (
          <div className="flex flex-col items-center justify-center h-full min-h-[64px] gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center">
              <span className="text-slate-500 dark:text-slate-400 text-xl font-light">+</span>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Upuść tutaj</span>
          </div>
        )}
      </div>
    </div>
  );
}

const SOURCE_CONTAINER_ID = "source-container";

export default function DragDropQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: DragDropQuestionProps) {
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const placedSourceIds = useMemo(() => new Set(Object.values(placements)), [placements]);
  const availableSources = useMemo(
    () => config.sources.filter(source => !placedSourceIds.has(String(source.id))),
    [config.sources, placedSourceIds]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overId = String(over.id);
    const parsed = parseId(activeIdStr);
    const sourceId = String(parsed.sourceId);
    
    const isTarget = config.targets.some(t => String(t.id) === overId);
    const isSourceContainer = overId === SOURCE_CONTAINER_ID;
    
    if (!isTarget && !isSourceContainer) return;

    // Use functional update to avoid stale closure
    setPlacements(prevPlacements => {
      // Find current target for this source
      let currentTargetId: string | null = null;
      for (const [tId, sId] of Object.entries(prevPlacements)) {
        if (sId === sourceId) {
          currentTargetId = tId;
          break;
        }
      }

      // Handle return to source container
      if (isSourceContainer) {
        if (currentTargetId) {
          const newPlacements = { ...prevPlacements };
          delete newPlacements[currentTargetId];
          
          // Trigger onChange with new state
          setTimeout(() => {
            onChange({
              type: 'drag_drop',
              placements: Object.entries(newPlacements).map(([targetId, srcId]) => ({
                sourceId: srcId,
                targetId,
              })),
            });
          }, 0);
          
          return newPlacements;
        }
        return prevPlacements;
      }

      // Handle drop on target
      const newPlacements = { ...prevPlacements };
      
      // Remove from old target if moving
      if (currentTargetId && currentTargetId !== overId) {
        delete newPlacements[currentTargetId];
      }
      
      // Swap if target already has an item
      const existingSourceInTarget = newPlacements[overId];
      if (existingSourceInTarget && existingSourceInTarget !== sourceId) {
        if (currentTargetId) {
          newPlacements[currentTargetId] = existingSourceInTarget;
        }
      }
      
      // Place in new target
      newPlacements[overId] = sourceId;

      // Trigger onChange with new state
      setTimeout(() => {
        onChange({
          type: 'drag_drop',
          placements: Object.entries(newPlacements).map(([targetId, srcId]) => ({
            sourceId: srcId,
            targetId,
          })),
        });
      }, 0);

      return newPlacements;
    });
  }, [config.targets, onChange]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleRemoveFromZone = useCallback((targetId: string) => {
    setPlacements(prevPlacements => {
      const newPlacements = { ...prevPlacements };
      delete newPlacements[targetId];
      
      setTimeout(() => {
        onChange({
          type: 'drag_drop',
          placements: Object.entries(newPlacements).map(([tId, srcId]) => ({
            sourceId: srcId,
            targetId: tId,
          })),
        });
      }, 0);
      
      return newPlacements;
    });
  }, [onChange]);

  const activeSourceId = activeId ? String(parseId(activeId).sourceId) : null;
  const activeSource = activeSourceId 
    ? config.sources.find(s => String(s.id) === activeSourceId)
    : null;

  const { setNodeRef: setSourceContainerRef } = useDroppable({ 
    id: SOURCE_CONTAINER_ID 
  });

  return (
    <div className="space-y-6">
      <p className="text-base text-slate-700 dark:text-slate-300">
        Przeciągnij elementy do odpowiednich miejsc
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Elementy do przeciągnięcia
            </h4>
            <div 
              ref={setSourceContainerRef}
              className="space-y-2 min-h-[100px] p-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700"
              data-testid="drag-sources"
            >
              {availableSources.map(source => {
                const sourceIdStr = String(source.id);
                return (
                  <DraggableItem
                    key={sourceIdStr}
                    dragId={`${SOURCE_PREFIX}${sourceIdStr}`}
                    content={source.content}
                    imageUrl={source.imageUrl}
                    disabled={disabled}
                  />
                );
              })}
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
                const targetIdStr = String(target.id);
                const placedSourceId = placements[targetIdStr];
                const placedSource = placedSourceId 
                  ? config.sources.find(s => String(s.id) === placedSourceId)
                  : undefined;

                const isCorrect = showResult && result?.feedback?.correctItems?.includes(target.id);
                const isIncorrect = showResult && result?.feedback?.incorrectItems?.includes(target.id);
                const isBeingDragged = activeSourceId === placedSourceId;

                return (
                  <DropZone
                    key={targetIdStr}
                    id={targetIdStr}
                    label={target.label}
                    isOver={false}
                    hasItem={!!placedSource && !isBeingDragged}
                    isCorrect={isCorrect}
                    isIncorrect={isIncorrect}
                  >
                    {placedSource && !isBeingDragged && (
                      <div className="relative">
                        <DraggableItem
                          dragId={`${PLACED_PREFIX}${targetIdStr}:${String(placedSource.id)}`}
                          content={placedSource.content}
                          imageUrl={placedSource.imageUrl}
                          disabled={disabled}
                          isCorrect={isCorrect}
                          isIncorrect={isIncorrect}
                        />
                        {!disabled && !showResult && (
                          <button
                            onClick={() => handleRemoveFromZone(targetIdStr)}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg z-10"
                            data-testid={`remove-btn-${targetIdStr}`}
                            title="Usuń"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </DropZone>
                );
              })}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeSource && (
            <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-white dark:bg-slate-800 shadow-2xl cursor-grabbing">
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
