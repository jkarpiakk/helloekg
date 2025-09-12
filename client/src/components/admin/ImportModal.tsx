import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Download, FileText, CheckCircle, XCircle, Eye } from "lucide-react";
import type { Section, Module } from "@shared/schema";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  modules: (Module & { sections: Section[] })[];
}

interface ParsedQuestion {
  sectionId: string;
  title?: string;
  questionText: string;
  explanation: string;
  answerOptions: string[];
  correctAnswerIndex: number;
  imageUrl?: string;
  difficultyLevel: "easy" | "medium" | "hard";
  tags: string[];
  status: "draft" | "review" | "published";
}

interface ValidationResult {
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  validationErrors: Array<{ index: number; errors: string[] }>;
  preview?: any[];
}

interface ImportResult {
  summary: {
    total: number;
    created: number;
    failed: number;
  };
  results: Array<{ index: number; status: 'created' | 'failed'; id?: string; errors?: string[] }>;
  validationErrors?: Array<{ index: number; errors: string[] }>;
}

export default function ImportModal({ isOpen, onClose, sections, modules }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [defaultSectionId, setDefaultSectionId] = useState<string>("");
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "validate" | "preview" | "import" | "results">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Validate questions (dry run)
  const validateMutation = useMutation({
    mutationFn: async (questions: ParsedQuestion[]) => {
      const response = await apiRequest("POST", "/api/admin/questions/bulk", {
        items: questions,
        dryRun: true
      });
      return response.json() as Promise<ValidationResult>;
    },
    onSuccess: (result) => {
      setValidationResult(result);
      setStep("preview");
      toast({
        title: "Walidacja zakończona",
        description: `${result.summary.valid} z ${result.summary.total} pytań jest poprawnych`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd walidacji",
        description: error.message || "Nie udało się zwalidować pytań",
        variant: "destructive",
      });
    },
  });

  // Import questions
  const importMutation = useMutation({
    mutationFn: async (questions: ParsedQuestion[]) => {
      const response = await apiRequest("POST", "/api/admin/questions/bulk", {
        items: questions,
        dryRun: false
      });
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep("results");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({
        title: "Import zakończony",
        description: `Utworzono ${result.summary.created} pytań, ${result.summary.failed} nie udało się`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd importu",
        description: error.message || "Nie udało się zaimportować pytań",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file: File) => {
    try {
      const text = await file.text();
      
      if (file.name.endsWith('.json')) {
        const jsonData = JSON.parse(text);
        const questions = Array.isArray(jsonData) ? jsonData : [jsonData];
        setParsedQuestions(questions);
        setStep("validate");
      } else if (file.name.endsWith('.csv')) {
        const questions = parseCSV(text);
        setParsedQuestions(questions);
        setStep("validate");
      } else {
        throw new Error("Nieobsługiwany format pliku. Użyj CSV lub JSON.");
      }
    } catch (error: any) {
      toast({
        title: "Błąd parsowania",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const parseCSV = (text: string): ParsedQuestion[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error("Plik CSV musi zawierać nagłówek i co najmniej jeden wiersz danych");

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const questions: ParsedQuestion[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      // Parse answers (pipe-separated: option1||option2||option3||option4)
      const answerOptions = row.answers ? row.answers.split('||').map((opt: string) => opt.trim()) : [];
      const correctAnswerIndex = parseInt(row.correctIndex) || 0;

      questions.push({
        sectionId: row.sectionId || defaultSectionId,
        title: row.title,
        questionText: row.questionText || row.bodyMd || "",
        explanation: row.explanation || row.explanationMd || "",
        answerOptions,
        correctAnswerIndex,
        imageUrl: row.imageUrl,
        difficultyLevel: (row.difficulty || row.difficultyLevel || "medium") as "easy" | "medium" | "hard",
        tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
        status: (row.status || "draft") as "draft" | "review" | "published"
      });
    }

    return questions;
  };

  const handleValidate = () => {
    if (parsedQuestions.length === 0) {
      toast({
        title: "Błąd",
        description: "Brak pytań do walidacji",
        variant: "destructive",
      });
      return;
    }

    validateMutation.mutate(parsedQuestions);
  };

  const handleImport = () => {
    if (!validationResult || validationResult.summary.valid === 0) {
      toast({
        title: "Błąd",
        description: "Brak poprawnych pytań do importu",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate(parsedQuestions);
  };

  const downloadTemplate = () => {
    const csvContent = `sectionId,title,questionText,explanation,answers,correctIndex,imageUrl,difficulty,tags,status
section-1,"Przykładowe pytanie","Jakie jest prawidłowe rozpoznanie tego zapisu EKG?","To jest typowy obraz zawału serca...","Zawał serca||Migotanie przedsionków||Rytm zatokowy||Blok AV",0,"","medium","zawał,ekg","draft"`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_pytania.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setFile(null);
    setDefaultSectionId("");
    setParsedQuestions([]);
    setValidationResult(null);
    setImportResult(null);
    setStep("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import pytań hurtowo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === "upload" ? "bg-primary text-primary-foreground" : 
              ["validate", "preview", "import", "results"].includes(step) ? "bg-green-500 text-white" : "bg-muted"
            }`}>
              <Upload className="h-4 w-4" />
            </div>
            <div className="h-px bg-border flex-1" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === "validate" ? "bg-primary text-primary-foreground" : 
              ["preview", "import", "results"].includes(step) ? "bg-green-500 text-white" : "bg-muted"
            }`}>
              <CheckCircle className="h-4 w-4" />
            </div>
            <div className="h-px bg-border flex-1" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === "preview" ? "bg-primary text-primary-foreground" : 
              ["import", "results"].includes(step) ? "bg-green-500 text-white" : "bg-muted"
            }`}>
              <Eye className="h-4 w-4" />
            </div>
            <div className="h-px bg-border flex-1" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              ["import", "results"].includes(step) ? "bg-green-500 text-white" : "bg-muted"
            }`}>
              <FileText className="h-4 w-4" />
            </div>
          </div>

          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Wybierz plik CSV lub JSON z pytaniami do importu. Każde pytanie musi zawierać: sekcję, treść pytania, wyjaśnienie, 4 opcje odpowiedzi i wskazanie poprawnej odpowiedzi.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="defaultSection">Domyślna sekcja (opcjonalna)</Label>
                  <Select value={defaultSectionId} onValueChange={setDefaultSectionId}>
                    <SelectTrigger data-testid="select-default-section">
                      <SelectValue placeholder="Wybierz sekcję" />
                    </SelectTrigger>
                    <SelectContent>
                      {modules.map(module => 
                        module.sections.map(section => (
                          <SelectItem key={section.id} value={section.id}>
                            {module.title} - {section.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
                    <Download className="h-4 w-4 mr-2" />
                    Pobierz szablon CSV
                  </Button>
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-import-file"
                />
                <div className="space-y-4">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">Przeciągnij plik lub kliknij aby wybrać</p>
                    <p className="text-sm text-muted-foreground">Obsługiwane formaty: CSV, JSON</p>
                  </div>
                  <Button onClick={() => fileInputRef.current?.click()} data-testid="button-select-file">
                    Wybierz plik
                  </Button>
                </div>
              </div>

              {file && (
                <Alert>
                  <AlertDescription>
                    Wybrano plik: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 2: Validate */}
          {step === "validate" && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Znaleziono <strong>{parsedQuestions.length}</strong> pytań w pliku. Kliknij "Waliduj" aby sprawdzić poprawność danych.
                </AlertDescription>
              </Alert>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Cofnij
                </Button>
                <Button 
                  onClick={handleValidate} 
                  disabled={validateMutation.isPending}
                  data-testid="button-validate"
                >
                  {validateMutation.isPending ? "Walidowanie..." : "Waliduj pytania"}
                </Button>
              </div>

              {validateMutation.isPending && (
                <div className="space-y-2">
                  <Progress value={50} />
                  <p className="text-sm text-muted-foreground text-center">Sprawdzanie poprawności pytań...</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && validationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{validationResult.summary.valid}</div>
                  <div className="text-sm text-muted-foreground">Poprawne</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{validationResult.summary.invalid}</div>
                  <div className="text-sm text-muted-foreground">Błędne</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{validationResult.summary.total}</div>
                  <div className="text-sm text-muted-foreground">Łącznie</div>
                </div>
              </div>

              {validationResult.validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Błędy walidacji:</strong></p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {validationResult.validationErrors.slice(0, 10).map((error, index) => (
                          <div key={index} className="text-sm">
                            Pytanie {error.index + 1}: {error.errors.join(", ")}
                          </div>
                        ))}
                        {validationResult.validationErrors.length > 10 && (
                          <p className="text-sm">I {validationResult.validationErrors.length - 10} więcej błędów...</p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("validate")}>
                  Cofnij
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={validationResult.summary.valid === 0}
                  data-testid="button-import"
                >
                  Importuj {validationResult.summary.valid} pytań
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Import */}
          {step === "import" && (
            <div className="space-y-4">
              <div className="text-center">
                <Progress value={importMutation.isPending ? 50 : 100} />
                <p className="text-sm text-muted-foreground mt-2">
                  {importMutation.isPending ? "Importowanie pytań..." : "Import zakończony"}
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Results */}
          {step === "results" && importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.summary.created}</div>
                  <div className="text-sm text-muted-foreground">Utworzone</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{importResult.summary.failed}</div>
                  <div className="text-sm text-muted-foreground">Nieudane</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{importResult.summary.total}</div>
                  <div className="text-sm text-muted-foreground">Łącznie</div>
                </div>
              </div>

              {importResult.results.some(r => r.status === 'failed') && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Nieudane importy:</strong></p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importResult.results
                          .filter(r => r.status === 'failed')
                          .slice(0, 10)
                          .map((result, index) => (
                            <div key={index} className="text-sm">
                              Pytanie {result.index + 1}: {result.errors?.join(", ")}
                            </div>
                          ))}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center">
                <Button onClick={handleClose} data-testid="button-close-results">
                  Zamknij
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}