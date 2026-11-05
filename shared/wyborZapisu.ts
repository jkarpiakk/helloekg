/**
 * „Wybierz zapis” (`image_choice`): każda odpowiedź to osobny zapis EKG z rejestru.
 *
 * Plik bez zależności. Kurs dostaje go kopią (scripts/sync-wstawki.sh w repo kursu →
 * shared/wyborZapisu.ts), więc studio i beta oceniają, tasują i podpisują dokładnie tak samo.
 *
 * Zasady:
 * - odpowiedź zapisujemy i oceniamy po `id` opcji, nigdy po literze ani pozycji na ekranie;
 * - kolejność losujemy przy każdym podejściu (ziarno podejścia), stabilnie w jego obrębie;
 * - litery A, B, C… nadajemy dopiero po losowaniu;
 * - przed odpowiedzią alt mówi tylko „Zapis A”, bo alt z rejestru często nazywa rozpoznanie.
 */

export interface OpcjaZapisu {
  /** Stały identyfikator, np. „A1”. NIE litera wyświetlana kursantowi. */
  id: string;
  /** Kod grafiki z rejestru studia. */
  imageGfx?: string;
  /** Ścieżka pliku: eksport studia dokłada `assets/…`, importer kursu zamienia na `/content-assets/…`. */
  imageUrl?: string;
  /** Opis z rejestru grafik (eksport). Kursant widzi go dopiero po sprawdzeniu. */
  altText?: string;
  isCorrect: boolean;
  /** Krótko: co jest na tym zapisie. Pokazywane po odpowiedzi. */
  explanationMd?: string;
}

export interface ImageChoiceConfig {
  options: OpcjaZapisu[];
  allowMultiple: boolean;
}

export interface ImageChoiceAnswer {
  type: 'image_choice';
  selectedIds: string[];
}

export const IMAGE_CHOICE_MIN = 2;
export const IMAGE_CHOICE_MAX = 6;

/** Powtarzalne tasowanie (to samo co `stableShuffle` w studiu): ten sam tekst ziarna = ta sama kolejność. */
export function tasujStabilnie<T>(lista: readonly T[], ziarno: string): T[] {
  const out = [...lista];
  let s = 0;
  for (let i = 0; i < ziarno.length; i++) s = (s * 31 + ziarno.charCodeAt(i)) >>> 0;
  s = s || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((s / 4294967296) * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Kolejność opcji w jednym podejściu. Ziarno = identyfikator podejścia (nowe podejście, nowa kolejność). */
export function kolejnoscOpcji<T extends { id: string }>(opcje: readonly T[], ziarnoPodejscia: string): T[] {
  return tasujStabilnie(opcje, ziarnoPodejscia);
}

export const literaZapisu = (pozycja: number): string => String.fromCharCode(65 + pozycja);

/** Alt obrazu: przed sprawdzeniem tylko „Zapis A”, po sprawdzeniu pełny opis z rejestru. */
export function altZapisu(opcja: Pick<OpcjaZapisu, 'altText'>, pozycja: number, odkryte: boolean): string {
  const etykieta = `Zapis ${literaZapisu(pozycja)}`;
  const opis = (opcja.altText ?? '').trim();
  return odkryte && opis ? `${etykieta}: ${opis}` : etykieta;
}

/** Problemy z konfiguracją, po polsku — wspólne dla walidatora studia i importera kursu. */
export function bledyKonfiguracjiZapisow(cfg: ImageChoiceConfig): Array<{ sciezka: Array<string | number>; komunikat: string }> {
  const out: Array<{ sciezka: Array<string | number>; komunikat: string }> = [];
  const opcje = Array.isArray(cfg?.options) ? cfg.options : [];
  const poprawne = opcje.filter((o) => o.isCorrect).length;
  if (opcje.length >= IMAGE_CHOICE_MIN && poprawne === 0) {
    out.push({ sciezka: ['options'], komunikat: 'Zaznacz poprawny zapis' });
  }
  if (!cfg?.allowMultiple && poprawne > 1) {
    out.push({ sciezka: ['options'], komunikat: 'Przy jednej odpowiedzi poprawny może być tylko jeden zapis' });
  }
  const ids = new Set(opcje.map((o) => o.id));
  if (ids.size !== opcje.length) out.push({ sciezka: ['options'], komunikat: 'Powtórzone identyfikatory zapisów' });
  const widziane = new Map<string, number>();
  opcje.forEach((o, i) => {
    if (!o.imageGfx) return;
    if (widziane.has(o.imageGfx)) {
      out.push({ sciezka: ['options', i, 'imageGfx'], komunikat: `Grafika ${o.imageGfx} jest już w zapisie ${widziane.get(o.imageGfx)! + 1}` });
    } else widziane.set(o.imageGfx, i);
  });
  return out;
}

/**
 * Ocena: poprawne, gdy zbiór wybranych `id` = zbiór poprawnych `id`. Bez punktów częściowych.
 * Odporna na śmieci z sieci (nieznane id, powtórzenia, brak tablicy).
 */
export function gradeImageChoice(
  cfg: ImageChoiceConfig,
  selectedIds: unknown,
): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
  const opcje = Array.isArray(cfg?.options) ? cfg.options : [];
  const znane = new Set(opcje.map((o) => o.id));
  const wybrane = new Set(Array.isArray(selectedIds) ? selectedIds.filter((x): x is string => typeof x === 'string' && znane.has(x)) : []);
  const poprawne = new Set(opcje.filter((o) => o.isCorrect).map((o) => o.id));
  const isCorrect = poprawne.size > 0 && wybrane.size === poprawne.size && [...wybrane].every((id) => poprawne.has(id));
  return {
    isCorrect,
    partialScore: isCorrect ? 1 : 0,
    // trafione: wybrane poprawne; chybione: wybrane błędne i niewybrane poprawne
    correctItems: [...wybrane].filter((id) => poprawne.has(id)),
    incorrectItems: [...[...wybrane].filter((id) => !poprawne.has(id)), ...[...poprawne].filter((id) => !wybrane.has(id))],
  };
}

/** Wzorcowa odpowiedź (feedback „correctAnswer”). */
export function poprawnaOdpowiedzZapisow(cfg: ImageChoiceConfig): ImageChoiceAnswer {
  return { type: 'image_choice', selectedIds: (cfg.options ?? []).filter((o) => o.isCorrect).map((o) => o.id) };
}

/** Kody grafik opcji — do „używana w” i do stanu grafik pytania. */
export function kodyGrafikZapisow(cfg: Partial<ImageChoiceConfig> | undefined): string[] {
  return [...new Set((cfg?.options ?? []).map((o) => o.imageGfx).filter((k): k is string => typeof k === 'string' && k.length > 0))];
}
