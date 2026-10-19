import type { Rhythm } from "@/components/ekg/EkgCanvas";

/**
 * Tożsamość wizualna modułów: ilustracja + rytm „podpisowy” do małego żywego zapisu EKG.
 *
 * Ilustracje pochodzą z katalogu grafik kursu (helloEKG Studio) albo z landingu:
 * - landing: `/img/gfx-XXXX.webp` (client/public/img),
 * - kurs: `/content-assets/<hash>.<ext>` (to samo co `assetPath` w katalogu, bez „assets/”).
 * Wybór po tytule modułu; kod i tytuł grafiki zapisane przy każdej pozycji.
 * Moduł bez pasującej ilustracji z plikiem pokazuje sam zapis EKG (nie podstawiamy byle czego).
 */

export interface ModuleImage {
  src: string;
  width: number;
  height: number;
  /** Krótki opis do `alt` w nagłówku modułu (miniatury są dekoracyjne: alt="") */
  alt: string;
  /** Kadr (object-position) — infografiki są wysokie, celujemy w rysunek, nie w tekst */
  focus: string;
  /** Powiększenie w małej miniaturze (punkt zaczepienia = `thumbFocus` albo `focus`) */
  thumbZoom?: number;
  thumbFocus?: string;
}

export interface ModuleArt {
  key: string;
  image: ModuleImage | null;
  rhythm: Rhythm;
}

const RULES: Array<{ match: RegExp; art: ModuleArt }> = [
  {
    // GFX-0232 · ilustracja · „schemat układu bodźcoprzewodzącego serca, z zaznaczeniem węzła
    // zatokowego, węzła AV, pęczka Hisa i włókien Purkinjego” (ta sama co w „Metodzie” na landingu)
    match: /wprowadzenie/i,
    art: {
      key: "intro",
      image: {
        src: "/img/gfx-0232.webp",
        width: 1600,
        height: 1000,
        alt: "Układ bodźcoprzewodzący serca: węzeł zatokowy, węzeł przedsionkowo-komorowy, pęczek Hisa i włókna Purkinjego",
        focus: "30% 50%",
        thumbZoom: 1.5,
        thumbFocus: "30% 50%",
      },
      rhythm: "sinus",
    },
  },
  {
    // GFX-0061 · ilustracja · „Porównanie wąski vs szeroki QRS” (autostrada vs droga okrężna)
    match: /załamk|zalamk|odcinki|odstęp/i,
    art: {
      key: "waves",
      image: {
        src: "/img/course/11ba0723cff5.webp",
        width: 1200,
        height: 1276,
        alt: "Wąski czy szeroki QRS: porównanie zapisów z odprowadzenia V6",
        focus: "50% 38%",
        thumbZoom: 2.2,
        thumbFocus: "28% 48%",
      },
      rhythm: "sinus",
    },
  },
  {
    // GFX-0065 · ilustracja · „Uniesienie odcinka ST. Po lewej STEMI… po prawej zapalenie osierdzia”
    match: /przerost|niedokrwien/i,
    art: {
      key: "ischemia",
      image: {
        src: "/img/gfx-0065.webp",
        width: 1200,
        height: 1080,
        alt: "Uniesienie ST: STEMI ściany dolnej a zapalenie osierdzia",
        focus: "20% 38%",
        thumbZoom: 2.2,
        thumbFocus: "18% 32%",
      },
      rhythm: "sinus",
    },
  },
  {
    // GFX-0055 · ilustracja · „Porównanie morfologii P: (a) prawidłowy zatokowy, (b) fala migotania,
    // (c) fale trzepotania »zęby piły«, (d) P ujemny w II (rytm węzłowy)”
    match: /arytmi|rytmu/i,
    art: {
      key: "arrhythmia",
      image: {
        src: "/img/course/de86f8283f3d.webp",
        width: 1200,
        height: 1268,
        alt: "Załamek P w czterech rytmach: zatokowym, migotaniu i trzepotaniu przedsionków oraz rytmie węzłowym",
        focus: "50% 45%",
        thumbZoom: 1.8,
        thumbFocus: "45% 54%",
      },
      rhythm: "af",
    },
  },
  {
    // GFX-0057 · schemat · „Blok AV I stopnia… obok mini-schemat hierarchii I° / II° / III°”
    match: /blok/i,
    art: {
      key: "blocks",
      image: {
        src: "/img/course/8efe211136eb.webp",
        width: 1200,
        height: 1314,
        alt: "Blok AV I stopnia i hierarchia bloków przedsionkowo-komorowych",
        focus: "50% 62%",
        thumbZoom: 1.9,
        thumbFocus: "40% 24%",
      },
      rhythm: "wenckebach",
    },
  },
  {
    // Brak ilustracji z plikiem (GFX-0001 „Budowa układu stymulującego” ma dopiero prompt).
    // Zostaje sam zapis: blok AV III stopnia — klasyczne wskazanie do stymulacji.
    match: /stymulator|urządzeni|urzadzeni/i,
    art: { key: "pacing", image: null, rhythm: "avb3" },
  },
  {
    // GFX-0067 · schemat · „Lokalizacja zmian ST–T wg grup odprowadzeń” (mapa 12 odprowadzeń
    // + nawyk czytania zapisu) — to, co robisz w każdym przypadku klinicznym
    match: /przypadk|klinicz/i,
    art: {
      key: "cases",
      image: {
        src: "/img/course/539d4e0fbd41.webp",
        width: 1200,
        height: 1392,
        alt: "Lokalizacja zmian ST–T: mapa dwunastu odprowadzeń i ścian serca",
        focus: "62% 22%",
        thumbZoom: 2.4,
        thumbFocus: "86% 22%",
      },
      rhythm: "tachy",
    },
  },
];

const FALLBACK: ModuleArt = { key: "default", image: null, rhythm: "sinus" };

export function getModuleArt(title: string | null | undefined): ModuleArt {
  const t = title ?? "";
  return RULES.find((r) => r.match.test(t))?.art ?? FALLBACK;
}

/** Moduł, w którym siedzi „Metoda” (orkiestra) */
export const isIntroModule = (title: string | null | undefined) => getModuleArt(title).key === "intro";
