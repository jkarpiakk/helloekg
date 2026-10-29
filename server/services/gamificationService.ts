import { db } from "../db";
import { 
  userStats, 
  dailyActivities, 
  achievements, 
  userAchievements,
  streakFreezeLog,
  type UserStats,
  type Achievement,
  type UserAchievement,
  type DailyActivity
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// XP tresholdy dla poziomów (wzór: poziom^2 * 100)
function getXpForLevel(level: number): number {
  return level * level * 100;
}

function getLevelFromXp(xp: number): number {
  let level = 1;
  while (getXpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

// Oblicz XP za odpowiedź
function calculateXpForAnswer(isCorrect: boolean, timeMs: number): number {
  if (!isCorrect) return 5; // 5 XP za próbę
  
  let baseXp = 10; // bazowe XP za poprawną odpowiedź
  
  // Bonus za szybkość (odpowiedź poniżej 30 sekund)
  if (timeMs < 30000) {
    baseXp += 5;
  }
  
  return baseXp;
}

// Inicjalizuj statystyki użytkownika przy rejestracji
export async function initializeUserStats(userId: string): Promise<UserStats> {
  const [stats] = await db
    .insert(userStats)
    .values({
      userId,
      xp: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      streakFreezes: 2,
      totalQuestionsAnswered: 0,
      correctAnswers: 0,
    })
    .returning();
  
  return stats;
}

// Pobierz lub utwórz statystyki użytkownika
export async function getUserStats(userId: string): Promise<UserStats> {
  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));
  
  if (!stats) {
    return await initializeUserStats(userId);
  }
  
  return stats;
}

// Aktualizuj streak
export async function updateStreak(userId: string): Promise<{ 
  stats: UserStats; 
  streakIncreased: boolean;
  streakLost: boolean;
  usedFreeze: boolean;
}> {
  const stats = await getUserStats(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastActivity = stats.lastActivityDate ? new Date(stats.lastActivityDate) : null;
  
  if (lastActivity) {
    lastActivity.setHours(0, 0, 0, 0);
  }
  
  let streakIncreased = false;
  let streakLost = false;
  let usedFreeze = false;
  
  // Jeśli dzisiaj już była aktywność, nie zmieniaj streaku
  if (lastActivity && lastActivity.getTime() === today.getTime()) {
    return { stats, streakIncreased: false, streakLost: false, usedFreeze: false };
  }
  
  // Jeśli wczoraj była aktywność, zwiększ streak
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (lastActivity && lastActivity.getTime() === yesterday.getTime()) {
    streakIncreased = true;
    const newStreak = stats.currentStreak + 1;
    const newLongestStreak = Math.max(newStreak, stats.longestStreak);
    
    const [updatedStats] = await db
      .update(userStats)
      .set({
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastActivityDate: today,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(userStats.userId, userId))
      .returning();
    
    return { stats: updatedStats, streakIncreased, streakLost, usedFreeze };
  }
  
  // Jeśli przedwczoraj lub wcześniej była aktywność
  const dayBeforeYesterday = new Date(yesterday);
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
  
  if (lastActivity && lastActivity.getTime() === dayBeforeYesterday.getTime()) {
    // Sprawdź czy można użyć streak freeze
    if (stats.streakFreezes > 0) {
      usedFreeze = true;
      
      // Użyj streak freeze
      await db.insert(streakFreezeLog).values({
        userId,
        daysSaved: 1,
      });
      
      const [updatedStats] = await db
        .update(userStats)
        .set({
          streakFreezes: stats.streakFreezes - 1,
          lastActivityDate: today,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(userStats.userId, userId))
        .returning();
      
      return { stats: updatedStats, streakIncreased: false, streakLost: false, usedFreeze };
    } else {
      // Utrata streaku
      streakLost = true;
      
      const [updatedStats] = await db
        .update(userStats)
        .set({
          currentStreak: 1, // Zaczyna nowy streak
          lastActivityDate: today,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(userStats.userId, userId))
        .returning();
      
      return { stats: updatedStats, streakIncreased: false, streakLost, usedFreeze: false };
    }
  }
  
  // Jeśli pierwsza aktywność lub duża przerwa - zaczynaj od 1
  const newStreak = lastActivity ? 1 : 1;
  
  const [updatedStats] = await db
    .update(userStats)
    .set({
      currentStreak: newStreak,
      lastActivityDate: today,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(userStats.userId, userId))
    .returning();
  
  return { 
    stats: updatedStats, 
    streakIncreased: newStreak > 1, 
    streakLost: lastActivity !== null && stats.currentStreak > 0,
    usedFreeze: false 
  };
}

// Dodaj XP i aktualizuj poziom
export async function addXp(
  userId: string, 
  xpAmount: number
): Promise<{ 
  stats: UserStats; 
  leveledUp: boolean; 
  newLevel?: number;
  unlockedAchievements: Achievement[];
}> {
  const stats = await getUserStats(userId);
  const newXp = stats.xp + xpAmount;
  const oldLevel = stats.level;
  const newLevel = getLevelFromXp(newXp);
  const leveledUp = newLevel > oldLevel;
  
  const [updatedStats] = await db
    .update(userStats)
    .set({
      xp: newXp,
      level: newLevel,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(userStats.userId, userId))
    .returning();
  
  // Sprawdź odblokowane osiągnięcia
  const unlockedAchievements = await checkAndUnlockAchievements(userId);
  
  return { 
    stats: updatedStats, 
    leveledUp, 
    newLevel: leveledUp ? newLevel : undefined,
    unlockedAchievements 
  };
}

// Zapisz aktywność dnia
export async function recordDailyActivity(
  userId: string,
  questionsAnswered: number = 1,
  xpEarned: number = 0,
  timeSpentMinutes: number = 0
): Promise<DailyActivity> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Sprawdź czy już istnieje wpis na dzisiaj
  const [existing] = await db
    .select()
    .from(dailyActivities)
    .where(
      and(
        eq(dailyActivities.userId, userId),
        eq(sql`DATE(${dailyActivities.activityDate})`, sql`DATE(${today})`)
      )
    );
  
  if (existing) {
    // Zaktualizuj istniejący wpis
    const [updated] = await db
      .update(dailyActivities)
      .set({
        questionsAnswered: existing.questionsAnswered + questionsAnswered,
        xpEarned: existing.xpEarned + xpEarned,
        timeSpentMinutes: existing.timeSpentMinutes + timeSpentMinutes,
      })
      .where(eq(dailyActivities.id, existing.id))
      .returning();
    
    return updated;
  } else {
    // Utwórz nowy wpis
    const [activity] = await db
      .insert(dailyActivities)
      .values({
        userId,
        activityDate: today,
        questionsAnswered,
        xpEarned,
        timeSpentMinutes,
      })
      .returning();
    
    return activity;
  }
}

// Obsługa odpowiedzi na pytanie (główna funkcja)
export async function handleQuestionAnswer(
  userId: string,
  isCorrect: boolean,
  timeMs: number
): Promise<{
  xpEarned: number;
  leveledUp: boolean;
  newLevel?: number;
  streakIncreased: boolean;
  streakLost: boolean;
  usedFreeze: boolean;
  currentStreak: number;
  unlockedAchievements: Achievement[];
}> {
  // 1. Aktualizuj streak
  const { stats: streakStats, streakIncreased, streakLost, usedFreeze } = await updateStreak(userId);
  
  // 2. Oblicz i dodaj XP
  const xpEarned = calculateXpForAnswer(isCorrect, timeMs);
  const { stats: finalStats, leveledUp, newLevel, unlockedAchievements } = await addXp(userId, xpEarned);
  
  // 3. Aktualizuj statystyki pytań
  await db
    .update(userStats)
    .set({
      totalQuestionsAnswered: sql`${userStats.totalQuestionsAnswered} + 1`,
      correctAnswers: isCorrect ? sql`${userStats.correctAnswers} + 1` : userStats.correctAnswers,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(userStats.userId, userId));
  
  // 4. Zapisz dzienną aktywność
  await recordDailyActivity(userId, 1, xpEarned, Math.ceil(timeMs / 60000));
  
  return {
    xpEarned,
    leveledUp,
    newLevel,
    streakIncreased,
    streakLost,
    usedFreeze,
    currentStreak: finalStats.currentStreak,
    unlockedAchievements,
  };
}

// Pobierz aktywność użytkownika dla heatmapy (ostatnie 365 dni)
export async function getUserActivityHeatmap(userId: string): Promise<DailyActivity[]> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  return await db
    .select()
    .from(dailyActivities)
    .where(
      and(
        eq(dailyActivities.userId, userId),
        sql`${dailyActivities.activityDate} >= ${oneYearAgo}`
      )
    )
    .orderBy(desc(dailyActivities.activityDate));
}

// Sprawdź i odblokuj osiągnięcia
export async function checkAndUnlockAchievements(userId: string): Promise<Achievement[]> {
  const stats = await getUserStats(userId);
  
  // Pobierz wszystkie osiągnięcia
  const allAchievements = await db.select().from(achievements);
  
  // Pobierz już odblokowane osiągnięcia
  const unlockedIds = (await db
    .select({ achievementId: userAchievements.achievementId })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId)))
    .map(ua => ua.achievementId);
  
  const newlyUnlocked: Achievement[] = [];
  
  for (const achievement of allAchievements) {
    // Pomiń już odblokowane
    if (unlockedIds.includes(achievement.id)) continue;
    
    let shouldUnlock = false;
    
    // Sprawdź warunek
    switch (achievement.condition.type) {
      case 'streak':
        shouldUnlock = stats.currentStreak >= achievement.condition.threshold;
        break;
      case 'total_questions':
        shouldUnlock = stats.totalQuestionsAnswered >= achievement.condition.threshold;
        break;
      case 'accuracy':
        const accuracy = stats.totalQuestionsAnswered > 0 
          ? (stats.correctAnswers / stats.totalQuestionsAnswered) * 100 
          : 0;
        shouldUnlock = accuracy >= achievement.condition.threshold;
        break;
      // Możesz dodać więcej typów warunków
    }
    
    if (shouldUnlock) {
      // Odblokuj osiągnięcie
      await db.insert(userAchievements).values({
        userId,
        achievementId: achievement.id,
      });
      
      // Dodaj bonus XP
      if (achievement.xpReward > 0) {
        await addXp(userId, achievement.xpReward);
      }
      
      newlyUnlocked.push(achievement);
    }
  }
  
  return newlyUnlocked;
}

// Pobierz osiągnięcia użytkownika
export async function getUserAchievements(userId: string): Promise<{
  unlocked: (UserAchievement & { achievement: Achievement })[];
  locked: Achievement[];
}> {
  // Pobierz odblokowane
  const unlocked = await db
    .select({
      id: userAchievements.id,
      userId: userAchievements.userId,
      achievementId: userAchievements.achievementId,
      unlockedAt: userAchievements.unlockedAt,
      achievement: achievements,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.unlockedAt));
  
  // Pobierz wszystkie osiągnięcia
  const allAchievements = await db.select().from(achievements);
  
  // Filtruj zablokowane
  const unlockedIds = unlocked.map(u => u.achievementId);
  const locked = allAchievements.filter(a => !unlockedIds.includes(a.id));
  
  return { unlocked, locked };
}

// Nazwa poziomu na podstawie numeru
export function getLevelName(level: number): string {
  if (level <= 5) return "Student Medycyny";
  if (level <= 10) return "Stażysta";
  if (level <= 20) return "Rezydent";
  if (level <= 30) return "Specjalista";
  return "Kardiolog";
}

// Oblicz XP do następnego poziomu
export function getXpToNextLevel(currentXp: number, currentLevel: number): {
  currentLevelXp: number;
  nextLevelXp: number;
  xpProgress: number;
  xpNeeded: number;
  progressPercentage: number;
} {
  const currentLevelXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  const xpProgress = currentXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentXp;
  const progressPercentage = (xpProgress / (nextLevelXp - currentLevelXp)) * 100;
  
  return {
    currentLevelXp,
    nextLevelXp,
    xpProgress,
    xpNeeded,
    progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
  };
}
