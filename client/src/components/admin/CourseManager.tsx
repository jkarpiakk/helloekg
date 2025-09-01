import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus, Edit, Trash2, BookOpen, FileText, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Module, Section } from "@shared/schema";

type ModuleWithSections = Module & { sections: Section[] };

interface ModuleFormData {
  title: string;
  description: string;
  order: number;
  isLocked: boolean;
  prerequisiteModuleId?: string;
}

interface SectionFormData {
  moduleId: string;
  title: string;
  description: string;
  order: number;
  isLocked: boolean;
  prerequisiteSectionId?: string;
}

function SortableModule({ module, onEdit, onDelete, onEditSection, onDeleteSection, onAddSection }: {
  module: ModuleWithSections;
  onEdit: (module: Module) => void;
  onDelete: (id: string) => void;
  onEditSection: (section: Section) => void;
  onDeleteSection: (id: string) => void;
  onAddSection: (moduleId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <span>Moduł {module.order}: {module.title}</span>
                  {module.isLocked && <Badge variant="secondary">Zablokowany</Badge>}
                </CardTitle>
                {module.description && (
                  <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => onAddSection(module.id)}>
                <Plus className="h-3 w-3 mr-1" />
                Sekcja
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(module)}>
                <Edit className="h-3 w-3" />
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onDelete(module.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {module.sections.length > 0 && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Sekcje:</h4>
              {module.sections.map((section) => (
                <div key={section.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">
                      {module.order}.{section.order} - {section.title}
                    </span>
                    {section.isLocked && <Badge variant="outline" className="text-xs">Zablokowany</Badge>}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => onEditSection(section)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteSection(section.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function CourseManager() {
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [addingSectionToModule, setAddingSectionToModule] = useState<string | null>(null);
  const { t } = useTranslation();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch modules with sections
  const { data: modules, isLoading } = useQuery({
    queryKey: ["/api/admin/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/modules");
      return response.json() as Promise<ModuleWithSections[]>;
    },
  });

  // Create module mutation
  const createModuleMutation = useMutation({
    mutationFn: async (data: ModuleFormData) => {
      const response = await apiRequest("POST", "/api/admin/modules", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Moduł został utworzony",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
      setShowModuleDialog(false);
      setEditingModule(null);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się utworzyć modułu",
        variant: "destructive",
      });
    },
  });

  // Update module mutation
  const updateModuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ModuleFormData> }) => {
      const response = await apiRequest("PUT", `/api/admin/modules/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Moduł został zaktualizowany",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
      setShowModuleDialog(false);
      setEditingModule(null);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować modułu",
        variant: "destructive",
      });
    },
  });

  // Delete module mutation
  const deleteModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/modules/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Moduł został usunięty",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się usunąć modułu",
        variant: "destructive",
      });
    },
  });

  // Create section mutation
  const createSectionMutation = useMutation({
    mutationFn: async (data: SectionFormData) => {
      const response = await apiRequest("POST", "/api/admin/sections", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Sekcja została utworzona",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
      setShowSectionDialog(false);
      setEditingSection(null);
      setAddingSectionToModule(null);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się utworzyć sekcji",
        variant: "destructive",
      });
    },
  });

  // Update section mutation
  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SectionFormData> }) => {
      const response = await apiRequest("PUT", `/api/admin/sections/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Sekcja została zaktualizowana",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
      setShowSectionDialog(false);
      setEditingSection(null);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować sekcji",
        variant: "destructive",
      });
    },
  });

  // Delete section mutation
  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/sections/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Sekcja została usunięta",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się usunąć sekcji",
        variant: "destructive",
      });
    },
  });

  // Reorder modules mutation
  const reorderModulesMutation = useMutation({
    mutationFn: async (moduleIds: string[]) => {
      const response = await apiRequest("PUT", "/api/admin/modules/reorder", { moduleIds });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/modules"] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id && modules) {
      const oldIndex = modules.findIndex((module) => module.id === active.id);
      const newIndex = modules.findIndex((module) => module.id === over.id);

      const newModules = arrayMove(modules, oldIndex, newIndex);
      const moduleIds = newModules.map(module => module.id);
      
      reorderModulesMutation.mutate(moduleIds);
    }
  }

  const handleSubmitModule = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const data: ModuleFormData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      order: parseInt(formData.get("order") as string),
      isLocked: formData.get("isLocked") === "on",
      prerequisiteModuleId: formData.get("prerequisiteModuleId") as string || undefined,
    };

    if (editingModule) {
      updateModuleMutation.mutate({ id: editingModule.id, data });
    } else {
      createModuleMutation.mutate(data);
    }
  };

  const handleSubmitSection = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const data: SectionFormData = {
      moduleId: (addingSectionToModule || editingSection?.moduleId) as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      order: parseInt(formData.get("order") as string),
      isLocked: formData.get("isLocked") === "on",
      prerequisiteSectionId: formData.get("prerequisiteSectionId") as string || undefined,
    };

    if (editingSection) {
      updateSectionMutation.mutate({ id: editingSection.id, data });
    } else {
      createSectionMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zarządzanie kursem</h2>
          <p className="text-muted-foreground">
            Edytuj strukturę kursu, moduły i sekcje
          </p>
        </div>
        <Button 
          onClick={() => {
            setEditingModule(null);
            setShowModuleDialog(true);
          }}
          data-testid="button-add-module"
        >
          <Plus className="h-4 w-4 mr-2" />
          Dodaj moduł
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={modules?.map(m => m.id) || []}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {modules?.map((module) => (
              <SortableModule
                key={module.id}
                module={module}
                onEdit={(module) => {
                  setEditingModule(module);
                  setShowModuleDialog(true);
                }}
                onDelete={(id) => deleteModuleMutation.mutate(id)}
                onEditSection={(section) => {
                  setEditingSection(section);
                  setShowSectionDialog(true);
                }}
                onDeleteSection={(id) => deleteSectionMutation.mutate(id)}
                onAddSection={(moduleId) => {
                  setAddingSectionToModule(moduleId);
                  setEditingSection(null);
                  setShowSectionDialog(true);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {modules?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak modułów</h3>
            <p className="text-muted-foreground mb-4">
              Zacznij od stworzenia pierwszego modułu kursu
            </p>
            <Button 
              onClick={() => {
                setEditingModule(null);
                setShowModuleDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj pierwszy moduł
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Module Dialog */}
      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingModule ? "Edytuj moduł" : "Dodaj nowy moduł"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitModule} className="space-y-4">
            <div>
              <Label htmlFor="title">Tytuł modułu</Label>
              <Input
                id="title"
                name="title"
                defaultValue={editingModule?.title || ""}
                required
                data-testid="input-module-title"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Opis (opcjonalny)</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={editingModule?.description || ""}
                data-testid="textarea-module-description"
              />
            </div>
            
            <div>
              <Label htmlFor="order">Kolejność</Label>
              <Input
                id="order"
                name="order"
                type="number"
                min="1"
                defaultValue={editingModule?.order || (modules?.length || 0) + 1}
                required
                data-testid="input-module-order"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="isLocked"
                name="isLocked"
                defaultChecked={editingModule?.isLocked || false}
                data-testid="switch-module-locked"
              />
              <Label htmlFor="isLocked">Zablokowany</Label>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowModuleDialog(false)}
              >
                Anuluj
              </Button>
              <Button 
                type="submit" 
                disabled={createModuleMutation.isPending || updateModuleMutation.isPending}
                data-testid="button-save-module"
              >
                {editingModule ? "Zapisz zmiany" : "Dodaj moduł"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Section Dialog */}
      <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "Edytuj sekcję" : "Dodaj nową sekcję"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitSection} className="space-y-4">
            <div>
              <Label htmlFor="sectionTitle">Tytuł sekcji</Label>
              <Input
                id="sectionTitle"
                name="title"
                defaultValue={editingSection?.title || ""}
                required
                data-testid="input-section-title"
              />
            </div>
            
            <div>
              <Label htmlFor="sectionDescription">Opis (opcjonalny)</Label>
              <Textarea
                id="sectionDescription"
                name="description"
                defaultValue={editingSection?.description || ""}
                data-testid="textarea-section-description"
              />
            </div>
            
            <div>
              <Label htmlFor="sectionOrder">Kolejność</Label>
              <Input
                id="sectionOrder"
                name="order"
                type="number"
                min="1"
                defaultValue={editingSection?.order || 1}
                required
                data-testid="input-section-order"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="sectionIsLocked"
                name="isLocked"
                defaultChecked={editingSection?.isLocked || false}
                data-testid="switch-section-locked"
              />
              <Label htmlFor="sectionIsLocked">Zablokowany</Label>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowSectionDialog(false)}
              >
                Anuluj
              </Button>
              <Button 
                type="submit" 
                disabled={createSectionMutation.isPending || updateSectionMutation.isPending}
                data-testid="button-save-section"
              >
                {editingSection ? "Zapisz zmiany" : "Dodaj sekcję"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}