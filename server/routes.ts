import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import Stripe from "stripe";
import { z } from "zod";
import { storage } from "./storage";
import { authService } from "./auth";
import { emailService } from "./services/emailService";
import { quizService } from "./services/quizService";
import { certificateService } from "./services/certificateService";
import { requireAuth, requireAdmin, requireReviewer, requireActiveSubscription } from "./middleware/auth";
import { authRateLimit, apiRateLimit } from "./middleware/rateLimit";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  insertQuestionSchema
} from "@shared/schema";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Warning: STRIPE_SECRET_KEY not set. Payment functionality will not work.');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
}) : null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'ekg-academy-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  }));

  // Apply rate limiting to all API routes
  app.use('/api', apiRateLimit);

  // Auth endpoints
  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      const { user, verificationToken } = await authService.registerUser(userData);
      
      // Send verification email
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/verify-email?token=${verificationToken}`;
      const emailTemplate = emailService.getEmailVerificationTemplate(user.firstName, verificationUrl);
      
      try {
        await emailService.sendEmail(user.email, emailTemplate);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Continue with registration even if email fails
      }

      // Create audit log
      await storage.createAuditLog({
        actorId: user.id,
        action: "user_registered",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        message: "Konto zostało utworzone. Sprawdź e-mail w celu weryfikacji.",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ 
        error: error.message || "Błąd podczas rejestracji" 
      });
    }
  });

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await authService.authenticateUser(email, password);
      if (!user) {
        return res.status(401).json({ error: "Nieprawidłowe dane logowania" });
      }

      if (!user.emailVerified) {
        return res.status(401).json({ 
          error: "Konto nie zostało zweryfikowane. Sprawdź e-mail.",
          code: "EMAIL_NOT_VERIFIED"
        });
      }

      // Set session
      req.session.userId = user.id;

      // Create audit log
      await storage.createAuditLog({
        actorId: user.id,
        action: "user_login",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          locale: user.locale
        }
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(400).json({ error: "Błąd podczas logowania" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Błąd podczas wylogowania" });
      }
      res.json({ message: "Wylogowano pomyślnie" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    res.json({
      user: {
        id: req.user!.id,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        role: req.user!.role,
        locale: req.user!.locale
      }
    });
  });

  // Subscription and payment endpoints
  app.get("/api/plans", async (req, res) => {
    try {
      const plans = await storage.getActivePlans();
      res.json(plans);
    } catch (error) {
      console.error("Plans fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania planów" });
    }
  });

  app.post("/api/create-payment-intent", requireAuth, async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    try {
      const { planId } = req.body;
      
      const plan = await storage.getActivePlans().then(plans => 
        plans.find(p => p.id === planId)
      );
      
      if (!plan) {
        return res.status(404).json({ error: "Plan nie znaleziony" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(plan.price) * 100), // Convert to cents
        currency: plan.currency.toLowerCase(),
        metadata: {
          userId: req.user!.id,
          planId: plan.id
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Payment intent error:", error);
      res.status(500).json({ error: "Błąd podczas tworzenia płatności" });
    }
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    try {
      const sig = req.headers['stripe-signature'];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig as string,
          process.env.STRIPE_WEBHOOK_SECRET!
        );
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const { userId, planId } = paymentIntent.metadata;

        if (userId && planId) {
          const plan = await storage.getActivePlans().then(plans => 
            plans.find(p => p.id === planId)
          );

          if (plan) {
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + plan.durationDays);

            await storage.createSubscription({
              userId,
              planId,
              startDate,
              endDate,
              status: "active",
              paymentProvider: "stripe"
            });

            // Send confirmation email
            const user = await storage.getUser(userId);
            if (user) {
              const emailTemplate = emailService.getSubscriptionConfirmationTemplate(
                user.firstName,
                plan.name,
                endDate.toLocaleDateString('pl-PL')
              );
              
              try {
                await emailService.sendEmail(user.email, emailTemplate);
              } catch (emailError) {
                console.error("Failed to send subscription email:", emailError);
              }
            }
          }
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Quiz endpoints
  // Get modules with sections and user progress
  app.get("/api/modules", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const modules = await storage.getModules();
      const userProgress = await storage.getUserProgress(req.user!.id);
      
      // Build modules with sections and progress
      const modulesWithSections = await Promise.all(
        modules.map(async (module) => {
          const sections = await storage.getSectionsByModule(module.id);
          
          // Add progress to each section
          const sectionsWithProgress = sections.map(section => {
            const progress = userProgress.find(p => p.sectionId === section.id);
            return {
              ...section,
              completionPercentage: progress ? parseFloat(progress.completionPercentage) : 0,
              lastActivity: progress?.lastActivity
            };
          });
          
          // Calculate module completion percentage
          const moduleCompletion = sectionsWithProgress.length > 0
            ? sectionsWithProgress.reduce((acc, section) => acc + (section.completionPercentage || 0), 0) / sectionsWithProgress.length
            : 0;
          
          return {
            ...module,
            sections: sectionsWithProgress,
            completionPercentage: moduleCompletion
          };
        })
      );
      
      res.json(modulesWithSections);
    } catch (error) {
      console.error("Modules fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania modułów" });
    }
  });

  // Get sections with user progress (legacy endpoint)
  app.get("/api/sections", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const sections = await storage.getSections();
      const userProgress = await storage.getUserProgress(req.user!.id);
      
      const sectionsWithProgress = sections.map(section => {
        const progress = userProgress.find(p => p.sectionId === section.id);
        return {
          ...section,
          completionPercentage: progress ? parseFloat(progress.completionPercentage) : 0,
          lastActivity: progress?.lastActivity
        };
      });

      res.json(sectionsWithProgress);
    } catch (error) {
      console.error("Sections fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania sekcji" });
    }
  });

  app.get("/api/quiz/question", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { sectionId, mode = "learn" } = req.query;
      
      if (!sectionId) {
        return res.status(400).json({ error: "sectionId jest wymagane" });
      }

      const question = await quizService.getQuestionForUser(
        req.user!.id,
        sectionId as string,
        mode as any
      );

      if (!question) {
        return res.status(404).json({ error: "Brak dostępnych pytań" });
      }

      res.json(question);
    } catch (error) {
      console.error("Question fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania pytania" });
    }
  });

  app.post("/api/quiz/answer", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { questionId, selectedIndex, timeMs, mode = "learn" } = req.body;

      if (typeof questionId !== 'string' || typeof selectedIndex !== 'number' || typeof timeMs !== 'number') {
        return res.status(400).json({ error: "Nieprawidłowe dane" });
      }

      const result = await quizService.submitAnswer(
        req.user!.id,
        questionId,
        selectedIndex,
        timeMs,
        mode
      );

      res.json(result);
    } catch (error: any) {
      console.error("Answer submission error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas zapisywania odpowiedzi" });
    }
  });

  app.get("/api/progress", requireAuth, async (req, res) => {
    try {
      const progress = await storage.getUserProgress(req.user!.id);
      const stats = await storage.getUserStatistics(req.user!.id);
      const weakAreas = await quizService.getUserWeakAreas(req.user!.id);

      res.json({
        progress,
        stats,
        weakAreas
      });
    } catch (error) {
      console.error("Progress fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania postępu" });
    }
  });

  app.get("/api/review-queue", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const reviewQuestions = await quizService.getReviewQueue(req.user!.id);
      res.json({ questionIds: reviewQuestions });
    } catch (error) {
      console.error("Review queue error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania kolejki powtórek" });
    }
  });

  // Certificate endpoints
  app.post("/api/certificates/generate", requireAuth, async (req, res) => {
    try {
      const result = await certificateService.generateCertificate(req.user!.id);
      res.json(result);
    } catch (error: any) {
      console.error("Certificate generation error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas generowania certyfikatu" });
    }
  });

  app.get("/api/certificates/verify/:certificateId", async (req, res) => {
    try {
      const { certificateId } = req.params;
      const verification = await certificateService.verifyCertificate(certificateId);
      
      if (!verification) {
        return res.status(404).json({ error: "Certyfikat nie znaleziony" });
      }

      res.json(verification);
    } catch (error) {
      console.error("Certificate verification error:", error);
      res.status(500).json({ error: "Błąd podczas weryfikacji certyfikatu" });
    }
  });

  // Admin endpoints
  app.get("/api/admin/questions", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { status, sectionId } = req.query;
      
      let questions;
      if (sectionId) {
        questions = await storage.getQuestionsBySection(sectionId as string, status as string);
      } else {
        // Get all questions across all sections
        const sections = await storage.getSections();
        const allQuestions = [];
        for (const section of sections) {
          const sectionQuestions = await storage.getQuestionsBySection(section.id, status as string);
          allQuestions.push(...sectionQuestions);
        }
        questions = allQuestions;
      }

      // Add statistics for each question
      const questionsWithStats = await Promise.all(
        questions.map(async (question) => {
          const stats = await storage.getQuestionStatistics(question.id);
          return { ...question, stats };
        })
      );

      res.json(questionsWithStats);
    } catch (error) {
      console.error("Admin questions fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania pytań" });
    }
  });

  app.post("/api/admin/questions", requireAuth, requireReviewer, async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse({
        ...req.body,
        createdBy: req.user!.id
      });
      
      const question = await storage.createQuestion(questionData);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "question_created",
        entityType: "question",
        entityId: question.id,
        diff: { question: questionData },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(question);
    } catch (error: any) {
      console.error("Question creation error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas tworzenia pytania" });
    }
  });

  app.put("/api/admin/questions/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const oldQuestion = await storage.getQuestionById(id);
      if (!oldQuestion) {
        return res.status(404).json({ error: "Pytanie nie znalezione" });
      }

      const updatedQuestion = await storage.updateQuestion(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "question_updated",
        entityType: "question",
        entityId: id,
        diff: { old: oldQuestion, new: updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedQuestion);
    } catch (error: any) {
      console.error("Question update error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas aktualizacji pytania" });
    }
  });

  app.post("/api/admin/questions/:id/review", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body; // "approve" or "reject"
      
      const newStatus = action === "approve" ? "published" : "draft";
      const question = await storage.updateQuestionStatus(id, newStatus, req.user!.id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: `question_${action}d`,
        entityType: "question",
        entityId: id,
        diff: { status: newStatus },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(question);
    } catch (error: any) {
      console.error("Question review error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas recenzji pytania" });
    }
  });

  // Delete question endpoint
  app.delete("/api/admin/questions/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      const question = await storage.getQuestionById(id);
      if (!question) {
        return res.status(404).json({ error: "Pytanie nie znalezione" });
      }

      await storage.deleteQuestion(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "question_deleted",
        entityType: "question",
        entityId: id,
        diff: { question },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Question delete error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas usuwania pytania" });
    }
  });

  // Admin modules management
  app.get("/api/admin/modules", requireAuth, requireReviewer, async (req, res) => {
    try {
      const modules = await storage.getModulesWithSections();
      res.json(modules);
    } catch (error) {
      console.error("Admin modules fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania modułów" });
    }
  });

  app.post("/api/admin/modules", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { title, description, order, isLocked, prerequisiteModuleId } = req.body;
      
      const module = await storage.createModule({
        title,
        description,
        order,
        isLocked: isLocked || false,
        prerequisiteModuleId
      });

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "module_created",
        entityType: "module",
        entityId: module.id,
        diff: { module },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(module);
    } catch (error: any) {
      console.error("Module creation error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas tworzenia modułu" });
    }
  });

  app.put("/api/admin/modules/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const oldModule = await storage.getModuleById(id);
      if (!oldModule) {
        return res.status(404).json({ error: "Moduł nie znaleziony" });
      }

      const updatedModule = await storage.updateModule(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "module_updated",
        entityType: "module",
        entityId: id,
        diff: { old: oldModule, new: updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedModule);
    } catch (error: any) {
      console.error("Module update error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas aktualizacji modułu" });
    }
  });

  app.delete("/api/admin/modules/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      const module = await storage.getModuleById(id);
      if (!module) {
        return res.status(404).json({ error: "Moduł nie znaleziony" });
      }

      await storage.deleteModule(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "module_deleted",
        entityType: "module",
        entityId: id,
        diff: { module },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Module delete error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas usuwania modułu" });
    }
  });

  // Admin sections management
  app.post("/api/admin/sections", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { moduleId, title, description, order, isLocked, prerequisiteSectionId } = req.body;
      
      const section = await storage.createSection({
        moduleId,
        title,
        description,
        order,
        isLocked: isLocked || false,
        prerequisiteSectionId
      });

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "section_created",
        entityType: "section",
        entityId: section.id,
        diff: { section },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(section);
    } catch (error: any) {
      console.error("Section creation error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas tworzenia sekcji" });
    }
  });

  app.put("/api/admin/sections/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const oldSection = await storage.getSectionById(id);
      if (!oldSection) {
        return res.status(404).json({ error: "Sekcja nie znaleziona" });
      }

      const updatedSection = await storage.updateSection(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "section_updated",
        entityType: "section",
        entityId: id,
        diff: { old: oldSection, new: updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedSection);
    } catch (error: any) {
      console.error("Section update error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas aktualizacji sekcji" });
    }
  });

  app.delete("/api/admin/sections/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      const section = await storage.getSectionById(id);
      if (!section) {
        return res.status(404).json({ error: "Sekcja nie znaleziona" });
      }

      await storage.deleteSection(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "section_deleted",
        entityType: "section",
        entityId: id,
        diff: { section },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Section delete error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas usuwania sekcji" });
    }
  });

  // Reorder modules
  app.put("/api/admin/modules/reorder", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { moduleIds } = req.body; // Array of module IDs in new order
      
      await storage.reorderModules(moduleIds);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "modules_reordered",
        entityType: "module",
        entityId: "",
        diff: { newOrder: moduleIds },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Module reorder error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas zmiany kolejności modułów" });
    }
  });

  // Reorder sections within a module
  app.put("/api/admin/sections/reorder", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { sectionIds, moduleId } = req.body; // Array of section IDs in new order for specific module
      
      await storage.reorderSections(sectionIds, moduleId);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "sections_reordered",
        entityType: "section",
        entityId: "",
        diff: { moduleId, newOrder: sectionIds },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Section reorder error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas zmiany kolejności sekcji" });
    }
  });

  // Object storage endpoints for admin uploads
  app.post("/api/admin/upload", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Upload URL generation error:", error);
      res.status(500).json({ error: error.message || "Błąd podczas generowania URL uploadu" });
    }
  });

  app.put("/api/admin/images", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { imageURL } = req.body;
      
      if (!imageURL) {
        return res.status(400).json({ error: "imageURL jest wymagane" });
      }

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        imageURL,
        {
          owner: req.user!.id,
          visibility: "public", // Images for questions should be public
        }
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error: any) {
      console.error("Error setting image ACL:", error);
      res.status(500).json({ error: "Błąd podczas zapisywania obrazu" });
    }
  });

  // Public file serving endpoint
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error: any) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Object entity serving endpoint  
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error checking object access:", error);
      if (error.name === "ObjectNotFoundError") {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Support endpoints
  app.post("/api/support/tickets", async (req, res) => {
    try {
      const { subject, message } = req.body;
      
      if (!subject || !message) {
        return res.status(400).json({ error: "Temat i wiadomość są wymagane" });
      }

      const ticket = await storage.createSupportTicket({
        userId: req.session?.userId || undefined,
        subject,
        message,
        status: "open",
        priority: "medium"
      });

      res.status(201).json(ticket);
    } catch (error) {
      console.error("Support ticket creation error:", error);
      res.status(500).json({ error: "Błąd podczas tworzenia zgłoszenia" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
