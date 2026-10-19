import { useEffect, useRef, type RefObject } from "react";

/**
 * Pasek postępu belki rozdziałów: jeden odcinek na rozdział. Przeczytane są pełne,
 * bieżący wypełnia się z przewijaniem (transform, bez przerysowań Reacta).
 */
export function ReadingProgress({
  index,
  total,
  articleRef,
  watchRef,
  offset,
}: {
  index: number;
  total: number;
  /** Bieżący rozdział (odczytywany co klatkę — po zmianie rozdziału wskazuje nowy element) */
  articleRef: RefObject<HTMLElement | null>;
  /** Stały kontener, którego zmiana wysokości (doładowane obrazy, rozwinięte karty) przelicza postęp */
  watchRef: RefObject<HTMLElement | null>;
  /** Wysokość nawigacji + belki nad treścią */
  offset: () => number;
}) {
  const fillRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const update = () => {
      raf = 0;
      const el = articleRef.current;
      const fill = fillRef.current;
      if (!el || !fill) return;
      const r = el.getBoundingClientRect();
      const y = window.scrollY;
      const start = r.top + y - offsetRef.current();
      const end = r.bottom + y - window.innerHeight;
      const f = end <= start ? (y >= end ? 1 : 0) : Math.min(1, Math.max(0, (y - start) / (end - start)));
      if (Math.abs(f - last) < 0.001) return;
      last = f;
      fill.style.transform = `scaleX(${f})`;
      const pct = Math.round(((index + f) / total) * 100);
      barRef.current?.setAttribute("aria-valuenow", String(pct));
      barRef.current?.setAttribute("aria-valuetext", `Rozdział ${index + 1} z ${total}, przeczytane ${Math.round(f * 100)}%`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    schedule();
    // Po zmianie rozdziału nowy element pojawia się dopiero po animacji wyjścia
    const late = window.setTimeout(schedule, 450);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (ro && watchRef.current) ro.observe(watchRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
    };
  }, [index, total, articleRef, watchRef]);

  return (
    <div
      ref={barRef}
      role="progressbar"
      aria-label="Postęp czytania"
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex h-[2px] gap-[3px]"
      data-testid="reading-progress"
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="relative h-full flex-1 overflow-hidden bg-[var(--puls-dark)]">
          {i < index && <span className="absolute inset-0 bg-[var(--puls)]" />}
          {i === index && (
            <span
              ref={fillRef}
              className="absolute inset-0 origin-left bg-[var(--puls)] will-change-transform"
              style={{ transform: "scaleX(0)" }}
            />
          )}
        </span>
      ))}
    </div>
  );
}
