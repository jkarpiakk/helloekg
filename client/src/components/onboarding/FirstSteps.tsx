/**
 * „Pierwsze kroki” — karta na górze panelu. Każdy punkt odhacza się z prawdziwych danych:
 * - wykład: kliknięcie w punkt / „Zaczynam” w instrukcji, albo postęp > 0 w którejkolwiek sekcji,
 * - 5 pytań: `stats.totalAttempts` z GET /api/progress,
 * - powtórka: kliknięcie w punkt (serwer nie udostępnia liczby odpowiedzi w trybie powtórki),
 * - uwaga: kliknięcie w punkt (serwer nie udostępnia listy zgłoszeń użytkownika).
 * Znika, gdy wszystko zrobione albo po „Ukryj” (zapamiętane na użytkownika).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { rise, stagger } from "@/lib/motion";
import {
  STEPS_EVENT,
  firstLectureHref,
  markStep,
  openWelcome,
  readSteps,
  stepsKey,
  useCurrentUser,
  useModules,
  type StepFlag,
} from "./onboardingStore";

const ANSWERS_GOAL = 5;

/** Wejście tylko przy pierwszym narysowaniu w tej sesji — powrót na panel nie powtarza animacji */
let entryPlayed = false;

interface Item {
  key: string;
  title: string;
  desc: string;
  href: string;
  done: boolean;
  meta?: string;
  flag?: StepFlag;
}

export default function FirstSteps() {
  const user = useCurrentUser();
  const userId = user?.id;

  const { data: modules, isLoading: modulesLoading } = useModules(!!userId);
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ["/api/progress"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/progress");
      return response.json() as Promise<{ stats?: { totalAttempts?: number } }>;
    },
    enabled: !!userId,
  });

  const [flags, setFlags] = useState(() => (userId ? readSteps(userId) : {}));
  useEffect(() => {
    if (!userId) return;
    const sync = () => setFlags(readSteps(userId));
    sync();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === stepsKey(userId)) sync();
    };
    window.addEventListener(STEPS_EVENT, sync);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(STEPS_EVENT, sync);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", sync);
    };
  }, [userId]);

  const items: Item[] = useMemo(() => {
    const sections = (modules ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap((m) => m.sections.slice().sort((a, b) => a.order - b.order));
    const anyProgress = sections.some((s) => (s.completionPercentage ?? 0) > 0 || !!s.lastActivity);
    const firstQuiz = sections.find((s) => (s.questionCount ?? 0) > 0);
    const answered = Number(progressData?.stats?.totalAttempts ?? 0) || 0;

    return [
      {
        key: "lecture",
        title: "Przeczytaj pierwszy wykład",
        desc: "Rozdział po rozdziale, na końcu „Przypomnij sobie”.",
        href: firstLectureHref(modules),
        done: !!flags.lecture || anyProgress,
        flag: "lecture",
      },
      {
        key: "answers",
        title: `Odpowiedz na ${ANSWERS_GOAL} pytań`,
        desc: "Po każdej odpowiedzi zobaczysz wyjaśnienie.",
        href: firstQuiz ? `/quiz?sectionId=${firstQuiz.id}` : "/modules",
        done: answered >= ANSWERS_GOAL,
        meta: `${Math.min(answered, ANSWERS_GOAL)}/${ANSWERS_GOAL}`,
      },
      {
        key: "review",
        title: "Zrób pierwszą powtórkę",
        desc: "Wracają tu pytania, w których się pomylisz.",
        href: "/quiz?mode=review",
        done: !!flags.review,
        flag: "review",
      },
      {
        key: "feedback",
        title: "Zgłoś pierwszą uwagę",
        desc: "Coś nie działa albo jest niejasne? Napisz nam.",
        href: "/zgloszenie?area=inne",
        done: !!flags.feedback,
        flag: "feedback",
      },
    ];
  }, [modules, progressData, flags]);

  const [animateIn] = useState(() => !entryPlayed);
  useEffect(() => {
    entryPlayed = true;
  }, []);

  const doneCount = items.filter((i) => i.done).length;
  const ready = !!userId && !modulesLoading && !progressLoading;
  const visible = ready && !flags.dismissed && doneCount < items.length;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.section
          key="first-steps"
          className="surface p-5 sm:p-6"
          aria-labelledby="first-steps-title"
          data-testid="first-steps"
          variants={rise}
          initial={animateIn ? "hidden" : false}
          animate="show"
          exit={{ opacity: 0, y: 12, transition: { type: "spring", bounce: 0, duration: 0.3 } }}
        >
          <header className="flex items-center justify-between gap-4">
            <h2 id="first-steps-title" className="label label--g">
              Pierwsze kroki
            </h2>
            <div className="flex items-center gap-1">
              <span className="num text-[15px] text-[var(--txt)]" aria-label={`Zrobione ${doneCount} z ${items.length}`}>
                {doneCount}/{items.length}
              </span>
              <button
                type="button"
                onClick={() => markStep(userId, "dismissed")}
                className="ml-2 inline-flex h-11 items-center rounded-full px-3 text-[14px] text-[var(--txt2)] transition-[transform,color] duration-150 hover:text-[var(--txt)] active:scale-[.97]"
                aria-label="Ukryj pierwsze kroki"
                data-testid="first-steps-hide"
              >
                Ukryj
              </button>
            </div>
          </header>

          <div
            className="progress mt-3"
            role="progressbar"
            aria-label="Pierwsze kroki"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={doneCount}
          >
            <span style={{ width: `${(doneCount / items.length) * 100}%` }} />
          </div>

          <motion.ul className="mt-4 border-t border-[var(--line)]" variants={stagger(0.04)}>
            {items.map((item) => (
              <motion.li key={item.key} variants={rise} className="border-b border-[var(--line)]">
                <Link
                  href={item.href}
                  onClick={() => item.flag && markStep(userId, item.flag)}
                  className="grid min-h-[64px] grid-cols-[28px_minmax(0,1fr)_auto_20px] items-center gap-3.5 py-3.5 text-inherit no-underline transition-transform duration-100 ease-out active:scale-[.995] sm:gap-4"
                  data-testid={`first-step-${item.key}`}
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full border transition-[background-color,border-color] duration-300 ${
                      item.done
                        ? "border-[var(--puls)] bg-[var(--puls)] text-[var(--on-puls)]"
                        : "border-[var(--line2)] text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <b
                      className={`font-heading text-[16px] font-medium leading-snug tracking-[-0.01em] ${
                        item.done ? "text-[var(--txt2)] line-through decoration-[var(--txt3)]" : "text-[var(--txt)]"
                      }`}
                    >
                      {item.title}
                    </b>
                    <span className="text-[14px] text-[var(--txt2)]">{item.desc}</span>
                    <span className="sr-only">{item.done ? "Zrobione." : "Do zrobienia."}</span>
                  </span>
                  <span className="label num">{item.meta && !item.done ? item.meta : ""}</span>
                  <ChevronRight className="h-4 w-4 text-[var(--txt3)]" aria-hidden="true" />
                </Link>
              </motion.li>
            ))}
          </motion.ul>

          <button
            type="button"
            onClick={openWelcome}
            className="mt-3 inline-flex min-h-[44px] items-center text-[14px] text-[var(--txt2)] underline decoration-[var(--line2)] underline-offset-4 transition-colors hover:text-[var(--txt)]"
            data-testid="first-steps-welcome"
          >
            Obejrzyj instrukcję jeszcze raz
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
