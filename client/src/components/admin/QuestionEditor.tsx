import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Upload, Plus, Trash2, Edit, Save, X, Image as ImageIcon } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import type { Question, Section, Module } from "@shared/schema";

interface QuestionFormData {
  sectionId: string;
  questionText: string;
  explanation: string;
  answerOptions: string[];
  correctAnswerIndex: number;
  imageUrl?: string;
  difficultyLevel: "easy" | "medium" | "hard";
  tags: string[];
  order: number;
  status: "draft" | "review" | "published";
}

interface QuestionEditorProps {
  question?: Question;
  sections: Section[];
  modules: (Module & { sections: Section[] })[];
  onSave: (data: QuestionFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    ['link', 'image'],
    ['clean']
  ],
};

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'color', 'background', 'link', 'image'
];

export default function QuestionEditor({
  question,
  sections,
  modules,
  onSave,
  onCancel,
  isLoading
}: QuestionEditorProps) {
  const [formData, setFormData] = useState<QuestionFormData>({
    sectionId: question?.sectionId || "",
    questionText: question?.bodyMd || "",
    explanation: question?.explanationMd || "",
    answerOptions: question?.answers?.map((a: any) => a.text) || ["", "", "", ""],
    correctAnswerIndex: question?.answers?.findIndex((a: any) => a.isCorrect) || 0,
    imageUrl: question?.imageUrl || "",
    difficultyLevel: question?.difficulty as "easy" | "medium" | "hard" || "medium",
    tags: question?.tags || [],
    order: question?.order || 1,
    status: question?.status as "draft" | "review" | "published" || "draft",
  });

  const [tagInput, setTagInput] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const questionQuillRef = useRef<ReactQuill>(null);
  const explanationQuillRef = useRef<ReactQuill>(null);
  const { toast } = useToast();

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      // Get upload URL
      const uploadResponse = await apiRequest("POST", "/api/admin/upload");
      const { uploadURL } = await uploadResponse.json();

      // Upload file to object storage
      const fileUploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!fileUploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Set ACL policy for the uploaded image
      const aclResponse = await apiRequest("PUT", "/api/admin/images", {
        imageURL: uploadURL,
      });
      const { objectPath } = await aclResponse.json();

      return objectPath;
    },
    onSuccess: (objectPath) => {
      setFormData(prev => ({ ...prev, imageUrl: objectPath }));
      toast({
        title: "Sukces",
        description: "Obraz został przesłany",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się przesłać obrazu",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Błąd",
        description: "Można przesłać tylko pliki obrazów",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Błąd",
        description: "Maksymalny rozmiar pliku to 5MB",
        variant: "destructive",
      });
      return;
    }

    uploadImageMutation.mutate(file);
  }, [uploadImageMutation, toast]);

  const handleAnswerOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.answerOptions];
    newOptions[index] = value;
    setFormData(prev => ({ ...prev, answerOptions: newOptions }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Validation
    if (!formData.sectionId) {
      toast({
        title: "Błąd",
        description: "Wybierz sekcję dla pytania",
        variant: "destructive",
      });
      return;
    }

    if (!formData.questionText.trim()) {
      toast({
        title: "Błąd",
        description: "Tekst pytania jest wymagany",
        variant: "destructive",
      });
      return;
    }

    if (formData.answerOptions.some(option => !option.trim())) {
      toast({
        title: "Błąd",
        description: "Wszystkie opcje odpowiedzi muszą być wypełnione",
        variant: "destructive",
      });
      return;
    }

    if (!formData.explanation.trim()) {
      toast({
        title: "Błąd",
        description: "Wyjaśnienie jest wymagane",
        variant: "destructive",
      });
      return;
    }

    onSave(formData);
  };

  const selectedModule = modules.find(m => 
    m.sections.some(s => s.id === formData.sectionId)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {question ? "Edytuj pytanie" : "Dodaj nowe pytanie"}
          </h2>
          <p className="text-muted-foreground">
            Stwórz interaktywne pytanie z wyjaśnieniem metodą Feynmana
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-question">
            <X className="h-4 w-4 mr-2" />
            Anuluj
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            data-testid="button-save-question"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {question ? "Zapisz zmiany" : "Dodaj pytanie"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Question text */}
          <Card>
            <CardHeader>
              <CardTitle>Treść pytania</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="questionText">Pytanie *</Label>
                <ReactQuill
                  ref={questionQuillRef}
                  theme="snow"
                  value={formData.questionText}
                  onChange={(value) => setFormData(prev => ({ ...prev, questionText: value }))}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Wprowadź treść pytania..."
                  className="h-32 mb-12"
                  data-testid="editor-question-text"
                />
              </div>

              {/* Image upload */}
              <div>
                <Label htmlFor="imageUpload">Obraz EKG (opcjonalny)</Label>
                <div className="mt-2">
                  {formData.imageUrl ? (
                    <div className="relative">
                      <img
                        src={formData.imageUrl}
                        alt="EKG"
                        className="max-w-full h-auto rounded border"
                        data-testid="img-question-preview"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setFormData(prev => ({ ...prev, imageUrl: "" }))}
                        data-testid="button-remove-image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <input
                        type="file"
                        id="imageUpload"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        data-testid="input-image-upload"
                      />
                      <label
                        htmlFor="imageUpload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        {uploadImageMutation.isPending ? (
                          <LoadingSpinner size="lg" className="mb-2" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {uploadImageMutation.isPending ? "Przesyłanie..." : "Kliknij aby przesłać obraz"}
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          PNG, JPG, max 5MB
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Answer options */}
          <Card>
            <CardHeader>
              <CardTitle>Opcje odpowiedzi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.answerOptions.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={formData.correctAnswerIndex === index}
                    onChange={() => setFormData(prev => ({ ...prev, correctAnswerIndex: index }))}
                    className="mt-1"
                    data-testid={`radio-correct-${index}`}
                  />
                  <div className="flex-1">
                    <Label className="text-sm font-medium">
                      Opcja {String.fromCharCode(65 + index)}
                      {formData.correctAnswerIndex === index && (
                        <Badge variant="default" className="ml-2 text-xs">Poprawna</Badge>
                      )}
                    </Label>
                    <Input
                      value={option}
                      onChange={(e) => handleAnswerOptionChange(index, e.target.value)}
                      placeholder={`Opcja ${String.fromCharCode(65 + index)}`}
                      className="mt-1"
                      data-testid={`input-answer-${index}`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Explanation */}
          <Card>
            <CardHeader>
              <CardTitle>Wyjaśnienie (Metoda Feynmana)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Wyjaśnij odpowiedź w prosty sposób, używając analogii i przykładów
              </p>
            </CardHeader>
            <CardContent>
              <ReactQuill
                ref={explanationQuillRef}
                theme="snow"
                value={formData.explanation}
                onChange={(value) => setFormData(prev => ({ ...prev, explanation: value }))}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Wyjaśnij dlaczego ta odpowiedź jest poprawna..."
                className="h-48 mb-12"
                data-testid="editor-explanation"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Question settings */}
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia pytania</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sectionId">Sekcja *</Label>
                <Select
                  value={formData.sectionId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, sectionId: value }))}
                >
                  <SelectTrigger data-testid="select-section">
                    <SelectValue placeholder="Wybierz sekcję" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <div key={module.id}>
                        <div className="px-2 py-1 text-sm font-medium text-muted-foreground">
                          {module.title}
                        </div>
                        {module.sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {module.order}.{section.order} - {section.title}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="difficultyLevel">Poziom trudności</Label>
                <Select
                  value={formData.difficultyLevel}
                  onValueChange={(value: "easy" | "medium" | "hard") => 
                    setFormData(prev => ({ ...prev, difficultyLevel: value }))
                  }
                >
                  <SelectTrigger data-testid="select-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Łatwy</SelectItem>
                    <SelectItem value="medium">Średni</SelectItem>
                    <SelectItem value="hard">Trudny</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="order">Kolejność</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.order}
                  onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
                  data-testid="input-question-order"
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "draft" | "review" | "published") => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Szkic</SelectItem>
                    <SelectItem value="review">Do przeglądu</SelectItem>
                    <SelectItem value="published">Opublikowane</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tagi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Dodaj tag..."
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  data-testid="input-tag"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      data-testid={`button-remove-tag-${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview info */}
          {selectedModule && (
            <Card>
              <CardHeader>
                <CardTitle>Informacje o module</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-medium">Moduł:</span> {selectedModule.title}
                  </div>
                  <div>
                    <span className="font-medium">Sekcja:</span>{" "}
                    {sections.find(s => s.id === formData.sectionId)?.title}
                  </div>
                  <div>
                    <span className="font-medium">Poziom:</span>{" "}
                    <Badge variant="outline">
                      {formData.difficultyLevel === "easy" ? "Łatwy" : 
                       formData.difficultyLevel === "medium" ? "Średni" : "Trudny"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}