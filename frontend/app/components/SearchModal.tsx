"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserResult = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type CloudResult = {
  id: string;
  title: string;
  duration: string;
  createdAt: string;
  authorUsername?: string;
  membersCount?: number;
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" /><path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10Z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [clouds, setClouds] = useState<CloudResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setUsers([]);
      setClouds([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const [usersRes, cloudsRes] = await Promise.all([
          fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}&limit=5`),
          fetch(`/api/clouds`),
        ]);

        // Users
        const usersPayload = usersRes.ok ? (await usersRes.json().catch(() => null)) : null;
        const fetchedUsers: UserResult[] = Array.isArray(usersPayload?.users)
          ? usersPayload.users.slice(0, 5).map((u: { id: string; username: string; displayName: string; avatarUrl: string | null }) => ({
              id: u.id,
              username: u.username,
              displayName: u.displayName,
              avatarUrl: u.avatarUrl,
            }))
          : [];

        // Clouds — filter client-side by title/author
        const cloudsPayload = cloudsRes.ok ? (await cloudsRes.json().catch(() => null)) : null;
        const lower = trimmed.toLowerCase();
        const fetchedClouds: CloudResult[] = Array.isArray(cloudsPayload?.clouds)
          ? (cloudsPayload.clouds as Array<{ id: string; title: string; duration: string; createdAt: string; author: { username: string }; membersCount: number }>)
              .filter(
                (c) =>
                  c.title.toLowerCase().includes(lower) ||
                  c.author?.username?.toLowerCase().includes(lower),
              )
              .slice(0, 5)
              .map((c) => ({
                id: c.id,
                title: c.title,
                duration: c.duration,
                createdAt: c.createdAt,
                authorUsername: c.author?.username,
                membersCount: c.membersCount,
              }))
          : [];

        setUsers(fetchedUsers);
        setClouds(fetchedClouds);
        setSearched(true);
      } catch {
        setUsers([]);
        setClouds([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const hasResults = users.length > 0 || clouds.length > 0;
  const showEmpty = searched && !hasResults && !loading;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-[560px] rounded-2xl bg-[#1C1F2E] border border-white/10 p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 rounded-xl bg-[#252840] px-4 py-3">
          <SearchIcon />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar clouds, pessoas..."
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none"
          />
          {loading ? (
            <span className="text-white/30"><SpinnerIcon /></span>
          ) : query ? (
            <button onClick={() => setQuery("")} className="text-white/40 hover:text-white"><XIcon /></button>
          ) : (
            <button onClick={onClose} className="text-white/40 hover:text-white"><XIcon /></button>
          )}
        </div>

        {/* Results */}
        {hasResults && (
          <div className="mt-3 flex flex-col gap-1 max-h-[420px] overflow-y-auto">
            {users.length > 0 && (
              <div>
                <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">Pessoas</p>
                {users.map(user => (
                  <button key={user.id} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.06] transition"
                    onClick={() => { router.push(`/users/${user.id}`); onClose(); }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#A855F7] text-[13px] font-bold text-white overflow-hidden">
                      {user.avatarUrl
                        ? <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                        : user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white">{user.displayName}</p>
                      <p className="truncate text-[12px] text-white/40">@{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {clouds.length > 0 && (
              <div className={users.length > 0 ? "mt-1" : ""}>
                <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">Clouds</p>
                {clouds.map(cloud => (
                  <button key={cloud.id} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.06] transition"
                    onClick={() => {
                      const params = new URLSearchParams({ title: cloud.title, duration: cloud.duration, createdAt: cloud.createdAt });
                      router.push(`/cloud/${cloud.id}?${params.toString()}`);
                      onClose();
                    }}>
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#252840] text-white/60">
                      <CloudIcon />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white">{cloud.title}</p>
                      {cloud.authorUsername && <p className="truncate text-[12px] text-white/40">@{cloud.authorUsername}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showEmpty && (
          <div className="mt-6 pb-3 text-center text-[13px] text-white/30">
            Nenhum resultado para <span className="text-white/50">&ldquo;{query}&rdquo;</span>
          </div>
        )}

        {!query && (
          <p className="mt-3 px-1 text-[12px] text-white/30">Pressione ESC para fechar</p>
        )}
      </div>
    </div>
  );
}
