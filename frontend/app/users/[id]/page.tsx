"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ─── Icons ────────────────────────────────────────────────────────────────────

function FireIcon({ s = 20, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 1C9.5 5.5 7 8.5 7 12.5c0 5 4 9 5 9s5-4 5-9c0-2-.5-3.5-1.5-5 .3 1.5.2 2.5-.5 3.5C14.5 9 13.5 5.5 12 1Z" />
      <path d="M12 1C10 5 8 8 8 12c0 4.5 3.5 8.5 4 9-.5-1.5-1-3-1-5 0-2 .8-4 1.5-5.5C13 12.5 13 14 12.5 16c1.5-1.5 3-3.5 3-6 0-2-.5-3.5-1-5C15 6.5 15 7.5 14.5 8.5 14 5 13 2.5 12 1Z" />
      <path opacity="0.4" d="M12 7.5c.5 1.5 1 3 1 4.5 0 2.5-1 4.5-1 5-.5-1-1-2.5-1-5 0-1.5.5-3 1-4.5Z" />
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
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

// ─── Types & seed data ────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  color: string;
  followers: number;
  following: number;
  hypes: number;
  region: string;
  memberSince: string;
  activeCloud?: {
    id: string;
    title: string;
    category: string;
    categoryColor: string;
    participants: number;
    timeLeft: string;
  };
};

const SEEDED: Record<string, User> = {
  joao: {
    id: "joao", name: "João Silva", handle: "@joaosilva",
    bio: "Apaixonado por clouds e meetups. Sempre online quando tem debate de tecnologia.",
    color: "#8B5CF6", followers: 240, following: 80, hypes: 120,
    region: "Sudeste", memberSince: "Fev 2025",
    activeCloud: { id: "ia-e-programadores", title: "IA vai substituir programadores?", category: "Tech", categoryColor: "#06B6D4", participants: 47, timeLeft: "12:08" },
  },
  ana: {
    id: "ana", name: "Ana Costa", handle: "@anacosta",
    bio: "Criadora de conteúdo áudio. Amo conversas que somem antes do amanhecer.",
    color: "#3B82F6", followers: 180, following: 40, hypes: 90,
    region: "Nordeste", memberSince: "Mar 2025",
  },
  pedro: {
    id: "pedro", name: "Pedro Lima", handle: "@pedrolima",
    bio: "Designer e curioso. Cada cloud é uma nova perspectiva.",
    color: "#22C55E", followers: 90, following: 120, hypes: 20,
    region: "Sul", memberSince: "Abr 2025",
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const FOLLOWING_KEY = "cloudscommunity:following";

function loadFollowing(): string[] {
  try { return JSON.parse(localStorage.getItem(FOLLOWING_KEY) ?? "[]"); } catch { return []; }
}

function saveFollowing(ids: string[]) {
  try { localStorage.setItem(FOLLOWING_KEY, JSON.stringify(ids)); } catch {}
}

export default function UserProfile() {
  const params = useParams();
  const rawId = params?.id ?? "unknown";
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const fallback: User = { id, name: id, handle: `@${id}`, bio: "", color: "#6B7280", followers: 0, following: 0, hypes: 0, region: "", memberSince: "" };
  const [user, setUser] = useState<User>(SEEDED[id] ?? fallback);
  const [followed, setFollowed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setUser(SEEDED[id] ?? fallback);
    setFollowed(loadFollowing().includes(id));
    setShareOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function doFollow() {
    const next = !followed;
    setFollowed(next);
    setUser(u => ({ ...u, followers: u.followers + (next ? 1 : -1) }));
    const list = loadFollowing();
    const updated = next ? [...list.filter(x => x !== id), id] : list.filter(x => x !== id);
    saveFollowing(updated);
  }

  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/users/${id}` : `/users/${id}`;
  const waText = encodeURIComponent(`Veja o perfil de ${user.name} no Clouds Community: ${profileUrl}`);
  const messagesHref = `/messages?share=profile&id=${id}&name=${encodeURIComponent(user.name)}`;
  const initials = user.name.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#09090B] text-white">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#09090B]/90 px-5 py-3 backdrop-blur-md">
        <Link href="/meet" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
          <BackIcon />
        </Link>
        <span className="text-[14px] font-semibold text-white truncate max-w-[200px]">{user.name}</span>
        <button
          type="button"
          aria-label="Compartilhar perfil"
          onClick={() => setShareOpen(o => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10"
        >
          <ShareIcon />
        </button>
      </div>

      {/* Share sheet */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShareOpen(false)}>
          <div className="w-full max-w-[480px] rounded-t-3xl border border-white/[0.08] bg-[#1C1F2E] p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <p className="mb-4 text-[13px] font-semibold text-white/50">Compartilhar perfil de {user.name}</p>
            <div className="flex flex-col gap-2">
              <a
                href={messagesHref}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111116] px-4 py-3.5 text-[14px] font-medium text-white transition hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED]/20 text-[#A78BFA]"><MessageIcon /></span>
                Enviar pelo Messages
              </a>
              <a
                href={`https://wa.me/?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111116] px-4 py-3.5 text-[14px] font-medium text-white transition hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#22C55E]/20 text-[#22C55E]"><WhatsAppIcon /></span>
                Compartilhar via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[680px] px-5 pb-32">

        {/* ── Hero ── */}
        <div className="mt-10 flex flex-col items-center text-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-[32px] font-bold text-white ring-4 ring-white/10"
            style={{ backgroundColor: user.color }}
          >
            {initials}
          </div>

          <h1 className="mt-4 text-[26px] font-extrabold tracking-tight">{user.name}</h1>
          <p className="text-[13px] text-white/40">{user.handle}</p>
          {user.bio && <p className="mt-3 max-w-[380px] text-[14px] leading-relaxed text-white/60">{user.bio}</p>}

          {/* Stats */}
          <div className="mt-5 flex items-center gap-6">
            <div>
              <p className="text-[20px] font-bold">{user.followers}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Seguidores</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-[20px] font-bold">{user.following}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Seguindo</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col items-center">
              <p className="flex items-center gap-1 text-[20px] font-bold text-[#F97316]">
                <FireIcon s={18} />{user.hypes}
              </p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Hypes</p>
            </div>
          </div>

          {user.region && (
            <div className="mt-3 flex items-center gap-3 text-[12px] text-white/30">
              <span>{user.region}</span>
              {user.memberSince && <><span>·</span><span>Desde {user.memberSince}</span></>}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={doFollow}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-semibold transition ${
                followed
                  ? "border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10"
                  : "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
              }`}
            >
              {followed && <CheckIcon />}
              {followed ? "Seguindo" : "Seguir"}
            </button>

            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-2.5 text-[14px] font-semibold text-white/70 transition hover:bg-white/10"
            >
              <ShareIcon />
              Compartilhar
            </button>
          </div>
        </div>

        {/* ── Cloud ativa ── */}
        {user.activeCloud && (
          <div className="mt-10">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Cloud ativa agora</p>
            <div className="relative overflow-hidden rounded-2xl border border-[#22C55E]/20 bg-[#0D150F] p-5">
              <div className="pointer-events-none absolute -top-10 left-1/2 h-28 w-56 -translate-x-1/2 rounded-full bg-[#22C55E]/10 blur-3xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#22C55E]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                    </span>
                    AO VIVO · {user.activeCloud.timeLeft}
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: user.activeCloud.categoryColor + "25", color: user.activeCloud.categoryColor }}>
                    {user.activeCloud.category}
                  </span>
                </div>
                <h2 className="mt-2 text-[16px] font-semibold leading-snug text-white">{user.activeCloud.title}</h2>
                <p className="mt-1 text-[12px] text-white/40">{user.activeCloud.participants} pessoas online</p>
                <div className="mt-4">
                  <Link href={`/cloud/${user.activeCloud.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-[#22C55E]/15 px-4 py-2 text-[13px] font-semibold text-[#22C55E] transition hover:bg-[#22C55E]/25">
                    Entrar na Cloud
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Activity strip ── */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { label: "Clouds criadas", value: Math.max(1, Math.floor(user.hypes / 10)).toString() },
            { label: "Hypes totais", value: user.hypes.toString() },
            { label: "Seguidores", value: user.followers.toString() },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-[#111116] p-4 text-center">
              <p className="text-[22px] font-bold text-white">{item.value}</p>
              <p className="mt-1 text-[11px] text-white/40">{item.label}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
