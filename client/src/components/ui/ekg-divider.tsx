export function EKGDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`ekg-divider ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
        width="100%"
        height="24"
      >
        <path
          d="M0,12 L150,12 L160,4 L168,20 L176,2 L184,22 L192,12 L400,12"
          fill="none"
          stroke="#1E4536"
          strokeWidth={2}
        />
        <path
          d="M0,12 L150,12 L160,4 L168,20 L176,2 L184,22 L192,12 L400,12"
          fill="none"
          stroke="#3EE6A8"
          strokeWidth={2}
          strokeDasharray="40 360"
          className="logo-pulse-path"
        />
      </svg>
    </div>
  );
}
