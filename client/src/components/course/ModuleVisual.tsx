import { EkgCanvas } from "@/components/ekg/EkgCanvas";
import type { ModuleArt } from "./moduleArt";

/**
 * Miniatura modułu w wierszu listy: kadr ilustracji (dekoracyjny — tytuł stoi obok),
 * a gdy moduł nie ma ilustracji — mały żywy zapis jego rytmu.
 * Wymiary stałe (pudełko + width/height na <img>), więc nic nie skacze przy wczytaniu.
 */
export function ModuleThumb({ art, className = "" }: { art: ModuleArt; className?: string }) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--ink)] w-[64px] h-[48px] sm:w-[104px] sm:h-[68px] ${className}`}
      aria-hidden="true"
    >
      {art.image ? (
        <img
          src={art.image.src}
          width={art.image.width}
          height={art.image.height}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition: art.image.thumbFocus ?? art.image.focus,
            transformOrigin: art.image.thumbFocus ?? art.image.focus,
            transform: art.image.thumbZoom ? `scale(${art.image.thumbZoom})` : undefined,
          }}
        />
      ) : (
        <span className="absolute inset-0 flex items-center">
          <EkgCanvas rhythm={art.rhythm} height={68} label={false} className="w-full shrink-0 !rounded-none !border-0" />
        </span>
      )}
    </span>
  );
}

/**
 * Nagłówek otwartego modułu / karty „Kontynuuj”: ilustracja w kadrze 16:10 i pod nią
 * żywy pasek EKG z rytmem modułu. `live={false}` rezerwuje miejsce na pasek bez montowania
 * canvasu (np. gdy <details> jest zamknięty i nie ma jeszcze szerokości).
 */
export function ModuleFigure({
  art,
  live = true,
  stripHeight = 72,
  eager = false,
  className = "",
}: {
  art: ModuleArt;
  live?: boolean;
  stripHeight?: number;
  /** Obrazek nad zgięciem (np. karta „Kontynuuj”) — bez lazy */
  eager?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className}`}>
      {art.image && (
        <figure className="relative m-0 aspect-[16/10] overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--ink)]">
          <img
            src={art.image.src}
            width={art.image.width}
            height={art.image.height}
            alt={art.image.alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: art.image.focus }}
          />
        </figure>
      )}
      <div style={{ height: stripHeight + 2 }}>
        {live ? (
          <EkgCanvas rhythm={art.rhythm} height={stripHeight} />
        ) : (
          <div className="h-full rounded-[12px] border border-[var(--line)] bg-[var(--ink)]" />
        )}
      </div>
    </div>
  );
}
