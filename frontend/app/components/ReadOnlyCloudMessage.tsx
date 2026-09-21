"use client";

import { AudioWaveformPlayer } from "./AudioWaveformPlayer";
import { UserAvatar } from "./session-user";
import Link from "next/link";

export type ReadOnlyMessage = {
  id: string;
  type: "text" | "audio" | "image" | "link" | "system" | string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  sender: {
    id?: string;
    displayName: string;
    username?: string;
    avatarUrl?: string | null;
  } | null;
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ReadOnlyCloudMessage({ message, own = false }: { message: ReadOnlyMessage; own?: boolean }) {
  const senderName = message.sender?.displayName || message.sender?.username || "Usuário";
  const avatarUser = {
    id: message.sender?.id || message.sender?.username || message.id,
    username: message.sender?.username || "usuario",
    displayName: senderName,
    avatarUrl: message.sender?.avatarUrl || null,
  };
  const profileHref = message.sender?.id ? `/users/${encodeURIComponent(message.sender.id)}` : null;

  if (message.type === "system") {
    return (
      <p className="text-center text-xs text-white/35">
        {message.content}
      </p>
    );
  }

  return (
    <article className={`flex items-end gap-2.5 ${own ? "flex-row-reverse" : "flex-row"}`} aria-label={`Mensagem de ${senderName}`}>
      {profileHref ? (
        <Link href={profileHref} aria-label={`Ver perfil de ${senderName}`} className="mb-6 w-9 shrink-0"><UserAvatar user={avatarUser} size={34} /></Link>
      ) : (
        <div className="mb-6 w-9 shrink-0"><UserAvatar user={avatarUser} size={34} /></div>
      )}

      <div className={`flex min-w-0 max-w-[calc(100%_-_2.75rem)] items-end gap-2 sm:max-w-[74%] ${own ? "flex-row-reverse" : "flex-row"}`}>
        <div className={`flex min-w-0 flex-col gap-1.5 ${own ? "items-end" : "items-start"}`}>
          <div className={`flex items-center gap-2 px-1 ${own ? "flex-row-reverse" : ""}`}>
            {profileHref ? <Link href={profileHref} className="text-[12px] font-semibold text-white/40 transition hover:text-white hover:underline">{own ? "Você" : senderName}</Link> : <span className="text-[12px] font-semibold text-white/40">{own ? "Você" : senderName}</span>}
          </div>

          {message.type === "audio" ? (
            message.mediaUrl ? (
              <AudioWaveformPlayer src={message.mediaUrl} isOwn={own} roundedCorner={own ? "right" : "left"} />
            ) : (
              <div className={`min-w-[220px] rounded-2xl px-4 py-3 text-[12px] text-white/60 ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
                Áudio indisponível
              </div>
            )
          ) : message.type === "image" ? (
            <a href={message.mediaUrl || "#"} target="_blank" rel="noreferrer" className={`block overflow-hidden rounded-2xl border border-white/[0.08] ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] bg-[#1a0e3d]"}`}>
              {message.mediaUrl ? (
                <img src={message.mediaUrl} alt="Imagem enviada" className="max-h-[320px] max-w-full object-cover" />
              ) : (
                <div className="px-4 py-8 text-[14px] text-white/50">Imagem indisponível</div>
              )}
            </a>
          ) : message.type === "link" ? (
            <a href={message.content || "#"} target="_blank" rel="noreferrer" className={`break-all rounded-2xl px-4 py-3 text-[14px] leading-relaxed text-white underline decoration-white/40 ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
              {message.content}
            </a>
          ) : (
            <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-white [overflow-wrap:anywhere] ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
              {message.content}
            </div>
          )}

          <div className={`flex items-center gap-1 px-1 text-[11px] text-white/30 ${own ? "flex-row-reverse" : ""}`}>
            <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
          </div>
        </div>
      </div>
    </article>
  );
}
