import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-0 border-t border-white/[0.07] bg-[#060410]">
      <div className="mx-auto max-w-[1280px] px-5 pb-1 pt-1 lg:px-8">

        <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:justify-between sm:items-start">
          <div className="max-w-[420px]">
            <p className="text-[12px] font-semibold text-white">Clouds Community</p>
            <p className="mt-0.5 text-[11px] leading-[1.5] text-white/50">
              Uma plataforma para conversar, compartilhar e conectar em tempo real.
            </p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex flex-wrap items-center justify-center gap-1">
              <Link
                href="/"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[12px] font-semibold text-white/80 transition hover:bg-white/10"
              >
                Home
              </Link>
              <Link
                href="/messages"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[12px] font-semibold text-white/80 transition hover:bg-white/10"
              >
                Messages
              </Link>
              <Link
                href="/meet"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[12px] font-semibold text-white/80 transition hover:bg-white/10"
              >
                Meet
              </Link>
            </div>
            <p className="text-[10px] text-white/35">
              © {new Date().getFullYear()} Clouds Community
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

