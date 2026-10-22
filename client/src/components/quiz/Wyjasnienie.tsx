import { useEffect, useId, useRef, useState } from "react";
import { sanitizeMarkdown } from "@/lib/sanitize";
import { isWstawka, rozbierzOpcjeWstawki, WSTAWKA_ZAPROSZENIA, type WstawkaId } from "@helloekg/shared";

/**
 * Wyjaśnienie pytania (Markdown) z wstawkami interaktywnymi.
 *
 * Linia `::wstawka <id> k=v … zaproszenie="…"` staje się zwiniętą kartą „Zobacz to na żywo”
 * (etap 2, zatwierdzony przez JK 22.10). Reszta tekstu renderuje się jak dotąd.
 * Linia z błędem albo nieznaną wstawką znika: wyjaśnienie ma być czytelne bez niej.
 */
type Czesc = { md: string } | { id: WstawkaId; opts: Record<string, string>; zaproszenie: string };

const LINIA = /^::wstawka[ \t]+(\S+)(.*)$/;

function rozbij(md: string): Czesc[] {
  const czesci: Czesc[] = [];
  let bufor: string[] = [];
  const zrzuc = () => {
    const tekst = bufor.join("\n").trim();
    if (tekst) czesci.push({ md: tekst });
    bufor = [];
  };
  for (const linia of md.replace(/\r\n?/g, "\n").split("\n")) {
    const m = LINIA.exec(linia.trim());
    if (!m) { bufor.push(linia); continue; }
    zrzuc();
    const id = (m[1] ?? "").toLowerCase();
    const { opts, nieznane } = rozbierzOpcjeWstawki(m[2] ?? "");
    if (!isWstawka(id) || nieznane.length) continue;
    const { zaproszenie, pytanie: _p, ...reszta } = opts;
    // Kursant już odpowiedział: kardiomonitor pokazuje rozpoznanie i alarm
    if (id === "kardiomonitor") reszta.pytanie = "odkryte";
    czesci.push({ id, opts: reszta, zaproszenie: zaproszenie || WSTAWKA_ZAPROSZENIA[id] });
  }
  zrzuc();
  return czesci;
}

export function Wyjasnienie({ md, className, testId }: { md: string; className?: string; testId?: string }) {
  const czesci = rozbij(md ?? "");
  return (
    <div className="grid gap-4" data-testid={testId}>
      {czesci.map((c, i) =>
        "md" in c
          ? <div key={i} className={className} dangerouslySetInnerHTML={sanitizeMarkdown(c.md)} />
          : <ZwinietaWstawka key={i} id={c.id} opts={c.opts} zaproszenie={c.zaproszenie} />,
      )}
    </div>
  );
}

/**
 * Zwinięta wstawka: jedna karta, nic się nie rusza, dopóki kursant jej nie dotknie.
 * Kod wstawki (ok. 2 MB z obrazami) ładuje się dopiero przy pierwszym rozwinięciu.
 * Błąd ładowania albo montowania: karta znika bez komunikatu (wyjaśnienie zostaje).
 */
export function ZwinietaWstawka({ id, opts, zaproszenie }: { id: WstawkaId; opts: Record<string, string>; zaproszenie: string }) {
  const [otwarta, setOtwarta] = useState(false);
  const [blad, setBlad] = useState(false);
  const [wczytana, setWczytana] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const sprzatanie = useRef<(() => void) | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!otwarta || wczytana || !host.current) return;
    let zywa = true;
    setWczytana(true);
    import("@/wstawki/index")
      .then(({ LOADERS }) => LOADERS[id]())
      .then((mount) => {
        if (!zywa || !host.current) return;
        sprzatanie.current = mount(host.current, opts);
      })
      .catch((e: unknown) => {
        console.error(`Wstawka „${id}” nie wczytała się`, e);
        if (zywa) setBlad(true);
      });
    return () => { zywa = false; };
    // opts i id nie zmieniają się w trakcie życia karty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otwarta]);

  useEffect(() => () => sprzatanie.current?.(), []);
  // Zwinięty panel zostaje w DOM (wstawka nie traci stanu), ale klawiatura i czytnik go nie widzą
  useEffect(() => { panel.current?.toggleAttribute("inert", !otwarta); }, [otwarta]);

  if (blad) return null;
  return (
    <div className="hk-live" data-testid="wstawka-karta" data-wstawka={id}>
      <button
        type="button"
        className="hk-live__toggle"
        aria-expanded={otwarta}
        aria-controls={panelId}
        onClick={() => setOtwarta((o) => !o)}
      >
        <span className="hk-live__text">
          <span className="label label--g">Zobacz to na żywo</span>
          <span className="hk-live__invite">{zaproszenie}</span>
        </span>
        <span className="hk-live__chev" aria-hidden="true" />
      </button>
      <div className="hk-live__panel" ref={panel} id={panelId} role="region" aria-label="Wstawka interaktywna" hidden={!otwarta && !wczytana}>
        <div className="hk-live__inner">
          <div className="hk-live__host" ref={host} data-testid="wstawka-host" />
        </div>
      </div>
    </div>
  );
}
