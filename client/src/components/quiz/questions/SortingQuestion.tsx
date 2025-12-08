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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  let borderClass = "border-slate-300 dark:border-slate-600 hover:border-primary/50";
  let bgClass = "bg-white dark:bg-slate-800 hover:bg-primary/5";
  let shadowClass = "hover:shadow-md";
  let positionBgClass = "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300";
  
  if (isCorrect) {
    borderClass = "border-green-500";
    bgClass = "bg-green-50 dark:bg-green-950/30";
    shadowClass = "shadow-md shadow-green-500/20";
    positionBgClass = "bg-green-500 text-white";
  } else if (isIncorrect) {
    borderClass = "border-red-500";
    bgClass = "bg-red-50 dark:bg-red-950/30";
    shadowClass = "shadow-md shadow-red-500/20";
    positionBgClass = "bg-red-500 text-white";
  } else if (disabled) {
    borderClass = "border-slate-200 dark:border-slate-700";
    bgClass = "bg-slate-100 dark:bg-slate-800/50";
    shadowClass = "";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`sortable-item-${id}`}
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
      <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full ${positionBgClass} text-sm font-bold shadow-sm`}>
        {position}
      </div>
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = items.indexOf(active.id as string);
    const newIndex = items.indexOf(over.id as string);

    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    const answerData: AnswerData = {
      type: 'sorting',
      order: newItems,
    };
    onChange(answerData);
  }, [items, onChange]);

  const getItemContent = (itemId: string) => {
    return config.items.find(i => i.id === itemId);
  };

  const activeItem = activeDragId ? getItemContent(activeDragId) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
        Ułóż elementy we właściwej kolejności przeciągając je
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-2" data-testid="sorting-items">
            {items.map((itemId, index) => {
              const item = getItemContent(itemId);
              if (!item) return null;

              const isCorrect = result?.feedback?.correctItems?.includes(itemId);
              const isIncorrect = result?.feedback?.incorrectItems?.includes(itemId);

              return (
                <SortableItem
                  key={itemId}
                  id={itemId}
                  content={item.text}
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
          {activeItem && (
            <div className="flex items-center gap-2 p-3 sm:p-4 rounded-lg border-2 border-primary bg-white dark:bg-slate-800 shadow-xl">
              <GripVertical className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              {activeItem.imageUrl && (
                <img 
                  src={activeItem.imageUrl} 
                  alt={activeItem.text} 
                  className="w-10 h-10 object-cover rounded"
                />
              )}
              <span className="text-sm sm:text-base text-slate-900 dark:text-white">{activeItem.text}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <div className="mt-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm sm:text-base text-amber-800 dark:text-amber-200">
            Poprawne pozycje: {Math.round(result.partialScore * 100)}% 
            ({result.feedback?.correctItems?.length || 0} z {config.items.length})
          </p>
        </div>
      )}

      {showResult && result?.correctAnswer?.type === 'sorting' && (
        <div className="mt-4 p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            Prawidłowa kolejność:
          </p>
          <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
            {result.correctAnswer.order.map((itemId, index) => {
              const item = getItemContent(itemId);
              return (
                <li key={itemId}>
                  {item?.text || itemId}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
