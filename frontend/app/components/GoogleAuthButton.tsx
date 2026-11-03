export function GoogleAuthButton({
  returnTo,
  intent = "login",
}: {
  returnTo: string;
  intent?: "login" | "link";
}) {
  const params = new URLSearchParams({ returnTo, intent });
  return (
    <a
      href={`/api/auth/google/start?${params.toString()}`}
      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-white/[0.14] bg-white/[0.06] px-6 py-3 text-[15px] font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC]"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.98-.9 6.64-2.42l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#FBBC05"
          d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.49l3.35-2.62Z"
        />
        <path
          fill="#EA4335"
          d="M12 6c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.62C7.18 7.76 9.39 6 12 6Z"
        />
      </svg>
      {intent === "link" ? "Vincular conta Google" : "Continuar com Google"}
    </a>
  );
}
