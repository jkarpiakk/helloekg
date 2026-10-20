import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Rhythm } from "@/components/ekg/EkgCanvas";
import { LectureContent } from "@/components/lecture/LectureContent";
import { ChapterHeader } from "@/components/lecture/ChapterHeader";
import { ReadingProgress } from "@/components/lecture/ReadingProgress";
import { chapterHasVisual, chaptersQuery, GAP_ROLES, renderMarkdown, sortChapters } from "@/components/lecture/lectureData";
import { useAuth } from "@/lib/auth";
import { spring } from "@/lib/motion";

export interface NextSectionLink {
  href: string;
  title: string;
  /** np. „Moduł 2 · Wykład 4” */
  label?: string;
}

/** Dokąd prowadzi „Sprawdź się” na końcu wykładu */
export interface CheckLink {
  href: string;
  sectionId: string;
  title: string;
  note: string;
}

interface LectureNavigationProps {
  sectionId: string;
  sectionTitle: string;
  /** false = sekcja nie ma rozdziałów (nie pytamy serwera); undefined = nie wiadomo */
  hasLecture?: boolean;
  /** Pytania do sprawdzenia się — tej sekcji albo utrwalające modułu; null = brak pytań */
  check: CheckLink | null;
  /** Kolejny temat w kursie (jeśli jest) */
  next?: NextSectionLink | null;
  /** Rytm ozdobnej linii EKG dobrany do tematu (nagłówek wykładu używa tego samego) */
  rhythm?: Rhythm;
  onComplete?: () => void;
}

/** Zapamiętane miejsce w wykładzie (GET /api/lecture-reads) */
interface LectureRead {
  sectionId: string;
  chapterOrder: number;
  chaptersTotal: number;
}

const READS_KEY = ["/api/lecture-reads"] as const;
const SAVE_DELAY_MS = 1000;

const hasChapterHash = () => typeof window !== "undefined" && /^#rozdzial-\d+$/.test(window.location.hash);

/** Zapis miejsca; keepalive — żądanie przeżyje zamknięcie karty */
const saveRead = (sectionId: string, chapterOrder: number, chaptersTotal: number, keepalive = false) =>
  fetch(`/api/lecture-reads/${sectionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapterOrder, chaptersTotal }),
    credentials: "include",
    keepalive,
  });

const readHashIndex = () => {
  const m = typeof window !== "undefined" ? window.location.hash.match(/^#rozdzial-(\d+)$/) : null;
  return m ? Math.max(0, parseInt(m[1], 10) - 1) : 0;
};

/** Następny rozdział wchodzi od dołu, poprzedni od góry; wychodzi w przeciwną stronę */
const chapterVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, y: dir >= 0 ? 12 : -12 }),
  center: { opacity: 1, y: 0, transition: spring },
  exit: (dir: number) => ({ opacity: 0, y: dir >= 0 ? -12 : 12, transition: { duration: 0.15, ease: "easeIn" } }),
};

export function LectureNavigation({ sectionId, sectionTitle, hasLecture, check, next, rhythm = "sinus", onComplete }: LectureNavigationProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(readHashIndex);
  const [direction, setDirection] = useState(1);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const topRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  const canSeeGaps = !!user && GAP_ROLES.includes(user.role);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...chaptersQuery(sectionId),
    enabled: hasLecture !== false,
  });

  // Wznowienie: bez numeru rozdziału w adresie wracamy tam, gdzie czytelnik skończył
  const [openedWithHash] = useState(hasChapterHash);
  const reads = useQuery({
    queryKey: READS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/lecture-reads", { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as LectureRead[];
    },
    staleTime: 0,
    retry: false,
    enabled: hasLecture !== false && !openedWithHash,
  });
  /** null = jeszcze nie zdecydowano; dopóki null, nie zapisujemy (nie nadpiszemy zapamiętanego miejsca rozdziałem 1) */
  const [resumed, setResumed] = useState<null | { chapter: number; total: number } | false>(openedWithHash ? false : null);

  const chapters = useMemo(() => sortChapters(data), [data]);
  const total = chapters.length;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const chapter = chapters[safeIndex];
  const isLast = safeIndex === total - 1;
  const html = useMemo(() => (chapter ? renderMarkdown(chapter.contentMd) : ""), [chapter]);

  // Zapis miejsca: 1 s po zmianie rozdziału; przy zamknięciu karty / wyjściu z wykładu — od razu (keepalive)
  const pending = useRef<{ chapter: number; total: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(
    (keepalive: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const p = pending.current;
      if (!p) return;
      pending.current = null;
      saveRead(sectionId, p.chapter, p.total, keepalive)
        .then((res) => {
          if (!res.ok) return;
          // Panel „Twój postęp” pobierze świeże „Czytaj dalej” przy następnym wejściu
          queryClient.invalidateQueries({ queryKey: ["/api/modules"], refetchType: "none" });
        })
        .catch(() => {});
    },
    [sectionId, queryClient],
  );

  useEffect(() => {
    if (resumed === null || !total) return;
    const p = { chapter: safeIndex + 1, total };
    pending.current = p;
    // Pamięć podręczna od razu: powrót do wykładu w tej samej sesji trafia we właściwe miejsce
    queryClient.setQueryData<LectureRead[]>(READS_KEY, (prev) => [
      ...(prev ?? []).filter((r) => r.sectionId !== sectionId),
      { sectionId, chapterOrder: p.chapter, chaptersTotal: p.total },
    ]);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(false), SAVE_DELAY_MS);
  }, [safeIndex, total, resumed, sectionId, flush, queryClient]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [flush]);

  // Notka „Wracasz do rozdziału…” znika, gdy czytelnik sam zmieni rozdział albo ją zamknie
  const [noteOpen, setNoteOpen] = useState(true);
  const showResumeNote = !!resumed && noteOpen && safeIndex === resumed.chapter - 1;

  // Nowa sekcja → od pierwszego rozdziału (chyba że link wskazuje konkretny)
  useEffect(() => {
    setIndex(readHashIndex());
    setCompleted(new Set());
  }, [sectionId]);

  // Link do rozdziału w tym samym wykładzie (zmienia się tylko #rozdzial-N) — przejdź do niego
  useEffect(() => {
    const onHash = () => {
      if (/^#rozdzial-\d+$/.test(window.location.hash)) setIndex(readHashIndex());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Numer rozdziału w adresie: odświeżenie strony nie gubi miejsca
  useEffect(() => {
    if (!total) return;
    const hash = safeIndex > 0 ? `#rozdzial-${safeIndex + 1}` : "";
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [safeIndex, total]);

  // Decyzja o wznowieniu — raz, gdy znamy rozdziały i zapamiętane miejsce
  useEffect(() => {
    if (resumed !== null || !total) return;
    if (reads.isPending && reads.fetchStatus !== "idle") return;
    const saved = reads.data?.find((r) => r.sectionId === sectionId);
    if (saved && saved.chapterOrder > 1 && saved.chapterOrder <= total) {
      setIndex(saved.chapterOrder - 1);
      setResumed({ chapter: saved.chapterOrder, total });
    } else {
      setResumed(false);
    }
  }, [resumed, total, reads.isPending, reads.fetchStatus, reads.data, sectionId]);

  /** Wysokość nawigacji i przyklejonej belki — o tyle treść jest przykryta od góry */
  const coverH = useCallback(() => {
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64;
    return navH + (barRef.current?.offsetHeight ?? 0);
  }, []);

  const scrollToChapterTop = useCallback(() => {
    const el = topRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - coverH() - 16;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "auto" });
  }, [coverH]);

  const goTo = useCallback(
    (target: number) => {
      if (target < 0 || target >= total || target === safeIndex) return;
      if (target > safeIndex && chapter) {
        setCompleted((prev) => new Set(prev).add(chapter.id));
      }
      setDirection(target > safeIndex ? 1 : -1);
      setIndex(target);
      // Przy „Ogranicz ruch” nie ma fazy wyjścia — przewijamy od razu
      if (reduce) requestAnimationFrame(scrollToChapterTop);
    },
    [total, safeIndex, chapter, reduce, scrollToChapterTop],
  );

  const finish = () => {
    if (chapter) setCompleted((prev) => new Set(prev).add(chapter.id));
    onComplete?.();
  };

  // Strzałki ← → przełączają rozdziały (poza polami tekstowymi)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight") goTo(safeIndex + 1);
      if (e.key === "ArrowLeft") goTo(safeIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, safeIndex]);

  if ((isLoading || (resumed === null && total > 0)) && hasLecture !== false) {
    return (
      <div className="min-h-[40vh] grid place-items-center" data-testid="loading-lecture">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    const noAccess = String((error as Error)?.message ?? "").startsWith("403");
    return (
      <div className="grid gap-5 justify-items-start border-t border-[var(--line)] pt-8" data-testid="error-lecture">
        <p className="muted max-w-[34em]">
          {noAccess
            ? "Ten wykład jest dostępny z aktywnym dostępem do kursu."
            : "Nie udało się wczytać wykładu. Sprawdź połączenie i spróbuj jeszcze raz."}
        </p>
        {!noAccess && (
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Spróbuj ponownie
          </Button>
        )}
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="grid gap-5 justify-items-start border-t border-[var(--line)] pt-8" data-testid="empty-lecture">
        <p className="lead">
          {check || next ? "Ten temat nie ma wykładu." : "Materiały do tego tematu są w przygotowaniu."}
        </p>
        {check ? (
          <Button asChild data-testid="button-go-to-quiz">
            <Link href={check.href}>
              Przejdź do pytań
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : next ? (
          <Button asChild data-testid="button-next-section">
            <Link href={next.href}>
              Następny temat
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/modules">Wróć do kursu</Link>
          </Button>
        )}
      </div>
    );
  }

  const showChapterTitle = !(total === 1 && chapter.title.trim() === sectionTitle.trim());
  const nextChapter = chapters[safeIndex + 1];

  return (
    <div ref={rootRef} data-testid="lecture">
      {/* Belka rozdziałów: przyklejona pod nawigacją, treść przewija się pod spodem.
          Pasek: odcinek na rozdział, bieżący wypełnia się w miarę czytania. */}
      <div
        ref={barRef}
        data-tour="chapter-bar"
        className="material-bar sticky top-[var(--nav-h)] z-30 mx-[calc(50%-50vw)] border-b border-[var(--line)]"
      >
        <div className="wrap wrap--narrow flex min-h-[48px] items-center gap-3 py-1.5">
          <p className="label num shrink-0" aria-live="polite" data-testid="chapter-counter">
            {total > 1 ? `Rozdział ${safeIndex + 1}/${total}` : "Wykład"}
          </p>
          <p className="min-w-0 flex-1 truncate text-[.875rem] text-[var(--txt2)]">{chapter.title}</p>
          {total > 1 && (
            <div className="flex shrink-0 items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => goTo(safeIndex - 1)}
                disabled={safeIndex === 0}
                aria-label="Poprzedni rozdział"
                data-testid="button-previous"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => goTo(safeIndex + 1)}
                disabled={isLast}
                aria-label="Następny rozdział"
                data-testid="button-next"
                data-tour="chapter-next"
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
        <ReadingProgress index={safeIndex} total={total} articleRef={articleRef} watchRef={rootRef} offset={coverH} />
      </div>

      {/* Spis rozdziałów — zwinięty, żeby nie odciągał od czytania */}
      {total > 1 && (
        <details className="border-b border-[var(--line)] mt-6">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-between gap-4 py-4 min-h-[44px] select-none">
            <span className="label">Spis rozdziałów · {total}</span>
            <span className="module-i" aria-hidden="true">
              <svg viewBox="0 0 16 16" focusable="false">
                <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <ol className="pb-4 grid">
            {chapters.map((c, i) => {
              const current = i === safeIndex;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={current ? "step" : undefined}
                    className={`w-full grid grid-cols-[36px_minmax(0,1fr)_20px] items-center gap-3 py-2.5 min-h-[44px] text-left text-[.9375rem] rounded-md transition-[transform,color] duration-150 active:scale-[.99] ${
                      current ? "text-[var(--txt)]" : "text-[var(--txt2)] hover:text-[var(--txt)]"
                    }`}
                    data-testid={`chapter-nav-${i}`}
                  >
                    <span className={`font-mono text-[.75rem] ${current ? "text-[var(--puls)]" : "text-[var(--label)]"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate">{c.title}</span>
                    {completed.has(c.id) ? (
                      <Check className="h-4 w-4 text-[var(--puls)]" aria-label="Przeczytany" />
                    ) : (
                      <span />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      <AnimatePresence initial={false}>
        {showResumeNote && resumed && (
          <motion.div
            key="resume-note"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15, ease: "easeIn" } }}
            className="mt-6 flex items-center gap-2 border-b border-[var(--line)] pb-3 text-[.875rem] text-[var(--txt2)]"
            role="status"
            data-testid="resume-note"
          >
            <p className="min-w-0 flex-1">
              Wracasz do rozdziału <span className="num">{resumed.chapter}</span> z <span className="num">{resumed.total}</span>
              <span aria-hidden="true"> · </span>
              <button
                type="button"
                onClick={() => {
                  setNoteOpen(false);
                  goTo(0);
                }}
                className="inline-flex min-h-[44px] items-center text-[var(--txt)] underline decoration-[var(--line2)] underline-offset-4 transition-[transform,color] duration-150 hover:decoration-[var(--txt2)] active:scale-[.97]"
                data-testid="button-restart-lecture"
              >
                Zacznij od początku
              </button>
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNoteOpen(false)}
              aria-label="Zamknij informację"
              className="shrink-0"
              data-testid="button-dismiss-resume"
            >
              <X aria-hidden="true" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={topRef} className="pt-10" />

      <AnimatePresence mode="wait" initial={false} custom={direction} onExitComplete={scrollToChapterTop}>
        <motion.article
          ref={articleRef}
          key={chapter.id}
          custom={direction}
          variants={chapterVariants}
          initial="enter"
          animate="center"
          exit="exit"
          aria-labelledby={showChapterTitle ? "chapter-title" : undefined}
        >
          <ChapterHeader
            index={safeIndex}
            total={total}
            title={chapter.title}
            showTitle={showChapterTitle}
            decorate={!chapterHasVisual(chapter.contentMd)}
            rhythm={rhythm}
            showLine={safeIndex > 0}
          />

          <div className="prose-hk">
            {chapter.analogy && (
              <blockquote data-testid="chapter-analogy">
                <p className="label">Analogia</p>
                <p>{chapter.analogy}</p>
              </blockquote>
            )}
            <LectureContent html={html} canSeeGaps={canSeeGaps} />
            {chapter.keyPoints && chapter.keyPoints.length > 0 && (
              <section className="border-t border-[var(--line)] pt-6 mt-10" aria-label="Najważniejsze">
                <p className="label mb-3">Najważniejsze</p>
                <ul>
                  {chapter.keyPoints.map((point, i) => (
                    <li key={i} data-testid={`key-point-${i}`}>{point}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Koniec rozdziału: dalej albo sprawdzenie się */}
          {!isLast ? (
            <nav className="mt-14 border-t border-[var(--line)] pt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Rozdziały">
              {safeIndex > 0 ? (
                <Button variant="ghost" onClick={() => goTo(safeIndex - 1)} className="-ml-3">
                  <ChevronLeft aria-hidden="true" />
                  Wstecz
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={() => goTo(safeIndex + 1)} className="max-w-full" data-testid="button-next-bottom">
                <span className="truncate">Dalej: {nextChapter?.title}</span>
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          ) : (
            <section className="mt-16 border-t border-[var(--line)] pt-10 grid gap-6" aria-labelledby="lecture-end" data-testid="lecture-end">
              <div className="grid gap-3">
                <p className="label label--g">Koniec wykładu</p>
                <h2 id="lecture-end" className="h3">
                  {check ? check.title : next ? "Czas na następny temat" : "To był ostatni wykład kursu"}
                </h2>
                {check && <p className="muted">{check.note}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {check ? (
                  <Button asChild onClick={finish} data-testid="button-lecture-quiz">
                    <Link href={check.href}>
                      Rozwiąż pytania
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : next ? (
                  <Button asChild onClick={finish} data-testid="button-next-section">
                    <Link href={next.href}>
                      Następny temat
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild onClick={finish}>
                    <Link href="/dashboard">Zobacz swój postęp</Link>
                  </Button>
                )}
                {total > 1 && (
                  <Button variant="ghost" onClick={() => goTo(safeIndex - 1)}>
                    <ChevronLeft aria-hidden="true" />
                    Poprzedni rozdział
                  </Button>
                )}
              </div>
              {check && next && (
                <Link
                  href={next.href}
                  className="group mt-4 grid grid-cols-[minmax(0,1fr)_28px] items-center gap-4 border-t border-b border-[var(--line)] py-5 no-underline text-inherit transition-transform duration-[120ms] ease-out active:scale-[.995]"
                  data-testid="link-next-section"
                >
                  <span className="grid gap-1 min-w-0">
                    <span className="label">Następny temat{next.label ? ` · ${next.label}` : ""}</span>
                    <span className="font-heading text-[1.125rem] leading-snug tracking-[-0.012em] text-[var(--txt)] truncate">
                      {next.title}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-[var(--label)] transition-colors group-hover:text-[var(--txt)]" aria-hidden="true" />
                </Link>
              )}
            </section>
          )}
        </motion.article>
      </AnimatePresence>
    </div>
  );
}
