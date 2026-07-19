import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { Move3D } from "lucide-react";
import type { VisualElement } from "@shared/schema";

interface DraggableElementProps {
  element: VisualElement;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<VisualElement>) => void;
}

export function DraggableElement({ 
  element, 
  isSelected, 
  onSelect, 
  onUpdate 
}: DraggableElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'absolute' as const,
    left: element.position.x,
    top: element.position.y,
    width: element.size.width,
    height: element.type === 'image' ? element.size.height : 'auto',
    zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(element.id);
  };

  const handleDoubleClick = () => {
    if (element.type !== 'image') {
      setIsEditing(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onUpdate(element.id, { content: e.target.value });
  };

  const elementStyle: React.CSSProperties = {
    fontSize: element.style.fontSize || 16,
    fontWeight: element.style.fontWeight || 'normal',
    color: element.style.color || '#000000',
    textAlign: element.style.textAlign || 'left',
    cursor: isDragging ? 'grabbing' : 'pointer',
    userSelect: isEditing ? 'text' : 'none',
    outline: isSelected ? '2px solid #3EE6A8' : 'none',
    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
  };

  const renderContent = () => {
    if (element.type === 'image') {
      return (
        <img
          src={element.content}
          alt="Uploaded content"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: '4px',
          }}
          data-testid={`image-element-${element.id}`}
        />
      );
    }

    if (isEditing) {
      return element.type === 'heading' ? (
        <input
          type="text"
          value={element.content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          style={{
            ...elementStyle,
            border: 'none',
            background: 'transparent',
            width: '100%',
            outline: 'none',
          }}
          data-testid={`input-element-${element.id}`}
        />
      ) : (
        <textarea
          value={element.content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          style={{
            ...elementStyle,
            border: 'none',
            background: 'transparent',
            width: '100%',
            minHeight: '40px',
            resize: 'none',
            outline: 'none',
          }}
          data-testid={`textarea-element-${element.id}`}
        />
      );
    }

    return element.type === 'heading' ? (
      <h2 style={elementStyle} data-testid={`heading-element-${element.id}`}>
        {element.content}
      </h2>
    ) : (
      <p style={elementStyle} data-testid={`text-element-${element.id}`}>
        {element.content}
      </p>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`group relative ${isDragging ? 'opacity-50' : ''}`}
      data-testid={`draggable-element-${element.id}`}
    >
      {/* Drag handle */}
      {isSelected && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -top-6 -right-6 w-6 h-6 bg-primary text-primary-foreground rounded flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`drag-handle-${element.id}`}
        >
          <Move3D className="w-3 h-3" />
        </div>
      )}

      {/* Content */}
      {renderContent()}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-primary/70 rounded" />
      )}
    </div>
  );
}