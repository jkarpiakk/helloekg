import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Fixed ECG morphology from the handoff (§5) — not random zig-zags. */
const EKG_PATH =
  "M0,26 L80,26 L92,20 L104,26 L150,26 L160,6 L170,42 L180,26 L240,26 L258,16 L276,26 L400,26 L412,20 L424,26 L470,26 L480,6 L490,42 L500,26 L560,26 L578,16 L596,26 L720,26 L732,20 L744,26 L790,26 L800,6 L810,42 L820,26 L880,26 L898,16 L916,26 L1040,26 L1052,20 L1064,26 L1110,26 L1120,6 L1130,42 L1140,26 L1200,26";

interface EKGDividerProps {
  className?: string;
  animated?: boolean;
  height?: number;
}

/** Brand separator. Use at most once per screen; never in a colour other than the system green. */
export function EKGDivider({ className, animated = true, height = 44 }: EKGDividerProps) {
  const reduced = usePrefersReducedMotion();
  const doAnimate = animated && !reduced;

  return (
    <svg
      viewBox="0 0 1200 44"
      preserveAspectRatio="none"
      className={className}
      width="100%"
      height={height}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d={EKG_PATH} fill="none" stroke="#1E4536" strokeWidth={1} />
      <path
        d={EKG_PATH}
        fill="none"
        stroke="#3EE6A8"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray="8 2400"
      >
        {doAnimate && (
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-2408"
            dur="5s"
            repeatCount="indefinite"
          />
        )}
      </path>
    </svg>
  );
}

export default EKGDivider;
