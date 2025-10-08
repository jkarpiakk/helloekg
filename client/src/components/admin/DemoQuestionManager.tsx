import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Eye, Plus, Trash2, Save } from "lucide-react";
import type { DemoQuestion } from "@shared/schema";

export default function DemoQuestionManager() {
  const [editingQuestion, setEditingQuestion] = useState<DemoQuestion | null>(null);
  const [formData, setFormData] = useState({
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
    imageUrl: "",
    isActive: true,
  });
  const { toast } = useToast();

  // Fetch all demo questions
  const { data: questions, isLoading } = useQuery({
    queryKey: ["/api/admin/demo-question"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/demo-question");
      return response.json() as Promise<DemoQuestion[]>;
    },
  });

  // Create mutation
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

  // Update mutation
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

  // Delete mutation
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
      question: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      explanation: "",
      imageUrl: "",
      isActive: true,
    });
    setEditingQuestion(null);
  };

  const handleEdit = (question: DemoQuestion) => {
    setEditingQuestion(question);
    setFormData({
      question: question.question,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      imageUrl: question.imageUrl || "",
      isActive: question.isActive,
    });
  };

  const handleSave = () => {
    if (editingQuestion) {
      updateMutation.mutate({ id: editingQuestion.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Pytanie Demonstracyjne</h2>
        <Badge variant="outline">
          Aktywne pytanie wyświetla się na stronie głównej
        </Badge>
      </div>

      {/* Editor Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {editingQuestion ? "Edytuj pytanie demo" : "Utwórz nowe pytanie demo"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="question">Pytanie</Label>
            <Textarea
              id="question"
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              placeholder="Jaki rytm widoczny jest na poniższym zapisie EKG?"
              rows={3}
              data-testid="input-question"
            />
          </div>

          <div className="space-y-2">
            <Label>Odpowiedzi</Label>
            {formData.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Odpowiedź ${index + 1}`}
                  data-testid={`input-option-${index}`}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={formData.correctIndex === index ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, correctIndex: index })}
                  data-testid={`button-correct-${index}`}
                >
                  {formData.correctIndex === index ? "✓ Poprawna" : "Oznacz jako poprawną"}
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="explanation">Wyjaśnienie</Label>
            <Textarea
              id="explanation"
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              placeholder="Szczegółowe wyjaśnienie odpowiedzi..."
              rows={5}
              data-testid="input-explanation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">URL obrazu (opcjonalnie)</Label>
            <Input
              id="imageUrl"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="https://example.com/ekg-image.jpg"
              data-testid="input-image-url"
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

      {/* List of Demo Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Istniejące pytania demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questions && questions.length > 0 ? (
              questions.map((question) => (
                <div
                  key={question.id}
                  className="border rounded-lg p-4 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium">{question.question}</h3>
                        {question.isActive && (
                          <Badge variant="default">Aktywne</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>
                          <strong>Poprawna odpowiedź:</strong>{" "}
                          {question.options[question.correctIndex]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Utworzono: {new Date(question.createdAt).toLocaleDateString('pl-PL')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
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
              ))
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
