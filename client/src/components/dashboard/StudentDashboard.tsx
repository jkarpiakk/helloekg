import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ProgressCard from "./ProgressCard";
import { Play, RotateCcw, Crown, Award, Heart, CheckCircle, AlertCircle, Flame, ChevronRight, Target, Clock, HelpCircle, TrendingUp } from "lucide-react";
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
      
      {/* ===== DESKTOP PREMIUM LAYOUT ===== */}
      <div className="hidden md:block min-h-screen bg-background">
        {/* Premium Hero Header with Gradient */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 app-gradient-hero opacity-60" />
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-chart-2/10 rounded-full blur-3xl" />
          
          <div className="relative max-w-7xl mx-auto px-6 lg:px-8 xl:px-12 py-8 lg:py-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Witaj ponownie</p>
                <h1 className="text-3xl lg:text-4xl font-bold text-foreground" data-testid="welcome-message">
                  {user?.firstName}! 👋
                </h1>
                <p className="text-base text-muted-foreground mt-1">{t("dashboard.continueWhere")}</p>
              </div>
              <div className="flex items-center gap-4">
                {stats.streak > 0 && (
                  <div className="stat-card-orange rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Flame className="h-6 w-6 text-chart-3" />
                    <div>
                      <span className="text-2xl font-bold text-chart-3">{stats.streak}</span>
                      <span className="text-sm text-muted-foreground ml-1">dni</span>
                    </div>
                  </div>
                )}
                {subscription && (
                  <div className="stat-card-teal rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-chart-2" />
                    <span className="text-sm font-medium text-chart-2">
                      Do {new Date(subscription.endDate).toLocaleDateString('pl-PL')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Desktop Content */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 xl:px-12 py-8">
          <div className="grid lg:grid-cols-[1fr_380px] gap-8">
            {/* Main content */}
            <div className="space-y-8">
              {/* Progress Overview - Premium Hero Card */}
              <ProgressCard
                overallProgress={overallProgress}
                successRate={stats.successRate * 100}
                streak={stats.streak}
              />
              
              {/* Quick Actions - Premium Tiles */}
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Szybkie akcje</h2>
                <div className="grid grid-cols-3 gap-4">
                  <Link href="/lecture" className="block group">
                    <div className="h-full p-6 bg-card border border-border rounded-2xl shadow-app hover:shadow-app-lg hover:border-primary/30 transition-all duration-300 cursor-pointer relative overflow-hidden">
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-chart-2 text-chart-2-foreground border-0 text-xs px-2 py-0.5">NOWE</Badge>
                      </div>
                      <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-chart-2/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Heart className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">Interaktywny wykład</h3>
                      <p className="text-sm text-muted-foreground">Podstawy EKG z wizualizacjami</p>
                    </div>
                  </Link>
                  <Link href="/quiz" className="block group">
                    <div className="h-full p-6 bg-card border border-border rounded-2xl shadow-app hover:shadow-app-lg hover:border-primary/30 transition-all duration-300 cursor-pointer">
                      <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Play className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">Kontynuuj naukę</h3>
                      <p className="text-sm text-muted-foreground">Wróć do ostatniego modułu</p>
                    </div>
                  </Link>
                  <Link href="/quiz?mode=review" className="block group">
                    <div className="h-full p-6 bg-card border border-chart-3/20 rounded-2xl shadow-app hover:shadow-app-lg hover:border-chart-3/40 transition-all duration-300 cursor-pointer bg-gradient-to-br from-chart-3/5 to-transparent">
                      <div className="w-14 h-14 bg-chart-3/15 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <RotateCcw className="h-7 w-7 text-chart-3" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">{t("dashboard.review")}</h3>
                      <p className="text-sm text-muted-foreground">Powtórz trudne pytania</p>
                    </div>
                  </Link>
                </div>
              </div>
              
              {/* Module Progress - Premium Cards */}
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">{t("dashboard.moduleProgress")}</h2>
                <div className="bg-card border border-border rounded-2xl shadow-app overflow-hidden">
                  <div className="divide-y divide-border">
                    {sections?.map((section, index) => (
                      <Link 
                        key={section.id} 
                        href={`/quiz?sectionId=${section.id}`}
                        className="block"
                      >
                        <div className="flex items-center gap-4 p-5 hover:bg-muted/30 transition-colors cursor-pointer group">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            section.completionPercentage >= 100 
                              ? 'bg-chart-2/15' 
                              : section.completionPercentage > 0 
                                ? 'bg-primary/15' 
                                : 'bg-muted'
                          }`}>
                            {section.completionPercentage >= 100 ? (
                              <CheckCircle className="h-6 w-6 text-chart-2" />
                            ) : (
                              <span className="text-lg font-bold text-foreground">{index + 1}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4 mb-2">
                              <h4 className="text-base font-medium text-foreground line-clamp-1">{section.title}</h4>
                              <span className={`text-sm font-semibold flex-shrink-0 ${
                                section.completionPercentage >= 100 ? 'text-chart-2' : 'text-muted-foreground'
                              }`}>
                                {Math.round(section.completionPercentage)}%
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  section.completionPercentage >= 100 ? 'bg-chart-2' : 'bg-primary'
                                }`}
                                style={{ width: `${section.completionPercentage}%` }}
                              />
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Premium Cards */}
            <div className="space-y-6">
              {/* Certificate Section - Premium */}
              <div className="bg-card border border-border rounded-2xl shadow-app overflow-hidden">
                <div className="p-5 border-b border-border bg-gradient-to-r from-chart-2/5 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-chart-2/15 flex items-center justify-center">
                      <Award className="h-5 w-5 text-chart-2" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Certyfikat</h3>
                  </div>
                </div>
                <div className="p-5">
                  {myCertificates && myCertificates.length > 0 ? (
                    <div className="flex items-center gap-4 p-4 stat-card-teal rounded-xl">
                      <CheckCircle className="h-6 w-6 text-chart-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-foreground">EKG Academy</p>
                        <p className="text-sm text-muted-foreground">{new Date(myCertificates[0].issuedAt).toLocaleDateString('pl-PL')}</p>
                      </div>
                      <Link href={`/certificate/${myCertificates[0].certificateId}`}>
                        <Button size="sm" className="h-10" data-testid="button-view-certificate-desktop">Zobacz</Button>
                      </Link>
                    </div>
                  ) : certificateEligibility?.isEligible ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-4 stat-card-teal rounded-xl">
                        <CheckCircle className="h-5 w-5 text-chart-2" />
                        <p className="text-base text-chart-2 font-medium">Możesz otrzymać certyfikat!</p>
                      </div>
                      <Button 
                        className="w-full h-12 text-base shadow-glow-success" 
                        onClick={() => generateCertificateMutation.mutate()}
                        disabled={generateCertificateMutation.isPending}
                        data-testid="button-generate-certificate-desktop"
                      >
                        {generateCertificateMutation.isPending ? 'Generowanie...' : '🎉 Generuj certyfikat'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Ukończ wymagania aby zdobyć certyfikat</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 rounded-xl p-4 text-center">
                          <div className={`text-2xl font-bold mb-1 ${certificateEligibility?.completedModules === certificateEligibility?.totalModules ? "text-chart-2" : "text-foreground"}`}>
                            {certificateEligibility?.completedModules || 0}/{certificateEligibility?.totalModules || 0}
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">Moduły</div>
                        </div>
                        <div className="bg-muted/30 rounded-xl p-4 text-center">
                          <div className={`text-2xl font-bold mb-1 ${certificateEligibility?.successRate >= 0.8 ? "text-chart-2" : "text-foreground"}`}>
                            {Math.round((certificateEligibility?.successRate || 0) * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground font-medium">Min. 80%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Weak areas - Premium */}
              <div className="bg-card border border-border rounded-2xl shadow-app overflow-hidden">
                <div className="p-5 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-chart-4/15 flex items-center justify-center">
                      <Target className="h-5 w-5 text-chart-4" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{t("dashboard.weakAreas")}</h3>
                  </div>
                </div>
                <div className="p-5">
                  <div className="space-y-3">
                    {weakAreas.slice(0, 3).map((area) => (
                      <div key={area.tag} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                        <span className="text-sm text-foreground flex-1 min-w-0 truncate">{area.tag}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                area.successRate < 0.5 ? 'bg-destructive' : 
                                area.successRate < 0.7 ? 'bg-chart-4' : 'bg-chart-2'
                              }`}
                              style={{ width: `${area.successRate * 100}%` }}
                            />
                          </div>
                          <span className={`text-sm font-semibold w-12 text-right ${
                            area.successRate < 0.5 ? 'text-destructive' : 
                            area.successRate < 0.7 ? 'text-chart-4' : 'text-chart-2'
                          }`}>
                            {Math.round(area.successRate * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                    {weakAreas.length === 0 && (
                      <div className="text-center py-6">
                        <CheckCircle className="h-10 w-10 text-chart-2 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Świetnie! Brak słabych obszarów</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick stats - Premium Grid */}
              <div className="bg-card border border-border rounded-2xl shadow-app overflow-hidden">
                <div className="p-5 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Statystyki</h3>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/30 rounded-xl">
                      <HelpCircle className="h-5 w-5 text-primary mx-auto mb-2" />
                      <div className="text-2xl font-bold text-foreground">{stats.totalAttempts}</div>
                      <div className="text-xs text-muted-foreground font-medium">Pytań</div>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-xl">
                      <Clock className="h-5 w-5 text-chart-4 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-foreground">{Math.round(stats.avgTime / 1000)}s</div>
                      <div className="text-xs text-muted-foreground font-medium">Śr. czas</div>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-xl">
                      <Target className="h-5 w-5 text-chart-2 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-chart-2">{Math.round(stats.successRate * 100)}%</div>
                      <div className="text-xs text-muted-foreground font-medium">Celność</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
