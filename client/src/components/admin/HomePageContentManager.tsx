import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Edit2, Plus, Trash2, Save, X } from "lucide-react";
import type { HomePageContent } from "@shared/schema";

const SECTIONS = [
  { value: "hero", label: "Sekcja Hero" },
  { value: "how-it-works", label: "Jak to działa" },
  { value: "course-content", label: "Zawartość kursu" },
  { value: "target-audience", label: "Dla kogo" },
  { value: "stats", label: "Statystyki" },
  { value: "other", label: "Inne" },
];

export default function HomePageContentManager() {
  const [editingContent, setEditingContent] = useState<HomePageContent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    key: "",
    value: "",
    section: "hero",
    description: "",
  });
  const { toast } = useToast();

  // Fetch all home page content
  const { data: contents, isLoading } = useQuery<HomePageContent[]>({
    queryKey: ["/api/admin/home-page-content"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/home-page-content", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Treść została utworzona",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/home-page-content"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się utworzyć treści",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/home-page-content/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Treść została zaktualizowana",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/home-page-content"] });
      setEditingContent(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować treści",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/home-page-content/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Treść została usunięta",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/home-page-content"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się usunąć treści",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      key: "",
      value: "",
      section: "hero",
      description: "",
    });
    setEditingContent(null);
    setIsCreating(false);
  };

  const handleEdit = (content: HomePageContent) => {
    setEditingContent(content);
    setIsCreating(false);
    setFormData({
      key: content.key,
      value: content.value,
      section: content.section,
      description: content.description || "",
    });
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingContent(null);
    setFormData({
      key: "",
      value: "",
      section: "hero",
      description: "",
    });
  };

  const handleSave = () => {
    if (editingContent) {
      updateMutation.mutate({ id: editingContent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const groupedContents = contents?.reduce((acc: Record<string, HomePageContent[]>, content: HomePageContent) => {
    if (!acc[content.section]) {
      acc[content.section] = [];
    }
    acc[content.section].push(content);
    return acc;
  }, {}) || {};

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
        <div>
          <h2 className="text-2xl font-bold text-foreground">Treści Strony Głównej</h2>
          <p className="text-muted-foreground mt-1">Zarządzaj tekstami wyświetlanymi na stronie głównej</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-content">
          <Plus className="h-4 w-4 mr-2" />
          Dodaj nową treść
        </Button>
      </div>

      {/* Editor Form */}
      {(isCreating || editingContent) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{editingContent ? "Edytuj treść" : "Utwórz nową treść"}</span>
              <Button variant="ghost" size="sm" onClick={resetForm} data-testid="button-close-form">
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key">Klucz (identyfikator)</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="np. hero.title"
                  disabled={!!editingContent}
                  data-testid="input-key"
                />
                <p className="text-xs text-muted-foreground">Unikalna nazwa identyfikująca tekst</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section">Sekcja</Label>
                <Select
                  value={formData.section}
                  onValueChange={(value) => setFormData({ ...formData, section: value })}
                >
                  <SelectTrigger data-testid="select-section">
                    <SelectValue placeholder="Wybierz sekcję" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map((section) => (
                      <SelectItem key={section.value} value={section.value}>
                        {section.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Treść</Label>
              <Textarea
                id="value"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Wprowadź treść tekstową..."
                rows={4}
                data-testid="input-value"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis (opcjonalnie)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Opis pomocniczy dla administratorów"
                data-testid="input-description"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending || !formData.key || !formData.value}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingContent ? "Zaktualizuj" : "Utwórz"}
              </Button>
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel">
                Anuluj
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List of Content by Section */}
      <div className="space-y-6">
        {Object.entries(groupedContents).map(([section, sectionContents]) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>{SECTIONS.find((s) => s.value === section)?.label || section}</span>
                <Badge variant="outline">{sectionContents.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sectionContents.map((content) => (
                  <div
                    key={content.id}
                    className="border rounded-lg p-4 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <code className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                            {content.key}
                          </code>
                          {content.description && (
                            <span className="text-sm text-muted-foreground">
                              — {content.description}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{content.value}</p>
                        <p className="text-xs text-muted-foreground">
                          Ostatnia aktualizacja: {new Date(content.updatedAt).toLocaleDateString('pl-PL')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(content)}
                          data-testid={`button-edit-${content.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Czy na pewno chcesz usunąć "${content.key}"?`)) {
                              deleteMutation.mutate(content.id);
                            }
                          }}
                          data-testid={`button-delete-${content.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {Object.keys(groupedContents).length === 0 && !isCreating && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Brak treści. Kliknij "Dodaj nową treść" aby rozpocząć.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
