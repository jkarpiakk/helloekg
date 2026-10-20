import { randomUUID } from "crypto";
import { storage } from "../storage";
import { db } from "../db";
import { examSessions, progress, attempts, questions } from "@shared/schema";
import { and, eq, lt, sql } from "drizzle-orm";
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
import {
  gradeClinicalCase,
  buildClinicalCaseCorrectAnswer,
  type AnyQuestionConfig,
  type AnyAnswerData,
} from "@shared/clinicalCase";

// Question types
export type QuestionType = 'multiple_choice' | 'drag_drop' | 'fill_blank' | 'matching' | 'sorting' | 'hotspot' | 'clinical_case';

/**
 * Pytanie wysyłane do przeglądarki. NIE zawiera poprawnej odpowiedzi ani wyjaśnienia:
 * ocenia wyłącznie serwer, a wynik (correctIndex, explanation, correctAnswer) wraca
 * dopiero w odpowiedzi na POST /api/quiz/answer. W questionConfig części z odpowiedzią
 * są wyczyszczone (patrz sanitizeConfigForClient) — wyjątek: clinical_case w nauce/powtórce,
 * bo kroki przypadku pokazują wynik od razu, krok po kroku (do egzaminu przypadki nie wchodzą).
 */
export interface QuizQuestion {
  id: string;
  title: string;
  bodyMd: string;
  imageUrl?: string;
  /** Kolejność potasowana; `index` = indeks w bazie — ten wysyła klient jako selectedIndex */
  answers: Array<{ text: string; index: number }>;
  sectionId: string;
  questionType: QuestionType;
  questionConfig?: QuestionConfig;
  mediaAssets?: QuestionMediaAssets;
}

export interface QuizResult {
  isCorrect: boolean;
  /** Indeks poprawnej odpowiedzi w bazie (porównuj z `answers[].index`, nie z pozycją na ekranie) */
  correctIndex: number;
  explanation: string;
  timeMs: number;
  partialScore?: number;
  correctAnswer?: AnswerData;
  feedback?: {
    correctItems?: string[];
    incorrectItems?: string[];
  };
  /** Pełna konfiguracja pytania interaktywnego — do pokazania wyniku (np. poprawne obszary hotspotu) */
  questionConfig?: QuestionConfig;
}

/** Odpowiedź na pytanie egzaminu — bez informacji, czy była poprawna */
export interface ExamAnswerReceipt {
  saved: true;
  answered: number;
  totalQuestions: number;
}

/** Jedno pytanie w przeglądzie po egzaminie */
export interface ExamReviewItem {
  questionId: string;
  title: string;
  bodyMd: string;
  imageUrl?: string;
  questionType: QuestionType;
  /** Odpowiedzi w kolejności z bazy (index = pozycja) */
  answers: Array<{ text: string; index: number }>;
  selectedIndex: number;
  answerData?: AnswerData;
  correctIndex: number;
  correctAnswer?: AnswerData;
  isCorrect: boolean;
  partialScore?: number;
  explanation: string;
}

export interface ExamSummary {
  totalQuestions: number;
  answered: number;
  /** Tylko po zakończeniu — w trakcie egzaminu wynik się nie ujawnia */
  correctAnswers?: number;
  totalTime: number;
  finished: boolean;
  /** Tylko po zakończeniu egzaminu */
  review?: ExamReviewItem[];
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
    partialScore?: number;
    answerData?: AnswerData;
  }>;
}

/** Stan pytania dla kursanta, liczony z OSTATNIEJ próby */
type QuestionState = "new" | "wrong" | "mastered";

export class QuizService {
  // Exam sessions are persisted in the database (table: exam_sessions) so that
  // in-progress exams survive server restarts.
  private readonly EXAM_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly EXAM_MAX_QUESTIONS = 100;

  // Loads a non-expired exam session from the DB.
  // Deletes the record and returns null if it has expired or does not exist.
  // With userId: a session that belongs to someone else is treated as not found.
  private async loadExamSession(sessionId: string, userId?: string): Promise<ExamSession | null> {
    const [row] = await db.select().from(examSessions).where(eq(examSessions.sessionId, sessionId));
    if (!row) return null;
    if (userId !== undefined && row.userId !== userId) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await db.delete(examSessions).where(eq(examSessions.sessionId, sessionId));
      return null;
    }
    return row.data as ExamSession;
  }

  // ======= ANSWER VALIDATION FUNCTIONS =======

  // correctItems/incorrectItems = identyfikatory CELÓW (tak oznacza je DragDropQuestion).
  // Cel bez elementu też jest błędny; poprawne = każdy cel ma właściwy element.
  validateDragDropAnswer(config: DragDropConfig, answer: { type: 'drag_drop'; placements: Array<{ sourceId: string; targetId: string }> }): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
    const correctItems: string[] = [];
    const incorrectItems: string[] = [];
    const placements = Array.isArray(answer.placements) ? answer.placements : [];
    
    for (const target of config.targets) {
      const placed = placements.find(p => String(p.targetId) === String(target.id));
      if (placed && String(placed.sourceId) === String(target.acceptsSourceId)) {
        correctItems.push(target.id);
      } else {
        incorrectItems.push(target.id);
      }
    }
    
    const total = config.targets.length;
    const partialScore = total === 0 ? 0 : correctItems.length / total;
    const isCorrect = total > 0 && incorrectItems.length === 0;
    
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

      case 'clinical_case': {
        // Typy z @shared/clinicalCase — unia QuestionConfig w schema.ts jeszcze go nie zna
        const config = question.questionConfig as AnyQuestionConfig | null;
        const answer = answerData as AnyAnswerData;
        if (answer.type !== 'clinical_case' || !config || config.type !== 'clinical_case') {
          return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
        }
        return gradeClinicalCase(config.config, answer);
      }
        
      default:
        return { isCorrect: false, partialScore: 0, correctItems: [], incorrectItems: [] };
    }
  }

  // ======= OCENA (wspólna dla nauki, powtórki i egzaminu) =======

  private isInteractive(question: Question): boolean {
    const questionType = (question.questionType || 'multiple_choice') as QuestionType;
    return questionType !== 'multiple_choice' && !!question.questionConfig;
  }

  /** Ocena po stronie serwera. Pytanie interaktywne bez answerData = błędna odpowiedź. */
  private grade(question: Question, selectedIndex: number, answerData?: AnswerData) {
    const correctIndex = question.answers.findIndex(answer => answer.isCorrect);
    if (this.isInteractive(question)) {
      if (!answerData) {
        return { isCorrect: false, partialScore: 0, correctIndex, correctItems: [] as string[], incorrectItems: [] as string[], interactive: true };
      }
      return { ...this.validateAnswer(question, answerData), correctIndex, interactive: true };
    }
    const isCorrect = correctIndex >= 0 && selectedIndex === correctIndex;
    return { isCorrect, partialScore: isCorrect ? 1 : 0, correctIndex, correctItems: undefined, incorrectItems: undefined, interactive: false };
  }

  private buildResult(question: Question, grading: ReturnType<QuizService["grade"]>, timeMs: number): QuizResult {
    return {
      isCorrect: grading.isCorrect,
      correctIndex: grading.correctIndex,
      explanation: question.explanationMd,
      timeMs,
      partialScore: grading.partialScore,
      correctAnswer: question.questionConfig ? this.buildCorrectAnswerData(question) : undefined,
      feedback: grading.interactive
        ? { correctItems: grading.correctItems, incorrectItems: grading.incorrectItems }
        : undefined,
      questionConfig: grading.interactive ? (question.questionConfig as QuestionConfig) : undefined,
    };
  }

  private safeTime(timeMs: number): number {
    return Number.isFinite(timeMs) ? Math.min(Math.max(0, Math.round(timeMs)), 24 * 60 * 60 * 1000) : 0;
  }

  // ======= EGZAMIN =======

  async initializeExam(userId: string, count: number): Promise<{ sessionId: string; totalQuestions: number }> {
    // Get all published questions from all sections
    // Jedno lekkie zapytanie: do losowania wystarczą id i typ (wcześniej 33 zapytania o pełne pytania)
    let allQuestions = await db
      .select({ id: questions.id, questionType: questions.questionType })
      .from(questions)
      .where(eq(questions.status, "published"));

    // Przypadki kliniczne pokazują wynik krok po kroku (to ich sens dydaktyczny),
    // więc nie dałoby się ich zadać na egzaminie bez zdradzania odpowiedzi
    allQuestions = allQuestions.filter(q => q.questionType !== 'clinical_case');
    
    if (allQuestions.length === 0) {
      throw new Error("Brak dostępnych pytań w bazie danych");
    }
    
    const wanted = Math.max(1, Math.min(Math.floor(count), this.EXAM_MAX_QUESTIONS));
    const selectedQuestions = this.shuffleArray(allQuestions).slice(0, Math.min(wanted, allQuestions.length));
    
    // Losowy, niezgadywalny identyfikator sesji (persisted to DB)
    const sessionId = randomUUID();
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

  /**
   * Pytanie egzaminu bez odpowiedzi i wyjaśnienia. Można pobrać tylko bieżące
   * (albo wcześniejsze) pytanie — nie da się podejrzeć kolejnych.
   * userId: przekazuj req.user.id — cudza sesja jest traktowana jak nieistniejąca.
   */
  async getExamQuestion(sessionId: string, questionIndex: number, userId?: string): Promise<QuizQuestion | null> {
    const session = await this.loadExamSession(sessionId, userId);
    
    if (!session) {
      throw new Error("Sesja egzaminu nie znaleziona lub wygasła. Rozpocznij egzamin od nowa.");
    }
    
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= session.questionIds.length) {
      return null; // Exam finished / out of range
    }

    if (questionIndex > session.currentIndex) {
      throw new Error("Najpierw odpowiedz na bieżące pytanie egzaminu.");
    }
    
    const question = await storage.getQuestionById(session.questionIds[questionIndex]);
    if (!question) {
      return null;
    }
    
    return this.formatQuestionForQuiz(question, "exam");
  }

  /**
   * Zapisuje odpowiedź egzaminu. Ocena tylko na serwerze; odpowiedź do klienta
   * NIE mówi, czy była poprawna (pełny przegląd dopiero w getExamSummary po końcu).
   * Przyjmuje wyłącznie bieżące pytanie i tylko raz.
   */
  async submitExamAnswer(
    sessionId: string, 
    questionId: string, 
    selectedIndex: number, 
    timeMs: number, 
    userId: string,
    answerData?: AnswerData
  ): Promise<ExamAnswerReceipt> {
    const session = await this.loadExamSession(sessionId, userId);
    
    if (!session) {
      throw new Error("Sesja egzaminu nie znaleziona lub wygasła. Rozpocznij egzamin od nowa.");
    }

    if (session.currentIndex >= session.questionIds.length) {
      throw new Error("Egzamin jest już zakończony.");
    }

    if (session.answers.some(a => a.questionId === questionId)) {
      throw new Error("Na to pytanie już odpowiedziano.");
    }

    if (questionId !== session.questionIds[session.currentIndex]) {
      throw new Error("To nie jest bieżące pytanie egzaminu.");
    }
    
    const question = await storage.getQuestionById(questionId);
    if (!question) {
      throw new Error("Pytanie nie znalezione");
    }

    const time = this.safeTime(timeMs);
    const grading = this.grade(question, selectedIndex, answerData);

    const next: ExamSession = {
      ...session,
      currentIndex: session.currentIndex + 1,
      answers: [
        ...session.answers,
        {
          questionId,
          selectedIndex,
          isCorrect: grading.isCorrect,
          timeMs: time,
          partialScore: grading.partialScore,
          answerData: answerData || undefined,
        },
      ],
    };

    // Zapis warunkowy: przejdzie tylko, jeśli nikt w międzyczasie nie odpowiedział
    // na to samo pytanie (np. podwójne kliknięcie, dwie karty)
    const updated = await db
      .update(examSessions)
      .set({ data: next })
      .where(and(
        eq(examSessions.sessionId, sessionId),
        sql`(${examSessions.data}->>'currentIndex')::int = ${session.currentIndex}`,
      ))
      .returning({ id: examSessions.id });

    if (updated.length === 0) {
      throw new Error("Na to pytanie już odpowiedziano.");
    }
    
    // Save attempt to database (statystyki, opanowanie, powtórka)
    await storage.createAttempt({
      userId,
      questionId,
      selectedIndex,
      isCorrect: grading.isCorrect,
      timeMs: time,
      mode: "exam",
      answerData: answerData || undefined
    });
    await this.updateUserProgress(userId, question.sectionId);

    return {
      saved: true,
      answered: next.answers.length,
      totalQuestions: next.questionIds.length,
    };
  }

  /** userId: przekazuj req.user.id — cudza sesja jest traktowana jak nieistniejąca. */
  async getExamSummary(sessionId: string, userId?: string): Promise<ExamSummary | null> {
    const session = await this.loadExamSession(sessionId, userId);
    
    if (!session) {
      return null;
    }
    
    const correctAnswers = session.answers.filter(a => a.isCorrect).length;
    const totalTime = session.answers.reduce((sum, a) => sum + a.timeMs, 0);
    const finished = session.answers.length >= session.questionIds.length;

    const summary: ExamSummary = {
      totalQuestions: session.questionIds.length,
      answered: session.answers.length,
      correctAnswers: finished ? correctAnswers : undefined,
      totalTime,
      finished,
    };

    // Przegląd z poprawnymi odpowiedziami i wyjaśnieniami — dopiero po ostatnim pytaniu
    if (finished) {
      const questionsById = new Map<string, Question>();
      await Promise.all(session.questionIds.map(async (id) => {
        const q = await storage.getQuestionById(id);
        if (q) questionsById.set(id, q);
      }));
      summary.review = session.answers.flatMap((a): ExamReviewItem[] => {
        const q = questionsById.get(a.questionId);
        if (!q) return [];
        return [{
          questionId: q.id,
          title: q.title || "",
          bodyMd: q.bodyMd,
          imageUrl: q.imageUrl || undefined,
          questionType: (q.questionType || 'multiple_choice') as QuestionType,
          answers: q.answers.map((ans, index) => ({ text: ans.text, index })),
          selectedIndex: a.selectedIndex,
          answerData: a.answerData,
          correctIndex: q.answers.findIndex(ans => ans.isCorrect),
          correctAnswer: q.questionConfig ? this.buildCorrectAnswerData(q) : undefined,
          isCorrect: a.isCorrect,
          partialScore: a.partialScore,
          explanation: q.explanationMd,
        }];
      });
    }

    return summary;
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

  // ======= NAUKA I POWTÓRKA =======

  /** Ostatnia próba każdego pytania (getUserAttempts zwraca od najnowszej) */
  private async latestAttempts(userId: string): Promise<Map<string, { isCorrect: boolean; at: Date }>> {
    const userAttempts = await storage.getUserAttempts(userId);
    const latest = new Map<string, { isCorrect: boolean; at: Date }>();
    for (const attempt of userAttempts) {
      if (!latest.has(attempt.questionId)) {
        latest.set(attempt.questionId, { isCorrect: attempt.isCorrect, at: new Date(attempt.createdAt) });
      }
    }
    return latest;
  }

  private stateOf(latest: Map<string, { isCorrect: boolean; at: Date }>, questionId: string): QuestionState {
    const l = latest.get(questionId);
    return !l ? "new" : l.isCorrect ? "mastered" : "wrong";
  }

  /**
   * Następne pytanie sesji nauki / powtórki.
   *
   * opts.exclude — pytania pokazane już w tej sesji (bez powtórzeń w sesji).
   * opts.ids     — tylko powtórka: ogranicz do tych pytań (np. błędne z właśnie
   *                skończonej sesji); muszą być pytaniami, na które kursant już odpowiadał.
   * Zwraca null, gdy nie ma już nic do pokazania (koniec sesji / pusta powtórka).
   *
   * Kolejność w nauce: nowe (po kolei) → błędne (najdawniej ćwiczone) → opanowane
   * (najdawniej ćwiczone). Dzięki temu nawet bez `exclude` pytanie nie wraca od razu.
   */
  async getQuestionForUser(
    userId: string,
    sectionId: string | null,
    mode: "learn" | "review" | "exam" = "learn",
    opts: { exclude?: string[]; ids?: string[] } = {}
  ): Promise<QuizQuestion | null> {
    // Exam mode should use initializeExam and getExamQuestion instead
    if (mode === "exam") {
      throw new Error("Use initializeExam and getExamQuestion for exam mode");
    }

    const exclude = new Set(opts.exclude ?? []);
    const latest = await this.latestAttempts(userId);
    const byOldestAttempt = (a: string, b: string) =>
      (latest.get(a)?.at.getTime() ?? 0) - (latest.get(b)?.at.getTime() ?? 0);

    if (mode === "review") {
      let candidateIds: string[];
      if (opts.ids && opts.ids.length > 0) {
        // Wskazane pytania — tylko te, które kursant już widział
        candidateIds = Array.from(new Set(opts.ids)).filter(id => latest.has(id));
      } else {
        candidateIds = await this.getReviewQueue(userId);
      }
      if (sectionId) {
        const inSection = new Set((await storage.getQuestionsBySection(sectionId, "published")).map(q => q.id));
        candidateIds = candidateIds.filter(id => inSection.has(id));
      }

      for (const id of candidateIds.filter(id => !exclude.has(id))) {
        const question = await storage.getQuestionById(id);
        if (question && question.status === "published") {
          return this.formatQuestionForQuiz(question, mode);
        }
      }
      return null;
    }

    // Nauka — pytania z sekcji
    if (!sectionId) return null;
    const questions = (await storage.getQuestionsBySection(sectionId, "published")).filter(q => !exclude.has(q.id));
    if (questions.length === 0) {
      return null;
    }

    const fresh = questions.filter(q => this.stateOf(latest, q.id) === "new");
    const wrong = questions.filter(q => this.stateOf(latest, q.id) === "wrong").sort((a, b) => byOldestAttempt(a.id, b.id));
    const mastered = questions.filter(q => this.stateOf(latest, q.id) === "mastered").sort((a, b) => byOldestAttempt(a.id, b.id));

    const selectedQuestion = fresh[0] ?? wrong[0] ?? mastered[0];
    return this.formatQuestionForQuiz(selectedQuestion, mode);
  }

  /** Usuwa z konfiguracji pytania wszystko, co zdradza odpowiedź */
  private sanitizeConfigForClient(config: Question["questionConfig"], mode: "learn" | "review" | "exam"): QuestionConfig | undefined {
    if (!config) return undefined;
    const c = config as AnyQuestionConfig;
    switch (c.type) {
      case 'drag_drop':
        return {
          type: 'drag_drop',
          config: {
            ...c.config,
            // Kolejność źródeł bywa zgodna z kolejnością celów
            sources: this.shuffleArray(c.config.sources),
            targets: c.config.targets.map(t => ({ ...t, acceptsSourceId: "" })),
          },
        };
      case 'fill_blank':
        return {
          type: 'fill_blank',
          config: {
            ...c.config,
            blanks: c.config.blanks.map(({ correctAnswers: _a, regex: _r, numericRange: _n, ...blank }) => ({
              ...blank,
              correctAnswers: [],
            })),
          },
        };
      case 'matching':
        return {
          type: 'matching',
          config: {
            ...c.config,
            rightColumn: c.config.shuffleRight === false ? c.config.rightColumn : this.shuffleArray(c.config.rightColumn),
            correctPairs: [],
          },
        };
      case 'sorting':
        return {
          type: 'sorting',
          config: { ...c.config, items: this.shuffleArray(c.config.items), correctOrder: [] },
        };
      case 'hotspot':
        return {
          type: 'hotspot',
          config: { ...c.config, hotspots: c.config.hotspots.map(h => ({ ...h, isCorrect: false })) },
        };
      case 'clinical_case':
        // Nauka/powtórka: kroki przypadku same pokazują wynik po każdym kroku — zostają pełne.
        // Egzamin (przypadki są z niego wyłączone, to tylko zabezpieczenie): bez odpowiedzi.
        if (mode !== "exam") return config as QuestionConfig;
        return {
          type: 'clinical_case',
          config: {
            ...c.config,
            takeaway: "",
            steps: c.config.steps.map(s =>
              s.kind === "single"
                ? { ...s, explanation: "", answers: s.answers.map(a => ({ ...a, isCorrect: false })) }
                : { ...s, explanation: "", hotspots: s.hotspots.map(h => ({ ...h, isCorrect: false })) }
            ),
          },
        } as unknown as QuestionConfig;
      default:
        return config as QuestionConfig;
    }
  }

  private formatQuestionForQuiz(question: Question, mode: "learn" | "review" | "exam"): QuizQuestion {
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

    let mediaAssets: QuestionMediaAssets | undefined = question.mediaAssets || undefined;
    if (mediaAssets?.explanationImage) {
      const { explanationImage: _e, ...rest } = mediaAssets;
      mediaAssets = rest;
    }

    // Celowo bez correctIndex i explanation — wracają w odpowiedzi na POST /api/quiz/answer
    return {
      id: question.id,
      title: question.title || "",
      bodyMd: question.bodyMd,
      imageUrl: question.imageUrl || undefined,
      answers,
      sectionId: question.sectionId,
      questionType,
      questionConfig: this.sanitizeConfigForClient(question.questionConfig, mode),
      mediaAssets
    };
  }

  async submitAnswer(
    userId: string, 
    questionId: string, 
    selectedIndex: number, 
    timeMs: number,
    mode: "learn" | "review" | "exam" = "learn",
    answerData?: AnswerData // structured answer data for interactive question types
  ): Promise<QuizResult> {
    // Egzamin ma własną ścieżkę (submitExamAnswer) — tu tylko nauka i powtórka
    const attemptMode = mode === "review" ? "review" : "learn";

    const question = await storage.getQuestionById(questionId);
    if (!question) {
      throw new Error("Pytanie nie znalezione");
    }

    const time = this.safeTime(timeMs);
    const grading = this.grade(question, selectedIndex, answerData);

    await storage.createAttempt({
      userId,
      questionId,
      selectedIndex,
      isCorrect: grading.isCorrect,
      timeMs: time,
      mode: attemptMode,
      answerData: answerData || undefined
    });

    // Opanowanie sekcji zmienia każda odpowiedź (także w powtórce)
    await this.updateUserProgress(userId, question.sectionId);

    // XP, seria i osiągnięcia przyznaje trasa POST /api/quiz/answer (gamificationService) —
    // tutaj już nie, bo w nauce liczyło się podwójnie

    return this.buildResult(question, grading, time);
  }

  // Build the correct answer data structure from question config
  private buildCorrectAnswerData(question: Question): AnswerData | undefined {
    if (!question.questionConfig) return undefined;
    
    const config = question.questionConfig as AnyQuestionConfig;
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
      case 'clinical_case':
        // AnswerData z schema.ts nie ma jeszcze tego wariantu — kształt z @shared/clinicalCase
        return buildClinicalCaseCorrectAnswer(config.config) as unknown as AnswerData;
      default:
        return undefined;
    }
  }

  /**
   * Postęp sekcji = OPANOWANIE: odsetek opublikowanych pytań sekcji, których
   * ostatnia próba jest poprawna. Samo odpowiadanie (także źle) nie podbija postępu.
   */
  private async computeMastery(sectionId: string, latest: Map<string, { isCorrect: boolean; at: Date }>): Promise<number | null> {
    const sectionQuestions = await storage.getQuestionsBySection(sectionId, "published");
    if (sectionQuestions.length === 0) return null;
    const mastered = sectionQuestions.filter(q => latest.get(q.id)?.isCorrect === true).length;
    return Math.round((mastered / sectionQuestions.length) * 10000) / 100;
  }

  private async updateUserProgress(userId: string, sectionId: string): Promise<void> {
    const latest = await this.latestAttempts(userId);
    const pct = await this.computeMastery(sectionId, latest);
    if (pct === null) return;
    await storage.updateProgress(userId, sectionId, pct);
  }

  /**
   * Przelicza zapisany postęp kursanta według opanowania (bez ruszania lastActivity,
   * od którego zależy „Kontynuuj”). Brakujące wiersze dopisuje z datą ostatniej próby.
   * Zwraca liczbę zmienionych/dodanych wierszy.
   */
  async recomputeUserProgress(userId: string): Promise<number> {
    const userAttempts = await storage.getUserAttempts(userId);
    const latest = await this.latestAttempts(userId);
    const rows = await storage.getUserProgress(userId);
    const allQuestions = await storage.getAllQuestions();
    const sectionOf = new Map(allQuestions.map(q => [q.id, q.sectionId]));

    // Sekcje z wierszem postępu albo z jakąkolwiek próbą
    const lastActivity = new Map<string, Date>();
    for (const a of userAttempts) {
      const sectionId = sectionOf.get(a.questionId);
      if (sectionId && !lastActivity.has(sectionId)) lastActivity.set(sectionId, new Date(a.createdAt));
    }
    const sectionIds = new Set<string>([...rows.map(r => r.sectionId), ...Array.from(lastActivity.keys())]);

    let changed = 0;
    for (const sectionId of Array.from(sectionIds)) {
      const pct = (await this.computeMastery(sectionId, latest)) ?? 0;
      const row = rows.find(r => r.sectionId === sectionId);
      if (row) {
        if (Math.abs(parseFloat(row.completionPercentage) - pct) > 0.001) {
          await db.update(progress)
            .set({ completionPercentage: pct.toString(), updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(progress.id, row.id));
          changed++;
        }
      } else {
        await db.insert(progress).values({
          userId,
          sectionId,
          completionPercentage: pct.toString(),
          lastActivity: lastActivity.get(sectionId) ?? new Date(),
        });
        changed++;
      }
    }
    return changed;
  }

  /** Jednorazowe przeliczenie postępu wszystkich kursantów (scripts/recompute-progress.ts) */
  async recomputeAllProgress(): Promise<{ users: number; rowsChanged: number }> {
    const fromAttempts = await db.selectDistinct({ userId: attempts.userId }).from(attempts);
    const fromProgress = await db.selectDistinct({ userId: progress.userId }).from(progress);
    const userIds = Array.from(new Set([...fromAttempts, ...fromProgress].map(r => r.userId)));
    let rowsChanged = 0;
    for (const userId of userIds) {
      rowsChanged += await this.recomputeUserProgress(userId);
    }
    return { users: userIds.length, rowsChanged };
  }

  /**
   * Kolejka powtórki: opublikowane pytania, których OSTATNIA próba jest błędna.
   * Pytanie znika z kolejki, gdy odpowiesz na nie dobrze. Najdawniej ćwiczone pierwsze.
   */
  async getReviewQueue(userId: string): Promise<string[]> {
    const latest = await this.latestAttempts(userId);
    const wrongIds = Array.from(latest.entries())
      .filter(([, l]) => !l.isCorrect)
      .sort((a, b) => a[1].at.getTime() - b[1].at.getTime())
      .map(([id]) => id);
    if (wrongIds.length === 0) return [];
    const published = new Set((await storage.getAllQuestions("published")).map(q => q.id));
    return wrongIds.filter(id => published.has(id));
  }

  /**
   * „Do poprawy” na Postępie: TEMATY (nie wewnętrzne tagi studia), w których ostatnie odpowiedzi
   * na pytania wypadają najsłabiej. Liczymy ostatnią odpowiedź na każde pytanie — tak jak opanowanie.
   */
  async getUserWeakAreas(userId: string): Promise<Array<{ tag: string; sectionId: string; successRate: number; questionCount: number }>> {
    const userAttempts = await storage.getUserAttempts(userId);
    const published = await storage.getAllQuestions("published");
    const byId = new Map(published.map(q => [q.id, q]));
    const latest = new Map<string, { isCorrect: boolean; at: number }>();
    for (const a of userAttempts) {
      const at = new Date(a.createdAt as any).getTime();
      const prev = latest.get(a.questionId);
      if (!prev || at >= prev.at) latest.set(a.questionId, { isCorrect: !!a.isCorrect, at });
    }
    const perSection = new Map<string, { correct: number; total: number }>();
    for (const [qid, l] of Array.from(latest.entries())) {
      const q = byId.get(qid);
      if (!q) continue;
      const st = perSection.get(q.sectionId) ?? { correct: 0, total: 0 };
      st.total++;
      if (l.isCorrect) st.correct++;
      perSection.set(q.sectionId, st);
    }
    const sections = await storage.getSections();
    const mods = await storage.getModules();
    const modTitle = new Map(mods.map(m => [m.id, m.title]));
    // „Pytania utrwalające” są w kilku modułach — dopisujemy moduł, żeby było wiadomo które
    const titleOf = new Map(sections.map(s => [s.id, /utrwal/i.test(s.title) ? `${s.title} · ${modTitle.get(s.moduleId) ?? ""}`.replace(/ · $/, "") : s.title]));
    return Array.from(perSection.entries())
      .filter(([, st]) => st.total >= 3 && st.correct / st.total < 0.8)
      .map(([sectionId, st]) => ({
        tag: titleOf.get(sectionId) ?? "Temat",
        sectionId,
        successRate: st.correct / st.total,
        questionCount: st.total,
      }))
      .sort((a, b) => a.successRate - b.successRate);
  }
}

export const quizService = new QuizService();
