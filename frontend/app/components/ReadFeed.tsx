"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type ReadCloud = {
  id: string;
  title: string;
  endedAt: string | null;
  messagesCount: number;
  participantsCount?: number;
  author: { id: string; name: string; username: string; avatarUrl: string | null };
  participantProfiles: Array<{ id: string; name: string; avatarUrl: string | null }>;
};

export function ReadFeed({ clouds, initialCloudId, currentUserId, onDelete }: { clouds: ReadCloud[]; initialCloudId?: string | null; currentUserId?: string; onDelete: (cloudId: string) => Promise<void> }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [slideAnim, setSlideAnim] = useState<"up" | "down" | null>(null);
  const [cloudToDelete, setCloudToDelete] = useState<ReadCloud | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const wheelLocked = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const index = initialCloudId ? clouds.findIndex((cloud) => cloud.id === initialCloudId) : -1;
    if (index >= 0) setIndex(index);
  }, [clouds, initialCloudId]);

  const current = Math.min(index, Math.max(0, clouds.length - 1));

  const navigateCloud = (direction: number) => {
    if (clouds.length <= 1 || slideAnim) return;
    setSlideAnim(direction > 0 ? "up" : "down");
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

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (window.matchMedia?.("(max-width: 767px)").matches || clouds.length <= 1 || slideAnim || Math.abs(event.deltaY) < 12 || wheelLocked.current) return;
    event.preventDefault();
    wheelLocked.current = true;
    navigateCloud(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLocked.current = false; }, 360);
  };

  const confirmDelete = async () => {
    if (!cloudToDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(cloudToDelete.id);
      setCloudToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Não foi possível excluir a cloud.");
    } finally {
      setDeleting(false);
    }
  };

  if (!clouds.length) {
    return <p className="px-6 py-24 text-center text-white/60">Nenhuma cloud encerrada por aqui ainda.</p>;
  }

  return (
    <div className="relative h-full w-full md:flex md:h-auto md:items-center md:justify-center" onWheel={handleWheel}>
      {clouds.length > 1 && (
        <div className="absolute right-[max(1.5rem,calc(50%-620px))] top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          <button type="button" aria-label="Cloud anterior" onClick={() => navigateCloud(-1)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.10] text-white transition hover:bg-white/[0.20]">
            <ArrowIcon direction="up" />
          </button>
          <button type="button" aria-label="Próxima Cloud" onClick={() => navigateCloud(1)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.10] text-white transition hover:bg-white/[0.20]">
            <ArrowIcon direction="down" />
          </button>
        </div>
      )}

      <div className="mobile-cloud-feed h-full snap-y snap-mandatory overflow-y-auto overscroll-contain md:mr-20 md:flex md:h-auto md:min-w-0 md:max-w-[1100px] md:flex-1 md:flex-col md:gap-4 md:overflow-visible xl:mr-0">
        {clouds.map((cloud, cloudIndex) => (
          <article
            key={cloud.id}
            className={`relative min-h-full snap-start flex-col overflow-hidden bg-transparent px-6 pb-3 pt-6 md:min-h-0 md:rounded-3xl md:border md:border-[#A855F7]/[.22] md:bg-[linear-gradient(175deg,rgba(40,15,100,.85)_0%,rgba(15,8,50,.92)_60%,rgba(8,5,30,.95)_100%)] md:px-0 md:pb-0 md:pt-0 md:shadow-[0_40px_100px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.06)] ${cloudIndex === current ? "flex" : "flex md:hidden"}`}
            style={{
              transition: "transform 0.25s ease, opacity 0.25s ease",
              transform: slideAnim === "up" ? "translateY(-36px)" : slideAnim === "down" ? "translateY(36px)" : "translateY(0)",
              opacity: slideAnim ? 0.15 : 1,
            }}
          >
            <div className="flex items-center justify-between gap-3 md:px-10 md:pb-5 md:pt-8">
              <Link href={`/users/${encodeURIComponent(cloud.author.username)}`} aria-label={`Ver perfil de ${cloud.author.name}`} className="flex min-w-0 items-center gap-3 md:gap-4">
                {cloud.author.avatarUrl ? (
                  <img src={cloud.author.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover md:h-16 md:w-16 md:ring-2 md:ring-white/10" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-base font-bold text-white md:h-16 md:w-16 md:text-xl md:ring-2 md:ring-white/10">{cloud.author.name.slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-bold leading-none text-white md:font-semibold md:leading-normal">{cloud.author.name}</p>
                  <p className="mt-1 truncate text-[13px] text-white/65 md:mt-0 md:text-[14px] md:text-white/45">@{cloud.author.username}</p>
                </div>
              </Link>

              <div className="flex shrink-0 -space-x-2 md:-space-x-3" aria-label={`${cloud.participantsCount ?? cloud.participantProfiles.length} participantes da Cloud`}>
                  {cloud.participantProfiles.slice(0, 7).map((person) => (
                    <Link key={person.id} href={`/users/${encodeURIComponent(person.id)}`} aria-label={`Ver perfil de ${person.name}`}>
                      {person.avatarUrl ? <img src={person.avatarUrl} alt={person.name} title={person.name} className="h-8 w-8 rounded-full border-2 border-[#100625] object-cover md:h-11 md:w-11 md:border-[#160a3e]" referrerPolicy="no-referrer" /> : <span title={person.name} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#100625] bg-[#7C3AED] text-[10px] font-bold text-white md:h-11 md:w-11 md:border-[#160a3e] md:text-[13px]">{person.name.slice(0, 1).toUpperCase()}</span>}
                    </Link>
                  ))}
                  {(cloud.participantsCount ?? cloud.participantProfiles.length) > 7 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#100625] bg-[#32106f] text-[10px] font-bold text-white md:h-11 md:w-11 md:border-[#160a3e] md:text-[13px]">+{(cloud.participantsCount ?? cloud.participantProfiles.length) - 7}</span>}
              </div>
            </div>

            <div
              className="my-auto px-0 py-5 text-center md:my-0 md:px-12 md:py-12"
              onPointerDown={(event) => { touchStart.current = { x: event.clientX, y: event.clientY }; }}
              onPointerUp={(event) => {
                const start = touchStart.current;
                touchStart.current = null;
                const isMobile = window.matchMedia?.("(max-width: 767px)").matches;
                if (!start || !isMobile) return;
                const deltaX = event.clientX - start.x;
                const deltaY = event.clientY - start.y;
                if (deltaX < -48 && Math.abs(deltaX) > Math.abs(deltaY)) router.push(`/cloud/${cloud.id}/conversation`);
              }}
              onPointerCancel={() => { touchStart.current = null; }}
              style={{ touchAction: "pan-y" }}
              aria-label={`Cloud ${cloud.title}. Deslize para a esquerda para ler a conversa.`}
            >
              <h2 lang="pt-BR" className={`hyphens-auto break-normal font-bold text-white ${cloud.title.length > 68 ? "text-[42px] leading-[1.16] tracking-[-.035em] md:text-[52px] md:leading-[1.1]" : "text-[52px] leading-[1.13] tracking-[-.045em] md:text-[60px] md:leading-[1.08] md:tracking-tight"}`} style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif", hyphenateCharacter: "–" }}>{cloud.title}</h2>
              <Link href={`/cloud/${cloud.id}/conversation`} className="mt-8 hidden min-w-[306px] items-center justify-center rounded-full border border-[#A855F7] px-7 py-4 text-[16px] font-medium text-white transition hover:bg-[#A855F7]/10 md:inline-flex">Ler conversa</Link>
            </div>

            <div className="relative flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/[.08] pt-3 text-[12px] text-white/65 md:gap-x-6 md:border-0 md:px-10 md:pb-6 md:pt-0 md:text-[14px]">
              <span className="inline-flex shrink-0 items-center gap-1.5"><MessageIcon /><span className="hidden sm:inline">{cloud.messagesCount} comentários</span><span className="sm:hidden">{cloud.messagesCount}</span></span>
              <span className="inline-flex shrink-0 items-center gap-1.5"><LockIcon />{endedLabel(cloud.endedAt, now)}</span>
              {cloud.author.id === currentUserId && <button type="button" onClick={() => { setDeleteError(""); setCloudToDelete(cloud); }} className="rounded-full border border-red-400/30 px-3 py-1.5 text-[12px] font-semibold text-red-300 transition hover:bg-red-500/10">Excluir cloud</button>}
            </div>
          </article>
        ))}
      </div>
      {cloudToDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-cloud-title">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#15161C] p-6 shadow-2xl">
          <h2 id="delete-cloud-title" className="text-[18px] font-bold text-white">Excluir Cloud?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/60">“{cloudToDelete.title}” será removida da plataforma e não ficará mais disponível em Read.</p>
          {deleteError && <p role="alert" className="mt-3 text-[13px] text-red-300">{deleteError}</p>}
          <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={deleting} onClick={() => setCloudToDelete(null)} className="rounded-full px-4 py-2 text-[13px] font-semibold text-white/65 transition hover:text-white">Cancelar</button><button type="button" disabled={deleting} onClick={() => void confirmDelete()} className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-50">{deleting ? "Excluindo..." : "Excluir"}</button></div>
        </div>
      </div>}
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "up" | "down" }) {
  return <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={direction === "up" ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} /></svg>;
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
