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
      <div className="flex justify-center items-center p-8" data-testid="loading-lecture">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!chapters || chapters.length === 0) {
    return (
      <Card className="p-8 text-center" data-testid="empty-lecture">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Brak treści wykładu</h3>
        <p className="text-muted-foreground">
          Treść wykładu dla tej sekcji nie została jeszcze dodana.
        </p>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="lecture-title">
              <BookOpen className="w-6 h-6" />
              {sectionTitle}
            </h1>
            <p className="text-muted-foreground">
              Rozdział {currentChapterIndex + 1} z {totalChapters}
            </p>
          </div>
          <Badge variant="secondary" data-testid="lecture-progress">
            <Clock className="w-4 h-4 mr-1" />
            {Math.round(progress)}% ukończone
          </Badge>
        </div>

        <Progress value={progress} className="w-full" data-testid="progress-bar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Spis treści</h3>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-2">
                  {chapters.map((chapter: LectureChapter, index: number) => (
                    <Button
                      key={chapter.id}
                      variant={index === currentChapterIndex ? "default" : "ghost"}
                      className="w-full justify-start text-left h-auto p-3"
                      onClick={() => handleJumpToChapter(index)}
                      data-testid={`chapter-nav-${index}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {completedChapters.has(chapter.id) ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <span className="w-4 h-4 flex items-center justify-center text-xs font-medium bg-muted rounded-full">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {chapter.title}
                          </p>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold" data-testid="current-chapter-title">
                  {currentChapter?.title}
                </h2>
                <Badge variant="outline">
                  Rozdział {currentChapterIndex + 1}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Analogy section */}
              {currentChapter?.analogy && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border-l-4 border-blue-500">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">Analogia</h4>
                      <p className="text-blue-800 dark:text-blue-200" data-testid="chapter-analogy">
                        {currentChapter.analogy}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Main content */}
              <div 
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={renderContent(currentChapter?.contentMd || "")}
                data-testid="chapter-content"
              />

              {/* Key Points */}
              {currentChapter?.keyPoints && currentChapter.keyPoints.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-3 flex items-center">
                    <span className="mr-2">🔑</span>
                    Kluczowe punkty
                  </h4>
                  <ul className="space-y-2">
                    {currentChapter.keyPoints.map((point: string, index: number) => (
                      <li 
                        key={index} 
                        className="text-green-800 dark:text-green-200 flex items-start"
                        data-testid={`key-point-${index}`}
                      >
                        <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator />

              {/* Navigation buttons */}
              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentChapterIndex === 0}
                  data-testid="button-previous"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Poprzedni
                </Button>

                <div className="text-sm text-muted-foreground">
                  {currentChapterIndex + 1} / {totalChapters}
                </div>

                <Button
                  onClick={handleNext}
                  data-testid="button-next"
                >
                  {currentChapterIndex === totalChapters - 1 ? (
                    <>
                      Zakończ
                      <Check className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Następny
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}