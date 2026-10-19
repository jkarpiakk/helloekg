import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquareText, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { press, springSnappy } from "@/lib/motion";
import { feedbackAreaForPath, type MyFeedbackReport } from "@shared/feedback";

type Mine = { hintSeen: boolean; reports: MyFeedbackReport[] };

const HINT_KEY = "hk:feedback-hint-seen";

function readLocalHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Pierwsza interakcja z przyciskiem albo podpowiedzią — podpowiedź znika na zawsze */
function recordHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* prywatne okno — wystarczy zapis na serwerze */
  }
  queryClient.setQueryData<Mine>(["/api/feedback/mine"], (d) => (d ? { ...d, hintSeen: true } : d));
  void fetch("/api/feedback/hint-seen", { method: "POST", credentials: "include", keepalive: true }).catch(() => undefined);
}

/** Trwa quiz (pytania na ekranie) — przycisk zasłaniałby „Dalej”, a przy pytaniu jest „Zgłoś błąd” */
function isActiveQuiz(path: string, search: string): boolean {
  if (!path.startsWith("/quiz")) return false;
  const p = new URLSearchParams(search);
  return p.has("sectionId") || p.has("section") || p.has("mode");
}

/**
 * Pływający przycisk „Zgłoś uwagę” (beta). Prawy dolny róg, z uwzględnieniem bezpiecznego obszaru.
 * Przy przewijaniu w dół zwija się do ikony; rozwija się tylko przy przewinięciu w górę
 * albo na końcu strony (bez samoczynnego rozwijania po czasie — nic nie rusza się bez powodu).
 */
export default function FeedbackFab() {
  const [path, navigate] = useLocation();
  const search = useSearch();
  const [collapsed, setCollapsed] = useState(false);
  const [localHintSeen, setLocalHintSeen] = useState(readLocalHint);
  const lastY = useRef(0);
  const frame = useRef<number | null>(null);

  const hidden = path.startsWith("/admin") || path.startsWith("/zgloszenie") || isActiveQuiz(path, search);

  const { data } = useQuery<Mine>({ queryKey: ["/api/feedback/mine"], enabled: !hidden && !localHintSeen });
  const showHint = !hidden && !localHintSeen && data !== undefined && !data.hintSeen;

  useEffect(() => {
    // Serwer pamięta podpowiedź — przenieś to do localStorage, żeby nie pytać przy każdym wejściu
    if (data?.hintSeen && !localHintSeen) {
      try {
        window.localStorage.setItem(HINT_KEY, "1");
      } catch {
        /* nic */
      }
    }
  }, [data?.hintSeen, localHintSeen]);

  useEffect(() => {
    if (hidden) return;
    lastY.current = window.scrollY;
    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 8;
        if (atEnd || delta < -4) setCollapsed(false);
        else if (delta > 4 && y > 80) setCollapsed(true);
        lastY.current = y;
        frame.current = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [hidden]);

  if (hidden) return null;

  const from = `${path}${search ? `?${search}` : ""}`;
  const href = `/zgloszenie?area=${feedbackAreaForPath(from)}&from=${encodeURIComponent(from)}`;

  const dismiss = () => {
    setLocalHintSeen(true);
    recordHintSeen();
  };

  // Bezpieczny obszar (notch, pasek gestów) + odstęp 16px
  const inset = {
    right: "max(16px, calc(env(safe-area-inset-right) + 12px))",
    bottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))",
  };

  return (
    <>
      <AnimatePresence>
        {showHint && (
          <motion.aside
            key="hint"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed z-[45] flex w-[min(320px,calc(100vw-32px))] items-start gap-2 rounded-2xl border border-[var(--line2)] bg-[var(--panel)] py-2 pl-4 pr-1 text-[.9375rem] leading-[1.5] text-[var(--txt)]"
            style={{ right: inset.right, bottom: `calc(${inset.bottom} + 60px)` }}
            data-testid="feedback-hint"
          >
            <p className="py-2">Widzisz błąd albo masz pomysł? Daj znać.</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Zamknij podpowiedź"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--txt2)] transition-[color,transform] duration-150 hover:text-[var(--txt)] active:scale-[.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--puls)]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      <motion.a
        layout
        transition={springSnappy}
        whileTap={press}
        href={href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          if (!localHintSeen) dismiss();
          navigate(href);
        }}
        aria-label="Zgłoś uwagę lub błąd"
        title="Zgłoś uwagę"
        data-testid="feedback-fab"
        data-tour="feedback-fab"
        style={{ ...inset, borderRadius: 999 }}
        className="material-bar fixed z-[45] flex h-12 min-w-12 items-center justify-center gap-2 border border-[var(--line2)] px-[14px] text-[.9375rem] font-medium text-[var(--txt)] no-underline transition-[border-color] duration-150 hover:border-[var(--txt3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--puls)]"
      >
        <motion.span layout="position" className="grid place-items-center">
          <MessageSquareText className="h-[18px] w-[18px]" aria-hidden />
        </motion.span>
        <AnimatePresence initial={false} mode="popLayout">
          {!collapsed && (
            <motion.span
              key="label"
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={springSnappy}
              className="whitespace-nowrap pr-1"
            >
              Zgłoś uwagę
            </motion.span>
          )}
        </AnimatePresence>
      </motion.a>
    </>
  );
}
