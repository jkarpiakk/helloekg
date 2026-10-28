import { Wyjasnienie } from "./Wyjasnienie";
import { WstawkaOtwarta, wyciagnijWstawki } from "./WstawkaOtwarta";
import { motion } from "framer-motion";
import { Check, Maximize2, X } from "lucide-react";
import { sanitizeMarkdown, sanitizeHtml } from "@/lib/sanitize";
import { rise } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { QuizQuestion, QuizResult, AnswerData } from "@/types";
import { QuestionRenderer } from "./questions";
import { caseKicker } from "./questions/ClinicalCaseQuestion";
import type { AnyQuestionConfig } from "@shared/clinicalCase";

/**
 * Stan odpowiedzi na bieżące pytanie:
 * idle — czeka na odpowiedź; pending — wysłana, czekamy na serwer;
 * result — wynik z serwera (nauka/powtórka); saved — zapisana bez wyniku (egzamin);
 * error — nie udało się zapisać (można odpowiedzieć/wysłać jeszcze raz).
 */
export type AnswerStatus = "idle" | "pending" | "result" | "saved" | "error";

interface QuestionCardProps {
  question: QuizQuestion;
  /** Pozycja wybranej odpowiedzi NA EKRANIE (odpowiedzi są tasowane) */
  selectedAnswer: number | null;
  status: AnswerStatus;
  /** Pokaż „Sprawdzam…” — dopiero gdy serwer odpowiada dłużej niż ~300 ms */
  showPending: boolean;
  /**
   * Egzamin: bez poprawności i wyjaśnienia, tylko „Zapisano”.
   * Wybór odpowiedzi tylko ją zaznacza — zapisuje dopiero „Zapisz odpowiedź”.
   */
  examMode?: boolean;
  /** Jednolinijkowa podpowiedź nad odpowiedziami (np. przy pierwszym pytaniu: „Odpowiedź liczy się po dotknięciu.”) */
  answerHint?: string;
  quizResult?: QuizResult;
  onAnswerSelect: (position: number) => void;
  onAnswerChange?: (answer: AnswerData) => void;
  /** Drugi argument: miniatura, z której wyrasta podgląd */
  onImageClick: (imageUrl: string, origin?: HTMLElement) => void;
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
  status,
  showPending,
  examMode = false,
  answerHint,
  quizResult,
  onAnswerSelect,
  onAnswerChange,
  onImageClick,
}: QuestionCardProps) {
  const questionType = question.questionType || "multiple_choice";
  const isInteractiveType = questionType !== "multiple_choice" && !!question.questionConfig;
  const imagePosition = (question as QuizQuestion & { imagePosition?: string }).imagePosition;
  const anyConfig = question.questionConfig as AnyQuestionConfig | undefined;
  const caseConfig = anyConfig?.type === "clinical_case" ? anyConfig.config : undefined;
  // Hotspot i przypadek rysują obraz same (plansza do wskazywania / zapis przypadku)
  const showImage = !!question.imageUrl && questionType !== "hotspot" && !caseConfig;
  const tresc = wyciagnijWstawki(question.bodyMd ?? "");
  // Wynik widać tylko w nauce/powtórce i tylko z odpowiedzi serwera
  const answered = status === "result" && !!quizResult && !examMode;
  const locked = status === "pending" || status === "result" || status === "saved";

  // correctIndex to indeks w bazie; odpowiedzi na ekranie są potasowane
  const correctPosition = answered ? question.answers.findIndex((a) => a.index === quizResult!.correctIndex) : -1;
  const correctAnswer = answered && !isInteractiveType && correctPosition >= 0 ? question.answers[correctPosition] : undefined;

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

      {tresc.tekst && (
        <div
          className="prose-hk mb-6 max-w-none text-[var(--txt)]"
          // Bez tytułu treść pytania JEST tytułem — w skali `.q__title` z landingu
          style={question.title ? undefined : { ...titleStyle, color: "var(--txt)", textWrap: "pretty" }}
          id={question.title ? undefined : "question-title"}
          dangerouslySetInnerHTML={sanitizeHtml(tresc.tekst)}
          data-testid="question-body"
        />
      )}
      {/* Monitor w treści pytania (::wstawka kardiomonitor … pytanie=tak) — otwarty, bez rozpoznania */}
      {tresc.wstawki.map((w, i) => (
        <div key={i} className="mb-6"><WstawkaOtwarta id={w.id} opts={w.opts} wPytaniu /></div>
      ))}

      {showImage && imagePosition === "below" && <QuestionImage url={question.imageUrl!} onOpen={onImageClick} />}

      {/* Pytania interaktywne */}
      {isInteractiveType && onAnswerChange && (
        <QuestionRenderer
          question={question}
          onAnswerChange={onAnswerChange}
          disabled={locked}
          showResult={answered}
          result={answered ? quizResult : undefined}
          onImageClick={onImageClick}
        />
      )}

      {/* Wybór odpowiedzi — wiersze `.opt` jak w quizie na landingu */}
      {!isInteractiveType && answerHint && !answered && (
        <p className="mb-3 text-[14px] text-[var(--txt2)]" data-testid="answer-hint">
          {answerHint}
        </p>
      )}
      {!isInteractiveType && (
        <div className="grid gap-[10px]" role="group" aria-label="Odpowiedzi" data-testid="answer-options">
          {question.answers.map((answer, index) => {
            const isRight = answered && index === correctPosition;
            const isWrong = answered && index === selectedAnswer && !isRight;
            const isDim = answered && !isRight && !isWrong;
            // Egzamin: zaznaczenie przed zapisem — wyraźne, ale neutralne (zieleń podpowiadałaby „dobrze”)
            const isExamPick = examMode && selectedAnswer === index;
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
                  isExamPick &&
                    "!border-[var(--txt2)] bg-[color-mix(in_srgb,var(--txt)_5%,transparent)] [&_.opt__key]:border-[var(--txt2)] [&_.opt__key]:text-[var(--txt)]",
                )}
                disabled={locked}
                aria-pressed={selectedAnswer === index}
                onClick={() => !locked && onAnswerSelect(index)}
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
                  {isExamPick && status !== "saved" && <span className="sr-only"> — zaznaczona</span>}
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

      {/* Egzamin: odpowiedź zapisana, bez wyniku — pełny przegląd dopiero na końcu */}
      {examMode && (status === "saved" || (status === "pending" && showPending)) && (
        <p className="mt-7 flex items-center gap-2 border-t border-[var(--line)] pt-6 label" role="status" data-testid="exam-saved">
          {status === "saved" ? (
            <>
              <Check className="h-4 w-4 text-[var(--puls)]" strokeWidth={2.25} aria-hidden />
              Zapisano
            </>
          ) : (
            "Zapisuję…"
          )}
        </p>
      )}

      {!examMode && status === "pending" && showPending && (
        <p className="mt-7 border-t border-[var(--line)] pt-6 label" role="status" data-testid="answer-pending">
          Sprawdzam…
        </p>
      )}

      {status === "error" && (
        <section
          className="mt-7 grid gap-1.5 border-t border-[var(--line)] pt-6"
          role="alert"
          data-testid="answer-save-error"
        >
          <p className="flex items-start gap-2.5 text-[17px] font-medium leading-snug text-[var(--txt)]">
            <X className="mt-0.5 h-5 w-5 shrink-0 text-[var(--alarm)]" strokeWidth={2.25} aria-hidden />
            Nie zapisano odpowiedzi
          </p>
          <p className="text-[15px] text-[var(--txt2)]">
            Sprawdź połączenie i wyślij jeszcze raz{isInteractiveType ? "" : ". Możesz też zmienić wybór"}.
          </p>
        </section>
      )}

      {/* Wyjaśnienie: wyrasta pod pytaniem po odpowiedzi (wynik z serwera) */}
      {answered && (
        <motion.section
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-7 grid gap-3.5 border-t border-[var(--line)] pt-6"
          aria-live="polite"
          data-testid="explanation-panel"
        >
          <p className="flex items-start gap-2.5 text-[17px] font-medium leading-snug text-[var(--txt)]" data-testid="result-title">
            {quizResult!.isCorrect ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--puls)]" strokeWidth={2.25} aria-hidden />
            ) : (
              <X className="mt-0.5 h-5 w-5 shrink-0 text-[var(--alarm)]" strokeWidth={2.25} aria-hidden />
            )}
            <span>
              {quizResult!.isCorrect
                ? "Dobrze."
                : isInteractiveType && quizResult!.partialScore !== undefined && quizResult!.partialScore > 0
                  ? `Częściowo dobrze: ${Math.round(quizResult!.partialScore * 100)}%.`
                  : "Nie tym razem."}
            </span>
          </p>

          {correctAnswer && !quizResult!.isCorrect && (
            <p className="text-[15px] text-[var(--txt)]">
              <span className="label mr-2">Poprawna odpowiedź</span>
              {letter(correctPosition)}. {correctAnswer.text}
            </p>
          )}

          {quizResult!.explanation && (
            <>
              <p className="label mt-1">{caseConfig ? "Podsumowanie przypadku" : "Wyjaśnienie"}</p>
              <Wyjasnienie md={quizResult!.explanation} className="prose-hk max-w-[46em] text-[16px]" testId="explanation-content" />
            </>
          )}

          <p className="label">Czas · {Math.max(1, Math.round(quizResult!.timeMs / 1000))} s</p>
        </motion.section>
      )}
    </article>
  );
}
