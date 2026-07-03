"use client";

import { useState } from "react";
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
      <path d="M6 6l12 12" /><path d="M18 6 6 18" />
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    name: "Você",
    handle: "@voce",
    bio: "Apaixonado por conversas ao vivo e ideias que desaparecem.",
    avatarColor: "#8B5CF6",
    followers: 124,
    following: 58,
    hypes: 42,
    region: "Sudeste",
    memberSince: "Jun 2025",
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Simulated active cloud
  const activeCloud = {
    id: "design-de-produto",
    title: "Debate ao vivo sobre design de produto",
    category: "Tech",
    categoryColor: "#06B6D4",
    participants: 34,
    timeLeft: "18:42",
  };

  function save() {
    setProfile(draft);
    setEditing(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoUrl(URL.createObjectURL(f));
  }

  const initials = profile.name.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#09090B] text-white">

      {/* ── Sticky header bar ── */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#09090B]/90 px-5 py-3 backdrop-blur-md">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
          <BackIcon />
        </Link>
        <span className="text-[14px] font-semibold text-white">Meu Perfil</span>
        <Link href="/settings" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/10">
          <GearIcon />
        </Link>
      </div>

      <div className="mx-auto max-w-[680px] px-5 pb-32">

        {/* ── Hero: avatar + name ── */}
        <div className="mt-10 flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="relative">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-[32px] font-bold text-white ring-4 ring-[#7C3AED]/40"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {photoUrl
                ? <img src={photoUrl} alt="avatar" className="h-24 w-24 rounded-full object-cover" />
                : initials}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Editar perfil"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9]"
            >
              <PencilIcon />
            </button>
          </div>

          <h1 className="mt-4 text-[26px] font-extrabold tracking-tight text-white">{profile.name}</h1>
          <p className="text-[13px] text-white/40">{profile.handle}</p>
          <p className="mt-3 max-w-[380px] text-[14px] leading-relaxed text-white/60">{profile.bio}</p>

          {/* Stats row */}
          <div className="mt-5 flex items-center gap-6 text-center">
            <div>
              <p className="text-[20px] font-bold text-white">{profile.followers}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Seguidores</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-[20px] font-bold text-white">{profile.following}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Seguindo</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col items-center">
              <p className="flex items-center gap-1 text-[20px] font-bold text-[#F97316]">
                <FireIcon s={18} />
                {profile.hypes}
              </p>
              <p className="text-[11px] uppercase tracking-widest text-white/40">Hypes</p>
            </div>
          </div>

          {/* Region + member since */}
          <div className="mt-4 flex items-center gap-3 text-[12px] text-white/30">
            <span>{profile.region}</span>
            <span>·</span>
            <span>Desde {profile.memberSince}</span>
          </div>
        </div>

        {/* ── Cloud ativa ── */}
        <div className="mt-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Transmitindo agora</p>
          <div className="relative overflow-hidden rounded-2xl border border-[#22C55E]/20 bg-[#0D150F] p-5">
            {/* Glow */}
            <div className="pointer-events-none absolute -top-12 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-[#22C55E]/10 blur-3xl" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22C55E]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#22C55E]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                    </span>
                    AO VIVO · {activeCloud.timeLeft}
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: activeCloud.categoryColor + "30", color: activeCloud.categoryColor }}>
                    {activeCloud.category}
                  </span>
                </div>
                <h2 className="mt-2 text-[16px] font-semibold leading-snug text-white">{activeCloud.title}</h2>
                <p className="mt-1 text-[12px] text-white/40">{activeCloud.participants} pessoas online</p>
              </div>
            </div>

            <div className="mt-4">
              <Link
                href={`/cloud/${activeCloud.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#22C55E]/15 px-4 py-2 text-[13px] font-semibold text-[#22C55E] transition hover:bg-[#22C55E]/25"
              >
                Entrar na Cloud
              </Link>
            </div>
          </div>
        </div>

        {/* ── Activity strip ── */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { label: "Clouds criadas", value: "12" },
            { label: "Hypes dados", value: "89" },
            { label: "Rank Meet", value: "#24" },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-[#111116] p-4 text-center">
              <p className="text-[22px] font-bold text-white">{item.value}</p>
              <p className="mt-1 text-[11px] text-white/40">{item.label}</p>
            </div>
          ))}
        </div>

      </div>

      {/* ── Edit modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[520px] rounded-t-3xl border border-white/[0.06] bg-[#1C1F2E] p-6 sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17px] font-bold">Editar perfil</h3>
              <button onClick={() => setEditing(false)} className="text-white/40 hover:text-white transition"><XIcon /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/40">Nome</label>
                <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#252840] px-4 py-3 text-[14px] text-white outline-none focus:border-[#7C3AED] transition" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/40">Bio</label>
                <textarea value={draft.bio} onChange={e => setDraft({ ...draft, bio: e.target.value })} rows={3}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#252840] px-4 py-3 text-[14px] text-white outline-none focus:border-[#7C3AED] transition" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/40">Foto</label>
                <input type="file" accept="image/*" onChange={onFile}
                  className="w-full text-[13px] text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-white/[0.08] file:px-4 file:py-2 file:text-[12px] file:font-semibold file:text-white hover:file:bg-white/[0.12]" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-full border border-white/10 py-3 text-[14px] font-semibold text-white/70 transition hover:bg-white/5">Cancelar</button>
              <button onClick={save} className="flex-1 rounded-full bg-[#7C3AED] py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
