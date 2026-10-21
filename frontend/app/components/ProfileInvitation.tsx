"use client";

import { useEffect, useState } from "react";
import { useSessionUser, UserAvatar } from "./session-user";
import { generalInvitationText } from "../lib/cloud-invitation";

export function ProfileInvitation() {
  const { user } = useSessionUser();
  const [loadedInvite, setInvite] = useState<{ ownerId: string; code: string; inviteUrl: string } | null>(null);
  const invite = loadedInvite?.ownerId === user?.id ? loadedInvite : null;
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const ownerId = user.id;
    void fetch("/api/users/send-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: user.email }) })
      .then(async (response) => { if (!response.ok) throw new Error(); const data = await response.json() as { code: string; inviteUrl: string }; if (!cancelled) setInvite({ ...data, ownerId }); })
      .catch(() => { if (!cancelled) setNotice("Não foi possível carregar seu convite."); });
    return () => { cancelled = true; };
  }, [user?.id]);
  if (!user) return null;
  const share = async () => {
    if (!invite) return;
    const inviteText = generalInvitationText(user.displayName || user.name || user.username);
    try {
      if (navigator.share) await navigator.share({ title: "Clouds", text: inviteText, url: invite.inviteUrl });
      else { await navigator.clipboard.writeText(`${inviteText}\n${invite.inviteUrl}`); setNotice("Convite copiado."); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try { await navigator.clipboard.writeText(`${inviteText}\n${invite.inviteUrl}`); setNotice("Convite copiado."); }
      catch { setNotice("Não foi possível compartilhar o convite."); }
    }
  };
  return <div className="mx-auto max-w-3xl text-center">
    <div className="grid grid-cols-2 items-center gap-3 rounded-[28px] border-2 border-[#a000f5] bg-black px-4 py-7 sm:gap-8 sm:px-10 sm:py-12">
      <div className="min-w-0 border-r border-[#a000f5] pr-3 sm:pr-8"><div className="mx-auto w-fit rounded-full border-4 border-[#a000f5]"><UserAvatar user={user} size={100} /></div><p className="mt-4 break-words text-lg font-bold text-white sm:text-2xl">{user.displayName || user.name}</p><p className="break-all text-sm text-[#8eabd3]">@{user.username}</p></div>
      <div className="min-w-0"><p className="flex items-center justify-center gap-2 text-2xl font-extrabold text-white sm:text-4xl"><img src="/logo_clouds.png" alt="" className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10" />Clouds</p><p className="tracking-[.3em] text-[#a000f5]">COMMUNITY</p><button type="button" disabled={!invite} onClick={() => { if (invite) void navigator.clipboard.writeText(invite.code).then(() => setNotice("Código copiado.")).catch(() => setNotice("Não foi possível copiar o código.")); }} className="mt-5 w-full rounded-full border border-white/20 px-2 py-3 font-bold tracking-[.2em] text-white">{invite?.code ?? "..."} ⧉</button></div>
    </div>
    <p className="mt-5 text-sm leading-relaxed text-white/70">Aumente a posição de seu perfil na aba Meet e seja recomendado a mais pessoas trazendo seus amigos para o Clouds. Acumule +10 hypes no seu perfil a cada novo usuário que adentrar à plataforma com seu código!</p>
    <button type="button" disabled={!invite} onClick={() => void share()} className="mt-5 w-full max-w-sm rounded-full bg-[#a000f5] px-6 py-3 font-bold text-white disabled:opacity-50">Chamar amigos (+10 hypes p/usuário)</button>
    <p className="mt-3 text-sm text-white/70">Ao acessar seu convite, seus amigos encontrarão seu código já preenchido no cadastro.</p>
    {notice && <p role="status" className="mt-2 text-sm text-white/70">{notice}</p>}
  </div>;
}
