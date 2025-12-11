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
import { Plus, Upload, Edit, Eye, Trash2, Check, X, EyeOff } from "lucide-react";
import type { QuestionWithStats } from "@/types";
import QuestionEditor from "./QuestionEditor";
import ImportModal from "./ImportModal";
import type { Module, Section } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function QuestionManager() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithStats | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionWithStats | null>(null);
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

  // Toggle section visibility mutation
  const toggleSectionVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean }) => {
      const response = await apiRequest("PUT", `/api/admin/sections/${id}`, { isVisible });
      return response.json();
    },
    onSuccess: (_, { isVisible }) => {
      toast({
        title: "Sukces",
        description: isVisible ? "Sekcja jest teraz widoczna" : "Sekcja została ukryta",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zmienić widoczności sekcji",
        variant: "destructive",
      });
    },
  });

  // Toggle module visibility mutation
  const toggleModuleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean }) => {
      const response = await apiRequest("PUT", `/api/admin/modules/${id}`, { isVisible });
      return response.json();
    },
    onSuccess: (_, { isVisible }) => {
      toast({
        title: "Sukces",
        description: isVisible ? "Moduł jest teraz widoczny" : "Moduł został ukryty",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zmienić widoczności modułu",
        variant: "destructive",
      });
    },
  });

  // Get currently selected module and section
  const selectedModule = moduleFilter !== "all" 
    ? modules?.find(m => m.id === moduleFilter) 
    : null;
  
  const selectedSection = sectionFilter !== "all" 
    ? allSections.find(s => s.id === sectionFilter) 
    : null;
  
  // Filter sections by selected module
  const filteredSections = moduleFilter !== "all" 
    ? allSections.filter(s => s.moduleId === moduleFilter)
    : allSections;

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
    const questionType = data.questionType || "multiple_choice";
    
    const transformedData: any = {
      sectionId: data.sectionId,
      title: data.title?.trim() || null,
      bodyMd: data.questionText,
      explanationMd: data.explanation,
      imageUrl: data.imageUrl,
      imagePosition: data.imagePosition || "above",
      difficulty: data.difficultyLevel,
      tags: data.tags,
      status: data.status,
      questionType: questionType,
    };

    if (questionType === "multiple_choice") {
      transformedData.answers = data.answerOptions.map((option: string, index: number) => ({
        text: option,
        isCorrect: index === data.correctAnswerIndex
      }));
      transformedData.questionConfig = { type: 'multiple_choice' };
    } else {
      transformedData.answers = [];
      transformedData.questionConfig = { 
        type: questionType, 
        config: data.questionConfig 
      };
    }

    if (editingQuestion) {
      updateQuestionMutation.mutate({ id: editingQuestion.id, data: transformedData });
    } else {
      createQuestionMutation.mutate(transformedData);
    }
  };

  if (showEditor) {
    return (
      <QuestionEditor
        question={editingQuestion || undefined}
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
          <Button 
            variant="outline" 
            onClick={() => setShowImportModal(true)}
            data-testid="import-bulk-button"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import hurtowy
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
          <div className="grid md:grid-cols-5 gap-4">
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
                Moduł
              </label>
              <div className="flex items-center gap-2">
                <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setSectionFilter("all"); }}>
                  <SelectTrigger data-testid="module-filter" className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie moduły</SelectItem>
                    {modules?.map(module => (
                      <SelectItem key={module.id} value={module.id}>
                        <span className="flex items-center gap-2">
                          {module.title}
                          {module.isVisible === false && (
                            <span className="text-orange-600 text-xs">(ukryty)</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModule && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleModuleVisibilityMutation.mutate({ 
                      id: selectedModule.id, 
                      isVisible: selectedModule.isVisible === false 
                    })}
                    title={selectedModule.isVisible !== false ? "Ukryj moduł" : "Pokaż moduł"}
                    className={selectedModule.isVisible === false ? "text-orange-600 border-orange-400 bg-orange-50 dark:bg-orange-950/30" : "text-muted-foreground"}
                    disabled={toggleModuleVisibilityMutation.isPending}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Sekcja
              </label>
              <div className="flex items-center gap-2">
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger data-testid="section-filter" className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie sekcje</SelectItem>
                    {filteredSections.map(section => (
                      <SelectItem key={section.id} value={section.id}>
                        <span className="flex items-center gap-2">
                          {section.title}
                          {section.isVisible === false && (
                            <span className="text-orange-600 text-xs">(ukryta)</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSection && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleSectionVisibilityMutation.mutate({ 
                      id: selectedSection.id, 
                      isVisible: selectedSection.isVisible === false 
                    })}
                    title={selectedSection.isVisible !== false ? "Ukryj sekcję" : "Pokaż sekcję"}
                    className={selectedSection.isVisible === false ? "text-orange-600 border-orange-400 bg-orange-50 dark:bg-orange-950/30" : "text-muted-foreground"}
                    disabled={toggleSectionVisibilityMutation.isPending}
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setPreviewQuestion(question)}
                          data-testid={`view-question-${question.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => deleteQuestionMutation.mutate(question.id)}
                          data-testid={`delete-question-${question.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
      
      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        sections={allSections}
        modules={modules || []}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewQuestion} onOpenChange={(open) => !open && setPreviewQuestion(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Podgląd pytania</DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Pytanie:</h3>
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewQuestion.bodyMd }}
                />
              </div>

              {previewQuestion.imageUrl && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Obraz:</h3>
                  <img 
                    src={previewQuestion.imageUrl} 
                    alt="Question illustration" 
                    className="max-w-full h-auto rounded-lg border"
                  />
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Odpowiedzi:</h3>
                <div className="space-y-2">
                  {previewQuestion.answers.map((answer, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border ${
                        answer.isCorrect 
                          ? 'bg-green-50 dark:bg-green-950/30 border-green-500' 
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                        <span>{answer.text}</span>
                        {answer.isCorrect && (
                          <Badge variant="default" className="ml-auto">Poprawna</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {previewQuestion.explanationMd && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Wyjaśnienie:</h3>
                  <div 
                    className="prose dark:prose-invert max-w-none p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg"
                    dangerouslySetInnerHTML={{ __html: previewQuestion.explanationMd }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Status:</span> {getStatusBadge(previewQuestion.status)}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Trudność:</span> <Badge variant="outline">{previewQuestion.difficulty}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Statystyki:</span> {Math.round(previewQuestion.stats.successRate * 100)}% ({previewQuestion.stats.attempts} prób)
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
