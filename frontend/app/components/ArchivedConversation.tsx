"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReadOnlyCloudMessage, type ReadOnlyMessage } from "./ReadOnlyCloudMessage";
import { CloudTitleMarquee } from "./CloudTitleMarquee";
import { useSessionUser } from "./session-user";
import { ForwardToContactModal, type ForwardContact } from "./ForwardToContactModal";
import { useRecloud } from "./RecloudAction";
import { RecloudIcon } from "./RecloudIcon";
import { SendIcon } from "./ui-icons";
import type { CloudParticipant } from "./CloudParticipantsSheet";

type ArchivedMessage = ReadOnlyMessage & { sender: NonNullable<ReadOnlyMessage["sender"]> };
type ArchivePayload = { cloud: { title: string; visibility?: "public" | "private"; authorId?: string; description?: string | null; endedAt?: string | null; participantProfiles?: CloudParticipant[] }; messages: ArchivedMessage[] };

function endedLabel(endedAt?: string | null) {
  if (!endedAt) return "Cloud encerrada";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(endedAt).getTime()) / 60_000));
  if (minutes < 1) return "Cloud encerrada agora";
  if (minutes < 60) return `Cloud encerrada há ${minutes}min`;
  if (minutes < 1440) return `Cloud encerrada há ${Math.floor(minutes / 60)}h`;
  return `Cloud encerrada há ${Math.floor(minutes / 1440)}d`;
}

function dateLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Hoje";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}

export function ArchivedConversation({ cloudId }: { cloudId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromReadFeed = searchParams.get("from") === "read";
  const readScope = searchParams.get("scope") === "following" ? "following" : "for-you";
  const { user } = useSessionUser();
  const [cloud, setCloud] = useState<ArchivePayload["cloud"] | null>(null);
  const [messages, setMessages] = useState<ArchivedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<ArchivedMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const recloud = useRecloud(cloudId, Boolean(user?.id && cloud));
  const showRecloudAction = Boolean(user?.id && cloud?.visibility !== "private");
  const [contacts, setContacts] = useState<ForwardContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollPending = useRef(true);
  const previousScrollHeight = useRef<number | null>(null);

  useEffect(() => {
    if (!shareOpen) return;
    let active = true;
    setLoadingContacts(true);
    void fetch("/api/users/following?compact=1", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { users?: ForwardContact[] }) => { if (active) setContacts((data.users ?? []).filter((contact) => contact.id !== user?.id)); })
      .catch(() => { if (active) setContacts([]); })
      .finally(() => { if (active) setLoadingContacts(false); });
    return () => { active = false; };
  }, [shareOpen, user?.id]);

  const fetchPage = useCallback(async (cursor?: string) => {
    const suffix = fromReadFeed
      ? `?take=100&fromStart=true${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`
      : cursor ? `?take=100&before=${encodeURIComponent(cursor)}` : "?take=100";
    const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/archive/messages${suffix}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as (ArchivePayload & { message?: string }) | null;
    if (!response.ok || !payload?.cloud || !Array.isArray(payload.messages)) {
      throw new Error(payload?.message ?? "Não foi possível carregar a conversa.");
    }
    return payload;
  }, [cloudId, fromReadFeed]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPage().then((payload) => {
      if (controller.signal.aborted) return;
      setCloud(payload.cloud);
      setMessages(payload.messages);
      setHasOlder(payload.messages.length === 100);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a conversa.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [fetchPage]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || messages.length === 0) return;
    if (previousScrollHeight.current !== null) {
      container.scrollTop += container.scrollHeight - previousScrollHeight.current;
      previousScrollHeight.current = null;
      return;
    }
    if (initialScrollPending.current) {
      container.scrollTop = fromReadFeed ? 0 : container.scrollHeight;
      initialScrollPending.current = false;
    }
  }, [messages, fromReadFeed]);

  const loadOlder = async () => {
    if (!messages[0] || loadingOlder) return;
    setLoadingOlder(true);
    if (!fromReadFeed) previousScrollHeight.current = scrollRef.current?.scrollHeight ?? null;
    try {
      const payload = await fetchPage(fromReadFeed ? messages[messages.length - 1].createdAt : messages[0].createdAt);
      setMessages((current) => fromReadFeed ? [...current, ...payload.messages] : [...payload.messages, ...current]);
      setHasOlder(payload.messages.length === 100);
    } catch (cause) {
      previousScrollHeight.current = null;
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar mensagens anteriores.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const sendReply = async () => {
    if (!replyTo?.sender.id || !replyText.trim()) return;
    setSendingReply(true); setReplyError("");
    try {
      const conversationResponse = await fetch("/api/direct-messages/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peerUserId: replyTo.sender.id }) });
      const conversationPayload = await conversationResponse.json().catch(() => null) as { conversation?: { id?: string }; message?: string } | null;
      const conversationId = conversationPayload?.conversation?.id;
      if (!conversationResponse.ok || !conversationId) throw new Error(conversationPayload?.message ?? "Não foi possível abrir a conversa.");
      const originalComment = replyTo.replyTo?.content?.trim() || replyTo.content?.trim() || "Comentário sem texto";
      const sent = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: JSON.stringify({ type: "cloud_comment_reply", cloudTitle: cloud?.title ?? "Cloud encerrada", comment: originalComment, response: replyText.trim() }), clientMessageId: crypto.randomUUID() }) });
      const sentPayload = await sent.json().catch(() => null) as { message?: string } | null;
      if (!sent.ok) throw new Error(sentPayload?.message ?? "Não foi possível enviar a resposta.");
      setReplyTo(null); setReplyText("");
    } catch (cause) { setReplyError(cause instanceof Error ? cause.message : "Não foi possível enviar a resposta."); }
    finally { setSendingReply(false); }
  };

  let previousDate = "";

  return <main className="flex h-[100dvh] min-h-screen flex-col overflow-hidden text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
    <header className="flex shrink-0 flex-wrap items-center gap-1.5 bg-black px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 sm:pb-4 sm:pt-4">
      {fromReadFeed ? <button type="button" onClick={() => router.back()} aria-label="Voltar para Read" className="flex h-8 w-8 shrink-0 items-center justify-center text-white/70 transition hover:text-white sm:h-9 sm:w-9"><BackIcon /></button> : <Link href={`/read?cloud=${encodeURIComponent(cloudId)}&scope=${readScope}`} aria-label="Voltar para Read" className="flex h-8 w-8 shrink-0 items-center justify-center text-white/70 transition hover:text-white sm:h-9 sm:w-9"><BackIcon /></Link>}
      <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
        <CloudTitleMarquee title={cloud?.title ?? "Conversa encerrada"} />
        <div className="hidden items-center gap-2 whitespace-nowrap text-[13px] text-white/50 sm:flex sm:text-[16px]">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-white/30 sm:h-3 sm:w-3" />
          <span>{endedLabel(cloud?.endedAt)}</span>
          <span className="text-white/20">|</span>
          <span className="flex items-center gap-1 text-[#A855F7]"><LockIcon /> Somente leitura</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        {cloud?.visibility !== "private" && <button type="button" disabled={!cloud} onClick={() => setShareOpen(true)} aria-label="Compartilhar Cloud" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-40">
          <SendIcon s={22} />
        </button>}
        {showRecloudAction && <button type="button" disabled={!recloud.canRecloud || recloud.busy} aria-label={recloud.reclouded ? "Desfazer Recloud" : "Republicar Cloud"} title={recloud.canRecloud ? (recloud.reclouded ? "Desfazer Recloud" : "Republicar Cloud") : "Republicação indisponível para esta Cloud"} aria-pressed={recloud.reclouded} onClick={() => void recloud.toggle()} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 ${recloud.reclouded ? "text-[#C084FC]" : "text-white/75 hover:text-white"}`}>
          <RecloudIcon />
        </button>}
      </div>
      <div data-testid="mobile-archive-status" className="flex w-full items-center gap-2 pl-[2.375rem] text-[13px] text-white/60 sm:hidden">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/30" />
        <span>{endedLabel(cloud?.endedAt)}</span>
        <span className="text-white/20">|</span>
        <span className="flex items-center gap-1 text-[#A855F7]"><LockIcon /> Somente leitura</span>
      </div>
    </header>

    {recloud.error && <div role="alert" className="border-b border-white/[0.07] bg-[#2A1018] px-5 py-2 text-[12px] text-[#FCA5A5]">{recloud.error}</div>}
    {error && <div role="alert" className="border-b border-white/[0.07] bg-[#2A1018] px-5 py-2 text-[12px] text-[#FCA5A5]">{error}</div>}

    <section ref={scrollRef} aria-label="Conversa completa" aria-busy={loading} className="scrollbar-purple flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-8 sm:py-6">
      {loading && <div role="status" className="flex h-full items-center justify-center text-white/40">Carregando mensagens...</div>}
      {hasOlder && !fromReadFeed && <button type="button" disabled={loadingOlder} onClick={() => void loadOlder()} className="mx-auto block rounded-full border border-white/15 px-5 py-2 text-sm text-white/70 transition hover:border-[#A855F7] hover:text-white disabled:opacity-50">{loadingOlder ? "Carregando..." : "Carregar mensagens anteriores"}</button>}
      {!loading && !error && messages.length === 0 && <div className="flex h-full items-center justify-center text-center text-white/40"><div><p className="text-[16px] font-semibold text-white/70">Nenhuma mensagem</p><p className="mt-1 text-[14px]">Esta cloud terminou sem mensagens.</p></div></div>}
      {messages.map((message) => {
        const currentDate = new Date(message.createdAt).toDateString();
        const showDate = currentDate !== previousDate;
        previousDate = currentDate;
        return <div key={message.id} className="space-y-4">
          {showDate && <div className="flex justify-center py-1"><span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/40">{dateLabel(message.createdAt)}</span></div>}
          <ReadOnlyCloudMessage message={message} own={Boolean(user?.id && message.sender.id === user.id)} onReply={(target) => { setReplyTo(target as ArchivedMessage); setReplyError(""); }} />
        </div>;
      })}
      {hasOlder && fromReadFeed && <button type="button" disabled={loadingOlder} onClick={() => void loadOlder()} className="mx-auto block rounded-full border border-white/15 px-5 py-2 text-sm text-white/70 transition hover:border-[#A855F7] hover:text-white disabled:opacity-50">{loadingOlder ? "Carregando..." : "Carregar mensagens seguintes"}</button>}
    </section>

    {shareOpen && cloud && (() => {
      const url = `${window.location.origin}/cloud/${encodeURIComponent(cloudId)}/conversation?from=read`;
      return <ForwardToContactModal title="Compartilhar Cloud" preview={cloud.title} url={url} label={cloud.title} forwarded={false} contacts={contacts} loading={loadingContacts} recloud={recloud.canRecloud ? { reclouded: recloud.reclouded, busy: recloud.busy, error: recloud.error, onToggle: () => void recloud.toggle() } : undefined} externalShareText={`Venha ler a conversa “${cloud.title}” no Clouds!\n${url}`} externalSharePrompt="Convide amigos para ler esta conversa no Read!" onClose={() => setShareOpen(false)} />;
    })()}
    {replyTo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#15161C] p-5"><h2 className="text-lg font-bold">Responder a {replyTo.sender.displayName}</h2><p className="mt-2 break-words rounded-xl bg-white/5 p-3 text-sm text-white/60 [overflow-wrap:anywhere]">Em “{cloud?.title}”: “{replyTo.content ?? "Mensagem"}”</p><textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Escreva sua resposta privada..." rows={4} className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-[#A855F7]" />{replyError && <p className="mt-2 text-xs text-red-300">{replyError}</p>}<div className="mt-4 flex justify-end gap-3"><button onClick={() => setReplyTo(null)} className="text-sm text-white/60">Cancelar</button><button disabled={sendingReply || !replyText.trim()} onClick={() => void sendReply()} className="rounded-full bg-[#9333EA] px-4 py-2 text-sm font-semibold disabled:opacity-50">{sendingReply ? "Enviando..." : "Enviar"}</button></div></div></div>}

    <footer className="shrink-0 border-t border-white/[0.07] bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:py-4">
      <Link href={`/?create=1&originCloudId=${encodeURIComponent(cloudId)}`} className="mx-auto flex min-h-[54px] max-w-3xl items-center justify-center rounded-full bg-[#A855F7] px-7 text-center text-[14px] font-semibold text-white transition hover:bg-[#9333EA]">Continuar essa conversa</Link>
    </footer>
  </main>;
}
