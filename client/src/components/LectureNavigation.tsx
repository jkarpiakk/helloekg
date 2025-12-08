import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, ChevronLeft, ChevronRight, Check, Clock, FileText } from "lucide-react";
import { sanitizeMarkdown } from "@/lib/sanitize";

interface LectureChapter {
  id: string;
  title: string;
  contentMd: string;
  analogy?: string;
  keyPoints: string[];
  visual?: string;
  order: number;
}

interface LectureNavigationProps {
  sectionId: string;
  sectionTitle: string;
  onComplete?: () => void;
}

export function LectureNavigation({ sectionId, sectionTitle, onComplete }: LectureNavigationProps) {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [completedChapters, setCompletedChapters] = useState<Set<string>>(new Set());

  const { data: chapters, isLoading } = useQuery({
    queryKey: ["/api/sections", sectionId, "chapters"],
    queryFn: () => apiRequest("GET", `/api/sections/${sectionId}/chapters`).then(res => res.json()),
  });

  const currentChapter = chapters?.[currentChapterIndex];
  const totalChapters = chapters?.length || 0;
  const progress = totalChapters > 0 ? (completedChapters.size / totalChapters) * 100 : 0;

  const handleNext = () => {
    if (currentChapter) {
      setCompletedChapters(prev => new Set(Array.from(prev).concat(currentChapter.id)));
    }
    
    if (currentChapterIndex < totalChapters - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    } else if (onComplete) {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  };

  const handleJumpToChapter = (index: number) => {
    setCurrentChapterIndex(index);
  };

  const renderContent = (contentMd: string) => {
    return sanitizeMarkdown(contentMd);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex justify-center items-center" data-testid="loading-lecture">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!chapters || chapters.length === 0) {
    return (
      <Card className="glass-card rounded-2xl shadow-app p-6 text-center mx-4" data-testid="empty-lecture">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Brak treści wykładu</h3>
        <p className="text-muted-foreground text-base">
          Treść wykładu dla tej sekcji nie została jeszcze dodana.
        </p>
      </Card>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      {/* Sticky Header with Progress - Mobile Optimized */}
      <div className="sticky top-0 z-40 glass-card border-b border-border/50">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate" data-testid="lecture-title">
                {sectionTitle}
              </h1>
              <p className="text-sm text-muted-foreground">
                Rozdział {currentChapterIndex + 1} z {totalChapters}
              </p>
            </div>
            <Badge variant="secondary" className="px-3 py-1.5 rounded-lg text-xs" data-testid="lecture-progress">
              {Math.round(progress)}%
            </Badge>
          </div>
          <Progress value={progress} className="h-2" data-testid="progress-bar" />
        </div>
      </div>

      {/* Mobile Chapter Navigation - Horizontal Scroll */}
      <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          {chapters.map((chapter: LectureChapter, index: number) => (
            <Button
              key={chapter.id}
              variant={index === currentChapterIndex ? "default" : "outline"}
              size="sm"
              className={`h-10 px-4 rounded-xl whitespace-nowrap active:scale-[0.97] transition-transform ${
                index === currentChapterIndex ? 'shadow-glow-primary' : ''
              }`}
              onClick={() => handleJumpToChapter(index)}
              data-testid={`chapter-nav-${index}`}
            >
              {completedChapters.has(chapter.id) ? (
                <Check className="w-4 h-4 mr-2 text-green-500" />
              ) : (
                <span className="w-5 h-5 mr-2 flex items-center justify-center text-xs font-medium bg-muted/50 rounded-full">
                  {index + 1}
                </span>
              )}
              <span className="text-sm">{chapter.title.length > 20 ? chapter.title.substring(0, 20) + '...' : chapter.title}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content - Mobile Optimized */}
      <div className="px-4 space-y-4">
        {/* Chapter Title Card */}
        <div className="glass-card rounded-2xl shadow-app p-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1.5 rounded-lg font-medium">
              {currentChapterIndex + 1}/{totalChapters}
            </Badge>
            <h2 className="text-lg font-bold flex-1" data-testid="current-chapter-title">
              {currentChapter?.title}
            </h2>
          </div>
        </div>

        {/* Content Card */}
        <Card className="glass-card rounded-2xl shadow-app-lg border-0">
          <CardContent className="p-4 space-y-5">
            {/* Analogy section */}
            {currentChapter?.analogy && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">💡</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-primary text-sm mb-1">Analogia</h4>
                    <p className="text-foreground text-base leading-relaxed" data-testid="chapter-analogy">
                      {currentChapter.analogy}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Main content */}
            <div 
              className="prose dark:prose-invert max-w-none prose-p:text-base prose-p:leading-relaxed prose-headings:text-foreground"
              dangerouslySetInnerHTML={renderContent(currentChapter?.contentMd || "")}
              data-testid="chapter-content"
            />

            {/* Key Points */}
            {currentChapter?.keyPoints && currentChapter.keyPoints.length > 0 && (
              <div className="bg-chart-2/10 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-chart-2 flex items-center gap-2 text-base">
                  <div className="w-8 h-8 rounded-lg bg-chart-2/20 flex items-center justify-center">
                    <span>🔑</span>
                  </div>
                  Kluczowe punkty
                </h4>
                <ul className="space-y-3">
                  {currentChapter.keyPoints.map((point: string, index: number) => (
                    <li 
                      key={index} 
                      className="flex items-start gap-3"
                      data-testid={`key-point-${index}`}
                    >
                      <div className="w-6 h-6 rounded-full bg-chart-2/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-chart-2" />
                      </div>
                      <span className="text-base leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sticky Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-border/50 safe-bottom">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentChapterIndex === 0}
              className="h-12 px-4 rounded-xl active:scale-[0.97] transition-transform touch-bounce flex items-center gap-2"
              data-testid="button-previous"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Poprzedni</span>
            </Button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{currentChapterIndex + 1}</span>
              <span>/</span>
              <span>{totalChapters}</span>
            </div>

            <Button
              onClick={handleNext}
              className="h-12 px-4 rounded-xl active:scale-[0.97] transition-transform touch-bounce flex items-center gap-2 shadow-glow-primary"
              data-testid="button-next"
            >
              {currentChapterIndex === totalChapters - 1 ? (
                <>
                  <span className="hidden sm:inline">Zakończ</span>
                  <span className="sm:hidden">Koniec</span>
                  <Check className="w-5 h-5" />
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Następny</span>
                  <span className="sm:hidden">Dalej</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}