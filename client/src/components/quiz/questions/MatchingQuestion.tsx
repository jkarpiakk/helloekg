import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Link2 } from "lucide-react";
import type { MatchingConfig, AnswerData, QuizResult } from "@/types";

interface MatchingQuestionProps {
  config: MatchingConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
}

export default function MatchingQuestion({
  config,
  onChange,
  disabled,
  showResult,
  result,
}: MatchingQuestionProps) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Map<string, string>>(new Map());

  const handleLeftClick = useCallback((leftId: string) => {
    if (disabled) return;
    
    if (pairs.has(leftId)) {
      const newPairs = new Map(pairs);
      newPairs.delete(leftId);
      setPairs(newPairs);
      
      const answerData: AnswerData = {
        type: 'matching',
        pairs: Array.from(newPairs.entries()).map(([leftId, rightId]) => ({
          leftId,
          rightId,
        })),
      };
      onChange(answerData);
      return;
    }
    
    setSelectedLeft(leftId === selectedLeft ? null : leftId);
  }, [disabled, pairs, selectedLeft, onChange]);

  const handleRightClick = useCallback((rightId: string) => {
    if (disabled || !selectedLeft) return;

    const newPairs = new Map(pairs);
    
    Array.from(newPairs.entries()).forEach(([key, value]) => {
      if (value === rightId) {
        newPairs.delete(key);
      }
    });
    
    newPairs.set(selectedLeft, rightId);
    setPairs(newPairs);
    setSelectedLeft(null);

    const answerData: AnswerData = {
      type: 'matching',
      pairs: Array.from(newPairs.entries()).map(([leftId, rightId]) => ({
        leftId,
        rightId,
      })),
    };
    onChange(answerData);
  }, [disabled, selectedLeft, pairs, onChange]);

  const getLeftItemClass = (leftId: string) => {
    const baseClass = "p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all touch-manipulation";
    const isPaired = pairs.has(leftId);
    const isSelected = selectedLeft === leftId;
    
    if (showResult) {
      const isCorrect = result?.feedback?.correctItems?.includes(leftId);
      const isIncorrect = result?.feedback?.incorrectItems?.includes(leftId);
      if (isCorrect) return `${baseClass} border-green-500 bg-green-50 dark:bg-green-950/20`;
      if (isIncorrect) return `${baseClass} border-red-500 bg-red-50 dark:bg-red-950/20`;
      return `${baseClass} border-muted bg-muted/30`;
    }
    
    if (isSelected) return `${baseClass} border-primary bg-primary/10 ring-2 ring-primary`;
    if (isPaired) return `${baseClass} border-primary bg-primary/5`;
    return `${baseClass} border-border hover:border-primary/50`;
  };

  const getRightItemClass = (rightId: string) => {
    const baseClass = "p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all touch-manipulation";
    const isPaired = Array.from(pairs.values()).includes(rightId);
    
    if (showResult) {
      return `${baseClass} border-muted bg-muted/30`;
    }
    
    if (!selectedLeft) {
      if (isPaired) return `${baseClass} border-primary/30 bg-primary/5 cursor-default`;
      return `${baseClass} border-border cursor-default`;
    }
    
    if (isPaired) return `${baseClass} border-primary/30 bg-primary/5`;
    return `${baseClass} border-border hover:border-primary/50`;
  };

  const getConnectedRight = (leftId: string) => {
    const rightId = pairs.get(leftId);
    if (!rightId) return null;
    return config.rightColumn.find(r => r.id === rightId);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <p className="text-sm sm:text-base text-muted-foreground">
        Połącz elementy z lewej kolumny z odpowiadającymi im elementami z prawej
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-3" data-testid="matching-left">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Kolumna A
          </h4>
          <div className="space-y-2">
            {config.leftColumn.map(item => {
              const connectedRight = getConnectedRight(item.id);
              const isCorrect = result?.feedback?.correctItems?.includes(item.id);
              const isIncorrect = result?.feedback?.incorrectItems?.includes(item.id);
              
              return (
                <div key={item.id} className="space-y-1">
                  <div
                    className={getLeftItemClass(item.id)}
                    onClick={() => handleLeftClick(item.id)}
                    data-testid={`left-item-${item.id}`}
                  >
                    <div className="flex items-center gap-2">
                      {item.imageUrl && (
                        <img 
                          src={item.imageUrl} 
                          alt={item.text} 
                          className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded"
                        />
                      )}
                      <span className="text-sm sm:text-base flex-1">{item.text}</span>
                      {showResult && isCorrect && <Check className="h-5 w-5 text-green-500" />}
                      {showResult && isIncorrect && <X className="h-5 w-5 text-red-500" />}
                      {connectedRight && !showResult && (
                        <Link2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                  {connectedRight && (
                    <div className="ml-4 pl-3 border-l-2 border-primary/30 text-xs sm:text-sm text-muted-foreground">
                      → {connectedRight.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3" data-testid="matching-right">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Kolumna B
          </h4>
          <div className="space-y-2">
            {config.rightColumn.map(item => (
              <div
                key={item.id}
                className={getRightItemClass(item.id)}
                onClick={() => handleRightClick(item.id)}
                data-testid={`right-item-${item.id}`}
              >
                <div className="flex items-center gap-2">
                  {item.imageUrl && (
                    <img 
                      src={item.imageUrl} 
                      alt={item.text} 
                      className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded"
                    />
                  )}
                  <span className="text-sm sm:text-base">{item.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedLeft && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          Wybierz element z kolumny B, aby połączyć
        </div>
      )}

      {showResult && result?.partialScore !== undefined && result.partialScore < 1 && (
        <div className="mt-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm sm:text-base text-amber-800 dark:text-amber-200">
            Poprawne pary: {Math.round(result.partialScore * 100)}% 
            ({result.feedback?.correctItems?.length || 0} z {config.correctPairs.length})
          </p>
        </div>
      )}
    </div>
  );
}
