"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function Avatar({ initials, size = 96, color = "#8B5CF6" }: { initials: string; size?: number; color?: string }) {
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

export default function Page() {
  const [profile, setProfile] = useState({ id: "me", name: "Você", bio: "Olá! Este é meu perfil.", avatarColor: "#8B5CF6", followers: 124, following: 58, hypes: 42 });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [sharePresence, setSharePresence] = useState(true);

  const activeCloud = {
    title: "Debate ao vivo sobre design de produto",
    url: "/cloud/design-de-produto",
    visibility: "public" as const,
  };

  const participatingCloud = {
    title: "Oficina de voz criativa",
    url: "/cloud/oficina-de-voz",
  };

  useEffect(() => setDraft(profile), [profile]);

  function save() {
    setProfile(draft);
    setEditing(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoUrl(URL.createObjectURL(f));
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white p-6">
      <div className="mx-auto max-w-[900px] rounded-2xl bg-[#0D0D10] border border-white/[0.04] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <div>
              {photoUrl ? <img src={photoUrl} alt="avatar" className="h-24 w-24 rounded-full object-cover" /> : <Avatar initials={profile.name.slice(0,2).toUpperCase()} />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-[22px] font-extrabold">{profile.name}</h1>
                <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10">Voltar ao feed</Link>
              </div>
              <p className="mt-2 text-white/60 max-w-[680px]">{profile.bio}</p>
              <div className="mt-4 flex flex-wrap items-center gap-6 text-[13px] text-white/60">
                <div><strong className="text-white">{profile.followers}</strong> seguidores</div>
                <div><strong className="text-white">{profile.following}</strong> seguindo</div>
                <div><strong className="text-white">{profile.hypes}</strong> hypes</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/settings" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10">Configurações</Link>
            <button onClick={() => setEditing(true)} className="rounded-full bg-[#7C3AED] px-4 py-2 font-semibold">Editar perfil</button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/[0.06] bg-[#111116] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] uppercase tracking-[0.28em] text-[#A78BFA]">Cloud ativa</p>
                <h2 className="mt-3 text-[20px] font-semibold text-white">{activeCloud.title}</h2>
              </div>
              <span className="rounded-full bg-[#2563EB]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#93C5FD]">{activeCloud.visibility === "public" ? "Público" : "Privado"}</span>
            </div>
            <p className="mt-4 text-[14px] text-white/60">A Cloud que você está transmitindo agora. Usuários podem acessar quando a visibilidade estiver liberada.</p>
            <Link href={activeCloud.url} className="mt-5 inline-flex items-center rounded-full bg-[#7C3AED] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]">
              Acessar Cloud ativa
            </Link>
          </div>

          <div className="rounded-3xl border border-white/[0.06] bg-[#111116] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] uppercase tracking-[0.28em] text-[#A78BFA]">Participação ao vivo</p>
                <h2 className="mt-3 text-[20px] font-semibold text-white">{participatingCloud.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSharePresence(prev => !prev)}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${sharePresence ? "bg-[#111827] text-white" : "bg-white/5 text-white/80 hover:bg-white/10"}`}
              >
                {sharePresence ? "Compartilhar presença" : "Privado"}
              </button>
            </div>
            <p className="mt-4 text-[14px] text-white/60">
              {sharePresence
                ? "Outros usuários podem ver que você está participando desta Cloud agora."
                : "Sua presença em Cloud está oculta para outros."
              }
            </p>
            {sharePresence ? (
              <Link href={participatingCloud.url} className="mt-5 inline-flex items-center rounded-full bg-[#111827] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-[#27272A]">
                Ver Cloud participando
              </Link>
            ) : (
              <div className="mt-5 rounded-2xl bg-white/5 p-4 text-[14px] text-white/70">Ative a visibilidade para compartilhar esta participação no seu perfil.</div>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/[0.06] bg-[#111116] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] uppercase tracking-[0.28em] text-[#A78BFA]">Hypes no perfil</p>
              <h2 className="mt-3 text-[28px] font-semibold text-white">{profile.hypes}</h2>
            </div>
            <div className="rounded-full bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white/80">Somente você vê este total</div>
          </div>
          <p className="mt-4 text-[14px] text-white/60">Este indicativo mostra quantos hypes seu perfil está recebendo neste momento.</p>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1C1F2E] rounded-2xl border border-white/[0.06] p-6 w-full max-w-[520px]">
            <h3 className="text-[18px] font-bold mb-4">Editar perfil</h3>
            <label className="block text-[12px] text-white/50 mb-1">Nome</label>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-xl bg-[#0D0D10] px-3 py-2 mb-3" />
            <label className="block text-[12px] text-white/50 mb-1">Bio</label>
            <textarea value={draft.bio} onChange={e => setDraft({ ...draft, bio: e.target.value })} className="w-full rounded-xl bg-[#0D0D10] px-3 py-2 mb-3" />
            <label className="block text-[12px] text-white/50 mb-1">Foto</label>
            <input type="file" accept="image/*" onChange={onFile} className="mb-4" />
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-full bg-white/6">Cancelar</button>
              <button onClick={save} className="px-4 py-2 rounded-full bg-[#7C3AED] font-semibold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
