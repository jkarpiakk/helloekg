import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ProgressCard from "./ProgressCard";
import { Play, RotateCcw, Crown, Award, Heart, CheckCircle, AlertCircle, Flame, ChevronRight, Target, Clock, HelpCircle
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
      {/* Mobile Header - app-style with glassmorphism */}
      <div className="md:hidden sticky top-0 z-40 bg-card/90 backdrop-blur-lg border-b border-border/50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground" data-testid="welcome-message-mobile">
                Cześć, {user?.firstName}!
              </h1>
              <p className="text-base text-muted-foreground">Kontynuuj swoją naukę</p>
            </div>
            <div className="flex items-center gap-2">
              {stats.streak > 0 && (
                <div className="flex items-center gap-1.5 bg-chart-3/15 text-chart-3 px-3 py-2 rounded-xl text-base font-semibold" data-testid="mobile-streak-badge">
                  <Flame className="h-5 w-5" />
                  {stats.streak}
                </div>
              )}
              {subscription && (
                <div className="bg-chart-2/15 text-chart-2 p-2.5 rounded-xl">
                  <Crown className="h-5 w-5" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block bg-card border-b border-border">
        <div className="max-w-6xl lg:max-w-[min(92vw,1680px)] mx-auto px-4 md:px-6 lg:px-8 xl:px-12 py-4 md:py-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground" data-testid="welcome-message">
                {t("dashboard.welcome")}, {user?.firstName}!
              </h1>
              <p className="text-base text-muted-foreground">{t("dashboard.continueWhere")}</p>
            </div>
            {subscription && (
              <div className="bg-chart-2/10 text-chart-2 px-4 py-2.5 rounded-lg border border-chart-2/20 text-base inline-flex items-center self-start md:self-auto">
                <Crown className="h-5 w-5 mr-2" />
                Plan aktywny do {new Date(subscription.endDate).toLocaleDateString('pl-PL')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 md:max-w-6xl lg:max-w-[min(92vw,1680px)] md:mx-auto md:px-6 lg:px-8 xl:px-12 md:py-8">
        <div className="grid lg:grid-cols-[2fr_1fr] gap-5 md:gap-6">
          {/* Main content */}
          <div className="space-y-5 md:space-y-6">
            {/* Progress Overview */}
            <ProgressCard
              overallProgress={overallProgress}
              successRate={stats.successRate * 100}
              streak={stats.streak}
            />

            {/* Continue Learning - Mobile: snap-scroll carousel, Desktop: grid */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 md:hidden">Kontynuuj</h2>
              <Card className="hidden md:block overflow-hidden">
                <CardHeader className="pb-2 px-6 pt-4">
                  <CardTitle className="text-lg">{t("dashboard.continue")}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <Link href="/lecture" className="block">
                      <div className="h-full p-4 border border-primary/20 rounded-xl bg-gradient-to-br from-primary/10 to-chart-2/5 hover:shadow-md transition-all cursor-pointer">
                        <div className="w-11 h-11 bg-primary/20 rounded-xl flex items-center justify-center mb-3">
                          <Heart className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-foreground">Interaktywny wykład</h3>
                          <Badge className="bg-chart-2/20 text-chart-2 border-0 text-xs px-1.5 py-0">NOWE</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Podstawy EKG</p>
                      </div>
                    </Link>
                    <Link href="/quiz" className="block">
                      <div className="h-full p-4 border border-border rounded-xl hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                        <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                          <Play className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-1">Kontynuuj naukę</h3>
                        <p className="text-sm text-muted-foreground">Moduł 1 • Ostatnia aktywność: 2h</p>
                      </div>
                    </Link>
                    <Link href="/quiz?mode=review" className="block">
                      <div className="h-full p-4 border border-chart-3/20 rounded-xl bg-gradient-to-br from-chart-3/5 to-transparent hover:shadow-md transition-all cursor-pointer">
                        <div className="w-11 h-11 bg-chart-3/10 rounded-xl flex items-center justify-center mb-3">
                          <RotateCcw className="h-5 w-5 text-chart-3" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-1">{t("dashboard.review")}</h3>
                        <p className="text-sm text-muted-foreground">5 pytań do powtórki</p>
                      </div>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              
              {/* Mobile: Snap-scroll carousel */}
              <div className="md:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                <div className="flex gap-4 pb-2">
                  <Link href="/lecture" className="flex-shrink-0 w-[280px] snap-start">
                    <div className="h-full p-5 border border-primary/20 rounded-2xl bg-gradient-to-br from-primary/15 to-chart-2/10 active:scale-[0.97] transition-transform touch-manipulation shadow-sm">
                      <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
                        <Heart className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">Interaktywny wykład</h3>
                        <Badge className="bg-chart-2/25 text-chart-2 border-0 text-xs px-2 py-0.5">NOWE</Badge>
                      </div>
                      <p className="text-base text-muted-foreground">Podstawy EKG</p>
                    </div>
                  </Link>

                  <Link href="/quiz" className="flex-shrink-0 w-[280px] snap-start">
                    <div className="h-full p-5 border border-border rounded-2xl bg-card active:scale-[0.97] transition-transform touch-manipulation shadow-sm">
                      <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mb-4">
                        <Play className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Kontynuuj naukę</h3>
                      <p className="text-base text-muted-foreground">Moduł 1 • Ostatnia aktywność: 2h</p>
                    </div>
                  </Link>

                  <Link href="/quiz?mode=review" className="flex-shrink-0 w-[280px] snap-start">
                    <div className="h-full p-5 border border-chart-3/25 rounded-2xl bg-gradient-to-br from-chart-3/10 to-transparent active:scale-[0.97] transition-transform touch-manipulation shadow-sm">
                      <div className="w-14 h-14 bg-chart-3/15 rounded-2xl flex items-center justify-center mb-4">
                        <RotateCcw className="h-7 w-7 text-chart-3" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">{t("dashboard.review")}</h3>
                      <p className="text-base text-muted-foreground">5 pytań do powtórki</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            {/* Module Progress */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 md:hidden">Postęp w modułach</h2>
              <Card className="md:block">
                <CardHeader className="pb-2 px-4 md:px-6 pt-4 hidden md:block">
                  <CardTitle className="text-lg">{t("dashboard.moduleProgress")}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 pt-4 md:pt-0">
                  <div className="space-y-3">
                    {sections?.map((section) => (
                      <Link 
                        key={section.id} 
                        href={`/quiz?sectionId=${section.id}`}
                        className="block"
                      >
                        <div className="flex items-center gap-4 p-4 md:p-3 border border-border rounded-2xl md:rounded-lg hover:shadow-md hover:border-primary/50 active:scale-[0.98] transition-all cursor-pointer group touch-manipulation min-h-[72px] md:min-h-0">
                          <div className={`w-12 h-12 md:w-10 md:h-10 rounded-xl md:rounded-lg flex items-center justify-center flex-shrink-0 ${
                            section.completionPercentage >= 100 
                              ? 'bg-chart-2/15' 
                              : section.completionPercentage > 0 
                                ? 'bg-primary/15' 
                                : 'bg-muted'
                          }`}>
                            {section.completionPercentage >= 100 ? (
                              <CheckCircle className="h-6 w-6 md:h-5 md:w-5 text-chart-2" />
                            ) : (
                              <Play className={`h-6 w-6 md:h-5 md:w-5 ${
                                section.completionPercentage > 0 
                                  ? 'text-primary' 
                                  : 'text-muted-foreground'
                              }`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-2 md:mb-1">
                              <h4 className="text-base md:text-sm font-medium text-foreground line-clamp-1">{section.title}</h4>
                              <span className="text-base md:text-sm text-muted-foreground font-semibold flex-shrink-0">
                                {Math.round(section.completionPercentage)}%
                              </span>
                            </div>
                            <div className="h-2 md:h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  section.completionPercentage >= 100 ? 'bg-chart-2' : 'bg-primary'
                                }`}
                                style={{ width: `${section.completionPercentage}%` }}
                              />
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 md:hidden" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:space-y-3">
            {/* Mobile section title */}
            <h2 className="text-lg font-semibold text-foreground md:hidden">Twoje statystyki</h2>
            
            {/* Certificate Section */}
            <Card className="rounded-2xl md:rounded-xl">
              <CardHeader className="pb-2 px-4 md:px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-5 w-5 md:h-4 md:w-4 text-chart-2" />
                  Certyfikat
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {myCertificates && myCertificates.length > 0 ? (
                  <div className="flex items-center gap-4 md:gap-3 p-4 md:p-3 bg-chart-2/10 border border-chart-2/20 rounded-xl md:rounded-lg">
                    <CheckCircle className="h-6 w-6 md:h-5 md:w-5 text-chart-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-base md:text-sm font-medium text-foreground">EKG Academy</p>
                      <p className="text-sm md:text-xs text-muted-foreground">{new Date(myCertificates[0].issuedAt).toLocaleDateString('pl-PL')}</p>
                    </div>
                    <Link href={`/certificate/${myCertificates[0].certificateId}`}>
                      <Button size="sm" className="h-11 md:h-9 px-4" data-testid="button-view-certificate">Zobacz</Button>
                    </Link>
                  </div>
                ) : certificateEligibility?.isEligible ? (
                  <div className="space-y-3 md:space-y-2">
                    <div className="flex items-center gap-3 md:gap-2 p-4 md:p-3 bg-chart-2/10 border border-chart-2/20 rounded-xl md:rounded-lg">
                      <CheckCircle className="h-5 w-5 md:h-4 md:w-4 text-chart-2" />
                      <p className="text-base md:text-sm text-chart-2 font-medium">Możesz otrzymać certyfikat!</p>
                    </div>
                    <Button 
                      className="w-full h-12 md:h-10 text-base md:text-sm" 
                      onClick={() => generateCertificateMutation.mutate()}
                      disabled={generateCertificateMutation.isPending}
                      data-testid="button-generate-certificate"
                    >
                      {generateCertificateMutation.isPending ? 'Generowanie...' : 'Generuj certyfikat'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 md:space-y-2">
                    <div className="flex items-center gap-3 md:gap-2 p-4 md:p-3 bg-muted rounded-xl md:rounded-lg">
                      <AlertCircle className="h-5 w-5 md:h-4 md:w-4 text-muted-foreground" />
                      <p className="text-base md:text-sm text-muted-foreground">Ukończ wymagania</p>
                    </div>
                    <div className="flex gap-3 md:gap-2">
                      <div className="flex-1 bg-muted/50 rounded-xl md:rounded-lg p-4 md:p-3 text-center">
                        <div className={`text-xl md:text-lg font-bold ${certificateEligibility?.completedModules === certificateEligibility?.totalModules ? "text-chart-2" : "text-foreground"}`}>
                          {certificateEligibility?.completedModules || 0}/{certificateEligibility?.totalModules || 0}
                        </div>
                        <div className="text-sm md:text-xs text-muted-foreground">Moduły</div>
                      </div>
                      <div className="flex-1 bg-muted/50 rounded-xl md:rounded-lg p-4 md:p-3 text-center">
                        <div className={`text-xl md:text-lg font-bold ${certificateEligibility?.successRate >= 0.8 ? "text-chart-2" : "text-foreground"}`}>
                          {Math.round((certificateEligibility?.successRate || 0) * 100)}%
                        </div>
                        <div className="text-sm md:text-xs text-muted-foreground">Min. 80%</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weak areas */}
            <Card className="rounded-2xl md:rounded-xl">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-5 w-5 md:h-4 md:w-4 text-chart-4" />
                  {t("dashboard.weakAreas")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3 md:space-y-2">
                  {weakAreas.slice(0, 3).map((area) => (
                    <div key={area.tag} className="flex items-center gap-3 md:gap-2 p-3 md:p-2 bg-muted/30 rounded-xl md:rounded-lg min-h-[52px] md:min-h-0">
                      <span className="text-base md:text-sm text-foreground flex-1 min-w-0">{area.tag}</span>
                      <div className="flex items-center gap-3 md:gap-2 flex-shrink-0">
                        <div className="w-20 md:w-16 h-2 md:h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              area.successRate < 0.5 ? 'bg-destructive' : 
                              area.successRate < 0.7 ? 'bg-chart-4' : 'bg-chart-2'
                            }`}
                            style={{ width: `${area.successRate * 100}%` }}
                          />
                        </div>
                        <span className="text-base md:text-sm text-muted-foreground w-12 md:w-10 text-right font-semibold">
                          {Math.round(area.successRate * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {weakAreas.length === 0 && (
                    <p className="text-base md:text-sm text-muted-foreground text-center py-4 md:py-2">Brak słabych obszarów</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card className="rounded-2xl md:rounded-xl">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-primary" />
                  Statystyki
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3 md:space-y-2">
                  <div className="flex justify-between items-center p-4 md:p-3 bg-muted/50 rounded-xl md:rounded-lg min-h-[56px] md:min-h-0">
                    <div className="flex items-center gap-3 md:gap-2">
                      <HelpCircle className="h-5 w-5 md:hidden text-muted-foreground" />
                      <span className="text-base md:text-sm text-muted-foreground">Rozwiązane pytania</span>
                    </div>
                    <span className="text-xl md:text-base font-bold text-foreground">{stats.totalAttempts}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 md:p-3 bg-muted/50 rounded-xl md:rounded-lg min-h-[56px] md:min-h-0">
                    <div className="flex items-center gap-3 md:gap-2">
                      <Clock className="h-5 w-5 md:hidden text-muted-foreground" />
                      <span className="text-base md:text-sm text-muted-foreground">Średni czas</span>
                    </div>
                    <span className="text-xl md:text-base font-bold text-foreground">{Math.round(stats.avgTime / 1000)}s</span>
                  </div>
                  <div className="flex justify-between items-center p-4 md:p-3 bg-muted/50 rounded-xl md:rounded-lg min-h-[56px] md:min-h-0">
                    <div className="flex items-center gap-3 md:gap-2">
                      <Flame className="h-5 w-5 md:hidden text-chart-3" />
                      <span className="text-base md:text-sm text-muted-foreground">Obecna seria</span>
                    </div>
                    <span className="text-xl md:text-base font-bold text-chart-3">{stats.streak}</span>
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
