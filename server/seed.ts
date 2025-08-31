import { db } from "./db";
import { users, plans, sections, questions, subscriptions } from "@shared/schema";
import { authService } from "./auth";

export async function seedDatabase() {
  console.log("Seeding database...");

  try {
    // Create default plans
    const planData = [
      {
        name: "Plan Miesięczny",
        price: "60.00",
        durationDays: 30,
        currency: "PLN",
        stripePriceId: null,
      },
      {
        name: "Plan Kwartalny", 
        price: "100.00",
        durationDays: 90,
        currency: "PLN",
        stripePriceId: null,
      },
      {
        name: "Plan Roczny",
        price: "169.00", 
        durationDays: 365,
        currency: "PLN",
        stripePriceId: null,
      }
    ];

    const createdPlans = await db.insert(plans).values(planData).returning();
    console.log(`Created ${createdPlans.length} plans`);

    // Create sections/modules
    const sectionData = [
      {
        title: "Moduł 1: Podstawy EKG",
        description: "Wprowadzenie do elektrokardiografii, podstawowe zasady interpretacji",
        order: 1,
        isLocked: false,
      },
      {
        title: "Moduł 2: Rytmy serca",
        description: "Rozpoznawanie i interpretacja różnych rytmów serca",
        order: 2,
        isLocked: true,
      },
      {
        title: "Moduł 3: Zawał serca",
        description: "Diagnostyka zawału mięśnia sercowego w zapisie EKG",
        order: 3,
        isLocked: true,
      },
      {
        title: "Moduł 4: Arytmie",
        description: "Zaburzenia rytmu i przewodnictwa",
        order: 4,
        isLocked: true,
      },
      {
        title: "Moduł 5: Zaburzenia przewodnictwa",
        description: "Bloki AV, bloki odnóg pęczka Hisa",
        order: 5,
        isLocked: true,
      }
    ];

    const createdSections = await db.insert(sections).values(sectionData).returning();
    console.log(`Created ${createdSections.length} sections`);

    // Create demo reviewer account
    const hashedPassword = await authService.hashPassword("reviewer123");
    const reviewerData = {
      email: "reviewer@ekgacademy.pl",
      password: hashedPassword,
      firstName: "Jan",
      lastName: "Kowalski",
      profession: "Kardiolog",
      role: "reviewer",
      locale: "pl",
      emailVerified: true,
      termsAccepted: true,
      privacyAccepted: true,
      marketingConsent: false,
    };

    const reviewer = await db.insert(users).values(reviewerData).returning();
    console.log("Created reviewer account");

    // Create sample questions for each section
    const sampleQuestions = [];
    
    for (let sectionIndex = 0; sectionIndex < createdSections.length; sectionIndex++) {
      const section = createdSections[sectionIndex];
      
      for (let i = 1; i <= 10; i++) {
        const questionData = {
          sectionId: section.id,
          title: `Pytanie ${i} - ${section.title}`,
          bodyMd: `**Scenariusz kliniczny:** Pacjent lat 65, zgłasza się z bólem w klatce piersiowej. Na podstawie zapisu EKG określ prawdopodobne rozpoznanie.

**Uwagi:** Zwróć uwagę na morfologię zespołów QRS, odstępy PR oraz obecność załamków P.`,
          imageUrl: `/images/ekg-placeholder-${String(sectionIndex * 10 + i).padStart(2, '0')}.png`,
          answers: [
            { text: "Rytm zatokowy prawidłowy", isCorrect: i % 4 === 1 },
            { text: "Migotanie przedsionków", isCorrect: i % 4 === 2 },
            { text: "Blok AV pierwszego stopnia", isCorrect: i % 4 === 3 },
            { text: "Częstoskurcz nadkomorowy", isCorrect: i % 4 === 0 }
          ],
          explanationMd: `## Prawidłowa odpowiedź

**${i % 4 === 1 ? "Rytm zatokowy prawidłowy" : i % 4 === 2 ? "Migotanie przedsionków" : i % 4 === 3 ? "Blok AV pierwszego stopnia" : "Częstoskurcz nadkomorowy"}**

### Charakterystyczne cechy:

- **Częstość rytmu:** W granicach normy (60-100/min)
- **Regularność:** Regularne odstępy RR
- **Załamki P:** Obecne przed każdym zespołem QRS
- **Przewodnictwo AV:** Prawidłowe (PQ 120-200ms)

### Znaczenie kliniczne:

Ten rytm jest charakterystyczny dla prawidłowej czynności serca. U pacjentów z objawami kardiologicznymi należy rozważyć inne przyczyny dolegliwości.

### Pamiętaj:

Zawsze interpretuj EKG w kontekście klinicznym pacjenta. Sam zapis EKG bez objawów klinicznych może nie wymagać interwencji.`,
          tags: ["podstawy", "rytm", "interpretacja", `modul-${sectionIndex + 1}`],
          difficulty: i <= 3 ? "easy" : i <= 7 ? "medium" : "hard",
          status: "published",
          createdBy: reviewer[0].id,
          reviewedBy: reviewer[0].id,
          reviewedAt: new Date(),
        };

        sampleQuestions.push(questionData);
      }
    }

    const createdQuestions = await db.insert(questions).values(sampleQuestions).returning();
    console.log(`Created ${createdQuestions.length} sample questions`);

    console.log("Database seeding completed successfully!");
    
    console.log("\n=== Demo Accounts ===");
    console.log("Reviewer account:");
    console.log("Email: reviewer@ekgacademy.pl");
    console.log("Password: reviewer123");
    console.log("Role: reviewer (can manage questions)");
    
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
