"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type ReadCloud = {
  id: string;
  title: string;
  endedAt: string | null;
  messagesCount: number;
  author: { name: string; username: string; avatarUrl: string | null };
  participantProfiles: Array<{ id: string; name: string; avatarUrl: string | null }>;
};

export function ReadFeed({ clouds }: { clouds: ReadCloud[] }) {
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [slideAnim, setSlideAnim] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const current = Math.min(index, Math.max(0, clouds.length - 1));

  const navigateCloud = (direction: number) => {
    if (clouds.length <= 1 || slideAnim) return;
    setSlideAnim(direction > 0 ? "left" : "right");
    window.setTimeout(() => {
      setIndex((previous) => {
        const next = previous + direction;
        if (next < 0) return clouds.length - 1;
        if (next >= clouds.length) return 0;
        return next;
      });
      setSlideAnim(null);
    }, 260);
  };

  if (!clouds.length) {
    return <p className="px-6 py-24 text-center text-white/60">Nenhuma cloud encerrada por aqui ainda.</p>;
  }

  return (
    <div className="relative h-full w-full md:flex md:h-auto md:items-center md:justify-center md:gap-4">
      {clouds.length > 1 && (
        <button type="button" aria-label="Cloud anterior" onClick={() => navigateCloud(-1)} className="z-10 hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white transition hover:bg-white/[0.20] md:flex">
          <ArrowIcon direction="left" />
        </button>
      )}

      <div className="mobile-cloud-feed h-full snap-y snap-mandatory overflow-y-auto overscroll-contain md:flex md:h-auto md:min-w-0 md:max-w-[1100px] md:flex-1 md:flex-col md:gap-4 md:overflow-visible">
        {clouds.map((cloud, cloudIndex) => (
          <article
            key={cloud.id}
            className={`relative min-h-full snap-start flex-col overflow-hidden bg-[radial-gradient(ellipse_at_50%_47%,rgba(54,23,147,.78)_0%,rgba(24,9,73,.66)_30%,transparent_63%),linear-gradient(180deg,#04030b_0%,#0a041f_100%)] px-6 pb-3 pt-6 md:min-h-0 md:rounded-3xl md:border md:border-[#A855F7]/[.22] md:bg-[linear-gradient(175deg,rgba(40,15,100,.85)_0%,rgba(15,8,50,.92)_60%,rgba(8,5,30,.95)_100%)] md:px-0 md:pb-0 md:pt-0 md:shadow-[0_40px_100px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.06)] ${cloudIndex === current ? "flex" : "flex md:hidden"}`}
            style={{
              transition: "transform 0.25s ease, opacity 0.25s ease",
              transform: slideAnim === "left" ? "translateX(-36px)" : slideAnim === "right" ? "translateX(36px)" : "translateX(0)",
              opacity: slideAnim ? 0.15 : 1,
            }}
          >
            <div className="flex items-center justify-between gap-3 md:px-10 md:pb-5 md:pt-8">
              <div className="flex min-w-0 items-center gap-3 md:gap-4">
                {cloud.author.avatarUrl ? (
                  <img src={cloud.author.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover md:h-16 md:w-16 md:ring-2 md:ring-white/10" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-base font-bold text-white md:h-16 md:w-16 md:text-xl md:ring-2 md:ring-white/10">{cloud.author.name.slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-bold leading-none text-white md:font-semibold md:leading-normal">{cloud.author.name}</p>
                  <p className="mt-1 truncate text-[13px] text-white/65 md:mt-0 md:text-[14px] md:text-white/45">@{cloud.author.username}</p>
                </div>
              </div>

              <div className="flex shrink-0 -space-x-2 md:-space-x-3" aria-label="Participantes da Cloud">
                {cloud.participantProfiles.slice(0, 7).map((person) => person.avatarUrl ? (
                  <img key={person.id} src={person.avatarUrl} alt={person.name} title={person.name} className="h-8 w-8 rounded-full border-2 border-[#100625] object-cover md:h-11 md:w-11 md:border-[#160a3e]" referrerPolicy="no-referrer" />
                ) : (
                  <span key={person.id} title={person.name} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#100625] bg-[#7C3AED] text-[10px] font-bold text-white md:h-11 md:w-11 md:border-[#160a3e] md:text-[13px]">{person.name.slice(0, 1).toUpperCase()}</span>
                ))}
                {cloud.participantProfiles.length > 7 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#100625] bg-[#32106f] text-[10px] font-bold text-white md:h-11 md:w-11 md:border-[#160a3e] md:text-[13px]">+{cloud.participantProfiles.length - 7}</span>}
              </div>
            </div>

            <div className="my-auto px-0 py-5 text-center md:my-0 md:px-12 md:py-12">
              <h2 className="break-words text-[52px] font-bold leading-[1.13] tracking-[-.045em] text-white md:text-[72px] md:font-extrabold md:leading-[1.08] md:tracking-tight" style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif" }}>{cloud.title}</h2>
            </div>

            <div className="flex justify-center px-0 pb-6 md:px-12 md:pb-12">
              <Link href={`/cloud/${cloud.id}/preview`} className="inline-flex items-center gap-5 rounded-full border border-[#A855F7]/70 bg-transparent px-8 py-4 text-[16px] font-semibold text-white transition hover:bg-[#A855F7]/20 md:px-24 md:py-5 md:text-[18px]">
                <MessageIcon />
                Ver prévia
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-white/[.08] pt-2 text-[13px] text-white/65 md:border-0 md:px-10 md:pb-6 md:pt-0 md:text-[14px]">
              <span className="inline-flex items-center gap-2"><MessageIcon />{cloud.messagesCount} comentários</span>
              <span className="inline-flex items-center gap-2"><LockIcon />{endedLabel(cloud.endedAt, now)}</span>
            </div>
          </article>
        ))}

        {clouds.length > 1 && (
          <div className="hidden justify-center gap-2 md:flex" aria-label={`Cloud ${current + 1} de ${clouds.length}`}>
            {clouds.map((cloud, dotIndex) => <span key={cloud.id} className={`h-1.5 rounded-full transition-all ${dotIndex === current ? "w-6 bg-[#A855F7]" : "w-1.5 bg-white/20"}`} />)}
          </div>
        )}
      </div>

      {clouds.length > 1 && (
        <button type="button" aria-label="Próxima Cloud" onClick={() => navigateCloud(1)} className="z-10 hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white transition hover:bg-white/[0.20] md:flex">
          <ArrowIcon direction="right" />
        </button>
      )}
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>;
}

function MessageIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="shrink-0 text-[#A855F7]" aria-hidden="true"><path d="M21 14a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" /></svg>;
}

function LockIcon() {
  return <svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="12" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3" /></svg>;
}

function endedLabel(endedAt: string | null, now: number) {
  if (!endedAt) return "Encerrada";
  const minutes = Math.max(0, Math.floor((now - new Date(endedAt).getTime()) / 60_000));
  if (minutes < 1) return "Encerrada agora";
  if (minutes < 60) return `Encerrada há ${minutes}min`;
  if (minutes < 1440) return `Encerrada há ${Math.floor(minutes / 60)}h`;
  return `Encerrada há ${Math.floor(minutes / 1440)}d`;
}
