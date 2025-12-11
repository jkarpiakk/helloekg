import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  Camera,
  Eye,
  Target,
  CheckCircle2,
  ArrowRight,
  Grid3X3,
  Crosshair
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

// Dane wykładu dla Modułu 3: Odprowadzenia EKG
const lectureData = {
  title: "Moduł 3: Odprowadzenia EKG - 12 Sposobów Patrzenia na Serce",
  duration: "85 min",
  sections: [
    {
      id: 1,
      title: "Odprowadzenia jako system kamer",
      content: "Wyobraź sobie, że chcesz sfilmować mecz piłki nożnej. Jedna kamera nie wystarczy - potrzebujesz kilku, ustawionych z różnych stron boiska. Podobnie jest z sercem. Aby dobrze je zobaczyć, potrzebujemy 12 różnych perspektyw - 12 odprowadzeń EKG. Każde z nich to jak kamera, która patrzy na serce z innej strony i rejestruje jego elektryczną aktywność.",
      analogy: "Odprowadzenia EKG = System kamer sportowych",
      keyPoints: ["12 różnych perspektyw", "Każde ma swoją specjalizację", "Razem dają pełny obraz", "Pozwalają zlokalizować problemy"],
      visual: "camera-system"
    },
    {
      id: 2,
      title: "Dwie główne grupy - różne płaszczyzny",
      content: "Nasze 12 kamer dzieli się na dwie główne grupy. Pierwsza to 6 odprowadzeń przedsercowych (V1-V6) - jak kamery ustawione wokół klatki piersiowej, patrzące na serce w płaszczyźnie poziomej. Druga grupa to 6 odprowadzeń kończynowych (I, II, III, aVR, aVL, aVF) - jak kamery z boków i z góry, obserwujące serce w płaszczyźnie czołowej.",
      analogy: "Dwie grupy kamer = Kamery poziome + kamery pionowe",
      keyPoints: ["V1-V6: płaszczyzna pozioma", "Kończynowe: płaszczyzna czołowa", "Uzupełniają się nawzajem", "Dają trójwymiarowy obraz"],
      visual: "camera-planes"
    },
    {
      id: 3,
      title: "Odprowadzenie I - Obserwator z boku",
      content: "Odprowadzenie I to jak obserwator stojący z lewej strony boiska, patrzący w kierunku prawej strony. Rejestruje elektryczność płynącą od prawej ręki do lewej ręki. Jest szczególnie wrażliwe na to, co dzieje się w lewej ścianie bocznej serca. To jeden z kluczowych graczy w określaniu osi elektrycznej serca.",
      analogy: "Odprowadzenie I = Obserwator z bocznej trybuny",
      keyPoints: ["Patrzy z lewej strony", "Prawa ręka → lewa ręka", "Ocena osi elektrycznej", "Lewa ściana boczna"],
      visual: "lead-I"
    },
    {
      id: 4,
      title: "Odprowadzenie II - Główny komentator",
      content: "Odprowadzenie II to jak główny komentator meczu - ma najlepszy widok na całą akcję. Patrzy na serce z kąta między prawą ręką a lewą nogą, niemal równolegle do naturalnej osi elektrycznej serca. Dlatego to właśnie w tym odprowadzeniu najczęściej oceniamy rytm serca i szukamy załamków P.",
      analogy: "Odprowadzenie II = Główny komentator z najlepszym widokiem",
      keyPoints: ["Najlepszy widok na rytm", "Równolegle do osi serca", "Ocena załamków P", "Główne odprowadzenie diagnostyczne"],
      visual: "lead-II"
    },
    {
      id: 5,
      title: "Odprowadzenie III - Partner komentarza",
      content: "Odprowadzenie III to partner odprowadzenia II, patrząc na serce z kąta między lewą ręką a lewą nogą. Razem z II i aVF tworzy trójkę odprowadzeń obserwujących dolną ścianę serca. To jak trzech komentatorów oglądających tę samą akcję z różnych kątów - każdy widzi nieco inne szczegóły.",
      analogy: "Odprowadzenie III = Partner komentarza z innego kąta",
      keyPoints: ["Partner dla II i aVF", "Dolna ściana serca", "Lewa ręka → lewa noga", "Uzupełnia obraz dolnej ściany"],
      visual: "lead-III"
    },
    {
      id: 6,
      title: "aVR - Obserwator z przeciwnej strony",
      content: "aVR to wyjątkowy obserwator - patrzy na serce z perspektywy prawej ręki, jakby z przeciwnej strony boiska. Dlatego zwykle widzi wszystko 'na opak' - załamki są ujemne. To jak kamera skierowana przeciwnie do akcji. Ale właśnie te odwrócone sygnały mogą być bardzo cenne diagnostycznie!",
      analogy: "aVR = Kamera z przeciwnej strony boiska",
      keyPoints: ["Perspektywa prawej ręki", "Zwykle załamki ujemne", "Widzi 'na opak'", "Diagnostyczna wartość odwrócenia"],
      visual: "lead-aVR"
    },
    {
      id: 7,
      title: "aVL - Strażnik lewej flanki",
      content: "aVL to jak strażnik obserwujący lewą flankę. Patrzy na serce z perspektywy lewej ręki, koncentrując się na górnej części lewej ściany bocznej serca. To odprowadzenie jest szczególnie przydatne w wykrywaniu problemów z tą właśnie częścią serca - jak wartownik na posterunku.",
      analogy: "aVL = Strażnik obserwujący lewą flankę",
      keyPoints: ["Perspektywa lewej ręki", "Górna część lewej ściany", "Wykrywa niedokrwienie boczne", "Wartownik na posterunku"],
      visual: "lead-aVL"
    },
    {
      id: 8,
      title: "aVF - Obserwator z dołu",
      content: "aVF to jak obserwator siedzący w pierwszym rzędzie, patrzący na akcję z dołu do góry. Widzi serce z perspektywy lewej nogi i jest szczególnie czuły na wszystko, co dzieje się w dolnej ścianie serca. Gdy coś złego dzieje się na dole serca, aVF pierwszy to zauważy.",
      analogy: "aVF = Obserwator z pierwszego rzędu, patrząc w górę",
      keyPoints: ["Perspektywa lewej nogi", "Widok z dołu", "Czuły na dolną ścianę", "Pierwszy wykrywa problemy dolne"],
      visual: "lead-aVF"
    },
    {
      id: 9,
      title: "V1 i V2 - Kamery przy prawej bramce",
      content: "V1 i V2 to jak kamery ustawione przy prawej bramce. Obserwują prawą stronę serca i przegrodę międzykomorową - tę ważną ścianę dzielącą lewe i prawe 'pomieszczenia' serca. W zdrowym sercu widzą głównie załamek S, bo elektryczność płynie od nich w kierunku przeciwnym - ku lewej stronie serca.",
      analogy: "V1-V2 = Kamery przy prawej bramce boiska",
      keyPoints: ["Prawa strona serca", "Przegroda międzykomorowa", "Dominuje załamek S", "Elektryczność płynie w lewo"],
      visual: "leads-V1V2"
    },
    {
      id: 10,
      title: "V3 i V4 - Kamery w centrum boiska",
      content: "V3 i V4 to kamery w najlepszym miejscu - w centrum boiska, obserwujące przednią ścianę lewej komory. V3 to miejsce, gdzie załamki R i S mają podobną wysokość - to 'strefa przejściowa', moment zmiany. V4 często pokazuje najwyższy załamek R, bo ma najlepszy widok na główną pompę serca.",
      analogy: "V3-V4 = Kamery w centrum boiska",
      keyPoints: ["Przednia ściana lewej komory", "V3: strefa przejściowa", "V4: najwyższy R", "Najlepszy widok na główną pompę"],
      visual: "leads-V3V4"
    },
    {
      id: 11,
      title: "V5 i V6 - Kamery przy lewej bramce",
      content: "V5 i V6 to kamery przy lewej bramce, obserwujące boczną ścianę lewej komory - tej najważniejszej pompy serca. Mają doskonały widok na najsilniejszą część serca i dlatego pokazują wysokie załamki R. To jak obserwowanie najlepszego gracza drużyny z bliska.",
      analogy: "V5-V6 = Kamery przy lewej bramce",
      keyPoints: ["Boczna ściana lewej komory", "Wysokie załamki R", "Najsilniejsza pompa", "Obserwacja najlepszego gracza"],
      visual: "leads-V5V6"
    },
    {
      id: 12,
      title: "Analiza zespołowa - czytanie mapy",
      content: "Analiza odprowadzeń to jak czytanie mapy z różnymi informacjami. Każde odprowadzenie mówi nam coś innego, ale razem tworzą spójną historię. Rozpoczynamy od sprawdzenia rytmu w odprowadzeniu II, potem oceniamy oś w I i aVF, a następnie szukamy zmian w grupach odprowadzeń patrzących na te same obszary serca.",
      analogy: "Analiza odprowadzeń = Czytanie szczegółowej mapy",
      keyPoints: ["Każde mówi co innego", "Razem tworzą spójną historię", "Rytm w II", "Oś w I i aVF"],
      visual: "ecg-analysis"
    },
    {
      id: 13,
      title: "Lokalizacja problemów - detektywistyka",
      content: "Kiedy znajdziemy nieprawidłowości, odprowadzenia pomagają nam jak detektywowi w śledztwie. Zmiany w II, III i aVF wskazują na problem z dolną ścianą serca. Zmiany w V1-V4 to problem z przednią ścianą. V5-V6 plus I i aVL to problemy z boczną ścianą. To jak mapa wskazówek prowadząca do rozwiązania zagadki.",
      analogy: "Lokalizacja problemów = Praca detektywa z mapą wskazówek",
      keyPoints: ["II, III, aVF: dolna ściana", "V1-V4: przednia ściana", "V5-V6, I, aVL: boczna ściana", "Mapa wskazówek"],
      visual: "problem-localization"
    },
    {
      id: 14,
      title: "Uniesienie ST - sygnały alarmowe",
      content: "Uniesienie odcinka ST w odprowadzeniach to jak sygnały alarmowe na mapie. Gdy widzimy uniesienie ST w V2-V4, to alarm z przedniej ściany serca - prawdopodobnie zawał przedni. Uniesienie w II, III, aVF to alarm z dolnej ściany. Te sygnały wymagają natychmiastowej reakcji, jak alarm pożarowy.",
      analogy: "Uniesienie ST = Sygnały alarmowe na mapie",
      keyPoints: ["V2-V4: zawał przedni", "II, III, aVF: zawał dolny", "Wymagają natychmiastowej reakcji", "Jak alarm pożarowy"],
      visual: "st-elevation"
    },
    {
      id: 15,
      title: "Załamki Q - ślady po przeszłości",
      content: "Patologiczne załamki Q w odprowadzeniach to jak ślady po przeszłych wydarzeniach - blizny po zawałach. Gdy widzimy głębokie i szerokie Q w V1-V4, to znaczy, że przednia ściana serca była kiedyś poważnie uszkodzona. To jak archeologiczne dowody tego, co wydarzyło się wcześniej w sercu.",
      analogy: "Załamki Q = Archeologiczne ślady przeszłości",
      keyPoints: ["Blizny po zawałach", "Głębokie i szerokie", "Dowody przeszłych wydarzeń", "Archeologiczne znaleziska"],
      visual: "q-waves"
    },
    {
      id: 16,
      title: "Przykład praktyczny - zawał przedni",
      content: "Wyobraź sobie pacjenta z bólem w klatce piersiowej. EKG pokazuje uniesienie ST w V2, V3 i V4. To jak gdyby trzy kamery obserwujące przednią część boiska jednocześnie zobaczyły coś niepokojącego. Wszystkie sygnalizują ten sam problem - ostry zawał przedniej ściany lewej komory. To jasny sygnał do działania!",
      analogy: "Zawał przedni = Trzy kamery widzą ten sam incydent",
      keyPoints: ["Uniesienie ST w V2-V4", "Przednia ściana lewej komory", "Wszystkie kamery widzą problem", "Jasny sygnał do działania"],
      visual: "anterior-mi"
    },
    {
      id: 17,
      title: "Przerost lewej komory - mocny gracz",
      content: "Gdy lewa komora musi pracować ciężej (np. z powodu nadciśnienia), staje się jak kulturysta - większa i silniejsza. To widać w odprowadzeniach V5-V6, gdzie załamki R stają się bardzo wysokie. To jak obserwowanie gracza, który przez trening stał się znacznie potężniejszy, ale czasem ta siła może być nadmierna.",
      analogy: "Przerost lewej komory = Kulturysta na boisku",
      keyPoints: ["Komora staje się większa", "Wysokie R w V5-V6", "Reakcja na nadciśnienie", "Nadmierna siła może szkodzić"],
      visual: "lvh"
    },
    {
      id: 18,
      title: "Bloki odnóg - problemy z komunikacją",
      content: "Bloki odnóg pęczka Hisa to jak problemy z komunikacją między prawą a lewą stroną boiska. Gdy prawa odnoga jest zablokowana, widzimy w V1 charakterystyczny wzór RSR' - jak echo sygnału. Gdy lewa odnoga ma problem, V5-V6 pokazują szerokie, zniekształcone załamki. To jak zakłócenia w transmisji między kamerami.",
      analogy: "Bloki odnóg = Zakłócenia w komunikacji między stronami",
      keyPoints: ["Problemy z przewodzeniem", "RBBB: wzór RSR' w V1", "LBBB: szerokie QRS w V5-V6", "Zakłócenia transmisji"],
      visual: "bundle-blocks"
    },
    {
      id: 19,
      title: "Strategia systematycznej analizy",
      content: "Dobra analiza EKG to jak sprawdzenie wszystkich kamer według ustalonego planu. Najpierw rytm (głównie II), potem oś (I i aVF), następnie przeglądamy odprowadzenia grupami: kończynowe dolne (II, III, aVF), przedsercowe przednie (V1-V4), boczne (I, aVL, V5-V6). To systematyczne podejście nie pozwoli nam niczego przegapić.",
      analogy: "Systematyczna analiza = Plan sprawdzania wszystkich kamer",
      keyPoints: ["Ustalony plan działania", "Rytm → oś → grupy", "Nic nie zostaje przeoczone", "Metodyczne podejście"],
      visual: "systematic-analysis"
    },
    {
      id: 20,
      title: "Odprowadzenia jako okno do serca",
      content: "Odprowadzenia EKG to nasze okno do wnętrza serca. Każde z 12 okien pokazuje inny fragment elektrycznej symfonii, która toczy się w sercu każdej sekundy. Kiedy nauczysz się 'słuchać' tej symfonii przez każde okno, będziesz potrafił rozpoznać, gdy któryś z instrumentów gra fałszywie. To sztuka wymagająca praktyki, ale niezwykle wartościowa.",
      analogy: "Odprowadzenia = 12 okien do elektrycznej symfonii serca",
      keyPoints: ["Okno do wnętrza serca", "Elektryczna symfonia", "Rozpoznawanie fałszywych nut", "Sztuka wymagająca praktyki"],
      visual: "heart-symphony"
    }
  ],
  quiz: [
    {
      question: "Które odprowadzenia najlepiej pokazują dolną ścianę serca?",
      options: ["V1-V3", "II, III, aVF", "V4-V6", "I, aVL"],
      correct: 1,
      explanation: "Odprowadzenia II, III i aVF patrzą na serce z dołu i najlepiej pokazują dolną ścianę lewej komory."
    },
    {
      question: "Co oznacza uniesienie ST w odprowadzeniach V2-V4?",
      options: ["Zawał dolnej ściany", "Zawał przedniej ściany", "Zawał bocznej ściany", "Przerost prawej komory"],
      correct: 1,
      explanation: "Odprowadzenia V2-V4 obserwują przednią ścianę serca, więc uniesienie ST w tych odprowadzeniach wskazuje na zawał przedniej ściany."
    },
    {
      question: "Dlaczego w odprowadzeniu aVR załamki są zwykle ujemne?",
      options: ["To błąd techniczny", "Patrzy z przeciwnej strony niż oś serca", "Elektroda jest źle podłączona", "To normalne tylko u kobiet"],
      correct: 1,
      explanation: "aVR patrzy na serce z prawej ręki, przeciwnie do naturalnego kierunku przepływu elektryczności, dlatego załamki są ujemne."
    }
  ]
};

export default function Module3Lecture() {
  const [currentSection, setCurrentSection] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();

  // Check if module 3 is visible (hidden modules won't appear in the list for students)
  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/?auth=login");
      return;
    }
    
    // Check if module 3 is accessible (will be missing from list if hidden for students)
    if (modules && !modulesLoading) {
      const isAdmin = user?.role && ['owner', 'reviewer', 'developer_admin'].includes(user.role);
      const module3Visible = modules.some((m: any) => m.title?.includes("Moduł 3") || m.title?.includes("Odprowadzenia"));
      
      if (!isAdmin && !module3Visible) {
        setLocation("/modules");
      }
    }
  }, [isAuthenticated, modules, modulesLoading, user, setLocation]);

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
      "camera-system": (
        <div className="flex items-center justify-center space-x-4 text-6xl">
          <Camera className="h-16 w-16 text-blue-500" />
          <Heart className="h-20 w-20 text-red-500 animate-pulse" />
          <Camera className="h-16 w-16 text-blue-500" />
        </div>
      ),
      "camera-planes": (
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="space-y-2">
            <Grid3X3 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-sm">Płaszczyzna pozioma (V1-V6)</p>
          </div>
          <div className="space-y-2">
            <Crosshair className="h-12 w-12 text-blue-500 mx-auto" />
            <p className="text-sm">Płaszczyzna czołowa (I,II,III,aVR,aVL,aVF)</p>
          </div>
        </div>
      ),
      "lead-I": (
        <div className="flex items-center justify-center space-x-6">
          <div className="text-center">
            <div className="w-8 h-8 bg-red-500 rounded-full mx-auto mb-2"></div>
            <p className="text-xs">Prawa ręka</p>
          </div>
          <ArrowRight className="h-8 w-8 text-green-500" />
          <div className="text-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full mx-auto mb-2"></div>
            <p className="text-xs">Lewa ręka</p>
          </div>
        </div>
      ),
      "lead-II": (
        <div className="flex items-center justify-center">
          <div className="relative">
            <Heart className="h-16 w-16 text-red-500" />
            <Eye className="h-8 w-8 text-blue-500 absolute -bottom-2 -right-2" />
            <Badge className="absolute -top-6 left-1/2 transform -translate-x-1/2" variant="outline">
              Najlepszy widok
            </Badge>
          </div>
        </div>
      ),
      "ecg-analysis": (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <Target className="h-8 w-8 text-green-500 mx-auto" />
            <p className="text-xs">Rytm (II)</p>
          </div>
          <div className="space-y-2">
            <Crosshair className="h-8 w-8 text-blue-500 mx-auto" />
            <p className="text-xs">Oś (I, aVF)</p>
          </div>
          <div className="space-y-2">
            <Grid3X3 className="h-8 w-8 text-purple-500 mx-auto" />
            <p className="text-xs">Grupy</p>
          </div>
        </div>
      )
    };

    return visualComponents[visualType as keyof typeof visualComponents] || (
      <div className="flex items-center justify-center">
        <Heart className="h-16 w-16 text-primary animate-pulse" />
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background app-gradient-dark">
      {/* Sticky Header with Progress */}
      <div className="sticky top-0 z-40 glass-card border-b border-border/50 safe-top">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate" data-testid="lecture-title">
                {lectureData.title}
              </h1>
              <p className="text-sm text-muted-foreground">{lectureData.duration}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {currentSection + 1}/{lectureData.sections.length}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-28 space-y-6">
        {/* Treść sekcji lub quiz */}
        {!showQuiz ? (
          <>
            {/* Section Header Card */}
            <div className="glass-card rounded-2xl shadow-app p-4" data-testid="section-header">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm px-3 py-1.5 rounded-lg font-medium">
                  {section?.id}/{lectureData.sections.length}
                </Badge>
                <h2 className="text-lg sm:text-xl font-bold flex-1">{section?.title}</h2>
              </div>
            </div>

            {/* Main Content Card */}
            <Card className="glass-card rounded-2xl shadow-app-lg overflow-hidden border-0">
              <CardContent className="p-4 sm:p-6 space-y-5">
                {/* Wizualizacja - Mobile First */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-xl p-6 min-h-[140px]">
                  <div className="mb-3">
                    {renderVisual(section?.visual || "default")}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Wizualizacja koncepcji
                  </p>
                </div>

                {/* Text Content */}
                <div className="space-y-4">
                  {/* Główna treść */}
                  <p className="text-base leading-relaxed text-muted-foreground">
                    {section?.content}
                  </p>

                  {/* Analogia */}
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <span className="text-base">💡</span>
                      </div>
                      <span className="font-semibold text-primary text-sm">Analogia Feynmana</span>
                    </div>
                    <p className="text-foreground font-medium text-base italic">{section?.analogy}</p>
                  </div>

                  {/* Kluczowe punkty */}
                  <div className="space-y-3 bg-chart-2/10 rounded-xl p-4">
                    <h3 className="font-semibold flex items-center gap-2 text-base">
                      <CheckCircle2 className="h-5 w-5 text-chart-2" />
                      Kluczowe punkty
                    </h3>
                    <ul className="space-y-3">
                      {section?.keyPoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-chart-2/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <ArrowRight className="h-3 w-3 text-chart-2" />
                          </div>
                          <span className="text-base leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Quiz Section - Premium Mobile Styling */
          <Card className="glass-card rounded-2xl shadow-app-lg border-0 mb-8">
            <CardContent className="p-4 sm:p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Quiz sprawdzający wiedzę</h2>
                <p className="text-muted-foreground text-base">
                  Sprawdź, jak dobrze zrozumiałeś materiał o odprowadzeniach EKG
                </p>
              </div>

              {lectureData.quiz.map((question, questionIndex) => (
                <div key={questionIndex} className="mb-6" data-testid={`quiz-question-${questionIndex}`}>
                  <h3 className="text-base sm:text-lg font-semibold mb-4 leading-relaxed">
                    {questionIndex + 1}. {question.question}
                  </h3>
                  
                  <div className="space-y-3 mb-4">
                    {question.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        onClick={() => handleAnswerSelect(optionIndex)}
                        disabled={showExplanation}
                        data-testid={`quiz-option-${questionIndex}-${optionIndex}`}
                        className={`w-full min-h-[52px] p-4 text-left border rounded-xl transition-all active:scale-[0.98] flex items-center gap-3 ${
                          !showExplanation
                            ? "hover:bg-secondary/50 border-border glass-card"
                            : selectedAnswer === optionIndex
                              ? optionIndex === question.correct
                                ? "bg-green-500/20 border-green-500 text-green-400"
                                : "bg-red-500/20 border-red-500 text-red-400"
                              : optionIndex === question.correct
                                ? "bg-green-500/20 border-green-500 text-green-400"
                                : "border-border/50 opacity-60"
                        }`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="text-base leading-relaxed">{option}</span>
                      </button>
                    ))}
                  </div>

                  {showExplanation && (
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mt-4">
                      <h4 className="font-semibold text-primary mb-2 text-base">Wyjaśnienie:</h4>
                      <p className="text-muted-foreground text-base leading-relaxed">{question.explanation}</p>
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-4">
                <Button 
                  onClick={() => setLocation("/modules")} 
                  size="lg"
                  className="w-full h-14 rounded-xl text-base font-semibold active:scale-[0.97] transition-transform shadow-glow-primary"
                  data-testid="button-finish"
                >
                  Powrót do modułów
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sticky Bottom Navigation */}
      {!showQuiz && (
        <div className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-border/50 safe-bottom">
          <div className="px-4 py-3 max-w-4xl mx-auto">
            <div className="flex items-center justify-between gap-3">
              <Button 
                variant="outline" 
                onClick={prevSection}
                disabled={currentSection === 0}
                className="h-12 px-4 rounded-xl active:scale-[0.97] transition-transform touch-bounce flex items-center gap-2"
                data-testid="button-previous"
              >
                <SkipBack className="h-5 w-5" />
                <span className="hidden sm:inline">Poprzednia</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-12 w-12 rounded-xl p-0 active:scale-[0.97] transition-transform"
                data-testid="button-play-pause"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>

              <Button 
                onClick={nextSection}
                className="h-12 px-4 rounded-xl active:scale-[0.97] transition-transform touch-bounce flex items-center gap-2 shadow-glow-primary"
                data-testid="button-next"
              >
                <span className="hidden sm:inline">
                  {currentSection === lectureData.sections.length - 1 ? "Quiz" : "Następna"}
                </span>
                <span className="sm:hidden">
                  {currentSection === lectureData.sections.length - 1 ? "Quiz" : "Dalej"}
                </span>
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}