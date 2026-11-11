/**
 * Szkolenie z punktami edukacyjnymi: wspólne dla serwera i przeglądarki (zawody, walidacja PWZ,
 * oświadczenie, ankieta). Logika testu, punktów i numeracji: server/szkolenie/logika.ts.
 */
import { z } from "zod";

export const ZAWODY = ["lekarz", "lekarz_dentysta", "pielegniarka", "polozna", "ratownik", "student", "inny"] as const;
export type Zawod = (typeof ZAWODY)[number];

/** Nazwy zawodów (formularz, panel, zaświadczenie) */
export const NAZWA_ZAWODU: Record<Zawod, string> = {
  lekarz: "lekarz",
  lekarz_dentysta: "lekarz dentysta",
  pielegniarka: "pielęgniarka / pielęgniarz",
  polozna: "położna / położny",
  ratownik: "ratownik medyczny",
  student: "student / studentka",
  inny: "inny zawód",
};

/** Zawody, w których numer PWZ jest wymagany (bez niego nie ma zaświadczenia z punktami) */
export const ZAWODY_Z_PWZ: readonly Zawod[] = ["lekarz", "lekarz_dentysta", "pielegniarka", "polozna", "ratownik"];
/** Specjalizacja (opcjonalnie) tylko dla lekarzy */
export const ZAWODY_ZE_SPECJALIZACJA: readonly Zawod[] = ["lekarz", "lekarz_dentysta"];

export const czyZawod = (v: unknown): v is Zawod => typeof v === "string" && (ZAWODY as readonly string[]).includes(v);

/** Tryb sprawdzania cyfry kontrolnej PWZ lekarza (ustawienie pwz_kontrola_lekarz) */
export const TRYBY_PWZ_LEKARZ = ["ostrzezenie", "blokada", "wylaczona"] as const;
export type TrybPwzLekarz = (typeof TRYBY_PWZ_LEKARZ)[number];

/**
 * Numer PWZ lekarza i lekarza dentysty: 7 cyfr, pierwsza to cyfra kontrolna
 * = (suma i × cyfra[i+1] dla i = 1…6) mod 11. Wynik 10 albo zero na początku: numer nieprawidłowy.
 * Zwraca opis problemu albo null. Algorytm do potwierdzenia przez JK na prawdziwych numerach,
 * dlatego domyślnie to tylko ostrzeżenie (pwz_kontrola_lekarz = "ostrzezenie").
 */
export function problemPwzLekarza(pwz: string): string | null {
  if (!/^\d{7}$/.test(pwz)) return "Numer PWZ lekarza ma 7 cyfr.";
  if (pwz[0] === "0") return "Numer PWZ lekarza nie zaczyna się od zera.";
  const d = pwz.split("").map(Number);
  let suma = 0;
  for (let i = 1; i <= 6; i++) suma += i * d[i];
  const kontrolna = suma % 11;
  if (kontrolna === 10 || kontrolna !== d[0]) return "Cyfra kontrolna numeru PWZ się nie zgadza. Sprawdź numer.";
  return null;
}

/** Pielęgniarka, położna: 7 znaków, cyfry i opcjonalnie litera P albo A na końcu (tylko ostrzeżenie) */
export function problemPwzPielegniarki(pwz: string): string | null {
  return /^(\d{7}|\d{6}[PA])$/i.test(pwz) ? null : "Numer prawa wykonywania zawodu pielęgniarki i położnej ma zwykle 7 znaków: cyfry i czasem litera P albo A na końcu. Sprawdź numer.";
}

/** Ratownik medyczny: same cyfry (tylko ostrzeżenie) */
export function problemPwzRatownika(pwz: string): string | null {
  return /^\d{1,12}$/.test(pwz) ? null : "Numer prawa wykonywania zawodu ratownika medycznego składa się z cyfr. Sprawdź numer.";
}

export type WynikPwz = { blad: string | null; ostrzezenie: string | null; pwz: string | null };

/**
 * Walidacja numeru PWZ dla zawodu. `blad` blokuje zapis, `ostrzezenie` tylko informuje.
 * Format wszędzie poza cyfrą kontrolną lekarza w trybie „blokada” jest ostrzeżeniem.
 */
export function sprawdzPwz(zawod: Zawod, surowy: string | null | undefined, trybLekarz: TrybPwzLekarz = "ostrzezenie"): WynikPwz {
  const pwz = (surowy ?? "").replace(/\s+/g, "").toUpperCase();
  if (!ZAWODY_Z_PWZ.includes(zawod)) return { blad: null, ostrzezenie: null, pwz: null };
  if (!pwz) return { blad: "Podaj numer prawa wykonywania zawodu.", ostrzezenie: null, pwz: null };
  if (pwz.length > 20) return { blad: "Numer prawa wykonywania zawodu jest za długi.", ostrzezenie: null, pwz: null };
  if (!/^[0-9A-Z]+$/.test(pwz)) return { blad: "Numer prawa wykonywania zawodu może mieć tylko cyfry i litery.", ostrzezenie: null, pwz: null };
  if (zawod === "lekarz" || zawod === "lekarz_dentysta") {
    if (trybLekarz === "wylaczona") return { blad: null, ostrzezenie: null, pwz };
    const p = problemPwzLekarza(pwz);
    return trybLekarz === "blokada" ? { blad: p, ostrzezenie: null, pwz } : { blad: null, ostrzezenie: p, pwz };
  }
  if (zawod === "pielegniarka" || zawod === "polozna") return { blad: null, ostrzezenie: problemPwzPielegniarki(pwz), pwz };
  return { blad: null, ostrzezenie: problemPwzRatownika(pwz), pwz };
}

/** Oświadczenie o prawdziwości danych (treść zapisywana przy zapisie; zmiana = nowa wersja tekstu) */
export const OSWIADCZENIE =
  "Oświadczam, że podane dane są prawdziwe i zgodne z moim prawem wykonywania zawodu. Wiem, że na ich podstawie helloEKG wystawi zaświadczenie o ukończeniu szkolenia.";

/** Imię i nazwisko jak w PWZ: litery (także polskie), spacja, łącznik, apostrof */
export const czescNazwiska = (label: string) =>
  z.string().trim().min(1, `Podaj ${label}`).max(60, `${label[0].toUpperCase()}${label.slice(1)} jest za długie`)
    .regex(/^[\p{L}][\p{L}\p{M} '’.-]*$/u, `Sprawdź ${label}: tylko litery, spacja albo łącznik`);

export const zapisSchema = z.object({
  imie: czescNazwiska("imię"),
  nazwisko: czescNazwiska("nazwisko"),
  oswiadczenie: z.literal(true, { message: "Potwierdź oświadczenie o prawdziwości danych" }),
  regulamin: z.boolean().optional(),
  zawody: z.array(z.object({
    zawod: z.enum(ZAWODY, { message: "Wybierz zawód" }),
    pwz: z.string().max(40).optional().nullable(),
    specjalizacja: z.string().trim().max(200).optional().nullable(),
  })).min(1, "Wybierz co najmniej jeden zawód").max(ZAWODY.length),
});
export type ZapisInput = z.infer<typeof zapisSchema>;

/** Inicjały na publiczną stronę weryfikacji: „Anna Maria” + „Nowak-Kowalska” → „A. M. N.-K.” */
export function inicjaly(imie: string, nazwisko: string): string {
  const litera = (s: string) => (s.trim()[0] ?? "").toLocaleUpperCase("pl-PL");
  const imiona = imie.trim().split(/\s+/).filter(Boolean).map((s) => `${litera(s)}.`);
  const nazwiska = nazwisko.trim().split(/\s+/).filter(Boolean)
    .map((n) => n.split("-").filter(Boolean).map((c) => `${litera(c)}.`).join("-"));
  return [...imiona, ...nazwiska].join(" ");
}

// ── Ankieta ewaluacyjna (pytania w ustawieniu cme_ankieta) ────────────────────

export const pytanieAnkietySchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/, "Identyfikator pytania: małe litery, cyfry i podkreślenie"),
  typ: z.enum(["skala", "tak_nie", "tekst"]),
  tresc: z.string().trim().min(3).max(300),
  wymagane: z.boolean().default(true),
});
export const ankietaSchema = z.object({
  wersja: z.string().trim().min(1).max(20),
  pytania: z.array(pytanieAnkietySchema).min(1).max(30),
});
export type Ankieta = z.infer<typeof ankietaSchema>;
export type PytanieAnkiety = z.infer<typeof pytanieAnkietySchema>;

export const ANKIETA_DOMYSLNA: Ankieta = {
  wersja: "1",
  pytania: [
    { id: "ocena_ogolna", typ: "skala", tresc: "Jak oceniasz szkolenie jako całość?", wymagane: true },
    { id: "zgodnosc_z_programem", typ: "skala", tresc: "Na ile treść szkolenia była zgodna z programem?", wymagane: true },
    { id: "przydatnosc", typ: "skala", tresc: "Na ile zdobyta wiedza przyda ci się w pracy?", wymagane: true },
    { id: "materialy", typ: "skala", tresc: "Jak oceniasz jakość materiałów: wykładów, zapisów EKG i pytań?", wymagane: true },
    { id: "test", typ: "skala", tresc: "Na ile test końcowy sprawdzał to, czego uczyło szkolenie?", wymagane: true },
    { id: "bez_reklam", typ: "tak_nie", tresc: "Czy szkolenie było wolne od treści reklamowych?", wymagane: true },
    { id: "polecenie", typ: "tak_nie", tresc: "Czy polecisz to szkolenie innym?", wymagane: true },
    { id: "uwagi", typ: "tekst", tresc: "Co warto poprawić albo dodać?", wymagane: false },
  ],
};

/** Odpowiedzi ankiety zgodne z pytaniami: skala od 1 do 5, tak/nie, tekst do 2000 znaków. Zwraca błąd albo odpowiedzi. */
export function sprawdzOdpowiedziAnkiety(ankieta: Ankieta, surowe: unknown): { blad: string } | { odpowiedzi: Record<string, string | number | boolean | null> } {
  const wej = (surowe && typeof surowe === "object" ? surowe : {}) as Record<string, unknown>;
  const wynik: Record<string, string | number | boolean | null> = {};
  for (const p of ankieta.pytania) {
    const v = wej[p.id];
    const puste = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (puste) {
      if (p.wymagane) return { blad: `Odpowiedz na pytanie: ${p.tresc}` };
      wynik[p.id] = null;
      continue;
    }
    if (p.typ === "skala") {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) return { blad: `Wybierz ocenę od 1 do 5: ${p.tresc}` };
      wynik[p.id] = v;
    } else if (p.typ === "tak_nie") {
      if (typeof v !== "boolean") return { blad: `Wybierz tak albo nie: ${p.tresc}` };
      wynik[p.id] = v;
    } else {
      if (typeof v !== "string") return { blad: `Nieprawidłowa odpowiedź: ${p.tresc}` };
      wynik[p.id] = v.trim().slice(0, 2000);
    }
  }
  return { odpowiedzi: wynik };
}
