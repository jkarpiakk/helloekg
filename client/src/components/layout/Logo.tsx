import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface LogoProps {
  className?: string;
  /** Wielkość znaku w px — na landingu 26 */
  markSize?: number;
  showWordmark?: boolean;
  animated?: boolean;
}

const H_PATH =
  "M4,50 L18,50 L26,14 L34,86 L40,50 L60,50 L66,14 L74,86 L80,50 L96,50";

/**
 * Logo jak na helloekg.pl: znak 26px (ślad + biegnący puls) i wordmark „hello**EKG**”
 * w Space Grotesk 500/600. Kolory z tokenów, więc działa w obu motywach.
 * Puls to jedyna nieskończona animacja w interfejsie; przy „Ogranicz ruch” znika.
 */
export default function Logo({ className = "", markSize = 26, showWordmark = true, animated = true }: LogoProps) {
  const reducedMotion = useReducedMotion();
  const isAnimated = animated && !reducedMotion;

  return (
    <span className={`inline-flex items-center gap-[9px] text-[var(--txt)] ${className}`} data-testid="logo">
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="helloEKG"
        className="shrink-0"
      >
        <path
          d={H_PATH}
          stroke={isAnimated ? "var(--puls-dark)" : "var(--puls)"}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {isAnimated && (
          <path
            d={H_PATH}
            stroke="var(--puls)"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="180 360"
            className="logo-pulse-path"
          />
        )}
      </svg>
      {showWordmark && (
        <span className="font-heading text-[18px] font-medium leading-none tracking-[-0.015em] whitespace-nowrap">
          hello<b className="font-semibold">EKG</b>
        </span>
      )}
    </span>
  );
}
