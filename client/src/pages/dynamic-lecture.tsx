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
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <CardContent className="space-y-4">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Sekcja nie znaleziona</h2>
            <p className="text-muted-foreground">
              Nie udało się znaleźć żądanej sekcji wykładu.
            </p>
            <Button asChild>
              <Link href="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Powrót do panelu
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleComplete = () => {
    // TODO: Mark section as completed, update progress
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Powrót do panelu
            </Link>
          </Button>
        </div>

        <LectureNavigation 
          sectionId={sectionId!}
          sectionTitle={section.title}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}