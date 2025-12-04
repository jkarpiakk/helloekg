import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Flame, TrendingUp } from "lucide-react";

interface ProgressCardProps {
  overallProgress: number;
  successRate: number;
  streak: number;
}

export default function ProgressCard({ overallProgress, successRate, streak }: ProgressCardProps) {
  return (
    <Card>
      <CardHeader className="px-4 py-3 md:px-6 md:py-4">
        <CardTitle className="text-base md:text-lg">Ogólny postęp</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
        <div className="flex items-center gap-4 md:gap-6">
          {/* Progress Ring */}
          <div className="relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle 
                cx="50" 
                cy="50" 
                r="42" 
                stroke="currentColor"
                strokeWidth="8" 
                fill="none"
                className="text-muted"
              />
              <circle 
                cx="50" 
                cy="50" 
                r="42" 
                stroke="currentColor"
                strokeWidth="8" 
                fill="none"
                strokeLinecap="round"
                className="text-primary"
                style={{ 
                  strokeDasharray: 264,
                  strokeDashoffset: 264 - (264 * overallProgress / 100)
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base md:text-lg font-bold text-primary" data-testid="overall-progress">
                {Math.round(overallProgress)}%
              </span>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex-1 grid grid-cols-2 gap-3 md:gap-4">
            <div className="bg-muted/40 rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-2" />
                <span className="text-xs md:text-sm text-muted-foreground">Celność</span>
              </div>
              <span className="text-lg md:text-xl font-bold text-chart-2" data-testid="success-rate">
                {Math.round(successRate)}%
              </span>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 md:p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Flame className="h-3.5 w-3.5 md:h-4 md:w-4 text-chart-3" />
                <span className="text-xs md:text-sm text-muted-foreground">Seria</span>
              </div>
              <span className="text-lg md:text-xl font-bold text-chart-3" data-testid="streak-count">
                {streak} dni
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
