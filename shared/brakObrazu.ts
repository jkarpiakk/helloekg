/**
 * Obraz pytania, który się nie wyświetla (zgłoszenie JK 11.11: przypadek Q-0040 bez paska EKG).
 * Odtwarzacz zamiast cichej dziury pokazuje ramkę i wysyła automatyczne zgłoszenie
 * (POST /api/report-error z polem `automatyczne`). Treść zgłoszenia składa serwer z tego modułu,
 * żeby klient nie mógł wpisać tam czegokolwiek.
 */

export const TEMAT_BRAK_OBRAZU = "Brak obrazu w pytaniu (automatycznie)";

/** Gdzie w pytaniu miał być obraz */
export type MiejsceObrazu = "pytanie" | "przypadek" | "plansza" | "zapis";
/** brak-adresu: pytanie ma kod grafiki, a nie ma pliku; blad-ladowania: plik nie wczytał się */
export type StanObrazu = "brak-adresu" | "blad-ladowania";

export interface ZgloszenieBrakuObrazu {
  powod: "brak-obrazu";
  stan: StanObrazu;
  miejsce: MiejsceObrazu;
  kod?: string;
  url?: string;
}

const MIEJSCA: Record<MiejsceObrazu, string> = {
  pytanie: "obraz pytania",
  przypadek: "zapis przypadku klinicznego",
  plansza: "plansza do wskazywania",
  zapis: "zapis do wyboru",
};

const KOD = /^GFX-\d{3,5}$/;
const URL_PLIKU = /^\/content-assets\/[0-9a-f]{64}\.(png|jpe?g|webp|gif|svg)$/i;

/** Kod studia pytania (tag `studio:Q-…`) */
export function kodStudia(tags: unknown): string | null {
  const t = Array.isArray(tags) ? tags.find((x) => typeof x === "string" && x.startsWith("studio:")) : undefined;
  return t ? (t as string).slice("studio:".length) : null;
}

/** Treść zgłoszenia albo null, gdy dane z odtwarzacza są nieprawidłowe */
export function opisBrakuObrazu(
  pytanie: { tags?: unknown; questionType?: string | null },
  dane: Record<string, unknown>,
): string | null {
  if (dane.powod !== "brak-obrazu") return null;
  if (dane.stan !== "brak-adresu" && dane.stan !== "blad-ladowania") return null;
  if (typeof dane.miejsce !== "string" || !Object.prototype.hasOwnProperty.call(MIEJSCA, dane.miejsce)) return null;
  if (dane.kod !== undefined && (typeof dane.kod !== "string" || !KOD.test(dane.kod))) return null;
  if (dane.url !== undefined && (typeof dane.url !== "string" || !URL_PLIKU.test(dane.url))) return null;
  const kod = dane.kod as string | undefined;
  const url = dane.url as string | undefined;
  const co = dane.stan === "brak-adresu" ? "pytanie ma przypisaną grafikę, ale nie ma adresu pliku" : "plik obrazu nie wczytał się";
  const szczegoly = [
    `Pytanie ${kodStudia(pytanie.tags) ?? "(bez kodu studia)"} (${pytanie.questionType || "multiple_choice"})`,
    MIEJSCA[dane.miejsce as MiejsceObrazu],
    ...(kod ? [`grafika ${kod}`] : []),
    ...(url ? [`plik ${url}`] : []),
  ];
  return `Obraz się nie wyświetla: ${co}. ${szczegoly.join(", ")}. Zgłoszenie automatyczne z odtwarzacza.`;
}

/** Jedno miejsce na obraz w pytaniu. Brak `url` = obraz przypisany, ale bez pliku. */
export interface MiejsceNaObraz {
  miejsce: MiejsceObrazu;
  kod?: string;
  url?: string;
}

/**
 * Wszystkie obrazy, które pytanie ma pokazać kursantowi (to samo liczy importer, test e2e i odtwarzacz):
 * obraz karty pytania, zapis przypadku (gdy ma kod grafiki albo krok „wskaż”), plansza hotspotu
 * (zawsze), każdy zapis „Wybierz zapis” (zawsze).
 */
export function obrazyPytania(q: { questionType?: string | null; imageUrl?: string | null; questionConfig?: unknown }): MiejsceNaObraz[] {
  const typ = q.questionType || "multiple_choice";
  const cfg = ((q.questionConfig as { config?: Record<string, unknown> } | null | undefined)?.config ?? {}) as Record<string, unknown>;
  const tekst = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const miejsce = (m: MiejsceObrazu, kod: unknown, url: unknown): MiejsceNaObraz =>
    ({ miejsce: m, ...(tekst(kod) ? { kod: tekst(kod) } : {}), ...(tekst(url) ? { url: tekst(url) } : {}) });
  if (typ === "clinical_case") {
    const kroki = Array.isArray(cfg.steps) ? (cfg.steps as Array<{ kind?: string }>) : [];
    const wskaz = kroki.some((k) => k?.kind === "hotspot");
    return tekst(cfg.imageGfx) || tekst(cfg.imageUrl) || wskaz ? [miejsce("przypadek", cfg.imageGfx, cfg.imageUrl)] : [];
  }
  if (typ === "hotspot") return [miejsce("plansza", cfg.imageGfx, cfg.imageUrl)];
  if (typ === "image_choice") {
    const opcje = Array.isArray(cfg.options) ? (cfg.options as Array<Record<string, unknown>>) : [];
    return opcje.map((o) => miejsce("zapis", o.imageGfx, o.imageUrl));
  }
  return tekst(q.imageUrl) ? [miejsce("pytanie", undefined, q.imageUrl)] : [];
}
