"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { socketAuth } from "../lib/socket-auth";
import { clampMiniCloudPosition } from "../lib/mini-cloud-position";
import { CloudSystemMessage } from "./CloudSystemMessage";
import { useSessionUser } from "./session-user";

type Cloud = { id: string; title: string; isAuthor: boolean; ownerUserId: string; duration?: string; createdAt?: string };
type Msg = { id: string; cloudId: string; type: string; content: string | null; createdAt: string; sender: { id: string; displayName: string; avatarUrl?: string | null } };

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
  useEffect(() => { const refresh = () => { setCloud(read(user?.id)); setIsPoppedOut(Boolean(localStorage.getItem(POPOUT_KEY))); }; refresh(); addEventListener("clouds:minimized-cloud-changed", refresh); addEventListener("storage", refresh); return () => { removeEventListener("clouds:minimized-cloud-changed", refresh); removeEventListener("storage", refresh); }; }, [user?.id]);
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
      if (Number.isFinite(saved?.width) && Number.isFinite(saved?.height)) setSize(clampSize(saved.width, saved.height));
      else setSize(clampSize(384, 480));
    } catch { setSize(clampSize(384, 480)); }
    const onViewportResize = () => {
      const mobile = window.matchMedia("(max-width: 639px)").matches;
      setIsMobile(mobile);
      setSize((current) => clampSize(current.width, current.height));
      setPos((current) => clampMiniCloudPosition(current.x, current.y, mobile ? Math.min(280, window.innerWidth - 16) : size.width, mobile ? Math.min(268, window.innerHeight - 16) : size.height, window.innerWidth, window.innerHeight));
    };
    onViewportResize();
    addEventListener("resize", onViewportResize);
    return () => removeEventListener("resize", onViewportResize);
  }, [size.width, size.height]);
  useEffect(() => { setLeaveConfirmOpen(false); setIsLeaving(false); setLeaveError(""); setMessages([]); setDraft(""); setEnded(false); }, [cloud?.id]);
  useEffect(() => {
    if (!cloud?.id) return;
    const cloudId = cloud.id;
    let cancelled = false;
    fetch(`/api/clouds/${cloudId}`, { cache: "no-store" }).then((response) => response.json()).then((payload) => {
      if (cancelled || !payload?.cloud?.createdAt || read(user?.id)?.id !== cloudId) return;
      setCloud((current) => {
        if (current?.id !== cloudId) return current;
        const next = { ...current, duration: payload.cloud.duration, createdAt: payload.cloud.createdAt };
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
      if (active && read(user?.id)?.id === cloudId && Array.isArray(payload.messages)) setMessages((current) => payload.messages.reduce((list: Msg[], message: Msg) => mergeMessages(list, message), current));
    }).catch(() => undefined);
    const socket = io(`${(SOCKET_URL || window.location.origin).replace(/\/+$/, "")}/clouds`, { auth: socketAuth, withCredentials: true, transports: ["polling", "websocket"] });
    socketRef.current = socket;
    socket.on("session:ready", () => { socket.emit("cloud:join", { cloudId, announce: false }); void load(); });
    socket.on("cloud:message:new", (message: Msg) => { if (message.cloudId === cloudId) setMessages((current) => mergeMessages(current, message)); });
    void load();
    return () => { active = false; socket.emit("cloud:leave", { cloudId }); socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, [cloud?.id, user?.id]);

  const hasEnded = ended || Boolean(cloud && duration(cloud.duration) - Math.floor((now - new Date(cloud.createdAt ?? now).getTime()) / 1000) <= 0);
  useEffect(() => {
    if (!cloud?.id || !hasEnded) return;
    setEnded(true);
    // This read triggers the backend expiry guard, placing the Cloud in Read
    // even when its final timer tick happened while the Mini Cloud was open.
    void fetch(`/api/clouds/${cloud.id}`, { cache: "no-store" }).catch(() => undefined);
    if (!isPopoutWindow) router.replace(`/read?cloud=${encodeURIComponent(cloud.id)}`);
  }, [cloud?.id, hasEnded, isPopoutWindow, router]);

  if (!cloud || cloud.ownerUserId !== user?.id || (isPoppedOut && !isPopoutWindow)) return null;
  const remaining = Math.max(0, duration(cloud.duration) - Math.floor((now - new Date(cloud.createdAt ?? now).getTime()) / 1000));
  const hours = Math.floor(remaining / 3600), minutes = Math.floor((remaining % 3600) / 60), secs = remaining % 60;
  const clock = hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
  const expand = () => { localStorage.removeItem("clouds:minimized-cloud"); dispatchEvent(new Event("clouds:minimized-cloud-changed")); router.push(`/cloud/${cloud.id}`); };
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
  const send = async (event: FormEvent) => { event.preventDefault(); if (!draft.trim()) return; const content = draft.trim(); setDraft(""); await fetch(`/api/clouds/${cloud.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "text", content }) }); };
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
  const dock = <aside style={{ transform: `translate(${pos.x}px,${pos.y}px)`, width, height, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100dvh - 16px)" }} className="fixed bottom-[calc(8px+env(safe-area-inset-bottom))] right-[calc(8px+env(safe-area-inset-right))] z-[90] flex flex-col overflow-hidden rounded-2xl border border-[#A855F7]/50 bg-black shadow-[0_20px_55px_rgba(0,0,0,.55)] sm:bottom-4 sm:right-4">
    <div onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button")) return; drag.current = { x: event.clientX - pos.x, y: event.clientY - pos.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) setPos(clampMiniCloudPosition(event.clientX - drag.current.x, event.clientY - drag.current.y, width, height, window.innerWidth, window.innerHeight)); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} className="flex items-center border-b border-white/10 px-2 py-2 cursor-move touch-none"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" /><p className="ml-1 min-w-0 flex-1 truncate text-[13px] font-bold text-white">{cloud.title}</p><div className="ml-2 flex shrink-0 items-center gap-0.5"><span className="mr-0.5 text-[14px] font-bold tabular-nums text-[#D8B4FE]">{clock}</span>{!isMobile && !isPopoutWindow && <button type="button" onClick={openInSeparateWindow} aria-label="Abrir Mini Cloud fora da aba" title="Manter Mini Cloud aberta fora do site" className="flex h-8 w-8 items-center justify-center text-[18px] leading-none text-white hover:text-[#D8B4FE]">▣</button>}<button type="button" onClick={expand} aria-label="Expandir Cloud" className="flex h-8 w-8 items-center justify-center text-[25px] leading-none text-white hover:text-[#D8B4FE]">↗</button><button type="button" onClick={() => { setLeaveError(""); setLeaveConfirmOpen(true); }} aria-label="Sair da Cloud" className="flex h-8 w-8 items-center justify-center text-[27px] leading-none text-white hover:text-[#D8B4FE]">×</button></div></div>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">{messages.map((message) => { if (message.type === "system") return <CloudSystemMessage key={message.id} message={{ content: message.content, senderId: message.sender?.id ?? "", senderName: message.sender?.displayName ?? "Alguém", senderAvatarUrl: message.sender?.avatarUrl }} />; const own = Boolean(user?.id && message.sender?.id === user.id); return <div key={message.id} className={own ? "flex flex-col items-end" : "flex flex-col items-start"}><p className="text-[10px] text-white/50">{own ? "Você" : message.sender?.displayName} · {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><p className={`mt-0.5 w-fit max-w-full break-words rounded-xl px-3 py-2 text-[13px] text-white ${own ? "bg-[#A855F7]" : "bg-white/[.10]"}`}>{message.content}</p></div>; })}</div>
    {hasEnded ? <div className="border-t border-white/10 p-2"><button type="button" onClick={continueConversation} className="w-full rounded-full bg-[#A855F7] px-3 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#9333EA]">Continuar essa conversa</button></div> : <form onPointerDown={(event) => event.stopPropagation()} onSubmit={send} className="flex gap-2 border-t border-white/10 p-2"><input type="text" name="mini-cloud-message" autoComplete="off" inputMode="text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Mensagem..." className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-2 text-[13px] text-white outline-none" /><button className="rounded-full bg-[#7C3AED] px-3 text-[12px] font-bold text-white">Enviar</button></form>}
    {!isMobile && <div role="separator" aria-label="Redimensionar Mini Cloud" title="Arraste para ajustar largura e altura" onPointerDown={(event) => { resize.current = { x: event.clientX, y: event.clientY, ...size }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!resize.current) return; const next = clampSize(resize.current.width + resize.current.x - event.clientX, resize.current.height + event.clientY - resize.current.y); setSize(next); setPos((current) => ({ x: Math.max(next.width - window.innerWidth + 8, Math.min(8, current.x)), y: Math.max(next.height - window.innerHeight + 8, Math.min(8, current.y)) })); localStorage.setItem(SIZE_KEY, JSON.stringify(next)); }} onPointerUp={() => { resize.current = null; }} onPointerCancel={() => { resize.current = null; }} className="absolute bottom-0 left-0 z-10 h-7 w-7 cursor-nesw-resize touch-none rounded-bl-2xl text-center text-[23px] text-white hover:text-[#D8B4FE]">⌞</div>}
    {leaveConfirmOpen && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/95 p-5"><div className="w-full rounded-2xl border border-white/10 bg-black p-4 shadow-2xl"><h2 className="text-[16px] font-bold text-white">Sair da Cloud?</h2><p className="mt-2 text-[13px] leading-relaxed text-white/70">Você sairá desta conversa. As pessoas na Cloud verão a mensagem de que você saiu.</p>{leaveError && <p role="alert" className="mt-3 text-[12px] text-red-300">{leaveError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={isLeaving} onClick={() => setLeaveConfirmOpen(false)} className="rounded-full bg-white/[.08] px-3 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/[.14]">Cancelar</button><button type="button" disabled={isLeaving} onClick={() => void confirmLeave()} className="rounded-full bg-[#EF4444] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#DC2626] disabled:opacity-50">{isLeaving ? "Saindo..." : "Sair"}</button></div></div></div>}
  </aside>;
  return dock;
}
