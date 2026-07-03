"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RankUser = {
  id: string;
  name: string;
  description: string;
  hypes: string;
  initial: string;
  highlight?: boolean;
  topCategories?: string[];
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const ranking: RankUser[] = [
  { id: "luna",  name: "Luna",  description: "Criadora de threads",         hypes: "12.4k", initial: "L", highlight: true, topCategories: ["Drama", "Pop"] },
  { id: "kai",   name: "Kai",   description: "Comentador em alta",          hypes: "10.8k", initial: "K", topCategories: ["Tech", "Gaming"] },
  { id: "maya",  name: "Maya",  description: "Perfil emergente",            hypes: "10.1k", initial: "M", topCategories: ["Music", "Movies"] },
  { id: "theo",  name: "Theo",  description: "Moderador da conversa",       hypes: "8.7k",  initial: "T", topCategories: ["Pop", "Politics"] },
  { id: "nina",  name: "Nina",  description: "Curadora de tópicos",         hypes: "8.2k",  initial: "N", topCategories: ["Funny", "Memes"] },
  { id: "joao",  name: "João",  description: "Dev & debatedor",             hypes: "6.1k",  initial: "J", topCategories: ["Tech", "Real Life"] },
  { id: "ana",   name: "Ana",   description: "Criadora de conteúdo áudio",  hypes: "5.4k",  initial: "A", topCategories: ["Music", "Drama"] },
  { id: "pedro", name: "Pedro", description: "Designer & curioso",          hypes: "3.2k",  initial: "P", topCategories: ["Tech", "Movies"] },
];

const AVATAR_COLORS: Record<string, string> = {
  luna: "#EC4899", kai: "#06B6D4", maya: "#F59E0B", theo: "#3B82F6",
  nina: "#22C55E", joao: "#8B5CF6", ana: "#3B82F6", pedro: "#22C55E",
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function FireIcon({ s = 13 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true" className="text-[#F97316]">
      <path d="M12 1C9.5 5.5 7 8.5 7 12.5c0 5 4 9 5 9s5-4 5-9c0-2-.5-3.5-1.5-5 .3 1.5.2 2.5-.5 3.5C14.5 9 13.5 5.5 12 1Z" />
      <path d="M12 1C10 5 8 8 8 12c0 4.5 3.5 8.5 4 9-.5-1.5-1-3-1-5 0-2 .8-4 1.5-5.5C13 12.5 13 14 12.5 16c1.5-1.5 3-3.5 3-6 0-2-.5-3.5-1-5C15 6.5 15 7.5 14.5 8.5 14 5 13 2.5 12 1Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-white/30">
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

// ─── localStorage helpers ─────────────────────────────────────────────────────

const FOLLOWING_KEY = "cloudscommunity:following";

function loadFollowing(): string[] {
  try { return JSON.parse(localStorage.getItem(FOLLOWING_KEY) ?? "[]"); } catch { return []; }
}

function saveFollowing(ids: string[]) {
  try { localStorage.setItem(FOLLOWING_KEY, JSON.stringify(ids)); } catch {}
}

// ─── Ranking row ─────────────────────────────────────────────────────────────

function RankRow({
  user, rank, followed, onToggle,
}: {
  user: RankUser; rank: number; followed: boolean; onToggle: (id: string) => void;
}) {
  const color = AVATAR_COLORS[user.id] ?? "#8B5CF6";

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#111116] px-4 py-3.5 transition hover:border-white/[0.12]">
      {/* Rank number */}
      <span className="w-5 shrink-0 text-center text-[13px] font-bold text-white/25">
        {rank}
      </span>

      {/* Avatar */}
      <Link href={`/users/${user.id}`} className="shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {user.initial}
        </div>
      </Link>

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/users/${user.id}`} className="text-[14px] font-semibold text-white hover:underline truncate">
            {user.name}
          </Link>
          {user.highlight && (
            <span className="shrink-0 rounded-full bg-[#7C3AED]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#C084FC]">
              Top
            </span>
          )}
        </div>
        <p className="truncate text-[12px] text-white/40">{user.description}</p>
      </div>

      {/* Hypes */}
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#F97316]">
        <FireIcon s={13} />
        {user.hypes}
      </span>

      {/* Follow button */}
      <button
        type="button"
        onClick={() => onToggle(user.id)}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
          followed
            ? "border border-white/10 bg-transparent text-white/40"
            : "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
        }`}
      >
        {followed ? "Seguindo" : "Seguir"}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [followedIds, setFollowedIds] = useState<string[]>([]);

  useEffect(() => {
    setFollowedIds(loadFollowing());
  }, []);

  function toggleFollow(id: string) {
    setFollowedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveFollowing(next);
      return next;
    });
  }

  const filteredRanking = ranking.filter(u =>
    !searchQuery ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-white">

      {/* ── Header ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between gap-4 px-5 lg:px-8">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image src="/logo_clouds.png" alt="Clouds Community" width={64} height={64} className="object-contain" style={{ width: 64, height: 64 }} priority />
            <div className="leading-none">
              <div className="text-[34px] font-extrabold tracking-[-0.02em] text-white">Clouds</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.6em] text-white/50">Community</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
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

      {/* ── Main ── */}
      <main className="mx-auto max-w-[640px] px-5 pb-28 pt-[108px]">

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-[28px] font-bold tracking-tight text-white">Meet</h1>
          <p className="mt-1 text-[14px] text-white/40">Perfis com mais hypes na plataforma</p>
        </div>

        {/* Search */}
        <div className="mb-5 flex h-11 items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#111116] px-4">
          <SearchIcon />
          <input
            type="text"
            placeholder="Buscar perfil..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-white/30 hover:text-white/60 transition"
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>

        {/* Ranking list */}
        <div className="flex flex-col gap-2">
          {filteredRanking.map((user, index) => (
            <RankRow
              key={user.id}
              user={user}
              rank={index + 1}
              followed={followedIds.includes(user.id)}
              onToggle={toggleFollow}
            />
          ))}
          {filteredRanking.length === 0 && (
            <p className="py-12 text-center text-[14px] text-white/30">Nenhum perfil encontrado.</p>
          )}
        </div>

      </main>

      {/* ── Bottom nav ── */}
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
            <MeetIcon s={24} className="text-[#A855F7]" />
            <span className="text-[12px] font-semibold text-[#A855F7]">Meet</span>
          </Link>
        </div>
      </nav>

    </div>
  );
}
