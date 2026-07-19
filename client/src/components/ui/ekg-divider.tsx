import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";

// Ścieżka linii EKG z brand booka helloEKG — morfologia STAŁA, element identyfikacji
// marki. Nie modyfikować, nie upraszczać, nie generować własnych wariantów.
const EKG_LINE_PATH =
  "M0,26 L80,26 L92,20 L104,26 L150,26 L160,6 L170,42 L180,26 L240,26 L258,16 L276,26 L400,26 L412,20 L424,26 L470,26 L480,6 L490,42 L500,26 L560,26 L578,16 L596,26 L720,26 L732,20 L744,26 L790,26 L800,6 L810,42 L820,26 L880,26 L898,16 L916,26 L1040,26 L1052,20 L1064,26 L1110,26 L1120,6 L1130,42 L1140,26 L1200,26";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function EKGDivider({ className = "" }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();

  // Na jasnym tle impuls #3EE6A8 ma kontrast poniżej AA i praktycznie znika —
  // brand book dopuszcza tam wyłącznie ciemniejszy akcent #0B7E54.
  const isLight = theme === "light";
  const traceColor = isLight ? "#93B8A8" : "#1E4536";
  const pulseColor = isLight ? "#0B7E54" : "#3EE6A8";

  return (
    <div className={`ekg-divider ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1200 44"
        preserveAspectRatio="none"
        width="100%"
        height="44"
      >
        {/* Dolna warstwa: ślad */}
        <path
          d={EKG_LINE_PATH}
          fill="none"
          stroke={traceColor}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {reducedMotion ? (
          /* prefers-reduced-motion: linia statyczna — pełna zieleń, bez animacji */
          <path
            d={EKG_LINE_PATH}
            fill="none"
            stroke={pulseColor}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          /* Górna warstwa: wędrujący impuls */
          <path
            d={EKG_LINE_PATH}
            fill="none"
            stroke={pulseColor}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="8 2400"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-2408"
              dur="5s"
              repeatCount="indefinite"
            />
          </path>
        )}
      </svg>
    </div>
  );
}
