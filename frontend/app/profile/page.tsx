"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import {
  SessionUserAvatar,
  SessionUserLink,
  getSessionUserDisplayName,
  getSessionUserHandle,
  useSessionUser,
} from "../components/session-user";

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
};

function FollowListModal({
  title,
  emptyMessage,
  loading,
  users,
  onClose,
}: {
  title: string;
  emptyMessage: string;
  loading: boolean;
  users: FollowListUser[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a0e3d] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[18px] font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="text-white/50 transition hover:text-white" aria-label="Fechar">
            <XIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-4 text-center text-white/50">Carregando...</p>
          ) : users.length === 0 ? (
            <p className="py-4 text-center text-white/50">{emptyMessage}</p>
          ) : (
            <div className="space-y-3">
              {users.map((listedUser) => (
                <Link
                  key={listedUser.id}
                  href={`/users/${listedUser.username}`}
                  className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-white/5"
                  onClick={onClose}
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] font-bold text-white">
                    {listedUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listedUser.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      listedUser.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-white">{listedUser.displayName}</p>
                    <p className="text-sm text-white/50">@{listedUser.username}</p>
                  </div>
                </Link>
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
      <p className="text-[16px] font-semibold text-white">Nenhuma cloud ativa no momento</p>
      <p className="mt-2 text-[13px] text-white/45">Quando você entrar em uma cloud ao vivo, ela aparece aqui.</p>
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
  title: string;
  description: string | null;
  duration: string;
  visibility: "public" | "private";
  createdAt: string;
  href: string;
};

function ProfileCloudCard({ cloud, now }: { cloud: ProfileCloud; now: number }) {
  const createdAt = new Date(cloud.createdAt);
  const remainingSeconds = Math.max(parseDurationSeconds(cloud.duration) - Math.floor((now - createdAt.getTime()) / 1000), 0);
  const isLive = remainingSeconds > 0;
  const isPublic = cloud.visibility === "public";

  return (
    <article className="cloud-card w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-[#A855F7]/30 bg-[#1a0a3d] p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {cloud.duration}
        </span>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center rounded-full bg-[#A855F7]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D8B4FE]">
              Ao vivo
            </span>
          )}
          {!isLive && isPublic && (
            <span className="inline-flex items-center rounded-full bg-[#22C55E]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#86EFAC]">
              Pública
            </span>
          )}
          {!isLive && !isPublic && (
            <span className="inline-flex items-center rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Privada
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-4 break-words text-[18px] font-semibold leading-snug text-white" style={{ fontFamily: 'Arial, sans-serif' }}>{cloud.title}</h3>
      {cloud.description && (
        <p className="mt-2 line-clamp-2 break-words text-[13px] leading-relaxed text-white/55">
          {cloud.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-white/35">
        <span>{isLive ? "Encerra em" : isPublic ? "Criada em" : "Encerrada"}</span>
        <span className={`rounded-full px-2.5 py-1 font-semibold ${isLive ? "bg-[#A855F7]/12 text-[#D8B4FE]" : isPublic ? "bg-[#22C55E]/12 text-[#86EFAC]" : "bg-white/[0.05] text-white/45"}`}>
          {formatCountdown(remainingSeconds)}
        </span>
      </div>
      <Link href={cloud.href} className="mt-5 inline-flex rounded-full bg-[#A855F7] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#9333EA]">Participar da Cloud</Link>
    </article>
  );
}

export default function ProfilePage() {
  const { user, status, refresh } = useSessionUser();
  const [editing, setEditing] = useState(false);
  const [clouds, setClouds] = useState<ProfileCloud[]>([]);
  const [cloudsLoading, setCloudsLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState({
    name: "",
    bio: "",
    location: "",
  });
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [followersList, setFollowersList] = useState<FollowListUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowListUser[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setDraft({
      name: user.displayName || user.name || "",
      bio: user.bio ?? "",
      location: user.location ?? "",
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadClouds = async () => {
      setCloudsLoading(true);

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
        if (!cancelled) {
          setCloudsLoading(false);
        }
      }
    };

    void loadClouds();

    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const displayName = getSessionUserDisplayName(user);
  const handle = getSessionUserHandle(user);
  const initials = displayName.charAt(0).toUpperCase();
  const followers = user?.followersCount ?? 0;
  const following = user?.followingCount ?? 0;
  const cloudsCount = user?.cloudsCount ?? 0;
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
          <Link href="/settings" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <GearIcon s={20} />
          </Link>
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
          <Link href="/settings" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <GearIcon s={20} />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[680px] px-5 pb-32">
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="relative">
            <SessionUserAvatar user={user} size={96} className="ring-4 ring-[#9333EA]/40" />
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

          <div className="mt-5 flex items-center gap-6 text-center">
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
          </div>

          <div className="mt-4 flex items-center gap-3 text-[12px] text-white">
            <span>{region}</span>
            <span>·</span>
            <span>Desde {memberSince}</span>
          </div>
        </div>

        <div className="mt-10">
          {cloudsLoading ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#120a2e] p-6 text-center text-[13px] text-white/45">
              Carregando suas clouds...
            </div>
          ) : clouds.filter((cloud) => parseDurationSeconds(cloud.duration) - Math.floor((now - new Date(cloud.createdAt).getTime()) / 1000) > 0).length > 0 ? (
            <div className="grid gap-3">
              {clouds.filter((cloud) => parseDurationSeconds(cloud.duration) - Math.floor((now - new Date(cloud.createdAt).getTime()) / 1000) > 0).map((cloud) => (
                <ProfileCloudCard key={cloud.id} cloud={cloud} now={now} />
              ))}
            </div>
          ) : (
            <ProfileEmptyState />
          )}
        </div>
      </div>

      {followersModalOpen && (
        <FollowListModal
          title="Seguidores"
          emptyMessage="Nenhum seguidor ainda"
          loading={loadingFollowers}
          users={followersList}
          onClose={() => setFollowersModalOpen(false)}
        />
      )}

      {followingModalOpen && (
        <FollowListModal
          title="Seguindo"
          emptyMessage="Não seguindo ninguém ainda"
          loading={loadingFollowing}
          users={followingList}
          onClose={() => setFollowingModalOpen(false)}
        />
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[520px] rounded-t-3xl border border-white/[0.06] bg-[#1a0e3d] p-6 sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17px] font-bold">Edit profile</h3>
              <button onClick={() => setEditing(false)} className="text-white/40 transition hover:text-white">
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
              <Field
                label="Região"
                value={draft.location}
                onChange={(value) => setDraft({ ...draft, location: value })}
                placeholder="Sua região"
              />
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white/55">
                Profile photo coming soon. For now, the avatar uses the first letter of your name.
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-full border border-white/10 py-3 text-[14px] font-semibold text-white/70 transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-full bg-[#9333EA] py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


