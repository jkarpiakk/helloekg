import { EkgCanvas, type Rhythm } from "@/components/ekg/EkgCanvas";

/**
 * Nagłówek rozdziału. Gdy rozdział nie ma własnego obrazu ani zapisu EKG, dostaje jeden
 * spokojny element marki: duży numer w Space Grotesk i cienką linię żywego EKG
 * (silnik przy „Ogranicz ruch” rysuje jedną nieruchomą klatkę).
 */
export function ChapterHeader({
  index,
  total,
  title,
  showTitle,
  decorate,
  rhythm,
  showLine,
}: {
  index: number;
  total: number;
  title: string;
  showTitle: boolean;
  /** Rozdział bez własnej grafiki → numer i linia EKG */
  decorate: boolean;
  rhythm: Rhythm;
  /** false, gdy linia EKG jest już na ekranie (np. w nagłówku wykładu nad pierwszym rozdziałem) */
  showLine: boolean;
}) {
  if (!showTitle) return null;
  const multi = total > 1;
  const n = String(index + 1).padStart(2, "0");

  if (!decorate || !multi) {
    return (
      <header className="grid gap-3 mb-8">
        {multi && <p className="label label--g">Rozdział {index + 1}</p>}
        <h2 id="chapter-title" className="h2" data-testid="current-chapter-title">
          {title}
        </h2>
      </header>
    );
  }

  return (
    <header className="mb-9 grid gap-5" data-testid="chapter-band">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-5 gap-y-3 sm:gap-x-7">
        <span
          className="num select-none font-medium leading-[.8] text-[clamp(3.75rem,2.6rem+4.4vw,6.5rem)] tracking-[-0.04em] text-[var(--txt3)]"
          aria-hidden="true"
        >
          {n}
        </span>
        <p className="label label--g pb-[.35em]">
          Rozdział {index + 1} z {total}
        </p>
      </div>
      <h2 id="chapter-title" className="h2" data-testid="current-chapter-title">
        {title}
      </h2>
    </header>
  );
}
