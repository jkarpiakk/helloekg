import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { Target, Flame } from "lucide-react";

interface ProgressCardProps {
  overallProgress: number;
  successRate: number;
  streak: number;
}

export default function ProgressCard({ overallProgress, successRate, streak }: ProgressCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="text-base sm:text-lg">{t("dashboard.overallProgress")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile: horizontal compact layout */}
        <div className="flex items-center gap-4 sm:hidden">
          {/* Progress ring - smaller on mobile */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 progress-ring" data-testid="progress-ring">
              <circle 
                cx="40" 
                cy="40" 
                r="32" 
                stroke="var(--border)" 
                strokeWidth="6" 
                fill="none"
              />
              <circle 
                cx="40" 
                cy="40" 
                r="32" 
                stroke="var(--primary)" 
                strokeWidth="6" 
                fill="none"
                className="progress-ring-circle"
                style={{ 
                  strokeDashoffset: 201 - (201 * overallProgress / 100)
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-primary" data-testid="overall-progress-mobile">
                {Math.round(overallProgress)}%
              </span>
            </div>
          </div>
          
          {/* Stats in column */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-chart-2" />
                <span className="text-sm text-muted-foreground">Skuteczność</span>
              </div>
              <span className="text-lg font-bold text-chart-2" data-testid="success-rate-mobile">
                {Math.round(successRate)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-chart-3" />
                <span className="text-sm text-muted-foreground">Dni z rzędu</span>
              </div>
              <span className="text-lg font-bold text-chart-3" data-testid="streak-count-mobile">
                {streak}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop: 3 column grid */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-6">
          {/* Overall progress */}
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <svg className="w-24 h-24 progress-ring" data-testid="progress-ring">
                <circle 
                  cx="48" 
                  cy="48" 
                  r="40" 
                  stroke="var(--border)" 
                  strokeWidth="8" 
                  fill="none"
                />
                <circle 
                  cx="48" 
                  cy="48" 
                  r="40" 
                  stroke="var(--primary)" 
                  strokeWidth="8" 
                  fill="none"
                  className="progress-ring-circle"
                  style={{ 
                    strokeDashoffset: 628 - (628 * overallProgress / 100)
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary" data-testid="overall-progress">
                  {Math.round(overallProgress)}%
                </span>
              </div>
            </div>
            <p className="text-muted-foreground">{t("dashboard.overallProgress")}</p>
          </div>

          {/* Accuracy */}
          <div className="text-center">
            <div className="text-3xl font-bold text-chart-2 mb-2" data-testid="success-rate">
              {Math.round(successRate)}%
            </div>
            <p className="text-muted-foreground">{t("dashboard.accuracy")}</p>
          </div>

          {/* Streak */}
          <div className="text-center">
            <div className="text-3xl font-bold text-chart-3 mb-2" data-testid="streak-count">
              {streak}
            </div>
            <p className="text-muted-foreground">{t("dashboard.streak")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
