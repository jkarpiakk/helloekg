import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { project, rubberband } from "@/lib/motion";

interface ImageLightboxProps {
  imageUrl: string;
  onClose: () => void;
  /** Miniatura, z której podgląd wyrasta i do której wraca przy zamknięciu */
  origin?: HTMLElement | null;
  alt?: string;
}

/* ── Sprężyna jak na helloekg.pl: damping (1 = bez odbicia) i response (s).
   Startuje z bieżącej wartości i prędkości, więc zmiana celu w trakcie ruchu nie szarpie. ── */
type Spring = {
  value: number;
  velocity: number;
  target: number;
  response: number;
  damping: number;
  to: (target: number, o?: { velocity?: number; response?: number; damping?: number }, done?: () => void) => void;
  set: (v: number) => void;
  grab: () => number;
  stop: () => void;
};

function createSpring(onUpdate: () => void, value = 0, eps = 0.5): Spring {
  let raf = 0;
  let last = 0;
  let done: (() => void) | null = null;
  const s = { value, velocity: 0, target: value, response: 0.4, damping: 1 } as Spring;
  const tick = (t: number) => {
    const dt = Math.min(0.032, (t - last) / 1000 || 0.016);
    last = t;
    const k = (2 * Math.PI / s.response) ** 2;
    const c = (4 * Math.PI * s.damping) / s.response;
    s.velocity += (-k * (s.value - s.target) - c * s.velocity) * dt;
    s.value += s.velocity * dt;
    if (Math.abs(s.velocity) < eps * 4 && Math.abs(s.value - s.target) < eps) {
      s.value = s.target;
      s.velocity = 0;
      raf = 0;
      onUpdate();
      const d = done;
      done = null;
      d?.();
      return;
    }
    onUpdate();
    raf = requestAnimationFrame(tick);
  };
  s.to = (target, o = {}, cb) => {
    s.target = target;
    if (o.velocity != null) s.velocity = o.velocity;
    if (o.response) s.response = o.response;
    if (o.damping) s.damping = o.damping;
    done = cb ?? null;
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  s.set = (v) => {
    cancelAnimationFrame(raf);
    raf = 0;
    s.value = s.target = v;
    s.velocity = 0;
    done = null;
    onUpdate();
  };
  s.grab = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    done = null;
    return s.value;
  };
  s.stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    done = null;
  };
  return s;
}

type Geo = { s: number; dx: number; dy: number } | null;

/**
 * Podgląd obrazu (port podglądu z helloekg.pl):
 * - otwiera się, wyrastając z miniatury, i wraca do niej przy zamknięciu (damping 1, response 0.42),
 * - przeciągnięcie w dół zamyka: śledzenie 1:1 po 10 px zwłoki, w górę gumowo,
 * - po puszczeniu prędkość przechodzi na sprężynę, a rzut pędu decyduje: zamknąć czy wrócić
 *   (powrót z lekkim odbiciem — damping 0.85, bo gest niósł pęd),
 * - tło blednie razem z przeciąganiem; Esc i kliknięcie tła zamykają,
 * - zamykany podgląd można złapać w locie: wraca pod palec od bieżącej wartości (przerywalność),
 * - dwa palce = powiększanie przeglądarki (pinch-zoom); wtedy, i przy powiększonym widoku,
 *   przeciąganie nie zamyka podglądu,
 * - przy „Ogranicz ruch” zostaje samo przenikanie.
 */
export default function ImageLightbox({ imageUrl, onClose, origin, alt = "Powiększony zapis EKG" }: ImageLightboxProps) {
  const still = !!useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const geo = useRef<Geo>(null);
  const opened = useRef(false);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const springs = useRef<{ p: Spring; y: Spring } | null>(null);

  const apply = useCallback(() => {
    const sp = springs.current;
    const panel = panelRef.current;
    if (!sp || !panel) return;
    const P = sp.p.value;
    const k = 1 - P;
    const ty = sp.y.value;
    const H = window.innerHeight;
    const g = geo.current;
    const s = g ? g.s + (1 - g.s) * P : 1;
    const shrink = 1 - Math.min(Math.abs(ty) / H, 1) * 0.12;
    panel.style.transform = `translate3d(${g ? g.dx * k : 0}px, ${(g ? g.dy * k : 0) + ty}px, 0) scale(${s * shrink})`;
    panel.style.opacity = String(g ? Math.min(1, P * 2.5) : Math.max(0, Math.min(1, P)));
    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(Math.max(0, P * (1 - Math.min(Math.abs(ty) / (H * 0.6), 1))));
    }
    const co = Math.max(0, (P - 0.6) / 0.4) * (1 - Math.min(Math.abs(ty) / 120, 1));
    if (closeRef.current) closeRef.current.style.opacity = String(co);
    if (barRef.current) barRef.current.style.opacity = String(co);
  }, []);

  if (!springs.current) {
    springs.current = { p: createSpring(() => apply(), 0, 0.002), y: createSpring(() => apply(), 0, 0.5) };
  }

  /** Geometria miniatury względem panelu (panel mierzony bez transformacji) */
  const measure = useCallback((): Geo => {
    const panel = panelRef.current;
    if (!panel || !origin || !origin.isConnected) return null;
    const f = origin.getBoundingClientRect();
    if (f.width === 0 || f.bottom < 0 || f.top > window.innerHeight) return null;
    const t = panel.style.transform;
    panel.style.transform = "none";
    const r = panel.getBoundingClientRect();
    panel.style.transform = t;
    if (r.width === 0) return null;
    return {
      s: f.width / r.width,
      dx: f.left + f.width / 2 - (r.left + r.width / 2),
      dy: f.top + f.height / 2 - (r.top + r.height / 2),
    };
  }, [origin]);

  const open = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    const { p, y } = springs.current!;
    y.set(0);
    geo.current = still ? null : measure();
    p.set(0);
    p.to(1, { response: still ? 0.3 : 0.42, damping: 1 });
    closeRef.current?.focus({ preventScroll: true });
  }, [measure, still]);

  const close = useCallback(
    (vy = 0) => {
      if (closing.current) return;
      closing.current = true;
      const { p, y } = springs.current!;
      const done = () => onCloseRef.current();
      if (still) {
        geo.current = null;
        p.to(0, { response: 0.25, damping: 1 }, done);
        return;
      }
      geo.current = measure();
      y.to(0, { velocity: vy, response: 0.4, damping: 1 });
      p.to(0, { response: 0.4, damping: 1 }, done);
    },
    [measure, still],
  );

  // Start: niewidoczny panel; otwieramy, gdy obraz ma już wymiary (zwykle od razu — jest w pamięci podręcznej)
  useLayoutEffect(() => {
    apply();
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) open();
  }, [apply, open]);

  // Blokada przewijania strony, Esc, powrót fokusu do miniatury
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const sp = springs.current!;
    return () => {
      window.removeEventListener("keydown", onKey, true);
      html.style.overflow = prev;
      sp.p.stop();
      sp.y.stop();
      if (origin && origin.isConnected) origin.focus({ preventScroll: true });
    };
  }, [close, origin]);

  /* ── Powiększanie palcami: przy skali 1 obraz przyjmuje tylko pinch (jeden palec = nasz gest);
     po powiększeniu wolno też przesuwać widok, a przeciąganie nie zamyka ── */
  const pointers = useRef(new Set<number>());
  const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.01;
  useEffect(() => {
    const vv = window.visualViewport;
    const img = imgRef.current;
    if (!vv || !img) return;
    const sync = () => {
      img.style.touchAction = vv.scale > 1.01 ? "manipulation" : "pinch-zoom";
    };
    sync();
    vv.addEventListener("resize", sync);
    return () => vv.removeEventListener("resize", sync);
  }, []);

  /** Gest przerwany (drugi palec, powiększenie) — panel wraca na miejsce sprężyną */
  const abandonDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.axis === "y" && !still) springs.current!.y.to(0, { response: 0.35, damping: 1 });
  };

  /* ── Gest na obrazie: 10 px zwłoki, potem oś; pion śledzony 1:1, w górę gumowo ── */
  const drag = useRef<{
    x0: number;
    y0: number;
    by: number;
    pid: number;
    axis: "x" | "y" | null;
    hist: { t: number; x: number; y: number }[];
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (e.button !== 0) return;
    pointers.current.add(e.pointerId);
    if (pointers.current.size > 1 || zoomed()) {
      abandonDrag();
      return;
    }
    if (closing.current) {
      // Złapany w trakcie zamykania: anuluj zamknięcie i wróć od bieżącej wartości (sprężyna nie skacze)
      closing.current = false;
      springs.current!.p.to(1, { response: still ? 0.3 : 0.42, damping: 1 });
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* gest działa i bez przechwycenia */
    }
    drag.current = {
      x0: e.clientX,
      y0: e.clientY,
      by: springs.current!.y.grab(),
      pid: e.pointerId,
      axis: null,
      hist: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    if (pointers.current.size > 1 || zoomed()) {
      abandonDrag();
      return;
    }
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    d.hist.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (d.hist.length > 6) d.hist.shift();
    if (!d.axis) {
      if (Math.hypot(dx, dy) < 10) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (still || d.axis !== "y") return;
    const y = springs.current!.y;
    const v = d.by + dy;
    y.value = v < 0 ? rubberband(v, window.innerHeight) : v;
    apply();
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLImageElement>) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    drag.current = null;
    if (d.axis !== "y" || still) return;
    const a = d.hist[0];
    const b = d.hist[d.hist.length - 1];
    const dt = Math.max(1, b.t - a.t);
    // Palec zatrzymany przed puszczeniem — brak pędu
    const vy = e.timeStamp - b.t > 100 ? 0 : ((b.y - a.y) / dt) * 1000;
    const y = springs.current!.y;
    const end = y.value + project(vy);
    if (end > window.innerHeight * 0.22) close(vy);
    else {
      // Odbicie tylko, gdy gest niósł pęd; inaczej spokojny powrót
      y.to(0, { velocity: vy, response: 0.35, damping: Math.abs(vy) > 200 ? 0.85 : 1 });
      if (springs.current!.p.target !== 1) springs.current!.p.to(1, { response: 0.42, damping: 1 });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Podgląd obrazu" data-testid="image-lightbox">
      <div ref={backdropRef} className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_94%,transparent)] opacity-0" onClick={() => close()} aria-hidden />
      <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
        <div
          ref={panelRef}
          className="pointer-events-auto relative grid w-full max-w-[min(980px,calc(100vw-32px))] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-[var(--line2)] bg-[var(--panel)] opacity-0 will-change-transform"
          style={{ transformOrigin: "50% 50%" }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt={alt}
            draggable={false}
            onLoad={open}
            onError={open}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            className="block max-h-[calc(100dvh-120px)] w-full cursor-grab touch-pinch-zoom select-none bg-[var(--ink)] object-contain active:cursor-grabbing"
            data-testid="lightbox-image"
          />
          <button
            ref={closeRef}
            type="button"
            onClick={() => close()}
            className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full border border-[var(--line2)] bg-[var(--panel)] text-[var(--txt)] transition-transform duration-100 active:scale-[.94]"
            aria-label="Zamknij podgląd"
            data-testid="close-lightbox"
          >
            <X className="h-4 w-4" />
          </button>
          <div ref={barRef} className="border-t border-[var(--line)] px-4 py-2.5 text-center text-note text-[var(--txt2)]">
            <span className="[@media(hover:hover)_and_(pointer:fine)]:hidden">Przeciągnij w dół, aby zamknąć</span>
            <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline">Esc albo kliknięcie obok zamyka podgląd</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
