import { useState, useEffect } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  Eye, Plus, Trash2, Save, GripVertical, 
  ListChecks, Puzzle, TextCursor, Link2, ArrowUpDown, Target,
  Upload, Image as ImageIcon
} from "lucide-react";
import { 
  DragDropEditor, 
  FillBlankEditor, 
  MatchingEditor, 
  SortingEditor, 
  HotspotEditor 
} from "./QuestionTypeEditors";
import type { DemoQuestion, QuestionConfig } from "@shared/schema";
import type { QuestionType } from "@/types";

const demoQuillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }],
    ['link'],
    ['clean']
  ],
  clipboard: {
    matchVisual: true,
  },
};

const demoQuillFormats = [
  'header', 'bold', 'italic', 'underline',
  'list', 'bullet', 'color', 'link', 'indent', 'align'
];

const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; icon: any; description: string }> = {
  multiple_choice: { 
    label: "ABCD - Wielokrotny wybór", 
    icon: ListChecks,
    description: "Klasyczne pytanie z 4 opcjami odpowiedzi"
  },
  drag_drop: { 
    label: "Przeciągnij i upuść", 
    icon: Puzzle,
    description: "Przeciągnij elementy do odpowiednich stref"
  },
  fill_blank: { 
    label: "Uzupełnij lukę", 
    icon: TextCursor,
    description: "Wpisz brakujące słowa w tekście"
  },
  matching: { 
    label: "Dopasuj pary", 
    icon: Link2,
    description: "Połącz elementy z dwóch kolumn"
  },
  sorting: { 
    label: "Uporządkuj", 
    icon: ArrowUpDown,
    description: "Ułóż elementy w prawidłowej kolejności"
  },
  hotspot: { 
    label: "Punkty na obrazie", 
    icon: Target,
    description: "Kliknij na prawidłowy obszar na obrazku EKG"
  },
};

const getDefaultConfig = (type: QuestionType): QuestionConfig | undefined => {
  switch (type) {
    case 'multiple_choice':
      return undefined;
    case 'drag_drop':
      return {
        type: 'drag_drop',
        sources: [
          { id: 'source_1', content: 'Element 1', label: '' },
          { id: 'source_2', content: 'Element 2', label: '' },
        ],
        targets: [
          { id: 'target_1', label: 'Strefa 1', acceptsSourceId: 'source_1' },
          { id: 'target_2', label: 'Strefa 2', acceptsSourceId: 'source_2' },
        ],
      };
    case 'fill_blank':
      return {
        type: 'fill_blank',
        template: 'Załamek {{blank:blank_1}} odpowiada za...',
        blanks: [
          { id: 'blank_1', correctAnswers: ['P'], validationType: 'exact', position: 0, placeholder: '?' }
        ],
      };
    case 'matching':
      return {
        type: 'matching',
        leftColumn: [
          { id: 'left_1', text: 'Element A' },
          { id: 'left_2', text: 'Element B' },
        ],
        rightColumn: [
          { id: 'right_1', text: 'Dopasowanie 1' },
          { id: 'right_2', text: 'Dopasowanie 2' },
        ],
        correctPairs: [
          { leftId: 'left_1', rightId: 'right_1' },
          { leftId: 'left_2', rightId: 'right_2' },
        ],
        shuffleRight: true,
      };
    case 'sorting':
      return {
        type: 'sorting',
        items: [
          { id: 'item_1', text: 'Krok 1' },
          { id: 'item_2', text: 'Krok 2' },
          { id: 'item_3', text: 'Krok 3' },
        ],
        correctOrder: ['item_1', 'item_2', 'item_3'],
      };
    case 'hotspot':
      return {
        type: 'hotspot',
        imageUrl: '',
        hotspots: [],
        allowMultiple: false,
      };
    default:
      return undefined;
  }
};

interface FormData {
  title: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  imageUrl: string;
  imagePosition: "above" | "below";
  questionType: QuestionType;
  questionConfig?: QuestionConfig;
  displayOrder: number;
  isActive: boolean;
}

export default function DemoQuestionManager() {
  const [editingQuestion, setEditingQuestion] = useState<DemoQuestion | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    imageUrl: "",
    imagePosition: "above",
    questionType: "multiple_choice",
    questionConfig: undefined,
    displayOrder: 0,
    isActive: true,
  });
  const { toast } = useToast();

  const { data: questions, isLoading } = useQuery({
    queryKey: ["/api/admin/demo-question"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/demo-question");
      return response.json() as Promise<DemoQuestion[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/demo-question", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Pytanie demo zostało utworzone",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-question"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się utworzyć pytania demo",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/demo-question/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Pytanie demo zostało zaktualizowane",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-question"] });
      setEditingQuestion(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować pytania demo",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/demo-question/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Pytanie demo zostało usunięte",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-question"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się usunąć pytania demo",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      question: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      explanation: "",
      imageUrl: "",
      imagePosition: "above",
      questionType: "multiple_choice",
      questionConfig: undefined,
      displayOrder: 0,
      isActive: true,
    });
    setEditingQuestion(null);
  };

  const handleEdit = (question: DemoQuestion) => {
    setEditingQuestion(question);
    setFormData({
      title: (question as any).title || "",
      question: question.question,
      options: question.options && question.options.length > 0 ? question.options : ["", "", "", ""],
      correctIndex: question.correctIndex ?? 0,
      explanation: question.explanation || "",
      imageUrl: question.imageUrl || "",
      imagePosition: ((question as any).imagePosition as "above" | "below") || "above",
      questionType: (question.questionType as QuestionType) || "multiple_choice",
      questionConfig: question.questionConfig as QuestionConfig | undefined,
      displayOrder: question.displayOrder || 0,
      isActive: question.isActive,
    });
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  };

  const handleQuestionTypeChange = (newType: QuestionType) => {
    setFormData({
      ...formData,
      questionType: newType,
      questionConfig: getDefaultConfig(newType),
    });
  };

  const handleConfigChange = (config: QuestionConfig) => {
    setFormData({ ...formData, questionConfig: config });
  };

  const handleSave = () => {
    if (!formData.question.trim()) {
      toast({
        title: "Błąd",
        description: "Treść pytania jest wymagana",
        variant: "destructive",
      });
      return;
    }

    if (formData.questionType === 'multiple_choice') {
      const filledOptions = formData.options.filter(o => o.trim());
      if (filledOptions.length < 2) {
        toast({
          title: "Błąd",
          description: "Wymagane są minimum 2 odpowiedzi",
          variant: "destructive",
        });
        return;
      }
    }

    const payload = {
      title: formData.title || null,
      question: formData.question,
      options: formData.questionType === 'multiple_choice' ? formData.options : [],
      correctIndex: formData.questionType === 'multiple_choice' ? formData.correctIndex : 0,
      explanation: formData.explanation,
      imageUrl: formData.imageUrl || null,
      imagePosition: formData.imagePosition,
      questionType: formData.questionType,
      questionConfig: formData.questionConfig,
      displayOrder: formData.displayOrder,
      isActive: formData.isActive,
    };

    if (editingQuestion) {
      updateMutation.mutate({ id: editingQuestion.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      // 1. Get signed upload URL from server
      const uploadResponse = await apiRequest("POST", "/api/admin/upload");
      const { uploadURL } = await uploadResponse.json();
      
      // 2. Upload file directly to object storage
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
      
      // 3. Set public ACL and get permanent path
      const aclResponse = await apiRequest("PUT", "/api/admin/images", {
        imageURL: uploadURL,
      });
      const { objectPath } = await aclResponse.json();
      
      return objectPath;
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Błąd uploadu",
        description: "Nie udało się przesłać obrazka. Spróbuj ponownie.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Błąd",
        description: "Można przesłać tylko pliki obrazów",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Błąd",
        description: "Maksymalny rozmiar pliku to 5MB",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const objectPath = await handleImageUpload(file);
      setFormData({ ...formData, imageUrl: objectPath });
      toast({
        title: "Sukces",
        description: "Obraz został przesłany",
      });
    } catch (error) {
      // Error already handled in handleImageUpload
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const renderQuestionTypeEditor = () => {
    const { questionType, questionConfig } = formData;

    if (questionType === 'multiple_choice') {
      return (
        <div className="space-y-4">
          <Label className="text-base font-semibold">Odpowiedzi ABCD</Label>
          {formData.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Badge variant={formData.correctIndex === index ? "default" : "outline"} className="w-8 justify-center">
                {String.fromCharCode(65 + index)}
              </Badge>
              <Input
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Odpowiedź ${String.fromCharCode(65 + index)}`}
                className="flex-1"
                data-testid={`input-option-${index}`}
              />
              <Button
                type="button"
                size="sm"
                variant={formData.correctIndex === index ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, correctIndex: index })}
                data-testid={`button-correct-${index}`}
              >
                {formData.correctIndex === index ? "✓ Poprawna" : "Oznacz"}
              </Button>
            </div>
          ))}
        </div>
      );
    }

    if (questionType === 'drag_drop' && questionConfig?.type === 'drag_drop') {
      return (
        <DragDropEditor
          config={questionConfig}
          onChange={(config) => handleConfigChange({ ...config, type: 'drag_drop' })}
        />
      );
    }

    if (questionType === 'fill_blank' && questionConfig?.type === 'fill_blank') {
      return (
        <FillBlankEditor
          config={questionConfig}
          onChange={(config) => handleConfigChange({ ...config, type: 'fill_blank' })}
        />
      );
    }

    if (questionType === 'matching' && questionConfig?.type === 'matching') {
      return (
        <MatchingEditor
          config={questionConfig}
          onChange={(config) => handleConfigChange({ ...config, type: 'matching' })}
        />
      );
    }

    if (questionType === 'sorting' && questionConfig?.type === 'sorting') {
      return (
        <SortingEditor
          config={questionConfig}
          onChange={(config) => handleConfigChange({ ...config, type: 'sorting' })}
        />
      );
    }

    if (questionType === 'hotspot' && questionConfig?.type === 'hotspot') {
      return (
        <HotspotEditor
          config={questionConfig}
          onChange={(config) => handleConfigChange({ ...config, type: 'hotspot' })}
          onImageUpload={handleImageUpload}
        />
      );
    }

    return null;
  };

  const getQuestionTypeIcon = (type: QuestionType) => {
    const Icon = QUESTION_TYPE_LABELS[type].icon;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Pytania Demonstracyjne</h2>
        <Badge variant="outline">
          Aktywne pytania wyświetlają się na stronie głównej
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {editingQuestion ? "Edytuj pytanie demo" : "Utwórz nowe pytanie demo"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Typ pytania</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => {
                const { label, icon: Icon, description } = QUESTION_TYPE_LABELS[type];
                const isSelected = formData.questionType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleQuestionTypeChange(type)}
                    className={`
                      p-3 rounded-lg border-2 text-left transition-all
                      ${isSelected 
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }
                    `}
                    data-testid={`button-type-${type}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Tytuł (opcjonalny nagłówek)</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="np. Przypadek kliniczny #1"
              data-testid="input-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="question">Treść pytania</Label>
            <div data-testid="input-question">
              <ReactQuill
                key={`question-${editingQuestion?.id || 'new'}`}
                theme="snow"
                value={formData.question}
                onChange={(value) => {
                  setFormData(prev => prev.question === value ? prev : { ...prev, question: value });
                }}
                modules={demoQuillModules}
                formats={demoQuillFormats}
                placeholder="Jaki rytm widoczny jest na poniższym zapisie EKG?"
                style={{ minHeight: '120px' }}
              />
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/20">
            {renderQuestionTypeEditor()}
          </div>

          <div className="space-y-2">
            <Label htmlFor="explanation">Wyjaśnienie (wyświetlane po odpowiedzi)</Label>
            <div data-testid="input-explanation">
              <ReactQuill
                key={`explanation-${editingQuestion?.id || 'new'}`}
                theme="snow"
                value={formData.explanation}
                onChange={(value) => {
                  setFormData(prev => prev.explanation === value ? prev : { ...prev, explanation: value });
                }}
                modules={demoQuillModules}
                formats={demoQuillFormats}
                placeholder="Szczegółowe wyjaśnienie odpowiedzi..."
                style={{ minHeight: '150px' }}
              />
            </div>
          </div>

          {formData.questionType !== 'hotspot' && (
            <div className="space-y-2">
              <Label>Obraz EKG (opcjonalny)</Label>
              <div className="mt-2">
                {formData.imageUrl ? (
                  <div className="relative">
                    <img
                      src={formData.imageUrl}
                      alt="EKG"
                      className="max-w-full h-auto rounded border max-h-48 object-contain"
                      data-testid="img-demo-preview"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setFormData({ ...formData, imageUrl: "" })}
                      data-testid="button-remove-demo-image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="demoImageUpload"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      data-testid="input-demo-image-upload"
                    />
                    <label
                      htmlFor="demoImageUpload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      {isUploading ? (
                        <LoadingSpinner size="lg" className="mb-2" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      )}
                      <span className="text-sm text-muted-foreground">
                        {isUploading ? "Przesyłanie..." : "Kliknij aby przesłać obraz"}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, max 5MB
                      </span>
                    </label>
                  </div>
                )}
              </div>
              
              {formData.imageUrl && (
                <div className="mt-3">
                  <Label>Pozycja obrazka</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="imagePosition"
                        value="above"
                        checked={formData.imagePosition === "above"}
                        onChange={() => setFormData({ ...formData, imagePosition: "above" })}
                        className="w-4 h-4"
                        data-testid="radio-image-above"
                      />
                      <span className="text-sm">Nad tekstem</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="imagePosition"
                        value="below"
                        checked={formData.imagePosition === "below"}
                        onChange={() => setFormData({ ...formData, imagePosition: "below" })}
                        className="w-4 h-4"
                        data-testid="radio-image-below"
                      />
                      <span className="text-sm">Pod tekstem</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="displayOrder">Kolejność wyświetlania</Label>
            <Input
              id="displayOrder"
              type="number"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
              placeholder="0"
              data-testid="input-display-order"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              data-testid="switch-active"
            />
            <Label htmlFor="isActive">Aktywne (wyświetlane na stronie głównej)</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingQuestion ? "Zaktualizuj" : "Utwórz"}
            </Button>
            {editingQuestion && (
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel">
                Anuluj
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Istniejące pytania demo ({questions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questions && questions.length > 0 ? (
              questions
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                .map((question) => {
                  const qType = (question.questionType || 'multiple_choice') as QuestionType;
                  const typeInfo = QUESTION_TYPE_LABELS[qType];
                  const Icon = typeInfo?.icon || ListChecks;
                  
                  return (
                    <div
                      key={question.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        question.isActive 
                          ? 'border-primary/30 bg-primary/5' 
                          : 'hover:bg-secondary/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs">
                              {typeInfo?.label || 'ABCD'}
                            </Badge>
                            {question.isActive && (
                              <Badge variant="default">Aktywne</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              #{question.displayOrder || 0}
                            </Badge>
                          </div>
                          <h3 className="font-medium mb-1 line-clamp-2" dangerouslySetInnerHTML={sanitizeHtml(question.question)} />
                          <div className="text-sm text-muted-foreground space-y-1">
                            {qType === 'multiple_choice' && question.options && question.correctIndex !== null && (
                              <div>
                                <strong>Poprawna:</strong>{" "}
                                {question.options[question.correctIndex]}
                              </div>
                            )}
                            <div className="text-xs">
                              Utworzono: {new Date(question.createdAt).toLocaleDateString('pl-PL')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(question)}
                            data-testid={`button-edit-${question.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(question.id)}
                            data-testid={`button-delete-${question.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Brak pytań demo. Utwórz pierwsze pytanie powyżej.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
