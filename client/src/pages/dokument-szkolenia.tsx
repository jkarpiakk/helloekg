import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { LectureContent } from "@/components/lecture/LectureContent";
import { renderMarkdown } from "@/components/lecture/lectureData";
import { sanitizeMarkdown } from "@/lib/sanitize";

type Rodzaj = "program" | "regulamin";

/**
 * Program szkolenia (ze studia, course_documents) i regulamin szkolenia (docs/regulamin-szkolenia.md).
 * Regulamin przed publikacją: widzi go tylko właściciel i admin, z wyraźnym oznaczeniem „szkic”.
 */
export default function DokumentSzkolenia({ rodzaj }: { rodzaj: Rodzaj }) {
  const { data, isLoading, isError } = useQuery<{ tresc: string | null; wersja?: string; szkic?: boolean }>({
    queryKey: ["/api/szkolenie", rodzaj],
    queryFn: async () => {
      const res = await fetch(`/api/szkolenie/${rodzaj}`, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    retry: false,
  });
  const tytul = rodzaj === "program" ? "Program szkolenia" : "Regulamin szkolenia";
  const html = useMemo(() => (data?.tresc && rodzaj === "program" ? renderMarkdown(data.tresc) : ""), [data, rodzaj]);

  return (
    <div className="wrap wrap--narrow pt-6 pb-24 sm:pt-10 grid gap-6" data-testid={`dokument-${rodzaj}`}>
      <Link href="/szkolenie" className="inline-flex items-center gap-2 min-h-[44px] text-sub text-[var(--txt2)] no-underline hover:text-[var(--txt)]">
        <ArrowLeft className="h-4 w-4" aria-hidden />Szkolenie
      </Link>
      {isLoading ? (
        <div className="min-h-[30vh] grid place-items-center"><LoadingSpinner size="lg" /></div>
      ) : isError || !data?.tresc ? (
        <>
          <p className="label">Szkolenie z punktami</p>
          <h1 className="h2">{tytul}</h1>
          <p className="lead">Dokument jest w przygotowaniu. Pytania: kontakt@helloekg.pl</p>
        </>
      ) : (
        <>
          {data.szkic && (
            <p className="rounded-xl border border-[var(--alarm)] px-4 py-3 text-ui" role="note" data-testid="dokument-szkic">
              SZKIC: dokument nie jest jeszcze opublikowany i nie obowiązuje. Widzi go tylko zespół helloEKG.
            </p>
          )}
          {rodzaj === "program" ? (
            <>
              <p className="label">Szkolenie z punktami</p>
              <LectureContent html={html} canSeeGaps={false} />
            </>
          ) : (
            <div className="prose-hk" dangerouslySetInnerHTML={sanitizeMarkdown(data.tresc)} />
          )}
        </>
      )}
    </div>
  );
}
