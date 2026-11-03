type CloudFeedNavigationProps = {
  activeIndex: number;
  cloudCount: number;
  onNavigate: (direction: -1 | 1) => void;
};

export function CloudFeedNavigation({
  activeIndex,
  cloudCount,
  onNavigate,
}: CloudFeedNavigationProps) {
  if (cloudCount <= 1) return null;

  return (
    <div
      style={{ right: "max(1rem, calc(50% - 625px))" }}
      className="pointer-events-none absolute inset-y-0 z-20 hidden flex-col justify-center gap-2 md:flex"
      data-testid="cloud-feed-navigation"
    >
      <button
        type="button"
        aria-label="Cloud anterior"
        onClick={() => onNavigate(-1)}
        disabled={activeIndex === 0}
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171325]/25 text-lg text-white/65 shadow-sm backdrop-blur-md transition hover:border-white/20 hover:bg-[#2B174F]/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Próxima Cloud"
        onClick={() => onNavigate(1)}
        disabled={activeIndex >= cloudCount - 1}
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171325]/25 text-lg text-white/65 shadow-sm backdrop-blur-md transition hover:border-white/20 hover:bg-[#2B174F]/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
      >
        ↓
      </button>
    </div>
  );
}
