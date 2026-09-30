"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { SessionUserAvatar, UserAvatar, getSessionUserDisplayName, useSessionUser } from "../components/session-user";
import { ArrowLeftIcon, BellIcon, CheckIcon, GearIcon, MicIcon, PauseIcon, PlayIcon, PlusIcon, SearchIcon, SendIcon, TrashIcon, XIcon } from "../components/ui-icons";
import { AudioWaveformPlayer } from "../components/AudioWaveformPlayer";
import { ForwardToContactModal, type ForwardContact } from "../components/ForwardToContactModal";
import { messagesConversationHref, requestedConversationId } from "../lib/navigation-memory";
import { buildMessageContactList } from "../lib/message-contacts";

type Status = "online" | "offline" | "busy";
type MessageKind = "text" | "audio" | "image" | "link";

type BackendConversation = {
  id: string;
  participantOneId: string;
  participantTwoId: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  blockedByPeer?: boolean;
  blockedByMe?: boolean;
  participant: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
  };
};

type BackendMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageKind;
  content: string | null;
  clientMessageId: string | null;
    createdAt: string;
    updatedAt: string;
  readAt: string | null;
  mediaAsset: {
    id: string;
    url: string;
    mimeType: string;
    sizeBytes: string;
    originalFileName: string | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  } | null;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type Conversation = {
  id: string;
  peerId: string;
  peerUsername: string;
  name: string;
  status: Status;
  avatarUrl: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  lastMessageAt: string | null;
  isPending?: boolean;
  blockedByPeer?: boolean;
  blockedByMe?: boolean;
};

type PublicUserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isPrivate: boolean;
};

type Msg = {
  id: string;
  conversationId: string;
  senderId: string;
  side: "left" | "right";
  sender: string;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
  kind: MessageKind;
  content: string;
  time: string;
    isoTime: string;
    updatedAt?: string;
  readAt: string | null;
  mediaUrl: string | null;
  mediaFileName?: string | null;
  durationMs: number | null;
  peaks?: number[] | null;
  linkUrl: string | null;
  linkLabel: string | null;
  pending?: boolean;
  clientMessageId?: string | null;
};

type SocketAck<T> = { ok: true; data: T } | { ok: false; message: string };

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

const statusDot: Record<Status, string> = {
  online: "bg-[#22C55E]",
  busy: "bg-[#F59E0B]",
  offline: "bg-[#6B7280]",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const normalizedQuery = normalizeText(query);
  const normalizedText = normalizeText(text);
  
  // Simple case-insensitive highlighting
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return text.replace(regex, '<mark class="bg-[#7C3AED]/40 text-white rounded px-0.5">$1</mark>');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function avatarColor(source: string) {
  const palette = ["#9333EA", "#3B82F6", "#22C55E", "#F97316", "#EC4899", "#06B6D4"];
  return palette[hashString(source) % palette.length];
}

function mapStatus(status: string): Status {
  if (status === "active") return "online";
  if (status === "pending") return "busy";
  return "offline";
}

function timeLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs <= 0) {
    return "";
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseLinkPreview(rawLabel: string | null | undefined, fallbackUrl?: string | null): string {
  if (!rawLabel) return fallbackUrl ? new URL(fallbackUrl).hostname.replace(/^www\./, "") : "Link compartilhado";
  try {
    const parsed = JSON.parse(rawLabel) as { type?: string; cloudTitle?: string; cloudVisibility?: string };
    if (parsed.type === "cloud_invitation") {
      const visibility = parsed.cloudVisibility === "private" ? "privada" : "pública";
      return parsed.cloudTitle ? `☁️ Convite: ${parsed.cloudTitle}` : `☁️ Convite para Cloud ${visibility}`;
    }
  } catch { /* not JSON */ }
  return rawLabel;
}

function previewForMessage(message: BackendMessage) {
  if (message.type === "audio") {
    const duration = formatDuration(message.mediaAsset?.durationMs ?? null);
    return duration ? `Áudio · ${duration}` : "Áudio";
  }

  if (message.type === "image") {
    return "Imagem";
  }

  if (message.type === "link") {
    try {
      const parsed = JSON.parse(message.content || "{}") as { url?: string; label?: string | null };
      return parseLinkPreview(parsed.label, parsed.url);
    } catch {
      if (message.content) {
        try {
          return new URL(message.content).hostname.replace(/^www\./, "");
        } catch { /* fall through */ }
      }
    }
    return "Link compartilhado";
  }

  return message.content || "";
}

function dateLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return "Hoje";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function buildConversation(payload: BackendConversation): Conversation {
  const name = payload.participant.displayName || payload.participant.username;
  return {
    id: payload.id,
    peerId: payload.participant.id,
    peerUsername: payload.participant.username,
    name,
    status: mapStatus(payload.participant.status),
    avatarUrl: payload.participant.avatarUrl,
    lastMessage: parseLinkPreview(payload.lastMessagePreview) || "",
    time: timeLabel(payload.lastMessageAt),
    unread: payload.unreadCount,
    blockedByPeer: payload.blockedByPeer ?? false,
    blockedByMe: payload.blockedByMe ?? false,
    lastMessageAt: payload.lastMessageAt,
  };
}

function buildMessage(
  payload: BackendMessage,
  currentUser: { id?: string | null; displayName?: string | null; avatarUrl?: string | null; username?: string | null } | null | undefined,
): Msg {
  let linkUrl: string | null = null;
  let linkLabel: string | null = null;
  const isSelf = Boolean(currentUser?.id && payload.senderId === currentUser.id);
  const senderDisplayName = isSelf ? currentUser?.displayName || currentUser?.username || "Você" : payload.sender.displayName || payload.sender.username;

  if (payload.type === "link") {
    try {
      const parsed = JSON.parse(payload.content || "{}") as { url?: string; label?: string | null };
      linkUrl = parsed.url ?? null;
      linkLabel = parsed.label?.trim() || null;
    } catch {
      linkUrl = payload.content || null;
    }
  }

  // Fallback: detect cloud_invitation JSON stored as text or with mismatched type
  const resolvedKind: MessageKind = (() => {
    if (payload.type === "link") return "link";
    if (payload.type === "audio") return "audio";
    if (payload.type === "image") return "image";
    // Check if content looks like a link message stored as text
    if (payload.type === "text" && payload.content) {
      try {
        const parsed = JSON.parse(payload.content) as { url?: string; label?: string | null };
        if (parsed.url) {
          linkUrl = parsed.url;
          linkLabel = parsed.label?.trim() || null;
          return "link";
        }
      } catch { /* not JSON */ }
    }
    return "text";
  })();

  return {
    id: payload.id,
    conversationId: payload.conversationId,
    senderId: payload.senderId,
    side: isSelf ? "right" : "left",
    sender: isSelf ? "Você" : senderDisplayName,
    senderDisplayName,
    senderAvatarUrl: isSelf ? currentUser?.avatarUrl ?? null : payload.sender.avatarUrl ?? null,
    kind: resolvedKind,
    content: payload.content || "",
    time: timeLabel(payload.createdAt),
      isoTime: payload.createdAt,
      updatedAt: payload.updatedAt,
    readAt: payload.readAt,
    mediaUrl: payload.mediaAsset?.url ?? null,
    mediaFileName: payload.mediaAsset?.originalFileName ?? null,
    durationMs: payload.mediaAsset?.durationMs ?? null,
    peaks: (payload.mediaAsset as { peaks?: number[] | null } | undefined)?.peaks ?? null,
    linkUrl,
    linkLabel,
    clientMessageId: payload.clientMessageId,
  };
}

function mergeMessage(list: Msg[], next: Msg) {
  const index = next.clientMessageId ? list.findIndex((item) => item.clientMessageId === next.clientMessageId) : -1;
  if (index >= 0) {
    const existing = list[index];
    return list.map((item, i) => (i === index ? { ...next, pending: false, peaks: next.peaks ?? existing.peaks ?? null } : item));
  }
  if (list.some((item) => item.id === next.id)) return list;
  return [...list, next];
}

type CloudCommentReference = { cloudTitle: string; comment: string; response?: string; isLegacyReference: boolean };

function parseCloudCommentReference(content: string | null): CloudCommentReference | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as { type?: string; cloudTitle?: string; comment?: string; response?: string };
    if ((parsed.type !== "cloud_comment_reference" && parsed.type !== "cloud_comment_reply") || !parsed.cloudTitle || !parsed.comment) return null;
    return { cloudTitle: parsed.cloudTitle, comment: parsed.comment, response: parsed.type === "cloud_comment_reply" ? parsed.response : undefined, isLegacyReference: parsed.type === "cloud_comment_reference" };
  } catch {
    return null;
  }
}

function sortConversations(list: Conversation[]) {
  return [...list].sort((a, b) => (new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()));
}

function resolveSocketUrl() {
  if (SOCKET_URL) return SOCKET_URL.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin.replace(/\/+$/, "");
  return "";
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) throw new Error("Falha ao carregar dados.");
  return payload;
}

type RecordedAudio = {
  blob: Blob;
  durationMs: number;
  mimeType: string;
  peaks?: number[];
};

type AudioRecorderState = "idle" | "recording" | "paused";

function downsampleWaveform(raw: number[], target: number): number[] {
  if (raw.length === 0) return [];
  const max = Math.max(...raw, 0.0001);
  const normalized = raw.map((v) => Math.max(0.05, v / max));
  if (normalized.length <= target) return normalized;
  const out: number[] = [];
  const chunk = normalized.length / target;
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * chunk);
    const end = Math.max(start + 1, Math.floor((i + 1) * chunk));
    let sum = 0;
    for (let j = start; j < end; j++) sum += normalized[j];
    out.push(sum / (end - start));
  }
  return out;
}

function useAudioRecorder(onStop: (recording: RecordedAudio) => void) {
  const [state, setState] = useState<AudioRecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const peaksRef = useRef<number[]>([]);

  const stopTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopSampler = useCallback(() => {
    if (sampleTimerRef.current) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
  }, []);

  const startSampler = useCallback(() => {
    stopSampler();
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    sampleTimerRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let max = 0;
      for (let i = 0; i < buf.length; i++) {
        const d = Math.abs(buf[i] - 128) / 128;
        if (d > max) max = d;
      }
      peaksRef.current.push(max);
    }, 80);
  }, [stopSampler]);

  const cleanupStream = useCallback(() => {
    stopSampler();
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* ignore */ }
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      try { void audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [stopSampler]);

  const start = useCallback(async () => {
    if (state !== "idle") {
      return;
    }

    try {
      if (!window.isSecureContext) {
        throw new Error("Para gravar áudio no celular, abra o Clouds pelo link HTTPS.");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Seu navegador não oferece suporte à gravação de áudio.");
      }
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

      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AC();
        void audioCtx.resume?.();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        sourceRef.current = source;
        analyserRef.current = analyser;
        peaksRef.current = [];
        startSampler();
      } catch {
        peaksRef.current = [];
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTimers();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const rawPeaks = peaksRef.current.length ? peaksRef.current : [0.3];
        onStop({
          blob,
          durationMs: secondsRef.current * 1000,
          mimeType: recorder.mimeType || "audio/webm",
          peaks: downsampleWaveform(rawPeaks, 40),
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
    } catch (error) {
      stopTimers();
      cleanupStream();
      setState("idle");
      setSeconds(0);
      secondsRef.current = 0;
      throw error instanceof Error ? error : new Error("Permissão de microfone negada.");
    }
  }, [cleanupStream, onStop, state, startSampler, stopTimers]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }, []);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    stopTimers();
    stopSampler();
    setState("paused");
  }, [stopTimers, stopSampler]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    startSampler();
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    setState("recording");
  }, [startSampler]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    stopTimers();
    chunksRef.current = [];

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Ignore stop races.
      }
    }

    cleanupStream();
    recorderRef.current = null;
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

function AudioMessageBubble({ msg }: { msg: Msg }) {
  const isRight = msg.side === "right";
  const isForwarded = /^(?:↗\s*)?(?:Encaminhada|Mensagem encaminhada)$/i.test(msg.content.trim());
  if (!msg.mediaUrl) {
    return (
      <div className={`rounded-2xl border px-4 py-3 text-[12px] text-white/60 ${isRight ? "rounded-br-[4px] border-[#9333EA]/30 bg-[#9333EA]" : "rounded-bl-[4px] border-white/[0.08] bg-[#1a0e3d]"}`}>
        Áudio indisponível
      </div>
    );
  }
  return (
    <div className={`flex flex-col ${isForwarded ? "gap-0" : "gap-1"}`}>
      {isForwarded && (
        <div className={`w-[272px] rounded-t-2xl px-3 py-2 text-[9px] font-medium uppercase tracking-[0.12em] ${isRight ? "bg-[#9333EA] text-white/60" : "border border-white/[0.08] bg-[#1c1530] text-white/40"}`}>
          ↗ Encaminhada
        </div>
      )}
      <AudioWaveformPlayer
        src={msg.mediaUrl}
        peaks={msg.peaks ?? undefined}
        durationMs={msg.durationMs}
        isOwn={isRight}
        roundedCorner={isRight ? "right" : "left"}
        flatTop={isForwarded}
      />
      {msg.pending && <div className={`text-[11px] ${isRight ? "text-right text-white/50" : "text-white/50"}`}>enviando...</div>}
    </div>
  );
}

function ImageMessageBubble({ msg }: { msg: Msg }) {
  const isRight = msg.side === "right";
  const isForwarded = /^(?:↗\s*)?(?:Encaminhada|Mensagem encaminhada)$/i.test(msg.content.trim());
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className={`overflow-hidden rounded-2xl border text-left transition ${isRight ? "rounded-br-[4px] border-[#9333EA]/30 bg-[#9333EA]" : "rounded-bl-[4px] border-white/[0.08] bg-[#1a0e3d]"}`}
      style={{ maxWidth: "320px" }}
    >
      {isForwarded && <div className="px-3 pb-2 pt-2 text-[9px] font-medium uppercase tracking-[0.12em] text-white/60">↗ Encaminhada</div>}
      {msg.mediaUrl ? (
        <img
          src={msg.mediaUrl}
          alt="Imagem enviada"
          className={`block w-full object-cover transition ${expanded ? "max-h-[420px]" : "max-h-[240px]"}`}
        />
      ) : (
        <div className="flex h-[180px] items-center justify-center text-[13px] text-white/50">
          Imagem indisponível
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-3 py-2 text-[11px] text-white/75">
        <span>Imagem</span>
        <span>{expanded ? "reduzir" : "ampliar"}</span>
      </div>
      {msg.pending && <div className="px-3 pb-3 text-[11px] text-white/70">enviando...</div>}
    </button>
  );
}

function LinkMessageBubble({ msg }: { msg: Msg }) {
  const isRight = msg.side === "right";
  const host = msg.linkUrl ? new URL(msg.linkUrl).hostname.replace(/^www\./, "") : "Link";
  let label = msg.linkLabel || host;
  let sharedProfile: { name?: string; avatarUrl?: string | null; external?: boolean } | null = null;
  let isExternal = false;
  
  // Check if this is a Cloud invitation (from our custom format)
  let cloudInviteData = null;
  let isPrivateCloudInvite = false;
  try {
    if (msg.linkLabel) {
      const parsed = JSON.parse(msg.linkLabel);
      if (parsed.type === "profile_share") {
        sharedProfile = parsed;
        label = parsed.name || "Perfil compartilhado";
        isExternal = Boolean(parsed.external);
      } else if (parsed.type === "forwarded_link") {
        label = parsed.label || "Link compartilhado";
        isExternal = Boolean(parsed.external);
      }
      if (parsed.type === "cloud_invitation") {
        cloudInviteData = parsed;
        isPrivateCloudInvite = parsed.cloudVisibility === "private";
      }
    }
  } catch {
    // Not JSON, handle as regular link
  }

  const isCloudInvite = cloudInviteData !== null;

  if (sharedProfile) {
    return (
      <a href={msg.linkUrl || "#"} className={`block overflow-hidden rounded-2xl border px-4 py-3 text-left transition hover:brightness-110 ${isRight ? "rounded-br-[4px] border-[#9333EA]/30 bg-[#9333EA]" : "rounded-bl-[4px] border-white/[0.08] bg-[#1a0e3d]"}`} style={{ maxWidth: "320px" }}>
        {isExternal && <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/65">↗ Conteúdo encaminhado</p>}
        <div className="flex items-center gap-3">
          {sharedProfile.avatarUrl ? <img src={sharedProfile.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-white/20" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-[16px] font-bold">{label.slice(0, 1).toUpperCase()}</span>}
          <div className="min-w-0"><p className="text-[11px] font-semibold text-white/65">Perfil compartilhado</p><p className="truncate text-[14px] font-bold text-white">{label}</p></div>
        </div>
        {msg.pending && <div className="mt-2 text-[11px] text-white/70">enviando...</div>}
      </a>
    );
  }

  if (isCloudInvite) {
    const inviteUrl = cloudInviteData.inviteToken
      ? `/invite/${cloudInviteData.inviteToken}`
      : msg.linkUrl || `/cloud/${cloudInviteData.cloudId}`;
    const isPrivate = cloudInviteData.cloudVisibility === "private";
    const senderFirstName = msg.side === "right" ? "Você" : (msg.senderDisplayName || msg.sender).split(" ")[0];
    const inviteText = msg.side === "right"
      ? `Você convidou para uma Cloud ${isPrivate ? "privada" : "pública"}`
      : `${senderFirstName} te convidou para participar de uma Cloud ${isPrivate ? "privada" : "pública"}`;

    return (
      <a
        href={inviteUrl}
        className="block text-left transition-opacity hover:opacity-90"
        style={{ maxWidth: "300px" }}
        onClick={(e) => {
          e.preventDefault();
          window.location.href = inviteUrl;
        }}
      >
        <div
          className="overflow-hidden rounded-3xl"
          style={{ background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 60%, #A855F7 100%)" }}
        >
          <div className="px-5 pt-5 pb-4">
            {/* Invite header */}
            <div className="flex items-center gap-2 mb-3">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 opacity-80">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <p className="text-[12px] font-semibold text-white/80 leading-snug">{inviteText}</p>
            </div>

            {/* Cloud title */}
            <p className="text-[22px] font-extrabold leading-tight text-white break-words">
              {cloudInviteData.cloudTitle}
            </p>

            {/* Meta row */}
            <div className="mt-2 flex items-center gap-2 text-[13px] font-medium text-white/65">
              {isPrivate ? (
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
              )}
              <span>{isPrivate ? "Privada" : "Pública"}</span>
              {cloudInviteData.cloudDuration && (
                <>
                  <span className="text-white/30">•</span>
                  <span>{cloudInviteData.cloudDuration}</span>
                </>
              )}
            </div>
          </div>

          {/* Button */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-center rounded-2xl bg-white/20 px-4 py-3 text-[15px] font-bold text-white backdrop-blur-sm">
              Entrar na Cloud
            </div>
          </div>
        </div>
        {msg.pending && <p className="mt-1 text-right text-[11px] text-white/40">enviando...</p>}
      </a>
    );
  }

  return (
    <a
      href={msg.linkUrl || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`block overflow-hidden rounded-2xl border px-4 py-3 text-left transition hover:brightness-110 ${isRight ? "rounded-br-[4px] border-[#9333EA]/30 bg-[#9333EA]" : "rounded-bl-[4px] border-white/[0.08] bg-[#1a0e3d]"}`}
      style={{ maxWidth: "320px" }}
      onClick={(event) => {
        if (!msg.linkUrl) {
          event.preventDefault();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
          ↗
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-white">{label}</p>
          <p className="mt-1 truncate text-[12px] text-white/65">{msg.linkUrl || "Link compartilhado"}</p>
        </div>
      </div>
      {isExternal && <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/65">↗ Conteúdo encaminhado</p>}
      {msg.pending && <div className="mt-2 text-[11px] text-white/70">enviando...</div>}
    </a>
  );
}

function MessageReceipt({ msg }: { msg: Msg }) {
  const isRead = Boolean(msg.readAt);
  const isDelivered = !msg.pending;
  const iconClass = isRead ? "text-[#7C3AED]" : "text-white";

  if (!isDelivered) {
    return (
      <span className={`inline-flex items-center ${iconClass}`}>
        <CheckIcon s={12} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${iconClass}`}>
      <CheckIcon s={12} />
      <CheckIcon s={12} className="-ml-1" />
    </span>
  );
}

function DmReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function DmDotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="typing-ellipsis inline-flex items-end gap-[3px] px-0.5" aria-label="Digitando">
      <span className="h-[5px] w-[5px] rounded-full bg-[#A855F7]" />
      <span className="h-[5px] w-[5px] rounded-full bg-[#A855F7]" />
      <span className="h-[5px] w-[5px] rounded-full bg-[#A855F7]" />
    </span>
  );
}

function DmMenuCopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DmMenuTranslateIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="M22 22l-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

function DmMenuEditIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
    </svg>
  );
}

function DmMenuCancelIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </svg>
  );
}

function DmMenuForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

function DmMsgMenu({
  msg,
  isRight,
  textContent,
  openUpward,
  onEdit,
  onDelete,
  onForward,
  onClose,
}: {
  msg: Msg;
  isRight: boolean;
  textContent: string | null;
  openUpward: boolean;
  onEdit?: (m: Msg) => void;
  onDelete?: (m: Msg) => void;
  onForward?: (m: Msg) => void;
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

  const handleCopy = () => {
    const text = textContent ?? msg.linkUrl ?? "";
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
    } catch {
      // silently ignore
    } finally {
      setTranslating(false);
    }
  };

  // Check if this is a private cloud invitation
  let isPrivateCloudInvite = false;
  try {
    if (msg.linkLabel) {
      const parsed = JSON.parse(msg.linkLabel);
      if (parsed.type === "cloud_invitation" && parsed.cloudVisibility === "private") {
        isPrivateCloudInvite = true;
      }
    }
  } catch {
    // Not JSON
  }

  const copyable = !!textContent || !!msg.linkUrl;
  const isOwn = isRight;

  const items: { label: string; icon: React.ReactNode; action: () => void; danger?: boolean; show: boolean }[] = [
    {
      label: copied ? "Copiado!" : "Copiar",
      icon: <DmMenuCopyIcon />,
      action: handleCopy,
      show: copyable,
    },
    {
      label: translating ? "Traduzindo…" : translated ? "Traduzido ✓" : "Traduzir",
      icon: <DmMenuTranslateIcon />,
      action: handleTranslate,
      show: !!textContent,
    },
    {
      label: "Editar",
      icon: <DmMenuEditIcon />,
      action: () => { onEdit?.(msg); onClose(); },
      show: isOwn && msg.kind === "text",
    },
    {
      label: "Cancelar envio",
      icon: <DmMenuCancelIcon />,
      action: () => { onDelete?.(msg); onClose(); },
      danger: true,
      show: isOwn,
    },
    {
      label: "Encaminhar",
      icon: <DmMenuForwardIcon />,
      action: () => { onForward?.(msg); onClose(); },
      show: !isPrivateCloudInvite, // Hide forward for private cloud invitations
    },
  ];

  return (
    <div
      ref={menuRef}
      className={`absolute z-50 min-w-[168px] rounded-2xl border border-white/[0.08] bg-[#15161C] py-1 shadow-2xl shadow-black/60 ${isRight ? "right-0" : "left-0"}`}
      style={openUpward ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }}
    >
      {translated && (
        <div className="border-b border-white/[0.06] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">Tradução</p>
          <p className="text-[13px] text-white leading-snug">{translated}</p>
        </div>
      )}
      {items.filter((i) => i.show).map((item) => (
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

function MessageBubble({ msg, onReply, onEdit, onDelete, onForward, searchQuery, showFooter = true, showAvatar = true }: { msg: Msg; onReply?: (m: Msg) => void; onEdit?: (m: Msg) => void; onDelete?: (m: Msg) => void; onForward?: (m: Msg) => void; searchQuery?: string; showFooter?: boolean; showAvatar?: boolean }) {
  const isRight = msg.side === "right";
  const [menuOpen, setMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const textContent = msg.kind === "text" ? msg.content : null;
  const forwardedMarkerMatch = textContent?.match(/^(?:↗\s*(?:Mensagem encaminhada|Encaminhada)\s*)+/);
  const isForwardedMessage = Boolean(forwardedMarkerMatch);
  const visibleTextContent = forwardedMarkerMatch ? textContent?.slice(forwardedMarkerMatch[0].length) ?? "" : textContent;
  const highlightedContent = searchQuery && visibleTextContent ? highlightText(visibleTextContent, searchQuery) : visibleTextContent;
  const cloudCommentReference = parseCloudCommentReference(textContent);

  function handleToggleMenu() {
    if (!menuOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Open upward if less than 220px below the button
      setOpenUpward(window.innerHeight - rect.bottom < 220);
    }
    setMenuOpen((o) => !o);
  }

  return (
    <div className="group flex w-full items-end gap-2.5" style={{ justifyContent: isRight ? "flex-end" : "flex-start" }}>
      {/* Avatar — alinha ao fundo do bubble usando mb igual à altura da action row */}
      {!isRight && <div className="w-9 shrink-0 mb-7">
        {showAvatar && <UserAvatar
          user={{ id: msg.senderId, username: msg.senderId, displayName: msg.senderDisplayName, avatarUrl: msg.senderAvatarUrl }}
          size={34}
        />}
      </div>}
      <div className={`relative flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`} style={{ maxWidth: "72%" }}>
        {msg.kind === "audio" ? (
          <AudioMessageBubble msg={msg} />
        ) : msg.kind === "image" ? (
          <ImageMessageBubble msg={msg} />
        ) : msg.kind === "link" ? (
          <LinkMessageBubble msg={msg} />
        ) : cloudCommentReference ? (
          <div className={`w-full min-w-[220px] overflow-hidden rounded-3xl text-white ${isRight ? "bg-[#9333EA]" : "bg-[#5B21B6]"}`}>
            <div className="p-5">
            <p className="text-[22px] font-bold leading-tight text-white">{cloudCommentReference.cloudTitle}</p>
            <p className="mt-3 border-t border-white/20 pt-3 text-[14px] leading-relaxed text-white/80">{cloudCommentReference.comment}</p>
            </div>
            {cloudCommentReference.response && <div className="border-t border-white/20 bg-black/10 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Resposta</p><p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white">{cloudCommentReference.response}</p></div>}
          </div>
        ) : (
          <div className={`relative rounded-2xl px-4 ${isForwardedMessage ? "min-w-[112px] pb-3 pt-6" : "py-3"} text-[15px] leading-relaxed text-white ${isRight ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
            {isForwardedMessage && <span className="pointer-events-none absolute left-3 top-1.5 text-[9px] font-medium uppercase tracking-[0.12em] text-white/40">↗ Encaminhada</span>}
            <span dangerouslySetInnerHTML={{ __html: highlightedContent || visibleTextContent || "" }} />
            {msg.pending && <span className="ml-2 text-[11px] text-white/50">enviando...</span>}
          </div>
        )}
        {/* Action row: reply + three-dot menu */}
        <div className={`${showFooter ? "flex px-1" : "absolute -bottom-1"} items-center gap-1 ${isRight ? "right-0 flex-row-reverse" : "left-0"}`}>
          {showFooter && <>
            <span className="text-[11px] text-white">{msg.time}</span>
            {msg.updatedAt && msg.updatedAt !== msg.isoTime && <span className="text-[10px] italic text-white/45">editada</span>}
            {isRight && <MessageReceipt msg={msg} />}
          </>}
          {/* Actions — visible on hover */}
          <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isRight ? "mr-1.5" : "ml-1.5"}`}>
            <button
              type="button"
              onClick={() => onReply?.(msg)}
              title="Responder"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/10 hover:text-white/70"
            >
              <DmReplyIcon />
            </button>
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                onClick={handleToggleMenu}
                title="Mais opções"
                className="flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/10 hover:text-white/70"
              >
                <DmDotsIcon />
              </button>
              {menuOpen && (
                <DmMsgMenu
                  msg={msg}
                  isRight={isRight}
                  textContent={textContent}
                  openUpward={openUpward}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onForward={onForward}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagesPageContent() {
  const { user, status } = useSessionUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const typingConversationIdRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceByUserIdRef = useRef<Record<string, Status>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const openedPeerRef = useRef<string | null>(null);
  const sidebarSearchRef = useRef<HTMLInputElement | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Msg[]>>({});
  const [typingByConversation, setTypingByConversation] = useState<Record<string, boolean>>({});
  const [isLocallyTyping, setIsLocallyTyping] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [linkUploading, setLinkUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<"emoji" | "sticker">("emoji");
  const [savedStickers, setSavedStickers] = useState<Array<{ id: string; mediaUrl: string }>>([]);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [sharedLink, setSharedLink] = useState<{ url: string; label: string } | null>(null);
  const autoSendRef = useRef(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Msg | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [conversationSearch, setConversationSearch] = useState(() => searchParams.get("q")?.trim() || "");
  const [messageMatchConversationIds, setMessageMatchConversationIds] = useState<Set<string>>(new Set());
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [followedUsers, setFollowedUsers] = useState<PublicUserProfile[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const handleAudioRecordingStop = useCallback(async (recording: RecordedAudio) => {
    if (!activeConversationIdRef.current || !user?.id) {
      return;
    }

    const conversationId = activeConversationIdRef.current;
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(recording.blob);
    const optimistic: Msg = {
      id: clientMessageId,
      conversationId,
      side: "right",
      senderId: user.id,
      sender: "Você",
      senderDisplayName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      kind: "audio",
      content: "",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isoTime: new Date().toISOString(),
      readAt: null,
      mediaUrl: tempUrl,
      durationMs: recording.durationMs,
      peaks: recording.peaks ?? null,
      linkUrl: null,
      linkLabel: null,
      pending: true,
      clientMessageId,
    };

    setAudioUploading(true);
    setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], optimistic) }));
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastMessage: "Áudio", time: optimistic.time, lastMessageAt: optimistic.isoTime, unread: 0 }
            : conversation,
        ),
      ),
    );

    try {
      const formData = new FormData();
      formData.set("file", recording.blob, `audio-${Date.now()}.webm`);
      formData.set("clientMessageId", clientMessageId);
      formData.set("durationMs", String(recording.durationMs));
      if (recording.peaks && recording.peaks.length) {
        formData.set("peaks", JSON.stringify(recording.peaks));
      }

      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/audio`, {
        method: "POST",
        body: formData,
      });

      const payload = await readJson<{ ok: true; message: BackendMessage }>(response);
      const confirmed = buildMessage(payload.message, user);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], confirmed) }));
      URL.revokeObjectURL(tempUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar o áudio.");
      URL.revokeObjectURL(tempUrl);
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((message) => message.clientMessageId !== clientMessageId),
      }));
    } finally {
      setAudioUploading(false);
    }
  }, [user?.id]);
  const audioRecorder = useAudioRecorder((recording) => {
    void handleAudioRecordingStop(recording);
  });

  useEffect(() => {
    const shareType = searchParams.get("share")?.trim().toLowerCase() || "";
    const rawUrl = searchParams.get("url")?.trim() || "";
    const rawId = searchParams.get("id")?.trim() || "";
    const rawLabel = searchParams.get("title")?.trim() || searchParams.get("name")?.trim() || "";
    const autosend = searchParams.get("autosend")?.trim().toLowerCase() === "true";

    if (!shareType) {
      return;
    }

    if (shareType === "cloud" && rawId) {
      const url = rawUrl || (typeof window !== "undefined" ? `${window.location.origin}/cloud/${rawId}` : `/cloud/${rawId}`);
      // rawLabel may be a JSON cloud_invitation object (from CloudShareModal)
      let label = rawLabel || "Cloud compartilhada";
      try {
        const parsed = JSON.parse(rawLabel);
        if (parsed.type === "cloud_invitation") {
          label = rawLabel; // keep as JSON so LinkMessageBubble can parse it
        }
      } catch {
        // plain string — keep as-is
      }
      setSharedLink({ url, label });
      
      if (autosend) {
        autoSendRef.current = true;
      }
      return;
    }

    if (shareType === "profile" && rawId) {
      const url = rawUrl || (typeof window !== "undefined" ? `${window.location.origin}/users/${rawId}` : `/users/${rawId}`);
      setSharedLink({ url, label: rawLabel || "Perfil compartilhado" });
      
      if (autosend) {
        autoSendRef.current = true;
      }
    }
  }, [searchParams]);

  useEffect(() => {
    setConversationSearch(searchParams.get("q")?.trim() || "");
  }, [searchParams]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!emojiOpen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const picker = document.querySelector('[data-emoji-picker="true"]');
      const button = document.querySelector('[data-emoji-toggle="true"]');
      if (picker?.contains(target) || button?.contains(target)) {
        return;
      }

      setEmojiOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEmojiOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [emojiOpen]);

  useEffect(() => {
    void fetch("/api/stickers", { cache: "no-store" }).then((response) => response.json()).then((payload: { stickers?: Array<{ id: string; mediaUrl: string }> }) => setSavedStickers(payload.stickers ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && messageSearchOpen) {
        setMessageSearch("");
        setMessageSearchOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [messageSearchOpen]);

  const handleImageFile = useCallback(async (file: File | null) => {
    if (!file || !activeConversationIdRef.current || !user?.id) {
      return;
    }

    const conversationId = activeConversationIdRef.current;
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(file);
    const optimistic: Msg = {
      id: clientMessageId,
      conversationId,
      side: "right",
      senderId: user.id,
      sender: "Você",
      senderDisplayName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      kind: "image",
      content: "",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isoTime: new Date().toISOString(),
      readAt: null,
      mediaUrl: tempUrl,
      durationMs: null,
      linkUrl: null,
      linkLabel: null,
      pending: true,
      clientMessageId,
    };

    setImageUploading(true);
    setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], optimistic) }));
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastMessage: "Imagem", time: optimistic.time, lastMessageAt: optimistic.isoTime, unread: 0 }
            : conversation,
        ),
      ),
    );

    try {
      const formData = new FormData();
      formData.set("file", file, file.name || `image-${Date.now()}.jpg`);
      formData.set("clientMessageId", clientMessageId);

      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/image`, {
        method: "POST",
        body: formData,
      });

      const payload = await readJson<{ ok: true; message: BackendMessage }>(response);
      const confirmed = buildMessage(payload.message, user);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], confirmed) }));
      URL.revokeObjectURL(tempUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a imagem.");
      URL.revokeObjectURL(tempUrl);
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((message) => message.clientMessageId !== clientMessageId),
      }));
    } finally {
      setImageUploading(false);
    }
  }, [user?.id]);

  const triggerImagePicker = useCallback(() => {
    if (activeConversationId && !imageUploading && audioRecorder.state === "idle") {
      imageInputRef.current?.click();
    }
  }, [activeConversationId, audioRecorder.state, imageUploading]);

  const sendSharedLink = useCallback(async () => {
    if (!sharedLink || !activeConversationIdRef.current || !user?.id) {
      return;
    }

    const conversationId = activeConversationIdRef.current;
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Msg = {
      id: clientMessageId,
      conversationId,
      side: "right",
      senderId: user.id,
      sender: "Você",
      senderDisplayName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      kind: "link",
      content: sharedLink.url,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isoTime: new Date().toISOString(),
      readAt: null,
      mediaUrl: null,
      durationMs: null,
      linkUrl: sharedLink.url,
      linkLabel: sharedLink.label,
      pending: true,
      clientMessageId,
    };

    setLinkUploading(true);
    setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], optimistic) }));
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastMessage: parseLinkPreview(sharedLink.label), time: optimistic.time, lastMessageAt: optimistic.isoTime, unread: 0 }
            : conversation,
        ),
      ),
    );

    try {
      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: sharedLink.url,
          label: sharedLink.label,
          clientMessageId,
        }),
      });

      const payload = await readJson<{ ok: true; message: BackendMessage }>(response);
      const confirmed = buildMessage(payload.message, user);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], confirmed) }));
      setSharedLink(null);
      autoSendRef.current = false;
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível compartilhar o link.");
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((message) => message.clientMessageId !== clientMessageId),
      }));
    } finally {
      setLinkUploading(false);
    }
  }, [sharedLink, user?.id]);

  const insertEmoji = useCallback((emoji: string) => {
    setDraft((current) => `${current}${emoji}`);
  }, []);

  useEffect(() => {
    const query = normalizeText(conversationSearch);
    if (!query) { setMessageMatchConversationIds(new Set()); setSearchingMessages(false); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchingMessages(true);
      void Promise.all(conversations.map(async (conversation) => {
        const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversation.id)}/messages?take=100`, { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { messages?: BackendMessage[] } | null;
        return Array.isArray(payload?.messages) && payload.messages.some((message) => message.type === "text" && normalizeText(message.content ?? "").includes(query)) ? conversation.id : null;
      })).then((ids) => {
        if (!cancelled) setMessageMatchConversationIds(new Set(ids.filter((id): id is string => Boolean(id))));
      }).catch(() => { if (!cancelled) setMessageMatchConversationIds(new Set()); }).finally(() => { if (!cancelled) setSearchingMessages(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [conversationSearch, conversations]);

  const filteredConversations = useMemo(() => {
    if (conversationSearch.trim()) return conversations.filter((conversation) => messageMatchConversationIds.has(conversation.id));
    return buildMessageContactList(conversations, followedUsers, conversationSearch);
  }, [conversationSearch, conversations, followedUsers, messageMatchConversationIds]);

  const forwardContacts = useMemo<ForwardContact[]>(() => {
    const byId = new Map<string, ForwardContact>();
    conversations.forEach((conversation) => byId.set(conversation.peerId, { id: conversation.peerId, username: conversation.peerUsername, displayName: conversation.name, avatarUrl: conversation.avatarUrl }));
    followedUsers.forEach((contact) => byId.set(contact.id, { id: contact.id, username: contact.username, displayName: contact.displayName, avatarUrl: contact.avatarUrl }));
    return [...byId.values()];
  }, [conversations, followedUsers]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || null;
  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] || [] : [];
  
  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) return activeMessages;
    
    const searchQuery = normalizeText(messageSearch);
    return activeMessages.filter((msg) => {
      if (msg.kind !== "text") return false;
      return normalizeText(msg.content).includes(searchQuery);
    });
  }, [activeMessages, messageSearch]);
  
  const isActiveConversationTyping = Boolean(activeConversationId && typingByConversation[activeConversationId]);
  const isTypingLocally = Boolean(activeConversationId && isLocallyTyping);
  const typingPerson = isActiveConversationTyping
    ? activeConversation
      ? { id: activeConversation.peerId, username: activeConversation.peerUsername, name: activeConversation.name, avatarUrl: activeConversation.avatarUrl, label: `${activeConversation.name} está digitando` }
      : null
    : null;
  const isAudioBusy = audioUploading || imageUploading || linkUploading || audioRecorder.state !== "idle";
  const isConversationBlocked = Boolean(activeConversation?.blockedByPeer || activeConversation?.blockedByMe);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setError(null);
    try {
      const response = await fetch("/api/direct-messages/conversations", { cache: "no-store" });
      const payload = await readJson<{ ok: true; conversations: BackendConversation[] }>(response);
      const mapped = payload.conversations.map((conversation) => {
        const built = buildConversation(conversation);
        return {
          ...built,
          status: presenceByUserIdRef.current[built.peerId] ?? built.status,
        };
      });
      const sortedConversations = sortConversations(mapped);
      conversationsRef.current = sortedConversations;
      setConversations(sortedConversations);
      const currentActiveId = activeConversationIdRef.current;
      const activeConversationStillExists = currentActiveId ? sortedConversations.some((conversation) => conversation.id === currentActiveId) : false;
      if (currentActiveId && !activeConversationStillExists) {
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar as conversas.");
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadFollowedUsers = useCallback(async () => {
    setLoadingFollowed(true);
    setError(null);
    try {
      const response = await fetch("/api/users/following", { cache: "no-store" });
      const payload = await readJson<{ ok: true; users: PublicUserProfile[] }>(response);
      // Exclude current user
      setFollowedUsers(payload.users.filter(u => u.id !== user?.id));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar os contatos seguidos.");
      setFollowedUsers([]);
    } finally {
      setLoadingFollowed(false);
    }
  }, [user?.id]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages?take=${MESSAGE_LIMIT}`, { cache: "no-store" });
      if (response.status === 404) {
        // A 404 pode acontecer momentaneamente enquanto o backend reinicia. Não remova
        // a conversa da lista local, ou o usuário perde acesso às demais conversas.
        setError("Não foi possível carregar as mensagens agora. Tente novamente em instantes.");
        return;
      }
      const payload = await readJson<{ ok: true; messages: BackendMessage[] }>(response);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: payload.messages.map((message) => buildMessage(message, user)) }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar as mensagens.");
    } finally {
      setLoadingMessages(false);
    }
  }, [user?.id]);

  const ensureConversation = useCallback(async (peerUserId: string) => {
    if (!peerUserId || openedPeerRef.current === peerUserId) return;
    openedPeerRef.current = peerUserId;
    try {
      const response = await fetch("/api/direct-messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId }),
      });
      const payload = await readJson<{ ok: true; conversation: BackendConversation }>(response);
      const built = buildConversation(payload.conversation);
      const conversation = {
        ...built,
        status: presenceByUserIdRef.current[built.peerId] ?? built.status,
      };
      setConversations((prev) => sortConversations(prev.some((item) => item.id === conversation.id) ? prev.map((item) => (item.id === conversation.id ? conversation : item)) : [conversation, ...prev]));
      activeConversationIdRef.current = conversation.id;
      setActiveConversationId(conversation.id);
      if (!searchParams.get("share")) {
        router.replace(messagesConversationHref(conversation.id), { scroll: false });
      }
    } catch (conversationError) {
      setError(conversationError instanceof Error ? conversationError.message : "Não foi possível abrir a conversa.");
    }
  }, [router, searchParams, user?.id]);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    void loadConversations();
  }, [loadConversations, status, user]);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    void loadFollowedUsers();
  }, [loadFollowedUsers, status, user]);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    const peerUserId = searchParams.get("id")?.trim();
    if (peerUserId) void ensureConversation(peerUserId);
  }, [ensureConversation, searchParams, status, user]);

  useEffect(() => {
    const rememberedConversationId = requestedConversationId(searchParams);
    if (!rememberedConversationId) {
      // A rota /messages representa sempre a lista. Isso também cobre o toque no
      // item Mensagens da navegação móvel depois de sair de uma conversa.
      if (!searchParams.get("id")?.trim()) {
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
      }
      return;
    }
    if (!conversations.some((conversation) => conversation.id === rememberedConversationId)) return;
    if (activeConversationIdRef.current === rememberedConversationId) return;
    activeConversationIdRef.current = rememberedConversationId;
    setActiveConversationId(rememberedConversationId);
  }, [conversations, searchParams]);

  const returnToConversationList = useCallback(() => {
    activeConversationIdRef.current = null;
    setActiveConversationId(null);
    router.replace("/messages", { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!activeConversationId || !autoSendRef.current || !sharedLink) return;
    
    // Small delay to ensure conversation is fully loaded
    const timer = setTimeout(() => {
      void sendSharedLink();
      autoSendRef.current = false;
    }, 500);
    
    return () => clearTimeout(timer);
  }, [activeConversationId, sharedLink, sendSharedLink]);

  useEffect(() => {
    if (!activeConversationId) return;
    activeConversationIdRef.current = activeConversationId;
    void loadMessages(activeConversationId);
    setConversations((previous) => previous.map((conversation) =>
      conversation.id === activeConversationId ? { ...conversation, unread: 0 } : conversation,
    ));
    void fetch(`/api/direct-messages/conversations/${encodeURIComponent(activeConversationId)}/read`, {
      method: "POST",
      credentials: "include",
    });

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("conversation:join", { conversationId: activeConversationId });
      socket.emit("conversation:read", { conversationId: activeConversationId });
    }
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    const socketUrl = resolveSocketUrl();
    if (!socketUrl) {
      setConnectionState("disconnected");
      return;
    }

    const socket = io(`${socketUrl}/direct-messages`, {
      withCredentials: true,
      transports: ["polling", "websocket"],
    });

    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("connect", () => {
      setConnectionState("connected");
      const conversationId = activeConversationIdRef.current;
      if (conversationId) {
        socket.emit("conversation:join", { conversationId });
        socket.emit("conversation:read", { conversationId });
      }
    });

    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", () => setConnectionState("disconnected"));

    socket.on("presence:update", (payload: { userId: string; status: "online" | "offline" }) => {
      presenceByUserIdRef.current = {
        ...presenceByUserIdRef.current,
        [payload.userId]: payload.status === "online" ? "online" : "offline",
      };

      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation.peerId === payload.userId
              ? { ...conversation, status: payload.status === "online" ? "online" : "offline" }
              : conversation,
          ),
        ),
      );
    });

    socket.on("conversation:typing", (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.userId === user.id) {
        return;
      }

      setTypingByConversation((prev) => ({
        ...prev,
        [payload.conversationId]: payload.isTyping,
      }));
    });

    socket.on("message:new", (message: BackendMessage) => {
      const mapped = buildMessage(message, user);
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: mergeMessage(prev[message.conversationId] || [], mapped),
      }));

      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation.id === message.conversationId
              ? {
                  ...conversation,
                  lastMessage: previewForMessage(message) || conversation.lastMessage,
                  time: timeLabel(message.createdAt),
                  lastMessageAt: message.createdAt,
                  unread: message.senderId === user.id ? conversation.unread : conversation.unread + 1,
                }
              : conversation,
          ),
        ),
      );

      if (message.conversationId === activeConversationIdRef.current && message.senderId !== user.id) {
        socket.emit("conversation:read", { conversationId: message.conversationId });
      }
    });

    socket.on("message:edited", (message: BackendMessage) => {
      const mapped = buildMessage(message, user);
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: (prev[message.conversationId] || []).map((m) =>
          m.id === mapped.id ? mapped : m
        ),
      }));
    });

    socket.on("message:deleted", (payload: { messageId: string }) => {
      setMessagesByConversation((prev) => {
        const updated: Record<string, Msg[]> = {};
        for (const [convId, msgs] of Object.entries(prev)) {
          updated[convId] = msgs.filter((m) => m.id !== payload.messageId);
        }
        return updated;
      });
    });

    socket.on("conversation:updated", (conversation: BackendConversation) => {
      const built = buildConversation(conversation);
      const mapped = {
        ...built,
        status: presenceByUserIdRef.current[built.peerId] ?? built.status,
      };
      setConversations((prev) =>
        sortConversations(prev.some((item) => item.id === mapped.id) ? prev.map((item) => (item.id === mapped.id ? mapped : item)) : [mapped, ...prev]),
      );
    });

    socket.on("conversation:read", (payload: { conversationId: string; readerId: string; readAt: string }) => {
      if (payload.readerId === user.id) {
        return;
      }

      setMessagesByConversation((prev) => ({
        ...prev,
        [payload.conversationId]: (prev[payload.conversationId] || []).map((message) =>
          message.side === "right" && message.isoTime <= payload.readAt
            ? { ...message, readAt: payload.readAt, pending: false }
            : message,
        ),
      }));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [status, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, activeConversationId, isActiveConversationTyping, isTypingLocally]);

  useEffect(() => {
    if (localTypingPreviewTimerRef.current) clearTimeout(localTypingPreviewTimerRef.current);
    if (!draft.trim()) {
      setIsLocallyTyping(false);
      return;
    }
    setIsLocallyTyping(true);
    localTypingPreviewTimerRef.current = setTimeout(() => setIsLocallyTyping(false), 1000);
    return () => {
      if (localTypingPreviewTimerRef.current) clearTimeout(localTypingPreviewTimerRef.current);
    };
  }, [draft]);

  const selectConversation = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    const currentConversationId = typingConversationIdRef.current;

    if (socket?.connected && currentConversationId) {
      socket.emit("conversation:typing", { conversationId: currentConversationId, isTyping: false });
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    typingConversationIdRef.current = null;
    setDraft("");
    setEmojiOpen(false);
    activeConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
    router.replace(messagesConversationHref(conversationId), { scroll: false });
  }, [router]);

  useEffect(() => {
    const socket = socketRef.current;
    const currentConversationId = activeConversationId;
    const text = draft.trim();

    if (!socket?.connected || !currentConversationId) {
      return undefined;
    }

    if (!text) {
      if (typingConversationIdRef.current === currentConversationId) {
        socket.emit("conversation:typing", { conversationId: currentConversationId, isTyping: false });
        typingConversationIdRef.current = null;
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      return undefined;
    }

    // Renovamos o sinal a cada alteração: o servidor o encerra após alguns
    // segundos sem atividade, por isso um único evento na primeira tecla não basta.
    socket.emit("conversation:typing", { conversationId: currentConversationId, isTyping: true });
    typingConversationIdRef.current = currentConversationId;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      const activeSocket = socketRef.current;
      if (activeSocket?.connected && typingConversationIdRef.current === currentConversationId) {
        activeSocket.emit("conversation:typing", { conversationId: currentConversationId, isTyping: false });
        typingConversationIdRef.current = null;
      }
    }, 1000);

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [activeConversationId, draft, connectionState]);

  // ── Edit / Delete / Forward ───────────────────────────────────────────────

  const handleEditMsg = (msg: Msg) => {
    setEditingMsg(msg);
    setEditDraft(msg.content);
  };

  const submitEditMsg = useCallback(async () => {
    if (!editingMsg || !activeConversationIdRef.current) return;
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === editingMsg.content) { setEditingMsg(null); return; }

    const conversationId = editingMsg.conversationId;

    // Optimistic update
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map((m) =>
        m.id === editingMsg.id ? { ...m, content: trimmed } : m
      ),
    }));
    setEditingMsg(null);

    try {
      const res = await fetch(
        `/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(editingMsg.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        }
      );
      if (!res.ok) {
        // Revert
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] || []).map((m) =>
            m.id === editingMsg.id ? { ...m, content: editingMsg.content } : m
          ),
        }));
      } else {
        // Update with server response to ensure consistency
        const data = await res.json();
        if (data.ok && data.message) {
          setMessagesByConversation((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).map((m) =>
              m.id === editingMsg.id ? buildMessage(data.message, user) : m
            ),
          }));
        }
      }
    } catch {
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) =>
          m.id === editingMsg.id ? { ...m, content: editingMsg.content } : m
        ),
      }));
    }
  }, [editDraft, editingMsg, user]);

  const handleDeleteMsg = useCallback(async (msg: Msg) => {
    const conversationId = msg.conversationId;

    // Optimistic removal
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).filter((m) => m.id !== msg.id),
    }));

    try {
      await fetch(
        `/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(msg.id)}`,
        { method: "DELETE" }
      );
    } catch {
      // silently ignore — optimistic
    }
  }, []);

  const handleForwardMsg = useCallback((msg: Msg) => {
    setForwardMsg(msg);
  }, []);

  const handleReplyMsg = useCallback((msg: Msg) => {
    setEditingMsg(null);
    setReplyingTo(msg);
  }, []);

  const sendText = useCallback(() => {
    const socket = socketRef.current;
    const content = draft.trim();
    if (!activeConversationId || !content || isConversationBlocked) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (typingConversationIdRef.current === activeConversationId) {
      if (socket?.connected) {
        socket.emit("conversation:typing", { conversationId: activeConversationId, isTyping: false });
      }
      typingConversationIdRef.current = null;
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Msg = {
      id: clientMessageId,
      conversationId: activeConversationId,
      side: "right",
      senderId: user?.id || "",
      sender: "Você",
      senderDisplayName: getSessionUserDisplayName(user),
      senderAvatarUrl: user?.avatarUrl ?? null,
      kind: "text",
      content,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isoTime: new Date().toISOString(),
      readAt: null,
      mediaUrl: null,
      durationMs: null,
      linkUrl: null,
      linkLabel: null,
      pending: true,
      clientMessageId,
    };

    setMessagesByConversation((prev) => ({ ...prev, [activeConversationId]: mergeMessage(prev[activeConversationId] || [], optimistic) }));
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === activeConversationId
            ? { ...conversation, lastMessage: content, time: optimistic.time, lastMessageAt: optimistic.isoTime, unread: 0 }
            : conversation,
        ),
      ),
    );
    setDraft("");

    void (async () => {
      try {
        const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(activeConversationId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, clientMessageId, replyToMessageId: replyingTo?.id ?? null }),
        });
        const payload = await readJson<{ ok: true; message: BackendMessage }>(response);
        const confirmed = buildMessage(payload.message, user);
        setMessagesByConversation((prev) => ({ ...prev, [activeConversationId]: mergeMessage(prev[activeConversationId] || [], confirmed) }));
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
        setMessagesByConversation((prev) => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).filter((message) => message.clientMessageId !== clientMessageId),
        }));
      }
    })();
    setReplyingTo(null);
  }, [activeConversationId, draft, isConversationBlocked, replyingTo, user]);

  const startAudioRecording = useCallback(() => {
    if (!activeConversationId || isAudioBusy || isConversationBlocked) {
      return;
    }

    setError(null);
    void audioRecorder.start().catch((recordingError) => {
      setError(recordingError instanceof Error ? recordingError.message : "Não foi possível iniciar a gravação.");
    });
  }, [activeConversationId, audioRecorder, isAudioBusy, isConversationBlocked]);

  const stopAudioRecording = useCallback(() => {
    audioRecorder.stop();
  }, [audioRecorder]);

  const cancelAudioRecording = useCallback(() => {
    audioRecorder.cancel();
  }, [audioRecorder]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendText();
    }
  }, [sendText]);

  if (status === "loading") {
    return (
      <div
        className="flex h-[100dvh] min-h-screen items-center justify-center text-white"
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}
      >
        Carregando sua sessão...
      </div>
    );
  }

  return (
    <div
      className="flex h-[100dvh] min-h-screen flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}
    >
      <div className="flex flex-1 overflow-hidden">
        <aside className={`${activeConversationId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-white/[0.07] bg-transparent md:w-[400px]`}>
          <div className="flex flex-col gap-3 bg-transparent px-4 py-5 sm:px-6">
            <div className="flex items-center gap-4">
              <Link href="/" aria-label="Voltar para home" className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:text-white/80 transition">
                <ArrowLeftIcon s={20} />
              </Link>
              <span className="text-[23px] font-bold text-white">Messages</span>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-white/[0.08] bg-[#1a0e3d] px-5 py-2.5">
              <SearchIcon s={20} className="text-white" />
              <input
                ref={sidebarSearchRef}
                type="text"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Buscar..."
                aria-label="Buscar conversas"
                className="flex-1 bg-transparent text-[16px] text-white placeholder:text-white/30 outline-none"
              />
              {conversationSearch.trim() && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => {
                    setConversationSearch("");
                    sidebarSearchRef.current?.focus();
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <XIcon s={15} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-purple px-3 py-2 sm:px-2 sm:py-1">
            {loadingFollowed && followedUsers.length === 0 ? (
              <div className="px-3 py-6 text-center text-[14px] text-white/40">Carregando contatos seguidos...</div>
            ) : (
              filteredConversations.map((item) => {
                const isConversation = "lastMessageAt" in item;
                
                if (isConversation) {
                  const conversation = item as Conversation;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${activeConversationId === conversation.id ? "bg-[#1a0e3d]" : "hover:bg-white/[0.04]"}`}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar user={{ id: conversation.peerId, username: conversation.peerUsername, displayName: conversation.name, avatarUrl: conversation.avatarUrl }} size={44} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#000000] ${statusDot[conversation.status]}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[14px] font-semibold text-white">{conversation.name}</span>
                          <span className="shrink-0 text-[12px] text-white/40">{conversation.time}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-[13px] text-white/50">{conversation.lastMessage || "No messages yet"}</span>
                          {(conversation.unread ?? 0) > 0 && <span className="ml-auto shrink-0 rounded-full bg-[#9333EA] px-1.5 py-0.5 text-[11px] font-bold text-white">{conversation.unread}</span>}
                        </div>
                      </div>
                    </button>
                  );
                } else {
                  const followedUser = item as PublicUserProfile;
                  return (
                    <button
                      key={followedUser.id}
                      type="button"
                      onClick={() => {
                        ensureConversation(followedUser.id);
                      }}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${activeConversation?.peerId === followedUser.id ? "bg-[#1a0e3d]" : "hover:bg-white/[0.04]"}`}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar user={{ id: followedUser.id, username: followedUser.username, displayName: followedUser.displayName, avatarUrl: followedUser.avatarUrl }} size={44} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#000000] ${statusDot[followedUser.isPrivate ? "offline" : "online"]}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[14px] font-semibold text-white">{followedUser.displayName || followedUser.username}</span>
                          <span className="shrink-0 text-[11px] font-medium text-[#9333EA]">Nova conversa</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-[13px] text-white/50">Nenhuma mensagem ainda</span>
                        </div>
                      </div>
                    </button>
                  );
                }
              })
            )}
            {!loadingFollowed && filteredConversations.length === 0 && (
              <p className="px-3 py-6 text-center text-[14px] text-white/40">
                {conversationSearch.trim()
                  ? (searchingMessages ? "Buscando mensagens..." : "Nenhuma mensagem encontrada.")
                  : "Você ainda não possui conversas nem contatos seguidos."}
              </p>
            )}
          </div>


        </aside>

        <main className={`${activeConversationId ? "flex" : "hidden md:flex"} relative w-full min-w-0 flex-1 flex-col overflow-hidden md:w-auto`}>
          <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#000000] px-3 py-3 sm:px-6 sm:py-4">
            {activeConversation ? (
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Voltar às conversas" onClick={returnToConversationList} className="flex h-9 w-9 items-center justify-center text-white/70 md:hidden"><ArrowLeftIcon s={20} /></button>
                  <Link href={`/users/${activeConversation.peerId}`} className="relative">
                  <UserAvatar user={{ id: activeConversation.peerId, username: activeConversation.peerUsername, displayName: activeConversation.name, avatarUrl: activeConversation.avatarUrl }} size={44} />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#000000] ${statusDot[activeConversation.status]}`} />
                </Link>
                <div>
                  <Link href={`/users/${activeConversation.peerId}`} className="text-[16px] font-semibold text-white hover:underline">{activeConversation.name}</Link>
                  <p className={`text-[13px] ${isActiveConversationTyping ? "text-white/60" : activeConversation.status === "online" ? "text-[#22C55E]" : activeConversation.status === "busy" ? "text-[#F59E0B]" : "text-white/40"}`}>
                    {isActiveConversationTyping
                      ? `${activeConversation.name} digitando...`
                      : activeConversation.status === "online"
                        ? "online"
                        : activeConversation.status === "busy"
                          ? "ocupado"
                          : "offline"}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[16px] font-semibold text-white">Nenhuma conversa selecionada</p>
                <p className="text-[13px] text-white/40">Abra uma conversa para começar.</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              {messageSearchOpen ? (
                <div className="flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-2">
                  <input
                    type="text"
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    placeholder="Buscar mensagens..."
                    className="bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none w-48"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setMessageSearch(""); setMessageSearchOpen(false); }}
                    className="text-white/40 hover:text-white transition"
                  >
                    <XIcon s={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label="Buscar na conversa"
                  onClick={() => setMessageSearchOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/[0.06] transition"
                >
                  <SearchIcon s={18} />
                </button>
              )}
            </div>
          </div>

          {error && <div className="border-b border-white/[0.07] bg-[#2A1018] px-5 py-2 text-[12px] text-[#FCA5A5]">{error}</div>}
          {activeConversation?.blockedByPeer && <div className="border-b border-white/[0.07] bg-[#251545] px-5 py-3 text-center text-[13px] text-[#D8B4FE]">Esta pessoa bloqueou você. Suas novas mensagens não serão entregues.</div>}
          {activeConversation?.blockedByMe && <div className="border-b border-white/[0.07] bg-[#251545] px-5 py-3 text-center text-[13px] text-[#D8B4FE]">Você bloqueou esta pessoa. Desbloqueie-a para voltar a enviar mensagens.</div>}

          {messageSearch.trim() && (
            <div className="border-b border-white/[0.07] bg-[#1a0e3d] px-5 py-2 text-[12px] text-white/60">
              {filteredMessages.length === 0 
                ? "Nenhuma mensagem encontrada" 
                : `${filteredMessages.length} mensagem${filteredMessages.length !== 1 ? 's' : ''} encontrada${filteredMessages.length !== 1 ? 's' : ''}`
              }
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-purple px-3 py-4 sm:px-8 sm:py-6" ref={messagesContainerRef}>
            <div className="flex min-h-full flex-col justify-end">
            {!activeConversationId ? (
              <div className="flex h-full items-center justify-center text-center text-white/40">
                <div>
                  <p className="text-[16px] font-semibold text-white/70">Select a conversation</p>
                  <p className="mt-1 text-[14px]">Messages will appear here.</p>
                </div>
              </div>
            ) : loadingMessages && activeMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-white/40">Loading messages...</div>
            ) : (
              (() => {
                const rows: Array<Msg | { id: string; type: "date"; label: string }> = [];
                let previous = "";
                const messagesToRender = messageSearch.trim() ? filteredMessages : activeMessages;
                
                for (let index = 0; index < messagesToRender.length; index += 1) {
                  const message = messagesToRender[index];
                  const cloudReference = parseCloudCommentReference(message.content);
                  const nextMessage = messagesToRender[index + 1];
                  const isLegacyCloudReplyPair = cloudReference?.isLegacyReference
                    && nextMessage?.kind === "text"
                    && nextMessage.senderId === message.senderId
                    && !parseCloudCommentReference(nextMessage.content)
                    && new Date(nextMessage.isoTime).getTime() - new Date(message.isoTime).getTime() < 120_000;
                  const renderedMessage = isLegacyCloudReplyPair
                    ? { ...message, content: JSON.stringify({ type: "cloud_comment_reply", cloudTitle: cloudReference.cloudTitle, comment: cloudReference.comment, response: nextMessage.content }) }
                    : message;
                  const current = new Date(message.isoTime).toDateString();
                  if (current !== previous) {
                    rows.push({ id: `date-${current}`, type: "date", label: dateLabel(message.isoTime) });
                    previous = current;
                  }
                  rows.push(renderedMessage);
                  if (isLegacyCloudReplyPair) index += 1;
                }
                return rows.map((entry, index) => {
                  if ("type" in entry && entry.type === "date") {
                    return (
                      <div key={entry.id} className="flex justify-center py-1">
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/40">{entry.label}</span>
                      </div>
                    );
                  }

                  const message = entry as Msg;
                  const previousEntry = rows[index - 1];
                  const nextEntry = rows[index + 1];
                  const previousMessage = previousEntry && !("type" in previousEntry) ? previousEntry as Msg : null;
                  const nextMessage = nextEntry && !("type" in nextEntry) ? nextEntry as Msg : null;
                  const continuesPreviousGroup = previousMessage?.senderId === message.senderId;
                  const continuesNextGroup = nextMessage?.senderId === message.senderId;

                  return (
                    <div key={message.id} className={continuesPreviousGroup ? "mt-1" : "mt-4 first:mt-0"}>
                      <MessageBubble msg={message} showFooter={!continuesNextGroup} showAvatar={!continuesNextGroup} onReply={handleReplyMsg} onEdit={handleEditMsg} onDelete={handleDeleteMsg} onForward={handleForwardMsg} searchQuery={messageSearch} />
                    </div>
                  );
                });
              })()
            )}
            {typingPerson && typingPerson.id !== user?.id && (
              <div className="flex items-end gap-2 pt-1 justify-start" role="status" aria-live="polite">
                <Link href={`/users/${typingPerson.id}`} aria-label={`Ver perfil de ${typingPerson.name}`}>
                  <UserAvatar user={{ id: typingPerson.id, username: typingPerson.username, displayName: typingPerson.name, avatarUrl: typingPerson.avatarUrl }} size={28} />
                </Link>
                <div key={typingPerson.id} className="relative rounded-[20px] bg-black px-3 py-2.5 rounded-bl-md">
                  <TypingDots />
                </div>
                <span className="pb-1 text-[12px] text-white/55">{typingPerson.label}</span>
              </div>
            )}
            <div ref={bottomRef} />
            </div>
          </div>

          {/* ── Edit bar ── */}
          {editingMsg && (
            <div className="border-t border-[#7C3AED]/40 bg-[#000000] px-5 py-3">
              <div className="flex flex-col gap-2 rounded-2xl border border-[#7C3AED]/40 bg-[#1a0e3d] px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A855F7]">Editando mensagem</span>
                  <button type="button" onClick={() => setEditingMsg(null)} className="text-white/40 hover:text-white transition">
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitEditMsg(); }
                      if (e.key === "Escape") setEditingMsg(null);
                    }}
                    className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => void submitEditMsg()}
                    disabled={!editDraft.trim() || editDraft.trim() === editingMsg.content}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9] disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {replyingTo && !editingMsg && (
            <div className="border-t border-white/[0.07] bg-[#000000] px-5 py-3">
              <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#1a0e3d] px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#A855F7]">Respondendo a {replyingTo.senderDisplayName}</p>
                  <p className="truncate text-[12px] text-white/60">{replyingTo.content || "Mídia"}</p>
                </div>
                <button type="button" aria-label="Cancelar resposta" onClick={() => setReplyingTo(null)} className="text-white/40 transition hover:text-white">×</button>
              </div>
            </div>
          )}

          <div className={`border-t border-white/[0.07] bg-[#000000] px-5 py-4 relative z-30`}>
            <div className="relative flex flex-col gap-2 rounded-full border border-white/[0.08] bg-[#1a0e3d] px-5 py-3">
              {emojiOpen && (
                <div data-emoji-picker="true" className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-10 rounded-[22px] border border-white/10 bg-[#11141F] shadow-[0_18px_50px_rgba(0,0,0,0.35)] overflow-hidden">
                  <div className="grid grid-cols-2 gap-1 border-b border-white/[0.07] p-2"><button type="button" onClick={() => setMediaPickerTab("emoji")} className={`rounded-xl py-2 text-[13px] font-semibold ${mediaPickerTab === "emoji" ? "bg-white/10 text-white" : "text-white/45"}`}>😊 Emojis</button><button type="button" onClick={() => setMediaPickerTab("sticker")} className={`rounded-xl py-2 text-[13px] font-semibold ${mediaPickerTab === "sticker" ? "bg-white/10 text-white" : "text-white/45"}`}>◌ Figurinhas</button></div>
                  {mediaPickerTab === "sticker" ? <div className="max-h-[28vh] overflow-y-auto p-3"><p className="mb-2 text-[12px] font-semibold text-white/60">Minhas figurinhas</p>{savedStickers.length ? <div className="flex flex-wrap gap-2">{savedStickers.map((sticker) => <button key={sticker.id} type="button" onClick={() => { void fetch(sticker.mediaUrl).then((response) => response.blob()).then((blob) => handleImageFile(new File([blob], "figurinha.webp", { type: blob.type || "image/webp" }))); setEmojiOpen(false); }} className="h-16 w-16 rounded-xl p-1 transition hover:bg-white/10"><img src={sticker.mediaUrl} alt="Figurinha" className="h-full w-full object-contain" /></button>)}</div> : <p className="py-4 text-center text-sm text-white/40">Nenhuma figurinha salva no CloudChat.</p>}</div> : <>
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
                          onClick={() => insertEmoji(emoji)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-[18px] transition hover:bg-white/[0.07]"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  </>}
                </div>
              )}
              {audioRecorder.state === "recording" || audioRecorder.state === "paused" ? (
                <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-black px-4 py-2.5">
                  <div className="flex-1 text-[14px] text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {audioRecorder.state === "paused" ? "Pausado" : "Gravando…"} {formatDuration(audioRecorder.seconds * 1000) || "0:00"}
                  </div>
                  <Waveform active={audioRecorder.state === "recording"} paused={audioRecorder.state === "paused"} progress={audioRecorder.seconds} />
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label={audioRecorder.state === "paused" ? "Retomar" : "Pausar"} onClick={audioRecorder.state === "paused" ? audioRecorder.resume : audioRecorder.pause}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10 transition">
                      {audioRecorder.state === "paused" ? <PlayIcon s={16} /> : <PauseIcon s={16} />}
                    </button>
                    <button type="button" aria-label="Enviar áudio" onClick={stopAudioRecording}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition">
                      <SendIcon />
                    </button>
                    <button type="button" aria-label="Cancelar gravação" onClick={cancelAudioRecording}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10 transition">
                      <TrashIcon s={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {sharedLink && (
                    <div className="flex items-center justify-between gap-3 rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">Link pronto para enviar</p>
                        <p className="truncate text-[14px] font-semibold text-white">{sharedLink.label}</p>
                        <p className="truncate text-[12px] text-white/45">{sharedLink.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSharedLink(null)}
                          className="rounded-full border border-white/10 px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          Remover
                        </button>
                        <button
                          type="button"
                          onClick={sendSharedLink}
                          disabled={!activeConversationId || linkUploading || isAudioBusy || isConversationBlocked}
                          className="rounded-full bg-cyan-500 px-4 py-2 text-[12px] font-semibold text-[#04111F] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {linkUploading ? "Enviando..." : "Enviar link"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Abrir emojis"
                      data-emoji-toggle="true"
                      onClick={() => setEmojiOpen((current) => !current)}
                      disabled={!activeConversationId || isAudioBusy || isConversationBlocked}
                      className="text-[#9CA3AF] leading-none transition hover:text-[#D1D5DB] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <path d="M9 9h.01" />
                        <path d="M15 9h.01" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Adicionar imagem"
                      onClick={triggerImagePicker}
                      disabled={!activeConversationId || isAudioBusy || isConversationBlocked}
                      className="text-[#9CA3AF] transition hover:text-[#D1D5DB] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <PlusIcon s={18} />
                    </button>
                    <input
                      type="text"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isConversationBlocked ? "Envio de mensagens indisponível" : activeConversationId ? "Mensagem..." : "Selecione uma conversa para começar"}
                      disabled={!activeConversationId || isAudioBusy || isConversationBlocked}
                      className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {draft.trim() ? (
                      <button type="button" aria-label="Enviar" onClick={sendText} disabled={isConversationBlocked} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9333EA] text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40">
                        <SendIcon s={18} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="Gravar áudio"
                        onClick={startAudioRecording}
                        disabled={!activeConversationId || isAudioBusy || isConversationBlocked}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#1a0e3d] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
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
                        void handleImageFile(file);
                      }}
                    />
                  </div>
                  {audioUploading || imageUploading ? <p className="text-[11px] text-white/35">Enviando mídia...</p> : null}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Forward modal ── */}
      {forwardMsg && (
        <ForwardToContactModal title="Encaminhar mensagem" preview={forwardMsg.kind === "text" ? forwardMsg.content : forwardMsg.kind === "audio" ? "Mensagem de áudio" : forwardMsg.kind === "image" ? "Imagem" : "Link"} url={forwardMsg.linkUrl ?? (typeof window !== "undefined" ? window.location.href : "")} label={forwardMsg.kind === "text" ? forwardMsg.content : forwardMsg.linkUrl ?? "Mensagem encaminhada"} messageContent={forwardMsg.kind === "text" ? forwardMsg.content : undefined} mediaKind={forwardMsg.kind === "audio" || forwardMsg.kind === "image" ? forwardMsg.kind : undefined} mediaUrl={forwardMsg.kind === "audio" || forwardMsg.kind === "image" ? forwardMsg.mediaUrl : undefined} mediaDurationMs={forwardMsg.kind === "audio" ? forwardMsg.durationMs : undefined} mediaFileName={forwardMsg.kind === "audio" || forwardMsg.kind === "image" ? forwardMsg.mediaFileName : undefined} contacts={forwardContacts} loading={loadingConversations || loadingFollowed} onClose={() => setForwardMsg(null)} />
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={(
        <div
          className="flex h-screen items-center justify-center text-white"
          style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}
        >
          Loading messages...
        </div>
      )}
    >
      <MessagesPageContent />
    </Suspense>
  );
}




