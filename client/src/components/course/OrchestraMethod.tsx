import { useId, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/motion";

/**
 * „Metoda — Serce to orkiestra. EKG to jej nagranie.” — port sekcji `.method` z landingu
 * (helloekg.pl). Ilustracja układu bodźcoprzewodzącego z podświetleniami SVG + jeden cykl EKG,
 * w którym aktywny fragment zmienia kolor na zielony. Teksty medyczne przepisane 1:1 z landingu.
 *
 * Różnica wobec landingu: tam kroki przełącza przewijanie (scrollytelling, bez autoprzewijania),
 * tu — przyciski P / PQ / QRS / ST / QT (aria-pressed, strzałki ←/→), bo w kursie ta sekcja
 * siedzi w środku listy i nie może zajmować pięciu ekranów. Autoprzewijania nie ma, tak jak na landingu.
 * Przejścia: krzywe/podświetlenia przez CSS transition, tekst przez sprężynę framer-motion —
 * obie da się przerwać w połowie kolejnym kliknięciem.
 */

type StepId = "p" | "pr" | "qrs" | "st" | "t";

interface Step {
  id: StepId;
  chip: string;
  label: string;
  title: string;
  body: string;
  clinic: string;
}

const STEPS: Step[] = [
  {
    id: "p",
    chip: "P",
    label: "01 · Załamek P · < 120 ms",
    title: "Węzeł zatokowy dyryguje.",
    body: "Każde pobudzenie rodzi się w kilku tysiącach komórek rozrusznikowych, położonych wysoko w prawym przedsionku. Impuls rozchodzi się z nich po obu przedsionkach i tworzy załamek P. Dodatni w II, ujemny w aVR: tak na papierze wygląda rytm zatokowy.",
    clinic: "Brak załamków P i niemiarowy rytm oznaczają, że batutę przejął ktoś inny. To migotanie przedsionków.",
  },
  {
    id: "pr",
    chip: "PQ",
    label: "02 · Odstęp PQ · 120–200 ms",
    title: "Węzeł AV pilnuje tempa.",
    body: "Tu impuls celowo zwalnia. Komórki węzła, których depolaryzację napędza prąd wapniowy, zatrzymują go na mniej więcej jedną dziesiątą sekundy, żeby przedsionki zdążyły dopełnić komory. Na EKG widać tylko płaską linię, a dla pracy serca ta chwila ma ogromne znaczenie.",
    clinic: "PQ powyżej 200 ms to blok AV I stopnia. Jeśli wydłuża się, aż jedno pobudzenie wypada, to Wenckebach.",
  },
  {
    id: "qrs",
    chip: "QRS",
    label: "03 · Zespół QRS · < 120 ms",
    title: "Układ Hisa–Purkinjego to autostrada.",
    body: "Impuls biegnie przez pęczek Hisa, dalej obiema odnogami do sieci Purkinjego, z prędkością do 4 m/s. Cały mięsień komór pobudza się w około jedną dziesiątą sekundy i dlatego prawidłowy QRS jest wąski.",
    clinic: "QRS 120 ms lub szerszy to najczęściej blok odnogi albo pobudzenie, które powstało w samej komorze.",
  },
  {
    id: "st",
    chip: "ST",
    label: "04 · Odcinek ST · izoelektryczny",
    title: "Plateau to długa nuta.",
    body: "Wszystkie komórki komór mają teraz ten sam potencjał, bo napływ wapnia do komórki równoważy wypływ potasu na zewnątrz. Nie ma gradientu ani prądu, więc linia jest płaska. Dlatego niedokrwienie, które zaburza tę równowagę, widać tutaj najwyraźniej.",
    clinic: "Uniesienie ST w obrębie jednej ściany z obniżeniem przeciwstronnym: zakładaj zamkniętą tętnicę, dopóki jej nie wykluczysz.",
  },
  {
    id: "t",
    chip: "QT",
    label: "05 · Załamek T · QTc < 450–460 ms",
    title: "Repolaryzacja stroi instrumenty.",
    body: "Komory wracają do spoczynku od zewnątrz do środka, dlatego załamek T ma zwykle ten sam kierunek co QRS. QT obejmuje cały występ. Kiedy się przeciąga, kolejne pobudzenie może wejść za wcześnie.",
    clinic: "QTc powyżej 500 ms: odstaw leki wydłużające QT, sprawdź potas i magnez.",
  },
];

/* Ścieżki jednego cyklu EKG — wygenerowane dla landingu, przepisane bez zmian */
const SEGMENTS: Array<{ seg: string; d: string }> = [
  { seg: "pre", d: "M0.0 170.0L1.1 170.0L2.1 170.0L3.2 170.0L4.2 170.0L5.3 170.0L6.3 170.0L7.4 170.0L8.4 170.0L9.5 170.0L10.5 170.0L11.6 170.0L12.6 170.0L13.7 170.0L14.7 170.0L15.8 170.0L16.8 170.0L17.9 170.0L18.9 170.0L20.0 170.0L21.0 170.0L22.1 170.0L23.1 170.0L24.2 170.0L25.2 170.0L26.3 170.0L27.3 170.0L28.4 170.0L29.4 170.0L30.5 170.0L31.5 170.0L32.6 170.0L33.6 169.9L34.7 169.9L35.7 169.8L36.8 169.7L37.8 169.6L38.9 169.4L39.9 169.2L41.0 168.8L42.0 168.4" },
  { seg: "p", d: "M42.0 168.4L43.0 167.9L44.1 167.2L45.1 166.3L46.2 165.3L47.3 164.1L48.3 162.7L49.3 161.2L50.4 159.6L51.4 157.8L52.5 156.1L53.5 154.4L54.6 152.8L55.6 151.5L56.7 150.3L57.8 149.5L58.8 149.1L59.9 149.0L60.9 149.3L62.0 150.0L63.0 151.1L64.0 152.4L65.1 153.9L66.2 155.5L67.2 157.3L68.3 159.0L69.3 160.7L70.4 162.2L71.4 163.6L72.5 164.9L73.5 166.0L74.6 166.9L75.6 167.6L76.7 168.2L77.7 168.7L78.8 169.1L79.8 169.3" },
  { seg: "pr", d: "M80.5 169.5L81.5 169.7L82.6 169.8L83.6 169.8L84.7 169.9L85.8 169.9L86.8 170.0L87.8 170.0L88.9 170.0L90.0 170.0L91.0 170.0L92.0 170.0L93.1 170.0L94.2 170.0L95.2 170.1L96.3 170.3L97.3 170.7" },
  { seg: "qrs", d: "M98.0 171.2L99.1 172.1L100.1 172.6L101.2 171.6L102.2 167.6L103.3 159.1L104.3 145.4L105.4 126.4L106.4 103.1L107.5 77.3L108.5 52.1L109.6 31.3L110.6 18.8L111.7 17.2L112.7 27.0L113.8 46.5L114.8 72.3L115.9 100.2L116.9 126.8L118.0 149.4L119.0 166.7L120.1 178.4L121.1 185.0L122.2 187.2L123.2 186.2L124.3 183.5L125.3 180.0L126.4 176.7L127.4 174.1L128.5 172.3L129.5 171.2" },
  { seg: "st", d: "M129.5 171.2L130.6 170.5L131.6 170.2L132.7 170.1L133.7 170.0L134.8 170.0L135.8 170.0L136.8 170.0L137.9 169.9L139.0 169.9L140.0 169.9L141.1 169.9L142.1 169.9L143.2 169.8L144.2 169.8L145.3 169.7L146.3 169.7L147.4 169.6L148.4 169.5L149.5 169.4L150.5 169.2L151.6 169.1L152.6 168.9L153.7 168.7L154.7 168.4L155.8 168.1L156.8 167.8L157.9 167.4L158.9 166.9L160.0 166.4L161.0 165.9L162.1 165.2L163.1 164.5L164.2 163.7" },
  { seg: "t", d: "M164.5 163.4L165.5 162.4L166.6 161.4L167.7 160.3L168.7 159.1L169.8 157.8L170.8 156.4L171.8 154.9L172.9 153.3L173.9 151.6L175.0 149.9L176.1 148.0L177.1 146.1L178.2 144.2L179.2 142.3L180.3 140.3L181.3 138.3L182.3 136.3L183.4 134.4L184.5 132.6L185.5 130.8L186.6 129.1L187.6 127.5L188.7 126.1L189.7 124.8L190.8 123.6L191.8 122.7L192.9 122.0L193.9 121.4L195.0 121.1L196.0 121.0L197.1 121.1L198.1 121.4L199.2 122.0L200.2 122.7L201.3 123.6L202.3 124.8L203.4 126.1L204.4 127.5L205.5 129.1L206.5 130.8L207.6 132.6L208.6 134.4L209.7 136.3L210.7 138.3L211.8 140.3L212.8 142.3L213.9 144.2L214.9 146.1L216.0 148.0L217.0 149.9L218.1 151.6L219.1 153.3L220.2 154.9L221.2 156.4L222.3 157.8L223.3 159.1L224.4 160.3L225.4 161.4L226.5 162.4L227.5 163.4L228.6 164.2L229.6 165.0L230.7 165.6L231.7 166.2L232.8 166.8L233.8 167.2L234.9 167.7L235.9 168.0L237.0 168.3L238.0 168.6L239.1 168.8L240.1 169.0L241.2 169.2L242.2 169.3L243.3 169.5L244.3 169.6L245.4 169.6L246.4 169.7L247.5 169.8L248.5 169.8L249.6 169.8L250.6 169.9L251.7 169.9L252.7 169.9L253.8 169.9L254.8 170.0L255.9 170.0L256.9 170.0L258.0 170.0L259.0 170.0" },
  { seg: "post", d: "M259.0 170.0L260.1 170.0L261.1 170.0L262.1 170.0L263.2 170.0L264.3 170.0L265.3 170.0L266.4 170.0L267.4 170.0L268.4 170.0L269.5 170.0L270.6 170.0L271.6 170.0L272.7 170.0L273.7 170.0L274.8 170.0L275.8 170.0L276.9 170.0L277.9 170.0L278.9 170.0L280.0 170.0L281.1 170.0L282.1 170.0L283.2 170.0L284.2 170.0L285.3 170.0L286.3 170.0L287.4 170.0L288.4 170.0L289.5 170.0L290.5 170.0L291.6 170.0L292.6 170.0L293.7 170.0L294.7 170.0L295.8 170.0L296.8 170.0L297.9 170.0L298.9 170.0L300.0 170.0L301.0 170.0L302.1 170.0L303.1 170.0L304.2 170.0L305.2 170.0L306.3 170.0L307.3 170.0L308.4 170.0L309.4 170.0L310.5 170.0L311.5 170.0L312.6 170.0L313.6 170.0L314.7 170.0" },
];
const BRACKETS = [
  { seg: "p", d: "M42.0 197V202H80.5V197", x: 61.3, y: 215, text: "P" },
  { seg: "pr", d: "M42.0 210V215H98.0V210", x: 70.0, y: 228, text: "PQ" },
  { seg: "qrs", d: "M98.0 197V202H129.5V197", x: 113.8, y: 215, text: "QRS" },
  { seg: "st", d: "M129.5 197V202H164.5V197", x: 147.0, y: 215, text: "ST" },
  { seg: "t", d: "M98.0 223V228H259.0V223", x: 178.5, y: 241, text: "QT" },
] as const;

const STYLES = `
.om{container-type:inline-size;display:grid;gap:clamp(20px,3vw,32px)}
.om__head{display:grid;gap:14px;max-width:42em}
.om__head .h2,.om__head .h3{margin:0}
.om__grid{display:grid;gap:20px}
@container (min-width:720px){.om__grid{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:clamp(28px,4vw,56px);align-items:start}}
.om__card{border:1px solid var(--line);border-radius:16px;background:var(--panel);padding:clamp(12px,2.4cqi,28px);display:grid;gap:8px}
@container (max-width:519px){.om__card{grid-template-columns:.8fr 1fr;align-items:center;padding:10px 12px}}
.om .csimg{position:relative;margin:0;width:100%;aspect-ratio:16/10;border-radius:12px;overflow:hidden;background:var(--ink)}
.om .csimg img,.om .csimg__fx{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.om .csimg__fx ellipse{fill:var(--puls);stroke:var(--puls);fill-opacity:.1;stroke-width:3;stroke-opacity:.7;stroke-dasharray:2 12;stroke-linecap:round;opacity:0;transition:opacity .45s var(--ease)}
.om .fx-path{fill:none;stroke:var(--puls);stroke-width:9;stroke-linecap:round;stroke-linejoin:round;opacity:0;transition:opacity .45s var(--ease)}
.om .fx-dot{opacity:0;transition:opacity .4s var(--ease)}
.om .fx-dot circle:first-child{fill:none;stroke:var(--puls);stroke-width:4}
.om .fx-dot circle:last-child{fill:var(--puls)}
.om[data-step=p] .fx-atria{opacity:1}
.om[data-step=p] .fx-sa,.om[data-step=p] .fx-d-sa{opacity:1}
.om[data-step=pr] .fx-d-av{opacity:1}
.om[data-step=pr] .fx-sa{opacity:.35}
.om[data-step=qrs] .fx-his,.om[data-step=qrs] .fx-d-his,.om[data-step=qrs] .fx-d-pk{opacity:1}
.om[data-step=qrs] .fx-vent{opacity:1}
.om[data-step=st] .fx-vent{opacity:1}
.om[data-step=st] .fx-his{opacity:.3}
.om[data-step=t] .fx-vent{opacity:.5}
.om[data-step=t] .fx-his{opacity:.15}
.om .complex{width:100%;height:auto;max-height:240px;display:block}
.om .complex__grid line{stroke:var(--line);stroke-width:1}
.om .complex__seg{fill:none;stroke:var(--txt4);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;transition:stroke .4s}
.om .complex__br{opacity:0;transition:opacity .4s}
.om .complex__br path{fill:none;stroke:var(--puls);stroke-width:1.2}
.om .complex__br text{font:500 13px var(--font-mono);fill:var(--puls);text-anchor:middle;letter-spacing:.08em}
.om[data-step=p] [data-seg=p],.om[data-step=pr] [data-seg=pr],.om[data-step=pr] .complex__seg[data-seg=p],.om[data-step=qrs] [data-seg=qrs],.om[data-step=st] [data-seg=st],.om[data-step=t] [data-seg=t],.om[data-step=t] .complex__seg[data-seg=qrs],.om[data-step=t] .complex__seg[data-seg=st]{stroke:var(--puls);opacity:1}
.om .complex__seg[data-seg=pre],.om .complex__seg[data-seg=post]{stroke:var(--txt4)}
.om__side{display:grid;gap:20px;align-content:start;min-width:0}
.om__chips .chip{min-height:44px;min-width:52px;justify-content:center;font-family:var(--font-mono);letter-spacing:.06em}
.om__panels{display:grid}
.om__panel{grid-area:1/1;display:grid;gap:14px;align-content:start}
.om__panel[aria-hidden=true]{pointer-events:none}
.om__panel>p:not(.label){color:var(--txt2);font-size:16px;line-height:1.7;max-width:34em;margin:0}
.om__panel .label{margin:0}
.om__title{margin:0}
.om__clinic{padding-top:14px;border-top:1px solid var(--line);font-size:15px!important}
.om__clinic .label{display:block;margin-bottom:6px}
`;

export default function OrchestraMethod({
  header = "full",
  level = 2,
  className = "",
}: {
  /** full: etykieta + tytuł + lead; lead: sam lead (tytuł jest wyżej, np. w <summary>); none */
  header?: "full" | "lead" | "none";
  /** Poziom nagłówka sekcji (tytuły kroków są o jeden niżej) */
  level?: 2 | 3;
  className?: string;
}) {
  const [step, setStep] = useState<StepId>("p");
  const reduce = useReducedMotion();
  const uid = useId();
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = STEPS.findIndex((s) => s.id === step);
  const H = (level === 2 ? "h2" : "h3") as "h2" | "h3";
  const StepH = (level === 2 ? "h3" : "h4") as "h3" | "h4";
  const headId = `${uid}-h`;
  const panelId = `${uid}-panel`;

  const select = (i: number, focus = false) => {
    const n = (i + STEPS.length) % STEPS.length;
    if (n === activeIndex) return;
    setStep(STEPS[n].id);
    if (focus) chipRefs.current[n]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select(activeIndex + 1, true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select(activeIndex - 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      select(STEPS.length - 1, true);
    }
  };

  return (
    <section
      className={`om ${className}`}
      data-step={step}
      aria-labelledby={header === "full" ? headId : undefined}
      aria-label={header === "full" ? undefined : "Metoda: serce to orkiestra, EKG to jej nagranie"}
    >
      <style>{STYLES}</style>

      {header !== "none" && (
        <header className="om__head">
          {header === "full" && (
            <>
              <p className="label label--g">Metoda</p>
              <H className={level === 2 ? "h2" : "h3"} id={headId}>
                Serce to orkiestra.
                <br />
                <span className="muted">EKG to jej nagranie.</span>
              </H>
            </>
          )}
          <p className={level === 2 ? "lead" : "muted"}>
            Każdy załamek na zapisie to fragment koncertu. Gdy wiesz, kto go gra i dlaczego, nieprawidłowe załamki
            zaczynają tłumaczyć się same.
          </p>
        </header>
      )}

      <div className="om__grid">
        <div className="om__card">
          <figure
            className="csimg"
            role="img"
            aria-label="Ilustracja układu bodźcoprzewodzącego: węzeł zatokowy, węzeł przedsionkowo-komorowy, pęczek Hisa i włókna Purkinjego"
          >
            <img src="/img/gfx-0232.webp" width={1600} height={1000} alt="" loading="lazy" decoding="async" />
            <svg className="csimg__fx" viewBox="0 0 1600 1000" aria-hidden="true" focusable="false">
              <ellipse className="fx-atria" cx="370" cy="350" rx="230" ry="150" />
              <ellipse className="fx-vent" cx="560" cy="690" rx="330" ry="230" />
              <path className="fx-path fx-sa" d="M258 272 L487 437" />
              <path
                className="fx-path fx-his"
                d="M487 437 L523 477 L548 520 L583 852 L222 622 M548 520 L520 640 L690 828 L735 828 L800 790 L818 740 L818 610 M610 650 L660 667 M655 740 L690 760"
              />
              <g className="fx-dot fx-d-sa">
                <circle cx="258" cy="272" r="34" />
                <circle cx="258" cy="272" r="13" />
              </g>
              <g className="fx-dot fx-d-av">
                <circle cx="487" cy="437" r="34" />
                <circle cx="487" cy="437" r="13" />
              </g>
              <g className="fx-dot fx-d-his">
                <circle cx="523" cy="477" r="30" />
                <circle cx="523" cy="477" r="10" />
              </g>
              <g className="fx-dot fx-d-pk">
                <circle cx="818" cy="740" r="30" />
                <circle cx="818" cy="740" r="10" />
              </g>
            </svg>
          </figure>
          <svg
            className="complex"
            viewBox="0 0 315 252"
            role="img"
            aria-label="Jeden cykl pracy serca w zapisie EKG: załamek P, odstęp PQ, zespół QRS, odcinek ST i załamek T"
          >
            <g className="complex__grid">
              {[0, 70, 140, 210, 280].map((x) => (
                <line key={`v${x}`} x1={x} y1="0" x2={x} y2="252" />
              ))}
              {[0, 70, 140, 210].map((y) => (
                <line key={`h${y}`} x1="0" y1={y} x2="315" y2={y} />
              ))}
            </g>
            {SEGMENTS.map((s) => (
              <path key={s.seg} className="complex__seg" data-seg={s.seg} d={s.d} />
            ))}
            {BRACKETS.map((b) => (
              <g key={b.seg} className="complex__br" data-seg={b.seg}>
                <path d={b.d} />
                <text x={b.x} y={b.y}>
                  {b.text}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="om__side">
          <div className="chips om__chips" role="group" aria-label="Fragment zapisu EKG" onKeyDown={onKeyDown}>
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                type="button"
                className="chip"
                aria-pressed={s.id === step}
                aria-controls={panelId}
                onClick={() => select(i)}
                data-testid={`method-step-${s.id}`}
              >
                {s.chip}
              </button>
            ))}
          </div>

          <div className="om__panels" id={panelId} aria-live="polite">
            {STEPS.map((s) => {
              const on = s.id === step;
              const inertProps = on ? {} : ({ inert: "" } as Record<string, string>);
              return (
                <motion.div
                  key={s.id}
                  className="om__panel"
                  aria-hidden={!on}
                  {...inertProps}
                  initial={false}
                  // Nieaktywny tekst czeka 6 px niżej: nowy wchodzi krótkim wzniesieniem, stary gaśnie
                  // szybciej, niż wchodzi nowy. Sprężyna rusza z bieżącej wartości — klik w połowie
                  // przejścia po prostu zmienia cel, bez skoku.
                  animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 6 }}
                  transition={on ? spring : { type: "spring", bounce: 0, duration: 0.2 }}
                >
                  <p className="label label--g">{s.label}</p>
                  <StepH className="h3 om__title">{s.title}</StepH>
                  <p>{s.body}</p>
                  <p className="om__clinic">
                    <span className="label">W praktyce</span> {s.clinic}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
