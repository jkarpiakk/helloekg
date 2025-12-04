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
      <CardHeader className="px-4 py-3 md:px-6 md:py-4">
        <CardTitle className="text-lg md:text-xl">Ogólny postęp</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
        {/* Compact horizontal layout: ring left, stats right */}
        <div className="flex items-center gap-4">
          {/* Progress Ring - left side */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle 
                cx="50" 
                cy="50" 
                r="42" 
                stroke="currentColor"
                strokeWidth="10" 
                fill="none"
                className="text-muted"
              />
              <circle 
                cx="50" 
                cy="50" 
                r="42" 
                stroke="currentColor"
                strokeWidth="10" 
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
              <span className="text-base font-bold text-primary" data-testid="overall-progress">
                {Math.round(overallProgress)}%
              </span>
            </div>
          </div>
          
          {/* Stats - right side, two compact pills */}
          <div className="flex-1 flex gap-3">
            <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Target className="h-4 w-4 text-chart-2" />
                <span className="text-sm text-muted-foreground">Celność</span>
              </div>
              <span className="text-lg font-bold text-chart-2" data-testid="success-rate">
                {Math.round(successRate)}%
              </span>
            </div>
            <div className="flex-1 bg-muted/40 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Flame className="h-4 w-4 text-chart-3" />
                <span className="text-sm text-muted-foreground">Seria</span>
              </div>
              <span className="text-lg font-bold text-chart-3" data-testid="streak-count">
                {streak} dni
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
