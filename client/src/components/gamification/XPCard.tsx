import { Star, TrendingUp, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface XPCardProps {
  xp: number;
  level: number;
  levelName: string;
  currentLevelXp: number;
  nextLevelXp: number;
  xpProgress: number;
  xpNeeded: number;
  progressPercentage: number;
}

export function XPCard({
  xp,
  level,
  levelName,
  currentLevelXp,
  nextLevelXp,
  xpProgress,
  xpNeeded,
  progressPercentage
}: XPCardProps) {
  // Kolor poziomu na podstawie rangi
  const getLevelColor = () => {
    if (level <= 5) return "text-gray-600 dark:text-gray-400";
    if (level <= 10) return "text-blue-600 dark:text-blue-400";
    if (level <= 20) return "text-purple-600 dark:text-purple-400";
    if (level <= 30) return "text-orange-600 dark:text-orange-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  const getLevelBadgeColor = () => {
    if (level <= 5) return "bg-gray-500/20 text-gray-700 dark:text-gray-300";
    if (level <= 10) return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
    if (level <= 20) return "bg-purple-500/20 text-purple-700 dark:text-purple-300";
    if (level <= 30) return "bg-orange-500/20 text-orange-700 dark:text-orange-300";
    return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300";
  };

  return (
    <Card data-testid="xp-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Poziom i XP
          </CardTitle>
          <Badge variant="secondary" className={getLevelBadgeColor()} data-testid="level-badge">
            Poziom {level}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nazwa poziomu */}
        <div className="text-center py-2">
          <div className="flex items-center justify-center gap-2">
            <Award className={`h-6 w-6 ${getLevelColor()}`} />
            <h3 className={`text-2xl font-bold ${getLevelColor()}`} data-testid="level-name">
              {levelName}
            </h3>
          </div>
        </div>

        {/* Pasek postępu */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Postęp do poziomu {level + 1}</span>
            <span className="font-medium text-foreground" data-testid="progress-percentage">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" data-testid="xp-progress-bar" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="xp-progress">{xpProgress} XP</span>
            <span data-testid="xp-needed">{xpNeeded} XP do celu</span>
          </div>
        </div>

        {/* Statystyki XP */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-xs text-muted-foreground">Łącznie XP</p>
            </div>
            <p className="text-xl font-bold text-foreground" data-testid="total-xp">
              {xp.toLocaleString()}
            </p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Award className="h-4 w-4 text-purple-600" />
              <p className="text-xs text-muted-foreground">Następny poziom</p>
            </div>
            <p className="text-xl font-bold text-foreground" data-testid="next-level-xp">
              {nextLevelXp.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Wskazówka */}
        <div className="bg-primary/5 rounded-lg p-3 mt-3">
          <p className="text-xs text-center text-muted-foreground">
            💡 Zdobywaj XP odpowiadając na pytania. Szybsze odpowiedzi = więcej XP!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
