"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { socketAuth } from "../lib/socket-auth";
import { clampMiniCloudPosition } from "../lib/mini-cloud-position";
import { cloudElapsedSeconds } from "../lib/cloud-start-time";
import { CloudSystemMessage } from "./CloudSystemMessage";
import { useSessionUser } from "./session-user";

type Cloud = { id: string; title: string; isAuthor: boolean; ownerUserId: string; duration?: string; createdAt?: string; startedAt?: string | null };
type Reaction = { id: string; emoji: string; userId: string };
type Msg = { id: string; cloudId: string; type: string; content: string | null; createdAt: string; sender: { id: string; displayName: string; avatarUrl?: string | null }; reactions?: Reaction[]; replyTo?: { sender: string; content: string | null } | null };

const read = (userId?: string | null): Cloud | null => { try { const value = localStorage.getItem("clouds:minimized-cloud"); const cloud = value ? JSON.parse(value) as Cloud : null; return userId && cloud?.ownerUserId === userId ? cloud : null; } catch { return null; } };
const SIZE_KEY = "clouds:mini-cloud-size";
const POPOUT_KEY = "clouds:mini-cloud-popout";
const MIN_WIDTH = 280;
const MIN_HEIGHT = 260;
const MAX_WIDTH = 720;
const MAX_HEIGHT = 800;
const SOCKET_URL = process.env.NEXT_PUBLIC_CLOUDS_SOCKET_URL?.trim();
const mergeMessages = (previous: Msg[], message: Msg) => previous.some((item) => item.id === message.id) ? previous : [...previous, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-100);
const clampSize = (width: number, height: number) => ({
  width: Math.max(Math.min(MIN_WIDTH, window.innerWidth - 16), Math.min(width, MAX_WIDTH, window.innerWidth - 16)),
  height: Math.max(Math.min(MIN_HEIGHT, window.innerHeight - 16), Math.min(height, MAX_HEIGHT, window.innerHeight - 16)),
});
const duration = (value?: string) => ({ "5min": 300, "10min": 600, "30min": 1800, "1h": 3600, "2h": 7200, "5h": 18000, "24h": 86400 }[(value ?? "").trim().toLowerCase().replace(/\s+/g, "")] ?? 1800);

export function MiniCloudDock() {
  const router = useRouter();
  const { user } = useSessionUser();
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [activeMenu, setActiveMenu] = useState<{ id: string; type: "actions" | "emoji" } | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [size, setSize] = useState({ width: 384, height: 480 });
  const [isMobile, setIsMobile] = useState(false);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [ended, setEnded] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const resize = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const isPopoutWindow = typeof window !== "undefined" && window.location.pathname === "/mini-cloud";
  useEffect(() => { const refresh = () => { const minimized = read(user?.id); setCloud(minimized); setIsPoppedOut(Boolean(minimized && localStorage.getItem(POPOUT_KEY) === minimized.id)); }; refresh(); addEventListener("clouds:minimized-cloud-changed", refresh); addEventListener("storage", refresh); return () => { removeEventListener("clouds:minimized-cloud-changed", refresh); removeEventListener("storage", refresh); }; }, [user?.id]);
  useEffect(() => {
    if (!isPopoutWindow) return;
    const clearPopout = () => {
      localStorage.removeItem(POPOUT_KEY);
      dispatchEvent(new Event("clouds:minimized-cloud-changed"));
    };
    addEventListener("pagehide", clearPopout);
    return () => removeEventListener("pagehide", clearPopout);
  }, [isPopoutWindow]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) ?? "null");
      if (isPopoutWindow) return;
      if (Number.isFinite(saved?.width) && Number.isFinite(saved?.height)) setSize(clampSize(saved.width, saved.height));
      else setSize(clampSize(384, 480));
    } catch { if (!isPopoutWindow) setSize(clampSize(384, 480)); }
    const onViewportResize = () => {
      if (isPopoutWindow) return;
      const mobile = window.matchMedia("(max-width: 639px)").matches;
      setIsMobile(mobile);
      setSize((current) => clampSize(current.width, current.height));
      setPos((current) => clampMiniCloudPosition(current.x, current.y, mobile ? Math.min(280, window.innerWidth - 16) : size.width, mobile ? Math.min(268, window.innerHeight - 16) : size.height, window.innerWidth, window.innerHeight));
    };
    onViewportResize();
    addEventListener("resize", onViewportResize);
    return () => removeEventListener("resize", onViewportResize);
  }, [isPopoutWindow, size.width, size.height]);
  useEffect(() => { setLeaveConfirmOpen(false); setIsLeaving(false); setLeaveError(""); setMessages([]); setDraft(""); setEnded(false); setReplyTo(null); setEditing(null); setActiveMenu(null); setSelectedMessageId(null); setPinnedId(null); setInteractionError(""); }, [cloud?.id]);
  useEffect(() => {
    if (!cloud?.id) return;
    const cloudId = cloud.id;
    let cancelled = false;
    fetch(`/api/clouds/${cloudId}`, { cache: "no-store" }).then((response) => response.json()).then((payload) => {
      if (cancelled || !payload?.cloud?.createdAt || read(user?.id)?.id !== cloudId) return;
      setCloud((current) => {
        if (current?.id !== cloudId) return current;
        const next = { ...current, duration: payload.cloud.duration, createdAt: payload.cloud.createdAt, startedAt: payload.cloud.startedAt };
        localStorage.setItem("clouds:minimized-cloud", JSON.stringify(next));
        setEnded(payload.cloud.status === "ended");
        return next;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [cloud?.id, user?.id]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!cloud?.id) return;
    const cloudId = cloud.id;
    let active = true;
    const load = () => fetch(`/api/clouds/${cloudId}/messages?take=30`, { cache: "no-store" }).then((response) => response.json()).then((payload) => {
      if (active && read(user?.id)?.id === cloudId && Array.isArray(payload.messages)) { setMessages((current) => payload.messages.reduce((list: Msg[], message: Msg) => mergeMessages(list, message), current)); setPinnedId(payload.pinnedMessage?.id ?? null); }
    }).catch(() => undefined);
    const socket = io(`${(SOCKET_URL || window.location.origin).replace(/\/+$/, "")}/clouds`, { auth: socketAuth, withCredentials: true, transports: ["polling", "websocket"] });
    socketRef.current = socket;
    socket.on("session:ready", () => { socket.emit("cloud:join", { cloudId, announce: false }); void load(); });
    socket.on("cloud:message:new", (message: Msg) => { if (message.cloudId === cloudId) setMessages((current) => mergeMessages(current, message)); });
    socket.on("cloud:message:pin:changed", (payload: { cloudId: string; messageId: string | null }) => { if (payload.cloudId === cloudId) setPinnedId(payload.messageId); });
    socket.on("cloud:reaction:changed", (payload: { cloudId: string; messageId: string; reaction: Reaction; removed: boolean }) => {
      if (payload.cloudId === cloudId) setMessages((current) => current.map((message) => message.id !== payload.messageId ? message : { ...message, reactions: payload.removed ? (message.reactions ?? []).filter((item) => item.id !== payload.reaction.id) : [...(message.reactions ?? []).filter((item) => item.id !== payload.reaction.id), payload.reaction] }));
    });
    void load();
    return () => { active = false; socket.emit("cloud:leave", { cloudId }); socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, [cloud?.id, user?.id]);

  const hasEnded = ended || Boolean(cloud && duration(cloud.duration) - cloudElapsedSeconds({ createdAt: cloud.createdAt ?? new Date(now).toISOString(), startedAt: cloud.startedAt }, now) <= 0);
  useEffect(() => {
    if (!cloud?.id || !hasEnded) return;
    setEnded(true);
    // This read triggers the backend expiry guard, placing the Cloud in Read
    // even when its final timer tick happened while the Mini Cloud was open.
    void fetch(`/api/clouds/${cloud.id}`, { cache: "no-store" }).catch(() => undefined);
    if (!isPopoutWindow) router.replace(`/read?cloud=${encodeURIComponent(cloud.id)}`);
  }, [cloud?.id, hasEnded, isPopoutWindow, router]);

  if (!cloud || cloud.ownerUserId !== user?.id || (isPoppedOut && !isPopoutWindow)) return null;
  const remaining = Math.max(0, duration(cloud.duration) - cloudElapsedSeconds({ createdAt: cloud.createdAt ?? new Date(now).toISOString(), startedAt: cloud.startedAt }, now));
  const hours = Math.floor(remaining / 3600), minutes = Math.floor((remaining % 3600) / 60), secs = remaining % 60;
  const clock = hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
  const expand = () => {
    localStorage.removeItem("clouds:minimized-cloud");
    localStorage.removeItem(POPOUT_KEY);
    dispatchEvent(new Event("clouds:minimized-cloud-changed"));
    const cloudUrl = `/cloud/${encodeURIComponent(cloud.id)}`;
    if (isPopoutWindow && window.opener && !window.opener.closed) {
      try {
        window.opener.location.assign(cloudUrl);
        window.opener.focus();
        window.close();
        return;
      } catch { /* A janela principal pode ter mudado de origem. */ }
    }
    router.push(cloudUrl);
  };
  const confirmLeave = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    setLeaveError("");
    const leavingCloud = cloud;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`/api/clouds/${leavingCloud.id}/${leavingCloud.isAuthor ? "exit" : "leave"}`, { method: "POST", credentials: "include", signal: controller.signal });
      if (!response.ok) throw new Error("Não foi possível sair da Cloud. Tente novamente.");
      localStorage.removeItem("clouds:minimized-cloud");
      dispatchEvent(new Event("clouds:minimized-cloud-changed"));
      setCloud(null);
      if (isPopoutWindow) {
        localStorage.removeItem(POPOUT_KEY);
        dispatchEvent(new Event("clouds:minimized-cloud-changed"));
        window.close();
      }
      setLeaveConfirmOpen(false);
    } catch (error) {
      setLeaveError(error instanceof Error && error.name !== "AbortError" ? error.message : "A saída demorou demais. Tente novamente.");
    } finally {
      window.clearTimeout(timeout);
      setIsLeaving(false);
    }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    const content = draft.trim();
    setInteractionError("");
    setSending(true);
    try {
      const response = await fetch(editing ? `/api/clouds/${encodeURIComponent(cloud.id)}/messages/${encodeURIComponent(editing.id)}` : `/api/clouds/${encodeURIComponent(cloud.id)}/messages`, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { content } : { type: "text", content, replyToMessageId: replyTo?.id ?? null }) });
      if (!response.ok) throw new Error("Não foi possível enviar a mensagem.");
      const payload = await response.json().catch(() => null) as { message?: Msg } | null;
      if (editing) setMessages((current) => current.map((message) => message.id === editing.id ? { ...message, content } : message));
      else if (payload?.message) setMessages((current) => mergeMessages(current, payload.message!));
      setDraft(""); setReplyTo(null); setEditing(null);
    } catch {
      setInteractionError("Não foi possível salvar a mensagem.");
    } finally {
      setSending(false);
    }
  };
  const react = async (message: Msg, emoji: string) => {
    setActiveMenu(null); setInteractionError("");
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/messages/${encodeURIComponent(message.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error();
      setMessages((current) => current.map((item) => item.id !== message.id ? item : { ...item, reactions: payload.removed ? (item.reactions ?? []).filter((reaction) => reaction.id !== payload.reaction.id) : [...(item.reactions ?? []).filter((reaction) => reaction.id !== payload.reaction.id), payload.reaction] }));
    } catch { setInteractionError("Não foi possível reagir à mensagem."); }
  };
  const pin = async (message: Msg) => {
    setInteractionError("");
    const unpin = pinnedId === message.id;
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/messages/${encodeURIComponent(message.id)}/${unpin ? "unpin" : "pin"}`, { method: "PATCH" });
      if (!response.ok) throw new Error();
      setPinnedId(unpin ? null : message.id);
    } catch { setInteractionError("Não foi possível atualizar a mensagem fixada."); }
  };
  const removeMessage = async (message: Msg) => {
    setActiveMenu(null); setInteractionError("");
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/messages/${encodeURIComponent(message.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setMessages((current) => current.filter((item) => item.id !== message.id));
      if (pinnedId === message.id) setPinnedId(null);
    } catch { setInteractionError("Não foi possível cancelar o envio."); }
  };
  const continueConversation = () => {
    localStorage.removeItem("clouds:minimized-cloud");
    localStorage.removeItem(POPOUT_KEY);
    dispatchEvent(new Event("clouds:minimized-cloud-changed"));
    router.push(`/?create=1&originCloudId=${encodeURIComponent(cloud.id)}`);
  };

  const width = isMobile ? Math.min(280, window.innerWidth - 16) : size.width;
  const height = isMobile ? Math.min(268, window.innerHeight - 16) : size.height;
  const openInSeparateWindow = () => {
    localStorage.setItem(POPOUT_KEY, cloud.id);
    dispatchEvent(new Event("clouds:minimized-cloud-changed"));
    const popup = window.open("/mini-cloud", "clouds-mini-cloud", `popup=yes,width=${Math.round(width)},height=${Math.round(height)},resizable=yes,scrollbars=no`);
    if (popup) {
      popup.focus();
      return;
    }
    localStorage.removeItem(POPOUT_KEY);
    dispatchEvent(new Event("clouds:minimized-cloud-changed"));
  };
  const dock = <aside style={isPopoutWindow ? { width: "100%", height: "100dvh" } : { transform: `translate(${pos.x}px,${pos.y}px)`, width, height, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100dvh - 16px)" }} className={`${isPopoutWindow ? "relative" : "fixed bottom-[calc(8px+env(safe-area-inset-bottom))] right-[calc(8px+env(safe-area-inset-right))] rounded-2xl border border-[#A855F7]/50 shadow-[0_20px_55px_rgba(0,0,0,.55)] sm:bottom-4 sm:right-4"} z-[90] flex flex-col overflow-hidden bg-black`}>
    <div onPointerDown={(event) => { if (isPopoutWindow || (event.target as HTMLElement).closest("button")) return; drag.current = { x: event.clientX - pos.x, y: event.clientY - pos.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) setPos(clampMiniCloudPosition(event.clientX - drag.current.x, event.clientY - drag.current.y, width, height, window.innerWidth, window.innerHeight)); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} className={`flex items-center border-b border-white/10 px-2 py-2 ${isPopoutWindow ? "" : "cursor-move touch-none"}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" /><p className="ml-1 min-w-0 flex-1 truncate text-[13px] font-bold text-white">{cloud.title}</p><div className="ml-2 flex shrink-0 items-center gap-0.5"><span className="mr-0.5 text-[14px] font-bold tabular-nums text-[#D8B4FE]">{clock}</span>{!isMobile && !isPopoutWindow && <button type="button" onClick={openInSeparateWindow} aria-label="Abrir Mini Cloud fora da aba" title="Manter Mini Cloud aberta fora do site" className="flex h-8 w-8 items-center justify-center text-[18px] leading-none text-white hover:text-[#D8B4FE]">▣</button>}<button type="button" onClick={expand} aria-label="Expandir Cloud" className="flex h-8 w-8 items-center justify-center text-[25px] leading-none text-white hover:text-[#D8B4FE]">↗</button><button type="button" onClick={() => { setLeaveError(""); setLeaveConfirmOpen(true); }} aria-label="Sair da Cloud" className="flex h-8 w-8 items-center justify-center text-[27px] leading-none text-white hover:text-[#D8B4FE]">×</button></div></div>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">{messages.map((message) => {
      if (message.type === "system") return <CloudSystemMessage key={message.id} message={{ content: message.content, senderId: message.sender?.id ?? "", senderName: message.sender?.displayName ?? "Alguém", senderAvatarUrl: message.sender?.avatarUrl }} />;
      const own = Boolean(user?.id && message.sender?.id === user.id);
      const counts = (message.reactions ?? []).reduce<Record<string, number>>((result, reaction) => { result[reaction.emoji] = (result[reaction.emoji] ?? 0) + 1; return result; }, {});
      return <div key={message.id} className={`group flex flex-col ${own ? "items-end" : "items-start"}`}>
        <p className="text-[10px] text-white/50">{own ? "Você" : message.sender?.displayName} · {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{pinnedId === message.id ? " · fixada" : ""}</p>
        <div className={`flex max-w-full items-center gap-1 ${own ? "flex-row-reverse" : ""}`}>
          <button type="button" aria-label="Mostrar opções da mensagem" aria-expanded={selectedMessageId === message.id} onClick={() => { setSelectedMessageId((current) => current === message.id ? null : message.id); setActiveMenu(null); }} className={`mt-0.5 min-w-0 break-words rounded-xl px-3 py-2 text-left text-[13px] text-white [overflow-wrap:anywhere] ${own ? "bg-[#A855F7]" : "bg-white/[.10]"}`}>
            {message.replyTo && <div className="mb-1 border-l-2 border-white/50 pl-2 text-[11px] text-white/70"><strong>{message.replyTo.sender}</strong><p className="line-clamp-2">{message.replyTo.content}</p></div>}{message.content}
          </button>
          {!hasEnded && <div className={`flex shrink-0 items-center gap-0.5 transition-opacity ${selectedMessageId === message.id || activeMenu?.id === message.id ? "opacity-100" : "pointer-events-none opacity-0 md:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:opacity-100"}`}>
            {cloud.isAuthor && <button type="button" aria-label={pinnedId === message.id ? "Desafixar mensagem" : "Fixar mensagem"} title={pinnedId === message.id ? "Desafixar" : "Fixar"} onClick={() => void pin(message)} className="h-7 w-7 rounded-full text-[14px] hover:bg-white/15">📌</button>}
            <button type="button" aria-label="Responder mensagem" title="Responder" onClick={() => { setEditing(null); setReplyTo(message); setActiveMenu(null); inputRef.current?.focus(); }} className="h-7 w-7 rounded-full text-[17px] hover:bg-white/15">↶</button>
            <button type="button" aria-label="Reagir à mensagem" title="Reagir" onClick={() => setActiveMenu(activeMenu?.id === message.id && activeMenu.type === "emoji" ? null : { id: message.id, type: "emoji" })} className="h-7 w-7 rounded-full text-[16px] hover:bg-white/15">☺</button>
            <button type="button" aria-label="Mais opções da mensagem" title="Mais opções" onClick={() => setActiveMenu(activeMenu?.id === message.id && activeMenu.type === "actions" ? null : { id: message.id, type: "actions" })} className="h-7 w-7 rounded-full text-[18px] hover:bg-white/15">⋮</button>
          </div>}
        </div>
        {Object.keys(counts).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{Object.entries(counts).map(([emoji, count]) => <button key={emoji} type="button" onClick={() => void react(message, emoji)} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{emoji} {count}</button>)}</div>}
      </div>;
    })}</div>
    {activeMenu && (() => { const message = messages.find((item) => item.id === activeMenu.id); if (!message) return null; const own = message.sender?.id === user?.id; return <div role="group" aria-label={activeMenu.type === "emoji" ? "Escolher reação" : "Opções da mensagem"} className="absolute bottom-14 right-3 z-20 max-w-[calc(100%-1.5rem)] rounded-xl border border-white/15 bg-[#15161C] p-2 shadow-xl">
      {activeMenu.type === "emoji" ? <div className="flex gap-1">{["❤️", "😂", "😮", "😢", "👍", "🔥"].map((emoji) => <button key={emoji} type="button" aria-label={`Reagir com ${emoji}`} onClick={() => void react(message, emoji)} className="h-8 w-8 rounded-lg hover:bg-white/10">{emoji}</button>)}</div> : <div className="flex flex-col text-left text-[12px]">
        {message.content && <button type="button" onClick={() => { void navigator.clipboard.writeText(message.content ?? "").then(() => setActiveMenu(null)).catch(() => setInteractionError("Não foi possível copiar a mensagem.")); }} className="rounded-lg px-3 py-2 text-left hover:bg-white/10">Copiar</button>}
        {own && message.type === "text" && <button type="button" onClick={() => { setReplyTo(null); setEditing(message); setDraft(message.content ?? ""); setActiveMenu(null); inputRef.current?.focus(); }} className="rounded-lg px-3 py-2 text-left hover:bg-white/10">Editar</button>}
        {own && <button type="button" onClick={() => void removeMessage(message)} className="rounded-lg px-3 py-2 text-left text-red-300 hover:bg-white/10">Cancelar envio</button>}
        <button type="button" onClick={() => { setActiveMenu(null); expand(); }} className="rounded-lg px-3 py-2 text-left hover:bg-white/10">Mais opções na Cloud</button>
      </div>}
      <button type="button" aria-label="Fechar opções" onClick={() => setActiveMenu(null)} className="absolute -right-1 -top-2 rounded-full bg-[#333] px-1 text-xs">×</button>
    </div>; })()}
    {interactionError && <p role="alert" className="px-3 text-[11px] text-red-300">{interactionError}</p>}
    {(replyTo || editing) && <div className="flex items-center gap-2 border-t border-white/10 px-3 py-1 text-[11px] text-white/70"><span className="min-w-0 flex-1 truncate">{editing ? "Editando" : `Respondendo a ${replyTo?.sender?.displayName}`}: {(editing ?? replyTo)?.content}</span><button type="button" aria-label="Cancelar resposta ou edição" onClick={() => { setReplyTo(null); setEditing(null); setDraft(""); }} className="px-1">×</button></div>}
    {hasEnded ? <div className="border-t border-white/10 p-2"><button type="button" onClick={continueConversation} className="w-full rounded-full bg-[#A855F7] px-3 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#9333EA]">Continuar essa conversa</button></div> : <form onPointerDown={(event) => event.stopPropagation()} onSubmit={send} className="flex gap-2 border-t border-white/10 p-2"><input ref={inputRef} type="text" name="mini-cloud-message" autoComplete="off" inputMode="text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Mensagem..." className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-2 text-[13px] text-white outline-none" /><button disabled={sending} className="rounded-full bg-[#7C3AED] px-3 text-[12px] font-bold text-white disabled:opacity-50">{editing ? "Salvar" : "Enviar"}</button></form>}
    {!isMobile && !isPopoutWindow && <div role="separator" aria-label="Redimensionar Mini Cloud" title="Arraste para ajustar largura e altura" onPointerDown={(event) => { resize.current = { x: event.clientX, y: event.clientY, ...size }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!resize.current) return; const next = clampSize(resize.current.width + resize.current.x - event.clientX, resize.current.height + event.clientY - resize.current.y); setSize(next); setPos((current) => ({ x: Math.max(next.width - window.innerWidth + 8, Math.min(8, current.x)), y: Math.max(next.height - window.innerHeight + 8, Math.min(8, current.y)) })); localStorage.setItem(SIZE_KEY, JSON.stringify(next)); }} onPointerUp={() => { resize.current = null; }} onPointerCancel={() => { resize.current = null; }} className="absolute bottom-0 left-0 z-10 h-7 w-7 cursor-nesw-resize touch-none rounded-bl-2xl text-center text-[23px] text-white hover:text-[#D8B4FE]">⌞</div>}
    {leaveConfirmOpen && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/95 p-5"><div className="w-full rounded-2xl border border-white/10 bg-black p-4 shadow-2xl"><h2 className="text-[16px] font-bold text-white">Sair da Cloud?</h2><p className="mt-2 text-[13px] leading-relaxed text-white/70">Você sairá desta conversa. As pessoas na Cloud verão a mensagem de que você saiu.</p>{leaveError && <p role="alert" className="mt-3 text-[12px] text-red-300">{leaveError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={isLeaving} onClick={() => setLeaveConfirmOpen(false)} className="rounded-full bg-white/[.08] px-3 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/[.14]">Cancelar</button><button type="button" disabled={isLeaving} onClick={() => void confirmLeave()} className="rounded-full bg-[#EF4444] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#DC2626] disabled:opacity-50">{isLeaving ? "Saindo..." : "Sair"}</button></div></div></div>}
  </aside>;
  return dock;
}
