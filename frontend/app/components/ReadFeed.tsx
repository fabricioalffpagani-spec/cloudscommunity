"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFeedPosition } from "../lib/feed-position";
import { ConnectedParticipants, useConnectionIds } from "./ConnectedParticipants";
import { RecloudMenuItem, useRecloud } from "./RecloudAction";
import { CloudParticipantsSheet } from "./CloudParticipantsSheet";
import { ForwardToContactModal, type ForwardContact } from "./ForwardToContactModal";
import { CloudReportModal } from "./CloudReportModal";
import { useDismissMenu } from "../lib/use-dismiss-menu";
import { CloudEditDialog, type EditableCloud } from "./CloudEditDialog";
import { PencilIcon, SendIcon, TrashIcon } from "./ui-icons";

export type ReadCloud = {
  id: string;
  title: string;
  duration?: string;
  description?: string | null;
  editCount?: number;
  endedAt: string | null;
  messagesCount: number;
  participantsCount?: number;
  author: { id: string; name: string; username: string; avatarUrl: string | null };
  participantProfiles: Array<{ id: string; name: string; username: string; avatarUrl: string | null }>;
};

export function ReadFeed({ clouds, initialCloudId, scope, currentUserId, onDelete, onEdited }: { clouds: ReadCloud[]; initialCloudId?: string | null; scope?: string; currentUserId?: string; onDelete: (cloudId: string) => Promise<void>; onEdited?: (cloud: EditableCloud) => void }) {
  const router = useRouter();
  const connectionIds = useConnectionIds(currentUserId);
  const [cloudToDelete, setCloudToDelete] = useState<ReadCloud | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [participantsCloudId, setParticipantsCloudId] = useState<string | null>(null);
  const [shareCloud, setShareCloud] = useState<ReadCloud | null>(null);
  const recloud = useRecloud(shareCloud?.id ?? "", Boolean(currentUserId && shareCloud));
  const [reportCloud, setReportCloud] = useState<ReadCloud | null>(null);
  const [editingCloud, setEditingCloud] = useState<ReadCloud | null>(null);
  const [optionsCloudId, setOptionsCloudId] = useState<string | null>(null);
  const optionsRef = useDismissMenu(optionsCloudId !== null, () => setOptionsCloudId(null));
  const [contacts, setContacts] = useState<ForwardContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const titleTap = useRef<{ cloudId: string; at: number } | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const syncPosition = useFeedPosition({ cloudIds: clouds.map((cloud) => cloud.id), feedRef, initialCloudId, scope, onActiveIndex: setActiveIndex });
  const participantsCloud = clouds.find((cloud) => cloud.id === participantsCloudId) ?? null;

  useEffect(() => {
    if (!shareCloud) return;
    let active = true;
    setLoadingContacts(true);
    fetch("/api/users/following", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { users?: ForwardContact[] }) => { if (active) setContacts((data.users ?? []).filter((contact) => contact.id !== currentUserId)); })
      .catch(() => { if (active) setContacts([]); })
      .finally(() => { if (active) setLoadingContacts(false); });
    return () => { active = false; };
  }, [shareCloud, currentUserId]);

  const navigateFeed = (direction: number) => {
    const nextIndex = Math.max(0, Math.min(clouds.length - 1, activeIndex + direction));
    const target = feedRef.current?.querySelectorAll<HTMLElement>("[data-cloud-page]")[nextIndex];
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveIndex(nextIndex);
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
    <div className="relative flex min-h-0 h-full w-full flex-col">
      <div ref={feedRef} onScroll={syncPosition} className="mobile-cloud-feed desktop-cloud-feed cloud-feed-scroller md:mx-auto md:w-full md:max-w-[1100px]">
        {clouds.map((cloud) => {
            const participants = cloud.participantProfiles.filter((person) => person.id !== cloud.author.id);
            const participantsCount = Math.max(participants.length, Math.max((cloud.participantsCount ?? 0) - 1, 0));
            return <article
            key={cloud.id}
            data-cloud-page
            className="relative flex min-h-full snap-start flex-col bg-transparent px-6 pb-3 pt-6 md:px-0 md:pb-0 md:pt-0"
          >
            <div className="read-card-header flex items-center justify-between gap-3 md:px-10 md:pb-5 md:pt-8">
              <Link href={`/users/${encodeURIComponent(cloud.author.username)}`} aria-label={`Ver perfil de ${cloud.author.name}`} className="flex min-w-0 items-center gap-3 md:gap-4">
                {cloud.author.avatarUrl ? (
                  <img src={cloud.author.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover md:h-16 md:w-16 md:ring-2 md:ring-white/10" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-base font-bold text-white md:h-16 md:w-16 md:text-xl md:ring-2 md:ring-white/10">{cloud.author.name.slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-bold leading-[1.25] text-white md:font-semibold md:leading-normal">{cloud.author.name}</p>
                  <p className="mt-0.5 truncate text-[13px] leading-[1.25] text-white/65 md:mt-0 md:text-[14px] md:leading-normal md:text-white/45">@{cloud.author.username}</p>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => setParticipantsCloudId(cloud.id)} className="flex shrink-0 -space-x-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC] md:-space-x-3" aria-label={`Ver ${participantsCount} participantes da Cloud`}>
                  {participants.slice(0, 7).map((person) => (
                    <span key={person.id}>
                      {person.avatarUrl ? <img src={person.avatarUrl} alt={person.name} title={person.name} className="h-8 w-8 rounded-full border-2 border-[#100625] object-cover md:h-11 md:w-11 md:border-[#160a3e]" referrerPolicy="no-referrer" /> : <span title={person.name} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#100625] bg-[#7C3AED] text-[10px] font-bold text-white md:h-11 md:w-11 md:border-[#160a3e] md:text-[13px]">{person.name.slice(0, 1).toUpperCase()}</span>}
                    </span>
                  ))}
                  {participantsCount > 7 && <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#100625] bg-[#32106f] text-[10px] font-bold text-white md:h-11 md:w-11 md:border-[#160a3e] md:text-[13px]">+{participantsCount - 7}</span>}
              </button><div ref={optionsCloudId === cloud.id ? optionsRef : undefined} className="relative">
                <button type="button" aria-label="Mais opções da Cloud" aria-expanded={optionsCloudId === cloud.id} onClick={(event) => { event.stopPropagation(); setOptionsCloudId((id) => id === cloud.id ? null : cloud.id); }} className="px-1 text-xl text-white/75">⋮</button>
                {optionsCloudId === cloud.id && <div className="absolute right-0 top-8 z-30 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#15161C] py-1 shadow-2xl">
                  {currentUserId === cloud.author.id && <button type="button" onClick={() => { setOptionsCloudId(null); setDeleteError(""); setCloudToDelete(cloud); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-red-300 hover:bg-white/5"><TrashIcon s={16} />Excluir a Cloud</button>}
                  {currentUserId && currentUserId === cloud.author.id && <button type="button" onClick={() => { setOptionsCloudId(null); setEditingCloud(cloud); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-white/80 hover:bg-white/5"><PencilIcon s={16} />Editar Cloud</button>}
                  <button type="button" onClick={() => { setOptionsCloudId(null); setShareCloud(cloud); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-white/80 hover:bg-white/5"><SendIcon s={16} />Enviar para</button>
                  {currentUserId && <RecloudMenuItem cloudId={cloud.id} />}
                  {currentUserId && currentUserId !== cloud.author.id && <button type="button" onClick={() => { setOptionsCloudId(null); setReportCloud(cloud); }} className="w-full px-4 py-2.5 text-left text-[13px] text-red-300 hover:bg-white/5">Denunciar</button>}
                </div>}
              </div></div>
            </div>

            <div
              className="read-card-center my-auto flex flex-1 flex-col items-center justify-center px-0 py-5 text-center md:my-0 md:px-12 md:py-10"
              role="button"
              tabIndex={0}
              onDoubleClick={() => { if (!window.matchMedia?.("(max-width: 767px)").matches) router.push(`/cloud/${cloud.id}/conversation?from=read&scope=${encodeURIComponent(scope ?? "for-you")}`); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(`/cloud/${cloud.id}/conversation?from=read&scope=${encodeURIComponent(scope ?? "for-you")}`); } }}
              onPointerDown={(event) => { touchStart.current = { x: event.clientX, y: event.clientY }; }}
              onPointerUp={(event) => {
                const start = touchStart.current;
                touchStart.current = null;
                const isMobile = window.matchMedia?.("(max-width: 767px)").matches;
                if (!start || !isMobile) return;
                const deltaX = event.clientX - start.x;
                const deltaY = event.clientY - start.y;
                if (Math.abs(deltaX) > 18 || Math.abs(deltaY) > 18) return;
                const now = Date.now();
                if (titleTap.current?.cloudId === cloud.id && now - titleTap.current.at < 350) {
                  titleTap.current = null;
                  router.push(`/cloud/${cloud.id}/conversation?from=read&scope=${encodeURIComponent(scope ?? "for-you")}`);
                } else {
                  titleTap.current = { cloudId: cloud.id, at: now };
                }
              }}
              onPointerCancel={() => { touchStart.current = null; }}
              style={{ touchAction: "pan-y" }}
              aria-label={`Cloud ${cloud.title}. Toque ou clique duas vezes para ler a conversa.`}
            >
              <h2 lang="pt-BR" className={`cloud-feed-title max-w-[88%] hyphens-auto break-words font-bold text-white ${cloud.title.length > 68 ? "text-[42px] leading-[1.16] tracking-[-.035em] md:text-[52px] md:leading-[1.1]" : "text-[52px] leading-[1.13] tracking-[-.045em] md:text-[60px] md:leading-[1.08] md:tracking-tight"}`} style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif", hyphenateCharacter: "–" }}>{cloud.title}</h2>
            </div>

            <div className="read-card-footer mb-4 min-h-7 md:mb-10 md:px-10"><ConnectedParticipants participants={cloud.participantProfiles} ids={connectionIds} archived /></div>
          </article>;
        })}
      </div>
      {clouds.length > 1 && <div style={{ right: "max(1rem, calc(50% - 625px))" }} className="pointer-events-none absolute inset-y-0 z-20 hidden flex-col justify-center gap-2 md:flex"><button type="button" aria-label="Cloud anterior" onClick={() => navigateFeed(-1)} disabled={activeIndex === 0} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171325]/25 text-lg text-white/65 shadow-sm backdrop-blur-md transition hover:border-white/20 hover:bg-[#2B174F]/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-20">↑</button><button type="button" aria-label="Próxima Cloud" onClick={() => navigateFeed(1)} disabled={activeIndex >= clouds.length - 1} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171325]/25 text-lg text-white/65 shadow-sm backdrop-blur-md transition hover:border-white/20 hover:bg-[#2B174F]/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-20">↓</button></div>}
      {participantsCloud && <CloudParticipantsSheet title={participantsCloud.title} participants={participantsCloud.participantProfiles} onClose={() => setParticipantsCloudId(null)} />}
      {editingCloud && <CloudEditDialog cloud={{ id: editingCloud.id, title: editingCloud.title, duration: editingCloud.duration ?? "10min", description: editingCloud.description, editCount: editingCloud.editCount ?? 0 }} onClose={() => setEditingCloud(null)} onSaved={(updated) => { onEdited?.(updated); setEditingCloud(null); }} />}
      {reportCloud && <CloudReportModal cloudId={reportCloud.id} cloudTitle={reportCloud.title} reportedId={reportCloud.author.id} onClose={() => setReportCloud(null)} />}
      {shareCloud && (() => {
        const url = `${window.location.origin}/cloud/${encodeURIComponent(shareCloud.id)}/conversation?from=read`;
        return <ForwardToContactModal title="Compartilhar Cloud" preview={shareCloud.title} url={url} label={shareCloud.title} forwarded={false} contacts={contacts} loading={loadingContacts} recloud={recloud.canRecloud ? { reclouded: recloud.reclouded, busy: recloud.busy, error: recloud.error, onToggle: () => void recloud.toggle() } : undefined} externalShareText={`Venha ler a conversa “${shareCloud.title}” no Clouds!\n${url}`} externalSharePrompt="Convide amigos para ler esta conversa no Read!" onClose={() => setShareCloud(null)} />;
      })()}
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
