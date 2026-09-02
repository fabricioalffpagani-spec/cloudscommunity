"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import { FlameIcon } from "../components/FlameIcon";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";
import { CloudCarousel, type CarouselCloud } from "../components/CloudCarousel";
import { SearchModal } from "../components/SearchModal";
import { NotificationsBell } from "../components/NotificationsPanel";
import { CreateCloudModal } from "../page";
import { subscribeToCloudPresence } from "../lib/cloud-presence";

type CloudAuthor = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
};

type FollowingCloud = {
  id: string;
  title: string;
  description: string | null;
  duration: string;
  visibility: "public" | "private";
  createdAt: string;
  authorId: string;
  author: CloudAuthor;
  membersCount: number;
  href: string;
};

function SearchIcon({ s = 23 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function BellIcon({ s = 23 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" />
      <path d="M10 19a2 2 0 0 0 4 0" />
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

function mapFollowingCloudToCarouselCloud(cloud: FollowingCloud): CarouselCloud {
  return {
    id: cloud.id,
    title: cloud.title,
    duration: cloud.duration,
    createdAt: new Date(cloud.createdAt),
    liveParticipants: cloud.membersCount,
    authorPhoto: cloud.author.avatarUrl ?? undefined,
    authorName: cloud.author.name,
    authorHandle: cloud.author.username,
    href: cloud.href,
  };
}

export default function FollowingPage() {
  const { user } = useSessionUser();
  const [clouds, setClouds] = useState<FollowingCloud[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadFollowing = async () => {
      setLoading(true);

      try {
        const response = await fetch("/api/clouds/following", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; clouds?: FollowingCloud[] } | null;

        if (!cancelled) {
          setClouds(response.ok && Array.isArray(payload?.clouds) ? payload.clouds : []);
        }
      } catch {
        if (!cancelled) {
          setClouds([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFollowing();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeToCloudPresence(({ cloudId, membersCount }) => {
    setClouds((prev) => prev.map((cloud) => cloud.id === cloudId ? { ...cloud, membersCount } : cloud));
  }), []);

  const carouselClouds = clouds.map(mapFollowingCloudToCarouselCloud);

  return (
    <div className="min-h-screen text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {createOpen && (
        <CreateCloudModal
          onClose={() => setCreateOpen(false)}
          onPublish={async (cloud) => {
            const response = await fetch("/api/clouds", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: cloud.title,
                description: cloud.description ?? "",
                duration: cloud.duration,
                visibility: cloud.visibility,
              }),
            });
            const payload = (await response.json().catch(() => null)) as { cloud?: { id?: string }; message?: string } | null;
            const id = payload?.cloud?.id;
            if (!response.ok || !id) {
              throw new Error(payload?.message ?? "Não foi possível criar a cloud.");
            }
            return { ...cloud, id, createdAt: new Date(), mode: "text" as const, href: `/cloud/${id}`, hypes: 0 };
          }}
        />
      )}

      <header className="fixed inset-x-0 top-0 z-50 bg-transparent">
        <div className="mx-auto flex h-[100px] max-w-[1280px] items-end justify-between gap-4 px-8 pb-4">
          <Link href="/" className="flex shrink-0 items-center gap-4 pb-2">
            <HeaderBrand />
          </Link>

          <nav aria-label="Navegação principal" className="flex items-end gap-12 pb-2">
            <Link href="/" className="inline-flex h-12 items-center text-[22px] font-semibold text-white/50 transition hover:text-white">
              For You
            </Link>
            <Link href="/following" className="relative inline-flex h-12 items-center text-[22px] font-semibold text-white">
              Seguindo
              <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-[#A855F7]" />
            </Link>
          </nav>

          <div className="flex items-center gap-4 pb-2">
            <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.12] text-white transition hover:bg-white/[0.20]">
              <SearchIcon s={28} />
            </button>
            <NotificationsBell buttonClassName="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]" />
            <Link href="/settings" aria-label="Configurações" className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]">
              <GearIcon s={28} />
            </Link>
            <Link href="/profile" aria-label="Meu perfil" className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#A855F7] text-[18px] font-bold text-white">
              <SessionUserAvatar user={user} size={56} />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-16 pt-[100px] pb-[72px]">
        {loading ? (
          <div className="flex w-full max-w-[1100px] items-center justify-center rounded-[28px] border border-white/[0.06] bg-[#120a2e] p-6 text-center text-[13px] text-white/45">
            Carregando clouds de quem você segue...
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CloudCarousel clouds={carouselClouds} onCreateCloud={() => setCreateOpen(true)} />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-[#060410]" aria-label="Navegação inferior">
        <div className="mx-auto grid max-w-[480px] grid-cols-3 items-center px-4 py-5">
          <Link href="/" className="flex flex-col items-center gap-2 text-[#A855F7] transition hover:text-[#A855F7]">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
              <path d="M9 21V12h6v9" />
            </svg>
            <span className="text-[13px] font-semibold">Home</span>
          </Link>
          <Link href="/messages" className="flex flex-col items-center gap-2 text-white transition hover:text-white">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[13px] font-semibold">Messages</span>
          </Link>
          <Link href="/trending" className="flex flex-col items-center gap-2 text-white transition hover:text-white">
            <FlameIcon s={30} />
            <span className="text-[13px] font-semibold">Trending</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
