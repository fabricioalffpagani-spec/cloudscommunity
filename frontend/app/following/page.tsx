"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HeaderBrand } from "../components/HeaderBrand";

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon({ s = 23 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" /><path d="M20 20l-3.5-3.5" />
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

function FireIcon({ s = 14, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 1C9.5 5.5 7 8.5 7 12.5c0 5 4 9 5 9s5-4 5-9c0-2-.5-3.5-1.5-5 .3 1.5.2 2.5-.5 3.5C14.5 9 13.5 5.5 12 1Z" />
      <path d="M12 1C10 5 8 8 8 12c0 4.5 3.5 8.5 4 9-.5-1.5-1-3-1-5 0-2 .8-4 1.5-5.5C13 12.5 13 14 12.5 16c1.5-1.5 3-3.5 3-6 0-2-.5-3.5-1-5C15 6.5 15 7.5 14.5 8.5 14 5 13 2.5 12 1Z" />
    </svg>
  );
}

function UserIcon({ s = 12 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function HomeIcon({ s = 24, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" /><path d="M9 21V12h6v9" />
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ─── Seed data (mirrors users/[id]/page.tsx SEEDED) ──────────────────────────

type ActiveCloud = {
  id: string;
  title: string;
  category: string;
  categoryColor: string;
  participants: number;
  timeLeft: string;
};

type UserEntry = {
  id: string;
  name: string;
  handle: string;
  color: string;
  activeCloud?: ActiveCloud;
};

const SEEDED: Record<string, UserEntry> = {
  joao: {
    id: "joao", name: "João Silva", handle: "@joaosilva", color: "#8B5CF6",
    activeCloud: { id: "ia-e-programadores", title: "IA vai substituir programadores?", category: "Tech", categoryColor: "#06B6D4", participants: 47, timeLeft: "12:08" },
  },
  ana: {
    id: "ana", name: "Ana Costa", handle: "@anacosta", color: "#3B82F6",
  },
  pedro: {
    id: "pedro", name: "Pedro Lima", handle: "@pedrolima", color: "#22C55E",
  },
};

const FOLLOWING_KEY = "cloudscommunity:following";

function loadFollowing(): string[] {
  try { return JSON.parse(localStorage.getItem(FOLLOWING_KEY) ?? "[]"); } catch { return []; }
}

// ─── Empty state illustration ─────────────────────────────────────────────────

function EmptyFollowing() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      {/* SVG illustration */}
      <svg width="160" height="140" viewBox="0 0 160 140" fill="none" aria-hidden="true">
        {/* Background circle */}
        <circle cx="80" cy="72" r="56" fill="#1C1F2E" />

        {/* Cloud shape */}
        <path
          d="M55 80 C55 69 63 62 72 62 C73 55 79 50 87 50 C97 50 105 58 105 68 C111 68 116 73 116 79 C116 86 111 91 104 91 H60 C57 91 55 88 55 85 Z"
          fill="#2D2F45" stroke="#4C4F70" strokeWidth="1.5"
        />

        {/* Rain / drops */}
        <rect x="68" y="97" width="3" height="8" rx="1.5" fill="#7C3AED" opacity="0.5" />
        <rect x="79" y="100" width="3" height="8" rx="1.5" fill="#7C3AED" opacity="0.35" />
        <rect x="90" y="97" width="3" height="8" rx="1.5" fill="#7C3AED" opacity="0.5" />

        {/* Person silhouette left */}
        <circle cx="38" cy="62" r="9" fill="#2D2F45" />
        <path d="M24 88 C24 78 30 74 38 74 C46 74 52 78 52 88" fill="#2D2F45" />

        {/* Person silhouette right */}
        <circle cx="122" cy="62" r="9" fill="#2D2F45" />
        <path d="M108 88 C108 78 114 74 122 74 C130 74 136 78 136 88" fill="#2D2F45" />

        {/* Plus icon on cloud — suggesting no follow */}
        <circle cx="80" cy="116" r="12" fill="#1C1F2E" stroke="#4C4F70" strokeWidth="1.2" />
        <path d="M80 111 v10 M75 116 h10" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <div>
        <p className="text-[19px] font-bold text-white">Nenhuma Cloud ativa</p>
        <p className="mt-2 max-w-[320px] text-[14px] leading-relaxed text-white/50">
          As pessoas que você segue não têm Clouds ativas no momento. Que tal descobrir novos perfis?
        </p>
      </div>

      <Link
        href="/meet"
        className="inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#7C3AED]"
      >
        <MeetIcon s={18} className="text-white" />
        Descobrir pessoas
      </Link>
    </div>
  );
}

// ─── Cloud card ───────────────────────────────────────────────────────────────

function FollowingCloudCard({ user, cloud }: { user: UserEntry; cloud: ActiveCloud }) {
  const initials = user.name.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/cloud/${cloud.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#111116] p-5 transition hover:border-white/[0.16] hover:bg-[#16161c]"
    >
      {/* Author */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ backgroundColor: user.color }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-white">{user.name}</p>
          <p className="text-[12px] text-white/40">{user.handle}</p>
        </div>

        {/* Live badge */}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#22C55E] shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
          </span>
          AO VIVO
        </span>
      </div>

      {/* Cloud title */}
      <p className="text-[16px] font-semibold leading-snug text-white">{cloud.title}</p>

      {/* Meta row */}
      <div className="flex items-center gap-3">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: `${cloud.categoryColor}22`, color: cloud.categoryColor }}
        >
          {cloud.category}
        </span>
        <span className="flex items-center gap-1 text-[12px] text-white/50">
          <UserIcon s={12} />
          {cloud.participants} online
        </span>
        <span className="ml-auto text-[12px] text-white/40">{cloud.timeLeft} restante</span>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FollowingPage() {
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFollowedIds(loadFollowing());
    setHydrated(true);
  }, []);

  const followedUsers = followedIds
    .map(id => SEEDED[id])
    .filter((u): u is UserEntry => u != null);

  const activeClouds = followedUsers.filter(u => u.activeCloud != null);

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-[#09090B] text-white">

      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between gap-4 px-3 lg:px-6">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <HeaderBrand />
          </Link>

          {/* Nav — Seguindo highlighted */}
          <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
            <Link href="/" className="inline-flex h-12 items-center px-2 text-[17px] font-semibold text-white/60 transition-colors hover:text-white">
              For You
            </Link>
            <Link href="/following" className="relative inline-flex h-12 items-center px-2 text-[17px] font-semibold text-white transition-colors hover:text-white/80">
              Seguindo
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#A855F7]" />
            </Link>
          </nav>

          {/* Action icons */}
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Buscar"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <SearchIcon s={23} />
            </button>
            <button type="button" aria-label="Notificações"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <BellIcon s={23} />
            </button>
            <Link href="/settings" aria-label="Configurações"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <GearIcon s={23} />
            </Link>
            <Link href="/profile" aria-label="Meu perfil"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7C3AED] text-[17px] font-bold text-white transition hover:bg-[#6D28D9]">
              F
            </Link>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="fixed inset-x-0 top-[88px] bottom-[72px] overflow-y-auto">
        <div className="mx-auto flex h-full max-w-[680px] flex-col px-5 lg:px-8 py-6">

          {activeClouds.length > 0 ? (
            <>
              <p className="mb-4 text-[13px] text-white/40">
                {activeClouds.length} Cloud{activeClouds.length > 1 ? "s" : ""} ativa{activeClouds.length > 1 ? "s" : ""} de pessoas que você segue
              </p>
              <div className="flex flex-col gap-4">
                {activeClouds.map(user => (
                  <FollowingCloudCard key={user.id} user={user} cloud={user.activeCloud!} />
                ))}
              </div>
            </>
          ) : (
            <EmptyFollowing />
          )}

        </div>
      </main>

      {/* ── Bottom Navigation Bar ── */}
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
