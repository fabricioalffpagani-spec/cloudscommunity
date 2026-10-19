"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { HeaderBrand } from "../components/HeaderBrand";
import { FlameIcon } from "../components/FlameIcon";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";
import { SearchModal } from "../components/SearchModal";
import { NotificationsBell } from "../components/NotificationsPanel";
import { MessagesNavLink } from "../components/MessagesNavLink";
import { MobileAppNav, MobileFeedHeader } from "../components/MobileAppChrome";

type TrendingCloud = {
  id: string;
  title: string;
  duration: string;
  rank: number;
  hypesCount: number;
  membersCount: number;
  author?: {
    name?: string;
    username?: string;
    avatarUrl?: string | null;
    location?: string | null;
  };
};

function SearchIcon({ s = 24 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function BellIcon({ s = 24 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function GearIcon({ s = 24 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function RefreshIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#A855F7]/20 text-[#C084FC] font-bold text-[16px]">
      {rank}
    </div>
  );
}

export default function TrendingPage() {
  const { user: sessionUser } = useSessionUser();
  const [clouds, setClouds] = useState<TrendingCloud[]>([]);
  const [totalActiveClouds, setTotalActiveClouds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scope, setScope] = useState<"world" | "nearby">("world");
  const [nearbyUnavailable, setNearbyUnavailable] = useState(false);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trending?scope=${scope}`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; clouds: TrendingCloud[]; totalActiveClouds: number; nearbyUnavailable?: boolean };
      if (data.ok) {
        setClouds(data.clouds ?? []);
        setTotalActiveClouds(data.totalActiveClouds ?? 0);
        setLastUpdated(new Date());
        setNearbyUnavailable(Boolean(data.nearbyUnavailable));
      }
    } catch {
      // mantém estado anterior em caso de erro
    } finally {
      setLoading(false);
    }
  }, [scope]);

  // Carrega ao montar e atualiza a cada 60s
  useEffect(() => {
    void loadTrending();
    const interval = setInterval(() => void loadTrending(), 60_000);
    return () => clearInterval(interval);
  }, [loadTrending]);

  return (
    <div
      className="flex h-[100dvh] min-h-screen flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}
    >
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {/* ── Header ── */}
      <header className="hidden flex-none bg-transparent md:block">
        <div className="mx-auto grid h-[100px] max-w-[1280px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 px-8 pb-4">
          <Link href="/" className="flex shrink-0 items-center gap-4 justify-self-start pb-2">
            <HeaderBrand />
          </Link>
          <nav aria-label="Navegação principal" className="flex items-end justify-self-center gap-16 pb-2">
            <Link href="/" title="Talk: Clouds ao vivo para conversar agora." className="inline-flex h-14 items-center text-[22px] font-semibold text-white/50 transition hover:text-white">Talk</Link>
            <Link href="/read" title="Read: conversas encerradas disponíveis para leitura." className="inline-flex h-14 items-center text-[22px] font-semibold text-white/50 transition hover:text-white">Read</Link>
            <Link href="/meet" title="Meet: descubra pessoas para seguir e conhecer." className="inline-flex h-14 items-center text-[22px] font-semibold text-white/50 transition hover:text-white">Meet</Link>
          </nav>
          <div className="flex items-center justify-self-end gap-4 pb-2">
            <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.12] text-white transition hover:bg-white/[0.20]">
              <SearchIcon s={28} />
            </button>
            <NotificationsBell buttonClassName="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]" />
            <Link href="/profile" aria-label="Meu perfil" className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#A855F7] text-[18px] font-bold text-white">
              <SessionUserAvatar user={sessionUser} size={56} />
            </Link>
            <Link href="/settings" aria-label="Configurações" className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]">
              <GearIcon s={28} />
            </Link>
          </div>
        </div>
      </header>
      <MobileFeedHeader onSearch={() => setSearchOpen(true)} />

      {/* ── Main Content ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-4 pb-28 pt-6 md:px-6 md:py-8">

          {/* Page Header */}
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-extrabold tracking-tight text-white md:text-[44px]" style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif" }}>
                Trending
              </h1>
              <p className="mt-1 text-[15px] text-white/50">
                {scope === "nearby" ? "Clouds mais hypadas no seu país" : "Clouds mais hypadas na plataforma"}
                {totalActiveClouds > 0 && (
                  <span className="ml-2 rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[13px] text-white/60">
                    {totalActiveClouds} {totalActiveClouds === 1 ? "cloud ativa" : "clouds ativas"}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadTrending()}
              disabled={loading}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[13px] text-white/60 transition hover:bg-white/[0.10] hover:text-white disabled:opacity-40"
            >
              <RefreshIcon s={15} />
              Atualizar
            </button>
          </div>

          <div className="mb-5 flex w-fit rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button type="button" onClick={() => setScope("world")} className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${scope === "world" ? "bg-[#9333EA] text-white" : "text-white/55 hover:text-white"}`}>Mundo</button>
            <button type="button" onClick={() => setScope("nearby")} className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${scope === "nearby" ? "bg-[#9333EA] text-white" : "text-white/55 hover:text-white"}`}>Perto de mim</button>
          </div>

          {lastUpdated && !loading && (
            <p className="mb-5 text-[12px] text-white/30">
              Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {/* Lista */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-[80px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
              ))}
            </div>
          ) : clouds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] py-20 text-center">
              <FlameIcon s={40} />
              <p className="text-[18px] font-semibold text-white/60">{nearbyUnavailable ? "Informe seu país no perfil" : "Nenhuma Cloud ativa no momento"}</p>
              <p className="text-[14px] text-white/30">{nearbyUnavailable ? "Assim podemos mostrar as Clouds hypadas no seu país." : scope === "nearby" ? "Ainda não há Clouds ativas no seu país." : "Quando as pessoas criarem Clouds, as mais hypadas aparecerão aqui."}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {clouds.map((cloud) => {
                return (
                  <div
                    key={cloud.id}
                    className="group relative flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#100828]/80 px-5 py-4 transition hover:border-[#A855F7]/40 hover:bg-[#180d38]/80"
                  >
                    {/* Rank */}
                    <RankBadge rank={cloud.rank} />

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[19px] font-bold text-white">{cloud.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/45">
                        {cloud.author?.avatarUrl && <img src={cloud.author.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />}
                        <span>{cloud.author?.name ?? cloud.author?.username ?? "Usuário"}</span>
                        {cloud.author?.location && <span>• {cloud.author.location}</span>}
                        <span>• {cloud.membersCount} {cloud.membersCount === 1 ? "pessoa" : "pessoas"}</span>
                        <span className="sm:hidden">• {cloud.hypesCount} hypes</span>
                      </div>
                    </div>

                    <span className="hidden shrink-0 items-center gap-1 text-[13px] font-semibold text-[#C084FC] sm:flex">
                      <FlameIcon s={17} /> {cloud.hypesCount}
                    </span>
                    <Link
                      href={`/cloud/${encodeURIComponent(cloud.id)}?join=1`}
                      className="shrink-0 rounded-full border border-[#A855F7]/60 bg-transparent px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#A855F7]/20"
                    >
                      Entrar
                    </Link>
                  </div>
                );
              })}
            </div>
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
