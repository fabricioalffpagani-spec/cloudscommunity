"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";

type PublicUserProfile = {
  id: string;
  username: string;
  name: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  website: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followingCount: number;
  cloudsCount: number;
  hypesCount: number;
  isFollowing: boolean;
  isSelf: boolean;
  profileUrl: string;
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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ProfileRow({
  user,
  onToggleFollow,
  pending,
}: {
  user: PublicUserProfile;
  onToggleFollow: (user: PublicUserProfile) => void;
  pending: boolean;
}) {
  const initials = user.displayName.trim().charAt(0).toUpperCase() || user.username.trim().charAt(0).toUpperCase() || "C";
  const avatarColor = user.avatarUrl ? undefined : "#7C3AED";
  const followLabel = user.isFollowing ? "Seguindo" : "Seguir";

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#111116] px-4 py-3.5 transition hover:border-white/[0.12]">
      <Link href={user.profileUrl} className="shrink-0">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={user.displayName} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold text-white" style={{ backgroundColor: avatarColor }}>
            {initials}
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={user.profileUrl} className="truncate text-[14px] font-semibold text-white hover:underline">
            {user.displayName}
          </Link>
          {user.isSelf && (
            <span className="shrink-0 rounded-full bg-[#7C3AED]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#C084FC]">
              Você
            </span>
          )}
        </div>
        <p className="truncate text-[12px] text-white/40">@{user.username}</p>
      </div>

      <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#F97316]">
        <svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor" aria-hidden="true">
          <path d="M12 1C9.5 5.5 7 8.5 7 12.5c0 5 4 9 5 9s5-4 5-9c0-2-.5-3.5-1.5-5 .3 1.5.2 2.5-.5 3.5C14.5 9 13.5 5.5 12 1Z" />
        </svg>
        {user.hypesCount}
      </span>

      {!user.isSelf && (
        <button
          type="button"
          onClick={() => onToggleFollow(user)}
          disabled={pending}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
            user.isFollowing
              ? "border border-white/10 bg-transparent text-white/40"
              : "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
          } ${pending ? "opacity-60" : ""}`}
        >
          {pending ? "..." : followLabel}
        </button>
      )}
    </div>
  );
}

export default function MeetPage() {
  const { user } = useSessionUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => normalize(searchQuery), [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(normalizedQuery)}&limit=10`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as { ok?: boolean; users?: PublicUserProfile[] } | null;

        if (!cancelled) {
          setResults(response.ok && Array.isArray(payload?.users) ? payload.users : []);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [normalizedQuery]);

  const toggleFollow = async (target: PublicUserProfile) => {
    if (target.isSelf) {
      return;
    }

    setMutating(target.id);

    try {
      const method = target.isFollowing ? "DELETE" : "POST";
      const response = await fetch(`/api/follow/${encodeURIComponent(target.username)}`, {
        method,
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; user?: PublicUserProfile; message?: string } | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.message ?? "Não foi possível atualizar o follow.");
      }

      setResults((current) => current.map((item) => (item.id === payload.user!.id ? payload.user! : item)));
    } catch {
      // mantém silencioso para não interromper a navegação
    } finally {
      setMutating(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between gap-4 px-3 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <HeaderBrand />
          </Link>

          <div className="flex items-center gap-3">
            <button type="button" aria-label="Notificações" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <BellIcon />
            </button>
            <Link href="/settings" aria-label="Configurações" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <GearIcon />
            </Link>
            <Link href="/profile" aria-label="Meu perfil" className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#7C3AED] text-[17px] font-bold text-white transition hover:bg-[#6D28D9]">
              <SessionUserAvatar user={user} size={48} />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-5 pb-28 pt-[108px]">
        <div className="mb-6">
          <h1 className="text-[28px] font-bold tracking-tight text-white">Meet</h1>
          <p className="mt-1 text-[14px] text-white/40">Busque por arroba ou nome de perfil.</p>
        </div>

        <div className="mb-5 flex h-11 items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#111116] px-4">
          <SearchIcon />
          <input
            type="text"
            placeholder="Buscar perfil..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-white/30 transition hover:text-white/60"
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="mb-3 text-[12px] text-white/35">
          {loading ? "Buscando perfis..." : `${results.length} resultado${results.length === 1 ? "" : "s"} encontrados`}
        </div>

        <div className="flex flex-col gap-2">
          {results.map((item) => (
            <ProfileRow
              key={item.id}
              user={item}
              onToggleFollow={toggleFollow}
              pending={mutating === item.id}
            />
          ))}
          {!loading && results.length === 0 && (
            <p className="py-12 text-center text-[14px] text-white/30">Nenhum perfil encontrado.</p>
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
            <MeetIcon s={24} className="text-[#A855F7]" />
            <span className="text-[12px] font-semibold text-[#A855F7]">Meet</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
