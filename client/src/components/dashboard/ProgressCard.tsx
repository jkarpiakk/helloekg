import { Target, Flame, Zap, TrendingUp } from "lucide-react";

interface ProgressCardProps {
  overallProgress: number;
  successRate: number;
  streak: number;
}

export default function ProgressCard({ overallProgress, successRate, streak }: ProgressCardProps) {
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (circumference * overallProgress / 100);
  
  return (
    <>
      {/* Mobile Premium Hero - App Store quality */}
      <div className="md:hidden">
        <div className="relative overflow-hidden rounded-3xl app-gradient-hero shadow-app-lg">
          {/* Decorative gradient orbs */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-chart-2/20 rounded-full blur-2xl" />
          
          <div className="relative p-6">
            {/* Header with motivational text */}
            <div className="text-center mb-6">
              <p className="text-sm font-medium text-muted-foreground mb-1">Twój postęp</p>
              <h2 className="text-title text-foreground">
                {overallProgress >= 80 ? "Świetna robota! 🎉" : 
                 overallProgress >= 50 ? "Jesteś w połowie drogi!" :
                 overallProgress >= 20 ? "Dobry początek!" : "Zaczynamy przygodę!"}
              </h2>
            </div>
            
            {/* Large animated progress ring */}
            <div className="flex justify-center mb-6">
              <div className="relative w-44 h-44">
                {/* Outer glow ring */}
                <div className={`absolute inset-0 rounded-full ${overallProgress >= 80 ? 'shadow-glow-success animate-pulse-glow' : ''}`} />
                
                <svg viewBox="0 0 120 120" className="w-full h-full progress-ring-glow">
                  {/* Background track */}
                  <circle 
                    cx="60" 
                    cy="60" 
                    r="54" 
                    stroke="currentColor"
                    strokeWidth="8" 
                    fill="none"
                    className="text-muted/15"
                  />
                  {/* Gradient progress arc */}
                  <circle 
                    cx="60" 
                    cy="60" 
                    r="54" 
                    stroke="url(#premiumGradient)"
                    strokeWidth="8" 
                    fill="none"
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{ 
                      strokeDasharray: circumference,
                      strokeDashoffset: strokeDashoffset,
                      transform: 'rotate(-90deg)',
                      transformOrigin: '60px 60px'
                    }}
                  />
                  <defs>
                    <linearGradient id="premiumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="hsl(221 83% 53%)" />
                      <stop offset="50%" stopColor="hsl(200 80% 50%)" />
                      <stop offset="100%" stopColor="hsl(173 58% 39%)" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-display text-foreground" data-testid="overall-progress-mobile">
                    {Math.round(overallProgress)}%
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">ukończono</span>
                </div>
              </div>
            </div>
            
            {/* Stats grid - premium tiles */}
            <div className="grid grid-cols-3 gap-3">
              {/* Accuracy stat */}
              <div className="stat-card-teal rounded-2xl p-4 text-center touch-bounce" data-testid="stat-accuracy">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-chart-2/20 flex items-center justify-center">
                  <Target className="h-5 w-5 text-chart-2" />
                </div>
                <span className="block text-2xl font-bold text-chart-2" data-testid="success-rate-mobile">
                  {Math.round(successRate)}%
                </span>
                <span className="block text-xs text-muted-foreground font-medium mt-0.5">Celność</span>
              </div>
              
              {/* Streak stat */}
              <div className="stat-card-orange rounded-2xl p-4 text-center touch-bounce" data-testid="stat-streak">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-chart-3/20 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-chart-3" />
                </div>
                <span className="block text-2xl font-bold text-chart-3" data-testid="streak-count-mobile">
                  {streak}
                </span>
                <span className="block text-xs text-muted-foreground font-medium mt-0.5">Seria dni</span>
              </div>
              
              {/* Level/XP stat */}
              <div className="stat-card-purple rounded-2xl p-4 text-center touch-bounce" data-testid="stat-level">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-chart-4/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-chart-4" />
                </div>
                <span className="block text-2xl font-bold text-chart-4">
                  {Math.floor(overallProgress / 10) + 1}
                </span>
                <span className="block text-xs text-muted-foreground font-medium mt-0.5">Poziom</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Card - horizontal layout */}
      <div className="hidden md:block">
        <div className="bg-card border border-border rounded-2xl shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Ogólny postęp</h3>
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
          </div>
        </div>
      </div>
    </>
  );
}
