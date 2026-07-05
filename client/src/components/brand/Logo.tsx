import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Canonical signet path — the "H" written as an ECG trace. Never split into segments. */
export const SIGNET_PATH =
  "M4,50 L18,50 L26,14 L34,86 L40,50 L60,50 L66,14 L74,86 L80,50 L96,50";

export type LogoVariant = "A" | "B" | "C" | "D";

interface LogoProps {
  /** A: green on dark (default) · B: ink-green on light · C: dark on full green · D: mono (currentColor) */
  variant?: LogoVariant;
  /** "Żywy znak" — pulse runs along the trace. Auto-disabled under prefers-reduced-motion. */
  animated?: boolean;
  showWordmark?: boolean;
  /** Signet height in px. */
  size?: number;
  /** Pulse rhythm as R-R interval. 72 is canonical (product/print). */
  bpm?: 48 | 72 | 140;
  className?: string;
  title?: string;
}

const STROKE: Record<LogoVariant, string> = {
  A: "#3EE6A8",
  B: "#0B7E54",
  C: "#07130E",
  D: "currentColor",
};

export function Logo({
  variant = "A",
  animated = false,
  showWordmark = true,
  size = 28,
  bpm = 72,
  className,
  title = "helloEKG",
}: LogoProps) {
  const reduced = usePrefersReducedMotion();
  const stroke = STROKE[variant];
  const doAnimate = animated && !reduced;
  // 72 BPM => 2.5s (canonical). Faster BPM => shorter duration.
  const dur = `${(2.5 * (72 / bpm)).toFixed(3)}s`;

  const wordColor =
    variant === "B"
      ? "#0C1210"
      : variant === "C"
        ? "#07130E"
        : variant === "D"
          ? "currentColor"
          : "#F2F6F4";

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.34 }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={title}
        style={{ display: "block", flex: "none", overflow: "visible" }}
      >
        {doAnimate ? (
          <>
            <path
              d={SIGNET_PATH}
              fill="none"
              stroke="#1E4536"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={SIGNET_PATH}
              fill="none"
              stroke={stroke}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="180 360"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="180"
                to="-360"
                dur={dur}
                repeatCount="indefinite"
              />
            </path>
          </>
        ) : (
          <path
            d={SIGNET_PATH}
            fill="none"
            stroke={stroke}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.015em",
            fontSize: size * 0.78,
            lineHeight: 1,
            color: wordColor,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontWeight: 500 }}>hello</span>
          <span style={{ fontWeight: 600 }}>EKG</span>
        </span>
      )}
    </span>
  );
}

export default Logo;
