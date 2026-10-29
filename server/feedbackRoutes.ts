/**
 * Zgłoszenia testerów (beta): przycisk „Zgłoś uwagę” → /zgloszenie → POST /api/feedback.
 *
 * Dane: tabela support_tickets (kind = "feedback"), ta sama, do której trafiają
 * zgłoszenia „Zgłoś błąd” przy pytaniu (kind = "question", starsze wiersze: kind = "support"
 * z question_id). Panel admina pokazuje oba źródła razem.
 *
 * Załączniki: JSON z obrazami w base64 (bez multipart — brak multera w zależnościach),
 * pod własnym typem treści FEEDBACK_CONTENT_TYPE, bo globalny express.json ma limit 100 kB.
 * Pliki na dysku: $FEEDBACK_UPLOAD_DIR/<id zgłoszenia>/<n>.<ext>.
 */
import type { Express, Request, Response } from "express";
import express from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { and, desc, eq, gte, inArray, isNotNull, isNull, or, sql, count } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { emailService } from "./services/emailService";
import { requireAuth, requireRole } from "./middleware/auth";
import { supportTickets, users, questions, type FeedbackAttachmentMeta, type FeedbackContext, type SupportTicket } from "@shared/schema";
import {
  FEEDBACK_AREAS,
  FEEDBACK_CONTENT_TYPE,
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_MAX_DESCRIPTION,
  FEEDBACK_MAX_FILES,
  FEEDBACK_MAX_FILE_BYTES,
  FEEDBACK_MIN_DESCRIPTION,
  FEEDBACK_NOTE_REQUIRED,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  feedbackAreaLabel,
  feedbackIdsFromPath,
  feedbackTypeLabel,
  isUuid,
  normalizeFeedbackPriority,
  normalizeFeedbackStatus,
  type AdminFeedbackReport,
  type AdminFeedbackResponse,
  type FeedbackStatus,
  type MyFeedbackReport,
} from "@shared/feedback";

const requireFeedbackAdmin = requireRole(["owner", "admin", "reviewer"]);

const uploadRoot = () => path.resolve(process.env.FEEDBACK_UPLOAD_DIR || "./data/feedback-uploads");
const notifyEmail = () => process.env.FEEDBACK_NOTIFY_EMAIL || "kontakt@helloekg.pl";

const EXT: Record<FeedbackAttachmentMeta["mime"], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Typ obrazu po sygnaturze pliku (nie ufamy deklaracji klienta) */
function sniffImage(buf: Buffer): FeedbackAttachmentMeta["mime"] | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const enumOf = <T extends readonly { value: string }[]>(items: T, message: string) =>
  z.enum(items.map((i) => i.value) as [T[number]["value"], ...T[number]["value"][]], { error: message });

const createSchema = z.object({
  description: z.string().trim().min(FEEDBACK_MIN_DESCRIPTION, "Opisz uwagę w co najmniej 10 znakach.").max(FEEDBACK_MAX_DESCRIPTION),
  area: enumOf(FEEDBACK_AREAS, "Wybierz, czego dotyczy zgłoszenie."),
  type: enumOf(FEEDBACK_TYPES, "Wybierz typ zgłoszenia."),
  pagePath: z.string().max(500).optional(),
  context: z
    .object({
      viewport: z.string().max(40).optional(),
      appVersion: z.string().max(40).optional(),
    })
    .optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().max(200),
        data: z.string(), // base64 (bez prefiksu data:)
      }),
    )
    .max(FEEDBACK_MAX_FILES, `Możesz dodać najwyżej ${FEEDBACK_MAX_FILES} pliki.`)
    .optional(),
});

const patchSchema = z.object({
  status: z
    .enum(FEEDBACK_STATUSES.map((s) => s.value) as [FeedbackStatus, ...FeedbackStatus[]], { error: "Nieznany status." })
    .optional(),
  priority: z.enum(FEEDBACK_PRIORITIES, { error: "Priorytet: P0, P1, P2 albo brak." }).nullable().optional(),
  adminNote: z.string().max(5000).nullable().optional(),
});

/** Wiersze zgłoszeń testerów + zgłoszeń z quizu (także starszych, sprzed kolumny kind) */
const feedbackScope = () =>
  or(
    inArray(supportTickets.kind, ["feedback", "question"]),
    and(eq(supportTickets.kind, "support"), isNotNull(supportTickets.questionId)),
  );

const kindOf = (t: SupportTicket): "feedback" | "question" => (t.kind === "feedback" ? "feedback" : "question");

function toMine(t: SupportTicket): MyFeedbackReport {
  const kind = kindOf(t);
  return {
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    kind,
    description: t.message,
    area: (t.area as MyFeedbackReport["area"]) ?? (kind === "question" ? "pytania" : null),
    type: (t.feedbackType as MyFeedbackReport["type"]) ?? null,
    status: normalizeFeedbackStatus(t.status),
    adminNote: t.adminResponse ?? null,
    attachmentCount: (t.attachments ?? []).length,
  };
}

function toAdmin(t: SupportTicket, questionTitle: string | null): AdminFeedbackReport {
  return {
    ...toMine(t),
    updatedAt: t.updatedAt.toISOString(),
    userEmail: t.userEmail,
    userName: t.userName,
    priority: normalizeFeedbackPriority(t.priority),
    pagePath: t.pagePath ?? null,
    context: t.context ?? null,
    questionId: t.questionId ?? null,
    questionTitle,
    attachments: (t.attachments ?? []).map((a, n) => ({ n, mime: a.mime, size: a.size, name: a.name })),
  };
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ error });

export function registerFeedbackRoutes(app: Express) {
  const parseFeedbackBody = express.json({
    type: FEEDBACK_CONTENT_TYPE,
    // 3 × 5 MB w base64 (≈ ×4/3) + tekst
    limit: Math.ceil(FEEDBACK_MAX_FILES * FEEDBACK_MAX_FILE_BYTES * 1.37) + 64 * 1024,
  });

  // ── Nowe zgłoszenie ─────────────────────────────────────────────────────
  app.post("/api/feedback", requireAuth, parseFeedbackBody, async (req: Request, res: Response) => {
    const user = req.user!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, parsed.error.issues[0]?.message || "Nieprawidłowe zgłoszenie.");
    }
    const input = parsed.data;

    try {
      // Limit: 20 zgłoszeń na osobę na dobę
      const [{ n }] = await db
        .select({ n: count() })
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.userId, user.id),
            eq(supportTickets.kind, "feedback"),
            gte(supportTickets.createdAt, sql`now() - interval '24 hours'`),
          ),
        );
      if (Number(n) >= FEEDBACK_DAILY_LIMIT) {
        return fail(res, 429, "Wysłałeś dziś już 20 zgłoszeń. Kolejne możesz wysłać jutro.");
      }

      // Załączniki: dekodowanie i sprawdzenie, zanim cokolwiek zapiszemy
      const files: Array<{ meta: FeedbackAttachmentMeta; buf: Buffer }> = [];
      const incoming = input.attachments ?? [];
      for (let i = 0; i < incoming.length; i++) {
        const a = incoming[i];
        const buf = Buffer.from(a.data, "base64");
        if (buf.length === 0) return fail(res, 400, `Plik „${a.name}” jest pusty.`);
        if (buf.length > FEEDBACK_MAX_FILE_BYTES) return fail(res, 400, `Plik „${a.name}” ma więcej niż 5 MB.`);
        const mime = sniffImage(buf);
        if (!mime) return fail(res, 400, `Plik „${a.name}” nie jest obrazem PNG, JPG ani WEBP.`);
        files.push({
          meta: { file: `${i + 1}.${EXT[mime]}`, mime, size: buf.length, name: a.name.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || `zrzut-${i + 1}` },
          buf,
        });
      }

      // tylko ścieżka w aplikacji: „//host” i „/\\host” przeglądarka potraktowałaby jako inny serwis
      const pagePath = input.pagePath && /^\/(?![\/\\])/.test(input.pagePath) ? input.pagePath : null;
      const ids = pagePath ? feedbackIdsFromPath(pagePath) : {};
      const context: FeedbackContext = {
        userAgent: (req.get("User-Agent") || "").slice(0, 400) || undefined,
        viewport: input.context?.viewport,
        appVersion: input.context?.appVersion,
        ...ids,
      };

      // question_id ma klucz obcy — wpisujemy tylko istniejące pytanie
      let questionId: string | undefined;
      if (isUuid(ids.questionId)) {
        const [q] = await db.select({ id: questions.id }).from(questions).where(eq(questions.id, ids.questionId)).limit(1);
        questionId = q?.id;
      }

      const id = crypto.randomUUID();
      const dir = path.join(uploadRoot(), id);
      if (files.length) {
        await fs.mkdir(dir, { recursive: true });
        await Promise.all(files.map((f) => fs.writeFile(path.join(dir, f.meta.file), f.buf, { mode: 0o640 })));
      }

      const userName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
      let ticket: SupportTicket;
      try {
        [ticket] = await db
          .insert(supportTickets)
          .values({
            id,
            kind: "feedback",
            userId: user.id,
            userEmail: user.email,
            userName,
            subject: input.description.replace(/\s+/g, " ").slice(0, 200),
            message: input.description,
            status: "nowe",
            area: input.area,
            feedbackType: input.type,
            pagePath,
            context,
            questionId,
            attachments: files.map((f) => f.meta),
          })
          .returning();
      } catch (e) {
        if (files.length) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
        throw e;
      }

      // Pierwsze zgłoszenie = interakcja z podpowiedzią
      if (!user.feedbackHintSeenAt) {
        await db.update(users).set({ feedbackHintSeenAt: new Date() }).where(eq(users.id, user.id)).catch(() => {});
      }

      // Powiadomienie e-mailem — błąd wysyłki nie psuje zgłoszenia
      const template = emailService.getFeedbackNotificationTemplate({
        id: ticket.id,
        userName,
        userEmail: user.email,
        areaLabel: feedbackAreaLabel(input.area),
        typeLabel: feedbackTypeLabel(input.type),
        description: input.description,
        pagePath,
        attachmentCount: files.length,
        viewport: context.viewport,
        appVersion: context.appVersion,
      });
      emailService.sendEmail(notifyEmail(), template).catch((e) => console.error("Feedback notification email failed:", e?.message || e));

      res.status(201).json({ id: ticket.id, report: toMine(ticket) });
    } catch (error) {
      console.error("Feedback create error:", error);
      fail(res, 500, "Nie udało się zapisać zgłoszenia. Spróbuj ponownie za chwilę.");
    }
  });

  // ── Moje zgłoszenia + stan podpowiedzi ──────────────────────────────────
  app.get("/api/feedback/mine", requireAuth, async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(supportTickets)
        .where(and(eq(supportTickets.userId, req.user!.id), feedbackScope()))
        .orderBy(desc(supportTickets.createdAt))
        .limit(50);
      res.json({ hintSeen: !!req.user!.feedbackHintSeenAt, reports: rows.map(toMine) });
    } catch (error) {
      console.error("Feedback mine error:", error);
      fail(res, 500, "Nie udało się pobrać zgłoszeń.");
    }
  });

  app.post("/api/feedback/hint-seen", requireAuth, async (req, res) => {
    try {
      await db
        .update(users)
        .set({ feedbackHintSeenAt: new Date() })
        .where(and(eq(users.id, req.user!.id), isNull(users.feedbackHintSeenAt)));
      res.json({ ok: true });
    } catch (error) {
      console.error("Feedback hint error:", error);
      fail(res, 500, "Błąd serwera");
    }
  });

  // ── Panel admina ────────────────────────────────────────────────────────
  app.get("/api/admin/feedback", requireAuth, requireFeedbackAdmin, async (req, res) => {
    try {
      const { status, area, type, source } = req.query as Record<string, string | undefined>;
      const rows = await db
        .select({ t: supportTickets, questionTitle: questions.title })
        .from(supportTickets)
        .leftJoin(questions, eq(questions.id, supportTickets.questionId))
        .where(feedbackScope())
        .orderBy(desc(supportTickets.createdAt))
        .limit(1000);

      // Mało wierszy (beta) — statusy starszych zgłoszeń normalizujemy, więc filtrujemy w pamięci
      let items = rows.map((r) => toAdmin(r.t, r.questionTitle ?? null));
      if (source === "feedback" || source === "question") items = items.filter((i) => i.kind === source);
      if (area && area !== "all") items = items.filter((i) => i.area === area);
      if (type && type !== "all") items = items.filter((i) => i.type === type);

      const counts = { nowe: 0, w_analizie: 0, wdrozone: 0, odrzucone: 0, total: items.length } as AdminFeedbackResponse["counts"];
      for (const i of items) counts[i.status]++;
      if (status && status !== "all") items = items.filter((i) => i.status === status);

      const body: AdminFeedbackResponse = { counts, items };
      res.json(body);
    } catch (error) {
      console.error("Admin feedback list error:", error);
      fail(res, 500, "Nie udało się pobrać zgłoszeń.");
    }
  });

  app.patch("/api/admin/feedback/:id", requireAuth, requireFeedbackAdmin, async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, "Nie ma takiego zgłoszenia.");
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || "Nieprawidłowe dane.");
    const input = parsed.data;

    try {
      const [current] = await db.select().from(supportTickets).where(and(eq(supportTickets.id, id), feedbackScope())).limit(1);
      if (!current) return fail(res, 404, "Nie ma takiego zgłoszenia.");

      const before = {
        status: normalizeFeedbackStatus(current.status),
        priority: normalizeFeedbackPriority(current.priority),
        adminNote: current.adminResponse ?? null,
      };
      const after = {
        status: input.status ?? before.status,
        priority: input.priority !== undefined ? input.priority : before.priority,
        adminNote: input.adminNote !== undefined ? input.adminNote?.trim() || null : before.adminNote,
      };
      if (FEEDBACK_NOTE_REQUIRED.includes(after.status) && !after.adminNote) {
        return fail(res, 400, "Przy statusie „wdrożone” lub „odrzucone” dopisz notatkę — zobaczy ją zgłaszający.");
      }

      const [updated] = await db
        .update(supportTickets)
        .set({
          kind: kindOf(current), // starsze zgłoszenia z quizu dostają kind = question
          status: after.status,
          priority: after.priority ?? "medium",
          adminResponse: after.adminNote,
          adminUserId: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, id))
        .returning();

      await storage.createAuditLog({
        actorId: req.user!.id,
        action: before.status !== after.status ? "feedback_status_changed" : "feedback_updated",
        entityType: "support_ticket",
        entityId: id,
        diff: { from: before, to: after },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      let questionTitle: string | null = null;
      if (updated.questionId) {
        const [q] = await db.select({ title: questions.title }).from(questions).where(eq(questions.id, updated.questionId)).limit(1);
        questionTitle = q?.title ?? null;
      }
      res.json(toAdmin(updated, questionTitle));
    } catch (error) {
      console.error("Admin feedback update error:", error);
      fail(res, 500, "Nie udało się zapisać zmian.");
    }
  });

  app.get("/api/admin/feedback/:id/attachments/:n", requireAuth, requireFeedbackAdmin, async (req, res) => {
    const { id } = req.params;
    const n = Number.parseInt(req.params.n, 10);
    if (!isUuid(id) || !Number.isInteger(n) || n < 0) return res.sendStatus(404);
    try {
      const [t] = await db.select({ attachments: supportTickets.attachments }).from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
      const meta = t?.attachments?.[n];
      if (!meta || !/^\d+\.(png|jpg|webp)$/.test(meta.file)) return res.sendStatus(404);
      res.set({
        "Content-Type": meta.mime,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
      });
      res.sendFile(path.join(uploadRoot(), id, meta.file), (err) => {
        if (err && !res.headersSent) res.sendStatus(404);
      });
    } catch (error) {
      console.error("Admin feedback attachment error:", error);
      res.sendStatus(500);
    }
  });
}
