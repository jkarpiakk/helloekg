import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Flame } from "lucide-react";

interface ProgressCardProps {
  overallProgress: number;
  successRate: number;
  streak: number;
}

export default function ProgressCard({ overallProgress, successRate, streak }: ProgressCardProps) {
  return (
    <>
      {/* Mobile Hero Card - app-like full-width design */}
      <div className="md:hidden">
        <Card className="bg-gradient-to-br from-primary/15 via-background to-chart-2/10 border-primary/20 rounded-2xl overflow-hidden shadow-lg">
          <CardContent className="p-5">
            {/* Large centered progress ring */}
            <div className="flex flex-col items-center mb-5">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="42" 
                    stroke="currentColor"
                    strokeWidth="6" 
                    fill="none"
                    className="text-muted/20"
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="42" 
                    stroke="url(#progressGradient)"
                    strokeWidth="6" 
                    fill="none"
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{ 
                      strokeDasharray: 264,
                      strokeDashoffset: 264 - (264 * overallProgress / 100)
                    }}
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-foreground" data-testid="overall-progress-mobile">
                    {Math.round(overallProgress)}%
                  </span>
                  <span className="text-base text-muted-foreground">ukończono</span>
                </div>
              </div>
              <p className="text-base text-muted-foreground mt-2">Twój postęp w nauce EKG</p>
            </div>
            
            {/* Stats row - large touch targets */}
            <div className="grid grid-cols-2 gap-3">
              {/* Celność */}
              <div className="bg-card/80 backdrop-blur border border-chart-2/30 rounded-2xl p-4 min-h-[100px] flex flex-col justify-center active:scale-[0.98] transition-transform touch-manipulation">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-chart-2/20 flex items-center justify-center">
                    <Target className="h-6 w-6 text-chart-2" />
                  </div>
                  <span className="text-base text-muted-foreground font-medium">Celność</span>
                </div>
                <span className="text-3xl font-bold text-chart-2" data-testid="success-rate-mobile">
                  {Math.round(successRate)}%
                </span>
              </div>
              
              {/* Seria */}
              <div className="bg-card/80 backdrop-blur border border-chart-3/30 rounded-2xl p-4 min-h-[100px] flex flex-col justify-center active:scale-[0.98] transition-transform touch-manipulation">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-chart-3/20 flex items-center justify-center">
                    <Flame className="h-6 w-6 text-chart-3" />
                  </div>
                  <span className="text-base text-muted-foreground font-medium">Seria</span>
                </div>
                <span className="text-3xl font-bold text-chart-3" data-testid="streak-count-mobile">
                  {streak} <span className="text-lg font-normal text-muted-foreground">dni</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop Card - horizontal layout */}
      <div className="hidden md:block">
        <Card>
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-lg lg:text-xl">Ogólny postęp</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <div className="flex items-center gap-8 lg:gap-12">
              {/* Progress Ring */}
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
              
              {/* Stats */}
              <div className="flex-1 grid grid-cols-2 gap-4 lg:gap-6">
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
