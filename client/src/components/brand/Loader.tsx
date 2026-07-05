import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { SIGNET_PATH } from "./Logo";

interface LoaderProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Brand loader — the signet with a faster impulse (dur 1.4s, dasharray 90 450). */
export function Loader({ size = 40, className, label = "Ładowanie…" }: LoaderProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <span
      className={className}
      role="status"
      aria-label={label}
      style={{ display: "inline-flex" }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
        <path
          d={SIGNET_PATH}
          fill="none"
          stroke="#1E4536"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={SIGNET_PATH}
          fill="none"
          stroke="#3EE6A8"
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="90 450"
        >
          {!reduced && (
            <animate
              attributeName="stroke-dashoffset"
              from="90"
              to="-450"
              dur="1.4s"
              repeatCount="indefinite"
            />
          )}
        </path>
      </svg>
    </span>
  );
}

export default Loader;
