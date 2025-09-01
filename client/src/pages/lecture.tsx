import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2,
  Zap,
  Activity,
  Target,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import EKGSimulator from "@/components/lecture/EKGSimulator";

// Dane wykładu podzielone na sekcje
const lectureData = {
  title: "Moduł 1: Wprowadzenie do EKG - Rytm i Oś",
  duration: "45 min",
  sections: [
    {
      id: 1,
      title: "Serce jako zorganizowany zespół",
      content: "Wyobraź sobie swoje serce jako świetnie zorganizowany zespół. Każdy członek ma swoje zadanie, a całość działa jak idealnie zsynchronizowana maszyna.",
      analogy: "Serce = Orkiestra muzyczna",
      keyPoints: ["Każda część ma swoją rolę", "Synchronizacja jest kluczowa", "Jeden dyrygent zarządza wszystkim"],
      visual: "orchestra"
    },
    {
      id: 2,
      title: "Węzeł zatokowy - Dyrygent serca",
      content: "Cała magia zaczyna się w węźle zatokowym, który znajduje się w prawym przedsionku. To właśnie on nadaje rytm – dosłownie.",
      analogy: "Węzeł zatokowy = Dyrygent orkiestry",
      keyPoints: ["Znajduje się w prawym przedsionku", "Wysyła impulsy elektryczne", "Kontroluje rytm serca"],
      visual: "conductor"
    },
    {
      id: 3,
      title: "Węzeł AV - Światła na skrzyżowaniu",
      content: "Gdy impuls dociera do węzła AV, zatrzymuje się tam na chwilę. To jak kontrolowane światło na skrzyżowaniu - daje czas przedsionkom na zakończenie pracy.",
      analogy: "Węzeł AV = Światła na skrzyżowaniu",
      keyPoints: ["Kontroluje przepływ impulsów", "Daje czas przedsionkom", "Zapobiega chaosowi"],
      visual: "traffic"
    },
    {
      id: 4,
      title: "Pęczek Hisa - Rozwidlenie autostrady",
      content: "Pęczek Hisa rozdziela impuls na dwie ścieżki - jedną do prawej, drugą do lewej komory. To jak rozwidlenie autostrady.",
      analogy: "Pęczek Hisa = Rozwidlenie autostrady", 
      keyPoints: ["Dzieli impuls na dwie drogi", "Jedna ścieżka do każdej komory", "Równomierne rozprowadzenie sygnału"],
      visual: "highway"
    },
    {
      id: 5,
      title: "Włókna Purkinjego - Superszybkie przewody",
      content: "Włókna Purkinjego to jak superszybkie przewody elektryczne, które błyskawicznie rozprowadzają sygnał po komorach.",
      analogy: "Włókna Purkinjego = Światłowody internetowe",
      keyPoints: ["Najszybsze przewodzenie", "Docierają do całych komór", "Powodują równomierny skurcz"],
      visual: "cables"
    },
    {
      id: 6,
      title: "Zapis EKG - 12 kamer wokół serca",
      content: "EKG to jak 12 kamer ustawionych wokół serca. Każda patrzy z innej perspektywy i pokazuje nam różne aspekty pracy serca.",
      analogy: "Odprowadzenia EKG = Kamery bezpieczeństwa",
      keyPoints: ["12 różnych perspektyw", "V1-V6 na klatce piersiowej", "I,II,III,aVR,aVL,aVF na kończynach"],
      visual: "cameras"
    },
    {
      id: 7,
      title: "Załamki EKG - Nuty w partyturze",
      content: "Każdy załamek na EKG to jak nuta w partyturze. P = przedsionki, QRS = komory, T = odpoczynek.",
      analogy: "Załamki EKG = Nuty muzyczne",
      keyPoints: ["P = depolaryzacja przedsionków", "QRS = depolaryzacja komór", "T = repolaryzacja komór"],
      visual: "ekg-simulator"
    },
    {
      id: 8,
      title: "Częstość serca - Metoda 300",
      content: "Obliczanie częstości to prosta matematyka: liczymy kratki między załamkami R i dzielimy 300 przez tę liczbę.",
      analogy: "Częstość serca = Tempo metronomu",
      keyPoints: ["Metoda 300", "Liczymy duże kratki", "Rytm regularny vs nieregularny"],
      visual: "metronome"
    },
    {
      id: 9,
      title: "Oś serca - Kompas elektryczny",
      content: "Oś serca to jak kompas pokazujący główny kierunek przepływu elektryczności. Normalna oś: -30° do +90°.",
      analogy: "Oś serca = Kompas nawigacyjny",
      keyPoints: ["Kierunek przepływu elektryczności", "Norma: -30° do +90°", "Odchylenia wskazują na problemy"],
      visual: "compass"
    }
  ],
  quiz: [
    {
      question: "Co można porównać do dyrygenta orkiestry w sercu?",
      options: ["Węzeł AV", "Węzeł zatokowy", "Pęczek Hisa", "Włókna Purkinjego"],
      correct: 1,
      explanation: "Węzeł zatokowy nadaje rytm całemu sercu, podobnie jak dyrygent orkiestrze."
    },
    {
      question: "Ile odprowadzeń ma standardowe EKG?",
      options: ["6", "8", "10", "12"],
      correct: 3,
      explanation: "Standardowe EKG ma 12 odprowadzeń - jak 12 kamer patrzących na serce z różnych stron."
    }
  ]
};

export default function Lecture() {
  const [currentSection, setCurrentSection] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/?auth=login");
    }
  }, [isAuthenticated, setLocation]);

  const progress = ((currentSection + 1) / lectureData.sections.length) * 100;
  const section = lectureData.sections[currentSection];

  const nextSection = () => {
    if (currentSection < lectureData.sections.length - 1) {
      setCurrentSection(currentSection + 1);
      setShowQuiz(false);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setShowQuiz(true);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
      setShowQuiz(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setShowExplanation(true);
  };

  const renderVisual = (visualType: string) => {
    const visualComponents = {
      orchestra: (
        <div className="flex items-center justify-center space-x-4 text-6xl">
          <span>🎼</span>
          <Heart className="h-16 w-16 text-primary animate-pulse" />
          <span>🎵</span>
        </div>
      ),
      conductor: (
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
          <Zap className="h-16 w-16 text-primary relative z-10" />
        </div>
      ),
      traffic: (
        <div className="flex flex-col items-center space-y-2">
          <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
        </div>
      ),
      highway: (
        <div className="flex items-center space-x-2">
          <div className="w-8 h-1 bg-primary"></div>
          <div className="relative">
            <div className="w-8 h-1 bg-primary transform rotate-45 origin-left"></div>
            <div className="w-8 h-1 bg-primary transform -rotate-45 origin-left"></div>
          </div>
        </div>
      ),
      cables: (
        <Activity className="h-16 w-16 text-chart-2 animate-bounce" />
      ),
      cameras: (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({length: 9}).map((_, i) => (
            <div key={i} className="w-4 h-4 bg-chart-3 rounded-full animate-pulse" style={{animationDelay: `${i * 0.1}s`}}></div>
          ))}
        </div>
      ),
      music: (
        <div className="text-4xl space-x-2">
          <span>♪</span><span>♫</span><span>♪</span><span>♫</span>
        </div>
      ),
      metronome: (
        <div className="relative">
          <Target className="h-16 w-16 text-chart-4" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-8 bg-primary animate-pulse"></div>
          </div>
        </div>
      ),
      compass: (
        <div className="relative w-16 h-16 border-2 border-primary rounded-full flex items-center justify-center">
          <div className="w-0.5 h-6 bg-red-500 rotate-45"></div>
          <span className="absolute -top-6 text-xs font-semibold">N</span>
        </div>
      ),
      "ekg-simulator": (
        <div className="w-full">
          <EKGSimulator />
        </div>
      )
    };

    return visualComponents[visualType as keyof typeof visualComponents] || null;
  };

  if (!isAuthenticated) {
    return <div>Ładowanie...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Heart className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">{lectureData.title}</h1>
              <p className="text-muted-foreground">Czas trwania: {lectureData.duration}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Postęp wykładu</span>
              <span className="text-sm text-muted-foreground">
                {currentSection + 1} / {lectureData.sections.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {!showQuiz ? (
          <Card className="mb-8 overflow-hidden">
            <CardContent className="p-8">
              {/* Section Header */}
              <div className="flex items-center gap-4 mb-6">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  Sekcja {section.id}
                </Badge>
                <h2 className="text-2xl font-bold">{section.title}</h2>
              </div>

              {/* Main Content */}
              <div className="grid lg:grid-cols-2 gap-8 mb-8">
                {/* Text Content */}
                <div className="space-y-6">
                  <p className="text-lg leading-relaxed text-muted-foreground">
                    {section.content}
                  </p>
                  
                  {/* Analogy Box */}
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-primary">Analogia Feynmanowska</span>
                    </div>
                    <p className="text-foreground font-medium">{section.analogy}</p>
                  </div>

                  {/* Key Points */}
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-chart-2" />
                      Kluczowe punkty:
                    </h3>
                    <ul className="space-y-2">
                      {section.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <ArrowRight className="h-4 w-4 text-chart-2 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Visual Content */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-xl p-8">
                  <div className="mb-4">
                    {renderVisual(section.visual)}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Wizualizacja koncepcji
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <Button 
                  variant="outline" 
                  onClick={prevSection}
                  disabled={currentSection === 0}
                  className="flex items-center gap-2"
                >
                  <SkipBack className="h-4 w-4" />
                  Poprzednia
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex items-center gap-2"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? "Pauza" : "Odtwórz"}
                  </Button>
                </div>

                <Button 
                  onClick={nextSection}
                  className="flex items-center gap-2"
                >
                  {currentSection === lectureData.sections.length - 1 ? "Quiz" : "Następna"}
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Quiz Section */
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Quiz kontrolny</h2>
                <p className="text-muted-foreground">Sprawdź swoją wiedzę z wykładu</p>
              </div>

              {lectureData.quiz.map((quizItem, index) => (
                <div key={index} className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">{quizItem.question}</h3>
                  
                  <div className="space-y-3 mb-4">
                    {quizItem.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        onClick={() => handleAnswerSelect(optionIndex)}
                        disabled={selectedAnswer !== null}
                        className={`w-full p-4 text-left border rounded-lg transition-colors ${
                          selectedAnswer === null 
                            ? "hover:bg-secondary/50 border-border"
                            : selectedAnswer === optionIndex
                              ? optionIndex === quizItem.correct 
                                ? "bg-green-100 border-green-500 text-green-700"
                                : "bg-red-100 border-red-500 text-red-700"
                              : optionIndex === quizItem.correct
                                ? "bg-green-100 border-green-500 text-green-700"
                                : "border-border"
                        }`}
                      >
                        <span className="font-semibold mr-3">{String.fromCharCode(65 + optionIndex)}.</span>
                        {option}
                      </button>
                    ))}
                  </div>

                  {showExplanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">Wyjaśnienie:</h4>
                      <p className="text-blue-700">{quizItem.explanation}</p>
                    </div>
                  )}
                </div>
              ))}

              <div className="text-center">
                <Button onClick={() => setLocation("/dashboard")} size="lg">
                  Zakończ wykład
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}