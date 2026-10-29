/**
 * Instrukcja przy pierwszym logowaniu: kolejne elementy ekranu podświetlają się (wycięcie
 * w przyciemnieniu), a karta obok mówi, co to jest i co kliknąć.
 *
 * Ruch (Apple, „Designing Fluid Interfaces”):
 * - wycięcie przechodzi między celami sprężyną bez odbicia; x, y, szerokość i wysokość osobno,
 *   zawsze od bieżącej wartości na ekranie — zmiana kroku w połowie ruchu nie skacze,
 * - cel śledzony zdarzeniami (przewijanie, zmiana rozmiaru, zmiany DOM) z krótkim „ogonem” klatek
 *   po każdym z nich — bez stałej pętli rAF; karta jedzie razem z nim,
 * - karta „materializuje się” od strony celu (skala .96 → 1, krycie, rozmycie) i tak samo znika,
 * - przyciski reagują przy naciśnięciu; Esc zamyka od razu; klik w przyciemnienie tylko „trąca” kartę.
 * „Ogranicz ruch”: bez podróży sprężyną i bez oddychania obwódki — samo przenikanie.
 *
 * Wyjście poza trasę kroku (np. kursant wrócił na panel w połowie): instrukcja pauzuje
 * i zostawia małą pigułkę „Wróć do instrukcji” (lewy dół, z „×” do zakończenia). To mniej
 * irytujące niż zamknięcie: nikt nie traci miejsca, a pigułka nie zasłania treści.
 */
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import { useLocation } from "wouter";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { spring } from "@/lib/motion";
import { firstLectureHref, useModules } from "./onboardingStore";
import {
  TOUR_EVENT,
  TOUR_STEPS,
  isLecturePath,
  isQuietRoute,
  readTour,
  saveTourDone,
  saveTourStep,
  type TourStep,
  type TourTarget,
} from "./tourSteps";

const PAD = 8;
const GAP = 14;
const GUTTER = 16;
const SEEK_MS = 4000;
const SKIP_MS = 600;
const holeSpring = { type: "spring", bounce: 0, duration: 0.4 } as const;
/** Po każdym zdarzeniu (przewinięcie, zmiana układu) śledzimy cel jeszcze przez tyle ms — łapie przejścia CSS */
const TAIL_MS = 500;
/** Zmiana położenia celu — karta przelicza swoją pozycję */
const GEOM_EVENT = "hk:tour-geom";

type Rect = { x: number; y: number; w: number; h: number };
type Side = "center" | "below" | "above" | "dock-bottom" | "dock-top";

const TOUR_CSS = `
.tour-hole{position:fixed;left:0;top:0;border-radius:16px;pointer-events:none;
  box-shadow:0 0 0 200vmax var(--tour-dim,rgba(3,5,8,.8))}
.tour-frame{position:absolute;inset:0;border-radius:inherit;border:1px solid color-mix(in srgb,var(--puls) 55%,transparent)}
.tour-ring{position:absolute;inset:0;border-radius:inherit;border:1px solid var(--puls)}
.tour-material{background:color-mix(in srgb,var(--panel) 92%,transparent);
  -webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%);
  border:1px solid var(--line2)}
.tour-arrow{position:absolute;left:0;width:12px;height:12px;background:var(--panel);border:1px solid var(--line2)}
.tour-arrow[data-edge="top"]{top:-7px;border-right:0;border-bottom:0}
.tour-arrow[data-edge="bottom"]{bottom:-7px;border-left:0;border-top:0}
@media (prefers-reduced-transparency: reduce){
  .tour-hole{--tour-dim:rgba(5,8,11,.9)}
  .tour-material{background:var(--panel);-webkit-backdrop-filter:none;backdrop-filter:none}
}
@media (prefers-contrast: more){
  .tour-material,.tour-arrow{border-width:2px}
  .tour-ring{border-width:2px}
}
`;

/* ───────────────────────── pomiary ───────────────────────── */

let safeArea: { top: number; bottom: number } | null = null;
function getSafeArea() {
  if (safeArea) return safeArea;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  safeArea = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return safeArea;
}

function isVisible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function resolveTarget(step: TourStep): { el: HTMLElement; ti: number } | null {
  const targets = step.targets ?? [];
  for (let i = 0; i < targets.length; i++) {
    const el = document.querySelector<HTMLElement>(targets[i].selector);
    if (el && isVisible(el)) return { el, ti: i };
  }
  return null;
}

function paddedRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
}

const centerRect = (): Rect => ({ x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 });
const sameRect = (a: Rect | null, b: Rect) =>
  !!a && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

/** Element przyklejony (nawigacja, przycisk zgłoszeń, belka rozdziałów) — przewijanie nic nie da */
function isPinned(el: Element | null) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const pos = getComputedStyle(n).position;
    if (pos === "fixed" || pos === "sticky") return true;
  }
  return false;
}

function needsScroll(el: Element) {
  if (isPinned(el)) return false;
  const r = el.getBoundingClientRect();
  const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64;
  return r.top < navH + getSafeArea().top + PAD || r.bottom > window.innerHeight - PAD;
}

const FOCUSABLE = 'a[href],button:not([disabled]),summary,input,select,textarea,[tabindex]:not([tabindex="-1"])';
function focusableIn(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  return el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE);
}

function useIsMobile() {
  const query = "(max-width: 767px)";
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

function placeCard(r: Rect | null, cw: number, ch: number, mobile: boolean) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  if (!r) return { x: (vw - cw) / 2, y: (vh - ch) / 2, side: "center" as Side, ax: cw / 2 };
  const tcx = r.x + r.w / 2;
  let x: number;
  let y: number;
  let side: Side;
  if (mobile) {
    // Telefon: arkusz przy krawędzi, po przeciwnej stronie niż cel
    const sa = getSafeArea();
    const targetTop = r.y + r.h / 2 < vh / 2;
    side = targetTop ? "dock-bottom" : "dock-top";
    x = (vw - cw) / 2;
    y = targetTop ? vh - ch - GUTTER - sa.bottom : GUTTER + sa.top;
  } else {
    const fitsBelow = r.y + r.h + GAP + ch <= vh - GUTTER;
    const fitsAbove = r.y - GAP - ch >= GUTTER;
    side = fitsBelow || (!fitsAbove && vh - (r.y + r.h) >= r.y) ? "below" : "above";
    x = clamp(tcx - cw / 2, GUTTER, vw - cw - GUTTER);
    y = clamp(side === "below" ? r.y + r.h + GAP : r.y - GAP - ch, GUTTER, vh - ch - GUTTER);
  }
  return { x, y, side, ax: clamp(tcx - x, 22, cw - 22) };
}

/* ───────────────────────── karta ───────────────────────── */

interface CardProps {
  step: TourStep;
  target?: TourTarget;
  label: string;
  geomRef: React.MutableRefObject<Rect | null>;
  cardRef: React.MutableRefObject<HTMLDivElement | null>;
  mobile: boolean;
  reduce: boolean;
  nudge: number;
  onNext: () => void;
  onBack: (() => void) | null;
  onSkip: () => void;
}

function CoachCard({ step, target, label, geomRef, cardRef, mobile, reduce, nudge, onNext, onBack, onSkip }: CardProps) {
  const isPresent = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const nx = useMotionValue(0);
  const ax = useMotionValue(0);
  const origin = useMotionValue("50% 50%");
  const x = useTransform([px, nx] as MotionValue<number>[], ([a, b]: number[]) => a + b);
  const arrowX = useTransform(ax, (v) => v - 6);
  const [side, setSide] = useState<Side>("center");
  const sideRef = useRef<Side>("center");

  // Pozycja liczona przed pierwszym narysowaniem, potem przy każdej zmianie celu, okna
  // albo rozmiaru karty (zdarzenia, bez stałej pętli) — do wyjścia
  useLayoutEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const p = placeCard(geomRef.current, el.offsetWidth, el.offsetHeight, mobile);
      px.set(p.x);
      py.set(p.y);
      ax.set(p.ax);
      const edgeTop = p.side === "below" || p.side === "dock-bottom";
      origin.set(p.side === "center" ? "50% 50%" : `${p.ax}px ${edgeTop ? "0%" : "100%"}`);
      if (p.side !== sideRef.current) {
        sideRef.current = p.side;
        setSide(p.side);
      }
    };
    update();
    if (!isPresent) return; // znikająca karta zostaje tam, gdzie była
    window.addEventListener(GEOM_EVENT, update);
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro && ref.current) ro.observe(ref.current);
    return () => {
      window.removeEventListener(GEOM_EVENT, update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [isPresent, mobile, geomRef, px, py, ax, origin]);

  useEffect(() => {
    if (!isPresent) return;
    cardRef.current = ref.current;
    const own = ref.current;
    // Fokus do karty przy każdym kroku (bez przewijania strony)
    const t = requestAnimationFrame(() => (primaryRef.current ?? own)?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(t);
      if (cardRef.current === own) cardRef.current = null;
    };
  }, [isPresent, cardRef]);

  // Klik w przyciemnienie: krótkie „trącenie” — tu się nie da, zostań przy karcie
  useEffect(() => {
    if (!nudge || reduce) return;
    const c = animate(nx, [0, -6, 5, -2, 0], { duration: 0.32, ease: "easeOut" });
    return () => c.stop();
  }, [nudge, reduce, nx]);

  const edgeTop = side === "below" || side === "dock-bottom";
  const body = target?.body ?? step.body;
  const hint = target?.hint;
  const Arrow = edgeTop ? ArrowUp : ArrowDown;
  const titleId = `tour-title-${step.id}`;
  const bodyId = `tour-body-${step.id}`;

  const hidden = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(6px)" };

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      tabIndex={-1}
      className={`tour-material pointer-events-auto fixed left-0 top-0 rounded-2xl p-5 text-[var(--txt)] outline-none ${
        mobile ? "w-[calc(100vw-32px)] max-w-[480px]" : "w-[min(340px,calc(100vw-32px))]"
      }`}
      style={{ x, y: py, transformOrigin: origin }}
      initial={hidden}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: reduce ? { duration: 0.2 } : spring }}
      exit={{ ...hidden, transition: reduce ? { duration: 0.15 } : { type: "spring", bounce: 0, duration: 0.25 } }}
      data-testid="tour-card"
    >
      {side !== "center" && (
        <motion.span className="tour-arrow" data-edge={edgeTop ? "top" : "bottom"} style={{ x: arrowX, rotate: 45 }} aria-hidden="true" />
      )}
      <p className="label label--g">{label}</p>
      <h2 id={titleId} className="mt-2 font-heading text-heading font-medium leading-snug tracking-[-0.012em]">
        {step.title}
      </h2>
      <p id={bodyId} className="mt-1.5 text-sub leading-[1.55] text-[var(--txt2)]">
        {body}
      </p>

      {step.kind === "action" && hint && (
        <p className="mt-4 flex items-center gap-2 text-ui font-medium text-[var(--puls)]" data-testid="tour-hint">
          <motion.span
            className="inline-grid place-items-center"
            animate={reduce ? undefined : { y: edgeTop ? [0, -3, 0] : [0, 3, 0] }}
            transition={{ duration: 1.6, repeat: 2, ease: "easeInOut" }}
            aria-hidden="true"
          >
            <Arrow className="h-4 w-4" />
          </motion.span>
          {hint}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          aria-keyshortcuts="Escape"
          title="Esc"
          className="-ml-1 inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-1 text-note text-[var(--txt2)] transition-[transform,color] duration-100 hover:text-[var(--txt)] active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--puls)]"
          data-testid="tour-skip"
        >
          Pomiń instrukcję
        </button>
        <div className="flex items-center gap-1">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} data-testid="tour-back">
              Wstecz
            </Button>
          )}
          <Button
            ref={primaryRef}
            size="sm"
            variant={step.kind === "action" ? "outline" : "default"}
            onClick={onNext}
            data-testid="tour-next"
          >
            {step.primary ?? "Dalej"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ───────────────────────── instrukcja ───────────────────────── */

function Tour({ userId }: { userId: string }) {
  const [path, navigate] = useLocation();
  const reduce = !!useReducedMotion();
  const mobile = useIsMobile();
  const [index, setIndex] = useState<number | null>(() => {
    const saved = readTour(userId);
    return typeof saved === "number" && saved < TOUR_STEPS.length ? saved : null;
  });
  const [phase, setPhase] = useState<"seek" | "show">("seek");
  const [ti, setTi] = useState(0);
  const [nudge, setNudge] = useState(0);
  const active = index !== null;
  const step = active ? TOUR_STEPS[index] : null;
  const routeOk = !step?.route || step.route(path);
  const quiet = isQuietRoute(path);
  const paused = active && (!routeOk || quiet);
  const visible = active && !paused;

  const { data: modules } = useModules(active);
  const lectureRef = useRef<string | null>(null);
  const pendingBack = useRef<number | null>(null);
  const geomRef = useRef<Rect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  /* wycięcie: x, y, w, h — każda oś osobno, zawsze od bieżącej wartości */
  const hx = useMotionValue(0);
  const hy = useMotionValue(0);
  const hw = useMotionValue(0);
  const hh = useMotionValue(0);
  const holeKey = useRef<unknown>(null);
  const holeGoal = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const holeAnim = useRef<Partial<Record<keyof Rect, AnimationPlaybackControls | null>>>({});

  const driveHole = useCallback(
    (rect: Rect, key: unknown) => {
      const changed = key !== holeKey.current;
      holeKey.current = key;
      const mvs: Record<keyof Rect, MotionValue<number>> = { x: hx, y: hy, w: hw, h: hh };
      (Object.keys(mvs) as (keyof Rect)[]).forEach((k) => {
        const mv = mvs[k];
        const v = rect[k];
        if (reduce) {
          holeAnim.current[k]?.stop();
          holeAnim.current[k] = null;
          mv.set(v);
        } else if (changed) {
          holeAnim.current[k]?.stop();
          const c = animate(mv, v, holeSpring);
          holeAnim.current[k] = c;
          c.then(() => {
            if (holeAnim.current[k] === c) holeAnim.current[k] = null;
          });
        } else if (Math.abs(holeGoal.current[k] - v) > 0.5) {
          const running = holeAnim.current[k];
          if (running) {
            // W trakcie ruchu cel się przesunął: nowy cel, ta sama prędkość
            running.stop();
            const c = animate(mv, v, holeSpring);
            holeAnim.current[k] = c;
            c.then(() => {
              if (holeAnim.current[k] === c) holeAnim.current[k] = null;
            });
          } else {
            mv.set(v); // spoczynek: śledzenie 1:1 (przewijanie)
          }
        }
        holeGoal.current[k] = v;
      });
    },
    [hx, hy, hw, hh, reduce],
  );

  const holeBottom = useTransform([hy, hh] as MotionValue<number>[], ([y, h]: number[]) => y + h);
  const holeRight = useTransform([hx, hw] as MotionValue<number>[], ([x, w]: number[]) => x + w);
  const topH = useTransform(hy, (v) => Math.max(0, v));
  const leftW = useTransform(hx, (v) => Math.max(0, v));

  /* przejścia */
  const finish = useCallback(() => {
    setIndex(null);
    saveTourDone(userId);
  }, [userId]);

  const go = useCallback(
    (i: number) => {
      if (i >= TOUR_STEPS.length) {
        finish();
        return;
      }
      setIndex(i);
      setPhase("seek");
      saveTourStep(userId, i);
    },
    [userId, finish],
  );

  const begin = useCallback(
    (i: number) => {
      const c = centerRect();
      [hx, hy, hw, hh].forEach((mv, n) => mv.set([c.x, c.y, c.w, c.h][n]));
      holeKey.current = "center";
      holeGoal.current = c;
      go(i);
    },
    [go, hx, hy, hw, hh],
  );

  /** Brak celu: krok-działanie, którego nie da się zrobić, przeskakuje całą ścieżkę trasy */
  const skip = useCallback(() => {
    if (index === null) return;
    if (TOUR_STEPS[index].kind === "action") {
      const j = TOUR_STEPS.findIndex((s, n) => n > index && !s.route);
      go(j === -1 ? TOUR_STEPS.length : j);
    } else {
      go(index + 1);
    }
  }, [index, go]);

  const goRef = useRef(go);
  const skipRef = useRef(skip);
  goRef.current = go;
  skipRef.current = skip;

  // Pierwsze logowanie: raz na użytkownika, tylko na panelu postępu (nie w quizie, nie w adminie)
  useEffect(() => {
    if (index !== null || path !== "/dashboard" || readTour(userId) !== null) return;
    const t = window.setTimeout(() => begin(0), 600);
    return () => window.clearTimeout(t);
  }, [index, path, userId, begin]);

  // „Obejrzyj instrukcję jeszcze raz”
  useEffect(() => {
    const restart = () => begin(0);
    window.addEventListener(TOUR_EVENT, restart);
    return () => window.removeEventListener(TOUR_EVENT, restart);
  }, [begin]);

  // Krok-działanie zrobiony zmianą trasy (Kurs → /modules, temat → /lecture/:id)
  useEffect(() => {
    if (isLecturePath(path)) lectureRef.current = path;
    if (index === null) return;
    const back = pendingBack.current;
    if (back !== null) {
      // trwa cofanie na inną stronę — czekamy, aż trasa będzie właściwa dla kroku docelowego
      if (TOUR_STEPS[back].route?.(path) ?? true) {
        pendingBack.current = null;
        go(back);
      }
      return;
    }
    const st = TOUR_STEPS[index];
    if (st.kind === "action" && st.done?.(path)) go(index + 1);
  }, [path, index, go]);

  /* szukanie celu → przewinięcie → stabilny → pokazanie (klatka po klatce, najwyżej SEEK_MS);
     potem śledzenie sterowane zdarzeniami: przewijanie, zmiana rozmiaru, ResizeObserver,
     MutationObserver — każde z nich daje TAIL_MS klatek, potem pętla staje */
  useEffect(() => {
    if (index === null || paused) return;
    const st = TOUR_STEPS[index];
    setPhase("seek");
    const s = { start: performance.now(), scrolledAt: 0, stable: 0, prev: null as Rect | null, skipSince: 0, tries: 0 };
    let shown = false;
    let lastTi = -1;
    let raf = 0;
    let until = 0;
    let stopped = false;
    let lastGeom: Rect | null = null;
    let observed: HTMLElement | null = null;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => kick()) : null;

    const checkDone = () => {
      if (stopped || st.kind !== "action" || !st.done?.(window.location.pathname)) return false;
      stopped = true;
      cancelAnimationFrame(raf);
      goRef.current(index + 1);
      return true;
    };
    // <details> otwarty kliknięciem (zdarzenie toggle nie bąbelkuje — łapiemy w fazie przechwytywania)
    const onToggle = () => checkDone();
    document.addEventListener("toggle", onToggle, true);

    const publish = (rect: Rect | null) => {
      geomRef.current = rect;
      if (rect && lastGeom && sameRect(lastGeom, rect)) return;
      if (!rect && !lastGeom) return;
      lastGeom = rect;
      window.dispatchEvent(new CustomEvent(GEOM_EVENT));
    };

    const tick = () => {
      if (stopped) return;
      if (checkDone()) return;
      const now = performance.now();
      const found = st.targets ? resolveTarget(st) : null;
      const el = found?.el ?? null;
      targetRef.current = el;
      if (ro && el !== observed) {
        if (observed) ro.unobserve(observed);
        if (el) ro.observe(el);
        observed = el;
      }
      if (found && found.ti !== lastTi) {
        lastTi = found.ti;
        setTi(found.ti);
      }
      const rect = el ? paddedRect(el) : centerRect();

      if (!shown) {
        if (st.targets && !el) {
          if (st.skipIf?.()) s.skipSince ||= now;
          else s.skipSince = 0;
          if (now - s.start > SEEK_MS || (s.skipSince && now - s.skipSince > SKIP_MS)) {
            stopped = true;
            cancelAnimationFrame(raf);
            skipRef.current();
          }
          return;
        }
        if (el && !s.scrolledAt) {
          s.scrolledAt = now;
          if (needsScroll(el)) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        }
        s.stable = sameRect(s.prev, rect) ? s.stable + 1 : 0;
        s.prev = rect;
        // Układ zmienił się w trakcie przewijania (np. rozwinięty moduł doładował treść) albo
        // przeglądarka przerwała płynne przewijanie — cel nadal poza ekranem: jeszcze raz
        if (el && s.stable >= 6 && s.tries < 3 && needsScroll(el)) {
          s.tries += 1;
          s.stable = 0;
          s.scrolledAt = now;
          el.scrollIntoView({ block: "center", behavior: reduce || s.tries > 1 ? "auto" : "smooth" });
          return;
        }
        if (!el || (s.stable >= 6 && now - s.scrolledAt > 120)) {
          shown = true;
          until = now + TAIL_MS;
          publish(el ? rect : null);
          driveHole(rect, el ?? "center");
          setPhase("show");
        }
        return;
      }

      if (st.targets && !el) {
        // Cel zniknął (np. zamknięte menu) — szukamy od nowa, wycięcie zostaje na miejscu
        shown = false;
        Object.assign(s, { start: now, scrolledAt: 0, stable: 0, prev: null, skipSince: 0, tries: 0 });
        setPhase("seek");
        return;
      }
      publish(el ? rect : null);
      driveHole(rect, el ?? "center");
    };

    // Szukanie biegnie co klatkę; pokazany cel — tylko w „ogonie” po zdarzeniu
    function loop() {
      raf = 0;
      if (stopped) return;
      tick();
      if (stopped) return;
      if (!shown || performance.now() < until) raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (stopped) return;
      until = Math.max(until, performance.now() + TAIL_MS);
      if (!raf) raf = requestAnimationFrame(loop);
    }

    const opts = { passive: true, capture: true } as const;
    window.addEventListener("scroll", kick, opts);
    window.addEventListener("resize", kick);
    window.visualViewport?.addEventListener("resize", kick);
    window.visualViewport?.addEventListener("scroll", kick);
    ro?.observe(document.body);
    // Zmiany DOM (rozwinięty moduł, zamknięte menu). Bez atrybutu style — animacje pisałyby go co klatkę.
    const mo = new MutationObserver(() => kick());
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "open", "hidden", "aria-expanded", "data-state"],
    });
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener("toggle", onToggle, true);
      window.removeEventListener("scroll", kick, opts);
      window.removeEventListener("resize", kick);
      window.visualViewport?.removeEventListener("resize", kick);
      window.visualViewport?.removeEventListener("scroll", kick);
      ro?.disconnect();
      mo.disconnect();
    };
  }, [index, paused, reduce, driveHole]);

  /* klawiatura: Enter = Dalej, Esc = pomiń, Tab krąży karta ↔ cel */
  useEffect(() => {
    if (!visible || !step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish();
        return;
      }
      if (phase !== "show") return;
      const activeEl = document.activeElement as HTMLElement | null;
      const card = cardRef.current;
      const target = targetRef.current;
      const inCard = !!(card && activeEl && card.contains(activeEl));
      const inTarget = !!(target && activeEl && target.contains(activeEl));
      if (e.key === "Enter" && step.kind === "info" && !inCard && !inTarget) {
        e.preventDefault();
        goRef.current((index ?? 0) + 1);
        return;
      }
      if (e.key === "Tab" && card) {
        const list = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
        const tf = focusableIn(target);
        if (tf) list.push(tf);
        if (!list.length) return;
        e.preventDefault();
        const at = inTarget && tf ? list.length - 1 : list.indexOf(activeEl as HTMLElement);
        const next = at === -1 ? 0 : (at + (e.shiftKey ? -1 : 1) + list.length) % list.length;
        list[next].focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [visible, step, phase, index, finish]);

  const hrefFor = (st: (typeof TOUR_STEPS)[number]) =>
    st.resume === "modules"
      ? "/modules"
      : st.resume === "lecture"
        ? lectureRef.current ?? firstLectureHref(modules)
        : "/dashboard";

  const resume = () => {
    if (!step) return;
    navigate(hrefFor(step));
  };

  /* „Wstecz” na każdym kroku po powitaniu. Gdy poprzedni krok jest na innej stronie, najpierw tam
     przechodzimy, a krok włączamy dopiero po zmianie trasy — inaczej krok-działanie uznałby się
     za zrobiony od razu (np. „Otwórz wykład”, gdy jesteśmy jeszcze w wykładzie) i przeskoczył dalej. */
  const goBack = () => {
    if (index === null || index < 2) return;
    const i = index - 1;
    const p = TOUR_STEPS[i];
    if (p.route && !p.route(path)) {
      pendingBack.current = i;
      navigate(hrefFor(p));
    } else {
      p.undo?.();
      go(i);
    }
  };
  const canBack = index !== null && index >= 2;

  /* „Dalej” w kroku-działaniu robi to, o co prosimy (kursant może też kliknąć sam).
     Krok sam się zaliczy, gdy zmieni się trasa albo rozwinie moduł. */
  const doNext = () => {
    if (index === null || !step) return;
    if (step.kind !== "action") return go(index + 1);
    if (step.id === "nav-kurs") return navigate("/modules");
    if (step.id === "module-first") {
      const d = document.querySelector('[data-tour="module-first"]')?.parentElement as HTMLDetailsElement | null;
      if (d) d.open = true;
      return;
    }
    if (step.id === "section-first-lecture") {
      const a = document.querySelector<HTMLAnchorElement>('[data-tour="section-first-lecture"]');
      const href = a?.getAttribute("href") ?? firstLectureHref(modules);
      return navigate(href);
    }
    go(index + 1);
  };
  const target = step?.targets?.[ti];
  const hasHole = !!step?.targets && phase === "show";
  const label = index ? `Instrukcja · ${index} / ${TOUR_STEPS.length - 1}` : "Instrukcja";
  const announce =
    visible && phase === "show" && step
      ? `${label}. ${step.title}. ${target?.body ?? step.body}${step.kind === "action" && target?.hint ? ` ${target.hint}.` : ""}`
      : "";

  const block = (e: React.PointerEvent) => {
    e.preventDefault();
    setNudge((n) => n + 1);
  };

  return (
    <>
      <style>{TOUR_CSS}</style>
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      <AnimatePresence>
        {visible && step && (
          <motion.div
            key="tour"
            className="pointer-events-none fixed inset-0 z-[70]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: "easeOut" }}
            data-testid="tour"
          >
            <motion.div className="tour-hole" style={{ x: hx, y: hy, width: hw, height: hh }} aria-hidden="true">
              {/* Stała ramka na każdym kroku — na ciemnym tle samo przyciemnienie nie wystarcza, żeby było widać, co jest wskazane */}
              {hasHole && <div className="tour-frame" />}
              {hasHole && step.kind === "action" && (
                <motion.div
                  className="tour-ring"
                  initial={{ opacity: 0 }}
                  // Trzy „oddechy” i spoczynek w pełnym kolorze — bez nieskończonej pętli
                  animate={reduce ? { opacity: 0.8 } : { opacity: [0.3, 1, 0.3, 1, 0.3, 1] }}
                  transition={reduce ? { duration: 0.2 } : { duration: 6, ease: "easeInOut" }}
                />
              )}
            </motion.div>

            {/* Reszta ekranu nie przyjmuje kliknięć; wycięcie — tak (cel zostaje klikalny) */}
            <motion.div className="pointer-events-auto fixed left-0 right-0 top-0" style={{ height: topH }} onPointerDown={block} />
            <motion.div className="pointer-events-auto fixed bottom-0 left-0 right-0" style={{ top: holeBottom }} onPointerDown={block} />
            <motion.div className="pointer-events-auto fixed left-0" style={{ top: hy, height: hh, width: leftW }} onPointerDown={block} />
            <motion.div className="pointer-events-auto fixed right-0" style={{ top: hy, height: hh, left: holeRight }} onPointerDown={block} />
            {/* Krok informacyjny: podświetlony element tylko pokazujemy — kliknięcie w niego nie może
                wyprowadzić z instrukcji (np. „Kontynuuj” → quiz). Klikalny jest tylko w krokach-działaniach. */}
            {step?.kind !== "action" && (
              <motion.div
                className="pointer-events-auto fixed left-0 top-0"
                style={{ x: hx, y: hy, width: hw, height: hh }}
                onPointerDown={block}
                onClick={(e) => e.preventDefault()}
              />
            )}

            <AnimatePresence>
              {phase === "show" && (
                <CoachCard
                  key={index}
                  step={step}
                  target={target}
                  label={label}
                  geomRef={geomRef}
                  cardRef={cardRef}
                  mobile={mobile}
                  reduce={reduce}
                  nudge={nudge}
                  onNext={doNext}
                  onBack={canBack ? goBack : null}
                  onSkip={finish}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pauza poza trasą kroku: mała pigułka, którą łatwo zignorować albo zamknąć */}
      <AnimatePresence>
        {paused && !quiet && (
          <motion.div
            key="tour-pill"
            className="tour-material fixed z-[60] flex items-center rounded-full py-1 pl-1 pr-1 text-ui"
            style={{
              left: "max(16px, calc(env(safe-area-inset-left) + 12px))",
              bottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))",
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={spring}
            data-testid="tour-pill"
          >
            <button
              type="button"
              onClick={resume}
              className="inline-flex h-11 items-center rounded-full px-4 font-medium text-[var(--txt)] transition-transform duration-100 active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--puls)]"
            >
              Wróć do instrukcji
            </button>
            <button
              type="button"
              onClick={finish}
              aria-label="Zakończ instrukcję"
              className="grid h-11 w-11 place-items-center rounded-full text-[var(--txt2)] transition-[transform,color] duration-100 hover:text-[var(--txt)] active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--puls)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Usterka instrukcji nie może zabrać aplikacji — wtedy po prostu jej nie ma */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function TourRoot({ userId }: { userId: string }) {
  return (
    <Quiet>
      <Tour userId={userId} />
    </Quiet>
  );
}
