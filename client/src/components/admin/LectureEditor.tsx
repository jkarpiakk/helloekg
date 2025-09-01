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

// Temporary disabled visual editor
const VisualLectureEditor = ({ sectionId, sectionTitle, chapter, onSave, onCancel }: any) => (
  <div className="p-8 text-center">
    <h2 className="text-xl font-bold mb-4">Wizualny Edytor Wykładu</h2>
    <p className="mb-4">Funkcja w przygotowaniu...</p>
    <Button onClick={onCancel}>Powrót</Button>
  </div>
);

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
            onSave={async (data) => {
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