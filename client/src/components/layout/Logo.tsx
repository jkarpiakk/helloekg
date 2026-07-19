import { useEffect, useId, useState } from "react";

interface LogoProps {
  className?: string;
  markSize?: number;
  showWordmark?: boolean;
  animated?: boolean;
}

const H_PATH =
  "M4,50 L18,50 L26,14 L34,86 L40,50 L60,50 L66,14 L74,86 L80,50 L96,50";

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

export default function Logo({ className = "", markSize = 40, showWordmark = true, animated = true }: LogoProps) {
  const reducedMotion = useReducedMotion();
  const isAnimated = animated && !reducedMotion;
  const gradientId = useId();

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} data-testid="logo">
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="helloEKG"
      >
        {isAnimated ? (
          <>
            <path
              d={H_PATH}
              stroke="#1E4536"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={H_PATH}
              stroke="#3EE6A8"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="60 300"
              className="logo-pulse-path"
            />
          </>
        ) : (
          <path
            d={H_PATH}
            stroke="#3EE6A8"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {showWordmark && (
        <span className="font-heading text-lg sm:text-xl leading-none whitespace-nowrap">
          <span className="font-medium text-foreground">hello</span>
          <span className="font-semibold text-foreground">EKG</span>
        </span>
      )}
    </span>
  );
}
