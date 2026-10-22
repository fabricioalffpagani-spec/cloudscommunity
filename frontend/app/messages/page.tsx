"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { socketAuth } from "../lib/socket-auth";
import { parseForwardedContent } from "../lib/forwarded-content";
import { sharedCloudLink } from "../lib/shared-cloud-link";

import { SessionUserAvatar, UserAvatar, getSessionUserDisplayName, useSessionUser } from "../components/session-user";
import { ArrowLeftIcon, BellIcon, CheckIcon, GearIcon, MicIcon, PauseIcon, PlayIcon, PlusIcon, SearchIcon, SendIcon, StickerIcon, TrashIcon, XIcon } from "../components/ui-icons";
import { AudioWaveformPlayer } from "../components/AudioWaveformPlayer";
import { ForwardToContactModal, type ForwardContact } from "../components/ForwardToContactModal";
import { MessageMenuPortal } from "../components/MessageMenuPortal";
import { ConversationListPreview } from "../components/ConversationListPreview";
import { messagesConversationHref, requestedConversationId } from "../lib/navigation-memory";
import { buildMessageContactList } from "../lib/message-contacts";
import { useComposerPanLock } from "../lib/composer-pan-lock";
import { isConversationForViewer } from "../lib/direct-conversation";
import { recordStickerUse } from "../lib/sticker-usage";
import { markDirectMessageFailed, mergeDirectMessage as mergeMessage, retryDirectMessage } from "../lib/merge-direct-message";
import { getInboxConversationPreview } from "../lib/conversation-preview";
import { getRevealedMessageTimeSide, isMessageReplySwipe, nextRevealedMessageTimeSide } from "../lib/message-time-swipe";

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
  editedAt: string | null;
  readAt: string | null;
  isPinned: boolean;
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
  reactions?: Array<{ id: string; emoji: string; userId: string; createdAt: string }>;
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
  editedAt?: string | null;
  readAt: string | null;
  isPinned?: boolean;
  mediaUrl: string | null;
  mediaFileName?: string | null;
  durationMs: number | null;
  peaks?: number[] | null;
  linkUrl: string | null;
  linkLabel: string | null;
  pending?: boolean;
  failed?: boolean;
  clientMessageId?: string | null;
  replyToMessageId?: string | null;
  reactions?: Array<{ id: string; emoji: string; userId: string; createdAt: string }>;
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
  if (status === "online") return "online";
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

function replyPreview(message: Msg): string {
  if (message.kind !== "link") return message.content || "Mídia";
  try {
    const parsed = JSON.parse(message.linkLabel || "{}") as { type?: string; cloudTitle?: string; label?: string };
    if (parsed.type === "cloud_invitation") return parsed.cloudTitle || "Convite para Cloud";
    if (parsed.type === "forwarded_link") return parsed.label || "Link compartilhado";
  } catch { /* regular link */ }
  return parseLinkPreview(message.linkLabel, message.linkUrl);
}

function isPrivateCloudInvitation(message: Msg): boolean {
  try {
    const label = JSON.parse(message.linkLabel || "{}");
    return label.type === "cloud_invitation" && label.cloudVisibility === "private";
  } catch { return false; }
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

function buildConversation(payload: BackendConversation, viewerId: string): Conversation | null {
  if (!isConversationForViewer(payload, viewerId)) return null;
  const name = payload.participant.displayName || payload.participant.username;
  return {
    id: payload.id,
    peerId: payload.participant.id,
    peerUsername: payload.participant.username,
    name,
    status: mapStatus(payload.participant.status),
    avatarUrl: payload.participant.avatarUrl,
    lastMessage: getInboxConversationPreview(
      payload.lastMessagePreview,
      parseLinkPreview,
    ),
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
      editedAt: payload.editedAt,
    readAt: payload.readAt,
    isPinned: payload.isPinned,
    mediaUrl: payload.mediaAsset?.url ?? null,
    mediaFileName: payload.mediaAsset?.originalFileName ?? null,
    durationMs: payload.mediaAsset?.durationMs ?? null,
    peaks: (payload.mediaAsset as { peaks?: number[] | null } | undefined)?.peaks ?? null,
    linkUrl,
    linkLabel,
    clientMessageId: payload.clientMessageId,
    reactions: payload.reactions ?? [],
  };
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

function withConfirmedPreview(list: Conversation[], conversationId: string, message: Msg, preview: string) {
  return sortConversations(list.map((conversation) => conversation.id === conversationId
    && (!conversation.lastMessageAt || conversation.lastMessageAt <= message.isoTime)
    ? { ...conversation, lastMessage: preview, time: message.time, lastMessageAt: message.isoTime, unread: 0 }
    : conversation));
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
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"].find((type) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
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
    <div className="flex items-end gap-[2px] sm:gap-[3px]" style={{ height: 32 }}>
      {heights.map((h, i) => (
        <span 
          key={i} 
          className={`block w-[4px] rounded-full transition-all duration-150 ease-out ${i > 11 ? "hidden sm:block" : ""}`}
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

function ForwardedHeading({ content }: { content: string }) {
  const info = parseForwardedContent(content);
  if (!info.forwarded) return null;
  return <div className="mb-2 text-[11px] font-medium leading-snug text-white/70">
    <span className="block">↗ Encaminhada</span>
    {info.origin ? <span>Da cloud <Link href={`/cloud/${encodeURIComponent(info.origin.id)}`} className="break-words font-semibold text-white" onClick={(event) => event.stopPropagation()}>{info.origin.name}</Link></span> : info.legacyCloud ? <span>De uma cloud</span> : null}
  </div>;
}

function AudioMessageBubble({ msg }: { msg: Msg }) {
  const isRight = msg.side === "right";
  const isForwarded = /^(?:↗\s*)?(?:Encaminhada(?: de uma cloud)?|Mensagem encaminhada)$/i.test(msg.content.trim());
  const forwardedLabel = /de uma cloud/i.test(msg.content) ? "Encaminhada de uma cloud" : "Encaminhada";
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
        <div className="w-[min(340px,calc(100vw-7rem))] max-w-full rounded-t-2xl bg-[#8a20e9] px-3 py-2 text-[9px] font-medium uppercase tracking-[0.12em] text-white/70">
          <ForwardedHeading content={msg.content} />
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
  const isForwarded = /^(?:↗\s*)?(?:Encaminhada(?: de uma cloud)?|Mensagem encaminhada)$/i.test(msg.content.trim());
  const forwardedLabel = /de uma cloud/i.test(msg.content) ? "Encaminhada de uma cloud" : "Encaminhada";
  const [expanded, setExpanded] = useState(false);
  const isSticker = Boolean(msg.mediaFileName?.startsWith("figurinha"));

  if (isSticker) return msg.mediaUrl ? <div>{isForwarded && <ForwardedHeading content={msg.content} />}<img src={msg.mediaUrl} alt="Figurinha enviada" className="mb-4 mt-4 h-36 w-36 object-contain" /></div> : null;

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className={`overflow-hidden rounded-2xl border text-left transition ${isRight ? "rounded-br-[4px] border-[#9333EA]/30 bg-[#9333EA]" : "rounded-bl-[4px] border-white/[0.08] bg-[#1a0e3d]"}`}
      style={{ maxWidth: "320px" }}
    >
      {isForwarded && <div className="px-3 pt-3"><ForwardedHeading content={msg.content} /></div>}
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
  const sharedCloud = typeof window !== "undefined" ? sharedCloudLink(msg.linkUrl, window.location.origin) : null;

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
    // Recipients of this direct invitation are already Cloud members.
    const inviteUrl = `/cloud/${encodeURIComponent(cloudInviteData.cloudId)}?join=1`;
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

  if (sharedCloud && msg.linkUrl) {
    const title = label === msg.linkUrl || /^https?:\/\//i.test(label) ? "Cloud compartilhada" : label;
    return (
      <a href={msg.linkUrl} className="block w-[min(360px,100%)] overflow-hidden rounded-3xl text-left text-white transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 60%, #A855F7 100%)" }}>
        <div className="px-5 pt-5 pb-4">
          {isExternal && <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/70">Conteúdo encaminhado</p>}
          <p className="mb-3 text-[12px] font-semibold text-white/80">Cloud compartilhada · {sharedCloud === "read" ? "Read" : "Talk"}</p>
          <p className="break-words text-[22px] font-extrabold leading-tight sm:text-2xl">{title}</p>
        </div>
        <div className="px-4 pb-4"><span className="flex min-h-11 items-center justify-center rounded-2xl bg-white/20 px-4 py-3 text-[15px] font-bold text-white">{sharedCloud === "read" ? "Ler" : "Entrar na Cloud"}</span></div>
        {msg.pending && <p className="mt-2 text-xs text-white/70">enviando...</p>}
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
  if (msg.failed) return null;
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

function DmMenuPinIcon() {
  return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4h6" /><path d="M10 4v5l-3 3v2h10v-2l-3-3V4" /><path d="M12 14v6" /></svg>;
}

function DmReactionIcon() {
  return <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 10h.01M15.5 10h.01" /><path d="M8 15c1.1 1 2.4 1.5 4 1.5s2.9-.5 4-1.5" /></svg>;
}

function DmMsgMenu({
  msg,
  textContent,
  onEdit,
  onDelete,
  onReply,
  onForward,
  onPin,
  onSaveSticker,
  isPinned = false,
  onClose,
}: {
  msg: Msg;
  textContent: string | null;
  onEdit?: (m: Msg) => void;
  onDelete?: (m: Msg) => void;
  onReply?: (m: Msg) => void;
  onForward?: (m: Msg) => void;
  onPin?: (m: Msg) => void;
  onSaveSticker?: (mediaUrl: string) => void;
  isPinned?: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);

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

  const copyable = !!textContent || !!msg.linkUrl;
  const isOwn = msg.side === "right";
  const isSticker = msg.kind === "image" && Boolean(msg.mediaFileName?.startsWith("figurinha"));

  const items: { label: string; icon: React.ReactNode; action: () => void; danger?: boolean; show: boolean }[] = [
    {
      label: copied ? "Copiado!" : "Copiar",
      icon: <DmMenuCopyIcon />,
      action: handleCopy,
      show: copyable && !isPrivateCloudInvitation(msg),
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
      show: !isPrivateCloudInvitation(msg),
    },
    {
      label: "Salvar figurinha",
      icon: <DmMenuPinIcon />,
      action: () => { if (msg.mediaUrl) onSaveSticker?.(msg.mediaUrl); onClose(); },
      show: isSticker && Boolean(msg.mediaUrl?.startsWith("data:image/")),
    },
    {
      label: isPinned ? "Desafixar" : "Fixar",
      icon: <DmMenuPinIcon />,
      action: () => { onPin?.(msg); onClose(); },
      show: true,
    },
  ];

  return (
    <div
      data-message-menu="true"
      className="min-w-[168px] rounded-2xl border border-white/[0.08] bg-[#15161C] py-1 shadow-2xl shadow-black/60"
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

function MessageBubble({ msg, onReply, onEdit, onDelete, onForward, onPin, onReact, onSaveSticker, onRetry, selectionMode = false, selected = false, onToggleSelection, isPinned, searchQuery, showFooter = true, showAvatar = true, showSwipeTime = false }: { msg: Msg; onReply?: (m: Msg) => void; onEdit?: (m: Msg) => void; onDelete?: (m: Msg) => void; onForward?: (m: Msg) => void; onPin?: (m: Msg) => void; onReact?: (m: Msg, emoji: string) => void; onSaveSticker?: (mediaUrl: string) => void; onRetry?: (m: Msg) => void; selectionMode?: boolean; selected?: boolean; onToggleSelection?: (m: Msg) => void; isPinned?: boolean; searchQuery?: string; showFooter?: boolean; showAvatar?: boolean; showSwipeTime?: boolean }) {
  const isRight = msg.side === "right";
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const replySwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const openedByLongPressRef = useRef(false);

  const textContent = msg.kind === "text" ? msg.content : null;
  const forwardedInfo = textContent !== null ? parseForwardedContent(textContent) : null;
  const isForwardedMessage = Boolean(forwardedInfo?.forwarded);
  const visibleTextContent = forwardedInfo?.text ?? textContent;
  const highlightedContent = searchQuery && visibleTextContent ? highlightText(visibleTextContent, searchQuery) : visibleTextContent;
  const cloudCommentReference = parseCloudCommentReference(textContent);

  useEffect(() => {
    const closeActions = (event: PointerEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setReactionPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeActions);
    return () => document.removeEventListener("pointerdown", closeActions);
  }, []);

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    cancelLongPress();
  }, [msg.id, msg.conversationId]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuAnchorRef.current?.contains(event.target as Node) && !menuPortalRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== msg.id) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("clouds:message-menu-open", closeOther);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("clouds:message-menu-open", closeOther);
    };
  }, [menuOpen, msg.id]);

  function openMenu() {
    setMenuOpen(true);
    document.dispatchEvent(new CustomEvent("clouds:message-menu-open", { detail: msg.id }));
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    pressStartRef.current = null;
  }

  function handleMessagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // The message owns a horizontal drag; the list only handles gestures that
    // begin outside a bubble, such as showing timestamps.
    event.stopPropagation();
    if (event.pointerType !== "touch" || (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, [data-message-menu]"))) return;
    replySwipeStartRef.current = { x: event.clientX, y: event.clientY };
    // Keep the end event even when the reply drag leaves the message bubble.
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelLongPress();
    openedByLongPressRef.current = false;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = setTimeout(() => {
      openedByLongPressRef.current = true;
      openMenu();
    }, 900);
  }

  function handleMessagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = pressStartRef.current;
    if (event.pointerType === "touch" && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) cancelLongPress();
  }

  function handleMessagePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const replySwipeStart = replySwipeStartRef.current;
    replySwipeStartRef.current = null;
    cancelLongPress();
    if (replySwipeStart && isMessageReplySwipe(event.clientX - replySwipeStart.x, event.clientY - replySwipeStart.y)) {
      event.preventDefault();
      event.stopPropagation();
      onReply?.(msg);
      return;
    }
    if (openedByLongPressRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <div
      className="group flex w-full [touch-action:pan-y] select-none items-end gap-2.5 [-webkit-touch-callout:none] md:select-text"
      style={{ justifyContent: isRight ? "flex-end" : "flex-start" }}
      onPointerDown={handleMessagePointerDown}
      onPointerMove={handleMessagePointerMove}
      onPointerUp={handleMessagePointerEnd}
      onPointerCancel={() => { replySwipeStartRef.current = null; cancelLongPress(); }}
      onClickCapture={(event) => { if (openedByLongPressRef.current && !(event.target instanceof Element && event.target.closest("[data-message-menu]"))) { event.preventDefault(); event.stopPropagation(); openedByLongPressRef.current = false; } }}
      onContextMenu={(event) => { if (!(event.target instanceof Element && event.target.closest("[data-message-menu]"))) { event.preventDefault(); openMenu(); } }}
    >
      {/* Avatar — alinha ao fundo do bubble usando mb igual à altura da action row */}
      {!isRight && <div className="w-9 shrink-0 mb-7">
        {showAvatar && <UserAvatar
          user={{ id: msg.senderId, username: msg.senderId, displayName: msg.senderDisplayName, avatarUrl: msg.senderAvatarUrl }}
          size={34}
        />}
      </div>}
      {selectionMode && <button type="button" aria-label={selected ? "Desmarcar mensagem" : "Selecionar mensagem"} onClick={() => onToggleSelection?.(msg)} className={`h-6 w-6 shrink-0 rounded-full border-2 ${selected ? "border-[#A855F7] bg-[#9333EA]" : "border-white/50 bg-black/20"}`}>{selected && <span className="block text-center text-[14px] leading-5 text-white">✓</span>}</button>}
      <div className={`relative flex flex-col gap-1 transition-transform duration-200 ${isRight ? "items-end" : "items-start"}`} style={{ maxWidth: msg.kind === "link" && typeof window !== "undefined" && sharedCloudLink(msg.linkUrl, window.location.origin) ? "85%" : "72%", transform: showSwipeTime ? `translateX(${isRight ? -44 : 44}px)` : "translateX(0)" }}>
        {showSwipeTime && <span data-message-swipe-time className={`absolute top-1/2 z-10 -translate-y-1/2 whitespace-nowrap text-[11px] text-white/65 ${isRight ? "left-full ml-2" : "right-full mr-2"}`}>{msg.time}</span>}
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
          <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-white ${isRight ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
            {isForwardedMessage && <ForwardedHeading content={textContent ?? ""} />}
            <span className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlightedContent || visibleTextContent || "" }} />
            {msg.pending && !msg.failed && <span className="ml-2 text-[11px] text-white/50">enviando...</span>}
          </div>
        )}
        {isPinned && <span className="px-1 text-[11px] font-medium text-[#D8B4FE]">📌 Mensagem fixada</span>}
        {msg.failed && msg.kind === "text" && <button type="button" onClick={() => onRetry?.(msg)} className="px-1 text-[11px] font-semibold text-red-300 hover:text-red-200">Falha no envio · Tentar novamente</button>}
        {(msg.reactions?.length ?? 0) > 0 && <div className={`flex flex-wrap gap-1 px-1 ${isRight ? "justify-end" : "justify-start"}`}>
          {Object.entries((msg.reactions ?? []).reduce<Record<string, NonNullable<Msg["reactions"]>>>((groups, reaction) => {
            groups[reaction.emoji] = [...(groups[reaction.emoji] ?? []), reaction];
            return groups;
          }, {})).map(([emoji, reactions]) => <button key={emoji} type="button" onClick={() => onReact?.(msg, emoji)} className="rounded-full border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[13px] text-white transition hover:bg-white/15">{emoji}<span className="ml-1 text-[11px] text-white/70">{reactions.length}</span></button>)}
        </div>}
        <div className={`${showFooter ? "flex px-1" : "absolute -bottom-1"} items-center gap-1 ${isRight ? "right-0 flex-row-reverse" : "left-0"}`}>
          {showFooter && <>
            <span className="text-[11px] text-white">{msg.time}</span>
            {msg.editedAt && <span className="text-[10px] italic text-white/45">editada</span>}
            {isRight && <MessageReceipt msg={msg} />}
          </>}
          <div ref={menuAnchorRef} className="relative">
              {menuOpen && (
                <MessageMenuPortal anchorRef={menuAnchorRef} menuRef={menuPortalRef} alignRight={isRight}><DmMsgMenu
                  msg={msg}
                  textContent={textContent}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReply={onReply}
                  onForward={onForward}
                  onPin={onPin}
                  onSaveSticker={onSaveSticker}
                  isPinned={isPinned}
                  onClose={closeMenu}
                /></MessageMenuPortal>
              )}
          </div>
        </div>
      </div>
      <div ref={actionsRef} className={`hidden shrink-0 items-center gap-1 self-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 md:flex ${isRight ? "order-first" : ""}`}>
        <button type="button" aria-label="Responder" title="Responder" onClick={() => onReply?.(msg)} className="flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/15"><span className="scale-125"><DmReplyIcon /></span></button>
        <button type="button" aria-label={isPinned ? "Desafixar mensagem" : "Fixar mensagem"} title={isPinned ? "Desafixar mensagem" : "Fixar mensagem"} onClick={() => onPin?.(msg)} className={`flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-white/15 ${isPinned ? "text-[#A855F7]" : "text-white"}`}><span className="scale-125"><DmMenuPinIcon /></span></button>
        <div className="relative"><button type="button" aria-label="Reagir" title="Reagir" onClick={() => setReactionPickerOpen((open) => !open)} className="flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:bg-white/15"><DmReactionIcon /></button>{reactionPickerOpen && <div className="absolute bottom-full right-0 z-50 mb-2 flex gap-1 rounded-full border border-white/10 bg-[#15161C] p-2 shadow-xl">{["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => <button key={emoji} type="button" onClick={() => { onReact?.(msg, emoji); setReactionPickerOpen(false); }} className="rounded-full p-1 text-xl transition hover:bg-white/10">{emoji}</button>)}</div>}</div>
        <button type="button" aria-label="Mais opções" title="Mais opções" onClick={openMenu} className="flex h-12 w-12 items-center justify-center rounded-full text-2xl leading-none text-white transition hover:bg-white/15">⋮</button>
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
  const followingIdsRef = useRef<string[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, Status>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const openedPeerRef = useRef<string | null>(null);
  const sidebarSearchRef = useRef<HTMLInputElement | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Msg[]>>({});
  const [pinsByConversation, setPinsByConversation] = useState<Record<string, Msg[]>>({});
  const [typingByConversation, setTypingByConversation] = useState<Record<string, boolean>>({});
  const [isLocallyTyping, setIsLocallyTyping] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [discardAudioConfirmationOpen, setDiscardAudioConfirmationOpen] = useState(false);
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
  const [forwardSelection, setForwardSelection] = useState<Msg[]>([]);
  const [forwardSelectionMode, setForwardSelectionMode] = useState(false);
  const [revealedMessageTimeSide, setRevealedMessageTimeSide] = useState<"left" | "right" | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messageTimeSwipeStartRef = useRef<number | null>(null);
  const composerFooterRef = useComposerPanLock();
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
      setConversations((prev) => withConfirmedPreview(prev, conversationId, confirmed, "Áudio"));
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
    const loadStickers = () => {
      void fetch("/api/stickers", { cache: "no-store" }).then((response) => response.json()).then((payload: { stickers?: Array<{ id: string; mediaUrl: string }> }) => setSavedStickers(payload.stickers ?? [])).catch(() => undefined);
    };
    loadStickers();
    const timer = window.setInterval(loadStickers, 15_000);
    return () => window.clearInterval(timer);
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

  const handleImageFile = useCallback(async (file: File | null, isSticker = false, savedStickerUrl?: string) => {
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
      mediaFileName: isSticker ? "figurinha.webp" : null,
      durationMs: null,
      linkUrl: null,
      linkLabel: null,
      pending: true,
      clientMessageId,
    };

    setImageUploading(true);
    setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], optimistic) }));

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
      setConversations((prev) => withConfirmedPreview(prev, conversationId, confirmed, "Imagem"));
      if (savedStickerUrl) {
        void recordStickerUse(savedStickerUrl).then(() =>
          fetch("/api/stickers", { cache: "no-store" })
            .then((result) => result.json())
            .then((result: { stickers: Array<{ id: string; mediaUrl: string }> }) => setSavedStickers(result.stickers)),
        ).catch(() => undefined);
      }
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
      setConversations((prev) => withConfirmedPreview(prev, conversationId, confirmed, parseLinkPreview(sharedLink.label)));
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
    if (!user?.id) return;
    setLoadingConversations(true);
    setError(null);
    try {
      const response = await fetch("/api/direct-messages/conversations", { cache: "no-store" });
      const payload = await readJson<{ ok: true; conversations: BackendConversation[] }>(response);
      const mapped = payload.conversations.flatMap((conversation) => {
        const built = buildConversation(conversation, user.id);
        if (!built) return [];
        return [{
          ...built,
          status: presenceByUserIdRef.current[built.peerId] ?? built.status,
        }];
      });
      const sortedConversations = sortConversations(mapped);
      conversationsRef.current = sortedConversations;
      setConversations(sortedConversations);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar as conversas.");
    } finally {
      setLoadingConversations(false);
    }
  }, [user?.id]);

  const loadFollowedUsers = useCallback(async () => {
    setLoadingFollowed(true);
    setError(null);
    try {
      const response = await fetch("/api/users/following", { cache: "no-store" });
      const payload = await readJson<{ ok: true; users: PublicUserProfile[] }>(response);
      // Exclude current user
      const following = payload.users.filter(u => u.id !== user?.id);
      followingIdsRef.current = following.map((person) => person.id);
      setFollowedUsers(following);
      const socket = socketRef.current;
      if (socket?.connected) socket.emit("presence:lookup", { userIds: followingIdsRef.current }, (result: { ok: boolean; data?: Record<string, Status> }) => {
        if (!result.ok || !result.data) return;
        presenceByUserIdRef.current = { ...presenceByUserIdRef.current, ...result.data };
        setPresenceByUserId(presenceByUserIdRef.current);
      });
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
      const payload = await readJson<{ ok: true; messages: BackendMessage[]; pinnedMessages?: BackendMessage[] }>(response);
      setPinsByConversation((prev) => ({
        ...prev,
        [conversationId]: (payload.pinnedMessages ?? []).map((message) => buildMessage(message, user)),
      }));
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).reduce(
          (list, message) => mergeMessage(list, message),
          payload.messages.map((message) => buildMessage(message, user)),
        ),
      }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar as mensagens.");
    } finally {
      setLoadingMessages(false);
    }
  }, [user?.id]);

  const ensureConversation = useCallback(async (peerUserId: string) => {
    if (!user?.id || !peerUserId || openedPeerRef.current === peerUserId) return;
    openedPeerRef.current = peerUserId;
    try {
      const response = await fetch("/api/direct-messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId }),
      });
      const payload = await readJson<{ ok: true; conversation: BackendConversation }>(response);
      const built = buildConversation(payload.conversation, user.id);
      if (!built) throw new Error("Conversa inválida para o usuário atual.");
      const conversation = {
        ...built,
        status: presenceByUserIdRef.current[built.peerId] ?? built.status,
      };
      setConversations((prev) => sortConversations(prev.some((item) => item.id === conversation.id) ? prev.map((item) => (item.id === conversation.id ? conversation : item)) : [conversation, ...prev]));
      activeConversationIdRef.current = conversation.id;
      setActiveConversationId(conversation.id);
      if (!searchParams.get("share")) {
    // Preserve the list route in history so the device Back button returns to it.
    router.push(messagesConversationHref(conversation.id), { scroll: false });
      }
    } catch (conversationError) {
      setError(conversationError instanceof Error ? conversationError.message : "Não foi possível abrir a conversa.");
    } finally {
      // This ref prevents duplicate simultaneous requests only. Keeping it set
      // after a failed request made a contact impossible to open until reload.
      if (openedPeerRef.current === peerUserId) openedPeerRef.current = null;
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

  const routeConversationId = requestedConversationId(searchParams);
  const routePeerId = searchParams.get("id")?.trim() ?? "";
  const lastRouteRef = useRef<string | null>(null);
  useEffect(() => {
    const rememberedConversationId = routeConversationId;
    const routeKey = `${rememberedConversationId ?? ""}:${routePeerId}`;
    const routeChanged = lastRouteRef.current !== routeKey;
    lastRouteRef.current = routeKey;
    if (!rememberedConversationId) {
      // A rota /messages representa sempre a lista. Isso também cobre o toque no
      // item Mensagens da navegação móvel depois de sair de uma conversa.
      if (!routePeerId && routeChanged) {
        activeConversationIdRef.current = null;
        setActiveConversationId(null);
      }
      return;
    }
    if (!conversations.some((conversation) => conversation.id === rememberedConversationId)) return;
    if (activeConversationIdRef.current === rememberedConversationId) return;
    activeConversationIdRef.current = rememberedConversationId;
    setActiveConversationId(rememberedConversationId);
  }, [conversations, routeConversationId, routePeerId]);

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
    }).then(async (response) => {
      if (!response.ok || !("serviceWorker" in navigator)) return;
      const result = await response.json().catch(() => null) as { ok?: boolean } | null;
      if (result?.ok !== true) return;
      const registration = await navigator.serviceWorker.getRegistration("/clouds-sw.js");
      registration?.active?.postMessage({ type: "direct-message-read", conversationId: activeConversationId });
    }).catch(() => undefined);
    window.dispatchEvent(new Event("direct-message-read"));

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
      auth: socketAuth,
      withCredentials: true,
      transports: ["polling", "websocket"],
    });

    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("session:ready", () => {
      presenceByUserIdRef.current = {};
      setPresenceByUserId({});
      setConnectionState("connected");
      void loadConversations();
      void loadFollowedUsers();
      const conversationId = activeConversationIdRef.current;
      if (conversationId) {
        socket.emit("conversation:join", { conversationId });
        socket.emit("conversation:read", { conversationId });
        void loadMessages(conversationId);
      }
    });

    socket.on("disconnect", () => { setConnectionState("disconnected"); presenceByUserIdRef.current = {}; setPresenceByUserId({}); setTypingByConversation({}); });
    socket.on("connect_error", () => setConnectionState("disconnected"));

    socket.on("presence:update", (payload: { userId: string; status: "online" | "offline" }) => {
      presenceByUserIdRef.current = {
        ...presenceByUserIdRef.current,
        [payload.userId]: payload.status === "online" ? "online" : "offline",
      };
      setPresenceByUserId(presenceByUserIdRef.current);

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

    socket.on("message:pin:changed", (payload: { conversationId: string; messageId: string; isPinned: boolean }) => {
      setMessagesByConversation((current) => ({
        ...current,
        [payload.conversationId]: (current[payload.conversationId] ?? []).map((message) =>
          message.id === payload.messageId ? { ...message, isPinned: payload.isPinned } : message,
        ),
      }));
      if (activeConversationIdRef.current === payload.conversationId) void loadMessages(payload.conversationId);
    });

    socket.on("message:new", (message: BackendMessage) => {
      window.dispatchEvent(new Event("direct-message-received"));
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

    socket.on("message:reaction:changed", (payload: { conversationId: string; messageId: string; reaction: NonNullable<Msg["reactions"]>[number]; removed: boolean }) => {
      setMessagesByConversation((previous) => ({
        ...previous,
        [payload.conversationId]: (previous[payload.conversationId] || []).map((message) => message.id !== payload.messageId ? message : {
          ...message,
          reactions: payload.removed
            ? (message.reactions ?? []).filter((reaction) => reaction.id !== payload.reaction.id)
            : [...(message.reactions ?? []).filter((reaction) => reaction.id !== payload.reaction.id), payload.reaction],
        }),
      }));
    });

    socket.on("message:edited", (message: BackendMessage) => {
      const mapped = buildMessage(message, user);
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: (prev[message.conversationId] || []).map((m) =>
          m.id === mapped.id ? mapped : m
        ),
      }));
      setPinsByConversation((prev) => ({
        ...prev,
        [message.conversationId]: (prev[message.conversationId] ?? []).map((pin) =>
          pin.id === mapped.id ? mapped : pin,
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
      setPinsByConversation((prev) => {
        const updated: Record<string, Msg[]> = {};
        for (const [convId, pins] of Object.entries(prev)) {
          updated[convId] = pins.filter((message) => message.id !== payload.messageId);
        }
        return updated;
      });
    });

    socket.on("conversation:updated", (conversation: BackendConversation) => {
      const built = buildConversation(conversation, user.id);
      if (!built) return;
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
  }, [status, user, loadConversations, loadFollowedUsers, loadMessages]);

  useEffect(() => {
    messagesContainerRef.current?.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: "smooth" });
  }, [activeMessages, activeConversationId, isActiveConversationTyping, isTypingLocally]);

  const revealConversationMessageTimes = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") messageTimeSwipeStartRef.current = event.clientX;
  }, []);

  const finishRevealConversationMessageTimes = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const start = messageTimeSwipeStartRef.current;
    messageTimeSwipeStartRef.current = null;
    if (event.pointerType !== "touch" || start === null) return;
    const side = getRevealedMessageTimeSide(event.clientX - start);
    if (!side) return;
    setRevealedMessageTimeSide((current) => nextRevealedMessageTimeSide(current, side));
  }, []);

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
    setReplyingTo(null);
    setEditingMsg(null);
    setForwardMsg(null);
    setForwardSelection([]);
    setForwardSelectionMode(false);
    activeConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
    router.push(messagesConversationHref(conversationId), { scroll: false });
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
    setPinsByConversation((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] ?? []).filter((pin) => pin.id !== msg.id),
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
    if (isPrivateCloudInvitation(msg)) return;
    setForwardSelection([msg]);
    setForwardSelectionMode(true);
  }, []);

  const toggleForwardSelection = useCallback((msg: Msg) => {
    if (isPrivateCloudInvitation(msg)) return;
    setForwardSelection((current) => current.some((item) => item.id === msg.id)
      ? current.filter((item) => item.id !== msg.id)
      : [...current, msg]);
  }, []);

  const openForwardModal = useCallback(() => {
    if (!forwardSelection.length) return;
    setForwardMsg(forwardSelection[0]);
    setForwardSelectionMode(false);
  }, [forwardSelection]);

  const handleReaction = useCallback(async (msg: Msg, emoji: string) => {
    if (msg.pending) return;
    try {
      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(msg.conversationId)}/messages/${encodeURIComponent(msg.id)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; message?: string; reaction?: NonNullable<Msg["reactions"]>[number]; removed?: boolean } | null;
      if (!response.ok || !payload?.ok || !payload.reaction) {
        setError(payload?.message || "Não foi possível registrar a reação. Tente novamente.");
        return;
      }
      const reaction = payload.reaction;
      const removed = Boolean(payload.removed);
      setMessagesByConversation((previous) => ({
        ...previous,
        [msg.conversationId]: (previous[msg.conversationId] || []).map((item) => {
          if (item.id !== msg.id) return item;
          return {
            ...item,
            reactions: removed
              ? (item.reactions ?? []).filter((existing) => existing.id !== reaction.id)
              : [...(item.reactions ?? []).filter((existing) => existing.id !== reaction.id), reaction],
          };
        }),
      }));
    } catch {
      setError("Não foi possível conectar ao serviço de mensagens. Tente novamente.");
    }
  }, []);

  const saveSticker = useCallback(async (mediaUrl: string) => {
    try {
      const response = await fetch("/api/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; sticker?: { id: string; mediaUrl: string }; message?: string } | null;
      if (!response.ok || !payload?.sticker) throw new Error(payload?.message || "Não foi possível salvar a figurinha.");
      const savedSticker = payload.sticker;
      setSavedStickers((current) => current.some((sticker) => sticker.mediaUrl === savedSticker.mediaUrl) ? current : [...current, savedSticker]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a figurinha.");
    }
  }, []);

  const togglePinnedMessage = useCallback(async (msg: Msg) => {
    const nextPinned = !msg.isPinned;
    const update = (pinned: boolean) => {
      setMessagesByConversation((current) => ({
        ...current,
        [msg.conversationId]: (current[msg.conversationId] ?? []).map((message) =>
          message.id === msg.id ? { ...message, isPinned: pinned } : message,
        ),
      }));
      setPinsByConversation((current) => {
        const otherPins = (current[msg.conversationId] ?? []).filter((message) => message.id !== msg.id);
        return {
          ...current,
          [msg.conversationId]: pinned ? [{ ...msg, isPinned: true }, ...otherPins] : otherPins,
        };
      });
    };
    update(nextPinned);
    try {
      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(msg.conversationId)}/messages/${encodeURIComponent(msg.id)}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) throw new Error(payload?.message || "Não foi possível atualizar a mensagem fixada.");
    } catch (pinError) {
      update(Boolean(msg.isPinned));
      setError(pinError instanceof Error ? pinError.message : "Não foi possível atualizar a mensagem fixada.");
    }
  }, []);

  const handleReplyMsg = useCallback((msg: Msg) => {
    setEditingMsg(null);
    setReplyingTo(msg);
  }, []);

  const postTextMessage = useCallback(async (message: Msg) => {
    const conversationId = message.conversationId;
    const clientMessageId = message.clientMessageId;
    if (!clientMessageId) return;
    try {
      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message.content, clientMessageId, replyToMessageId: message.replyToMessageId ?? null }),
      });
      const payload = await readJson<{ ok: true; message: BackendMessage }>(response);
      const confirmed = buildMessage(payload.message, user);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], confirmed) }));
      setConversations((prev) => withConfirmedPreview(prev, conversationId, confirmed, message.content));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: markDirectMessageFailed(prev[conversationId] || [], clientMessageId),
      }));
    }
  }, [user]);

  const retryTextMessage = useCallback((message: Msg) => {
    const clientMessageId = message.clientMessageId;
    if (!message.failed || !clientMessageId) return;
    setMessagesByConversation((prev) => ({
      ...prev,
      [message.conversationId]: retryDirectMessage(prev[message.conversationId] || [], clientMessageId),
    }));
    void postTextMessage(message);
  }, [postTextMessage]);

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
      replyToMessageId: replyingTo?.id ?? null,
    };

    setMessagesByConversation((prev) => ({ ...prev, [activeConversationId]: mergeMessage(prev[activeConversationId] || [], optimistic) }));
    setDraft("");

    void postTextMessage(optimistic);
    setReplyingTo(null);
  }, [activeConversationId, draft, isConversationBlocked, postTextMessage, replyingTo, user]);

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

  const requestAudioRecordingDiscard = useCallback(() => {
    if (audioRecorder.state === "recording") audioRecorder.pause();
    setDiscardAudioConfirmationOpen(true);
  }, [audioRecorder]);

  const confirmAudioRecordingDiscard = useCallback(() => {
    audioRecorder.cancel();
    setDiscardAudioConfirmationOpen(false);
  }, [audioRecorder]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      className="flex h-[100dvh] flex-col overflow-hidden overscroll-none text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
                          <ConversationListPreview isTyping={Boolean(typingByConversation[conversation.id])} lastMessage={conversation.lastMessage} />
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
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#000000] ${statusDot[presenceByUserId[followedUser.id] ?? "offline"]}`} />
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

        <main className={`${activeConversationId ? "flex" : "hidden md:flex"} relative min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden md:w-auto`}>
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

          {activeConversationId && (pinsByConversation[activeConversationId] ?? []).map((pinned) => (
            <div key={pinned.id} className="flex items-center gap-3 border-b border-white/[0.07] bg-[#1a0e3d] px-5 py-2">
              <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-[#D8B4FE]">Mensagem fixada</p><p className="truncate text-[13px] text-white/80">{pinned.kind === "audio" ? "Áudio" : pinned.kind === "image" ? "Imagem" : parseForwardedContent(pinned.content).text}</p></div>
              <button type="button" aria-label="Desafixar mensagem" title="Desafixar mensagem" onClick={() => void togglePinnedMessage(pinned)} className="rounded-full px-2 py-1 text-white/70 hover:bg-white/10">×</button>
            </div>
          ))}

          {messageSearch.trim() && (
            <div className="border-b border-white/[0.07] bg-[#1a0e3d] px-5 py-2 text-[12px] text-white/60">
              {filteredMessages.length === 0 
                ? "Nenhuma mensagem encontrada" 
                : `${filteredMessages.length} mensagem${filteredMessages.length !== 1 ? 's' : ''} encontrada${filteredMessages.length !== 1 ? 's' : ''}`
              }
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-purple px-3 pb-1 pt-4 sm:px-8 sm:pb-2 sm:pt-6" ref={messagesContainerRef} onPointerDown={revealConversationMessageTimes} onPointerUp={finishRevealConversationMessageTimes} onPointerCancel={() => { messageTimeSwipeStartRef.current = null; }}>
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
                      <MessageBubble msg={message} showFooter={!continuesNextGroup} showSwipeTime={revealedMessageTimeSide === message.side} showAvatar={!continuesNextGroup} onReply={handleReplyMsg} onEdit={handleEditMsg} onDelete={handleDeleteMsg} onForward={handleForwardMsg} onPin={togglePinnedMessage} onReact={handleReaction} onSaveSticker={saveSticker} onRetry={retryTextMessage} selectionMode={forwardSelectionMode} selected={forwardSelection.some((item) => item.id === message.id)} onToggleSelection={toggleForwardSelection} isPinned={Boolean(message.isPinned)} searchQuery={messageSearch} />
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
                  <p className="truncate text-[12px] text-white/60">{replyPreview(replyingTo)}</p>
                </div>
                <button type="button" aria-label="Cancelar resposta" onClick={() => setReplyingTo(null)} className="text-white/40 transition hover:text-white">×</button>
              </div>
            </div>
          )}

          <div ref={composerFooterRef} className="relative z-30 shrink-0 overscroll-none border-t border-white/[0.07] bg-[#000000] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            <div className="relative flex flex-col gap-2 rounded-full border border-white/[0.08] bg-[#1a0e3d] px-5 py-3">
              {emojiOpen && (
                <div data-emoji-picker="true" className="absolute bottom-[calc(100%+8px)] left-1/2 z-10 w-[calc(100vw-2rem)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-[22px] border border-white/10 bg-[#11141F] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                  <div className="grid grid-cols-2 gap-1 border-b border-white/[0.07] p-2"><button type="button" onClick={() => setMediaPickerTab("emoji")} className={`rounded-xl py-2 text-[13px] font-semibold ${mediaPickerTab === "emoji" ? "bg-white/10 text-white" : "text-white/45"}`}>😊 Emojis</button><button type="button" onClick={() => setMediaPickerTab("sticker")} className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold ${mediaPickerTab === "sticker" ? "bg-white/10 text-white" : "text-white/45"}`}><StickerIcon />Figurinhas</button></div>
                  {mediaPickerTab === "sticker" ? <div className="max-h-[28vh] overflow-y-auto p-3"><div className="mb-2 flex items-center justify-between"><p className="text-[12px] font-semibold text-white/60">Figurinhas do Clouds</p><span className="text-[11px] text-white/40">{savedStickers.length} {savedStickers.length === 1 ? "figurinha" : "figurinhas"}</span></div>{savedStickers.length ? <div className="grid w-full max-w-[560px] grid-cols-5 gap-3">{savedStickers.map((sticker) => <button key={sticker.id} type="button" onClick={() => { void fetch(sticker.mediaUrl).then((response) => response.blob()).then((blob) => handleImageFile(new File([blob], "figurinha.webp", { type: blob.type || "image/webp" }), true, sticker.mediaUrl)); setEmojiOpen(false); }} className="aspect-square w-full overflow-hidden rounded-xl p-0 transition hover:bg-white/10"><img src={sticker.mediaUrl} alt="Figurinha" className={`h-full w-full object-contain ${sticker.mediaUrl.includes("/api/stickers/system/") ? "scale-125" : "scale-100"}`} /></button>)}</div> : <p className="py-4 text-center text-sm text-white/40">Ainda não há figurinhas disponíveis.</p>}</div> : <>
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
                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-black px-2 py-2.5 sm:flex-nowrap sm:rounded-full sm:px-4">
                  <div className="min-w-0 flex-1 text-[12px] text-white sm:text-[14px]" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {audioRecorder.state === "paused" ? "Pausado" : "Gravando…"} {formatDuration(audioRecorder.seconds * 1000) || "0:00"}
                  </div>
                  <div className="block min-w-0"><Waveform active={audioRecorder.state === "recording"} paused={audioRecorder.state === "paused"} progress={audioRecorder.seconds} /></div>
                  <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                    <button type="button" aria-label={audioRecorder.state === "paused" ? "Retomar" : "Pausar"} onClick={audioRecorder.state === "paused" ? audioRecorder.resume : audioRecorder.pause}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white hover:bg-white/10 transition">
                      {audioRecorder.state === "paused" ? <PlayIcon s={16} /> : <PauseIcon s={16} />}
                    </button>
                    <button type="button" aria-label="Enviar áudio" onClick={stopAudioRecording}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition">
                      <SendIcon />
                    </button>
                    <button type="button" aria-label="Excluir gravação" onClick={requestAudioRecordingDiscard}
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
                    <textarea
                      name="direct-message"
                      autoComplete="off"
                      inputMode="text"
                      rows={1}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onInput={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`; }}
                      onKeyDown={handleKeyDown}
                      placeholder={isConversationBlocked ? "Envio de mensagens indisponível" : activeConversationId ? "Mensagem..." : "Selecione uma conversa para começar"}
                      disabled={!activeConversationId || isAudioBusy || isConversationBlocked}
                      className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent text-[15px] text-white placeholder:text-white outline-none [overflow-wrap:anywhere] disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ maxHeight: 120, fieldSizing: "content" }}
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

      {discardAudioConfirmationOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="discard-audio-title">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#171821] p-5 shadow-2xl">
            <h2 id="discard-audio-title" className="text-[17px] font-bold text-white">Excluir gravação?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/65">A gravação foi pausada. Você pode continuar de onde parou ou descartá-la permanentemente.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { audioRecorder.resume(); setDiscardAudioConfirmationOpen(false); }} className="rounded-full px-4 py-2.5 text-[13px] font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white">Continuar gravando</button>
              <button type="button" onClick={confirmAudioRecordingDiscard} className="rounded-full bg-red-500 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-red-600">Excluir gravação</button>
            </div>
          </div>
        </div>
      )}

      {forwardSelectionMode && <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 mx-auto flex w-auto max-w-[calc(100vw-1.5rem)] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#15161C]/95 px-3 py-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:w-fit sm:max-w-none md:bottom-6 md:gap-3 md:rounded-full md:px-4">
        <span className="text-center text-sm font-semibold text-white">{forwardSelection.length} selecionada{forwardSelection.length === 1 ? "" : "s"}<span className="hidden sm:inline"> · toque nos círculos para selecionar mais</span></span>
        <button type="button" onClick={() => { setForwardSelection([]); setForwardSelectionMode(false); }} className="rounded-full px-3 py-1.5 text-sm text-white/70 hover:bg-white/10">Cancelar</button>
        <button type="button" disabled={!forwardSelection.length} onClick={openForwardModal} className="rounded-full bg-[#9333EA] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Encaminhar</button>
      </div>}

      {/* ── Forward modal ── */}
      {forwardMsg && (
        <ForwardToContactModal title="Encaminhar mensagem" preview={forwardMsg.kind === "text" ? forwardMsg.content : forwardMsg.kind === "audio" ? "Mensagem de áudio" : forwardMsg.kind === "image" ? "Imagem" : "Link"} url={forwardMsg.linkUrl ?? (typeof window !== "undefined" ? window.location.href : "")} label={forwardMsg.kind === "text" ? forwardMsg.content : forwardMsg.kind === "link" ? replyPreview(forwardMsg) : "Mensagem encaminhada"} messageContent={forwardMsg.kind === "text" ? forwardMsg.content : undefined} mediaKind={forwardMsg.kind === "audio" || forwardMsg.kind === "image" ? forwardMsg.kind : undefined} mediaUrl={forwardMsg.kind === "audio" || forwardMsg.kind === "image" ? forwardMsg.mediaUrl : undefined} mediaDurationMs={forwardMsg.kind === "audio" ? forwardMsg.durationMs : undefined} mediaFileName={forwardMsg.kind === "audio" || forwardMsg.kind === "image" ? forwardMsg.mediaFileName : undefined} forwarded={forwardMsg.side !== "right"} items={forwardSelection.map((message) => ({ preview: message.kind === "text" ? message.content : undefined, url: message.linkUrl ?? (typeof window !== "undefined" ? window.location.href : ""), label: message.kind === "text" ? message.content : message.kind === "link" ? replyPreview(message) : "Mensagem encaminhada", messageContent: message.kind === "text" ? message.content : undefined, mediaKind: message.kind === "audio" || message.kind === "image" ? message.kind : undefined, mediaUrl: message.kind === "audio" || message.kind === "image" ? message.mediaUrl : undefined, mediaDurationMs: message.kind === "audio" ? message.durationMs : undefined, mediaFileName: message.kind === "audio" || message.kind === "image" ? message.mediaFileName : undefined, cloudOrigin: parseForwardedContent(message.content).origin ?? undefined, forwardedOrigin: parseForwardedContent(message.content).origin ? "cloud" : undefined, forwarded: message.side !== "right" }))} contacts={forwardContacts} loading={loadingConversations || loadingFollowed} onClose={() => { setForwardMsg(null); setForwardSelection([]); }} />
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
