import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  Heart, Activity, Zap, Play, Pause, RotateCcw, 
  Volume2, VolumeX, ArrowLeft, Sparkles 
} from "lucide-react";
import { Link } from "wouter";

interface EKGPreset {
  name: string;
  bpm: number;
  rhythm: 'normal' | 'afib' | 'vtach' | 'bradycardia' | 'svt';
  description: string;
  color: string;
}

const PRESETS: EKGPreset[] = [
  { name: 'Rytm zatokowy', bpm: 75, rhythm: 'normal', description: 'Prawidłowy rytm serca', color: 'bg-green-500' },
  { name: 'Bradykardia', bpm: 45, rhythm: 'bradycardia', description: 'Zwolniona akcja serca', color: 'bg-blue-500' },
  { name: 'Tachykardia', bpm: 140, rhythm: 'svt', description: 'Przyspieszona akcja serca', color: 'bg-orange-500' },
  { name: 'Migotanie przedsionków', bpm: 110, rhythm: 'afib', description: 'Nieregularny rytm', color: 'bg-yellow-500' },
  { name: 'VTach', bpm: 180, rhythm: 'vtach', description: 'Częstoskurcz komorowy', color: 'bg-red-500' },
];

export default function EKGSimulator() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  const [bpm, setBpm] = useState(75);
  const [isPlaying, setIsPlaying] = useState(true);
  const [rhythm, setRhythm] = useState<'normal' | 'afib' | 'vtach' | 'bradycardia' | 'svt'>('normal');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [heartBeat, setHeartBeat] = useState(false);
  
  const beatIntervalRef = useRef<number>();
  const timeRef = useRef(0);
  const lastBeatRef = useRef(0);
  const heartBeatRef = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/?auth=login");
    }
  }, [isAuthenticated, setLocation]);

  // Generate EKG waveform points
  const generateEKGPoint = (t: number, rhythm: string): number => {
    // For AFib, add irregular beat timing
    const baseInterval = (60 / bpm) * 1000;
    const beatInterval = rhythm === 'afib' 
      ? baseInterval * (0.7 + Math.random() * 0.6) // Irregular timing 70-130% of base
      : baseInterval;
    
    const timeSinceBeat = t - lastBeatRef.current;
    
    if (timeSinceBeat > beatInterval) {
      lastBeatRef.current = t;
      heartBeatRef.current = true;
      setHeartBeat(true);
      setTimeout(() => {
        heartBeatRef.current = false;
        setHeartBeat(false);
      }, 100);
    }

    const phase = (timeSinceBeat / beatInterval) * 2 * Math.PI;
    
    if (rhythm === 'afib') {
      // Irregular rhythm - random variations
      return Math.sin(phase) * 0.3 + Math.random() * 0.2 + (phase > 3 && phase < 3.5 ? Math.sin(phase * 5) * 2 : 0);
    } else if (rhythm === 'vtach') {
      // Wide QRS complexes
      return Math.sin(phase * 3) * 1.5;
    } else if (rhythm === 'bradycardia' || rhythm === 'svt') {
      // Normal morphology, different rate
      return generateNormalEKG(phase);
    } else {
      // Normal sinus rhythm
      return generateNormalEKG(phase);
    }
  };

  const generateNormalEKG = (phase: number): number => {
    // P wave
    if (phase > 0.5 && phase < 1.0) return Math.sin((phase - 0.5) * Math.PI * 4) * 0.3;
    // QRS complex
    if (phase > 2.5 && phase < 3.2) {
      const qrsPhase = (phase - 2.5) / 0.7;
      return qrsPhase < 0.3 ? -qrsPhase * 2 : 
             qrsPhase < 0.6 ? (qrsPhase - 0.3) * 8 : 
             -(qrsPhase - 0.6) * 3;
    }
    // T wave
    if (phase > 3.8 && phase < 5.0) return Math.sin((phase - 3.8) * Math.PI * 1.5) * 0.5;
    return 0;
  };

  // Draw EKG on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const points: number[] = [];

    const draw = () => {
      if (!isPlaying) return;

      // Clear canvas
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = '#1a3a1a';
      ctx.lineWidth = 1;
      
      // Vertical lines
      for (let x = 0; x < width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Generate new point
      timeRef.current += 16; // ~60fps
      const newPoint = generateEKGPoint(timeRef.current, rhythm);
      points.push(newPoint);

      // Keep only visible points
      if (points.length > width) {
        points.shift();
      }

      // Draw EKG line - use ref to avoid stale closure
      ctx.strokeStyle = heartBeatRef.current ? '#ff0000' : '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();

      points.forEach((point, i) => {
        const x = width - points.length + i;
        const y = centerY - point * 50;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, bpm, rhythm]); // Removed heartBeat to prevent animation restart

  const applyPreset = (preset: EKGPreset) => {
    setBpm(preset.bpm);
    setRhythm(preset.rhythm);
  };

  const reset = () => {
    setBpm(75);
    setRhythm('normal');
    setIsPlaying(true);
    timeRef.current = 0;
    lastBeatRef.current = 0;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" data-testid="back-to-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Wróć
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <h1 className="text-2xl font-bold text-foreground">Symulator EKG Live</h1>
                </div>
                <p className="text-muted-foreground">Interaktywna wizualizacja rytmu serca w czasie rzeczywistym</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2/20">
              <Activity className="h-4 w-4 mr-2" />
              {bpm} BPM
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main EKG Display */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Monitor EKG</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      data-testid="toggle-sound"
                    >
                      {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPlaying(!isPlaying)}
                      data-testid="toggle-play"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={reset}
                      data-testid="reset-simulator"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={300}
                    className="w-full border border-border rounded-lg bg-black"
                  />
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full transition-all ${heartBeat ? 'bg-red-500 scale-125' : 'bg-red-500/30'}`} />
                    <span className="text-white font-mono text-sm">
                      {rhythm === 'normal' ? 'NSR' : 
                       rhythm === 'afib' ? 'AFib' :
                       rhythm === 'vtach' ? 'VT' :
                       rhythm === 'bradycardia' ? 'Brady' : 'SVT'}
                    </span>
                  </div>
                </div>

                {/* Heart Rate Control */}
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">Częstość akcji serca (BPM)</label>
                      <span className="text-sm font-mono text-muted-foreground">{bpm}</span>
                    </div>
                    <Slider
                      value={[bpm]}
                      onValueChange={([value]) => setBpm(value)}
                      min={30}
                      max={200}
                      step={1}
                      className="w-full"
                      data-testid="bpm-slider"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Animated Heart */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Wizualizacja</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className={`transition-transform duration-200 ${heartBeat ? 'scale-110' : 'scale-100'}`}>
                    <Heart className={`h-32 w-32 ${heartBeat ? 'text-red-500' : 'text-red-500/50'} transition-colors`} />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {rhythm === 'normal' && 'Prawidłowy rytm zatokowy'}
                    {rhythm === 'afib' && 'Migotanie przedsionków - nieregularny rytm'}
                    {rhythm === 'vtach' && 'Częstoskurcz komorowy - niebezpieczna arytmia'}
                    {rhythm === 'bradycardia' && 'Bradykardia - zwolniona akcja serca'}
                    {rhythm === 'svt' && 'Tachykardia nadkomorowa'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Scenariusze
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {PRESETS.map((preset) => (
                    <Button
                      key={preset.name}
                      variant={rhythm === preset.rhythm && bpm === preset.bpm ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => applyPreset(preset)}
                      data-testid={`preset-${preset.rhythm}`}
                    >
                      <div className={`w-3 h-3 rounded-full ${preset.color} mr-2`} />
                      <div className="text-left flex-1">
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-xs text-muted-foreground">{preset.bpm} BPM</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informacje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-foreground font-medium mb-1">Jak używać?</p>
                  <p className="text-xs text-muted-foreground">
                    Wybierz scenariusz lub dostosuj częstość ręcznie. Obserwuj jak zmienia się krzywa EKG i rytm bicia serca.
                  </p>
                </div>
                <div className="p-3 bg-chart-2/10 border border-chart-2/20 rounded-lg">
                  <p className="text-sm text-chart-2 font-medium mb-1">✨ Funkcje:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Animacja w czasie rzeczywistym</li>
                    <li>• 5 różnych rytmów serca</li>
                    <li>• Regulacja 30-200 BPM</li>
                    <li>• Wizualizacja patologii</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
