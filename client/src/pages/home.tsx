import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import AuthForms from "@/components/auth/AuthForms";
import PricingSection from "@/components/payment/PricingSection";
import DemoQuestionRenderer from "@/components/demo/DemoQuestionRenderer";
import { EKGDivider } from "@/components/ui/ekg-divider";
import { Play, Info, Users, Award, Star, GraduationCap, Check, BookOpen, Heart } from "lucide-react";
import { Link } from "wouter";
import type { DemoQuestion } from "@shared/schema";

// Serce 3D ładowane leniwie (three.js poza głównym bundle), nie blokuje LCP
const Hero3DHeart = lazy(() => import("@/components/Hero3DHeart"));
const HeroEKGStrip = lazy(() => import("@/components/HeroEKGStrip"));

const FALLBACK_DEMO_QUESTIONS: DemoQuestion[] = [{
  id: 'fallback-1',
  title: null,
  imagePosition: null,
  question: "Jaki rytm widoczny jest na poniższym zapisie EKG?",
  options: ["Rytm zatokowy prawidłowy", "Migotanie przedsionków", "Blok AV III stopnia", "Częstoskurcz komorowy"],
  correctIndex: 1,
  explanation: "Wyobraź sobie orkiestrę bez dyrygenta! W normalnym rytmie wszyscy muzycy słuchają jednego dyrygenta i grają w takcie. Ale w migotaniu przedsionków nagle dziesiątki muzyków zaczyna grać swoje własne melodie jednocześnie - jeden gra walca, drugi tango, trzeci rock. Powstaje kompletny chaos! Przedsionki 'migocą' od tych wszystkich sprzecznych sygnałów, a komory próbują nadążyć za tym chaosem - stąd ten nieregularny, nieprzewidywalny rytm, jakby serce 'potykało się' przy każdym uderzeniu.",
  imageUrl: null,
  questionType: 'multiple_choice',
  questionConfig: null,
  displayOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}];

export default function Home() {
  const [location, setLocation] = useLocation();
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authParam = urlParams.get('auth');
    
    if (authParam === 'login' || authParam === 'register') {
      setAuthMode(authParam);
    }
  }, [location]);

  const handleAuthSuccess = () => {
    setAuthMode(null);
    setLocation("/dashboard");
  };

  const { data: demoQuestions } = useQuery({
    queryKey: ["/api/demo-questions"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/demo-questions");
      return response.json() as Promise<DemoQuestion[]>;
    },
  });

  const questions = (demoQuestions && demoQuestions.length > 0) ? demoQuestions : FALLBACK_DEMO_QUESTIONS;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 lg:py-32 overflow-hidden">
        {/* Medical pattern background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/10"></div>
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            {/* Hero Content */}
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-3 sm:space-y-4">
                <Badge className="inline-flex items-center px-3 py-1 text-xs sm:text-sm bg-primary/10 text-primary border border-primary/20" data-testid="hero-badge">
                  <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  {t("hero.badge")}
                </Badge>
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                  <span>Odkryj Sekrety EKG</span><br />
                  <span className="text-primary">Kurs, który Zmienia Nauczanie</span>
                </h1>
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
                  Czy kiedykolwiek patrzyłeś na zapis EKG i widziałeś tylko tajemnicze fale? W tym kursie odmienimy Twoje spojrzenie na elektrokardiografię. Dzięki metodzie Feynmanowskiej, opowieści o sercu przestają być skomplikowanymi schematami – staną się historiami, które naprawdę zrozumiesz.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {isAuthenticated ? (
                  <Button className="min-h-[44px] shadow-app-lg hover:scale-105 active:scale-[0.97] transition-transform w-full sm:w-auto rounded-xl text-base" asChild data-testid="start-learning-button">
                    <Link href="/dashboard">
                      <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      {t("hero.cta.start")}
                    </Link>
                  </Button>
                ) : (
                  <Button 
                    className="min-h-[44px] shadow-app-lg hover:scale-105 active:scale-[0.97] transition-transform w-full sm:w-auto rounded-xl text-base"
                    onClick={() => setAuthMode("register")}
                    data-testid="start-learning-button"
                  >
                    <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    {t("hero.cta.start")}
                  </Button>
                )}
                <Button 
                  variant="outline"
                  className="min-h-[44px] active:scale-[0.97] transition-transform w-full sm:w-auto rounded-xl text-base"
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ 
                      behavior: 'smooth',
                      block: 'start'
                    });
                  }}
                  data-testid="how-it-works-button"
                >
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  {t("hero.cta.learn")}
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2 sm:pt-4">
                <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                  <span>{t("hero.stats.students")}</span>
                </div>
                <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                  <Award className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                  <span>{t("hero.stats.certificates")}</span>
                </div>
                <div className="flex items-center text-muted-foreground text-xs sm:text-sm">
                  <Star className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                  <span>{t("hero.stats.rating")}</span>
                </div>
              </div>

              {/* Serce 3D — tylko w hero (nie miniaturyzować do ikon), pod nim
                  zsynchronizowany zapis P-QRS-T w tym samym rytmie 72 BPM */}
              <div className="space-y-1" data-testid="hero-3d-heart">
                <div className="flex justify-center lg:justify-start">
                  <Suspense fallback={<div style={{ width: 320, height: 320 }} aria-hidden="true" />}>
                    <Hero3DHeart size={320} />
                  </Suspense>
                </div>
                <Suspense fallback={<div style={{ height: 64 }} aria-hidden="true" />}>
                  <HeroEKGStrip />
                </Suspense>
              </div>
            </div>

            {/* Hero Demo - All 6 Question Types */}
            <div className="relative">
              <DemoQuestionRenderer 
                questions={questions}
                onRegisterClick={() => setAuthMode("register")}
              />
              
              {/* Floating success element */}
              <div className="hidden sm:flex absolute -top-4 -right-4 w-16 h-16 sm:w-20 sm:h-20 bg-chart-2 rounded-full items-center justify-center shadow-lg">
                <Check className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <EKGDivider />
      </div>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-12 sm:py-16 lg:py-20 bg-secondary/30">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">
              Dlaczego ten kurs jest inny?
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-3xl mx-auto">
              Tradycyjne podejście do EKG często opiera się na wkuwaniu definicji i schematów. My zastosowaliśmy sprawdzone metody naukowe, które sprawiają, że nauka jest skuteczniejsza i trwała.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Step 1 */}
            <div className="text-center group bg-card/50 rounded-2xl p-4 sm:p-6 shadow-app">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-glow-primary">
                <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">
                Metoda Feynmanowska
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Skomplikowane mechanizmy zostają przełożone na proste, codzienne obrazy. Impuls w węźle zatokowym działa jak dyrygent orkiestry, a zespół QRS to potężny silnik komór serca.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center group bg-card/50 rounded-2xl p-4 sm:p-6 shadow-app">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-chart-2 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-glow-success">
                <Play className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">
                Active Recall
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Każda sekcja kończy się pytaniami, które zmuszają Cię do przywołania wiedzy z pamięci. To sprawdzona metoda, która znacznie poprawia zdolność do trwałego zapamiętania informacji.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center group bg-card/50 rounded-2xl p-4 sm:p-6 shadow-app">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-chart-3 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <Award className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">
                Powtarzanie sukcesywne
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Regularnie wracamy do kluczowych informacji w różnym kontekście, zgodnie z krzywą zapominania. Każdy nowy element wiedzy buduje się na solidnych fundamentach.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Course Content Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">
              Co zawiera kurs?
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-3xl mx-auto">
              Kompleksowy program oparty na badaniach naukowych, zaprojektowany dla trwałej nauki
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8">
            {/* 500+ Questions */}
            <div className="bg-card border border-border rounded-2xl p-3 sm:p-6 text-center hover:shadow-app-lg transition-shadow shadow-app">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-lg sm:text-2xl font-bold text-primary">500+</span>
              </div>
              <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-2 sm:mb-3">
                Pytań w formie quizu
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Z natychmiastowym feedbackiem i szczegółowymi wyjaśnieniami każdej odpowiedzi
              </p>
            </div>

            {/* Structured Chapters */}
            <div className="bg-card border border-border rounded-2xl p-3 sm:p-6 text-center hover:shadow-app-lg transition-shadow shadow-app">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-chart-2/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <BookOpen className="h-5 w-5 sm:h-8 sm:w-8 text-chart-2" />
              </div>
              <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-2 sm:mb-3">
                Strukturalne rozdziały
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Od podstaw do zaawansowanych zagadnień: rytm, oś serca, arytmie i zawały
              </p>
            </div>

            {/* Clinical Cases */}
            <div className="bg-card border border-border rounded-2xl p-3 sm:p-6 text-center hover:shadow-app-lg transition-shadow shadow-app">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-chart-3/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Heart className="h-5 w-5 sm:h-8 sm:w-8 text-chart-3" />
              </div>
              <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-2 sm:mb-3">
                Przypadki kliniczne
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Prawdziwe zapisy EKG analizowane krok po kroku w praktycznym kontekście
              </p>
            </div>

            {/* Scientific Methods */}
            <div className="bg-card border border-border rounded-2xl p-3 sm:p-6 text-center hover:shadow-app-lg transition-shadow shadow-app">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-chart-4/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Star className="h-5 w-5 sm:h-8 sm:w-8 text-chart-4" />
              </div>
              <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-2 sm:mb-3">
                Metody oparte na badaniach
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Successive relearning i aktywne przywoływanie dla trwałości wiedzy
              </p>
            </div>
          </div>

          {/* Target Audience */}
          <div className="mt-10 sm:mt-16 bg-secondary/20 rounded-2xl p-4 sm:p-6 lg:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">
                Dla kogo jest ten kurs?
              </h3>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-4xl mx-auto">
                Stworzony dla wszystkich, którzy chcą zrozumieć EKG – od studentów medycyny, przez pielęgniarki i ratowników medycznych, 
                aż po każdego, kto chce poszerzyć swoje horyzonty. Nie musisz mieć wcześniejszego doświadczenia – zaczynamy od podstaw.
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
              {[
                "Studenci medycyny",
                "Pielęgniarki", 
                "Ratownicy medyczni",
                "Lekarze",
                "Osoby zainteresowane medycyną"
              ].map((audience, index) => (
                <div key={index} className="bg-background border border-border rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
                  <span className="text-xs sm:text-sm font-medium text-foreground">{audience}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection onOpenAuth={() => setAuthMode("register")} />

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
