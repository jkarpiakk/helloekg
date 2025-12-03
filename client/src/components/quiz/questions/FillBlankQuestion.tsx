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

      let inputClass = "inline-block w-28 sm:w-36 md:w-40 mx-1 my-1 text-center";
      if (showResult) {
        if (isCorrect) {
          inputClass += " border-green-500 bg-green-50 dark:bg-green-950/20";
        } else if (isIncorrect) {
          inputClass += " border-red-500 bg-red-50 dark:bg-red-950/20";
        }
      }

      const correctAnswer = showResult && isIncorrect && result?.correctAnswer?.type === 'fill_blank'
        ? result.correctAnswer.filledBlanks.find(b => b.blankId === blank.id)?.value
        : null;

      parts.push(
        <span key={`blank-${blank.id}`} className="inline-flex items-center gap-1 align-middle">
          <span className="text-xs text-muted-foreground font-medium mr-1">
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
            <Check className="h-4 w-4 text-green-500" />
          )}
          {showResult && isIncorrect && (
            <>
              <X className="h-4 w-4 text-red-500" />
              {correctAnswer && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium ml-1">
                  ({correctAnswer})
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
      <p className="text-sm sm:text-base text-muted-foreground">
        Uzupełnij puste pola odpowiednimi wartościami
      </p>

      <div 
        className="text-base sm:text-lg leading-relaxed sm:leading-loose p-4 sm:p-6 bg-muted/30 rounded-lg"
        data-testid="fill-blank-text"
      >
        {renderTextWithBlanks()}
      </div>

      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
        <span className="font-medium">Podpowiedź:</span>
        {config.blanks.map((blank, index) => (
          <span key={blank.id} className="px-2 py-1 bg-muted rounded">
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
