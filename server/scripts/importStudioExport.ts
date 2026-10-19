/**
 * Import paczki eksportu z helloEKG Studio (create.helloekg.pl → /api/transfer/export.zip)
 * do bazy kursu.
 *
 *   DATABASE_URL=... npx tsx server/scripts/importStudioExport.ts <rozpakowany-katalog> [--all-published]
 *
 * Mapowanie: sekcja studia → moduł, wykład → sekcja (rozdziały = nagłówki ##),
 * pytania bez wykładu → sekcja „Pytania utrwalające" na końcu modułu.
 * Grafiki: assets/<hash>.<ext> → /content-assets/<hash>.<ext> (katalog CONTENT_ASSETS_DIR).
 *
 * UWAGA: import zastępuje CAŁĄ treść kursu (moduły, sekcje, rozdziały, pytania)
 * razem z postępami uczących się, które są do niej przypięte.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { users, modules, sections, lectureChapters, questions } from "@shared/schema";

const dir = process.argv[2];
const allPublished = process.argv.includes("--all-published");
if (!dir) {
  console.error("Użycie: importStudioExport.ts <katalog-eksportu> [--all-published]");
  process.exit(1);
}

const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const studioSections: Array<{ code: string; title: string; order: number }> = read("sections.json");
const studioLectures: any[] = read("lectures.json");
const studioQuestions: any[] = read("questions.json");
const manifest = read("manifest.json");

/** Rozszerzenia studia, które kurs już obsługuje — reszta zostaje szkicem */
const SUPPORTED_EXTENSIONS = new Set(["clinical_case"]);
const unsupported = new Set<string>(
  (manifest.extensionsUsed ?? [])
    .filter((e: any) => !SUPPORTED_EXTENSIONS.has(e.ext))
    .map((e: any) => e.questionExternalId)
);

const ASSET_RE = /(^|[("'\s])assets\/([0-9a-f]{64}\.[a-z0-9]+)/g;
const fixAssets = (s: string) => s.replace(ASSET_RE, "$1/content-assets/$2");
const fixDeep = (v: any): any =>
  typeof v === "string" ? fixAssets(v)
  : Array.isArray(v) ? v.map(fixDeep)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fixDeep(x)]))
  : v;
/** Treść wykładu: znaczniki zamiast tekstowych zaślepek studia — renderer kursu decyduje, co pokazać */
const fixLecture = (md: string) =>
  fixAssets(md).replace(/\*\[Grafika w przygotowaniu: (GFX-\d+)\]\*/g, '<div data-gfx-pending="$1"></div>');
const isAsset = (u: unknown) => typeof u === "string" && u.startsWith("/content-assets/");

/** Dzieli wykład na rozdziały po nagłówkach `##`. Tekst przed pierwszym trafia do „Wstępu". */
function splitChapters(title: string, md: string): Array<{ title: string; contentMd: string }> {
  const body = md.replace(/^#\s+.*\n+/, "");
  const parts = body.split(/^(?=##\s)/m).map((p) => p.trim()).filter(Boolean);
  const chapters = parts.map((p) => {
    const m = p.match(/^##\s+(.+)\n?([\s\S]*)$/);
    return m ? { title: m[1].trim(), contentMd: m[2].trim() } : { title: "Wstęp", contentMd: p };
  }).filter((c) => c.contentMd.length > 0);
  return chapters.length ? chapters : [{ title, contentMd: body.trim() }];
}

async function main() {
  // Autor techniczny — kolumny created_by są wymagane
  const importEmail = "studio-import@helloekg.pl";
  let [author] = await db.select().from(users).where(eq(users.email, importEmail));
  if (!author) {
    [author] = await db.insert(users).values({
      email: importEmail,
      password: "!" + crypto.randomBytes(32).toString("hex"), // nie jest hashem bcrypt → logowanie niemożliwe
      firstName: "Studio",
      lastName: "Import",
      role: "reviewer",
      emailVerified: true,
    } as any).returning();
  }

  const stats = { modules: 0, sections: 0, chapters: 0, published: 0, draft: 0 };

  await db.transaction(async (tx) => {
    await tx.delete(modules); // kaskada: sekcje, rozdziały, pytania

    for (const s of [...studioSections].sort((a, b) => a.order - b.order)) {
      const [mod] = await tx.insert(modules).values({ title: s.title, order: s.order }).returning();
      stats.modules++;

      const lecs = studioLectures
        .filter((l) => l.sectionCode === s.code)
        .sort((a, b) => a.order - b.order);
      const sectionByLecture = new Map<string, string>();
      let order = 1;

      for (const l of lecs) {
        const [sec] = await tx.insert(sections).values({ moduleId: mod.id, title: l.title, order: order++ }).returning();
        sectionByLecture.set(l.externalId, sec.id);
        stats.sections++;
        const chapters = splitChapters(l.title, fixLecture(l.contentMdApp));
        await tx.insert(lectureChapters).values(chapters.map((c, i) => ({
          sectionId: sec.id,
          title: c.title.slice(0, 300),
          contentMd: c.contentMd,
          order: i + 1,
          isPublished: true,
          createdBy: author.id,
        })));
        stats.chapters += chapters.length;
      }

      const loose = studioQuestions.filter((q) => q.sectionCode === s.code && !q.lectureExternalId);
      let looseSectionId: string | undefined;
      if (loose.length) {
        const [sec] = await tx.insert(sections).values({
          moduleId: mod.id,
          title: lecs.length ? "Pytania utrwalające" : s.title,
          order: order++,
        }).returning();
        looseSectionId = sec.id;
        stats.sections++;
      }

      const qs = studioQuestions
        .filter((q) => q.sectionCode === s.code)
        .sort((a, b) => a.externalId.localeCompare(b.externalId));
      const rows = qs.map((q, i) => {
        let imageUrl: string | null = q.imageUrl ? fixAssets(q.imageUrl) : null;
        let config = q.questionType === "multiple_choice" ? null : fixDeep(q.questionConfig);
        let ok = !unsupported.has(q.externalId);
        // Hotspot: grafika pytania jest zarazem planszą do klikania
        if (q.questionType === "hotspot" && config?.config) {
          if (!isAsset(config.config.imageUrl) && isAsset(imageUrl)) {
            config.config.imageUrl = imageUrl;
            imageUrl = null;
          }
          if (!isAsset(config.config.imageUrl)) ok = false;
        }
        // Przypadek kliniczny: zapis EKG należy do przypadku (rysuje go ClinicalCaseQuestion),
        // nie do karty pytania. Eksport dokłada config.imageUrl = assets/… obok kodu GFX.
        if (q.questionType === "clinical_case" && config?.config) {
          if (!isAsset(config.config.imageUrl) && isAsset(imageUrl)) config.config.imageUrl = imageUrl;
          if (!isAsset(config.config.imageUrl)) delete config.config.imageUrl;
          imageUrl = null;
          // Krok „wskaż na zapisie" bez pliku grafiki jest nie do rozwiązania
          const steps: any[] = Array.isArray(config.config.steps) ? config.config.steps : [];
          if (steps.some((st) => st?.kind === "hotspot") && !config.config.imageUrl) ok = false;
          if (steps.length < 2) ok = false;
        }
        if (imageUrl && !isAsset(imageUrl)) imageUrl = null;
        const published = ok && (allPublished || q.status === "zatwierdzone");
        published ? stats.published++ : stats.draft++;
        return {
          sectionId: (q.lectureExternalId && sectionByLecture.get(q.lectureExternalId)) || looseSectionId!,
          title: q.title ? String(q.title).slice(0, 300) : null,
          bodyMd: fixAssets(q.bodyMd),
          imageUrl,
          answers: q.answers ?? [],
          explanationMd: fixAssets(q.explanationMd ?? ""),
          tags: [...(q.tags ?? []), `studio:${q.externalId}`],
          difficulty: q.difficulty ?? "medium",
          status: published ? "published" : "draft",
          order: i + 1,
          createdBy: author.id,
          questionType: q.questionType,
          questionConfig: config,
        };
      });
      if (rows.some((r) => !r.sectionId)) throw new Error(`Pytanie bez sekcji w ${s.code}`);
      for (let i = 0; i < rows.length; i += 200) {
        await tx.insert(questions).values(rows.slice(i, i + 200) as any);
      }
    }
  });

  console.log("Import zakończony:", stats);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
