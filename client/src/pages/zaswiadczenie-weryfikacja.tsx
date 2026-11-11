import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Weryfikacja {
  numer: string;
  wazne: boolean;
  tytul: string;
  dataWydania: string;
  inicjaly: string;
}

/**
 * Publiczna weryfikacja zaświadczenia po losowym kluczu z linku i kodu QR w PDF (kolejnego numeru
 * nie da się tu wpisać): numer, ważność, tytuł szkolenia, data wydania i inicjały. Bez logowania, bez PWZ.
 */
export default function ZaswiadczenieWeryfikacja() {
  const { klucz } = useParams<{ klucz: string }>();
  const { data, isLoading, isError } = useQuery<Weryfikacja>({
    queryKey: ["/api/zaswiadczenia", klucz],
    queryFn: async () => {
      const res = await fetch(`/api/zaswiadczenia/${encodeURIComponent(klucz ?? "")}`, { credentials: "omit" });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    retry: false,
    enabled: !!klucz,
  });

  return (
    <div className="wrap wrap--narrow pt-16 pb-24 grid gap-6" data-testid="weryfikacja">
      <p className="label">Weryfikacja zaświadczenia</p>
      {isLoading ? (
        <div className="min-h-[30vh] grid place-items-center"><LoadingSpinner size="lg" /></div>
      ) : isError || !data ? (
        <>
          <h1 className="h2 inline-flex items-center gap-3"><XCircle className="h-8 w-8 text-[var(--alarm)]" aria-hidden />Nie znaleziono zaświadczenia</h1>
          <p className="lead">Użyj pełnego linku z zaświadczenia albo zeskanuj kod QR. Sam numer zaświadczenia nie wystarczy. Pytania: kontakt@helloekg.pl</p>
        </>
      ) : (
        <>
          <h1 className="h2 inline-flex items-center gap-3" data-testid="weryfikacja-stan">
            {data.wazne
              ? <><CheckCircle2 className="h-8 w-8 text-[var(--puls)]" aria-hidden />Zaświadczenie ważne</>
              : <><XCircle className="h-8 w-8 text-[var(--alarm)]" aria-hidden />Zaświadczenie unieważnione</>}
          </h1>
          <dl className="rows grid">
            {[
              ["Numer", data.numer],
              ["Szkolenie", data.tytul],
              ["Data wydania", data.dataWydania],
              ["Uczestnik (inicjały)", data.inicjaly],
            ].map(([k, v]) => (
              <div key={k} className="row py-4 grid-cols-[minmax(0,1fr)] sm:grid-cols-[200px_minmax(0,1fr)] gap-1">
                <dt className="label">{k}</dt>
                <dd className="text-body" data-testid={`weryfikacja-${k}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-ui text-[var(--txt2)]">Wydawca: helloEKG. Pytania o zaświadczenie: kontakt@helloekg.pl</p>
        </>
      )}
    </div>
  );
}
