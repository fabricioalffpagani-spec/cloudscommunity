"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlameIcon } from "../../components/FlameIcon";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  { label: "Rostos",     icon: "😀", emojis: ["😀","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😏","😒","🙄","😬","😔","😪","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"] },
  { label: "Gestos",     icon: "👋", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","👀","👁️","👅","👄","💋"] },
  { label: "Corações",   icon: "❤️", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💝","💘","💌","💟","💯","💢","💥","💫","💦","💨","💬","💭","💤","🔥","✨","🎉","🎊","🎈"] },
  { label: "Animais",    icon: "🐶", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🐢","🐍","🦎","🐙","🦑","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🦓","🐘","🦒","🐕","🐈"] },
  { label: "Comida",     icon: "🍎", emojis: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🥔","🍠","🥐","🥯","🍞","🥖","🧀","🥚","🍳","🥞","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥗","🥘","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🍤","🍙","🍚","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🧃","🥤","🧋","🍵","☕","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🍾"] },
  { label: "Viagens",    icon: "✈️", emojis: ["🚗","🚕","🚙","🚌","🏎️","🚓","🚑","🚒","🛻","🚲","🛴","🛹","🚁","🛸","✈️","🛩️","🚀","🛶","⛵","🚤","🚢","🚂","🚄","🚇","🌍","🌎","🌏","🗺️","🏔️","🌋","🏕️","🏖️","🏝️","🗼","🗽","🏰","🏯","⛩️","🏛️","🌃","🌆","🌇","🌉"] },
  { label: "Atividades", icon: "⚽", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏒","🥊","🥋","🎯","⛸️","🎿","🛷","🥌","🎣","🤿","🎽","🏆","🥇","🥈","🥉","🏅","🎪","🤹","🎨","🎭","🎬","🎤","🎧","🎼","🎹","🎸","🎺","🎻","🥁","🎲","🎮","🕹️","🧩","♠️","♥️","♦️","♣️"] },
  { label: "Objetos",    icon: "💡", emojis: ["💡","🔦","🕯️","📱","💻","🖥️","📷","📸","📹","🎥","📺","📻","🔋","🔌","💾","💿","📀","🔭","🔬","🩺","💊","💉","🩹","🧬","🔑","🗝️","🔒","🔓","🔨","⚙️","🔧","🔩","🧹","🧺","🧻","🚪","🪑","🛋️","🛏️","🧸","🖼️","🎁","🎈","🎀","🎊","🎉","📦","📫","📝","📚","📖","📰","📌","📍","📎","✂️","💰","💳","💸","📈","📉","📊","🔮","🧿","💈"] },
  { label: "Natureza",   icon: "🌸", emojis: ["🌸","🌼","🌻","🌺","🌹","🥀","🌷","💐","🍀","🌿","🍃","🍂","🍁","🌱","🌲","🌳","🌴","🌵","🎋","🎍","☀️","🌤️","⛅","🌥️","🌦️","🌧️","⛈️","🌩️","🌪️","🌫️","🌬️","🌀","🌈","❄️","☃️","⛄","☄️","💧","🌊","🔥","⚡","🌑","🌕","🌙","⭐","🌟","🌠","🌌","🪐","🦋","🐝","🍄","🌾","🐚","🪨"] },
];

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

function FireIcon({ className = "", filled = false }: { className?: string; filled?: boolean }) {
  return <FlameIcon s={26} className={`block ${className}`} filled={filled} />;
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
    <svg viewBox="0 0 24 24" width={s} height={s} fill="white" aria-hidden="true">
      <path d="M8 5.14v14l11-7-11-7Z" />
    </svg>
  );
}

function PauseIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="white" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

function TrashIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="overflow-visible">
      {/* Lid + handle grouped — move together on hover */}
      <g className="transition-transform duration-200 group-hover:-translate-y-[2.5px] group-hover:rotate-[-6deg]" style={{ transformOrigin: '12px 6px' }}>
        <path d="M3 6h18" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </g>
      {/* Body stays put */}
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    </svg>
  );
}

function CheckIcon({ s = 12 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5L20 7"/>
    </svg>
  );
}

function DotsMenuIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="white" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function CopyMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TranslateMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="M22 22l-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

function EditMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </svg>
  );
}

function CancelSendMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </svg>
  );
}

function ForwardMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

type CloudMsgMenuProps = {
  msg: Message;
  own: boolean;
  onEdit: (msg: Message) => void;
  onDelete: (msgId: string) => void;
  onForward: (msg: Message) => void;
  onClose: () => void;
};

function CloudMsgMenu({ msg, own, onEdit, onDelete, onForward, onClose }: CloudMsgMenuProps) {
  const [copied, setCopied] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const textContent = msg.type === "text" ? msg.content : null;

  const handleCopy = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); onClose(); }, 1200);
    }).catch(() => {});
  };

  const handleTranslate = async () => {
    if (!textContent) return;
    setTranslating(true);
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(textContent)}`
      );
      const data = await res.json() as [[string, string][]] | null;
      const result = data?.[0]?.map(([t]) => t).join("") ?? null;
      if (result) setTranslated(result);
    } catch {
      // silently ignore
    } finally {
      setTranslating(false);
    }
  };

  const items: { label: string; icon: React.ReactNode; action: () => void; danger?: boolean; show: boolean }[] = [
    {
      label: copied ? "Copiado!" : "Copiar",
      icon: <CopyMenuIcon />,
      action: handleCopy,
      show: !!textContent,
    },
    {
      label: translating ? "Traduzindo…" : translated ? "Traduzido ✓" : "Traduzir",
      icon: <TranslateMenuIcon />,
      action: handleTranslate,
      show: !!textContent,
    },
    {
      label: "Editar",
      icon: <EditMenuIcon />,
      action: () => { onEdit(msg); onClose(); },
      show: own && msg.type === "text",
    },
    {
      label: "Cancelar envio",
      icon: <CancelSendMenuIcon />,
      action: () => { onDelete(msg.id); onClose(); },
      danger: true,
      show: own,
    },
    {
      label: "Encaminhar",
      icon: <ForwardMenuIcon />,
      action: () => { onForward(msg); onClose(); },
      show: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className={`absolute z-50 min-w-[168px] rounded-2xl border border-white/[0.08] bg-[#15161C] py-1 shadow-2xl shadow-black/60 ${own ? "right-0" : "left-0"}`}
      style={{ top: "calc(100% + 4px)" }}
    >
      {translated && (
        <div className="border-b border-white/[0.06] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">Tradução</p>
          <p className="text-[13px] text-white leading-snug">{translated}</p>
        </div>
      )}
      {items.filter(i => i.show).map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.action}
          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition hover:bg-white/[0.06] ${item.danger ? "text-red-400 hover:text-red-300" : "text-white/80 hover:text-white"}`}
        >
          <span className={item.danger ? "text-red-400" : "text-white/50"}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ReplyIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10h10a5 5 0 0 1 5 5v2" />
      <path d="M3 10l4-4" />
      <path d="M3 10l4 4" />
    </svg>
  );
}

function ReactionIcon({ s = 16 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <circle cx="9" cy="9" r="1" fill="white" stroke="none" />
      <circle cx="15" cy="9" r="1" fill="white" stroke="none" />
    </svg>
  );
}

function PinIcon({ s = 16, filled = false }: { s?: number; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill={filled ? "white" : "none"} stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: "rotate(-45deg)" }}>
      <path d="M12 17v-4" />
      <path d="M12 3v4" />
      <path d="M6 10c0-2 2-3 6-3s6 1 6 3c0 3-3 5-3 5v4c0 1-1 2-3 2s-3-1-3-2v-4s-3-2-3-5Z" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReplyMeta = { id: string; sender: string; content: string };

type Reaction = {
  id: string;
  emoji: string;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
};

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
  reactions?: Reaction[];
  /** true = sent by the current user */
  own?: boolean;
  /** true = pinned by cloud author */
  isPinned?: boolean;
};

type TextMsg = CloudMsgBase & { type: "text"; content: string };
type AudioMsg = CloudMsgBase & { type: "audio"; duration: string; audioUrl?: string; waveform?: number[] };
type Message = TextMsg | AudioMsg;

type CloudMeta = {
  title: string;
  duration: string;
  createdAt: string;
  membersCount: number;
  description?: string | null;
  authorId?: string;
  visibility?: "public" | "private";
  hypesCount?: number;
  hyped?: boolean;
  members?: Array<{ id: string; userId: string; role: string; user: { id: string; profile: { displayName: string; username: string; avatarUrl: string | null } } }>;
};

type CloudChatProps = {
  cloudId: string;
  title?: string;
  duration?: string;
  createdAt?: string;
  participants?: number;
  visibility?: string;
  onBack?: () => void;
};



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
      waveformRef.current = Array.from({ length: 28 }, (_, i) => 4 + Math.floor(Math.random() * 18));
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

// ─── Header icons ─────────────────────────────────────────────────────────────

function ForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="overflow-visible">
      <polyline points="15 10 20 15 15 20" className="transition-transform duration-200 group-hover:translate-x-[2px]" style={{ transformOrigin: '17.5px 15px' }} />
      <path d="M4 4v7a4 4 0 0 0 4 4h12" className="transition-transform duration-200 group-hover:translate-x-[2px]" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} fill="white" aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" className="transition-opacity duration-300 group-hover:opacity-70" style={{ transitionDelay: '0ms' }} />
      <circle cx="12" cy="12" r="1.5" className="transition-opacity duration-300 group-hover:opacity-70" style={{ transitionDelay: '100ms' }} />
      <circle cx="12" cy="19" r="1.5" className="transition-opacity duration-300 group-hover:opacity-70" style={{ transitionDelay: '200ms' }} />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18 8 12l7-6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

// ─── Waveform (animated bars) ─────────────────────────────────────────────────

const BAR_COUNT = 28;

function Waveform({ active, paused, progress }: { active?: boolean; paused?: boolean; progress?: number }) {
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0)
  );

  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    if (active && !paused) {
      iv = setInterval(() => setHeights(() => Array.from({ length: BAR_COUNT }, () => 4 + Math.floor(Math.random() * 18))), 240);
    } else if (active && paused) {
      iv = setInterval(() => setHeights(() => Array.from({ length: BAR_COUNT }, () => 6 + Math.floor(Math.random() * 6))), 800);
    } else {
      setHeights(Array.from({ length: BAR_COUNT }, () => 0));
    }
    return () => { if (iv) clearInterval(iv); };
  }, [active, paused]);

  // Calculate how many bars should be visible based on progress (assuming max 15 seconds for full progress)
  const visibleBars = active && progress ? Math.min(Math.floor((progress / 15) * BAR_COUNT), BAR_COUNT) : 0;

  return (
    <div className="flex items-end gap-[3px]" style={{ height: 32 }}>
      {heights.map((h, i) => (
        <span 
          key={i} 
          className="block w-[4px] rounded-full transition-all duration-150 ease-out"
          style={{ 
            height: `${h}px`,
            background: active && !paused 
              ? `linear-gradient(to top, #9333EA, #A855F7)` 
              : `linear-gradient(to top, #9333EA 30%, #A855F7 100%)`,
            boxShadow: active && !paused ? '0 0 8px rgba(147, 51, 234, 0.6)' : 'none',
            opacity: i < visibleBars ? (active ? 1 : 0.6) : 0,
            transition: i < visibleBars ? 'height 0.15s ease-out, opacity 0.3s ease-out' : 'opacity 0.3s ease-out'
          }} 
        />
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
        <div className="flex items-end gap-[3px]" style={{ height: 32 }}>
          {(msg.waveform ?? Array.from({ length: BAR_COUNT }, () => 4 + Math.floor(Math.random() * 18))).map((h, i) => (
            <span 
              key={i} 
              className="block w-[4px] rounded-full transition-all duration-150 ease-out"
              style={{ 
                height: `${h}px`,
                background: `linear-gradient(to top, #9333EA 30%, #A855F7 100%)`,
                opacity: 0.8
              }} 
            />
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
  onEdit,
  onDelete,
  onForward,
  reactionPickerFor,
  setReactionPickerFor,
  onAddReaction,
  onPinToggle,
  isCloudAuthor,
  onShowReactionUsers,
}: {
  msg: Message;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (msgId: string) => void;
  onForward: (m: Message) => void;
  reactionPickerFor: string | null;
  setReactionPickerFor: (id: string | null) => void;
  onAddReaction: (id: string, emoji: string) => void;
  onPinToggle: (msgId: string) => void;
  isCloudAuthor: boolean;
  onShowReactionUsers: (msgId: string, emoji: string, reactions: Reaction[]) => void;
}) {
  const own = !!msg.own;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`group flex items-center gap-3 ${own ? "flex-row-reverse" : "flex-row"} ${msg.isPinned ? "rounded-lg bg-[#1a1a2e] p-2 border border-[#7C3AED]/30" : ""}`}>
      {/* Avatar fixed column */}
      <div className={`${own ? "w-11" : "w-9"} shrink-0`}>
        <Avatar initials={msg.initials} color={msg.color} size={own ? 44 : 36} />
      </div>

      {/* Content column aligned with avatar */}
      <div className={`relative mt-5 flex w-fit max-w-[72%] flex-col gap-2 ${own ? "items-end" : "items-start"}`}>
        {/* sender + host badge + pinned badge */}
        <div className={`absolute bottom-full mb-1 flex flex-wrap items-center gap-2 whitespace-nowrap ${own ? "right-0 flex-row-reverse" : "left-0"}`}>
          {msg.sender === "Você" ? (
            <span className="px-1 text-[12px] font-semibold text-white">{msg.sender}</span>
          ) : (
            <Link href={profileHrefFromName(msg.sender)} className="px-1 text-[12px] font-semibold text-white transition hover:text-white hover:underline">
              {msg.sender}
            </Link>
          )}
          {msg.host && (
            <span className="rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#C4B5FD]">
              Host
            </span>
          )}
          {msg.isPinned && (
            <span className="rounded-full border border-[#F97316]/40 bg-[#F97316]/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#FDBA74]">
              Fixado
            </span>
          )}
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
            className={`relative rounded-[22px] px-4 py-2.5 text-[15px] leading-relaxed text-white ${
              own ? "rounded-br-lg bg-[#6D28D9] shadow-[0_12px_28px_rgba(109,40,217,0.24)]" : "rounded-bl-lg border border-white/[0.08] bg-[#111827]"
            }`}
          >
            {msg.content}
            
            {/* Ações laterais: aparecem somente ao passar o mouse (ou focar) na mensagem. */}
            <div className={`absolute top-1/2 z-20 -translate-y-1/2 ${own ? "right-full mr-2" : "left-full ml-2"}`}>
              {/* Actions — visible on hover */}
              <div className="flex items-center gap-0.5 rounded-full bg-black/35 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    title="Mais opções"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                  >
                    <DotsMenuIcon s={15} />
                  </button>
                  {menuOpen && (
                    <CloudMsgMenu
                      msg={msg}
                      own={own}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onForward={onForward}
                      onClose={() => setMenuOpen(false)}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onReply(msg)}
                  title="Responder"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                >
                  <ReplyIcon s={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
                  title="Reagir"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                >
                  <ReactionIcon s={15} />
                </button>
                {isCloudAuthor && (
                  <button
                    type="button"
                    onClick={() => onPinToggle(msg.id)}
                    title={msg.isPinned ? "Desfixar" : "Fixar"}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                  >
                    <PinIcon s={15} filled={msg.isPinned} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <AudioBubble msg={msg} own={own} />
            
            {/* Ações laterais: aparecem somente ao passar o mouse (ou focar) na mensagem. */}
            <div className={`absolute top-1/2 z-20 -translate-y-1/2 ${own ? "right-full mr-2" : "left-full ml-2"}`}>
              {/* Actions — visible on hover */}
              <div className="flex items-center gap-0.5 rounded-full bg-black/35 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    title="Mais opções"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                  >
                    <DotsMenuIcon s={15} />
                  </button>
                  {menuOpen && (
                    <CloudMsgMenu
                      msg={msg}
                      own={own}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onForward={onForward}
                      onClose={() => setMenuOpen(false)}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onReply(msg)}
                  title="Responder"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                >
                  <ReplyIcon s={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
                  title="Reagir"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                >
                  <ReactionIcon s={15} />
                </button>
                {isCloudAuthor && (
                  <button
                    type="button"
                    onClick={() => onPinToggle(msg.id)}
                    title={msg.isPinned ? "Desfixar" : "Fixar"}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                  >
                    <PinIcon s={15} filled={msg.isPinned} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={`text-[11px] text-white/45 ${own ? "pr-1 text-right" : "pl-1"}`}>{msg.time}</div>

        {msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {Object.entries(msg.reactions.reduce((acc, reaction) => { (acc[reaction.emoji] ??= []).push(reaction); return acc; }, {} as Record<string, Reaction[]>)).map(([emoji, reactions]) => (
              <button key={emoji} type="button" onClick={() => onShowReactionUsers(msg.id, emoji, reactions)} className="rounded-full bg-white/10 px-2 py-1 text-[12px] transition hover:bg-white/20 flex items-center gap-1" title={`${reactions.length} usuário(s) reagiram com ${emoji}`}><span>{emoji}</span><span className="text-white/70">{reactions.length}</span></button>
            ))}
          </div>
        )}

        {/* reaction picker */}
        {reactionPickerFor === msg.id && (
          <div className="relative mt-1 z-50">
            <div className="absolute top-full left-0 mt-2 max-h-[150px] overflow-y-auto rounded-3xl bg-[#15161C] p-3 shadow-lg">
              <div className="flex flex-wrap gap-2">
                {EMOJI_BANK.map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onAddReaction(msg.id, emoji)}
                    className="rounded-2xl border border-white/[0.08] bg-[#0E0F15] px-3 py-2 text-[18px] transition hover:border-white/20 hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}

// ─── CloudChat ────────────────────────────────────────────────────────────────

// ─── Live timer hook ──────────────────────────────────────────────────────────

const DURATION_SECONDS: Record<string, number> = {
  "30min":  30 * 60,
  "1h":     60 * 60,
  "2h":     2 * 60 * 60,
  "5h":     5 * 60 * 60,
  "24h":    24 * 60 * 60,
};

function parseDurationSeconds(duration: string) {
  return DURATION_SECONDS[duration] ?? 5 * 60;
}

function useCountdown(meta: CloudMeta | null) {
  const [remaining, setRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const duration = meta?.duration ?? null;
  const createdAt = meta?.createdAt ?? null;

  useEffect(() => {
    if (!duration || !createdAt) {
      setRemaining(0);
      setIsExpired(false);
      return;
    }
    const update = () => {
      const total = parseDurationSeconds(duration);
      const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      const newRemaining = Math.max(total - elapsed, 0);
      setRemaining(newRemaining);
      setIsExpired(newRemaining === 0);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [duration, createdAt]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return {
    formatted: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    remaining,
    isExpired
  };
}

// ─── Cloud Share Modal ────────────────────────────────────────────────────────

type ShareContact = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  initials: string;
  color: string;
};



function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function CopyLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CloudShareModal({
  cloudId,
  cloudTitle,
  cloudDuration,
  cloudMembersCount,
  cloudVisibility,
  onClose,
}: {
  cloudId: string;
  cloudTitle: string;
  cloudDuration?: string;
  cloudMembersCount?: number;
  cloudVisibility?: "public" | "private";
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }>>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // For public clouds the share URL is the cloud itself.
  // For private clouds we generate an invite token so the recipient
  // goes through /invite/[token] which does the join before entering.
  const isPrivate = cloudVisibility === "private";

  const baseCloudUrl = typeof window !== "undefined"
    ? `${window.location.origin}/cloud/${cloudId}`
    : `http://localhost:3000/cloud/${cloudId}`;

  const shareUrl = inviteToken
    ? `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/invite/${inviteToken}`
    : baseCloudUrl;

  // Auto-generate invite token for private clouds
  useEffect(() => {
    if (!isPrivate) return;
    fetch(`/api/clouds/${encodeURIComponent(cloudId)}/invite`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { invite?: { token: string } }) => {
        if (data?.invite?.token) setInviteToken(data.invite.token);
      })
      .catch(() => {/* non-critical */});
  }, [cloudId, isPrivate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users/following", { cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => null) as { users?: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }>; message?: string } | null;
        if (!response.ok || !payload) throw new Error(payload?.message || "Não foi possível carregar seus contatos.");
        return Array.isArray(payload.users) ? payload.users : [];
      })
      .then(items => { if (!cancelled) setContacts(items); })
      .catch(error => { if (!cancelled) setContactsError(error instanceof Error ? error.message : "Não foi possível carregar seus contatos."); })
      .finally(() => { if (!cancelled) setLoadingContacts(false); });
    return () => { cancelled = true; };
  }, []);

  const sendToContact = (contactId: string) => {
    const inviteLabel = JSON.stringify({
      type: "cloud_invitation",
      cloudId,
      inviteToken: inviteToken ?? null,
      cloudTitle,
      cloudDuration: cloudDuration ?? "",
      cloudMembersCount: cloudMembersCount ?? 1,
      cloudVisibility: cloudVisibility ?? "public",
    });
    const params = new URLSearchParams({
      id: contactId,
      share: "cloud",
      url: shareUrl,
      title: inviteLabel,
      autosend: "true",
    });
    window.location.assign(`/messages?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[420px] rounded-t-3xl sm:rounded-3xl bg-[#111116] border border-white/[0.08] pb-safe overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.06]">
          <h2 className="text-[16px] font-bold text-white">Encaminhar Cloud</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <XIcon s={16} />
          </button>
        </div>

        {/* Cloud preview */}
        <div className="mx-5 mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">Cloud</p>
          <p className="text-[14px] font-semibold text-white line-clamp-1">{cloudTitle}</p>
          <p className="text-[12px] text-white/40 mt-0.5 truncate">{shareUrl}</p>
        </div>

        {/* Messenger contacts */}
        <div className="px-5 mt-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/40 mb-3">Enviar no mensageiro</p>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
            {loadingContacts && <p className="py-3 text-[13px] text-white/45">Carregando contatos...</p>}
            {contactsError && <p className="py-3 text-[13px] text-red-300">{contactsError}</p>}
            {!loadingContacts && !contactsError && contacts.length === 0 && <p className="py-3 text-[13px] text-white/45">Você ainda não possui contatos para enviar.</p>}
            {/* Test contacts are loaded from the same source as the messenger. */}
            {contacts.map(contact => {
              // For private clouds, wait until the invite token is ready before allowing send
              const pendingToken = isPrivate && !inviteToken;
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => !pendingToken && sendToContact(contact.id)}
                  disabled={pendingToken}
                  title={pendingToken ? "Gerando link de convite..." : undefined}
                  className="flex flex-col items-center gap-1.5 min-w-[60px] group disabled:opacity-50 disabled:cursor-wait"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] text-[15px] font-bold text-white ring-2 ring-transparent transition group-hover:ring-[#A855F7]">
                    {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : contact.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="max-w-[56px] truncate text-[11px] text-white/60 transition group-hover:text-white">
                    {contact.displayName.split(" ")[0]}
                  </span>
                </button>
              );
            })}
            {false && [
              { id: "user1", name: "João Silva", initials: "JS", color: "#A855F7" },
              { id: "user2", name: "Ana Costa", initials: "AC", color: "#3B82F6" },
              { id: "user3", name: "Pedro Lima", initials: "PL", color: "#22C55E" },
            ].map(contact => (
              <button
                key={contact.id}
                type="button"
                onClick={() => sendToContact(contact.id)}
                className="flex flex-col items-center gap-1.5 min-w-[60px] group"
              >
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-[15px] font-bold text-white ring-2 ring-transparent group-hover:ring-[#A855F7] transition"
                  style={{ background: contact.color }}
                >
                  {contact.initials}
                </div>
                <span className="text-[11px] text-white/60 max-w-[56px] truncate group-hover:text-white transition">
                  {contact.name.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* External share */}
        <div className="px-5 mt-4 mb-5">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/40 mb-3">Compartilhar fora</p>
          <div className="flex flex-col gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${cloudTitle}\n${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-[14px] font-medium text-white hover:border-[#25D366]/40 hover:bg-[#25D366]/10 transition"
            >
              <span className="text-[#25D366]"><WhatsAppIcon /></span>
              WhatsApp
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(cloudTitle)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-[14px] font-medium text-white hover:border-[#2AABEE]/40 hover:bg-[#2AABEE]/10 transition"
            >
              <span className="text-[#2AABEE]"><TelegramIcon /></span>
              Telegram
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-[14px] font-medium text-white hover:border-[#A855F7]/40 hover:bg-[#A855F7]/10 transition"
            >
              <span className="text-[#A855F7]"><CopyLinkIcon /></span>
              {copied ? "Link copiado!" : "Copiar link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ManageMembersModal ───────────────────────────────────────────────────────

type CloudMemberEntry = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; profile: { displayName: string; username: string; avatarUrl: string | null } };
};

function ManageMembersModal({
  cloudId,
  cloudTitle,
  isPrivate,
  members,
  isRemovingMember,
  onRemoveMember,
  onClose,
}: {
  cloudId: string;
  cloudTitle: string;
  isPrivate: boolean;
  members: CloudMemberEntry[];
  isRemovingMember: boolean;
  onRemoveMember: (userId: string) => void;
  onClose: () => void;
}) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateInvite = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/invite`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.invite?.token) {
        const link = `${window.location.origin}/invite/${data.invite.token}`;
        setInviteLink(link);
      }
    } catch {
      // ignore
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const nonHostMembers = members.filter((m) => m.role !== "host");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-bold text-white">Gerenciar Membros</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white"
          >
            <XIcon s={16} />
          </button>
        </div>

        {/* Invite link section — only for private clouds */}
        {isPrivate && (
          <div className="mb-4 rounded-xl border border-[#7C3AED]/20 bg-[#7C3AED]/5 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#C4B5FD] mb-3">
              Convite por link
            </p>
            {inviteLink ? (
              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[12px] text-white/60 break-all">
                  {inviteLink}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#7C3AED] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#6D28D9]"
                >
                  {copied ? (
                    <>
                      <CheckIcon s={14} />
                      Link copiado!
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copiar link de convite
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={generateInvite}
                disabled={isGenerating}
                className="flex items-center justify-center gap-2 w-full rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/10 px-4 py-2.5 text-[13px] font-semibold text-[#C4B5FD] transition hover:bg-[#7C3AED]/20 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {isGenerating ? "Gerando..." : "Gerar link de convite"}
              </button>
            )}
          </div>
        )}

        {/* Members list */}
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {nonHostMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                {member.user.profile.avatarUrl ? (
                  <img
                    src={member.user.profile.avatarUrl}
                    alt={member.user.profile.displayName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-[#A855F7] flex items-center justify-center text-sm font-semibold text-white">
                    {member.user.profile.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-[14px] font-semibold text-white">{member.user.profile.displayName}</p>
                  <p className="text-[12px] text-white/50">@{member.user.profile.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveMember(member.userId)}
                disabled={isRemovingMember}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-red-500/20 hover:text-red-500 disabled:opacity-50"
                title="Remover membro"
              >
                <XIcon s={14} />
              </button>
            </div>
          ))}
          {nonHostMembers.length === 0 && (
            <p className="text-[14px] text-white/50 text-center py-6">Nenhum membro para gerenciar</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CloudChat({ cloudId, title, duration: durationProp, createdAt: createdAtProp, participants, visibility: visibilityProp, onBack }: CloudChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [replyTo, setReplyTo] = useState<ReplyMeta | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [hyped, setHyped] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Seed cloudMeta imediatamente com as props vindas da URL (fallback rápido),
  // sobrescrito quando o fetch retornar os dados reais do banco.
  const [cloudMeta, setCloudMeta] = useState<CloudMeta | null>(() => {
    if (title && durationProp && createdAtProp) {
      return { title, duration: durationProp, createdAt: createdAtProp, membersCount: participants ?? 1, visibility: (visibilityProp === "private" ? "private" : "public") };
    }
    return null;
  });
  const { formatted: liveTimer, remaining, isExpired } = useCountdown(cloudMeta);
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [reactionUsersOpen, setReactionUsersOpen] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<{ emoji: string; reactions: Reaction[] } | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);

  // Redirect to feed when cloud expires
  useEffect(() => {
    if (isExpired && cloudId !== "unknown") {
      router.replace("/");
    }
  }, [isExpired, cloudId, router]);

  // fetch current user
  useEffect(() => {
    fetch('/api/auth/me', {
      credentials: 'include',
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: { user?: { id: string } }) => {
        if (data?.user?.id) {
          setCurrentUserId(data.user.id);
        }
      })
      .catch(() => {
        // User not logged in
      });
  }, []);

  // Auto-join the cloud when entering (creates membership if not already a member)
  useEffect(() => {
    if (!cloudId || cloudId === "unknown") return;
    fetch(`/api/clouds/${encodeURIComponent(cloudId)}/join`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {
      // Non-critical — user may already be a member or not logged in
    });
  }, [cloudId]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpen && !(event.target as HTMLElement).closest('[data-menu="true"]')) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // fetch cloud metadata (title, duration, membersCount, authorId)
  useEffect(() => {
    if (!cloudId || cloudId === "unknown") return;
    let cancelled = false;
    fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, {
      cache: "no-store",
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: { cloud?: { title: string; description?: string | null; duration: string; createdAt: string; membersCount: number; authorId: string; visibility?: string; members?: Array<{ id: string; userId: string; role: string; user: { id: string; profile: { displayName: string; username: string; avatarUrl: string | null } } }> } }) => {
        if (cancelled || !data?.cloud) return;
        const c = data.cloud;
        setCloudMeta({
          title: c.title,
          duration: c.duration,
          createdAt: c.createdAt,
          membersCount: c.membersCount,
          description: c.description,
          authorId: c.authorId,
          visibility: c.visibility === "private" ? "private" : "public",
          members: c.members,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // If API fails, use props as fallback (for seed data)
          if (title && durationProp) {
            setCloudMeta({
              title,
              duration: durationProp,
              createdAt: createdAtProp || new Date().toISOString(),
              membersCount: participants || 1,
            });
          } else {
            console.warn("[CloudChat] failed to load cloud meta:", err);
          }
        }
      });
    return () => { cancelled = true; };
  }, [cloudId, title, durationProp, createdAtProp, participants]);

  // load existing messages from database
  useEffect(() => {
    if (!cloudId || cloudId === "unknown") {
      setMessages([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages`, {
      cache: "no-store",
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: { messages?: any[] }) => {
        if (cancelled || !data?.messages) return;
        const mappedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          sender: msg.sender,
          initials: msg.initials,
          color: msg.color,
          type: msg.type,
          content: msg.content,
          time: new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          flames: 0,
          own: msg.own,
          isPinned: msg.isPinned,
          replyTo: msg.replyTo,
          audioUrl: msg.mediaUrl,
          duration: msg.type === "audio" ? "0:00" : undefined,
          reactions: msg.reactions || [],
        }));
        console.log("[CloudChat] Loaded messages from server:", mappedMessages);
        setMessages(mappedMessages);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.warn("[CloudChat] failed to load messages:", err);
          setMessages([]);
        }
      });
    return () => { cancelled = true; };
  }, [cloudId]);

  // auto-scroll when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendText = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    // Create optimistic message
    const optimisticMsg: TextMsg = {
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

    setMessages((prev) => [...prev, optimisticMsg]);
    setDraft("");
    setReplyTo(null);
    setEmojiOpen(false);

    // Send to backend
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({
          type: "text",
          content: trimmed,
          replyToMessageId: replyTo?.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CloudChat] Message sent successfully:', data.message);
        // Replace optimistic message with server message
        setMessages((prev) => prev.map((m) => 
          m.id === optimisticMsg.id 
            ? {
                ...m,
                id: data.message.id,
                sender: data.message.sender,
                initials: data.message.initials,
                time: new Date(data.message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                isPinned: data.message.isPinned,
              }
            : m
        ));
      } else {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        console.error("Failed to send message");
      }
    } catch (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      console.error("Failed to send message:", error);
    }
  }, [draft, replyTo, cloudId]);

  const sendAudio = useCallback(async (audioUrl: string, duration: string, waveform?: number[]) => {
    // Create optimistic message
    const optimisticMsg: AudioMsg = {
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

    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyTo(null);
    setEmojiOpen(false);

    // Send to backend
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({
          type: "audio",
          mediaUrl: audioUrl,
          replyToMessageId: replyTo?.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Replace optimistic message with server message
        setMessages((prev) => prev.map((m) => 
          m.id === optimisticMsg.id 
            ? {
                ...m,
                id: data.message.id,
                sender: data.message.sender,
                initials: data.message.initials,
                time: new Date(data.message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                isPinned: data.message.isPinned,
              }
            : m
        ));
      } else {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        console.error("Failed to send audio message");
      }
    } catch (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      console.error("Failed to send audio message:", error);
    }
  }, [replyTo, cloudId, currentUserId]);

  const recorder = useRecorder(sendAudio);

  const addReaction = useCallback(async (id: string, emoji: string) => {
    setReactionPickerFor(null);
    
    // Check if user already reacted with this emoji
    const message = messages.find((m) => m.id === id);
    if (!message || !currentUserId) return;

    const existingReaction = message.reactions?.find(
      (r) => r.emoji === emoji && r.userId === currentUserId
    );

    if (existingReaction) {
      // Remove the reaction locally (toggle)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                reactions: m.reactions?.filter((r) => r.id !== existingReaction.id) || [],
              }
            : m
        )
      );
    } else {
      // Add reaction locally
      const newReaction: Reaction = {
        id: `temp-${Date.now()}`,
        emoji,
        userId: currentUserId,
        user: {
          id: currentUserId,
          username: "Você",
          displayName: "Você",
          avatarUrl: null,
        },
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                reactions: [...(m.reactions || []), newReaction],
              }
            : m
        )
      );
    }

    // Sync with backend
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages/${encodeURIComponent(id)}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ emoji }),
      });

      if (response.ok) {
        const data = await response.json();
        // Reload all messages to get the accurate reaction state from server
        const messagesResponse = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages`, {
          cache: "no-store",
          credentials: "include",
        });
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const mappedMessages = messagesData.messages.map((msg: any) => ({
            id: msg.id,
            sender: msg.sender,
            initials: msg.initials,
            color: msg.color,
            type: msg.type,
            content: msg.content,
            time: new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            flames: 0,
            own: msg.own,
            isPinned: msg.isPinned,
            replyTo: msg.replyTo,
            audioUrl: msg.mediaUrl,
            duration: msg.type === "audio" ? "0:00" : undefined,
            reactions: msg.reactions || [],
          }));
          setMessages(mappedMessages);
        }
      } else {
        // Revert on error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  reactions: existingReaction
                    ? [...(m.reactions || []), existingReaction]
                    : m.reactions?.filter((r) => r.userId !== currentUserId) || [],
                }
              : m
          )
        );
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
      // Revert on error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                reactions: existingReaction
                  ? [...(m.reactions || []), existingReaction]
                  : m.reactions?.filter((r) => r.userId !== currentUserId) || [],
              }
            : m
        )
      );
    }
  }, [cloudId, currentUserId, messages]);

  const startReply = (msg: Message) => {
    const content = msg.type === "audio" ? "Áudio" : msg.content;
    setReplyTo({ id: msg.id, sender: msg.sender, content });
    setEmojiOpen(false);
    setReactionPickerFor(null);
  };

  const showReactionUsers = (msgId: string, emoji: string, reactions: Reaction[]) => {
    setSelectedReaction({ emoji, reactions });
    setReactionUsersOpen(true);
  };

  const togglePin = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    const currentPinnedState = msg.isPinned;
    const newPinnedState = !currentPinnedState;

    // Verificar se o ID é um UUID válido (formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = uuidRegex.test(msgId);

    // Se for pinar uma nova mensagem, primeiro desfixar qualquer mensagem já fixada
    const currentlyPinnedMessage = messages.find((m) => m.isPinned && m.id !== msgId);

    // Se não for um UUID válido (ex: mensagens de exemplo), apenas atualizar estado local
    if (!isValidUuid) {
      console.log("Skipping API call for non-UUID message ID:", msgId);
      setMessages((prev) => {
        const updated = prev.map((m) => {
          if (m.id === msgId) {
            return { ...m, isPinned: newPinnedState };
          }
          // Se estiver pinando uma nova mensagem, desfixar a anterior
          if (newPinnedState && m.isPinned && m.id !== msgId) {
            return { ...m, isPinned: false };
          }
          return m;
        });
        // Reordenar: fixadas primeiro
        return [...updated].sort((a, b) => {
          const aPriority = a.isPinned ? 0 : 1;
          const bPriority = b.isPinned ? 0 : 1;
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          return 0;
        });
      });
      return;
    }

    // Se houver uma mensagem fixada anterior e estamos pinando uma nova, desfixar a anterior primeiro
    if (newPinnedState && currentlyPinnedMessage && currentlyPinnedMessage.id !== msgId) {
      const unpinEndpoint = `/api/clouds/${cloudId}/unpin-message`;
      try {
        await fetch(unpinEndpoint, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messageId: currentlyPinnedMessage.id }),
        });
      } catch (error) {
        console.error("Failed to unpin previous message:", error);
      }
    }

    const endpoint = newPinnedState ? `/api/clouds/${cloudId}/pin-message` : `/api/clouds/${cloudId}/unpin-message`;

    console.log("Toggle pin:", { msgId, currentPinnedState, newPinnedState, endpoint, cloudId });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId: msgId }),
      });

      console.log("Response status:", response.status, "Response ok:", response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log("Response data:", data);

        // Atualizar estado localmente imediatamente
        setMessages((prev) => {
          const updated = prev.map((m) => {
            if (m.id === msgId) {
              return { ...m, isPinned: newPinnedState };
            }
            // Se estiver pinando uma nova mensagem, desfixar a anterior
            if (newPinnedState && m.isPinned && m.id !== msgId) {
              return { ...m, isPinned: false };
            }
            return m;
          });
          console.log("Updated messages:", updated);
          // Reordenar: fixadas primeiro
          return [...updated].sort((a, b) => {
            const aPriority = a.isPinned ? 0 : 1;
            const bPriority = b.isPinned ? 0 : 1;
            if (aPriority !== bPriority) {
              return aPriority - bPriority;
            }
            return 0;
          });
        });
      } else {
        const errorText = await response.text();
        console.error("Failed to toggle pin:", response.status, errorText);
      }
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  };

  const startEditMsg = (msg: Message) => {
    if (msg.type !== "text") return;
    setEditingMsg(msg);
    setEditDraft(msg.content);
  };

  const submitEditMsg = useCallback(async () => {
    if (!editingMsg || editingMsg.type !== "text") return;
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === editingMsg.content) { setEditingMsg(null); return; }

    // Optimistic update
    setMessages((prev) => prev.map((m) => m.id === editingMsg.id ? { ...m, content: trimmed } : m));
    setEditingMsg(null);

    try {
      const res = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages/${encodeURIComponent(editingMsg.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        // Revert on failure
        setMessages((prev) => prev.map((m) => m.id === editingMsg.id ? { ...m, content: (editingMsg as TextMsg).content } : m));
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === editingMsg.id ? { ...m, content: (editingMsg as TextMsg).content } : m));
    }
  }, [cloudId, editDraft, editingMsg]);

  const deleteMsg = useCallback(async (msgId: string) => {
    // Optimistic removal
    setMessages((prev) => prev.filter((m) => m.id !== msgId));

    try {
      await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages/${encodeURIComponent(msgId)}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      // If delete fails the message just won't reappear until refresh — acceptable
    }
  }, [cloudId]);

  const startForwardMsg = (msg: Message) => {
    setForwardMsg(msg);
  };

  const handleDeleteCloud = async () => {
    if (!cloudId || cloudId === "unknown") return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        window.location.href = '/';
      } else {
        console.error('Failed to delete cloud');
      }
    } catch (error) {
      console.error('Error deleting cloud:', error);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!cloudId || cloudId === "unknown") return;
    setIsRemovingMember(true);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/members/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        // Refresh cloud metadata to update members list
        fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, {
          cache: "no-store",
          credentials: "include",
        })
          .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
          .then((data: { cloud?: { title: string; description?: string | null; duration: string; createdAt: string; membersCount: number; authorId: string; visibility?: string; members?: Array<{ id: string; userId: string; role: string; user: { id: string; profile: { displayName: string; username: string; avatarUrl: string | null } } }> } }) => {
            if (data?.cloud) {
              const c = data.cloud;
              setCloudMeta({
                title: c.title,
                duration: c.duration,
                createdAt: c.createdAt,
                membersCount: c.membersCount,
                description: c.description,
                authorId: c.authorId,
                visibility: c.visibility === "private" ? "private" : "public",
                members: c.members,
              });
            }
          });
      } else {
        console.error('Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleLeaveCloud = async () => {
    if (!cloudId || cloudId === "unknown") return;
    setIsLeaving(true);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        router.replace('/');
      } else {
        const data = await response.json().catch(() => null);
        console.error('Failed to leave cloud:', data?.message);
        setLeaveConfirmOpen(false);
      }
    } catch (error) {
      console.error('Error leaving cloud:', error);
    } finally {
      setIsLeaving(false);
    }
  };

  const isRecording = recorder.state === "recording" || recorder.state === "paused";

  const cloudTitle = cloudMeta?.title ?? title ?? "…";
  const participantCount = cloudMeta?.membersCount ?? participants ?? 0;

  return (
    <div className="flex h-full flex-col bg-black text-white">

      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,5,40,0.40) 0%, rgba(8,3,20,0.85) 45%, #030208 100%)" }}>
        {/* Back */}
        {onBack ? (
          <button
            type="button"
            aria-label="Voltar"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-white/70 transition hover:text-white"
          >
            <BackArrowIcon />
          </button>
        ) : (
          <Link
            href="/"
            aria-label="Voltar"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-white/70 transition hover:text-white"
          >
            <BackArrowIcon />
          </Link>
        )}

        {/* Title + meta */}
        <div className="flex flex-1 flex-col gap-1 overflow-hidden">
          <h1 className="truncate text-[28px] font-bold leading-tight text-white">
            {cloudTitle}
          </h1>
          <div className="flex items-center gap-3 text-[16px] text-white/50">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-[#A855F7]" />
              {participantCount} {participantCount === 1 ? "pessoa" : "pessoas"} na conversa
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1 font-sans font-bold text-[#A855F7] text-[22px]" style={{ fontFamily: 'Arial, sans-serif' }}>
              <ClockIcon />
              {liveTimer}
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex shrink-0 items-center gap-0.5">
          {cloudMeta?.visibility !== "private" && (
            <>
              <button 
                type="button" 
                aria-label="Hype" 
                onClick={() => setHyped(!hyped)}
                className={`flex h-10 w-10 items-center justify-center transition ${hyped ? 'text-[#F97316]' : 'text-white hover:text-[#F97316]'}`}
              >
                <FireIcon filled={hyped} />
              </button>
              <button
                type="button"
                aria-label="Encaminhar"
                onClick={() => setShareOpen(true)}
                className="group flex h-10 w-10 items-center justify-center text-white/60 transition hover:text-white"
              >
                <ForwardIcon />
              </button>
            </>
          )}
          {currentUserId === cloudMeta?.authorId && (
            <>
              <button
                type="button"
                aria-label="Gerenciar membros"
                onClick={() => setManageMembersOpen(true)}
                className="group flex h-10 w-10 items-center justify-center text-white/60 transition hover:text-white"
              >
                <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="overflow-visible">
                  {/* Main person — rises first, no delay */}
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" className="transition-transform duration-200 group-hover:-translate-y-[3px]" style={{ transitionDelay: '0ms' }} />
                  <circle cx="9" cy="7" r="4" className="transition-transform duration-200 group-hover:-translate-y-[3px]" style={{ transitionDelay: '0ms' }} />
                  {/* Second person — rises after, with delay */}
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" className="transition-transform duration-200 group-hover:-translate-y-[3px]" style={{ transitionDelay: '80ms' }} />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" className="transition-transform duration-200 group-hover:-translate-y-[3px]" style={{ transitionDelay: '80ms' }} />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Excluir Cloud"
                onClick={() => setDeleteConfirmOpen(true)}
                className="group flex h-10 w-10 items-center justify-center text-white/60 transition hover:text-red-500"
              >
                <TrashIcon s={24} />
              </button>
            </>
          )}
          {/* Three-dots menu — always visible */}
          <div className="relative" data-menu="true">
            <button 
              type="button" 
              aria-label="Mais opções" 
              onClick={() => setMenuOpen(!menuOpen)}
              className="group flex h-10 w-10 items-center justify-center text-white transition hover:text-white"
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#11141F] shadow-xl z-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setInfoOpen(true); }}
                  className="w-full px-4 py-3 text-left text-[14px] text-white/80 hover:bg-white/5 hover:text-white transition flex items-center gap-3"
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  Informações da Cloud
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setDescriptionOpen(true); }}
                  className="w-full px-4 py-3 text-left text-[14px] text-white/80 hover:bg-white/5 hover:text-white transition flex items-center gap-3"
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>
                  Ler descrição
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                  className="w-full px-4 py-3 text-left text-[14px] text-white/80 hover:bg-white/5 hover:text-red-400 transition flex items-center gap-3"
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                  Denunciar Cloud
                </button>
                {currentUserId !== cloudMeta?.authorId && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setLeaveConfirmOpen(true); }}
                    className="w-full px-4 py-3 text-left text-[14px] text-white/80 hover:bg-white/5 hover:text-red-400 transition flex items-center gap-3"
                  >
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sair da Cloud
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 shrink-0 border-t border-white/[0.06]" />

      {/* ── Messages list ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4" ref={messagesContainerRef}>
        <div className="space-y-4">
          {/* Pinned messages - sticky at top */}
          {messages.filter(msg => msg.isPinned).map((msg) => (
            <div key={msg.id} className="sticky top-0 z-10">
              <MsgBubble
                msg={msg}
                onReply={startReply}
                onEdit={startEditMsg}
                onDelete={deleteMsg}
                onForward={startForwardMsg}
                reactionPickerFor={reactionPickerFor}
                setReactionPickerFor={setReactionPickerFor}
                onAddReaction={addReaction}
                onPinToggle={togglePin}
                isCloudAuthor={currentUserId === cloudMeta?.authorId}
                onShowReactionUsers={showReactionUsers}
              />
            </div>
          ))}
          {/* Unpinned messages */}
          {messages.filter(msg => !msg.isPinned).map((msg) => (
            <MsgBubble
              key={msg.id}
              msg={msg}
              onReply={startReply}
              onEdit={startEditMsg}
              onDelete={deleteMsg}
              onForward={startForwardMsg}
              reactionPickerFor={reactionPickerFor}
              setReactionPickerFor={setReactionPickerFor}
              onAddReaction={addReaction}
              onPinToggle={togglePin}
              isCloudAuthor={currentUserId === cloudMeta?.authorId}
              onShowReactionUsers={showReactionUsers}
            />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* ── Edit bar (replaces input when editing) ── */}
      {editingMsg && (
        <div className="border-t border-[#7C3AED]/40 bg-black px-4 py-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-[#7C3AED]/40 bg-[#1C1F2E] px-4 py-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold uppercase tracking-wider text-[#A855F7]">Editando mensagem</span>
              <button type="button" onClick={() => setEditingMsg(null)} className="text-white/40 hover:text-white transition">
                <XIcon s={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitEditMsg(); } if (e.key === "Escape") setEditingMsg(null); }}
                className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => void submitEditMsg()}
                disabled={!editDraft.trim() || editDraft.trim() === (editingMsg.type === "text" ? editingMsg.content : "")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9] disabled:opacity-40"
              >
                <CheckIcon s={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="border-t border-white/[0.08] bg-black px-4 py-3">

        {/* Recording state */}
        {isRecording ? (
          <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-black px-4 py-2.5">
            <div className="flex-1 text-[14px] text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
              {recorder.state === "paused" ? "Pausado" : "Gravando…"}{" "}
              {fmt(recorder.seconds)}
            </div>
            <Waveform active={recorder.state === "recording"} paused={recorder.state === "paused"} progress={recorder.seconds} />
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
                <TrashIcon s={16} />
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
                className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white outline-none"
              />

              {/* Send / Mic toggle */}
              {draft.trim() ? (
                <button type="button" aria-label="Enviar mensagem" onClick={sendText}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition">
                  <SendIcon />
                </button>
              ) : (
                <button type="button" aria-label="Gravar áudio" onClick={recorder.start}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#1C1F2E] text-white hover:border-[#7C3AED] transition">
                  <MicIcon s={18} />
                </button>
              )}
            </div>
          </div>
        )}
        {emojiOpen && !isRecording && (
          <div className="mt-3 rounded-[22px] border border-white/[0.08] bg-[#15161C] shadow-[0_18px_50px_rgba(0,0,0,0.35)] overflow-hidden">
            {/* Abas de categorias */}
            <div className="flex gap-1 overflow-x-auto border-b border-white/[0.07] px-2 pt-2 pb-0 scrollbar-none">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setEmojiCategory(i)}
                  title={cat.label}
                  className={`shrink-0 rounded-t-xl px-3 py-2 text-[18px] transition ${i === emojiCategory ? "bg-white/[0.08]" : "opacity-50 hover:opacity-100"}`}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
            {/* Emojis da categoria ativa */}
            <div className="max-h-[28vh] overflow-y-auto p-3">
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_CATEGORIES[emojiCategory]?.emojis.map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setDraft((d) => d + emoji)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0E0F15] text-[18px] transition hover:border-white/20 hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Share modal ── */}
      {shareOpen && (
        <CloudShareModal
          cloudId={cloudId}
          cloudTitle={cloudTitle}
          cloudDuration={cloudMeta?.duration}
          cloudMembersCount={cloudMeta?.membersCount}
          cloudVisibility={cloudMeta?.visibility}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <h3 className="text-[18px] font-bold text-white mb-2">Excluir Cloud</h3>
            <p className="text-[14px] text-white/60 mb-6">
              Tem certeza que deseja excluir esta cloud? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCloud}
                disabled={isDeleting}
                className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reaction users modal ── */}
      {reactionUsersOpen && selectedReaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-bold text-white flex items-center gap-2">
                <span className="text-2xl">{selectedReaction.emoji}</span>
                <span>Reações ({selectedReaction.reactions.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setReactionUsersOpen(false)}
                className="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white"
              >
                <XIcon s={16} />
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedReaction.reactions.map((reaction) => (
                <div key={reaction.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                  {reaction.user.avatarUrl ? (
                    <img
                      src={reaction.user.avatarUrl}
                      alt={reaction.user.displayName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-[#A855F7] flex items-center justify-center text-sm font-semibold text-white">
                      {reaction.user.displayName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-white">{reaction.user.displayName}</p>
                    <p className="text-[12px] text-white/50">@{reaction.user.username}</p>
                  </div>
                  <span className="text-2xl">{selectedReaction.emoji}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Manage members modal ── */}
      {manageMembersOpen && (
        <ManageMembersModal
          cloudId={cloudId}
          cloudTitle={cloudTitle}
          isPrivate={cloudMeta?.visibility === "private"}
          members={cloudMeta?.members ?? []}
          isRemovingMember={isRemovingMember}
          onRemoveMember={handleRemoveMember}
          onClose={() => setManageMembersOpen(false)}
        />
      )}

      {/* ── Cloud info modal ── */}
      {infoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-bold text-white">Informações da Cloud</h3>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white"
              >
                <XIcon s={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[12px] uppercase tracking-wider text-white/40 mb-1">Título</p>
                <p className="text-[16px] text-white">{cloudTitle}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wider text-white/40 mb-1">Duração</p>
                <p className="text-[16px] text-white">{cloudMeta?.duration || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wider text-white/40 mb-1">Participantes</p>
                <p className="text-[16px] text-white">{participantCount} {participantCount === 1 ? 'pessoa' : 'pessoas'}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-wider text-white/40 mb-1">Criada em</p>
                <p className="text-[16px] text-white">{cloudMeta?.createdAt ? new Date(cloudMeta.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {descriptionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="flex items-center justify-between gap-4 mb-4"><h3 className="text-[18px] font-bold text-white">Descrição da Cloud</h3><button type="button" onClick={() => setDescriptionOpen(false)} className="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white"><XIcon s={16} /></button></div>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/75">{cloudMeta?.description?.trim() || "O criador não adicionou uma descrição para esta Cloud."}</p>
          </div>
        </div>
      )}

      {/* ── Report modal ── */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-bold text-white">Denunciar Cloud</h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white"
              >
                <XIcon s={16} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-[14px] text-white/70">Por favor, selecione o motivo da denúncia:</p>
              <div className="space-y-2">
                {['Conteúdo inadequado', 'Spam', 'Harassment', 'Violação de privacidade', 'Outro'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setReportOpen(false);
                      // Aqui você pode adicionar a lógica de envio da denúncia
                      alert(`Denúncia enviada: ${reason}`);
                    }}
                    className="w-full px-4 py-3 text-left text-[14px] text-white/80 hover:bg-white/5 hover:text-white transition rounded-lg border border-white/5"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave Cloud confirmation modal ── */}
      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-bold text-white">Sair da Cloud</h3>
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(false)}
                className="flex h-8 w-8 items-center justify-center text-white/60 transition hover:text-white"
              >
                <XIcon s={16} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-[14px] text-white/70">
                Tem certeza que deseja sair desta Cloud? Você não poderá mais participar das conversas.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setLeaveConfirmOpen(false)}
                  disabled={isLeaving}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 hover:text-white transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleLeaveCloud}
                  disabled={isLeaving}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50"
                >
                  {isLeaving ? "Saindo..." : "Sair"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Forward modal ── */}
      {forwardMsg && (
        <CloudShareModal
          cloudId={cloudId}
          cloudTitle={forwardMsg.type === "text" ? forwardMsg.content.slice(0, 60) : "Mensagem de áudio"}
          cloudDuration={cloudMeta?.duration}
          cloudMembersCount={cloudMeta?.membersCount}
          cloudVisibility={cloudMeta?.visibility}
          onClose={() => setForwardMsg(null)}
        />
      )}
    </div>
  );
}
