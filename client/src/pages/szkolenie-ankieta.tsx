import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { bladSerwera, SZKOLENIE_KEY } from "@/lib/szkolenie";
import type { Ankieta } from "@shared/szkolenie";

interface StanAnkiety {
  dostepna: boolean;
  wypelniona: boolean;
  ankieta: Ankieta;
}

/** Anonimowa ankieta ewaluacyjna po zaliczeniu testu, przed zaświadczeniem. Bez treści sprzedażowych. */
export default function SzkolenieAnkieta() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);
  const { data, isLoading } = useQuery<StanAnkiety>({
    queryKey: ["/api/szkolenie/ankieta"],
    queryFn: async () => (await apiRequest("GET", "/api/szkolenie/ankieta")).json(),
    enabled: isAuthenticated,
    staleTime: 0,
  });
  const [odp, setOdp] = useState<Record<string, number | boolean | string>>({});
  const [blad, setBlad] = useState<string | null>(null);
  const [wyslano, setWyslano] = useState(false);

  const wyslij = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/szkolenie/ankieta", { odpowiedzi: odp }),
    onSuccess: () => {
      setWyslano(true);
      qc.invalidateQueries({ queryKey: SZKOLENIE_KEY });
      qc.invalidateQueries({ queryKey: ["/api/szkolenie/ankieta"] });
      window.scrollTo(0, 0);
    },
    onError: (e) => setBlad(bladSerwera(e)),
  });

  if (!isAuthenticated) return null;
  if (isLoading || !data) return <div className="min-h-[60vh] grid place-items-center"><LoadingSpinner size="lg" /></div>;

  const naglowek = (
    <>
      <Link href="/szkolenie" className="inline-flex items-center gap-2 min-h-[44px] text-sub text-[var(--txt2)] no-underline hover:text-[var(--txt)]">
        <ArrowLeft className="h-4 w-4" aria-hidden />Szkolenie
      </Link>
      <p className="label">Szkolenie z punktami</p>
      <h1 className="h1">Ankieta</h1>
    </>
  );

  if (wyslano || data.wypelniona) {
    return (
      <div className="wrap wrap--narrow pt-6 pb-24 sm:pt-10 grid gap-6" data-testid="ankieta-dziekujemy">
        {naglowek}
        <p className="lead inline-flex items-center gap-2"><Check className="h-5 w-5 text-[var(--puls)]" aria-hidden />Dziękujemy! Ankieta jest zapisana.</p>
        <div><Button asChild data-testid="do-zaswiadczenia"><Link href="/szkolenie#krok-zaswiadczenie">Odbierz zaświadczenie</Link></Button></div>
      </div>
    );
  }
  if (!data.dostepna) {
    return (
      <div className="wrap wrap--narrow pt-6 pb-24 sm:pt-10 grid gap-6">
        {naglowek}
        <p className="lead">Ankieta otworzy się po zaliczeniu testu końcowego.</p>
      </div>
    );
  }

  const ustaw = (id: string, v: number | boolean | string) => setOdp((p) => ({ ...p, [id]: v }));
  return (
    <form
      className="wrap wrap--narrow pt-6 pb-24 sm:pt-10 grid gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        setBlad(null);
        wyslij.mutate();
      }}
      data-testid="ankieta"
      noValidate
    >
      <div className="grid gap-4">{naglowek}</div>
      <p className="lead">Odpowiedzi są anonimowe: zapisujemy je bez powiązania z twoim kontem, a w dzienniku szkolenia zostaje tylko informacja, że ankieta jest wypełniona.</p>
      {data.ankieta.pytania.map((p, n) => (
        <fieldset key={p.id} className="grid gap-3 border-t border-[var(--line)] pt-6" data-testid={`ankieta-${p.id}`}>
          <legend className="text-body font-medium mb-3">
            {n + 1}. {p.tresc}{!p.wymagane && <span className="text-[var(--txt2)] font-normal"> (opcjonalnie)</span>}
          </legend>
          {p.typ === "skala" && (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={p.tresc}>
                {[1, 2, 3, 4, 5].map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={odp[p.id] === o}
                    onClick={() => ustaw(p.id, o)}
                    className={cn("h-11 w-11 rounded-lg border num text-body", odp[p.id] === o ? "border-[var(--puls-deep)] bg-[var(--tint)]" : "border-[var(--line2)]")}
                    data-testid={`ankieta-${p.id}-${o}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
              <p className="text-note text-[var(--txt2)]">1: zdecydowanie źle, 5: bardzo dobrze</p>
            </div>
          )}
          {p.typ === "tak_nie" && (
            <div className="flex gap-2" role="radiogroup" aria-label={p.tresc}>
              {[{ v: true, t: "Tak" }, { v: false, t: "Nie" }].map((o) => (
                <button
                  key={o.t}
                  type="button"
                  role="radio"
                  aria-checked={odp[p.id] === o.v}
                  onClick={() => ustaw(p.id, o.v)}
                  className={cn("min-h-[44px] px-5 rounded-lg border text-body", odp[p.id] === o.v ? "border-[var(--puls-deep)] bg-[var(--tint)]" : "border-[var(--line2)]")}
                  data-testid={`ankieta-${p.id}-${o.v ? "tak" : "nie"}`}
                >
                  {o.t}
                </button>
              ))}
            </div>
          )}
          {p.typ === "tekst" && (
            <Textarea rows={4} maxLength={2000} value={String(odp[p.id] ?? "")} onChange={(e) => ustaw(p.id, e.target.value)} aria-label={p.tresc} data-testid={`ankieta-${p.id}-tekst`} />
          )}
        </fieldset>
      ))}
      {blad && <p className="text-ui text-[var(--alarm)]" role="alert">{blad}</p>}
      <div><Button type="submit" disabled={wyslij.isPending} data-testid="ankieta-wyslij">{wyslij.isPending ? "Wysyłam…" : "Wyślij ankietę"}</Button></div>
    </form>
  );
}
