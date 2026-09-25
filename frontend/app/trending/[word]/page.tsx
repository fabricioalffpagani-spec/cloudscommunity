"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { use } from "react";
import { HeaderBrand } from "../../components/HeaderBrand";
import { FlameIcon } from "../../components/FlameIcon";
import { SessionUserAvatar, useSessionUser } from "../../components/session-user";
import { useRouter } from "next/navigation";
import { SearchModal } from "../../components/SearchModal";
import { NotificationsBell } from "../../components/NotificationsPanel";
import { MessagesNavLink } from "../../components/MessagesNavLink";
import { MobileAppNav, MobileFeedHeader } from "../../components/MobileAppChrome";

type CloudApiPayload = {
  id: string;
  title: string;
  description: string | null;
  duration: string;
  visibility: "public" | "private";
  status: string;
  createdAt: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
  hypesCount: number;
  membersCount: number;
  participantProfiles?: Array<{ id: string; name: string; avatarUrl: string | null }>;
  href: string;
};

type Cloud = {
  id: string;
  title: string;
  description?: string;
  duration: string;
  createdAt: Date;
  visibility: "public" | "private";
  href: string;
  hypes: number;
  membersCount: number;
  authorName: string;
  authorHandle: string;
  authorPhoto?: string;
  participantProfiles: Array<{ id: string; name: string; avatarUrl: string | null }>;
};

const DURATION_SECONDS: Record<string, number> = {
  "10min": 10 * 60,
  "30min": 30 * 60,
  "2h": 2 * 60 * 60,
  "5h": 5 * 60 * 60,
  "24h": 24 * 60 * 60,
};

function getRemainingSeconds(cloud: Cloud): number {
  const durationSecs = DURATION_SECONDS[cloud.duration] ?? 30 * 60;
  const elapsed = (Date.now() - cloud.createdAt.getTime()) / 1000;
  return Math.max(durationSecs - elapsed, 0);
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18 8 12l7-6" />
    </svg>
  );
}

function CloudCard({ cloud }: { cloud: Cloud }) {
  const [now, setNow] = useState(Date.now());
  const router = useRouter();

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const remaining = getRemainingSeconds({ ...cloud, createdAt: new Date(cloud.createdAt) });
  const isActive = remaining > 0;

  const handleEnter = () => {
    const params = new URLSearchParams({
      title: cloud.title,
      duration: cloud.duration,
      createdAt: cloud.createdAt.toISOString(),
      participants: String(cloud.membersCount),
    });
    router.push(`/cloud/${cloud.id}?${params.toString()}`);
  };

  void now; // usado implicitamente via remaining

  return (
    <div className="cloud-card flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#100828]/80 px-6 py-5 transition hover:border-[#A855F7]/30 hover:bg-[#180d38]/80">
      {/* Header do card */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {cloud.authorPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cloud.authorPhoto} alt={cloud.authorName} className="h-10 w-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#A855F7] text-[13px] font-bold text-white">
              {cloud.authorName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-white">{cloud.authorName}</p>
            <p className="text-[12px] text-white/40">@{cloud.authorHandle}</p>
          </div>
        </div>
      </div>

      {/* Título */}
      <h3 className="text-[18px] font-bold leading-snug text-white">{cloud.title}</h3>

      {/* Descrição */}
      {cloud.description && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-white/50">{cloud.description}</p>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-[13px] text-white/40">
          <span className="flex items-center gap-1.5">
            <ClockIcon />
            {isActive ? formatCountdown(remaining) : "Encerrada"}
          </span>
          <div className="flex -space-x-2">{cloud.participantProfiles.slice(0,7).map(person => person.avatarUrl ? <img key={person.id} src={person.avatarUrl} alt={person.name} className="h-7 w-7 rounded-full border-2 border-[#100828] object-cover"/> : <span key={person.id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#100828] bg-[#7C3AED] text-[10px] font-bold text-white">{person.name.slice(0,1)}</span>)}{cloud.participantProfiles.length > 7 && <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#100828] bg-[#32106f] text-[10px] font-bold text-white">+{cloud.participantProfiles.length-7}</span>}</div>
        </div>
        <button
          type="button"
          onClick={handleEnter}
          disabled={!isActive}
          className="shrink-0 rounded-full bg-[#9333EA] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

export default function TrendingWordPage({ params }: { params: Promise<{ word: string }> }) {
  const { word: encodedWord } = use(params);
  const word = decodeURIComponent(encodedWord);
  const { user: sessionUser } = useSessionUser();

  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clouds", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; clouds?: CloudApiPayload[] };
      const all: Cloud[] = Array.isArray(data?.clouds)
        ? data.clouds.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description ?? undefined,
            duration: c.duration,
            createdAt: new Date(c.createdAt),
            visibility: c.visibility,
            href: c.href,
            hypes: c.hypesCount,
            membersCount: Math.max(1, c.membersCount),
            authorName: c.author.name,
            authorHandle: c.author.username,
            authorPhoto: c.author.avatarUrl ?? undefined,
            participantProfiles: c.participantProfiles ?? [],
          }))
        : [];

      // Filtra clouds que contêm a palavra no título (case-insensitive) e ainda estão ativas
      const filtered = all.filter(
        (c) =>
          c.title.toLowerCase().includes(word.toLowerCase()) &&
          getRemainingSeconds(c) > 0,
      );

      setClouds(filtered);
    } catch {
      setClouds([]);
    } finally {
      setLoading(false);
    }
  }, [word]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className="flex h-[100dvh] min-h-screen flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}
    >
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {/* ── Header ── */}
      <header className="hidden flex-none bg-transparent md:block">
        <div className="mx-auto flex h-[100px] max-w-[1280px] items-end justify-between gap-4 px-8 pb-4">
          <Link href="/" className="flex shrink-0 items-center gap-4 pb-2">
            <HeaderBrand />
          </Link>
          <nav aria-label="Navegação" className="flex items-end gap-8 pb-2">
            <Link href="/" className="inline-flex h-12 items-center text-[20px] font-semibold text-white/50 transition hover:text-white">Talk</Link>
            <Link href="/read" className="inline-flex h-12 items-center text-[20px] font-semibold text-white/50 transition hover:text-white">Read</Link>
            <Link href="/meet" className="inline-flex h-12 items-center text-[20px] font-semibold text-white/50 transition hover:text-white">Meet</Link>
          </nav>
          <div className="flex items-center gap-4 pb-2">
            <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.12] text-white transition hover:bg-white/[0.20]">
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.5" /><path d="M20 20l-3.5-3.5" /></svg>
            </button>
            <NotificationsBell buttonClassName="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]" />
            <Link href="/settings" aria-label="Configurações" className="order-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]">
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
            </Link>
            <Link href="/profile" aria-label="Meu perfil" className="order-1 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#A855F7] text-[18px] font-bold text-white">
              <SessionUserAvatar user={sessionUser} size={56} />
            </Link>
          </div>
        </div>
      </header>
      <MobileFeedHeader active="for-you" onSearch={() => setSearchOpen(true)} />

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-4 py-6 md:px-6 md:py-8">

          {/* Back + título */}
          <div className="mb-8">
            <Link
              href="/trending"
              className="mb-4 inline-flex items-center gap-2 text-[14px] text-white/40 transition hover:text-white"
            >
              <BackArrowIcon />
              Voltar ao Trending
            </Link>
            <h1 className="mt-3 text-[30px] font-extrabold tracking-tight text-white md:text-[36px]" style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif" }}>
              #{word.charAt(0).toUpperCase() + word.slice(1)}
            </h1>
            <p className="mt-1 text-[15px] text-white/50">
              Clouds ativas com essa palavra no título
            </p>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[140px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
              ))}
            </div>
          ) : clouds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] py-20 text-center">
              <FlameIcon s={40} />
              <p className="text-[18px] font-semibold text-white/60">Nenhuma Cloud ativa com &quot;{word}&quot;</p>
              <p className="text-[14px] text-white/30">Esta palavra pode ter saído do trending. Volte ao ranking para ver os tópicos atuais.</p>
              <Link href="/trending" className="mt-2 rounded-full border border-white/10 px-5 py-2 text-[13px] font-semibold text-white/60 transition hover:text-white">
                Ver Trending
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[13px] text-white/30">
                {clouds.length} {clouds.length === 1 ? "Cloud encontrada" : "Clouds encontradas"}
              </p>
              <div className="flex flex-col gap-3">
                {clouds.map((cloud) => (
                  <CloudCard key={cloud.id} cloud={cloud} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <nav className="hidden flex-none border-t border-white/[0.07] bg-[#060410] md:block" aria-label="Navegação inferior">
        <div className="mx-auto grid max-w-[480px] grid-cols-4 items-center px-4 py-5">
          <Link href="/" className="flex flex-col items-center gap-2 text-white transition hover:text-white"><svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"/><path d="M9 21V12h6v9"/></svg><span className="text-[13px] font-semibold">Home</span></Link>
          <MessagesNavLink />
          <Link href="/?create=1" aria-label="Publicar nova Cloud" className="group flex flex-col items-center gap-2 text-white transition hover:text-[#A855F7]"><span className="relative flex h-8 w-8 items-center justify-center"><img src="/cloud-plus-compact.png" alt="" className="absolute h-20 w-20 scale-[1.45] object-contain drop-shadow-[0_0_0.2px_white] transition-[filter] group-hover:[filter:brightness(0)_saturate(100%)_invert(52%)_sepia(97%)_saturate(2679%)_hue-rotate(241deg)_brightness(100%)_contrast(95%)]" /></span><span className="text-[13px] font-semibold">Publicar</span></Link>
          <Link href="/trending" className="-translate-x-4 flex flex-col items-center gap-2 text-[#A855F7]"><FlameIcon s={30}/><span className="text-[13px] font-semibold">Trending</span></Link>
        </div>
      </nav>
      <MobileAppNav active="trending" />
    </div>
  );
}
