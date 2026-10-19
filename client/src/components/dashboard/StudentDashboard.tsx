import { Component, Suspense, lazy, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { rise, stagger } from "@/lib/motion";
import ProgressCard, { ProgressLine } from "./ProgressCard";
import { isIntroModule } from "@/components/course/moduleArt";
import type { Certificate, UserProgress, WeakArea } from "@/types";

interface CourseSection {
  id: string;
  title: string;
  order: number;
  completionPercentage: number;
  lastActivity?: string | null;
  questionCount?: number;
  chapterCount?: number;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
  completionPercentage: number;
  sections: CourseSection[];
}

interface Eligibility {
  isEligible?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const hasLecture = (s: CourseSection) => (s.chapterCount ?? 0) > 0;
const hasQuestions = (s: CourseSection) => (s.questionCount ?? 0) > 0;

/** Postęp to odsetek opanowanych pytań — liczymy go tylko z sekcji, które mają pytania */
function moduleProgress(sections: CourseSection[]) {
  const withQ = sections.filter(hasQuestions);
  if (!withQ.length) return null;
  return withQ.reduce((acc, s) => acc + (s.completionPercentage || 0), 0) / withQ.length;
}

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

const cleanTitle = (title: string) => title.replace(/^\s*moduł\s*\d+\s*[:.–—-]\s*/i, "");

/* ── Onboarding (FirstSteps) ─────────────────────────────────────────────
 * Pliki tworzy osobno inny etap prac. `import.meta.glob` zwraca pusty obiekt, gdy pliku nie ma,
 * więc build i HMR działają także bez nich; gdy się pojawią, Vite sam je podepnie.
 * Ładowane leniwie (React.lazy + Suspense fallback null) i odgrodzone granicą błędu —
 * usterka w onboardingu nie może zabrać całego panelu postępu. */
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

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  // null = jeszcze nie ruszany: decyduje stan kursu (otwarte dla kogoś, kto nie zaczął modułu 1)

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

  const { data: certificateEligibility } = useQuery<Eligibility>({
    queryKey: ["/api/certificates/eligibility"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/certificates/eligibility");
      return response.json();
    },
  });

  const { data: myCertificates } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates/my"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/certificates/my");
      return response.json();
    },
  });

  const generateCertificateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/certificates/generate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/eligibility"] });
      toast({ title: "Certyfikat gotowy", description: "Znajdziesz go w panelu postępu." });
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się wygenerować certyfikatu",
        description: error?.message || "Spróbuj jeszcze raz za chwilę.",
        variant: "destructive",
      });
    },
  });

  const course = useMemo(() => {
    const sortedModules = (modules ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((m) => ({ ...m, sections: m.sections.slice().sort((a, b) => a.order - b.order) }));
    const flat = sortedModules.flatMap((m, mi) => {
      let lectureNo = 0;
      return m.sections.map((s) => ({
        section: s,
        module: m,
        moduleNo: mi + 1,
        lectureNo: hasLecture(s) ? ++lectureNo : null,
      }));
    });
    // Tylko sekcje, w których coś jest — „Kontynuuj” nigdy nie prowadzi do pustej
    const withContent = flat.filter((x) => hasLecture(x.section) || hasQuestions(x.section));
    // „Zrobione” = wszystkie pytania tematu opanowane (ostatnia odpowiedź na każde poprawna);
    // sam wykład nie zapisuje postępu
    const isDone = (s: CourseSection) => hasQuestions(s) && (s.completionPercentage || 0) >= 100;

    const lastActive = withContent
      .filter((x) => x.section.lastActivity)
      .sort((a, b) => new Date(b.section.lastActivity!).getTime() - new Date(a.section.lastActivity!).getTime())[0];

    let target: (typeof withContent)[number] | null = null;
    if (lastActive && !isDone(lastActive.section)) {
      target = lastActive;
    } else if (lastActive) {
      const from = withContent.indexOf(lastActive);
      target = withContent.slice(from + 1).find((x) => !isDone(x.section)) ?? null;
    }
    if (!target) target = withContent.find((x) => !isDone(x.section)) ?? null;

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
  const primaryIsQuiz = !targetHasLecture || targetStartedQuiz;
  const certificate = myCertificates?.[0];


  // „Metoda” (orkiestra) — dla tych, którzy nie skończyli jeszcze modułu wprowadzającego
  const introModule = course.modules.find((m) => isIntroModule(m.title)) ?? null;
  const introProgress = introModule ? moduleProgress(introModule.sections) : null;

  return (
    <motion.div className="wrap pt-12 pb-24 sm:pt-16" variants={stagger(0.05)} initial="hidden" animate="show">
      {/* Powitanie i prowadzenie po aplikacji: components/onboarding/Tour.tsx (montowane w App) */}

      {/* Hero jak na landingu: etykieta + tytuł + postęp po lewej, „Kontynuuj” z ilustracją po prawej */}
      <section
        className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 items-start mb-16 sm:mb-20"
        aria-labelledby="dashboard-title"
      >
        <motion.header className="grid gap-5 content-start lg:pt-6" variants={rise}>
          <p className="label label--g" data-testid="welcome-message">
            {user?.firstName ? `Cześć, ${user.firstName}` : "Cześć"}
          </p>
          <h1 id="dashboard-title" className="h1">Twój postęp</h1>
          <p className="lead max-w-[30em]">
            Tu widzisz, co masz za sobą i od czego zacząć dziś. Postęp to odsetek opanowanych pytań — tych, w których twoja ostatnia odpowiedź była poprawna.
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
            <Link href="/quiz?mode=exam" className="chip min-h-[44px]" data-testid="action-exam">
              Egzamin próbny
            </Link>
            <Link href="/modules" className="chip min-h-[44px]" data-testid="action-course">
              Cały kurs
            </Link>
          </nav>
        </motion.header>

        <motion.div variants={rise} className="min-w-0">
          {modulesError ? (
            <p className="muted border-t border-[var(--line)] pt-8">
              Nie udało się wczytać kursu. Odśwież stronę i spróbuj jeszcze raz.
            </p>
          ) : target ? (
            <section className="surface p-4 sm:p-5 grid gap-6" aria-labelledby="continue-title" data-testid="continue-card" data-tour="continue">
              <div className="grid gap-5 px-1 sm:px-3 pb-2 sm:pb-3">
                <p className="label label--g">
                  Kontynuuj · Moduł {target.moduleNo} · {target.lectureNo !== null ? `Wykład ${target.lectureNo}` : "Pytania"}
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
                      {target.section.questionCount} {plural(target.section.questionCount ?? 0, "pytanie", "pytania", "pytań")}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild data-testid="action-continue">
                    <Link href={primaryIsQuiz ? `/quiz?sectionId=${target.section.id}` : `/lecture/${target.section.id}`}>
                      {primaryIsQuiz ? (targetStartedQuiz ? "Wróć do pytań" : "Rozwiąż pytania") : "Czytaj wykład"}
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
                    Zacznij powtórkę
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
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <h2 id="modules-title" className="label">Moduły</h2>
                  <Link href="/modules" className="inline-flex min-h-11 items-center text-[14px] text-[var(--txt2)] hover:text-[var(--txt)]">
                    Otwórz kurs
                  </Link>
                </div>
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
                    <li
                      key={area.tag}
                      className="border-b border-[var(--line)] py-3 flex items-center justify-between gap-4 text-[15px]"
                    >
                      <span className="min-w-0 truncate text-[var(--txt)]">{area.tag}</span>
                      <span className="num text-[var(--txt2)] shrink-0">{Math.round(area.successRate * 100)}% poprawnych</span>
                    </li>
                  ))}
                </ul>
                <Link href="/quiz?mode=review" className="inline-flex min-h-11 items-center mt-2 text-[14px] text-[var(--puls)]">
                  Powtórz te pytania
                </Link>
              </motion.section>
            )}

            {certificate ? (
              <motion.section variants={rise} className="surface p-6 grid gap-3" aria-labelledby="cert-title">
                <p className="label label--g">Certyfikat</p>
                <h2 id="cert-title" className="h3">Twój certyfikat jest gotowy</h2>
                <p className="muted text-[15px]">
                  Wydany {new Date(certificate.issuedAt).toLocaleDateString("pl-PL")}
                </p>
                <div>
                  <Button asChild variant="outline" size="sm" data-testid="button-view-certificate">
                    <Link href={`/certificate/${certificate.certificateId}`}>Zobacz certyfikat</Link>
                  </Button>
                </div>
              </motion.section>
            ) : certificateEligibility?.isEligible ? (
              <motion.section variants={rise} className="surface p-6 grid gap-3" aria-labelledby="cert-title">
                <p className="label label--g">Certyfikat</p>
                <h2 id="cert-title" className="h3">Możesz odebrać certyfikat</h2>
                <p className="muted text-[15px]">Spełniasz warunki ukończenia kursu.</p>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateCertificateMutation.mutate()}
                    disabled={generateCertificateMutation.isPending}
                    data-testid="button-generate-certificate"
                  >
                    {generateCertificateMutation.isPending ? "Generuję…" : "Wygeneruj certyfikat"}
                  </Button>
                </div>
              </motion.section>
            ) : null}
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
