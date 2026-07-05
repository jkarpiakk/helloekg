interface ProgressBarProps {
  /** 0–100 */
  value: number;
  className?: string;
  label?: string;
}

/** Course progress bar — track #1E4536, fill #3EE6A8, 4px tall, 2px radius (handoff §5). */
export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div style={{ height: 4, borderRadius: 2, background: "#1E4536", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "#3EE6A8",
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
