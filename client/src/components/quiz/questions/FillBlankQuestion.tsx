import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import type { FillBlankConfig, AnswerData, QuizResult } from "@/types";

interface FillBlankQuestionProps {
  config: FillBlankConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

export default function FillBlankQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: FillBlankQuestionProps) {
  const [values, setValues] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const initialValues = new Map<string, string>();
    config.blanks.forEach(blank => {
      initialValues.set(blank.id, '');
    });
    setValues(initialValues);
  }, [config]);

  const handleChange = (blankId: string, value: string) => {
    const newValues = new Map(values);
    newValues.set(blankId, value);
    setValues(newValues);

    const answerData: AnswerData = {
      type: 'fill_blank',
      filledBlanks: Array.from(newValues.entries()).map(([blankId, value]) => ({
        blankId,
        value,
      })),
    };
    onChange(answerData);
  };

  const renderTextWithBlanks = () => {
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    let blankIndex = 0;

    const sortedBlanks = [...config.blanks].sort((a, b) => a.position - b.position);

    for (const blank of sortedBlanks) {
      if (blank.position > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {config.template.substring(lastIndex, blank.position)}
          </span>
        );
      }

      const currentValue = values.get(blank.id) || '';
      const isCorrect = result?.feedback?.correctItems?.includes(blank.id);
      const isIncorrect = result?.feedback?.incorrectItems?.includes(blank.id);

      let inputClass = "inline-block w-28 sm:w-36 md:w-40 mx-1 my-1 text-center font-medium border-2 transition-all duration-200";
      if (showResult) {
        if (isCorrect) {
          inputClass += " border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 shadow-sm shadow-green-500/20";
        } else if (isIncorrect) {
          inputClass += " border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 shadow-sm shadow-red-500/20";
        }
      } else {
        inputClass += " border-border hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20";
      }

      const correctAnswer = showResult && isIncorrect && result?.correctAnswer?.type === 'fill_blank'
        ? result.correctAnswer.filledBlanks.find(b => b.blankId === blank.id)?.value
        : null;

      parts.push(
        <span key={`blank-${blank.id}`} className="inline-flex items-center gap-1 align-middle">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1">
            [{blankIndex + 1}]
          </span>
          <Input
            type="text"
            value={currentValue}
            onChange={(e) => handleChange(blank.id, e.target.value)}
            disabled={disabled}
            placeholder={blank.placeholder || "..."}
            className={inputClass}
            data-testid={`blank-input-${blank.id}`}
          />
          {showResult && isCorrect && (
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" data-testid={`blank-correct-${blank.id}`} />
          )}
          {showResult && isIncorrect && (
            <>
              <X className="h-5 w-5 text-red-600 dark:text-red-400" data-testid={`blank-incorrect-${blank.id}`} />
              {correctAnswer && (
                <span className="text-xs text-green-700 dark:text-green-400 font-semibold ml-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 rounded">
                  {correctAnswer}
                </span>
              )}
            </>
          )}
        </span>
      );

      lastIndex = blank.position;
      blankIndex++;
    }

    if (lastIndex < config.template.length) {
      parts.push(
        <span key={`text-end`}>
          {config.template.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
        Uzupełnij puste pola odpowiednimi wartościami
      </p>

      <div 
        className="text-base sm:text-lg leading-relaxed sm:leading-loose p-4 sm:p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
        data-testid="fill-blank-text"
      >
        {renderTextWithBlanks()}
      </div>

      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex-wrap" data-testid="fill-blank-hints">
        <span className="font-semibold text-slate-900 dark:text-white">Podpowiedzi:</span>
        {config.blanks.map((blank, index) => (
          <span 
            key={blank.id} 
            className="px-2 py-1 bg-primary/10 text-primary rounded-md font-medium border border-primary/20"
            data-testid={`hint-${blank.id}`}
          >
            [{index + 1}] {blank.hint || 'bez podpowiedzi'}
          </span>
        ))}
      </div>

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <div className="mt-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm sm:text-base text-amber-800 dark:text-amber-200">
            Poprawne odpowiedzi: {Math.round(result.partialScore * 100)}% 
            ({result.feedback?.correctItems?.length || 0} z {config.blanks.length})
          </p>
        </div>
      )}
    </div>
  );
}
