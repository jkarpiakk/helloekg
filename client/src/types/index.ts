// Re-export types from shared schema
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
  InsertBlogPost
} from "@shared/schema";

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
  answers: Array<{ text: string; index: number }>;
  sectionId: string;
}

export interface QuizResult {
  isCorrect: boolean;
  correctIndex: number;
  explanation: string;
  timeMs: number;
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
