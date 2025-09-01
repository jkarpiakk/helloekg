import { db } from "../db";
import { questions, sections, users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Pozostałe pytania dla Modułu 1 (12-20)
const remainingModule1Questions = [
  {
    title: "Co oznacza, jeśli w odprowadzeniu I załamki R są niskie, a w odprowadzeniu aVF dodatnie?",
    bodyMd: "**Niska amplituda załamków R**\n\nNa zapisie EKG widzisz bardzo niskie załamki R w odprowadzeniu I, ale załamki w aVF są wyraźnie dodatnie. Co to może oznaczać?",
    answers: [
      { text: "Niska amplituda załamków spowodowana otyłością lub płynem w osierdziu", isCorrect: true },
      { text: "Oś elektryczna przesunięta w prawo", isCorrect: false },
      { text: "Blok AV I stopnia", isCorrect: false },
      { text: "Migotanie przedsionków", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Niska amplituda załamków spowodowana otyłością lub płynem w osierdziu**

Niska amplituda załamków R w odprowadzeniach to jak przyciemnione światło – impulsy elektryczne nadal płyną, ale ich sygnał jest osłabiony. Może to wynikać z tłumienia sygnału przez tkankę tłuszczową, płyn w osierdziu, rozedmę płuc lub zwiększoną odległość między elektrodami a sercem. 

Dodatni załamek w aVF wskazuje, że prąd płynie w dół (w stronę nóg), co oznacza, że oś elektryczna jest w normalnym zakresie.

**Przyczyny niskiej amplitudy:**
- Otyłość (tkanka tłuszczowa tłumi sygnał)
- Płyn w osierdziu (przeszkoda dla prądu)
- Rozedma płuc (powietrze nie przewodzi prądu)
- Nieprawidłowe założenie elektrod`,
    tags: ["niska-amplituda", "oś-elektryczna", "I", "aVF", "diagnostyka"],
    difficulty: "medium"
  },
  {
    title: "Co oznacza załamek P widoczny w odprowadzeniu II?",
    bodyMd: "**Załamek P w EKG**\n\nNa początku każdego cyklu sercowego w odprowadzeniu II widzisz wyraźny załamek P. Co reprezentuje ta pierwsza fala na zapisie?",
    answers: [
      { text: "Depolaryzację przedsionków", isCorrect: true },
      { text: "Depolaryzację komór", isCorrect: false },
      { text: "Repolaryzację przedsionków", isCorrect: false },
      { text: "Repolaryzację komór", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Depolaryzację przedsionków**

Załamek P to pierwsza "nutka" cyklu serca – reprezentuje depolaryzację przedsionków, czyli ich pobudzenie elektryczne, które prowadzi do skurczu. To jak włączanie światła w dwóch pokojach (przedsionkach), aby przygotować je na przyjęcie impulsu.

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- **Depolaryzacja komór** to zespół QRS
- **Repolaryzacja przedsionków** nie jest widoczna, bo jest zasłonięta przez większe zespoły QRS  
- **Repolaryzacja komór** to załamek T

Załamek P jest jak sygnał startu dla całego cyklu sercowego.`,
    tags: ["załamek-P", "depolaryzacja", "przedsionki", "podstawy"],
    difficulty: "easy"
  },
  {
    title: "Jaki jest prawidłowy czas trwania odstępu PQ?",
    bodyMd: "**Odstęp PQ w EKG**\n\nOdstęp PQ to kluczowy parametr w ocenie przewodzenia przedsionkowo-komorowego. Jaki jest prawidłowy zakres jego trwania?",
    answers: [
      { text: "0,12–0,20 sekundy", isCorrect: true },
      { text: "0,08–0,12 sekundy", isCorrect: false },
      { text: "0,20–0,30 sekundy", isCorrect: false },
      { text: "0,30–0,40 sekundy", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: 0,12–0,20 sekundy**

Odstęp PQ to czas potrzebny na przejście impulsu z przedsionków do komór przez węzeł AV. Wyobraź sobie ten odstęp jak chwilowy postój na stacji kolejowej, gdzie pasażerowie (impulsy) przesiadają się do innego pociągu.

**Interpretacja:**
- **<0,12 s** = skrócony (może wskazywać na zespół WPW)
- **0,12-0,20 s** = prawidłowy
- **>0,20 s** = wydłużony (blok AV I stopnia)

Jeśli trwa zbyt długo (>0,20 s), oznacza to, że coś opóźnia przejście sygnału, co jest typowe dla bloku AV I stopnia.`,
    tags: ["odstęp-PQ", "przewodnictwo-AV", "normy", "bloki"],
    difficulty: "easy"
  },
  {
    title: "Dlaczego zespoły QRS są wąskie w rytmie zatokowym?",
    bodyMd: "**Szerokość zespołów QRS**\n\nW prawidłowym rytmie zatokowym zespoły QRS są wąskie. Co to oznacza o drogach przewodzenia w sercu?",
    answers: [
      { text: "Impuls przechodzi przez normalne drogi przewodzenia", isCorrect: true },
      { text: "Komory są powiększone", isCorrect: false },
      { text: "Węzeł AV nie działa prawidłowo", isCorrect: false },
      { text: "Impuls pochodzi z komór", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Impuls przechodzi przez normalne drogi przewodzenia**

Wąskie QRS (trwające <0,12 sekundy) oznaczają, że impuls elektryczny przechodzi przez normalne drogi przewodzenia – pęczek Hisa i włókna Purkinjego – bez przeszkód. To jak jazda autostradą bez korków.

**Dlaczego szerokość ma znaczenie:**
- **Wąskie QRS** (<0,12 s) = prawidłowe przewodzenie
- **Szerokie QRS** (≥0,12 s) = impuls musiał znaleźć "objazd"

Jeśli QRS jest szeroki, to znak, że impuls musiał znaleźć "objazd", co zwykle wskazuje na problem z przewodzeniem, jak blok odnogi pęczka Hisa.`,
    tags: ["QRS", "szerokość", "przewodzenie", "pęczek-Hisa"],
    difficulty: "easy"
  },
  {
    title: "Jakie odprowadzenie przedsercowe najlepiej rejestruje aktywność przegrody międzykomorowej?",
    bodyMd: "**Odprowadzenia przedsercowe i przegroda międzykomorowa**\n\nPrzegroda międzykomorowa to ważna struktura serca. Które odprowadzenia przedsercowe najlepiej ją obserwują?",
    answers: [
      { text: "V1 i V2", isCorrect: true },
      { text: "V3 i V4", isCorrect: false },
      { text: "V5 i V6", isCorrect: false },
      { text: "aVR", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: V1 i V2**

V1 i V2 to jak detektywi stojący po obu stronach przegrody międzykomorowej – obserwują impulsy elektryczne w tej okolicy z największą precyzją. Dlatego są kluczowe w diagnozie bloków odnogi pęczka Hisa.

**Dlaczego inne odpowiedzi są nieprawidłowe:**
- **V3 i V4** patrzą bardziej na przednią ścianę
- **V5 i V6** obserwują lewą ścianę boczną
- **aVR** to odprowadzenie kończynowe, nie przedsercowe

Te odprowadzenia są szczególnie ważne w rozpoznawaniu zaburzeń przewodnictwa wewnątrzkomorowego.`,
    tags: ["V1", "V2", "przegroda-międzykomorowa", "bloki-odnóg"],
    difficulty: "medium"
  },
  {
    title: "Co oznacza uniesienie odcinka ST w odprowadzeniach II, III i aVF?",
    bodyMd: "**Uniesienie odcinka ST**\n\nNa zapisie EKG widzisz wyraźne uniesienie odcinka ST w odprowadzeniach II, III i aVF. Co to najprawdopodobniej oznacza?",
    answers: [
      { text: "Zawał ściany dolnej serca", isCorrect: true },
      { text: "Zawał ściany przedniej serca", isCorrect: false },
      { text: "Przerost lewej komory", isCorrect: false },
      { text: "Zatorowość płucna", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Zawał ściany dolnej serca**

Odprowadzenia II, III i aVF patrzą na serce od dołu, jak kamery skierowane na podstawę serca. Uniesienie ST w tych odprowadzeniach to jak sygnał SOS wysyłany przez dolną ścianę serca, która cierpi z powodu niedokrwienia spowodowanego zawałem.

**Topografia ścian serca:**
- **II, III, aVF** = ściana dolna
- **V1-V4** = ściana przednia
- **I, aVL, V5-V6** = ściana boczna

To jeden z najważniejszych wzorców do zapamiętania w diagnostyce zawału serca.`,
    tags: ["uniesienie-ST", "zawał", "ściana-dolna", "II-III-aVF"],
    difficulty: "medium"
  },
  {
    title: "Co jest cechą charakterystyczną rytmu zatokowego?",
    bodyMd: "**Cechy rytmu zatokowego**\n\nRytm zatokowy ma swoje charakterystyczne cechy. Która z nich jest najbardziej specyficzna dla tego rytmu?",
    answers: [
      { text: "Załamek P jest dodatni w odprowadzeniu II", isCorrect: true },
      { text: "Załamek T jest zawsze ujemny w odprowadzeniu I", isCorrect: false },
      { text: "Odstępy PQ są nieregularne", isCorrect: false },
      { text: "Oś elektryczna serca jest zawsze dodatnia", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Załamek P jest dodatni w odprowadzeniu II**

Dodatni załamek P w odprowadzeniu II to znak rozpoznawczy rytmu zatokowego, ponieważ impuls płynie z węzła zatokowego w kierunku przedsionków i komór, co pokrywa się z kierunkiem rejestracji w odprowadzeniu II.

**Dlaczego to jest ważne:**
- Węzeł zatokowy znajduje się w prawym przedsionku
- Impuls płynie w dół i w lewo
- Odprowadzenie II "patrzy" w tym samym kierunku

Inne odpowiedzi dotyczą parametrów, które mogą być zmienne nawet w rytmie zatokowym.`,
    tags: ["rytm-zatokowy", "załamek-P", "odprowadzenie-II", "cechy-charakterystyczne"],
    difficulty: "medium"
  },
  {
    title: "Jakie znaczenie mają odprowadzenia aVL i aVF w ocenie osi elektrycznej?",
    bodyMd: "**Odprowadzenia aVL i aVF**\n\nOdprowadzenia aVL i aVF mają szczególne znaczenie w ocenie osi elektrycznej serca. Jaka jest ich funkcja?",
    answers: [
      { text: "aVL patrzy na serce z lewej strony, a aVF z dołu", isCorrect: true },
      { text: "Oba odprowadzenia rejestrują aktywność przedsionków", isCorrect: false },
      { text: "Są kluczowe w diagnozie bloków przewodzenia", isCorrect: false },
      { text: "Używane są wyłącznie do oceny załamków Q", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: aVL patrzy na serce z lewej strony, a aVF z dołu**

aVL to "kamera" na lewej stronie serca, a aVF patrzy od dołu. Razem z odprowadzeniem I tworzą trójwymiarowy obraz osi elektrycznej serca, co pomaga zrozumieć, w którą stronę płynie główny prąd.

To jak użycie GPS-u, aby zlokalizować dokładne ustawienie serca w klatce piersiowej.

**Praktyczne zastosowanie:**
- **aVL** = "left" (lewa strona)
- **aVF** = "foot" (stopa, czyli dół)
- Razem z **I** dają pełny obraz osi elektrycznej

Te odprowadzenia są fundamentalne w szybkiej ocenie osi serca.`,
    tags: ["aVL", "aVF", "oś-elektryczna", "orientacja-przestrzenna"],
    difficulty: "medium"
  },
  {
    title: "Co sugeruje brak załamków P w odprowadzeniu II?",
    bodyMd: "**Brak załamków P**\n\nPrzez długi odcinek zapisu EKG w odprowadzeniu II nie widzisz żadnych załamków P, tylko nieregularne zespoły QRS. Co to oznacza?",
    answers: [
      { text: "Migotanie przedsionków", isCorrect: true },
      { text: "Rytm zatokowy", isCorrect: false },
      { text: "Blok AV I stopnia", isCorrect: false },
      { text: "Częstoskurcz nadkomorowy", isCorrect: false }
    ],
    explanationMd: `**Prawidłowa odpowiedź: Migotanie przedsionków**

Brak załamków P w odprowadzeniu II to znak migotania przedsionków – sytuacji, w której przedsionki tracą swój regularny rytm, a impulsy elektryczne powstają chaotycznie. 

Wyobraź sobie przedsionki jako tłum ludzi, którzy wszyscy próbują mówić jednocześnie – nie ma tu żadnej harmonii.

**Cechy migotania przedsionków:**
- Brak załamków P
- Nieregularne odstępy R-R  
- Może być obecna falista linia podstawowa
- Częstość często powyżej 100/min

To jedna z najczęstszych arytmii, szczególnie u osób starszych.`,
    tags: ["migotanie-przedsionków", "brak-załamków-P", "arytmia", "nieregularność"],
    difficulty: "medium"
  }
];

async function addRemainingModule1Questions() {
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
    const questionsToInsert = remainingModule1Questions.map(q => ({
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

    console.log(`📝 Dodaję ${questionsToInsert.length} pozostałych pytań do bazy danych...`);

    // Insert questions
    const result = await db.insert(questions).values(questionsToInsert).returning();

    console.log(`✅ Pomyślnie dodano ${result.length} dodatkowych pytań dla Modułu 1!`);
    
    // Display added questions
    result.forEach((question, index) => {
      console.log(`   ${index + 12}. ${question.title}`);
    });

    console.log(`\n🎯 Łącznie w Modułu 1 jest teraz 20 pytań (11 poprzednich + ${result.length} nowych)`);

  } catch (error) {
    console.error("❌ Błąd podczas dodawania pytań:", error);
  }
}

// Run the script
addRemainingModule1Questions()
  .then(() => {
    console.log("\n🎉 Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });