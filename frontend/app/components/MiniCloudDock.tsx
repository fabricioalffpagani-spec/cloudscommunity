"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSessionUser } from "./session-user";

type Cloud = { id: string; title: string; isAuthor: boolean; duration?: string; createdAt?: string };
type Msg = { id: string; content: string | null; createdAt: string; sender: { id?: string; displayName: string } };

const read = (): Cloud | null => { try { const value = localStorage.getItem("clouds:minimized-cloud"); return value ? JSON.parse(value) : null; } catch { return null; } };
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
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { const refresh = () => setCloud(read()); refresh(); addEventListener("clouds:minimized-cloud-changed", refresh); return () => removeEventListener("clouds:minimized-cloud-changed", refresh); }, []);
  useEffect(() => { if (!cloud?.id) return; fetch(`/api/clouds/${cloud.id}`, { cache: "no-store" }).then((response) => response.json()).then((payload) => { const source = payload?.cloud; if (!source?.createdAt) return; const next = { ...cloud, duration: source.duration, createdAt: source.createdAt }; setCloud(next); localStorage.setItem("clouds:minimized-cloud", JSON.stringify(next)); }).catch(() => {}); }, [cloud?.id]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!cloud) return; const load = () => fetch(`/api/clouds/${cloud.id}/messages?take=12`).then((response) => response.json()).then((payload) => setMessages(payload.messages ?? [])).catch(() => {}); load(); const timer = setInterval(load, 4000); return () => clearInterval(timer); }, [cloud]);

  if (!cloud) return null;
  const remaining = Math.max(0, duration(cloud.duration) - Math.floor((now - new Date(cloud.createdAt ?? now).getTime()) / 1000));
  const hours = Math.floor(remaining / 3600), minutes = Math.floor((remaining % 3600) / 60), secs = remaining % 60;
  const clock = hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
  const expand = () => { localStorage.removeItem("clouds:minimized-cloud"); dispatchEvent(new Event("clouds:minimized-cloud-changed")); router.push(`/cloud/${cloud.id}`); };
  const confirmLeave = async () => { if (isLeaving) return; setIsLeaving(true); setLeaveError(""); try { const response = await fetch(`/api/clouds/${cloud.id}/${cloud.isAuthor ? "exit" : "leave"}`, { method: "POST", credentials: "include" }); if (!response.ok) throw new Error(); localStorage.removeItem("clouds:minimized-cloud"); dispatchEvent(new Event("clouds:minimized-cloud-changed")); } catch { setLeaveError("Não foi possível sair da Cloud. Tente novamente."); setIsLeaving(false); } };
  const send = async (event: FormEvent) => { event.preventDefault(); if (!draft.trim()) return; const content = draft.trim(); setDraft(""); await fetch(`/api/clouds/${cloud.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "text", content }) }); };

  return <aside onPointerDown={(event) => { drag.current = { x: event.clientX - pos.x, y: event.clientY - pos.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) setPos({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }} style={{ transform: `translate(${pos.x}px,${pos.y}px)` }} className="fixed bottom-4 right-4 z-[90] flex h-[min(24rem,calc(100dvh-2rem))] w-[min(20rem,calc(100vw-3rem))] touch-none flex-col overflow-hidden rounded-2xl border border-[#A855F7]/50 bg-[#160a38] shadow-[0_20px_55px_rgba(0,0,0,.55)] md:h-[min(30rem,calc(100dvh-2rem))] md:w-[min(24rem,calc(100vw-2rem))]">
    <div className="flex cursor-move items-center gap-2 border-b border-white/10 px-3 py-2.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{cloud.title}</p><span className="text-[15px] font-bold tabular-nums text-[#D8B4FE]">{clock}</span><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={expand} aria-label="Expandir Cloud" className="flex h-9 w-9 items-center justify-center text-2xl leading-none text-white/70 hover:text-white">↗</button><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setLeaveError(""); setLeaveConfirmOpen(true); }} aria-label="Sair da Cloud" className="flex h-9 w-9 items-center justify-center text-2xl leading-none text-white/60 hover:text-white">×</button></div>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">{messages.map((message) => { const own = Boolean(user?.id && message.sender?.id === user.id); return <div key={message.id} className={own ? "flex flex-col items-end" : "flex flex-col items-start"}><p className="text-[10px] text-white/40">{own ? "Você" : message.sender?.displayName} · {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><p className={`mt-0.5 w-fit max-w-full break-words rounded-xl px-3 py-2 text-[13px] text-white ${own ? "bg-[#A855F7]" : "bg-white/[.08]"}`}>{message.content}</p></div>; })}</div>
    <form onPointerDown={(event) => event.stopPropagation()} onSubmit={send} className="flex gap-2 border-t border-white/10 p-3"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Mensagem..." className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-2 text-[13px] text-white outline-none" /><button className="rounded-full bg-[#7C3AED] px-3 text-[12px] font-bold text-white">Enviar</button></form>
    {leaveConfirmOpen && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0420]/95 p-5" onPointerDown={(event) => event.stopPropagation()}><div className="w-full rounded-2xl border border-white/10 bg-[#1d0d44] p-4 shadow-2xl"><h2 className="text-[16px] font-bold text-white">Sair da Cloud?</h2><p className="mt-2 text-[13px] leading-relaxed text-white/70">Você sairá desta conversa. As pessoas na Cloud verão a mensagem de que você saiu.</p>{leaveError && <p role="alert" className="mt-3 text-[12px] text-red-300">{leaveError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={isLeaving} onClick={() => setLeaveConfirmOpen(false)} className="rounded-full bg-white/[.08] px-3 py-2 text-[12px] font-semibold text-white/80 hover:bg-white/[.14]">Cancelar</button><button type="button" disabled={isLeaving} onClick={() => void confirmLeave()} className="rounded-full bg-[#EF4444] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#DC2626] disabled:opacity-50">{isLeaving ? "Saindo..." : "Sair"}</button></div></div></div>}
  </aside>;
}
