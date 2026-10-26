"use client";

import { useRef, useState } from "react";
import { cloudForwardMarker, parseForwardedContent, type ForwardOrigin } from "../lib/forwarded-content";
import { RecloudIcon } from "./RecloudIcon";
import { filterPeople } from "../lib/filter-people";

export type ForwardContact = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ForwardItem = {
  preview?: string;
  url: string;
  label: string;
  messageContent?: string;
  mediaKind?: "audio" | "image";
  mediaUrl?: string | null;
  mediaDurationMs?: number | null;
  mediaFileName?: string | null;
  forwarded?: boolean;
  forwardedOrigin?: "cloud";
  cloudOrigin?: ForwardOrigin;
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
  forwardedOrigin?: "cloud";
  cloudOrigin?: ForwardOrigin;
  contacts: ForwardContact[];
  loading?: boolean;
  contactsError?: string | null;
  externalShareText?: string;
  externalSharePrompt?: string;
  items?: ForwardItem[];
  recloud?: { reclouded: boolean; busy: boolean; error: string; onToggle: () => void };
  onClose: () => void;
};

export function ForwardToContactModal({ title, preview, url, label, messageContent, mediaKind, mediaUrl, mediaDurationMs, mediaFileName, forwarded = true, forwardedOrigin, cloudOrigin, contacts, loading = false, contactsError, externalShareText, externalSharePrompt = "Esse papo tem a cara de alguém? Convide amigos para participar!", items, recloud, onClose }: Props) {
  const [note, setNote] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [externalShareNotice, setExternalShareNotice] = useState<string | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const forwardingRef = useRef(new Set<string>());
  const visibleContacts = filterPeople(contacts, contactQuery);
  const forwardItems = items?.length ? items : [{ preview, url, label, messageContent, mediaKind, mediaUrl, mediaDurationMs, mediaFileName, forwarded, forwardedOrigin, cloudOrigin }];

  const forward = async (contact: ForwardContact) => {
    if (forwardingRef.current.has(contact.id) || sentTo.includes(contact.id)) return;
    forwardingRef.current.add(contact.id);
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
      for (const item of forwardItems) {
      const clientMessageId = `forward-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const parsedContent = item.messageContent !== undefined ? parseForwardedContent(item.messageContent) : null;
      const cleanMessageContent = parsedContent?.text;
      const origin = item.cloudOrigin ?? parsedContent?.origin;
      const isTextMessage = item.messageContent !== undefined;
      let forwardedLabel = item.label;
      if (item.forwarded && !isTextMessage) {
        try {
          forwardedLabel = JSON.stringify({ ...JSON.parse(item.label), external: true });
        } catch {
          forwardedLabel = JSON.stringify({ type: "forwarded_link", label: item.label, external: true });
        }
      }
      const isMedia = Boolean(item.mediaKind);
      let endpoint = `/api/direct-messages/conversations/${encodeURIComponent(conversationId)}`;
      let body: BodyInit;

      if (isMedia) {
        if (!item.mediaUrl) throw new Error("A mídia original não está disponível para encaminhamento.");
        const mediaResponse = await fetch(item.mediaUrl as string);
        if (!mediaResponse.ok) throw new Error("Não foi possível carregar a mídia original.");
        const downloadedBlob = await mediaResponse.blob();
        const expectedMimePrefix = item.mediaKind === "audio" ? "audio/" : "image/";
        const mediaBlob = downloadedBlob.type.startsWith(expectedMimePrefix)
          ? downloadedBlob
          : new Blob([downloadedBlob], { type: item.mediaKind === "audio" ? "audio/webm" : "image/jpeg" });
        const formData = new FormData();
        const extension = item.mediaKind === "audio" ? "webm" : "jpg";
        formData.set("file", mediaBlob, item.mediaFileName || `encaminhada-${Date.now()}.${extension}`);
        formData.set("clientMessageId", clientMessageId);
        formData.set("forwarded", String(item.forwarded ?? true));
        if (item.forwardedOrigin) formData.set("forwardedOrigin", item.forwardedOrigin);
        if (origin) { formData.set("cloudId", origin.id); formData.set("cloudName", origin.name); }
        if (item.mediaKind === "audio" && item.mediaDurationMs) formData.set("durationMs", String(item.mediaDurationMs));
        endpoint += item.mediaKind === "audio" ? "/audio" : "/image";
        body = formData;
      } else {
        endpoint += isTextMessage ? "/messages" : "/link";
        body = JSON.stringify(isTextMessage
          ? { content: `${origin ? cloudForwardMarker(origin) : `↗ ${item.forwardedOrigin === "cloud" ? "Encaminhada de uma cloud" : "Encaminhada"}`}\n${cleanMessageContent ?? ""}`, clientMessageId }
          : { url: item.url, label: forwardedLabel, clientMessageId });
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
      }
      setSentTo((previous) => previous.includes(contact.id) ? previous : [...previous, contact.id]);
      const text = note.trim();
      if (text) {
        const noteResponse = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, clientMessageId: `forward-note-${Date.now()}-${Math.random().toString(36).slice(2)}` }),
        });
        const notePayload = await noteResponse.json().catch(() => null);
        if (!noteResponse.ok || notePayload?.ok === false) throw new Error(notePayload?.message || "O item foi encaminhado, mas não foi possível enviar o recado.");
      }
      setNote("");
    } catch (forwardError) {
      setError(forwardError instanceof Error ? forwardError.message : "Não foi possível encaminhar.");
    } finally {
      forwardingRef.current.delete(contact.id);
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

  const shareNatively = async () => {
    const text = externalShareText || (preview || title);
    setExternalShareNotice(null);
    try {
      if (!navigator.share) throw new Error("Compartilhamento nativo indisponível");
      // Never put the URL in both `text` and `url`: WhatsApp renders those
      // fields separately and would show the same invitation twice.
      await navigator.share(externalShareText
        ? { title: preview || title, text }
        : { title: preview || title, text, url });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        setExternalShareNotice("O compartilhamento nativo não está disponível. O convite foi copiado.");
      } catch {
        setExternalShareNotice("Não foi possível abrir o compartilhamento nativo agora.");
      }
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setExternalShareNotice("Link copiado.");
    } catch {
      setExternalShareNotice("Não foi possível copiar o link.");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-3 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#15161C] p-4 md:p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-white/45 transition hover:text-white">×</button>
        </div>
        {preview && <p className="mb-4 line-clamp-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white/70">{items && items.length > 1 ? `${items.length} mensagens selecionadas para encaminhar` : preview}</p>}
        {recloud && <div className="mb-4"><button type="button" disabled={recloud.busy} aria-pressed={recloud.reclouded} onClick={recloud.onToggle} className={`flex w-full items-center justify-center gap-2 rounded-full border border-[#A855F7]/50 bg-[#7C3AED]/15 px-4 py-2.5 text-[13px] font-semibold transition hover:bg-[#7C3AED]/30 disabled:opacity-50 ${recloud.reclouded ? "text-[#C084FC]" : "text-white"}`}><RecloudIcon />{recloud.reclouded ? "Desfazer Recloud" : "Republicar Cloud"}</button>{recloud.error && <p role="alert" className="mt-2 text-[12px] text-red-300">{recloud.error}</p>}</div>}
        {externalShareText && (
          <section className="mb-5 rounded-xl border border-[#A855F7]/25 bg-[#7C3AED]/10 p-3 md:hidden">
            <p className="text-[13px] font-semibold text-white">{externalSharePrompt}</p>
            <button type="button" onClick={() => void shareNatively()} className="mt-3 w-full rounded-full bg-[#9333EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED]">Compartilhar com…</button>
            <button type="button" onClick={() => void copyShareLink()} className="mt-2 w-full rounded-full border border-white/20 px-4 py-2 text-[13px] font-semibold text-white">Copiar link</button>
            {externalShareNotice && <p role="status" className="mt-2 text-[11px] font-medium text-[#D8B4FE]">{externalShareNotice}</p>}
          </section>
        )}
        {externalShareText && (
          <section className="mb-5 hidden rounded-xl border border-[#A855F7]/25 bg-[#7C3AED]/10 p-3 md:block">
            <p className="text-[13px] font-semibold text-white">{externalSharePrompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void shareNatively()} className="rounded-full bg-[#9333EA] px-3 py-2 text-[12px] font-semibold text-white">Compartilhar com apps</button>
              <button type="button" onClick={() => void copyShareLink()} className="rounded-full border border-white/20 px-3 py-2 text-[12px] font-semibold text-white">Copiar link</button>
              <button type="button" onClick={shareOnWhatsApp} className="rounded-full bg-[#25D366] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110">WhatsApp</button>
              <button type="button" onClick={() => void shareToMobileApp("Instagram", "https://www.instagram.com/direct/inbox/")} className="rounded-full bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110">Instagram Direct</button>
              <button type="button" onClick={shareOnX} className="rounded-full bg-black px-3 py-2 text-[12px] font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10">X</button>
              <button type="button" onClick={shareOnReddit} className="rounded-full bg-[#FF4500] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110">Reddit</button>
              <button type="button" onClick={() => void shareToMobileApp("TikTok", "https://www.tiktok.com/messages")} className="rounded-full border border-cyan-300/30 bg-[#0891B2] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#0E7490]">TikTok Mensagens</button>
            </div>
            <p className="mt-3 hidden text-[11px] leading-relaxed text-white/45 md:block">No computador, Instagram Direct e TikTok Mensagens copiam o convite e abrem a caixa de mensagens em uma nova aba para você enviar a quem quiser.</p>
            {externalShareNotice && <p role="status" className="mt-2 text-[11px] font-medium text-[#D8B4FE]">{externalShareNotice}</p>}
          </section>
        )}
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Contatos do Messages</p>
        <input type="search" aria-label="Pesquisar contatos" placeholder="Buscar por nome ou @username" value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} className="mb-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/40 focus:border-[#A855F7]" />
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {loading ? <p className="py-5 text-center text-[13px] text-white/40">Carregando contatos...</p> : contactsError ? <p role="alert" className="py-5 text-center text-[13px] text-red-300">{contactsError}</p> : contacts.length === 0 ? <p className="py-5 text-center text-[13px] text-white/40">Nenhum contato disponível.</p> : visibleContacts.length === 0 ? <p className="py-5 text-center text-[13px] text-white/40">Nenhum resultado encontrado.</p> : visibleContacts.map((contact) => {
            const sent = sentTo.includes(contact.id);
            return <div key={contact.id} className="flex min-h-12 items-center gap-2 rounded-xl px-2 py-1 hover:bg-white/[0.05] md:gap-3 md:py-2">
              {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-[13px] font-bold">{contact.displayName.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-white">{contact.displayName}</p><p className="truncate text-[12px] text-white/45">@{contact.username}</p></div>
              <button type="button" disabled={Boolean(sendingTo) || sent} onClick={() => void forward(contact)} className="min-h-9 shrink-0 rounded-full bg-[#9333EA] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50">{sent ? "Enviado" : sendingTo === contact.id ? "Enviando..." : "Encaminhar"}</button>
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
