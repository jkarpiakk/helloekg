// Import and re-export types from shared schema
import type {
  User,
  Plan,
  Subscription,
  Section,
  Question,
  Attempt,
  Progress,
  Certificate,
  SupportTicket,
  AuditLog,
  BlogPost,
  InsertBlogPost,
  // New question type configs
  DragDropConfig,
  FillBlankConfig,
  MatchingConfig,
  SortingConfig,
  HotspotConfig,
  QuestionConfig,
  QuestionMediaAssets,
  // Answer data types
  AnswerData,
  MultipleChoiceAnswer,
  DragDropAnswer,
  FillBlankAnswer,
  MatchingAnswer,
  SortingAnswer,
  HotspotAnswer,
} from "@shared/schema";

export type {
  User,
  Plan,
  Subscription,
  Section,
  Question,
  Attempt,
  Progress,
  Certificate,
  SupportTicket,
  AuditLog,
  BlogPost,
  InsertBlogPost,
  // New question type configs
  DragDropConfig,
  FillBlankConfig,
  MatchingConfig,
  SortingConfig,
  HotspotConfig,
  QuestionConfig,
  QuestionMediaAssets,
  // Answer data types
  AnswerData,
  MultipleChoiceAnswer,
  DragDropAnswer,
  FillBlankAnswer,
  MatchingAnswer,
  SortingAnswer,
  HotspotAnswer,
};

// Question type literal type
export type QuestionType = 'multiple_choice' | 'drag_drop' | 'fill_blank' | 'matching' | 'sorting' | 'hotspot';

// Additional frontend-specific types
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  locale: string;
}

export interface QuizQuestion {
  id: string;
  title: string;
  bodyMd: string;
  imageUrl?: string;
  /** Kolejność potasowana; `index` = indeks w bazie — ten wysyłamy jako selectedIndex */
  answers: Array<{ text: string; index: number }>;
  sectionId: string;
  // Bez correctIndex i explanation: ocenia serwer, wynik przychodzi w QuizResult
  // New fields for interactive question types
  questionType: QuestionType;
  questionConfig?: QuestionConfig;
  mediaAssets?: QuestionMediaAssets;
}

export interface QuizResult {
  isCorrect: boolean;
  /** Indeks poprawnej odpowiedzi w bazie — porównuj z `answers[].index` */
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
  partialScore?: number; // 0-1 for partial credit (matching, fill-blank)
  correctAnswer?: AnswerData; // The correct answer for comparison
  feedback?: {
    correctItems?: string[]; // IDs of correctly answered items
    incorrectItems?: string[]; // IDs of incorrectly answered items
  };
  /** Pełna konfiguracja pytania interaktywnego (w pytaniu części z odpowiedzią są wyczyszczone) */
  questionConfig?: QuestionConfig;
}

export interface UserProgress {
  totalAttempts: number;
  successRate: number;
  avgTime: number;
  streak: number;
}

export interface WeakArea {
  tag: string;
  successRate: number;
  questionCount: number;
}

export interface SectionWithProgress extends Section {
  completionPercentage: number;
  lastActivity?: Date;
}

export interface QuestionWithStats extends Question {
  stats: {
    attempts: number;
    successRate: number;
    avgTime: number;
  };
}

export interface CertificateVerification {
  certificate: Certificate;
  user: {
    firstName: string;
    lastName: string;
    profession?: string;
  };
  isValid: boolean;
}

// UI State types
export interface AppState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

export interface QuizState {
  currentQuestion: QuizQuestion | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  mode: 'learn' | 'review' | 'exam';
  selectedAnswer: number | null;
  showExplanation: boolean;
  isSubmitting: boolean;
  startTime: number;
  // New fields for interactive question types
  currentAnswer?: AnswerData; // Current answer state for any question type
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  profession?: string;
  marketingConsent: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

export interface ContactForm {
  name?: string;
  email: string;
  subject: string;
  message: string;
}

// Internationalization
export interface I18nKeys {
  [key: string]: string | I18nKeys;
}

export type Locale = 'pl' | 'en' | 'es';

// Theme
export type ThemeMode = 'light' | 'dark' | 'system';
