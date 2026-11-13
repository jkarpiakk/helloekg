import { useRef, type ReactNode } from "react";
import { Minimize2 } from "lucide-react";
import { usePelnyEkran, type PelnyEkran } from "@/lib/pelnyEkran";

/**
 * Rama wstawki z pełnym ekranem (prośba JK 13.11). Ta sama wstawka (bez ponownego montowania)
 * przechodzi w widok na cały ekran: host dostaje `data-hw-pe`, a układ wstawki (core/ui `uklad`)
 * przypina scenę: po lewej na szerokim ekranie, u góry na telefonie.
 */
export function RamaPelnegoEkranu({
  tytul,
  children,
}: {
  tytul: string;
  children: (pe: PelnyEkran) => ReactNode;
}) {
  const miejsce = useRef<HTMLDivElement>(null);
  const kontener = useRef<HTMLDivElement>(null);
  const tresc = useRef<HTMLDivElement>(null);
  const pe = usePelnyEkran({ kontener, miejsce, scena: () => tresc.current });

  return (
    <div ref={miejsce}>
      <div
        ref={kontener}
        className={pe.pelny ? "pelny-ekran pelny-ekran--wstawka" : undefined}
        role={pe.pelny ? "dialog" : undefined}
        aria-modal={pe.pelny || undefined}
        aria-label={pe.pelny ? `${tytul}, pełny ekran` : undefined}
        data-hw-pe={pe.pelny ? "" : undefined}
        data-testid={pe.pelny ? "pelny-ekran" : undefined}
      >
        {pe.pelny && <PasekPelnegoEkranu tytul={tytul} onZamknij={pe.zamknij} />}
        <div ref={tresc} className={pe.pelny ? "pelny-ekran__tresc" : undefined}>
          {children(pe)}
        </div>
      </div>
    </div>
  );
}

/** Pasek u góry pełnego ekranu: gdzie jestem i jak wyjść (zawsze w tym samym miejscu) */
export function PasekPelnegoEkranu({ tytul, onZamknij, children }: { tytul: string; onZamknij: () => void; children?: ReactNode }) {
  return (
    <div className="pelny-ekran__bar">
      <p className="label min-w-0 flex-1 truncate">{tytul}</p>
      {children}
      <button
        type="button"
        onClick={onZamknij}
        className="pelny-ekran__zamknij"
        data-testid="pelny-ekran-zamknij"
      >
        <Minimize2 className="h-4 w-4" aria-hidden />
        <span>Zamknij</span>
      </button>
    </div>
  );
}

const IKONA =
  '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';

/**
 * Przycisk „Pełny ekran” w nagłówku wstawki, obok przycisku dźwięku (ten sam wygląd co reszta
 * „ekranu urządzenia”). Wstawka bez dźwięku: przycisk w prawym górnym rogu.
 */
export function dolozPrzyciskPelnegoEkranu(host: HTMLElement, onClick: (btn: HTMLElement) => void): () => void {
  const snd = host.querySelector<HTMLElement>(".hw-snd");
  const maly = !!snd?.classList.contains("hw-snd--maly");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = maly ? "hw-chip hw-snd--maly hk-pe-btn" : "hw-chip hw-snd hk-pe-btn";
  btn.setAttribute("data-pe-przelacz", "");
  btn.setAttribute("aria-label", "Pełny ekran");
  btn.innerHTML = `${IKONA}<span>Pełny ekran</span>`;
  btn.addEventListener("click", () => onClick(btn));
  if (snd) {
    snd.insertAdjacentElement("afterend", btn);
  } else {
    btn.classList.add("hk-pe-btn--rog");
    host.style.position = host.style.position || "relative";
    host.append(btn);
  }
  return () => btn.remove();
}
