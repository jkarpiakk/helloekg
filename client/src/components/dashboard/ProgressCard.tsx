import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";

interface ProgressCardProps {
  overallProgress: number;
  successRate: number;
  streak: number;
}

export default function ProgressCard({ overallProgress, successRate, streak }: ProgressCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.overallProgress")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-6">
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
