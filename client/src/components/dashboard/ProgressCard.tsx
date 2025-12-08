import { Card, CardContent } from "@/components/ui/card";
import { Target, Flame } from "lucide-react";

interface ProgressCardProps {
  overallProgress: number;
  successRate: number;
  streak: number;
}

export default function ProgressCard({ overallProgress, successRate, streak }: ProgressCardProps) {
  return (
    <>
      {/* Mobile Hero Card - full-width with gradient */}
      <div className="md:hidden">
        <Card className="bg-gradient-to-br from-primary/10 via-background to-chart-2/5 border-primary/20 overflow-hidden">
          <CardContent className="p-4">
            {/* Mobile: Centered large ring */}
            <div className="flex flex-col items-center mb-4">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="42" 
                    stroke="currentColor"
                    strokeWidth="6" 
                    fill="none"
                    className="text-muted/30"
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="42" 
                    stroke="currentColor"
                    strokeWidth="6" 
                    fill="none"
                    strokeLinecap="round"
                    className="text-primary transition-all duration-700"
                    style={{ 
                      strokeDasharray: 264,
                      strokeDashoffset: 264 - (264 * overallProgress / 100)
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-primary" data-testid="overall-progress-mobile">
                    {Math.round(overallProgress)}%
                  </span>
                  <span className="text-xs text-muted-foreground">ukończono</span>
                </div>
              </div>
            </div>
            
            {/* Mobile: Horizontal stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card/80 backdrop-blur border border-chart-2/20 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Target className="h-4 w-4 text-chart-2" />
                  <span className="text-xs text-muted-foreground">Celność</span>
                </div>
                <span className="text-xl font-bold text-chart-2" data-testid="success-rate-mobile">
                  {Math.round(successRate)}%
                </span>
              </div>
              
              <div className="bg-card/80 backdrop-blur border border-chart-3/20 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Flame className="h-4 w-4 text-chart-3" />
                  <span className="text-xs text-muted-foreground">Seria</span>
                </div>
                <span className="text-xl font-bold text-chart-3" data-testid="streak-count-mobile">
                  {streak} dni
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop Card - horizontal layout with better alignment */}
      <div className="hidden md:block">
        <Card>
          <div className="px-6 lg:px-8 pt-5 lg:pt-6">
            <h3 className="text-lg lg:text-xl font-semibold text-foreground">Ogólny postęp</h3>
          </div>
          <CardContent className="p-6 lg:p-8 pt-4">
            <div className="flex items-center gap-8 lg:gap-12">
              {/* Progress Ring - fixed width for alignment */}
              <div className="flex-shrink-0">
                <div className="relative w-32 h-32 lg:w-36 lg:h-36">
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
                    <span className="text-3xl lg:text-4xl font-bold text-primary" data-testid="overall-progress">
                      {Math.round(overallProgress)}%
                    </span>
                    <span className="text-sm text-muted-foreground">ukończono</span>
                  </div>
                </div>
              </div>
              
              {/* Stats - two equal cards */}
              <div className="flex-1 grid grid-cols-2 gap-4 lg:gap-6">
                {/* Celność */}
                <div className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border border-chart-2/20 rounded-2xl p-5 lg:p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-chart-2/20 flex items-center justify-center">
                      <Target className="h-5 w-5 text-chart-2" />
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">Celność</span>
                  </div>
                  <span className="text-3xl lg:text-4xl font-bold text-chart-2" data-testid="success-rate">
                    {Math.round(successRate)}%
                  </span>
                </div>
                
                {/* Seria */}
                <div className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border border-chart-3/20 rounded-2xl p-5 lg:p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-chart-3/20 flex items-center justify-center">
                      <Flame className="h-5 w-5 text-chart-3" />
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">Seria</span>
                  </div>
                  <span className="text-3xl lg:text-4xl font-bold text-chart-3" data-testid="streak-count">
                    {streak} <span className="text-xl font-normal">dni</span>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
