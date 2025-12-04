import { Card, CardContent } from "@/components/ui/card";
import { Target, Flame, TrendingUp } from "lucide-react";

interface ProgressCardProps {
  overallProgress: number;
  successRate: number;
  streak: number;
}

export default function ProgressCard({ overallProgress, successRate, streak }: ProgressCardProps) {
  const ringSize = 56;
  const strokeWidth = 5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * overallProgress / 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="px-3 py-3 sm:px-6 sm:py-5">
        {/* Mobile: ultra-compact horizontal layout */}
        <div className="flex items-center gap-3 sm:hidden">
          {/* Progress ring - 56px */}
          <div className="relative flex-shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="progress-ring -rotate-90" data-testid="progress-ring-mobile">
              <circle 
                cx={ringSize/2} 
                cy={ringSize/2} 
                r={radius} 
                stroke="var(--border)" 
                strokeWidth={strokeWidth} 
                fill="none"
              />
              <circle 
                cx={ringSize/2} 
                cy={ringSize/2} 
                r={radius} 
                stroke="var(--primary)" 
                strokeWidth={strokeWidth} 
                fill="none"
                strokeLinecap="round"
                className="progress-ring-circle"
                style={{ 
                  strokeDasharray: circumference,
                  strokeDashoffset: offset
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-primary" data-testid="overall-progress-mobile">
                {Math.round(overallProgress)}%
              </span>
            </div>
          </div>
          
          {/* Stats grid - 2 columns */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center bg-muted/30 rounded-lg py-2 px-1">
              <div className="flex items-center gap-1 mb-0.5">
                <Target className="h-3 w-3 text-chart-2" />
                <span className="text-[10px] text-muted-foreground tracking-tight">Celność</span>
              </div>
              <span className="text-base font-bold text-chart-2" data-testid="success-rate-mobile">
                {Math.round(successRate)}%
              </span>
            </div>
            <div className="flex flex-col items-center bg-muted/30 rounded-lg py-2 px-1">
              <div className="flex items-center gap-1 mb-0.5">
                <Flame className="h-3 w-3 text-chart-3" />
                <span className="text-[10px] text-muted-foreground tracking-tight">Seria</span>
              </div>
              <span className="text-base font-bold text-chart-3" data-testid="streak-count-mobile">
                {streak}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop: 3 column grid */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-4 lg:gap-6">
          {/* Overall progress */}
          <div className="text-center">
            <div className="relative w-20 h-20 lg:w-24 lg:h-24 mx-auto mb-3">
              <svg className="w-full h-full progress-ring -rotate-90" data-testid="progress-ring">
                <circle 
                  cx="50%" 
                  cy="50%" 
                  r="38%" 
                  stroke="var(--border)" 
                  strokeWidth="8" 
                  fill="none"
                />
                <circle 
                  cx="50%" 
                  cy="50%" 
                  r="38%" 
                  stroke="var(--primary)" 
                  strokeWidth="8" 
                  fill="none"
                  strokeLinecap="round"
                  className="progress-ring-circle"
                  style={{ 
                    strokeDasharray: "239",
                    strokeDashoffset: 239 - (239 * overallProgress / 100)
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl lg:text-2xl font-bold text-primary" data-testid="overall-progress">
                  {Math.round(overallProgress)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs lg:text-sm">Postęp</span>
            </div>
          </div>

          {/* Accuracy */}
          <div className="text-center flex flex-col justify-center">
            <div className="text-2xl lg:text-3xl font-bold text-chart-2 mb-1" data-testid="success-rate">
              {Math.round(successRate)}%
            </div>
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              <span className="text-xs lg:text-sm">Skuteczność</span>
            </div>
          </div>

          {/* Streak */}
          <div className="text-center flex flex-col justify-center">
            <div className="text-2xl lg:text-3xl font-bold text-chart-3 mb-1" data-testid="streak-count">
              {streak}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Flame className="h-3.5 w-3.5" />
              <span className="text-xs lg:text-sm">Dni z rzędu</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
