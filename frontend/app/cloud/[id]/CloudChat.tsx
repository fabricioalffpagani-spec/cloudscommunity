"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EMOJI_BANK = ["😀","🔥","❤️","😂","🙌","🎉","💬","👍","👀","✨"];

function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

function SmileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
    </svg>
  );
}

function FireIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2C9.5 6 8 8.5 8 11.5c0 3.75 3 6.5 4 8.5 1-2 4-4.75 4-8.5C16 8.5 14.5 6 12 2Z" />
    </svg>
  );
}

function MicIcon({ s = 18 }: { s?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
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

function XIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function formatSeconds(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type CloudMsgBase = {
  id: string;
  sender: string;
  initials: string;
  color: string;
  time: string;
  host?: boolean;
  replyTo?: { sender: string; content: string };
  flames: number;
  reaction?: string;
};

type TextMsg = CloudMsgBase & {
  type: "text";
  content: string;
};

type AudioMsg = CloudMsgBase & {
  type: "audio";
  duration: string;
  audioUrl?: string;
  waveform?: number[];
};

type Message = TextMsg | AudioMsg;

type CloudChatProps = {
  cloudId: string;
};

const BASE_MESSAGES: TextMsg[] = [
  {
    id: "c1",
    sender: "Beatriz",
    initials: "B",
    color: "#A855F7",
    type: "text",
    content: "Sejam bem-vindos! Vamos discutir: IA vai substituir programadores?",
    time: "12:30",
    host: true,
    flames: 24,
  },
  {
    id: "c2",
    sender: "devmarcos",
    initials: "DM",
    color: "#22C55E",
    type: "text",
    content: "Acho que não. A IA é uma ferramenta, não um substituto.",
    time: "12:31",
    flames: 24,
  },
  {
    id: "c3",
    sender: "anavieira",
    initials: "AV",
    color: "#3B82F6",
    type: "text",
    content: "Depende do tipo de programação. Tarefas repetitivas sim, mas criatividade e lógica complexa não.",
    time: "12:31",
    flames: 17,
  },
  {
    id: "c4",
    sender: "lucasdev",
    initials: "LD",
    color: "#F59E0B",
    type: "text",
    content: "Ferramentas como Copilot já aumentam muito nossa produtividade.",
    time: "12:32",
    flames: 12,
    replyTo: { sender: "anavieira", content: "Depende do tipo de programação..." },
  },
  {
    id: "c5",
    sender: "carolcode",
    initials: "CC",
    color: "#EC4899",
    type: "text",
    content: "Concordo! E acho que o real diferencial será saber usar a IA a nosso favor.",
    time: "12:32",
    flames: 9,
  },
  {
    id: "c6",
    sender: "pedroa.dev",
    initials: "PD",
    color: "#8B5CF6",
    type: "text",
    content: "Concordo! A IA cuida do básico e a gente foca no que realmente importa.",
    time: "12:33",
    flames: 7,
  },
];

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

  const start = useCallback(async () => {
    try {
      canceledRef.current = false;
      waveformRef.current = Array.from({ length: 28 }, (_, i) => 4 + ((i * 7) % 18));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const rec = new MediaRecorder(stream);
      chunksRef.current = [];


      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        if (!canceledRef.current) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const url = URL.createObjectURL(blob);
          onDone(url, fmt(seconds), waveformRef.current.slice());
        }

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        setSeconds(0);
        setState("idle");
      };

      rec.start();
      mediaRef.current = rec;
      setState("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

      const wfIv = setInterval(() => {
        waveformRef.current = waveformRef.current.map(() => 4 + Math.floor(Math.random() * 18));
      }, 240);

      (timerRef.current as any).wfIv = wfIv;
    } catch {
      alert("Permissão de microfone negada.");
    }
  }, [fmt, onDone, seconds]);

  const pause = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state !== "recording") return;
    try {
      mediaRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setState("paused");
    } catch {
      // ignore
    }
  }, []);

  const resume = useCallback(() => {
    if (!mediaRef.current || mediaRef.current.state !== "paused") return;
    try {
      mediaRef.current.resume();
      if (!timerRef.current) timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setState("recording");
    } catch {
      // ignore
    }
  }, []);

  const stop = useCallback(() => {
    if (!mediaRef.current) return;
    try {
      mediaRef.current.stop();
    } catch {
      // ignore
    }
  }, []);

  const cancel = useCallback(() => {
    canceledRef.current = true;

    if (mediaRef.current && (mediaRef.current.state === "recording" || mediaRef.current.state === "paused")) {
      try {
        mediaRef.current.stop();
      } catch {
        // ignore
      }
    }

    chunksRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setSeconds(0);
    setState("idle");
  }, []);

  useEffect(
    () =>
      () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      },
    []
  );

  return { state, seconds, fmt, start, pause, resume, stop, cancel };
}

function AudioBubble({ msg }: { msg: AudioMsg }) {
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
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play();
      setPlaying(true);
    }
  };

  return (
    <div
      className="mt-3 flex items-center gap-3 rounded-[28px] bg-[#111827] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
      style={{ minWidth: 260 }}
    >
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15 transition"
      >
        {playing ? <PauseIcon s={16} /> : <PlayIcon s={16} />}
      </button>

      <div className="flex-1">
        <div className="flex items-end gap-[4px]" style={{ height: 26 }}>
          {(msg.waveform ?? Array.from({ length: 28 }, () => 6)).map((h, i) => (
            <span key={i} className="block w-[3px] rounded-full bg-white/80" style={{ height: `${h}px` }} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/50">
          <span>{msg.audioUrl ? "" : "0:00"}</span>
          <span>{msg.duration}</span>
        </div>
        {msg.audioUrl && <audio ref={audioRef} src={msg.audioUrl} className="hidden" />}
      </div>
    </div>
  );
}

export default function CloudChat({ cloudId }: CloudChatProps) {
  const [messages, setMessages] = useState<Message[]>(BASE_MESSAGES);
  const [draft, setDraft] = useState("");
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  const sendText = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `own-${Date.now()}`,
        sender: "Você",
        initials: "VC",
        color: "#8B5CF6",
        type: "text",
        content: trimmed,
        time: now(),
        flames: 0,
      },
    ]);

    setDraft("");
  }, [draft]);

  const sendAudio = useCallback(
    (audioUrl: string, duration: string, waveform?: number[]) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `own-audio-${Date.now()}`,
          sender: "Você",
          initials: "VC",
          color: "#8B5CF6",
          type: "audio",
          time: now(),
          flames: 0,
          duration,
          audioUrl,
          waveform,
        },
      ]);
    },
    []
  );

  const recorder = useRecorder(sendAudio);

  const addReaction = (messageId: string, emoji: string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, reaction: emoji } : msg)));
    setReactionPickerFor(null);
  };

  const bottomSendDisabled = recorder.state === "recording" || recorder.state === "paused";

  return (
    <div className="flex h-full flex-col bg-[#070b17] text-white">
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-4">
                <Avatar initials={msg.initials} color={msg.color} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${msg.host ? "text-[#F8FAFC]" : "text-white"}`}>{msg.sender}</p>
                    {msg.host && (
                      <span className="rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#C4B5FD]">
                        Host
                      </span>
                    )}
                    <span className="text-xs text-white/50">{msg.time}</span>
                  </div>

                  {msg.replyTo && (
                    <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                      <p className="font-semibold text-white">{msg.replyTo.sender}</p>
                      <p className="mt-1 leading-snug">{msg.replyTo.content}</p>
                    </div>
                  )}

                  {msg.type === "text" ? (
                    <div className="mt-3 rounded-[28px] bg-[#111827] p-4 text-sm leading-relaxed text-white shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                      {msg.content}
                    </div>
                  ) : (
                    <AudioBubble msg={msg} />
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
                    <button
                      type="button"
                      onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
                      disabled={bottomSendDisabled}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      <span>↩</span>
                      Responder
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-[#F97316] transition hover:bg-white/10"
                    >
                      <FireIcon />
                      {msg.flames}
                    </button>

                    {msg.reaction && <span className="rounded-full bg-[#ffffff14] px-3 py-2 text-sm">{msg.reaction}</span>}
                  </div>

                  {reactionPickerFor === msg.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {EMOJI_BANK.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => addReaction(msg.id, emoji)}
                          className="rounded-full bg-white/5 px-3 py-2 text-sm transition hover:bg-white/10"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#060a16] px-6 py-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Digite sua mensagem...</p>
            <p className="text-xs text-white/50">{recorder.state === "recording" || recorder.state === "paused" ? "Gravando áudio" : "rafael, ju.dev e outras 3 pessoas estão digitando..."}</p>
          </div>
          <div className="flex items-center gap-2 rounded-3xl bg-white/5 px-3 py-2">
            <button type="button" className="rounded-full p-2 text-white/80 transition hover:bg-white/10" disabled={bottomSendDisabled}>
              <SmileIcon />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-[#F97316] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#fb923c]"
              disabled={bottomSendDisabled}
            >
              <FireIcon />
              Hype
            </button>
          </div>
        </div>

        {recorder.state === "recording" || recorder.state === "paused" ? (
          <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-[#12070f] px-4 py-2.5">
            <div className="flex items-center justify-center">
              <div className="flex items-end gap-[4px]" style={{ height: 26 }}>
                {Array.from({ length: 28 }, (_, i) => 4 + ((i * 7) % 18)).map((h, i) => (
                  <span key={i} className="block w-[3px] rounded-full bg-white/80" style={{ height: `${h}px` }} />
                ))}
              </div>
            </div>

            <div className="flex-1">
              <div className="text-[14px] font-mono text-white">
                {recorder.state === "paused" ? "Pausado" : "Gravando…"} {recorder.fmt(recorder.seconds)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {recorder.state === "recording" ? (
                <button
                  type="button"
                  aria-label="Pausar"
                  onClick={recorder.pause}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-white hover:bg-white/10 transition"
                >
                  <span className="text-[16px]">❚❚</span>
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Retomar"
                  onClick={recorder.resume}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-white hover:bg-white/10 transition"
                >
                  <PlayIcon s={16} />
                </button>
              )}

              <button
                type="button"
                aria-label="Enviar"
                onClick={recorder.stop}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition"
              >
                <span className="text-[16px]">➤</span>
              </button>

              <button
                type="button"
                aria-label="Cancelar"
                onClick={recorder.cancel}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-white hover:bg-white/10 transition"
              >
                <XIcon s={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Escreva sua mensagem ou grave áudio..."
              className="min-h-[72px] flex-1 resize-none rounded-3xl border border-white/10 bg-[#0b1222] px-4 py-4 text-sm text-white outline-none transition focus:border-[#7C3AED]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
            />

            {draft.trim() ? (
              <button
                type="button"
                onClick={sendText}
                className="inline-flex h-14 items-center justify-center rounded-3xl bg-[#7C3AED] px-6 text-sm font-semibold text-white transition hover:bg-[#6D28D9]"
              >
                Enviar
              </button>
            ) : (
              <button
                type="button"
                aria-label="Gravar áudio"
                onClick={recorder.start}
                className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[#0b1222] border border-white/10 text-white/60 hover:text-white hover:border-[#7C3AED] transition"
              >
                <MicIcon s={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

