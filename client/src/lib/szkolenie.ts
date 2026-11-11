import { useQuery } from "@tanstack/react-query";

/** Typy odpowiedzi tras /api/szkolenie (server/szkolenie/serwis.ts) */

export interface ZapisSzkolenia {
  id: string;
  zawod: string;
  zawodNazwa: string;
  pwz: string | null;
  pwzOstrzezenie: string | null;
  specjalizacja: string | null;
  imie: string;
  nazwisko: string;
  oswiadczenieAt: string;
  zablokowany: boolean;
  punkty: number | null;
  powodBezPunktow: string | null;
}

export interface StanModuluSzkolenia {
  id: string;
  externalId: string | null;
  tytul: string;
  kolejnosc: number;
  wyklady: { ukonczone: number; wszystkie: number };
  podsumowanie: { jest: boolean; otwarte: boolean };
  cwiczenia: { opanowane: number; wszystkie: number; wymagane: boolean };
  ukonczony: boolean;
  ukonczonyAt: string | null;
}

export type StanPodejsc =
  | { stan: "zaliczony" | "w_toku" | "mozna"; wykorzystane: number; pozostale: number }
  | { stan: "przerwa"; wykorzystane: number; pozostale: number; od: string }
  | { stan: "wyczerpane"; wykorzystane: number; pozostale: 0 };

export interface PodejscieTestu {
  id: string;
  nr: number;
  startedAt: string;
  submittedAt: string | null;
  wynik: number | null;
  maks: number | null;
  procent: number | null;
  zaliczony: boolean | null;
}

export interface ZasadyTestu {
  liczbaPytan: number;
  prog: number;
  limit: number;
  przerwaPo: number;
  przerwaGodziny: number;
}

export interface ZaswiadczenieSzkolenia {
  numer: string;
  /** Klucz linku weryfikacji /zaswiadczenie/<klucz> */
  klucz: string;
  zawod: string;
  zawodNazwa: string;
  punkty: number | null;
  powodBezPunktow: string | null;
  godziny: number;
  wydano: string;
  wazne: boolean;
}

export interface StanSzkolenia {
  wlaczone: boolean;
  godziny: number;
  tytul: string;
  cwiczeniaWymagane: boolean;
  regulaminOpublikowany: boolean;
  pwzTryb: "ostrzezenie" | "blokada" | "wylaczona";
  zapisy: ZapisSzkolenia[];
  moduly: StanModuluSzkolenia[];
  test: { odblokowany: boolean; stan: StanPodejsc; zasady: ZasadyTestu; pulaPusta: boolean; podejscia: PodejscieTestu[] };
  ankieta: { wypelniona: boolean; dostepna: boolean };
  zaswiadczenia: ZaswiadczenieSzkolenia[];
}

export const SZKOLENIE_KEY = ["/api/szkolenie"] as const;

export function useSzkolenie(enabled = true) {
  return useQuery<StanSzkolenia | { wlaczone: false }>({
    queryKey: SZKOLENIE_KEY,
    queryFn: async () => {
      const res = await fetch("/api/szkolenie", { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    enabled,
    staleTime: 0,
    retry: false,
  });
}

export const czyStan = (d: StanSzkolenia | { wlaczone: false } | undefined): d is StanSzkolenia => !!d && "zapisy" in d;

/** Komunikat z odpowiedzi serwera („400: {"error":"…"}” → „…”) */
export function bladSerwera(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  try {
    return JSON.parse(raw.slice(raw.indexOf("{"))).error ?? raw;
  } catch {
    return raw.replace(/^\d{3}:\s*/, "") || "Spróbuj ponownie.";
  }
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", ...o });
export const dataPL = (d: string | Date) => fmt({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
export const dataGodzinaPL = (d: string | Date) =>
  fmt({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

export const liczbaPL = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));
