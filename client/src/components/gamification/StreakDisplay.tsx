import { Flame, Snowflake, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  streakFreezes: number;
  onUseFreeze?: () => void;
}

export function StreakDisplay({ 
  currentStreak, 
  longestStreak, 
  streakFreezes,
  onUseFreeze 
}: StreakDisplayProps) {
  // Rozmiar ognia zależy od długości streaku
  const getFlameSize = () => {
    if (currentStreak === 0) return "h-16 w-16";
    if (currentStreak < 7) return "h-20 w-20";
    if (currentStreak < 30) return "h-24 w-24";
    if (currentStreak < 100) return "h-28 w-28";
    return "h-32 w-32";
  };

  // Kolor ognia zależy od długości streaku
  const getFlameColor = () => {
    if (currentStreak === 0) return "text-muted-foreground";
    if (currentStreak < 7) return "text-orange-500";
    if (currentStreak < 30) return "text-orange-600";
    if (currentStreak < 100) return "text-red-500";
    return "text-purple-600";
  };

  // Animacja pulsowania dla aktywnych serii
  const pulseClass = currentStreak > 0 ? "animate-pulse" : "";

  return (
    <Card className="overflow-hidden" data-testid="streak-display">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          {/* Wizualizacja ognia */}
          <div className="flex flex-col items-center space-y-2">
            <div className={`relative ${pulseClass}`}>
              <Flame 
                className={`${getFlameSize()} ${getFlameColor()} transition-all duration-300`}
                data-testid="streak-flame"
              />
              {currentStreak > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white drop-shadow-lg" data-testid="streak-number">
                    {currentStreak}
                  </span>
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground" data-testid="streak-label">
                {currentStreak === 0 ? "Zacznij serię!" : `${currentStreak} ${currentStreak === 1 ? "dzień" : "dni"}`}
              </p>
              {currentStreak > 0 && (
                <p className="text-xs text-muted-foreground">
                  Nie zguб serii!
                </p>
              )}
            </div>
          </div>

          {/* Statystyki */}
          <div className="flex flex-col space-y-3">
            {/* Rekord */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center space-x-2 bg-secondary/50 rounded-lg px-4 py-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">Rekord</p>
                      <p className="text-lg font-bold text-foreground" data-testid="longest-streak">
                        {longestStreak}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Twój najdłuższy streak</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Streak Freezes */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center space-x-2 bg-blue-500/10 rounded-lg px-4 py-2">
                    <Snowflake className="h-5 w-5 text-blue-500" />
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">Zamrożenia</p>
                      <p className="text-lg font-bold text-foreground" data-testid="freeze-count">
                        {streakFreezes}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Ochrona serii - użyj gdy opuścisz dzień</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Przycisk użycia freeze (tylko jeśli jest dostępny) */}
            {streakFreezes > 0 && onUseFreeze && (
              <Button
                variant="outline"
                size="sm"
                onClick={onUseFreeze}
                className="w-full"
                data-testid="button-use-freeze"
              >
                <Snowflake className="h-4 w-4 mr-2" />
                Użyj zamrożenia
              </Button>
            )}
          </div>
        </div>

        {/* Milestone Badges */}
        {currentStreak > 0 && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {currentStreak >= 7 && (
              <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-300">
                🔥 Tydzień
              </Badge>
            )}
            {currentStreak >= 30 && (
              <Badge variant="secondary" className="bg-red-500/20 text-red-700 dark:text-red-300">
                🏆 Miesiąc
              </Badge>
            )}
            {currentStreak >= 100 && (
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-700 dark:text-purple-300">
                ⭐ 100 dni
              </Badge>
            )}
            {currentStreak >= 365 && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                👑 Rok
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
