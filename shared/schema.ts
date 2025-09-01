import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, json, decimal, uuid } from "drizzle-orm/pg-core";
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
  role: varchar("role", { length: 50 }).notNull().default("student"),
  locale: varchar("locale", { length: 5 }).notNull().default("pl"),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: varchar("email_verification_token", { length: 100 }),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  privacyAccepted: boolean("privacy_accepted").notNull().default(false),
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Subscription plans
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  durationDays: integer("duration_days").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("PLN"),
  stripePriceId: varchar("stripe_price_id", { length: 100 }),
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
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Course modules
export const modules = pgTable("modules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
  prerequisiteModuleId: uuid("prerequisite_module_id").references(() => modules.id),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Course sections/subsections within modules
export const sections = pgTable("sections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
  prerequisiteSectionId: uuid("prerequisite_section_id").references(() => sections.id),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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

// Questions
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(),
  bodyMd: text("body_md").notNull(),
  imageUrl: text("image_url"),
  answers: json("answers").$type<Array<{ text: string; isCorrect: boolean }>>().notNull(),
  explanationMd: text("explanation_md").notNull(),
  tags: json("tags").$type<string[]>().default([]),
  difficulty: varchar("difficulty", { length: 20 }).notNull().default("medium"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// User attempts on questions
export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  selectedIndex: integer("selected_index").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  timeMs: integer("time_ms").notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("learn"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
  adminResponse: text("admin_response"),
  adminUserId: uuid("admin_user_id").references(() => users.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Audit log for tracking changes
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  diff: json("diff"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  attempts: many(attempts),
  progress: many(progress),
  certificates: many(certificates),
  supportTickets: many(supportTickets),
  createdQuestions: many(questions, { relationName: "createdBy" }),
  reviewedQuestions: many(questions, { relationName: "reviewedBy" }),
  auditLogs: many(auditLog),
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
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  emailVerificationToken: true,
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

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ 
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

// Additional schemas for API endpoints
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = insertUserSchema.extend({
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła nie pasują do siebie",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła nie pasują do siebie",
  path: ["confirmPassword"],
});
