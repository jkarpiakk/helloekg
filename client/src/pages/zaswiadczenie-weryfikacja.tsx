import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface Weryfikacja {
  numer: string;
  wazne: boolean;
  /** Data unieważnienia (DD.MM.RRRR) albo null */
  uniewaznione: string | null;
  rodzaj: "punkty" | "ukonczenie";
  rodzajNazwa: string;
  punkty: number | null;
  zawod: string;
  zawodDeklarowany: boolean;
  godziny: number;
  etykietaGodzin: string;
  tytul: string;
  dataWydania: string;
  inicjaly: string;
}

const liczba = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

/**
 * Publiczna weryfikacja zaświadczenia po losowym kluczu z linku i kodu QR w PDF (kolejnego numeru
 * nie da się tu wpisać): numer, ważność, rodzaj (z punktami albo bez), punkty, zawód, godziny, tytuł,
 * data wydania i inicjały. Rodzaj i punkty są po to, żeby dopisanie punktów w PDF nie przeszło weryfikacji.
 * Bez logowania, bez PWZ.
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
          {!data.wazne && (
            <p className="lead" data-testid="weryfikacja-uniewaznione">
              To zaświadczenie zostało unieważnione{data.uniewaznione && data.uniewaznione !== "tak" ? ` ${data.uniewaznione}` : ""} i nie potwierdza ukończenia szkolenia ani punktów.
            </p>
          )}
          <dl className="rows grid">
            {[
              ["Numer", data.numer],
              ["Rodzaj", data.rodzajNazwa],
              ["Punkty edukacyjne", data.punkty !== null ? liczba(data.punkty) : "bez punktów"],
              [data.zawodDeklarowany ? "Deklarowany zawód" : "Zawód", data.zawodDeklarowany ? `${data.zawod} (podany przez uczestnika, niesprawdzony w rejestrze)` : data.zawod],
              [data.etykietaGodzin, liczba(data.godziny)],
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
          <p className="text-ui text-[var(--txt2)]">Porównaj rodzaj i liczbę punktów z dokumentem: inne wartości na wydruku oznaczają, że dokument zmieniono. Wydawca: helloEKG. Pytania o zaświadczenie: kontakt@helloekg.pl</p>
        </>
      )}
    </div>
  );
}
