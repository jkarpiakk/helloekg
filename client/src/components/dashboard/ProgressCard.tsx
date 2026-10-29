import { ProgressLine } from "@/components/ui/progress-line";

interface ProgressCardProps {
  /** Średnie opanowanie sekcji z pytaniami, 0–100 (opanowane = ostatnia odpowiedź poprawna) */
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
          <p id="overall-progress-label" className="label">Cały kurs · opanowane</p>
          <p className="muted text-sub">
            Tematy opanowane w całości: <span className="num text-[var(--txt)]">{completedSections}</span> z{" "}
            <span className="num">{totalSections}</span>
          </p>
        </div>
        <p className="num text-[clamp(2rem,1.6rem+1.6vw,2.75rem)] leading-none text-[var(--txt)]" data-testid="overall-progress">
          {pct}
          <span className="text-[var(--txt3)] text-[0.55em] ml-0.5">%</span>
          <span className="sr-only"> opanowane</span>
        </p>
      </div>
      <ProgressLine value={overallProgress} label="Opanowanie całego kursu" />
    </section>
  );
}
