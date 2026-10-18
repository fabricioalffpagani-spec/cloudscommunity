"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HeaderBrand } from "../components/HeaderBrand";
import { FlameIcon } from "../components/FlameIcon";
import { LongPressHint } from "../components/LongPressHint";
import {
  SessionUserAvatar,
  SessionUserLink,
  getSessionUserDisplayName,
  getSessionUserHandle,
  useSessionUser,
} from "../components/session-user";
import { MobileAppNav, MobileCloudEntryLink } from "../components/MobileAppChrome";
import { NotificationsBell } from "../components/NotificationsPanel";
import { ProfilePhotoCropper } from "../components/ProfilePhotoCropper";
import { ProfileAvatarViewer } from "../components/ProfileAvatarViewer";

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function GearIcon({ s = 15 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

function BackIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18 8 12l7-6" />
    </svg>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/[0.08] bg-[#120a2e] p-6 ${className}`}>{children}</div>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#6B7280]">{children}</h3>;
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-[#1a0e3d] px-4 py-3 text-[14px] text-[#F9FAFB] placeholder:text-[#6B7280] outline-none transition focus:border-[#A855F7]"
      />
    </div>
  );
}

function hasCountryAndCity(location: string) {
  const [country, ...cityParts] = location.split(",");
  return Boolean(country?.trim() && cityParts.join(",").trim());
}

const DURATION_SECONDS: Record<string, number> = {
  "30min": 30 * 60,
  "1h": 60 * 60,
  "2h": 2 * 60 * 60,
  "5h": 5 * 60 * 60,
  "24h": 24 * 60 * 60,
};

function parseDurationSeconds(duration: string) {
  return DURATION_SECONDS[duration] ?? 30 * 60;
}

function formatCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

type FollowListUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  hypesCount?: number;
};

function FollowListModal({
  title,
  emptyMessage,
  loading,
  users,
  onClose,
  actionLabel,
  onAction,
  actioningId,
  showHypes,
  hint,
}: {
  title: string;
  emptyMessage: string;
  loading: boolean;
  users: FollowListUser[];
  onClose: () => void;
  actionLabel?: string;
  onAction?: (user: FollowListUser) => void;
  actioningId?: string | null;
  showHypes?: boolean;
  hint?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="absolute left-1/2 top-1/2 flex max-h-[calc(100dvh-3rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a0e3d] p-4 sm:p-6"
        style={{ width: "calc(100% - 3rem)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[18px] font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="text-white/50 transition hover:text-white" aria-label="Fechar">
            <XIcon />
          </button>
        </div>
        {hint && <p className="mb-4 text-[12px] leading-relaxed text-white/55">{hint}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-purple pr-1">
          {loading ? (
            <p className="py-4 text-center text-white/50">Carregando...</p>
          ) : users.length === 0 ? (
            <p className="py-4 text-center text-white/50">{emptyMessage}</p>
          ) : (
            <div className="space-y-3">
              {users.map((listedUser) => (
                <div
                  key={listedUser.id}
                  className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-white/5"
                >
                  <Link href={`/users/${listedUser.username}`} className="flex min-w-0 flex-1 items-center gap-3" onClick={onClose}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] font-bold text-white">
                    {listedUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listedUser.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      listedUser.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="truncate font-semibold text-white">{listedUser.displayName}</p>
                    <p className="truncate text-sm text-white/50">@{listedUser.username}</p>
                  </div>
                  </Link>
                  {showHypes && <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center text-[#FF7A18]"><FlameIcon s={22} filled /><span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[9px] font-extrabold leading-none text-white">{listedUser.hypesCount}</span></span>}
                  {actionLabel && onAction && <button type="button" disabled={actioningId === listedUser.id} onClick={() => onAction(listedUser)} className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition hover:border-red-400/60 hover:text-red-300 disabled:opacity-50">{actioningId === listedUser.id ? "..." : actionLabel}</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMemberSince(value?: string | null) {
  if (!value) {
    return "agora";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "agora";
  }

  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function ProfileEmptyState() {
  return (
    <div className="mt-10 rounded-2xl border border-white/[0.06] bg-[#120a2e] p-6 text-center">
      <p className="text-[16px] font-semibold text-white">As clouds que criar aparecerão aqui.</p>
      <p className="mt-2 text-[13px] text-white/45">Você pode ocultá-las de seu perfil nas configurações.</p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#22C55E]/15 px-4 py-2 text-[13px] font-semibold text-[#22C55E] transition hover:bg-[#22C55E]/25"
      >
        Explorar feed
      </Link>
    </div>
  );
}

type ProfileCloud = {
  id: string;
  authorId: string;
  title: string;
  description: string | null;
  duration: string;
  visibility: "public" | "private";
  createdAt: string;
  endedAt: string | null;
  scheduledAt: string | null;
  participantProfiles?: Array<{ id: string; name: string; username: string; avatarUrl: string | null }>;
  messagesCount?: number;
  status: "active" | "ended";
  href: string;
};

const CLOUD_REPORT_REASONS = ["Spam ou publicidade", "Discurso de ódio", "Assédio ou bullying", "Conteúdo violento ou perturbador", "Informação falsa", "Conteúdo sexual inapropriado", "Ameaças", "Outro"];

function ProfileCloudCard({ cloud, now, viewerId, authorAvatarUrl, onDelete, onReminderActivated }: { cloud: ProfileCloud; now: number; viewerId?: string; authorAvatarUrl?: string | null; onDelete?: (cloud: ProfileCloud) => void; onReminderActivated?: (cloud: ProfileCloud) => void }) {
  const createdAt = new Date(cloud.createdAt);
  const remainingSeconds = Math.max(parseDurationSeconds(cloud.duration) - Math.floor((now - createdAt.getTime()) / 1000), 0);
  const isEnded = cloud.status === "ended";
  const scheduledDate = cloud.scheduledAt ? new Date(cloud.scheduledAt) : null;
  const isScheduled = Boolean(scheduledDate && scheduledDate.getTime() > now);
  const isLive = !isEnded && remainingSeconds > 0;
  const [reminderSet, setReminderSet] = useState(() => Boolean(viewerId && cloud.participantProfiles?.some((participant) => participant.id === viewerId)));
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReasons, setReportReasons] = useState<string[]>([]);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState("");
  const isHost = Boolean(viewerId && cloud.authorId === viewerId);

  useEffect(() => {
    if (viewerId && cloud.participantProfiles?.some((participant) => participant.id === viewerId)) {
      setReminderSet(true);
    }
  }, [cloud.participantProfiles, viewerId]);

  const activateReminder = async () => {
    if (reminderSet) return;
    const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/join`, { method: "POST" });
    if (response.ok) {
      setReminderSet(true);
      onReminderActivated?.(cloud);
    }
  };

  const sendReport = async () => {
    if (reportReasons.length === 0 || reporting) return;
    setReporting(true);
    setReportError("");
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportedId: cloud.authorId, messageId: null, messageContent: cloud.title, reasons: reportReasons }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível enviar a denúncia.");
      setReportOpen(false);
      setReportReasons([]);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Não foi possível enviar a denúncia.");
    } finally {
      setReporting(false);
    }
  };

  const statusLabel = isScheduled ? "Agendada" : isLive ? "Ao vivo" : "Encerrada";
  const statusDetail = isScheduled && scheduledDate
    ? `Estreia em ${scheduledDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
    : isEnded && cloud.endedAt
      ? `Encerrada em ${new Date(cloud.endedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
      : `Encerra em ${formatCountdown(remainingSeconds)}`;
  const participants = (cloud.participantProfiles ?? []).filter((participant) => participant.id !== cloud.authorId);
  const visibleParticipants = participants.slice(0, 3);
  return (
    <article className={`cloud-card relative flex min-h-[180px] min-w-0 w-full flex-col overflow-visible rounded-2xl border border-[#8B5CF6]/35 bg-[#1a0e3d]/75 p-4 shadow-[0_12px_32px_rgba(2,0,12,.22)] backdrop-blur-sm ${menuOpen ? "z-30" : "z-0"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] text-[13px] font-bold text-white">{authorAvatarUrl ? <img src={authorAvatarUrl} alt="" className="h-full w-full object-cover" /> : cloud.title.slice(0, 1).toUpperCase()}</span>
        <div className="flex items-center gap-2"><div className="flex -space-x-2" aria-label={`${participants.length} participantes`}>{visibleParticipants.map((participant) => <span key={participant.id} title={participant.name} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-[#110825] bg-[#7C3AED] text-[10px] font-bold text-white">{participant.avatarUrl ? <img src={participant.avatarUrl} alt={participant.name} className="h-full w-full object-cover" /> : participant.name.slice(0, 1).toUpperCase()}</span>)}{participants.length > visibleParticipants.length && <span title={`${participants.length - visibleParticipants.length} participantes a mais`} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#110825] bg-[#28134e] text-[10px] font-bold text-white">+{participants.length - visibleParticipants.length}</span>}</div><div className="relative"><button type="button" aria-label="Opções da Cloud" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="flex h-8 w-7 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10">⋮</button>{menuOpen && <div className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#1a0e3d] py-1 shadow-2xl"><button type="button" onClick={() => { setDetailsOpen(true); setMenuOpen(false); }} className="w-full px-4 py-2.5 text-left text-[13px] text-white/80 hover:bg-white/[0.07]">Informações da Cloud</button>{viewerId && !isHost && <button type="button" onClick={() => { setReportOpen(true); setMenuOpen(false); setReportError(""); }} className="w-full px-4 py-2.5 text-left text-[13px] text-red-300 hover:bg-red-500/10">Denunciar</button>}{isHost && onDelete && <button type="button" onClick={() => { onDelete(cloud); setMenuOpen(false); }} className="w-full px-4 py-2.5 text-left text-[13px] text-red-300 hover:bg-red-500/10">Excluir Cloud permanentemente</button>}</div>}</div></div>
      </div>
      <MobileCloudEntryLink href={isEnded ? `/cloud/${cloud.id}/conversation` : cloud.href} className="flex min-w-0 flex-1 items-center justify-center py-5 text-center"><h3 lang="pt-BR" className={`min-w-0 break-words [overflow-wrap:anywhere] hyphens-auto font-semibold text-white ${cloud.title.length > 68 ? "text-[21px] leading-[1.2]" : "text-[27px] leading-tight"}`}>{cloud.title}</h3></MobileCloudEntryLink>
      <p className="text-center text-[11px] text-white/50">{statusLabel} {statusDetail}</p>
      {detailsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"><div className="max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-sm overflow-x-hidden overflow-y-auto rounded-2xl border border-white/10 bg-[#15161C] p-5"><div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-[#15161C]"><h2 className="text-[18px] font-bold">Informações da Cloud</h2><button type="button" aria-label="Fechar informações" onClick={() => setDetailsOpen(false)} className="shrink-0 p-1 text-xl text-white/50">×</button></div><div className="mt-4 min-w-0 space-y-2 text-[14px] text-white/70"><p><span className="text-white/40">Duração: </span>{cloud.duration}</p><p><span className="text-white/40">Participantes: </span>{cloud.participantProfiles?.length ?? 0}</p><p><span className="text-white/40">Comentários: </span>{cloud.messagesCount ?? 0}</p><p><span className="text-white/40">Status: </span>{statusLabel}</p><p className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"><span className="text-white/40">Descrição: </span>{cloud.description?.trim() || "Sem descrição."}</p></div></div></div>}
      {reportOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15161C] p-5"><div className="flex items-center justify-between gap-4"><h2 className="text-[18px] font-bold">Denunciar Cloud</h2><button type="button" onClick={() => setReportOpen(false)} className="text-xl text-white/50">×</button></div><p className="mt-2 text-[13px] leading-relaxed text-white/60">Selecione os motivos. A denúncia será encaminhada para cloudscomunidade@gmail.com.</p><div className="mt-4 space-y-2">{CLOUD_REPORT_REASONS.map((reason) => <label key={reason} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/80"><input type="checkbox" checked={reportReasons.includes(reason)} onChange={() => setReportReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason])} className="h-4 w-4 accent-[#A855F7]" />{reason}</label>)}</div>{reportError && <p role="alert" className="mt-3 text-[13px] text-red-300">{reportError}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setReportOpen(false)} className="rounded-full px-4 py-2 text-[13px] text-white/70">Cancelar</button><button type="button" disabled={reportReasons.length === 0 || reporting} onClick={() => void sendReport()} className="rounded-full bg-red-500 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{reporting ? "Enviando..." : "Enviar denúncia"}</button></div></div></div>}
    </article>
  );
}

export default function ProfilePage() {
  const { user, status, refresh, decrementCloudCount } = useSessionUser();
  const [editing, setEditing] = useState(false);
  const [clouds, setClouds] = useState<ProfileCloud[]>([]);
  const [cloudFilter, setCloudFilter] = useState<"all" | "active" | "scheduled" | "ended">("all");
  const [cloudsLoading, setCloudsLoading] = useState(true);
  const [cloudToDelete, setCloudToDelete] = useState<ProfileCloud | null>(null);
  const [queueCloud, setQueueCloud] = useState<ProfileCloud | null>(null);
  const [deletingCloud, setDeletingCloud] = useState(false);
  const [deleteCloudError, setDeleteCloudError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState({
    name: "",
    bio: "",
    location: "",
    avatarUrl: "" as string | null,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [followersList, setFollowersList] = useState<FollowListUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowListUser[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [hypesModalOpen, setHypesModalOpen] = useState(false);
  const [hypesList, setHypesList] = useState<FollowListUser[]>([]);
  const [loadingHypes, setLoadingHypes] = useState(false);
  const [actioningUserId, setActioningUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    setDraft({
      name: user.displayName || user.name || "",
      bio: user.bio ?? "",
      location: user.location ?? "",
      avatarUrl: user.avatarUrl,
    });
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadClouds = async (showLoading = true) => {
      if (showLoading) setCloudsLoading(true);

      try {
        const response = await fetch("/api/clouds/mine", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null) as { ok?: boolean; clouds?: ProfileCloud[] } | null;

        if (!cancelled) {
          setClouds(response.ok && Array.isArray(payload?.clouds) ? payload.clouds : []);
        }
      } catch {
        if (!cancelled) {
          setClouds([]);
        }
      } finally {
        if (!cancelled && showLoading) {
          setCloudsLoading(false);
        }
      }
    };

    void loadClouds();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadFollowList = async (
    kind: "followers" | "following",
  ) => {
    if (!user) {
      return;
    }

    const setLoading = kind === "followers" ? setLoadingFollowers : setLoadingFollowing;
    const setList = kind === "followers" ? setFollowersList : setFollowingList;

    setLoading(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.username)}/${kind}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; users?: FollowListUser[] } | null;

      if (response.ok && payload?.ok && Array.isArray(payload.users)) {
        setList(payload.users);
      } else {
        setList([]);
      }
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const openFollowersModal = () => {
    setFollowersModalOpen(true);
    void loadFollowList("followers");
  };

  const openFollowingModal = () => {
    setFollowingModalOpen(true);
    void loadFollowList("following");
  };

  const openHypesModal = async () => {
    if (!user) return;
    setHypesModalOpen(true);
    setLoadingHypes(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.username)}/hypes`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { ok?: boolean; users?: FollowListUser[] } | null;
      setHypesList(response.ok && payload?.ok && Array.isArray(payload.users) ? payload.users : []);
    } finally { setLoadingHypes(false); }
  };

  const deleteCloud = async () => {
    if (!cloudToDelete) return;
    setDeletingCloud(true);
    setDeleteCloudError("");
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudToDelete.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível excluir a cloud.");
      setClouds((current) => current.filter((cloud) => cloud.id !== cloudToDelete.id));
      decrementCloudCount();
      setCloudToDelete(null);
      void refresh();
    } catch (error) {
      setDeleteCloudError(error instanceof Error ? error.message : "Não foi possível excluir a cloud.");
    } finally {
      setDeletingCloud(false);
    }
  };

  const removeFollower = async (listedUser: FollowListUser) => {
    if (!user) return;
    setActioningUserId(listedUser.id);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.username)}/followers/${encodeURIComponent(listedUser.id)}`, { method: "DELETE" });
      if (!response.ok) return;
      setFollowersList((current) => current.filter((item) => item.id !== listedUser.id));
      await refresh();
    } finally { setActioningUserId(null); }
  };

  const unfollowUser = async (listedUser: FollowListUser) => {
    setActioningUserId(listedUser.id);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(listedUser.username)}/follow`, { method: "DELETE" });
      if (!response.ok) return;
      setFollowingList((current) => current.filter((item) => item.id !== listedUser.id));
      await refresh();
    } finally { setActioningUserId(null); }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setProfileError("Escolha uma imagem para a foto de perfil.");
      return;
    }
    if (file.size > 10_000_000) {
      setProfileError("A foto deve ter no máximo 10 MB.");
      return;
    }
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(URL.createObjectURL(file));
    setProfileError(null);
  };
  const closeCropper = () => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  };
  const confirmCrop = (avatarUrl: string) => {
    setDraft((current) => ({ ...current, avatarUrl }));
    closeCropper();
  };

  const saveProfile = async () => {
    const location = draft.location.trim();
    if (location && !hasCountryAndCity(location)) {
      setProfileError("Informe a região no formato País, cidade.");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);

    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: draft.name.trim(),
          bio: draft.bio.trim(),
          location,
          avatarUrl: draft.avatarUrl,
        }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) {
        setProfileError(payload?.message || "Não foi possível salvar o perfil.");
        return;
      }
      await refresh();
      setEditing(false);
    } catch {
      setProfileError("Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  };

  const displayName = getSessionUserDisplayName(user);
  const handle = getSessionUserHandle(user);
  const initials = displayName.charAt(0).toUpperCase();
  const followers = user?.followersCount ?? 0;
  const following = user?.followingCount ?? 0;
  const cloudsCount = user?.cloudsCount ?? 0;
  const filteredClouds = useMemo(() => clouds.filter((cloud) => {
    const scheduled = Boolean(cloud.scheduledAt && new Date(cloud.scheduledAt).getTime() > now);
    return cloudFilter === "all" || (cloudFilter === "scheduled" && scheduled) || (cloudFilter === "ended" && cloud.status === "ended") || (cloudFilter === "active" && cloud.status === "active" && !scheduled);
  }), [cloudFilter, clouds, now]);
  const emptyCloudMessage = {
    all: "Você ainda não publicou nenhuma Cloud.",
    active: "Não há Clouds ativas no momento.",
    scheduled: "Não há Clouds agendadas.",
    ended: "Não há Clouds encerradas.",
  }[cloudFilter];
  const hypesCount = user?.hypesCount ?? 0;
  const memberSince = formatMemberSince(user?.createdAt);
  const region = user?.location || "Sem região informada";
  const bio = user?.bio?.trim() || "Nenhuma bio cadastrada ainda.";
  const loading = status === "loading" || !user;

  if (loading) {
    return (
      <div className="min-h-screen text-white"
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
        <div className="sticky top-0 z-30 flex items-center justify-between bg-transparent px-5 py-4">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <BackIcon s={20} />
          </Link>
          <div className="flex items-center gap-3">
            <NotificationsBell buttonClassName="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10" />
            <Link href="/settings" aria-label="Configurações" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
              <GearIcon s={20} />
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[680px] px-5 pb-32 pt-10">
          <div className="rounded-2xl border border-white/[0.06] bg-[#120a2e] p-8 text-center text-white/55">
            Loading your profile...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-transparent px-5 py-4">
        <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
          <BackIcon s={20} />
        </Link>
        <div className="flex items-center gap-4">
          {/* <SessionUserLink showLabel className="hidden sm:inline-flex" /> */}
          <NotificationsBell buttonClassName="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10" />
          <Link href="/settings" aria-label="Configurações" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <GearIcon s={20} />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[680px] px-6 pb-32 sm:px-5 md:pb-32">
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="relative">
            <ProfileAvatarViewer avatarUrl={user?.avatarUrl} name={displayName}><SessionUserAvatar user={user} size={80} className="ring-4 ring-[#9333EA]/40 sm:h-24 sm:w-24" /></ProfileAvatarViewer>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Editar perfil"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#9333EA] text-white transition hover:bg-[#6D28D9]"
            >
              <PencilIcon />
            </button>
          </div>

          <h1 className="mt-4 text-[26px] font-extrabold tracking-tight text-white">{displayName}</h1>
          <p className="text-[13px] text-white/40">{handle}</p>
          <p className="mt-3 max-w-[380px] text-[14px] leading-relaxed text-white/60">{bio}</p>

          <div className="mt-5 flex max-w-full items-center gap-3 text-center sm:gap-6">
            <button type="button" onClick={openFollowersModal} className="transition hover:opacity-80">
              <p className="text-[20px] font-bold text-white">{followers}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Seguidores</p>
            </button>
            <div className="h-8 w-px bg-white/10" />
            <button type="button" onClick={openFollowingModal} className="transition hover:opacity-80">
              <p className="text-[20px] font-bold text-white">{following}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Seguindo</p>
            </button>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-[20px] font-bold text-white">{cloudsCount}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Clouds</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <LongPressHint hint="Total de hypes recebidos em suas Clouds. Você pode ocultar essa informação do seu perfil nas configurações">
            <button type="button" onClick={openHypesModal} className="group relative transition hover:opacity-80">
              <p className="text-[20px] font-bold text-white">{hypesCount}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Hypes</p>
              <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-48 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a0e3d] px-2 py-1.5 text-center text-[11px] leading-snug text-white/80 opacity-0 shadow-xl transition group-hover:opacity-100">Total de hypes recebidos em suas Clouds. Você pode ocultar essa informação do seu perfil nas configurações</span>
            </button>
            </LongPressHint>
          </div>

          <div className="mt-4 flex items-center gap-3 text-[13px] text-white">
            <span>{region}</span>
            <span>·</span>
            <span>Desde {memberSince}</span>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-none sm:justify-center">{([['all', 'Todas'], ['active', 'Ativas'], ['scheduled', 'Agendadas'], ['ended', 'Encerradas']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setCloudFilter(value)} className={`shrink-0 rounded-full border px-4 py-2 text-[12px] font-semibold transition ${cloudFilter === value ? 'border-[#A855F7] bg-[#7C3AED] text-white' : 'border-[#8B5CF6]/35 bg-transparent text-white/55 hover:text-white'}`}>{label}</button>)}</div>
          {cloudsLoading ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#120a2e] p-6 text-center text-[13px] text-white/45">
              Carregando suas clouds...
            </div>
          ) : filteredClouds.length > 0 ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              {filteredClouds.map((cloud) => (
                <ProfileCloudCard key={cloud.id} cloud={cloud} now={now} viewerId={user?.id} authorAvatarUrl={user?.avatarUrl} onReminderActivated={setQueueCloud} onDelete={(endedCloud) => { setDeleteCloudError(""); setCloudToDelete(endedCloud); }} />
              ))}
            </div>
          ) : (
            <div className="min-h-48 px-4 py-12 text-center"><p className="text-[15px] font-medium text-white">{emptyCloudMessage}</p>{user && (cloudFilter === "scheduled" ? <Link href="/?create=1&schedule=1" className="mt-5 inline-flex rounded-full bg-[#9333EA] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED]">Agende uma cloud</Link> : <Link href="/?create=1" className="mt-5 inline-flex rounded-full bg-[#9333EA] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED]">Crie uma cloud</Link>)}</div>
          )}
        </div>
      </div>

      {queueCloud && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-5" role="dialog" aria-modal="true" aria-labelledby="queue-cloud-title"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171821] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="mb-2 inline-flex rounded-full bg-[#9333EA]/20 p-2 text-[#D8B4FE]"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></div><h2 id="queue-cloud-title" className="text-lg font-bold text-white">Você entrou na fila</h2><p className="mt-1 text-sm leading-relaxed text-white/65">Você será notificado quando “{queueCloud.title}” estrear.</p></div><button type="button" onClick={() => setQueueCloud(null)} aria-label="Fechar" className="text-xl text-white/50">×</button></div><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-white/45">Participantes aguardando</p><div className="mt-3 max-h-48 space-y-2 overflow-y-auto">{[...(queueCloud.participantProfiles ?? []), ...(user?.id && !queueCloud.participantProfiles?.some((participant) => participant.id === user.id) ? [{ id: user.id, name: user.displayName, username: user.username, avatarUrl: user.avatarUrl }] : [])].map((participant) => <div key={participant.id} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#9333EA] text-xs font-bold">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" className="h-full w-full object-cover" /> : participant.name.slice(0, 1)}</span><span className="text-sm font-medium text-white">{participant.name}</span></div>)}</div></div><button type="button" onClick={() => setQueueCloud(null)} className="mt-5 w-full rounded-full bg-[#9333EA] py-2.5 text-sm font-semibold text-white">Entendi</button></div></div>}

      {cloudToDelete && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-cloud-title">
          <div className="box-border max-h-[calc(100dvh-3rem)] max-w-sm overflow-y-auto rounded-3xl border border-white/10 bg-[#15161C] p-5 shadow-2xl sm:p-6" style={{ width: "calc(100vw - 48px)" }}>
            <h2 id="delete-cloud-title" className="text-[18px] font-bold text-white">Excluir Cloud?</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-white/60">“{cloudToDelete.title}” será removida da plataforma, não ficará mais disponível em Read e também será removida permanentemente do seu perfil.</p>
            {deleteCloudError && <p role="alert" className="mt-3 text-[13px] text-red-300">{deleteCloudError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={deletingCloud} onClick={() => setCloudToDelete(null)} className="rounded-full px-4 py-2 text-[13px] font-semibold text-white/65 transition hover:text-white">Cancelar</button>
              <button type="button" disabled={deletingCloud} onClick={() => void deleteCloud()} className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-50">{deletingCloud ? "Excluindo..." : "Excluir"}</button>
            </div>
          </div>
        </div>
      , document.body)}

      {followersModalOpen && (
        <FollowListModal
          title="Seguidores"
          emptyMessage="Nenhum seguidor ainda"
          loading={loadingFollowers}
          users={followersList}
          onClose={() => setFollowersModalOpen(false)}
          actionLabel="Remover seguidor"
          onAction={removeFollower}
          actioningId={actioningUserId}
        />
      )}

      {followingModalOpen && (
        <FollowListModal
          title="Seguindo"
          emptyMessage="Não seguindo ninguém ainda"
          loading={loadingFollowing}
          users={followingList}
          onClose={() => setFollowingModalOpen(false)}
          actionLabel="Deixar de seguir"
          onAction={unfollowUser}
          actioningId={actioningUserId}
        />
      )}

      {hypesModalOpen && <FollowListModal title="Hypes recebidos" hint="Total de hypes recebidos em suas Clouds. Você pode ocultar essa informação do seu perfil nas configurações" emptyMessage="Nenhum hype recebido ainda" loading={loadingHypes} users={hypesList} onClose={() => setHypesModalOpen(false)} showHypes />}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[520px] rounded-t-3xl border border-white/[0.06] bg-[#1a0e3d] p-6 sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17px] font-bold">Edit profile</h3>
              <button onClick={() => { closeCropper(); setEditing(false); }} className="text-white/40 transition hover:text-white">
                <XIcon />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <Field label="Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} placeholder="Your name" />
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Bio</label>
                <textarea
                  value={draft.bio}
                  onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#22124a] px-4 py-3 text-[14px] text-white outline-none transition focus:border-[#9333EA]"
                />
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Região</p>
                <p className="mt-1 text-[14px] text-white/75">{draft.location || "Não definida"}</p>
                <p className="mt-1 text-[12px] text-white/45">A cidade é definida pela localização nativa do dispositivo.</p>
                <Link href="/settings?section=perfil" className="mt-2 inline-block text-[12px] font-semibold text-[#C084FC] hover:text-white">Definir localização nas configurações</Link>
              </div>
              <input ref={photoInputRef} id="profile-avatar-input" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handlePhotoChange} />
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] text-lg font-bold text-white">
                  {draft.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.avatarUrl} alt="Prévia da foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    draft.name.trim().charAt(0).toUpperCase() || "?"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white">Foto de perfil</p>
                  <p className="mt-0.5 text-[12px] text-white/50">JPG, PNG ou WebP de até 10 MB.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label htmlFor="profile-avatar-input" className="cursor-pointer rounded-full border border-white/15 px-3 py-2 text-[12px] font-semibold text-white/80 transition hover:border-[#A855F7] hover:text-white">Alterar</label>
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="rounded-full bg-[#9333EA] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingProfile ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
              {profileError && <p className="text-[13px] text-red-300" role="alert">{profileError}</p>}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { closeCropper(); setEditing(false); }}
                className="flex-1 rounded-full border border-white/10 py-3 text-[14px] font-semibold text-white/70 transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="flex-1 rounded-full bg-[#9333EA] py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? "Salvando..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ProfilePhotoCropper source={cropSource} onCancel={closeCropper} onConfirm={confirmCrop} />
      <MobileAppNav active="profile" />
    </div>
  );
}


