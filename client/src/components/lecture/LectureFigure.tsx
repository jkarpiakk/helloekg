import { useState } from "react";

export type OpenImage = (src: string, alt: string, origin: HTMLElement) => void;

/**
 * Ilustracja wykładu: zaokrąglenie 12, cienka linia, leniwe ładowanie.
 * Bez widocznego podpisu: alt to opis dla czytników ekranu (pełny, „jak dla niewidomego”),
 * a nie podpis dla widzącego — grafika i tak ma napisy w sobie (decyzja JK 21.10).
 * Dotknięcie otwiera podgląd, który wyrasta z miniatury (ImageLightbox).
 */
export function LectureFigure({ src, alt, onOpen }: { src: string; alt: string; onOpen: OpenImage }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <figure className="grid justify-items-center" data-testid="lecture-figure">
      <button
        type="button"
        onClick={(e) => {
          const img = e.currentTarget.querySelector("img");
          if (img) onOpen(src, alt, img);
        }}
        className="block max-w-full cursor-zoom-in rounded-[12px] transition-transform duration-[120ms] ease-out active:scale-[.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--puls)]"
      >
        {/* nazwa przycisku = „Powiększ ilustrację.” + alt obrazka (czytnik słyszy pełny opis) */}
        <span className="sr-only">Powiększ ilustrację. </span>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="!m-0 block h-auto max-w-full !rounded-[12px] !border !border-[var(--line)] bg-[var(--panel)]"
        />
      </button>
    </figure>
  );
}

/** Obraz w środku akapitu (rzadkie) — też otwiera podgląd */
export function InlineLectureImage({ src, alt, onOpen }: { src: string; alt: string; onOpen: OpenImage }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        const img = e.currentTarget.querySelector("img");
        if (img) onOpen(src, alt, img);
      }}
      className="inline cursor-zoom-in align-middle"
      aria-label={alt ? `Powiększ: ${alt}` : "Powiększ obraz"}
    >
      <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} className="inline-block max-w-full" />
    </button>
  );
}
