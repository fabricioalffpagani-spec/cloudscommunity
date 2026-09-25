"use client";

import { useState } from "react";

export type ForwardContact = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type Props = {
  title: string;
  preview?: string;
  url: string;
  label: string;
  messageContent?: string;
  mediaKind?: "audio" | "image";
  mediaUrl?: string | null;
  mediaDurationMs?: number | null;
  mediaFileName?: string | null;
  forwarded?: boolean;
  contacts: ForwardContact[];
  loading?: boolean;
  externalShareText?: string;
  onClose: () => void;
};

export function ForwardToContactModal({ title, preview, url, label, messageContent, mediaKind, mediaUrl, mediaDurationMs, mediaFileName, forwarded = true, contacts, loading = false, externalShareText, onClose }: Props) {
  const [note, setNote] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [externalShareNotice, setExternalShareNotice] = useState<string | null>(null);

  const forward = async (contact: ForwardContact) => {
    setSendingTo(contact.id);
    setError(null);
    try {
      const conversationResponse = await fetch("/api/direct-messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId: contact.id }),
      });
      const conversationPayload = await conversationResponse.json().catch(() => null);
      if (!conversationResponse.ok || !conversationPayload?.conversation?.id) throw new Error(conversationPayload?.message || "Não foi possível abrir a conversa.");
      const conversationId = conversationPayload.conversation.id as string;
      const clientMessageId = `forward-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const cleanMessageContent = messageContent?.replace(/^(?:↗\s*(?:Mensagem encaminhada|Encaminhada)\s*)+/, "");
      const isTextMessage = messageContent !== undefined;
      let forwardedLabel = label;
      if (forwarded && !isTextMessage) {
        try {
          forwardedLabel = JSON.stringify({ ...JSON.parse(label), external: true });
        } catch {
          forwardedLabel = JSON.stringify({ type: "forwarded_link", label, external: true });
        }
      }
      const isMedia = Boolean(mediaKind);
      let endpoint = `/api/direct-messages/conversations/${encodeURIComponent(conversationId)}`;
      let body: BodyInit;

      if (isMedia) {
        if (!mediaUrl) throw new Error("A mídia original não está disponível para encaminhamento.");
        const mediaResponse = await fetch(mediaUrl as string);
        if (!mediaResponse.ok) throw new Error("Não foi possível carregar a mídia original.");
        const downloadedBlob = await mediaResponse.blob();
        const expectedMimePrefix = mediaKind === "audio" ? "audio/" : "image/";
        const mediaBlob = downloadedBlob.type.startsWith(expectedMimePrefix)
          ? downloadedBlob
          : new Blob([downloadedBlob], { type: mediaKind === "audio" ? "audio/webm" : "image/jpeg" });
        const formData = new FormData();
        const extension = mediaKind === "audio" ? "webm" : "jpg";
        formData.set("file", mediaBlob, mediaFileName || `encaminhada-${Date.now()}.${extension}`);
        formData.set("clientMessageId", clientMessageId);
        formData.set("forwarded", String(forwarded));
        if (mediaKind === "audio" && mediaDurationMs) formData.set("durationMs", String(mediaDurationMs));
        endpoint += mediaKind === "audio" ? "/audio" : "/image";
        body = formData;
      } else {
        endpoint += isTextMessage ? "/messages" : "/link";
        body = JSON.stringify(isTextMessage
          ? { content: `${forwarded ? "↗ Encaminhada\n" : ""}${cleanMessageContent ?? ""}`, clientMessageId }
          : { url, label: forwardedLabel, clientMessageId });
      }

      const send = () => fetch(endpoint, {
        method: "POST",
        ...(body instanceof FormData ? {} : { headers: { "Content-Type": "application/json" } }),
        body,
      });
      let forwardedResponse = await send();
      // A conversa pode ser criada enquanto o backend conclui um reinício. Uma única
      // nova tentativa evita falhas transitórias sem duplicar a mensagem (idempotência).
      if (forwardedResponse.status === 404) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        forwardedResponse = await send();
      }
      const forwardedPayload = await forwardedResponse.json().catch(() => null);
      if (!forwardedResponse.ok || forwardedPayload?.ok === false) throw new Error(forwardedPayload?.message || "Não foi possível encaminhar.");
      const text = note.trim();
      if (text) {
        const noteResponse = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, clientMessageId: `${clientMessageId}-note` }),
        });
        const notePayload = await noteResponse.json().catch(() => null);
        if (!noteResponse.ok || notePayload?.ok === false) throw new Error(notePayload?.message || "O item foi encaminhado, mas não foi possível enviar o recado.");
      }
      setSentTo((previous) => [...previous, contact.id]);
    } catch (forwardError) {
      setError(forwardError instanceof Error ? forwardError.message : "Não foi possível encaminhar.");
    } finally {
      setSendingTo(null);
    }
  };

  const shareToMobileApp = async (appName: "Instagram" | "TikTok", desktopMessagesUrl: string) => {
    const text = externalShareText || `${preview || title}\n${url}`;
    setExternalShareNotice(null);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
    if (!isMobile) {
      try {
        await navigator.clipboard.writeText(text);
        setExternalShareNotice("Link do convite copiado. Você pode compartilhá-lo com quem quiser — ele continua na sua área de transferência.");
        window.open(desktopMessagesUrl, "_blank", "noopener,noreferrer");
      } catch {
        setExternalShareNotice("Não foi possível copiar o convite automaticamente. Tente novamente.");
      }
      return;
    }

    try {
      if (!navigator.share || (navigator.canShare && !navigator.canShare({ text }))) {
        throw new Error("Compartilhamento nativo indisponível");
      }
      // Some mobile browsers reject a combined title/text/url payload. The
      // complete text already contains the public Cloud URL, so this is the
      // most broadly compatible Web Share payload.
      await navigator.share({ text });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        setExternalShareNotice(`Não foi possível abrir o compartilhamento do ${appName}. O convite foi copiado para você enviar pelo app.`);
      } catch {
        setExternalShareNotice(`Não foi possível abrir o compartilhamento do ${appName} agora.`);
      }
    }
  };

  const shareOnWhatsApp = () => {
    const text = externalShareText || `${preview || title}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const shareOnX = () => {
    const text = externalShareText || `${preview || title}\n${url}`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const shareOnReddit = () => {
    window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(preview || title)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#15161C] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-white/45 transition hover:text-white">×</button>
        </div>
        {preview && <p className="mb-4 line-clamp-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white/70">{preview}</p>}
        {externalShareText && (
          <section className="mb-5 rounded-xl border border-[#A855F7]/25 bg-[#7C3AED]/10 p-3">
            <p className="text-[13px] font-semibold text-white">Esse papo tem a cara de alguém? Convide amigos para participar!</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={shareOnWhatsApp} className="rounded-full bg-[#25D366] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110">WhatsApp</button>
              <button type="button" onClick={() => void shareToMobileApp("Instagram", "https://www.instagram.com/direct/inbox/")} className="rounded-full bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110">Instagram Direct</button>
              <button type="button" onClick={shareOnX} className="rounded-full bg-black px-3 py-2 text-[12px] font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10">X</button>
              <button type="button" onClick={shareOnReddit} className="rounded-full bg-[#FF4500] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110">Reddit</button>
              <button type="button" onClick={() => void shareToMobileApp("TikTok", "https://www.tiktok.com/messages")} className="rounded-full bg-gradient-to-r from-[#25F4EE] via-[#151515] to-[#FE2C55] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110">TikTok Mensagens</button>
            </div>
            <p className="mt-3 hidden text-[11px] leading-relaxed text-white/45 md:block">No computador, Instagram Direct e TikTok Mensagens copiam o convite e abrem a caixa de mensagens em uma nova aba para você enviar a quem quiser.</p>
            {externalShareNotice && <p role="status" className="mt-2 text-[11px] font-medium text-[#D8B4FE]">{externalShareNotice}</p>}
          </section>
        )}
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Contatos do Messages</p>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {loading ? <p className="py-5 text-center text-[13px] text-white/40">Carregando contatos...</p> : contacts.length === 0 ? <p className="py-5 text-center text-[13px] text-white/40">Nenhum contato disponível.</p> : contacts.map((contact) => {
            const sent = sentTo.includes(contact.id);
            return <div key={contact.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.05]">
              {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-[13px] font-bold">{contact.displayName.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-white">{contact.displayName}</p><p className="truncate text-[12px] text-white/45">@{contact.username}</p></div>
              <button type="button" disabled={Boolean(sendingTo) || sent} onClick={() => void forward(contact)} className="rounded-full bg-[#9333EA] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50">{sent ? "Enviado" : sendingTo === contact.id ? "Enviando..." : "Encaminhar"}</button>
            </div>;
          })}
        </div>
        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-white/40" htmlFor="forward-note">Recado opcional</label>
        <textarea id="forward-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} placeholder="Escreva algo sobre este encaminhamento..." className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#9333EA]" />
        {error && <p className="mt-2 text-[12px] text-red-300">{error}</p>}
      </div>
    </div>
  );
}
