import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FillBlankConfig, AnswerData, QuizResult } from "@/types";
import PartialScore from "./PartialScore";

interface FillBlankQuestionProps {
  config: FillBlankConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

type Blank = FillBlankConfig["blanks"][0];

/** Znacznik luki w szablonie ze studia: {{blank:<id>}} */
const BLANK_MARKER = /(\{\{blank:[^}]+\}\})/;

/**
 * Sprawdzenie formy po wyjściu z pola — tylko wizualnie, nie ocenia odpowiedzi.
 * Mówi, co zrobić (np. „Wpisz liczbę”), nie zdradza poprawnej wartości.
 */
function formatProblem(blank: Blank, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (blank.validationType === "numeric_range" && Number.isNaN(Number(v.replace(",", ".")))) {
    return "Wpisz liczbę, np. 80";
  }
  return null;
}

export default function FillBlankQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: FillBlankQuestionProps) {
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [problems, setProblems] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const initialValues = new Map<string, string>();
    config.blanks.forEach((blank) => {
      initialValues.set(blank.id, "");
    });
    setValues(initialValues);
    setProblems({});
  }, [config]);

  const handleChange = (blankId: string, value: string) => {
    const newValues = new Map(values);
    newValues.set(blankId, value);
    setValues(newValues);

    // Komunikat znika, gdy tylko wpis jest już w porządku
    const blank = config.blanks.find((b) => b.id === blankId);
    if (problems[blankId] && blank && !formatProblem(blank, value)) {
      setProblems((p) => ({ ...p, [blankId]: null }));
    }

    const answerData: AnswerData = {
      type: "fill_blank",
      filledBlanks: Array.from(newValues.entries()).map(([blankId, value]) => ({
        blankId,
        value,
      })),
    };
    onChange(answerData);
  };

  // Studio zapisuje lukę jako znacznik {{blank:<id>}} w szablonie, a `position` to wtedy tylko
  // numer kolejny luki. Stary format (bez znaczników): `position` = indeks znaku w szablonie.
  const parts = config.template.split(BLANK_MARKER);
  const markerMode = parts.length > 1;
  const byId = new Map(config.blanks.map((b) => [b.id, b]));
  const markerIds = markerMode
    ? parts.filter((_, i) => i % 2 === 1).map((m) => m.slice(8, -2).trim())
    : [];
  // Numeracja luk idzie za kolejnością znaczników (jak w podglądzie studia); luka bez znacznika na końcu
  const sortedBlanks: Blank[] = markerMode
    ? [
        ...markerIds.filter((id, i) => byId.has(id) && markerIds.indexOf(id) === i).map((id) => byId.get(id)!),
        ...[...config.blanks].sort((a, b) => a.position - b.position).filter((b) => !markerIds.includes(b.id)),
      ]
    : [...config.blanks].sort((a, b) => a.position - b.position);
  const numberOf = new Map(sortedBlanks.map((b, i) => [b.id, i]));

  const renderBlank = (blank: Blank, blankIndex: number) => {
    const currentValue = values.get(blank.id) || "";
    const isCorrect = showResult && result?.feedback?.correctItems?.includes(blank.id);
    const isIncorrect = showResult && result?.feedback?.incorrectItems?.includes(blank.id);
    const problem = !showResult ? problems[blank.id] : null;

    const correctAnswer =
      showResult && isIncorrect && result?.correctAnswer?.type === "fill_blank"
        ? result.correctAnswer.filledBlanks.find((b) => b.blankId === blank.id)?.value
        : null;

    return (
      <span key={`blank-${blank.id}`} className="mx-1 inline-flex flex-wrap items-center gap-1.5 align-middle">
        <span className="font-mono text-[.75rem] text-[var(--label)]" aria-hidden>
          {blankIndex + 1}
        </span>
        <input
          type="text"
          value={currentValue}
          onChange={(e) => handleChange(blank.id, e.target.value)}
          onBlur={(e) => setProblems((p) => ({ ...p, [blank.id]: formatProblem(blank, e.target.value) }))}
          disabled={disabled}
          placeholder={blank.placeholder || "…"}
          inputMode={blank.validationType === "numeric_range" ? "decimal" : undefined}
          autoComplete="off"
          spellCheck={false}
          aria-label={`Luka ${blankIndex + 1}${blank.hint ? ` — ${blank.hint}` : ""}`}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `blank-problem-${blank.id}` : undefined}
          className={cn(
            "h-11 w-32 rounded-[10px] border bg-transparent px-3 text-center text-base text-[var(--txt)] transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-[var(--txt3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--puls)] focus-visible:ring-offset-0 sm:w-40",
            "disabled:cursor-default",
            isCorrect && "border-[var(--puls-deep)] bg-[var(--tint)]",
            isIncorrect && "border-[color-mix(in_srgb,var(--alarm)_55%,transparent)] text-[var(--txt2)]",
            !isCorrect &&
              !isIncorrect &&
              (problem
                ? "border-[var(--alarm)]"
                : "border-[var(--field-border)] hover:border-[var(--txt2)] focus-visible:border-[var(--puls)]"),
          )}
          data-testid={`blank-input-${blank.id}`}
        />
        {isCorrect && (
          <Check className="h-4 w-4 text-[var(--puls)]" aria-label="Poprawnie" data-testid={`blank-correct-${blank.id}`} />
        )}
        {isIncorrect && (
          <>
            <X className="h-4 w-4 text-[var(--alarm)]" aria-label="Błędnie" data-testid={`blank-incorrect-${blank.id}`} />
            {correctAnswer && (
              <span className="text-[.875rem] text-[var(--txt)]" data-testid={`blank-answer-${blank.id}`}>
                <span className="label mr-1.5">Poprawnie</span>
                {correctAnswer}
              </span>
            )}
          </>
        )}
      </span>
    );
  };

  const renderTextWithBlanks = () => {
    if (markerMode) {
      const shown = new Set<string>();
      const out = parts.map((part, i) => {
        if (i % 2 === 0) return part ? <span key={`text-${i}`}>{part}</span> : null;
        const blank = byId.get(part.slice(8, -2).trim());
        // Znacznik bez definicji luki albo powtórzony: nie pokazujemy surowego {{blank:…}}
        if (!blank || shown.has(blank.id)) return null;
        shown.add(blank.id);
        return renderBlank(blank, numberOf.get(blank.id)!);
      });
      // Luka zdefiniowana, ale bez znacznika w tekście: na końcu, żeby dało się odpowiedzieć
      sortedBlanks.filter((b) => !shown.has(b.id)).forEach((b) => out.push(renderBlank(b, numberOf.get(b.id)!)));
      return out;
    }

    const out: JSX.Element[] = [];
    let lastIndex = 0;
    sortedBlanks.forEach((blank, blankIndex) => {
      if (blank.position > lastIndex) {
        out.push(<span key={`text-${lastIndex}`}>{config.template.substring(lastIndex, blank.position)}</span>);
      }
      out.push(renderBlank(blank, blankIndex));
      lastIndex = blank.position;
    });
    if (lastIndex < config.template.length) {
      out.push(<span key="text-end">{config.template.substring(lastIndex)}</span>);
    }
    return out;
  };

  const visibleProblems = showResult
    ? []
    : sortedBlanks
        .map((b, i) => ({ id: b.id, n: i + 1, msg: problems[b.id] }))
        .filter((p): p is { id: string; n: number; msg: string } => !!p.msg);
  const hints = sortedBlanks.map((b, i) => ({ n: i + 1, hint: b.hint })).filter((h) => h.hint);

  return (
    <div className="grid gap-4">
      <p className="text-[.9375rem] text-[var(--txt2)]">Uzupełnij luki w tekście.</p>

      <div className="text-[1.0625rem] leading-[2.4] text-[var(--txt)]" data-testid="fill-blank-text">
        {renderTextWithBlanks()}
      </div>

      {visibleProblems.length > 0 && (
        <ul className="grid gap-1 text-[.875rem] text-[var(--txt)]" aria-live="polite">
          {visibleProblems.map((p) => (
            <li key={p.id} id={`blank-problem-${p.id}`} className="flex items-center gap-2">
              <span className="font-mono text-[.75rem] text-[var(--alarm)]">{p.n}</span>
              {p.msg}
            </li>
          ))}
        </ul>
      )}

      {hints.length > 0 && (
        <div className="grid gap-2 border-t border-[var(--line)] pt-4" data-testid="fill-blank-hints">
          <p className="label">Podpowiedzi</p>
          <ul className="grid gap-1 text-[.875rem] text-[var(--txt2)]">
            {hints.map((h) => (
              <li key={h.n} className="flex gap-2.5" data-testid={`hint-${sortedBlanks[h.n - 1].id}`}>
                <span className="font-mono text-[.75rem] leading-[1.9] text-[var(--label)]">{h.n}</span>
                <span>{h.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <PartialScore
          score={result.partialScore}
          correct={result.feedback?.correctItems?.length}
          total={config.blanks.length}
        />
      )}
    </div>
  );
}
