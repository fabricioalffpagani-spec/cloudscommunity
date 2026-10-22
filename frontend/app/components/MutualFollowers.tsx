"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type MutualFollower = { id: string; username: string; displayName: string; avatarUrl: string | null; profileUrl: string };

export function MutualFollowers({ username, displayName, preview, count, centered = false }: { username: string; displayName: string; preview?: MutualFollower[]; count?: number; centered?: boolean }) {
  const [followers, setFollowers] = useState<MutualFollower[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (preview && !open) return;
    let active = true;
    setLoading(true);
    setError(false);
    void fetch(`/api/users/${encodeURIComponent(username)}/mutual-followers`, { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); const data = await response.json() as { followers?: MutualFollower[] }; if (!Array.isArray(data.followers)) throw new Error(); if (active) setFollowers(data.followers); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [username, open, preview]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const shown = preview ?? followers ?? [];
  const total = preview ? count ?? preview.length : shown.length;
  if (!shown.length) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Ver seguidores em comum com ${displayName}`} className={`mt-1 flex max-w-full flex-wrap items-center gap-1.5 text-left text-[12px] text-[#b7a9f8] hover:text-white ${centered ? "justify-center" : ""}`}>
      <span>Seguido(a) por</span>
      <span className="flex -space-x-1.5" aria-hidden="true">{shown.slice(0, 4).map((follower) => <span key={follower.id} className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] text-[10px] font-bold text-white ring-2 ring-[#09082a]">{follower.avatarUrl ? <img src={follower.avatarUrl} alt="" className="h-full w-full object-cover" /> : (follower.displayName || follower.username).charAt(0).toUpperCase()}</span>)}</span>
      {total > 4 && <span>e {total - 4} {total - 4 === 1 ? "outra pessoa" : "outras pessoas"}</span>}
    </button>
    {open && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Seguidores em comum" className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-[#1a0e3d] text-left shadow-xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><h2 className="text-lg font-bold text-white">Seguidores em comum</h2><button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-full px-2 py-1 text-2xl text-white/70 hover:text-white">×</button></div>
        {loading ? <p className="p-5 text-sm text-white/60">Carregando...</p> : error ? <p role="alert" className="p-5 text-sm text-red-300">Não foi possível carregar os seguidores em comum. Feche e tente novamente.</p> : !followers?.length ? <p className="p-5 text-sm text-white/60">Nenhum seguidor em comum no momento.</p> : <ul className="overflow-y-auto p-3">{followers.map((follower) => <li key={follower.id}><Link href={follower.profileUrl} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-white/5"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] font-bold text-white">{follower.avatarUrl ? <img src={follower.avatarUrl} alt="" className="h-full w-full object-cover" /> : (follower.displayName || follower.username).charAt(0).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{follower.displayName}</span><span className="block truncate text-xs text-white/55">@{follower.username}</span></span></Link></li>)}</ul>}
      </section>
    </div>}
  </>;
}
