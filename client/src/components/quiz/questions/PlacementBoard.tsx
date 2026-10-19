/**
 * Plansza „element → miejsce” wspólna dla przeciągania (drag & drop) i dopasowywania par.
 *
 * Gest (Pointer Events + setPointerCapture):
 * - naciśnięcie: element od razu lekko się wciska (reakcja przy dotknięciu),
 * - 10 px zwłoki, potem element śledzi palec 1:1 od miejsca chwytu i unosi się (skala 1.02 + linia);
 *   na dotyku element przewija stronę (pan-y) — podnosi się za uchwyt albo po przytrzymaniu ~200 ms,
 * - przy krawędzi ekranu strona przewija się sama, a element zostaje pod palcem (dolne miejsca na telefonie),
 * - miejsce docelowe pod palcem podświetla się,
 * - puszczenie nad miejscem: element „wpada” do niego sprężyną z prędkością gestu (FLIP z bieżącej pozycji),
 * - puszczenie poza miejscem: wraca tą samą prostą, którą przyszedł, niosąc składową prędkości.
 * Alternatywa bez gestu (dotyk / klawiatura): wybierz element, potem miejsce — lub odwrotnie.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Check, GripVertical, Undo2, X } from "lucide-react";
import { spring, springMomentum, springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  DRAG_THRESHOLD,
  HOLD_MS,
  HOLD_SLOP,
  blockTouchScrollWhile,
  createAutoScroll,
  dragStartMode,
  pushSample,
  releaseVelocity,
  returnVelocity,
  withVelocity,
  vt,
  type AutoScroll,
  type Sample,
} from "./gesture";

export interface BoardPiece {
  id: string;
  content: string;
  imageUrl?: string;
}

export interface BoardSlot {
  id: string;
  label: string;
  imageUrl?: string;
  /** Po sprawdzeniu: czy element w tym miejscu jest poprawny */
  result?: "right" | "wrong";
  /** Po sprawdzeniu, przy błędzie: poprawna odpowiedź słowami */
  correctText?: string;
}

type Placements = Record<string, string>; // slotId -> pieceId
type Selection = { kind: "piece" | "slot"; id: string } | null;
type Flip = { cx: number; cy: number; vx: number; vy: number; lifted: boolean; thrown: boolean };

interface PlacementBoardProps {
  pieces: BoardPiece[];
  slots: BoardSlot[];
  placements: Placements;
  onPlacementsChange: (next: Placements) => void;
  disabled: boolean;
  showResult: boolean;
  poolLabel: string;
  slotsLabel: string;
  /** data-testid dla elementów — zgodność z dotychczasowymi testami */
  pieceTestId?: (id: string) => string;
  slotTestId?: (id: string) => string;
  poolTestId?: string;
  slotsTestId?: string;
  /** Na szerokim ekranie pula po prawej (np. kolumna B przy dopasowaniu) */
  poolLast?: boolean;
}

const POOL = "__pool__";

export default function PlacementBoard({
  pieces,
  slots,
  placements,
  onPlacementsChange,
  disabled,
  showResult,
  poolLabel,
  slotsLabel,
  pieceTestId,
  slotTestId,
  poolTestId,
  slotsTestId,
  poolLast = false,
}: PlacementBoardProps) {
  const [selection, setSelection] = useState<Selection>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  /** Synchronicznie (bez czekania na render) — blokada przewijania palcem musi zadziałać od razu */
  const draggingRef = useRef<string | null>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const flips = useRef(new Map<string, Flip>());

  // Wszystkie elementy zużyły już swoje FLIP-y (efekty dzieci biegną przed efektem rodzica)
  useLayoutEffect(() => {
    flips.current.clear();
  });

  // Podniesiony element: palec nie przewija strony (elementy mają touch-action: pan-y)
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    return blockTouchScrollWhile(board, () => draggingRef.current !== null);
  }, []);

  // Po sprawdzeniu nic nie jest już wybrane
  useLayoutEffect(() => {
    if (disabled) {
      setSelection(null);
      setHover(null);
    }
  }, [disabled]);

  const placedIn = useCallback(
    (pieceId: string) => Object.keys(placements).find((k) => placements[k] === pieceId) ?? null,
    [placements],
  );

  /** Zapamiętaj, gdzie każdy element jest teraz na ekranie — po zmianie układu poleci stąd */
  const snapshot = (moved?: { id: string; vx: number; vy: number; lifted: boolean }) => {
    els.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      const isMoved = moved?.id === id;
      flips.current.set(id, {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        vx: isMoved ? moved!.vx : 0,
        vy: isMoved ? moved!.vy : 0,
        lifted: isMoved ? moved!.lifted : false,
        thrown: isMoved && moved!.lifted,
      });
    });
  };

  /** Przenieś element do miejsca (albo z powrotem do puli). false = nic się nie zmieniło. */
  const move = (
    pieceId: string,
    dest: string,
    gesture?: { vx: number; vy: number; lifted: boolean },
  ): boolean => {
    const next: Placements = { ...placements };
    const from = placedIn(pieceId);
    if (dest === POOL) {
      if (!from) return false;
      delete next[from];
    } else {
      if (from === dest) return false;
      const occupant = next[dest];
      if (from) delete next[from];
      // Zamiana miejscami, gdy element przyszedł z innego miejsca; inaczej poprzedni wraca do puli
      if (occupant && occupant !== pieceId && from) next[from] = occupant;
      next[dest] = pieceId;
    }
    snapshot(gesture ? { id: pieceId, ...gesture } : undefined);
    onPlacementsChange(next);
    return true;
  };

  /** Co leży pod palcem: id miejsca, pula albo nic (z pominięciem samego przeciąganego elementu) */
  const targetAt = (clientX: number, clientY: number, pieceId: string): string | null => {
    const dragged = els.current.get(pieceId);
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const node of stack) {
      if (dragged && dragged.contains(node)) continue;
      if (!boardRef.current?.contains(node)) continue;
      const slot = (node as HTMLElement).closest<HTMLElement>("[data-slot-id]");
      if (slot) return slot.dataset.slotId ?? null;
      const pool = (node as HTMLElement).closest<HTMLElement>("[data-pool]");
      if (pool) return POOL;
    }
    return null;
  };

  const onPieceTap = (id: string) => {
    if (disabled) return;
    if (selection?.kind === "slot") {
      move(id, selection.id);
      setSelection(null);
      return;
    }
    if (selection?.kind === "piece" && selection.id !== id) {
      const slot = placedIn(id);
      if (slot) {
        move(selection.id, slot);
        setSelection(null);
        return;
      }
    }
    setSelection(selection?.kind === "piece" && selection.id === id ? null : { kind: "piece", id });
  };

  const onSlotTap = (slotId: string) => {
    if (disabled) return;
    if (selection?.kind === "piece") {
      move(selection.id, slotId);
      setSelection(null);
      return;
    }
    setSelection(selection?.kind === "slot" && selection.id === slotId ? null : { kind: "slot", id: slotId });
  };

  const onPoolTap = () => {
    if (disabled || selection?.kind !== "piece") return;
    move(selection.id, POOL);
    setSelection(null);
  };

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const consumeFlip = useCallback((id: string) => {
    const f = flips.current.get(id);
    flips.current.delete(id);
    return f;
  }, []);

  const pieceById = (id: string) => pieces.find((p) => p.id === id);
  const poolPieces = pieces.filter((p) => !placedIn(p.id));

  const renderPiece = (piece: BoardPiece, state?: "right" | "wrong") => (
    <Piece
      key={piece.id}
      piece={piece}
      state={state}
      disabled={disabled}
      selected={selection?.kind === "piece" && selection.id === piece.id}
      testId={pieceTestId?.(piece.id)}
      register={register}
      consumeFlip={consumeFlip}
      onTap={onPieceTap}
      onDragStart={(id) => {
        draggingRef.current = id;
        setSelection(null);
        setDraggingId(id);
      }}
      onDragMove={(id, x, y) => setHover(targetAt(x, y, id))}
      onRelease={(id, x, y, v) => {
        draggingRef.current = null;
        setHover(null);
        setDraggingId(null);
        const dest = targetAt(x, y, id);
        if (!dest) return false;
        return move(id, dest, { ...v, lifted: true });
      }}
      onCancel={() => {
        draggingRef.current = null;
        setHover(null);
        setDraggingId(null);
      }}
    />
  );

  const selectedPiece = selection?.kind === "piece" ? pieceById(selection.id) : undefined;
  const selectedSlot = selection?.kind === "slot" ? slots.find((s) => s.id === selection.id) : undefined;

  return (
    <div ref={boardRef} className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        {/* Pula elementów */}
        <section aria-label={poolLabel} className={cn(poolLast && "md:order-last")}>
          <p className="label mb-3">{poolLabel}</p>
          <div
            data-pool
            data-testid={poolTestId}
            onClick={(e) => {
              if (e.target === e.currentTarget) onPoolTap();
            }}
            className={cn(
              "grid min-h-[68px] content-start gap-2 rounded-[12px] border border-dashed p-2 transition-colors duration-200",
              hover === POOL || (selection?.kind === "piece" && placedIn(selection.id))
                ? "border-[var(--txt3)] bg-[var(--tint)]"
                : "border-[var(--line2)]",
            )}
          >
            {poolPieces.map((p) => renderPiece(p))}
            {poolPieces.length === 0 && (
              <p className="px-3 py-4 text-[.875rem] text-[var(--txt2)]" onClick={onPoolTap}>
                {showResult ? "Wszystkie elementy rozmieszczone." : "Wszystko rozmieszczone. Przeciągnij tu element, aby go odłożyć."}
              </p>
            )}
          </div>
        </section>

        {/* Miejsca docelowe */}
        <section aria-label={slotsLabel} data-testid={slotsTestId}>
          <p className="label mb-3">{slotsLabel}</p>
          <ul className="grid gap-4">
            {slots.map((slot) => {
              const occupantId = placements[slot.id];
              const occupant = occupantId ? pieceById(occupantId) : undefined;
              const isHover = hover === slot.id;
              const isSelected = selection?.kind === "slot" && selection.id === slot.id;
              const awaiting = !disabled && (selection?.kind === "piece" || draggingId) && !occupant;
              return (
                <li key={slot.id} className="grid gap-2">
                  <div className="flex items-center gap-3 text-[.9375rem] leading-snug text-[var(--txt)]">
                    {slot.imageUrl && (
                      <img
                        src={slot.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-[8px] border border-[var(--line)] object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1">{slot.label}</span>
                    {slot.result === "right" && (
                      <span className="inline-flex items-center gap-1 text-[.8125rem] text-[var(--puls)]">
                        <Check className="h-4 w-4" aria-hidden />
                        <span>Dobrze</span>
                      </span>
                    )}
                    {slot.result === "wrong" && (
                      <span className="inline-flex items-center gap-1 text-[.8125rem] text-[var(--alarm)]">
                        <X className="h-4 w-4" aria-hidden />
                        <span>Błąd</span>
                      </span>
                    )}
                  </div>
                  <div
                    data-slot-id={slot.id}
                    data-testid={slotTestId?.(slot.id)}
                    className={cn(
                      "relative flex min-h-[60px] items-stretch gap-2 rounded-[12px] border p-1.5 transition-[border-color,background-color] duration-200",
                      slot.result === "right" && "border-[var(--puls-deep)] bg-[var(--tint)]",
                      slot.result === "wrong" && "border-[color-mix(in_srgb,var(--alarm)_55%,transparent)]",
                      !slot.result && (isHover || isSelected)
                        ? "border-[var(--txt3)] bg-[var(--tint)]"
                        : !slot.result && (occupant ? "border-[var(--line2)]" : "border-dashed border-[var(--line2)]"),
                      !slot.result && awaiting && !isHover && "border-[var(--txt4)]",
                    )}
                  >
                    {occupant ? (
                      <>
                        <div className="min-w-0 flex-1">{renderPiece(occupant, slot.result)}</div>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => {
                              move(occupant.id, POOL);
                              setSelection(null);
                            }}
                            className="grid w-11 shrink-0 place-items-center rounded-[8px] text-[var(--label)] transition-[color,transform] duration-150 hover:text-[var(--txt)] active:scale-[.94]"
                            aria-label={`Odłóż „${occupant.content}” z powrotem`}
                            data-testid={`remove-btn-${slot.id}`}
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onSlotTap(slot.id)}
                        aria-pressed={isSelected}
                        aria-label={`Miejsce: ${slot.label}. ${selectedPiece ? `Wstaw „${selectedPiece.content}”.` : "Puste."}`}
                        className="flex flex-1 items-center justify-center rounded-[8px] px-3 text-[.875rem] text-[var(--txt2)] transition-colors duration-200 hover:text-[var(--txt)] disabled:cursor-default"
                      >
                        {showResult ? "Puste" : selectedPiece ? "Wstaw tutaj" : "Upuść tutaj"}
                      </button>
                    )}
                  </div>
                  {slot.result === "wrong" && slot.correctText && (
                    <p className="text-[.875rem] text-[var(--txt2)]">
                      <span className="label mr-2">Poprawnie</span>
                      {slot.correctText}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {!disabled && (
        <p className="min-h-[1.5em] text-[.875rem] text-[var(--txt2)]" aria-live="polite">
          {selectedPiece
            ? `Wybrano „${selectedPiece.content}”. Wskaż miejsce${placedIn(selectedPiece.id) ? " albo dotknij pulę, aby odłożyć" : ""}.`
            : selectedSlot
              ? `Wybrano miejsce „${selectedSlot.label}”. Wskaż element.`
              : "Przeciągnij element (za uchwyt albo po przytrzymaniu) lub dotknij go, a potem miejsce."}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── element przeciągany ───────────────────────── */

interface PieceProps {
  piece: BoardPiece;
  state?: "right" | "wrong";
  disabled: boolean;
  selected: boolean;
  testId?: string;
  register: (id: string, el: HTMLElement | null) => void;
  consumeFlip: (id: string) => Flip | undefined;
  onTap: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onRelease: (id: string, x: number, y: number, v: { vx: number; vy: number }) => boolean;
  onCancel: () => void;
}

function Piece({
  piece,
  state,
  disabled,
  selected,
  testId,
  register,
  consumeFlip,
  onTap,
  onDragStart,
  onDragMove,
  onRelease,
  onCancel,
}: PieceProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  // Element w ruchu (przeciągany albo w locie do miejsca) jest nad innymi
  const zIndex = useTransform([x, y, scale], ([a, b, s]) =>
    Math.abs(a as number) + Math.abs(b as number) > 0.5 || (s as number) > 1.001 ? 40 : 1,
  );
  const [lifted, setLifted] = useState(false);
  const g = useRef<{
    sx: number;
    sy: number;
    /** Ostatni punkt wskaźnika — auto-przewijanie przelicza z niego pozycję bez ruchu palca */
    lx: number;
    ly: number;
    bx: number;
    by: number;
    pid: number;
    mode: "threshold" | "hold";
    active: boolean;
    hold: ReturnType<typeof setTimeout> | null;
    hist: Sample[];
  } | null>(null);
  const scroller = useRef<AutoScroll | null>(null);

  useEffect(
    () => () => {
      if (g.current?.hold) clearTimeout(g.current.hold);
      scroller.current?.stop();
    },
    [],
  );

  const setRef = useCallback(
    (el: HTMLButtonElement | null) => {
      ref.current = el;
      register(piece.id, el);
    },
    [piece.id, register],
  );

  // FLIP: jeśli układ się zmienił, zacznij z miejsca, w którym element był na ekranie,
  // i dojedź sprężyną (z prędkością gestu, jeśli to on go tu rzucił)
  useLayoutEffect(() => {
    const f = consumeFlip(piece.id);
    const el = ref.current;
    if (!f || !el) return;
    const r = el.getBoundingClientRect();
    const dx = f.cx - (r.left + r.width / 2 - x.get());
    const dy = f.cy - (r.top + r.height / 2 - y.get());
    if (f.lifted) scale.set(1.02);
    if (reduce) {
      x.set(0);
      y.set(0);
      scale.set(1);
      return;
    }
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      x.set(dx);
      y.set(dy);
      const base = f.thrown ? springMomentum : spring;
      animate(x, 0, withVelocity(f.vx, base));
      animate(y, 0, withVelocity(f.vy, base));
    }
    animate(scale, 1, vt(springSnappy));
  });

  const settleBack = (vx = 0, vy = 0) => {
    const rv = returnVelocity(x.get(), y.get(), vx, vy);
    if (reduce) {
      x.set(0);
      y.set(0);
    } else {
      animate(x, 0, withVelocity(rv.vx));
      animate(y, 0, withVelocity(rv.vy));
    }
    animate(scale, 1, vt(springSnappy));
  };

  /** Pozycja 1:1 od miejsca chwytu z ostatniego punktu wskaźnika */
  const track = () => {
    const d = g.current;
    if (!d || !d.active) return;
    x.set(d.bx + d.lx - d.sx);
    y.set(d.by + d.ly - d.sy);
    onDragMove(piece.id, d.lx, d.ly);
  };

  /** Podniesienie: od progu (mysz, uchwyt) albo po przytrzymaniu (dotyk) */
  const lift = () => {
    const d = g.current;
    if (!d || d.active) return;
    d.active = true;
    if (d.hold) clearTimeout(d.hold);
    d.hold = null;
    setLifted(true);
    onDragStart(piece.id);
    animate(scale, 1.02, vt(springSnappy));
    if (d.mode === "hold") navigator.vibrate?.(8);
    if (ref.current) {
      // Przy krawędzi ekranu strona przewija się sama — przesunięcie dodajemy do pozycji elementu
      scroller.current = createAutoScroll(ref.current, (moved) => {
        const cur = g.current;
        if (!cur) return;
        cur.sy -= moved;
        track();
      });
    }
  };

  const endGesture = () => {
    const d = g.current;
    g.current = null;
    if (d?.hold) clearTimeout(d.hold);
    scroller.current?.stop();
    scroller.current = null;
    return d;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0 || g.current) return;
    x.stop();
    y.stop();
    const mode = dragStartMode(e);
    const d = {
      sx: e.clientX,
      sy: e.clientY,
      lx: e.clientX,
      ly: e.clientY,
      bx: x.get(),
      by: y.get(),
      pid: e.pointerId,
      mode,
      active: false,
      hold: null as ReturnType<typeof setTimeout> | null,
      hist: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
    };
    g.current = d;
    if (mode === "hold") {
      d.hold = setTimeout(() => {
        if (g.current === d && !d.active) lift();
      }, HOLD_MS);
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* brak wsparcia — gest działa dalej bez przechwycenia */
    }
    // Reakcja od razu przy dotknięciu
    animate(scale, 0.98, { duration: 0.1, ease: "easeOut" });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = g.current;
    if (!d || e.pointerId !== d.pid) return;
    pushSample(d.hist, { t: e.timeStamp, x: e.clientX, y: e.clientY });
    d.lx = e.clientX;
    d.ly = e.clientY;
    if (!d.active) {
      const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
      if (d.mode === "hold") {
        // Palec ruszył przed przytrzymaniem — to przewijanie albo zwykły ruch, nie przeciąganie
        if (dist > HOLD_SLOP) {
          endGesture();
          settleBack();
        }
        return;
      }
      if (dist < DRAG_THRESHOLD) return;
      lift();
    }
    track();
    scroller.current?.update(e.clientY);
  };

  const finish = (e: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const cur = g.current;
    if (!cur || e.pointerId !== cur.pid) return;
    const d = endGesture()!;
    if (!d.active) {
      // Złapany w locie i puszczony bez przeciągania — dowieź go na miejsce
      if (Math.abs(x.get()) + Math.abs(y.get()) > 0.5) settleBack();
      else animate(scale, 1, vt(springSnappy));
      if (!cancelled) onTap(piece.id);
      return;
    }
    setLifted(false);
    const v = releaseVelocity(d.hist, { t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (cancelled) {
      onCancel();
      settleBack(v.vx, v.vy);
      return;
    }
    const accepted = onRelease(piece.id, e.clientX, e.clientY, v);
    if (!accepted) settleBack(v.vx, v.vy);
  };

  return (
    <motion.button
      ref={setRef}
      type="button"
      style={{ x, y, scale, zIndex }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      // Klawiatura (Enter/Spacja) — kliknięcie bez wskaźnika
      onClick={(e) => {
        if (e.detail === 0) onTap(piece.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && selected) onTap(piece.id);
      }}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      data-testid={testId}
      className={cn(
        "relative flex min-h-[48px] w-full select-none items-center gap-3 rounded-[10px] border bg-[var(--panel)] px-3.5 py-2.5 text-left text-[.9375rem] leading-snug text-[var(--txt)] transition-[border-color,background-color,color] duration-200",
        disabled ? "cursor-default" : "cursor-grab touch-pan-y touch-pinch-zoom [-webkit-touch-callout:none] active:cursor-grabbing",
        state === "right" && "border-[var(--puls-deep)] bg-[var(--tint)]",
        state === "wrong" && "border-[color-mix(in_srgb,var(--alarm)_55%,transparent)] text-[var(--txt2)]",
        !state && (lifted ? "border-[var(--txt3)]" : selected ? "border-[var(--puls-deep)] bg-[var(--tint)]" : "border-[var(--line2)] hover:border-[var(--txt3)]"),
      )}
    >
      {!disabled && (
        // Uchwyt: na dotyku przeciąga od razu (bez przytrzymania), strony tu nie przewija
        <span
          data-drag-handle
          aria-hidden
          className="-my-2.5 -ml-3.5 grid w-11 shrink-0 touch-none place-items-center self-stretch text-[var(--label)]"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      {piece.imageUrl && (
        <img
          src={piece.imageUrl}
          alt=""
          draggable={false}
          className="h-10 w-10 shrink-0 rounded-[8px] border border-[var(--line)] object-cover"
        />
      )}
      <span className="min-w-0 flex-1">{piece.content}</span>
      {state === "right" && <Check className="h-4 w-4 shrink-0 text-[var(--puls)]" aria-label="Poprawnie" />}
      {state === "wrong" && <X className="h-4 w-4 shrink-0 text-[var(--alarm)]" aria-label="Błędnie" />}
    </motion.button>
  );
}
