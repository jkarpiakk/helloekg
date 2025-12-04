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
      {/* Dashboard Header - ultra compact on mobile */}
      <div className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight" data-testid="welcome-message">
                {t("dashboard.welcome")}, {user?.firstName}!
              </h1>
              <p className="text-xs sm:text-base text-muted-foreground">{t("dashboard.continueWhere")}</p>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              {subscription && (
                <div className="bg-chart-2/10 text-chart-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-chart-2/20 text-[11px] sm:text-sm">
                  <Crown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 inline" />
                  <span className="hidden sm:inline">Plan do </span>
                  {new Date(subscription.endDate).toLocaleDateString('pl-PL')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        <div className="grid lg:grid-cols-[2fr_1fr] gap-3 sm:gap-6 lg:gap-8">
          {/* Main content */}
          <div className="space-y-3 sm:space-y-6 lg:space-y-8">
            {/* Progress Overview */}
            <ProgressCard
              overallProgress={overallProgress}
              successRate={stats.successRate * 100}
              streak={stats.streak}
            />

            {/* Continue Learning */}
            <Card>
              <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6">
                <CardTitle className="text-sm sm:text-lg">{t("dashboard.continue")}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4 lg:gap-6">
                  {/* Interactive Lecture */}
                  <Link href="/lecture" className="block">
                    <div className="p-3 sm:p-5 border border-border rounded-xl hover:shadow-lg active:shadow-xl active:scale-[0.98] transition-all cursor-pointer group bg-gradient-to-br from-primary/5 to-chart-2/5 touch-manipulation">
                      <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Heart className="h-5 w-5 text-primary animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 sm:mt-3 sm:mb-2">
                            <h3 className="text-sm font-semibold text-foreground truncate">Interaktywny wykład</h3>
                            <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20 text-[10px] sm:text-xs px-1.5 py-0">NOWE</Badge>
                          </div>
                          <p className="text-[11px] sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none sm:mb-3">
                            Podstawy EKG przez wizualne analogie
                          </p>
                          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>45 min • 9 sekcji</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Continue where left off */}
                  <Link href="/quiz" className="block">
                    <div className="p-3 sm:p-5 border border-border rounded-xl hover:shadow-lg active:shadow-xl active:scale-[0.98] transition-all cursor-pointer group touch-manipulation">
                      <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Play className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between sm:mt-3 sm:mb-2">
                            <h3 className="text-sm font-semibold text-foreground">Kontynuuj naukę</h3>
                            <span className="text-[11px] sm:text-xs text-muted-foreground">Moduł 1</span>
                          </div>
                          <p className="text-[11px] sm:text-sm text-muted-foreground">{t("dashboard.lastActivity")} 2h</p>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Review mistakes */}
                  <Link href="/quiz?mode=review" className="block">
                    <div className="p-3 sm:p-5 border border-border rounded-xl hover:shadow-lg active:shadow-xl active:scale-[0.98] transition-all cursor-pointer group touch-manipulation">
                      <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-chart-3/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <RotateCcw className="h-5 w-5 text-chart-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between sm:mt-3 sm:mb-2">
                            <h3 className="text-sm font-semibold text-foreground">{t("dashboard.review")}</h3>
                            <span className="text-[11px] sm:text-xs text-muted-foreground">5 pytań</span>
                          </div>
                          <p className="text-[11px] sm:text-sm text-muted-foreground">{t("dashboard.strengthenKnowledge")}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Module Progress */}
            <Card>
              <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6">
                <CardTitle className="text-sm sm:text-lg">{t("dashboard.moduleProgress")}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-2 sm:space-y-3">
                  {sections?.map((section, index) => (
                    <Link 
                      key={section.id} 
                      href={`/quiz?sectionId=${section.id}`}
                      className="block"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-4 border border-border rounded-lg hover:shadow-lg hover:border-primary/50 active:shadow-xl active:scale-[0.98] transition-all cursor-pointer group touch-manipulation">
                        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${
                          section.completionPercentage >= 100 
                            ? 'bg-chart-2/10' 
                            : section.completionPercentage > 0 
                              ? 'bg-primary/10' 
                              : 'bg-muted'
                        }`}>
                          <Play className={`h-4 w-4 sm:h-5 sm:w-5 ${
                            section.completionPercentage >= 100 
                              ? 'text-chart-2' 
                              : section.completionPercentage > 0 
                                ? 'text-primary' 
                                : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-foreground truncate">{section.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 sm:h-2 bg-secondary rounded-full overflow-hidden max-w-[120px] sm:max-w-none">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${section.completionPercentage}%` }}
                              />
                            </div>
                            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium whitespace-nowrap">
                              {Math.round(section.completionPercentage)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-3 sm:space-y-6">
            {/* Certificate Section */}
            <Card>
              <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
                  <Award className="h-4 w-4 sm:h-5 sm:w-5 text-chart-2" />
                  Certyfikat
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {myCertificates && myCertificates.length > 0 ? (
                  <div className="space-y-2">
                    <div className="p-2.5 sm:p-4 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <h4 className="text-xs sm:text-sm font-semibold text-foreground">EKG Academy</h4>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {new Date(myCertificates[0].issuedAt).toLocaleDateString('pl-PL')}
                          </p>
                        </div>
                        <CheckCircle className="h-4 w-4 text-chart-2" />
                      </div>
                      <Link href={`/certificate/${myCertificates[0].certificateId}`}>
                        <Button size="sm" className="w-full h-8 text-xs" data-testid="button-view-certificate">
                          Zobacz
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : certificateEligibility?.isEligible ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-chart-2 flex-shrink-0" />
                      <p className="text-xs text-chart-2 font-medium">
                        Możesz otrzymać certyfikat!
                      </p>
                    </div>
                    <Button 
                      className="w-full h-8 text-xs" 
                      size="sm"
                      onClick={() => generateCertificateMutation.mutate()}
                      disabled={generateCertificateMutation.isPending}
                      data-testid="button-generate-certificate"
                    >
                      {generateCertificateMutation.isPending ? 'Generowanie...' : 'Generuj certyfikat'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Ukończ wymagania
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/50 rounded p-2 text-center">
                        <div className={`font-bold ${certificateEligibility?.completedModules === certificateEligibility?.totalModules ? "text-chart-2" : "text-foreground"}`}>
                          {certificateEligibility?.completedModules || 0}/{certificateEligibility?.totalModules || 0}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Moduły</div>
                      </div>
                      <div className="bg-muted/50 rounded p-2 text-center">
                        <div className={`font-bold ${certificateEligibility?.successRate >= 0.8 ? "text-chart-2" : "text-foreground"}`}>
                          {Math.round((certificateEligibility?.successRate || 0) * 100)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">Min. 80%</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weak areas - compact on mobile */}
            <Card>
              <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6">
                <CardTitle className="text-sm sm:text-lg">{t("dashboard.weakAreas")}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-2 sm:space-y-3">
                  {weakAreas.slice(0, 3).map((area, index) => (
                    <div key={area.tag} className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm text-foreground truncate flex-1">{area.tag}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="w-12 sm:w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              area.successRate < 0.5 ? 'bg-destructive' : 
                              area.successRate < 0.7 ? 'bg-chart-4' : 'bg-chart-2'
                            }`}
                            style={{ width: `${area.successRate * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground w-8 text-right">
                          {Math.round(area.successRate * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {weakAreas.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Brak słabych obszarów
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick stats - compact grid on mobile */}
            <Card>
              <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6">
                <CardTitle className="text-sm sm:text-lg">Statystyki</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="grid grid-cols-3 gap-2 sm:space-y-0 sm:grid-cols-1 sm:gap-3">
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-0 sm:bg-transparent text-center sm:text-left sm:flex sm:justify-between">
                    <span className="block sm:inline text-[10px] sm:text-sm text-muted-foreground">Pytania</span>
                    <span className="block sm:inline text-sm sm:text-sm font-bold sm:font-semibold text-foreground">{stats.totalAttempts}</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-0 sm:bg-transparent text-center sm:text-left sm:flex sm:justify-between">
                    <span className="block sm:inline text-[10px] sm:text-sm text-muted-foreground">Śr. czas</span>
                    <span className="block sm:inline text-sm sm:text-sm font-bold sm:font-semibold text-foreground">{Math.round(stats.avgTime / 1000)}s</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 sm:p-0 sm:bg-transparent text-center sm:text-left sm:flex sm:justify-between">
                    <span className="block sm:inline text-[10px] sm:text-sm text-muted-foreground">Seria</span>
                    <span className="block sm:inline text-sm sm:text-sm font-bold sm:font-semibold text-foreground">{stats.streak}</span>
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
