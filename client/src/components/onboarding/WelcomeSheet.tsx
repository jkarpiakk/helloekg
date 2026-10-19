/**
 * Instrukcja na start: 4 krótkie kroki, pokazywane raz na użytkownika
 * (`hk-welcome-v1:<userId>`; gdy localStorage nie działa — raz na sesję).
 * Ponownie otwiera ją zdarzenie `hk:welcome` (np. link w „Pierwszych krokach”).
 *
 * Telefon: arkusz od dołu — ściągasz go w dół (1:1 od miejsca chwytu, gumowa granica w górę,
 * po puszczeniu rzut pędu decyduje: zamknąć czy wrócić). Kroki przesuwasz w bok tym samym gestem.
 * Komputer: okno na środku, które się „materializuje”; strzałki ← → zmieniają krok.
 * „Ogranicz ruch”: samo przenikanie.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Transition,
  type ValueAnimationTransition,
} from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CircleDot,
  Crosshair,
  Flag,
  Link2,
  ListOrdered,
  MessageSquare,
  Move,
  TextCursorInput,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EkgCanvas } from "@/components/ekg/EkgCanvas";
import { project, rubberband, spring, springMomentum } from "@/lib/motion";
import {
  WELCOME_EVENT,
  firstLectureHref,
  markStep,
  readStore,
  useCurrentUser,
  useModules,
  welcomeKey,
  writeStore,
} from "./onboardingStore";

/* ───────────────────────── treść kroków ───────────────────────── */

interface Step {
  label: string;
  title: string;
  body: ReactNode;
  visual: ReactNode;
}

function CourseVisual() {
  const parts = [
    ["01", "7 modułów"],
    ["02", "Wykład"],
    ["03", "Pytania"],
    ["04", "Powtórka"],
  ];
  return (
    <div className="grid gap-3" aria-hidden="true">
      <EkgCanvas rhythm="sinus" height={64} label={false} />
      <ol className="grid grid-cols-4 border-y border-[var(--line)]">
        {parts.map(([n, t], i) => (
          <li
            key={n}
            className={`grid gap-1 px-2.5 py-2.5 ${i > 0 ? "border-l border-[var(--line)]" : ""}`}
          >
            <span className={`label text-[10px] ${i === 0 ? "label--g" : ""}`}>{n}</span>
            <span className="text-[13px] leading-tight text-[var(--txt)]">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LectureVisual() {
  const line = (w: string) => <span className="block h-[5px] rounded-full bg-[var(--line2)]" style={{ width: w }} />;
  return (
    <div className="surface grid gap-3 p-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="label text-[10px]">Rozdział 2 / 4</span>
        <span className="flex gap-1">
          {[1, 1, 0, 0].map((on, i) => (
            <span
              key={i}
              className={`block h-[3px] w-5 rounded-full ${on ? "bg-[var(--puls)]" : "bg-[var(--line2)]"}`}
            />
          ))}
        </span>
      </div>
      <div className="grid gap-2">
        {line("92%")}
        {line("100%")}
        {line("74%")}
      </div>
      <div className="grid gap-2 rounded-r-[8px] border-l-2 border-[var(--puls-deep)] bg-[var(--tint)] px-3 py-2.5">
        <span className="text-[12px] font-medium text-[var(--txt)]">Przypomnij sobie</span>
        {line("80%")}
      </div>
      <span className="inline-flex h-8 items-center gap-1.5 justify-self-start rounded-full bg-[var(--puls)] px-3.5 text-[12px] font-medium text-[var(--on-puls)]">
        Sprawdź się <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

const TASK_TYPES = [
  { icon: CircleDot, t: "Jednokrotny wybór" },
  { icon: Crosshair, t: "Wskaż na zapisie" },
  { icon: Move, t: "Przeciągnij i upuść" },
  { icon: Link2, t: "Dopasuj" },
  { icon: ListOrdered, t: "Uporządkuj" },
  { icon: TextCursorInput, t: "Uzupełnij" },
];

function QuestionsVisual() {
  return (
    <ul className="grid grid-cols-2 border-t border-[var(--line)]" aria-label="Typy zadań">
      {TASK_TYPES.map(({ icon: Icon, t }, i) => (
        <li
          key={t}
          className={`flex min-h-[44px] items-center gap-2.5 border-b border-[var(--line)] py-2 text-[13px] text-[var(--txt)] ${
            i % 2 ? "pl-3" : "border-r pr-3"
          }`}
        >
          <Icon className="h-4 w-4 shrink-0 text-[var(--puls)]" aria-hidden="true" />
          {t}
        </li>
      ))}
    </ul>
  );
}

function BetaVisual() {
  return (
    <div className="surface relative h-[150px] overflow-hidden p-4" aria-hidden="true">
      <span className="label text-[10px]">Pytanie 3 / 10</span>
      <div className="mt-3 grid gap-2">
        <span className="block h-[5px] w-[85%] rounded-full bg-[var(--line2)]" />
        <span className="block h-[5px] w-[60%] rounded-full bg-[var(--line2)]" />
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--txt2)]">
        <Flag className="h-3.5 w-3.5" /> Zgłoś błąd
      </span>
      <span className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line2)] bg-[var(--panel)] px-3.5 text-[12px] font-medium text-[var(--txt)]">
        <MessageSquare className="h-3.5 w-3.5 text-[var(--puls)]" /> Zgłoś uwagę
      </span>
    </div>
  );
}

const STEPS: Step[] = [
  {
    label: "Jak działa kurs",
    title: "7 modułów, w każdym ten sam rytm.",
    body: (
      <>
        Najpierw wykład, potem pytania, na końcu powtórka. Idziesz po kolei od modułu 1 albo wybierasz temat
        w zakładce Kurs.
      </>
    ),
    visual: <CourseVisual />,
  },
  {
    label: "Wykład",
    title: "Czytasz rozdział po rozdziale.",
    body: (
      <>
        Na końcu wykładu czeka „Przypomnij sobie” — krótkie podsumowanie najważniejszego. Potem jeden przycisk
        prowadzi cię do pytań.
      </>
    ),
    visual: <LectureVisual />,
  },
  {
    label: "Pytania i powtórki",
    title: "Sześć typów zadań. Wyjaśnienie po każdym.",
    body: (
      <>
        Po odpowiedzi od razu widzisz, dlaczego tak jest. Postęp liczy się z odpowiedzi. Pytania, w których się
        pomylisz, wracają w Powtórce.
      </>
    ),
    visual: <QuestionsVisual />,
  },
  {
    label: "To jest beta",
    title: "Coś nie działa? Daj znać.",
    body: (
      <>
        Coś się psuje albo jest niejasne? Kliknij „Zgłoś uwagę” w prawym dolnym rogu. Przy pytaniu masz też
        „Zgłoś błąd”. Każda uwaga trafia prosto do nas.
      </>
    ),
    visual: <BetaVisual />,
  },
];

/* ───────────────────────── pomocnicze ───────────────────────── */

function useMediaQuery(query: string) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener?.("change", on);
    return () => mql.removeEventListener?.("change", on);
  }, [query]);
  return matches;
}

interface Sample {
  t: number;
  x: number;
  y: number;
}

/** Prędkość (px/s) z próbek z ostatnich ~100 ms — tak liczy ją UIKit */
function velocityOf(samples: Sample[]): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const last = samples[samples.length - 1];
  let first = samples[0];
  for (const s of samples) {
    if (last.t - s.t <= 100) {
      first = s;
      break;
    }
  }
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

const SLOP = 10;

/** Presety z @/lib/motion jako opcje animate() dla pojedynczej wartości (+ prędkość gestu) */
const tr = (t: Transition, velocity?: number) =>
  ({ ...(t as object), ...(velocity ? { velocity } : {}) }) as ValueAnimationTransition<number>;

/* ───────────────────────── panel ───────────────────────── */

function WelcomePanel({ mobile, onDone }: { mobile: boolean; onDone: () => void }) {
  const reduce = useReducedMotion() ?? false;
  const user = useCurrentUser();
  const [, setLocation] = useLocation();
  const { data: modules, refetch } = useModules(true);

  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const last = STEPS.length - 1;

  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const closingRef = useRef(false);

  const trackX = useMotionValue(0);
  const trackOpacity = useMotionValue(1);
  const sheetY = useMotionValue(0);
  // Przyciemnienie słabnie razem ze ściąganym arkuszem
  const scrim = useTransform(sheetY, (v) => {
    const h = heightRef.current || 600;
    return Math.max(0, Math.min(1, 1 - v / h));
  });

  const [scrollable, setScrollable] = useState(false);

  // Wymiary: szerokość kroku i wysokość arkusza; po zmianie rozmiaru tor wraca na miejsce
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const el = contentRef.current;
    if (!vp || !el) return;
    const measure = () => {
      widthRef.current = vp.offsetWidth;
      heightRef.current = el.offsetHeight;
      trackX.set(-stepRef.current * widthRef.current);
      const sc = scrollRef.current;
      setScrollable(!!sc && sc.scrollHeight > sc.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(el);
    return () => ro.disconnect();
  }, [trackX]);

  // Wejście arkusza od dołu (na telefonie, bez „Ogranicz ruch”)
  useLayoutEffect(() => {
    if (!mobile || reduce) return;
    sheetY.set(window.innerHeight);
    const c = animate(sheetY, 0, tr(spring));
    return () => c.stop();
  }, [mobile, reduce, sheetY]);

  const goTo = useCallback(
    (n: number, velocity = 0) => {
      const target = Math.max(0, Math.min(last, n));
      stepRef.current = target;
      setStep(target);
      const x = -target * widthRef.current;
      if (reduce) {
        trackX.set(x);
        trackOpacity.set(0);
        animate(trackOpacity, 1, { duration: 0.2, ease: "easeOut" });
      } else {
        animate(trackX, x, velocity ? tr(springMomentum, velocity) : tr(spring));
      }
    },
    [last, reduce, trackX, trackOpacity],
  );

  /** Zamknięcie tą samą drogą, którą arkusz przyszedł */
  const requestClose = useCallback(
    (velocity = 0) => {
      if (closingRef.current) return;
      closingRef.current = true;
      if (mobile && !reduce) {
        animate(sheetY, (heightRef.current || window.innerHeight) + 24, {
          type: "spring",
          bounce: 0,
          duration: 0.35,
          velocity,
          onComplete: onDone,
        });
      } else {
        onDone();
      }
    },
    [mobile, reduce, sheetY, onDone],
  );

  const start = async () => {
    markStep(user?.id, "lecture");
    const data = modules ?? (await refetch().catch(() => null))?.data;
    setLocation(firstLectureHref(data));
    onDone();
  };

  /* ── gest: w bok = kroki, w dół = zamknij (tylko arkusz) ── */
  const g = useRef<{
    id: number;
    x0: number;
    y0: number;
    axis: "x" | "y" | null;
    slopX: number;
    slopY: number;
    samples: Sample[];
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || closingRef.current) return;
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, slopX: 0, slopY: 0, samples: [] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.axis) {
      if (Math.hypot(dx, dy) < SLOP) return;
      const axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      // Pionowo: tylko arkusz na telefonie i tylko gdy treść nie jest przewinięta
      if (axis === "y" && (!mobile || (scrollRef.current?.scrollTop ?? 0) > 0)) {
        g.current = null;
        return;
      }
      s.axis = axis;
      s.slopX = Math.sign(dx) * Math.min(Math.abs(dx), SLOP);
      s.slopY = Math.sign(dy) * Math.min(Math.abs(dy), SLOP);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    s.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (s.samples.length > 8) s.samples.shift();
    if (reduce) return; // przy „Ogranicz ruch” nic nie jedzie za palcem
    if (s.axis === "x") {
      const W = widthRef.current;
      const min = -last * W;
      const raw = -stepRef.current * W + (dx - s.slopX);
      const v = raw > 0 ? rubberband(raw, W) : raw < min ? min - rubberband(min - raw, W) : raw;
      trackX.set(v);
    } else {
      const d = dy - s.slopY;
      sheetY.set(d < 0 ? -rubberband(-d, heightRef.current || 600) : d);
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    g.current = null;
    if (!s.axis) return;
    const cancelled = e.type === "pointercancel";
    const { vx, vy } = velocityOf(s.samples);
    if (s.axis === "x") {
      const W = widthRef.current;
      const offset = e.clientX - s.x0 - s.slopX;
      const projected = offset + (cancelled ? 0 : project(vx));
      let next = stepRef.current;
      if (!cancelled && projected < -W / 2) next += 1;
      else if (!cancelled && projected > W / 2) next -= 1;
      goTo(next, next !== stepRef.current || offset !== 0 ? vx : 0);
    } else {
      const y = e.clientY - s.y0 - s.slopY;
      const H = heightRef.current || window.innerHeight;
      if (!cancelled && y > 0 && y + project(vy) > H / 2) requestClose(vy);
      else if (!reduce) animate(sheetY, 0, tr(springMomentum, vy));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(stepRef.current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(stepRef.current - 1);
    }
  };

  /* ── układ ── */
  const slides = (
    <div ref={viewportRef} className="overflow-hidden" aria-roledescription="karuzela" aria-label="Kroki instrukcji">
      <motion.div className="flex items-start" style={{ x: trackX, opacity: trackOpacity }}>
        {STEPS.map((s, i) => {
          const hidden = i !== step;
          return (
            <section
              key={s.label}
              className="grid shrink-0 grow-0 basis-full gap-5"
              aria-roledescription="krok"
              aria-label={`${i + 1} z ${STEPS.length}: ${s.label}`}
              aria-hidden={hidden || undefined}
              {...(hidden ? ({ inert: "" } as Record<string, string>) : {})}
            >
              {s.visual}
              <div className="grid gap-2">
                <span className="label label--g">
                  {String(i + 1).padStart(2, "0")} · {s.label}
                </span>
                <h2 className="h3 text-[var(--txt)]">{s.title}</h2>
                <p className="text-[15px] leading-[1.65] text-[var(--txt2)]">{s.body}</p>
              </div>
            </section>
          );
        })}
      </motion.div>
    </div>
  );

  const footer = (
    <div className="grid gap-4 sm:flex sm:items-center sm:justify-between">
      <div className="flex justify-center gap-1 sm:justify-start" role="group" aria-label="Wybierz krok">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Krok ${i + 1}: ${s.label}`}
            aria-current={i === step ? "step" : undefined}
            className="grid h-11 w-6 place-items-center rounded-full"
          >
            <span
              className={`block h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                i === step ? "w-4 bg-[var(--puls)]" : "w-1.5 bg-[var(--line2)]"
              }`}
            />
          </button>
        ))}
      </div>
      <div className="grid gap-1 sm:flex sm:flex-row-reverse sm:items-center sm:gap-2">
        {step < last ? (
          <Button ref={primaryRef} onClick={() => goTo(step + 1)} className="w-full sm:w-auto">
            Dalej <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <Button ref={primaryRef} onClick={start} className="w-full sm:w-auto">
            Zaczynam <ArrowRight aria-hidden="true" />
          </Button>
        )}
        <Button variant="ghost" onClick={() => requestClose()} className="w-full sm:w-auto">
          Rozejrzę się sam
        </Button>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between gap-4">
      <span className="label">
        Instrukcja · <span className="num">{step + 1}</span>/{STEPS.length}
      </span>
      <DialogPrimitive.Close
        aria-label="Zamknij instrukcję"
        className="grid h-11 w-11 place-items-center rounded-full text-[var(--txt2)] transition-[transform,color] duration-150 hover:text-[var(--txt)] active:scale-95"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line2)]">
          <X className="h-4 w-4" aria-hidden="true" />
        </span>
      </DialogPrimitive.Close>
    </div>
  );

  const a11y = (
    <>
      <DialogPrimitive.Title className="sr-only">Jak korzystać z kursu helloEKG</DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">
        Cztery krótkie kroki. Strzałki w lewo i w prawo zmieniają krok, Esc zamyka.
      </DialogPrimitive.Description>
      <p className="sr-only" aria-live="polite">
        Krok {step + 1} z {STEPS.length}: {STEPS[step].label}
      </p>
    </>
  );

  const contentProps = {
    onOpenAutoFocus: (e: Event) => {
      e.preventDefault();
      primaryRef.current?.focus({ preventScroll: true });
    },
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && requestClose()}>
      <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Overlay forceMount asChild>
          {mobile && !reduce ? (
            <motion.div className="hk-scrim fixed inset-0 z-50" style={{ animation: "none", opacity: scrim }} />
          ) : (
            <motion.div
              className="hk-scrim fixed inset-0 z-50"
              style={{ animation: "none" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.28 } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            />
          )}
        </DialogPrimitive.Overlay>

        <DialogPrimitive.Content forceMount asChild {...contentProps}>
          {mobile ? (
            <motion.div
              ref={contentRef}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[20px] border-t border-[var(--line2)] bg-[var(--panel)] outline-none"
              style={{
                y: sheetY,
                touchAction: scrollable ? "pan-y" : "none",
                paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              }}
              {...(reduce
                ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
                : {})}
            >
              {/* uchwyt: ściągnij w dół, żeby zamknąć */}
              <div className="flex justify-center pt-2.5" style={{ touchAction: "none" }} aria-hidden="true">
                <span className="block h-[5px] w-10 rounded-full bg-[var(--line2)]" />
              </div>
              <div className="px-5 pt-1" style={{ touchAction: "none" }}>
                {header}
              </div>
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">
                {slides}
              </div>
              <div className="border-t border-[var(--line)] px-5 pt-3">{footer}</div>
              {a11y}
            </motion.div>
          ) : (
            <motion.div
              ref={contentRef}
              className="fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[520px] gap-5 overflow-hidden rounded-[20px] border border-[var(--line2)] bg-[var(--panel)] p-6 outline-none sm:p-7"
              style={{ x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: spring }}
              exit={{ opacity: 0, scale: 0.96, transition: { type: "spring", bounce: 0, duration: 0.25 } }}
            >
              {header}
              <div ref={scrollRef} className="min-h-0 overflow-y-auto">
                {slides}
              </div>
              <div className="border-t border-[var(--line)] pt-5">{footer}</div>
              {a11y}
            </motion.div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ───────────────────────── eksport ───────────────────────── */

export default function WelcomeSheet() {
  const user = useCurrentUser();
  const userId = user?.id;
  const mobile = !useMediaQuery("(min-width: 640px)");
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  // Raz na użytkownika — oznaczamy przy pokazaniu, więc przeładowanie w połowie nie męczy drugi raz
  useEffect(() => {
    if (!userId) return;
    const key = welcomeKey(userId);
    if (readStore(key)) return;
    writeStore(key, new Date().toISOString());
    // Krótka chwila, żeby panel zdążył się narysować — instrukcja przychodzi „na” niego
    const t = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(t);
  }, [userId]);

  useEffect(() => {
    const show = () => {
      setSession((n) => n + 1);
      setOpen(true);
    };
    window.addEventListener(WELCOME_EVENT, show);
    return () => window.removeEventListener(WELCOME_EVENT, show);
  }, []);

  const onDone = useCallback(() => setOpen(false), []);

  return (
    <AnimatePresence>
      {open && <WelcomePanel key={`${session}-${mobile ? "m" : "d"}`} mobile={mobile} onDone={onDone} />}
    </AnimatePresence>
  );
}

