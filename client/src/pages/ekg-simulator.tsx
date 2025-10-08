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
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Html } from "@react-three/drei";
import * as THREE from "three";

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

// 3D Anatomical Heart Component with smooth beat animation
function AnatomicalHeart({ 
  isBeating, 
  rhythm, 
  bpm,
  timeRef,
  lastBeatRef,
  beatIntervalRef,
  isPlaying
}: { 
  isBeating: boolean; 
  rhythm: string; 
  bpm: number;
  timeRef: React.MutableRefObject<number>;
  lastBeatRef: React.MutableRefObject<number>;
  beatIntervalRef: React.MutableRefObject<number | undefined>;
  isPlaying: boolean;
}) {
  const leftVentricleRef = useRef<THREE.Mesh>(null);
  const rightVentricleRef = useRef<THREE.Mesh>(null);
  const leftAtriumRef = useRef<THREE.Mesh>(null);
  const rightAtriumRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Store AFib variation per beat to avoid per-frame jitter
  const afibVariationRef = useRef(1.0);
  const lastBeatTimeRecordedRef = useRef(0);
  
  useFrame((state) => {
    if (!isPlaying) return; // Pause animation when playback is stopped
    
    const t = state.clock.getElapsedTime();
    
    // Use the actual beat interval from EKG generator (includes AFib randomness)
    const currentBeatInterval = beatIntervalRef.current || (60 / bpm) * 1000;
    
    // Calculate phase from actual EKG timing using live refs
    const timeSinceLastBeat = timeRef.current - lastBeatRef.current;
    const phase = Math.min(timeSinceLastBeat / currentBeatInterval, 1);
    
    // Update AFib variation only on new beat
    if (lastBeatRef.current !== lastBeatTimeRecordedRef.current) {
      lastBeatTimeRecordedRef.current = lastBeatRef.current;
      if (rhythm === 'afib') {
        afibVariationRef.current = 0.8 + Math.random() * 0.4; // 80-120% variation
      } else {
        afibVariationRef.current = 1.0;
      }
    }
    
    // Smooth systole/diastole curve using sine
    // Systole (contraction) happens in first 40% of cycle
    const systolePhase = Math.min(phase / 0.4, 1);
    const systoleScale = 0.85 + Math.sin(systolePhase * Math.PI) * 0.15 * afibVariationRef.current;
    
    // Diastole (relaxation) in remaining 60%
    const diastolePhase = phase > 0.4 ? (phase - 0.4) / 0.6 : 0;
    const ventricleScale = phase < 0.4 
      ? systoleScale 
      : 1.0 - Math.sin(diastolePhase * Math.PI) * 0.15 * afibVariationRef.current;
    
    // Atria contract before ventricles (P wave)
    const atriaPhase = (phase + 0.8) % 1; // Offset by 80% of cycle
    const atriaScale = atriaPhase < 0.3 
      ? 0.92 + Math.sin((atriaPhase / 0.3) * Math.PI) * 0.08 * afibVariationRef.current
      : 1.0;
    
    // Apply smooth scaling to ventricles
    if (leftVentricleRef.current) {
      leftVentricleRef.current.scale.set(
        ventricleScale,
        ventricleScale * 1.2, // Elongate vertically
        ventricleScale
      );
    }
    if (rightVentricleRef.current) {
      rightVentricleRef.current.scale.set(
        ventricleScale * 0.9,
        ventricleScale * 1.1,
        ventricleScale * 0.9
      );
    }
    
    // Apply smooth scaling to atria
    if (leftAtriumRef.current) {
      leftAtriumRef.current.scale.setScalar(atriaScale);
    }
    if (rightAtriumRef.current) {
      rightAtriumRef.current.scale.setScalar(atriaScale);
    }
    
    // Gentle rotation for better view
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Left Ventricle - largest chamber, elongated cone shape */}
      <mesh ref={leftVentricleRef} position={[-0.5, -0.3, 0]}>
        <coneGeometry args={[0.7, 1.6, 32, 1, false, 0, Math.PI * 2]} />
        <meshStandardMaterial 
          color="#c41e3a" 
          roughness={0.3} 
          metalness={0.2}
        />
      </mesh>

      {/* Right Ventricle - smaller, crescent shape */}
      <mesh ref={rightVentricleRef} position={[0.55, -0.2, 0.15]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.6, 1.4, 32, 1]} />
        <meshStandardMaterial 
          color="#d73447" 
          roughness={0.3} 
          metalness={0.2}
        />
      </mesh>

      {/* Left Atrium - rounded top */}
      <mesh ref={leftAtriumRef} position={[-0.5, 1.1, 0]}>
        <sphereGeometry args={[0.45, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.8]} />
        <meshStandardMaterial 
          color="#e74c3c" 
          roughness={0.25} 
          metalness={0.25}
        />
      </mesh>

      {/* Right Atrium */}
      <mesh ref={rightAtriumRef} position={[0.5, 1.15, 0.1]}>
        <sphereGeometry args={[0.45, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.8]} />
        <meshStandardMaterial 
          color="#ec7063" 
          roughness={0.25} 
          metalness={0.25}
        />
      </mesh>

      {/* Aorta - main artery */}
      <mesh position={[-0.4, 1.6, -0.1]} rotation={[0.2, 0, 0.4]}>
        <cylinderGeometry args={[0.22, 0.28, 1.0, 16]} />
        <meshStandardMaterial 
          color="#b71c1c" 
          roughness={0.4} 
          metalness={0.2}
        />
      </mesh>

      {/* Superior Vena Cava - blue vein */}
      <mesh position={[0.45, 1.7, 0.15]} rotation={[0.1, 0, -0.2]}>
        <cylinderGeometry args={[0.14, 0.18, 0.8, 16]} />
        <meshStandardMaterial 
          color="#3949ab" 
          roughness={0.4} 
          metalness={0.2}
        />
      </mesh>

      {/* Pulmonary Artery - purple */}
      <mesh position={[0.15, 1.45, 0.35]} rotation={[0.5, 0.3, -0.3]}>
        <cylinderGeometry args={[0.16, 0.20, 0.7, 16]} />
        <meshStandardMaterial 
          color="#5e35b1" 
          roughness={0.4} 
          metalness={0.2}
        />
      </mesh>

      {/* Interventricular septum - wall between ventricles */}
      <mesh position={[0, 0, 0.05]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.15, 1.8, 0.8]} />
        <meshStandardMaterial 
          color="#8b0000" 
          roughness={0.5} 
          metalness={0.1}
        />
      </mesh>
      
      {/* Pulmonary veins */}
      <mesh position={[-0.8, 1.3, -0.2]} rotation={[0, 0.8, 0.3]}>
        <cylinderGeometry args={[0.10, 0.12, 0.5, 12]} />
        <meshStandardMaterial color="#3949ab" roughness={0.4} />
      </mesh>
      <mesh position={[-0.7, 1.2, 0.3]} rotation={[0, -0.6, 0.2]}>
        <cylinderGeometry args={[0.10, 0.12, 0.5, 12]} />
        <meshStandardMaterial color="#3949ab" roughness={0.4} />
      </mesh>
      
      {/* Interactive Labels */}
      <Html position={[-0.5, -0.8, 0]} center>
        <div className="bg-red-900/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
          Lewa komora
        </div>
      </Html>
      
      <Html position={[0.55, -0.7, 0.15]} center>
        <div className="bg-red-800/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
          Prawa komora
        </div>
      </Html>
      
      <Html position={[-0.5, 1.5, 0]} center>
        <div className="bg-red-700/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
          Lewy przedsionek
        </div>
      </Html>
      
      <Html position={[0.5, 1.55, 0.1]} center>
        <div className="bg-red-600/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
          Prawy przedsionek
        </div>
      </Html>
      
      <Html position={[-0.6, 2.2, -0.1]} center>
        <div className="bg-red-950/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
          Aorta
        </div>
      </Html>
      
      <Html position={[0.45, 2.2, 0.15]} center>
        <div className="bg-blue-800/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
          Żyła główna górna
        </div>
      </Html>
      
      <Html position={[0.15, 1.9, 0.5]} center>
        <div className="bg-purple-700/90 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
          Tętnica płucna
        </div>
      </Html>
    </group>
  );
}

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
  const pauseTimeOffsetRef = useRef(0);
  const lastPauseTimeRef = useRef(0);

  // Handle pause/resume timing
  useEffect(() => {
    if (!isPlaying) {
      lastPauseTimeRef.current = performance.now();
    } else if (lastPauseTimeRef.current > 0) {
      // Resume: add time that passed during pause to offset
      const pauseDuration = performance.now() - lastPauseTimeRef.current;
      pauseTimeOffsetRef.current += pauseDuration;
      lastPauseTimeRef.current = 0;
    }
  }, [isPlaying]);

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
      beatIntervalRef.current = beatInterval; // Store actual interval for 3D sync
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

            {/* 3D Anatomical Heart */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Anatomiczny Model Serca 3D</span>
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    Interaktywny
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] bg-gradient-to-b from-slate-950 to-slate-900 rounded-lg overflow-hidden border border-border">
                  <Canvas>
                    <PerspectiveCamera makeDefault position={[0, 0, 6]} />
                    <OrbitControls 
                      enableZoom={true} 
                      enablePan={true}
                      minDistance={3}
                      maxDistance={10}
                    />
                    
                    {/* Lighting */}
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <directionalLight position={[-10, -10, -5]} intensity={0.5} />
                    <pointLight position={[0, 5, 0]} intensity={0.8} color="#ffffff" />
                    <spotLight 
                      position={[5, 5, 5]} 
                      angle={0.3} 
                      penumbra={1} 
                      intensity={1}
                      castShadow 
                    />
                    
                    <AnatomicalHeart 
                      isBeating={heartBeat} 
                      rhythm={rhythm} 
                      bpm={bpm}
                      timeRef={timeRef}
                      lastBeatRef={lastBeatRef}
                      beatIntervalRef={beatIntervalRef}
                      isPlaying={isPlaying}
                    />
                  </Canvas>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      {rhythm === 'normal' && 'Prawidłowy rytm zatokowy - skoordynowany skurcz komór i przedsionków'}
                      {rhythm === 'afib' && 'Migotanie przedsionków - nieregularny rytm, przedsionki drżą'}
                      {rhythm === 'vtach' && 'Częstoskurcz komorowy - niebezpieczna arytmia'}
                      {rhythm === 'bradycardia' && 'Bradykardia - zwolniona akcja serca'}
                      {rhythm === 'svt' && 'Tachykardia nadkomorowa - przyspieszona akcja'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-600" />
                      <span>Lewy przedsionek</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <span>Prawy przedsionek</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-600" />
                      <span>Żyły</span>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    💡 Obracaj model myszą, przybliżaj kółkiem
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
