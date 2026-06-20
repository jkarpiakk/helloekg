import { storage } from "../storage";
import { db } from "../db";
import { examSessions } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import { handleQuestionAnswer } from "./gamificationService";
import type { 
  Question, 
  Attempt, 
  AnswerData, 
  QuestionConfig,
  DragDropConfig,
  FillBlankConfig,
  MatchingConfig,
  SortingConfig,
  HotspotConfig,
  QuestionMediaAssets
} from "@shared/schema";

// Question types
export type QuestionType = 'multiple_choice' | 'drag_drop' | 'fill_blank' | 'matching' | 'sorting' | 'hotspot';

export interface QuizQuestion {
  id: string;
  title: string;
  bodyMd: string;
  imageUrl?: string;
  answers: Array<{ text: string; index: number }>;
  sectionId: string;
  correctIndex: number;
  explanation: string;
  // New fields for interactive question types
  questionType: QuestionType;
  questionConfig?: QuestionConfig;
  mediaAssets?: QuestionMediaAssets;
}

export interface QuizResult {
  isCorrect: boolean;
  correctIndex: number;
  explanation: string;
  timeMs: number;
  xpEarned?: number;
  newAchievements?: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
  }>;
  // New fields for interactive question types
  partialScore?: number;
  correctAnswer?: AnswerData;
  feedback?: {
    correctItems?: string[];
    incorrectItems?: string[];
  };
}

export interface ReviewQueue {
  questionId: string;
  lastAttempt: Date;
  incorrectCount: number;
  nextReviewDate: Date;
}

export interface ExamSession {
  questionIds: string[];
  currentIndex: number;
  startedAt: Date;
  answers: Array<{
    questionId: string;
    selectedIndex: number;
    isCorrect: boolean;
    timeMs: number;
  }>;
}

export class QuizService {
  // Exam sessions are persisted in the database (table: exam_sessions) so that
  // in-progress exams survive server restarts.
  private readonly EXAM_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  // Loads a non-expired exam session from the DB.
  // Deletes the record and returns null if it has expired or does not exist.
  private async loadExamSession(sessionId: string): Promise<ExamSession | null> {
    const [row] = await db.select().from(examSessions).where(eq(examSessions.sessionId, sessionId));
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await db.delete(examSessions).where(eq(examSessions.sessionId, sessionId));
      return null;
    }
    return row.data as ExamSession;
  }

  // ======= ANSWER VALIDATION FUNCTIONS =======

  validateDragDropAnswer(config: DragDropConfig, answer: { type: 'drag_drop'; placements: Array<{ sourceId: string; targetId: string }> }): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
    const correctItems: string[] = [];
    const incorrectItems: string[] = [];
    
    for (const placement of answer.placements) {
      const target = config.targets.find(t => t.id === placement.targetId);
      if (target && target.acceptsSourceId === placement.sourceId) {
        correctItems.push(placement.sourceId);
      } else {
        incorrectItems.push(placement.sourceId);
      }
    }
    
    const partialScore = correctItems.length / config.sources.length;
    const isCorrect = incorrectItems.length === 0 && correctItems.length === config.sources.length;
    
    return { isCorrect, partialScore, correctItems, incorrectItems };
  }

  validateFillBlankAnswer(config: FillBlankConfig, answer: { type: 'fill_blank'; filledBlanks: Array<{ blankId: string; value: string }> }): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
    const correctItems: string[] = [];
    const incorrectItems: string[] = [];
    
    for (const filled of answer.filledBlanks) {
      const blank = config.blanks.find(b => b.id === filled.blankId);
      if (!blank) {
        incorrectItems.push(filled.blankId);
        continue;
      }
      
      let isMatch = false;
      const normalizedValue = filled.value.trim().toLowerCase();
      
      switch (blank.validationType) {
        case 'exact':
          isMatch = blank.correctAnswers.some(correct => 
            correct.toLowerCase() === normalizedValue
          );
          break;
        case 'regex':
          if (blank.regex) {
            try {
              const regex = new RegExp(blank.regex, 'i');
              isMatch = regex.test(filled.value.trim());
            } catch {
              isMatch = false;
            }
          }
          break;
        case 'numeric_range':
          if (blank.numericRange) {
            const numValue = parseFloat(filled.value.replace(',', '.'));
            isMatch = !isNaN(numValue) && 
              numValue >= blank.numericRange.min && 
              numValue <= blank.numericRange.max;
          }
          break;
      }
      
      if (isMatch) {
        correctItems.push(filled.blankId);
      } else {
        incorrectItems.push(filled.blankId);
      }
    }
    
    const partialScore = correctItems.length / config.blanks.length;
    const isCorrect = incorrectItems.length === 0 && correctItems.length === config.blanks.length;
    
    return { isCorrect, partialScore, correctItems, incorrectItems };
  }

  validateMatchingAnswer(config: MatchingConfig, answer: { type: 'matching'; pairs: Array<{ leftId: string; rightId: string }> }): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
    const correctItems: string[] = [];
    const incorrectItems: string[] = [];
    
    for (const pair of answer.pairs) {
      const correctPair = config.correctPairs.find(p => p.leftId === pair.leftId);
      if (correctPair && correctPair.rightId === pair.rightId) {
        correctItems.push(pair.leftId);
      } else {
        incorrectItems.push(pair.leftId);
      }
    }
    
    const partialScore = correctItems.length / config.correctPairs.length;
    const isCorrect = incorrectItems.length === 0 && correctItems.length === config.correctPairs.length;
    
    return { isCorrect, partialScore, correctItems, incorrectItems };
  }

  validateSortingAnswer(config: SortingConfig, answer: { type: 'sorting'; order: string[] }): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
    const correctItems: string[] = [];
    const incorrectItems: string[] = [];
    
    for (let i = 0; i < config.correctOrder.length; i++) {
      if (answer.order[i] === config.correctOrder[i]) {
        correctItems.push(answer.order[i]);
      } else {
        incorrectItems.push(answer.order[i] || config.correctOrder[i]);
      }
    }
    
    const partialScore = correctItems.length / config.correctOrder.length;
    const isCorrect = incorrectItems.length === 0;
    
    return { isCorrect, partialScore, correctItems, incorrectItems };
  }

  validateHotspotAnswer(config: HotspotConfig, answer: { type: 'hotspot'; clickedHotspots: string[]; clickCoordinates?: { x: number; y: number }[] }): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
    const correctHotspots = config.hotspots.filter(h => h.isCorrect);
    const correctItems: string[] = [];
    const incorrectItems: string[] = [];
    
    for (const clickedId of answer.clickedHotspots) {
      const hotspot = config.hotspots.find(h => h.id === clickedId);
      if (hotspot && hotspot.isCorrect) {
        correctItems.push(clickedId);
      } else {
        incorrectItems.push(clickedId);
      }
    }
    
    // Check if all correct hotspots were clicked (for multiple hotspot questions)
    const allCorrectClicked = correctHotspots.every(h => answer.clickedHotspots.includes(h.id));
    const noIncorrectClicked = incorrectItems.length === 0;
    
    const partialScore = correctItems.length / correctHotspots.length;
    const isCorrect = allCorrectClicked && noIncorrectClicked;
    
    return { isCorrect, partialScore, correctItems, incorrectItems };
  }

  // Unified answer validation dispatcher
  validateAnswer(question: Question, answerData: AnswerData): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
    const questionType = question.questionType || 'multiple_choice';
    
    switch (questionType) {
      case 'multiple_choice':
        if (answerData.type !== 'multiple_choice') {
          return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
        }
        const correctIndex = question.answers.findIndex(a => a.isCorrect);
        const isCorrect = answerData.selectedIndex === correctIndex;
        return { 
          isCorrect, 
          partialScore: isCorrect ? 1 : 0, 
          correctItems: isCorrect ? ['answer'] : [], 
          incorrectItems: isCorrect ? [] : ['answer'] 
        };
        
      case 'drag_drop':
        if (answerData.type !== 'drag_drop' || !question.questionConfig || question.questionConfig.type !== 'drag_drop') {
          return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
        }
        return this.validateDragDropAnswer(question.questionConfig.config, answerData);
        
      case 'fill_blank':
        if (answerData.type !== 'fill_blank' || !question.questionConfig || question.questionConfig.type !== 'fill_blank') {
          return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
        }
        return this.validateFillBlankAnswer(question.questionConfig.config, answerData);
        
      case 'matching':
        if (answerData.type !== 'matching' || !question.questionConfig || question.questionConfig.type !== 'matching') {
          return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
        }
        return this.validateMatchingAnswer(question.questionConfig.config, answerData);
        
      case 'sorting':
        if (answerData.type !== 'sorting' || !question.questionConfig || question.questionConfig.type !== 'sorting') {
          return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
        }
        return this.validateSortingAnswer(question.questionConfig.config, answerData);
        
      case 'hotspot':
        if (answerData.type !== 'hotspot' || !question.questionConfig || question.questionConfig.type !== 'hotspot') {
          return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
        }
        return this.validateHotspotAnswer(question.questionConfig.config, answerData);
        
      default:
        return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
    }
  }

  async initializeExam(userId: string, count: number): Promise<{ sessionId: string; totalQuestions: number }> {
    // Get all published questions from all sections
    const sections = await storage.getSections();
    let allQuestions: Question[] = [];
    
    for (const section of sections) {
      const sectionQuestions = await storage.getQuestionsBySection(section.id, "published");
      allQuestions.push(...sectionQuestions);
    }
    
    if (allQuestions.length === 0) {
      throw new Error("Brak dostępnych pytań w bazie danych");
    }
    
    // Shuffle and select questions
    const shuffled = this.shuffleArray(allQuestions);
    const selectedQuestions = shuffled.slice(0, Math.min(count, allQuestions.length));
    
    // Create session (persisted to DB)
    const sessionId = `${userId}_${Date.now()}`;
    const session: ExamSession = {
      questionIds: selectedQuestions.map(q => q.id),
      currentIndex: 0,
      startedAt: new Date(),
      answers: []
    };
    
    await db.insert(examSessions).values({
      sessionId,
      userId,
      data: session,
      expiresAt: new Date(Date.now() + this.EXAM_SESSION_TTL_MS)
    });
    await this.cleanExpiredSessions();
    
    return {
      sessionId,
      totalQuestions: selectedQuestions.length
    };
  }

  async getExamQuestion(sessionId: string, questionIndex: number): Promise<QuizQuestion | null> {
    const session = await this.loadExamSession(sessionId);
    
    if (!session) {
      throw new Error("Sesja egzaminu nie znaleziona lub wygasła. Rozpocznij egzamin od nowa.");
    }
    
    if (questionIndex >= session.questionIds.length) {
      return null; // Exam finished
    }
    
    const questionId = session.questionIds[questionIndex];
    const question = await storage.getQuestionById(questionId);
    
    if (!question) {
      return null;
    }
    
    return this.formatQuestionForQuiz(question);
  }

  async submitExamAnswer(
    sessionId: string, 
    questionId: string, 
    selectedIndex: number, 
    timeMs: number, 
    userId: string,
    answerData?: AnswerData
  ): Promise<QuizResult> {
    const session = await this.loadExamSession(sessionId);
    
    if (!session) {
      throw new Error("Sesja egzaminu nie znaleziona lub wygasła. Rozpocznij egzamin od nowa.");
    }
    
    const question = await storage.getQuestionById(questionId);
    if (!question) {
      throw new Error("Pytanie nie znalezione");
    }
    
    const questionType = (question.questionType || 'multiple_choice') as QuestionType;
    let isCorrect: boolean;
    let partialScore: number | undefined;
    let correctItems: string[] | undefined;
    let incorrectItems: string[] | undefined;
    const correctIndex = question.answers.findIndex(answer => answer.isCorrect);

    // For interactive question types, use answerData validation
    if (answerData && questionType !== 'multiple_choice') {
      const validationResult = this.validateAnswer(question, answerData);
      isCorrect = validationResult.isCorrect;
      partialScore = validationResult.partialScore;
      correctItems = validationResult.correctItems;
      incorrectItems = validationResult.incorrectItems;
    } else {
      // Legacy multiple choice validation
      isCorrect = selectedIndex === correctIndex;
      partialScore = isCorrect ? 1 : 0;
    }
    
    // Save answer to session
    session.answers.push({
      questionId,
      selectedIndex,
      isCorrect,
      timeMs
    });
    
    session.currentIndex++;
    
    // Persist updated session state to DB
    await db.update(examSessions).set({ data: session }).where(eq(examSessions.sessionId, sessionId));
    
    // Save attempt to database (for statistics)
    await storage.createAttempt({
      userId,
      questionId,
      selectedIndex,
      isCorrect,
      timeMs,
      mode: "exam",
      answerData: answerData || undefined
    });

    // Build correct answer for feedback
    let correctAnswer: AnswerData | undefined;
    if (question.questionConfig) {
      correctAnswer = this.buildCorrectAnswerData(question);
    }
    
    return {
      isCorrect,
      correctIndex,
      explanation: question.explanationMd,
      timeMs,
      partialScore,
      correctAnswer,
      feedback: (correctItems || incorrectItems) ? {
        correctItems,
        incorrectItems
      } : undefined
    };
  }

  async getExamSummary(sessionId: string): Promise<{ totalQuestions: number; correctAnswers: number; totalTime: number } | null> {
    const session = await this.loadExamSession(sessionId);
    
    if (!session) {
      return null;
    }
    
    const correctAnswers = session.answers.filter(a => a.isCorrect).length;
    const totalTime = session.answers.reduce((sum, a) => sum + a.timeMs, 0);
    
    return {
      totalQuestions: session.questionIds.length,
      correctAnswers,
      totalTime
    };
  }

  async clearExamSession(sessionId: string): Promise<void> {
    await db.delete(examSessions).where(eq(examSessions.sessionId, sessionId));
  }

  private async cleanExpiredSessions(): Promise<void> {
    await db.delete(examSessions).where(lt(examSessions.expiresAt, new Date()));
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  async getQuestionForUser(userId: string, sectionId: string | null, mode: "learn" | "review" | "exam" = "learn", examQuestionCount?: number): Promise<QuizQuestion | null> {
    // Exam mode should use initializeExam and getExamQuestion instead
    if (mode === "exam") {
      throw new Error("Use initializeExam and getExamQuestion for exam mode");
    }
    
    // For review mode without section, get questions from review queue
    if (mode === "review" && !sectionId) {
      const reviewQuestionIds = await this.getReviewQueue(userId);
      
      if (reviewQuestionIds.length === 0) {
        return null;
      }
      
      // Get random question from review queue
      const randomQuestionId = reviewQuestionIds[Math.floor(Math.random() * reviewQuestionIds.length)];
      const question = await storage.getQuestionById(randomQuestionId);
      
      if (!question) {
        return null;
      }
      
      return this.formatQuestionForQuiz(question);
    }
    
    // Regular mode - get questions from specific section
    const questions = await storage.getQuestionsBySection(sectionId!, "published");
    
    if (questions.length === 0) {
      return null;
    }

    let selectedQuestion: Question;

    if (mode === "review") {
      // Get questions the user got wrong recently
      const userAttempts = await storage.getUserAttempts(userId);
      const incorrectQuestions = userAttempts
        .filter(attempt => !attempt.isCorrect)
        .map(attempt => attempt.questionId);
      
      const reviewQuestions = questions.filter(q => incorrectQuestions.includes(q.id));
      
      if (reviewQuestions.length > 0) {
        selectedQuestion = reviewQuestions[Math.floor(Math.random() * reviewQuestions.length)];
      } else {
        selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
      }
    } else {
      // For learn mode, select questions user hasn't seen or got wrong
      const userAttempts = await storage.getUserAttempts(userId);
      const attemptedQuestionIds = new Set(userAttempts.map(a => a.questionId));
      
      const unattemptedQuestions = questions.filter(q => !attemptedQuestionIds.has(q.id));
      
      if (unattemptedQuestions.length > 0) {
        selectedQuestion = unattemptedQuestions[0]; // Sequential learning
      } else {
        // All questions attempted, select randomly
        selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
      }
    }

    return this.formatQuestionForQuiz(selectedQuestion);
  }

  private formatQuestionForQuiz(question: Question): QuizQuestion {
    const correctIndex = question.answers.findIndex(answer => answer.isCorrect);
    
    const answers = question.answers.map((answer, index) => ({
      text: answer.text,
      index
    }));

    // Only shuffle answers for multiple choice questions
    const questionType = (question.questionType || 'multiple_choice') as QuestionType;
    if (questionType === 'multiple_choice') {
      for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
      }
    }

    return {
      id: question.id,
      title: question.title,
      bodyMd: question.bodyMd,
      imageUrl: question.imageUrl || undefined,
      answers,
      sectionId: question.sectionId,
      correctIndex,
      explanation: question.explanationMd,
      // New fields for interactive question types
      questionType,
      questionConfig: question.questionConfig || undefined,
      mediaAssets: question.mediaAssets || undefined
    };
  }

  async submitAnswer(
    userId: string, 
    questionId: string, 
    selectedIndex: number, 
    timeMs: number,
    mode: "learn" | "review" | "exam" = "learn",
    answerData?: AnswerData // New: structured answer data for interactive question types
  ): Promise<QuizResult> {
    const question = await storage.getQuestionById(questionId);
    if (!question) {
      throw new Error("Pytanie nie znalezione");
    }

    const questionType = (question.questionType || 'multiple_choice') as QuestionType;
    let isCorrect: boolean;
    let partialScore: number | undefined;
    let correctItems: string[] | undefined;
    let incorrectItems: string[] | undefined;
    const correctIndex = question.answers.findIndex(answer => answer.isCorrect);

    // For interactive question types, use answerData validation
    if (answerData && questionType !== 'multiple_choice') {
      const validationResult = this.validateAnswer(question, answerData);
      isCorrect = validationResult.isCorrect;
      partialScore = validationResult.partialScore;
      correctItems = validationResult.correctItems;
      incorrectItems = validationResult.incorrectItems;
    } else {
      // Legacy multiple choice validation
      isCorrect = selectedIndex === correctIndex;
      partialScore = isCorrect ? 1 : 0;
    }

    // Save attempt with optional answerData
    await storage.createAttempt({
      userId,
      questionId,
      selectedIndex,
      isCorrect,
      timeMs,
      mode,
      answerData: answerData || undefined
    });

    // Update progress if in learn mode
    if (mode === "learn") {
      await this.updateUserProgress(userId, question.sectionId);
    }

    // Handle gamification (XP, achievements, streak) - only in learn mode
    let xpEarned: number | undefined;
    let newAchievements: Array<{ id: string; name: string; description: string; icon: string; }> | undefined;

    if (mode === "learn") {
      const gamificationResult = await handleQuestionAnswer(userId, isCorrect, timeMs);
      xpEarned = gamificationResult.xpEarned;
      
      if (gamificationResult.unlockedAchievements.length > 0) {
        newAchievements = gamificationResult.unlockedAchievements.map(achievement => ({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
        }));
      }
    }

    // Build correct answer for feedback
    let correctAnswer: AnswerData | undefined;
    if (question.questionConfig) {
      correctAnswer = this.buildCorrectAnswerData(question);
    }

    return {
      isCorrect,
      correctIndex,
      explanation: question.explanationMd,
      timeMs,
      xpEarned,
      newAchievements,
      // New fields for interactive question types
      partialScore,
      correctAnswer,
      feedback: (correctItems || incorrectItems) ? {
        correctItems,
        incorrectItems
      } : undefined
    };
  }

  // Build the correct answer data structure from question config
  private buildCorrectAnswerData(question: Question): AnswerData | undefined {
    if (!question.questionConfig) return undefined;
    
    const config = question.questionConfig;
    switch (config.type) {
      case 'drag_drop':
        return {
          type: 'drag_drop',
          placements: config.config.targets.map(t => ({
            sourceId: t.acceptsSourceId,
            targetId: t.id
          }))
        };
      case 'fill_blank':
        return {
          type: 'fill_blank',
          filledBlanks: config.config.blanks.map(b => ({
            blankId: b.id,
            value: b.correctAnswers[0] // First correct answer as example
          }))
        };
      case 'matching':
        return {
          type: 'matching',
          pairs: config.config.correctPairs
        };
      case 'sorting':
        return {
          type: 'sorting',
          order: config.config.correctOrder
        };
      case 'hotspot':
        return {
          type: 'hotspot',
          clickedHotspots: config.config.hotspots.filter(h => h.isCorrect).map(h => h.id)
        };
      default:
        return undefined;
    }
  }

  private async updateUserProgress(userId: string, sectionId: string): Promise<void> {
    const sectionQuestions = await storage.getQuestionsBySection(sectionId, "published");
    const userAttempts = await storage.getUserAttempts(userId);
    
    // Count unique questions attempted in this section
    const sectionAttempts = userAttempts.filter(attempt => 
      sectionQuestions.some(q => q.id === attempt.questionId)
    );
    
    const uniqueQuestionsAttempted = new Set(sectionAttempts.map(a => a.questionId)).size;
    const completionPercentage = Math.min(100, (uniqueQuestionsAttempted / sectionQuestions.length) * 100);
    
    await storage.updateProgress(userId, sectionId, completionPercentage);
  }

  async getReviewQueue(userId: string): Promise<string[]> {
    const userAttempts = await storage.getUserAttempts(userId);
    
    // Get questions that were answered incorrectly
    const incorrectAttempts = userAttempts.filter(attempt => !attempt.isCorrect);
    
    // Group by question and get the most recent attempt for each
    const questionAttempts = new Map<string, Attempt>();
    
    incorrectAttempts.forEach(attempt => {
      const existing = questionAttempts.get(attempt.questionId);
      if (!existing || attempt.createdAt > existing.createdAt) {
        questionAttempts.set(attempt.questionId, attempt);
      }
    });

    // Return all incorrect questions (immediately available for review)
    // Note: Spaced repetition can be added later with a more sophisticated algorithm
    const reviewQuestions: string[] = Array.from(questionAttempts.keys());

    return reviewQuestions;
  }

  async getUserWeakAreas(userId: string): Promise<Array<{ tag: string; successRate: number; questionCount: number }>> {
    const userAttempts = await storage.getUserAttempts(userId);
    const questions = await storage.getAllQuestions("published"); // Get all questions
    
    const tagStats = new Map<string, { correct: number; total: number }>();
    
    for (const attempt of userAttempts) {
      const question = questions.find(q => q.id === attempt.questionId);
      if (!question || !question.tags) continue;
      
      for (const tag of question.tags) {
        if (!tagStats.has(tag)) {
          tagStats.set(tag, { correct: 0, total: 0 });
        }
        
        const stats = tagStats.get(tag)!;
        stats.total++;
        if (attempt.isCorrect) {
          stats.correct++;
        }
      }
    }
    
    const weakAreas = Array.from(tagStats.entries())
      .filter(([_, stats]) => stats.total >= 3) // Only include tags with at least 3 attempts
      .map(([tag, stats]) => ({
        tag,
        successRate: stats.correct / stats.total,
        questionCount: stats.total
      }))
      .sort((a, b) => a.successRate - b.successRate); // Sort by lowest success rate first
    
    return weakAreas;
  }
}

export const quizService = new QuizService();
