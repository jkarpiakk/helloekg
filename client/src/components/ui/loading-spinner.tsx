import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Sygnet H z logo (ten sam kształt co w belce i na helloekg.pl) */
const H_PATH = "M4,50 L18,50 L26,14 L34,86 L40,50 L60,50 L66,14 L74,86 L80,50 L96,50";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: 16, md: 32, lg: 56 } as const;

/**
 * Jedyny wskaźnik ładowania kursu: sygnet H, po którym biegnie impuls (jak logo w belce).
 * Zastąpił kręcące się kółko, żeby ładowanie trasy i ładowanie danych wyglądały tak samo.
 * „Ogranicz ruch”: bez biegnącego impulsu, sam nieruchomy sygnet w kolorze akcentu.
 * Nazwa i API bez zmian (size sm/md/lg, data-testid="loading-spinner").
 */
export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const reduce = useReducedMotion();
  const px = SIZES[size];

  return (
    <div
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      role="status"
      aria-label="Ładowanie"
      data-testid="loading-spinner"
    >
      <svg width={px} height={px} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d={H_PATH}
          style={{ stroke: reduce ? "var(--puls)" : "var(--puls-dark)" }}
          strokeWidth={size === "sm" ? 10 : 7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {!reduce && (
          <path
            d={H_PATH}
            style={{ stroke: "var(--puls)", animationDuration: "1.4s" }}
            strokeWidth={size === "sm" ? 10 : 7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="90 450"
            className="logo-pulse-path"
          />
        )}
      </svg>
      <span className="sr-only">Ładowanie</span>
    </div>
  );
}
