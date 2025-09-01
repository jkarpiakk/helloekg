import { db } from "../db";
import { questions, sections, users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Pytania dla Modułu 1 - Podstawy EKG
const module1Questions = [
  {
    title: "Co jest głównym źródłem impulsów elektrycznych w zdrowym sercu?",
    bodyMd: "**Źródło impulsów elektrycznych serca**\n\nWyobraź sobie serce jako orkiestrę, która potrzebuje dyrygenta do nadawania rytmu. Które z poniższych struktur pełni tę najważniejszą rolę w zdrowym sercu?",
    answers: [
      { text: "Węzeł zatokowy", isCorrect: true },
      { text: "Węzeł przedsionkowo-komorowy", isCorrect: false },
      { text: "Pęczek Hisa", isCorrect: false },
      { text: "Włókna Purkinjego", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Węzeł zatokowy**

Wyobraź sobie serce jako orkiestrę, a węzeł zatokowy jako dyrygenta. To on nadaje rytm, generując impulsy elektryczne, które rozchodzą się po przedsionkach. Dzięki temu każdy skurcz zaczyna się we właściwym momencie. 

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- **Węzeł przedsionkowo-komorowy** to bardziej stacja przekaźnikowa, która chwilowo zatrzymuje impulsy, zanim dotrą do komór
- **Pęczek Hisa** i **włókna Purkinjego** to "linie przesyłowe", które przewodzą sygnały do mięśni komór

Jeśli węzeł zatokowy przestanie działać, inne struktury mogą przejąć jego funkcję, ale będą generować znacznie wolniejszy rytm.`,
    tags: ["podstawy", "węzeł-zatokowy", "układ-bodźcoprzewodzący", "rytm"],
    difficulty: "easy"
  },
  {
    title: "Jakie odprowadzenie kończynowe rejestruje aktywność elektryczną z lewej strony serca?",
    bodyMd: "**Odprowadzenia kończynowe**\n\nKażde odprowadzenie EKG to jak kamera patrząca na serce z innej strony. Które z odprowadzeń kończynowych najlepiej pokazuje aktywność lewej strony serca?",
    answers: [
      { text: "I", isCorrect: true },
      { text: "II", isCorrect: false },
      { text: "III", isCorrect: false },
      { text: "aVR", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: I**

Odprowadzenie I działa jak kamera patrząca z lewej strony serca. Wyobraź sobie, że masz elektrody na lewej i prawej ręce – prąd płynący w kierunku lewej ręki powoduje dodatnie załamki. To odprowadzenie świetnie pokazuje aktywność lewej ściany bocznej serca.

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- **Odprowadzenie II** patrzy bardziej od dołu
- **Odprowadzenie III** patrzy z kąta między lewą ręką a nogą  
- **aVR** obserwuje serce z przeciwnej strony – zazwyczaj wszystko w nim wygląda odwrotnie niż w innych odprowadzeniach`,
    tags: ["odprowadzenia", "kończynowe", "analiza", "lewa-strona"],
    difficulty: "medium"
  },
  {
    title: "Jak obliczyć częstość akcji serca na podstawie EKG?",
    bodyMd: "**Obliczanie częstości akcji serca**\n\nNa zapisie EKG widać kratki różnej wielkości. Która z metod pozwala najszybciej i najdokładniej obliczyć częstość uderzeń serca na minutę?",
    answers: [
      { text: "Podziel 300 przez liczbę dużych kratek między załamkami R", isCorrect: true },
      { text: "Policz liczbę małych kratek między załamkami P i podziel przez 100", isCorrect: false },
      { text: "Pomnóż liczbę załamków QRS w 6 sekundach przez 5", isCorrect: false },
      { text: "Zsumuj załamki P i R w jednym cyklu", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Podziel 300 przez liczbę dużych kratek między załamkami R**

Każda duża kratka na EKG odpowiada 0,20 sekundy. Jeśli policzymy, ile dużych kratek mieści się między załamkami R, możemy szybko obliczyć, ile razy serce bije na minutę. 

**Przykład:** jeśli między załamkami R są 4 kratki, to 300/4 = 75 uderzeń na minutę.

To proste, jak podzielenie ciasta na równe kawałki – im więcej kratek, tym wolniejsze bicie serca. Inne metody są możliwe, ale ta jest najszybsza i najczęściej stosowana w praktyce.`,
    tags: ["częstość", "obliczenia", "metoda-300", "praktyka"],
    difficulty: "easy"
  },
  {
    title: "Jak rozpoznać rytm zatokowy na EKG?",
    bodyMd: "**Rozpoznawanie rytmu zatokowego**\n\nRytm zatokowy to złoty standard normalnej pracy serca. Która z cech jest najważniejszą wskazówką, że mamy do czynienia z rytmem zatokowym?",
    answers: [
      { text: "Załamek P poprzedza każdy zespół QRS", isCorrect: true },
      { text: "Odstępy R-R są nieregularne", isCorrect: false },
      { text: "Załamki T są zawsze odwrócone", isCorrect: false },
      { text: "W odprowadzeniu II widoczne są fale F", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Załamek P poprzedza każdy zespół QRS**

Rytm zatokowy to złoty standard – serce bije regularnie pod kontrolą węzła zatokowego. Aby upewnić się, że mamy do czynienia z rytmem zatokowym, sprawdź, czy załamek P pojawia się przed każdym QRS i czy odstępy R-R są równe. 

To jak dobrze zorganizowany ruch uliczny, gdzie każdy samochód (P) jedzie w odpowiedniej kolejności przed ciężarówką (QRS).

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- **Nieregularne odstępy R-R** wskazują na arytmię
- **Odwrócone załamki T** mogą wskazywać na niedokrwienie
- **Fale F w odprowadzeniu II** to znak migotania przedsionków`,
    tags: ["rytm-zatokowy", "załamek-P", "QRS", "norma"],
    difficulty: "easy"
  },
  {
    title: "Jak określić oś elektryczną serca na podstawie odprowadzeń I i aVF?",
    bodyMd: "**Ocena osi elektrycznej serca**\n\nOś elektryczna serca pokazuje główny kierunek przepływu elektryczności w komorach. Jak interpretować załamki w odprowadzeniach I i aVF?",
    answers: [
      { text: "Jeśli oba są dodatnie, oś jest normalna", isCorrect: true },
      { text: "Jeśli oba są ujemne, oś jest w lewo", isCorrect: false },
      { text: "Jeśli I jest dodatnie, a aVF ujemne, oś jest w prawo", isCorrect: false },
      { text: "Jeśli aVF jest dodatnie, a I ujemne, oś jest nie do określenia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Jeśli oba są dodatnie, oś jest normalna**

Wyobraź sobie, że oś serca to kompas, a odprowadzenia I i aVF to dwie wskazówki, które pokazują, gdzie jest "północ". 

**Interpretacja:**
- **Oba dodatnie** = oś normalna (od -30° do +90°)
- **I dodatnie, aVF ujemne** = odchylenie w lewo  
- **I ujemne, aVF dodatnie** = odchylenie w prawo
- **Oba ujemne** = oś ekstremalna (może oznaczać poważne problemy)

To jak patrzenie na mapę i próba ustalenia kierunku – kiedy znasz dwa punkty odniesienia, możesz określić, gdzie jesteś.`,
    tags: ["oś-elektryczna", "odprowadzenia", "I", "aVF", "interpretacja"],
    difficulty: "medium"
  },
  {
    title: "Dlaczego węzeł zatokowy nazywany jest \"naturalnym rozrusznikiem\" serca?",
    bodyMd: "**Węzeł zatokowy jako rozrusznik**\n\nW sercu istnieje kilka struktur zdolnych do generowania impulsów elektrycznych. Dlaczego to właśnie węzeł zatokowy dominuje nad pozostałymi?",
    answers: [
      { text: "Generuje impulsy o najwyższej częstotliwości", isCorrect: true },
      { text: "Znajduje się najbliżej komór", isCorrect: false },
      { text: "Zawsze działa szybciej niż węzeł AV", isCorrect: false },
      { text: "Jest jedynym źródłem impulsów elektrycznych w sercu", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Generuje impulsy o najwyższej częstotliwości**

Węzeł zatokowy jest jak lider zespołu – generuje impulsy najszybciej, zwykle z częstością 60–100 razy na minutę, co narzuca rytm pozostałym częściom układu bodźcoprzewodzącego. 

**Dlaczego to ma znaczenie:**
Choć inne struktury, jak węzeł AV czy włókna Purkinjego, też mogą generować impulsy, robią to znacznie wolniej i wchodzą do akcji tylko wtedy, gdy węzeł zatokowy zawiedzie.

To jak główny aktor w przedstawieniu – dopóki jest obecny, inni czekają w kolejce.`,
    tags: ["węzeł-zatokowy", "rozrusznik", "częstotliwość", "dominacja"],
    difficulty: "medium"
  },
  {
    title: "Które odprowadzenie przedsercowe najlepiej pokazuje przednią ścianę serca?",
    bodyMd: "**Odprowadzenia przedsercowe**\n\nOdprowadzenia V1-V6 umieszczone na klatce piersiowej patrzą na różne części serca. Które z nich mają najlepszy widok na przednią ścianę lewej komory?",
    answers: [
      { text: "V3 i V4", isCorrect: true },
      { text: "V1 i V2", isCorrect: false },
      { text: "V5 i V6", isCorrect: false },
      { text: "V1 i aVL", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: V3 i V4**

V3 i V4 to jak dwie kamery ustawione na przodzie serca, obserwujące jego przednią ścianę. 

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- **V1 i V2** patrzą bardziej na prawą stronę serca i przegrodę międzykomorową
- **V5 i V6** rejestrują lewą ścianę boczną serca  
- **aVL** to odprowadzenie kończynowe, nie przedsercowe

Wyobraź sobie to jak widok na budynek – każda kamera pokazuje inny fragment, a razem tworzą pełny obraz.`,
    tags: ["odprowadzenia-przedsercowe", "V3", "V4", "przednia-ściana"],
    difficulty: "easy"
  },
  {
    title: "Co oznacza rytm miarowy na EKG?",
    bodyMd: "**Miarowość rytmu serca**\n\nAnaliza regularności rytmu serca to podstawa interpretacji EKG. Co świadczy o tym, że rytm jest miarowy?",
    answers: [
      { text: "Odstępy między załamkami R są równe", isCorrect: true },
      { text: "Załamki P występują przed każdym QRS", isCorrect: false },
      { text: "QRS mają taki sam kształt w każdym cyklu", isCorrect: false },
      { text: "Oś elektryczna mieści się w zakresie od -30° do +90°", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Odstępy między załamkami R są równe**

Rytm miarowy oznacza, że odstępy między załamkami R (czyli odstępy R-R) są identyczne – serce bije w równym tempie. To jak metronom, który wyznacza stały rytm muzyki.

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- **Obecność załamków P** czy **normalna oś elektryczna** są ważne, ale nie mają bezpośredniego wpływu na miarowość rytmu
- **Jednakowy kształt QRS** świadczy o tym, że impulsy przewodzą się tą samą drogą, ale nie o regularności

Miarowość to kwestia czasu, nie kształtu ani pochodzenia impulsów.`,
    tags: ["rytm", "miarowość", "odstępy-RR", "regularność"],
    difficulty: "easy"
  },
  {
    title: "Jakie odprowadzenie kończynowe najlepiej pokazuje aktywność elektryczną prawej strony serca?",
    bodyMd: "**Prawa strona serca w EKG**\n\nChociaż większość odprowadzeń skupia się na lewej stronie serca, jedno z odprowadzeń kończynowych daje nam wgląd w prawą stronę. Które to?",
    answers: [
      { text: "aVR", isCorrect: true },
      { text: "I", isCorrect: false },
      { text: "II", isCorrect: false },
      { text: "III", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: aVR**

Odprowadzenie aVR jest jak "okno" na prawą stronę serca. Często widzimy w nim odwrotne załamki, ponieważ prąd płynie przeciwnie do tego odprowadzenia. To jak patrzenie na serce z "tyłu" – nie pokazuje szczegółów przedsionków ani komór, ale daje ogólny obraz aktywności prawej strony serca.

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- **Odprowadzenia I, II, III** patrzą głównie na lewą stronę serca i dolną ścianę

aVR jest często ignorowane, ale może dostarczyć cennych informacji diagnostycznych, szczególnie w niektórych rodzajach zawałów.`,
    tags: ["aVR", "prawa-strona", "odprowadzenia-kończynowe"],
    difficulty: "medium"
  },
  {
    title: "Co oznacza, jeśli w odprowadzeniu I załamki są ujemne?",
    bodyMd: "**Ujemne załamki w odprowadzeniu I**\n\nInterpretacja polarności załamków w różnych odprowadzeniach pomaga w ocenie osi elektrycznej serca. Co oznacza ujemna polarność w odprowadzeniu I?",
    answers: [
      { text: "Oś elektryczna jest przesunięta w prawo", isCorrect: true },
      { text: "Oś elektryczna jest przesunięta w lewo", isCorrect: false },
      { text: "Serce jest w normalnej osi elektrycznej", isCorrect: false },
      { text: "Węzeł AV przejął funkcję węzła zatokowego", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Oś elektryczna jest przesunięta w prawo**

Jeśli załamki w odprowadzeniu I są ujemne, oznacza to, że prąd elektryczny płynie w kierunku przeciwnym do lewej ręki – w prawo. To typowe dla odchylenia osi elektrycznej serca w prawo.

Wyobraź sobie, że serce jest jak kompas, który wskazuje na południe zamiast na wschód – coś zmieniło jego naturalne ustawienie.

**Przyczyny odchylenia osi w prawo:**
- Przerost prawej komory
- Blok prawej odnogi pęczka Hisa  
- Zatorowość płucna
- Wrodzone wady serca

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- Odchylenie w lewo dałoby dodatnie załamki w I
- Normalna oś też daje dodatnie załamki w I`,
    tags: ["oś-elektryczna", "odchylenie-w-prawo", "odprowadzenie-I", "ujemne-załamki"],
    difficulty: "medium"
  },
  {
    title: "Jakie znaczenie ma aVF w ocenie osi elektrycznej serca?",
    bodyMd: "**Odprowadzenie aVF w diagnostyce**\n\nOdprowadzenie aVF ma szczególne znaczenie w ocenie osi elektrycznej serca. Jaka jest jego główna funkcja diagnostyczna?",
    answers: [
      { text: "Wskazuje, czy prąd płynie w dół czy w górę", isCorrect: true },
      { text: "Jest kluczowe w diagnozie zawału przedniej ściany", isCorrect: false },
      { text: "Obserwuje lewą ścianę boczną serca", isCorrect: false },
      { text: "Rejestruje aktywność elektryczną przedsionków", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Wskazuje, czy prąd płynie w dół czy w górę**

aVF patrzy na serce od dołu, niczym kamera skierowana na "podstawę" organu. Jeśli załamki w aVF są dodatnie, oznacza to, że główny prąd elektryczny płynie w dół. Ujemne załamki sugerują, że prąd skierowany jest w górę.

To jak kompas, który mówi nam, czy "wiatr" płynie w dół w stronę nóg, czy w stronę głowy.

**Praktyczne zastosowanie:**
Razem z odprowadzeniem I, aVF pozwala szybko określić oś elektryczną:
- I dodatnie + aVF dodatnie = oś normalna
- I dodatnie + aVF ujemne = odchylenie w lewo  
- I ujemne + aVF dodatnie = odchylenie w prawo`,
    tags: ["aVF", "oś-elektryczna", "kierunek-prądu", "diagnostyka"],
    difficulty: "medium"
  }
];

async function addModule1Questions() {
  try {
    console.log("🔍 Szukam sekcji dla Modułu 1...");
    
    // Find the first section (Moduł 1: Podstawy EKG)
    const module1Section = await db.select()
      .from(sections)
      .where(eq(sections.order, 1))
      .limit(1);

    if (module1Section.length === 0) {
      console.error("❌ Nie znaleziono sekcji dla Modułu 1");
      return;
    }

    const sectionId = module1Section[0].id;
    console.log(`✅ Znaleziono sekcję: ${module1Section[0].title} (ID: ${sectionId})`);

    // Get a reviewer user (admin or reviewer role)
    const reviewer = await db.select()
      .from(users)
      .where(eq(users.role, "reviewer"))
      .limit(1);

    if (reviewer.length === 0) {
      console.error("❌ Nie znaleziono użytkownika reviewer");
      return;
    }

    const reviewerId = reviewer[0].id;
    console.log(`✅ Znaleziono recenzenta: ${reviewer[0].firstName} ${reviewer[0].lastName}`);

    // Prepare questions for insertion
    const questionsToInsert = module1Questions.map(q => ({
      sectionId,
      title: q.title,
      bodyMd: q.bodyMd,
      imageUrl: null,
      answers: q.answers,
      explanationMd: q.explanationMd,
      tags: q.tags,
      difficulty: q.difficulty as "easy" | "medium" | "hard",
      status: "published" as const,
      createdBy: reviewerId,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    }));

    console.log(`📝 Dodaję ${questionsToInsert.length} pytań do bazy danych...`);

    // Insert questions
    const result = await db.insert(questions).values(questionsToInsert).returning();

    console.log(`✅ Pomyślnie dodano ${result.length} pytań dla Modułu 1!`);
    
    // Display added questions
    result.forEach((question, index) => {
      console.log(`   ${index + 1}. ${question.title}`);
    });

  } catch (error) {
    console.error("❌ Błąd podczas dodawania pytań:", error);
  }
}

// Run the script
addModule1Questions()
  .then(() => {
    console.log("\n🎉 Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });