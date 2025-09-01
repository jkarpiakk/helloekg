import { useState, useCallback } from "react";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Type, 
  Image, 
  Heading1, 
  Save, 
  Plus, 
  Trash2, 
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Move3D
} from "lucide-react";
import type { VisualElement } from "@shared/schema";
import { DraggableElement } from "./DraggableElement";
import { ImageUploader } from "./ImageUploader";

interface VisualLectureEditorProps {
  sectionId: string;
  sectionTitle: string;
  chapter?: {
    id: string;
    title: string;
    visualContent: VisualElement[];
  } | null;
  onSave: (data: {
    title: string;
    visualContent: VisualElement[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function VisualLectureEditor({ 
  sectionId, 
  sectionTitle, 
  chapter, 
  onSave, 
  onCancel 
}: VisualLectureEditorProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(chapter?.title || "");
  const [elements, setElements] = useState<VisualElement[]>(
    chapter?.visualContent || []
  );
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const generateId = () => Math.random().toString(36).substring(7);

  const addElement = (type: VisualElement['type']) => {
    const newElement: VisualElement = {
      id: generateId(),
      type,
      content: type === 'text' ? 'Nowy tekst' : 
               type === 'heading' ? 'Nowy nagłówek' : '',
      position: { 
        x: Math.random() * 400 + 50, 
        y: Math.random() * 300 + 50 
      },
      size: { 
        width: type === 'image' ? 200 : 300, 
        height: type === 'image' ? 150 : type === 'heading' ? 60 : 40 
      },
      style: {
        fontSize: type === 'heading' ? 24 : 16,
        fontWeight: type === 'heading' ? 'bold' : 'normal',
        color: '#000000',
        textAlign: 'left'
      }
    };
    
    setElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const updateElement = useCallback((id: string, updates: Partial<VisualElement>) => {
    setElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ));
  }, []);

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElement === id) {
      setSelectedElement(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    
    if (delta.x !== 0 || delta.y !== 0) {
      updateElement(active.id as string, {
        position: {
          x: Math.max(0, elements.find(el => el.id === active.id)!.position.x + delta.x),
          y: Math.max(0, elements.find(el => el.id === active.id)!.position.y + delta.y),
        }
      });
    }

    setActiveId(null);
  };

  const handleImageUpload = (imageUrl: string) => {
    const newElement: VisualElement = {
      id: generateId(),
      type: 'image',
      content: imageUrl,
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 },
      style: {}
    };
    
    setElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Błąd",
        description: "Tytuł rozdziału jest wymagany",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        visualContent: elements
      });
      toast({
        title: "Sukces",
        description: "Rozdział zapisany pomyślnie"
      });
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się zapisać rozdziału",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedEl = selectedElement ? elements.find(el => el.id === selectedElement) : null;

  return (
    <div className="flex h-screen bg-background">
      {/* Toolbar */}
      <div className="w-80 border-r border-border bg-muted/30 p-4 space-y-4">
        <div className="space-y-2">
          <Label>Tytuł rozdziału</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Wprowadź tytuł..."
            data-testid="input-chapter-title"
          />
        </div>

        <Tabs defaultValue="add" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">Dodaj</TabsTrigger>
            <TabsTrigger value="edit">Edytuj</TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-2">
            <h3 className="font-medium">Dodaj elementy</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                onClick={() => addElement('heading')}
                data-testid="button-add-heading"
              >
                <Heading1 className="w-4 h-4 mr-2" />
                Nagłówek
              </Button>
              <Button 
                variant="outline" 
                onClick={() => addElement('text')}
                data-testid="button-add-text"
              >
                <Type className="w-4 h-4 mr-2" />
                Tekst
              </Button>
            </div>
            <ImageUploader onUpload={handleImageUpload} />
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            {selectedEl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Edycja elementu</h3>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deleteElement(selectedEl.id)}
                    data-testid="button-delete-element"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {selectedEl.type !== 'image' && (
                  <div className="space-y-2">
                    <Label>Treść</Label>
                    <Textarea
                      value={selectedEl.content}
                      onChange={(e) => updateElement(selectedEl.id, { content: e.target.value })}
                      rows={3}
                      data-testid="textarea-element-content"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <Label>Rozmiar czcionki: {selectedEl.style.fontSize}px</Label>
                  <Slider
                    value={[selectedEl.style.fontSize || 16]}
                    onValueChange={([value]) => 
                      updateElement(selectedEl.id, { 
                        style: { ...selectedEl.style, fontSize: value }
                      })
                    }
                    min={10}
                    max={72}
                    step={1}
                    data-testid="slider-font-size"
                  />
                </div>

                {selectedEl.type !== 'image' && (
                  <div className="space-y-2">
                    <Label>Wyrównanie</Label>
                    <div className="flex space-x-1">
                      {[
                        { value: 'left', icon: AlignLeft },
                        { value: 'center', icon: AlignCenter },
                        { value: 'right', icon: AlignRight }
                      ].map(({ value, icon: Icon }) => (
                        <Button
                          key={value}
                          variant={selectedEl.style.textAlign === value ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateElement(selectedEl.id, {
                            style: { ...selectedEl.style, textAlign: value as any }
                          })}
                          data-testid={`button-align-${value}`}
                        >
                          <Icon className="w-4 h-4" />
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Kolor tekstu</Label>
                  <Input
                    type="color"
                    value={selectedEl.style.color || '#000000'}
                    onChange={(e) => updateElement(selectedEl.id, {
                      style: { ...selectedEl.style, color: e.target.value }
                    })}
                    data-testid="input-text-color"
                  />
                </div>

                {selectedEl.type === 'image' && (
                  <div className="space-y-3">
                    <Label>Szerokość: {selectedEl.size.width}px</Label>
                    <Slider
                      value={[selectedEl.size.width]}
                      onValueChange={([width]) => 
                        updateElement(selectedEl.id, { 
                          size: { ...selectedEl.size, width }
                        })
                      }
                      min={50}
                      max={800}
                      step={10}
                      data-testid="slider-image-width"
                    />
                    
                    <Label>Wysokość: {selectedEl.size.height}px</Label>
                    <Slider
                      value={[selectedEl.size.height]}
                      onValueChange={([height]) => 
                        updateElement(selectedEl.id, { 
                          size: { ...selectedEl.size, height }
                        })
                      }
                      min={50}
                      max={600}
                      step={10}
                      data-testid="slider-image-height"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Wybierz element na kanwie aby go edytować
              </p>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex space-x-2 pt-4 border-t">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1"
            data-testid="button-save-chapter"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel-edit"
          >
            Anuluj
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="absolute inset-0 p-4">
            {elements.map((element) => (
              <DraggableElement
                key={element.id}
                element={element}
                isSelected={selectedElement === element.id}
                onSelect={setSelectedElement}
                onUpdate={updateElement}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId && (
              <div className="opacity-50">
                {elements.find(el => el.id === activeId) && (
                  <DraggableElement
                    element={elements.find(el => el.id === activeId)!}
                    isSelected={false}
                    onSelect={() => {}}
                    onUpdate={() => {}}
                  />
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Canvas info */}
        <div className="absolute bottom-4 left-4 text-sm text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded">
          Elementy: {elements.length}
        </div>
      </div>
    </div>
  );
}