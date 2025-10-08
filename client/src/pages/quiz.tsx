import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import QuizInterface from "@/components/quiz/QuizInterface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { ArrowLeft, BookOpen, Clock, Target } from "lucide-react";
import { Link } from "wouter";
import type { SectionWithProgress } from "@/types";

export default function Quiz() {
  const [, setLocation] = useLocation();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [quizMode, setQuizMode] = useState<"learn" | "review" | "exam">("learn");
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const sectionParam = urlParams.get('section');
  const modeParam = urlParams.get('mode') as "learn" | "review" | "exam" | null;

  // Set initial values from URL
  useState(() => {
    if (sectionParam) setSelectedSection(sectionParam);
    if (modeParam) setQuizMode(modeParam);
  });

  // Fetch sections with progress
  const { data: sections, isLoading } = useQuery({
    queryKey: ["/api/sections"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sections");
      return response.json() as Promise<SectionWithProgress[]>;
    },
    enabled: isAuthenticated,
  });

  // Fetch review queue for review mode
  const { data: reviewQueue } = useQuery({
    queryKey: ["/api/review-queue"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/review-queue");
      return response.json();
    },
    enabled: isAuthenticated && quizMode === "review",
  });

  // Redirect if not authenticated
  if (!isAuthenticated) {
    setLocation("/?auth=login");
    return null;
  }

  // Show loading while fetching data
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show quiz interface if section is selected OR in review mode
  if (selectedSection || quizMode === "review") {
    return (
      <QuizInterface
        sectionId={quizMode === "review" ? undefined : selectedSection}
        mode={quizMode}
        onExit={() => {
          setSelectedSection(null);
          setQuizMode("learn");
          setLocation("/quiz");
        }}
      />
    );
  }

  // Show section selection
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild data-testid="back-to-dashboard">
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Wróć do panelu
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Wybierz tryb nauki</h1>
                <p className="text-muted-foreground">Kontynuuj naukę EKG w wybranym trybie</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Mode Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${
              quizMode === "learn" ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => setQuizMode("learn")}
            data-testid="quiz-mode-learn"
          >
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Tryb nauki</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Ucz się nowych zagadnień z natychmiastowym feedbackiem
              </p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${
              quizMode === "review" ? "border-chart-3 bg-chart-3/5" : ""
            }`}
            onClick={() => setQuizMode("review")}
            data-testid="quiz-mode-review"
          >
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-chart-3/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-chart-3" />
              </div>
              <CardTitle>Powtórka błędów</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Powtórz pytania, które sprawiły Ci trudność
              </p>
              {reviewQueue && (
                <Badge variant="outline" className="mt-2 mx-auto block w-fit">
                  {reviewQueue.questionIds?.length || 0} pytań do powtórzenia
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 ${
              quizMode === "exam" ? "border-chart-4 bg-chart-4/5" : ""
            }`}
            onClick={() => setQuizMode("exam")}
            data-testid="quiz-mode-exam"
          >
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-chart-4/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-chart-4" />
              </div>
              <CardTitle>Egzamin próbny</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Sprawdź swoją wiedzę w trybie egzaminacyjnym
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Review mode message when no questions available */}
        {quizMode === "review" && reviewQueue && reviewQueue.questionIds?.length === 0 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">Brak pytań do powtórzenia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                Nie masz jeszcze błędnych odpowiedzi do powtórzenia. Kontynuuj naukę w trybie standardowym!
              </p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => setQuizMode("learn")} data-testid="button-switch-to-learn">
                  Przejdź do trybu nauki
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Selection - only show for learn/exam mode */}
        {quizMode !== "review" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Wybierz moduł</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections?.map((section, index) => {
              const isLocked = section.isLocked && section.completionPercentage < 100;
              const isCompleted = section.completionPercentage >= 100;
              
              return (
                <Card 
                  key={section.id}
                  className={`transition-all hover:shadow-lg ${
                    isLocked 
                      ? "opacity-50 cursor-not-allowed" 
                      : "cursor-pointer hover:-translate-y-1"
                  }`}
                  onClick={() => !isLocked && setSelectedSection(section.id)}
                  data-testid={`section-${section.id}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        isCompleted 
                          ? "bg-chart-2/10" 
                          : section.completionPercentage > 0 
                            ? "bg-primary/10" 
                            : "bg-muted"
                      }`}>
                        {isLocked ? (
                          <div className="w-6 h-6 bg-muted-foreground rounded" />
                        ) : (
                          <BookOpen className={`h-6 w-6 ${
                            isCompleted 
                              ? "text-chart-2" 
                              : section.completionPercentage > 0 
                                ? "text-primary" 
                                : "text-muted-foreground"
                          }`} />
                        )}
                      </div>
                      {isCompleted && (
                        <Badge className="bg-chart-2/10 text-chart-2">
                          Ukończono
                        </Badge>
                      )}
                    </div>
                    <CardTitle className={isLocked ? "text-muted-foreground" : ""}>
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {section.description && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {section.description}
                      </p>
                    )}
                    
                    {isLocked ? (
                      <p className="text-sm text-muted-foreground">
                        Ukończ poprzedni moduł aby odblokować
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Postęp</span>
                          <span className="font-mono">{Math.round(section.completionPercentage)}%</span>
                        </div>
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${section.completionPercentage}%` }}
                          />
                        </div>
                        {section.lastActivity && (
                          <p className="text-xs text-muted-foreground">
                            Ostatnia aktywność: {new Date(section.lastActivity).toLocaleDateString('pl-PL')}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
