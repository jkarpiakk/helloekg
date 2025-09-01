import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  BarChart3, Users, BookOpen, Trophy, TrendingUp, Calendar,
  Target, Clock, CheckCircle, AlertTriangle, Star
} from "lucide-react";

interface PlatformStats {
  totalUsers: number;
  totalQuestions: number;
  totalAttempts: number;
  avgSuccessRate: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
  questionsAddedThisMonth: number;
}

interface PerformanceMetrics {
  avgQuizCompletionTime: number;
  mostDifficultQuestions: Array<{
    id: string;
    questionText: string;
    successRate: number;
    attempts: number;
  }>;
  bestPerformingSections: Array<{
    id: string;
    title: string;
    avgSuccessRate: number;
    completionRate: number;
  }>;
  userEngagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    avgSessionTime: number;
  };
}

export default function AnalyticsManager() {
  const [timeRange, setTimeRange] = useState<string>("30d");
  const { t } = useTranslation();

  // Fetch platform statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/analytics/stats", timeRange],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/analytics/stats?range=${timeRange}`);
      return response.json() as Promise<PlatformStats>;
    },
  });

  // Fetch performance metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/admin/analytics/performance", timeRange],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/analytics/performance?range=${timeRange}`);
      return response.json() as Promise<PerformanceMetrics>;
    },
  });

  const isLoading = statsLoading || metricsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analityka platformy</h2>
          <p className="text-muted-foreground">
            Statystyki użytkowania, wydajność i metryki biznesowe
          </p>
        </div>
        <div className="w-48">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger data-testid="time-range-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Ostatnie 7 dni</SelectItem>
              <SelectItem value="30d">Ostatnie 30 dni</SelectItem>
              <SelectItem value="90d">Ostatnie 3 miesiące</SelectItem>
              <SelectItem value="365d">Ostatni rok</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                +{stats.newUsersThisMonth} w tym miesiącu
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pytania</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalQuestions}</div>
              <p className="text-xs text-muted-foreground">
                +{stats.questionsAddedThisMonth} w tym miesiącu
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próby</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAttempts}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round(stats.avgSuccessRate * 100)}% skuteczność
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Przychody</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.monthlyRevenue} PLN</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeSubscriptions} aktywnych subskrypcji
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Engagement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Zaangażowanie użytkowników</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Dzienni aktywni</p>
                  <p className="text-2xl font-bold">{metrics.userEngagement.dailyActiveUsers}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Tygodniowi aktywni</p>
                  <p className="text-2xl font-bold">{metrics.userEngagement.weeklyActiveUsers}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Miesięczni aktywni</p>
                  <p className="text-2xl font-bold">{metrics.userEngagement.monthlyActiveUsers}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Śr. czas sesji</p>
                  <p className="text-2xl font-bold">{Math.round(metrics.userEngagement.avgSessionTime)}min</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quiz Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Wydajność quizów</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Średni czas ukończenia</p>
                  <p className="text-2xl font-bold">{Math.round(metrics.avgQuizCompletionTime)}min</p>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Najlepsze sekcje</p>
                  <div className="space-y-2">
                    {metrics.bestPerformingSections.slice(0, 3).map((section, index) => (
                      <div key={section.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{section.title}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-green-600">{Math.round(section.avgSuccessRate * 100)}%</span>
                          <Star className="h-3 w-3 text-yellow-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Difficult Questions */}
      {metrics?.mostDifficultQuestions && metrics.mostDifficultQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Najtrudniejsze pytania</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.mostDifficultQuestions.map((question) => (
                <div key={question.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{question.questionText.substring(0, 100)}...</p>
                    <p className="text-xs text-muted-foreground">{question.attempts} prób</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${
                      question.successRate < 0.3 ? 'text-red-600' :
                      question.successRate < 0.5 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {Math.round(question.successRate * 100)}%
                    </div>
                    <p className="text-xs text-muted-foreground">skuteczność</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Performing Sections */}
      {metrics?.bestPerformingSections && metrics.bestPerformingSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5" />
              <span>Najlepsze sekcje</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.bestPerformingSections.map((section, index) => (
                <div key={section.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(section.completionRate * 100)}% ukończone
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">
                      {Math.round(section.avgSuccessRate * 100)}%
                    </div>
                    <p className="text-xs text-muted-foreground">skuteczność</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!stats && !metrics) && (
        <Card>
          <CardContent className="py-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Brak danych analitycznych</h3>
            <p className="text-muted-foreground">
              Dane analityczne będą dostępne po zebraniu wystarczającej ilości informacji o użytkownikach
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}