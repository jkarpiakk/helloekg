import { motion } from "framer-motion";
import { Check, Maximize2, X } from "lucide-react";
import { sanitizeMarkdown, sanitizeHtml } from "@/lib/sanitize";
import { rise } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { QuizQuestion, QuizResult, AnswerData } from "@/types";
import { QuestionRenderer } from "./questions";
import { caseKicker } from "./questions/ClinicalCaseQuestion";
import type { AnyQuestionConfig } from "@shared/clinicalCase";

interface QuestionCardProps {
  question: QuizQuestion;
  selectedAnswer: number | null;
  showExplanation: boolean;
  quizResult?: QuizResult;
  onAnswerSelect: (index: number) => void;
  onAnswerChange?: (answer: AnswerData) => void;
  /** Drugi argument: miniatura, z której wyrasta podgląd */
  onImageClick: (imageUrl: string, origin?: HTMLElement) => void;
  isSubmitting: boolean;
}

const letter = (i: number) => String.fromCharCode(65 + i);

/** Tytuł pytania w skali `.q__title` z landingu */
const titleStyle: React.CSSProperties = {
  font: "500 clamp(1.3125rem, 1.1rem + .9vw, 1.875rem)/1.22 var(--font-heading)",
  letterSpacing: "-.018em",
};

function QuestionImage({ url, onOpen }: { url: string; onOpen: (url: string, origin?: HTMLElement) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(url, e.currentTarget)}
      className="group relative mb-6 block w-full overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--ink)] transition-[transform,border-color] duration-200 ease-out hover:border-[var(--line2)] active:scale-[.99]"
      aria-label="Powiększ zapis EKG"
      data-testid="question-image"
    >
      <img src={url} alt="Zapis EKG" className="block max-h-[60vh] w-full object-contain" />
      <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--line2)] bg-[var(--panel)] px-3 py-1.5 text-[12px] text-[var(--txt2)] transition-colors duration-200 group-hover:text-[var(--txt)]">
        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        Powiększ
      </span>
    </button>
  );
}

export default function QuestionCard({
  question,
  selectedAnswer,
  showExplanation,
  quizResult,
  onAnswerSelect,
  onAnswerChange,
  onImageClick,
  isSubmitting,
}: QuestionCardProps) {
  const questionType = question.questionType || "multiple_choice";
  const isInteractiveType = questionType !== "multiple_choice" && !!question.questionConfig;
  const imagePosition = (question as QuizQuestion & { imagePosition?: string }).imagePosition;
  const anyConfig = question.questionConfig as AnyQuestionConfig | undefined;
  const caseConfig = anyConfig?.type === "clinical_case" ? anyConfig.config : undefined;
  // Hotspot i przypadek rysują obraz same (plansza do wskazywania / zapis przypadku)
  const showImage = !!question.imageUrl && questionType !== "hotspot" && !caseConfig;
  const answered = showExplanation && !!quizResult;

  const correctAnswer =
    answered && !isInteractiveType ? question.answers[quizResult!.correctIndex] : undefined;

  return (
    <article
      className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-[clamp(22px,3vw,40px)]"
      aria-labelledby="question-title"
    >
      {caseConfig && (
        <p className="label label--g mb-4" data-testid="case-kicker">
          {caseKicker(caseConfig)}
        </p>
      )}

      {question.title && (
        <h1 id="question-title" className="mb-6 text-[var(--txt)]" style={titleStyle} data-testid="question-title">
          {question.title}
        </h1>
      )}

      {showImage && imagePosition !== "below" && <QuestionImage url={question.imageUrl!} onOpen={onImageClick} />}

      {question.bodyMd && (
        <div
          className="prose-hk mb-6 max-w-none text-[var(--txt)]"
          // Bez tytułu treść pytania JEST tytułem — w skali `.q__title` z landingu
          style={question.title ? undefined : { ...titleStyle, color: "var(--txt)", textWrap: "pretty" }}
          id={question.title ? undefined : "question-title"}
          dangerouslySetInnerHTML={sanitizeHtml(question.bodyMd)}
          data-testid="question-body"
        />
      )}

      {showImage && imagePosition === "below" && <QuestionImage url={question.imageUrl!} onOpen={onImageClick} />}

      {/* Pytania interaktywne */}
      {isInteractiveType && onAnswerChange && (
        <QuestionRenderer
          question={question}
          onAnswerChange={onAnswerChange}
          disabled={showExplanation}
          showResult={showExplanation}
          result={quizResult}
          onImageClick={onImageClick}
        />
      )}

      {/* Wybór odpowiedzi — wiersze `.opt` jak w quizie na landingu */}
      {!isInteractiveType && (
        <div className="grid gap-[10px]" role="group" aria-label="Odpowiedzi" data-testid="answer-options">
          {question.answers.map((answer, index) => {
            const isRight = answered && index === quizResult!.correctIndex;
            const isWrong = answered && index === selectedAnswer && !isRight;
            const isDim = answered && !isRight && !isWrong;
            return (
              <button
                key={index}
                type="button"
                className={cn(
                  "opt",
                  isRight && "is-right",
                  isWrong && "is-wrong",
                  isDim && "is-dim",
                  !answered && selectedAnswer === index && "is-picked",
                )}
                disabled={showExplanation || isSubmitting}
                aria-pressed={selectedAnswer === index}
                onClick={() => !showExplanation && !isSubmitting && onAnswerSelect(index)}
                data-testid={`answer-option-${index}`}
              >
                <span className="opt__key" aria-hidden>
                  {letter(index)}
                </span>
                <span>
                  <span className="sr-only">{letter(index)}. </span>
                  {answer.text}
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
      )}

      {/* Wyjaśnienie: wyrasta pod pytaniem po odpowiedzi */}
      {showExplanation && (
        <motion.section
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-7 grid gap-3.5 border-t border-[var(--line)] pt-6"
          aria-live="polite"
          data-testid="explanation-panel"
        >
          {!quizResult ? (
            <p className="label">Sprawdzam odpowiedź…</p>
          ) : (
            <>
              <p className="flex items-start gap-2.5 text-[17px] font-medium leading-snug text-[var(--txt)]" data-testid="result-title">
                {quizResult.isCorrect ? (
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--puls)]" strokeWidth={2.25} aria-hidden />
                ) : (
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-[var(--alarm)]" strokeWidth={2.25} aria-hidden />
                )}
                <span>
                  {quizResult.isCorrect
                    ? "Dobrze."
                    : isInteractiveType && quizResult.partialScore !== undefined && quizResult.partialScore > 0
                      ? `Częściowo dobrze — ${Math.round(quizResult.partialScore * 100)}%.`
                      : "Nie tym razem."}
                </span>
              </p>

              {correctAnswer && (
                <p className="text-[15px] text-[var(--txt)]">
                  <span className="label mr-2">Poprawna odpowiedź</span>
                  {letter(quizResult.correctIndex)}. {correctAnswer.text}
                </p>
              )}

              {quizResult.explanation && (
                <>
                  <p className="label mt-1">{caseConfig ? "Podsumowanie przypadku" : "Wyjaśnienie"}</p>
                  <div
                    className="prose-hk max-w-[46em] text-[16px]"
                    dangerouslySetInnerHTML={sanitizeMarkdown(quizResult.explanation)}
                    data-testid="explanation-content"
                  />
                </>
              )}

              <p className="label">Czas · {Math.max(1, Math.round(quizResult.timeMs / 1000))} s</p>
            </>
          )}
        </motion.section>
      )}
    </article>
  );
}
