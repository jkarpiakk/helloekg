import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Check, X, GraduationCap, ChevronLeft, ChevronRight, 
  ListChecks, Puzzle, TextCursor, Link2, ArrowUpDown, Target,
  Lightbulb, Sparkles
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { DemoQuestion, QuestionConfig, DragDropConfig, FillBlankConfig, MatchingConfig, SortingConfig, HotspotConfig } from "@shared/schema";
import type { QuestionType, AnswerData, DragDropAnswer, FillBlankAnswer, MatchingAnswer, SortingAnswer, HotspotAnswer } from "@/types";
import afEcgImage from "@assets/af ecg_1757697444254.jpg";
import DOMPurify from "dompurify";

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
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const { isAuthenticated } = useAuth();

  const currentQuestion = questions[currentIndex];
  const questionType = (currentQuestion?.questionType || 'multiple_choice') as QuestionType;
  const questionConfig = currentQuestion?.questionConfig as QuestionConfig | undefined;

  useEffect(() => {
    setSelectedAnswer(null);
    setCurrentAnswer(null);
    setShowResult(false);
    setIsCorrect(false);
    setShowExplanationModal(false);
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

  // Helper to extract config from both nested and flat structures
  const extractConfig = useCallback(() => {
    if (!questionConfig) return null;
    if ('config' in questionConfig && questionConfig.config) {
      return questionConfig.config;
    }
    // Flat structure - the questionConfig itself contains the config data
    const { type, ...configData } = questionConfig as any;
    return configData;
  }, [questionConfig]);

  const handleSubmitInteractive = () => {
    if (!currentAnswer || !questionConfig) return;
    
    let correct = false;
    const config = extractConfig();
    if (!config) return;
    
    if (questionConfig.type === 'drag_drop' && currentAnswer.type === 'drag_drop') {
      const ddConfig = config as DragDropConfig;
      const ddAnswer = currentAnswer as DragDropAnswer;
      const placements = ddAnswer.placements;
      correct = ddConfig.targets.every((target) => {
        const placed = placements.find(p => p.targetId === target.id);
        return placed && placed.sourceId === target.acceptsSourceId;
      });
    }
    
    if (questionConfig.type === 'fill_blank' && currentAnswer.type === 'fill_blank') {
      const fbConfig = config as FillBlankConfig;
      const fbAnswer = currentAnswer as FillBlankAnswer;
      const filledBlanks = fbAnswer.filledBlanks || [];
      correct = fbConfig.blanks.every((blank) => {
        const userBlank = filledBlanks.find(fb => fb.blankId === blank.id);
        const userAnswer = (userBlank?.value || '').toLowerCase().trim();
        return blank.correctAnswers.some((a: string) => a.toLowerCase().trim() === userAnswer);
      });
    }
    
    if (questionConfig.type === 'matching' && currentAnswer.type === 'matching') {
      const mConfig = config as MatchingConfig;
      const mAnswer = currentAnswer as MatchingAnswer;
      const userPairs = mAnswer.pairs;
      correct = mConfig.correctPairs.every((cp) => {
        return userPairs.some(up => up.leftId === cp.leftId && up.rightId === cp.rightId);
      }) && userPairs.length === mConfig.correctPairs.length;
    }
    
    if (questionConfig.type === 'sorting' && currentAnswer.type === 'sorting') {
      const sConfig = config as SortingConfig;
      const sAnswer = currentAnswer as SortingAnswer;
      const userOrder = sAnswer.order;
      correct = userOrder.length === sConfig.correctOrder.length &&
        userOrder.every((id, index) => id === sConfig.correctOrder[index]);
    }
    
    if (questionConfig.type === 'hotspot' && currentAnswer.type === 'hotspot') {
      const hConfig = config as HotspotConfig;
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
    if (!questionConfig || questionConfig.type === 'multiple_choice') {
      return null;
    }

    const mockResult = showResult ? {
      isCorrect,
      correctIndex: 0,
      explanation: currentQuestion.explanation,
      timeMs: 0,
      feedback: isCorrect ? { correctItems: [], incorrectItems: [] } : { correctItems: [], incorrectItems: [] }
    } : undefined;

    // Handle both nested config structure and flat structure from database
    const getConfig = () => {
      if ('config' in questionConfig && questionConfig.config) {
        return questionConfig.config;
      }
      // Flat structure - the questionConfig itself contains the config data
      const { type, ...configData } = questionConfig as any;
      return configData;
    };

    if (questionConfig.type === 'drag_drop') {
      const config = getConfig() as DragDropConfig;
      if (!config.sources || !config.targets) {
        return <div className="text-amber-600 text-sm">Brak konfiguracji drag & drop</div>;
      }
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
      const config = getConfig() as FillBlankConfig;
      if (!config.blanks || !config.template) {
        return <div className="text-amber-600 text-sm">Brak konfiguracji uzupełniania luk</div>;
      }
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
      const config = getConfig() as MatchingConfig;
      if (!config.leftColumn || !config.rightColumn || !config.correctPairs) {
        return <div className="text-amber-600 text-sm">Brak konfiguracji dopasowywania</div>;
      }
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
      const config = getConfig() as SortingConfig;
      if (!config.items || !config.correctOrder) {
        return <div className="text-amber-600 text-sm">Brak konfiguracji sortowania</div>;
      }
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
      const config = getConfig() as HotspotConfig;
      if (!config.hotspots || !config.imageUrl) {
        return <div className="text-amber-600 text-sm">Brak konfiguracji zaznaczania obszarów</div>;
      }
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
    <Card className="shadow-app-lg rounded-2xl p-3 sm:p-4 lg:p-6 relative overflow-hidden">
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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
            <div 
              className="text-sm sm:text-base lg:text-lg font-semibold text-foreground prose prose-sm dark:prose-invert max-w-none [&>h2]:text-lg [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:text-base [&>h3]:font-semibold [&>p]:mt-2" 
              data-testid="demo-question-text"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentQuestion.question) }}
            />
            {showResult && (
              <Button 
                variant="outline" 
                size="sm"
                className="w-full sm:w-auto min-h-[40px] rounded-xl active:scale-[0.97] transition-transform text-xs sm:text-sm"
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
              <div className={`p-3 sm:p-4 rounded-lg border ${
                isCorrect 
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                  : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              }`} data-testid="demo-result-panel">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCorrect ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {isCorrect ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : (
                        <X className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div>
                      <p className={`font-bold text-base sm:text-lg ${
                        isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                      }`} data-testid="demo-result-status">
                        {isCorrect ? "Brawo! Poprawna odpowiedź!" : "Niepoprawna odpowiedź"}
                      </p>
                      {!isCorrect && questionType === 'multiple_choice' && currentQuestion.options && (
                        <p className="text-sm text-muted-foreground">
                          Prawidłowa: {currentQuestion.options[currentQuestion.correctIndex || 0]}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowExplanationModal(true)}
                    className="min-h-[44px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg rounded-xl active:scale-[0.97] transition-transform text-xs sm:text-sm"
                    data-testid="open-explanation-modal"
                  >
                    <Lightbulb className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Zobacz wyjaśnienie</span>
                    <span className="sm:hidden">Wyjaśnienie</span>
                  </Button>
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
                      className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-sm sm:text-base rounded-xl active:scale-[0.97] transition-transform shadow-app"
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
              className="min-h-[44px] min-w-[44px] rounded-xl active:scale-[0.97] transition-transform text-xs sm:text-sm px-2 sm:px-3"
              data-testid="demo-prev-button"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Poprzednie</span>
            </Button>
            
            <div className="flex gap-1.5 sm:gap-1">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full transition-all ${
                    idx === currentIndex 
                      ? 'bg-primary w-5 sm:w-4' 
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
              className="min-h-[44px] min-w-[44px] rounded-xl active:scale-[0.97] transition-transform text-xs sm:text-sm px-2 sm:px-3"
              data-testid="demo-next-button"
            >
              <span className="hidden sm:inline">Następne</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Explanation Modal */}
      <Dialog open={showExplanationModal} onOpenChange={setShowExplanationModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Lightbulb className="h-6 w-6 text-white" />
              </div>
              <span>Wyjaśnienie odpowiedzi</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Question recap */}
            <div className="p-4 bg-secondary/50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-2">Pytanie:</p>
              <p className="font-medium text-foreground">{currentQuestion?.question}</p>
            </div>

            {/* Result badge */}
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 ${
                isCorrect 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {isCorrect ? (
                  <>
                    <Check className="h-5 w-5" />
                    Poprawna odpowiedź!
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5" />
                    Niepoprawna odpowiedź
                  </>
                )}
              </div>
            </div>

            {/* Correct answer for multiple choice */}
            {!isCorrect && questionType === 'multiple_choice' && currentQuestion?.options && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-600 dark:text-green-400 mb-1">Prawidłowa odpowiedź:</p>
                <p className="font-semibold text-green-700 dark:text-green-300">
                  {String.fromCharCode(65 + (currentQuestion.correctIndex || 0))}. {currentQuestion.options[currentQuestion.correctIndex || 0]}
                </p>
              </div>
            )}

            {/* Main explanation */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-semibold text-lg">Dlaczego tak jest?</h3>
              </div>
              <div className="p-5 bg-gradient-to-br from-primary/5 to-chart-2/5 rounded-xl border border-primary/20">
                <div 
                  className="text-foreground leading-relaxed text-base sm:text-lg prose prose-sm dark:prose-invert max-w-none" 
                  data-testid="demo-result-explanation"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentQuestion?.explanation || '') }}
                />
              </div>
            </div>

            {/* CTA for non-authenticated users */}
            {!isAuthenticated && (
              <div className="mt-6 p-5 bg-gradient-to-r from-primary/10 to-chart-2/10 rounded-xl border border-primary/30">
                <div className="text-center space-y-3">
                  <p className="font-semibold text-foreground text-lg">
                    🎓 Chcesz nauczyć się więcej?
                  </p>
                  <p className="text-muted-foreground">
                    Dołącz do kursu i uzyskaj dostęp do 500+ pytań z wyjaśnieniami!
                  </p>
                  <Button 
                    onClick={() => {
                      setShowExplanationModal(false);
                      onRegisterClick();
                    }}
                    size="lg"
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                    data-testid="modal-register-cta"
                  >
                    <GraduationCap className="h-5 w-5 mr-2" />
                    Rozpocznij naukę teraz
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
