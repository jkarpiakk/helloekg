import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import AuthForms from "@/components/auth/AuthForms";
import PricingSection from "@/components/payment/PricingSection";
import { Play, Info, Users, Award, Star, GraduationCap, Check, BookOpen, Heart, X } from "lucide-react";
import { Link } from "wouter";
import afEcgImage from "@assets/af ecg_1757697444254.jpg";
import type { DemoQuestion } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  // Check URL parameters for auth mode
  const urlParams = new URLSearchParams(window.location.search);
  const authParam = urlParams.get('auth');
  
  // Open auth dialog if URL param exists
  useEffect(() => {
    if (authParam === 'login' || authParam === 'register') {
      setAuthMode(authParam);
    }
  }, [authParam]);

  const handleAuthSuccess = () => {
    setAuthMode(null);
    // Remove auth param from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    window.history.replaceState({}, '', url.pathname);
  };

  // Fetch demo question from API
  const { data: apiDemoQuestion } = useQuery({
    queryKey: ["/api/demo-question"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/demo-question");
      return response.json() as Promise<DemoQuestion>;
    },
  });

  // Fallback to hardcoded question if API fails
  const demoQuestion = apiDemoQuestion ? {
    question: apiDemoQuestion.question,
    options: apiDemoQuestion.options,
    correct: apiDemoQuestion.correctIndex,
    explanation: apiDemoQuestion.explanation,
    imageUrl: apiDemoQuestion.imageUrl
  } : {
    question: "Jaki rytm widoczny jest na poniższym zapisie EKG?",
    options: ["Rytm zatokowy prawidłowy", "Migotanie przedsionków", "Blok AV III stopnia", "Częstoskurcz komorowy"],
    correct: 1,
    explanation: "Wyobraź sobie orkiestrę bez dyrygenta! W normalnym rytmie wszyscy muzycy słuchają jednego dyrygenta i grają w takcie. Ale w migotaniu przedsionków nagle dziesiątki muzyków zaczyna grać swoje własne melodie jednocześnie - jeden gra walca, drugi tango, trzeci rock. Powstaje kompletny chaos! Przedsionki 'migocą' od tych wszystkich sprzecznych sygnałów, a komory próbują nadążyć za tym chaosem - stąd ten nieregularny, nieprzewidywalny rytm, jakby serce 'potykało się' przy każdym uderzeniu."
  };

  const handleAnswerSelect = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);
  };

  const resetDemo = () => {
    setSelectedAnswer(null);
    setShowResult(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        {/* Medical pattern background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/10"></div>
        <div className="absolute inset-0 opacity-5 ekg-pattern"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge className="inline-flex items-center px-3 py-1 text-sm bg-primary/10 text-primary border border-primary/20" data-testid="hero-badge">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  {t("hero.badge")}
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                  <span>Odkryj Sekrety EKG</span><br />
                  <span className="text-primary">Kurs, który Zmienia Nauczanie</span>
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Czy kiedykolwiek patrzyłeś na zapis EKG i widziałeś tylko tajemnicze fale? W tym kursie odmienimy Twoje spojrzenie na elektrokardiografię. Dzięki metodzie Feynmanowskiej, opowieści o sercu przestają być skomplikowanymi schematami – staną się historiami, które naprawdę zrozumiesz.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                {isAuthenticated ? (
                  <Button size="lg" className="shadow-lg hover:scale-105 transition-transform" asChild data-testid="start-learning-button">
                    <Link href="/dashboard">
                      <Play className="h-5 w-5 mr-2" />
                      {t("hero.cta.start")}
                    </Link>
                  </Button>
                ) : (
                  <Button 
                    size="lg" 
                    className="shadow-lg hover:scale-105 transition-transform"
                    onClick={() => setAuthMode("register")}
                    data-testid="start-learning-button"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {t("hero.cta.start")}
                  </Button>
                )}
                <Button variant="outline" size="lg" data-testid="how-it-works-button">
                  <Info className="h-5 w-5 mr-2" />
                  {t("hero.cta.learn")}
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center gap-6 pt-4">
                <div className="flex items-center text-muted-foreground">
                  <Users className="h-5 w-5 mr-2" />
                  <span>{t("hero.stats.students")}</span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Award className="h-5 w-5 mr-2" />
                  <span>{t("hero.stats.certificates")}</span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Star className="h-5 w-5 mr-2" />
                  <span>{t("hero.stats.rating")}</span>
                </div>
              </div>
            </div>

            {/* Hero Demo */}
            <div className="relative">
              <Card className="shadow-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary to-chart-2"></div>
                
                {/* Sample quiz preview */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Pytanie 1 z 10</span>
                    <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="w-2 h-full bg-primary rounded-full"></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        {demoQuestion.question}
                      </h3>
                      {showResult && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={resetDemo}
                          data-testid="reset-demo-button"
                        >
                          Spróbuj ponownie
                        </Button>
                      )}
                    </div>
                    
                    {/* Real EKG image - Atrial Fibrillation */}
                    <div className="bg-white rounded-lg p-4 border border-border">
                      <img 
                        src={demoQuestion.imageUrl || afEcgImage} 
                        alt="Zapis EKG" 
                        className="w-full h-auto rounded"
                        data-testid="demo-ecg-image"
                      />
                    </div>

                    {/* Interactive quiz options */}
                    <div className="space-y-3">
                      {demoQuestion.options.map((option, index) => {
                        const isSelected = selectedAnswer === index;
                        const isCorrect = index === demoQuestion.correct;
                        
                        let buttonClass = "p-4 border border-border rounded-lg cursor-pointer transition-all duration-200 text-left";
                        
                        if (showResult) {
                          if (isCorrect) {
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
                            onClick={() => handleAnswerSelect(index)}
                            className={buttonClass}
                            disabled={showResult}
                            data-testid={`demo-option-${index}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
                                {option}
                              </div>
                              {showResult && isCorrect && (
                                <Check className="h-5 w-5 text-green-600" />
                              )}
                              {showResult && isSelected && !isCorrect && (
                                <X className="h-5 w-5 text-red-600" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Result explanation */}
                    {showResult && (
                      <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg" data-testid="demo-result-panel">
                        <div className="flex items-start space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            selectedAnswer === demoQuestion.correct 
                              ? 'bg-green-500 text-white' 
                              : 'bg-red-500 text-white'
                          }`}>
                            {selectedAnswer === demoQuestion.correct ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-foreground mb-1" data-testid="demo-result-status">
                              {selectedAnswer === demoQuestion.correct 
                                ? "Brawo! Poprawna odpowiedź!" 
                                : "Niepoprawnie. Prawidłowa odpowiedź to: " + demoQuestion.options[demoQuestion.correct]
                              }
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid="demo-result-explanation">
                              {demoQuestion.explanation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
              
              {/* Floating success element */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-chart-2 rounded-full flex items-center justify-center shadow-lg">
                <Check className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Dlaczego ten kurs jest inny?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Tradycyjne podejście do EKG często opiera się na wkuwaniu definicji i schematów. My zastosowaliśmy sprawdzone metody naukowe, które sprawiają, że nauka jest skuteczniejsza i trwała.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center group">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <GraduationCap className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Metoda Feynmanowska
              </h3>
              <p className="text-muted-foreground">
                Skomplikowane mechanizmy zostają przełożone na proste, codzienne obrazy. Impuls w węźle zatokowym działa jak dyrygent orkiestry, a zespół QRS to potężny silnik komór serca.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center group">
              <div className="w-20 h-20 bg-chart-2 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <Play className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Active Recall
              </h3>
              <p className="text-muted-foreground">
                Każda sekcja kończy się pytaniami, które zmuszają Cię do przywołania wiedzy z pamięci. To sprawdzona metoda, która znacznie poprawia zdolność do trwałego zapamiętania informacji.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center group">
              <div className="w-20 h-20 bg-chart-3 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <Award className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">
                Powtarzanie sukcesywne
              </h3>
              <p className="text-muted-foreground">
                Regularnie wracamy do kluczowych informacji w różnym kontekście, zgodnie z krzywą zapominania. Każdy nowy element wiedzy buduje się na solidnych fundamentach.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Course Content Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Co zawiera kurs?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Kompleksowy program oparty na badaniach naukowych, zaprojektowany dla trwałej nauki
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* 500+ Questions */}
            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">500+</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Pytań w formie quizu
              </h3>
              <p className="text-muted-foreground text-sm">
                Z natychmiastowym feedbackiem i szczegółowymi wyjaśnieniami każdej odpowiedzi
              </p>
            </div>

            {/* Structured Chapters */}
            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-chart-2/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-chart-2" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Strukturalne rozdziały
              </h3>
              <p className="text-muted-foreground text-sm">
                Od podstaw do zaawansowanych zagadnień: rytm, oś serca, arytmie i zawały
              </p>
            </div>

            {/* Clinical Cases */}
            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-chart-3/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-8 w-8 text-chart-3" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Przypadki kliniczne
              </h3>
              <p className="text-muted-foreground text-sm">
                Prawdziwe zapisy EKG analizowane krok po kroku w praktycznym kontekście
              </p>
            </div>

            {/* Scientific Methods */}
            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-chart-4/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-chart-4" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Metody oparte na badaniach
              </h3>
              <p className="text-muted-foreground text-sm">
                Successive relearning i aktywne przywoływanie dla trwałości wiedzy
              </p>
            </div>
          </div>

          {/* Target Audience */}
          <div className="mt-16 bg-secondary/20 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Dla kogo jest ten kurs?
              </h3>
              <p className="text-lg text-muted-foreground max-w-4xl mx-auto">
                Stworzony dla wszystkich, którzy chcą zrozumieć EKG – od studentów medycyny, przez pielęgniarki i ratowników medycznych, 
                aż po każdego, kto chce poszerzyć swoje horyzonty. Nie musisz mieć wcześniejszego doświadczenia – zaczynamy od podstaw.
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4">
              {[
                "Studenci medycyny",
                "Pielęgniarki", 
                "Ratownicy medyczni",
                "Lekarze",
                "Osoby zainteresowane medycyną"
              ].map((audience, index) => (
                <div key={index} className="bg-background border border-border rounded-full px-4 py-2">
                  <span className="text-sm font-medium text-foreground">{audience}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* Auth Dialog */}
      <Dialog open={authMode !== null} onOpenChange={() => setAuthMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="sr-only">
            {authMode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
          </DialogTitle>
          {authMode && (
            <AuthForms 
              mode={authMode} 
              onSuccess={handleAuthSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
