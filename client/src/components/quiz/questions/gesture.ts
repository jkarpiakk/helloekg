/**
 * Wspólne narzędzia gestów dla pytań interaktywnych (przeciąganie, sortowanie, dopasowanie).
 * Zasady z „Designing Fluid Interfaces” (Apple, WWDC 2018):
 * - 10 px zwłoki, zanim ruch zostanie uznany za przeciąganie (odróżnia dotknięcie od gestu),
 * - po przekroczeniu progu element śledzi palec 1:1 od miejsca chwytu,
 * - przy puszczeniu prędkość gestu przechodzi na sprężynę (velocity handoff).
 */
import type { Transition, ValueAnimationTransition } from "framer-motion";
import { springMomentum } from "@/lib/motion";

export const DRAG_THRESHOLD = 10;

export type Sample = { t: number; x: number; y: number };

/** Dopisz próbkę i trzymaj tylko ostatnie ~100 ms ruchu */
export function pushSample(hist: Sample[], s: Sample) {
  hist.push(s);
  while (hist.length > 2 && s.t - hist[0].t > 100) hist.shift();
}

/** Prędkość w px/s z ostatnich próbek (jeśli palec stał przed puszczeniem — ~0) */
export function releaseVelocity(hist: Sample[], at: Sample): { vx: number; vy: number } {
  const recent = hist.filter((h) => at.t - h.t <= 100);
  const a = recent[0] ?? at;
  const dt = Math.max(16, at.t - a.t);
  return { vx: ((at.x - a.x) / dt) * 1000, vy: ((at.y - a.y) / dt) * 1000 };
}

/**
 * Powrót po anulowaniu: ta sama droga, którą element przyszedł (prosta do punktu wyjścia).
 * Z prędkości zostaje tylko składowa wzdłuż tej prostej — ruch nie skręca, ale niesie pęd.
 */
export function returnVelocity(x: number, y: number, vx: number, vy: number) {
  const len = Math.hypot(x, y);
  if (len < 0.5) return { vx: 0, vy: 0 };
  const ux = -x / len;
  const uy = -y / len;
  const along = vx * ux + vy * uy;
  return { vx: along * ux, vy: along * uy };
}

/** Preset przejścia z `@/lib/motion` jako opcje `animate(motionValue, …)` */
export function vt(t: Transition): ValueAnimationTransition<number> {
  return t as ValueAnimationTransition<number>;
}

/** Sprężyna z pędem (damping ~0.8) z prędkością gestu */
export function withVelocity(velocity: number, base: Transition = springMomentum): ValueAnimationTransition<number> {
  return { ...(base as ValueAnimationTransition<number>), velocity };
}

/** Czy zdarzenie pochodzi z pola tekstowego / kontrolki, która sama obsługuje klawisze */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
