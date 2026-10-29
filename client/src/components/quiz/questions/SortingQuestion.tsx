import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { rubberband, spring, springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { SortingConfig, AnswerData, QuizResult } from "@/types";
import {
  DRAG_THRESHOLD,
  HOLD_MS,
  HOLD_SLOP,
  blockTouchScrollWhile,
  createAutoScroll,
  dragStartMode,
  pushSample,
  releaseVelocity,
  withVelocity,
  vt,
  type AutoScroll,
  type Sample,
} from "./gesture";
import PartialScore from "./PartialScore";

interface SortingQuestionProps {
  config: SortingConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

function getItemText(item: { id: string; text?: string; content?: string }): string {
  if (typeof item.content === "string") return item.content;
  if (typeof item.text === "string") return item.text;
  return item.id;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/**
 * Sortowanie: wiersz chwycony po 10 px śledzi palec 1:1 w pionie (w poziomie i za krańcami listy
 * — gumowo), sąsiedzi rozstępują się sprężyną, a po puszczeniu wiersz wpada na swoje miejsce
 * z prędkością gestu. Strzałki przy wierszu to alternatywa dla dotyku i klawiatury.
 * Dotyk: wiersz przewija stronę (pan-y); przeciąga się za uchwyt albo po przytrzymaniu ~200 ms.
 * Przy krawędzi ekranu strona przewija się sama, a wiersz zostaje pod palcem.
 */
export default function SortingQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: SortingQuestionProps) {
  const reduce = useReducedMotion();
  const [items, setItems] = useState<string[]>(() => {
    const shuffled = [...config.items.map((i) => i.id)];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const listRef = useRef<HTMLOListElement>(null);
  const rowEls = useRef(new Map<string, HTMLLIElement>());
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const dragScale = useMotionValue(1);
  const g = useRef<{
    id: string;
    sx: number;
    sy: number;
    /** Ostatnia pozycja wskaźnika — auto-przewijanie przelicza z niej położenie bez ruchu palca */
    lx: number;
    ly: number;
    by: number;
    top: number;
    pid: number;
    mode: "threshold" | "hold";
    active: boolean;
    /** Złapany w trakcie własnego powrotu — przy rezygnacji trzeba go dowieźć na miejsce */
    caught: boolean;
    hold: ReturnType<typeof setTimeout> | null;
    /** Przestawiono — czekamy, aż układ się odświeży, zanim policzymy kolejne miejsce */
    pending: boolean;
    hist: Sample[];
  } | null>(null);
  const scroller = useRef<AutoScroll | null>(null);
  /** Słuchacze okna dodane przy chwycie — zdejmujemy dokładnie te same */
  const handlers = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(null);

  const getItemById = (itemId: string) => config.items.find((i) => i.id === itemId);

  const commit = (next: string[]) => {
    setItems(next);
    onChange({ type: "sorting", order: next });
  };

  // Po przestawieniu w trakcie gestu wiersz zmienia miejsce w układzie — przesunięcie
  // kompensujemy, żeby dalej był dokładnie pod palcem
  useLayoutEffect(() => {
    const d = g.current;
    if (!d || !d.active) return;
    const el = rowEls.current.get(d.id);
    if (!el) return;
    d.pending = false;
    const delta = el.offsetTop - d.top;
    if (delta !== 0) {
      d.top = el.offsetTop;
      d.by -= delta;
      dragY.set(dragY.get() - delta);
    }
  }, [items, dragY]);

  // Kolejność startowa też jest odpowiedzią — „Sprawdź” aktywny od razu, nawet jeśli losowanie
  // dało już dobry układ (inaczej nie dałoby się go wysłać bez ruszania czegokolwiek)
  useEffect(() => {
    if (!disabled) onChange({ type: "sorting", order: items });
    // tylko przy pierwszym wyświetleniu pytania
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Palec po podniesieniu wiersza nie przewija strony (wiersz ma touch-action: pan-y)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    return blockTouchScrollWhile(list, () => !!g.current?.active);
  }, []);

  useEffect(
    () => () => {
      const d = g.current;
      if (d?.hold) clearTimeout(d.hold);
      scroller.current?.stop();
      const h = handlers.current;
      if (h) {
        window.removeEventListener("pointermove", h.move);
        window.removeEventListener("pointerup", h.up);
        window.removeEventListener("pointercancel", h.up);
      }
    },
    [],
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;

  /** Pozycja przeciąganego wiersza z ostatniego punktu wskaźnika + nowe miejsce na liście */
  const track = () => {
    const d = g.current;
    const list = listRef.current;
    if (!d || !d.active || !list) return;
    const el = rowEls.current.get(d.id);
    if (!el) return;
    const dx = d.lx - d.sx;
    const dy = d.ly - d.sy;
    // Pion 1:1, za krańcami listy gumowo; poziom tylko lekko, gumowo
    const minY = -el.offsetTop;
    const maxY = list.clientHeight - el.offsetTop - el.offsetHeight;
    const raw = d.by + dy;
    const yy = raw < minY ? minY + rubberband(raw - minY, 160) : raw > maxY ? maxY + rubberband(raw - maxY, 160) : raw;
    dragY.set(yy);
    dragX.set(rubberband(dx, 80));

    if (d.pending) return;
    // Nowe miejsce: ile pozostałych wierszy ma środek powyżej środka przeciąganego
    const current = itemsRef.current;
    const center = el.offsetTop + yy + el.offsetHeight / 2;
    let target = 0;
    current.forEach((id) => {
      if (id === d.id) return;
      const r = rowEls.current.get(id);
      if (r && r.offsetTop + r.offsetHeight / 2 < center) target++;
    });
    const from = current.indexOf(d.id);
    if (target !== from) {
      const next = arrayMove(current, from, target);
      itemsRef.current = next;
      d.pending = true;
      setItems(next);
    }
  };

  /** Podniesienie wiersza: od progu (mysz, uchwyt) albo po przytrzymaniu (dotyk) */
  const lift = () => {
    const d = g.current;
    if (!d || d.active) return;
    d.active = true;
    if (d.hold) clearTimeout(d.hold);
    d.hold = null;
    setActiveId(d.id);
    animate(dragScale, 1.02, vt(springSnappy));
    if (d.mode === "hold") navigator.vibrate?.(8);
    const list = listRef.current;
    if (list) {
      // Przy krawędzi ekranu strona przewija się sama; przesunięcie dodajemy do pozycji wiersza
      scroller.current = createAutoScroll(list, (moved) => {
        const cur = g.current;
        if (!cur) return;
        cur.sy -= moved;
        track();
      });
    }
  };

  /** Wiersz wraca na swoje miejsce z prędkością gestu (albo od razu przy „Ogranicz ruch”) */
  const settle = (id: string, vy: number) => {
    const done = () => setActiveId((cur) => (cur === id && !g.current ? null : cur));
    if (reduce) {
      dragX.set(0);
      dragY.set(0);
      dragScale.set(1);
      done();
      return;
    }
    animate(dragX, 0, withVelocity(0));
    animate(dragScale, 1, vt(springSnappy));
    animate(dragY, 0, { ...withVelocity(vy), onComplete: done });
  };

  const endGesture = () => {
    const d = g.current;
    g.current = null;
    if (d?.hold) clearTimeout(d.hold);
    scroller.current?.stop();
    scroller.current = null;
    const h = handlers.current;
    handlers.current = null;
    if (h) {
      window.removeEventListener("pointermove", h.move);
      window.removeEventListener("pointerup", h.up);
      window.removeEventListener("pointercancel", h.up);
    }
    return d;
  };

  // Ruch i puszczenie słuchamy na oknie: wiersze zmieniają kolejność w DOM w trakcie gestu,
  // a przeniesienie węzła mogłoby zerwać przechwycenie wskaźnika.
  function onMove(e: PointerEvent) {
    const d = g.current;
    if (!d || e.pointerId !== d.pid) return;
    pushSample(d.hist, { t: e.timeStamp, x: e.clientX, y: e.clientY });
    d.lx = e.clientX;
    d.ly = e.clientY;
    if (!d.active) {
      const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
      if (d.mode === "hold") {
        // Palec ruszył przed przytrzymaniem — to przewijanie, nie przeciąganie
        if (dist > HOLD_SLOP) {
          endGesture();
          if (d.caught) settle(d.id, 0);
        }
        return;
      }
      if (dist < DRAG_THRESHOLD) return;
      lift();
    }
    e.preventDefault();
    track();
    scroller.current?.update(e.clientY);
  }

  function onUp(e: PointerEvent) {
    const cur = g.current;
    if (!cur || e.pointerId !== cur.pid) return;
    const d = endGesture()!;
    if (!d.active) {
      if (d.caught) settle(d.id, 0);
      return;
    }
    const v = releaseVelocity(d.hist, { t: e.timeStamp, x: e.clientX, y: e.clientY });
    onChange({ type: "sorting", order: itemsRef.current });
    settle(d.id, v.vy);
  }

  const onPointerDown = (id: string) => (e: React.PointerEvent<HTMLLIElement>) => {
    if (disabled || e.button !== 0 || g.current) return;
    const el = rowEls.current.get(id);
    if (!el) return;
    const settling = activeIdRef.current;
    if (settling && settling !== id) {
      // Inny wiersz jeszcze wraca na miejsce: kończymy jego powrót od razu (bez czekania)
      // i bierzemy nowy — dotyk nigdy nie jest zablokowany przez animację
      dragX.stop();
      dragY.stop();
      dragScale.stop();
      dragX.set(0);
      dragY.set(0);
      dragScale.set(1);
      activeIdRef.current = null;
      setActiveId(null);
    }
    dragX.stop();
    dragY.stop();
    const caught = settling === id; // złapany ponownie w trakcie powrotu — od bieżącej pozycji
    const mode = dragStartMode(e);
    g.current = {
      id,
      sx: e.clientX,
      sy: e.clientY,
      lx: e.clientX,
      ly: e.clientY,
      by: caught ? dragY.get() : 0,
      top: el.offsetTop,
      pid: e.pointerId,
      mode,
      active: false,
      caught,
      hold: null,
      pending: false,
      hist: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
    };
    if (!caught) {
      dragX.set(0);
      dragY.set(0);
    }
    if (mode === "hold") {
      const d = g.current;
      d.hold = setTimeout(() => {
        if (g.current === d && !d.active) lift();
      }, HOLD_MS);
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* gest działa i bez przechwycenia */
    }
    handlers.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const nudge = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    commit(arrayMove(items, index, to));
  };

  return (
    <div className="grid gap-5">
      <ol ref={listRef} className="relative grid gap-2.5" data-testid="sorting-items" aria-label="Kolejność">
        {items.map((itemId, index) => {
          const item = getItemById(itemId);
          if (!item) return null;
          const isCorrect = showResult && result?.feedback?.correctItems?.includes(itemId);
          const isIncorrect = showResult && result?.feedback?.incorrectItems?.includes(itemId);
          const isActive = activeId === itemId;
          const text = getItemText(item);
          return (
            <motion.li
              key={itemId}
              ref={(el: HTMLLIElement | null) => {
                if (el) rowEls.current.set(itemId, el);
                else rowEls.current.delete(itemId);
              }}
              layout={isActive ? false : "position"}
              transition={spring}
              style={isActive ? { x: dragX, y: dragY, scale: dragScale, zIndex: 40 } : { zIndex: 1 }}
              onPointerDown={onPointerDown(itemId)}
              data-testid={`sortable-item-${itemId}`}
              className={cn(
                "relative grid select-none grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-lg border bg-[var(--panel)] py-2 pl-4 pr-1.5 text-sub leading-snug transition-[border-color,background-color,color] duration-200",
                disabled ? "cursor-default" : "cursor-grab touch-pan-y touch-pinch-zoom [-webkit-touch-callout:none] active:cursor-grabbing",
                isCorrect && "border-[var(--puls-deep)] bg-[var(--tint)]",
                isIncorrect && "border-[color-mix(in_srgb,var(--alarm)_55%,transparent)] text-[var(--txt2)]",
                !isCorrect && !isIncorrect && (isActive ? "border-[var(--txt3)]" : "border-[var(--line2)] hover:border-[var(--txt3)]"),
              )}
            >
              <span
                className={cn(
                  "grid h-[30px] w-[30px] place-items-center rounded-sm border font-mono text-meta font-medium",
                  isCorrect ? "border-[var(--puls-deep)] text-[var(--puls)]" : "border-[var(--line2)] text-[var(--txt2)]",
                )}
              >
                {index + 1}
              </span>
              <span className="flex min-h-[40px] min-w-0 items-center gap-3">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt=""
                    draggable={false}
                    className="h-10 w-10 shrink-0 rounded-sm border border-[var(--line)] object-cover"
                  />
                )}
                <span className="min-w-0">{text}</span>
              </span>
              <span className="flex items-center">
                {isCorrect && <Check className="mx-2.5 h-4 w-4 text-[var(--puls)]" aria-label="Dobre miejsce" />}
                {isIncorrect && <X className="mx-2.5 h-4 w-4 text-[var(--alarm)]" aria-label="Złe miejsce" />}
                {!disabled && (
                  <>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => nudge(index, -1)}
                      disabled={index === 0}
                      aria-label={`Przesuń „${text}” wyżej`}
                      className="grid h-11 w-11 place-items-center rounded-sm text-[var(--label)] transition-[color,transform] duration-150 hover:text-[var(--txt)] active:scale-[.92] disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => nudge(index, 1)}
                      disabled={index === items.length - 1}
                      aria-label={`Przesuń „${text}” niżej`}
                      className="grid h-11 w-11 place-items-center rounded-sm text-[var(--label)] transition-[color,transform] duration-150 hover:text-[var(--txt)] active:scale-[.92] disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {/* Uchwyt: na dotyku przeciąga od razu (bez przytrzymania), strony tu nie przewija */}
                    <span
                      data-drag-handle
                      aria-hidden
                      className="grid h-11 w-11 shrink-0 touch-none place-items-center rounded-sm text-[var(--label)]"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  </>
                )}
              </span>
            </motion.li>
          );
        })}
      </ol>

      {!disabled && (
        <p className="text-ui text-[var(--txt2)]">
          Przeciągnij wiersz za uchwyt (albo przytrzymaj go chwilę) lub użyj strzałek, aby ułożyć elementy od pierwszego do ostatniego.
        </p>
      )}

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <PartialScore
          score={result.partialScore}
          correct={result.feedback?.correctItems?.length}
          total={config.items.length}
          noun="na dobrym miejscu"
        />
      )}

      {showResult && result?.correctAnswer?.type === "sorting" && (
        <div className="grid gap-3 border-t border-[var(--line)] pt-4">
          <p className="label">Poprawna kolejność</p>
          <ol className="grid gap-1.5">
            {result.correctAnswer.order.map((itemId: string, i: number) => {
              const item = getItemById(itemId);
              return (
                <li key={itemId} className="grid grid-cols-[30px_minmax(0,1fr)] items-baseline gap-3.5 text-sub text-[var(--txt)]">
                  <span className="font-mono text-meta text-[var(--label)]">{String(i + 1).padStart(2, "0")}</span>
                  <span>{item ? getItemText(item) : itemId}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
