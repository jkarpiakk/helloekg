import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, X } from "lucide-react";
import type { SortingConfig, AnswerData, QuizResult } from "@/types";

interface SortingQuestionProps {
  config: SortingConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

function getItemText(item: { id: string; text?: string; content?: string }): string {
  if (typeof item.content === 'string') return item.content;
  if (typeof item.text === 'string') return item.text;
  return item.id;
}

interface SortableItemProps {
  id: string;
  content: string;
  imageUrl?: string;
  position: number;
  disabled: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
}

function SortableItem({ id, content, imageUrl, position, disabled, isCorrect, isIncorrect }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  let borderClass = "border-slate-300 dark:border-slate-600";
  let bgClass = "bg-white dark:bg-slate-800";
  let positionBgClass = "bg-slate-700 text-white";
  
  if (isCorrect) {
    borderClass = "border-green-500";
    bgClass = "bg-green-50 dark:bg-green-950/30";
    positionBgClass = "bg-green-500 text-white";
  } else if (isIncorrect) {
    borderClass = "border-red-500";
    bgClass = "bg-red-50 dark:bg-red-950/30";
    positionBgClass = "bg-red-500 text-white";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`sortable-item-${id}`}
      className={`
        flex items-center gap-3 p-4 rounded-xl border-2 shadow-sm
        ${borderClass} ${bgClass}
        ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
        touch-manipulation select-none
      `}
      {...attributes}
      {...listeners}
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${positionBgClass} text-sm font-bold shadow-sm flex-shrink-0`}>
        {position}
      </div>
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
      <span className="text-base flex-1 font-medium text-slate-900 dark:text-white">{content}</span>
      {isCorrect && <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />}
      {isIncorrect && <X className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />}
    </div>
  );
}

interface DragOverlayItemProps {
  content: string;
  imageUrl?: string;
  position: number;
}

function DragOverlayItem({ content, imageUrl, position }: DragOverlayItemProps) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-white dark:bg-slate-800 shadow-2xl cursor-grabbing">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold shadow-sm flex-shrink-0">
        {position}
      </div>
      <GripVertical className="h-5 w-5 text-primary flex-shrink-0" />
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt={content} 
          className="w-12 h-12 object-cover rounded-lg"
        />
      )}
      <span className="text-base font-medium text-slate-900 dark:text-white">{content}</span>
    </div>
  );
}

export default function SortingQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: SortingQuestionProps) {
  const [items, setItems] = useState<string[]>(() => {
    const shuffled = [...config.items.map(i => i.id)];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });
  
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = items.indexOf(active.id as string);
    const newIndex = items.indexOf(over.id as string);

    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    const answerData: AnswerData = {
      type: 'sorting',
      order: newItems,
    };
    onChange(answerData);
  }, [items, onChange]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const getItemById = (itemId: string) => {
    return config.items.find(i => i.id === itemId);
  };

  const activeItem = activeId ? getItemById(activeId) : null;
  const activeIndex = activeId ? items.indexOf(activeId) : -1;

  return (
    <div className="space-y-6">
      <p className="text-base text-slate-700 dark:text-slate-300">
        Ułóż elementy we właściwej kolejności przeciągając je
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-2" data-testid="sorting-items">
            {items.map((itemId, index) => {
              const item = getItemById(itemId);
              if (!item) return null;

              const isCorrect = result?.feedback?.correctItems?.includes(itemId);
              const isIncorrect = result?.feedback?.incorrectItems?.includes(itemId);
              const itemText = getItemText(item);

              return (
                <SortableItem
                  key={itemId}
                  id={itemId}
                  content={itemText}
                  imageUrl={item.imageUrl}
                  position={index + 1}
                  disabled={disabled}
                  isCorrect={isCorrect}
                  isIncorrect={isIncorrect}
                />
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem && activeIndex >= 0 && (
            <DragOverlayItem
              content={getItemText(activeItem)}
              imageUrl={activeItem.imageUrl}
              position={activeIndex + 1}
            />
          )}
        </DragOverlay>
      </DndContext>

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-base text-amber-800 dark:text-amber-200">
            Poprawne pozycje: {Math.round(result.partialScore * 100)}% 
            ({result.feedback?.correctItems?.length || 0} z {config.items.length})
          </p>
        </div>
      )}

      {showResult && result?.correctAnswer?.type === 'sorting' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Prawidłowa kolejność:
          </p>
          <ol className="list-decimal list-inside text-base text-blue-700 dark:text-blue-300 space-y-1">
            {result.correctAnswer.order.map((itemId: string) => {
              const item = getItemById(itemId);
              return (
                <li key={itemId} className="font-medium">
                  {item ? getItemText(item) : itemId}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
