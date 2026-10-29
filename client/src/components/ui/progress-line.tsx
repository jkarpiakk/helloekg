import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Jedyny pasek postępu kursu: cienka linia z landingu (`.progress`, 4px, tor `--puls-dark`,
 * wypełnienie `--puls`). Przy pierwszym renderze rośnie od zera, przy kolejnych zmianach płynnie
 * przechodzi do nowej wartości (transform w CSS). Przy „Ogranicz ruch” od razu wartość docelowa.
 *
 * `value` liczony w jednostkach `max` (domyślnie procenty): `<ProgressLine value={3} max={10} />`
 * to „3 z 10”, i tak też czyta go czytnik ekranu (aria-valuenow / aria-valuemax).
 */
export function ProgressLine({
  value,
  max = 100,
  label,
  className,
  "data-testid": testId,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const reduce = useReducedMotion();
  const safeMax = max > 0 ? max : 1;
  const raw = Number.isFinite(value) ? value : 0;
  const target = Math.max(0, Math.min(1, raw / safeMax));
  const [fill, setFill] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setFill(target);
      return;
    }
    // Dwie klatki: przeglądarka musi najpierw narysować 0, żeby transition zadziałał
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setFill(target));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [target, reduce]);

  return (
    <div
      className={cn("progress", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max > 0 ? max : undefined}
      aria-valuenow={Math.round(Math.max(0, Math.min(safeMax, raw)))}
      aria-label={label}
      data-testid={testId}
    >
      <span style={{ "--w": fill, transition: reduce ? "none" : undefined } as React.CSSProperties} />
    </div>
  );
}
