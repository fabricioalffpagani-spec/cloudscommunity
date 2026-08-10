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

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  "5 min": 5 * 60,
  "10 min": 10 * 60,
  "30 min": 30 * 60,
  "1h": 60 * 60,
  "24h": 24 * 60 * 60,
};

function parseDurationSeconds(duration: string) {
  return DURATION_SECONDS[duration] ?? 5 * 60;
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
    <Link
      href={cloud.href}
      className="block w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#120a2e] p-6 transition hover:border-white/[0.14] hover:bg-[#16161c]"
    >
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

      <h3 className="mt-4 break-words text-[18px] font-semibold leading-snug text-white">{cloud.title}</h3>
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
    </Link>
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
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(60,15,160,0.70) 0%, rgba(18,6,55,0.98) 45%, #060410 100%)" }}>
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#060410]/90 px-5 py-3 backdrop-blur-md">
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <BackIcon />
          </Link>
          <span className="text-[14px] font-semibold text-white">Meu Perfil</span>
          <Link href="/settings" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <GearIcon />
          </Link>
        </div>
        <div className="mx-auto max-w-[680px] px-5 pb-32 pt-10">
          <div className="rounded-2xl border border-white/[0.06] bg-[#120a2e] p-8 text-center text-white/55">
            Carregando seu perfil...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(60,15,160,0.70) 0%, rgba(18,6,55,0.98) 45%, #060410 100%)" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-[#060410]/90 px-5 py-3 backdrop-blur-md">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
          <BackIcon />
        </Link>
        <span className="text-[14px] font-semibold text-white">Meu Perfil</span>
        <div className="flex items-center gap-3">
          {/* <SessionUserLink showLabel className="hidden sm:inline-flex" /> */}
          <Link href="/settings" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
            <GearIcon />
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
            <div>
              <p className="text-[20px] font-bold text-white">{followers}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Seguidores</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-[20px] font-bold text-white">{following}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Seguindo</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-[20px] font-bold text-white">{cloudsCount}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Clouds</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-[12px] text-white/30">
            <span>{region}</span>
            <span>·</span>
            <span>Desde {memberSince}</span>
          </div>
        </div>

        {(() => {
          const activeCloud = clouds.find((c) => {
            if (c.visibility !== "public") return false;
            const remaining = parseDurationSeconds(c.duration) - Math.floor((now - new Date(c.createdAt).getTime()) / 1000);
            return remaining > 0;
          }) ?? null;

          return activeCloud ? (
            <div className="mt-10">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Cloud Ativa</p>
              <Link
                href={activeCloud.href}
                className="block w-full overflow-hidden rounded-2xl border border-[#A855F7]/30 bg-[#1a0a3d] p-6 transition hover:border-[#A855F7]/60 hover:bg-[#1e0e45]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    {activeCloud.duration}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#A855F7]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D8B4FE]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#A855F7] animate-pulse" />
                    Ao vivo
                  </span>
                </div>
                <h3 className="mt-4 break-words text-[20px] font-bold leading-snug text-white">{activeCloud.title}</h3>
                {activeCloud.description && (
                  <p className="mt-2 line-clamp-2 break-words text-[13px] leading-relaxed text-white/55">
                    {activeCloud.description}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-white/35">
                  <span>Encerra em</span>
                  <span className="rounded-full bg-[#A855F7]/15 px-2.5 py-1 font-semibold text-[#D8B4FE]">
                    {formatCountdown(Math.max(parseDurationSeconds(activeCloud.duration) - Math.floor((now - new Date(activeCloud.createdAt).getTime()) / 1000), 0))}
                  </span>
                </div>
              </Link>
            </div>
          ) : null;
        })()}

        <div className="mt-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Minhas Clouds</p>
          {cloudsLoading ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#120a2e] p-6 text-center text-[13px] text-white/45">
              Carregando suas clouds...
            </div>
          ) : clouds.length > 0 ? (
            <div className="grid gap-3">
              {clouds.map((cloud) => (
                <ProfileCloudCard key={cloud.id} cloud={cloud} now={now} />
              ))}
            </div>
          ) : (
            <ProfileEmptyState />
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[520px] rounded-t-3xl border border-white/[0.06] bg-[#1a0e3d] p-6 sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17px] font-bold">Editar perfil</h3>
              <button onClick={() => setEditing(false)} className="text-white/40 transition hover:text-white">
                <XIcon />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <Field label="Nome" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} placeholder="Seu nome" />
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
                Foto de perfil em breve. Por enquanto, o avatar usa a primeira letra do seu nome.
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-full border border-white/10 py-3 text-[14px] font-semibold text-white/70 transition hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-full bg-[#9333EA] py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


