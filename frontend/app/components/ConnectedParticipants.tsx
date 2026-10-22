"use client";

import { useEffect, useState } from "react";
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
  const connected = participants.filter((person) => ids.has(person.id));
  if (!connected.length) return null;
  return <div className="flex min-w-0 items-center gap-2 text-[11px] leading-tight text-white/70 md:text-sm">
    <div className="flex shrink-0 -space-x-2" aria-label={`${connected.length} perfis`}>
      {connected.slice(0, 6).map((person, index) => <span key={person.id} title={person.name} className={`${index >= 4 ? "hidden md:flex" : "flex"} h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-[#100625] bg-[#7C3AED] text-[10px] font-bold text-white md:h-8 md:w-8`}>{person.avatarUrl ? <img src={person.avatarUrl} alt={person.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : person.name.slice(0, 1).toUpperCase()}</span>)}
      {connected.length > 4 && <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#100625] bg-[#32106f] text-[10px] font-bold text-white md:hidden">+{connected.length - 4}</span>}
      {connected.length > 6 && <span className="hidden h-8 w-8 items-center justify-center rounded-full border-2 border-[#100625] bg-[#32106f] text-[10px] font-bold text-white md:flex">+{connected.length - 6}</span>}
    </div>
    <span>{archived ? "participaram dessa cloud" : "estão participando dessa cloud"}</span>
  </div>;
}
