"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";

type ActiveCloud = {
  id: string;
  title: string;
  duration: string;
  createdAt: string;
  visibility: "public" | "private";
};

type FollowingProfile = {
  id: string;
  username: string;
  name: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  cloudsCount: number;
  hypesCount: number;
  isFollowing: boolean;
  isSelf: boolean;
  profileUrl: string;
  activeCloud?: ActiveCloud | null;
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

function HomeIcon({ s = 24, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function MessageIcon({ s = 24, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MeetIcon({ s = 24, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function parseDurationSeconds(duration: string) {
  const map: Record<string, number> = {
    "5 min": 5 * 60,
    "10 min": 10 * 60,
    "30 min": 30 * 60,
    "1h": 60 * 60,
    "24h": 24 * 60 * 60,
  };

  return map[duration] ?? 5 * 60;
}

function formatCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function FollowingCloudCard({ profile, now }: { profile: FollowingProfile; now: number }) {
  const cloud = profile.activeCloud;

  if (!cloud) {
    return null;
  }

  const remainingSeconds = Math.max(parseDurationSeconds(cloud.duration) - Math.floor((now - new Date(cloud.createdAt).getTime()) / 1000), 0);
  const live = remainingSeconds > 0;

  return (
    <Link href={profile.profileUrl} className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#111116] p-5 transition hover:border-white/[0.16] hover:bg-[#16161c]">
      <div className="flex items-center gap-3">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt={profile.displayName} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-[14px] font-bold text-white">
            {profile.displayName.trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-white">{profile.displayName}</p>
          <p className="text-[12px] text-white/40">@{profile.username}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#22C55E] shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
          </span>
          AO VIVO
        </span>
      </div>

      <p className="text-[16px] font-semibold leading-snug text-white">{cloud.title}</p>

      <div className="flex items-center justify-between gap-3 text-[12px] text-white/45">
        <span>{live ? "Encerra em" : "Encerrada"}</span>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-semibold text-white/70">
          {formatCountdown(remainingSeconds)}
        </span>
      </div>
    </Link>
  );
}

function EmptyFollowing() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="rounded-[28px] border border-white/[0.06] bg-[#111116] p-8">
        <p className="text-[19px] font-bold text-white">Nenhuma Cloud ativa</p>
        <p className="mt-2 max-w-[320px] text-[14px] leading-relaxed text-white/50">
          As pessoas que você segue não têm Clouds ativas no momento. Que tal descobrir novos perfis?
        </p>
        <Link
          href="/meet"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#7C3AED]"
        >
          <MeetIcon s={18} className="text-white" />
          Descobrir pessoas
        </Link>
      </div>
    </div>
  );
}

export default function FollowingPage() {
  const { user } = useSessionUser();
  const [profiles, setProfiles] = useState<FollowingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const loadFollowing = async () => {
      setLoading(true);

      try {
        const response = await fetch("/api/users/following", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { ok?: boolean; users?: FollowingProfile[] } | null;

        if (!cancelled) {
          setProfiles(response.ok && Array.isArray(payload?.users) ? payload.users : []);
        }
      } catch {
        if (!cancelled) {
          setProfiles([]);
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeProfiles = profiles.filter((profile) => profile.activeCloud);

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between gap-4 px-3 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <HeaderBrand />
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
            <Link href="/" className="inline-flex h-12 items-center px-2 text-[17px] font-semibold text-white/60 transition-colors hover:text-white">
              For You
            </Link>
            <Link href="/following" className="relative inline-flex h-12 items-center px-2 text-[17px] font-semibold text-white transition-colors hover:text-white/80">
              Seguindo
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#A855F7]" />
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button type="button" aria-label="Buscar" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <SearchIcon s={23} />
            </button>
            <button type="button" aria-label="Notificações" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <BellIcon s={23} />
            </button>
            <Link href="/settings" aria-label="Configurações" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <GearIcon s={23} />
            </Link>
            <Link href="/profile" aria-label="Meu perfil" className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#7C3AED] text-[17px] font-bold text-white transition hover:bg-[#6D28D9]">
              <SessionUserAvatar user={user} size={48} />
            </Link>
          </div>
        </div>
      </header>

      <main className="fixed inset-x-0 top-[88px] bottom-[72px] overflow-y-auto">
        <div className="mx-auto flex h-full max-w-[680px] flex-col px-5 py-6 lg:px-8">
          {loading ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#111116] p-6 text-center text-[13px] text-white/45">
              Carregando seguidos...
            </div>
          ) : activeProfiles.length > 0 ? (
            <>
              <p className="mb-4 text-[13px] text-white/40">
                {activeProfiles.length} perfil{activeProfiles.length > 1 ? "s" : ""} seguido{activeProfiles.length > 1 ? "s" : ""} com cloud ativa
              </p>
              <div className="flex flex-col gap-4">
                {activeProfiles.map((profile) => (
                  <FollowingCloudCard key={profile.id} profile={profile} now={now} />
                ))}
              </div>
            </>
          ) : (
            <EmptyFollowing />
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-around px-6 py-4">
          <Link href="/" className="flex flex-col items-center gap-1.5">
            <HomeIcon s={24} className="text-white/40" />
            <span className="text-[12px] font-semibold text-white/40">Home</span>
          </Link>
          <Link href="/messages" className="flex flex-col items-center gap-1.5">
            <MessageIcon s={24} className="text-white/40" />
            <span className="text-[12px] font-semibold text-white/40">Messages</span>
          </Link>
          <Link href="/meet" className="flex flex-col items-center gap-1.5">
            <MeetIcon s={24} className="text-white/40" />
            <span className="text-[12px] font-semibold text-white/40">Meet</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
