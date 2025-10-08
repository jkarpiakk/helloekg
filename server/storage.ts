import { 
  users, plans, subscriptions, modules, sections, questions, attempts, 
  progress, certificates, supportTickets, auditLog, blogPosts, demoQuestions,
  type User, type InsertUser, type Plan, type InsertPlan,
  type Subscription, type InsertSubscription, type Module, type InsertModule,
  type Section, type InsertSection, type Question, type InsertQuestion, 
  type Attempt, type InsertAttempt, type Progress, type InsertProgress, 
  type Certificate, type InsertCertificate, type SupportTicket, type InsertSupportTicket, 
  type AuditLog, type InsertAuditLog, type BlogPost, type InsertBlogPost,
  type DemoQuestion, type InsertDemoQuestion
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, avg, sql, or, ilike, isNull } from "drizzle-orm";

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
  getModules(): Promise<Module[]>;
  getModulesWithSections(): Promise<(Module & { sections: Section[] })[]>;
  getModuleById(id: string): Promise<Module | undefined>;
  createModule(module: InsertModule): Promise<Module>;
  updateModule(id: string, updates: Partial<InsertModule>): Promise<Module>;
  deleteModule(id: string): Promise<void>;
  reorderModules(moduleIds: string[]): Promise<void>;
  getSections(): Promise<Section[]>;
  getSectionsByModule(moduleId: string): Promise<Section[]>;
  getSectionById(id: string): Promise<Section | undefined>;
  createSection(section: InsertSection): Promise<Section>;
  updateSection(id: string, updates: Partial<InsertSection>): Promise<Section>;
  deleteSection(id: string): Promise<void>;
  reorderSections(sectionIds: string[], moduleId: string): Promise<void>;
  getQuestionsBySection(sectionId: string, status?: string): Promise<Question[]>;
  getQuestionById(id: string): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  createQuestionsBulk(questions: InsertQuestion[]): Promise<{ summary: { total: number; created: number; failed: number }; results: Array<{ index: number; status: 'created' | 'failed'; id?: string; errors?: string[] }> }>;
  updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question>;
  updateQuestionStatus(id: string, status: string, reviewedBy?: string): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;
  
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
  
  // Blog methods
  createBlogPost(data: InsertBlogPost): Promise<BlogPost>;
  getBlogPosts(filters?: {
    status?: 'draft' | 'published';
    authorId?: string;
    tag?: string;
    q?: string;  // search query
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: BlogPost[];
    total: number;
    page: number;
    pageSize: number;
  }>;
  getBlogPostBySlug(slug: string, status?: 'draft' | 'published'): Promise<BlogPost | undefined>;
  updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost>;
  updateBlogPostStatus(id: string, status: 'draft' | 'published'): Promise<BlogPost>;
  deleteBlogPost(id: string): Promise<void>;
  
  // Demo question methods
  getActiveDemoQuestion(): Promise<DemoQuestion | undefined>;
  getAllDemoQuestions(): Promise<DemoQuestion[]>;
  createDemoQuestion(data: InsertDemoQuestion): Promise<DemoQuestion>;
  updateDemoQuestion(id: string, updates: Partial<InsertDemoQuestion>): Promise<DemoQuestion>;
  deleteDemoQuestion(id: string): Promise<void>;
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
  async getModules(): Promise<Module[]> {
    return db.select().from(modules).orderBy(asc(modules.order));
  }

  async getModuleById(id: string): Promise<Module | undefined> {
    const [module] = await db.select().from(modules).where(eq(modules.id, id));
    return module || undefined;
  }

  async getSections(): Promise<Section[]> {
    return db.select().from(sections).orderBy(asc(sections.order));
  }

  async getSectionsByModule(moduleId: string): Promise<Section[]> {
    return db.select().from(sections)
      .where(eq(sections.moduleId, moduleId))
      .orderBy(asc(sections.order));
  }

  async getSectionById(id: string): Promise<Section | undefined> {
    const [section] = await db.select().from(sections).where(eq(sections.id, id));
    return section || undefined;
  }

  async getModulesWithSections(): Promise<(Module & { sections: Section[] })[]> {
    const allModules = await this.getModules();
    const modulesWithSections = await Promise.all(
      allModules.map(async (module) => {
        const moduleSections = await this.getSectionsByModule(module.id);
        return { ...module, sections: moduleSections };
      })
    );
    return modulesWithSections;
  }

  async createModule(module: InsertModule): Promise<Module> {
    const [newModule] = await db.insert(modules).values(module as any).returning() as any;
    return newModule;
  }

  async updateModule(id: string, updates: Partial<InsertModule>): Promise<Module> {
    const [module] = await db
      .update(modules)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(modules.id, id))
      .returning();
    return module;
  }

  async deleteModule(id: string): Promise<void> {
    await db.delete(modules).where(eq(modules.id, id));
  }

  async reorderModules(moduleIds: string[]): Promise<void> {
    for (let i = 0; i < moduleIds.length; i++) {
      await db
        .update(modules)
        .set({ order: i + 1, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(modules.id, moduleIds[i]));
    }
  }

  async createSection(section: InsertSection): Promise<Section> {
    const [newSection] = await db.insert(sections).values(section as any).returning() as any;
    return newSection;
  }

  async updateSection(id: string, updates: Partial<InsertSection>): Promise<Section> {
    const [section] = await db
      .update(sections)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(sections.id, id))
      .returning();
    return section;
  }

  async deleteSection(id: string): Promise<void> {
    await db.delete(sections).where(eq(sections.id, id));
  }

  async reorderSections(sectionIds: string[], moduleId: string): Promise<void> {
    for (let i = 0; i < sectionIds.length; i++) {
      await db
        .update(sections)
        .set({ order: i + 1, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(sections.id, sectionIds[i]));
    }
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
    // Serialize JSON fields properly
    const questionData = {
      ...question,
      answers: JSON.stringify(question.answers) as any,
      tags: question.tags ? JSON.stringify(question.tags) as any : JSON.stringify([]) as any
    };
    const [newQuestion] = await db.insert(questions).values(questionData as any).returning();
    return newQuestion;
  }

  async createQuestionsBulk(questionList: InsertQuestion[]): Promise<{ summary: { total: number; created: number; failed: number }; results: Array<{ index: number; status: 'created' | 'failed'; id?: string; errors?: string[] }> }> {
    const results: Array<{ index: number; status: 'created' | 'failed'; id?: string; errors?: string[] }> = [];
    let created = 0;
    let failed = 0;

    // Process each question individually to allow partial failures
    for (let i = 0; i < questionList.length; i++) {
      try {
        const question = questionList[i];
        // Serialize JSON fields properly
        const questionData = {
          ...question,
          answers: JSON.stringify(question.answers) as any,
          tags: question.tags ? JSON.stringify(question.tags) as any : JSON.stringify([]) as any
        };
        const [newQuestion] = await db.insert(questions).values(questionData as any).returning();
        
        results.push({
          index: i,
          status: 'created',
          id: newQuestion.id
        });
        created++;
      } catch (error: any) {
        console.error(`Failed to create question at index ${i}:`, error);
        
        results.push({
          index: i,
          status: 'failed',
          errors: [error.message || 'Unknown error occurred']
        });
        failed++;
      }
    }

    return {
      summary: {
        total: questionList.length,
        created,
        failed
      },
      results
    };
  }

  async updateQuestion(id: string, updates: Partial<InsertQuestion>): Promise<Question> {
    // Serialize JSON fields properly
    const updateData: any = { 
      ...updates, 
      updatedAt: sql`CURRENT_TIMESTAMP` 
    };
    
    if (updates.answers) {
      updateData.answers = JSON.stringify(updates.answers) as any;
    }
    if (updates.tags) {
      updateData.tags = JSON.stringify(updates.tags) as any;
    }
    
    const [question] = await db
      .update(questions)
      .set(updateData)
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

  async deleteQuestion(id: string): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
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

  // Blog methods
  async createBlogPost(data: InsertBlogPost): Promise<BlogPost> {
    // Serialize JSON fields properly
    const blogData = {
      ...data,
      tags: data.tags ? JSON.stringify(data.tags) as any : JSON.stringify([]) as any,
      seoMeta: data.seoMeta ? JSON.stringify(data.seoMeta) as any : JSON.stringify({}) as any
    };
    const [newBlogPost] = await db.insert(blogPosts).values(blogData as any).returning();
    return newBlogPost;
  }

  async getBlogPosts(filters?: {
    status?: 'draft' | 'published';
    authorId?: string;
    tag?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: BlogPost[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(blogPosts.status, filters.status));
    }
    
    if (filters?.authorId) {
      conditions.push(eq(blogPosts.authorId, filters.authorId));
    }
    
    if (filters?.tag) {
      conditions.push(sql`${blogPosts.tags} @> ${JSON.stringify([filters.tag])}`);
    }
    
    if (filters?.q) {
      const searchQuery = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(blogPosts.title, searchQuery),
          ilike(blogPosts.excerpt, searchQuery)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(blogPosts)
      .where(whereClause);

    // Get items with pagination
    const items = await db
      .select()
      .from(blogPosts)
      .where(whereClause)
      .orderBy(
        sql`CASE WHEN ${blogPosts.publishedAt} IS NOT NULL THEN ${blogPosts.publishedAt} ELSE ${blogPosts.createdAt} END DESC`
      )
      .limit(pageSize)
      .offset(offset);

    return {
      items,
      total: countResult.count,
      page,
      pageSize
    };
  }

  async getBlogPostBySlug(slug: string, status?: 'draft' | 'published'): Promise<BlogPost | undefined> {
    const conditions = [eq(blogPosts.slug, slug)];
    
    if (status) {
      conditions.push(eq(blogPosts.status, status));
    }

    const [blogPost] = await db
      .select()
      .from(blogPosts)
      .where(and(...conditions));
      
    return blogPost || undefined;
  }

  async updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost> {
    // Serialize JSON fields properly
    const updateData: any = { 
      ...updates, 
      updatedAt: sql`CURRENT_TIMESTAMP` 
    };
    
    if (updates.tags) {
      updateData.tags = JSON.stringify(updates.tags) as any;
    }
    if (updates.seoMeta) {
      updateData.seoMeta = JSON.stringify(updates.seoMeta) as any;
    }
    
    const [blogPost] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, id))
      .returning();
    return blogPost;
  }

  async updateBlogPostStatus(id: string, status: 'draft' | 'published'): Promise<BlogPost> {
    const updateData: any = {
      status,
      updatedAt: sql`CURRENT_TIMESTAMP`
    };

    // If publishing and publishedAt is null, set it to current timestamp
    if (status === 'published') {
      const [existingPost] = await db
        .select({ publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(eq(blogPosts.id, id));
        
      if (existingPost && !existingPost.publishedAt) {
        updateData.publishedAt = sql`CURRENT_TIMESTAMP`;
      }
    } else if (status === 'draft') {
      // If setting to draft, clear publishedAt
      updateData.publishedAt = null;
    }

    const [blogPost] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, id))
      .returning();
    return blogPost;
  }

  async deleteBlogPost(id: string): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  // Demo question methods
  async getActiveDemoQuestion(): Promise<DemoQuestion | undefined> {
    const [question] = await db
      .select()
      .from(demoQuestions)
      .where(eq(demoQuestions.isActive, true))
      .orderBy(desc(demoQuestions.createdAt))
      .limit(1);
    return question || undefined;
  }

  async getAllDemoQuestions(): Promise<DemoQuestion[]> {
    return db.select().from(demoQuestions).orderBy(desc(demoQuestions.createdAt));
  }

  async createDemoQuestion(data: InsertDemoQuestion): Promise<DemoQuestion> {
    const [question] = await db.insert(demoQuestions).values(data as any).returning();
    return question;
  }

  async updateDemoQuestion(id: string, updates: Partial<InsertDemoQuestion>): Promise<DemoQuestion> {
    const [question] = await db
      .update(demoQuestions)
      .set({ ...updates as any, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(demoQuestions.id, id))
      .returning();
    return question;
  }

  async deleteDemoQuestion(id: string): Promise<void> {
    await db.delete(demoQuestions).where(eq(demoQuestions.id, id));
  }
}

export const storage = new DatabaseStorage();
