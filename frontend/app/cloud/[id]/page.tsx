import Link from "next/link";
import { headers } from "next/headers";
import CloudChat from "./CloudChat";
import CloudActions from "./CloudActions";

type CloudPageProps = {
  params?: {
    id?: string;
  };
};

function formatCloudTitle(id?: string) {
  if (!id) return "Cloud em andamento";
  const cleaned = id.replace(/[^a-zA-Z0-9-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Cloud em andamento";
  return cleaned
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18 8 12l7-6" />
    </svg>
  );
}

function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2c-1.65 2.96-2 4.67-2 6.5 0 3.05 2 5.5 2 5.5s2-2.45 2-5.5c0-2.78-1.2-4.28-2-6.5Zm0 18c-3.5 0-6-2.5-6-6 0-2.33 1.35-4.1 2.84-5.42.4-.34.78-.65 1.1-.95C9.9 7.65 9.5 8 9.5 9.5 9.5 12 12 14 12 14s2.5-2 2.5-4.5c0-1.5-.4-1.85-.44-2.87.32.3.7.62 1.1.95C16.65 7.9 18 9.67 18 12c0 3.5-2.5 6-6 6Z" />
    </svg>
  );
}

function PaperPlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}


async function getSiteOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return "http://localhost:3000";
  }

  return `${protocol}://${host}`;
}

export default async function CloudPage({ params }: CloudPageProps) {
  const title = formatCloudTitle(params?.id);
  const siteOrigin = await getSiteOrigin();
  const shareTarget = `${siteOrigin}/cloud/${params?.id ?? ""}`;

  return (
    <main className="min-h-screen bg-[#040510] text-white">
      <div className="mx-auto flex h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex h-12 w-12 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10">
              <BackIcon />
            </Link>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#A78BFA]">Cloud ativa</p>
              <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
              <p className="mt-2 text-sm text-white/60">AO VIVO · 240 online</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`mailto:?subject=${encodeURIComponent(`Participe da Cloud ${title}`)}&body=${encodeURIComponent(`Oi!\n\nQuero te convidar para a Cloud "${title}". Acesse o link e participe:\n${shareTarget}`)}`}
              className="inline-flex items-center gap-2 rounded-3xl bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(124,58,237,0.35)] transition hover:bg-[#6D28D9]"
            >
              <PaperPlaneIcon />
              Compartilhar
            </a>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-[40px] bg-[#050816]/90 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
          <div className="flex h-full flex-col border border-white/10 bg-[#060812]/50">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-[#1f1d2f]/90 text-white">
                  <FlameIcon />
                </div>
                <div>
                  <p className="text-lg font-semibold sm:text-xl">{title}</p>
                  <p className="mt-1 text-sm text-white/50">AO VIVO · 240 online</p>
                </div>
              </div>
              <CloudActions />
            </div>
            <div className="flex-1 overflow-hidden">
              <CloudChat cloudId={params?.id ?? "unknown"} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
