"use client";

import Link from "next/link";
import {
  useState, useRef, useEffect, useCallback,
} from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";


// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "online" | "offline" | "busy";

type Conversation = {
  id: string;
  name: string;
  lastMessage: string;
  lastMsgType?: "audio" | "text";
  time: string;
  status: Status;
  unread?: number;
  avatar: string;
  color: string;
};

type ReplyMeta = { id: string; sender: string; content: string };

type Msg =
  | { id: string; type: "date"; label: string }
  | { id: string; side: "left" | "right"; type: "text"; sender: string; content: string; time: string; replyTo?: ReplyMeta; reaction?: string }
  | { id: string; side: "left" | "right"; type: "audio"; sender: string; time: string; duration: string; audioUrl?: string; waveform?: number[]; replyTo?: ReplyMeta; reaction?: string }
  | { id: string; side: "left" | "right"; type: "link"; sender: string; content: string; url: string; time: string; replyTo?: ReplyMeta; reaction?: string };

// ─── Static seed data ─────────────────────────────────────────────────────────

const INIT_CONVS: Conversation[] = [
  { id: "joao",  name: "João Silva", lastMessage: "Acompanhe a esta Cloud comigo!", time: "13:23", status: "online", unread: 15, avatar: "JS", color: "#8B5CF6" },
  { id: "ana",   name: "Ana Costa",  lastMessage: "Áudio gravado", lastMsgType: "audio", time: "11:18", status: "busy", avatar: "AC", color: "#3B82F6" },
  { id: "pedro", name: "Pedro Lima", lastMessage: "Oi! Tudo bem?", time: "09:05", status: "offline", avatar: "PL", color: "#22C55E" },
];

const INIT_MSGS: Record<string, Msg[]> = {
  joao: [
    { id: "d1", type: "date", label: "02 de junho de 2026" },
    { id: "m1", side: "left",  type: "text", sender: "João",  content: "oi", time: "11:22" },
    { id: "d2", type: "date", label: "Hoje" },
    { id: "m2", side: "right", type: "text", sender: "Você",  content: "oi", time: "13:20" },
    { id: "m3", side: "right", type: "audio", sender: "Você", time: "13:22", duration: "0:04" },
    { id: "m4", side: "right", type: "link", sender: "Você",  content: "Acompanhe a esta Cloud comigo! testeee", url: "http://localhost:3000/cloud/c87c53a9-d0b5-4461-a5ef-cb88d8e0c30d", time: "13:23" },
  ],
  ana:   [{ id: "d1", type: "date", label: "Hoje" }, { id: "m1", side: "left", type: "audio", sender: "Ana", time: "11:18", duration: "0:12" }],
  pedro: [{ id: "d1", type: "date", label: "Hoje" }, { id: "m1", side: "left", type: "text", sender: "Pedro", content: "Oi! Tudo bem?", time: "09:05" }],
};

const DIRECT_MESSAGES_STORAGE_KEY = "cloudscommunity:direct-messages:v1";

// ─── Icons ────────────────────────────────────────────────────────────────────

function I({ d, size = 20, fill }: { d: string | string[]; size?: number; fill?: boolean }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} />)}
    </svg>
  );
}

const EMOJI_BANK = ["😀","🔥","❤️","😂","🙌","🎉","💬","👍","👀","✨"];

const icons = {
  search:       () => <svg viewBox="0 0 24 24" width={23} height={23} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path d="M20 20l-3.5-3.5"/></svg>,
  upload:       () => <svg viewBox="0 0 24 24" width={23} height={23} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>,
  bell:         (s=23) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>,
  gear:         (s=23) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>,
  send:         () => <I d={["M22 2 11 13","m22 2-7 20-4-9-9-4 20-7Z"]} size={18}/>,
  mic:          (s=18) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"/><path d="M19 12a7 7 0 0 1-14 0"/><path d="M12 19v3"/></svg>,
  stop:         () => <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>,
  play:         () => <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true"><path d="M8 5.14v14l11-7-11-7Z"/></svg>,
  plus:         (s=18) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>,
  emoji:        () => <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14s1 2 3.5 2 3.5-2 3.5-2"/><circle cx="9" cy="10" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".8" fill="currentColor" stroke="none"/></svg>,
  phone:        () => <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16a2 2 0 0 0 .27.92Z"/></svg>,
  search_sm:    () => <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path d="M20 20l-3.5-3.5"/></svg>,
  dots:         () => <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>,
  check2:       () => <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 12 5 5L17 7"/><path d="m9 12 5 5L22 7"/></svg>,
  x:            (s=18) => <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function uid() { return Math.random().toString(36).slice(2); }

function Avatar({ initials, size = 36, color = "#8B5CF6" }: { initials: string; size?: number; color?: string }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

const statusDot: Record<Status, string> = {
  online: "bg-[#22C55E]", busy: "bg-[#F59E0B]", offline: "bg-[#6B7280]",
};

// ─── Audio recorder hook ──────────────────────────────────────────────────────

type RecState = "idle" | "recording" | "paused";

function useRecorder(onDone: (url: string, dur: string, waveform?: number[]) => void) {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canceledRef = useRef(false);
  const waveformRef = useRef<number[]>([]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const start = useCallback(async () => {
    try {
      canceledRef.current = false;
      waveformRef.current = Array.from({ length: 28 }, (_, i) => 4 + ((i * 7) % 18));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (!canceledRef.current) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              onDone(reader.result, fmt(seconds), waveformRef.current.slice());
            }
          };
          reader.readAsDataURL(blob);
        }
        stream.getTracks().forEach(t => t.stop());
        setSeconds(0);
        setState("idle");
      };
      rec.start();
      mediaRef.current = rec;
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);

      // update waveform snapshot periodically while recording
      const wfIv = setInterval(() => {
        waveformRef.current = waveformRef.current.map(() => 4 + Math.floor(Math.random() * 18));
      }, 240);
      // store ref to clear when stopped
      (timerRef as any).wfIv = wfIv;
    } catch { alert("Permissão de microfone negada."); }
  }, [onDone]);

  const pause = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state !== "recording") return;
    try { mediaRef.current.pause(); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } setState("paused"); } catch {}
  }, []);

  const resume = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state !== "paused") return;
    try { mediaRef.current.resume(); if (!timerRef.current) timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000); setState("recording"); } catch {}
  }, []);

  const stop = useCallback(() => {
    if (!mediaRef.current) return;
    try { mediaRef.current.stop(); } catch { }
  }, []);

  const cancel = useCallback(() => {
    canceledRef.current = true;
    if (mediaRef.current && (mediaRef.current.state === "recording" || mediaRef.current.state === "paused")) {
      try { mediaRef.current.stop(); } catch {}
    }
    chunksRef.current = [];
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if ((timerRef as any).wfIv) { clearInterval((timerRef as any).wfIv); (timerRef as any).wfIv = null; }
    setSeconds(0);
    setState("idle");
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); if ((timerRef as any).wfIv) clearInterval((timerRef as any).wfIv); if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); }, []);

  return { state, seconds, fmt, start, pause, resume, stop, cancel };
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MsgBubble({
  msg,
  startReply,
  reactionPickerFor,
  setReactionPickerFor,
  addReaction,
}: {
  msg: Exclude<Msg, { type: "date" }>;
  startReply: (message: Exclude<Msg, { type: "date" }>) => void;
  reactionPickerFor: string | null;
  setReactionPickerFor: (id: string | null) => void;
  addReaction: (messageId: string, emoji: string) => void;
}) {
  const isRight = msg.side === "right";
  const initials = isRight ? "F" : msg.sender.slice(0, 2).toUpperCase();
  const color = isRight ? "#8B5CF6" : "#3B82F6";

  const bubble = () => {
    if (msg.type === "text") return (
      <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-white ${isRight ? "rounded-br-[4px] bg-[#7C3AED]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1C1F2E]"}`}>
        {msg.content}
      </div>
    );
    if (msg.type === "audio") return (
      <AudioMessageBubble isRight={isRight} msg={msg} />
    );
    if (msg.type === "link") return (
      <div className={`flex flex-col gap-2 rounded-2xl px-4 py-3.5 ${isRight ? "rounded-br-[4px] bg-[#7C3AED]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1C1F2E]"}`} style={{ maxWidth: 340 }}>
        <p className="text-[15px] leading-relaxed text-white">{msg.content}</p>
        <div className="rounded-xl bg-black/25 px-3 py-2">
          <p className="text-[11px] text-white/50 mb-0.5">Link:</p>
          <a href={msg.url} target="_blank" rel="noopener noreferrer"
            className="break-all text-[12px] text-[#C084FC] underline hover:text-white/80">{msg.url}</a>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex items-end gap-2.5 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-9 shrink-0"><Avatar initials={initials} size={34} color={color} /></div>
      <div className={`flex flex-col gap-2 ${isRight ? "items-end" : "items-start"}`} style={{ maxWidth: "72%" }}>
        {msg.sender === "Você" ? (
          <span className="px-1 text-[12px] font-semibold text-white/40">{msg.sender}</span>
        ) : (
          <Link href={`/users/${encodeURIComponent(msg.sender.replace(/^@/, "").trim())}`} className="px-1 text-[12px] font-semibold text-white/40 transition hover:text-white hover:underline">
            {msg.sender}
          </Link>
        )}
        {msg.replyTo && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/5 px-3 py-2.5 text-[13px] text-white/70">
            {msg.replyTo.sender === "Você" ? (
              <p className="font-semibold text-white">{msg.replyTo.sender}</p>
            ) : (
              <Link href={`/users/${encodeURIComponent(msg.replyTo.sender.replace(/^@/, "").trim())}`} className="font-semibold text-white transition hover:underline">
                {msg.replyTo.sender}
              </Link>
            )}
            <p className="mt-1 leading-snug line-clamp-2">{msg.replyTo.content}</p>
          </div>
        )}
        {bubble()}
        <div className={`flex flex-wrap items-center gap-2 px-1 text-[12px] text-white/40 ${isRight ? "flex-row-reverse" : ""}`}>
          <button type="button" onClick={() => startReply(msg)}
            className="rounded-full px-2.5 py-1 transition hover:bg-white/10">
            Responder
          </button>
          <button type="button" onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
            className="rounded-full px-2.5 py-1 transition hover:bg-white/10">
            Reagir
          </button>
          {msg.reaction && (
            <span className="rounded-full bg-white/10 px-2 py-1 text-[14px]">
              {msg.reaction}
            </span>
          )}
        </div>
        {reactionPickerFor === msg.id && (
          <div className="mt-2 flex flex-wrap gap-2 px-1">
            {EMOJI_BANK.map(emoji => (
              <button key={emoji} type="button" onClick={() => addReaction(msg.id, emoji)}
                className="rounded-2xl border border-white/[0.08] bg-[#15161C] px-3 py-2.5 text-[20px] transition hover:border-white/20 hover:bg-white/10">
                {emoji}
              </button>
            ))}
            <button type="button" onClick={() => setReactionPickerFor(null)}
              className="rounded-2xl border border-white/[0.08] bg-[#15161C] px-3 py-2.5 text-[15px] text-white/80 transition hover:border-white/20 hover:bg-white/10">
              Fechar
            </button>
          </div>
        )}
        <div className={`flex items-center gap-1 px-1 text-[11px] text-white/30 ${isRight ? "flex-row-reverse" : ""}`}>
          <span>{msg.time}</span>
          {isRight && <span className="text-[#C084FC]">{icons.check2()}</span>}
        </div>
      </div>
    </div>
  );
}

function AudioMessageBubble({ isRight, msg }: { isRight: boolean; msg: Extract<Msg, { type: "audio" }> }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnded = () => setPlaying(false);
    a.addEventListener("ended", onEnded);
    return () => a.removeEventListener("ended", onEnded);
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); }
  };

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${isRight ? "rounded-br-[4px] bg-[#7C3AED]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1C1F2E]"}`} style={{ minWidth: 250 }}>
      <button type="button" aria-label={playing ? "Pause" : "Play"}
        onClick={toggle}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${isRight ? "bg-white/20 hover:bg-white/30" : "bg-[#7C3AED] hover:bg-[#6D28D9]"}`}>
        {playing ? icons.x(14) : icons.play()}
      </button>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-end">
          <div className="flex items-end gap-[4px]" style={{ height: 30 }}>
            {(msg.waveform ?? Array.from({ length: 28 }, () => 6)).map((h, i) => (
              <span key={i} className="block w-[3px] rounded-full bg-white/80" style={{ height: `${h}px` }} />
            ))}
          </div>
        </div>

        <div className="flex justify-between text-[11px] text-white/50"><span>{msg.audioUrl ? "" : "0:00"}</span><span>{msg.duration}</span></div>
        {msg.audioUrl && <audio ref={audioRef} src={msg.audioUrl} className="hidden" />}
      </div>
    </div>
  );
}

// ─── Waveform visual ────────────────────────────────────────────────────────

function Waveform({ active, paused }: { active?: boolean; paused?: boolean }) {
  const BAR_COUNT = 28;
  const [heights, setHeights] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, (_, i) => 4 + ((i * 7) % 18)));

  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    if (active && !paused) {
      iv = setInterval(() => {
        setHeights(h => h.map(() => 4 + Math.floor(Math.random() * 18)));
      }, 240);
    } else if (active && paused) {
      // lighter subtle movement when paused
      iv = setInterval(() => {
        setHeights(h => h.map(() => 6 + Math.floor(Math.random() * 6)));
      }, 800);
    } else {
      setHeights(Array.from({ length: BAR_COUNT }, (_, i) => 4 + ((i * 7) % 18)));
    }
    return () => { if (iv) clearInterval(iv); };
  }, [active, paused]);

  return (
    <div className="flex items-end gap-[4px]" style={{ height: 26 }}>
      {heights.map((h, i) => (
        <span key={i} className="block w-[3px] rounded-full bg-white/80 transition-all" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useSessionUser();
  const [convs, setConvs] = useState<Conversation[]>(INIT_CONVS);
  const [activeId, setActiveId] = useState("joao");
  const [contactSearch, setContactSearch] = useState("");
  const [messages, setMessages] = useState<Record<string, Msg[]>>(INIT_MSGS);
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyMeta | null>(null);
  const [typing, setTyping] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [messagesHydrated, setMessagesHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = convs.find(c => c.id === activeId)!;
  const msgs = messages[activeId] ?? [];
  const normalizedSearch = contactSearch
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
  const filteredConvs = convs.filter(conv =>
    conv.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedSearch)
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DIRECT_MESSAGES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, Msg[]>;
        setMessages(prev => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore malformed local data and continue with the seed conversations.
    } finally {
      setMessagesHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!messagesHydrated) return;
    localStorage.setItem(DIRECT_MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages, messagesHydrated]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (!text.trim()) {
      setTyping(false);
      return;
    }
    setTyping(true);
    const timer = setTimeout(() => setTyping(false), 1200);
    return () => clearTimeout(timer);
  }, [text]);

  const handleSelectEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    setEmojiOpen(false);
  };

  const startReply = (message: Exclude<Msg, { type: "date" }>) => {
    setReplyTo({ id: message.id, sender: message.sender, content: message.type === "audio" ? "Áudio" : message.content });
    setEmojiOpen(false);
    setReactionPickerFor(null);
  };

  const addReaction = (messageId: string, emoji: string) => {
    setMessages(prev => ({
      ...prev,
      [activeId]: prev[activeId].map(msg => msg.id === messageId ? { ...msg, reaction: emoji } : msg),
    }));
    setReactionPickerFor(null);
  };

  // Send text message
  const sendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const msg: Msg = {
      id: uid(),
      side: "right",
      type: "text",
      sender: "Você",
      content: trimmed,
      time: now(),
      replyTo: replyTo ? { id: replyTo.id, sender: replyTo.sender, content: replyTo.content } : undefined,
    };
    setMessages(prev => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), msg] }));
    setConvs(prev => prev.map(c => c.id === activeId ? { ...c, lastMessage: trimmed, lastMsgType: "text", time: now() } : c));
    setText("");
    setReplyTo(null);
    setEmojiOpen(false);
  };

  // Send audio message (called by recorder)
  const sendAudio = useCallback((audioUrl: string, duration: string, waveform?: number[]) => {
    const msg: Msg = {
      id: uid(),
      side: "right",
      type: "audio",
      sender: "Você",
      time: now(),
      duration,
      audioUrl,
      waveform,
      replyTo: replyTo ? { id: replyTo.id, sender: replyTo.sender, content: replyTo.content } : undefined,
    };
    setMessages(prev => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), msg] }));
    setConvs(prev => prev.map(c => c.id === activeId ? { ...c, lastMessage: "Áudio gravado", lastMsgType: "audio", time: now() } : c));
    setReplyTo(null);
    setEmojiOpen(false);
  }, [activeId, replyTo]);

  const recorder = useRecorder(sendAudio);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#09090B] text-white">


      {/* ── HEADER — identical to Home ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between gap-4 px-3 lg:px-6">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <HeaderBrand />
          </Link>

          {/* Action icons */}
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Buscar"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">{icons.search()}</button>
            <button type="button" aria-label="Notificações"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">{icons.bell()}</button>
            <Link href="/settings" aria-label="Configurações"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">{icons.gear()}</Link>
            <Link href="/profile" aria-label="Meu perfil"
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#7C3AED] text-[17px] font-bold text-white transition hover:bg-[#6D28D9]">
              <SessionUserAvatar user={user} size={48} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Layout below header ── */}
      <div className="flex flex-1 overflow-hidden pt-[88px]">

        {/* Sidebar */}
        <aside className="flex w-[400px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0D0D10]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <span className="text-[17px] font-bold text-white">Mensagens</span>
            <Link href="/meet" aria-label="Nova conversa"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/70 hover:bg-white/10">
              {icons.plus(18)}
            </Link>
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2.5">
              {icons.search_sm()}
              <input
                type="search"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Buscar contatos..."
                aria-label="Buscar contatos"
                className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {filteredConvs.map(conv => (
              <div key={conv.id} role="button" tabIndex={0} onClick={() => setActiveId(conv.id)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveId(conv.id); } }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition cursor-pointer ${activeId === conv.id ? "bg-[#1C1F2E]" : "hover:bg-white/[0.04]"}`}>
                <Link href={`/users/${conv.id}`} className="relative shrink-0">
                  <Avatar initials={conv.avatar} size={44} color={conv.color} />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0D0D10] ${statusDot[conv.status]}`} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/users/${conv.id}`} className="truncate text-[14px] font-semibold text-white hover:underline">
                      {conv.name}
                    </Link>
                    <span className="shrink-0 text-[12px] text-white/40">{conv.time}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {conv.lastMsgType === "audio" && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true"><path d="M8 10a2 2 0 0 0 2-2V5a2 2 0 1 0-4 0v3a2 2 0 0 0 2 2ZM13 8a5 5 0 0 1-10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    <span className="truncate text-[13px] text-white/50">{conv.lastMessage}</span>
                    {(conv.unread ?? 0) > 0 && <span className="ml-auto shrink-0 rounded-full bg-[#7C3AED] px-1.5 py-0.5 text-[11px] font-bold text-white">{conv.unread}</span>}
                  </div>
                </div>
              </div>
            ))}
            {filteredConvs.length === 0 && (
              <p className="px-3 py-6 text-center text-[14px] text-white/40">
                Nenhum contato encontrado.
              </p>
            )}
          </div>

          <div className="border-t border-white/[0.07] px-5 py-4">
            <Link href="/profile" className="flex items-center gap-3">
              <SessionUserAvatar user={user} size={38} />
              <span className="text-[14px] font-medium text-white/70">Você</span>
            </Link>
          </div>
        </aside>

        {/* Chat area */}
        <main className="flex flex-1 flex-col overflow-hidden">

          {/* Chat header */}
          <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0D0D10] px-6 py-4">
            <div className="flex items-center gap-3">
              <Link href={`/users/${activeConv.id}`} className="relative">
                <Avatar initials={activeConv.avatar} size={44} color={activeConv.color} />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0D0D10] ${statusDot[activeConv.status]}`} />
              </Link>
              <div>
                <Link href={`/users/${activeConv.id}`} className="text-[16px] font-semibold text-white hover:underline">
                  {activeConv.name}
                </Link>
                <p className={`text-[13px] ${activeConv.status === "online" ? "text-[#22C55E]" : activeConv.status === "busy" ? "text-[#F59E0B]" : "text-white/40"}`}>
                  {activeConv.status === "online" ? "online" : activeConv.status === "busy" ? "ocupado" : "offline"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Call button */}
              <button type="button" aria-label="Ligar"
                onClick={() => setCalling(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white transition">
                {icons.phone()}
              </button>
              <button type="button" aria-label="Buscar na conversa"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white transition">
                {icons.search_sm()}
              </button>
            </div>
          </div>
          {typing && (
            <div className="border-b border-white/[0.07] bg-[#0D0D10] px-5 py-2 text-[12px] text-[#A78BFA]">
              Digitando...
            </div>
          )}

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            {msgs.map(msg =>
              msg.type === "date" ? (
                <div key={msg.id} className="flex justify-center py-1">
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/40">{msg.label}</span>
                </div>
              ) : (
                <MsgBubble
                  key={msg.id}
                  msg={msg}
                  startReply={startReply}
                  reactionPickerFor={reactionPickerFor}
                  setReactionPickerFor={setReactionPickerFor}
                  addReaction={addReaction}
                />
              )
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-white/[0.07] bg-[#0D0D10] px-5 py-4">
            {emojiOpen && (
              <div className="mb-3 grid grid-cols-5 gap-2 rounded-3xl bg-[#15161C] p-4">
                {EMOJI_BANK.map(emoji => (
                  <button key={emoji} type="button" onClick={() => handleSelectEmoji(emoji)}
                    className="rounded-2xl border border-white/[0.08] bg-[#0E0F15] px-3 py-2.5 text-[20px] transition hover:border-white/20 hover:bg-white/10">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {recorder.state === "recording" || recorder.state === "paused" ? (
              /* Recording UI with waveform, pause/resume, send, cancel */
              <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-[#12070f] px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center">
                    <Waveform active={recorder.state === "recording"} paused={recorder.state === "paused"} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-mono text-white">{recorder.state === "paused" ? "Pausado" : "Gravando…"} {recorder.fmt(recorder.seconds)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {recorder.state === "recording" ? (
                    <button type="button" aria-label="Pausar" onClick={recorder.pause}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-white hover:bg-white/10 transition">
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                    </button>
                  ) : (
                    <button type="button" aria-label="Retomar" onClick={recorder.resume}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-white hover:bg-white/10 transition">{icons.play()}</button>
                  )}

                  <button type="button" aria-label="Enviar" onClick={recorder.stop}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition">{icons.send()}</button>

                  <button type="button" aria-label="Cancelar" onClick={recorder.cancel}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6 text-white hover:bg-white/10 transition">{icons.x(18)}</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-full border border-white/[0.08] bg-[#1C1F2E] px-5 py-3">
                {replyTo && (
                  <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/5 px-4 py-2.5 text-[13px] text-white/80">
                    <div>
                      <p className="font-semibold">Respondendo a {replyTo.sender}</p>
                      <p className="text-white/50 line-clamp-1">{replyTo.content}</p>
                    </div>
                    <button type="button" onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white">✕</button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Emoji" onClick={() => { setEmojiOpen(o => !o); setReactionPickerFor(null); }}
                    className="text-white/40 hover:text-white/70 transition">{icons.emoji()}</button>
                  <input
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendText())}
                    placeholder="Mensagem..."
                    className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none"
                  />
                  {text.trim() ? (
                    <button type="button" aria-label="Enviar" onClick={sendText}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition">
                      {icons.send()}
                    </button>
                  ) : (
                    <button type="button" aria-label="Gravar áudio" onClick={recorder.start}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C1F2E] border border-white/10 text-white/60 hover:text-white hover:border-[#7C3AED] transition">
                      {icons.mic()}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Call overlay ── */}
      {calling && (


        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-[#1C1F2E] px-12 py-10">
            <Avatar initials={activeConv.avatar} size={80} color={activeConv.color} />
            <div className="text-center">
              <p className="text-[22px] font-bold text-white">{activeConv.name}</p>
              <p className="mt-1 text-[14px] text-white/50 animate-pulse">Chamando…</p>
            </div>
            <button type="button" aria-label="Encerrar chamada" onClick={() => setCalling(false)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition">
              {icons.phone()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
