"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSessionUser } from "../../components/session-user";
import { FlameIcon } from "../../components/FlameIcon";
import { NotificationsBell } from "../../components/NotificationsPanel";
import { ForwardToContactModal, type ForwardContact } from "../../components/ForwardToContactModal";

type FollowListUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
  hypesCount?: number;
};

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
  isFollowRequested?: boolean;
  isSelf: boolean;
  profileUrl: string;
  activeClouds: Array<{
    id: string;
    title: string;
    description: string | null;
    duration: string;
    createdAt: string;
    visibility: "public" | "private";
    href: string;
  }>;
};

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18 8 12l7-6" />
    </svg>
  );
}

function FireIcon({ s = 20 }: { s?: number }) {
  return <FlameIcon s={s} />;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
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

function FieldStat({ value, label, description, onClick }: { value: string | number; label: string; description: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`group relative ${onClick ? "cursor-pointer hover:opacity-80 transition" : ""}`}>
      <p className="text-[20px] font-bold text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-widest text-white/40">{label}</p>
      <p role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-40 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1a0e3d] px-2 py-1.5 text-center text-[11px] leading-snug text-white/80 opacity-0 shadow-xl transition group-hover:opacity-100">{description}</p>
    </div>
  );
}

function ProfileListRow({ user, actionLabel, onAction, actioning }: { user: FollowListUser; actionLabel?: string; onAction?: () => void; actioning?: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-white/5">
    <Link href={`/users/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] font-bold text-white">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : user.displayName.charAt(0).toUpperCase()}</div>
      <div className="min-w-0"><p className="truncate font-semibold text-white">{user.displayName}</p><p className="truncate text-sm text-white/50">@{user.username}</p></div>
    </Link>
    {user.hypesCount !== undefined && <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center text-[#FF7A18]"><FlameIcon s={22} filled /><span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[9px] font-extrabold leading-none text-white">{user.hypesCount}</span></span>}
    {actionLabel && onAction && <button type="button" disabled={actioning} onClick={onAction} className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition hover:border-red-400/60 hover:text-red-300 disabled:opacity-50">{actioning ? "..." : actionLabel}</button>}
  </div>;
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

function parseDurationSeconds(duration: string) {
  const map: Record<string, number> = {
    "10min": 10 * 60,
    "30min": 30 * 60,
    "2h": 2 * 60 * 60,
    "5h": 5 * 60 * 60,
    "24h": 24 * 60 * 60,
  };

  return map[duration] ?? 30 * 60;
}

function ActiveCloudCard({ cloud, now }: { cloud: PublicUserProfile["activeClouds"][number]; now: number }) {
  const remainingSeconds = Math.max(parseDurationSeconds(cloud.duration) - Math.floor((now - new Date(cloud.createdAt).getTime()) / 1000), 0);
  const live = remainingSeconds > 0;

  return (
    <article className="block w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-[#A855F7]/30 bg-[#1a0a3d] p-6 transition hover:border-[#A855F7]/50 hover:bg-[#22104f]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {cloud.duration}
        </span>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${live ? "bg-[#9333EA]/12 text-[#D8B4FE]" : "bg-white/[0.05] text-white/45"}`}>
          {live ? "Ao vivo" : "Encerrada"}
        </span>
      </div>

      <h3 className="mt-4 break-words text-[18px] font-semibold leading-snug text-white" style={{ fontFamily: 'Arial, sans-serif' }}>{cloud.title}</h3>
      {cloud.description && (
        <p className="mt-2 line-clamp-2 break-words text-[13px] leading-relaxed text-white/55">
          {cloud.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-white/35">
        <span>{live ? "Encerra em" : "Encerrada"}</span>
        <span className={`rounded-full px-2.5 py-1 font-semibold ${live ? "bg-[#9333EA]/12 text-[#D8B4FE]" : "bg-white/[0.05] text-white/45"}`}>
          {formatCountdown(remainingSeconds)}
        </span>
      </div>
      <Link href={cloud.href} className="mt-5 inline-flex items-center justify-center rounded-full bg-[#7C3AED] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#6D28D9]">
        Acessar cloud
      </Link>
    </article>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const { user: sessionUser } = useSessionUser();
  const rawIdentifier = params?.id ?? "";
  const identifier = Array.isArray(rawIdentifier) ? rawIdentifier[0] : rawIdentifier;

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [contacts, setContacts] = useState<ForwardContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${encodeURIComponent(identifier)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as { ok?: boolean; user?: PublicUserProfile; message?: string } | null;

        if (!cancelled) {
          if (response.ok && payload?.user) {
            setProfile(payload.user);
          } else {
            setProfile(null);
            setError(payload?.message ?? "Perfil não encontrado.");
          }
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setError("Não foi possível carregar o perfil.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [identifier]);

  useEffect(() => {
    const refreshStats = () => fetch(`/api/users/${encodeURIComponent(identifier)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { user?: PublicUserProfile }) => {
        if (payload.user) setProfile((current) => current ? { ...current, ...payload.user } : payload.user ?? null);
      })
      .catch(() => {});
    const interval = window.setInterval(refreshStats, 10_000);
    return () => window.clearInterval(interval);
  }, [identifier]);

  useEffect(() => {
    if (!forwardOpen) return;
    const controller = new AbortController();
    fetch("/api/users/following", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { users?: ForwardContact[] }) => setContacts((payload.users ?? []).filter((contact) => contact.id !== sessionUser?.id)))
      .catch(() => setContacts([]))
      .finally(() => setLoadingContacts(false));
    return () => controller.abort();
  }, [forwardOpen, sessionUser?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const profileUrl = useMemo(() => {
    if (!profile) {
      return "";
    }

    if (typeof window === "undefined") {
      return `/users/${profile.username}`;
    }

    return `${window.location.origin}/users/${profile.username}`;
  }, [profile]);

  const toggleFollow = async () => {
    if (!profile || profile.isSelf || mutating) {
      return;
    }

    setMutating(true);

    try {
      const response = await fetch(`/api/follow/${encodeURIComponent(profile.username)}`, {
        method: profile.isFollowing || profile.isFollowRequested ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; user?: PublicUserProfile; message?: string } | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.message ?? "Não foi possível atualizar o follow.");
      }

      setProfile(payload.user);
    } catch {
      // keep current state
    } finally {
      setMutating(false);
    }
  };

  const loadFollowers = async () => {
    if (!profile) return;
    
    setLoadingFollowers(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(profile.username)}/followers`);
      const payload = await response.json();
      if (payload.ok && payload.users) {
        setFollowersList(payload.users);
      }
    } catch (error) {
      console.error("Failed to load followers:", error);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const loadFollowing = async () => {
    if (!profile) return;
    
    setLoadingFollowing(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(profile.username)}/following`);
      const payload = await response.json();
      if (payload.ok && payload.users) {
        setFollowingList(payload.users);
      }
    } catch (error) {
      console.error("Failed to load following:", error);
    } finally {
      setLoadingFollowing(false);
    }
  };

  const openFollowersModal = () => {
    setFollowersModalOpen(true);
    loadFollowers();
  };

  const openFollowingModal = () => {
    setFollowingModalOpen(true);
    loadFollowing();
  };

  const openHypesModal = async () => {
    if (!profile) return;
    setHypesModalOpen(true);
    setLoadingHypes(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(profile.username)}/hypes`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { ok?: boolean; users?: FollowListUser[] } | null;
      setHypesList(response.ok && payload?.ok && Array.isArray(payload.users) ? payload.users : []);
    } finally { setLoadingHypes(false); }
  };

  const removeFollower = async (listedUser: FollowListUser) => {
    if (!profile) return;
    setActioningUserId(listedUser.id);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(profile.username)}/followers/${encodeURIComponent(listedUser.id)}`, { method: "DELETE" });
      if (!response.ok) return;
      setFollowersList((current) => current.filter((item) => item.id !== listedUser.id));
      setProfile((current) => current ? { ...current, followersCount: Math.max(0, current.followersCount - 1) } : current);
    } finally { setActioningUserId(null); }
  };

  const unfollowListedUser = async (listedUser: FollowListUser) => {
    setActioningUserId(listedUser.id);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(listedUser.username)}/follow`, { method: "DELETE" });
      if (!response.ok) return;
      setFollowingList((current) => current.filter((item) => item.id !== listedUser.id));
      setProfile((current) => current ? { ...current, followingCount: Math.max(0, current.followingCount - 1) } : current);
    } finally { setActioningUserId(null); }
  };

  const displayName = profile?.displayName ?? profile?.name ?? "Perfil";
  const handle = profile ? `@${profile.username}` : "@perfil";
  const initials = displayName.trim().charAt(0).toUpperCase() || "C";
  const followers = profile?.followersCount ?? 0;
  const following = profile?.followingCount ?? 0;
  const cloudsCount = profile?.cloudsCount ?? 0;
  const hypesCount = profile?.hypesCount ?? 0;
  const memberSince = formatMemberSince(profile?.createdAt);
  const bio = profile?.bio?.trim() || "Nenhuma bio cadastrada ainda.";
  const isOwnProfile = Boolean(profile?.isSelf || sessionUser?.id === profile?.id);
  const activeClouds = profile?.activeClouds ?? [];

  const waText = profile
    ? encodeURIComponent(`Veja o perfil de ${displayName} no Clouds Community: ${profileUrl}`)
    : "";

  if (loading) {
    return (
      <div className="min-h-screen text-white"
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
        <div className="sticky top-0 z-30 flex items-center justify-between bg-transparent px-5 py-3">
          <Link href="/meet" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <BackIcon />
          </Link>
          <span className="text-[14px] font-semibold text-white">Profile</span>
          <NotificationsBell buttonClassName="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10" />
        </div>
        <div className="mx-auto max-w-[680px] px-5 pb-32 pt-10">
          <div className="rounded-2xl border border-white/[0.06] bg-[#111116] p-8 text-center text-white/55">
            Loading profile...
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen text-white"
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
        <div className="sticky top-0 z-30 flex items-center justify-between bg-transparent px-5 py-3">
          <Link href="/meet" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <BackIcon />
          </Link>
          <span className="text-[14px] font-semibold text-white">Profile</span>
        </div>
        <div className="mx-auto max-w-[680px] px-5 py-10">
          <div className="rounded-2xl border border-white/[0.06] bg-[#111116] p-8 text-center">
            <p className="text-[18px] font-semibold text-white">Profile unavailable</p>
            <p className="mt-2 text-[13px] text-white/45">{error ?? "Could not load profile."}</p>
            <Link href="/meet" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-4 py-2 text-[13px] font-semibold text-white">
              Back to Meet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-transparent px-5 py-3">
        <Link href="/meet" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
          <BackIcon />
        </Link>
          <span aria-hidden="true" />
        <div className="flex items-center gap-2">
          <NotificationsBell buttonClassName="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10" />
          <button
            type="button"
            aria-label="Compartilhar perfil"
            onClick={() => setShareOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10"
          >
            <ShareIcon />
          </button>
        </div>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShareOpen(false)}>
          <div className="w-full max-w-[480px] rounded-t-3xl border border-white/[0.08] bg-[#1C1F2E] p-5 pb-8" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <p className="mb-4 text-[13px] font-semibold text-white/50">Compartilhar perfil de {displayName}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setShareOpen(false); setLoadingContacts(true); setForwardOpen(true); }}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111116] px-4 py-3.5 text-[14px] font-medium text-white transition hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED]/20 text-[#A78BFA]"><MessageIcon /></span>
                Enviar pelo Messages
              </button>
              <a
                href={`https://wa.me/?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111116] px-4 py-3.5 text-[14px] font-medium text-white transition hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#22C55E]/20 text-[#22C55E]">
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                </span>
                Compartilhar via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {forwardOpen && profile && (
        <ForwardToContactModal title="Encaminhar perfil" preview={`Perfil de ${displayName}`} url={profileUrl} label={JSON.stringify({ type: "profile_share", name: displayName, avatarUrl: profile.avatarUrl })} contacts={contacts} loading={loadingContacts} onClose={() => setForwardOpen(false)} />
      )}

      <div className="mx-auto max-w-[680px] px-5 pb-32">
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#7C3AED] text-[32px] font-bold text-white ring-4 ring-white/10">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <h1 className="mt-4 text-[26px] font-extrabold tracking-tight">{displayName}</h1>
          <p className="text-[13px] text-white/40">{handle}</p>
          {bio && <p className="mt-3 max-w-[380px] text-[14px] leading-relaxed text-white/60">{bio}</p>}

          <div className="mt-5 flex items-center gap-6">
            <FieldStat value={followers} label="Followers" description="Pessoas que seguem este perfil." onClick={openFollowersModal} />
            <div className="h-8 w-px bg-white/10" />
            <FieldStat value={following} label="Following" description="Perfis que esta pessoa segue." onClick={openFollowingModal} />
            <div className="h-8 w-px bg-white/10" />
            <FieldStat value={cloudsCount} label="Clouds" description="Clouds publicadas por este perfil." />
            <div className="h-8 w-px bg-white/10" />
            <FieldStat value={hypesCount} label="Hypes" description="Total de hypes recebidos nas suas Clouds." onClick={openHypesModal} />
          </div>

          <div className="mt-3 flex items-center gap-3 text-[13px] text-white/30">
            {profile.location && <span>{profile.location}</span>}
            {profile.location && <span>·</span>}
            <span>Desde {memberSince}</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {isOwnProfile ? (
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]"
              >
                <EditIcon />
                Edit profile
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={mutating}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold transition ${
                    profile.isFollowing || profile.isFollowRequested
                      ? "border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10"
                      : "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                  } ${mutating ? "opacity-60" : ""}`}
                >
                  {profile.isFollowing && <CheckIcon />}
                  {mutating ? "..." : profile.isFollowing ? "Following" : profile.isFollowRequested ? "Solicitado" : "Follow"}
                </button>
                {(!profile.isPrivate || profile.isFollowing) && (
                  <Link
                    href={`/messages?id=${encodeURIComponent(profile.id)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-white/10"
                  >
                    <MessageIcon />
                    Mensagem
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="mt-10 w-full text-left">
            {activeClouds.length > 0 ? (
              <>
                <div className="grid gap-3">
                  {activeClouds.map((cloud) => (
                    <ActiveCloudCard key={cloud.id} cloud={cloud} now={now} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-[14px] text-white">
                Sem clouds ativas no momento
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Followers Modal */}
      {followersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setFollowersModalOpen(false)}>
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15161C] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Seguidores</h3>
              <button onClick={() => setFollowersModalOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-purple pr-1">
              {loadingFollowers ? (
                <p className="text-center text-white/50 py-4">Carregando...</p>
              ) : followersList.length === 0 ? (
                <p className="text-center text-white/50 py-4">Nenhum seguidor ainda</p>
              ) : (
                <div className="space-y-3">
                  {followersList.map((user) => <ProfileListRow key={user.id} user={user} actionLabel={isOwnProfile ? "Remover seguidor" : undefined} onAction={isOwnProfile ? () => removeFollower(user) : undefined} actioning={actioningUserId === user.id} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {followingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setFollowingModalOpen(false)}>
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15161C] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Seguindo</h3>
              <button onClick={() => setFollowingModalOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-purple pr-1">
              {loadingFollowing ? (
                <p className="text-center text-white/50 py-4">Carregando...</p>
              ) : followingList.length === 0 ? (
                <p className="text-center text-white/50 py-4">Não seguindo ninguém ainda</p>
              ) : (
                <div className="space-y-3">
                  {followingList.map((user) => <ProfileListRow key={user.id} user={user} actionLabel={isOwnProfile ? "Deixar de seguir" : undefined} onAction={isOwnProfile ? () => unfollowListedUser(user) : undefined} actioning={actioningUserId === user.id} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hypesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setHypesModalOpen(false)}>
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15161C] p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h3 className="text-[18px] font-bold">Hypes recebidos</h3><button type="button" onClick={() => setHypesModalOpen(false)} className="text-white/50 hover:text-white">×</button></div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-purple pr-1">{loadingHypes ? <p className="py-4 text-center text-white/50">Carregando...</p> : hypesList.length === 0 ? <p className="py-4 text-center text-white/50">Nenhum hype recebido ainda</p> : <div className="space-y-3">{hypesList.map((user) => <ProfileListRow key={user.id} user={user} />)}</div>}</div>
          </div>
        </div>
      )}
    </div>
  );
}
