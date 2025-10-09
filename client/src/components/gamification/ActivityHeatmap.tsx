import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DailyActivity {
  activityDate: string;
  questionsAnswered: number;
  xpEarned: number;
  timeSpentMinutes: number;
}

interface ActivityHeatmapProps {
  activities: DailyActivity[];
}

export function ActivityHeatmap({ activities }: ActivityHeatmapProps) {
  // Przygotuj dane dla ostatnich 365 dni
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364); // 365 dni wstecz

  // Utwórz mapę aktywności
  const activityMap = new Map<string, DailyActivity>();
  activities.forEach(activity => {
    const date = new Date(activity.activityDate).toISOString().split('T')[0];
    activityMap.set(date, activity);
  });

  // Generuj dane dla wszystkich dni
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    currentWeek.push(new Date(d));
  }
  
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // Funkcja do określenia intensywności koloru
  const getIntensityClass = (questions: number) => {
    if (questions === 0) return "bg-muted hover:bg-muted";
    if (questions < 5) return "bg-green-200 dark:bg-green-900/40 hover:bg-green-300 dark:hover:bg-green-900/60";
    if (questions < 10) return "bg-green-400 dark:bg-green-700/60 hover:bg-green-500 dark:hover:bg-green-700/80";
    if (questions < 20) return "bg-green-600 dark:bg-green-600/80 hover:bg-green-700 dark:hover:bg-green-600";
    return "bg-green-800 dark:bg-green-500 hover:bg-green-900 dark:hover:bg-green-400";
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getMonthLabels = () => {
    const months: { month: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    
    weeks.forEach((week, index) => {
      const firstDay = week[0];
      const month = firstDay.getMonth();
      
      if (month !== lastMonth) {
        months.push({
          month: firstDay.toLocaleDateString('pl-PL', { month: 'short' }),
          weekIndex: index
        });
        lastMonth = month;
      }
    });
    
    return months;
  };

  return (
    <Card data-testid="activity-heatmap">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Aktywność w ostatnim roku
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-4">
          {/* Month labels */}
          <div className="flex gap-1 mb-2 pl-6">
            {getMonthLabels().map((m, i) => (
              <div 
                key={i} 
                style={{ marginLeft: i === 0 ? 0 : `${(m.weekIndex - (i > 0 ? getMonthLabels()[i-1].weekIndex : 0) - 1) * 14}px` }}
                className="text-xs text-muted-foreground"
              >
                {m.month}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex gap-1">
            {/* Day labels */}
            <div className="flex flex-col gap-1 text-xs text-muted-foreground justify-around pr-2">
              <div>Pn</div>
              <div>Śr</div>
              <div>Pt</div>
            </div>

            {/* Activity squares */}
            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((date, dayIndex) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const activity = activityMap.get(dateStr);
                    const questions = activity?.questionsAnswered || 0;

                    return (
                      <TooltipProvider key={dayIndex}>
                        <Tooltip>
                          <TooltipTrigger>
                            <div
                              className={`w-3 h-3 rounded-sm transition-colors ${getIntensityClass(questions)}`}
                              data-testid={`activity-day-${dateStr}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              <p className="font-semibold">{formatDate(date)}</p>
                              {activity ? (
                                <>
                                  <p className="text-muted-foreground">{questions} pytań</p>
                                  <p className="text-muted-foreground">{activity.xpEarned} XP</p>
                                  <p className="text-muted-foreground">{activity.timeSpentMinutes} min</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">Brak aktywności</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <span>Mniej</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-muted" />
              <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/40" />
              <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700/60" />
              <div className="w-3 h-3 rounded-sm bg-green-600 dark:bg-green-600/80" />
              <div className="w-3 h-3 rounded-sm bg-green-800 dark:bg-green-500" />
            </div>
            <span>Więcej</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
