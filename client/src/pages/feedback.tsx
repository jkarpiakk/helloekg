import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { rise, stagger } from "@/lib/motion";
import FeedbackStatusPill from "@/components/feedback/FeedbackStatusPill";
import {
  FEEDBACK_AREAS,
  FEEDBACK_CONTENT_TYPE,
  FEEDBACK_MAX_FILES,
  FEEDBACK_MAX_FILE_BYTES,
  FEEDBACK_MIN_DESCRIPTION,
  FEEDBACK_TYPES,
  feedbackAreaForPath,
  feedbackAreaLabel,
  feedbackTypeLabel,
  isFeedbackArea,
  type FeedbackArea,
  type FeedbackType,
  type MyFeedbackReport,
} from "@shared/feedback";

type Mine = { hintSeen: boolean; reports: MyFeedbackReport[] };
type Picked = { id: string; file: File; url: string };

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || "";

/** Bezpieczny adres powrotu: tylko ścieżka w tej aplikacji */
function safeFrom(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/zgloszenie")) return null;
  return raw.slice(0, 500);
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(new Error("Nie udało się odczytać pliku."));
    r.readAsDataURL(file);
  });
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function FeedbackPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const from = safeFrom(params.get("from"));
  const initialArea: FeedbackArea = useMemo(() => {
    const a = params.get("area");
    if (isFeedbackArea(a)) return a;
    return from ? feedbackAreaForPath(from) : "inne";
  }, [params, from]);

  const [description, setDescription] = useState("");
  const [descTouched, setDescTouched] = useState(false);
  const [area, setArea] = useState<FeedbackArea>(initialArea);
  const [type, setType] = useState<FeedbackType>("dzialanie");
  const [files, setFiles] = useState<Picked[]>([]);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setArea(initialArea), [initialArea]);
  // Podglądy zwalniamy przy wyjściu ze strony
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);

  const { data: mine } = useQuery<Mine>({ queryKey: ["/api/feedback/mine"], enabled: isAuthenticated });

  const descTrimmed = description.trim();
  const descError =
    descTouched && descTrimmed.length < FEEDBACK_MIN_DESCRIPTION
      ? descTrimmed.length === 0
        ? "Opisz, co się stało albo czego ci brakuje."
        : `Dopisz jeszcze ${FEEDBACK_MIN_DESCRIPTION - descTrimmed.length} zn. — jedno pełne zdanie wystarczy.`
      : "";

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (!incoming.length) return;
    const next = [...files];
    let error = "";
    for (const file of incoming) {
      if (!ACCEPT.includes(file.type)) {
        error = `„${file.name}” to nie obraz PNG, JPG ani WEBP.`;
        continue;
      }
      if (file.size > FEEDBACK_MAX_FILE_BYTES) {
        error = `„${file.name}” ma ponad 5 MB. Zmniejsz go albo przytnij zrzut.`;
        continue;
      }
      if (next.length >= FEEDBACK_MAX_FILES) {
        error = `Możesz dodać najwyżej ${FEEDBACK_MAX_FILES} zrzuty.`;
        break;
      }
      next.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file) });
    }
    setFiles(next);
    setFileError(error);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const f = prev.find((p) => p.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((p) => p.id !== id);
    });
    setFileError("");
  }

  const submit = useMutation({
    mutationFn: async () => {
      const attachments = await Promise.all(files.map(async (f) => ({ name: f.file.name, data: await readAsBase64(f.file) })));
      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": FEEDBACK_CONTENT_TYPE },
        body: JSON.stringify({
          description: descTrimmed,
          area,
          type,
          pagePath: from ?? undefined,
          context: {
            viewport: `${window.innerWidth}×${window.innerHeight}@${window.devicePixelRatio || 1}x`,
            appVersion: APP_VERSION || undefined,
          },
          attachments,
        }),
      });
      if (!res.ok) {
        let msg = res.status === 413 ? "Załączniki są za duże. Każdy zrzut może mieć najwyżej 5 MB." : "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* odpowiedź bez JSON */
        }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      files.forEach((f) => URL.revokeObjectURL(f.url));
      setFiles([]);
      setDescription("");
      setDescTouched(false);
      setFileError("");
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/mine"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDescTouched(true);
    if (descTrimmed.length < FEEDBACK_MIN_DESCRIPTION) {
      descRef.current?.focus();
      return;
    }
    submit.mutate();
  };

  if (!isAuthenticated) return null;

  return (
    <div className="bg-[var(--ink)]">
      <div className="wrap wrap--narrow safe-bottom pb-16 pt-8 sm:pt-12">
        {from && (
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-6 gap-1.5 px-3">
            <Link href={from} data-testid="feedback-back">
              <ArrowLeft aria-hidden />
              Wróć
            </Link>
          </Button>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {sent ? (
            <motion.section
              key="sent"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid gap-4 border-b border-[var(--line)] pb-12"
              aria-live="polite"
              data-testid="feedback-success"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--puls-deep)] bg-[var(--tint)] text-[var(--puls)]">
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <p className="label label--g">Zgłoszenie wysłane</p>
              <h1 className="h2">Dzięki. Mamy to.</h1>
              <p className="lead">
                Czytamy każde zgłoszenie. Status zobaczysz poniżej w „Twoich zgłoszeniach” — tam też pojawi się nasza notatka, gdy coś poprawimy.
              </p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                {from ? (
                  <Button asChild>
                    <Link href={from}>Wróć do poprzedniej strony</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/dashboard">Wróć do kursu</Link>
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSent(false)} data-testid="feedback-another">
                  Zgłoś coś jeszcze
                </Button>
              </div>
            </motion.section>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              onPaste={(e) => {
                if (e.clipboardData.files.length) {
                  e.preventDefault();
                  addFiles(e.clipboardData.files);
                }
              }}
              variants={stagger(0.04)}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -12 }}
              className="grid gap-10"
              noValidate
              data-testid="feedback-form"
            >
              <motion.header variants={rise} className="grid gap-3">
                <p className="label">Beta · Zgłoszenie</p>
                <h1 className="h2">Zgłoś uwagę</h1>
                <p className="lead">
                  Błąd w treści, coś nie działa, pomysł — wszystko się przyda. Zgłoszenie podpisze się twoim kontem, nie musisz podawać danych.
                </p>
              </motion.header>

              {/* 1 · Opis */}
              <motion.div variants={rise} className="grid gap-3">
                <label htmlFor="feedback-description" className="label">
                  01 · Co się stało?
                </label>
                <Textarea
                  id="feedback-description"
                  ref={descRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => setDescTouched(true)}
                  rows={5}
                  maxLength={5000}
                  placeholder="Np. w wykładzie o bloku przedsionkowo-komorowym II stopnia opis Mobitza I i II jest zamieniony."
                  className="min-h-[140px] text-[1rem] leading-[1.6]"
                  aria-invalid={descError ? true : undefined}
                  aria-describedby="feedback-description-hint"
                  data-testid="feedback-description"
                />
                <p
                  id="feedback-description-hint"
                  className={`text-[.875rem] ${descError ? "text-[var(--alarm)]" : "text-[var(--txt2)]"}`}
                  role={descError ? "alert" : undefined}
                >
                  {descError || "Napisz, co widzisz i czego oczekiwano. Co najmniej 10 znaków."}
                </p>
              </motion.div>

              {/* 2 · Obszar */}
              <motion.fieldset variants={rise} className="grid gap-3">
                <legend className="label mb-3">02 · Czego dotyczy?</legend>
                <div className="chips" role="group" aria-label="Obszar zgłoszenia">
                  {FEEDBACK_AREAS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      className="chip min-h-[44px]"
                      aria-pressed={area === a.value}
                      onClick={() => setArea(a.value)}
                      data-testid={`feedback-area-${a.value}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </motion.fieldset>

              {/* 3 · Typ */}
              <motion.fieldset variants={rise} className="grid gap-3">
                <legend className="label mb-3">03 · Co to jest?</legend>
                <div className="grid gap-2" role="radiogroup" aria-label="Typ zgłoszenia">
                  {FEEDBACK_TYPES.map((t) => {
                    const on = type === t.value;
                    return (
                      <label key={t.value} className={`opt ${on ? "is-picked" : ""}`} data-testid={`feedback-type-${t.value}`}>
                        <input
                          type="radio"
                          name="feedback-type"
                          value={t.value}
                          checked={on}
                          onChange={() => setType(t.value)}
                          className="sr-only"
                        />
                        <span className="opt__key" aria-hidden>
                          <span
                            className={`h-2.5 w-2.5 rounded-full transition-[opacity,transform] duration-200 ${on ? "scale-100 bg-[var(--puls)] opacity-100" : "scale-50 opacity-0"}`}
                          />
                        </span>
                        <span className="grid gap-0.5">
                          <span className="text-[.9375rem] font-medium text-[var(--txt)]">{t.label}</span>
                          <span className="text-[.875rem] text-[var(--txt2)]">{t.description}</span>
                        </span>
                        <span className="opt__mark" aria-hidden>
                          {on && <Check className="h-4 w-4 text-[var(--puls)]" />}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </motion.fieldset>

              {/* 4 · Zrzuty ekranu */}
              <motion.div variants={rise} className="grid gap-3">
                <p className="label" id="feedback-files-label">
                  04 · Zrzut ekranu <span className="normal-case tracking-normal text-[var(--txt2)]">(opcjonalnie)</span>
                </p>
                <label
                  htmlFor="feedback-files"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed px-5 py-5 transition-[border-color,background-color] duration-200 ${
                    dragging ? "border-[var(--puls-deep)] bg-[var(--tint)]" : "border-[var(--line2)] hover:border-[var(--txt3)]"
                  } ${files.length >= FEEDBACK_MAX_FILES ? "pointer-events-none opacity-50" : ""}`}
                  data-testid="feedback-dropzone"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--line2)] text-[var(--txt2)]">
                    <ImagePlus className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="grid gap-0.5">
                    <span className="text-[.9375rem] font-medium text-[var(--txt)]">Przeciągnij, wklej albo wybierz plik</span>
                    <span className="text-[.875rem] text-[var(--txt2)]">PNG, JPG lub WEBP · do 5 MB · najwyżej {FEEDBACK_MAX_FILES} pliki</span>
                  </span>
                  <input
                    ref={fileInput}
                    id="feedback-files"
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    multiple
                    className="sr-only"
                    aria-labelledby="feedback-files-label"
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                    disabled={files.length >= FEEDBACK_MAX_FILES}
                    data-testid="feedback-files"
                  />
                </label>


                {fileError && (
                  <p className="text-[.875rem] text-[var(--alarm)]" role="alert">
                    {fileError}
                  </p>
                )}

                {files.length > 0 && (
                  <ul className="grid grid-cols-3 gap-3" aria-label="Dodane zrzuty">
                    <AnimatePresence initial={false}>
                      {files.map((f) => (
                        <motion.li
                          key={f.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]"
                        >
                          <img src={f.url} alt={f.file.name} className="aspect-[4/3] w-full object-cover" />
                          <span className="block truncate px-2.5 py-1.5 text-[.75rem] text-[var(--txt2)]">{f.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(f.id)}
                            aria-label={`Usuń ${f.file.name}`}
                            className="material-bar absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-full border border-[var(--line2)] text-[var(--txt)] transition-transform duration-150 active:scale-[.97]"
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </motion.div>

              <motion.div variants={rise} className="grid gap-4 border-t border-[var(--line)] pt-6">
                {submit.isError && (
                  <p className="text-[.9375rem] text-[var(--alarm)]" role="alert" data-testid="feedback-error">
                    {(submit.error as Error).message}
                  </p>
                )}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-[34em] text-[.8125rem] leading-[1.55] text-[var(--txt2)]">
                    Dołączymy też adres strony{from ? <> (<span className="font-mono">{from.split("?")[0]}</span>)</> : null}, przeglądarkę i rozmiar ekranu — to pomaga odtworzyć problem.
                  </p>
                  <Button type="submit" disabled={submit.isPending} className="w-full sm:w-auto" data-testid="feedback-submit">
                    {submit.isPending ? "Wysyłam…" : "Wyślij zgłoszenie"}
                  </Button>
                </div>
              </motion.div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Twoje zgłoszenia */}
        {mine && mine.reports.length > 0 && (
          <section className="mt-16 grid gap-5" aria-labelledby="my-feedback-title" data-testid="my-feedback">
            <div className="grid gap-1">
              <p className="label">Historia</p>
              <h2 id="my-feedback-title" className="h3">
                Twoje zgłoszenia
              </h2>
            </div>
            <ol className="rows">
              {mine.reports.map((r, i) => (
                <li key={r.id} className="grid gap-2 border-b border-[var(--line)] py-5">
                  <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:gap-4">
                    <span className="row__n pt-1 num">{String(mine.reports.length - i).padStart(2, "0")}</span>
                    <div className="grid min-w-0 gap-1">
                      <p className="line-clamp-2 text-[.9375rem] leading-[1.5] text-[var(--txt)]">{r.description}</p>
                      <p className="text-[.8125rem] text-[var(--txt2)]">
                        {r.kind === "question" ? "Błąd w pytaniu" : feedbackTypeLabel(r.type)} · {feedbackAreaLabel(r.area)} · {fmtDate(r.createdAt)}
                        {r.attachmentCount > 0 && ` · ${r.attachmentCount} zrzut${r.attachmentCount === 1 ? "" : "y"}`}
                      </p>
                    </div>
                    <FeedbackStatusPill status={r.status} />
                  </div>
                  {r.adminNote && (
                    <p className="ml-[48px] border-l-2 border-[var(--puls-deep)] pl-3 text-[.875rem] leading-[1.55] text-[var(--txt2)] sm:ml-[64px]">
                      <span className="label mr-2">Zespół</span>
                      {r.adminNote}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
