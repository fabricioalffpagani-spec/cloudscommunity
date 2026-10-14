export function ReadWelcomeHint({ fading }: { fading: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-4 transition-opacity duration-700 md:hidden ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <p
        className="w-full max-w-[22rem] break-words rounded-2xl border border-white/15 px-6 py-5 text-center text-[20px] font-semibold leading-snug text-white shadow-[0_16px_42px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:px-7 sm:py-6 sm:text-[22px] [overflow-wrap:anywhere]"
        style={{ backgroundColor: "rgba(8, 6, 18, 0.94)" }}
      >
        Leia conversas que já aconteceram...
      </p>
    </div>
  );
}
