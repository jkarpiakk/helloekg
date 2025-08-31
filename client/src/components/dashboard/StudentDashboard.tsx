import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import ProgressCard from "./ProgressCard";
import { Play, RotateCcw, Crown, Target, Flame, Award } from "lucide-react";
import { Link } from "wouter";
import type { SectionWithProgress, UserProgress, WeakArea } from "@/types";

export default function StudentDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

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
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="welcome-message">
                {t("dashboard.welcome")}, {user?.firstName}!
              </h1>
              <p className="text-muted-foreground">{t("dashboard.continueWhere")}</p>
            </div>
            <div className="flex items-center space-x-4">
              {subscription && (
                <div className="bg-chart-2/10 text-chart-2 px-4 py-2 rounded-lg border border-chart-2/20">
                  <Crown className="h-4 w-4 mr-2 inline" />
                  Plan aktywny do {new Date(subscription.endDate).toLocaleDateString('pl-PL')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
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
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Continue where left off */}
                  <div className="p-6 border border-border rounded-xl hover:shadow-lg transition-all cursor-pointer group">
                    <Link href="/quiz" className="block">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Play className="h-6 w-6 text-primary" />
                        </div>
                        <span className="text-sm text-muted-foreground">Moduł 1</span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">Kontynuuj naukę</h3>
                      <p className="text-sm text-muted-foreground">{t("dashboard.lastActivity")} 2 {t("dashboard.hoursAgo")}</p>
                    </Link>
                  </div>

                  {/* Review mistakes */}
                  <div className="p-6 border border-border rounded-xl hover:shadow-lg transition-all cursor-pointer group">
                    <Link href="/quiz?mode=review" className="block">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-chart-3/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <RotateCcw className="h-6 w-6 text-chart-3" />
                        </div>
                        <span className="text-sm text-muted-foreground">5 pytań</span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2">{t("dashboard.review")}</h3>
                      <p className="text-sm text-muted-foreground">{t("dashboard.strengthenKnowledge")}</p>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Module Progress */}
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.moduleProgress")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sections?.map((section, index) => (
                    <div key={section.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          section.completionPercentage >= 100 
                            ? 'bg-chart-2/10' 
                            : section.completionPercentage > 0 
                              ? 'bg-primary/10' 
                              : 'bg-muted'
                        }`}>
                          <Play className={`h-6 w-6 ${
                            section.completionPercentage >= 100 
                              ? 'text-chart-2' 
                              : section.completionPercentage > 0 
                                ? 'text-primary' 
                                : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{section.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            15 {t("dashboard.questions")} • {Math.round(section.completionPercentage)}% {t("dashboard.completed")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${section.completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground font-mono w-12">
                          {Math.round(section.completionPercentage)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
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
