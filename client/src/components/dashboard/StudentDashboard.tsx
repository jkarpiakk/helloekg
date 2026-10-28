import { Component, Suspense, lazy, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { rise, stagger } from "@/lib/motion";
import ProgressCard, { ProgressLine } from "./ProgressCard";
import ExamCountDialog from "./ExamCountDialog";
import CertificateCard from "./CertificateCard";
import { pytania } from "@/lib/i18n";
import { isIntroModule } from "@/components/course/moduleArt";
import { courseItems, nextStep, type OrderModule } from "@/lib/courseOrder";
import type { UserProgress, WeakArea } from "@/types";

interface CourseSection {
  id: string;
  title: string;
  order: number;
  completionPercentage: number;
  lastActivity?: string | null;
  questionCount?: number;
  chapterCount?: number;
  /** Ostatnio otwarty rozdział wykładu (GET /api/modules) */
  lastChapter?: number | null;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
  completionPercentage: number;
  sections: CourseSection[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const hasLecture = (s: CourseSection) => (s.chapterCount ?? 0) > 0;
/** Wykład przeczytany do ostatniego rozdziału (albo tematu bez wykładu) */
const lectureFinished = (s: CourseSection) =>
  !hasLecture(s) || (s.lastChapter ?? 0) >= (s.chapterCount ?? 0);
const hasQuestions = (s: CourseSection) => (s.questionCount ?? 0) > 0;

/** Postęp to odsetek opanowanych pytań — liczymy go tylko z sekcji, które mają pytania */
function moduleProgress(sections: CourseSection[]) {
  const withQ = sections.filter(hasQuestions);
  if (!withQ.length) return null;
  return withQ.reduce((acc, s) => acc + (s.completionPercentage || 0), 0) / withQ.length;
}

const cleanTitle = (title: string) => title.replace(/^\s*moduł\s*\d+\s*[:.–—-]\s*/i, "");

/* ── Onboarding (FirstSteps) ─────────────────────────────────────────────
 * Pliki tworzy osobno inny etap prac. `import.meta.glob` zwraca pusty obiekt, gdy pliku nie ma,
 * więc build i HMR działają także bez nich; gdy się pojawią, Vite sam je podepnie.
 * Ładowane leniwie (React.lazy + Suspense fallback null) i odgrodzone granicą błędu —
 * usterka w onboardingu nie może zabrać całego ekranu Postępu. */
const onboardingLoaders = import.meta.glob("../onboarding/FirstSteps.tsx");
const Nothing: ComponentType = () => null;

function optionalLazy(name: "FirstSteps") {
  const load = onboardingLoaders[`../onboarding/${name}.tsx`];
  return lazy(async () => {
    if (!load) return { default: Nothing };
    try {
      const mod = (await load()) as Record<string, unknown>;
      return { default: ((mod.default ?? mod[name]) as ComponentType | undefined) ?? Nothing };
    } catch {
      return { default: Nothing };
    }
  });
}

const FirstSteps = optionalLazy("FirstSteps");

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}


/** „Czytaj dalej · Rozdział 4 z 9”, gdy kursant przerwał wykład w środku; inaczej „Czytaj wykład” */
function readLabel(section: { lastChapter?: number | null; chapterCount?: number }) {
  const total = section.chapterCount ?? 0;
  const last = section.lastChapter ? Math.min(section.lastChapter, total || section.lastChapter) : 0;
  return last > 1 && last <= total ? `Czytaj dalej · Rozdział ${last} z ${total}` : "Czytaj wykład";
}

export default function StudentDashboard() {
  const { user } = useAuth();
  // Egzamin próbny: wybór liczby pytań od razu tutaj, bez przystanku na /quiz
  const [examOpen, setExamOpen] = useState(false);

  // Moduły z sekcjami i postępem — z nich „Kontynuuj” i lista modułów
  const { data: modules, isLoading: modulesLoading, isError: modulesError } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json() as Promise<CourseModule[]>;
    },
    refetchOnMount: "always",
  });

  // Statystyki odpowiedzi i słabe obszary
  const { data: progressData } = useQuery({
    queryKey: ["/api/progress"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/progress");
      return response.json() as Promise<{ progress: unknown[]; stats: UserProgress; weakAreas: WeakArea[] }>;
    },
    refetchOnMount: "always",
  });

  const course = useMemo(() => {
    const sortedModules = (modules ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((m) => ({ ...m, sections: m.sections.slice().sort((a, b) => a.order - b.order) }));
    // Numer tematu = pozycja w module, tak jak na liście w Kursie („Moduł 01 · Temat 04”)
    const flat = sortedModules.flatMap((m, mi) =>
      m.sections.map((s, si) => ({
        section: s,
        module: m,
        moduleNo: mi + 1,
        sectionNo: si + 1,
      })),
    );
    // Tylko sekcje, w których coś jest — „Kontynuuj” nigdy nie prowadzi do pustej
    const withContent = flat.filter((x) => hasLecture(x.section) || hasQuestions(x.section));
    // „Zrobione” (do licznika) = wszystkie pytania tematu opanowane
    const isDone = (s: CourseSection) => hasQuestions(s) && (s.completionPercentage || 0) >= 100;
    // „Następny krok” — wspólna reguła kolejności kursu (lib/courseOrder): pierwszy nieprzerobiony
    // temat; „Pytania utrwalające” stoją na końcu modułu, więc wypadają dopiero po jego wykładach
    const step = nextStep(courseItems(sortedModules as unknown as OrderModule[]));
    const target = step ? withContent.find((x) => x.section.id === step.section.id) ?? null : null;

    const questionSections = flat.filter((x) => hasQuestions(x.section));
    const overall = questionSections.length
      ? questionSections.reduce((acc, x) => acc + (x.section.completionPercentage || 0), 0) / questionSections.length
      : 0;
    return {
      modules: sortedModules,
      target,
      overall,
      completed: questionSections.filter((x) => isDone(x.section)).length,
      total: questionSections.length,
      hasContent: withContent.length > 0,
    };
  }, [modules]);

  if (modulesLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const stats = progressData?.stats;
  const weakAreas = progressData?.weakAreas ?? [];
  const target = course.target;
  const targetHasLecture = target ? hasLecture(target.section) : false;
  const targetHasQuestions = target ? hasQuestions(target.section) : false;
  // Kto już odpowiadał na pytania w tym temacie, wraca do pytań; reszta zaczyna od wykładu.
  // lastActivity zapisuje każda odpowiedź — także błędna, która nie podnosi opanowania
  const targetStartedQuiz =
    targetHasQuestions && ((target?.section.completionPercentage || 0) > 0 || !!target?.section.lastActivity);
  // Najpierw wykład (dopóki nieprzeczytany do końca), potem pytania tego tematu
  const primaryIsQuiz = !targetHasLecture || (target ? lectureFinished(target.section) : false);


  // „Metoda” (orkiestra) — dla tych, którzy nie skończyli jeszcze modułu wprowadzającego
  const introModule = course.modules.find((m) => isIntroModule(m.title)) ?? null;
  const introProgress = introModule ? moduleProgress(introModule.sections) : null;

  return (
    <motion.div className="wrap pt-12 pb-24 sm:pt-16" variants={stagger(0.05)} initial="hidden" animate="show">
      {/* Powitanie i prowadzenie po aplikacji: components/onboarding/Tour.tsx (montowane w App) */}

      {/* Najpierw „Twój postęp” (tytuł, opis, postęp całego kursu), pod nim spokojnie „Następny krok” */}
      <section className="grid gap-10 mb-16 sm:mb-20" aria-labelledby="dashboard-title">
        <motion.header className="grid gap-5 content-start" variants={rise}>
          <p className="label label--g" data-testid="welcome-message">
            {user?.firstName ? `Cześć, ${user.firstName}` : "Cześć"}
          </p>
          <h1 id="dashboard-title" className="h1">Twój postęp</h1>
          <p className="lead max-w-[36em]">
            Tu widzisz, co masz za sobą i od czego zacząć dziś. Postęp to odsetek opanowanych pytań, czyli tych, w których twoja ostatnia odpowiedź była poprawna.
          </p>
          {!modulesError && course.total > 0 && (
            <div className="pt-4 max-w-[460px]">
              <div data-tour="overall-progress">
              <ProgressCard
                overallProgress={course.overall}
                completedSections={course.completed}
                totalSections={course.total}
              />
              </div>
            </div>
          )}
          <nav className="chips pt-2" aria-label="Szybkie akcje">
            <Link href="/quiz?mode=review" className="chip min-h-[44px]" data-testid="action-review">
              Powtórka
            </Link>
            <button type="button" className="chip min-h-[44px]" onClick={() => setExamOpen(true)} data-testid="action-exam">
              Egzamin próbny
            </button>
          </nav>
          <ExamCountDialog open={examOpen} onOpenChange={setExamOpen} />
        </motion.header>
        <motion.div variants={rise} className="min-w-0 max-w-[760px]">
          {modulesError ? (
            <p className="muted border-t border-[var(--line)] pt-8">
              Nie udało się wczytać kursu. Odśwież stronę i spróbuj jeszcze raz.
            </p>
          ) : target ? (
            <section className="border-t border-[var(--line)] pt-8 grid gap-6" aria-labelledby="continue-title" data-testid="continue-card" data-tour="continue">
              <div className="grid gap-5">
                <p className="label">
                  Następny krok · Moduł {pad(target.moduleNo)} · Temat {pad(target.sectionNo)}
                </p>
                <div className="grid gap-1">
                  <h2 id="continue-title" className="h3">{target.section.title}</h2>
                  <p className="muted text-[15px]">{cleanTitle(target.module.title)}</p>
                </div>
                {targetHasQuestions && (
                  <div className="grid gap-2 max-w-[420px]">
                    <ProgressLine value={target.section.completionPercentage} label="Opanowane w tym temacie" />
                    <p className="text-[14px] text-[var(--txt2)]">
                      <span className="num">{Math.round(target.section.completionPercentage || 0)}%</span> opanowane ·{" "}
                      {pytania(target.section.questionCount ?? 0)}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild data-testid="action-continue">
                    <Link href={primaryIsQuiz ? `/quiz?sectionId=${target.section.id}` : `/lecture/${target.section.id}`}>
                      {primaryIsQuiz
                        ? (targetStartedQuiz ? "Wróć do pytań" : "Rozwiąż pytania")
                        : readLabel(target.section)}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                  {primaryIsQuiz && targetHasLecture && (
                    <Button asChild variant="ghost">
                      <Link href={`/lecture/${target.section.id}`}>Wykład</Link>
                    </Button>
                  )}
                  {!primaryIsQuiz && targetHasQuestions && (
                    <Button asChild variant="ghost">
                      <Link href={`/quiz?sectionId=${target.section.id}`}>Od razu do pytań</Link>
                    </Button>
                  )}
                </div>
              </div>
            </section>
          ) : course.hasContent ? (
            <section className="surface p-6 sm:p-8 grid gap-4" aria-labelledby="continue-title" data-testid="continue-card" data-tour="continue">
              <p className="label label--g">Kurs ukończony</p>
              <h2 id="continue-title" className="h3">Wszystkie pytania opanowane</h2>
              <p className="muted">Utrwal wiedzę w powtórce albo sprawdź się w egzaminie próbnym.</p>
              <div>
                <Button asChild>
                  <Link href="/quiz?mode=review">
                    Otwórz powtórkę
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </section>
          ) : (
            <p id="continue-title" className="muted border-t border-[var(--line)] pt-8">
              Nie masz jeszcze dostępu do żadnego modułu.
            </p>
          )}
        </motion.div>
      </section>

      {/* Pierwsze kroki — po tym, co najważniejsze (tytuł + „Kontynuuj”) */}
      <div className="[&:not(:empty)]:mb-16 sm:[&:not(:empty)]:mb-20">
        <Quiet>
          <Suspense fallback={null}>
            <FirstSteps />
          </Suspense>
        </Quiet>
      </div>



      {!modulesError && (
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
          {/* Lewa kolumna: moduły */}
          <div className="grid gap-12 content-start min-w-0">
            {course.modules.length > 0 && (
              <motion.section variants={rise} aria-labelledby="modules-title">
                <h2 id="modules-title" className="label mb-4">Moduły</h2>
                <ul className="rows">
                  {course.modules.map((module, mi) => {
                    const progress = moduleProgress(module.sections);
                    const pct = Math.round(progress ?? 0);
                    return (
                      <li key={module.id} className="contents">
                        <Link
                          href={`/modules#m-${module.id}`}
                          className="row group py-4 sm:py-5 gap-3 sm:gap-5 grid-cols-[28px_minmax(0,1fr)_20px] sm:grid-cols-[48px_minmax(0,1fr)_auto_28px]"
                          data-testid={`module-progress-${module.id}`}
                        >
                          <span className="row__n">{pad(mi + 1)}</span>
                          <span className="row__t gap-2">
                            <b className="!text-[1.0625rem] sm:!text-[1.25rem] !leading-snug">{cleanTitle(module.title)}</b>
                            {progress !== null && (
                              <ProgressLine value={pct} label={`Postęp: ${cleanTitle(module.title)}`} className="max-w-[320px]" />
                            )}
                          </span>
                          <span className="num text-[15px] text-[var(--txt2)] hidden sm:block">{progress !== null ? `${pct}%` : ""}</span>
                          <ChevronRight
                            className="h-4 w-4 text-[var(--txt3)] transition-colors group-hover:text-[var(--txt)]"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </motion.section>
            )}
          </div>

          {/* Prawa kolumna: liczby z odpowiedzi */}
          <aside className="grid gap-12 content-start" aria-label="Podsumowanie">
            {stats && stats.totalAttempts > 0 && (
              <motion.section variants={rise} aria-labelledby="stats-title">
                <h2 id="stats-title" className="label mb-4">Twoje odpowiedzi</h2>
                <dl className="grid grid-cols-3 border-t border-[var(--line)]">
                  <Stat label="Odpowiedzi" value={String(stats.totalAttempts)} testId="stat-attempts" />
                  <Stat label="Poprawne" value={`${Math.round(stats.successRate * 100)}%`} testId="stat-success" />
                  <Stat label="Śr. czas" value={`${Math.round(stats.avgTime / 1000)} s`} testId="stat-time" />
                </dl>
              </motion.section>
            )}

            {weakAreas.length > 0 && (
              <motion.section variants={rise} aria-labelledby="weak-title">
                <h2 id="weak-title" className="label mb-4">Do poprawy</h2>
                <ul className="rows">
                  {weakAreas.slice(0, 3).map((area) => (
                    <li key={area.sectionId ?? area.tag} className="border-b border-[var(--line)]">
                      <Link
                        href={area.sectionId ? `/quiz?sectionId=${area.sectionId}` : "/quiz?mode=review"}
                        className="flex min-h-11 items-center justify-between gap-4 py-3 text-[15px] no-underline transition-[color,transform] duration-150 hover:text-[var(--txt)] active:scale-[.99]"
                      >
                        <span className="min-w-0 truncate text-[var(--txt)]">{area.tag}</span>
                        <span className="num text-[var(--txt2)] shrink-0">{Math.round(area.successRate * 100)}% poprawnych</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/quiz?mode=review" className="inline-flex min-h-11 items-center mt-2 text-[14px] text-[var(--puls)]">
                  Otwórz powtórkę
                </Link>
              </motion.section>
            )}

            <CertificateCard />
          </aside>
        </div>
      )}
    </motion.div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="grid gap-1 py-4 pr-3">
      <dt className="text-[13px] text-[var(--txt2)]">{label}</dt>
      <dd className="num text-[1.5rem] leading-none text-[var(--txt)]" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
