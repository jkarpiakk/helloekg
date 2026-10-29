import { useEffect, useRef } from "react";
import { mount, type Rhythm } from "./ekgEngine";

export type { Rhythm };

export const EKG_RHYTHM_LABELS: Record<Rhythm, string> = {
  sinus: "rytm zatokowy",
  af: "migotanie przedsionków",
  avb1: "blok AV I stopnia",
  wenckebach: "blok AV II stopnia typu Wenckebacha",
  avb3: "blok AV III stopnia",
  aflutter: "trzepotanie przedsionków",
  brady: "bradykardia zatokowa",
  tachy: "tachykardia zatokowa",
};

export const isRhythm = (v: string): v is Rhythm => v in EKG_RHYTHM_LABELS;

/**
 * Żywy zapis EKG z silnika marki (ten sam co na blogu helloekg.pl i w studiu).
 * Animacja zatrzymuje się poza ekranem; przy „Ogranicz ruch” rysuje jedną klatkę.
 */
export function EkgCanvas({
  rhythm,
  height = 90,
  label = true,
  className = "",
}: {
  rhythm: Rhythm;
  height?: number;
  /** Podpis rytmu w rogu (mono, jak na landingu) */
  label?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mount(ref.current, rhythm, { height });
  }, [rhythm, height]);

  return (
    <figure
      className={`relative overflow-hidden rounded-lg border border-[var(--line)] ${className}`}
      style={{ background: "#070a0e" }}
    >
      <canvas ref={ref} height={height} role="img" aria-label={`Żywy zapis EKG: ${EKG_RHYTHM_LABELS[rhythm]}`} />
      {label && (
        <figcaption className="label pointer-events-none absolute left-3 top-2.5">
          {EKG_RHYTHM_LABELS[rhythm]}
        </figcaption>
      )}
    </figure>
  );
}
