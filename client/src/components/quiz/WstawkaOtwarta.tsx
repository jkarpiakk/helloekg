import { useEffect, useRef, useState } from "react";
import { isWstawka, rozbierzOpcjeWstawki, WSTAWKA_LABELS, type WstawkaId } from "@helloekg/shared";

/**
 * Wstawka interaktywna otwarta od razu: w wykładzie (etap 5a) i w treści pytania (monitor, etap 5c).
 * Kod (osobny kawałek JS z obrazami) ładuje się dopiero, gdy wstawka zbliża się do ekranu.
 * Nic nie rusza się samo; „Ogranicz ruch” obsługuje sama wstawka.
 * Błąd ładowania: w wykładzie blok znika; w pytaniu (gdzie monitor jest treścią) zostaje komunikat.
 */
export function WstawkaOtwarta({ id, opts, wPytaniu = false }: { id: WstawkaId; opts: Record<string, string>; wPytaniu?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [blad, setBlad] = useState(false);
  const [widoczna, setWidoczna] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setWidoczna(true); return; }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setWidoczna(true); io.disconnect(); } }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!widoczna || !host.current) return;
    let zywa = true;
    let sprzatanie: (() => void) | null = null;
    import("@/wstawki/index")
      .then(({ LOADERS }) => LOADERS[id]())
      .then((mount) => { if (zywa && host.current) sprzatanie = mount(host.current, opts); })
      .catch((e: unknown) => { console.error(`Wstawka „${id}” nie wczytała się`, e); if (zywa) setBlad(true); });
    return () => { zywa = false; sprzatanie?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widoczna]);

  if (blad && !wPytaniu) return null;
  return (
    <div className="hk-wstawka not-prose" data-testid="wstawka-otwarta" data-wstawka={id} aria-label={`Wstawka interaktywna: ${WSTAWKA_LABELS[id]}`} role="group">
      {blad
        ? <p className="hk-wstawka__blad">Nie udało się wczytać zapisu z monitora. Odśwież stronę, żeby odpowiedzieć na to pytanie.</p>
        : <div ref={host} className="hk-wstawka__host" />}
    </div>
  );
}

/** Wycina z treści linie `::wstawka …`; zwraca tekst bez nich i listę poprawnych wstawek. */
export function wyciagnijWstawki(tresc: string): { tekst: string; wstawki: Array<{ id: WstawkaId; opts: Record<string, string> }> } {
  const wstawki: Array<{ id: WstawkaId; opts: Record<string, string> }> = [];
  const linie = (tresc ?? "").replace(/\r\n?/g, "\n").split("\n").filter((l) => {
    const m = /^::wstawka[ \t]+(\S+)(.*)$/.exec(l.trim());
    if (!m) return true;
    const id = (m[1] ?? "").toLowerCase();
    const { opts, nieznane } = rozbierzOpcjeWstawki(m[2] ?? "");
    if (isWstawka(id) && !nieznane.length) {
      const { zaproszenie: _z, ...reszta } = opts;
      wstawki.push({ id, opts: reszta });
    }
    return false;
  });
  return { tekst: linie.join("\n").trim(), wstawki };
}
