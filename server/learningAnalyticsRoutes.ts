/**
 * Panel nauki (admin → Statystyki): kto z testerów się uczy, które pytania sprawiają
 * kłopot (albo mają błąd w kluczu), gdzie ludzie przestają czytać wykład.
 *
 * Wszystko z danych, które kurs i tak zapisuje: attempts, lecture_reads, progress,
 * support_tickets. Konta zespołu (STAFF_ROLES) domyślnie pominięte (?staff=1 je dołącza).
 * Statystyki pytań liczą pierwsze podejście każdej osoby, od GRADING_FIXED_AT.
 */
import type { Express } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { requireAuth, requireRole } from "./middleware/auth";
import {
  GRADING_FIXED_AT,
  LEARNING_RANGES,
  MIN_ANSWERS_PER_QUESTION,
  STAFF_ROLES,
  TESTER_STATUSES,
  testerStatus,
  type LearningAnalytics,
  type LearningLecture,
  type LearningQuestion,
  type LearningTester,
} from "@shared/learningAnalytics";

const requireLearningAdmin = requireRole(["owner", "admin", "reviewer"]);

const LIST_LIMIT = 15;

const rows = async <T>(q: SQL) => ((await db.execute(q)) as unknown as { rows: T[] }).rows;

/** Treść pytania do listy: bez obrazków, znaczników markdown i nowych linii */
export function plainText(md: string, max = 180): string {
  const s = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^::.*$/gm, " ")
    .replace(/[#*_`>|~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

type Pick = { c: boolean; t: number; i: number };
type QuestionRow = {
  id: string;
  title: string | null;
  body_md: string;
  question_type: string;
  answers: Array<{ text: string; isCorrect: boolean }> | null;
  tags: string[] | null;
  section_title: string;
  module_title: string;
  reports: number;
  picks: Pick[];
};

export function summarizeQuestion(r: QuestionRow): LearningQuestion {
  const picks = r.picks ?? [];
  const answers = Array.isArray(r.answers) ? r.answers : [];
  let topWrong: LearningQuestion["topWrong"] = null;
  let correctText: string | null = null;
  let correctPicks: number | null = null;
  if (r.question_type === "multiple_choice" && answers.length) {
    const correctIndex = answers.findIndex((a) => a.isCorrect);
    const counts = new Map<number, number>();
    for (const p of picks) if (p.i >= 0) counts.set(p.i, (counts.get(p.i) ?? 0) + 1);
    correctText = correctIndex >= 0 ? plainText(answers[correctIndex].text, 120) : null;
    correctPicks = counts.get(correctIndex) ?? 0;
    const wrong = Array.from(counts.entries())
      .filter(([i]) => i !== correctIndex && answers[i])
      .sort((a, b) => b[1] - a[1])[0];
    if (wrong) topWrong = { text: plainText(answers[wrong[0]].text, 120), picks: wrong[1] };
  }
  const studioTag = (r.tags ?? []).find((t) => t.startsWith("studio:"));
  return {
    id: r.id,
    studioId: studioTag ? studioTag.slice("studio:".length) : null,
    text: plainText(r.title?.trim() ? `${r.title}. ${r.body_md}` : r.body_md),
    type: r.question_type,
    moduleTitle: r.module_title,
    sectionTitle: r.section_title,
    answers: picks.length,
    correctRate: picks.length ? picks.filter((p) => p.c).length / picks.length : 0,
    medianTimeMs: median(picks.map((p) => p.t)),
    reports: r.reports,
    topWrong,
    correctText,
    correctPicks,
  };
}

/**
 * Podejrzane = najczęstsza błędna odpowiedź wybierana co najmniej tak często jak poprawna
 * (i przez co najmniej 2 osoby — pojedyncze 1:1 to przypadek). Zwykle znaczy błąd w kluczu
 * albo niejednoznaczne sformułowanie, nie „trudne pytanie”.
 */
export const isSuspicious = (q: LearningQuestion) =>
  q.answers >= MIN_ANSWERS_PER_QUESTION && !!q.topWrong && q.topWrong.picks >= Math.max(2, q.correctPicks ?? 0);

export function buildQuestionLists(all: LearningQuestion[]): LearningAnalytics["questions"] {
  const rated = all.filter((q) => q.answers >= MIN_ANSWERS_PER_QUESTION);
  return {
    hard: rated
      .filter((q) => q.correctRate <= 0.5)
      .sort((a, b) => a.correctRate - b.correctRate || b.answers - a.answers)
      .slice(0, LIST_LIMIT),
    suspicious: rated
      .filter(isSuspicious)
      .sort((a, b) => b.topWrong!.picks - (b.correctPicks ?? 0) - (a.topWrong!.picks - (a.correctPicks ?? 0)) || b.answers - a.answers)
      .slice(0, LIST_LIMIT),
    slow: [...rated].sort((a, b) => b.medianTimeMs - a.medianTimeMs).slice(0, LIST_LIMIT),
    reported: all
      .filter((q) => q.reports > 0)
      .sort((a, b) => b.reports - a.reports || b.answers - a.answers)
      .slice(0, LIST_LIMIT),
  };
}

type ReadRow = { o: number; t: number };

export function summarizeLecture(r: {
  id: string;
  title: string;
  module_title: string;
  chapters: number;
  reads: ReadRow[];
  quizzers: number;
  avg_mastery: number | null;
}): LearningLecture {
  const reads = r.reads ?? [];
  const finished = reads.filter((x) => x.o >= x.t).length;
  const stops = new Map<number, number>();
  for (const x of reads) if (x.o < x.t) stops.set(x.o, (stops.get(x.o) ?? 0) + 1);
  const top = Array.from(stops.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return {
    sectionId: r.id,
    moduleTitle: r.module_title,
    title: r.title,
    chapters: r.chapters,
    opened: reads.length,
    finished,
    commonStopChapter: top ? top[0] : null,
    commonStopCount: top ? top[1] : 0,
    quizzers: r.quizzers,
    avgMastery: r.avg_mastery == null ? null : Math.round(r.avg_mastery),
  };
}

export function registerLearningAnalyticsRoutes(app: Express) {
  app.get("/api/admin/analytics/learning", requireAuth, requireLearningAdmin, async (req, res) => {
    try {
      const asked = Number(req.query.days);
      const days = (LEARNING_RANGES as readonly number[]).includes(asked) ? asked : 30;
      const includeStaff = req.query.staff === "1";
      const now = new Date();
      const since = new Date(now.getTime() - days * 86_400_000).toISOString();
      const questionsSince = since > new Date(GRADING_FIXED_AT).toISOString() ? since : new Date(GRADING_FIXED_AT).toISOString();

      // Filtr kont na aliasie u (users)
      const who = includeStaff
        ? sql`true`
        : sql`u.role not in (${sql.join(STAFF_ROLES.map((r) => sql`${r}`), sql`, `)})`;
      const today = sql`(now() at time zone 'Europe/Warsaw')::date`;

      const testerRows = await rows<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        role: string;
        created_at: string;
        last_active_at: string | null;
        active_today: boolean;
        active_days: number;
        answers_total: number;
        answers_in_range: number;
        correct_rate: number | null;
        lectures_opened: number;
        lectures_finished: number;
      }>(sql`
        with u as (
          select id, first_name, last_name, email, role, created_at::timestamptz as created_at
          from users u where ${who} and u.suspended_at is null
        ),
        act as (
          select user_id, created_at::timestamptz as at from attempts
          union all
          select user_id, updated_at from lecture_reads
        )
        select u.id, u.first_name, u.last_name, u.email, u.role, u.created_at,
          (select max(at) from act where act.user_id = u.id) as last_active_at,
          exists(select 1 from act where act.user_id = u.id and (at at time zone 'Europe/Warsaw')::date = ${today}) as active_today,
          (select count(distinct (at at time zone 'Europe/Warsaw')::date) from act where act.user_id = u.id)::int as active_days,
          (select count(*) from attempts a where a.user_id = u.id)::int as answers_total,
          (select count(*) from attempts a where a.user_id = u.id and a.created_at::timestamptz >= ${since}::timestamptz)::int as answers_in_range,
          (select avg(a.is_correct::int) from attempts a
             where a.user_id = u.id and a.created_at::timestamptz >= ${questionsSince}::timestamptz)::float as correct_rate,
          (select count(*) from lecture_reads r where r.user_id = u.id)::int as lectures_opened,
          (select count(*) from lecture_reads r where r.user_id = u.id and r.chapter_order >= r.chapters_total)::int as lectures_finished
        from u
      `);

      const testers: LearningTester[] = testerRows
        .map((r) => ({
          id: r.id,
          name: `${r.first_name} ${r.last_name}`.trim(),
          email: r.email,
          role: r.role,
          createdAt: new Date(r.created_at).toISOString(),
          lastActiveAt: r.last_active_at ? new Date(r.last_active_at).toISOString() : null,
          status: testerStatus(r.last_active_at ? new Date(r.last_active_at) : null, now),
          activeDays: r.active_days,
          answersTotal: r.answers_total,
          answersInRange: r.answers_in_range,
          correctRate: r.correct_rate,
          lecturesOpened: r.lectures_opened,
          lecturesFinished: r.lectures_finished,
        }))
        .sort(
          (a, b) =>
            TESTER_STATUSES.indexOf(a.status) - TESTER_STATUSES.indexOf(b.status) ||
            (b.lastActiveAt ?? b.createdAt).localeCompare(a.lastActiveAt ?? a.createdAt),
        );

      const questionRows = await rows<QuestionRow>(sql`
        with f as (
          select distinct on (a.user_id, a.question_id) a.question_id, a.is_correct, a.time_ms, a.selected_index
          from attempts a join users u on u.id = a.user_id
          where a.created_at::timestamptz >= ${questionsSince}::timestamptz and ${who}
          order by a.user_id, a.question_id, a.created_at
        ),
        rep as (
          select t.question_id, count(*)::int as n from support_tickets t
          where t.question_id is not null group by t.question_id
        )
        select q.id, q.title, q.body_md, q.question_type, q.answers, q.tags,
          s.title as section_title, m.title as module_title,
          coalesce(rep.n, 0) as reports,
          coalesce((select json_agg(json_build_object('c', f.is_correct, 't', f.time_ms, 'i', f.selected_index))
                    from f where f.question_id = q.id), '[]'::json) as picks
        from questions q
          join sections s on s.id = q.section_id
          join modules m on m.id = s.module_id
          left join rep on rep.question_id = q.id
        where exists(select 1 from f where f.question_id = q.id) or rep.n is not null
      `);

      const lectureRows = await rows<Parameters<typeof summarizeLecture>[0]>(sql`
        select s.id, s.title, m.title as module_title,
          (select count(*) from lecture_chapters c where c.section_id = s.id and c.is_published)::int as chapters,
          coalesce((select json_agg(json_build_object('o', r.chapter_order, 't', r.chapters_total))
                    from lecture_reads r join users u on u.id = r.user_id
                    where r.section_id = s.id and ${who}), '[]'::json) as reads,
          (select count(distinct a.user_id) from attempts a
             join questions q on q.id = a.question_id join users u on u.id = a.user_id
             where q.section_id = s.id and ${who})::int as quizzers,
          (select avg(p.completion_percentage)::float from progress p join users u on u.id = p.user_id
             where p.section_id = s.id and ${who}
               and exists(select 1 from attempts a join questions q on q.id = a.question_id
                          where a.user_id = p.user_id and q.section_id = s.id)) as avg_mastery
        from sections s join modules m on m.id = s.module_id
        where s.is_visible and m.is_visible
        order by m."order", s."order"
      `);

      const [counts] = await rows<{
        lecture_opens: number;
        reports: number;
        answers: number;
        correct_rate: number | null;
      }>(sql`
        select
          (select count(*) from lecture_reads r join users u on u.id = r.user_id
             where r.updated_at >= ${since}::timestamptz and ${who})::int as lecture_opens,
          (select count(*) from support_tickets t where t.created_at::timestamptz >= ${since}::timestamptz)::int as reports,
          (select count(*) from attempts a join users u on u.id = a.user_id
             where a.created_at::timestamptz >= ${since}::timestamptz and ${who})::int as answers,
          (select avg(a.is_correct::int) from attempts a join users u on u.id = a.user_id
             where a.created_at::timestamptz >= ${questionsSince}::timestamptz and ${who})::float as correct_rate
      `);

      const sinceMs = new Date(since).getTime();
      const lectures = lectureRows.map(summarizeLecture).filter((l) => l.chapters > 0 || l.quizzers > 0);
      const body: LearningAnalytics = {
        rangeDays: days,
        since,
        includeStaff,
        questionsSince,
        summary: {
          testers: testers.length,
          activeToday: testerRows.filter((r) => r.active_today).length,
          activeInRange: testers.filter((t) => t.lastActiveAt && new Date(t.lastActiveAt).getTime() >= sinceMs).length,
          newInRange: testers.filter((t) => new Date(t.createdAt).getTime() >= sinceMs).length,
          answersInRange: counts.answers,
          correctRate: counts.correct_rate,
          lectureOpensInRange: counts.lecture_opens,
          reportsInRange: counts.reports,
        },
        testers,
        questions: buildQuestionLists(questionRows.map(summarizeQuestion)),
        lectures,
      };
      res.json(body);
    } catch (error) {
      console.error("Learning analytics error:", error);
      res.status(500).json({ error: "Nie udało się policzyć statystyk nauki" });
    }
  });
}
