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
      <CardHeader className="pb-2 px-4 md:px-6 pt-4 md:pt-5">
        <CardTitle className="text-lg md:text-xl">Ogólny postęp</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
        {/* Responsive grid: stack on mobile, horizontal on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 md:gap-6 items-center">
          {/* Progress Ring */}
          <div className="flex justify-center md:justify-start">
            <div className="relative w-24 h-24 md:w-28 md:h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  stroke="currentColor"
                  strokeWidth="8" 
                  fill="none"
                  className="text-muted/50"
                />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  stroke="currentColor"
                  strokeWidth="8" 
                  fill="none"
                  strokeLinecap="round"
                  className="text-primary"
                  style={{ 
                    strokeDasharray: 251,
                    strokeDashoffset: 251 - (251 * overallProgress / 100)
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl md:text-3xl font-bold text-primary" data-testid="overall-progress">
                  {Math.round(overallProgress)}%
                </span>
                <span className="text-xs text-muted-foreground">ukończono</span>
              </div>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {/* Celność */}
            <div className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border border-chart-2/20 rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-chart-2/20 flex items-center justify-center">
                  <Target className="h-4 w-4 text-chart-2" />
                </div>
                <span className="text-sm text-muted-foreground">Celność</span>
              </div>
              <span className="text-2xl md:text-3xl font-bold text-chart-2" data-testid="success-rate">
                {Math.round(successRate)}%
              </span>
            </div>
            
            {/* Seria */}
            <div className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border border-chart-3/20 rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-chart-3/20 flex items-center justify-center">
                  <Flame className="h-4 w-4 text-chart-3" />
                </div>
                <span className="text-sm text-muted-foreground">Seria</span>
              </div>
              <span className="text-2xl md:text-3xl font-bold text-chart-3" data-testid="streak-count">
                {streak} <span className="text-lg font-normal">dni</span>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
