import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Circle, CircleDot, ExternalLink, Minus } from "lucide-react";
import {
  LEARNING_RANGES,
  MIN_ANSWERS_PER_QUESTION,
  TESTER_STATUS_LABEL,
  type LearningAnalytics as LearningData,
  type LearningQuestion,
  type LearningTester,
  type TesterStatus,
} from "@shared/learningAnalytics";

const STUDIO_URL = "https://create.helloekg.pl";

const pct = (v: number | null | undefined) => (v == null ? "–" : `${Math.round(v * 100)}%`);
const secs = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s` : `${Math.round(ms / 1000)} s`);
const date = (iso: string) => new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "2-digit" });

function ago(iso: string | null): string {
  if (!iso) return "nigdy";
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return `dziś, ${d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "ABCD",
  drag_drop: "Przeciąganie",
  fill_blank: "Luki",
  matching: "Dopasowanie",
  sorting: "Kolejność",
  hotspot: "Wskaż na obrazie",
  clinical_case: "Przypadek",
};

const STATUS_STYLE: Record<TesterStatus, string> = {
  bez_startu: "border-[var(--txt3)] text-[var(--txt)]",
  przerwa: "border-[var(--alarm)] text-[var(--txt)]",
  rzadziej: "border-[var(--line2)] text-[var(--txt2)]",
  na_biezaco: "border-[var(--puls-deep)] bg-[var(--tint)] text-[var(--puls)]",
};

const STATUS_ICON: Record<TesterStatus, typeof Check> = {
  bez_startu: Minus,
  przerwa: AlertTriangle,
  rzadziej: CircleDot,
  na_biezaco: Circle,
};

/** Status testera: kolor + ikona + słowo */
function StatusPill({ status }: { status: TesterStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-mono text-[.75rem] uppercase tracking-[.12em] ${STATUS_STYLE[status]}`}
      data-testid={`learning-status-${status}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {TESTER_STATUS_LABEL[status]}
    </span>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="grid content-start gap-1 border-t border-[var(--line)] pt-3">
      <dt className="label">{label}</dt>
      <dd className="num text-[1.75rem] leading-none text-[var(--txt)]">{value}</dd>
      {note && <dd className="text-[13px] text-[var(--txt3)]">{note}</dd>}
    </div>
  );
}

function SectionHead({ label, title, children }: { label: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="grid gap-1">
      <p className="label">{label}</p>
      <h3 className="h3">{title}</h3>
      {children && <p className="max-w-[46em] text-[15px] text-[var(--txt2)]">{children}</p>}
    </header>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="border-y border-[var(--line)] py-8 text-center text-[15px] text-[var(--txt2)]">{children}</p>
);

function TesterRow({ t }: { t: LearningTester }) {
  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 border-b border-[var(--line)] py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_176px]"
      data-testid={`learning-tester-${t.id}`}
    >
      <span className="grid min-w-0 gap-1">
        <span className="truncate text-[15px] text-[var(--txt)]">
          {t.name || <span className="text-[var(--txt3)]">Bez imienia</span>}
          {t.role !== "student" && <span className="ml-2 font-mono text-[11px] uppercase tracking-[.12em] text-[var(--label)]">{t.role}</span>}
        </span>
        <a href={`mailto:${t.email}`} className="truncate text-[13px] text-[var(--txt3)] underline-offset-2 hover:text-[var(--txt2)] hover:underline">
          {t.email}
        </a>
      </span>
      <span className="order-last col-span-2 grid gap-0.5 text-[13px] text-[var(--txt2)] md:order-none md:col-span-1">
        <span>Ostatnio: {ago(t.lastActiveAt)}</span>
        <span className="text-[var(--txt3)]">
          Konto od {date(t.createdAt)} · dni z nauką: <span className="num">{t.activeDays}</span>
        </span>
      </span>
      <span className="order-last col-span-2 grid gap-0.5 text-[13px] text-[var(--txt2)] md:order-none md:col-span-1">
        <span>
          Odpowiedzi: <span className="num text-[var(--txt)]">{t.answersInRange}</span>
          <span className="text-[var(--txt3)]"> w okresie · {t.answersTotal} razem</span>
        </span>
        <span className="text-[var(--txt3)]">
          Poprawne: {pct(t.correctRate)} · wykłady: {t.lecturesFinished}/{t.lecturesOpened} doczytane
        </span>
      </span>
      <span className="justify-self-end">
        <StatusPill status={t.status} />
      </span>
    </li>
  );
}

type QuestionList = keyof LearningData["questions"];

const QUESTION_LISTS: Array<{ key: QuestionList; label: string; intro: string; empty: string }> = [
  {
    key: "suspicious",
    label: "Podejrzane",
    intro: "Błędną odpowiedź wybiera tyle samo osób co poprawną albo więcej. Najczęściej znaczy to błąd w kluczu albo niejasne sformułowanie, a nie trudne pytanie. Tylko ABCD.",
    empty: "Żadne pytanie ABCD nie ma błędnej odpowiedzi wybieranej częściej niż poprawna.",
  },
  {
    key: "hard",
    label: "Trudne",
    intro: "Połowa osób albo mniej odpowiada dobrze za pierwszym razem.",
    empty: "Żadne pytanie nie ma wyniku 50% lub niższego.",
  },
  {
    key: "slow",
    label: "Długie",
    intro: "Najdłuższy środkowy czas odpowiedzi. Może to być złożony przypadek, a może nieczytelny obrazek albo zawiła treść.",
    empty: "Za mało odpowiedzi, żeby porównać czasy.",
  },
  {
    key: "reported",
    label: "Zgłaszane",
    intro: "Pytania ze zgłoszeniami „Zgłoś błąd” od początku bety. Szczegóły w zakładce Zgłoszenia.",
    empty: "Nikt nie zgłosił błędu w pytaniu.",
  },
];

function QuestionRow({ q, list }: { q: LearningQuestion; list: QuestionList }) {
  return (
    <li className="grid gap-2 border-b border-[var(--line)] py-4" data-testid={`learning-question-${q.id}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="min-w-0 text-[15px] leading-[1.5] text-[var(--txt)]">{q.text || "(pytanie bez treści tekstowej)"}</p>
        {q.studioId && (
          <a
            href={`${STUDIO_URL}/pytania/${encodeURIComponent(q.studioId)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[13px] text-[var(--txt2)] underline-offset-2 hover:text-[var(--txt)] hover:underline"
          >
            W studiu <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>
      <p className="text-[13px] text-[var(--txt3)]">
        {q.moduleTitle} · {q.sectionTitle} · {TYPE_LABEL[q.type] ?? q.type}
        {q.studioId && <span className="font-mono"> · {q.studioId}</span>}
      </p>
      <p className="text-[13px] text-[var(--txt2)]">
        {q.answers > 0 ? (
          <>
            <span className="num text-[var(--txt)]">{q.answers}</span> os. · poprawnie {pct(q.correctRate)} · środkowy czas {secs(q.medianTimeMs)}
          </>
        ) : (
          "Brak odpowiedzi w tym okresie"
        )}
        {q.reports > 0 && <> · zgłoszenia: <span className="num text-[var(--txt)]">{q.reports}</span></>}
      </p>
      {list === "suspicious" && q.topWrong && (
        <dl className="grid gap-1 border-l-2 border-[var(--line2)] pl-3 text-[13px]">
          <div>
            <dt className="inline text-[var(--txt3)]">Klucz: </dt>
            <dd className="inline text-[var(--txt)]">
              {q.correctText} <span className="text-[var(--txt3)]">({q.correctPicks} os.)</span>
            </dd>
          </div>
          <div>
            <dt className="inline text-[var(--txt3)]">Najczęstsza błędna: </dt>
            <dd className="inline text-[var(--txt)]">
              {q.topWrong.text} <span className="text-[var(--txt3)]">({q.topWrong.picks} os.)</span>
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}

export default function LearningAnalytics() {
  const [days, setDays] = useState<number>(30);
  const [staff, setStaff] = useState(false);
  const [list, setList] = useState<QuestionList>("suspicious");

  const { data, isLoading, isError } = useQuery<LearningData>({
    queryKey: [`/api/admin/analytics/learning?days=${days}${staff ? "&staff=1" : ""}`],
    staleTime: 60_000,
  });

  const current = QUESTION_LISTS.find((l) => l.key === list)!;
  const s = data?.summary;
  const needAttention = data?.testers.filter((t) => t.status === "bez_startu" || t.status === "przerwa").length ?? 0;

  return (
    <section className="grid gap-10" data-testid="learning-analytics">
      <header className="grid gap-4">
        <div className="grid gap-1">
          <p className="label">Beta</p>
          <h2 className="h3">Panel nauki</h2>
          <p className="max-w-[46em] text-[15px] text-[var(--txt2)]">
            Kto z testerów się uczy, które pytania warto poprawić i gdzie ludzie przestają czytać. Liczone z odpowiedzi,
            otwartych wykładów i zgłoszeń, które kurs już zapisuje.
          </p>
        </div>
        <div className="chips" role="group" aria-label="Okres">
          {LEARNING_RANGES.map((d) => (
            <button key={d} type="button" className="chip" aria-pressed={days === d} onClick={() => setDays(d)} data-testid={`learning-range-${d}`}>
              {d} dni
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={staff} onClick={() => setStaff((v) => !v)} data-testid="learning-staff">
            Z kontami zespołu
          </button>
        </div>
      </header>

      {isLoading ? (
        <p className="label" role="status">
          Liczę statystyki…
        </p>
      ) : isError || !data || !s ? (
        <p className="text-[15px] text-[var(--alarm)]" role="alert">
          Nie udało się pobrać statystyk. Odśwież stronę.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4" data-testid="learning-summary">
            <Stat label="Testerzy" value={s.testers} note={`+${s.newInRange} w okresie`} />
            <Stat label="Aktywni" value={s.activeInRange} note={`dziś: ${s.activeToday}`} />
            <Stat label="Odpowiedzi" value={s.answersInRange} note={`poprawne: ${pct(s.correctRate)}`} />
            <Stat label="Otwarte wykłady" value={s.lectureOpensInRange} note={`zgłoszenia: ${s.reportsInRange}`} />
          </dl>

          <section className="grid gap-4">
            <SectionHead label={`Testerzy · ${data.testers.length}`} title="Kto się uczy">
              Na górze osoby, które nie zaczęły albo nie wracają od ponad 5 dni
              {needAttention > 0 ? ` (teraz: ${needAttention})` : ""}. Warto do nich napisać: adres jest linkiem.
              {!data.includeStaff && " Bez kont zespołu."}
            </SectionHead>
            {data.testers.length ? (
              <ul className="border-t border-[var(--line)]" data-testid="learning-testers">
                {data.testers.map((t) => (
                  <TesterRow key={t.id} t={t} />
                ))}
              </ul>
            ) : (
              <Empty>Nie ma jeszcze kont testerów. Włącz „Z kontami zespołu”, żeby zobaczyć własne.</Empty>
            )}
          </section>

          <section className="grid gap-4">
            <SectionHead label="Pytania" title="Do przejrzenia">
              Liczy się pierwsze podejście każdej osoby, od {date(data.questionsSince)}. Pytanie trafia na listę, gdy odpowiedziały
              na nie co najmniej {MIN_ANSWERS_PER_QUESTION} osoby.
            </SectionHead>
            <div className="chips" role="group" aria-label="Lista pytań">
              {QUESTION_LISTS.map((l) => (
                <button key={l.key} type="button" className="chip" aria-pressed={list === l.key} onClick={() => setList(l.key)} data-testid={`learning-list-${l.key}`}>
                  {l.label}
                  <span className="num text-[var(--txt3)]">{data.questions[l.key].length}</span>
                </button>
              ))}
            </div>
            <p className="max-w-[46em] text-[14px] text-[var(--txt3)]">{current.intro}</p>
            {data.questions[list].length ? (
              <ul className="border-t border-[var(--line)]" data-testid={`learning-questions-${list}`}>
                {data.questions[list].map((q) => (
                  <QuestionRow key={q.id} q={q} list={list} />
                ))}
              </ul>
            ) : (
              <Empty>{current.empty}</Empty>
            )}
          </section>

          <section className="grid gap-4">
            <SectionHead label={`Wykłady · ${data.lectures.length}`} title="Gdzie przestają czytać">
              Kurs pamięta ostatni otwarty rozdział każdej osoby, więc „doczytane” znaczy: doszła do ostatniego rozdziału. Stan na
              dziś, niezależnie od okresu.
            </SectionHead>
            {data.lectures.some((l) => l.opened || l.quizzers) ? (
              <ul className="border-t border-[var(--line)]" data-testid="learning-lectures">
                {data.lectures.map((l) => (
                  <li
                    key={l.sectionId}
                    className={`grid gap-2 border-b border-[var(--line)] py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-6 ${l.opened || l.quizzers ? "" : "opacity-50"}`}
                    data-testid={`learning-lecture-${l.sectionId}`}
                  >
                    <span className="grid min-w-0 gap-0.5">
                      <span className="text-[15px] text-[var(--txt)]">{l.title}</span>
                      <span className="truncate text-[13px] text-[var(--txt3)]">
                        {l.moduleTitle}
                        {l.chapters > 0 && ` · ${l.chapters} rozdz.`}
                      </span>
                    </span>
                    <span className="grid content-start gap-1.5 text-[13px] text-[var(--txt2)]">
                      {l.chapters > 0 ? (
                        <>
                          <span>
                            Otwarło <span className="num text-[var(--txt)]">{l.opened}</span> · doczytało{" "}
                            <span className="num text-[var(--txt)]">{l.finished}</span>
                          </span>
                          {l.opened > 0 && (
                            <span className="progress" aria-hidden>
                              <span style={{ "--w": l.finished / l.opened } as React.CSSProperties} />
                            </span>
                          )}
                          {l.commonStopChapter != null && (
                            <span className="text-[var(--txt3)]">
                              Najczęściej stoją na rozdziale {l.commonStopChapter} ({l.commonStopCount} os.)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[var(--txt3)]">Bez wykładu, same pytania</span>
                      )}
                    </span>
                    <span className="grid content-start gap-0.5 text-[13px] text-[var(--txt2)]">
                      <span>
                        Pytania: <span className="num text-[var(--txt)]">{l.quizzers}</span> os.
                      </span>
                      {l.avgMastery != null && <span className="text-[var(--txt3)]">Średnie opanowanie: {l.avgMastery}%</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nikt jeszcze nie otworzył wykładu ani nie odpowiedział na pytania.</Empty>
            )}
          </section>
        </>
      )}
    </section>
  );
}
