import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import FeedbackStatusPill from "@/components/feedback/FeedbackStatusPill";
import {
  FEEDBACK_AREAS,
  FEEDBACK_NOTE_REQUIRED,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  feedbackAreaLabel,
  feedbackTypeLabel,
  type AdminFeedbackReport,
  type AdminFeedbackResponse,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@shared/feedback";

type Filters = { status: string; area: string; type: string; source: string };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

const typeLabelOf = (r: Pick<AdminFeedbackReport, "kind" | "type">) =>
  r.kind === "question" && !r.type ? "Błąd w pytaniu" : feedbackTypeLabel(r.type);

function initialReportId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("report");
  } catch {
    return null;
  }
}

export default function FeedbackAdminPanel() {
  const [filters, setFilters] = useState<Filters>({ status: "all", area: "all", type: "all", source: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(initialReportId);

  const qs = new URLSearchParams(filters).toString();
  const { data, isLoading, isError } = useQuery<AdminFeedbackResponse>({
    queryKey: [`/api/admin/feedback?${qs}`],
    staleTime: 30_000,
  });

  const selected = useMemo(() => data?.items.find((i) => i.id === selectedId) ?? null, [data, selectedId]);
  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  const counts = data?.counts;
  const statusChips: Array<{ value: string; label: string; n?: number }> = [
    { value: "all", label: "Wszystkie", n: counts?.total },
    ...FEEDBACK_STATUSES.map((s) => ({ value: s.value, label: s.label, n: counts?.[s.value] })),
  ];

  return (
    <section className="grid gap-6" data-testid="feedback-admin">
      <header className="grid gap-1">
        <p className="label">Beta</p>
        <h2 className="h3">Zgłoszenia testerów</h2>
        <p className="text-[15px] text-[var(--txt2)]">
          Formularz „Zgłoś uwagę” i zgłoszenia „Zgłoś błąd” przy pytaniach. Każde nowe zgłoszenie z formularza idzie też mailem.
        </p>
      </header>

      <div className="chips" role="group" aria-label="Status">
        {statusChips.map((c) => (
          <button
            key={c.value}
            type="button"
            className="chip"
            aria-pressed={filters.status === c.value}
            onClick={() => set("status", c.value)}
            data-testid={`feedback-admin-status-${c.value}`}
          >
            {c.label}
            <span className="num text-[var(--txt3)]">{c.n ?? "–"}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={filters.source} onValueChange={(v) => set("source", v)}>
          <SelectTrigger aria-label="Źródło">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie źródła</SelectItem>
            <SelectItem value="feedback">Formularz „Zgłoś uwagę”</SelectItem>
            <SelectItem value="question">„Zgłoś błąd” przy pytaniu</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.area} onValueChange={(v) => set("area", v)}>
          <SelectTrigger aria-label="Obszar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Każdy obszar</SelectItem>
            {FEEDBACK_AREAS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.type} onValueChange={(v) => set("type", v)}>
          <SelectTrigger aria-label="Typ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Każdy typ</SelectItem>
            {FEEDBACK_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="label" role="status">
          Ładuję zgłoszenia…
        </p>
      ) : isError ? (
        <p className="text-[15px] text-[var(--alarm)]" role="alert">
          Nie udało się pobrać zgłoszeń. Odśwież stronę.
        </p>
      ) : !data?.items.length ? (
        <p className="border-y border-[var(--line)] py-10 text-center text-[15px] text-[var(--txt2)]">Brak zgłoszeń dla tych filtrów.</p>
      ) : (
        <ul className="rows" data-testid="feedback-admin-list">
          {data.items.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-[var(--line)] py-4 text-left transition-[background-color,transform] duration-150 hover:bg-[color-mix(in_srgb,var(--txt)_2%,transparent)] active:scale-[.995] md:grid-cols-[110px_minmax(0,1fr)_170px_auto]"
                data-testid={`feedback-admin-row-${r.id}`}
              >
                <span className="hidden pt-0.5 font-mono text-[12px] text-[var(--label)] md:block">{fmt(r.createdAt)}</span>
                <span className="grid min-w-0 gap-1">
                  <span className="line-clamp-2 text-[15px] leading-[1.45] text-[var(--txt)]">{r.description}</span>
                  <span className="truncate text-[13px] text-[var(--txt3)]">
                    <span className="md:hidden">{fmt(r.createdAt)} · </span>
                    {r.userName} · {r.userEmail}
                    {r.attachments.length > 0 && (
                      <>
                        {" · "}
                        <ImageIcon className="inline h-3.5 w-3.5 align-[-2px]" aria-label="Załączniki" /> {r.attachments.length}
                      </>
                    )}
                  </span>
                </span>
                <span className="hidden text-[13px] leading-[1.45] text-[var(--txt2)] md:grid">
                  <span>{typeLabelOf(r)}</span>
                  <span className="text-[var(--txt3)]">{feedbackAreaLabel(r.area)}</span>
                </span>
                <span className="flex items-center gap-2">
                  {r.priority && <span className="font-mono text-[12px] text-[var(--txt)]">{r.priority}</span>}
                  <FeedbackStatusPill status={r.status} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && <FeedbackDetail key={selected.id + selected.updatedAt} report={selected} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function FeedbackDetail({ report }: { report: AdminFeedbackReport }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<FeedbackStatus>(report.status);
  const [priority, setPriority] = useState<FeedbackPriority | null>(report.priority);
  const [note, setNote] = useState(report.adminNote ?? "");
  const [error, setError] = useState("");

  useEffect(() => setError(""), [status, note]);

  const noteRequired = FEEDBACK_NOTE_REQUIRED.includes(status);
  const dirty = status !== report.status || priority !== report.priority || note.trim() !== (report.adminNote ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/feedback/${report.id}`, {
        status,
        priority,
        adminNote: note.trim() || null,
      });
      return res.json() as Promise<AdminFeedbackReport>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/admin/feedback") });
      toast({ title: "Zapisano", description: "Zgłaszający zobaczy nowy status." });
    },
    onError: (e: Error) => {
      const m = e.message.replace(/^\d+:\s*/, "");
      try {
        setError(JSON.parse(m).error || m);
      } catch {
        setError(m);
      }
    },
  });

  const meta: Array<[string, React.ReactNode]> = [
    ["Od", `${report.userName} · ${report.userEmail}`],
    ["Kiedy", fmt(report.createdAt)],
    ["Typ", typeLabelOf(report)],
    ["Obszar", feedbackAreaLabel(report.area)],
  ];
  // link tylko do ścieżki w aplikacji (stare zgłoszenia mogły mieć „//host”)
  if (report.pagePath && /^\/(?![\/\\])/.test(report.pagePath))
    meta.push([
      "Strona",
      <a href={report.pagePath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-mono text-[13px] text-[var(--puls)]">
        {report.pagePath}
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      </a>,
    ]);
  if (report.questionTitle || report.questionId) meta.push(["Pytanie", report.questionTitle || report.questionId]);
  if (report.context?.sectionId) meta.push(["Sekcja", <span className="font-mono text-[12px]">{report.context.sectionId}</span>]);
  if (report.context?.viewport) meta.push(["Ekran", report.context.viewport]);
  if (report.context?.appVersion) meta.push(["Wersja", <span className="font-mono text-[12px]">{report.context.appVersion}</span>]);
  if (report.context?.userAgent) meta.push(["Przeglądarka", <span className="text-[12px] text-[var(--txt3)]">{report.context.userAgent}</span>]);

  return (
    <div className="grid gap-7 pb-8">
      <SheetHeader className="grid gap-2 pr-8 text-left">
        <p className="label">{report.kind === "question" ? "Zgłoś błąd · pytanie" : "Zgłoś uwagę"}</p>
        <SheetTitle className="h3">{typeLabelOf(report)}</SheetTitle>
        <SheetDescription asChild>
          <div>
            <FeedbackStatusPill status={report.status} />
          </div>
        </SheetDescription>
      </SheetHeader>

      <p className="whitespace-pre-wrap text-[16px] leading-[1.65] text-[var(--txt)]" data-testid="feedback-admin-description">
        {report.description}
      </p>

      <dl className="rows text-[14px]">
        {meta.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-[var(--line)] py-2.5">
            <dt className="label pt-0.5">{k}</dt>
            <dd className="min-w-0 break-words text-[var(--txt2)]">{v}</dd>
          </div>
        ))}
      </dl>

      {report.attachments.length > 0 && (
        <div className="grid gap-3">
          <p className="label">Zrzuty ekranu</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {report.attachments.map((a) => {
              const src = `/api/admin/feedback/${report.id}/attachments/${a.n}`;
              return (
                <a
                  key={a.n}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--ink)] transition-transform duration-150 active:scale-[.97]"
                  data-testid={`feedback-admin-attachment-${a.n}`}
                >
                  <img src={src} alt={a.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  <span className="block truncate px-2 py-1 text-[12px] text-[var(--txt3)]">
                    {a.name} · {Math.max(1, Math.round(a.size / 1024))} kB
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <form
        className="grid gap-5 border-t border-[var(--line)] pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (noteRequired && !note.trim()) {
            setError("Przy statusie „wdrożone” lub „odrzucone” dopisz notatkę — zobaczy ją zgłaszający.");
            return;
          }
          save.mutate();
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="label mb-2">Status</legend>
          <div className="chips">
            {FEEDBACK_STATUSES.map((s) => (
              <button key={s.value} type="button" className="chip" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="label mb-2">Priorytet</legend>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={priority === null} onClick={() => setPriority(null)}>
              Brak
            </button>
            {FEEDBACK_PRIORITIES.map((p) => (
              <button key={p} type="button" className="chip font-mono" aria-pressed={priority === p} onClick={() => setPriority(p)}>
                {p}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <label htmlFor="feedback-admin-note" className="label">
            Notatka dla zgłaszającego {noteRequired ? "· wymagana" : "· opcjonalna"}
          </label>
          <Textarea
            id="feedback-admin-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Np. Poprawione w wykładzie 2.3 — dzięki!"
            aria-invalid={error ? true : undefined}
            data-testid="feedback-admin-note"
          />
          {error && (
            <p className="text-[14px] text-[var(--alarm)]" role="alert">
              {error}
            </p>
          )}
        </div>

        <div>
          <Button type="submit" disabled={!dirty || save.isPending} data-testid="feedback-admin-save">
            {save.isPending ? "Zapisuję…" : "Zapisz"}
          </Button>
        </div>
      </form>
    </div>
  );
}
