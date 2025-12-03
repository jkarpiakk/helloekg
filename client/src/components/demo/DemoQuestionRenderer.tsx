import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Check, X, GraduationCap, ChevronLeft, ChevronRight, 
  ListChecks, Puzzle, TextCursor, Link2, ArrowUpDown, Target 
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { DemoQuestion, QuestionConfig, DragDropConfig, FillBlankConfig, MatchingConfig, SortingConfig, HotspotConfig } from "@shared/schema";
import type { QuestionType, AnswerData, DragDropAnswer, FillBlankAnswer, MatchingAnswer, SortingAnswer, HotspotAnswer } from "@/types";
import afEcgImage from "@assets/af ecg_1757697444254.jpg";

import DragDropQuestion from "@/components/quiz/questions/DragDropQuestion";
import FillBlankQuestion from "@/components/quiz/questions/FillBlankQuestion";
import MatchingQuestion from "@/components/quiz/questions/MatchingQuestion";
import SortingQuestion from "@/components/quiz/questions/SortingQuestion";
import HotspotQuestion from "@/components/quiz/questions/HotspotQuestion";

const QUESTION_TYPE_INFO: Record<QuestionType, { label: string; icon: React.ComponentType<{className?: string}>; color: string }> = {
  multiple_choice: { 
    label: "ABCD", 
    icon: ListChecks,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  },
  drag_drop: { 
    label: "Przeciągnij", 
    icon: Puzzle,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
  },
  fill_blank: { 
    label: "Uzupełnij", 
    icon: TextCursor,
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
  },
  matching: { 
    label: "Dopasuj", 
    icon: Link2,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  sorting: { 
    label: "Uporządkuj", 
    icon: ArrowUpDown,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
  },
  hotspot: { 
    label: "Zaznacz", 
    icon: Target,
    color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200"
  }
};

interface DemoQuestionRendererProps {
  questions: DemoQuestion[];
  onRegisterClick: () => void;
}

export default function DemoQuestionRenderer({ questions, onRegisterClick }: DemoQuestionRendererProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerData | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const { isAuthenticated } = useAuth();

  const currentQuestion = questions[currentIndex];
  const questionType = (currentQuestion?.questionType || 'multiple_choice') as QuestionType;
  const questionConfig = currentQuestion?.questionConfig as QuestionConfig | undefined;

  useEffect(() => {
    setSelectedAnswer(null);
    setCurrentAnswer(null);
    setShowResult(false);
    setIsCorrect(false);
  }, [currentIndex]);

  const handleMultipleChoiceSelect = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    const correct = index === (currentQuestion?.correctIndex || 0);
    setIsCorrect(correct);
    setShowResult(true);
  };

  const handleAnswerChange = useCallback((answer: AnswerData) => {
    setCurrentAnswer(answer);
  }, []);

  const handleSubmitInteractive = () => {
    if (!currentAnswer || !questionConfig) return;
    
    let correct = false;
    
    if (questionConfig.type === 'drag_drop' && currentAnswer.type === 'drag_drop') {
      const ddConfig = questionConfig.config as DragDropConfig;
      const ddAnswer = currentAnswer as DragDropAnswer;
      const placements = ddAnswer.placements;
      correct = ddConfig.targets.every((target) => {
        const placed = placements.find(p => p.targetId === target.id);
        return placed && placed.sourceId === target.acceptsSourceId;
      });
    }
    
    if (questionConfig.type === 'fill_blank' && currentAnswer.type === 'fill_blank') {
      const fbConfig = questionConfig.config as FillBlankConfig;
      const fbAnswer = currentAnswer as FillBlankAnswer;
      const filledBlanks = fbAnswer.filledBlanks || [];
      correct = fbConfig.blanks.every((blank) => {
        const userBlank = filledBlanks.find(fb => fb.blankId === blank.id);
        const userAnswer = (userBlank?.value || '').toLowerCase().trim();
        return blank.correctAnswers.some((a: string) => a.toLowerCase().trim() === userAnswer);
      });
    }
    
    if (questionConfig.type === 'matching' && currentAnswer.type === 'matching') {
      const mConfig = questionConfig.config as MatchingConfig;
      const mAnswer = currentAnswer as MatchingAnswer;
      const userPairs = mAnswer.pairs;
      correct = mConfig.correctPairs.every((cp) => {
        return userPairs.some(up => up.leftId === cp.leftId && up.rightId === cp.rightId);
      }) && userPairs.length === mConfig.correctPairs.length;
    }
    
    if (questionConfig.type === 'sorting' && currentAnswer.type === 'sorting') {
      const sConfig = questionConfig.config as SortingConfig;
      const sAnswer = currentAnswer as SortingAnswer;
      const userOrder = sAnswer.order;
      correct = userOrder.length === sConfig.correctOrder.length &&
        userOrder.every((id, index) => id === sConfig.correctOrder[index]);
    }
    
    if (questionConfig.type === 'hotspot' && currentAnswer.type === 'hotspot') {
      const hConfig = questionConfig.config as HotspotConfig;
      const hAnswer = currentAnswer as HotspotAnswer;
      const clickedIds = hAnswer.clickedHotspots;
      const correctIds = hConfig.hotspots.filter((h) => h.isCorrect).map((h) => h.id);
      correct = correctIds.length > 0 && 
        correctIds.every((id) => clickedIds.includes(id)) &&
        clickedIds.every((id) => correctIds.includes(id));
    }
    
    setIsCorrect(correct);
    setShowResult(true);
  };

  const resetDemo = () => {
    setSelectedAnswer(null);
    setCurrentAnswer(null);
    setShowResult(false);
    setIsCorrect(false);
  };

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (!currentQuestion) {
    return null;
  }

  const typeInfo = QUESTION_TYPE_INFO[questionType];
  const Icon = typeInfo.icon;

  const renderMultipleChoice = () => {
    const options = currentQuestion.options || [];
    
    return (
      <div className="space-y-2 sm:space-y-3">
        {options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const optionIsCorrect = index === (currentQuestion.correctIndex || 0);
          
          let buttonClass = "w-full p-3 sm:p-4 border border-border rounded-lg cursor-pointer transition-all duration-200 text-left text-sm sm:text-base";
          
          if (showResult) {
            if (optionIsCorrect) {
              buttonClass += " bg-green-100 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300";
            } else if (isSelected) {
              buttonClass += " bg-red-100 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-600 dark:text-red-300";
            }
          } else {
            buttonClass += " hover:bg-secondary/50 hover:border-primary/50";
          }
          
          return (
            <button
              key={index}
              onClick={() => handleMultipleChoiceSelect(index)}
              className={buttonClass}
              disabled={showResult}
              data-testid={`demo-option-${index}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold mr-2 sm:mr-3">{String.fromCharCode(65 + index)}.</span>
                  {option}
                </div>
                {showResult && optionIsCorrect && (
                  <Check className="h-5 w-5 text-green-600" />
                )}
                {showResult && isSelected && !optionIsCorrect && (
                  <X className="h-5 w-5 text-red-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderInteractiveQuestion = () => {
    if (!questionConfig) return null;

    const mockResult = showResult ? {
      isCorrect,
      correctIndex: 0,
      explanation: currentQuestion.explanation,
      timeMs: 0,
      feedback: isCorrect ? { correctItems: [], incorrectItems: [] } : { correctItems: [], incorrectItems: [] }
    } : undefined;

    if (questionConfig.type === 'drag_drop') {
      const config = questionConfig.config as DragDropConfig;
      return (
        <div className="space-y-4">
          <DragDropQuestion
            config={config}
            onChange={handleAnswerChange}
            disabled={showResult}
            showResult={showResult}
            result={mockResult}
          />
          {!showResult && currentAnswer && (
            <Button 
              onClick={handleSubmitInteractive} 
              className="w-full"
              data-testid="submit-demo-answer"
            >
              Sprawdź odpowiedź
            </Button>
          )}
        </div>
      );
    }
    
    if (questionConfig.type === 'fill_blank') {
      const config = questionConfig.config as FillBlankConfig;
      return (
        <div className="space-y-4">
          <FillBlankQuestion
            config={config}
            onChange={handleAnswerChange}
            disabled={showResult}
            showResult={showResult}
            result={mockResult}
          />
          {!showResult && currentAnswer && (
            <Button 
              onClick={handleSubmitInteractive} 
              className="w-full"
              data-testid="submit-demo-answer"
            >
              Sprawdź odpowiedź
            </Button>
          )}
        </div>
      );
    }
    
    if (questionConfig.type === 'matching') {
      const config = questionConfig.config as MatchingConfig;
      return (
        <div className="space-y-4">
          <MatchingQuestion
            config={config}
            onChange={handleAnswerChange}
            disabled={showResult}
            showResult={showResult}
            result={mockResult}
          />
          {!showResult && currentAnswer && (
            <Button 
              onClick={handleSubmitInteractive} 
              className="w-full"
              data-testid="submit-demo-answer"
            >
              Sprawdź odpowiedź
            </Button>
          )}
        </div>
      );
    }
    
    if (questionConfig.type === 'sorting') {
      const config = questionConfig.config as SortingConfig;
      return (
        <div className="space-y-4">
          <SortingQuestion
            config={config}
            onChange={handleAnswerChange}
            disabled={showResult}
            showResult={showResult}
            result={mockResult}
          />
          {!showResult && currentAnswer && (
            <Button 
              onClick={handleSubmitInteractive} 
              className="w-full"
              data-testid="submit-demo-answer"
            >
              Sprawdź odpowiedź
            </Button>
          )}
        </div>
      );
    }
    
    if (questionConfig.type === 'hotspot') {
      const config = questionConfig.config as HotspotConfig;
      return (
        <div className="space-y-4">
          <HotspotQuestion
            config={config}
            onChange={handleAnswerChange}
            disabled={showResult}
            showResult={showResult}
            result={mockResult}
          />
          {!showResult && currentAnswer && (
            <Button 
              onClick={handleSubmitInteractive} 
              className="w-full"
              data-testid="submit-demo-answer"
            >
              Sprawdź odpowiedź
            </Button>
          )}
        </div>
      );
    }
    
    return null;
  };

  return (
    <Card className="shadow-2xl p-3 sm:p-4 lg:p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1.5 sm:h-2 bg-gradient-to-r from-primary to-chart-2"></div>
      
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              Pytanie {currentIndex + 1} z {questions.length}
            </span>
            <Badge variant="secondary" className={`flex items-center gap-1 text-xs ${typeInfo.color}`}>
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{typeInfo.label}</span>
            </Badge>
          </div>
          <div className="w-16 sm:w-24 h-1.5 sm:h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-foreground" data-testid="demo-question-text">
              {currentQuestion.question}
            </h3>
            {showResult && (
              <Button 
                variant="outline" 
                size="sm"
                className="w-full sm:w-auto"
                onClick={resetDemo}
                data-testid="reset-demo-button"
              >
                Spróbuj ponownie
              </Button>
            )}
          </div>
          
          {currentQuestion.imageUrl && questionType === 'multiple_choice' && (
            <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 border border-border">
              <img 
                src={currentQuestion.imageUrl || afEcgImage} 
                alt="Zapis EKG" 
                className="w-full h-auto rounded"
                data-testid="demo-ecg-image"
              />
            </div>
          )}

          {questionType === 'multiple_choice' ? renderMultipleChoice() : renderInteractiveQuestion()}

          {showResult && (
            <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
              <div className="p-3 sm:p-4 bg-primary/5 border border-primary/20 rounded-lg" data-testid="demo-result-panel">
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {isCorrect ? (
                      <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                    ) : (
                      <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground mb-1 text-sm sm:text-base" data-testid="demo-result-status">
                      {isCorrect 
                        ? "Brawo! Poprawna odpowiedź!" 
                        : questionType === 'multiple_choice' && currentQuestion.options
                          ? `Niepoprawnie. Prawidłowa odpowiedź to: ${currentQuestion.options[currentQuestion.correctIndex || 0]}`
                          : "Niepoprawnie. Spróbuj ponownie!"
                      }
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground" data-testid="demo-result-explanation">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              </div>
              
              {!isAuthenticated && (
                <div className="bg-gradient-to-r from-primary/10 to-chart-2/10 border border-primary/30 rounded-lg p-3 sm:p-4">
                  <div className="text-center space-y-2 sm:space-y-3">
                    <p className="text-xs sm:text-sm font-semibold text-foreground">
                      Chcesz nauczyć się więcej? 500+ podobnych pytań czeka!
                    </p>
                    <Button 
                      onClick={onRegisterClick}
                      className="w-full bg-primary hover:bg-primary/90 text-sm sm:text-base"
                      data-testid="demo-register-cta"
                    >
                      <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Rozpocznij naukę
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Rejestracja zajmuje mniej niż minutę
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {questions.length > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrev}
              disabled={currentIndex === 0}
              data-testid="demo-prev-button"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Poprzednie
            </Button>
            
            <div className="flex gap-1">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex 
                      ? 'bg-primary w-4' 
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  data-testid={`demo-dot-${idx}`}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={currentIndex === questions.length - 1}
              data-testid="demo-next-button"
            >
              Następne
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
