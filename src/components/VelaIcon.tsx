export function VelaIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-label="Vela"
    >
      <defs>
        <linearGradient id="vela-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%"   stopColor="#d946ef" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <path
        d="M24 1 Q24 24 47 24 Q24 24 24 47 Q24 24 1 24 Q24 24 24 1 Z"
        fill="url(#vela-grad)"
      />
    </svg>
  );
}
