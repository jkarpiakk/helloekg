import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw } from "lucide-react";

interface EKGPoint {
  x: number;
  y: number;
  label?: string;
}

export default function EKGSimulator() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPoint, setCurrentPoint] = useState(0);
  const [highlightedWave, setHighlightedWave] = useState<string | null>(null);

  // Simplified EKG wave data (P-QRS-T complex)
  const ekgWave: EKGPoint[] = [
    // Baseline
    { x: 0, y: 100 },
    { x: 50, y: 100 },
    
    // P Wave
    { x: 80, y: 90, label: "P" },
    { x: 100, y: 85 },
    { x: 120, y: 100 },
    
    // PR Interval
    { x: 150, y: 100 },
    { x: 180, y: 100 },
    
    // QRS Complex
    { x: 200, y: 105, label: "Q" },
    { x: 220, y: 140, label: "R" },
    { x: 240, y: 80, label: "S" },
    { x: 260, y: 100 },
    
    // ST Segment
    { x: 290, y: 100 },
    { x: 320, y: 100 },
    
    // T Wave
    { x: 350, y: 90, label: "T" },
    { x: 380, y: 85 },
    { x: 410, y: 100 },
    
    // End baseline
    { x: 450, y: 100 },
    { x: 500, y: 100 }
  ];

  const waveDescriptions = {
    P: "Załamek P - Depolaryzacja przedsionków. Przedsionki 'zapalają się' i przygotowują do skurczu.",
    Q: "Załamek Q - Początek depolaryzacji komór. Pierwsze negative deflection.",
    R: "Załamek R - Główny załamek depolaryzacji komór. Najwyższy punkt zespołu QRS.",
    S: "Załamek S - Koniec depolaryzacji komór. Powrót w dół po załamku R.",
    T: "Załamek T - Repolaryzacja komór. Serce wraca do stanu spoczynku."
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentPoint(prev => {
          if (prev >= ekgWave.length - 1) {
            return 0; // Loop back to start
          }
          return prev + 1;
        });
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    setCurrentPoint(0);
    setHighlightedWave(null);
  };

  const createPath = () => {
    if (currentPoint === 0) return "";
    
    const visiblePoints = ekgWave.slice(0, currentPoint + 1);
    return visiblePoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
  };

  const getCurrentLabel = () => {
    const point = ekgWave[currentPoint];
    return point?.label || null;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">Symulator EKG na żywo</h3>
            <p className="text-muted-foreground text-sm">
              Obserwuj jak powstaje zapis EKG w czasie rzeczywistym
            </p>
          </div>

          {/* EKG Grid and Wave */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-4 relative overflow-hidden">
            <svg 
              viewBox="0 0 520 200" 
              className="w-full h-48"
              style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 9px, rgba(0,255,0,0.1) 10px), repeating-linear-gradient(90deg, transparent, transparent 9px, rgba(0,255,0,0.1) 10px)' }}
            >
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,255,0,0.2)" strokeWidth="0.5"/>
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,255,0,0.3)" strokeWidth="0.8"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* EKG Wave */}
              <path
                d={createPath()}
                fill="none"
                stroke="#00ff00"
                strokeWidth="2"
                className="drop-shadow-[0_0_4px_rgba(0,255,0,0.6)]"
              />
              
              {/* Current point indicator */}
              {currentPoint > 0 && (
                <circle
                  cx={ekgWave[currentPoint].x}
                  cy={ekgWave[currentPoint].y}
                  r="4"
                  fill="#ff0040"
                  className="animate-pulse drop-shadow-[0_0_6px_rgba(255,0,64,0.8)]"
                />
              )}
              
              {/* Wave labels */}
              {ekgWave.slice(0, currentPoint + 1).map((point, index) => 
                point.label && (
                  <text
                    key={index}
                    x={point.x}
                    y={point.y - 15}
                    textAnchor="middle"
                    className="fill-yellow-400 text-sm font-bold drop-shadow-lg"
                    style={{ textShadow: '0 0 4px rgba(255,255,0,0.8)' }}
                  >
                    {point.label}
                  </text>
                )
              )}
            </svg>

            {/* Heartbeat animation overlay */}
            {isPlaying && (
              <div className="absolute top-2 right-2">
                <div className="w-6 h-6 bg-red-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>

          {/* Current wave explanation */}
          {getCurrentLabel() && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 className="font-semibold text-primary mb-2">
                Właśnie oglądasz: {getCurrentLabel()}
              </h4>
              <p className="text-sm text-muted-foreground">
                {waveDescriptions[getCurrentLabel() as keyof typeof waveDescriptions]}
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-4">
            <Button 
              onClick={togglePlayback}
              variant={isPlaying ? "destructive" : "default"}
              className="flex items-center gap-2"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Zatrzymaj" : "Odtwórz"}
            </Button>
            
            <Button 
              onClick={resetSimulation}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Wave legend */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {Object.entries(waveDescriptions).map(([wave, description]) => (
              <div
                key={wave}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  highlightedWave === wave
                    ? 'bg-primary/20 border-primary'
                    : 'bg-secondary/30 border-border hover:bg-secondary/50'
                }`}
                onClick={() => setHighlightedWave(highlightedWave === wave ? null : wave)}
              >
                <div className="font-semibold text-primary">{wave}</div>
                <div className="text-muted-foreground mt-1 leading-tight">
                  {description.split('.')[0]}...
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}