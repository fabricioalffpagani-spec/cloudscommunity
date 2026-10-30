"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeaderBrand } from "../components/HeaderBrand";
import { FlameIcon } from "../components/FlameIcon";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";
import { ReadFeed, type ReadCloud } from "../components/ReadFeed";
import { SearchModal } from "../components/SearchModal";
import { NotificationsBell } from "../components/NotificationsPanel";
import { MessagesNavLink } from "../components/MessagesNavLink";
import { MobileAppNav, MobileFeedHeader, useMobileFeedTabSwipe } from "../components/MobileAppChrome";
import { CloudScopeTabs, type CloudScope } from "../components/CloudScopeTabs";
import { cacheFeed, getCachedFeed } from "../lib/feed-cache";

type ReadFeedPage = { clouds: ReadCloud[]; nextOffset: number | null };

function getCachedReadPage(key: string): ReadFeedPage | null {
  const cached = getCachedFeed<unknown>(key);
  if (!cached || typeof cached !== "object" || Array.isArray(cached)) return null;
  const page = cached as Partial<ReadFeedPage>;
  return Array.isArray(page.clouds) && (typeof page.nextOffset === "number" || page.nextOffset === null)
    ? { clouds: page.clouds, nextOffset: page.nextOffset }
    : null;
}

function SearchIcon({ s = 23 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function GearIcon({ s = 23 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export default function ReadPage() {
  return <Suspense fallback={null}><ReadPageContent /></Suspense>;
}

function ReadPageContent() {
  const searchParams = useSearchParams();
  const mobileFeedTabSwipe = useMobileFeedTabSwipe();
  const { user } = useSessionUser();
  const initialScope = searchParams.get("scope") === "following" ? "following" : "for-you";
  const cacheKey = user?.id ? `read:${user.id}:${initialScope}` : "";
  const [clouds, setClouds] = useState<ReadCloud[]>(() => getCachedReadPage(cacheKey)?.clouds ?? []);
  const [nextOffset, setNextOffset] = useState<number | null>(() => getCachedReadPage(cacheKey)?.nextOffset ?? 0);
  const [loading, setLoading] = useState(() => getCachedReadPage(cacheKey) === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cloudScope, setCloudScope] = useState<CloudScope>(initialScope);

  const deleteCloud = async (cloudId: string) => {
    const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    if (!response.ok) throw new Error(payload?.message ?? "Não foi possível excluir a cloud.");
    const next = clouds.filter((cloud) => cloud.id !== cloudId);
    const adjustedOffset = nextOffset === null || next.length === clouds.length ? nextOffset : Math.max(0, nextOffset - 1);
    setClouds(next);
    setNextOffset(adjustedOffset);
    cacheFeed(user?.id ? `read:${user.id}:${cloudScope}` : "", { clouds: next, nextOffset: adjustedOffset });
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || loadMoreError || nextOffset === null) return;
    const currentCacheKey = user?.id ? `read:${user.id}:${cloudScope}` : "";
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ offset: String(nextOffset) });
      if (cloudScope === "following") params.set("scope", "following");
      const response = await fetch(`/api/clouds/read?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ReadFeedPage | null;
      if (!response.ok || !Array.isArray(payload?.clouds) || (typeof payload.nextOffset !== "number" && payload.nextOffset !== null)) throw new Error("Não foi possível carregar mais clouds encerradas.");
      setClouds((current) => {
        const existing = new Set(current.map((cloud) => cloud.id));
        const next = [...current, ...payload.clouds.filter((cloud) => !existing.has(cloud.id))];
        cacheFeed(currentCacheKey, { clouds: next, nextOffset: payload.nextOffset });
        return next;
      });
      setNextOffset(payload.nextOffset);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [cloudScope, loadingMore, loadMoreError, nextOffset, user?.id]);


  useEffect(() => {
    let cancelled = false;

    const loadRead = async () => {
      const currentCacheKey = user?.id ? `read:${user.id}:${cloudScope}` : "";
      const cached = getCachedReadPage(currentCacheKey);
      if (cached && attempt === 0) {
        setClouds(cached.clouds);
        setNextOffset(cached.nextOffset);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      setLoadMoreError(false);

      try {
        const endpoint = cloudScope === "following" ? "/api/clouds/read?scope=following" : "/api/clouds/read";
        const response = await fetch(endpoint, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as ReadFeedPage | null;
        if (!response.ok || !Array.isArray(payload?.clouds) || (typeof payload.nextOffset !== "number" && payload.nextOffset !== null)) throw new Error("Não foi possível carregar as clouds encerradas.");

        if (!cancelled) {
          cacheFeed(currentCacheKey, payload);
          setClouds(payload.clouds);
          setNextOffset(payload.nextOffset);
        }
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar as clouds encerradas.");
          setClouds([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRead();

    return () => {
      cancelled = true;
    };
  }, [attempt, cloudScope, user?.id]);

  return (
    <div className="flex h-[100dvh] min-h-screen flex-col overflow-hidden text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }} {...mobileFeedTabSwipe}>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <header className="hidden flex-none bg-transparent md:block">
        <div className="mx-auto grid h-[100px] max-w-[1280px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 px-8 pb-4">
          <Link href="/" className="flex shrink-0 items-center gap-4 justify-self-start pb-2">
            <HeaderBrand />
          </Link>

          <nav aria-label="Navegação principal" className="flex items-end justify-self-center gap-16 pb-2">
            <Link href="/" title="Converse: Clouds ao vivo para conversar agora." className="inline-flex h-14 items-center text-[13px] font-semibold text-white/50 transition hover:text-white">
              Converse
            </Link>
            <Link href="/read" title="Leia: conversas encerradas disponíveis para leitura." className="relative inline-flex h-14 items-center text-[13px] font-semibold text-white">
              Leia
              <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-[#A855F7]" />
            </Link>
            <Link href="/meet" title="Conheça: descubra pessoas para seguir e conhecer." className="inline-flex h-14 items-center text-[13px] font-semibold text-white/50 transition hover:text-white">
              Conheça
            </Link>
          </nav>

          <div className="flex items-center justify-self-end gap-4 pb-2">
            <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.12] text-white transition hover:bg-white/[0.20]">
              <SearchIcon s={28} />
            </button>
            <NotificationsBell buttonClassName="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]" />
            <Link href="/profile" aria-label="Meu perfil" className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#A855F7] text-[18px] font-bold text-white">
              <SessionUserAvatar user={user} size={56} />
            </Link>
            <Link href="/settings" aria-label="Configurações" className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]">
              <GearIcon s={28} />
            </Link>
          </div>
        </div>
      </header>

      <MobileFeedHeader active="following" onSearch={() => setSearchOpen(true)} />

      <CloudScopeTabs value={cloudScope} onChange={setCloudScope} />

      <main className="cloud-feed-main relative flex items-center justify-center px-0 pt-0 md:items-start md:gap-4 md:px-4">
        {error ? <div role="alert" className="p-6 text-center"><p>{error}</p><button onClick={() => setAttempt((value) => value + 1)} className="mt-4 text-[#C084FC]">Tentar novamente</button></div> : loading ? (
          <div className="flex w-full max-w-[1100px] items-center justify-center rounded-[28px] border border-white/[0.06] bg-[#120a2e] p-6 text-center text-[13px] text-white/45">
            Carregando clouds encerradas...
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-1 items-center justify-center md:block">
            <ReadFeed key={cloudScope} clouds={clouds} initialCloudId={searchParams.get("cloud")} scope={cloudScope} currentUserId={user?.id} onDelete={deleteCloud} hasMore={nextOffset !== null && !loadMoreError} onReachEnd={loadMore} isLoadingMore={loadingMore} onEdited={(updated) => { const next = clouds.map((cloud) => cloud.id === updated.id ? { ...cloud, title: updated.title, duration: updated.duration, description: updated.description, editCount: updated.editCount } : cloud); setClouds(next); cacheFeed(user?.id ? `read:${user.id}:${cloudScope}` : "", { clouds: next, nextOffset }); }} />
            {loadMoreError && <button type="button" onClick={() => setLoadMoreError(false)} className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#2B174F] px-4 py-2 text-sm text-white" role="alert">Falha ao carregar mais Clouds. Tentar novamente</button>}
          </div>
        )}
      </main>

      <nav className="hidden flex-none border-t border-white/[0.07] bg-[#060410] md:block" aria-label="Navegação inferior">
        <div className="mx-auto grid max-w-[480px] grid-cols-4 items-center px-4 py-5">
          <Link href="/" className="flex flex-col items-center gap-2 text-[#A855F7] transition hover:text-[#A855F7]">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
              <path d="M9 21V12h6v9" />
            </svg>
            <span className="text-[13px] font-semibold">Home</span>
          </Link>
          <MessagesNavLink />
          <Link href="/?create=1" aria-label="Publicar nova Cloud" className="group flex flex-col items-center gap-2 text-white transition hover:text-[#A855F7]">
            <span className="relative flex h-8 w-8 items-center justify-center"><img src="/cloud-plus-compact.png" alt="" className="absolute h-20 w-20 scale-[1.45] object-contain drop-shadow-[0_0_0.2px_white] transition-[filter] group-hover:[filter:brightness(0)_saturate(100%)_invert(52%)_sepia(97%)_saturate(2679%)_hue-rotate(241deg)_brightness(100%)_contrast(95%)]" /></span>
            <span className="text-[13px] font-semibold">Publicar</span>
          </Link>
          <Link href="/trending" className="-translate-x-4 flex flex-col items-center gap-2 text-white transition hover:text-[#A855F7]">
            <FlameIcon s={30} />
            <span className="text-[13px] font-semibold">Trending</span>
          </Link>
        </div>
      </nav>
      <MobileAppNav active="home" />
    </div>
  );
}
