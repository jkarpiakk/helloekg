import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ProgressCard from "./ProgressCard";
import { Play, RotateCcw, Crown, Target, Flame, Award, Heart, Clock, CheckCircle, AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { SectionWithProgress, UserProgress, WeakArea, Certificate } from "@/types";

export default function StudentDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch sections with progress
  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ["/api/sections"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sections");
      return response.json() as Promise<SectionWithProgress[]>;
    },
  });

  // Fetch user progress and statistics
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["/api/progress"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/progress");
      return response.json() as Promise<{
        progress: any[];
        stats: UserProgress;
        weakAreas: WeakArea[];
      }>;
    },
  });

  // Fetch subscription status
  const { data: subscription } = useQuery({
    queryKey: ["/api/subscription/status"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subscription/status");
      return response.json();
    },
    retry: false,
  });

  // Fetch certificate eligibility
  const { data: certificateEligibility } = useQuery({
    queryKey: ["/api/certificates/eligibility"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/certificates/eligibility");
      return response.json();
    },
  });

  // Fetch user certificates
  const { data: myCertificates } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates/my"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/certificates/my");
      return response.json();
    },
  });

  // Generate certificate mutation
  const generateCertificateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/certificates/generate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/eligibility"] });
      toast({
        title: "Certyfikat wygenerowany!",
        description: "Twój certyfikat ukończenia kursu został wygenerowany.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wygenerować certyfikatu",
        variant: "destructive",
      });
    },
  });

  if (sectionsLoading || progressLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const stats = progressData?.stats || { totalAttempts: 0, successRate: 0, avgTime: 0, streak: 0 };
  const weakAreas = progressData?.weakAreas || [];
  const overallProgress = sections ? 
    sections.reduce((acc, section) => acc + section.completionPercentage, 0) / sections.length : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground" data-testid="welcome-message">
                {t("dashboard.welcome")}, {user?.firstName}!
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">{t("dashboard.continueWhere")}</p>
            </div>
            <div className="flex items-center space-x-4">
              {subscription && (
                <div className="bg-chart-2/10 text-chart-2 px-3 sm:px-4 py-2 rounded-lg border border-chart-2/20 text-xs sm:text-sm">
                  <Crown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 inline" />
                  <span className="hidden sm:inline">Plan aktywny do </span>
                  {new Date(subscription.endDate).toLocaleDateString('pl-PL')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Progress Overview */}
            <ProgressCard
              overallProgress={overallProgress}
              successRate={stats.successRate * 100}
              streak={stats.streak}
            />

            {/* Continue Learning */}
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.continue")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
                  {/* Interactive Lecture */}
                  <Link href="/lecture" className="block">
                    <div className="p-4 sm:p-6 border border-border rounded-xl hover:shadow-lg active:shadow-xl active:scale-[0.98] transition-all cursor-pointer group bg-gradient-to-br from-primary/5 to-chart-2/5 touch-manipulation">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse" />
                        </div>
                        <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20">NOWE!</Badge>
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">Interaktywny wykład EKG</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                        Zapoznaj się z podstawami EKG przez wizualne analogie i interaktywne prezentacje
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>45 min</span>
                        <span>•</span>
                        <span>9 sekcji</span>
                      </div>
                    </div>
                  </Link>

                  {/* Continue where left off */}
                  <Link href="/quiz" className="block">
                    <div className="p-4 sm:p-6 border border-border rounded-xl hover:shadow-lg active:shadow-xl active:scale-[0.98] transition-all cursor-pointer group touch-manipulation">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Play className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        </div>
                        <span className="text-sm text-muted-foreground">Moduł 1</span>
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">Kontynuuj naukę</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{t("dashboard.lastActivity")} 2 {t("dashboard.hoursAgo")}</p>
                    </div>
                  </Link>

                  {/* Review mistakes */}
                  <Link href="/quiz?mode=review" className="block">
                    <div className="p-4 sm:p-6 border border-border rounded-xl hover:shadow-lg active:shadow-xl active:scale-[0.98] transition-all cursor-pointer group touch-manipulation">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-chart-3/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6 text-chart-3" />
                        </div>
                        <span className="text-sm text-muted-foreground">5 pytań</span>
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">{t("dashboard.review")}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{t("dashboard.strengthenKnowledge")}</p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Module Progress */}
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.moduleProgress")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  {sections?.map((section, index) => (
                    <Link 
                      key={section.id} 
                      href={`/quiz?sectionId=${section.id}`}
                      className="block"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-4 border border-border rounded-lg hover:shadow-lg hover:border-primary/50 active:shadow-xl active:scale-[0.98] transition-all cursor-pointer group touch-manipulation">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${
                            section.completionPercentage >= 100 
                              ? 'bg-chart-2/10' 
                              : section.completionPercentage > 0 
                                ? 'bg-primary/10' 
                                : 'bg-muted'
                          }`}>
                            <Play className={`h-5 w-5 sm:h-6 sm:w-6 ${
                              section.completionPercentage >= 100 
                                ? 'text-chart-2' 
                                : section.completionPercentage > 0 
                                  ? 'text-primary' 
                                  : 'text-muted-foreground'
                            }`} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm sm:text-base font-semibold text-foreground truncate">{section.title}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              15 {t("dashboard.questions")} • {Math.round(section.completionPercentage)}% {t("dashboard.completed")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <div className="flex-1 sm:w-32 h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${section.completionPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs sm:text-sm text-muted-foreground font-mono w-12">
                            {Math.round(section.completionPercentage)}%
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Certificate Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-chart-2" />
                  Certyfikat ukończenia
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myCertificates && myCertificates.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground">Certyfikat EKG Academy</h4>
                          <p className="text-xs text-muted-foreground">
                            {new Date(myCertificates[0].issuedAt).toLocaleDateString('pl-PL')}
                          </p>
                        </div>
                        <CheckCircle className="h-5 w-5 text-chart-2" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        ID: {myCertificates[0].certificateId}
                      </p>
                      <Link href={`/certificate/${myCertificates[0].certificateId}`}>
                        <Button size="sm" className="w-full" data-testid="button-view-certificate">
                          Zobacz certyfikat
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : certificateEligibility?.isEligible ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-chart-2" />
                      <p className="text-sm text-chart-2 font-medium">
                        Gratulacje! Możesz otrzymać certyfikat
                      </p>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => generateCertificateMutation.mutate()}
                      disabled={generateCertificateMutation.isPending}
                      data-testid="button-generate-certificate"
                    >
                      {generateCertificateMutation.isPending ? (
                        <>Generowanie...</>
                      ) : (
                        <>
                          <Award className="h-4 w-4 mr-2" />
                          Generuj certyfikat
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Ukończ wymagania kursu
                      </p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ukończone moduły</span>
                        <span className={certificateEligibility?.completedModules === certificateEligibility?.totalModules ? "text-chart-2 font-semibold" : "text-foreground"}>
                          {certificateEligibility?.completedModules || 0}/{certificateEligibility?.totalModules || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Skuteczność</span>
                        <span className={certificateEligibility?.successRate >= 0.8 ? "text-chart-2 font-semibold" : "text-foreground"}>
                          {Math.round((certificateEligibility?.successRate || 0) * 100)}%
                          <span className="text-muted-foreground text-xs ml-1">(min. 80%)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weak areas */}
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.weakAreas")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {weakAreas.slice(0, 3).map((area, index) => (
                    <div key={area.tag} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{area.tag}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              area.successRate < 0.5 ? 'bg-destructive' : 
                              area.successRate < 0.7 ? 'bg-chart-4' : 'bg-chart-2'
                            }`}
                            style={{ width: `${area.successRate * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-10">
                          {Math.round(area.successRate * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {weakAreas.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Brak słabych obszarów - świetna robota!
                    </p>
                  )}
                </div>
                
                <Button variant="outline" className="w-full mt-4" size="sm">
                  Zobacz wszystkie
                </Button>
              </CardContent>
            </Card>

            {/* Achievement badges */}
            <Card>
              <CardHeader>
                <CardTitle>Ostatnie osiągnięcia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.streak >= 10 && (
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-chart-2/10 rounded-full flex items-center justify-center">
                        <Flame className="h-5 w-5 text-chart-2" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Seria {stats.streak} dni</h4>
                        <p className="text-xs text-muted-foreground">Systematyczna nauka</p>
                      </div>
                    </div>
                  )}
                  
                  {stats.successRate >= 0.9 && (
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Ekspert</h4>
                        <p className="text-xs text-muted-foreground">90%+ skuteczność</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card>
              <CardHeader>
                <CardTitle>Szybkie statystyki</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ukończone pytania</span>
                    <span className="text-sm font-semibold text-foreground">{stats.totalAttempts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Średni czas odpowiedzi</span>
                    <span className="text-sm font-semibold text-foreground">{Math.round(stats.avgTime / 1000)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Najlepsza seria</span>
                    <span className="text-sm font-semibold text-foreground">{stats.streak}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
