import { 
  users, plans, subscriptions, sections, questions, attempts, 
  progress, certificates, supportTickets, auditLog,
  type User, type InsertUser, type Plan, type InsertPlan,
  type Subscription, type InsertSubscription, type Section, type InsertSection,
  type Question, type InsertQuestion, type Attempt, type InsertAttempt,
  type Progress, type InsertProgress, type Certificate, type InsertCertificate,
  type SupportTicket, type InsertSupportTicket, type AuditLog, type InsertAuditLog
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, avg, sql } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  
  // Subscription management
  getActivePlans(): Promise<Plan[]>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getUserActiveSubscription(userId: string): Promise<Subscription | undefined>;
  updateSubscriptionStatus(id: string, status: string): Promise<Subscription>;
  
  // Course content
  getSections(): Promise<Section[]>;
  getSectionById(id: string): Promise<Section | undefined>;
  getQuestionsBySection(sectionId: string, status?: string): Promise<Question[]>;
  getQuestionById(id: string): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question>;
  updateQuestionStatus(id: string, status: string, reviewedBy?: string): Promise<Question>;
  
  // Quiz and progress
  createAttempt(attempt: InsertAttempt): Promise<Attempt>;
  getUserAttempts(userId: string, questionId?: string): Promise<Attempt[]>;
  getUserProgress(userId: string): Promise<Progress[]>;
  updateProgress(userId: string, sectionId: string, completionPercentage: number): Promise<Progress>;
  
  // Certificates
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  getCertificateByPublicId(certificateId: string): Promise<Certificate | undefined>;
  getUserCertificates(userId: string): Promise<Certificate[]>;
  
  // Analytics
  getQuestionStatistics(questionId: string): Promise<{ attempts: number; successRate: number; avgTime: number }>;
  getUserStatistics(userId: string): Promise<{ totalAttempts: number; successRate: number; avgTime: number; streak: number }>;
  
  // Support
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTickets(status?: string): Promise<SupportTicket[]>;
  updateSupportTicket(id: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket>;
  
  // Audit logging
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
}

export class DatabaseStorage implements IStorage {
  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStripeInfo(id: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId, stripeSubscriptionId, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Subscription management
  async getActivePlans(): Promise<Plan[]> {
    return db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.durationDays));
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [sub] = await db.insert(subscriptions).values(subscription).returning();
    return sub;
  }

  async getUserActiveSubscription(userId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        sql`${subscriptions.endDate} > CURRENT_TIMESTAMP`
      ))
      .orderBy(desc(subscriptions.endDate));
    return subscription || undefined;
  }

  async updateSubscriptionStatus(id: string, status: string): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ status })
      .where(eq(subscriptions.id, id))
      .returning();
    return subscription;
  }

  // Course content
  async getSections(): Promise<Section[]> {
    return db.select().from(sections).orderBy(asc(sections.order));
  }

  async getSectionById(id: string): Promise<Section | undefined> {
    const [section] = await db.select().from(sections).where(eq(sections.id, id));
    return section || undefined;
  }

  async getQuestionsBySection(sectionId: string, status?: string): Promise<Question[]> {
    if (status) {
      return db.select().from(questions)
        .where(and(eq(questions.sectionId, sectionId), eq(questions.status, status)))
        .orderBy(asc(questions.createdAt));
    }
    
    return db.select().from(questions)
      .where(eq(questions.sectionId, sectionId))
      .orderBy(asc(questions.createdAt));
  }

  async getAllQuestions(status?: string): Promise<Question[]> {
    if (status) {
      return db.select().from(questions)
        .where(eq(questions.status, status))
        .orderBy(asc(questions.createdAt));
    }
    
    return db.select().from(questions)
      .orderBy(asc(questions.createdAt));
  }

  async getQuestionById(id: string): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question || undefined;
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }

  async updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question> {
    const [question] = await db
      .update(questions)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  async updateQuestionStatus(id: string, status: string, reviewedBy?: string): Promise<Question> {
    const updateData: any = { status, updatedAt: sql`CURRENT_TIMESTAMP` };
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
      updateData.reviewedAt = sql`CURRENT_TIMESTAMP`;
    }
    
    const [question] = await db
      .update(questions)
      .set(updateData)
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  // Quiz and progress
  async createAttempt(attempt: InsertAttempt): Promise<Attempt> {
    const [newAttempt] = await db.insert(attempts).values(attempt).returning();
    return newAttempt;
  }

  async getUserAttempts(userId: string, questionId?: string): Promise<Attempt[]> {
    if (questionId) {
      return db.select().from(attempts)
        .where(and(eq(attempts.userId, userId), eq(attempts.questionId, questionId)))
        .orderBy(desc(attempts.createdAt));
    }
    
    return db.select().from(attempts)
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.createdAt));
  }

  async getUserProgress(userId: string): Promise<Progress[]> {
    return db.select().from(progress).where(eq(progress.userId, userId));
  }

  async updateProgress(userId: string, sectionId: string, completionPercentage: number): Promise<Progress> {
    const existing = await db
      .select()
      .from(progress)
      .where(and(eq(progress.userId, userId), eq(progress.sectionId, sectionId)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(progress)
        .set({
          completionPercentage: completionPercentage.toString(),
          lastActivity: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(progress.userId, userId), eq(progress.sectionId, sectionId)))
        .returning();
      return updated;
    } else {
      const [newProgress] = await db
        .insert(progress)
        .values({
          userId,
          sectionId,
          completionPercentage: completionPercentage.toString(),
        })
        .returning();
      return newProgress;
    }
  }

  // Certificates
  async createCertificate(certificate: InsertCertificate): Promise<Certificate> {
    const [newCertificate] = await db.insert(certificates).values(certificate).returning();
    return newCertificate;
  }

  async getCertificateByPublicId(certificateId: string): Promise<Certificate | undefined> {
    const [certificate] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.certificateId, certificateId));
    return certificate || undefined;
  }

  async getUserCertificates(userId: string): Promise<Certificate[]> {
    return db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
  }

  // Analytics
  async getQuestionStatistics(questionId: string): Promise<{ attempts: number; successRate: number; avgTime: number }> {
    const [stats] = await db
      .select({
        attempts: count(),
        successRate: avg(sql`CASE WHEN ${attempts.isCorrect} THEN 1.0 ELSE 0.0 END`),
        avgTime: avg(attempts.timeMs)
      })
      .from(attempts)
      .where(eq(attempts.questionId, questionId));

    return {
      attempts: stats.attempts || 0,
      successRate: parseFloat(stats.successRate as string) || 0,
      avgTime: parseFloat(stats.avgTime as string) || 0
    };
  }

  async getUserStatistics(userId: string): Promise<{ totalAttempts: number; successRate: number; avgTime: number; streak: number }> {
    const [stats] = await db
      .select({
        totalAttempts: count(),
        successRate: avg(sql`CASE WHEN ${attempts.isCorrect} THEN 1.0 ELSE 0.0 END`),
        avgTime: avg(attempts.timeMs)
      })
      .from(attempts)
      .where(eq(attempts.userId, userId));

    // Calculate streak (simplified - would need more complex query for actual implementation)
    const recentAttempts = await db
      .select()
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.createdAt))
      .limit(20);

    let streak = 0;
    for (const attempt of recentAttempts) {
      if (attempt.isCorrect) {
        streak++;
      } else {
        break;
      }
    }

    return {
      totalAttempts: stats.totalAttempts || 0,
      successRate: parseFloat(stats.successRate as string) || 0,
      avgTime: parseFloat(stats.avgTime as string) || 0,
      streak
    };
  }

  // Support
  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const [newTicket] = await db.insert(supportTickets).values(ticket).returning();
    return newTicket;
  }

  async getSupportTickets(status?: string): Promise<SupportTicket[]> {
    const query = db.select().from(supportTickets);
    
    if (status) {
      query.where(eq(supportTickets.status, status));
    }
    
    return query.orderBy(desc(supportTickets.createdAt));
  }

  async updateSupportTicket(id: string, updates: Partial<InsertSupportTicket>): Promise<SupportTicket> {
    const [ticket] = await db
      .update(supportTickets)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(supportTickets.id, id))
      .returning();
    return ticket;
  }

  // Audit logging
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLog).values(log).returning();
    return newLog;
  }
}

export const storage = new DatabaseStorage();
