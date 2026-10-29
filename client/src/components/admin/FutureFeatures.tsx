import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { StreakDisplay } from "@/components/gamification/StreakDisplay";
import { XPCard } from "@/components/gamification/XPCard";
import { ActivityHeatmap } from "@/components/gamification/ActivityHeatmap";
import { AchievementGallery } from "@/components/gamification/AchievementGallery";
import { Activity, Trophy, Sparkles, Heart } from "lucide-react";
import { Link } from "wouter";

export default function FutureFeatures() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Fetch users for testing
  const { data: users } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/users");
      return response.json();
    },
  });

  // Fetch gamification stats for selected user
  const { data: gamificationStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/gamification/stats", selectedUserId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/gamification/stats");
      return response.json();
    },
    enabled: !!selectedUserId,
  });

  // Fetch activity heatmap
  const { data: activityHeatmap } = useQuery({
    queryKey: ["/api/gamification/activity-heatmap", selectedUserId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/gamification/activity-heatmap");
      return response.json();
    },
    enabled: !!selectedUserId,
  });

  // Fetch achievements
  const { data: achievements } = useQuery({
    queryKey: ["/api/gamification/achievements", selectedUserId],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/gamification/achievements");
      return response.json();
    },
    enabled: !!selectedUserId,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Funkcje przyszłościowe
          </CardTitle>
          <CardDescription>
            Moduły planowane do wdrożenia w przyszłości. Te funkcje są wyłączone dla użytkowników,
            ale dostępne tutaj do testów i rozwoju.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="gamification" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gamification" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            System gamifikacji
          </TabsTrigger>
          <TabsTrigger value="simulator" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Symulator EKG Live
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gamification" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>System gamifikacji (Duolingo-style)</span>
                <Badge variant="secondary">W przygotowaniu</Badge>
              </CardTitle>
              <CardDescription>
                Kompletny system motywacyjny z punktami XP, poziomami, seriami dni, osiągnięciami i heatmapą aktywności.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">Funkcje zaimplementowane:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>✅ System punktów XP (10 XP za poprawną odpowiedź, 5 XP za błędną)</li>
                  <li>✅ Poziomy: Student → Intern → Resident → Specialist</li>
                  <li>✅ Streak system z freeze protection</li>
                  <li>✅ Osiągnięcia (12 domyślnych: streak, accuracy, volume)</li>
                  <li>✅ Heatmapa aktywności (styl GitHub)</li>
                  <li>✅ Animacje confetti przy odblokowaniu osiągnięć</li>
                  <li>⏳ Email notifications (dzienny digest, alerty)</li>
                </ul>
              </div>

              {/* Preview gamification components */}
              {gamificationStats && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Podgląd komponentów:</h4>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <StreakDisplay
                      currentStreak={gamificationStats.currentStreak}
                      longestStreak={gamificationStats.longestStreak}
                      streakFreezes={gamificationStats.streakFreezes}
                    />
                    <XPCard
                      xp={gamificationStats.xp}
                      level={gamificationStats.level}
                      levelName={gamificationStats.levelName}
                      currentLevelXp={gamificationStats.levelInfo.currentLevelXp}
                      nextLevelXp={gamificationStats.levelInfo.nextLevelXp}
                      xpProgress={gamificationStats.levelInfo.xpProgress}
                      xpNeeded={gamificationStats.levelInfo.xpNeeded}
                      progressPercentage={gamificationStats.levelInfo.progressPercentage}
                    />
                  </div>

                  {activityHeatmap && (
                    <ActivityHeatmap activities={activityHeatmap} />
                  )}

                  {achievements && (
                    <AchievementGallery
                      unlocked={achievements.unlocked}
                      locked={achievements.locked}
                    />
                  )}
                </div>
              )}

              {!gamificationStats && !statsLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Zaloguj się jako student, aby zobaczyć podgląd gamifikacji</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Live EKG Simulator</span>
                <Badge variant="secondary">W przygotowaniu</Badge>
              </CardTitle>
              <CardDescription>
                Interaktywny symulator rytmu serca w czasie rzeczywistym z wizualizacją 3D i różnymi arytmiami.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">Funkcje zaimplementowane:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>✅ Symulacja rytmu zatokowego (normalny)</li>
                  <li>✅ Tachykardia zatokowa</li>
                  <li>✅ Bradykardia zatokowa</li>
                  <li>✅ Migotanie przedsionków (AFib)</li>
                  <li>✅ Częstoskurcz komorowy (VTach)</li>
                  <li>✅ Wizualizacja 3D serca (Three.js)</li>
                  <li>✅ Animacje w czasie rzeczywistym</li>
                  <li>✅ Panel kontrolny z opisami arytmii</li>
                </ul>
              </div>

              <div className="border border-border rounded-lg p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Activity className="h-6 w-6 text-purple-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">🎮 Symulator EKG Live</h3>
                    <p className="text-sm text-muted-foreground">
                      Interaktywny symulator rytmu serca w czasie rzeczywistym
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm mb-4">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span>Animacja 3D</span>
                  <span>•</span>
                  <span>5 rytmów</span>
                  <span>•</span>
                  <span>Real-time rendering</span>
                </div>

                <Link href="/simulator">
                  <Button className="w-full bg-purple-500 hover:bg-purple-600">
                    <Activity className="h-4 w-4 mr-2" />
                    Otwórz symulator
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
