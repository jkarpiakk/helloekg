/**
 * Certyfikat ukończenia jako wydruk z aparatu EKG: arkusz A4 poziomo (297 × 210 mm),
 * cały w SVG w milimetrach, więc na ekranie skaluje się do szerokości, a drukuje 1:1.
 * Pasek rytmu jest narysowany w skali papieru (25 mm/s, 10 mm/mV): cecha 1 mV,
 * rytm zatokowy 72/min (RR 0,83 s), PQ 0,16 s, QRS 0,08 s, QT 0,34 s.
 * Kolory są stałe (papier do druku), niezależne od motywu aplikacji.
 */

import { createPortal } from "react-dom";

const INK = "#0B0F14";
const MUTED = "#5C6870";
const GREEN = "#0B7E54";
const PAPER = "#FCFDFC";
const GRID_MINOR = "rgba(11,126,84,.10)";
const GRID_MAJOR = "rgba(11,126,84,.24)";

const HEADING = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/* Pas siatki i paska rytmu (mm) */
const BAND = { x: 16, y: 116, w: 265, h: 75 };
const BASE = 152; // linia izoelektryczna
const MM_S = 25; // przesuw
const MM_MV = 10; // cecha
const RR = (60 / 72) * MM_S; // 72/min

/** Jedno pobudzenie zatokowe od x (mm): P, PQ, QRS, ST, T. Zwraca fragment ścieżki. */
function beat(x: number): string {
  const v = (mv: number) => (BASE - mv * MM_MV).toFixed(2);
  const s = (sec: number) => sec * MM_S;
  const p0 = x, p1 = p0 + s(0.08); // P 0,08 s, 0,15 mV
  const q0 = p1 + s(0.08); // odcinek PQ (odstęp PQ 0,16 s)
  const r = q0 + s(0.03), sW = r + s(0.03), j = sW + s(0.02); // QRS 0,08 s
  const t0 = j + s(0.1), t1 = t0 + s(0.16); // ST 0,1 s, T 0,16 s, 0,3 mV
  return [
    `L${p0.toFixed(2)} ${v(0)}`,
    `Q${((p0 + p1) / 2).toFixed(2)} ${v(0.3)} ${p1.toFixed(2)} ${v(0)}`,
    `L${q0.toFixed(2)} ${v(0)}`,
    `L${(q0 + s(0.01)).toFixed(2)} ${v(-0.1)}`,
    `L${r.toFixed(2)} ${v(1.2)}`,
    `L${sW.toFixed(2)} ${v(-0.3)}`,
    `L${j.toFixed(2)} ${v(0)}`,
    `L${t0.toFixed(2)} ${v(0)}`,
    `C${(t0 + s(0.06)).toFixed(2)} ${v(0.42)} ${(t0 + s(0.11)).toFixed(2)} ${v(0.4)} ${t1.toFixed(2)} ${v(0)}`,
  ].join(" ");
}

const X0 = BAND.x + 5;
const BEATS: number[] = [];
for (let x = X0 + 16; x + RR <= BAND.x + BAND.w - 2; x += RR) BEATS.push(x);

function rhythmStrip(): string {
  const x0 = X0;
  // cecha 1 mV: 0,2 s szerokości, 10 mm wysokości
  let d = `M${x0} ${BASE} L${x0 + 3} ${BASE} L${x0 + 3} ${BASE - MM_MV} L${x0 + 8} ${BASE - MM_MV} L${x0 + 8} ${BASE} L${x0 + 14} ${BASE}`;
  for (const x of BEATS) d += " " + beat(x);
  return d + ` L${BAND.x + BAND.w - 3} ${BASE}`;
}

function grid() {
  const lines: JSX.Element[] = [];
  for (let i = 0; i <= BAND.w; i++) {
    const x = BAND.x + i;
    lines.push(<line key={`v${i}`} x1={x} y1={BAND.y} x2={x} y2={BAND.y + BAND.h} stroke={i % 5 ? GRID_MINOR : GRID_MAJOR} strokeWidth={i % 5 ? 0.1 : 0.22} />);
  }
  for (let i = 0; i <= BAND.h; i++) {
    const y = BAND.y + i;
    lines.push(<line key={`h${i}`} x1={BAND.x} y1={y} x2={BAND.x + BAND.w} y2={y} stroke={i % 5 ? GRID_MINOR : GRID_MAJOR} strokeWidth={i % 5 ? 0.1 : 0.22} />);
  }
  return lines;
}

const LOGO_PATH = "M4,50 L18,50 L26,14 L34,86 L40,50 L60,50 L66,14 L74,86 L80,50 L96,50";
const STRIP = rhythmStrip();

/* Pomiary na jednym pobudzeniu, jak cyrklem: PQ, QRS, QT i RR do następnego */
const MB = BEATS[4] ?? X0 + 16;
const M = (() => {
  const s = (sec: number) => sec * MM_S;
  const p0 = MB, q0 = p0 + s(0.16), r = q0 + s(0.03), j = q0 + s(0.08), t1 = j + s(0.1) + s(0.16);
  return { p0, q0, r, j, t1, r2: r + RR };
})();
const MEASURES: Array<{ x1: number; x2: number; y: number; label: string; side: "start" | "end" }> = [
  { x1: M.p0, x2: M.q0, y: 133, label: "PQ 0,16 s", side: "end" },
  { x1: M.q0, x2: M.j, y: 129, label: "QRS 0,08 s", side: "end" },
  { x1: M.q0, x2: M.t1, y: 125, label: "QT 0,34 s", side: "end" },
  { x1: M.r, x2: M.r2, y: 120.5, label: "RR 0,83 s", side: "end" },
];

export interface CertificateSheetProps {
  name: string;
  certificateId: string;
  issuedAt: string | Date;
  /** Tytuły modułów kursu w kolejności (z /api/modules) */
  modules: string[];
  courseName?: string;
  signatory?: { name: string; role: string };
  className?: string;
}

export default function CertificateSheet({
  name,
  certificateId,
  issuedAt,
  modules,
  courseName = "Kurs EKG od podstaw",
  signatory = { name: "Jakub Karpiak", role: "autor kursu helloEKG" },
  className,
}: CertificateSheetProps) {
  const date = new Date(issuedAt);
  const dateShort = date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  // Nazwisko mieści się w lewej kolumnie (164 mm): Space Grotesk ≈ 0,56 em na znak
  const nameSize = Math.min(15, 164 / (Math.max(name.length, 1) * 0.56));
  const mods = modules.slice(0, 8);

  return (
    <svg
      viewBox="0 0 297 210"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Certyfikat ukończenia kursu: ${name}, ${courseName}, wydany ${dateShort}, numer ${certificateId}`}
      className={`cert-sheet block h-auto w-full ${className ?? ""}`}
      style={{ background: PAPER, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      data-testid="certificate-sheet"
    >
      <rect width="297" height="210" fill={PAPER} />

      {/* Nagłówek jak na wydruku z aparatu */}
      <g transform="translate(16 15.5) scale(.075)">
        <path d={LOGO_PATH} stroke={GREEN} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      <text x="25.2" y="21.3" fontFamily={HEADING} fontSize="5.4" fontWeight={500} fill={INK} letterSpacing="-.08">
        hello<tspan fontWeight={600}>EKG</tspan>
      </text>
      <text x="281" y="20.6" textAnchor="end" fontFamily={MONO} fontSize="2.5" fill={MUTED} letterSpacing=".35">
        25 mm/s · 10 mm/mV · ODPROWADZENIE II
      </text>
      <line x1="16" y1="27" x2="281" y2="27" stroke={INK} strokeWidth=".18" />

      {[["NR CERTYFIKATU", certificateId, 16], ["DATA WYDANIA", dateShort, 92]].map(([k, v, x]) => (
        <g key={k as string}>
          <text x={x as number} y="34.5" fontFamily={MONO} fontSize="2.2" fill={MUTED} letterSpacing=".35">{k}</text>
          <text x={x as number} y="39.8" fontFamily={MONO} fontSize="3.1" fill={INK}>{v}</text>
        </g>
      ))}
      <line x1="16" y1="44.5" x2="281" y2="44.5" stroke={INK} strokeOpacity=".14" strokeWidth=".18" />

      {/* Lewa kolumna: komu i za co */}
      <text x="16" y="60" fontFamily={MONO} fontSize="3" fill={GREEN} letterSpacing=".5">CERTYFIKAT UKOŃCZENIA KURSU</text>
      <text x="15.2" y="81" fontFamily={HEADING} fontSize={nameSize} fontWeight={500} fill={INK} letterSpacing={-nameSize * 0.03}>
        {name}
      </text>
      <text x="16" y="94" fontFamily={HEADING} fontSize="6.2" fontWeight={500} fill={INK} letterSpacing="-.12">{courseName}</text>
      <text fontFamily={SANS} fontSize="3.4" fill={MUTED}>
        <tspan x="16" y="102">Wszystkie tematy kursu opanowane: wykłady, pytania z wyjaśnieniami</tspan>
        <tspan x="16" y="107.4">i powtórki, aż do poprawnej odpowiedzi na każde pytanie.</tspan>
      </text>

      {/* Prawa kolumna: zakres */}
      <line x1="186" y1="54" x2="186" y2="108" stroke={INK} strokeOpacity=".14" strokeWidth=".18" />
      <text x="194" y="60" fontFamily={MONO} fontSize="2.6" fill={MUTED} letterSpacing=".45">ZAKRES</text>
      {mods.map((m, i) => (
        <g key={m}>
          <text x="194" y={67.5 + i * 6} fontFamily={MONO} fontSize="2.5" fill={GREEN}>{String(i + 1).padStart(2, "0")}</text>
          <text x="201" y={67.5 + i * 6} fontFamily={SANS} fontSize="3.05" fill={INK}>{m}</text>
        </g>
      ))}

      {/* Papier milimetrowy i pasek rytmu */}
      <g>{grid()}</g>
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={BAND.x + i * 75 + 5} y1={BAND.y} x2={BAND.x + i * 75 + 5} y2={BAND.y + 2.5} stroke={INK} strokeWidth=".3" />
      ))}
      <text x={BAND.x + 2} y={BAND.y + 9} fontFamily={MONO} fontSize="3" fill={INK}>II</text>
      <path d={STRIP} fill="none" stroke={INK} strokeWidth=".38" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M${MB} ${BASE} ` + beat(MB)} fill="none" stroke={GREEN} strokeWidth=".5" strokeLinejoin="round" strokeLinecap="round" />
      {[M.p0, M.q0, M.j, M.t1].map((x) => (
        <line key={x} x1={x} y1={125} x2={x} y2={BASE + 3} stroke={GREEN} strokeWidth=".12" strokeDasharray=".6 .6" />
      ))}
      {[M.r, M.r2].map((x) => (
        <line key={x} x1={x} y1={120.5} x2={x} y2={BASE - 12.5} stroke={GREEN} strokeWidth=".12" strokeDasharray=".6 .6" />
      ))}
      {MEASURES.map((m) => (
        <g key={m.label} stroke={GREEN} strokeWidth=".25">
          <line x1={m.x1} y1={m.y} x2={m.x2} y2={m.y} />
          {m.x1 > M.p0 + 0.1 && <line x1={M.p0 - 1} y1={m.y} x2={m.x1} y2={m.y} strokeWidth=".1" strokeDasharray=".4 .5" />}
          <line x1={m.x1} y1={m.y - 0.9} x2={m.x1} y2={m.y + 0.9} />
          <line x1={m.x2} y1={m.y - 0.9} x2={m.x2} y2={m.y + 0.9} />
          <text
            x={m.side === "end" ? M.p0 - 2 : m.x2 + 1.2}
            y={m.y + 0.8}
            textAnchor={m.side}
            stroke="none"
            fill={GREEN}
            fontFamily={MONO}
            fontSize="2.2"
            letterSpacing=".2"
          >
            {m.label}
          </text>
        </g>
      ))}

      {/* Interpretacja i podpis na białych polach nad siatką */}
      <rect x="21" y="163" width="150" height="23" fill={PAPER} stroke={INK} strokeOpacity=".2" strokeWidth=".18" />
      <text x="25" y="169.5" fontFamily={MONO} fontSize="2.3" fill={GREEN} letterSpacing=".45">INTERPRETACJA</text>
      <text fontFamily={SANS} fontSize="3.4" fill={INK}>
        <tspan x="25" y="176">Rytm zatokowy miarowy, 72/min. PQ 0,16 s, QRS 0,08 s, QTc w normie.</tspan>
        <tspan x="25" y="181.4" fontWeight={600}>Kurs ukończony, wszystkie tematy opanowane.</tspan>
      </text>

      <rect x="190" y="163" width="86" height="23" fill={PAPER} stroke={INK} strokeOpacity=".2" strokeWidth=".18" />
      <text x="194" y="175.5" fontFamily={HEADING} fontSize="4.8" fontWeight={500} fill={INK} letterSpacing="-.1">{signatory.name}</text>
      <line x1="194" y1="178" x2="272" y2="178" stroke={INK} strokeWidth=".18" />
      <text x="194" y="182.6" fontFamily={MONO} fontSize="2.2" fill={MUTED} letterSpacing=".35">{signatory.role.toUpperCase()}</text>

      <text x="16" y="200" fontFamily={MONO} fontSize="2.2" fill={MUTED} letterSpacing=".35">HELLOEKG.PL</text>
      <text x="281" y="200" textAnchor="end" fontFamily={MONO} fontSize="2.2" fill={MUTED} letterSpacing=".35">{certificateId}</text>
    </svg>
  );
}

/** Druk: tylko arkusz, A4 poziomo, bez marginesów. Aplikacja (#root) znika, drukuje się kopia z <body>. */
const PRINT_CSS = `
.cert-print-copy { display: none; }
@media print {
  @page { size: A4 landscape; margin: 0; }
  html, body { background: #FCFDFC !important; margin: 0 !important; }
  #root { display: none !important; }
  .cert-print-copy { display: block !important; width: 297mm; height: 210mm; overflow: hidden; }
  .cert-print-copy .cert-sheet { width: 297mm; height: 210mm; }
}`;

/** Kopia arkusza do druku („Drukuj / Zapisz PDF”), wstawiana bezpośrednio do <body>. */
export function CertificatePrintCopy(props: CertificateSheetProps) {
  return createPortal(
    <div className="cert-print-copy" aria-hidden>
      <style>{PRINT_CSS}</style>
      <CertificateSheet {...props} />
    </div>,
    document.body,
  );
}
