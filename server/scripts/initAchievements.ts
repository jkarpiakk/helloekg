import { db } from "../db";
import { achievements } from "@shared/schema";
import { eq } from "drizzle-orm";

const defaultAchievements = [
  // Streak Achievements
  {
    key: "streak_7",
    name: "Płomień Tygodnia 🔥",
    description: "Naucz się przez 7 dni z rzędu",
    category: "streak",
    icon: "🔥",
    condition: {
      type: "streak" as const,
      threshold: 7
    },
    xpReward: 100
  },
  {
    key: "streak_30",
    name: "Ognisty Miesiąc 🏆",
    description: "Naucz się przez 30 dni z rzędu",
    category: "streak",
    icon: "🏆",
    condition: {
      type: "streak" as const,
      threshold: 30
    },
    xpReward: 500
  },
  {
    key: "streak_100",
    name: "Nieugaszony Ogień ⭐",
    description: "Naucz się przez 100 dni z rzędu",
    category: "streak",
    icon: "⭐",
    condition: {
      type: "streak" as const,
      threshold: 100
    },
    xpReward: 1000
  },
  {
    key: "streak_365",
    name: "Rok Poświęcenia 👑",
    description: "Naucz się przez 365 dni z rzędu",
    category: "streak",
    icon: "👑",
    condition: {
      type: "streak" as const,
      threshold: 365
    },
    xpReward: 5000
  },

  // Accuracy Achievements
  {
    key: "accuracy_90",
    name: "Precyzyjny Diagnostyk 🎯",
    description: "Osiągnij 90% skuteczności",
    category: "accuracy",
    icon: "🎯",
    condition: {
      type: "accuracy" as const,
      threshold: 90
    },
    xpReward: 200
  },
  {
    key: "accuracy_95",
    name: "Perfekcjonista 💎",
    description: "Osiągnij 95% skuteczności",
    category: "accuracy",
    icon: "💎",
    condition: {
      type: "accuracy" as const,
      threshold: 95
    },
    xpReward: 500
  },
  {
    key: "accuracy_99",
    name: "Bezbłędny Kardiolog 🌟",
    description: "Osiągnij 99% skuteczności",
    category: "accuracy",
    icon: "🌟",
    condition: {
      type: "accuracy" as const,
      threshold: 99
    },
    xpReward: 1000
  },

  // Volume Achievements
  {
    key: "questions_100",
    name: "Rozpoczynający 📚",
    description: "Odpowiedz na 100 pytań",
    category: "volume",
    icon: "📚",
    condition: {
      type: "total_questions" as const,
      threshold: 100
    },
    xpReward: 50
  },
  {
    key: "questions_500",
    name: "Praktykant EKG 📖",
    description: "Odpowiedz na 500 pytań",
    category: "volume",
    icon: "📖",
    condition: {
      type: "total_questions" as const,
      threshold: 500
    },
    xpReward: 200
  },
  {
    key: "questions_1000",
    name: "Ekspert EKG 🎓",
    description: "Odpowiedz na 1000 pytań",
    category: "volume",
    icon: "🎓",
    condition: {
      type: "total_questions" as const,
      threshold: 1000
    },
    xpReward: 500
  },
  {
    key: "questions_5000",
    name: "Mistrz Elektrokardiografii 🏅",
    description: "Odpowiedz na 5000 pytań",
    category: "volume",
    icon: "🏅",
    condition: {
      type: "total_questions" as const,
      threshold: 5000
    },
    xpReward: 2000
  },

  // Speed Achievements (będzie implementowane w przyszłości)
  {
    key: "speed_master",
    name: "Szybki Umysł ⚡",
    description: "Średni czas odpowiedzi poniżej 20 sekund",
    category: "speed",
    icon: "⚡",
    condition: {
      type: "speed" as const,
      threshold: 20
    },
    xpReward: 300
  },
];

async function initAchievements() {
  console.log("🎯 Inicjalizacja osiągnięć...");
  
  for (const achievement of defaultAchievements) {
    // Sprawdź czy osiągnięcie już istnieje
    const [existing] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.key, achievement.key));
    
    if (existing) {
      console.log(`✓ Osiągnięcie '${achievement.name}' już istnieje`);
      continue;
    }
    
    // Dodaj osiągnięcie
    await db.insert(achievements).values(achievement);
    console.log(`✓ Dodano osiągnięcie: ${achievement.name}`);
  }
  
  console.log("\n✅ Inicjalizacja osiągnięć zakończona!");
}

export { initAchievements, defaultAchievements };

// Uruchom jeśli wywołano bezpośrednio
if (import.meta.url === `file://${process.argv[1]}`) {
  initAchievements()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Błąd podczas inicjalizacji osiągnięć:", error);
      process.exit(1);
    });
}
