import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ProgressLine } from "@/components/dashboard/ProgressCard";
import { apiRequest } from "@/lib/queryClient";
import { spring } from "@/lib/motion";

interface LectureChapter {
  id: string;
  title: string;
  contentMd: string;
  analogy?: string | null;
  keyPoints?: string[] | null;
  visual?: string | null;
  order: number;
}

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
  onComplete?: () => void;
}

/**
 * Markdown → bezpieczny HTML. Domyślny profil DOMPurify (bez skryptów, handlerów, ramek),
 * plus <details>/<summary>, których używają wykłady. Atrybut style wycinamy — wygląd daje .prose-hk.
 */
function renderMarkdown(md: string): string {
  try {
    const raw = marked.parse(md ?? "", { async: false }) as string;
    const clean = DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["details", "summary"],
      FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "iframe"],
      FORBID_ATTR: ["style"],
    });
    return clean.replace(/<img /g, '<img loading="lazy" decoding="async" ');
  } catch {
    return DOMPurify.sanitize(md ?? "", { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
}

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

export function LectureNavigation({ sectionId, sectionTitle, hasLecture, check, next, onComplete }: LectureNavigationProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(readHashIndex);
  const [direction, setDirection] = useState(1);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const topRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["/api/sections", sectionId, "chapters"],
    queryFn: () => apiRequest("GET", `/api/sections/${sectionId}/chapters`).then((res) => res.json()),
    enabled: hasLecture !== false,
    retry: false,
  });

  const chapters = useMemo<LectureChapter[]>(
    () => (Array.isArray(data) ? (data as LectureChapter[]).slice().sort((a, b) => a.order - b.order) : []),
    [data],
  );
  const total = chapters.length;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const chapter = chapters[safeIndex];
  const isLast = safeIndex === total - 1;
  const html = useMemo(() => (chapter ? renderMarkdown(chapter.contentMd) : ""), [chapter]);

  // Nowa sekcja → od pierwszego rozdziału (chyba że link wskazuje konkretny)
  useEffect(() => {
    setIndex(readHashIndex());
    setCompleted(new Set());
  }, [sectionId]);

  // Numer rozdziału w adresie: odświeżenie strony nie gubi miejsca
  useEffect(() => {
    if (!total) return;
    const hash = safeIndex > 0 ? `#rozdzial-${safeIndex + 1}` : "";
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [safeIndex, total]);

  const scrollToChapterTop = useCallback(() => {
    const el = topRef.current;
    if (!el) return;
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 64;
    const barH = barRef.current?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - navH - barH - 16;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "auto" });
  }, []);

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

  if (isLoading && hasLecture !== false) {
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

  const progress = ((safeIndex + 1) / total) * 100;
  const showChapterTitle = !(total === 1 && chapter.title.trim() === sectionTitle.trim());
  const nextChapter = chapters[safeIndex + 1];

  return (
    <div data-testid="lecture">
      {/* Belka rozdziałów: przyklejona pod nawigacją, treść przewija się pod spodem */}
      {total > 1 && (
        <div
          ref={barRef}
          className="material-bar sticky top-[var(--nav-h)] z-30 mx-[calc(50%-50vw)] border-b border-[var(--line)]"
        >
          <div className="wrap wrap--narrow flex items-center gap-3 py-2.5">
            <p className="label num shrink-0" aria-live="polite" data-testid="chapter-counter">
              Rozdział {safeIndex + 1}/{total}
            </p>
            <p className="min-w-0 flex-1 truncate text-[14px] text-[var(--txt2)]">{chapter.title}</p>
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
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          <ProgressLine value={progress} label="Postęp w wykładzie" className="rounded-none h-[2px]" />
        </div>
      )}

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
                    className={`w-full grid grid-cols-[36px_minmax(0,1fr)_20px] items-center gap-3 py-2.5 min-h-[44px] text-left text-[15px] rounded-md transition-[transform,color] duration-150 active:scale-[.99] ${
                      current ? "text-[var(--txt)]" : "text-[var(--txt2)] hover:text-[var(--txt)]"
                    }`}
                    data-testid={`chapter-nav-${i}`}
                  >
                    <span className={`font-mono text-[12px] ${current ? "text-[var(--puls)]" : "text-[var(--label)]"}`}>
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

      <div ref={topRef} className="pt-10" />

      <AnimatePresence mode="wait" initial={false} custom={direction} onExitComplete={scrollToChapterTop}>
        <motion.article
          key={chapter.id}
          custom={direction}
          variants={chapterVariants}
          initial="enter"
          animate="center"
          exit="exit"
          aria-labelledby={showChapterTitle ? "chapter-title" : undefined}
        >
          {showChapterTitle && (
            <header className="grid gap-3 mb-8">
              {total > 1 && <p className="label label--g">Rozdział {safeIndex + 1}</p>}
              <h2 id="chapter-title" className="h2" data-testid="current-chapter-title">
                {chapter.title}
              </h2>
            </header>
          )}

          <div className="prose-hk">
            {chapter.analogy && (
              <blockquote data-testid="chapter-analogy">
                <p className="label">Analogia</p>
                <p>{chapter.analogy}</p>
              </blockquote>
            )}
            <div className="prose-hk max-w-none" dangerouslySetInnerHTML={{ __html: html }} data-testid="chapter-content" />
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
                  <ChevronRight className="h-4 w-4 text-[var(--txt3)] transition-colors group-hover:text-[var(--txt)]" aria-hidden="true" />
                </Link>
              )}
            </section>
          )}
        </motion.article>
      </AnimatePresence>
    </div>
  );
}
