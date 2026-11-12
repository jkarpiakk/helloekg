import { createContext, useContext, useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { MiejsceObrazu, StanObrazu } from "@shared/brakObrazu";

/**
 * Obraz pytania, który się nie wyświetla (zgłoszenie JK 11.11: przypadek Q-0040 bez paska EKG).
 * Nigdy nie rysujemy pytania tak, jakby obrazu nie miało być: w jego miejscu stoi ramka
 * „Zapis EKG chwilowo niedostępny, zgłosiliśmy to”, a odtwarzacz sam wysyła zgłoszenie
 * (POST /api/report-error, treść składa serwer z kodu studia pytania).
 */

/** Pytanie, którego obrazy rysujemy (do zgłoszenia). Ustawia karta pytania. */
export const PytanieObrazow = createContext<string | null>(null);

/** Jedno zgłoszenie na pytanie, miejsce i obraz w tej karcie przeglądarki (serwer też odsiewa powtórki) */
const zgloszone = new Set<string>();

export function useZglosBrakObrazu() {
  const questionId = useContext(PytanieObrazow);
  return (dane: { stan: StanObrazu; miejsce: MiejsceObrazu; kod?: string; url?: string }) => {
    if (!questionId) return;
    const klucz = [questionId, dane.miejsce, dane.kod ?? "", dane.url ?? ""].join("|");
    if (zgloszone.has(klucz)) return;
    zgloszone.add(klucz);
    apiRequest("POST", "/api/report-error", { questionId, automatyczne: { powod: "brak-obrazu", ...dane } })
      .catch(() => zgloszone.delete(klucz)); // np. bez sieci: spróbujemy przy następnym wyświetleniu
  };
}

/** Obraz, który nie wczytał się: `onError` dla <img>, stan zeruje się przy zmianie adresu */
export function useBladObrazu(src: string | undefined | null) {
  const [zly, setZly] = useState<string | null>(null);
  return { zepsuty: !!src && zly === src, onError: () => setZly(src ?? null) };
}

interface BrakObrazuProps {
  stan: StanObrazu;
  miejsce: MiejsceObrazu;
  kod?: string;
  url?: string;
  /** Mniejsza ramka w kafelku („Wybierz zapis”) */
  kompakt?: boolean;
  className?: string;
}

export function BrakObrazu({ stan, miejsce, kod, url, kompakt = false, className }: BrakObrazuProps) {
  const zglos = useZglosBrakObrazu();
  useEffect(() => {
    zglos({ stan, miejsce, kod, url });
    // zgłoszenie raz na wyświetlenie tego braku
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stan, miejsce, kod, url]);
  return (
    <div
      role="img"
      aria-label="Zapis EKG chwilowo niedostępny, zgłosiliśmy to"
      className={cn(
        "grid w-full place-items-center gap-2 rounded-lg border border-dashed border-[var(--line2)] bg-[var(--ink)] text-center text-[var(--txt2)]",
        kompakt ? "min-h-[120px] px-3 py-4 text-meta" : "min-h-[180px] px-5 py-8 text-ui",
        className,
      )}
      data-testid="brak-obrazu"
      data-stan={stan}
    >
      <ImageOff className={kompakt ? "h-5 w-5" : "h-6 w-6"} aria-hidden />
      <p className="max-w-[32ch]">Zapis EKG chwilowo niedostępny, zgłosiliśmy to.</p>
    </div>
  );
}

/** Prosty obraz pytania (test szkolenia): przy błędzie wczytania ramka zamiast pękniętego obrazka */
export function ObrazLubBrak({ src, className }: { src: string; className?: string }) {
  const { zepsuty, onError } = useBladObrazu(src);
  if (zepsuty) return <BrakObrazu stan="blad-ladowania" miejsce="pytanie" url={src} />;
  return <img src={src} alt="Zapis EKG" className={className} onError={onError} />;
}
