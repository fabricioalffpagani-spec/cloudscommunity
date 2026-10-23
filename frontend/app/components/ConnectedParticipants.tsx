"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { CloudParticipant } from "./CloudParticipantsSheet";

export function useConnectionIds(userId?: string) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    setIds(new Set());
    if (!userId) return;
    fetch("/api/users/connections", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { userIds?: string[] }) => { if (active) setIds(new Set(data.userIds ?? [])); })
      .catch(() => { if (active) setIds(new Set()); });
    return () => { active = false; };
  }, [userId]);
  return ids;
}

export function ConnectedParticipants({ participants, ids, archived = false }: { participants: CloudParticipant[]; ids: Set<string>; archived?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialogTitleId = useId();
  const connected = participants.filter((person) => ids.has(person.id));
  if (!connected.length && !open) return null;
  const description = archived
    ? (connected.length === 1 ? "participou dessa cloud" : "participaram dessa cloud")
    : (connected.length === 1 ? "está participando dessa cloud" : "estão participando dessa cloud");
  return <>
    {connected.length > 0 && <button type="button" onClick={(event) => { event.stopPropagation(); setOpen(true); }} aria-label={`Ver ${connected.length} ${connected.length === 1 ? "pessoa em comum" : "pessoas em comum"}`} className="flex min-w-0 items-center gap-2 text-left text-[11px] leading-tight text-white/70 outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC] md:text-sm">
      <span className="flex shrink-0 -space-x-2" aria-label={`${connected.length} perfis`}>
        {connected.slice(0, 6).map((person, index) => <span key={person.id} title={person.name} className={`${index >= 4 ? "hidden md:flex" : "flex"} h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-[#100625] bg-[#7C3AED] text-[10px] font-bold text-white md:h-8 md:w-8`}>{person.avatarUrl ? <img src={person.avatarUrl} alt={person.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : person.name.slice(0, 1).toUpperCase()}</span>)}
        {connected.length > 4 && <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#100625] bg-[#32106f] text-[10px] font-bold text-white md:hidden">+{connected.length - 4}</span>}
        {connected.length > 6 && <span className="hidden h-8 w-8 items-center justify-center rounded-full border-2 border-[#100625] bg-[#32106f] text-[10px] font-bold text-white md:flex">+{connected.length - 6}</span>}
      </span>
      <span>{description}</span>
    </button>}
    {open && createPortal(<div role="dialog" aria-modal="true" aria-labelledby={dialogTitleId} onClick={(event) => { event.stopPropagation(); setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-5">
      <div onClick={(event) => event.stopPropagation()} className="w-full rounded-t-3xl border border-white/10 bg-[#171821] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id={dialogTitleId} className="text-lg font-bold text-white">Pessoas em comum</h2><p className="mt-1 text-sm text-white/60">{connected.length} {connected.length === 1 ? "pessoa" : "pessoas"} {description}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-2xl text-white/55">×</button></div>
        <div className="mt-5 max-h-[55dvh] space-y-2 overflow-y-auto">{connected.map((person) => <Link key={person.id} href={`/users/${encodeURIComponent(person.id)}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/5"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#9333EA] text-sm font-bold">{person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : person.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{person.name}</span><span className="block truncate text-xs text-white/55">@{person.username}</span></span></Link>)}</div>
      </div>
    </div>, document.body)}
  </>;
}
