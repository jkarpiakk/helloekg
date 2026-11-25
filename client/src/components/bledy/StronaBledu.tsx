import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { rise, stagger } from "@/lib/motion";
import { pasek, type RodzajPaska } from "./pasek";

/**
 * Strona błędu w motywie EKG: pasek zapisu na siatce 1 i 5 mm (jak na monitorze kursu), nad nim pasek
 * odprowadzenia z kodem błędu, pod nim tytuł, wyjaśnienie i jedno główne działanie.
 * Zapis rysuje się w tempie papieru (25 mm/s), potem chwilę stoi i zaczyna od nowa; przy „Ogranicz ruch”
 * stoi od razu cały.
 */
export function StronaBledu({
  kod,
  rodzaj,
  etykieta,
  tytul,
  children,
  dzialania,
  dopisek,
}: {
  /** Krótki kod na pasku monitora, np. „404” */
  kod: string;
  rodzaj: RodzajPaska;
  etykieta: string;
  tytul: string;
  children: ReactNode;
  dzialania: ReactNode;
  dopisek?: ReactNode;
}) {
  return (
    <div className="wrap" data-testid={`strona-bledu-${kod}`}>
      <motion.div className="mx-auto grid max-w-[40rem] gap-7 py-14 sm:py-24" variants={stagger(0.06)} initial="hidden" animate="show">
        <motion.div variants={rise}>
          <PasekBledu rodzaj={rodzaj} kod={kod} />
        </motion.div>
        <div className="grid gap-4">
          <motion.p variants={rise} className="label">{etykieta}</motion.p>
          <motion.h1 variants={rise} className="h2 text-[var(--txt)]">{tytul}</motion.h1>
          <motion.div variants={rise} className="lead max-w-[34em] text-[var(--txt2)]">{children}</motion.div>
        </div>
        <motion.div variants={rise} className="flex flex-wrap items-center gap-3">{dzialania}</motion.div>
        {dopisek && <motion.div variants={rise} className="text-ui text-[var(--txt2)]">{dopisek}</motion.div>}
      </motion.div>
    </div>
  );
}

/** Pasek zapisu: szerokość z kontenera, ścieżka z pasek.ts (wspólna ze stroną przerwy serwera) */
export function PasekBledu({ rodzaj, kod }: { rodzaj: RodzajPaska; kod: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [szer, setSzer] = useState(0);
  const still = !!useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSzer(Math.round(el.clientWidth)));
    ro.observe(el);
    setSzer(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const px = szer && szer < 480 ? 3.4 : 4;
  const p = szer ? pasek(rodzaj, szer, px) : null;
  const mm = px.toFixed(2);
  const opis =
    rodzaj === "blok"
      ? "Zapis EKG: miarowe pobudzenia, w jednym po załamku P nie ma zespołu QRS."
      : rodzaj === "artefakt"
        ? "Zapis EKG: miarowy rytm, w środku zakłócenie linii izoelektrycznej."
        : "Zapis EKG: prostokąty cechy 10 mm/mV.";

  return (
    <figure className="m-0 overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--panel)]" role="img" aria-label={opis}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2 font-mono text-[.75rem] uppercase tracking-[.07em] text-[var(--label)]">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-[7px] w-[7px] rounded-full bg-[var(--puls)]" aria-hidden />
          II · 25 mm/s · 10 mm/mV
        </span>
        <span className="text-[var(--puls)]">{kod}</span>
      </div>
      <div
        ref={ref}
        className="relative"
        style={{
          height: p?.wysokosc ?? 116,
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--puls) 13%, transparent) 1px, transparent 1px)," +
            "linear-gradient(90deg, color-mix(in srgb, var(--puls) 13%, transparent) 1px, transparent 1px)," +
            "linear-gradient(color-mix(in srgb, var(--puls) 5%, transparent) 1px, transparent 1px)," +
            "linear-gradient(90deg, color-mix(in srgb, var(--puls) 5%, transparent) 1px, transparent 1px)",
          backgroundSize: `${(px * 5).toFixed(2)}px ${(px * 5).toFixed(2)}px, ${(px * 5).toFixed(2)}px ${(px * 5).toFixed(2)}px, ${mm}px ${mm}px, ${mm}px ${mm}px`,
        }}
      >
        {p && (
          <svg width={p.szerokosc} height={p.wysokosc} viewBox={`0 0 ${p.szerokosc} ${p.wysokosc}`} className="block" aria-hidden>
            {/* Znacznik nad zjawiskiem: przerywany nawias i podpis */}
            <g className="text-[var(--label)]">
              <path
                d={`M${p.znacznik.x - p.znacznik.szer / 2} 27 v-5 h${p.znacznik.szer} v5`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text x={p.znacznik.x} y={16} textAnchor="middle" fill="currentColor" style={{ font: "500 10px var(--font-mono)", letterSpacing: ".06em" }}>
                {p.znacznik.podpis.toUpperCase()}
              </text>
            </g>
            <path
              d={p.d}
              pathLength={1}
              fill="none"
              stroke="var(--puls)"
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={still ? undefined : "hk-pasek-bledu"}
              // rysowanie trwa tyle, ile zapis na papierze (78% cyklu), potem pasek stoi i gaśnie
              style={still ? undefined : ({ "--hk-pasek-s": `${(p.sekundy / 0.78).toFixed(2)}s` } as React.CSSProperties)}
            />
          </svg>
        )}
      </div>
    </figure>
  );
}
