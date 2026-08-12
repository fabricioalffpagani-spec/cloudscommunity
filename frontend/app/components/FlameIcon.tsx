type FlameIconProps = {
  s?: number;
  className?: string;
  filled?: boolean;
};

/** Shared Clouds icon used for Trending and Hype. */
export function FlameIcon({ s = 22, className = "" }: FlameIconProps) {
  return (
    <svg
      viewBox="0 0 24 26"
      width={s}
      height={Math.round(s * 1.12)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.1 24.1a8.1 8.1 0 0 1-5.8-13.7c1.5-1.9 3.5-3.6 6.2-5.7-.2 3.2-.2 5.1.9 6.8.8 1.3 2.3 1.8 3.4 1.5 1-.2 1.6-1 1.9-2 2.5 2.9 3.4 5.7 2.9 8.4a8.1 8.1 0 0 1-9.2 4.7Z" />
    </svg>
  );
}
