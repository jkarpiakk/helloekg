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
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          {/* Progress Ring */}
          <div className="flex justify-center md:justify-start">
            <div className="relative w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  stroke="currentColor"
                  strokeWidth="8" 
                  fill="none"
                  className="text-muted/30"
                />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  stroke="currentColor"
                  strokeWidth="8" 
                  fill="none"
                  strokeLinecap="round"
                  className="text-primary transition-all duration-700"
                  style={{ 
                    strokeDasharray: 251,
                    strokeDashoffset: 251 - (251 * overallProgress / 100)
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary" data-testid="overall-progress">
                  {Math.round(overallProgress)}%
                </span>
                <span className="text-sm text-muted-foreground">ukończono</span>
              </div>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="flex-1 grid grid-cols-2 gap-3 md:gap-4">
            {/* Celność */}
            <div className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border border-chart-2/20 rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                  <Target className="h-4 w-4 md:h-5 md:w-5 text-chart-2" />
                </div>
                <span className="text-base text-muted-foreground">Celność</span>
              </div>
              <span className="text-2xl md:text-3xl font-bold text-chart-2" data-testid="success-rate">
                {Math.round(successRate)}%
              </span>
            </div>
            
            {/* Seria */}
            <div className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border border-chart-3/20 rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-chart-3/20 flex items-center justify-center">
                  <Flame className="h-4 w-4 md:h-5 md:w-5 text-chart-3" />
                </div>
                <span className="text-base text-muted-foreground">Seria</span>
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
