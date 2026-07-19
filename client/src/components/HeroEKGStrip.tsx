import { useEffect, useRef } from "react";

/**
 * Pasek EKG pod hero — rysuje P-QRS-T w tym samym rytmie 72 BPM co fala pobudzenia
 * w Hero3DHeart. Zegar jest wspólny (performance.now() modulo długość cyklu), więc
 * obie animacje są zsynchronizowane bez przekazywania stanu między komponentami.
 *
 * Fazy odpowiadają dokładnie tym z shadera serca:
 *   P 0–15% | pauza AV/PQ 15–24% | QRS 24–34% | T 45–60% | reszta: spoczynek
 */

// Musi być identyczne z CYCLE_SECONDS w Hero3DHeart — obie animacje dzielą zegar
const CYCLE_SECONDS = 2.6;

/** Wychylenie zapisu w danej fazie cyklu (0..1), w jednostkach względnych. */
function ekgAmplitude(phase: number): number {
  // Załamek P — łagodne, niskie wychylenie w trakcie aktywacji przedsionków
  if (phase >= 0.02 && phase < 0.15) {
    return Math.sin(((phase - 0.02) / 0.13) * Math.PI) * 0.16;
  }
  // Odcinek PQ — linia izoelektryczna: opóźnienie w węźle AV
  if (phase < 0.24) return 0;
  // Zespół QRS — Q w dół, R ostro w górę, S w dół
  if (phase < 0.34) {
    const q = (phase - 0.24) / 0.10;
    if (q < 0.25) return -q * 0.5;
    if (q < 0.55) return (q - 0.25) * 3.2 - 0.12;
    if (q < 0.8) return 0.84 - (q - 0.55) * 4.4;
    return -0.26 + (q - 0.8) * 1.3;
  }
  // Załamek T — repolaryzacja komór
  if (phase >= 0.45 && phase < 0.60) {
    return Math.sin(((phase - 0.45) / 0.15) * Math.PI) * 0.3;
  }
  return 0;
}

type Props = { className?: string; height?: number };

export default function HeroEKGStrip({ className = "", height = 64 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameId = 0;
    let width = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ile cykli mieści się w kadrze — stała skala czasu niezależna od szerokości
    const SECONDS_ON_SCREEN = CYCLE_SECONDS * 3;

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent?.clientWidth || 800;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = "100%";
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const centerY = height / 2;
    const amp = height * 0.36;

    const drawFrame = (elapsed: number) => {
      ctx.clearRect(0, 0, width, height);

      // Ślad — cały zapis widoczny w przygaszonej zieleni
      ctx.strokeStyle = "#1E4536";
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let x = 0; x <= width; x++) {
        const tAtX = elapsed - ((width - x) / width) * SECONDS_ON_SCREEN;
        const phase = ((tAtX % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS / CYCLE_SECONDS;
        const y = centerY - ekgAmplitude(phase) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Impuls — jasna zieleń na ostatnim odcinku, tam gdzie „teraz" biegnie zapis
      ctx.strokeStyle = "#3EE6A8";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const headFrom = Math.max(0, width - Math.round((width / SECONDS_ON_SCREEN) * CYCLE_SECONDS));
      for (let x = headFrom; x <= width; x++) {
        const tAtX = elapsed - ((width - x) / width) * SECONDS_ON_SCREEN;
        const phase = ((tAtX % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS / CYCLE_SECONDS;
        const y = centerY - ekgAmplitude(phase) * amp;
        if (x === headFrom) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    if (reduced) {
      // prefers-reduced-motion: statyczny, reprezentatywny fragment zapisu
      drawFrame(SECONDS_ON_SCREEN);
    } else {
      const loop = (now: number) => {
        // Ten sam zegar co Hero3DHeart — performance.now() w sekundach
        drawFrame(now / 1000);
        frameId = requestAnimationFrame(loop);
      };
      frameId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [height]);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
