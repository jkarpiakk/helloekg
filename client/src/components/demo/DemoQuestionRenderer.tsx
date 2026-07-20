import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Check, X, GraduationCap, ChevronLeft, ChevronRight, 
  ListChecks, Puzzle, TextCursor, Link2, ArrowUpDown, Target,
  Lightbulb
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

/**
 * Etykiety typów pytań. Brand book §2 dopuszcza wyłącznie paletę marki, więc
 * kolorowe plakietki (fiolet, bursztyn, róż, pomarańcz) zostały usunięte —
 * typ pytania to etykieta mono w zieleni akcentu, bez tła.
 */
const QUESTION_TYPE_INFO: Record<QuestionType, { label: string; icon: React.ComponentType<{className?: string}>; color: string }> = {
  multiple_choice: { label: "ABCD", icon: ListChecks, color: "text-primary" },
  drag_drop: { label: "Przeciągnij", icon: Puzzle, color: "text-primary" },
  fill_blank: { label: "Uzupełnij", icon: TextCursor, color: "text-primary" },
  matching: { label: "Dopasuj", icon: Link2, color: "text-primary" },
  sorting: { label: "Uporządkuj", icon: ArrowUpDown, color: "text-primary" },
  hotspot: { label: "Zaznacz", icon: Target, color: "text-primary" },
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
          
          // §7: kontrolki radius 10px, touch ≥44px, border neutralny.
          // Poprawna = obwódka #0B7E54 + tinta 6% + „✓", NIGDY pełne wypełnienie.
          // `border-input` zamiast zaszytego #223040: ta wartość to linia motywu
          // CIEMNEGO, na bieli wychodziła ciężka. Token daje #223040 na ciemnym
          // i #E2E8E5 na jasnym, zgodnie z paletą §2.
          let buttonClass =
            "w-full min-h-[44px] px-4 py-3 border rounded-[10px] cursor-pointer transition-colors duration-200 text-left text-[15px] leading-relaxed";

          if (showResult) {
            if (optionIsCorrect) {
              buttonClass += " border-[#0B7E54] bg-[rgba(62,230,168,0.06)] text-foreground";
            } else if (isSelected) {
              buttonClass += " border-input text-muted-foreground";
            } else {
              buttonClass += " border-input text-muted-foreground";
            }
          } else {
            buttonClass += " border-input hover:border-primary/60 hover:bg-primary/[0.04]";
          }
          
          return (
            <button
              key={index}
              onClick={() => handleMultipleChoiceSelect(index)}
              className={buttonClass}
              disabled={showResult}
              data-testid={`demo-option-${index}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  {/* Oznaczenie odpowiedzi jako etykieta mono (§3) */}
                  <span
                    className="font-mono text-xs text-muted-foreground mr-3"
                    style={{ letterSpacing: "0.14em" }}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option}
                </div>
                {showResult && optionIsCorrect && (
                  <Check className="h-5 w-5 text-[#0B7E54] dark:text-primary" />
                )}
                {showResult && isSelected && !optionIsCorrect && (
                  <X className="h-5 w-5 text-destructive" />
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
        return <div className="text-destructive text-sm">Brak konfiguracji drag & drop</div>;
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
        return <div className="text-destructive text-sm">Brak konfiguracji uzupełniania luk</div>;
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
        return <div className="text-destructive text-sm">Brak konfiguracji dopasowywania</div>;
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
        return <div className="text-destructive text-sm">Brak konfiguracji sortowania</div>;
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
        return <div className="text-destructive text-sm">Brak konfiguracji zaznaczania obszarów</div>;
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
    /* Karta wg brand booka §7: border 1px hairline, radius 12px, BEZ cienia
       (spec: „Cienie: brak — płaskie powierzchnie"). Usunięty gradientowy pasek
       u góry — zieleń ma znaczyć impuls, nie służyć za tapetę. */
    <Card className="rounded-xl border border-border bg-card p-4 sm:p-5 lg:p-6 relative">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Etykieta mono: wersaliki, tracking 0,16em (§3) */}
            <span className="text-label text-[11px] text-muted-foreground" style={{ letterSpacing: "0.16em" }}>
              Pytanie {currentIndex + 1} / {questions.length}
            </span>
            <span
              className={`text-label text-[11px] inline-flex items-center gap-1.5 ${typeInfo.color}`}
              style={{ letterSpacing: "0.16em" }}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{typeInfo.label}</span>
            </span>
          </div>
          {/* Pasek postępu wg §5: tor #1E4536, wypełnienie #3EE6A8, 4px, radius 2px */}
          <div className="w-16 sm:w-24 h-1 rounded-[2px] bg-[#1E4536] overflow-hidden shrink-0">
            <div
              className="h-full rounded-[2px] bg-[#3EE6A8] transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {/* Title if exists */}
          {(currentQuestion as any).title && (
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground" data-testid="demo-question-title">
              {(currentQuestion as any).title}
            </h2>
          )}
          
          {/* Image above text if imagePosition is "above" */}
          {currentQuestion.imageUrl && questionType === 'multiple_choice' && ((currentQuestion as any).imagePosition === 'above' || !(currentQuestion as any).imagePosition) && (
            <div className="bg-white rounded-[10px] p-2 sm:p-3 border border-border">
              <img 
                src={currentQuestion.imageUrl || afEcgImage} 
                alt="Zapis EKG" 
                className="w-full h-auto rounded"
                data-testid="demo-ecg-image"
              />
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
            {/* Pytanie: Space Grotesk 500, skala H3 20/1.3 (§3) */}
            <div
              className="font-heading text-base sm:text-lg lg:text-xl font-medium leading-snug text-foreground prose prose-sm dark:prose-invert max-w-none [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:text-base [&>h3]:font-medium [&>p]:mt-2"
              data-testid="demo-question-text"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentQuestion.question) }}
            />
            {showResult && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto shrink-0 text-xs sm:text-sm"
                onClick={resetDemo}
                data-testid="reset-demo-button"
              >
                Spróbuj ponownie
              </Button>
            )}
          </div>
          
          {/* Image below text if imagePosition is "below" */}
          {currentQuestion.imageUrl && questionType === 'multiple_choice' && (currentQuestion as any).imagePosition === 'below' && (
            <div className="bg-white rounded-[10px] p-2 sm:p-3 border border-border">
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
              <div className={`p-4 rounded-[10px] border ${
                isCorrect
                  ? 'bg-[rgba(62,230,168,0.06)] border-[#0B7E54]'
                  : 'border-input'
              }`} data-testid="demo-result-panel">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Znacznik bez wypełnionego koła — płaska forma zgodnie z §7 */}
                    {isCorrect ? (
                      <Check className="h-5 w-5 shrink-0 mt-0.5 text-[#0B7E54] dark:text-primary" />
                    ) : (
                      <X className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                    )}
                    <div>
                      {/* Ton §8: błąd to nauka, nie karcenie */}
                      <p className={`font-heading text-base font-medium ${
                        isCorrect ? 'text-[#0B7E54] dark:text-primary' : 'text-foreground'
                      }`} data-testid="demo-result-status">
                        {isCorrect ? "Dobrze." : "Nie tym razem. Tu błędy nic nie kosztują."}
                      </p>
                      {!isCorrect && questionType === 'multiple_choice' && currentQuestion.options && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Prawidłowa: {currentQuestion.options[currentQuestion.correctIndex || 0]}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Wariant secondary: §7 dopuszcza JEDEN zielony przycisk na widok
                      (jest nim CTA rejestracji niżej). Bursztyn i pomarańcz nie
                      występują w palecie marki — usunięte. */}
                  <Button
                    variant="secondary"
                    onClick={() => setShowExplanationModal(true)}
                    className="shrink-0 text-xs sm:text-sm"
                    data-testid="open-explanation-modal"
                  >
                    <Lightbulb className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Zobacz wyjaśnienie</span>
                    <span className="sm:hidden">Wyjaśnienie</span>
                  </Button>
                </div>
              </div>
              
              {!isAuthenticated && (
                /* Bez gradientu tła — §2: zieleń nigdy jako tapeta. Zostaje hairline. */
                <div className="border border-border rounded-xl p-4">
                  <div className="text-center space-y-3">
                    <p className="font-heading text-sm sm:text-base font-medium text-foreground">
                      500 pytań czeka. To było jedno z nich.
                    </p>
                    <Button
                      onClick={onRegisterClick}
                      className="w-full text-sm sm:text-base"
                      data-testid="demo-register-cta"
                    >
                      <GraduationCap className="h-4 w-4 mr-2" />
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
            <DialogTitle className="flex items-center gap-3 font-heading text-xl sm:text-2xl font-medium">
              <Lightbulb className="h-6 w-6 text-primary shrink-0" />
              <span>Dlaczego tak jest?</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Question recap */}
            <div className="p-4 rounded-[10px] border border-border">
              <p className="text-label text-[11px] text-muted-foreground mb-2" style={{ letterSpacing: "0.16em" }}>
                Pytanie
              </p>
              <div
                className="font-medium text-foreground prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentQuestion?.question || '') }}
              />
            </div>

            {/* Result badge */}
            <div className="flex items-center gap-3">
              <div className={`text-label text-[11px] inline-flex items-center gap-2 ${
                isCorrect ? 'text-[#0B7E54] dark:text-primary' : 'text-muted-foreground'
              }`} style={{ letterSpacing: "0.16em" }}>
                {isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {isCorrect ? "Odpowiedź poprawna" : "Odpowiedź błędna"}
              </div>
            </div>

            {/* Correct answer for multiple choice */}
            {!isCorrect && questionType === 'multiple_choice' && currentQuestion?.options && (
              <div className="p-4 bg-[rgba(62,230,168,0.06)] rounded-[10px] border border-[#0B7E54]">
                <p className="text-sm text-[#0B7E54] dark:text-primary mb-1">Prawidłowa odpowiedź:</p>
                <p className="font-semibold text-[#0B7E54] dark:text-primary">
                  {String.fromCharCode(65 + (currentQuestion.correctIndex || 0))}. {currentQuestion.options[currentQuestion.correctIndex || 0]}
                </p>
              </div>
            )}

            {/* Main explanation */}
            <div className="space-y-3">
              <div className="p-5 rounded-xl border border-border">
                <div 
                  className="text-foreground leading-relaxed text-base sm:text-lg prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_p]:my-2 [&_strong]:font-bold [&_em]:italic [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground" 
                  data-testid="demo-result-explanation"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentQuestion?.explanation || '') }}
                />
              </div>
            </div>

            {/* CTA for non-authenticated users */}
            {!isAuthenticated && (
              <div className="mt-6 p-5 rounded-xl border border-border">
                <div className="text-center space-y-3">
                  <p className="font-heading font-medium text-foreground text-lg">
                    Tak wygląda każde pytanie w kursie.
                  </p>
                  <p className="text-muted-foreground">
                    500 pytań, każde z wyjaśnieniem. 16 godzin. Zero wkuwania.
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
