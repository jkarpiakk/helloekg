import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, json, jsonb, decimal, uuid, index, primaryKey, uniqueIndex, check, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  profession: varchar("profession", { length: 100 }),
  /** Numer prawa wykonywania zawodu: pod przyszłe punkty edukacyjne. Dziś formularz go nie zbiera. */
  pwzNumber: varchar("pwz_number", { length: 20 }),
  role: varchar("role", { length: 50 }).notNull().default("student"),
  /** Tester bety: pełny dostęp do kursu, dopóki płatności są wyłączone (PLATNOSCI_WLACZONE) */
  testerBety: boolean("tester_bety").notNull().default(false),
  locale: varchar("locale", { length: 5 }).notNull().default("pl"),
  emailVerified: boolean("email_verified").notNull().default(false),
  /** Skrót SHA-256 tokenu z linku potwierdzającego (sam token jest tylko w mailu) */
  emailVerificationToken: varchar("email_verification_token", { length: 100 }),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  emailVerifiedAt: timestamp("email_verified_at"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  privacyAccepted: boolean("privacy_accepted").notNull().default(false),
  passwordResetToken: varchar("password_reset_token", { length: 100 }),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  // Pierwsza interakcja z podpowiedzią przycisku „Zgłoś uwagę” (null = jeszcze pokazujemy)
  feedbackHintSeenAt: timestamp("feedback_hint_seen_at"),
  // Zawieszenie konta (null = aktywne). Logowanie i requireAuth odrzucają zawieszonych.
  suspendedAt: timestamp("suspended_at"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Exam sessions (persisted so in-progress exams survive server restarts)
export const examSessions = pgTable("exam_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").unique().notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Subscription plans
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  durationDays: integer("duration_days").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("PLN"),
  stripePriceId: varchar("stripe_price_id", { length: 100 }),
  /** Plan odnawiany w Stripe (subskrypcja): "month" albo "year". Pusty: jednorazowa płatność za durationDays dni */
  interval: varchar("interval", { length: 10 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// User subscriptions/access
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  paymentProvider: varchar("payment_provider", { length: 50 }).notNull(),
  invoiceUrl: text("invoice_url"),
  /** Subskrypcja odnawiana w Stripe (plan z interval): jeden zapis na subskrypcję, odnowienia przesuwają endDate */
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }).unique(),
  /** Sesja Stripe Checkout, z której powstała subskrypcja: jedna sesja = jeden zapis (ponowne użycie nie daje kolejnych dni) */
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }).unique(),
  /** Płatność Stripe (payment_intent) tej subskrypcji: po niej zwrot (charge.refunded) odbiera dostęp */
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** Zdarzenia webhooka Stripe już obsłużone: to samo zdarzenie (event.id) przetwarzamy raz */
export const stripeEvents = pgTable("stripe_events", {
  eventId: varchar("event_id", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 100 }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** Zgody przy rejestracji: który dokument, w jakiej wersji i kiedy zaakceptowany */
export const userConsents = pgTable("user_consents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  document: varchar("document", { length: 50 }).notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().default(sql`now()`),
}, (t) => [index("user_consents_user_idx").on(t.userId)]);

export type UserConsent = typeof userConsents.$inferSelect;

/** Ustawienia zmieniane w panelu admina (np. REJESTRACJA_OTWARTA): klucz → wartość JSON */
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

// Course modules
export const modules = pgTable("modules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  /** Kod sekcji ze studia (S1…S7) — import aktualizuje moduł w miejscu zamiast tworzyć nowy */
  externalId: varchar("external_id", { length: 64 }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
  isVisible: boolean("is_visible").notNull().default(true),
  prerequisiteModuleId: uuid("prerequisite_module_id"),
  /** Podsumowanie modułu (Markdown ze studia, `podsumowanieMd`): otwarcie jest warunkiem ukończenia modułu w szkoleniu */
  summaryMd: text("summary_md"),
  /** Bibliografia modułu (Markdown ze studia, `bibliografiaMd`) */
  bibliographyMd: text("bibliography_md"),
  /** Moduł wchodzi do szkolenia z punktami (studio: `szkolenie`; S1–S7 tak, S8 „EKG na LEK” nie) */
  cme: boolean("cme").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Course sections/subsections within modules
export const sections = pgTable("sections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  /** Id wykładu ze studia (np. S2_01) albo „S1:utrwalajace” — klucz importu bez kasowania postępów */
  externalId: varchar("external_id", { length: 64 }),
  moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
  isVisible: boolean("is_visible").notNull().default(true),
  prerequisiteSectionId: uuid("prerequisite_section_id"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Lecture chapters for each section
export const lectureChapters = pgTable("lecture_chapters", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(),
  contentMd: text("content_md").notNull(),
  analogy: text("analogy"),
  keyPoints: json("key_points").$type<string[]>().default([]),
  visual: varchar("visual", { length: 100 }),
  visualContent: json("visual_content").$type<VisualElement[]>().default([]),
  order: integer("order").notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ======= QUESTION TYPE CONFIGURATIONS =======

// Drag & Drop configuration
export interface DragDropConfig {
  sources: Array<{ id: string; content: string; label?: string; imageUrl?: string }>;
  /**
   * acceptsSourceIds (studio, flaga dd_many): pole jest GRUPĄ, przyjmuje kilka kart naraz.
   * Wtedy każda karta należy do dokładnie jednej grupy (shared/dragDropGrupy.ts).
   */
  targets: Array<{ id: string; label: string; acceptsSourceId: string; acceptsSourceIds?: string[]; imageUrl?: string }>;
  backgroundImageUrl?: string;
  /** Tylko w konfiguracji wysłanej kursantowi: pytanie „do grup” (odpowiedzi usunięte) */
  grupy?: boolean;
}

// Fill-in-the-blank configuration
export interface FillBlankConfig {
  template: string; // Text with {{blank:id}} placeholders
  blanks: Array<{
    id: string;
    position: number; // Position in text where blank appears
    correctAnswers: string[]; // Multiple accepted answers
    validationType: 'exact' | 'regex' | 'numeric_range';
    regex?: string; // For regex validation
    numericRange?: { min: number; max: number }; // For numeric range
    placeholder?: string; // Placeholder text for input
    hint?: string; // Optional hint for the blank
  }>;
}

// Matching pairs configuration
export interface MatchingConfig {
  leftColumn: Array<{ id: string; text: string; imageUrl?: string }>;
  rightColumn: Array<{ id: string; text: string; imageUrl?: string }>;
  correctPairs: Array<{ leftId: string; rightId: string }>;
  shuffleRight: boolean;
}

// Sorting configuration
export interface SortingConfig {
  items: Array<{ id: string; text?: string; content?: string; imageUrl?: string }>;
  correctOrder: string[]; // Array of item IDs in correct order
}

// Hotspot configuration
export interface HotspotConfig {
  imageUrl: string;
  hotspots: Array<{
    id: string;
    label?: string;
    shape: 'rect' | 'circle' | 'polygon';
    coords: number[]; // [x1, y1, x2, y2] for rect, [cx, cy, r] for circle, [x1,y1,...] for polygon
    isCorrect: boolean;
  }>;
  allowMultiple: boolean; // Can user select multiple hotspots?
}

// Media assets for all question types
export interface QuestionMediaAssets {
  promptImage?: string; // Main question image
  answerImages?: Array<{ id: string; url: string; alt?: string }>; // For image-based answers
  backgroundImage?: string; // For drag-drop or hotspot background
  explanationImage?: string; // Image in explanation
}

// Union type for all question configs
export type QuestionConfig = 
  | { type: 'multiple_choice' }
  | { type: 'drag_drop'; config: DragDropConfig }
  | { type: 'fill_blank'; config: FillBlankConfig }
  | { type: 'matching'; config: MatchingConfig }
  | { type: 'sorting'; config: SortingConfig }
  | { type: 'hotspot'; config: HotspotConfig }
  | { type: 'clinical_case'; config: import('./clinicalCase').ClinicalCaseConfig }
  // „Wybierz zapis”: kontrakt i logika w shared/wyborZapisu.ts (kopia ze studia)
  | { type: 'image_choice'; config: import('./wyborZapisu').ImageChoiceConfig };

// Questions
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }),
  bodyMd: text("body_md").notNull(),
  imageUrl: text("image_url"),
  imagePosition: varchar("image_position", { length: 10 }).default("above"), // "above" or "below" text
  answers: json("answers").$type<Array<{ text: string; isCorrect: boolean }>>().notNull(),
  explanationMd: text("explanation_md").notNull(),
  tags: json("tags").$type<string[]>().default([]),
  difficulty: varchar("difficulty", { length: 20 }).notNull().default("medium"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  version: integer("version").notNull().default(1),
  order: integer("order").notNull().default(1),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  // NEW: Question type and configuration for interactive questions
  questionType: varchar("question_type", { length: 30 }).notNull().default("multiple_choice"),
  questionConfig: json("question_config").$type<QuestionConfig>(),
  mediaAssets: json("media_assets").$type<QuestionMediaAssets>(),
  /**
   * Pula pytania (studio: `pula`): "practice" = ćwiczenia (nauka, powtórka, egzamin próbny, opanowanie),
   * "test" = tylko test zaliczeniowy szkolenia z punktami; nigdy nie trafia do ćwiczeń ani statystyk.
   */
  pool: varchar("pool", { length: 10 }).notNull().default("practice"),
  /** Odpowiedzi w zapisanej kolejności (studio: `bezTasowania`), także w teście */
  noShuffle: boolean("no_shuffle").notNull().default(false),
  /** Pytania (externalId studia), z którymi to pytanie nie może wystąpić w jednym losowaniu testu */
  excludes: jsonb("excludes").$type<string[]>().notNull().default([]),
}, (t) => [
  // migracja 2026-11-11-punkty.sql (tu, żeby drizzle-kit push ich nie usuwał)
  check("questions_pool_check", sql`${t.pool} IN ('practice', 'test')`),
  index("questions_pool_status_idx").on(t.pool, t.status),
]);

// Answer data types for different question types
export interface MultipleChoiceAnswer {
  type: 'multiple_choice';
  selectedIndex: number;
}

export interface DragDropAnswer {
  type: 'drag_drop';
  placements: Array<{ sourceId: string; targetId: string }>;
}

export interface FillBlankAnswer {
  type: 'fill_blank';
  filledBlanks: Array<{ blankId: string; value: string }>;
}

export interface MatchingAnswer {
  type: 'matching';
  pairs: Array<{ leftId: string; rightId: string }>;
}

export interface SortingAnswer {
  type: 'sorting';
  order: string[]; // Item IDs in user's order
}

export interface HotspotAnswer {
  type: 'hotspot';
  clickedHotspots: string[]; // IDs of clicked hotspots
  clickCoordinates?: { x: number; y: number }[]; // Actual click positions
  clickedOutside?: boolean; // Whether user clicked outside any hotspot area
}

export type AnswerData = 
  | MultipleChoiceAnswer
  | DragDropAnswer
  | FillBlankAnswer
  | MatchingAnswer
  | SortingAnswer
  | HotspotAnswer
  | import('./wyborZapisu').ImageChoiceAnswer;

// User attempts on questions
export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  selectedIndex: integer("selected_index").notNull(), // Keep for backward compatibility with ABCD
  isCorrect: boolean("is_correct").notNull(),
  timeMs: integer("time_ms").notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("learn"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  // NEW: Structured answer data for all question types
  answerData: json("answer_data").$type<AnswerData>(),
  partialScore: decimal("partial_score", { precision: 5, scale: 2 }), // For questions with partial scoring (matching, fill-blank)
});

// User progress per section
export const progress = pgTable("progress", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  completionPercentage: decimal("completion_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  lastActivity: timestamp("last_activity").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Miejsce w wykładzie: ostatnio otwarty rozdział per użytkownik i sekcja (wznowienie czytania)
export const lectureReads = pgTable("lecture_reads", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  /** Numer rozdziału od 1 (jak w adresie #rozdzial-N) */
  chapterOrder: integer("chapter_order").notNull(),
  chaptersTotal: integer("chapters_total").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
}, (t) => [primaryKey({ columns: [t.userId, t.sectionId] })]);

export type LectureRead = typeof lectureReads.$inferSelect;

// Certificates
export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  certificateId: varchar("certificate_id", { length: 50 }).notNull().unique(),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  pdfUrl: text("pdf_url"),
  issuedAt: timestamp("issued_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: timestamp("expires_at"),
  isValid: boolean("is_valid").notNull().default(true),
});

// Support tickets
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  userName: varchar("user_name", { length: 200 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  priority: varchar("priority", { length: 20 }).notNull().default("medium"),
  questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
  adminResponse: text("admin_response"),
  adminUserId: uuid("admin_user_id").references(() => users.id, { onDelete: "set null" }),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  // Zgłoszenia testerów (beta): kind = support | question | feedback.
  // Dla kind = feedback: status nowe/w_analizie/wdrozone/odrzucone, priority P0–P2 (albo "medium" = brak),
  // adminResponse = notatka zespołu widoczna dla zgłaszającego.
  kind: varchar("kind", { length: 20 }).notNull().default("support"),
  area: varchar("area", { length: 20 }),
  feedbackType: varchar("feedback_type", { length: 20 }),
  pagePath: text("page_path"),
  context: jsonb("context").$type<FeedbackContext>(),
  attachments: jsonb("attachments").$type<FeedbackAttachmentMeta[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("support_tickets_kind_created_idx").on(t.kind, t.createdAt)]);

export type FeedbackContext = {
  userAgent?: string;
  viewport?: string;
  appVersion?: string;
  sectionId?: string;
  questionId?: string;
};

export type FeedbackAttachmentMeta = {
  file: string; // nazwa pliku na dysku (generowana), w katalogu zgłoszenia
  mime: "image/png" | "image/jpeg" | "image/webp";
  size: number;
  name: string; // oryginalna nazwa (tylko do wyświetlenia)
};

// Audit log for tracking changes
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // Nullable + SET NULL: usunięcie konta nie jest blokowane, wpisy audytu zostają (bez aktora)
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  diff: json("diff"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Blog posts
export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  title: varchar("title", { length: 300 }).notNull(),
  excerpt: text("excerpt").notNull(),
  contentMd: text("content_md").notNull(),
  featuredImage: text("featured_image"),
  tags: json("tags").$type<string[]>().default([]),
  seoMeta: json("seo_meta").$type<{title?: string, description?: string, keywords?: string[]}>().default({}),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  subscriptions: many(subscriptions),
  attempts: many(attempts),
  progress: many(progress),
  certificates: many(certificates),
  supportTickets: many(supportTickets),
  createdQuestions: many(questions, { relationName: "createdBy" }),
  reviewedQuestions: many(questions, { relationName: "reviewedBy" }),
  auditLogs: many(auditLog),
  createdBlogPosts: many(blogPosts),
  stats: one(userStats),
  dailyActivities: many(dailyActivities),
  achievements: many(userAchievements),
  streakFreezes: many(streakFreezeLog),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));

export const modulesRelations = relations(modules, ({ many, one }) => ({
  sections: many(sections),
  prerequisiteModule: one(modules, { fields: [modules.prerequisiteModuleId], references: [modules.id] }),
}));

export const sectionsRelations = relations(sections, ({ many, one }) => ({
  module: one(modules, { fields: [sections.moduleId], references: [modules.id] }),
  questions: many(questions),
  progress: many(progress),
  prerequisiteSection: one(sections, { fields: [sections.prerequisiteSectionId], references: [sections.id] }),
  lectureChapters: many(lectureChapters),
}));

export const lectureChaptersRelations = relations(lectureChapters, ({ one }) => ({
  section: one(sections, { fields: [lectureChapters.sectionId], references: [sections.id] }),
  creator: one(users, { fields: [lectureChapters.createdBy], references: [users.id] }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  section: one(sections, { fields: [questions.sectionId], references: [sections.id] }),
  creator: one(users, { fields: [questions.createdBy], references: [users.id], relationName: "createdBy" }),
  reviewer: one(users, { fields: [questions.reviewedBy], references: [users.id], relationName: "reviewedBy" }),
  attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  user: one(users, { fields: [attempts.userId], references: [users.id] }),
  question: one(questions, { fields: [attempts.questionId], references: [questions.id] }),
}));

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(users, { fields: [progress.userId], references: [users.id] }),
  section: one(sections, { fields: [progress.sectionId], references: [sections.id] }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  assignee: one(users, { fields: [supportTickets.assignedTo], references: [users.id] }),
  question: one(questions, { fields: [supportTickets.questionId], references: [questions.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, { fields: [blogPosts.authorId], references: [users.id] }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
});

export const insertPlanSchema = createInsertSchema(plans).omit({ 
  id: true, 
  createdAt: true 
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ 
  id: true, 
  createdAt: true 
});

export const insertModuleSchema = createInsertSchema(modules).omit({ 
  id: true, 
  createdAt: true 
});

export const insertSectionSchema = createInsertSchema(sections).omit({ 
  id: true, 
  createdAt: true 
});

export const insertQuestionSchema = createInsertSchema(questions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  version: true,
  reviewedBy: true,
  reviewedAt: true,
});

export const insertAttemptSchema = createInsertSchema(attempts).omit({ 
  id: true, 
  createdAt: true 
});

export const insertProgressSchema = createInsertSchema(progress).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({ 
  id: true, 
  issuedAt: true 
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets, {
  context: () => z.custom<FeedbackContext>().nullable().optional(),
  attachments: () => z.custom<FeedbackAttachmentMeta[]>().optional(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ 
  id: true, 
  createdAt: true 
});

export const insertLectureChapterSchema = createInsertSchema(lectureChapters).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Module = typeof modules.$inferSelect;
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Section = typeof sections.$inferSelect;
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Attempt = typeof attempts.$inferSelect;
export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type Progress = typeof progress.$inferSelect;
export type InsertProgress = z.infer<typeof insertProgressSchema>;
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
// Visual Editor Types
export interface VisualElement {
  id: string;
  type: 'text' | 'image' | 'heading';
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
}

export type LectureChapter = typeof lectureChapters.$inferSelect;
export type InsertLectureChapter = z.infer<typeof insertLectureChapterSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

// Demo question for homepage - supports all 6 question types
export const demoQuestions = pgTable("demo_questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title"), // Optional title/header for the question
  question: text("question").notNull(),
  // For multiple_choice type - legacy fields for backward compatibility
  options: json("options").$type<string[]>().default([]),
  correctIndex: integer("correct_index").default(0),
  explanation: text("explanation").notNull(),
  imageUrl: text("image_url"),
  imagePosition: varchar("image_position", { length: 10 }).default("above"), // "above" or "below" text
  // New fields for all question types
  questionType: varchar("question_type", { length: 50 }).notNull().default("multiple_choice"),
  questionConfig: json("question_config").$type<QuestionConfig>(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertDemoQuestionSchema = createInsertSchema(demoQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DemoQuestion = typeof demoQuestions.$inferSelect;
export type InsertDemoQuestion = z.infer<typeof insertDemoQuestionSchema>;

// Home page content - editable texts
export const homePageContent = pgTable("home_page_content", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  section: varchar("section", { length: 100 }).notNull(), // hero, how-it-works, course-content, etc.
  description: text("description"), // helper text for admins
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertHomePageContentSchema = createInsertSchema(homePageContent).omit({
  id: true,
  updatedAt: true,
});

export type HomePageContent = typeof homePageContent.$inferSelect;
export type InsertHomePageContent = z.infer<typeof insertHomePageContentSchema>;

// ======= GAMIFICATION TABLES =======

// User statistics for gamification
export const userStats = pgTable("user_stats", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: timestamp("last_activity_date"),
  streakFreezes: integer("streak_freezes").notNull().default(2), // liczba dostępnych "zamrożeń" serii
  totalQuestionsAnswered: integer("total_questions_answered").notNull().default(0),
  correctAnswers: integer("correct_answers").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Daily activity tracking for heatmap
export const dailyActivities = pgTable("daily_activities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityDate: timestamp("activity_date").notNull(), // data aktywności (bez czasu)
  questionsAnswered: integer("questions_answered").notNull().default(0),
  xpEarned: integer("xp_earned").notNull().default(0),
  timeSpentMinutes: integer("time_spent_minutes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Achievement definitions
export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(), // np. "streak_7", "perfectionist"
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(), // streak, accuracy, speed, volume
  icon: varchar("icon", { length: 100 }).notNull(), // ikona emoji lub nazwa lucide
  condition: json("condition").$type<{
    type: 'streak' | 'accuracy' | 'total_questions' | 'speed' | 'category_mastery';
    threshold: number;
    category?: string; // dla category_mastery
  }>().notNull(),
  xpReward: integer("xp_reward").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// User unlocked achievements
export const userAchievements = pgTable("user_achievements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: uuid("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Streak freeze usage log
export const streakFreezeLog = pgTable("streak_freeze_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  usedDate: timestamp("used_date").notNull().default(sql`CURRENT_TIMESTAMP`),
  daysSaved: integer("days_saved").notNull().default(1),
});

// ======= GAMIFICATION RELATIONS =======

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, { fields: [userStats.userId], references: [users.id] }),
}));

export const dailyActivitiesRelations = relations(dailyActivities, ({ one }) => ({
  user: one(users, { fields: [dailyActivities.userId], references: [users.id] }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  achievement: one(achievements, { fields: [userAchievements.achievementId], references: [achievements.id] }),
}));

export const streakFreezeLogRelations = relations(streakFreezeLog, ({ one }) => ({
  user: one(users, { fields: [streakFreezeLog.userId], references: [users.id] }),
}));

// ======= GAMIFICATION SCHEMAS =======

export const insertUserStatsSchema = createInsertSchema(userStats).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertDailyActivitySchema = createInsertSchema(dailyActivities).omit({ 
  id: true, 
  createdAt: true 
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({ 
  id: true, 
  createdAt: true 
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({ 
  id: true, 
  unlockedAt: true 
});

export const insertStreakFreezeLogSchema = createInsertSchema(streakFreezeLog).omit({ 
  id: true, 
  usedDate: true 
});

// ======= GAMIFICATION TYPES =======

export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type DailyActivity = typeof dailyActivities.$inferSelect;
export type InsertDailyActivity = z.infer<typeof insertDailyActivitySchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type StreakFreezeLog = typeof streakFreezeLog.$inferSelect;
export type InsertStreakFreezeLog = z.infer<typeof insertStreakFreezeLogSchema>;

// Additional schemas for API endpoints
// Hasło: co najmniej 10 znaków. Górny limit tylko chroni serwer przed kosztownymi żądaniami;
// argon2id liczy skrót z całego hasła (bcrypt czytał tylko 72 bajty, stare skróty bcrypt zostają do pierwszego logowania).
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 1024;
const nowyHaslo = z.string()
  .min(PASSWORD_MIN_LENGTH, `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków`)
  .max(PASSWORD_MAX_LENGTH, `Hasło może mieć najwyżej ${PASSWORD_MAX_LENGTH} znaków`);

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  // przy logowaniu bez dolnego progu: konta sprzed 10.11.2026 mogą mieć hasło 8-znakowe
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

/** Wersje dokumentów, które akceptuje się przy rejestracji (zapis w user_consents) */
export const DOKUMENTY = {
  regulamin_bety: { wersja: "1.0", tytul: "Regulamin bety" },
  polityka_prywatnosci: { wersja: "1.0", tytul: "Polityka prywatności" },
} as const;
export type DokumentId = keyof typeof DOKUMENTY;

export const registerSchema = z.object({
  email: z.string().trim().email("Podaj prawidłowy adres e-mail").max(255),
  password: nowyHaslo,
  confirmPassword: z.string().max(PASSWORD_MAX_LENGTH),
  firstName: z.string().trim().min(1, "Podaj imię").max(60, "Imię jest za długie")
    .regex(/^[\p{L}][\p{L}\p{M} '’-]*$/u, "Sprawdź imię: tylko litery, spacja albo łącznik"),
  termsAccepted: z.literal(true, { message: "Zaakceptuj regulamin bety" }),
  privacyAccepted: z.literal(true, { message: "Zaakceptuj politykę prywatności" }),
  /** Pole-pułapka (honeypot): człowiek go nie widzi i nie wypełnia */
  website: z.string().max(500).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła nie pasują do siebie",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: nowyHaslo,
  confirmPassword: z.string().max(PASSWORD_MAX_LENGTH),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła nie pasują do siebie",
  path: ["confirmPassword"],
});

// ======= SZKOLENIE Z PUNKTAMI EDUKACYJNYMI (CME, 11.11.2026) =======
//
// Rejestr uczestnictwa zostaje 5 lat po usunięciu konta: żadna z tabel niżej nie kasuje się kaskadowo
// z kontem. `user_id` dostaje NULL (ON DELETE SET NULL), a `participant_id` (kopia id konta bez klucza
// obcego) dalej łączy zapis, dziennik, podejścia do testu i zaświadczenia jednej osoby.
// Konto bez zapisu na szkolenie: przy usunięciu jego ślady w tych tabelach są kasowane (usunKontoZDanymi).

/** Dokumenty kursu ze studia (np. "program": Program szkolenia z program.json) */
export const courseDocuments = pgTable("course_documents", {
  key: varchar("key", { length: 50 }).primaryKey(),
  contentMd: text("content_md"),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** Reguły punktów per zawód (edytowalne w panelu): kopia reguły trafia do zaświadczenia w chwili wydania */
export const cmeRules = pgTable("cme_rules", {
  profession: varchar("profession", { length: 30 }).primaryKey(),
  active: boolean("active").notNull().default(false),
  legalBasis: text("legal_basis"),
  /** Opis sposobu liczenia (do zaświadczenia i panelu), np. „1 punkt za 1 godzinę szkolenia” */
  pointsFormula: text("points_formula"),
  pointsPerHour: decimal("points_per_hour", { precision: 6, scale: 2 }).notNull().default("0"),
  maxPoints: decimal("max_points", { precision: 6, scale: 2 }),
  minHours: decimal("min_hours", { precision: 6, scale: 2 }),
  testRequired: boolean("test_required").notNull().default(true),
  /**
   * Lekarze: reguła działa dopiero z kompletem: uchwała NRL, numer wpisu do rejestru ORL
   * (RR-NNNNNN-00X-ZZZZ) i data przyjęcia „Informacji o formie kształcenia”
   */
  registryRequired: boolean("registry_required").notNull().default(false),
  /** Numer wpisu do rejestru podmiotów prowadzących kształcenie (format RR-NNNNNN-00X-ZZZZ) */
  registryNumber: varchar("registry_number", { length: 200 }),
  nrlResolution: varchar("nrl_resolution", { length: 200 }),
  formInfoAcceptedAt: varchar("form_info_accepted_at", { length: 10 }),
  /** Pielęgniarki i położne: numer decyzji NRPiP */
  decisionNumber: varchar("decision_number", { length: 200 }),
  /** "godziny" = liczone z godzin (ratownik), "decyzja" = punkty przyznane w uchwale / decyzji (lekarz, pielęgniarka) */
  pointsMode: varchar("points_mode", { length: 12 }).notNull().default("godziny"),
  pointsGranted: decimal("points_granted", { precision: 6, scale: 2 }),
  /** Forma kształcenia słowami przepisu (na zaświadczeniu); pusta = ustawienie cme_forma */
  formText: text("form_text"),
  /** Komunikat na zaświadczeniu bez punktów: dlaczego reguła nie działa */
  inactiveReason: text("inactive_reason"),
  /** Data uchwały NRL (lekarze): razem z datą przyjęcia informacji o formie wyznacza domyślny początek obowiązywania */
  nrlResolutionAt: date("nrl_resolution_at", { mode: "string" }),
  /**
   * Okres obowiązywania reguły (włącznie, dni w strefie Polski). Punkty tylko wtedy, gdy całe szkolenie
   * (zapis i zaliczenie testu z dziennika) mieści się w tym okresie; bez daty „od” reguła nie daje punktów.
   */
  obowiazujeOd: date("obowiazuje_od", { mode: "string" }),
  obowiazujeDo: date("obowiazuje_do", { mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => [
  check("cme_rules_obowiazuje_check", sql`${t.obowiazujeDo} IS NULL OR ${t.obowiazujeOd} IS NULL OR ${t.obowiazujeDo} >= ${t.obowiazujeOd}`),
  check("cme_rules_points_mode_check", sql`${t.pointsMode} IN ('godziny', 'decyzja')`),
]);

/** Kto wykonał czynność (kopia z chwili zdarzenia: konto admina może później zniknąć) */
export type KopiaWykonawcy = { id: string; email: string; imie: string | null; rola: string };

/** Zapis na szkolenie: jeden wiersz na osobę i zawód (kilka zawodów naraz = kilka wierszy) */
export const cmeEnrollments = pgTable("cme_enrollments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  participantId: uuid("participant_id").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  profession: varchar("profession", { length: 30 }).notNull(),
  pwz: varchar("pwz", { length: 20 }),
  /** Ostrzeżenie walidacji PWZ w chwili zapisu (null = numer wygląda poprawnie albo nie jest wymagany) */
  pwzWarning: text("pwz_warning"),
  specialization: varchar("specialization", { length: 200 }),
  /** Lekarze (opcjonalnie): okręgowa izba lekarska, do raportu dla izby */
  chamber: varchar("chamber", { length: 100 }),
  /** Zespół wpisał PWZ z pominięciem walidacji formatu (np. PWZ warunkowe), wpis w dzienniku */
  pwzOverride: boolean("pwz_override").notNull().default(false),
  /** PWZ sprawdzony ręcznie w publicznym rejestrze NIL / NIPiP (kto i kiedy): warunek zaświadczenia z punktami */
  pwzVerifiedAt: timestamp("pwz_verified_at", { withTimezone: true }),
  pwzVerifiedBy: uuid("pwz_verified_by").references(() => users.id, { onDelete: "set null" }),
  /** Kopia danych sprawdzającego (e-mail, imię, rola): zostaje po usunięciu jego konta */
  pwzVerifiedBySnapshot: jsonb("pwz_verified_by_snapshot").$type<KopiaWykonawcy>(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  /** Treść oświadczenia o prawdziwości danych w brzmieniu z chwili zapisu */
  declarationText: text("declaration_text").notNull(),
  declarationAt: timestamp("declaration_at", { withTimezone: true }).notNull(),
  /** Wersja regulaminu szkolenia zaakceptowana przy zapisie (null, gdy regulamin nie był opublikowany) */
  termsVersion: varchar("terms_version", { length: 20 }),
  /** Po pierwszym zaświadczeniu dane są zablokowane; zmienia je tylko admin (wpis w dzienniku) */
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
}, (t) => [
  index("cme_enrollments_participant_idx").on(t.participantId),
  index("cme_enrollments_user_idx").on(t.userId),
  uniqueIndex("cme_enrollments_participant_profession_uq").on(t.participantId, t.profession),
]);

/** Dziennik szkolenia (UTC): zapis, wykłady, moduły, test, ankieta, zaświadczenia, zmiany admina */
export const cmeLog = pgTable("cme_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 40 }).notNull(),
  participantId: uuid("participant_id").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  enrollmentId: uuid("enrollment_id").references(() => cmeEnrollments.id),
  /** Kto wykonał zmianę, gdy to nie uczestnik (admin) */
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  /** Kopia danych wykonawcy (e-mail, imię, rola) z chwili zdarzenia */
  actorSnapshot: jsonb("actor_snapshot").$type<KopiaWykonawcy>(),
  at: timestamp("at", { withTimezone: true }).notNull().default(sql`now()`),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index("cme_log_participant_idx").on(t.participantId, t.at), index("cme_log_type_idx").on(t.type, t.at)]);

/**
 * Wykład w szkoleniu: pierwsze otwarcie i ukończenie (każdy rozdział otwarty). Bez klucza obcego do sekcji
 * (usunięcie albo ponowny import treści nie kasuje rejestru); kopia identyfikatora i tytułu wykładu oraz modułu.
 */
export const cmeLectureProgress = pgTable("cme_lecture_progress", {
  participantId: uuid("participant_id").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  sectionId: uuid("section_id").notNull(),
  lectureExternalId: varchar("lecture_external_id", { length: 64 }),
  lectureTitle: varchar("lecture_title", { length: 200 }),
  moduleId: uuid("module_id"),
  moduleExternalId: varchar("module_external_id", { length: 64 }),
  firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }).notNull().default(sql`now()`),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.participantId, t.sectionId] })]);

/** Rozdział wykładu otwarty pierwszy raz (dowód przejścia przez wykład; bez pomiaru czasu) */
export const cmeChapterProgress = pgTable("cme_chapter_progress", {
  participantId: uuid("participant_id").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  sectionId: uuid("section_id").notNull(),
  lectureExternalId: varchar("lecture_external_id", { length: 64 }),
  /** Numer rozdziału od 1 (kolejność opublikowanych rozdziałów, jak #rozdzial-N) */
  chapterOrder: integer("chapter_order").notNull(),
  firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }).notNull().default(sql`now()`),
}, (t) => [primaryKey({ columns: [t.participantId, t.sectionId, t.chapterOrder] })]);

/** Moduł w szkoleniu: otwarcie podsumowania i ukończenie (raz ukończony zostaje ukończony). Bez klucza obcego do modułu. */
export const cmeModuleProgress = pgTable("cme_module_progress", {
  participantId: uuid("participant_id").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  moduleId: uuid("module_id").notNull(),
  moduleExternalId: varchar("module_external_id", { length: 64 }),
  moduleTitle: varchar("module_title", { length: 200 }),
  summaryOpenedAt: timestamp("summary_opened_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.participantId, t.moduleId] })]);

export type OdpowiedzTestu = { questionId: string; answerIndex: number };
export type OcenaPytaniaTestu = { questionId: string; externalId: string | null; chosen: number | null; correct: number[]; ok: boolean };

/** Podejście do testu zaliczeniowego: wylosowane pytania, kolejność odpowiedzi, odpowiedzi po indeksie, wynik */
export const cmeTestAttempts = pgTable("cme_test_attempts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  participantId: uuid("participant_id").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().default(sql`now()`),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  /** Termin oddania (start + test_limit_minut); po nim i krótkim zapasie podejście oddaje się samo */
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),
  /** Oddane automatycznie po czasie (ocenione odpowiedzi zapisane przed terminem) */
  autoSubmitted: boolean("auto_submitted").notNull().default(false),
  /** Pytania w kolejności pokazanej kursantowi */
  questionIds: jsonb("question_ids").$type<string[]>().notNull(),
  /** Kolejność odpowiedzi per pytanie (indeksy z bazy w kolejności na ekranie) */
  answerOrders: jsonb("answer_orders").$type<Record<string, number[]>>().notNull().default({}),
  /** Wybrana odpowiedź per pytanie: indeks odpowiedzi w bazie (stały identyfikator odpowiedzi) */
  answers: jsonb("answers").$type<Record<string, number>>().notNull().default({}),
  /** Ocena per pytanie w chwili oddania (kopia, żeby wynik nie zależał od późniejszych zmian pytań) */
  grading: jsonb("grading").$type<OcenaPytaniaTestu[]>(),
  score: integer("score"),
  maxScore: integer("max_score"),
  percent: decimal("percent", { precision: 5, scale: 2 }),
  passed: boolean("passed"),
  /** Próg i liczby z konfiguracji w chwili rozpoczęcia */
  rules: jsonb("rules").$type<Record<string, unknown>>().notNull().default({}),
  /**
   * Kopia wylosowanych pytań z chwili startu (treść, odpowiedzi, klucz, uzasadnienie, moduł): ocena i wgląd
   * liczą się z niej, więc późniejsza edycja albo usunięcie pytania nie zmienia wyniku ani dowodu.
   */
  questionSnapshot: jsonb("question_snapshot").$type<Record<string, {
    externalId: string | null; sectionId: string | null; moduleId: string | null; modul: string | null; modulTytul: string | null; modulKolejnosc: number | null;
    title: string | null; bodyMd: string; imageUrl: string | null; answers: Array<{ text: string; isCorrect: boolean }>; explanationMd: string;
  }>>(),
}, (t) => [
  index("cme_test_attempts_participant_idx").on(t.participantId, t.startedAt),
  // najwyżej jedno niedokończone podejście na osobę
  uniqueIndex("cme_test_attempts_open_uq").on(t.participantId).where(sql`submitted_at IS NULL`),
]);

/**
 * Ankieta ewaluacyjna: ANONIMOWA. Celowo bez user_id/participant_id i bez dokładnej godziny
 * (tylko miesiąc), żeby nie dało się jej połączyć z dziennikiem. Dziennik ma tylko „ankieta wypełniona”.
 */
export const cmeSurveyResponses = pgTable("cme_survey_responses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  month: varchar("month", { length: 7 }).notNull(),
  surveyVersion: varchar("survey_version", { length: 20 }).notNull(),
  answers: jsonb("answers").$type<Record<string, string | number | boolean | null>>().notNull(),
});

/** Zaświadczenia szkolenia z punktami: kolejny numer, kopia danych i reguły z chwili wydania */
export const cmeCertificates = pgTable("cme_certificates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  /** Numer do odczytu (HE-RRRR-NNNNNN, kolejny): na PDF, w panelu i liście obecności; publicznie nic po nim nie znajdziesz */
  number: varchar("number", { length: 30 }).notNull().unique(),
  /** Losowy klucz weryfikacji (128 bitów, base64url): jedyna droga do publicznej strony /zaswiadczenie/<klucz> i kodu QR */
  verificationToken: varchar("verification_token", { length: 64 }).notNull().unique(),
  participantId: uuid("participant_id").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  enrollmentId: uuid("enrollment_id").notNull().references(() => cmeEnrollments.id),
  profession: varchar("profession", { length: 30 }).notNull(),
  /** "punkty" = z punktami edukacyjnymi, "ukonczenie" = ukończenie bez punktów (najwyżej jedno ważne każdego rodzaju na zawód) */
  kind: varchar("kind", { length: 12 }).notNull().default("punkty"),
  /** Dane uczestnika, szkolenia i organizatora z chwili wydania */
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  /** Reguła punktów z chwili wydania */
  ruleSnapshot: jsonb("rule_snapshot").$type<Record<string, unknown>>().notNull(),
  points: decimal("points", { precision: 6, scale: 2 }),
  hours: decimal("hours", { precision: 6, scale: 2 }).notNull(),
  testAttemptId: uuid("test_attempt_id").references(() => cmeTestAttempts.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().default(sql`now()`),
  valid: boolean("valid").notNull().default(true),
  invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  invalidatedReason: text("invalidated_reason"),
}, (t) => [
  index("cme_certificates_participant_idx").on(t.participantId),
  // najwyżej jedno ważne zaświadczenie każdego rodzaju na osobę i zawód
  uniqueIndex("cme_certificates_valid_kind_uq").on(t.participantId, t.profession, t.kind).where(sql`valid`),
  check("cme_certificates_kind_check", sql`${t.kind} IN ('punkty', 'ukonczenie')`),
]);

/** Licznik numerów zaświadczeń per rok (bez dziur, w transakcji wydania) */
export const cmeCertificateCounters = pgTable("cme_certificate_counters", {
  year: integer("year").primaryKey(),
  last: integer("last").notNull().default(0),
});

export type CourseDocument = typeof courseDocuments.$inferSelect;
export type CmeRule = typeof cmeRules.$inferSelect;
export type CmeEnrollment = typeof cmeEnrollments.$inferSelect;
export type CmeLogEntry = typeof cmeLog.$inferSelect;
export type CmeTestAttempt = typeof cmeTestAttempts.$inferSelect;
export type CmeCertificate = typeof cmeCertificates.$inferSelect;
