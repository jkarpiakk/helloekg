import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  xpReward: number;
}

interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: string;
  achievement: Achievement;
}

interface AchievementGalleryProps {
  unlocked: UserAchievement[];
  locked: Achievement[];
}

export function AchievementGallery({ unlocked, locked }: AchievementGalleryProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'streak':
        return 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/50';
      case 'accuracy':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/50';
      case 'volume':
        return 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50';
      case 'speed':
        return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50';
      default:
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/50';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'streak': return 'Seria';
      case 'accuracy': return 'Dokładność';
      case 'volume': return 'Aktywność';
      case 'speed': return 'Szybkość';
      default: return category;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Card data-testid="achievement-gallery">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-600" />
            Osiągnięcia
          </CardTitle>
          <Badge variant="secondary">
            {unlocked.length} / {unlocked.length + locked.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Zdobyte osiągnięcia */}
        {unlocked.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">Zdobyte</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {unlocked.map((ua) => (
                <TooltipProvider key={ua.id}>
                  <Tooltip>
                    <TooltipTrigger className="text-left">
                      <div 
                        className={`border-2 rounded-lg p-4 transition-all hover:scale-105 ${getCategoryColor(ua.achievement.category)}`}
                        data-testid={`achievement-unlocked-${ua.achievement.key}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-3xl">{ua.achievement.icon}</div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-semibold text-sm truncate">
                              {ua.achievement.name}
                            </h5>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {ua.achievement.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {getCategoryLabel(ua.achievement.category)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                +{ua.achievement.xpReward} XP
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <p className="font-semibold">{ua.achievement.name}</p>
                        <p className="text-muted-foreground">{ua.achievement.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Zdobyte: {formatDate(ua.unlockedAt)}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        )}

        {/* Zablokowane osiągnięcia */}
        {locked.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Zablokowane</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {locked.map((achievement) => (
                <TooltipProvider key={achievement.id}>
                  <Tooltip>
                    <TooltipTrigger className="text-left">
                      <div 
                        className="border-2 border-muted rounded-lg p-4 bg-muted/20 opacity-60 hover:opacity-80 transition-opacity"
                        data-testid={`achievement-locked-${achievement.key}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-3xl grayscale">{achievement.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Lock className="h-3 w-3 text-muted-foreground" />
                              <h5 className="font-semibold text-sm text-muted-foreground truncate">
                                {achievement.name}
                              </h5>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {achievement.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {getCategoryLabel(achievement.category)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                +{achievement.xpReward} XP
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <p className="font-semibold">{achievement.name}</p>
                        <p className="text-muted-foreground">{achievement.description}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        )}

        {/* Pusta galeria */}
        {unlocked.length === 0 && locked.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Brak osiągnięć do wyświetlenia</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
