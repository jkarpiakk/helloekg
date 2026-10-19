import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Lock, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeMarkdown } from "@/lib/sanitize";
import { rise, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { AnswerData, QuizResult } from "@/types";
import {
  isClinicalStepCorrect,
  type ClinicalCaseAnswer,
  type ClinicalCaseConfig,
  type ClinicalCaseStep,
  type ClinicalCaseStepAnswer,
} from "@shared/clinicalCase";
import HotspotQuestion from "./HotspotQuestion";
import PartialScore from "./PartialScore";

interface ClinicalCaseQuestionProps {
  config: ClinicalCaseConfig;
  /** Ziarno tasowania odpowiedzi w krokach — ten sam układ po powrocie do pytania */
  questionId: string;
  /** Obraz pytania, gdy import nie przeniósł go do konfiguracji */
  fallbackImageUrl?: string;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
  onImageClick?: (imageUrl: string, origin?: HTMLElement) => void;
}

const letter = (i: number) => String.fromCharCode(65 + i);
const pad = (n: number) => String(n).padStart(2, "0");

/** „Przypadek · 03:12 · SOR" — nad nagłówkiem przypadku (rysuje QuestionCard) */
export function caseKicker(config: ClinicalCaseConfig): string {
  return ["Przypadek", config.timeLabel, config.place].filter((x) => x && String(x).trim()).join(" · ");
}

/** Powtarzalne tasowanie (jak stableShuffle w studiu): ten sam tekst ziarna = ta sama kolejność */
function stableOrder(n: number, seedText: string): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  seed = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((seed / 4294967296) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Przypadek kliniczny — przebieg jak w „Przypadku 01" na landingu:
 * scenariusz i parametry na górze, potem kroki odsłaniane po kolei.
 * Odpowiedź w kroku od razu pokazuje poprawną opcję i wyjaśnienie; kolejny krok
 * odsłania się po „Dalej". Po ostatnim kroku odpowiedź trafia do quizu
 * (przycisk „Sprawdź"), serwer liczy wynik częściowy = trafione kroki / wszystkie,
 * a na końcu wyrasta złota rada z dyżuru i wynik każdego kroku.
 */
export default function ClinicalCaseQuestion({
  config,
  questionId,
  fallbackImageUrl,
  onChange,
  disabled,
  showResult,
  result,
  onImageClick,
}: ClinicalCaseQuestionProps) {
  const steps = config.steps ?? [];
  const imageUrl = config.imageUrl || fallbackImageUrl;
  const [answers, setAnswers] = useState<Record<string, ClinicalCaseStepAnswer>>({});
  /** Ile kroków widać (aktywny = ostatni widoczny) */
  const [revealed, setRevealed] = useState(1);
  /** Wskazanie w bieżącym kroku „hotspot", zanim kursant je zatwierdzi */
  const [pendingClick, setPendingClick] = useState<string[] | null>(null);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const reduce = useReducedMotion();

  const orders = useMemo(
    () => steps.map((s) => (s.kind === "single" ? stableOrder(s.answers.length, `${questionId}:${s.id}`) : [])),
    [steps, questionId],
  );

  const answeredCount = steps.filter((s) => answers[s.id]).length;
  const allAnswered = steps.length > 0 && answeredCount === steps.length;

  // Wynik z serwera ma pierwszeństwo; do tego czasu liczymy lokalnie z konfiguracji
  const stepOk = (s: ClinicalCaseStep) =>
    showResult && result?.feedback?.correctItems
      ? result.feedback.correctItems.includes(s.id)
      : isClinicalStepCorrect(s, answers[s.id]);

  const answerStep = (step: ClinicalCaseStep, a: ClinicalCaseStepAnswer) => {
    if (disabled || answers[step.id]) return;
    const next = { ...answers, [step.id]: a };
    setAnswers(next);
    setPendingClick(null);
    const complete = steps.every((s) => next[s.id]);
    if (complete) {
      const answer: ClinicalCaseAnswer = { type: "clinical_case", steps: steps.map((s) => next[s.id]) };
      // AnswerData z @shared/schema nie zna jeszcze tego wariantu — kształt z @shared/clinicalCase
      onChange(answer as unknown as AnswerData);
    }
  };

  const goNext = () => {
    setRevealed((r) => Math.min(steps.length, r + 1));
  };

  // Nowy krok wjeżdża pod poprzedni — przewiń tak, żeby jego pytanie było na górze ekranu
  useEffect(() => {
    if (revealed <= 1) return;
    const el = stepRefs.current[revealed - 1];
    const t = setTimeout(() => el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }), 80);
    return () => clearTimeout(t);
  }, [revealed, reduce]);

  const correctCount = steps.filter((s) => stepOk(s)).length;

  return (
    <div className="grid gap-6" data-testid="clinical-case">
      {/* Scenariusz */}
      {config.intro && (
        <div
          className="prose-hk max-w-[42em] text-[1rem] leading-[1.7] text-[var(--txt2)]"
          dangerouslySetInnerHTML={sanitizeMarkdown(config.intro)}
          data-testid="case-intro"
        />
      )}

      {/* Parametry jak na kardiomonitorze */}
      {config.vitals && config.vitals.length > 0 && (
        <dl
          className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4"
          aria-label="Parametry pacjenta"
          data-testid="case-vitals"
        >
          {config.vitals.map((v, i) => (
            <div key={i} className="bg-[var(--panel)] px-4 py-3">
              <dt className="label">{v.label}</dt>
              <dd className="num mt-1 text-[clamp(1.125rem,1rem+.5vw,1.375rem)] leading-tight text-[var(--txt)]">{v.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Zapis EKG przypadku — poza krokami „wskaż", tam jest planszą do dotykania */}
      {imageUrl && !steps.some((s, i) => s.kind === "hotspot" && i === revealed - 1 && !answers[s.id]) && (
        <button
          type="button"
          onClick={(e) => onImageClick?.(imageUrl, e.currentTarget)}
          className="group relative block w-full overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--ink)] transition-[transform,border-color] duration-200 ease-out hover:border-[var(--line2)] active:scale-[.99]"
          aria-label="Powiększ zapis EKG przypadku"
          data-testid="case-image"
        >
          <img src={imageUrl} alt="Zapis EKG przypadku" className="block max-h-[60vh] w-full object-contain" />
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--line2)] bg-[var(--panel)] px-3 py-1.5 text-[.75rem] text-[var(--txt2)]">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            Powiększ
          </span>
        </button>
      )}

      {/* Oś kroków */}
      <ol className="grid" aria-label="Kroki przypadku" data-testid="case-steps">
        {steps.map((step, i) => {
          const visible = i < revealed;
          const a = answers[step.id];
          const done = !!a;
          const ok = done && stepOk(step);
          const isLast = i === steps.length - 1;
          return (
            <li
              key={step.id}
              ref={(el) => (stepRefs.current[i] = el)}
              className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-4 scroll-mt-36"
              data-testid={`case-step-${i}`}
            >
              {/* Węzeł osi + linia do następnego kroku */}
              <div className="relative flex flex-col items-center" aria-hidden>
                <span
                  className={cn(
                    "z-[1] grid h-8 w-8 place-items-center rounded-full border font-mono text-[.75rem] transition-colors duration-300",
                    !visible && "border-[var(--line)] text-[var(--label)]",
                    visible && !done && "border-[var(--puls-deep)] text-[var(--puls)]",
                    done && ok && "border-[var(--puls-deep)] bg-[var(--tint)] text-[var(--puls)]",
                    done && !ok && "border-[color-mix(in_srgb,var(--alarm)_55%,transparent)] text-[var(--alarm)]",
                  )}
                >
                  {done ? ok ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <X className="h-4 w-4" strokeWidth={2.5} /> : visible ? pad(i + 1) : <Lock className="h-3.5 w-3.5" />}
                </span>
                {!isLast && (
                  <span className={cn("mt-1 w-px flex-1 transition-colors duration-300", done ? "bg-[var(--line2)]" : "bg-[var(--line)]")} />
                )}
              </div>

              <div className={cn("min-w-0", isLast ? "pb-0" : "pb-7")}>
                <p className="label flex min-h-8 items-center">
                  Krok {pad(i + 1)} / {pad(steps.length)}
                  {done && <span className="sr-only"> — {ok ? "dobrze" : "błędnie"}</span>}
                </p>

                {!visible ? (
                  <p className="text-[.875rem] text-[var(--txt2)]">Odsłoni się po odpowiedzi na poprzedni krok.</p>
                ) : (
                  <motion.div variants={rise} initial={i === 0 ? false : "hidden"} animate="show" className="grid gap-4">
                    <div
                      className="prose-hk max-w-none text-[var(--txt)]"
                      style={{ font: "500 clamp(1.1875rem,1.05rem + .6vw,1.5rem)/1.28 var(--font-heading)", letterSpacing: "-.014em" }}
                      dangerouslySetInnerHTML={sanitizeMarkdown(step.prompt)}
                    />

                    {step.kind === "single" ? (
                      <div className="grid gap-[10px]" role="group" aria-label={`Odpowiedzi — krok ${i + 1}`}>
                        {(orders[i] ?? []).map((idx, pos) => {
                          const opt = step.answers[idx];
                          const picked = a?.selectedIndex === idx;
                          const isRight = done && opt.isCorrect;
                          const isWrong = done && picked && !opt.isCorrect;
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={cn("opt", isRight && "is-right", isWrong && "is-wrong", done && !isRight && !isWrong && "is-dim")}
                              disabled={done || disabled}
                              aria-pressed={picked}
                              onClick={() => answerStep(step, { stepId: step.id, selectedIndex: idx })}
                              data-testid={`case-step-${i}-option-${pos}`}
                            >
                              <span className="opt__key" aria-hidden>
                                {letter(pos)}
                              </span>
                              <span>
                                <span className="sr-only">{letter(pos)}. </span>
                                {opt.text}
                                {isRight && <span className="sr-only"> — poprawna odpowiedź</span>}
                                {isWrong && <span className="sr-only"> — twoja odpowiedź, błędna</span>}
                              </span>
                              <span className="opt__mark" aria-hidden>
                                {isRight && <Check className="h-[18px] w-[18px]" strokeWidth={2.25} />}
                                {isWrong && <X className="h-[18px] w-[18px]" strokeWidth={2.25} />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : imageUrl ? (
                      <div className="grid gap-3">
                        <HotspotQuestion
                          config={{ imageUrl, hotspots: step.hotspots, allowMultiple: false }}
                          onChange={(d) => {
                            if (d.type !== "hotspot" || !d.clickCoordinates?.length) return setPendingClick(null);
                            // Pudło poza obszarami też da się zatwierdzić — liczy się wtedy jako błąd
                            setPendingClick(d.clickedHotspots.length ? d.clickedHotspots : ["poza"]);
                          }}
                          disabled={done || disabled}
                          showResult={done}
                          result={
                            done
                              ? ({ feedback: { incorrectItems: (a?.clickedHotspots ?? []).filter((id) => !step.hotspots.find((h) => h.id === id)?.isCorrect) } } as QuizResult)
                              : undefined
                          }
                        />
                        {!done && (
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!pendingClick || pendingClick.length === 0 || disabled}
                              onClick={() => answerStep(step, { stepId: step.id, clickedHotspots: pendingClick ?? [] })}
                              data-testid={`case-step-${i}-confirm`}
                            >
                              Zatwierdź wskazanie
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[.875rem] text-[var(--txt2)]">Ten krok wymaga zapisu EKG, którego jeszcze nie ma.</p>
                    )}

                    {/* Wyjaśnienie kroku — wyrasta pod odpowiedziami */}
                    <AnimatePresence initial={false}>
                      {done && (
                        <motion.div
                          key="explain"
                          variants={rise}
                          initial="hidden"
                          animate="show"
                          className="grid gap-3 border-t border-[var(--line)] pt-4"
                          aria-live="polite"
                          data-testid={`case-step-${i}-explanation`}
                        >
                          <p className="flex items-start gap-2.5 text-[1rem] font-medium leading-snug text-[var(--txt)]">
                            {ok ? (
                              <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--puls)]" strokeWidth={2.25} aria-hidden />
                            ) : (
                              <X className="mt-0.5 h-5 w-5 shrink-0 text-[var(--alarm)]" strokeWidth={2.25} aria-hidden />
                            )}
                            {ok ? "Dobrze." : "Nie tym razem."}
                          </p>
                          <div
                            className="prose-hk max-w-[46em] text-[.9375rem] text-[var(--txt2)]"
                            dangerouslySetInnerHTML={sanitizeMarkdown(step.explanation)}
                          />
                          {!isLast && revealed === i + 1 && (
                            <div className="pt-1">
                              <Button variant="outline" size="sm" onClick={goNext} className="gap-2" data-testid={`case-step-${i}-next`}>
                                Dalej: krok {pad(i + 2)}
                                <ArrowRight aria-hidden />
                              </Button>
                            </div>
                          )}
                          {isLast && !showResult && (
                            <p className="label">Wszystkie kroki za Tobą — sprawdź wynik przypadku.</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Podsumowanie: wynik kroków + złota rada */}
      <AnimatePresence>
        {showResult && allAnswered && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: spring }}
            className="grid gap-5"
            aria-label="Podsumowanie przypadku"
            data-testid="case-summary"
          >
            <div className="rounded-[14px] border border-[var(--line)]">
              <p className="label border-b border-[var(--line)] px-4 py-3">
                Wynik kroków
              </p>
              <ul>
                {steps.map((s, i) => {
                  const ok = stepOk(s);
                  return (
                    <li
                      key={s.id}
                      className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0"
                    >
                      <span className="font-mono text-[.75rem] text-[var(--label)]">{pad(i + 1)}</span>
                      <span
                        className="line-clamp-2 text-[.9375rem] text-[var(--txt)]"
                        dangerouslySetInnerHTML={sanitizeMarkdown(s.prompt)}
                      />
                      <span className={cn("inline-flex items-center gap-1.5 text-[.875rem]", ok ? "text-[var(--puls)]" : "text-[var(--alarm)]")}>
                        {ok ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
                        {ok ? "Dobrze" : "Błąd"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {config.takeaway && (
              <aside
                className="rounded-r-[10px] border-l-2 border-[var(--puls)] bg-[var(--tint)] px-[18px] py-[14px] text-[var(--txt)]"
                data-testid="case-takeaway"
              >
                <span className="label mb-1 block">Złota rada z dyżuru</span>
                <div
                  className="prose-hk max-w-none"
                  style={{ font: "500 clamp(1.0625rem,1rem + .3vw,1.25rem)/1.45 var(--font-heading)" }}
                  dangerouslySetInnerHTML={sanitizeMarkdown(config.takeaway)}
                />
              </aside>
            )}

            {result?.partialScore !== undefined && result.partialScore < 1 && (
              <PartialScore score={result.partialScore} correct={correctCount} total={steps.length} noun="kroków dobrze" />
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
