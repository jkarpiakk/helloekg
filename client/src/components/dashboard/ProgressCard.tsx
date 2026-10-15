import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Cienki pasek postępu z landingu (`.progress`). Przy pierwszym renderze rośnie od zera,
 * przy kolejnych zmianach płynnie przechodzi do nowej wartości (transition w CSS).
 * Przy „Ogranicz ruch” od razu pokazuje wartość docelową.
 */
export function ProgressLine({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const target = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const [width, setWidth] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setWidth(target);
      return;
    }
    // Dwie klatki: przeglądarka musi najpierw narysować 0, żeby transition zadziałał
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setWidth(target));
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
      aria-valuemax={100}
      aria-valuenow={Math.round(target)}
      aria-label={label}
    >
      <span style={{ width: `${width}%`, transition: reduce ? "none" : undefined }} />
    </div>
  );
}

interface ProgressCardProps {
  /** Średni postęp wszystkich sekcji, 0–100 */
  overallProgress: number;
  completedSections: number;
  totalSections: number;
}

/** Postęp całego kursu: duża liczba, pasek, jedna linijka kontekstu */
export default function ProgressCard({ overallProgress, completedSections, totalSections }: ProgressCardProps) {
  const pct = Math.round(overallProgress);
  return (
    <section className="grid gap-4" aria-labelledby="overall-progress-label" data-testid="progress-card">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <p id="overall-progress-label" className="label">Cały kurs</p>
          <p className="muted text-[15px]">
            Ukończone zestawy pytań: <span className="num text-[var(--txt)]">{completedSections}</span> z{" "}
            <span className="num">{totalSections}</span>
          </p>
        </div>
        <p className="num text-[clamp(2rem,1.6rem+1.6vw,2.75rem)] leading-none text-[var(--txt)]" data-testid="overall-progress">
          {pct}
          <span className="text-[var(--txt3)] text-[0.55em] ml-0.5">%</span>
        </p>
      </div>
      <ProgressLine value={overallProgress} label="Postęp całego kursu" />
    </section>
  );
}
