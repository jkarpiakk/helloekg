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
/** Dotyk poza uchwytem: przytrzymanie bez ruchu tyle ms podnosi element (krótsze = przewijanie) */
export const HOLD_MS = 200;
/** Ruch palca większy niż tyle px przed upływem HOLD_MS to przewijanie — gest się wycofuje */
export const HOLD_SLOP = 8;

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

/**
 * Jak zaczyna się przeciąganie dla danego wskaźnika:
 * - mysz (i pióro na urządzeniu z myszą): od razu, po progu 10 px,
 * - dotyk na uchwycie (`data-drag-handle`, touch-action: none): po progu 10 px,
 * - dotyk gdziekolwiek indziej: po przytrzymaniu HOLD_MS bez ruchu — wiersz ma touch-action: pan-y,
 *   więc zwykłe przesunięcie palcem przewija stronę.
 */
export function dragStartMode(e: { pointerType: string; target: EventTarget | null }): "threshold" | "hold" {
  if (e.pointerType === "mouse") return "threshold";
  const t = e.target as Element | null;
  return t && typeof t.closest === "function" && t.closest("[data-drag-handle]") ? "threshold" : "hold";
}

/**
 * Blokada przewijania strony palcem, gdy element jest już podniesiony. Słuchacz `touchmove`
 * (niepasywny) wisi na kontenerze stale — dodany dopiero w trakcie gestu bywa ignorowany
 * przez przeglądarkę. Zwraca funkcję sprzątającą.
 */
export function blockTouchScrollWhile(el: HTMLElement, isDragging: () => boolean): () => void {
  const onTouchMove = (e: TouchEvent) => {
    if (isDragging() && e.cancelable) e.preventDefault();
  };
  // Długie przytrzymanie na Androidzie otwiera menu kontekstowe — w trakcie gestu nie
  const onContext = (e: Event) => {
    if (isDragging()) e.preventDefault();
  };
  el.addEventListener("touchmove", onTouchMove, { passive: false });
  el.addEventListener("contextmenu", onContext);
  return () => {
    el.removeEventListener("touchmove", onTouchMove);
    el.removeEventListener("contextmenu", onContext);
  };
}

/** Najbliższy przodek, który się przewija w pionie (domyślnie dokument) */
function scrollParent(el: Element | null): HTMLElement | null {
  for (let n = el?.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

const EDGE = 60;
/** Maksymalna prędkość auto-przewijania (px/s) — przy samej krawędzi */
const MAX_SPEED = 900;

/**
 * Auto-przewijanie przy krawędzi w trakcie przeciągania: w pasie EDGE px od góry/dołu
 * okna (górny pas liczony od dolnej krawędzi belki nawigacji) prędkość rośnie z bliskością.
 * Faktyczne przesunięcie (po przycięciu do granic) trafia do `onScroll(dy)` — przeciągany
 * element dodaje je do swojej pozycji, więc zostaje pod palcem.
 */
export function createAutoScroll(origin: Element, onScroll: (dy: number) => void) {
  const container = scrollParent(origin);
  let raf = 0;
  let pointerY = -1;
  let last = 0;
  let acc = 0;

  const bounds = () => {
    if (container) {
      const r = container.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    }
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 0;
    const vv = window.visualViewport;
    return { top: navH, bottom: vv ? vv.offsetTop + vv.height : window.innerHeight };
  };

  const speedAt = (y: number) => {
    const b = bounds();
    const top = b.top + EDGE - y;
    const bottom = y - (b.bottom - EDGE);
    if (top > 0) return -MAX_SPEED * Math.min(1, top / EDGE) ** 2;
    if (bottom > 0) return MAX_SPEED * Math.min(1, bottom / EDGE) ** 2;
    return 0;
  };

  const read = () => (container ? container.scrollTop : window.scrollY);

  const tick = (t: number) => {
    raf = 0;
    const v = speedAt(pointerY);
    if (!v) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    const before = read();
    // Ułamki pikseli zbieramy, żeby powolne przewijanie przy granicy pasa też ruszyło
    acc += v * dt;
    const step = Math.trunc(acc);
    acc -= step;
    if (step) {
      if (container) container.scrollTop += step;
      else window.scrollBy({ top: step, behavior: "instant" as ScrollBehavior });
    }
    const moved = read() - before;
    if (moved) onScroll(moved);
    raf = requestAnimationFrame(tick);
  };

  return {
    /** Wywołuj przy każdym ruchu wskaźnika (clientY) */
    update(clientY: number) {
      pointerY = clientY;
      if (!raf && speedAt(clientY)) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      pointerY = -1;
    },
  };
}

export type AutoScroll = ReturnType<typeof createAutoScroll>;
