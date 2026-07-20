import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { CYCLE_SECONDS, cyclePhase } from "@/lib/heart-rhythm";

/**
 * Pasek EKG pod hero — rysuje P-QRS-T w tym samym rytmie co puls serca 3D.
 * Zegar jest wspólny (performance.now modulo CYCLE_SECONDS z @/lib/heart-rhythm),
 * więc obie animacje są w fazie bez przekazywania stanu między komponentami.
 *
 * Fazy odpowiadają dokładnie tym z shadera serca:
 *   P 0–15% | pauza AV/PQ 15–24% | QRS 24–34% | T 45–60% | reszta: spoczynek
 */

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
  const { theme } = useTheme();
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Na bieli jasnozielony impuls znika — akcentem jasnego motywu jest #0B7E54
    const isLight = theme === "light";
    const traceColor = isLight ? "#93B8A8" : "#1E4536";
    const pulseColor = isLight ? "#0B7E54" : "#3EE6A8";
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
      // Przypisanie do canvas.width czyści bufor. W trybie animowanym najbliższa
      // klatka i tak przerysuje, ale przy prefers-reduced-motion pętli nie ma —
      // bez tego pasek zostawał trwale pusty po zmianie szerokości okna.
      if (reduced) drawFrame(SECONDS_ON_SCREEN);
    };

    const centerY = height / 2;
    const amp = height * 0.36;

    // Wychylenie dla kolumny piksela, liczone z nadpróbkowaniem.
    //
    // Bez tego zapis MIGOCZE: załamek R jest bardzo wąski (kilka pikseli), więc przy
    // jednej próbce na kolumnę jego szczyt raz trafiał w próbkę, a raz nie i amplituda
    // skakała z klatki na klatkę. Bierzemy skrajne wychylenie z kilku podpróbek, dzięki
    // czemu szczyt jest reprezentowany zawsze, niezależnie od podpikselowego przesunięcia.
    const SUBSAMPLES = 4;
    const yAt = (x: number, elapsed: number) => {
      let extreme = 0;
      for (let s = 0; s < SUBSAMPLES; s++) {
        const xs = x + s / SUBSAMPLES;
        const tAtX = elapsed - ((width - xs) / width) * SECONDS_ON_SCREEN;
        const v = ekgAmplitude(cyclePhase(tAtX));
        if (Math.abs(v) > Math.abs(extreme)) extreme = v;
      }
      return centerY - extreme * amp;
    };

    const drawFrame = (rawElapsed: number) => {
      // Przesuwaj zapis skokami o pełny piksel. Płynne przesuwanie o ułamki piksela
      // sprawiało, że cała krzywa drgała pionowo między klatkami.
      const pxPerSecond = width / SECONDS_ON_SCREEN;
      const elapsed = Math.round(rawElapsed * pxPerSecond) / pxPerSecond;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Ślad — cały zapis widoczny w przygaszonej zieleni
      ctx.strokeStyle = traceColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x++) {
        const y = yAt(x, elapsed);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Impuls — jasna zieleń na ostatnim odcinku, tam gdzie „teraz" biegnie zapis
      ctx.strokeStyle = pulseColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const headFrom = Math.max(0, width - Math.round((width / SECONDS_ON_SCREEN) * CYCLE_SECONDS));
      for (let x = headFrom; x <= width; x++) {
        const y = yAt(x, elapsed);
        if (x === headFrom) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    // Dopiero tutaj — `resize` wywołuje `drawFrame`, więc musi być po jego definicji
    resize();
    window.addEventListener("resize", resize);

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
  }, [height, theme, reduced]);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
