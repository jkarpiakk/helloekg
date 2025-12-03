import { useState, useCallback, useRef } from "react";
import { Check, X, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HotspotConfig, AnswerData, QuizResult } from "@/types";

interface HotspotQuestionProps {
  config: HotspotConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

export default function HotspotQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: HotspotQuestionProps) {
  const [clickedHotspots, setClickedHotspots] = useState<Set<string>>(new Set());
  const [clickCoordinates, setClickCoordinates] = useState<{ x: number; y: number }[]>([]);
  const imageRef = useRef<HTMLImageElement>(null);

  const isPointInHotspot = (x: number, y: number, hotspot: HotspotConfig['hotspots'][0]): boolean => {
    switch (hotspot.shape) {
      case 'rect': {
        const [x1, y1, x2, y2] = hotspot.coords;
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
      }
      case 'circle': {
        const [cx, cy, r] = hotspot.coords;
        const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        return distance <= r;
      }
      case 'polygon': {
        const points = [];
        for (let i = 0; i < hotspot.coords.length; i += 2) {
          points.push({ x: hotspot.coords[i], y: hotspot.coords[i + 1] });
        }
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const xi = points[i].x, yi = points[i].y;
          const xj = points[j].x, yj = points[j].y;
          if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
          }
        }
        return inside;
      }
      default:
        return false;
    }
  };

  const handleImageClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (disabled || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setClickCoordinates(prev => [...prev, { x, y }]);

    for (const hotspot of config.hotspots) {
      if (isPointInHotspot(x, y, hotspot)) {
        const newClickedHotspots = new Set(clickedHotspots);
        
        if (config.allowMultiple) {
          if (newClickedHotspots.has(hotspot.id)) {
            newClickedHotspots.delete(hotspot.id);
          } else {
            newClickedHotspots.add(hotspot.id);
          }
        } else {
          newClickedHotspots.clear();
          newClickedHotspots.add(hotspot.id);
        }
        
        setClickedHotspots(newClickedHotspots);

        const answerData: AnswerData = {
          type: 'hotspot',
          clickedHotspots: Array.from(newClickedHotspots),
          clickCoordinates: [...clickCoordinates, { x, y }],
        };
        onChange(answerData);
        return;
      }
    }
  }, [disabled, config, clickedHotspots, clickCoordinates, onChange]);

  const handleClear = () => {
    setClickedHotspots(new Set());
    setClickCoordinates([]);
    onChange({
      type: 'hotspot',
      clickedHotspots: [],
      clickCoordinates: [],
    });
  };

  const renderHotspotOverlay = (hotspot: HotspotConfig['hotspots'][0]) => {
    const isClicked = clickedHotspots.has(hotspot.id);
    const isCorrect = result?.feedback?.correctItems?.includes(hotspot.id);
    const isIncorrect = result?.feedback?.incorrectItems?.includes(hotspot.id);
    
    let fillColor = 'transparent';
    let strokeColor = 'transparent';
    
    if (showResult) {
      if (hotspot.isCorrect) {
        fillColor = 'rgba(34, 197, 94, 0.3)';
        strokeColor = 'rgb(34, 197, 94)';
      } else if (isIncorrect) {
        fillColor = 'rgba(239, 68, 68, 0.3)';
        strokeColor = 'rgb(239, 68, 68)';
      }
    } else if (isClicked) {
      fillColor = 'rgba(59, 130, 246, 0.3)';
      strokeColor = 'rgb(59, 130, 246)';
    }

    const shouldShow = showResult || isClicked;
    if (!shouldShow) return null;

    switch (hotspot.shape) {
      case 'rect': {
        const [x1, y1, x2, y2] = hotspot.coords;
        return (
          <rect
            key={hotspot.id}
            x={`${x1}%`}
            y={`${y1}%`}
            width={`${x2 - x1}%`}
            height={`${y2 - y1}%`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
          />
        );
      }
      case 'circle': {
        const [cx, cy, r] = hotspot.coords;
        return (
          <circle
            key={hotspot.id}
            cx={`${cx}%`}
            cy={`${cy}%`}
            r={`${r}%`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
          />
        );
      }
      case 'polygon': {
        const points = [];
        for (let i = 0; i < hotspot.coords.length; i += 2) {
          points.push(`${hotspot.coords[i]}%,${hotspot.coords[i + 1]}%`);
        }
        return (
          <polygon
            key={hotspot.id}
            points={points.join(' ')}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="2"
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-sm sm:text-base text-muted-foreground">
        {config.allowMultiple 
          ? "Kliknij na wszystkie prawidłowe obszary na obrazku"
          : "Kliknij na prawidłowy obszar na obrazku"}
      </p>

      <div 
        className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 ${
          disabled 
            ? 'border-muted' 
            : 'border-primary/30 hover:border-primary hover:shadow-lg'
        }`}
        data-testid="hotspot-container"
      >
        <img
          ref={imageRef}
          src={config.imageUrl}
          alt="Obraz z zaznaczalnymi obszarami"
          className={`w-full h-auto transition-opacity ${disabled ? 'cursor-default' : 'cursor-crosshair hover:opacity-95'}`}
          onClick={handleImageClick}
          data-testid="hotspot-image"
        />
        
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {config.hotspots.map(hotspot => renderHotspotOverlay(hotspot))}
        </svg>

        {showResult && config.hotspots.filter(h => h.isCorrect).map(hotspot => {
          let labelX = 0, labelY = 0;
          switch (hotspot.shape) {
            case 'rect': {
              const [x1, y1, x2, y2] = hotspot.coords;
              labelX = (x1 + x2) / 2;
              labelY = y2 + 3;
              break;
            }
            case 'circle': {
              const [cx, cy, r] = hotspot.coords;
              labelX = cx;
              labelY = cy + r + 3;
              break;
            }
          }
          
          if (hotspot.label) {
            return (
              <div
                key={`label-${hotspot.id}`}
                className="absolute text-xs font-medium text-green-700 dark:text-green-400 bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded"
                style={{
                  left: `${labelX}%`,
                  top: `${labelY}%`,
                  transform: 'translate(-50%, 0)',
                }}
              >
                {hotspot.label}
              </div>
            );
          }
          return null;
        })}
      </div>

      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg" data-testid="hotspot-status">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MousePointer2 className={`h-5 w-5 ${clickedHotspots.size > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={clickedHotspots.size > 0 ? 'text-foreground' : 'text-muted-foreground'}>
            {clickedHotspots.size === 0 
              ? "Kliknij na obrazek, aby zaznaczyć" 
              : `Zaznaczono: ${clickedHotspots.size} ${config.allowMultiple ? 'obszarów' : 'obszar'}`}
          </span>
        </div>
        
        {!disabled && clickedHotspots.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            data-testid="clear-hotspots"
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
          >
            Wyczyść
          </Button>
        )}
      </div>

      {showResult && (
        <div className="flex items-center gap-4 text-sm p-3 bg-muted/20 rounded-lg" data-testid="hotspot-legend">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-green-500/30 border-2 border-green-500 shadow-sm" />
            <span className="font-medium text-green-700 dark:text-green-400">Prawidłowy obszar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-red-500/30 border-2 border-red-500 shadow-sm" />
            <span className="font-medium text-red-700 dark:text-red-400">Błędne zaznaczenie</span>
          </div>
        </div>
      )}

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <div className="mt-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm sm:text-base text-amber-800 dark:text-amber-200">
            Poprawne odpowiedzi: {Math.round(result.partialScore * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}
