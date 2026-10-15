/**
 * Ruch w helloEKG — sprężyny opisane jak u Apple („Designing Fluid Interfaces”, WWDC 2018):
 * damping ratio (1 = bez odbicia) i response (s). W framer-motion odpowiada im
 * `bounce` (= 1 − damping) i `duration` (≈ response).
 *
 * Zasady:
 * - domyślnie damping 1 — spokojnie, bez przestrzelenia,
 * - odbicie (damping ~0.8) tylko tam, gdzie gest niósł pęd (rzut, puszczenie po przeciągnięciu),
 * - sprężyna startuje z bieżącej wartości, więc każdą animację można przerwać w połowie,
 * - przy „Ogranicz ruch” zamiast przesunięć zostaje krótkie przenikanie.
 */
import type { Transition, Variants } from "framer-motion";

/** Domyślna sprężyna interfejsu: damping 1.0, response 0.4 */
export const spring: Transition = { type: "spring", bounce: 0, duration: 0.4 };
/** Szybsza — drobne elementy, zmiany stanu */
export const springSnappy: Transition = { type: "spring", bounce: 0, duration: 0.3 };
/** Z pędem — tylko po geście, który go niósł (damping ~0.8) */
export const springMomentum: Transition = { type: "spring", bounce: 0.2, duration: 0.4 };
/** Szuflady i arkusze (Apple: damping 0.8, response 0.3) — tylko gdy otwiera je gest */
export const springSheet: Transition = { type: "spring", bounce: 0.2, duration: 0.3 };

/** Wejście treści: krótko i blisko — ruch tylko podpowiada kierunek */
export const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** Kontener z kolejnym wejściem dzieci */
export const stagger = (gap = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap } },
});

/** Reakcja na naciśnięcie: od razu przy dotknięciu, nie po puszczeniu */
export const press = { scale: 0.97, transition: { duration: 0.1, ease: "easeOut" } } as const;

/** Rzut pędu jak przy przewijaniu w iOS — gdzie element by się zatrzymał (px) */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Gumowa granica: im dalej za krawędź, tym mniejszy ruch */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
