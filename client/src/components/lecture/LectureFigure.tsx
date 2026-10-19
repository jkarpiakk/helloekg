import { useState } from "react";

/** Podpis z alt tylko wtedy, gdy alt jest zdaniem, a nie nazwą pliku czy „image” */
export const captionFromAlt = (alt: string) => {
  const a = (alt ?? "").trim();
  if (a.length < 4 || !/\s/.test(a) || /\.(png|jpe?g|webp|gif|svg)$/i.test(a)) return "";
  return a;
};

export type OpenImage = (src: string, alt: string, origin: HTMLElement) => void;

/**
 * Ilustracja wykładu: zaokrąglenie 12, cienka linia, podpis z alt, leniwe ładowanie.
 * Dotknięcie otwiera podgląd, który wyrasta z miniatury (ImageLightbox).
 */
export function LectureFigure({ src, alt, onOpen }: { src: string; alt: string; onOpen: OpenImage }) {
  const caption = captionFromAlt(alt);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <figure className="grid justify-items-center gap-2.5" data-testid="lecture-figure">
      <button
        type="button"
        onClick={(e) => {
          const img = e.currentTarget.querySelector("img");
          if (img) onOpen(src, alt, img);
        }}
        className="block max-w-full cursor-zoom-in rounded-[12px] transition-transform duration-[120ms] ease-out active:scale-[.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--puls)]"
        aria-label={caption ? `Powiększ ilustrację: ${caption}` : "Powiększ ilustrację"}
      >
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
      {caption && (
        <figcaption className="max-w-[36em] text-center text-[13px] leading-[1.5] text-[var(--txt3)]">{caption}</figcaption>
      )}
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
