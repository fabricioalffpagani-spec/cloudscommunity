"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMOJI_BANK = ["😀","🔥","❤️","😂","🙌","🎉","💬","👍","👀","✨"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function profileHrefFromName(name: string) {
  return `/users/${encodeURIComponent(name.replace(/^@/, "").trim())}`;
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Avatar({ initials, color, size = 48 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {initials}
    </div>
  );
}

function SmileIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14s1 2 3.5 2 3.5-2 3.5-2" />
      <circle cx="9" cy="10" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FireIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 1C9.5 5.5 7 8.5 7 12.5c0 5 4 9 5 9s5-4 5-9c0-2-.5-3.5-1.5-5 .3 1.5.2 2.5-.5 3.5C14.5 9 13.5 5.5 12 1Z" />
      <path d="M12 1C10 5 8 8 8 12c0 4.5 3.5 8.5 4 9-.5-1.5-1-3-1-5 0-2 .8-4 1.5-5.5C13 12.5 13 14 12.5 16c1.5-1.5 3-3.5 3-6 0-2-.5-3.5-1-5C15 6.5 15 7.5 14.5 8.5 14 5 13 2.5 12 1Z" />
      <path opacity="0.4" d="M12 7.5c.5 1.5 1 3 1 4.5 0 2.5-1 4.5-1 5-.5-1-1-2.5-1-5 0-1.5.5-3 1-4.5Z" />
    </svg>
  );
}

function MicIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 12a7 7 0 0 1-14 0" />
      <path d="M12 19v3" />
    </svg>
  );
}

function PlayIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v14l11-7-11-7Z" />
    </svg>
  );
}

function PauseIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function XIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function Check2Icon() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m2 12 5 5L17 7" />
      <path d="m9 12 5 5L22 7" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReplyMeta = { id: string; sender: string; content: string };

type CloudMsgBase = {
  id: string;
  sender: string;
  initials: string;
  color: string;
  time: string;
  host?: boolean;
  replyTo?: ReplyMeta;
  flames: number;
  reaction?: string;
  /** true = sent by the current user */
  own?: boolean;
};

type TextMsg = CloudMsgBase & { type: "text"; content: string };
type AudioMsg = CloudMsgBase & { type: "audio"; duration: string; audioUrl?: string; waveform?: number[] };
type Message = TextMsg | AudioMsg;

type CloudChatProps = { cloudId: string };

// ─── Seed messages ────────────────────────────────────────────────────────────

const BASE_MESSAGES: TextMsg[] = [
  { id: "c1", sender: "Beatriz", initials: "B",  color: "#A855F7", type: "text", content: "Sejam bem-vindos! Vamos discutir: IA vai substituir programadores?", time: "12:30", host: true, flames: 24 },
  { id: "c2", sender: "devmarcos", initials: "DM", color: "#22C55E", type: "text", content: "Acho que não. A IA é uma ferramenta, não um substituto.", time: "12:31", flames: 24 },
  { id: "c3", sender: "anavieira", initials: "AV", color: "#3B82F6", type: "text", content: "Depende do tipo de programação. Tarefas repetitivas sim, mas criatividade e lógica complexa não.", time: "12:31", flames: 17 },
  { id: "c4", sender: "lucasdev", initials: "LD", color: "#F59E0B", type: "text", content: "Ferramentas como Copilot já aumentam muito nossa produtividade.", time: "12:32", flames: 12, replyTo: { id: "c3", sender: "anavieira", content: "Depende do tipo de programação..." } },
  { id: "c5", sender: "carolcode", initials: "CC", color: "#EC4899", type: "text", content: "Concordo! E acho que o real diferencial será saber usar a IA a nosso favor.", time: "12:32", flames: 9 },
  { id: "c6", sender: "pedroa.dev", initials: "PD", color: "#8B5CF6", type: "text", content: "Concordo! A IA cuida do básico e a gente foca no que realmente importa.", time: "12:33", flames: 7 },
];

// ─── Recorder hook ────────────────────────────────────────────────────────────

type RecState = "idle" | "recording" | "paused";

function useRecorder(onDone: (url: string, dur: string, waveform?: number[]) => void) {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const mediaRef   = useRef<MediaRecorder | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const chunksRef  = useRef<Blob[]>([]);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const wfIvRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef  = useRef(false);
  const waveformRef = useRef<number[]>([]);
  // keep latest seconds value accessible inside onstop closure
  const secondsRef = useRef(0);

  const start = useCallback(async () => {
    try {
      cancelRef.current = false;
      waveformRef.current = Array.from({ length: 28 }, (_, i) => 4 + ((i * 7) % 18));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (wfIvRef.current)  { clearInterval(wfIvRef.current);  wfIvRef.current  = null; }
        if (!cancelRef.current) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const url  = URL.createObjectURL(blob);
          onDone(url, fmt(secondsRef.current), waveformRef.current.slice());
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setSeconds(0);
        secondsRef.current = 0;
        setState("idle");
      };
      rec.start();
      mediaRef.current = rec;
      setState("recording");
      setSeconds(0);
      secondsRef.current = 0;
      timerRef.current = setInterval(() => {
        setSeconds((s) => { secondsRef.current = s + 1; return s + 1; });
      }, 1000);
      wfIvRef.current = setInterval(() => {
        waveformRef.current = waveformRef.current.map(() => 4 + Math.floor(Math.random() * 18));
      }, 240);
    } catch {
      alert("Permissão de microfone negada.");
    }
  }, [onDone]);

  const pause = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state !== "recording") return;
    try {
      mediaRef.current.pause();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (wfIvRef.current)  { clearInterval(wfIvRef.current);  wfIvRef.current  = null; }
      setState("paused");
    } catch { /* ignore */ }
  }, []);

  const resume = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state !== "paused") return;
    try {
      mediaRef.current.resume();
      if (!timerRef.current) timerRef.current = setInterval(() => {
        setSeconds((s) => { secondsRef.current = s + 1; return s + 1; });
      }, 1000);
      wfIvRef.current = setInterval(() => {
        waveformRef.current = waveformRef.current.map(() => 4 + Math.floor(Math.random() * 18));
      }, 240);
      setState("recording");
    } catch { /* ignore */ }
  }, []);

  const stop = useCallback(() => {
    if (!mediaRef.current) return;
    try { mediaRef.current.stop(); } catch { /* ignore */ }
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    if (mediaRef.current && (mediaRef.current.state === "recording" || mediaRef.current.state === "paused")) {
      try { mediaRef.current.stop(); } catch { /* ignore */ }
    }
    chunksRef.current = [];
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (timerRef.current)  { clearInterval(timerRef.current); timerRef.current = null; }
    if (wfIvRef.current)   { clearInterval(wfIvRef.current);  wfIvRef.current  = null; }
    setSeconds(0);
    secondsRef.current = 0;
    setState("idle");
  }, []);

  // cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current)  clearInterval(timerRef.current);
    if (wfIvRef.current)   clearInterval(wfIvRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  return { state, seconds, start, pause, resume, stop, cancel };
}

// ─── Waveform (animated bars) ─────────────────────────────────────────────────

const BAR_COUNT = 28;

function Waveform({ active, paused }: { active?: boolean; paused?: boolean }) {
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => 4 + ((i * 7) % 18))
  );

  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    if (active && !paused) {
      iv = setInterval(() => setHeights(() => Array.from({ length: BAR_COUNT }, () => 4 + Math.floor(Math.random() * 18))), 240);
    } else if (active && paused) {
      iv = setInterval(() => setHeights(() => Array.from({ length: BAR_COUNT }, () => 6 + Math.floor(Math.random() * 6))), 800);
    } else {
      const reset = Array.from({ length: BAR_COUNT }, (_, i) => 4 + ((i * 7) % 18));
      iv = setTimeout(() => setHeights(reset), 0) as unknown as ReturnType<typeof setInterval>;
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

// ─── Audio bubble ─────────────────────────────────────────────────────────────

function AudioBubble({ msg, own }: { msg: AudioMsg; own?: boolean }) {
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
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${own ? "rounded-br-[4px] bg-[#7C3AED]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#111827]"}`}
      style={{ minWidth: 220 }}
    >
      <button
        type="button"
        aria-label={playing ? "Pausar" : "Reproduzir"}
        onClick={toggle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${own ? "bg-white/20 hover:bg-white/30" : "bg-[#7C3AED] hover:bg-[#6D28D9]"}`}
      >
        {playing ? <PauseIcon s={14} /> : <PlayIcon s={14} />}
      </button>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-end gap-[4px]" style={{ height: 26 }}>
          {(msg.waveform ?? Array.from({ length: BAR_COUNT }, () => 6)).map((h, i) => (
            <span key={i} className="block w-[3px] rounded-full bg-white/80" style={{ height: `${h}px` }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-white/50">
          <span>{msg.audioUrl ? "" : "0:00"}</span>
          <span>{msg.duration}</span>
        </div>
        {msg.audioUrl && <audio ref={audioRef} src={msg.audioUrl} className="hidden" />}
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MsgBubble({
  msg,
  onReply,
  reactionPickerFor,
  setReactionPickerFor,
  onAddReaction,
}: {
  msg: Message;
  onReply: (m: Message) => void;
  reactionPickerFor: string | null;
  setReactionPickerFor: (id: string | null) => void;
  onAddReaction: (id: string, emoji: string) => void;
}) {
  const own = !!msg.own;

  return (
    <div className={`flex items-end gap-3 ${own ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-10 shrink-0">
        <Avatar initials={msg.initials} color={msg.color} size={36} />
      </div>

      <div className={`flex flex-col gap-1.5 ${own ? "items-end" : "items-start"}`} style={{ maxWidth: "72%" }}>
        {/* sender + host badge */}
        <div className={`flex flex-wrap items-center gap-2 px-1 ${own ? "flex-row-reverse" : ""}`}>
          {msg.sender === "Você" ? (
            <span className="text-[12px] font-semibold text-white/50">{msg.sender}</span>
          ) : (
            <Link href={profileHrefFromName(msg.sender)} className="text-[12px] font-semibold text-white/50 transition hover:text-white hover:underline">
              {msg.sender}
            </Link>
          )}
          {msg.host && (
            <span className="rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#C4B5FD]">
              Host
            </span>
          )}
          <span className="text-[11px] text-white/30">{msg.time}</span>
        </div>

        {/* reply preview */}
        {msg.replyTo && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/5 px-3 py-2 text-[12px] text-white/70">
            {msg.replyTo.sender === "Você" ? (
              <p className="font-semibold text-white">{msg.replyTo.sender}</p>
            ) : (
              <Link href={profileHrefFromName(msg.replyTo.sender)} className="font-semibold text-white transition hover:underline">
                {msg.replyTo.sender}
              </Link>
            )}
            <p className="mt-1 leading-snug line-clamp-2">{msg.replyTo.content}</p>
          </div>
        )}

        {/* bubble */}
        {msg.type === "text" ? (
          <div
            className={`rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed text-white ${
              own ? "rounded-br-[4px] bg-[#7C3AED]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#111827]"
            }`}
          >
            {msg.content}
          </div>
        ) : (
          <AudioBubble msg={msg} own={own} />
        )}

        {/* actions row */}
        <div className={`flex flex-wrap items-center gap-2 px-1 text-[11px] text-white/40 ${own ? "flex-row-reverse" : ""}`}>
          <button type="button" onClick={() => onReply(msg)} className="rounded-full px-2 py-1 transition hover:bg-white/10">
            Responder
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[#F97316] transition hover:bg-white/10"
          >
            <FireIcon />
            {msg.flames}
          </button>
          <button
            type="button"
            onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
            className="rounded-full px-2 py-1 transition hover:bg-white/10"
          >
            Reagir
          </button>
          {msg.reaction && (
            <span className="rounded-full bg-white/10 px-2 py-1 text-[12px]">{msg.reaction}</span>
          )}
        </div>

        {/* reaction picker */}
        {reactionPickerFor === msg.id && (
          <div className="mt-1 flex flex-wrap gap-2 px-1">
            {EMOJI_BANK.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onAddReaction(msg.id, emoji)}
                className="rounded-2xl border border-white/[0.08] bg-[#15161C] px-3 py-2 text-[18px] transition hover:border-white/20 hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReactionPickerFor(null)}
              className="rounded-2xl border border-white/[0.08] bg-[#15161C] px-3 py-2 text-[13px] text-white/70 transition hover:border-white/20 hover:bg-white/10"
            >
              Fechar
            </button>
          </div>
        )}

        {/* time + read receipt */}
        <div className={`flex items-center gap-1 px-1 text-[10px] text-white/30 ${own ? "flex-row-reverse" : ""}`}>
          <span>{msg.time}</span>
          {own && <span className="text-[#C084FC]"><Check2Icon /></span>}
        </div>
      </div>
    </div>
  );
}

// ─── CloudChat ────────────────────────────────────────────────────────────────

export default function CloudChat({ cloudId }: CloudChatProps) {
  // cloudId would be used to fetch real messages from a backend
  void cloudId;
  const [messages, setMessages] = useState<Message[]>(BASE_MESSAGES);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyMeta | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // auto-scroll when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendText = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const msg: TextMsg = {
      id: uid(),
      sender: "Você",
      initials: "VC",
      color: "#8B5CF6",
      type: "text",
      content: trimmed,
      time: now(),
      flames: 0,
      own: true,
      replyTo: replyTo ?? undefined,
    };
    setMessages((prev) => [...prev, msg]);
    setDraft("");
    setReplyTo(null);
    setEmojiOpen(false);
  }, [draft, replyTo]);

  const sendAudio = useCallback((audioUrl: string, duration: string, waveform?: number[]) => {
    const msg: AudioMsg = {
      id: uid(),
      sender: "Você",
      initials: "VC",
      color: "#8B5CF6",
      type: "audio",
      time: now(),
      flames: 0,
      own: true,
      duration,
      audioUrl,
      waveform,
      replyTo: replyTo ?? undefined,
    };
    setMessages((prev) => [...prev, msg]);
    setReplyTo(null);
    setEmojiOpen(false);
  }, [replyTo]);

  const recorder = useRecorder(sendAudio);

  const addReaction = (id: string, emoji: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, reaction: emoji } : m)));
    setReactionPickerFor(null);
  };

  const startReply = (msg: Message) => {
    const content = msg.type === "audio" ? "Áudio" : msg.content;
    setReplyTo({ id: msg.id, sender: msg.sender, content });
    setEmojiOpen(false);
    setReactionPickerFor(null);
  };

  const isRecording = recorder.state === "recording" || recorder.state === "paused";

  return (
    <div className="flex h-full flex-col bg-[#070b17] text-white">

      {/* ── Messages list ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-4">
          {messages.map((msg) => (
            <MsgBubble
              key={msg.id}
              msg={msg}
              onReply={startReply}
              reactionPickerFor={reactionPickerFor}
              setReactionPickerFor={setReactionPickerFor}
              onAddReaction={addReaction}
            />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-white/10 bg-[#060a16] px-4 py-3">

        {/* Emoji picker */}
        {emojiOpen && (
          <div className="mb-3 grid grid-cols-5 gap-2 rounded-3xl bg-[#15161C] p-3">
            {EMOJI_BANK.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { setDraft((d) => d + emoji); setEmojiOpen(false); }}
                className="rounded-2xl border border-white/[0.08] bg-[#0E0F15] px-3 py-2 text-[18px] transition hover:border-white/20 hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Recording state */}
        {isRecording ? (
          <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-[#12070f] px-4 py-2.5">
            <Waveform active={recorder.state === "recording"} paused={recorder.state === "paused"} />
            <div className="flex-1 text-[14px] font-mono text-white">
              {recorder.state === "paused" ? "Pausado" : "Gravando…"}{" "}
              {fmt(recorder.seconds)}
            </div>
            <div className="flex items-center gap-2">
              {recorder.state === "recording" ? (
                <button type="button" aria-label="Pausar" onClick={recorder.pause}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10 transition">
                  <PauseIcon s={16} />
                </button>
              ) : (
                <button type="button" aria-label="Retomar" onClick={recorder.resume}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10 transition">
                  <PlayIcon s={16} />
                </button>
              )}
              <button type="button" aria-label="Enviar áudio" onClick={recorder.stop}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition">
                <SendIcon />
              </button>
              <button type="button" aria-label="Cancelar gravação" onClick={recorder.cancel}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10 transition">
                <XIcon s={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Idle state */
          <div className="flex flex-col gap-2 rounded-full border border-white/[0.08] bg-[#1C1F2E] px-4 py-2.5">
            {/* Reply preview */}
            {replyTo && (
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/5 px-3 py-2 text-[12px] text-white/80">
                <div>
                  <p className="font-semibold">Respondendo a {replyTo.sender}</p>
                  <p className="text-white/50 line-clamp-1">{replyTo.content}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white transition">
                  <XIcon s={14} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Emoji button */}
              <button
                type="button"
                aria-label="Emoji"
                onClick={() => { setEmojiOpen((o) => !o); setReactionPickerFor(null); }}
                className="shrink-0 text-white/40 hover:text-white/70 transition"
              >
                <SmileIcon />
              </button>

              {/* Text input */}
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendText())}
                placeholder="Mensagem..."
                className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none"
              />

              {/* Send / Mic toggle */}
              {draft.trim() ? (
                <button type="button" aria-label="Enviar mensagem" onClick={sendText}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition">
                  <SendIcon />
                </button>
              ) : (
                <button type="button" aria-label="Gravar áudio" onClick={recorder.start}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#1C1F2E] text-white/60 hover:border-[#7C3AED] hover:text-white transition">
                  <MicIcon s={18} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
