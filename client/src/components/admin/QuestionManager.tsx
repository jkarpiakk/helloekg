import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus, Upload, Edit, Eye, Trash2, Check, X } from "lucide-react";
import type { QuestionWithStats } from "@/types";
import QuestionEditor from "./QuestionEditor";
import type { Module, Section } from "@shared/schema";

export default function QuestionManager() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithStats | null>(null);
  const { t } = useTranslation();
  const { toast } = useToast();

  // Fetch questions with filters
  const { data: questions, isLoading } = useQuery({
    queryKey: ["/api/admin/questions", statusFilter, sectionFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sectionFilter !== "all") params.set("sectionId", sectionFilter);
      if (searchQuery) params.set("search", searchQuery);
      
      const response = await apiRequest("GET", `/api/admin/questions?${params}`);
      return response.json() as Promise<QuestionWithStats[]>;
    },
  });

  // Fetch modules with sections for the editor
  const { data: modules } = useQuery({
    queryKey: ["/api/admin/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/modules");
      return response.json() as Promise<(Module & { sections: Section[] })[]>;
    },
  });

  // Flatten sections for filter dropdown
  const allSections = modules?.flatMap(m => m.sections) || [];

  // Create question mutation
  const createQuestionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/questions", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Pytanie zostało utworzone",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      setShowEditor(false);
      setEditingQuestion(null);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się utworzyć pytania",
        variant: "destructive",
      });
    },
  });

  // Update question mutation
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/admin/questions/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Pytanie zostało zaktualizowane",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      setShowEditor(false);
      setEditingQuestion(null);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować pytania",
        variant: "destructive",
      });
    },
  });

  // Delete question mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/questions/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Pytanie zostało usunięte",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się usunąć pytania",
        variant: "destructive",
      });
    },
  });

  // Review question mutation
  const reviewQuestionMutation = useMutation({
    mutationFn: async ({ questionId, action }: { questionId: string; action: "approve" | "reject" }) => {
      const response = await apiRequest("POST", `/api/admin/questions/${questionId}/review`, { action });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Status pytania został zaktualizowany",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować statusu pytania",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary",
      review: "outline",
      published: "default",
    } as const;

    const colors = {
      draft: "bg-muted text-muted-foreground",
      review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };

    return (
      <Badge className={colors[status as keyof typeof colors] || colors.draft}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 0.8) return "text-green-600";
    if (rate >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const handleSaveQuestion = (data: any) => {
    // Transform data from QuestionFormData format to database format
    const transformedData = {
      sectionId: data.sectionId,
      title: data.questionText.substring(0, 100) || "Pytanie", // Extract title from question text
      bodyMd: data.questionText,
      explanationMd: data.explanation,
      answers: data.answerOptions.map((option: string, index: number) => ({
        text: option,
        isCorrect: index === data.correctAnswerIndex
      })),
      imageUrl: data.imageUrl,
      difficulty: data.difficultyLevel,
      tags: data.tags,
      status: data.status,
    };

    if (editingQuestion) {
      updateQuestionMutation.mutate({ id: editingQuestion.id, data: transformedData });
    } else {
      createQuestionMutation.mutate(transformedData);
    }
  };

  if (showEditor) {
    return (
      <QuestionEditor
        question={editingQuestion}
        sections={allSections}
        modules={modules || []}
        onSave={handleSaveQuestion}
        onCancel={() => {
          setShowEditor(false);
          setEditingQuestion(null);
        }}
        isLoading={createQuestionMutation.isPending || updateQuestionMutation.isPending}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Questions toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-foreground">{t("admin.questionManagement")}</h2>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50">
              Published: {questions?.filter(q => q.status === "published").length || 0}
            </Badge>
            <Badge variant="outline" className="bg-yellow-50">
              Review: {questions?.filter(q => q.status === "review").length || 0}
            </Badge>
            <Badge variant="outline">
              Draft: {questions?.filter(q => q.status === "draft").length || 0}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="outline" data-testid="import-csv-button">
            <Upload className="h-4 w-4 mr-2" />
            {t("admin.importCsv")}
          </Button>
          <Button 
            onClick={() => {
              setEditingQuestion(null);
              setShowEditor(true);
            }}
            data-testid="new-question-button"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.newQuestion")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("admin.status")}
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.all")}</SelectItem>
                  <SelectItem value="published">{t("admin.published")}</SelectItem>
                  <SelectItem value="review">{t("admin.review")}</SelectItem>
                  <SelectItem value="draft">{t("admin.draft")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("admin.module")}
              </label>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger data-testid="section-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie moduły</SelectItem>
                  <SelectItem value="module1">Moduł 1: Podstawy</SelectItem>
                  <SelectItem value="module2">Moduł 2: Rytmy</SelectItem>
                  <SelectItem value="module3">Moduł 3: Zawał</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("admin.difficulty")}
              </label>
              <Select>
                <SelectTrigger data-testid="difficulty-filter">
                  <SelectValue placeholder="Wszystkie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.all")}</SelectItem>
                  <SelectItem value="easy">{t("admin.easy")}</SelectItem>
                  <SelectItem value="medium">{t("admin.medium")}</SelectItem>
                  <SelectItem value="hard">{t("admin.hard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("common.search")}
              </label>
              <Input
                type="text"
                placeholder={t("admin.searchQuestion")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions list */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="questions-table">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 font-semibold text-foreground">Pytanie</th>
                  <th className="text-left p-4 font-semibold text-foreground">{t("admin.module")}</th>
                  <th className="text-left p-4 font-semibold text-foreground">{t("admin.status")}</th>
                  <th className="text-left p-4 font-semibold text-foreground">{t("admin.successRate")}</th>
                  <th className="text-left p-4 font-semibold text-foreground">{t("admin.created")}</th>
                  <th className="text-left p-4 font-semibold text-foreground">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {questions?.map((question) => (
                  <tr key={question.id} className="hover:bg-secondary/50" data-testid={`question-row-${question.id}`}>
                    <td className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          {question.imageUrl ? (
                            <img src={question.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <div className="w-full h-full bg-muted rounded-lg" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">{question.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {question.bodyMd.substring(0, 100)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">Moduł 1</td>
                    <td className="p-4">
                      {getStatusBadge(question.status)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              question.stats.successRate >= 0.8 ? 'bg-green-500' :
                              question.stats.successRate >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${question.stats.successRate * 100}%` }}
                          />
                        </div>
                        <span className={`text-sm ${getSuccessRateColor(question.stats.successRate)}`}>
                          {Math.round(question.stats.successRate * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(question.createdAt).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setEditingQuestion(question);
                            setShowEditor(true);
                          }}
                          data-testid={`edit-question-${question.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" data-testid={`view-question-${question.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => deleteQuestionMutation.mutate(question.id)}
                          data-testid={`delete-question-${question.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {question.status === "review" && (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => reviewQuestionMutation.mutate({ questionId: question.id, action: "approve" })}
                              disabled={reviewQuestionMutation.isPending}
                              data-testid={`approve-question-${question.id}`}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => reviewQuestionMutation.mutate({ questionId: question.id, action: "reject" })}
                              disabled={reviewQuestionMutation.isPending}
                              data-testid={`reject-question-${question.id}`}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" data-testid={`delete-question-${question.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("admin.showing")} 1-{questions?.length || 0} {t("admin.resultsOf")} {questions?.length || 0} {t("admin.results")}
        </p>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" disabled>
            Poprzednie
          </Button>
          <Button size="sm">1</Button>
          <Button variant="outline" size="sm">2</Button>
          <Button variant="outline" size="sm">3</Button>
          <Button variant="outline" size="sm">
            Następne
          </Button>
        </div>
      </div>
    </div>
  );
}
