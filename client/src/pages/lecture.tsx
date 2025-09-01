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
  duration: "75 min",
  sections: [
    {
      id: 1,
      title: "Serce jako zorganizowany zespół",
      content: "Wyobraź sobie swoje serce jako świetnie zorganizowany zespół muzyczny. Każdy członek ma swoje zadanie, a całość działa jak idealnie zsynchronizowana maszyna. Ale czy zastanawiałeś się, kto tym wszystkim zarządza? Kto mówi sercu, kiedy ma się skurczyć, a kiedy rozluźnić? Odpowiedź leży w układzie bodźcoprzewodzącym - niewidzialnym elektrycznym mózgu serca.",
      analogy: "Serce = Orkiestra muzyczna",
      keyPoints: ["Każda część ma swoją rolę", "Synchronizacja jest kluczowa", "Układ bodźcoprzewodzący to dyrygent", "Niewidzialny elektryczny mózg serca"],
      visual: "orchestra"
    },
    {
      id: 2,
      title: "Węzeł zatokowy - Dyrygent serca",
      content: "Cała magia zaczyna się w węźle zatokowym, który znajduje się w prawym przedsionku. To właśnie on nadaje rytm - dosłownie. Możesz go sobie wyobrazić jako dyrygenta orkiestry. Węzeł zatokowy wysyła impulsy elektryczne, które rozchodzą się po przedsionkach, powodując ich skurcz. To pierwszy krok - przedsionki ściskają krew i przesyłają ją do komór.",
      analogy: "Węzeł zatokowy = Dyrygent orkiestry",
      keyPoints: ["Znajduje się w prawym przedsionku", "Wysyła impulsy elektryczne", "Kontroluje rytm serca", "Pierwszy krok w cyklu serca"],
      visual: "conductor"
    },
    {
      id: 3,
      title: "Węzeł AV - Mądre światła na skrzyżowaniu",
      content: "Gdy impuls dociera do węzła AV, zatrzymuje się tam na chwilę. To bardzo mądre rozwiązanie! Węzeł AV działa jak kontrolowane światło na skrzyżowaniu - daje czas przedsionkom na zakończenie swojej pracy i zapobiega przedostawaniu się zbyt szybkich impulsów do komór. W dobrze zarządzanym systemie nic nie dzieje się za szybko.",
      analogy: "Węzeł AV = Inteligentne światła na skrzyżowaniu",
      keyPoints: ["Kontroluje przepływ impulsów", "Daje czas przedsionkom", "Zapobiega chaosowi", "Opóźnienie to mądre rozwiązanie"],
      visual: "traffic"
    },
    {
      id: 4,
      title: "Pęczek Hisa - Rozwidlenie autostrady",
      content: "Po chwili impuls rusza dalej. Dociera do pęczka Hisa, który rozdziela go na dwie ścieżki - jedną prowadzącą do prawej, a drugą do lewej komory. Wyobraź sobie to jako rozwidlenie autostrady. Każda komora otrzymuje swój własny sygnał w tym samym czasie.",
      analogy: "Pęczek Hisa = Rozwidlenie autostrady",
      keyPoints: ["Dzieli impuls na dwie drogi", "Jedna ścieżka do każdej komory", "Równomierne rozprowadzenie sygnału", "Synchronizacja komór"],
      visual: "highway"
    },
    {
      id: 5,
      title: "Włókna Purkinjego - Superszybkie przewody",
      content: "Następnie włókna Purkinjego, które są jak superszybkie przewody elektryczne, błyskawicznie rozprowadzają sygnał po komorach, powodując ich skurcz. I wtedy dzieje się najważniejsze - krew jest wypompowywana z serca do całego ciała. Ten proces powtarza się raz za razem - rytmicznie, nieprzerwanie.",
      analogy: "Włókna Purkinjego = Światłowody internetowe",
      keyPoints: ["Najszybsze przewodzenie", "Docierają do całych komór", "Powodują równomierny skurcz", "Końcowy etap przewodzenia"],
      visual: "cables"
    },
    {
      id: 6,
      title: "Rytm zatokowy - Złoty standard",
      content: "Kiedy wszystko działa prawidłowo, mówimy o rytmie zatokowym. To właśnie rytm serca w jego najlepszej formie. Kiedy chcemy zarejestrować tę elektryczną aktywność, używamy EKG, które pozwala zajrzeć do serca i zobaczyć te impulsy w formie wykresu.",
      analogy: "Rytm zatokowy = Idealny zegar",
      keyPoints: ["Normalny rytm serca", "Regularny i miarowy", "Pochodzi z węzła zatokowego", "Złoty standard pracy serca"],
      visual: "metronome"
    },
    {
      id: 7,
      title: "Odprowadzenia EKG - 12 kamer wokół serca",
      content: "Aby dobrze odczytywać EKG, trzeba wiedzieć, że każdy zapis to coś w rodzaju widoku serca z innej perspektywy. Wyobraź sobie, że masz dwanaście kamer ustawionych wokół serca. Sześć z nich znajduje się na klatce piersiowej - to odprowadzenia przedsercowe (V1-V6), które patrzą na serce z przodu i z boku.",
      analogy: "Odprowadzenia EKG = System kamer bezpieczeństwa",
      keyPoints: ["12 różnych perspektyw", "V1-V6 na klatce piersiowej", "6 odprowadzeń kończynowych", "Każde pokazuje inny aspekt"],
      visual: "cameras"
    },
    {
      id: 8,
      title: "Odprowadzenia przedsercowe - Widok z przodu",
      content: "V1 i V2 obserwują prawą stronę serca i przegrodę między komorami, V3 i V4 patrzą na przednią ścianę serca, a V5 i V6 na lewą ścianę. Pozostałe sześć to odprowadzenia kończynowe, które dają nam informacje o sercu z innych płaszczyzn.",
      analogy: "Odprowadzenia przedsercowe = Kamery na klatce piersiowej",
      keyPoints: ["V1-V2: prawa strona i przegroda", "V3-V4: przednia ściana", "V5-V6: lewa ściana", "Widok anatomiczny serca"],
      visual: "precordial-leads"
    },
    {
      id: 9,
      title: "Załamki EKG - Nuty w partyturze życia",
      content: "Teraz wyobraź sobie, że każdy załamek na wykresie EKG to jak nuty w partyturze. Załamek P reprezentuje pracę przedsionków, a zespół QRS - pracę komór. To jest język, którym serce z nami rozmawia, opowiadając swoją historię elektryczną.",
      analogy: "Załamki EKG = Nuty w partyturze",
      keyPoints: ["P = depolaryzacja przedsionków", "QRS = depolaryzacja komór", "T = repolaryzacja komór", "Każdy załamek ma znaczenie"],
      visual: "ekg-simulator"
    },
    {
      id: 10,
      title: "Załamek P - Początek każdej podróży",
      content: "Załamek P to historia przedsionków - tych niewielkich, ale niezwykle ważnych komór serca, które przepychają krew do komór. Załamek P jest jak początek każdej podróży - to tutaj wszystko się zaczyna. Jeśli jest obecny, wiemy, że impuls pochodzi z węzła zatokowego.",
      analogy: "Załamek P = Sygnał startu",
      keyPoints: ["Depolaryzacja przedsionków", "Znak naturalnego rytmu", "Mały ale ważny", "Początek cyklu sercowego"],
      visual: "p-wave"
    },
    {
      id: 11,
      title: "Odstęp PQ - Chwila spowolnienia",
      content: "Za załamkiem P następuje odstęp PQ, który odzwierciedla czas potrzebny na przejście impulsu przez węzeł przedsionkowo-komorowy. Wyobraź sobie ten odstęp jak znak na drodze informujący o lekkim spowolnieniu - chwilowym postoju, zanim samochody ruszą dalej. Normalnie odstęp PQ trwa od 0,12 do 0,20 sekundy.",
      analogy: "Odstęp PQ = Znak spowolnienia na drodze",
      keyPoints: ["Czas przejścia przez węzeł AV", "Norma: 0,12-0,20 s", "Dłuższy = blok AV", "Krótszy = omijanie węzła AV"],
      visual: "pq-interval"
    },
    {
      id: 12,
      title: "Zespół QRS - Dzieło sztuki serca",
      content: "Następnie przechodzimy do zespołu QRS - prawdziwego dzieła sztuki serca. To tutaj komory, czyli główne pompy serca, pokazują swoją siłę. Zespół QRS odpowiada za depolaryzację komór i jest zwykle wąski, trwający mniej niż 0,12 sekundy. Jeśli jednak QRS jest szeroki, to znak, że impuls elektryczny ma problem z przejściem przez normalny układ przewodzący.",
      analogy: "Zespół QRS = Silnik samochodu",
      keyPoints: ["Depolaryzacja komór", "Normalnie < 0,12 s", "Szeroki QRS = problemy przewodzenia", "Główna siła napędowa"],
      visual: "qrs-complex"
    },
    {
      id: 13,
      title: "Odcinek ST - Czas odpoczynku",
      content: "Odcinek ST, który pojawia się po zespole QRS, to czas odpoczynku serca. Można to porównać do chwili relaksu po intensywnym wysiłku. W zdrowym sercu ST jest izoelektryczny, czyli znajduje się na tej samej linii co odcinek PR. Jeśli jednak ST jest uniesiony lub obniżony, serce wysyła sygnał alarmowy.",
      analogy: "Odcinek ST = Chwila odpoczynku po wysiłku",
      keyPoints: ["Plateau repolaryzacji", "Normalnie izoelektryczny", "Uniesienie ST = zawał STEMI", "Obniżenie ST = niedokrwienie"],
      visual: "st-segment"
    },
    {
      id: 14,
      title: "Załamek T - Uspokajające fale",
      content: "Załamki T, które kończą każdy cykl, to znak, że serce wraca do swojego pierwotnego stanu. Wyobraź sobie je jak uspokajające fale na plaży po burzy. Prawidłowe T są symetryczne i lekko zaokrąglone. Jeśli jednak są odwrócone lub zbyt wysokie, mogą wskazywać na problemy.",
      analogy: "Załamek T = Uspokajające fale po burzy",
      keyPoints: ["Repolaryzacja komór", "Symetryczne i zaokrąglone", "Odwrócone = niedokrwienie", "Wysokie = hiperkaliemia"],
      visual: "t-wave"
    },
    {
      id: 15,
      title: "Częstość serca - Metoda 300",
      content: "Odstęp między załamkami R pozwala nam sprawdzić, czy rytm jest regularny. A co z częstością akcji serca? Tutaj wchodzi prosta matematyka: liczymy, ile dużych kratek na wykresie mieści się między dwoma załamkami R i dzielimy 300 przez tę liczbę. Na przykład jeśli są cztery kratki, mamy 300/4, czyli 75 uderzeń na minutę.",
      analogy: "Częstość serca = Tempo metronomu",
      keyPoints: ["Metoda 300", "Liczymy duże kratki między R-R", "300 ÷ liczba kratek = częstość", "Sprawdzenie regularności rytmu"],
      visual: "heart-rate"
    },
    {
      id: 16,
      title: "Oś serca - Elektryczny kompas",
      content: "A co z osią serca? To trochę jak kompas, który pokazuje główny kierunek przepływu elektryczności w komorach. Jeśli wszystko jest w porządku, oś mieści się w zakresie od -30° do +90°. Szybki sposób na ocenę osi to spojrzenie na QRS w odprowadzeniach I i aVF.",
      analogy: "Oś serca = Kompas nawigacyjny",
      keyPoints: ["Kierunek przepływu elektryczności", "Norma: -30° do +90°", "Sprawdzamy QRS w I i aVF", "Wskazuje na przerosty"],
      visual: "compass"
    },
    {
      id: 17,
      title: "Odchylenia osi - Reakcja na obciążenie",
      content: "Jeśli oś odchyla się w lewo, może to oznaczać na przykład przerost lewej komory. Z kolei odchylenie w prawo może wskazywać na problemy z prawą stroną serca, takie jak przerost prawej komory lub zatorowość płucną. Każda zmiana w kierunku przepływu impulsu elektrycznego to reakcja serca na jego obciążenie lub problem.",
      analogy: "Odchylenie osi = Reakcja na trudne warunki",
      keyPoints: ["Odchylenie w lewo = przerost LV", "Odchylenie w prawo = problemy RV", "Reakcja na obciążenie", "Wskazówka diagnostyczna"],
      visual: "axis-deviation"
    },
    {
      id: 18,
      title: "Przerost komór - Większy silnik",
      content: "Na przykład w nadciśnieniu tętniczym lewa komora, która musi pracować ciężej, zaczyna się przerastać. Wyobraź sobie to jak rozbudowywanie silnika w samochodzie, który ma przewozić coraz cięższe ładunki. Taki większy silnik wymaga więcej przestrzeni, co przekłada się na odchylenie osi elektrycznej w lewo.",
      analogy: "Przerost komory = Rozbudowa silnika",
      keyPoints: ["Komora pracuje ciężej", "Przerost jako adaptacja", "Zmiana osi elektrycznej", "Widoczne w EKG"],
      visual: "ventricular-hypertrophy"
    },
    {
      id: 19,
      title: "Znaczenie kliniczne EKG",
      content: "EKG ma ogromne znaczenie kliniczne. Pozwala ocenić rytm serca, diagnozować arytmie, rozpoznać stany zagrażające życiu jak zawał mięśnia sercowego, dostarczyć informacji o przerostach i zaburzeniach elektrolitowych. To okno do wnętrza serca.",
      analogy: "EKG = Okno do wnętrza serca",
      keyPoints: ["Ocena rytmu serca", "Diagnoza arytmii", "Rozpoznanie zawału", "Wykrywanie przerostów"],
      visual: "clinical-significance"
    },
    {
      id: 20,
      title: "EKG jako historia serca",
      content: "Zrozumienie podstaw EKG to pierwszy krok na drodze do odczytywania zapisów i dostrzegania subtelnych sygnałów, które wysyła serce. Kiedy patrzymy na linie załamków i odstępów, widzimy nie tylko liczby, ale i opowieść - o rytmie życia, o tym, jak serce radzi sobie z codziennymi wyzwaniami.",
      analogy: "EKG = Biografia serca",
      keyPoints: ["Każda linia opowiada historię", "Rytm życia w liczbach", "Subtelne sygnały", "Klucz do diagnostyki"],
      visual: "ecg-story"
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