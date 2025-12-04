import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Flame } from "lucide-react";

interface ProgressCardProps {
  overallProgress: number;
  successRate: number;
  streak: number;
}

export default function ProgressCard({ overallProgress, successRate, streak }: ProgressCardProps) {
  return (
    <Card>
      <CardHeader className="px-4 py-4 md:px-6 md:py-5">
        <CardTitle className="text-lg md:text-xl">Ogólny postęp</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
        {/* Mobile: vertical stack. sm+: horizontal */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center md:gap-6">
          {/* Progress Ring */}
          <div className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24">
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
              <span className="text-lg md:text-xl font-bold text-primary" data-testid="overall-progress">
                {Math.round(overallProgress)}%
              </span>
            </div>
          </div>
          
          {/* Stats - stack vertically on smallest screens, side by side on sm+ */}
          <div className="w-full sm:flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-muted/40 rounded-lg p-3 md:p-4 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-5 w-5 flex-shrink-0 text-chart-2" />
                <span className="text-base text-muted-foreground">Celność</span>
              </div>
              <span className="text-xl md:text-2xl font-bold text-chart-2" data-testid="success-rate">
                {Math.round(successRate)}%
              </span>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 md:p-4 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-5 w-5 flex-shrink-0 text-chart-3" />
                <span className="text-base text-muted-foreground">Seria</span>
              </div>
              <span className="text-xl md:text-2xl font-bold text-chart-3" data-testid="streak-count">
                {streak} dni
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
