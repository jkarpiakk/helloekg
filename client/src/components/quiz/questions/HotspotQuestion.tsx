import { useCallback, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HotspotConfig, AnswerData, QuizResult } from "@/types";
import { DRAG_THRESHOLD } from "./gesture";
import PartialScore from "./PartialScore";

interface HotspotQuestionProps {
  config: HotspotConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

type Hotspot = HotspotConfig["hotspots"][0];

/** Trafienie w obszar — współrzędne w % obrazu (0–100); rect = [lewo, góra, prawo, dół] */
function isPointInHotspot(x: number, y: number, hotspot: Hotspot): boolean {
  switch (hotspot.shape) {
    case "rect": {
      const [x1, y1, x2, y2] = hotspot.coords;
      return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    }
    case "circle": {
      const [cx, cy, r] = hotspot.coords;
      const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      return distance <= r;
    }
    case "polygon": {
      const points = [];
      for (let i = 0; i < hotspot.coords.length; i += 2) {
        points.push({ x: hotspot.coords[i], y: hotspot.coords[i + 1] });
      }
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x,
          yi = points[i].y;
        const xj = points[j].x,
          yj = points[j].y;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }
    default:
      return false;
  }
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
  // Znacznik pokazany od razu przy naciśnięciu; zatwierdzany przy puszczeniu bez przesunięcia
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ pid: number; sx: number; sy: number; x: number; y: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const toPercent = (clientX: number, clientY: number) => {
    const rect = imageRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const commitPoint = useCallback(
    (x: number, y: number) => {
      const newCoordinates = config.allowMultiple ? [...clickCoordinates, { x, y }] : [{ x, y }];
      setClickCoordinates(newCoordinates);

      const newClickedHotspots = new Set(config.allowMultiple ? clickedHotspots : []);
      let foundHotspot = false;

      for (const hotspot of config.hotspots) {
        if (isPointInHotspot(x, y, hotspot)) {
          foundHotspot = true;
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
          break;
        }
      }

      setClickedHotspots(newClickedHotspots);

      const answerData: AnswerData = {
        type: "hotspot",
        clickedHotspots: Array.from(newClickedHotspots),
        clickCoordinates: newCoordinates,
        clickedOutside: !foundHotspot,
      };
      onChange(answerData);
    },
    [config, clickedHotspots, clickCoordinates, onChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !imageRef.current || e.button !== 0) return;
    const p = toPercent(e.clientX, e.clientY);
    if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return;
    press.current = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, ...p };
    setPending(p);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = press.current;
    if (!d || e.pointerId !== d.pid) return;
    // Przesunięcie = przewijanie strony, nie wskazanie
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) >= DRAG_THRESHOLD) {
      press.current = null;
      setPending(null);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = press.current;
    press.current = null;
    setPending(null);
    if (!d || e.pointerId !== d.pid) return;
    commitPoint(d.x, d.y);
  };

  const onPointerCancel = () => {
    press.current = null;
    setPending(null);
  };

  const handleClear = () => {
    setClickedHotspots(new Set());
    setClickCoordinates([]);
    onChange({
      type: "hotspot",
      clickedHotspots: [],
      clickCoordinates: [],
    });
  };

  // Obszary po sprawdzeniu: poprawny — linia pulsu; błędnie wskazany — przerywana linia alarmu
  const renderHotspotOverlay = (hotspot: Hotspot) => {
    if (!showResult) return null;
    const isIncorrect = result?.feedback?.incorrectItems?.includes(hotspot.id);
    let stroke: string;
    let fill = "transparent";
    let dash: string | undefined;
    if (hotspot.isCorrect) {
      stroke = "var(--puls)";
      fill = "var(--tint)";
    } else if (isIncorrect) {
      stroke = "var(--alarm)";
      dash = "4 3";
    } else {
      return null;
    }
    const common = {
      fill,
      stroke,
      strokeWidth: 2,
      strokeDasharray: dash,
      vectorEffect: "non-scaling-stroke" as const,
    };

    switch (hotspot.shape) {
      case "rect": {
        const [x1, y1, x2, y2] = hotspot.coords;
        return <rect key={hotspot.id} x={x1} y={y1} width={x2 - x1} height={y2 - y1} rx={0.6} {...common} />;
      }
      case "circle": {
        const [cx, cy, r] = hotspot.coords;
        return <ellipse key={hotspot.id} cx={cx} cy={cy} rx={r} ry={r} {...common} />;
      }
      case "polygon": {
        const points = [];
        for (let i = 0; i < hotspot.coords.length; i += 2) {
          points.push(`${hotspot.coords[i]},${hotspot.coords[i + 1]}`);
        }
        return <polygon key={hotspot.id} points={points.join(" ")} {...common} />;
      }
      default:
        return null;
    }
  };

  const markerFor = (coord: { x: number; y: number }) =>
    config.hotspots.some((h) => h.isCorrect && isPointInHotspot(coord.x, coord.y, h));

  return (
    <div className="grid gap-4">
      <p className="text-[15px] text-[var(--txt2)]">
        {config.allowMultiple
          ? "Dotknij zapisu we wszystkich właściwych miejscach."
          : "Dotknij zapisu we właściwym miejscu."}
      </p>

      <div
        className={cn(
          "relative select-none overflow-hidden rounded-[12px] border bg-[var(--panel)] transition-[border-color] duration-200",
          disabled ? "border-[var(--line)]" : "cursor-crosshair border-[var(--line2)] hover:border-[var(--txt3)]",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        data-testid="hotspot-container"
      >
        <img
          ref={imageRef}
          src={config.imageUrl}
          alt="Zapis EKG — wskaż właściwe miejsce"
          draggable={false}
          className="block h-auto w-full"
          data-testid="hotspot-image"
        />

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {config.hotspots.map((hotspot) => renderHotspotOverlay(hotspot))}
        </svg>

        {/* Znaczniki wskazań (HTML, żeby były okrągłe niezależnie od proporcji obrazu) */}
        {clickCoordinates.map((coord, idx) => {
          const hit = markerFor(coord);
          const tone = !showResult ? "neutral" : hit ? "right" : "wrong";
          return (
            <span
              key={`click-${idx}`}
              className={cn(
                "pointer-events-none absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-[var(--ink)]",
                tone === "neutral" && "border-[var(--txt)]",
                tone === "right" && "border-[var(--puls)] text-[var(--puls)]",
                tone === "wrong" && "border-[var(--alarm)] text-[var(--alarm)]",
              )}
              style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
              aria-hidden
            >
              {tone === "neutral" && <span className="h-1.5 w-1.5 rounded-full bg-[var(--txt)]" />}
              {tone === "right" && <Check className="h-3 w-3" strokeWidth={3} />}
              {tone === "wrong" && <X className="h-3 w-3" strokeWidth={3} />}
            </span>
          );
        })}
        {pending && (
          <span
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--txt)] bg-[color-mix(in_srgb,var(--ink)_60%,transparent)]"
            style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
            aria-hidden
          />
        )}

        {showResult &&
          config.hotspots
            .filter((h) => h.isCorrect)
            .map((hotspot) => {
              let labelX = 0,
                labelY = 0;
              switch (hotspot.shape) {
                case "rect": {
                  const [x1, , x2, y2] = hotspot.coords;
                  labelX = (x1 + x2) / 2;
                  labelY = y2 + 3;
                  break;
                }
                case "circle": {
                  const [cx, cy, r] = hotspot.coords;
                  labelX = cx;
                  labelY = cy + r + 3;
                  break;
                }
              }
              if (!hotspot.label) return null;
              return (
                <div
                  key={`label-${hotspot.id}`}
                  className="pointer-events-none absolute rounded-[6px] border border-[var(--puls-deep)] bg-[var(--panel)] px-2 py-0.5 text-[12px] text-[var(--txt)]"
                  style={{ left: `${labelX}%`, top: `${labelY}%`, transform: "translate(-50%, 0)" }}
                >
                  {hotspot.label}
                </div>
              );
            })}
      </div>

      <div className="flex min-h-[44px] items-center justify-between gap-3" data-testid="hotspot-status">
        <p className="text-[14px] text-[var(--txt2)]" aria-live="polite">
          {clickCoordinates.length === 0
            ? "Nic jeszcze nie wskazano."
            : clickedHotspots.size > 0
              ? `Wskazano obszar${config.allowMultiple ? ` (${clickedHotspots.size})` : ""}.`
              : "Wskazano miejsce poza obszarami."}
        </p>
        {!disabled && clickCoordinates.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear} data-testid="clear-hotspots">
            Wyczyść
          </Button>
        )}
      </div>

      {showResult && (
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[var(--txt2)]" data-testid="hotspot-legend">
          <li className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-[4px] border-2 border-[var(--puls)] bg-[var(--tint)]" aria-hidden />
            Właściwy obszar
          </li>
          <li className="flex items-center gap-2">
            <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-[var(--puls)] text-[var(--puls)]" aria-hidden>
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            Twoje trafne wskazanie
          </li>
          <li className="flex items-center gap-2">
            <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-[var(--alarm)] text-[var(--alarm)]" aria-hidden>
              <X className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            Twoje chybione wskazanie
          </li>
        </ul>
      )}

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <PartialScore score={result.partialScore} />
      )}
    </div>
  );
}
