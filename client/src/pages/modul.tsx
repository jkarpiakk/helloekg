import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { LectureContent } from "@/components/lecture/LectureContent";
import { renderMarkdown } from "@/components/lecture/lectureData";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { bladSerwera, SZKOLENIE_KEY } from "@/lib/szkolenie";

interface ModulStrona {
  id: string;
  tytul: string;
  kolejnosc: number;
  szkolenie: boolean;
  podsumowanieMd: string | null;
  bibliografiaMd: string | null;
}

const cleanTitle = (title: string) => title.replace(/^\s*moduł\s*\d+\s*[:.–—-]\s*/i, "");

/** Strona modułu: podsumowanie (jego otwarcie liczy się do ukończenia modułu), bibliografia, „Napisz do prowadzącego”. */
export default function ModulPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);

  const { data: m, isLoading, isError } = useQuery<ModulStrona>({
    queryKey: ["/api/szkolenie/moduly", id],
    queryFn: async () => (await apiRequest("GET", `/api/szkolenie/moduly/${id}`)).json(),
    enabled: isAuthenticated && !!id,
  });

  // Podsumowanie wyświetlone = otwarte (raz na wejście)
  const zgloszone = useRef<string | null>(null);
  useEffect(() => {
    if (!m?.podsumowanieMd || zgloszone.current === m.id) return;
    zgloszone.current = m.id;
    apiRequest("POST", `/api/szkolenie/moduly/${m.id}/podsumowanie`)
      .then(() => qc.invalidateQueries({ queryKey: SZKOLENIE_KEY }))
      .catch(() => {});
  }, [m, qc]);

  const podsumowanie = useMemo(() => (m?.podsumowanieMd ? renderMarkdown(m.podsumowanieMd) : ""), [m?.podsumowanieMd]);
  const bibliografia = useMemo(() => (m?.bibliografiaMd ? renderMarkdown(m.bibliografiaMd) : ""), [m?.bibliografiaMd]);

  if (!isAuthenticated) return null;
  if (isLoading) return <div className="min-h-[60vh] grid place-items-center"><LoadingSpinner size="lg" /></div>;
  if (isError || !m) {
    return (
      <div className="wrap wrap--narrow pt-16 pb-24 grid gap-5 justify-items-start">
        <p className="label">Moduł</p>
        <h1 className="h2">Nie ma takiego modułu</h1>
        <Button asChild><Link href="/modules">Wróć do kursu</Link></Button>
      </div>
    );
  }

  return (
    <div className="wrap wrap--narrow pt-6 pb-24 sm:pt-10 grid gap-12" data-testid="modul">
      <Link href={`/modules#m-${m.id}`} className="inline-flex items-center gap-2 min-h-[44px] text-sub text-[var(--txt2)] no-underline hover:text-[var(--txt)]">
        <ArrowLeft className="h-4 w-4" aria-hidden />Kurs
      </Link>
      <header className="grid gap-3">
        <p className="label">{m.szkolenie ? "Moduł szkolenia" : "Moduł dodatkowy, poza szkoleniem z punktami"}</p>
        <h1 className="h1">{cleanTitle(m.tytul)}</h1>
      </header>

      <section className="grid gap-4" aria-labelledby="podsumowanie">
        <h2 id="podsumowanie" className="h3">Podsumowanie</h2>
        {podsumowanie ? (
          <div data-testid="modul-podsumowanie"><LectureContent html={podsumowanie} canSeeGaps={false} /></div>
        ) : (
          <p className="text-body text-[var(--txt2)]">Podsumowanie tego modułu jest w przygotowaniu.</p>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="bibliografia">
        <h2 id="bibliografia" className="h3">Bibliografia</h2>
        {bibliografia ? (
          <div data-testid="modul-bibliografia"><LectureContent html={bibliografia} canSeeGaps={false} /></div>
        ) : (
          <p className="text-body text-[var(--txt2)]">Bibliografia tego modułu jest w przygotowaniu.</p>
        )}
      </section>

      <DoProwadzacego modulId={m.id} />
    </div>
  );
}

function DoProwadzacego({ modulId }: { modulId: string }) {
  const [tresc, setTresc] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [wyslano, setWyslano] = useState(false);
  const wyslij = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/szkolenie/moduly/${modulId}/do-prowadzacego`, { tresc }),
    onSuccess: () => {
      setWyslano(true);
      setTresc("");
    },
    onError: (e) => setBlad(bladSerwera(e)),
  });
  return (
    <section className="grid gap-4 border-t border-[var(--line)] pt-10" aria-labelledby="do-prowadzacego">
      <h2 id="do-prowadzacego" className="h3">Napisz do prowadzącego</h2>
      <p className="text-body text-[var(--txt2)]">Pytanie o treść modułu trafi do zespołu merytorycznego helloEKG. Odpowiemy mailem.</p>
      {wyslano ? (
        <div className="grid gap-3 justify-items-start" role="status">
          <p className="text-body inline-flex items-center gap-2" data-testid="prowadzacy-wyslano"><Check className="h-4 w-4 text-[var(--puls)]" aria-hidden />Wiadomość wysłana. Dziękujemy!</p>
          <Button variant="outline" size="sm" onClick={() => setWyslano(false)}>Napisz kolejną</Button>
        </div>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBlad(null);
            if (tresc.trim().length < 10) return setBlad("Napisz co najmniej 10 znaków.");
            wyslij.mutate();
          }}
        >
          <label htmlFor="prowadzacy-tresc" className="sr-only">Twoje pytanie</label>
          <Textarea id="prowadzacy-tresc" rows={5} maxLength={5000} value={tresc} onChange={(e) => setTresc(e.target.value)} placeholder="Twoje pytanie" data-testid="prowadzacy-tresc" />
          {blad && <p className="text-ui text-[var(--alarm)]" role="alert">{blad}</p>}
          <div><Button type="submit" disabled={wyslij.isPending} data-testid="prowadzacy-wyslij">{wyslij.isPending ? "Wysyłam…" : "Wyślij"}</Button></div>
        </form>
      )}
    </section>
  );
}
