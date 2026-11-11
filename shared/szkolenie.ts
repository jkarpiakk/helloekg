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

/**
 * Numer PWZ lekarza i lekarza dentysty (NIL, „Zasady weryfikowania nr PWZ”): 7 cyfr KABCDEF, bez zera
 * na początku, K = (A·1 + B·2 + C·3 + D·4 + E·5 + F·6) mod 11. Reszta 0 i 10 nie daje numeru.
 * Przykład NIL: 5425740. Walidacja twarda; wyjątek (np. PWZ warunkowe) wpisuje zespół w panelu, z wpisem w dzienniku.
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

/**
 * Pielęgniarka i położna (NIPiP): 7 cyfr i obowiązkowa litera: P dla pielęgniarki, A dla położnej.
 * Osoba z oboma zawodami ma dwa numery (osobne pole dla każdego zawodu).
 */
export function problemPwzPielegniarki(zawod: "pielegniarka" | "polozna", pwz: string): string | null {
  const litera = zawod === "pielegniarka" ? "P" : "A";
  if (!/^\d{7}[PA]$/.test(pwz)) return `Numer prawa wykonywania zawodu ${zawod === "pielegniarka" ? "pielęgniarki" : "położnej"} to 7 cyfr i litera ${litera} na końcu.`;
  if (pwz[7] !== litera) return `Litera na końcu numeru nie pasuje do zawodu: dla ${zawod === "pielegniarka" ? "pielęgniarki" : "położnej"} to ${litera}.`;
  return null;
}

export type WynikPwz = { blad: string | null; pwz: string | null };

/**
 * Walidacja numeru PWZ dla zawodu (twarda). Ratownik medyczny: rejestr dopiero rusza i nie ma urzędowego
 * formatu, więc dowolne cyfry i litery (do 20 znaków) albo „nie mam jeszcze numeru” (`brakNumeru`).
 */
export function sprawdzPwz(zawod: Zawod, surowy: string | null | undefined, opts: { brakNumeru?: boolean } = {}): WynikPwz {
  const pwz = (surowy ?? "").replace(/\s+/g, "").toUpperCase();
  if (!ZAWODY_Z_PWZ.includes(zawod)) return { blad: null, pwz: null };
  if (zawod === "ratownik" && opts.brakNumeru) return { blad: null, pwz: null };
  if (!pwz) return { blad: "Podaj numer prawa wykonywania zawodu.", pwz: null };
  if (pwz.length > 20) return { blad: "Numer prawa wykonywania zawodu jest za długi.", pwz: null };
  if (!/^[0-9A-Z]+$/.test(pwz)) return { blad: "Numer prawa wykonywania zawodu może mieć tylko cyfry i litery.", pwz: null };
  if (zawod === "lekarz" || zawod === "lekarz_dentysta") return { blad: problemPwzLekarza(pwz), pwz };
  if (zawod === "pielegniarka" || zawod === "polozna") return { blad: problemPwzPielegniarki(zawod, pwz), pwz };
  return { blad: null, pwz };
}

/** Okręgowe izby lekarskie (raport do izby; pole opcjonalne dla lekarzy) */
export const IZBY_LEKARSKIE = [
  "Beskidzka (Bielsko-Biała)", "Białostocka", "Bydgoska", "Częstochowska", "Dolnośląska (Wrocław)", "Gdańska",
  "Gorzowska", "Kielecka", "Koszalińska", "Krakowska", "Lubelska", "Lubuska (Zielona Góra)", "Łódzka", "Opolska",
  "Płocka", "Rzeszowska", "Szczecińska", "Śląska (Katowice)", "Tarnowska", "Toruńska", "Warmińsko-Mazurska (Olsztyn)",
  "Warszawska", "Wielkopolska (Poznań)", "Wojskowa",
] as const;

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
    /** Ratownik medyczny: „nie mam jeszcze numeru PWZ” */
    brakPwz: z.boolean().optional(),
    specjalizacja: z.string().trim().max(200).optional().nullable(),
    /** Lekarze (opcjonalnie): okręgowa izba lekarska, do raportu dla izby */
    izba: z.string().trim().max(100).optional().nullable(),
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

/**
 * Pytania startowe: wzór obowiązkowej ankiety anonimowej NIL (audyt prawny 11.11, p. 2.5), w tym
 * „Czy treści kształcenia były wolne od reklamy i stronniczości?”, oraz pytania o organizację.
 */
export const ANKIETA_DOMYSLNA: Ankieta = {
  wersja: "2",
  pytania: [
    { id: "nowa_wiedza", typ: "tak_nie", tresc: "Czy szkolenie dało ci nową wiedzę?", wymagane: true },
    { id: "oparta_na_faktach", typ: "tak_nie", tresc: "Czy przekazywana wiedza była oparta na faktach naukowych?", wymagane: true },
    { id: "w_praktyce", typ: "tak_nie", tresc: "Czy wykorzystasz zdobytą wiedzę w praktyce?", wymagane: true },
    { id: "korzysc_pacjentow", typ: "tak_nie", tresc: "Czy twoi pacjenci odniosą korzyść z tego szkolenia?", wymagane: true },
    { id: "bez_reklamy", typ: "tak_nie", tresc: "Czy treści kształcenia były wolne od reklamy i stronniczości?", wymagane: true },
    { id: "najslabsze", typ: "tekst", tresc: "Co było najsłabszą stroną szkolenia?", wymagane: false },
    { id: "najmocniejsze", typ: "tekst", tresc: "Co było najmocniejszą stroną szkolenia?", wymagane: false },
    { id: "ocena_ogolna", typ: "skala", tresc: "Jak oceniasz szkolenie jako całość?", wymagane: true },
    { id: "organizacja", typ: "skala", tresc: "Jak oceniasz organizację szkolenia: platformę, dostęp do materiałów i kontakt z prowadzącym?", wymagane: true },
    { id: "materialy", typ: "skala", tresc: "Jak oceniasz jakość materiałów: wykładów, zapisów EKG i pytań?", wymagane: true },
    { id: "test", typ: "skala", tresc: "Na ile test końcowy sprawdzał to, czego uczyło szkolenie?", wymagane: true },
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
