import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  BookOpen,
  Lock,
  ChevronRight,
  CheckCircle2,
  Clock,
  Play,
  Users,
  Heart,
  Activity,
  Zap,
  Target,
  TrendingUp,
  Award
} from "lucide-react";

interface ModuleSection {
  id: string;
  title: string;
  description: string;
  order: number;
  completionPercentage: number;
  lastActivity?: string;
}

interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  isLocked: boolean;
  completionPercentage: number;
  sections: ModuleSection[];
}

const moduleIcons = {
  1: Heart,
  2: Activity,
  3: Zap,
  4: TrendingUp,
  5: Target,
  6: Award,
  7: Users
};

export default function Modules() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/?auth=login");
    }
  }, [isAuthenticated, setLocation]);

  // Fetch modules with sections and progress
  const { data: modules, isLoading } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json() as Promise<CourseModule[]>;
    },
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <div>Ładowanie...</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const getModuleStatus = (module: CourseModule) => {
    if (module.completionPercentage === 100) return "completed";
    if (module.completionPercentage > 0) return "in-progress";
    if (module.isLocked) return "locked";
    return "available";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600 bg-green-100 border-green-200";
      case "in-progress": return "text-blue-600 bg-blue-100 border-blue-200";
      case "locked": return "text-gray-400 bg-gray-100 border-gray-200";
      default: return "text-primary bg-primary/10 border-primary/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "Ukończony";
      case "in-progress": return "W trakcie";
      case "locked": return "Zablokowany";
      default: return "Dostępny";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Moduły Kursu EKG</h1>
              <p className="text-muted-foreground">
                Kompleksowy program nauczania interpretacji EKG
              </p>
            </div>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="space-y-6">
          {modules?.map((module) => {
            const status = getModuleStatus(module);
            const IconComponent = moduleIcons[module.order as keyof typeof moduleIcons] || BookOpen;
            const isAccessible = !module.isLocked;

            return (
              <Card 
                key={module.id} 
                className={`overflow-hidden transition-all duration-300 ${
                  isAccessible 
                    ? "hover:shadow-lg cursor-pointer border-border" 
                    : "opacity-60 border-gray-200"
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        isAccessible ? "bg-primary/10" : "bg-gray-100"
                      }`}>
                        {status === "locked" ? (
                          <Lock className="h-6 w-6 text-gray-400" />
                        ) : (
                          <IconComponent className={`h-6 w-6 ${
                            isAccessible ? "text-primary" : "text-gray-400"
                          }`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-xl">{module.title}</CardTitle>
                          <Badge className={getStatusColor(status)}>
                            {getStatusText(status)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Moduł {module.order}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {module.description}
                        </p>
                      </div>
                    </div>
                    
                    {isAccessible && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setLocation(`/module/${module.id}`)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  {isAccessible && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Postęp</span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(module.completionPercentage)}%
                        </span>
                      </div>
                      <Progress value={module.completionPercentage} className="h-2" />
                    </div>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Sections List */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground">
                      Sekcje ({module.sections.length})
                    </h4>
                    <div className="grid md:grid-cols-2 gap-3">
                      {module.sections.map((section, index) => (
                        <div
                          key={section.id}
                          className={`p-3 rounded-lg border transition-colors ${
                            isAccessible 
                              ? "hover:bg-secondary/50 border-border cursor-pointer" 
                              : "border-gray-200 cursor-not-allowed"
                          }`}
                          onClick={() => {
                            if (isAccessible) {
                              setLocation(`/quiz?section=${section.id}`);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              section.completionPercentage === 100
                                ? "bg-green-100 text-green-600"
                                : section.completionPercentage > 0
                                  ? "bg-blue-100 text-blue-600"
                                  : isAccessible
                                    ? "bg-gray-100 text-gray-600"
                                    : "bg-gray-50 text-gray-400"
                            }`}>
                              {section.completionPercentage === 100 ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-sm truncate">{section.title}</h5>
                              {section.description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {section.description}
                                </p>
                              )}
                            </div>
                            {section.completionPercentage > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {Math.round(section.completionPercentage)}%
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Module Actions */}
                  {isAccessible && (
                    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
                      <Button 
                        size="sm" 
                        onClick={() => setLocation(`/module/${module.id}`)}
                        className="flex-1"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {module.completionPercentage > 0 ? "Kontynuuj" : "Rozpocznij"}
                      </Button>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>~{module.sections.length * 15} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          <span>{module.sections.length} sekcji</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Course Summary */}
        <div className="mt-12 bg-gradient-to-r from-primary/10 to-chart-2/10 rounded-xl p-6">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">Zakończ wszystkie moduły</h3>
            <p className="text-muted-foreground mb-4">
              Aby otrzymać certyfikat ukończenia kursu EKG Academy
            </p>
            <div className="flex justify-center gap-6 text-sm">
              {modules && (
                <>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-chart-2" />
                    <span>{modules.length} modułów</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-chart-3" />
                    <span>{modules.reduce((acc, m) => acc + m.sections.length, 0)} sekcji</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-chart-4" />
                    <span>~{modules.reduce((acc, m) => acc + m.sections.length, 0) * 15} minut</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}