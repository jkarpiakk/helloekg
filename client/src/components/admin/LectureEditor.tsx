import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash, Save, X, Presentation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { VisualElement } from "@shared/schema";

// Full Visual Lecture Editor Implementation
const VisualLectureEditor = ({ sectionId, sectionTitle, chapter, onSave, onCancel }: any) => {
  const { toast } = useToast();
  const [title, setTitle] = useState(chapter?.title || "");
  const [elements, setElements] = useState<VisualElement[]>(chapter?.visualContent || []);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const generateId = () => Math.random().toString(36).substring(7);

  const addElement = (type: VisualElement['type']) => {
    const newElement: VisualElement = {
      id: generateId(),
      type,
      content: type === 'text' ? 'Nowy tekst' : type === 'heading' ? 'Nowy nagłówek' : '',
      position: { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 },
      size: { width: type === 'image' ? 200 : 300, height: type === 'image' ? 150 : type === 'heading' ? 60 : 40 },
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

  const updateElement = (id: string, updates: Partial<VisualElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElement === id) setSelectedElement(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Błąd", description: "Tytuł rozdziału jest wymagany", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), visualContent: elements });
      toast({ title: "Sukces", description: "Rozdział zapisany pomyślnie" });
    } catch (error) {
      toast({ title: "Błąd", description: "Nie udało się zapisać rozdziału", variant: "destructive" });
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

        <div className="space-y-2">
          <h3 className="font-medium">Dodaj elementy</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => addElement('heading')} data-testid="button-add-heading">
              <Plus className="w-4 h-4 mr-2" />
              Nagłówek
            </Button>
            <Button variant="outline" onClick={() => addElement('text')} data-testid="button-add-text">
              <Plus className="w-4 h-4 mr-2" />
              Tekst
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => document.getElementById('image-upload')?.click()}
            data-testid="button-add-image"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dodaj obrazek
          </Button>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              
              if (!file.type.startsWith('image/')) {
                toast({ title: "Błąd", description: "Proszę wybrać plik obrazu", variant: "destructive" });
                return;
              }
              
              if (file.size > 10 * 1024 * 1024) {
                toast({ title: "Błąd", description: "Plik jest za duży. Maksymalny rozmiar to 10MB", variant: "destructive" });
                return;
              }
              
              try {
                const uploadResponse = await apiRequest("POST", "/api/objects/upload");
                const { uploadURL } = await uploadResponse.json();
                
                const uploadResult = await fetch(uploadURL, {
                  method: 'PUT',
                  body: file,
                  headers: { 'Content-Type': file.type },
                });
                
                if (!uploadResult.ok) throw new Error('Upload failed');
                
                const imageUrl = uploadURL.split('?')[0];
                await apiRequest("PUT", "/api/lecture-images", { imageURL: imageUrl });
                
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
                
                toast({ title: "Sukces", description: "Obrazek został dodany" });
              } catch (error) {
                toast({ title: "Błąd", description: "Nie udało się przesłać obrazka", variant: "destructive" });
              }
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>

        {selectedEl && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Edycja elementu</h3>
              <Button variant="destructive" size="sm" onClick={() => deleteElement(selectedEl.id)} data-testid="button-delete-element">
                <Trash className="w-4 h-4" />
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

            {selectedEl.type === 'image' && (
              <div className="space-y-3">
                <Label>Szerokość: {selectedEl.size.width}px</Label>
                <input
                  type="range"
                  min="50"
                  max="800"
                  value={selectedEl.size.width}
                  onChange={(e) => updateElement(selectedEl.id, { 
                    size: { ...selectedEl.size, width: parseInt(e.target.value) }
                  })}
                  className="w-full"
                  data-testid="slider-image-width"
                />
                
                <Label>Wysokość: {selectedEl.size.height}px</Label>
                <input
                  type="range"
                  min="50"
                  max="600"
                  value={selectedEl.size.height}
                  onChange={(e) => updateElement(selectedEl.id, { 
                    size: { ...selectedEl.size, height: parseInt(e.target.value) }
                  })}
                  className="w-full"
                  data-testid="slider-image-height"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Rozmiar czcionki: {selectedEl.style.fontSize}px</Label>
              <input
                type="range"
                min="10"
                max="72"
                value={selectedEl.style.fontSize || 16}
                onChange={(e) => updateElement(selectedEl.id, { 
                  style: { ...selectedEl.style, fontSize: parseInt(e.target.value) }
                })}
                className="w-full"
                data-testid="slider-font-size"
              />
            </div>

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
          </div>
        )}

        <div className="flex space-x-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={saving} className="flex-1" data-testid="button-save-chapter">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-edit">
            Anuluj
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <div className="absolute inset-0 p-4">
          {elements.map((element) => (
            <div
              key={element.id}
              style={{
                position: 'absolute',
                left: element.position.x,
                top: element.position.y,
                width: element.size.width,
                fontSize: element.style.fontSize || 16,
                fontWeight: element.style.fontWeight || 'normal',
                color: element.style.color || '#000000',
                textAlign: element.style.textAlign || 'left',
                cursor: 'move',
                outline: selectedElement === element.id ? '2px solid #3b82f6' : 'none',
                background: selectedElement === element.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                padding: '8px',
                borderRadius: '4px'
              }}
              onClick={() => setSelectedElement(element.id)}
              onMouseDown={(e) => {
                if (selectedElement !== element.id) return;
                const startX = e.clientX - element.position.x;
                const startY = e.clientY - element.position.y;
                
                const handleMouseMove = (e: MouseEvent) => {
                  updateElement(element.id, {
                    position: {
                      x: Math.max(0, e.clientX - startX),
                      y: Math.max(0, e.clientY - startY)
                    }
                  });
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
              data-testid={`element-${element.id}`}
            >
              {element.type === 'image' ? (
                <img
                  src={element.content}
                  alt="Uploaded content"
                  style={{
                    width: element.size.width,
                    height: element.size.height,
                    objectFit: 'contain',
                    borderRadius: '4px',
                  }}
                />
              ) : element.type === 'heading' ? (
                <h2>{element.content}</h2>
              ) : (
                <p>{element.content}</p>
              )}
            </div>
          ))}
        </div>
        
        <div className="absolute bottom-4 left-4 text-sm text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded">
          Elementy: {elements.length} | Kliknij element, aby go edytować i przeciągnąć
        </div>
      </div>
    </div>
  );
};

interface LectureChapter {
  id: string;
  title: string;
  contentMd: string;
  analogy?: string;
  keyPoints: string[];
  visual?: string;
  visualContent: VisualElement[];
  order: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LectureEditorProps {
  sectionId: string;
  sectionTitle: string;
}

export function LectureEditor({ sectionId, sectionTitle }: LectureEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingChapter, setEditingChapter] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    contentMd: "",
    analogy: "",
    keyPoints: [""],
    visual: "",
    visualContent: [] as VisualElement[],
    order: 1,
    isPublished: false,
  });
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [visualEditingChapter, setVisualEditingChapter] = useState<LectureChapter | null>(null);

  const { data: chapters, isLoading } = useQuery({
    queryKey: ["/api/admin/sections", sectionId, "chapters"],
    queryFn: () => apiRequest("GET", `/api/admin/sections/${sectionId}/chapters`).then(res => res.json()),
  });

  const createChapterMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/admin/sections/${sectionId}/chapters`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sections", sectionId, "chapters"] });
      setIsCreating(false);
      resetForm();
      toast({ title: "Rozdział dodany pomyślnie" });
    },
    onError: () => {
      toast({ title: "Błąd podczas dodawania rozdziału", variant: "destructive" });
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PUT", `/api/admin/chapters/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sections", sectionId, "chapters"] });
      setEditingChapter(null);
      resetForm();
      toast({ title: "Rozdział zaktualizowany pomyślnie" });
    },
    onError: () => {
      toast({ title: "Błąd podczas aktualizacji rozdziału", variant: "destructive" });
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/chapters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sections", sectionId, "chapters"] });
      toast({ title: "Rozdział usunięty pomyślnie" });
    },
    onError: () => {
      toast({ title: "Błąd podczas usuwania rozdziału", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      contentMd: "",
      analogy: "",
      keyPoints: [""],
      visual: "",
      visualContent: [],
      order: (chapters?.length || 0) + 1,
      isPublished: false,
    });
  };

  const handleEdit = (chapter: LectureChapter) => {
    setFormData({
      title: chapter.title,
      contentMd: chapter.contentMd,
      analogy: chapter.analogy || "",
      keyPoints: chapter.keyPoints.length > 0 ? chapter.keyPoints : [""],
      visual: chapter.visual || "",
      visualContent: chapter.visualContent || [],
      order: chapter.order,
      isPublished: chapter.isPublished,
    });
    setEditingChapter(chapter.id);
  };

  const handleSave = () => {
    const cleanedKeyPoints = formData.keyPoints.filter(point => point.trim() !== "");
    
    if (editingChapter) {
      updateChapterMutation.mutate({
        id: editingChapter,
        data: { ...formData, keyPoints: cleanedKeyPoints },
      });
    } else {
      createChapterMutation.mutate({ ...formData, keyPoints: cleanedKeyPoints });
    }
  };

  const handleCancel = () => {
    setEditingChapter(null);
    setIsCreating(false);
    resetForm();
  };

  const addKeyPoint = () => {
    setFormData(prev => ({
      ...prev,
      keyPoints: [...prev.keyPoints, ""]
    }));
  };

  const updateKeyPoint = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      keyPoints: prev.keyPoints.map((point, i) => i === index ? value : point)
    }));
  };

  const removeKeyPoint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      keyPoints: prev.keyPoints.filter((_, i) => i !== index)
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8" data-testid="loading-lectures">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold" data-testid="section-title">Wykład: {sectionTitle}</h2>
          <p className="text-muted-foreground">Zarządzaj rozdziałami wykładu</p>
        </div>
        <Button 
          onClick={() => setIsCreating(true)}
          disabled={isCreating || editingChapter !== null}
          data-testid="button-add-chapter"
        >
          <Plus className="w-4 h-4 mr-2" />
          Dodaj rozdział
        </Button>
      </div>

      {/* Form for creating/editing */}
      {(isCreating || editingChapter) && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">
              {editingChapter ? "Edytuj rozdział" : "Nowy rozdział"}
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Tytuł rozdziału</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="np. Węzeł zatokowy - Dyrygent serca"
                  data-testid="input-chapter-title"
                />
              </div>
              <div>
                <Label htmlFor="order">Kolejność</Label>
                <Input
                  id="order"
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
                  data-testid="input-chapter-order"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="contentMd">Treść (Markdown)</Label>
              <Textarea
                id="contentMd"
                value={formData.contentMd}
                onChange={(e) => setFormData(prev => ({ ...prev, contentMd: e.target.value }))}
                placeholder="Treść rozdziału w formacie Markdown..."
                className="min-h-[200px]"
                data-testid="textarea-chapter-content"
              />
            </div>

            <div>
              <Label htmlFor="analogy">Analogia</Label>
              <Input
                id="analogy"
                value={formData.analogy}
                onChange={(e) => setFormData(prev => ({ ...prev, analogy: e.target.value }))}
                placeholder="np. Węzeł zatokowy = Dyrygent orkiestry"
                data-testid="input-chapter-analogy"
              />
            </div>

            <div>
              <Label>Kluczowe punkty</Label>
              {formData.keyPoints.map((point, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    value={point}
                    onChange={(e) => updateKeyPoint(index, e.target.value)}
                    placeholder="Kluczowy punkt..."
                    data-testid={`input-key-point-${index}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeKeyPoint(index)}
                    data-testid={`button-remove-key-point-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addKeyPoint}
                data-testid="button-add-key-point"
              >
                <Plus className="w-4 h-4 mr-2" />
                Dodaj punkt
              </Button>
            </div>

            <div>
              <Label htmlFor="visual">Element wizualny</Label>
              <Input
                id="visual"
                value={formData.visual}
                onChange={(e) => setFormData(prev => ({ ...prev, visual: e.target.value }))}
                placeholder="np. conductor, orchestra, traffic"
                data-testid="input-chapter-visual"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isPublished"
                checked={formData.isPublished}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublished: checked }))}
                data-testid="switch-chapter-published"
              />
              <Label htmlFor="isPublished">Opublikowany</Label>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSave}
                disabled={createChapterMutation.isPending || updateChapterMutation.isPending}
                data-testid="button-save-chapter"
              >
                <Save className="w-4 h-4 mr-2" />
                Zapisz
              </Button>
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-chapter">
                <X className="w-4 h-4 mr-2" />
                Anuluj
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chapters list */}
      <div className="space-y-4">
        {chapters?.map((chapter: LectureChapter) => (
          <Card key={chapter.id} data-testid={`chapter-${chapter.id}`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">#{chapter.order}</span>
                    <h3 className="text-lg font-medium" data-testid={`chapter-title-${chapter.id}`}>
                      {chapter.title}
                    </h3>
                    {chapter.isPublished ? (
                      <Badge variant="default" data-testid={`badge-published-${chapter.id}`}>Opublikowane</Badge>
                    ) : (
                      <Badge variant="secondary" data-testid={`badge-draft-${chapter.id}`}>Szkic</Badge>
                    )}
                  </div>
                  
                  {chapter.analogy && (
                    <p className="text-sm text-blue-600 mb-2" data-testid={`chapter-analogy-${chapter.id}`}>
                      💡 {chapter.analogy}
                    </p>
                  )}
                  
                  <p className="text-sm text-muted-foreground mb-2" data-testid={`chapter-content-preview-${chapter.id}`}>
                    {chapter.contentMd.substring(0, 150)}...
                  </p>
                  
                  {chapter.keyPoints.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-medium mb-1">Kluczowe punkty:</p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {chapter.keyPoints.slice(0, 3).map((point, index) => (
                          <li key={index} data-testid={`key-point-${chapter.id}-${index}`}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setVisualEditingChapter(chapter);
                      setShowVisualEditor(true);
                    }}
                    title="Edytor wizualny"
                    data-testid={`button-visual-editor-${chapter.id}`}
                  >
                    <Presentation className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(chapter)}
                    disabled={editingChapter !== null || isCreating}
                    data-testid={`button-edit-chapter-${chapter.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteChapterMutation.mutate(chapter.id)}
                    disabled={deleteChapterMutation.isPending}
                    data-testid={`button-delete-chapter-${chapter.id}`}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {chapters?.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center" data-testid="empty-chapters">
              <p className="text-muted-foreground">Brak rozdziałów wykładu</p>
              <p className="text-sm text-muted-foreground mt-1">
                Kliknij "Dodaj rozdział", aby utworzyć pierwszy rozdział wykładu.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Visual Lecture Editor Modal */}
      {showVisualEditor && visualEditingChapter && (
        <div className="fixed inset-0 z-50 bg-background">
          <VisualLectureEditor
            sectionId={sectionId}
            sectionTitle={sectionTitle}
            chapter={visualEditingChapter}
            onSave={async (data: { title: string; visualContent: VisualElement[] }) => {
              await updateChapterMutation.mutateAsync({
                id: visualEditingChapter.id,
                data: {
                  title: data.title,
                  contentMd: visualEditingChapter.contentMd,
                  visualContent: data.visualContent,
                  analogy: visualEditingChapter.analogy,
                  keyPoints: visualEditingChapter.keyPoints,
                  visual: visualEditingChapter.visual,
                  order: visualEditingChapter.order,
                  isPublished: visualEditingChapter.isPublished,
                }
              });
              setShowVisualEditor(false);
              setVisualEditingChapter(null);
            }}
            onCancel={() => {
              setShowVisualEditor(false);
              setVisualEditingChapter(null);
            }}
          />
        </div>
      )}
    </div>
  );
}