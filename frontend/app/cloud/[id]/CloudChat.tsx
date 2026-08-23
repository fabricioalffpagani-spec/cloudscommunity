"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

import { FlameIcon } from "../../components/FlameIcon";
import { UserAvatar, getSessionUserDisplayName, useSessionUser } from "../../components/session-user";
import { ArrowLeftIcon, CheckIcon, MicIcon, PauseIcon, PlayIcon, PlusIcon, SendIcon, TrashIcon } from "../../components/ui-icons";

type CloudPayload = {
  id: string;
  title: string;
  description: string | null;
  duration: string;
  status: string;
  authorId: string;
  createdAt?: string;
  visibility?: "public" | "private";
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
  membersCount: number;
  hypesCount?: number;
  hyped?: boolean;
  members?: Array<{
    id: string;
    userId: string;
    role: string;
    user: {
      id: string;
      profile: {
        displayName: string;
        username: string;
        avatarUrl: string | null;
      };
    };
  }>;
  href: string;
};

type CloudMemberEntry = {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  };
};

type PublicUserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type ReactionPayload = {
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

type CloudMessagePayload = {
  id: string;
  cloudId: string;
  senderId: string;
  type: "text" | "audio" | "image" | "link";
  content: string | null;
  mediaUrl: string | null;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  replyTo: {
    id: string;
    sender: string;
    content: string | null;
  } | null;
  reactions: ReactionPayload[];
};

type CloudChatProps = {
  cloudId: string;
  title?: string;
  duration?: string;
  createdAt?: string;
  participants?: number;
  visibility?: string;
};

type CloudMeta = {
  id?: string;
  title: string;
  duration: string;
  createdAt: string;
  membersCount: number;
  description?: string | null;
  authorId?: string;
  visibility: "public" | "private";
  hypesCount?: number;
  hyped?: boolean;
  members?: CloudMemberEntry[];
};

type RecordedAudio = {
  blob: Blob;
  durationMs: number;
  mimeType: string;
};

type RecorderState = "idle" | "recording" | "paused";

type ChatMessage = {
  id: string;
  cloudId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  side: "left" | "right";
  kind: "text" | "audio" | "image" | "link";
  content: string;
  mediaUrl: string | null;
  replyTo: {
    id: string;
    sender: string;
    content: string | null;
  } | null;
  reactions: ReactionPayload[];
  time: string;
  isoTime: string;
  pending?: boolean;
  clientMessageId?: string | null;
  audioDurationMs?: number | null;
};

const SOCKET_URL = process.env.NEXT_PUBLIC_CLOUDS_SOCKET_URL?.trim() || "";
const MESSAGE_LIMIT = 50;
const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Rostos",
    icon: "😀",
    emojis: [
      "😀","😄","😁","😆","😅","🤣","😂","🙂","😊","😇",
      "🥰","😍","🤩","😘","😋","😛","😜","🤪","😝","🤑",
      "🤗","🤭","🤫","🤔","😐","😑","😏","😒","🙄","😬",
      "😔","😪","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵",
      "🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐",
      "😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦",
      "😧","😨","😰","😥","😢","😭","😱","😖","😣","😞",
      "😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿",
      "💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖",
    ],
  },
  {
    label: "Gestos",
    icon: "👋",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","👌","🤏","✌️","🤞","🤟",
      "🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊",
      "👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️",
      "💅","🤳","💪","🦾","👀","👁️","👅","👄","💋",
    ],
  },
  {
    label: "Corações",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❣️","💕","💞","💓","💗","💖","💝","💘","💌","💟",
      "💯","💢","💥","💫","💦","💨","💬","💭","💤","🔥","✨","🎉","🎊","🎈",
    ],
  },
  {
    label: "Animais",
    icon: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
      "🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧",
      "🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄",
      "🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🦂","🐢",
      "🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡",
      "🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓",
      "🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘",
      "🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐",
      "🦌","🐕","🐩","🦮","🐈","🐓","🦃","🦤","🦚","🦜",
      "🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥",
    ],
  },
  {
    label: "Comida",
    icon: "🍎",
    emojis: [
      "🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈",
      "🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦",
      "🥬","🥒","🌶️","🫑","🧄","🧅","🥔","🍠","🥐","🥯",
      "🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓",
      "🥩","🍗","🍖","🌭","🍔","🍟","🍕","🫓","🥪","🥙",
      "🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜",
      "🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘",
      "🍥","🥮","🍢","🧁","🍰","🎂","🍮","🍭","🍬","🍫",
      "🍿","🍩","🍪","🌰","🥜","🍯","🧃","🥤","🧋","🍵",
      "☕","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾",
    ],
  },
  {
    label: "Viagens",
    icon: "✈️",
    emojis: [
      "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐",
      "🛻","🚚","🚛","🚜","🏍️","🛵","🚲","🛴","🛹","🛼",
      "🚁","🛸","✈️","🛩️","🚀","🛶","⛵","🚤","🛥️","🚢",
      "🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝",
      "🗺️","🏔️","⛰️","🌋","🏕️","🏖️","🏝️","🌍","🌎","🌏",
      "🗼","🗽","🏰","🏯","🗿","⛩️","🕌","🕍","⛪","🏛️",
      "🌁","🌃","🌄","🌅","🌆","🌇","🌉","🎠","🎡","🎢",
    ],
  },
  {
    label: "Atividades",
    icon: "⚽",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱",
      "🏓","🏸","🏒","🏑","🥍","🏏","⛳","🪃","🥊","🥋",
      "🎯","⛸️","🎿","🛷","🥌","🎣","🤿","🎽","🏆","🥇",
      "🥈","🥉","🏅","🎖️","🎪","🤹","🎨","🎭","🎬","🎤",
      "🎧","🎼","🎹","🎸","🎺","🎻","🪕","🥁","🎲","🎮",
      "🕹️","🧩","♠️","♥️","♦️","♣️","🃏","🀄","🎴",
    ],
  },
  {
    label: "Objetos",
    icon: "💡",
    emojis: [
      "💡","🔦","🕯️","🪔","📱","💻","🖥️","⌨️","🖱️","🖨️",
      "📷","📸","📹","🎥","📺","📻","📡","🔋","🔌","💾",
      "💿","📀","🧮","🔭","🔬","🩺","💊","💉","🩹","🩸",
      "🧬","🔑","🗝️","🔒","🔓","🔨","⚙️","🪛","🔧","🔩",
      "🪤","🪣","🧹","🧺","🧻","🚪","🪑","🛋️","🛏️","🧸",
      "🖼️","🎁","🎈","🎀","🎊","🎉","📦","📫","📬","📭",
      "📮","📝","📚","📖","📰","📌","📍","📎","✂️","🗑️",
      "💰","💳","💸","🧾","📈","📉","📊","🔮","🧿","💈",
    ],
  },
  {
    label: "Natureza",
    icon: "🌸",
    emojis: [
      "🌸","🌼","🌻","🌺","🌹","🥀","🌷","💐","🍀","🌿",
      "🍃","🍂","🍁","🌱","🌲","🌳","🌴","🌵","🎋","🎍",
      "☀️","🌤️","⛅","🌥️","🌦️","🌧️","⛈️","🌩️","🌪️","🌫️",
      "🌬️","🌀","🌈","❄️","☃️","⛄","☄️","💧","🌊","🔥",
      "⚡","🌑","🌕","🌙","⭐","🌟","🌠","🌌","🪐","☀️",
      "🦋","🐝","🌺","🍄","🌾","🐚","🪸","🪨","🪵","🌻",
    ],
  },
];

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDurationMs(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function dateLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return "Hoje";
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function resolveSocketUrl() {
  if (SOCKET_URL) {
    return SOCKET_URL.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "";
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) {
    throw new Error("Falha ao carregar dados.");
  }

  return payload;
}

function mergeMessage(list: ChatMessage[], next: ChatMessage) {
  const index = next.clientMessageId ? list.findIndex((item) => item.clientMessageId === next.clientMessageId) : -1;

  if (index >= 0) {
    return list.map((item, currentIndex) => {
      if (currentIndex !== index) {
        return item;
      }

      return {
        ...item,
        ...next,
        pending: false,
        audioDurationMs: next.audioDurationMs ?? item.audioDurationMs ?? null,
      };
    });
  }

  if (list.some((item) => item.id === next.id)) {
    return list;
  }

  return [...list, next];
}

function normalizeMessage(payload: CloudMessagePayload, currentUserId?: string | null): ChatMessage {
  const isOwn = Boolean(currentUserId && payload.senderId === currentUserId);

  return {
    id: payload.id,
    cloudId: payload.cloudId,
    senderId: payload.senderId,
    senderName: payload.sender.displayName || payload.sender.username || "Usuário",
    senderAvatarUrl: payload.sender.avatarUrl,
    side: isOwn ? "right" : "left",
    kind: payload.type,
    content: payload.content || "",
    mediaUrl: payload.mediaUrl,
    replyTo: payload.replyTo,
    reactions: payload.reactions || [],
    time: timeLabel(payload.createdAt),
    isoTime: payload.createdAt,
    clientMessageId: payload.clientMessageId,
  };
}

function normalizeCloud(payload: CloudPayload) {
  return {
    id: payload.id,
    title: payload.title,
    description: payload.description,
    duration: payload.duration,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    status: payload.status,
    authorId: payload.authorId,
    membersCount: payload.membersCount,
    hypesCount: payload.hypesCount ?? 0,
    hyped: payload.hyped ?? false,
    visibility: payload.visibility ?? "public",
    author: payload.author,
    members: (payload.members ?? []).map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      user: {
        id: member.user.id,
        displayName: member.user.profile.displayName,
        username: member.user.profile.username,
        avatarUrl: member.user.profile.avatarUrl,
      },
    })),
  };
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function parseDurationSeconds(duration: string) {
  const normalized = duration.trim().toLowerCase().replace(/\s+/g, "");
  const map: Record<string, number> = {
    "5min": 5 * 60,
    "10min": 10 * 60,
    "30min": 30 * 60,
    "1h": 60 * 60,
    "2h": 2 * 60 * 60,
    "5h": 5 * 60 * 60,
    "24h": 24 * 60 * 60,
  };

  return map[normalized] ?? 30 * 60;
}

function useCountdown(meta: CloudMeta | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (!meta?.createdAt) {
      return { formatted: "0:00", remaining: 0, isExpired: false };
    }

    const elapsed = Math.floor((now - new Date(meta.createdAt).getTime()) / 1000);
    const remaining = Math.max(parseDurationSeconds(meta.duration) - elapsed, 0);

    return {
      formatted: formatCountdown(remaining),
      remaining,
      isExpired: remaining <= 0,
    };
  }, [meta?.createdAt, meta?.duration, now]);
}

function HeaderClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function HeaderFireIcon({ active = false }: { active?: boolean }) {
  return <FlameIcon s={26} filled={active} className="transition-transform duration-200 group-hover:-translate-y-[1px] group-hover:scale-105" />;
}

function HeaderForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="overflow-visible transition-transform duration-200 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22 11 13 2 9l20-7z" />
    </svg>
  );
}

function HeaderMembersIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="overflow-visible">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" className="transition-transform duration-200 group-hover:-translate-y-[3px]" style={{ transitionDelay: "0ms" }} />
      <circle cx="9" cy="7" r="4" className="transition-transform duration-200 group-hover:-translate-y-[3px]" style={{ transitionDelay: "0ms" }} />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" className="transition-transform duration-200 group-hover:-translate-y-[3px]" style={{ transitionDelay: "80ms" }} />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" className="transition-transform duration-200 group-hover:-translate-y-[3px]" style={{ transitionDelay: "80ms" }} />
    </svg>
  );
}

function HeaderInfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function HeaderDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} fill="white" aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" className="transition-opacity duration-300 group-hover:opacity-70" style={{ transitionDelay: "0ms" }} />
      <circle cx="12" cy="12" r="1.5" className="transition-opacity duration-300 group-hover:opacity-70" style={{ transitionDelay: "100ms" }} />
      <circle cx="12" cy="19" r="1.5" className="transition-opacity duration-300 group-hover:opacity-70" style={{ transitionDelay: "200ms" }} />
    </svg>
  );
}

function AnimatedTrashIcon({ s = 24 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="overflow-visible">
      <g className="transition-transform duration-200 ease-out group-hover:-translate-y-[7px] group-hover:rotate-[-15deg]" style={{ transformOrigin: "12px 6px" }}>
        <path d="M3 6h18" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      </g>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    </svg>
  );
}

function useAudioRecorder(onStop: (recording: RecordedAudio) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  const stopTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (state !== "idle") {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"].find((type) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      secondsRef.current = 0;
      setSeconds(0);
      setState("recording");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTimers();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        onStop({
          blob,
          durationMs: secondsRef.current * 1000,
          mimeType: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        cleanupStream();
        recorderRef.current = null;
        setState("idle");
        setSeconds(0);
        secondsRef.current = 0;
      };

      recorder.start();
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
    } catch {
      stopTimers();
      cleanupStream();
      setState("idle");
      setSeconds(0);
      secondsRef.current = 0;
      throw new Error("Permissão de microfone negada.");
    }
  }, [cleanupStream, onStop, state, stopTimers]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }, []);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }

    recorder.pause();
    stopTimers();
    setState("paused");
  }, [stopTimers]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") {
      return;
    }

    recorder.resume();
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    setState("recording");
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    stopTimers();
    chunksRef.current = [];

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }

    cleanupStream();
    setState("idle");
    setSeconds(0);
    secondsRef.current = 0;
  }, [cleanupStream, stopTimers]);

  useEffect(() => () => {
    stopTimers();
    cleanupStream();
  }, [cleanupStream, stopTimers]);

  return { state, seconds, start, stop, pause, resume, cancel };
}

const BAR_COUNT = 28;

function Waveform({ active, paused, progress }: { active?: boolean; paused?: boolean; progress?: number }) {
  const [heights, setHeights] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, () => 0));

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (active && !paused) {
      interval = setInterval(() => {
        setHeights(() => Array.from({ length: BAR_COUNT }, () => 4 + Math.floor(Math.random() * 18)));
      }, 240);
    } else if (active && paused) {
      interval = setInterval(() => {
        setHeights(() => Array.from({ length: BAR_COUNT }, () => 6 + Math.floor(Math.random() * 6)));
      }, 800);
    } else {
      setHeights(Array.from({ length: BAR_COUNT }, () => 0));
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [active, paused]);

  const visibleBars = active && progress ? Math.min(Math.floor((progress / 15) * BAR_COUNT), BAR_COUNT) : 0;

  return (
    <div className="flex items-end gap-[3px]" style={{ height: 32 }}>
      {heights.map((h, i) => (
        <span
          key={i}
          className="block w-[4px] rounded-full transition-all duration-150 ease-out"
          style={{
            height: `${h}px`,
            background: active && !paused ? "linear-gradient(to top, #9333EA, #A855F7)" : "linear-gradient(to top, #9333EA 30%, #A855F7 100%)",
            boxShadow: active && !paused ? "0 0 8px rgba(147, 51, 234, 0.6)" : "none",
            opacity: i < visibleBars ? (active ? 1 : 0.6) : 0,
            transition: i < visibleBars ? "height 0.15s ease-out, opacity 0.3s ease-out" : "opacity 0.3s ease-out",
          }}
        />
      ))}
    </div>
  );
}

function MessageReceipt() {
  return <CheckIcon s={14} className="text-white/45" />;
}

function CloudPinIcon({ pinned }: { pinned?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function CloudReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function CloudDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function CloudMsgMenu({
  msg,
  isRight,
  isCloudAuthor,
  isPinned,
  onPin,
  onForward,
  onClose,
}: {
  msg: ChatMessage;
  isRight: boolean;
  isCloudAuthor: boolean;
  isPinned: boolean;
  onPin: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onClose: () => void;
}) {
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

  const textContent = msg.kind === "text" ? msg.content : null;

  const handleCopy = () => {
    const text = textContent ?? "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
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
    } catch { /* ignore */ } finally {
      setTranslating(false);
    }
  };

  return (
    <div
      ref={menuRef}
      className={`absolute z-50 min-w-[168px] rounded-2xl border border-white/[0.08] bg-[#15161C] py-1 shadow-2xl shadow-black/60 ${isRight ? "right-0" : "left-0"}`}
      style={{ bottom: "calc(100% + 4px)" }}
    >
      {translated && (
        <div className="border-b border-white/[0.06] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">Tradução</p>
          <p className="text-[13px] text-white leading-snug">{translated}</p>
        </div>
      )}
      {textContent && (
        <button type="button" onClick={handleCopy} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white">
          <span className="text-white/50">
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          </span>
          {copied ? "Copiado!" : "Copiar"}
        </button>
      )}
      {textContent && (
        <button type="button" onClick={() => void handleTranslate()} disabled={translating} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50">
          <span className="text-white/50">
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
          </span>
          {translating ? "Traduzindo…" : translated ? "Traduzido ✓" : "Traduzir"}
        </button>
      )}
      {isCloudAuthor && (
        <button type="button" onClick={() => { onPin(msg); onClose(); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white">
          <span className="text-white/50">
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
          </span>
          {isPinned ? "Desafixar" : "Fixar mensagem"}
        </button>
      )}
      <button type="button" onClick={() => { onForward(msg); onClose(); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white">
        <span className="text-white/50">
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
        </span>
        Encaminhar
      </button>
    </div>
  );
}

function AudioBubble({ msg, own }: { msg: ChatMessage; own?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) {
      return;
    }

    const onEnded = () => setPlaying(false);
    a.addEventListener("ended", onEnded);
    return () => a.removeEventListener("ended", onEnded);
  }, []);

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`} style={{ minWidth: 220 }}>
      <button
        type="button"
        onClick={() => {
          const audio = audioRef.current;
          if (!audio) {
            return;
          }

          if (playing) {
            audio.pause();
            setPlaying(false);
            return;
          }

          void audio.play();
          setPlaying(true);
        }}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${own ? "bg-white/20 hover:bg-white/30" : "bg-[#7C3AED] hover:bg-[#6D28D9]"}`}
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        {playing ? <PauseIcon s={14} /> : <PlayIcon s={14} />}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[12px] text-white/60">
          <span>Áudio</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{msg.audioDurationMs ? `${Math.max(1, Math.round(msg.audioDurationMs / 1000))}s` : "0s"}</span>
        </div>
        {msg.mediaUrl && <audio ref={audioRef} src={msg.mediaUrl} className="hidden" preload="metadata" />}
      </div>
    </div>
  );
}

function ImageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <a href={msg.mediaUrl || "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a0e3d]">
      {msg.mediaUrl ? (
        <img src={msg.mediaUrl} alt="Imagem enviada" className="max-h-[320px] max-w-full object-cover" />
      ) : (
        <div className="px-4 py-8 text-[14px] text-white/50">Imagem indisponível</div>
      )}
    </a>
  );
}

function CloudMessageBubble({
  msg,
  onReact,
  onReply,
  onPin,
  onForward,
  isCloudAuthor,
  isPinned,
}: {
  msg: ChatMessage;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
  onPin: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  isCloudAuthor: boolean;
  isPinned: boolean;
}) {
  const own = msg.side === "right";
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [msgMenuOpen, setMsgMenuOpen] = useState(false);
  const groupedReactions = useMemo(() => {
    return msg.reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    }, {} as Record<string, ReactionPayload[]>);
  }, [msg.reactions]);

  return (
    <div className={`group flex items-end gap-2.5 ${own ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-9 shrink-0 pt-0.5">
        <UserAvatar
          user={{ id: msg.senderId, username: msg.senderId, displayName: msg.senderName, avatarUrl: msg.senderAvatarUrl }}
          size={34}
        />
      </div>

      <div className={`flex flex-col gap-1.5 ${own ? "items-end" : "items-start"}`} style={{ maxWidth: "74%" }}>
        <div className={`flex items-center gap-2 px-1 ${own ? "flex-row-reverse" : ""}`}>
          <span className="text-[12px] font-semibold text-white/40">{own ? "Você" : msg.senderName}</span>
          {isPinned && <span className="text-[10px] text-[#A855F7]">📌 fixada</span>}
        </div>

        {msg.replyTo && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] text-white/70">
            <p className="font-semibold text-white">{msg.replyTo.sender}</p>
            <p className="mt-1 line-clamp-2 leading-snug">{msg.replyTo.content || ""}</p>
          </div>
        )}

        {msg.kind === "audio" ? (
          <AudioBubble msg={msg} own={own} />
        ) : msg.kind === "image" ? (
          <ImageBubble msg={msg} />
        ) : msg.kind === "link" ? (
          <div className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed text-white ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
            {msg.content}
          </div>
        ) : (
          <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-white ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
            {msg.content}
            {msg.pending && <span className="ml-2 text-[11px] text-white/50">enviando...</span>}
          </div>
        )}

        {/* Action icons row */}
        <div className={`flex items-center gap-1 px-1 ${own ? "flex-row-reverse" : ""}`}>
          <div className={`flex items-center gap-1 text-[11px] text-white/30 ${own ? "flex-row-reverse" : ""}`}>
            <span>{msg.time}</span>
            {own && !msg.pending && <MessageReceipt />}
          </div>
          {/* Hover action icons */}
          <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${own ? "mr-2" : "ml-2"}`}>
            {isCloudAuthor && (
              <button
                type="button"
                title={isPinned ? "Desafixar" : "Fixar mensagem"}
                onClick={() => onPin(msg)}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10 ${isPinned ? "text-[#A855F7]" : "text-white"}`}
              >
                <CloudPinIcon pinned={isPinned} />
              </button>
            )}
            {/* Quick emoji picker */}
            <div className="relative">
              <button
                type="button"
                title="Reagir"
                onClick={() => setEmojiPickerOpen((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/10"
              >
                <span className="text-[14px] leading-none">😀</span>
              </button>
              {emojiPickerOpen && (
                <div className={`absolute bottom-full z-50 mb-1 flex gap-1 rounded-2xl border border-white/10 bg-[#15161C] p-2 shadow-xl ${own ? "right-0" : "left-0"}`}>
                  {["❤️","😂","😮","😢","👍","🔥"].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => { onReact(msg.id, e); setEmojiPickerOpen(false); }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-[18px] transition hover:bg-white/10"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              title="Responder"
              onClick={() => onReply(msg)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            >
              <CloudReplyIcon />
            </button>
            <div className="relative">
              <button
                type="button"
                title="Mais opções"
                onClick={() => setMsgMenuOpen((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/10"
              >
                <CloudDotsIcon />
              </button>
              {msgMenuOpen && (
                <CloudMsgMenu
                  msg={msg}
                  isRight={own}
                  isCloudAuthor={isCloudAuthor}
                  isPinned={isPinned}
                  onPin={onPin}
                  onForward={onForward}
                  onClose={() => setMsgMenuOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        {Object.keys(groupedReactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 px-1 ${own ? "justify-end" : ""}`}>
            {Object.entries(groupedReactions).map(([emoji, reactions]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(msg.id, emoji)}
                className="rounded-full bg-white/10 px-2 py-1 text-[12px] transition hover:bg-white/20"
                title={`${reactions.length} reação(ões) com ${emoji}`}
              >
                <span>{emoji}</span>
                <span className="ml-1 text-white/70">{reactions.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CloudChat({ cloudId, title, duration, createdAt, participants, visibility }: CloudChatProps) {
  const { user, status } = useSessionUser();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioRecorder = useAudioRecorder((recording) => {
    void handleAudioRecordingStop(recording);
  });

  const [cloud, setCloud] = useState<ReturnType<typeof normalizeCloud> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [hyped, setHyped] = useState(false);
  const [hypesCount, setHypesCount] = useState(0);
  const [audioUploading, setAudioUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contacts, setContacts] = useState<PublicUserProfile[]>([]);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [typingUserIds, setTypingUserIds] = useState<Record<string, boolean>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<{ name: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [isUpdatingHype, setIsUpdatingHype] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const [isLeavingCloud, setIsLeavingCloud] = useState(false);
  const [isManagingMemberId, setIsManagingMemberId] = useState<string | null>(null);
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const activeCloudIdRef = useRef(cloudId);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeCloudIdRef.current = cloudId;
  }, [cloudId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!emojiOpen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const picker = document.querySelector('[data-cloud-emoji-picker="true"]');
      const button = document.querySelector('[data-cloud-emoji-toggle="true"]');
      if (picker?.contains(target) || button?.contains(target)) {
        return;
      }

      setEmojiOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [emojiOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!actionMenuOpen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const menu = document.querySelector('[data-cloud-action-menu="true"]');
      const button = document.querySelector('[data-cloud-action-toggle="true"]');
      if (menu?.contains(target) || button?.contains(target)) {
        return;
      }

      setActionMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [actionMenuOpen]);

  const loadCloud = useCallback(async () => {
    setLoadingCloud(true);
    setError(null);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, { cache: "no-store" });
      const payload = await readJson<{ ok: true; cloud: CloudPayload }>(response);
      setCloud(normalizeCloud(payload.cloud));
      setHyped(Boolean(payload.cloud.hyped));
      setHypesCount(payload.cloud.hypesCount ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a cloud.");
    } finally {
      setLoadingCloud(false);
    }
  }, [cloudId]);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages?take=${MESSAGE_LIMIT}`, { cache: "no-store" });
      const payload = await readJson<{ ok: true; messages: CloudMessagePayload[] }>(response);
      setMessages(payload.messages.map((message) => normalizeMessage(message, user?.id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as mensagens.");
    } finally {
      setLoadingMessages(false);
    }
  }, [cloudId, user?.id]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const response = await fetch("/api/users/following", { cache: "no-store" });
      const payload = await readJson<{ ok: true; users: PublicUserProfile[] }>(response);
      setContacts(payload.users.filter((contact) => contact.id !== user?.id));
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [user?.id]);

  const joinCloud = useCallback((socket: Socket) => {
    socket.emit("cloud:join", { cloudId });
  }, [cloudId]);

  const isCloudAuthor = Boolean(user?.id && cloud?.authorId && user.id === cloud.authorId);
  const isPrivateCloud = (cloud?.visibility ?? visibility ?? "public") === "private";
  const typingNames = Object.entries(typingUserIds)
    .filter(([, isTyping]) => isTyping)
    .map(([typingUserId]) => {
      const member = cloud?.members?.find((entry) => entry.userId === typingUserId);
      if (member) {
        return member.user.displayName;
      }

      if (cloud?.authorId === typingUserId) {
        return cloud.author?.name || cloud.author?.username || "Pessoa";
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));
  const typingLabel = typingNames.length === 0
    ? ""
    : typingNames.length === 1
      ? `${typingNames[0]} digitando...`
      : `${typingNames.slice(0, 2).join(", ")}${typingNames.length > 2 ? ` e mais ${typingNames.length - 2}` : ""} digitando...`;

  const handleToggleHype = useCallback(async () => {
    if (!user || !cloud) {
      return;
    }

    if (isUpdatingHype) {
      return;
    }

    setIsUpdatingHype(true);
    setError(null);

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/hype`, {
        method: hyped ? "DELETE" : "POST",
        credentials: "include",
      });
      const payload = await readJson<{ ok: true; hypesCount: number }>(response);
      const nextHyped = !hyped;
      const nextCount = payload.hypesCount ?? Math.max(0, hypesCount + (nextHyped ? 1 : -1));
      setHyped(nextHyped);
      setHypesCount(nextCount);
      setCloud((current) => current ? { ...current, hyped: nextHyped, hypesCount: nextCount } : current);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Não foi possível atualizar o hype.");
    } finally {
      setIsUpdatingHype(false);
    }
  }, [cloud, cloudId, hypesCount, hyped, isUpdatingHype, user]);

  const handleCopyShareLink = useCallback(async () => {
    try {
      const shareUrl = `${window.location.origin}/cloud/${encodeURIComponent(cloudId)}`;
      await navigator.clipboard.writeText(shareUrl);
      setError(null);
    } catch {
      setError("Não foi possível copiar o link da cloud.");
    }
  }, [cloudId]);

  const handleDeleteCloud = useCallback(async () => {
    if (!cloud || !isCloudAuthor || isDeletingCloud) {
      return;
    }

    setIsDeletingCloud(true);
    setError(null);

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await readJson<{ ok: true }>(response);
      router.replace("/");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a cloud.");
    } finally {
      setIsDeletingCloud(false);
    }
  }, [cloud, cloudId, isCloudAuthor, isDeletingCloud, router]);

  const handleLeaveCloud = useCallback(async () => {
    if (!cloud || isCloudAuthor || isLeavingCloud) {
      return;
    }

    setIsLeavingCloud(true);
    setError(null);

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/leave`, {
        method: "POST",
        credentials: "include",
      });
      await readJson<{ ok: true }>(response);
      router.replace("/");
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Não foi possível sair da cloud.");
    } finally {
      setIsLeavingCloud(false);
    }
  }, [cloud, cloudId, isCloudAuthor, isLeavingCloud, router]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!cloud || !isCloudAuthor || isManagingMemberId) {
      return;
    }

    setIsManagingMemberId(memberId);
    setError(null);

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/members/${encodeURIComponent(memberId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      await readJson<{ ok: true }>(response);
      setCloud((current) =>
        current
          ? {
              ...current,
              members: current.members?.filter((member) => member.userId !== memberId) ?? [],
              membersCount: Math.max(0, current.membersCount - 1),
            }
          : current,
      );
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "Não foi possível remover o membro.");
    } finally {
      setIsManagingMemberId(null);
    }
  }, [cloud, cloudId, isCloudAuthor, isManagingMemberId]);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      return;
    }

    void loadCloud();
    void loadMessages();
    void loadContacts();
  }, [loadCloud, loadContacts, loadMessages, status, user]);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      return;
    }

    const socketUrl = resolveSocketUrl();
    if (!socketUrl) {
      setConnectionState("disconnected");
      return;
    }

    const socket = io(`${socketUrl}/clouds`, {
      withCredentials: true,
      transports: ["polling", "websocket"],
    });

    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("connect", () => {
      setConnectionState("connected");
    });

    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", () => setConnectionState("disconnected"));

    socket.on("cloud:message:new", (message: CloudMessagePayload) => {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(message, user.id)));
    });

    socket.on("cloud:reaction:changed", (payload: { cloudId: string; messageId: string; reaction: ReactionPayload; removed: boolean }) => {
      if (payload.cloudId !== cloudId) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== payload.messageId) {
            return message;
          }

          const reactions = payload.removed
            ? message.reactions.filter((reaction) => reaction.id !== payload.reaction.id)
            : [...message.reactions.filter((reaction) => reaction.id !== payload.reaction.id), payload.reaction];

          return { ...message, reactions };
        }),
      );
    });

    socket.on("cloud:typing", (payload: { cloudId: string; userId: string; isTyping: boolean }) => {
      if (payload.cloudId !== cloudId || payload.userId === user.id) {
        return;
      }

      setTypingUserIds((prev) => ({
        ...prev,
        [payload.userId]: payload.isTyping,
      }));

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = setTimeout(() => {
        setTypingUserIds((prev) => ({
          ...prev,
          [payload.userId]: false,
        }));
      }, 3500);
    });

    return () => {
      socket.emit("cloud:leave", { cloudId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [cloudId, joinCloud, status, user]);

  useEffect(() => {
    const socket = socketRef.current;
    if (status !== "authenticated" || !user || connectionState !== "connected" || !socket?.connected) {
      return;
    }

    const timer = setTimeout(() => {
      if (socket.connected) {
        socket.emit("cloud:join", { cloudId });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [cloudId, connectionState, status, user]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }

    const currentTyping = Boolean(draft.trim());
    socket.emit("cloud:typing", { cloudId, isTyping: currentTyping });

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      socket.emit("cloud:typing", { cloudId, isTyping: false });
    }, currentTyping ? 1500 : 0);
  }, [cloudId, draft]);

  const openImagePicker = useCallback(() => {
    if (!audioRecorder || audioRecorder.state !== "idle") {
      return;
    }

    imageInputRef.current?.click();
  }, [audioRecorder]);

  const sendReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      const payload = await readJson<{ ok: true; reaction: ReactionPayload; removed: boolean }>(response);
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const reactions = payload.removed
            ? message.reactions.filter((reaction) => reaction.id !== payload.reaction.id)
            : [...message.reactions.filter((reaction) => reaction.id !== payload.reaction.id), payload.reaction];

          return { ...message, reactions };
        }),
      );
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível reagir à mensagem.");
    }
  }, [cloudId]);

  const sendText = useCallback(async () => {
    if (!draft.trim() || !user) {
      return;
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessage = {
      id: clientMessageId,
      cloudId,
      senderId: user.id,
      senderName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      side: "right",
      kind: "text",
      content: draft.trim(),
      mediaUrl: null,
      replyTo: replyingTo ? { id: replyingTo.id, sender: replyingTo.senderName, content: replyingTo.content } : null,
      reactions: [],
      time: timeLabel(new Date().toISOString()),
      isoTime: new Date().toISOString(),
      pending: true,
      clientMessageId,
    };

    const nextDraft = draft;
    setDraft("");
    setReplyingTo(null);
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          content: nextDraft.trim(),
          clientMessageId,
          replyToMessageId: replyingTo?.id ?? null,
        }),
      });

      const payload = await readJson<{ ok: true; message: CloudMessagePayload }>(response);
      setMessages((prev) => mergeMessage(prev, normalizeMessage(payload.message, user.id)));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
      setMessages((prev) => prev.filter((message) => message.clientMessageId !== clientMessageId));
    }
  }, [cloudId, draft, user]);

  const handleAudioRecordingStop = useCallback(async (recording: RecordedAudio) => {
    if (!user) {
      return;
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(recording.blob);
    const optimistic: ChatMessage = {
      id: clientMessageId,
      cloudId,
      senderId: user.id,
      senderName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      side: "right",
      kind: "audio",
      content: "",
      mediaUrl: tempUrl,
      replyTo: null,
      reactions: [],
      time: timeLabel(new Date().toISOString()),
      isoTime: new Date().toISOString(),
      pending: true,
      clientMessageId,
      audioDurationMs: recording.durationMs,
    };

    setAudioUploading(true);
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      const formData = new FormData();
      formData.set("file", recording.blob, `audio-${Date.now()}.webm`);
      formData.set("clientMessageId", clientMessageId);

      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/audio`, {
        method: "POST",
        body: formData,
      });

      const payload = await readJson<{ ok: true; message: CloudMessagePayload }>(response);
      setMessages((prev) => mergeMessage(prev, normalizeMessage(payload.message, user.id)));
      URL.revokeObjectURL(tempUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar o áudio.");
      URL.revokeObjectURL(tempUrl);
      setMessages((prev) => prev.filter((message) => message.clientMessageId !== clientMessageId));
    } finally {
      setAudioUploading(false);
      setSelectedFilePreview(null);
    }
  }, [cloudId, user]);

  const handleImageFile = useCallback(async (file: File | null) => {
    if (!file || !user) {
      return;
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(file);
    const optimistic: ChatMessage = {
      id: clientMessageId,
      cloudId,
      senderId: user.id,
      senderName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      side: "right",
      kind: "image",
      content: "",
      mediaUrl: tempUrl,
      replyTo: null,
      reactions: [],
      time: timeLabel(new Date().toISOString()),
      isoTime: new Date().toISOString(),
      pending: true,
      clientMessageId,
    };

    setImageUploading(true);
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      const formData = new FormData();
      formData.set("file", file, file.name || `image-${Date.now()}.jpg`);
      formData.set("clientMessageId", clientMessageId);

      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/image`, {
        method: "POST",
        body: formData,
      });

      const payload = await readJson<{ ok: true; message: CloudMessagePayload }>(response);
      setMessages((prev) => mergeMessage(prev, normalizeMessage(payload.message, user.id)));
      URL.revokeObjectURL(tempUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a imagem.");
      URL.revokeObjectURL(tempUrl);
      setMessages((prev) => prev.filter((message) => message.clientMessageId !== clientMessageId));
    } finally {
      setImageUploading(false);
      setSelectedFilePreview(null);
    }
  }, [cloudId, user]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendText();
    }
  }, [sendText]);

  const handlePin = useCallback((msg: ChatMessage) => {
    setPinnedMessageId((prev) => prev === msg.id ? null : msg.id);
  }, []);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyingTo(msg);
  }, []);

  const handleForwardMsg = useCallback((msg: ChatMessage) => {
    setShareOpen(true);
  }, []);

  const isAudioBusy = audioUploading || imageUploading || audioRecorder.state !== "idle";
  const resolvedTitle = cloud?.title || title || "Cloud";
  const resolvedParticipants = cloud?.membersCount ?? participants ?? 0;
  const { formatted: liveTimer } = useCountdown(cloud);
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/cloud/${encodeURIComponent(cloudId)}` : `/cloud/${encodeURIComponent(cloudId)}`;
  const cloudVisibility = cloud?.visibility ?? (visibility === "private" ? "private" : "public");
  const isDarkCloud = cloudVisibility === "private";

  if (status === "loading" || loadingCloud) {
    return (
      <div className="flex h-screen items-center justify-center text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
        Carregando a cloud...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,5,40,0.40) 0%, rgba(8,3,20,0.85) 45%, #030208 100%)" }}>
        <Link
          href="/"
          aria-label="Voltar"
          className="flex h-9 w-9 shrink-0 items-center justify-center text-white/70 transition hover:text-white"
        >
          <ArrowLeftIcon s={18} />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
          <h1 className="truncate text-[28px] font-bold leading-tight text-white">
            {resolvedTitle}
          </h1>
          <div className="flex items-center gap-3 text-[16px] text-white/50">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-[#A855F7]" />
              {resolvedParticipants} {resolvedParticipants === 1 ? "pessoa" : "pessoas"} na conversa
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1 font-sans font-bold text-[#A855F7] text-[22px]" style={{ fontFamily: "Arial, sans-serif" }}>
              <HeaderClockIcon />
              {liveTimer}
            </span>
          </div>
          {typingLabel && (
            <p className="text-[13px] text-white/45">
              {typingLabel}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {!isDarkCloud && (
            <>
              <button
                type="button"
                aria-label="Hype"
                onClick={() => void handleToggleHype()}
                disabled={isUpdatingHype}
                className={`group flex h-10 w-10 items-center justify-center transition ${hyped ? "text-[#F97316]" : "text-white hover:text-[#F97316]"}`}
              >
                <HeaderFireIcon active={hyped} />
              </button>
              <button
                type="button"
                aria-label="Encaminhar"
                onClick={() => setShareOpen(true)}
                className="group flex h-10 w-10 items-center justify-center text-white/60 transition hover:text-white"
              >
                <HeaderForwardIcon />
              </button>
            </>
          )}

          {isCloudAuthor && (
            <>
              <button
                type="button"
                aria-label="Gerenciar membros"
                onClick={() => setManageMembersOpen(true)}
                className="group flex h-10 w-10 items-center justify-center text-white/60 transition hover:text-white"
              >
                <HeaderMembersIcon />
              </button>
              <button
                type="button"
                aria-label="Excluir cloud"
                onClick={() => setDeleteConfirmOpen(true)}
                className="group flex h-10 w-10 items-center justify-center text-white transition hover:text-white"
              >
                <AnimatedTrashIcon s={24} />
              </button>
            </>
          )}

          <div className="relative" data-cloud-action-root="true">
            <button
              type="button"
              aria-label="Mais opções"
              data-cloud-action-toggle="true"
              onClick={() => setActionMenuOpen((current) => !current)}
              className="group flex h-10 w-10 items-center justify-center text-white transition hover:text-white"
            >
              <HeaderDotsIcon />
            </button>

            {actionMenuOpen && (
              <div
                data-cloud-action-menu="true"
                className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#11141F] shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setInfoOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="flex h-6 w-6 items-center justify-center text-white/60">
                    <HeaderInfoIcon />
                  </span>
                  Informações da Cloud
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setDescriptionOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-white/60">D</span>
                  Ler descrição
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-white/80 transition hover:bg-white/5 hover:text-red-400"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-white/60">!</span>
                  Denunciar Cloud
                </button>
                {!isCloudAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionMenuOpen(false);
                      setLeaveConfirmOpen(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-white/80 transition hover:bg-white/5 hover:text-red-400"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-white/60">↩</span>
                    Sair da Cloud
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="border-b border-white/[0.07] bg-[#2A1018] px-5 py-2 text-[12px] text-[#FCA5A5]">{error}</div>}

      {pinnedMessageId && (() => {
        const pinned = messages.find((m) => m.id === pinnedMessageId);
        if (!pinned) return null;
        return (
          <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#1a0e3d]/60 px-5 py-2">
            <span className="text-[#A855F7]">📌</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-[#A855F7]">Mensagem fixada</p>
              <p className="truncate text-[13px] text-white/70">{pinned.content || "Mídia"}</p>
            </div>
            {isCloudAuthor && (
              <button type="button" onClick={() => setPinnedMessageId(null)} className="text-white/40 transition hover:text-white">×</button>
            )}
          </div>
        );
      })()}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loadingMessages && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-white/40">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-white/40">
            <div>
              <p className="text-[16px] font-semibold text-white/70">Nenhuma mensagem ainda</p>
              <p className="mt-1 text-[14px]">Seja o primeiro a escrever nessa cloud.</p>
            </div>
          </div>
        ) : (
          (() => {
            const rows: Array<ChatMessage | { id: string; type: "date"; label: string }> = [];
            let previous = "";
            for (const message of messages) {
              const current = new Date(message.isoTime).toDateString();
              if (current !== previous) {
                rows.push({ id: `date-${current}`, type: "date", label: dateLabel(message.isoTime) });
                previous = current;
              }
              rows.push(message);
            }

            return rows.map((entry) => {
              if ("type" in entry && entry.type === "date") {
                return (
                  <div key={entry.id} className="flex justify-center py-1">
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/40">{entry.label}</span>
                  </div>
                );
              }

              return <CloudMessageBubble key={entry.id} msg={entry as ChatMessage} onReact={sendReaction} onReply={handleReply} onPin={handlePin} onForward={handleForwardMsg} isCloudAuthor={isCloudAuthor} isPinned={pinnedMessageId === (entry as ChatMessage).id} />;
            });
          })()
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.07] bg-[#000000] px-5 py-4">
        <div className="relative flex flex-col gap-2 rounded-full border border-white/[0.08] bg-[#1a0e3d] px-5 py-3">
          {audioRecorder.state === "recording" || audioRecorder.state === "paused" ? (
            <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-black px-4 py-2.5">
              <div className="flex-1 text-[14px] text-white" style={{ fontFamily: "Arial, sans-serif" }}>
                {audioRecorder.state === "paused" ? "Pausado" : "Gravando…"} {formatDurationMs(audioRecorder.seconds * 1000) || "0:00"}
              </div>
              <Waveform active={audioRecorder.state === "recording"} paused={audioRecorder.state === "paused"} progress={audioRecorder.seconds} />
              <div className="flex items-center gap-2">
                <button type="button" aria-label={audioRecorder.state === "paused" ? "Retomar" : "Pausar"} onClick={audioRecorder.state === "paused" ? audioRecorder.resume : audioRecorder.pause} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/10">
                  {audioRecorder.state === "paused" ? <PlayIcon s={16} /> : <PauseIcon s={16} />}
                </button>
                <button type="button" aria-label="Enviar áudio" onClick={audioRecorder.stop} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9]">
                  <SendIcon />
                </button>
                <button type="button" aria-label="Cancelar gravação" onClick={audioRecorder.cancel} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/10">
                  <TrashIcon s={16} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {selectedFilePreview && (
                <div className="flex items-center justify-between gap-3 rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">Arquivo pronto para enviar</p>
                    <p className="truncate text-[14px] font-semibold text-white">{selectedFilePreview.name}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedFilePreview(null)} className="rounded-full border border-white/10 px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white">
                    Remover
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {replyingTo && (
                  <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[#A855F7]">Respondendo a {replyingTo.senderName}</p>
                      <p className="truncate text-[12px] text-white/60">{replyingTo.content || "Mídia"}</p>
                    </div>
                    <button type="button" onClick={() => setReplyingTo(null)} className="text-white/40 transition hover:text-white">×</button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Abrir emojis"
                    data-cloud-emoji-toggle="true"
                    onClick={() => setEmojiOpen((current) => !current)}
                    disabled={isAudioBusy}
                    className="text-white transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    😀
                  </button>
                  <button
                    type="button"
                    aria-label="Adicionar imagem"
                    onClick={openImagePicker}
                    disabled={isAudioBusy}
                    className="text-white transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlusIcon s={18} />
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem..."
                    disabled={isAudioBusy}
                    className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/50 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {draft.trim() ? (
                    <button type="button" aria-label="Enviar" onClick={() => void sendText()} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9333EA] text-white transition hover:bg-[#6D28D9]">
                      <SendIcon s={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Gravar áudio"
                      onClick={() => void audioRecorder.start().catch((recordError) => setError(recordError instanceof Error ? recordError.message : "Não foi possível iniciar a gravação."))}
                      disabled={isAudioBusy}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#1a0e3d] text-white/70 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MicIcon s={18} />
                    </button>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.currentTarget.value = "";
                      if (file) {
                        setSelectedFilePreview({ name: file.name || "Imagem" });
                        void handleImageFile(file);
                      }
                    }}
                  />
                </div>

                {emojiOpen && (
                  <div data-cloud-emoji-picker="true" className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-10 rounded-[22px] border border-white/10 bg-[#11141F] shadow-[0_18px_50px_rgba(0,0,0,0.35)] overflow-hidden">
                    <div className="flex gap-1 overflow-x-auto border-b border-white/[0.07] px-2 pt-2 pb-0 scrollbar-none">
                      {EMOJI_CATEGORIES.map((cat, index) => (
                        <button
                          key={cat.label}
                          type="button"
                          onClick={() => setEmojiCategory(index)}
                          title={cat.label}
                          className={`shrink-0 rounded-t-xl px-3 py-2 text-[18px] transition ${index === emojiCategory ? "bg-white/[0.08]" : "opacity-50 hover:opacity-100"}`}
                        >
                          {cat.icon}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-[28vh] overflow-y-auto p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {EMOJI_CATEGORIES[emojiCategory]?.emojis.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setDraft((current) => `${current}${emoji}`)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-[18px] transition hover:bg-white/[0.07]"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {audioUploading || imageUploading ? <p className="text-[11px] text-white/35">Enviando mídia...</p> : null}
            </>
          )}
        </div>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Enviar convite</h3>
              <button type="button" onClick={() => setShareOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
                {isPrivateCloud ? "Convite privado" : "Link da cloud"}
              </p>
              <p className="text-[13px] text-white/70">
                {isPrivateCloud
                  ? "Copie o link abaixo ou envie diretamente para um contato do mensageiro."
                  : "Copie o link abaixo ou envie diretamente para um contato do mensageiro."}
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                <input readOnly value={shareLink} className="min-w-0 flex-1 bg-transparent text-[13px] text-white/80 outline-none" />
                <button type="button" onClick={() => void handleCopyShareLink()} className="rounded-full bg-[#9333EA] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#6D28D9]">
                  Copiar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Contatos do mensageiro</p>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {loadingContacts && contacts.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-white/40">Carregando contatos...</p>
                ) : contacts.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-white/40">Nenhum contato disponível.</p>
                ) : (
                  contacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams({
                          id: contact.id,
                          share: "cloud",
                          url: shareLink,
                          title: cloud?.title || "Cloud",
                          autosend: "true",
                        });
                        setShareOpen(false);
                        window.location.assign(`/messages?${params.toString()}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
                    >
                      <UserAvatar user={{ id: contact.id, username: contact.username, displayName: contact.displayName, avatarUrl: contact.avatarUrl }} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-white">{contact.displayName}</p>
                        <p className="truncate text-[12px] text-white/45">@{contact.username}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {infoOpen && cloud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Informações da Cloud</h3>
              <button type="button" onClick={() => setInfoOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <div className="space-y-3 text-[14px] text-white/70">
              <p><span className="text-white/40">Título: </span>{cloud.title}</p>
              <p><span className="text-white/40">Duração: </span>{cloud.duration}</p>
              <p><span className="text-white/40">Participantes: </span>{resolvedParticipants}</p>
              <p><span className="text-white/40">Tempo restante: </span>{liveTimer}</p>
            </div>
          </div>
        </div>
      )}

      {descriptionOpen && cloud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Descrição da Cloud</h3>
              <button type="button" onClick={() => setDescriptionOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/75">
              {cloud.description?.trim() || "O criador não adicionou uma descrição para esta Cloud."}
            </p>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Denunciar Cloud</h3>
              <button type="button" onClick={() => setReportOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <p className="text-[14px] leading-relaxed text-white/70">
              Esta ação ainda não envia a denúncia para um fluxo separado. O botão foi mantido para preservar a interface definida no commit de referência.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setReportOpen(false)} className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-white/80 transition hover:bg-white/[0.12] hover:text-white">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {leaveConfirmOpen && !isCloudAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Sair da Cloud</h3>
              <button type="button" onClick={() => setLeaveConfirmOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <p className="text-[14px] leading-relaxed text-white/70">
              Tem certeza que deseja sair desta Cloud? Você não poderá mais participar das conversas até entrar novamente.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setLeaveConfirmOpen(false)} className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-white/80 transition hover:bg-white/[0.12] hover:text-white">
                Cancelar
              </button>
              <button type="button" onClick={() => void handleLeaveCloud()} disabled={isLeavingCloud} className="rounded-full bg-[#EF4444] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-50">
                {isLeavingCloud ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOpen && isCloudAuthor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Excluir Cloud</h3>
              <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <p className="text-[14px] leading-relaxed text-white/70">
              Esta ação é permanente. A cloud será encerrada e removida para todos os participantes.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-white/80 transition hover:bg-white/[0.12] hover:text-white">
                Cancelar
              </button>
              <button type="button" onClick={() => void handleDeleteCloud()} disabled={isDeletingCloud} className="rounded-full bg-[#EF4444] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-50">
                {isDeletingCloud ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageMembersOpen && isCloudAuthor && cloud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Gerenciar membros</h3>
              <button type="button" onClick={() => setManageMembersOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <div className="space-y-3">
              {(cloud.members ?? []).length === 0 ? (
                <p className="text-[14px] text-white/55">Nenhum membro adicional carregado para esta cloud.</p>
              ) : (
                (cloud.members ?? []).map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white">{member.user.displayName}</p>
                      <p className="truncate text-[12px] text-white/45">@{member.user.username}</p>
                    </div>
                    {member.userId !== user?.id && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(member.userId)}
                        disabled={isManagingMemberId === member.userId}
                        className="rounded-full bg-white/[0.06] px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isManagingMemberId === member.userId ? "Removendo..." : "Remover"}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
