import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, ChevronRight, Lock } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { ProgressLine } from "@/components/dashboard/ProgressCard";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { rise, stagger } from "@/lib/motion";

interface ModuleSection {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  isLocked?: boolean;
  completionPercentage: number;
  lastActivity?: string | null;
  /** Opublikowane pytania w sekcji */
  questionCount?: number;
  /** Opublikowane rozdziały wykładu w sekcji */
  chapterCount?: number;
}

interface CourseModule {
  id: string;
  title: string;
  description?: string | null;
  order: number;
  isLocked?: boolean;
  completionPercentage: number;
  sections: ModuleSection[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** „Moduł 3: Zawał serca” → „Zawał serca” — numer i tak stoi obok */
const cleanTitle = (title: string) => title.replace(/^\s*moduł\s*\d+\s*[:.–—-]\s*/i, "");

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

/** Co naprawdę jest w sekcji: „Wykład · 10 rozdziałów · 20 pytań” */
function sectionContent(s: ModuleSection) {
  const ch = s.chapterCount ?? 0;
  const q = s.questionCount ?? 0;
  const parts: string[] = [];
  if (ch > 0) parts.push(ch === 1 ? "Wykład" : `Wykład · ${ch} ${plural(ch, "rozdział", "rozdziały", "rozdziałów")}`);
  if (q > 0) parts.push(`${q} ${plural(q, "pytanie", "pytania", "pytań")}`);
  return parts.join(" · ");
}

/**
 * Postęp modułu liczony tylko z sekcji z pytaniami — postęp to odsetek opanowanych pytań,
 * więc sekcja z samym wykładem zaniżałaby wynik na zawsze.
 */
function moduleProgress(sections: ModuleSection[]) {
  const withQ = sections.filter((s) => (s.questionCount ?? 0) > 0);
  if (!withQ.length) return null;
  return withQ.reduce((acc, s) => acc + (s.completionPercentage || 0), 0) / withQ.length;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Modules() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    return hash.startsWith("#m-") ? new Set([hash.slice(3)]) : new Set();
  });

  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);

  const { data: modules, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json() as Promise<CourseModule[]>;
    },
    enabled: isAuthenticated,
    // Postęp zmienia się po każdym quizie — przy wejściu na ekran zawsze dociągnij świeży
    refetchOnMount: "always",
  });

  const sorted = useMemo(
    () =>
      (modules ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((m) => ({ ...m, sections: m.sections.slice().sort((a, b) => a.order - b.order) })),
    [modules],
  );

  // Wejście z linku #m-… (np. z panelu postępu): przewiń do otwartego modułu
  useEffect(() => {
    if (!sorted.length) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#m-")) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [sorted.length]);

  const toggle = (id: string, open: boolean) =>
    setOpenIds((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="wrap pt-12 pb-24 sm:pt-16">
      <header className="grid gap-4 mb-10 sm:mb-14">
        <p className="label">Kurs EKG{sorted.length ? ` · ${sorted.length} ${plural(sorted.length, "moduł", "moduły", "modułów")}` : ""}</p>
        <h1 className="h1">Kurs</h1>
        <p className="lead">
          Otwórz moduł, przeczytaj wykład i od razu sprawdź się w pytaniach. Postęp liczymy z twoich odpowiedzi.
        </p>
      </header>

      {isError && (
        <div className="grid gap-4 justify-items-start py-8 border-t border-[var(--line)]">
          <p className="muted">Nie udało się wczytać kursu. Sprawdź połączenie i spróbuj jeszcze raz.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Spróbuj ponownie</Button>
        </div>
      )}

      {!isError && sorted.length === 0 && (
        <p className="muted py-8 border-t border-[var(--line)]">
          Nie masz jeszcze dostępu do żadnego modułu.
        </p>
      )}

      {sorted.length > 0 && (
        <motion.div
          className="border-t border-[var(--line)]"
          variants={stagger(0.04)}
          initial="hidden"
          animate="show"
        >
          {sorted.map((module, mi) => {
            const progress = moduleProgress(module.sections);
            const count = module.sections.length;
            const lectures = module.sections.filter((s) => (s.chapterCount ?? 0) > 0).length;
            const questions = module.sections.reduce((acc, s) => acc + (s.questionCount ?? 0), 0);
            const metaParts: string[] = [];
            if (lectures) metaParts.push(`${lectures} ${plural(lectures, "wykład", "wykłady", "wykładów")}`);
            if (questions) metaParts.push(`${questions} ${plural(questions, "pytanie", "pytania", "pytań")}`);
            if (progress !== null) metaParts.push(`${Math.round(progress)}%`);
            const meta = module.isLocked ? "Zablokowany" : metaParts.join(" · ") || "Wkrótce";
            const isOpen = openIds.has(module.id);

            return (
              <motion.details
                key={module.id}
                id={`m-${module.id}`}
                variants={rise}
                open={isOpen}
                onToggle={(e) => toggle(module.id, (e.currentTarget as HTMLDetailsElement).open)}
                className="border-b border-[var(--line)] scroll-mt-24"
                data-testid={`module-${module.id}`}
              >
                <summary
                  data-tour={mi === 0 ? "module-first" : undefined}
                  className="group list-none [&::-webkit-details-marker]:hidden cursor-pointer grid grid-cols-[28px_minmax(0,1fr)_28px] sm:grid-cols-[48px_minmax(0,1fr)_auto_28px] items-center gap-3 sm:gap-5 py-5 sm:py-6 transition-transform duration-[120ms] ease-out active:scale-[.995] select-none"
                >
                  <span className="label label--g num">{pad(mi + 1)}</span>
                  <span className="row__t">
                    <b>{cleanTitle(module.title)}</b>
                    <span className="label !text-[11px] sm:hidden mt-1">{meta}</span>
                  </span>
                  <span className="label hidden sm:inline-flex items-center gap-2">
                    {module.isLocked && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                    {meta}
                  </span>
                  <span className="module-i">
                    {module.isLocked ? <Lock aria-hidden="true" /> : <PlusIcon />}
                  </span>
                </summary>

                <div className="pb-8 grid gap-8 sm:gap-10 sm:pl-[60px]">
                  {module.description && (
                    <p className="text-[16px] sm:text-[17px] leading-[1.7] text-[var(--txt2)] max-w-[42em]">
                      {module.description}
                    </p>
                  )}

                  {module.isLocked ? (
                    <p className="muted pb-2">Ukończ poprzedni moduł, żeby odblokować ten.</p>
                  ) : count === 0 ? (
                    <p className="muted pb-2">W tym module nie ma jeszcze materiałów.</p>
                  ) : (
                    <div className="grid gap-3">
                      <h3 className="label">Tematy</h3>
                      <ul className="rows [&>li:last-child]:border-b-0">
                        {module.sections.map((section, si) => (
                          <SectionRow
                            key={section.id}
                            index={si + 1}
                            section={section}
                            tourFirst={section === module.sections.find((x) => (x.chapterCount ?? 0) > 0)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.details>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function SectionRow({ index, section, tourFirst }: { index: number; section: ModuleSection; tourFirst?: boolean }) {
  const pct = Math.round(section.completionPercentage || 0);
  const hasLecture = (section.chapterCount ?? 0) > 0;
  const hasQuestions = (section.questionCount ?? 0) > 0;
  const isEmpty = !hasLecture && !hasQuestions;
  const done = hasQuestions && pct >= 100;
  const lectureHref = `/lecture/${section.id}`;
  const quizHref = `/quiz?sectionId=${section.id}`;
  // Wykład ma pierwszeństwo; sekcja z samymi pytaniami prowadzi prosto do quizu
  const primaryHref = hasLecture ? lectureHref : quizHref;
  const content = sectionContent(section);

  return (
    <li
      className={`row group relative py-4 sm:py-5 grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[48px_minmax(0,1fr)_auto_28px] ${
        isEmpty ? "active:scale-100" : ""
      }`}
      data-testid={`section-${section.id}`}
      data-tour={tourFirst ? "section-first-lecture" : undefined}
    >
      <span className="row__n">
        {done ? (
          <span className="text-[var(--puls)] inline-flex">
            <Check className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Ukończone</span>
          </span>
        ) : (
          pad(index)
        )}
      </span>
      <span className="row__t gap-2">
        {isEmpty ? (
          <b className="!text-[1.0625rem] sm:!text-[1.1875rem] !leading-snug text-[var(--txt3)]">{section.title}</b>
        ) : (
          <Link
            href={primaryHref}
            className="text-[var(--txt)] no-underline after:absolute after:inset-0 after:content-[''] rounded-sm"
            data-testid={`section-link-${section.id}`}
          >
            <b className="!text-[1.0625rem] sm:!text-[1.1875rem] !leading-snug">{section.title}</b>
          </Link>
        )}
        <span className="!text-[14px] flex flex-wrap items-center gap-x-2">
          {isEmpty ? (
            <span>Materiały w przygotowaniu</span>
          ) : (
            <>
              <span>{content}</span>
              {hasQuestions && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="num">{pct}%</span>
                </>
              )}
            </>
          )}
        </span>
        {hasQuestions && <ProgressLine value={pct} label={`Postęp: ${section.title}`} className="max-w-[260px]" />}
      </span>
      <span className="relative z-10">
        {hasLecture && hasQuestions && (
          <Link href={quizHref} className="chip min-h-[44px]" data-testid={`section-quiz-${section.id}`}>
            Pytania
          </Link>
        )}
      </span>
      {isEmpty ? (
        <span className="hidden sm:block" />
      ) : (
        <ChevronRight
          className="hidden sm:block h-4 w-4 text-[var(--txt3)] transition-colors group-hover:text-[var(--txt)]"
          aria-hidden="true"
        />
      )}
    </li>
  );
}
