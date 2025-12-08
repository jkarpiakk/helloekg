import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LectureNavigation } from "@/components/LectureNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link } from "wouter";

export default function DynamicLecture() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const { user } = useAuth();

  const { data: section, isLoading } = useQuery({
    queryKey: ["/api/sections", sectionId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/modules/sections`);
      const sections = await response.json();
      return sections.find((s: any) => s.id === sectionId);
    },
    enabled: !!sectionId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background app-gradient-dark">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background app-gradient-dark px-4">
        <Card className="glass-card rounded-2xl shadow-app-lg border-0 p-6 text-center max-w-md w-full">
          <CardContent className="space-y-5 p-0">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Sekcja nie znaleziona</h2>
              <p className="text-muted-foreground text-base">
                Nie udało się znaleźć żądanej sekcji wykładu.
              </p>
            </div>
            <Button 
              asChild 
              className="w-full h-12 rounded-xl active:scale-[0.97] transition-transform shadow-glow-primary"
              data-testid="button-back"
            >
              <Link href="/dashboard">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Powrót do panelu
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleComplete = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-background app-gradient-dark">
      {/* Floating Back Button */}
      <div className="fixed top-4 left-4 z-50 safe-top">
        <Button 
          variant="outline" 
          size="sm"
          asChild
          className="h-10 px-3 rounded-xl glass-card active:scale-[0.97] transition-transform shadow-app"
          data-testid="button-back-floating"
        >
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Powrót</span>
          </Link>
        </Button>
      </div>

      <LectureNavigation 
        sectionId={sectionId!}
        sectionTitle={section.title}
        onComplete={handleComplete}
      />
    </div>
  );
}