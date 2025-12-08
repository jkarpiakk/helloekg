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
  const overallProgress = sections && sections.length > 0 
    ? sections.reduce((acc, section) => acc + section.completionPercentage, 0) / sections.length 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* ===== MOBILE APP LAYOUT ===== */}
      <div className="md:hidden">
        {/* Mobile content - full app experience */}
        <div className="px-5 pt-6 pb-8 space-y-6 safe-bottom">
          
          {/* Greeting with premium feel */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-0.5">Witaj ponownie</p>
              <h1 className="text-2xl font-bold text-foreground" data-testid="welcome-message-mobile">
                {user?.firstName || 'Użytkowniku'}! 👋
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {stats.streak > 0 && (
                <div className="stat-card-orange rounded-2xl px-3 py-2 flex items-center gap-1.5" data-testid="mobile-streak-badge">
                  <Flame className="h-5 w-5 text-chart-3" />
                  <span className="text-lg font-bold text-chart-3">{stats.streak}</span>
                </div>
              )}
              {subscription && (
                <div className="stat-card-teal rounded-2xl p-2.5">
                  <Crown className="h-5 w-5 text-chart-2" />
                </div>
              )}
            </div>
          </div>
          
          {/* Hero Progress Card */}
          <ProgressCard
            overallProgress={overallProgress}
            successRate={stats.successRate * 100}
            streak={stats.streak}
          />
          
          {/* Quick Actions - Premium app-style tiles */}
          <div>
            <h2 className="text-section text-foreground mb-4">Szybkie akcje</h2>
            <div className="grid grid-cols-3 gap-3">
              <Link href="/quiz" className="block">
                <div className="action-tile rounded-2xl p-4 text-center touch-bounce shadow-app min-h-[100px] flex flex-col items-center justify-center" data-testid="action-continue">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-2">
                    <Play className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Kontynuuj</span>
                </div>
              </Link>
              
              <Link href="/quiz?mode=review" className="block">
                <div className="action-tile rounded-2xl p-4 text-center touch-bounce shadow-app min-h-[100px] flex flex-col items-center justify-center" data-testid="action-review">
                  <div className="w-12 h-12 rounded-2xl bg-chart-3/20 flex items-center justify-center mb-2">
                    <RotateCcw className="h-6 w-6 text-chart-3" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Powtórka</span>
                </div>
              </Link>
              
              <Link href="/lecture" className="block">
                <div className="action-tile rounded-2xl p-4 text-center touch-bounce shadow-app min-h-[100px] flex flex-col items-center justify-center relative" data-testid="action-lecture">
                  <div className="absolute -top-1 -right-1">
                    <span className="bg-chart-2 text-chart-2-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">NEW</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-chart-2/20 flex items-center justify-center mb-2">
                    <Heart className="h-6 w-6 text-chart-2" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Wykład</span>
                </div>
              </Link>
            </div>
          </div>
          
          {/* Module Progress - Compact premium cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-section text-foreground">Moduły</h2>
              <span className="text-sm text-muted-foreground">{sections?.length || 0} dostępnych</span>
            </div>
            <div className="space-y-3">
              {sections?.slice(0, 4).map((section, index) => (
                <Link 
                  key={section.id} 
                  href={`/quiz?sectionId=${section.id}`}
                  className="block"
                >
                  <div 
                    className={`bg-card border border-border rounded-2xl p-4 touch-bounce shadow-app motion-safe:animate-slide-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards]`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        section.completionPercentage >= 100 
                          ? 'bg-chart-2/20' 
                          : section.completionPercentage > 0 
                            ? 'bg-primary/20' 
                            : 'bg-muted/50'
                      }`}>
                        {section.completionPercentage >= 100 ? (
                          <CheckCircle className="h-7 w-7 text-chart-2" />
                        ) : (
                          <span className="text-xl font-bold text-foreground">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground mb-1 line-clamp-1">{section.title}</h3>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-700 ${
                                section.completionPercentage >= 100 ? 'bg-chart-2' : 'bg-primary'
                              }`}
                              style={{ width: `${section.completionPercentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-muted-foreground w-12 text-right">
                            {Math.round(section.completionPercentage)}%
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              ))}
              {sections && sections.length > 4 && (
                <Link href="/quiz" className="block">
                  <div className="bg-card border border-border rounded-2xl p-4 text-center touch-bounce shadow-sm">
                    <span className="text-sm font-medium text-primary">Zobacz wszystkie moduły →</span>
                  </div>
                </Link>
              )}
            </div>
          </div>
          
          {/* Certificate Status - Premium card */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-app-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-chart-2/20 flex items-center justify-center">
                <Award className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Certyfikat</h3>
                <p className="text-sm text-muted-foreground">EKG Academy</p>
              </div>
            </div>
            
            {myCertificates && myCertificates.length > 0 ? (
              <div className="flex items-center justify-between p-4 stat-card-teal rounded-2xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-chart-2" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Certyfikat zdobyty!</p>
                    <p className="text-xs text-muted-foreground">{new Date(myCertificates[0].issuedAt).toLocaleDateString('pl-PL')}</p>
                  </div>
                </div>
                <Link href={`/certificate/${myCertificates[0].certificateId}`}>
                  <Button size="sm" className="h-10 touch-bounce" data-testid="button-view-certificate">Zobacz</Button>
                </Link>
              </div>
            ) : certificateEligibility?.isEligible ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 stat-card-teal rounded-xl">
                  <CheckCircle className="h-5 w-5 text-chart-2" />
                  <p className="text-sm text-chart-2 font-medium">Możesz otrzymać certyfikat!</p>
                </div>
                <Button 
                  className="w-full h-12 text-base touch-bounce shadow-glow-success" 
                  onClick={() => generateCertificateMutation.mutate()}
                  disabled={generateCertificateMutation.isPending}
                  data-testid="button-generate-certificate"
                >
                  {generateCertificateMutation.isPending ? 'Generowanie...' : '🎉 Generuj certyfikat'}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-2xl p-4 text-center">
                  <div className={`text-2xl font-bold mb-1 ${certificateEligibility?.completedModules === certificateEligibility?.totalModules ? "text-chart-2" : "text-foreground"}`}>
                    {certificateEligibility?.completedModules || 0}/{certificateEligibility?.totalModules || 0}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Moduły</div>
                </div>
                <div className="bg-muted/30 rounded-2xl p-4 text-center">
                  <div className={`text-2xl font-bold mb-1 ${certificateEligibility?.successRate >= 0.8 ? "text-chart-2" : "text-foreground"}`}>
                    {Math.round((certificateEligibility?.successRate || 0) * 100)}%
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Wymagane 80%</div>
                </div>
              </div>
            )}
          </div>
          
          {/* Weak Areas - Compact */}
          {weakAreas.length > 0 && (
            <div>
              <h2 className="text-section text-foreground mb-3">Do poprawy</h2>
              <div className="space-y-2">
                {weakAreas.slice(0, 3).map((area) => (
                  <div key={area.tag} className="bg-muted/50 border border-border/50 rounded-xl p-3 flex items-center gap-3">
                    <Target className="h-5 w-5 text-chart-4 flex-shrink-0" />
                    <span className="text-sm text-foreground flex-1 min-w-0 truncate">{area.tag}</span>
                    <span className={`text-sm font-semibold ${
                      area.successRate < 0.5 ? 'text-destructive' : 
                      area.successRate < 0.7 ? 'text-chart-4' : 'text-chart-2'
                    }`}>
                      {Math.round(area.successRate * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
              <HelpCircle className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="text-xl font-bold text-foreground">{stats.totalAttempts}</div>
              <div className="text-xs text-muted-foreground">Pytań</div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
              <Clock className="h-5 w-5 text-chart-4 mx-auto mb-2" />
              <div className="text-xl font-bold text-foreground">{Math.round(stats.avgTime / 1000)}s</div>
              <div className="text-xs text-muted-foreground">Śr. czas</div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
              <Target className="h-5 w-5 text-chart-2 mx-auto mb-2" />
              <div className="text-xl font-bold text-chart-2">{Math.round(stats.successRate * 100)}%</div>
              <div className="text-xs text-muted-foreground">Celność</div>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* ===== DESKTOP LAYOUT ===== */}
      <div className="hidden md:block">
        {/* Desktop Header */}
        <div className="bg-card border-b border-border">
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
        
        {/* Desktop Content */}
        <div className="max-w-6xl lg:max-w-[min(92vw,1680px)] mx-auto px-4 md:px-6 lg:px-8 xl:px-12 py-8">
          <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
            {/* Main content */}
            <div className="space-y-6">
              {/* Progress Overview */}
              <ProgressCard
                overallProgress={overallProgress}
                successRate={stats.successRate * 100}
                streak={stats.streak}
              />
              
              {/* Continue Learning */}
              <Card>
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
              
              {/* Module Progress */}
              <Card>
                <CardHeader className="pb-2 px-6 pt-4">
                  <CardTitle className="text-lg">{t("dashboard.moduleProgress")}</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-4">
                  <div className="space-y-3">
                    {sections?.map((section) => (
                      <Link 
                        key={section.id} 
                        href={`/quiz?sectionId=${section.id}`}
                        className="block"
                      >
                        <div className="flex items-center gap-3 p-3 border border-border rounded-lg hover:shadow-md hover:border-primary/50 active:scale-[0.98] transition-all cursor-pointer">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            section.completionPercentage >= 100 
                              ? 'bg-chart-2/15' 
                              : section.completionPercentage > 0 
                                ? 'bg-primary/15' 
                                : 'bg-muted'
                          }`}>
                            {section.completionPercentage >= 100 ? (
                              <CheckCircle className="h-5 w-5 text-chart-2" />
                            ) : (
                              <Play className={`h-5 w-5 ${
                                section.completionPercentage > 0 
                                  ? 'text-primary' 
                                  : 'text-muted-foreground'
                              }`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h4 className="text-sm font-medium text-foreground line-clamp-1">{section.title}</h4>
                              <span className="text-sm text-muted-foreground font-semibold flex-shrink-0">
                                {Math.round(section.completionPercentage)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  section.completionPercentage >= 100 ? 'bg-chart-2' : 'bg-primary'
                                }`}
                                style={{ width: `${section.completionPercentage}%` }}
                              />
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
            <div className="space-y-3">
              {/* Certificate Section */}
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Award className="h-4 w-4 text-chart-2" />
                    Certyfikat
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {myCertificates && myCertificates.length > 0 ? (
                    <div className="flex items-center gap-3 p-3 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-chart-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">EKG Academy</p>
                        <p className="text-xs text-muted-foreground">{new Date(myCertificates[0].issuedAt).toLocaleDateString('pl-PL')}</p>
                      </div>
                      <Link href={`/certificate/${myCertificates[0].certificateId}`}>
                        <Button size="sm" className="h-9" data-testid="button-view-certificate-desktop">Zobacz</Button>
                      </Link>
                    </div>
                  ) : certificateEligibility?.isEligible ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-chart-2" />
                        <p className="text-sm text-chart-2 font-medium">Możesz otrzymać certyfikat!</p>
                      </div>
                      <Button 
                        className="w-full h-10" 
                        onClick={() => generateCertificateMutation.mutate()}
                        disabled={generateCertificateMutation.isPending}
                        data-testid="button-generate-certificate-desktop"
                      >
                        {generateCertificateMutation.isPending ? 'Generowanie...' : 'Generuj certyfikat'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Ukończ wymagania</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                          <div className={`text-lg font-bold ${certificateEligibility?.completedModules === certificateEligibility?.totalModules ? "text-chart-2" : "text-foreground"}`}>
                            {certificateEligibility?.completedModules || 0}/{certificateEligibility?.totalModules || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Moduły</div>
                        </div>
                        <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                          <div className={`text-lg font-bold ${certificateEligibility?.successRate >= 0.8 ? "text-chart-2" : "text-foreground"}`}>
                            {Math.round((certificateEligibility?.successRate || 0) * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Min. 80%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weak areas */}
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-chart-4" />
                    {t("dashboard.weakAreas")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {weakAreas.slice(0, 3).map((area) => (
                      <div key={area.tag} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                        <span className="text-sm text-foreground flex-1 min-w-0">{area.tag}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                area.successRate < 0.5 ? 'bg-destructive' : 
                                area.successRate < 0.7 ? 'bg-chart-4' : 'bg-chart-2'
                              }`}
                              style={{ width: `${area.successRate * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-10 text-right font-medium">
                            {Math.round(area.successRate * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {weakAreas.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">Brak słabych obszarów</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick stats */}
              <Card>
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    Statystyki
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Rozwiązane pytania</span>
                      <span className="text-base font-bold text-foreground">{stats.totalAttempts}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Średni czas</span>
                      <span className="text-base font-bold text-foreground">{Math.round(stats.avgTime / 1000)}s</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Obecna seria</span>
                      <span className="text-base font-bold text-chart-3">{stats.streak}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
