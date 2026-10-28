import { useEffect, useMemo } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LectureNavigation, type CheckLink, type NextSectionLink } from "@/components/LectureNavigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { LectureHero } from "@/components/lecture/LectureHero";
import OrderHint from "@/components/course/OrderHint";
import { chaptersQuery, countWords, pickRhythm, plural, readingMinutes, sortChapters } from "@/components/lecture/lectureData";

interface CourseSection {
  id: string;
  title: string;
  order: number;
  completionPercentage: number;
  questionCount?: number;
  chapterCount?: number;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
  sections: CourseSection[];
}

const cleanTitle = (title: string) => title.replace(/^\s*moduł\s*\d+\s*[:.–—-]\s*/i, "");

export default function DynamicLecture() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);

  // Nowy temat zaczyna się od góry strony
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [sectionId]);

  // Moduły z sekcjami: z nich bierzemy etykietę modułu i następny temat
  const { data: modules, isLoading, isError } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json() as Promise<CourseModule[]>;
    },
    enabled: isAuthenticated,
  });

  const ctx = useMemo(() => {
    if (!modules || !sectionId) return null;
    const hasLecture = (x: CourseSection) => (x.chapterCount ?? 0) > 0;
    const hasQuestions = (x: CourseSection) => (x.questionCount ?? 0) > 0;
    const flat = modules
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap((m, mi) => {
        const secs = m.sections.slice().sort((a, b) => a.order - b.order);
        let lectureNo = 0;
        return secs.map((s) => ({
          section: s,
          module: m,
          moduleNo: mi + 1,
          // Numer wykładu liczymy tylko po sekcjach, które mają wykład
          lectureNo: hasLecture(s) ? ++lectureNo : null,
        }));
      });
    const i = flat.findIndex((x) => x.section.id === sectionId);
    if (i === -1) return null;
    const current = flat[i];

    // „Sprawdź się”: pytania tej sekcji, a gdy ich nie ma — pytania utrwalające modułu
    let check: CheckLink | null = null;
    if (hasQuestions(current.section)) {
      check = {
        href: `/quiz?sectionId=${current.section.id}`,
        sectionId: current.section.id,
        title: "Sprawdź się: pytania do tego wykładu",
        note: `${current.section.questionCount} ${plural(current.section.questionCount ?? 0, "pytanie", "pytania", "pytań")}. Odpowiedzi od razu pokażą, co już umiesz, a co warto powtórzyć.`,
      };
    } else {
      const sameModule = flat.filter((x) => x.module.id === current.module.id && x.section.id !== current.section.id);
      const review =
        sameModule.find((x) => !hasLecture(x.section) && hasQuestions(x.section) && /pytania utrwal/i.test(x.section.title)) ??
        sameModule.find((x) => !hasLecture(x.section) && hasQuestions(x.section));
      if (review) {
        check = {
          href: `/quiz?sectionId=${review.section.id}`,
          sectionId: review.section.id,
          title: "Sprawdź się: pytania utrwalające do tego modułu",
          note: `Ten wykład nie ma osobnych pytań. ${review.section.questionCount} ${plural(review.section.questionCount ?? 0, "pytanie", "pytania", "pytań")} z całego modułu czeka w „${review.section.title}”.`,
        };
      }
    }

    // Następny temat z treścią (z pominięciem tego, do którego już prowadzi „Sprawdź się”)
    const after = flat
      .slice(i + 1)
      .find((x) => (hasLecture(x.section) || hasQuestions(x.section)) && x.section.id !== check?.sectionId);
    const next: NextSectionLink | null = after
      ? {
          href: hasLecture(after.section) ? `/lecture/${after.section.id}` : `/quiz?sectionId=${after.section.id}`,
          title: after.section.title,
          label: [
            after.module.id === current.module.id ? null : `Moduł ${after.moduleNo}`,
            hasLecture(after.section) ? "Wykład" : "Pytania",
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : null;
    return { ...current, check, next };
  }, [modules, sectionId]);

  // Te same rozdziały co w LectureNavigation (wspólny klucz → jedno zapytanie): do metadanych nagłówka
  const lectureKnown = ctx ? ctx.section.chapterCount === undefined || ctx.section.chapterCount > 0 : false;
  const { data: chapterData } = useQuery({
    ...chaptersQuery(sectionId ?? ""),
    enabled: isAuthenticated && !!sectionId && lectureKnown,
  });
  const meta = useMemo(() => {
    const chapters = sortChapters(chapterData);
    if (!chapters.length) return null;
    const n = chapters.length;
    const min = readingMinutes(countWords(chapters));
    return `${n} ${plural(n, "rozdział", "rozdziały", "rozdziałów")} · ~${min} min czytania`;
  }, [chapterData]);
  const topic = useMemo(() => (ctx ? pickRhythm(ctx.module.title, ctx.section.title) : null), [ctx]);

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!ctx || !sectionId) {
    return (
      <div className="wrap wrap--narrow pt-16 pb-24 grid gap-5 justify-items-start">
        <p className="label">Wykład</p>
        <h1 className="h2">{isError ? "Nie udało się wczytać wykładu" : "Nie ma takiego wykładu"}</h1>
        <p className="muted">
          {isError
            ? "Sprawdź połączenie i spróbuj jeszcze raz."
            : "Link może być nieaktualny albo ten temat nie jest jeszcze dostępny. Wybierz wykład z listy kursu."}
        </p>
        <Button asChild data-testid="button-back">
          <Link href="/modules">
            <ArrowLeft aria-hidden="true" />
            Wróć do kursu
          </Link>
        </Button>
      </div>
    );
  }

  const { section, module, moduleNo, lectureNo, check, next } = ctx;

  return (
    <div className="wrap wrap--narrow pt-6 pb-24 sm:pt-10">
      <Link
        href={`/modules#m-${module.id}`}
        className="inline-flex items-center gap-2 min-h-[44px] -ml-1 px-1 text-[15px] text-[var(--txt2)] no-underline transition-[color,transform] duration-150 hover:text-[var(--txt)] active:scale-[.97]"
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kurs
      </Link>

      {sectionId && <OrderHint sectionId={sectionId} />}
      <LectureHero
        label={`Moduł ${moduleNo} · ${lectureNo !== null ? `Wykład ${lectureNo}` : "Pytania"}`}
        title={section.title}
        moduleName={cleanTitle(module.title)}
        meta={meta}
        rhythm={topic?.rhythm ?? "sinus"}
        rhythmLabel={topic?.exact ?? false}
      />

      <LectureNavigation
        key={section.id}
        sectionId={section.id}
        sectionTitle={section.title}
        hasLecture={section.chapterCount === undefined ? undefined : section.chapterCount > 0}
        check={check}
        next={next}
        rhythm={topic?.rhythm}
      />
    </div>
  );
}
