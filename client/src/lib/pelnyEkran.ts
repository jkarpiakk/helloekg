/**
 * Pełny ekran dla elementów interaktywnych (prośba JK 13.11: „tak jak grafiki”, bez przewijania
 * w tę i z powrotem między kardiomonitorem a odpowiedziami).
 *
 * Element nie przenosi się w inne miejsce drzewa: ten sam kontener dostaje klasę `pelny-ekran`
 * (position: fixed, własne przewijanie), więc monitor gra dalej, zaznaczenia i stan pytania zostają.
 * W przepływie strony zostaje miejsce o tej samej wysokości (`miejsce`), przewinięcie strony też.
 *
 * Ruch (Apple, „Designing Fluid Interfaces”):
 * - widok wyrasta ze sceny (monitor, zapis): scena leci FLIP-em z miejsca na stronie,
 *   a reszta odsłania się przycięciem (clip-path) od prostokąta sceny do całego ekranu,
 * - jedna wartość postępu p (0 = na stronie, 1 = pełny ekran) na sprężynie damping 1, response 0,42;
 *   zamykanie to ta sama droga wstecz, a przerwane w połowie wraca od bieżącego p (bez skoku),
 * - scena poza ekranem (otwarcie z paska) albo „Ogranicz ruch”: samo przenikanie.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { animate, useReducedMotion, type AnimationPlaybackControls } from "framer-motion";

type Rect = { top: number; left: number; width: number; height: number };

interface Opcje {
  /** Element, który staje się pełnym ekranem */
  kontener: RefObject<HTMLElement>;
  /** Rodzic kontenera w przepływie strony: trzyma wysokość, gdy kontener jest „fixed” */
  miejsce?: RefObject<HTMLElement>;
  /** Scena, z której widok wyrasta (domyślnie cały kontener) */
  scena?: () => HTMLElement | null;
}

export interface PelnyEkran {
  pelny: boolean;
  /** Otwórz; `zrodlo` dostaje fokus po zamknięciu */
  otworz: (zrodlo?: HTMLElement | null) => void;
  zamknij: () => void;
  przelacz: (zrodlo?: HTMLElement | null) => void;
  /** Bez animacji (np. pytanie zmienia się na takie, które nie ma sceny) */
  zamknijOdRazu: () => void;
  /** Treść pod spodem się zmieniła (następne pytanie): zamknięcie bez lotu do starej sceny, przewinięcie strony z teraz */
  odswiez: () => void;
}

const widoczny = (r: Rect | null | undefined) =>
  !!r && r.width > 0 && r.top < window.innerHeight && r.top + r.height > 0;

export function usePelnyEkran({ kontener, miejsce, scena }: Opcje): PelnyEkran {
  const still = !!useReducedMotion();
  const [pelny, setPelny] = useState(false);
  const s = useRef({
    p: 0,
    cel: 0 as 0 | 1,
    anim: null as AnimationPlaybackControls | null,
    naStronie: null as Rect | null,
    naEkranie: null as Rect | null,
    przenikanie: false,
    przewiniecie: 0,
    zrodlo: null as HTMLElement | null,
    overflow: "",
    zablokowane: false,
    startuj: false,
  });
  const scenaEl = useCallback(() => scena?.() ?? kontener.current, [scena, kontener]);

  /** Jedna klatka: p = 0 → scena w miejscu na stronie, p = 1 → pełny ekran */
  const zastosuj = useCallback(
    (p: number) => {
      const k = kontener.current;
      const el = scenaEl();
      const st = s.current;
      if (!k) return;
      if (st.przenikanie || !st.naStronie || !st.naEkranie || !el) {
        k.style.opacity = String(p);
        k.style.transform = st.przenikanie && !still ? `translate3d(0, ${(1 - p) * 16}px, 0)` : "";
        return;
      }
      const a = st.naStronie;
      const b = st.naEkranie;
      const q = 1 - p;
      const skala = a.width / b.width;
      const sk = skala + (1 - skala) * p;
      if (el !== k) {
        el.style.transformOrigin = "0 0";
        el.style.transform = `translate3d(${(a.left - b.left) * q}px, ${(a.top - b.top) * q}px, 0) scale(${sk})`;
      }
      // Odsłanianie: od prostokąta sceny (po skali) do całego ekranu
      const W = window.innerWidth;
      const H = window.innerHeight;
      const top = a.top * q;
      const left = a.left * q;
      const right = (W - (a.left + b.width * skala)) * q;
      const bottom = (H - (a.top + b.height * skala)) * q;
      k.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${14 * q}px)`;
      k.style.opacity = "";
    },
    [kontener, scenaEl, still],
  );

  const wyczysc = useCallback(() => {
    const k = kontener.current;
    const el = scenaEl();
    if (k) {
      k.style.clipPath = "";
      k.style.opacity = "";
      k.style.transform = "";
    }
    if (el && el !== k) {
      el.style.transform = "";
      el.style.transformOrigin = "";
    }
  }, [kontener, scenaEl]);

  const biegnij = useCallback(
    (cel: 0 | 1) => {
      const st = s.current;
      st.cel = cel;
      st.anim?.stop();
      // Położenie sceny na pełnym ekranie (bez naszej transformacji)
      const el = scenaEl();
      if (el && !st.przenikanie) {
        const t = el.style.transform;
        el.style.transform = "";
        const r = el.getBoundingClientRect();
        el.style.transform = t;
        st.naEkranie = { top: r.top, left: r.left, width: r.width, height: r.height };
        if (!widoczny(st.naStronie) || r.width === 0) st.przenikanie = true;
      }
      st.anim = animate(st.p, cel, {
        ...(still || st.przenikanie
          ? { duration: still ? 0.2 : 0.28, ease: [0.2, 0.7, 0.2, 1] }
          : { type: "spring", bounce: 0, duration: 0.42 }),
        onUpdate: (v) => {
          st.p = v;
          zastosuj(v);
        },
        onComplete: () => {
          st.anim = null;
          if (cel === 1) wyczysc();
          else setPelny(false);
        },
      });
    },
    [scenaEl, still, zastosuj, wyczysc],
  );

  const otworz = useCallback(
    (zrodlo?: HTMLElement | null) => {
      const st = s.current;
      if (pelny) {
        if (st.cel === 0) biegnij(1); // złapane w trakcie zamykania: wraca od bieżącej wartości
        return;
      }
      const el = scenaEl();
      const r = el?.getBoundingClientRect();
      st.naStronie = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      st.przenikanie = !widoczny(st.naStronie);
      st.przewiniecie = window.scrollY;
      st.zrodlo = zrodlo ?? (document.activeElement as HTMLElement | null);
      st.p = 0;
      st.cel = 1;
      st.startuj = true;
      const m = miejsce?.current;
      if (m && kontener.current) m.style.minHeight = `${m.offsetHeight}px`;
      setPelny(true);
    },
    [pelny, biegnij, scenaEl, miejsce, kontener],
  );

  const zamknij = useCallback(() => {
    if (!pelny || s.current.cel === 0) return;
    biegnij(0);
  }, [pelny, biegnij]);

  const zamknijOdRazu = useCallback(() => {
    const st = s.current;
    st.anim?.stop();
    st.anim = null;
    st.cel = 0;
    st.p = 0;
    wyczysc();
    setPelny(false);
  }, [wyczysc]);

  const odswiez = useCallback(() => {
    const st = s.current;
    st.przewiniecie = window.scrollY;
    st.naStronie = null;
    st.przenikanie = true;
  }, []);

  const przelacz = useCallback(
    (zrodlo?: HTMLElement | null) => (pelny && s.current.cel === 1 ? zamknij() : otworz(zrodlo)),
    [pelny, zamknij, otworz],
  );

  // Wejście: kontener jest już „fixed” — pierwsza klatka w miejscu sceny, potem sprężyna
  useLayoutEffect(() => {
    const st = s.current;
    const html = document.documentElement;
    if (pelny && st.startuj) {
      st.startuj = false;
      st.overflow = html.style.overflow;
      st.zablokowane = true;
      html.style.overflow = "hidden";
      const k = kontener.current;
      if (k) {
        k.scrollTop = 0;
        // fokus na widoku (nie na „Zamknij”: Enter ma dalej sprawdzać odpowiedź)
        if (!k.hasAttribute("tabindex")) k.setAttribute("tabindex", "-1");
        k.focus({ preventScroll: true });
      }
      biegnij(1);
      zastosuj(st.p);
      return;
    }
    if (!pelny && st.zablokowane) {
      st.zablokowane = false;
      wyczysc();
      kontener.current?.removeAttribute("tabindex");
      html.style.overflow = st.overflow;
      const m = miejsce?.current;
      if (m) m.style.minHeight = "";
      if (Math.abs(window.scrollY - st.przewiniecie) > 1) window.scrollTo(0, st.przewiniecie);
      st.zrodlo?.isConnected && st.zrodlo.focus({ preventScroll: true });
      st.zrodlo = null;
    }
  }, [pelny, biegnij, zastosuj, wyczysc, kontener, miejsce]);

  // Przypięta u góry scena zasłania to, do czego przewija fokus (Tab, czytnik): przewijanie omija jej wysokość
  useEffect(() => {
    const k = kontener.current;
    if (!pelny || !k || typeof ResizeObserver === "undefined") return;
    const licz = () => {
      const sc = k.querySelector<HTMLElement>("[data-scena], [data-hw-scena]");
      const u = sc && getComputedStyle(sc).position === "sticky" && sc.getBoundingClientRect().width > k.clientWidth * 0.7;
      k.style.setProperty("--pe-scena", u ? `${sc!.offsetHeight}px` : "0px");
    };
    const ro = new ResizeObserver(licz);
    ro.observe(k);
    const sc = k.querySelector<HTMLElement>("[data-scena], [data-hw-scena]");
    if (sc) ro.observe(sc);
    licz();
    return () => ro.disconnect();
  }, [pelny, kontener]);

  // Esc zamyka (chyba że nad nami jest inne okno: podgląd obrazu, zgłoszenie błędu)
  useEffect(() => {
    if (!pelny) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const inne = Array.from(document.querySelectorAll('[aria-modal="true"], [role="dialog"][data-state="open"]')).some(
        (d) => d !== kontener.current && !kontener.current?.contains(d) && !d.contains(kontener.current),
      );
      if (inne) return;
      e.preventDefault();
      zamknij();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pelny, zamknij, kontener]);

  // Odmontowanie w trakcie: przywróć przewijanie strony
  useEffect(
    () => () => {
      const st = s.current;
      st.anim?.stop();
      if (st.zablokowane) {
        document.documentElement.style.overflow = st.overflow;
      }
    },
    [],
  );

  return { pelny, otworz, zamknij, przelacz, zamknijOdRazu, odswiez };
}
