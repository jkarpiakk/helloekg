import { storage } from "../storage";
import type { Question, Attempt } from "@shared/schema";

export interface QuizQuestion {
  id: string;
  title: string;
  bodyMd: string;
  imageUrl?: string;
  answers: Array<{ text: string; index: number }>;
  sectionId: string;
}

export interface QuizResult {
  isCorrect: boolean;
  correctIndex: number;
  explanation: string;
  timeMs: number;
}

export interface ReviewQueue {
  questionId: string;
  lastAttempt: Date;
  incorrectCount: number;
  nextReviewDate: Date;
}

export class QuizService {
  async getQuestionForUser(userId: string, sectionId: string, mode: "learn" | "review" | "exam" = "learn"): Promise<QuizQuestion | null> {
    const questions = await storage.getQuestionsBySection(sectionId, "published");
    
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
    const answers = question.answers.map((answer, index) => ({
      text: answer.text,
      index
    }));

    // Shuffle answers to prevent pattern memorization
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [answers[i], answers[j]] = [answers[j], answers[i]];
    }

    return {
      id: question.id,
      title: question.title,
      bodyMd: question.bodyMd,
      imageUrl: question.imageUrl,
      answers,
      sectionId: question.sectionId
    };
  }

  async submitAnswer(
    userId: string, 
    questionId: string, 
    selectedIndex: number, 
    timeMs: number,
    mode: "learn" | "review" | "exam" = "learn"
  ): Promise<QuizResult> {
    const question = await storage.getQuestionById(questionId);
    if (!question) {
      throw new Error("Pytanie nie znalezione");
    }

    const correctAnswer = question.answers.find(answer => answer.isCorrect);
    const correctIndex = question.answers.findIndex(answer => answer.isCorrect);
    const isCorrect = selectedIndex === correctIndex;

    // Save attempt
    await storage.createAttempt({
      userId,
      questionId,
      selectedIndex,
      isCorrect,
      timeMs,
      mode
    });

    // Update progress if in learn mode
    if (mode === "learn") {
      await this.updateUserProgress(userId, question.sectionId);
    }

    return {
      isCorrect,
      correctIndex,
      explanation: question.explanationMd,
      timeMs
    };
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

    // Apply spaced repetition algorithm (simplified)
    const reviewQuestions: string[] = [];
    const now = new Date();
    
    questionAttempts.forEach((attempt, questionId) => {
      const daysSinceAttempt = (now.getTime() - attempt.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      // Review after 1 day, then 3 days, then 7 days
      if (daysSinceAttempt >= 1) {
        reviewQuestions.push(questionId);
      }
    });

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
