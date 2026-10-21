/**
 * Import paczki eksportu z helloEKG Studio (create.helloekg.pl → /api/transfer/export.zip)
 * do bazy kursu.
 *
 *   DATABASE_URL=... npx tsx server/scripts/importStudioExport.ts <rozpakowany-katalog> [--all-published] [--dry-run] [--replace]
 *
 * Domyślnie SYNCHRONIZACJA: moduły, tematy i pytania są dopasowywane po identyfikatorach studia
 * (modules.external_id = kod sekcji, sections.external_id = id wykładu, pytania po tagu studio:<id>)
 * i aktualizowane w miejscu — id w bazie zostają, więc odpowiedzi i postępy kursantów też.
 * Rozdziały tematu są podmieniane w całości (nie mają postępów). Pytanie usunięte w studiu
 * dostaje status draft (nie znika, bo wiszą na nim odpowiedzi). --dry-run tylko liczy zmiany.
 * --replace: dawny tryb — kasuje całą treść i postępy, buduje od zera.
 *
 * Mapowanie: sekcja studia → moduł, wykład → sekcja (rozdziały = nagłówki ##),
 * pytania bez wykładu → sekcja „Pytania utrwalające" na końcu modułu.
 * Grafiki: assets/<hash>.<ext> → /content-assets/<hash>.<ext> (katalog CONTENT_ASSETS_DIR).
 *
 * UWAGA (tylko --replace): zastępuje CAŁĄ treść kursu razem z postępami.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { users, modules, sections, lectureChapters, questions } from "@shared/schema";

const dir = process.argv[2];
const allPublished = process.argv.includes("--all-published");
const dryRun = process.argv.includes("--dry-run");
const replaceAll = process.argv.includes("--replace");
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
/**
 * Linia `::grafika GFX-NNNN` w treści lub wyjaśnieniu pytania → obrazek z paczki eksportu
 * (studio zamienia ją tylko w wykładach). Kod bez pliku: linia znika, zamiast pokazać się jako tekst.
 */
const studioGraphics: Array<{ code: string; assetPath: string | null; altText: string | null; title: string }> =
  fs.existsSync(path.join(dir, "graphics.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "graphics.json"), "utf8")) : [];
const gfxByCode = new Map(studioGraphics.map((g) => [g.code, g]));
const gfxLines = (s: string) =>
  s.replace(/^::grafika[ \t]+(GFX-\d+)[ \t]*$/gim, (_m, code: string) => {
    const g = gfxByCode.get(code.toUpperCase());
    if (!g?.assetPath) return "";
    const alt = (g.altText || g.title || "").replace(/[\[\]\n\r]/g, " ").trim();
    return `![${alt}](${g.assetPath})`;
  }).replace(/\n{3,}/g, "\n\n");
const fixAssets = (s: string) => gfxLines(s).replace(ASSET_RE, "$1/content-assets/$2");
const fixDeep = (v: any): any =>
  typeof v === "string" ? fixAssets(v)
  : Array.isArray(v) ? v.map(fixDeep)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fixDeep(x)]))
  : v;
/** Treść wykładu: znaczniki zamiast tekstowych zaślepek studia — renderer kursu decyduje, co pokazać */
const fixLecture = (md: string) =>
  fixAssets(md).replace(/\*\[Grafika w przygotowaniu: (GFX-\d+)\]\*/g, '<div data-gfx-pending="$1"></div>');
/**
 * Interaktywne wstawki kursu, których studio jeszcze nie zna jako dyrektyw.
 * „Serce to orkiestra” (mapa: struktura przewodząca ↔ element zapisu) stoi po pierwszym akapicie
 * rozdziału, który właśnie to omawia. Gdy studio dostanie dyrektywę, ten wpis do usunięcia.
 */
const WIDGETS: Array<{ chapterTitle: string; widget: string }> = [
  { chapterTitle: "Od układu przewodzącego do zapisu EKG", widget: "orchestra" },
];
const withWidgets = (c: { title: string; contentMd: string }) => {
  const w = WIDGETS.find((x) => x.chapterTitle === c.title);
  if (!w || c.contentMd.includes("data-widget")) return c;
  return { ...c, contentMd: c.contentMd.replace(/\n\n/, `\n\n<div data-widget="${w.widget}"></div>\n\n`) };
};
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


/**
 * Kolejność pytań w temacie kursu (kurs podaje nowe pytania od najniższego `order`):
 * kolejność ze studia, a przy remisie przeplatanie typów zaczynając od ABCD. Studio numeruje
 * pytania utrwalające osobno w każdym typie (1-5), więc temat nie zaczyna się już od pięciu
 * drag&drop pod rząd (zgłoszenie JK 21.10).
 */
const TYPE_PRIORITY = ["multiple_choice", "matching", "sorting", "fill_blank", "drag_drop", "clinical_case", "hotspot"];
function courseOrder(qs: any[]): Map<string, number> {
  const groups = new Map<string, any[]>();
  for (const q of qs) {
    const key = q.lectureExternalId || "_loose";
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  const pos = new Map<string, number>();
  for (const g of Array.from(groups.values())) {
    g.slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)
        || TYPE_PRIORITY.indexOf(a.questionType) - TYPE_PRIORITY.indexOf(b.questionType)
        || a.externalId.localeCompare(b.externalId))
      .forEach((q, i) => pos.set(q.externalId, i));
  }
  return pos;
}

/** Wiersz pytania kursu z pytania studia (wspólne dla obu trybów) */
function questionRow(q: any, i: number, sectionId: string | undefined, authorId: string, stats: { published: number; draft: number }) {
        let imageUrl: string | null = q.imageUrl ? fixAssets(q.imageUrl) : null;
        let config = q.questionType === "multiple_choice" ? null : fixDeep(q.questionConfig);
        let ok = !unsupported.has(q.externalId);
        // Pytania z interaktywną wstawką studia (::wstawka → bodyMdApp z data-widget) zostają szkicem,
        // dopóki kurs nie umie jej narysować — inaczej kursant zobaczyłby pytanie bez kardiomonitora
        if (q.bodyMdApp || (q.tags ?? []).includes("kardiomonitor") || /::wstawka\b/.test(q.bodyMd ?? "")) ok = false;
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
          sectionId: sectionId!,
          title: q.title ? String(q.title).slice(0, 300) : null,
          bodyMd: fixAssets(q.bodyMd),
          imageUrl,
          answers: q.answers ?? [],
          explanationMd: fixAssets(q.explanationMd ?? ""),
          tags: [...(q.tags ?? []), `studio:${q.externalId}`],
          difficulty: q.difficulty ?? "medium",
          status: published ? "published" : "draft",
          order: i + 1,
          createdBy: authorId,
          questionType: q.questionType,
          questionConfig: config,
        };
      }

const LOOSE = (code: string) => `${code}:utrwalajace`;

async function sync(authorId: string) {
  const st = { modules: { added: 0, updated: 0 }, sections: { added: 0, updated: 0 }, chapters: 0, questions: { added: 0, updated: 0, retired: 0 }, published: 0, draft: 0 };
  const DryRun = new Error("dry-run");
  try {
    await db.transaction(async (tx) => {
      const allMods = await tx.select().from(modules);
      const allSecs = await tx.select().from(sections);
      const seenQ = new Set<string>();

      for (const s of [...studioSections].sort((a, b) => a.order - b.order)) {
        // moduł: po kodzie studia, a przy pierwszej synchronizacji po tytule
        let mod = allMods.find((m) => m.externalId === s.code) ?? allMods.find((m) => !m.externalId && m.title === s.title);
        if (mod) {
          await tx.update(modules).set({ externalId: s.code, title: s.title, order: s.order, updatedAt: new Date() }).where(eq(modules.id, mod.id));
          st.modules.updated++;
        } else {
          [mod] = await tx.insert(modules).values({ externalId: s.code, title: s.title, order: s.order }).returning();
          st.modules.added++;
        }
        const modSecs = allSecs.filter((x) => x.moduleId === mod!.id);
        const lecs = studioLectures.filter((l) => l.sectionCode === s.code).sort((a, b) => a.order - b.order);
        const sectionByLecture = new Map<string, string>();
        let order = 1;

        // Pierwsza synchronizacja: tytuły w studiu bywają poprawiane (myślnik → dwukropek, słowo inaczej),
        // więc porównujemy bez interpunkcji, a w ostateczności po miejscu tematu w module.
        const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, " ").trim();
        const claimed = new Set<string>();
        const unmatched = () => modSecs.filter((x) => !x.externalId && !claimed.has(x.id) && !/utrwal/i.test(x.title)).sort((a, b) => a.order - b.order);
        const upsertSection = async (externalId: string, title: string, lectureIndex?: number) => {
          let sec =
            allSecs.find((x) => x.externalId === externalId) ??
            modSecs.find((x) => !x.externalId && !claimed.has(x.id) && norm(x.title) === norm(title)) ??
            modSecs.find((x) => !x.externalId && !claimed.has(x.id) && norm(x.title).slice(0, 18) === norm(title).slice(0, 18)) ??
            (lectureIndex !== undefined ? unmatched()[0] : undefined);
          if (sec) claimed.add(sec.id);
          if (sec && sec.title !== title) console.log(`  zmiana tytułu: „${sec.title}” → „${title}”`);
          if (sec) {
            await tx.update(sections).set({ externalId, moduleId: mod!.id, title, order, updatedAt: new Date() }).where(eq(sections.id, sec.id));
            st.sections.updated++;
          } else {
            [sec] = await tx.insert(sections).values({ externalId, moduleId: mod!.id, title, order }).returning();
            st.sections.added++;
          }
          order++;
          return sec!.id;
        };

        for (const l of lecs) {
          const secId = await upsertSection(l.externalId, l.title, 0);
          sectionByLecture.set(l.externalId, secId);
          const chapters = splitChapters(l.title, fixLecture(l.contentMdApp)).map(withWidgets);
          await tx.delete(lectureChapters).where(eq(lectureChapters.sectionId, secId));
          await tx.insert(lectureChapters).values(chapters.map((c, i) => ({
            sectionId: secId, title: c.title.slice(0, 300), contentMd: c.contentMd, order: i + 1, isPublished: true, createdBy: authorId,
          })));
          st.chapters += chapters.length;
        }

        const qs = studioQuestions.filter((q) => q.sectionCode === s.code).sort((a, b) => a.externalId.localeCompare(b.externalId));
        let looseId: string | undefined;
        if (qs.some((q) => !q.lectureExternalId)) {
          looseId = await upsertSection(LOOSE(s.code), lecs.length ? "Pytania utrwalające" : s.title);
        }

        const pos = courseOrder(qs);
        for (let i = 0; i < qs.length; i++) {
          const q = qs[i];
          seenQ.add(q.externalId);
          const row = questionRow(q, pos.get(q.externalId) ?? i, (q.lectureExternalId && sectionByLecture.get(q.lectureExternalId)) || looseId, authorId, st);
          if (!row.sectionId) throw new Error(`Pytanie bez tematu: ${q.externalId}`);
          const [existing] = await tx.select({ id: questions.id }).from(questions)
            .where(sql`${questions.tags}::jsonb ? ${"studio:" + q.externalId}`).limit(1);
          if (existing) {
            const { createdBy: _c, ...upd } = row as any;
            await tx.update(questions).set({ ...upd, updatedAt: new Date() }).where(eq(questions.id, existing.id));
            st.questions.updated++;
          } else {
            await tx.insert(questions).values(row as any);
            st.questions.added++;
          }
        }
      }

      // Pytania ze studia, których już nie ma w eksporcie: wycofane, ale zachowane (wiszą na nich odpowiedzi)
      const studioTagged = await tx.select({ id: questions.id, tags: questions.tags, status: questions.status }).from(questions)
        .where(sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${questions.tags}::jsonb) t WHERE t LIKE 'studio:%')`);
      const retire = studioTagged.filter((r) => r.status !== "draft" && !(r.tags ?? []).some((t) => t.startsWith("studio:") && seenQ.has(t.slice(7)))).map((r) => r.id);
      if (retire.length) await tx.update(questions).set({ status: "draft", updatedAt: new Date() }).where(inArray(questions.id, retire));
      st.questions.retired = retire.length;

      if (dryRun) throw DryRun;
    });
  } catch (e) {
    if (e !== DryRun) throw e;
    console.log("PRÓBA (nic nie zapisano):");
  }
  console.log("Synchronizacja:", JSON.stringify(st));
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

  if (!replaceAll) {
    await sync(author.id);
    await pool.end();
    return;
  }

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
        const chapters = splitChapters(l.title, fixLecture(l.contentMdApp)).map(withWidgets);
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
      const pos = courseOrder(qs);
      const rows = qs.map((q, i) =>
        questionRow(q, pos.get(q.externalId) ?? i, (q.lectureExternalId && sectionByLecture.get(q.lectureExternalId)) || looseSectionId, author.id, stats),
      );
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
