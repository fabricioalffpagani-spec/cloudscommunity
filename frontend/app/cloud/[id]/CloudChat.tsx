"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { socketAuth } from "../../lib/socket-auth";

import { FlameIcon } from "../../components/FlameIcon";
import { UserAvatar, getSessionUserDisplayName, useSessionUser } from "../../components/session-user";
import { ArrowLeftIcon, CheckIcon, MicIcon, PauseIcon, PlayIcon, PlusIcon, SendIcon, TrashIcon } from "../../components/ui-icons";
import { AudioWaveformPlayer } from "../../components/AudioWaveformPlayer";
import { CloudSystemMessage } from "../../components/CloudSystemMessage";
import { ForwardToContactModal } from "../../components/ForwardToContactModal";
import { GuestCloudSignupModal } from "../../components/GuestCloudSignupModal";
import { useComposerPanLock } from "../../lib/composer-pan-lock";
import { buildMentionCandidates } from "../../lib/mention-candidates";

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
type CloudMention = { userId: string; username: string; start: number; end: number };

type CloudMessagePayload = {
  id: string;
  cloudId: string;
  senderId: string;
  type: "text" | "audio" | "image" | "link" | "system";
  content: string | null;
  mentions: CloudMention[];
  mediaUrl: string | null;
  isSticker: boolean;
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
  joinOnEntry?: boolean;
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
  peaks?: number[];
};

type RecorderState = "idle" | "recording" | "paused";

type ChatMessage = {
  id: string;
  cloudId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  side: "left" | "right";
  kind: "text" | "audio" | "image" | "link" | "system";
  content: string;
  mentions?: CloudMention[];
  mediaUrl: string | null;
  isSticker?: boolean;
  replyTo: {
    id: string;
    sender: string;
    content: string | null;
  } | null;
  reactions: ReactionPayload[];
  time: string;
  isoTime: string;
  updatedAt?: string;
  pending?: boolean;
  clientMessageId?: string | null;
  audioDurationMs?: number | null;
  audioPeaks?: number[] | null;
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
  {
    label: "Pessoas",
    icon: "🧑",
    emojis: [
      "👶","🧒","👦","👧","🧑","👱","👨","🧔","👨‍🦰","👨‍🦱","👨‍🦳","👨‍🦲","👩","👩‍🦰","👩‍🦱","👩‍🦳","👩‍🦲","🧓","👴","👵",
      "🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","🧑‍⚕️","🧑‍🎓","🧑‍🏫","🧑‍⚖️","🧑‍🌾","🧑‍🍳","🧑‍🔧","🧑‍🏭","🧑‍💼","🧑‍🔬",
      "🧑‍💻","🧑‍🎤","🧑‍🎨","🧑‍✈️","🧑‍🚀","🧑‍🚒","👮","🕵️","💂","🥷","👷","🤴","👸","👳","👲","🧕","🤵","👰","🤰","🤱",
      "👨‍👩‍👧","👨‍👩‍👦","👩‍👩‍👦","👨‍👨‍👧","🐶","🐱","🦸","🦹","🧙","🧚","🧛","🧜","🧝","🧞","🧟","💃","🕺","👯","🧖","🛀",
    ],
  },
  {
    label: "Símbolos",
    icon: "💟",
    emojis: [
      "✅","☑️","✔️","❌","❎","➕","➖","➗","✖️","💲","💱","™️","©️","®️","〰️","➰","➿","🔚","🔙","🔛","🔝","🔜","☑️","🔘","⚪",
      "⚫","🔴","🔵","🟢","🟡","🟠","🟣","🟤","⬛","⬜","◼️","◻️","◾","◽","▪️","▫️","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔳","🔲",
      "⚠️","🚫","⛔","📛","🚷","🚯","🚳","🚱","🔞","☢️","☣️","⬆️","↗️","➡️","↘️","⬇️","↙️","⬅️","↖️","↕️","↔️","🔄","🔃","🔀","🔁",
      "🔂","▶️","⏸️","⏹️","⏺️","⏭️","⏮️","⏩","⏪","🔼","🔽","🎵","🎶","〽️","⚕️","♻️","⚜️","🔱","⚜️","🛐","☮️","☯️","✝️","☪️","🕉️",
    ],
  },
  {
    label: "Bandeiras",
    icon: "🏳️",
    emojis: [
      "🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🇧🇷","🇵🇹","🇦🇷","🇺🇾","🇨🇱","🇨🇴","🇲🇽","🇺🇸","🇨🇦","🇬🇧","🇫🇷","🇩🇪","🇮🇹","🇪🇸","🇳🇱","🇧🇪","🇨🇭","🇸🇪",
      "🇳🇴","🇩🇰","🇫🇮","🇮🇪","🇵🇱","🇺🇦","🇷🇺","🇯🇵","🇰🇷","🇨🇳","🇮🇳","🇹🇭","🇻🇳","🇮🇩","🇦🇺","🇳🇿","🇿🇦","🇳🇬","🇪🇬","🇲🇦","🇹🇷","🇮🇱","🇸🇦","🇦🇪","🇺🇳",
    ],
  },
];

// Start with the full library instead of a small subset. The category tabs
// remain available for people who prefer to browse by subject.
EMOJI_CATEGORIES.unshift({
  label: "Todos",
  icon: "✨",
  emojis: [...new Set(EMOJI_CATEGORIES.flatMap((category) => category.emojis))],
});

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
        audioPeaks: next.audioPeaks ?? item.audioPeaks ?? null,
      };
    });
  }

  if (list.some((item) => item.id === next.id)) {
    return list;
  }

  return [...list, next];
}

function shiftMentions(mentions: CloudMention[], previous: string, next: string): CloudMention[] {
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < previous.length - prefix && suffix < next.length - prefix && previous[previous.length - suffix - 1] === next[next.length - suffix - 1]) suffix += 1;
  const changedEnd = previous.length - suffix;
  const delta = next.length - previous.length;
  return mentions.flatMap((mention) => {
    const shifted = mention.end <= prefix ? mention : mention.start >= changedEnd ? { ...mention, start: mention.start + delta, end: mention.end + delta } : null;
    return shifted && next.slice(shifted.start, shifted.end) === `@${shifted.username}` ? [shifted] : [];
  });
}

function MentionedText({ content, mentions = [] }: { content: string; mentions?: CloudMention[] }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    if (mention.start < cursor || content.slice(mention.start, mention.end) !== `@${mention.username}`) continue;
    parts.push(content.slice(cursor, mention.start));
    parts.push(<Link key={`${mention.userId}:${mention.start}`} href={`/users/${encodeURIComponent(mention.userId)}`} className="font-bold text-[#E9D5FF] hover:underline">@{mention.username}</Link>);
    cursor = mention.end;
  }
  parts.push(content.slice(cursor));
  return <>{parts}</>;
}

function normalizeMessage(payload: CloudMessagePayload, currentUserId?: string | null): ChatMessage {
  const isOwn = Boolean(currentUserId && payload.senderId === currentUserId);
  const isSystem = payload.type === 'system';

  return {
    id: payload.id,
    cloudId: payload.cloudId,
    senderId: payload.senderId,
    senderName: payload.sender.displayName || payload.sender.username || "Usuário",
    senderAvatarUrl: payload.sender.avatarUrl,
    side: isSystem ? "left" : isOwn ? "right" : "left",
    kind: payload.type,
    content: payload.content || "",
    mentions: payload.mentions || [],
    mediaUrl: payload.mediaUrl,
    isSticker: payload.isSticker,
    replyTo: payload.replyTo,
    reactions: payload.reactions || [],
    time: timeLabel(payload.createdAt),
    isoTime: payload.createdAt,
    updatedAt: payload.updatedAt,
    clientMessageId: payload.clientMessageId,
    audioDurationMs: (payload as { audioDurationMs?: number | null }).audioDurationMs ?? null,
    audioPeaks: (payload as { peaks?: number[] | null }).peaks ?? null,
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
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="overflow-visible transition-transform duration-200 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]">
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
  const [state, setState] = useState<RecorderState>("idle");
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
    if (!recorder || recorder.state !== "recording") {
      return;
    }

    recorder.pause();
    stopTimers();
    stopSampler();
    setState("paused");
  }, [stopTimers, stopSampler]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") {
      return;
    }

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
    <div className="flex items-end gap-[2px] sm:gap-[3px]" style={{ height: 32 }}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={`block w-[4px] rounded-full transition-all duration-150 ease-out ${i > 11 ? "hidden sm:block" : ""}`}
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
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={pinned ? "2.5" : "2.2"} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4h6" />
      <path d="M10 4v5l-3 3v2h10v-2l-3-3V4" />
      <path d="M12 14v6" />
    </svg>
  );
}

function CloudEmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function CloudReplyIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function CloudMsgMenu({
  msg,
  isRight,
  isCloudAuthor,
  isPinned,
  openUpward,
  onPin,
  onForward,
  onEdit,
  onDelete,
  onReport,
  onSaveSticker,
  onReply,
  onClose,
}: {
  msg: ChatMessage;
  isRight: boolean;
  isCloudAuthor: boolean;
  isPinned: boolean;
  openUpward: boolean;
  onPin: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  onReport: (msg: ChatMessage) => void;
  onSaveSticker: (mediaUrl: string) => void;
  onReply: (msg: ChatMessage) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const isOwn = isRight;


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

  const items: { key: string; label: string; action: () => void; danger?: boolean; show: boolean; icon: ReactNode }[] = [
    {
      key: "reply",
      label: "Responder",
      action: () => { onReply(msg); onClose(); },
      show: true,
      icon: <CloudReplyIcon />,
    },
    {
      key: "copy",
      label: copied ? "Copiado!" : "Copiar",
      action: handleCopy,
      show: Boolean(textContent),
      icon: <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
    },
    {
      key: "translate",
      label: translating ? "Traduzindo…" : translated ? "Traduzido ✓" : "Traduzir",
      action: () => void handleTranslate(),
      show: Boolean(textContent),
      icon: <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>,
    },
    {
      key: "forward",
      label: "Encaminhar",
      action: () => { onForward(msg); onClose(); },
      show: true,
      icon: <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>,
    },
    {
      key: "save-sticker",
      label: "Salvar figurinha",
      action: () => { if (msg.mediaUrl) onSaveSticker(msg.mediaUrl); onClose(); },
      show: Boolean(msg.isSticker && msg.mediaUrl),
      icon: <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>,
    },
    {
      key: "edit",
      label: "Editar",
      action: () => { onEdit(msg); onClose(); },
      show: isOwn && msg.kind === "text",
      icon: <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
    },
    {
      key: "unsend",
      label: "Cancelar envio",
      action: () => { onDelete(msg); onClose(); },
      danger: true,
      show: isOwn,
      icon: <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>,
    },
    {
      key: "pin",
      label: isPinned ? "Desafixar" : "Fixar mensagem",
      action: () => { onPin(msg); onClose(); },
      show: !isOwn && isCloudAuthor,
      icon: <CloudPinIcon pinned={isPinned} />,
    },
    {
      key: "report",
      label: "Denunciar",
      action: () => { onReport(msg); onClose(); },
      danger: true,
      show: !isOwn,
      icon: <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
    },
  ];

  return (
    <div
      data-message-menu="true"
      className={`absolute z-50 min-w-[168px] rounded-2xl border border-white/[0.08] bg-[#15161C] py-1 shadow-2xl shadow-black/60 ${isRight ? "right-0" : "left-0"}`}
      style={openUpward ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }}
    >
      {translated && (
        <div className="border-b border-white/[0.06] px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">Tradução</p>
          <p className="text-[13px] text-white leading-snug">{translated}</p>
        </div>
      )}
      {items.filter((item) => item.show).map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.action}
          disabled={translating && item.key === "translate"}
          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition hover:bg-white/[0.06] disabled:opacity-50 ${item.danger ? "text-red-400 hover:text-red-300" : "text-white/80 hover:text-white"}`}
        >
          <span className={item.danger ? "text-red-400" : "text-white/50"}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
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

/* Balão iMessage com animação de entrada/saída */
function TypingBubble({ avatars, exiting }: { avatars: Array<{ id: string; name: string; avatarUrl: string | null }>; exiting?: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${exiting ? "typing-bubble-exit" : "typing-bubble-enter"}`} style={{ transformOrigin: "left bottom" }}>
      {/* Avatars empilhados */}
      <div className="flex -space-x-2 shrink-0">
        {avatars.slice(0, 3).map((p) => (
          <Link key={p.id} href={`/users/${encodeURIComponent(p.id)}`} aria-label={`Ver perfil de ${p.name}`}>
            <UserAvatar
              user={{ id: p.id, username: p.id, displayName: p.name, avatarUrl: p.avatarUrl }}
              size={26}
            />
          </Link>
        ))}
      </div>
      {/* Balão preto com bolinhas */}
      <div
        className="flex items-center gap-1 rounded-[18px] rounded-bl-[4px] px-4 py-[10px] bg-black"
      >
        <TypingDots />
      </div>
    </div>
  );
}

function AudioBubble({ msg, own }: { msg: ChatMessage; own?: boolean }) {
  if (!msg.mediaUrl) {
    return (
      <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`} style={{ minWidth: 220 }}>
        <span className="text-[12px] text-white/60">Áudio indisponível</span>
      </div>
    );
  }
  return (
    <AudioWaveformPlayer
      src={msg.mediaUrl}
      peaks={msg.audioPeaks ?? undefined}
      durationMs={msg.audioDurationMs ?? null}
      isOwn={Boolean(own)}
      roundedCorner={own ? "right" : "left"}
    />
  );
}

function ImageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className={`relative ${msg.isSticker ? "mb-4 mt-4 w-fit" : ""}`}>
    <div className={msg.isSticker ? "block overflow-visible border-0 bg-transparent" : "block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a0e3d]"}>
      {msg.mediaUrl ? (
        <img src={msg.mediaUrl} alt={msg.isSticker ? "Figurinha enviada" : "Imagem enviada"} className={msg.isSticker ? "h-36 w-36 object-contain" : "max-h-[320px] max-w-full object-contain"} />
      ) : (
        <div className="px-4 py-8 text-[14px] text-white/50">Imagem indisponível</div>
      )}
    </div>
    </div>
  );
}

async function makeStickerFile(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
      nextImage.src = sourceUrl;
    });
    // Stickers render at 144 CSS px. On common 3x mobile screens, 320 px
    // source images are upscaled and look soft. Keep enough source detail for
    // those displays while still bounding upload size.
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 512 / longestSide);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a figurinha.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível criar a figurinha.")), "image/webp", 0.92));
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "figurinha"}.webp`, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

type ReportNotifPayload = {
  cloudId: string;
  reportedId: string;
  reportedName: string;
  reportedUsername: string;
  reportedAvatarUrl: string | null;
  messageId: string | null;
  messageContent: string | null;
  reasons: string[];
};

function ReportNotificationModal({
  cloudId,
  report,
  onBan,
  onClose,
}: {
  cloudId: string;
  report: ReportNotifPayload;
  onBan: (userId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [confirmBan, setConfirmBan] = useState(false);
  const [banning, setBanning] = useState(false);

  const handleBan = async () => {
    setBanning(true);
    await onBan(report.reportedId);
    setBanning(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end p-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#15161C] shadow-2xl shadow-black/70 overflow-hidden animate-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-red-500/[0.08] px-4 py-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            <span className="text-[13px] font-semibold text-red-400">Nova denúncia recebida</span>
          </div>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="p-4 space-y-3">
          {/* Perfil denunciado */}
          <div className="flex items-center gap-3">
            <UserAvatar
              user={{ id: report.reportedId, username: report.reportedUsername, displayName: report.reportedName, avatarUrl: report.reportedAvatarUrl }}
              size={40}
            />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-white">{report.reportedName}</p>
              <p className="truncate text-[12px] text-white/40">@{report.reportedUsername}</p>
            </div>
          </div>

          {/* Mensagem denunciada */}
          {report.messageContent && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-1">Mensagem denunciada</p>
              <p className="text-[13px] text-white/80 leading-snug line-clamp-3">{report.messageContent}</p>
            </div>
          )}

          {/* Motivos */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">Motivos</p>
            <div className="flex flex-wrap gap-1.5">
              {report.reasons.map((r) => (
                <span key={r} className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-400">{r}</span>
              ))}
            </div>
          </div>

          {/* Confirmação de ban */}
          {confirmBan ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3 space-y-3">
              <p className="text-[13px] text-white/80 leading-snug">
                Deseja banir <span className="font-semibold text-white">@{report.reportedUsername || report.reportedName}</span> da Cloud? Após o banimento, o usuário não poderá mais acessar esta Cloud.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmBan(false)}
                  className="flex-1 rounded-full bg-white/[0.06] py-2 text-[13px] text-white/70 transition hover:bg-white/[0.12]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleBan()}
                  disabled={banning}
                  className="flex-1 rounded-full bg-red-500 py-2 text-[13px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {banning ? "Banindo…" : "Confirmar"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmBan(true)}
              className="w-full rounded-full bg-red-500/20 py-2.5 text-[13px] font-semibold text-red-400 transition hover:bg-red-500/30 hover:text-red-300"
            >
              Banir usuário
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportModal({
  cloudId,
  msg,
  onClose,
}: {
  cloudId: string;
  msg: { id: string; senderId: string; senderName: string; senderAvatarUrl: string | null; content: string | null };
  onClose: () => void;
}) {
  const REASONS = [
    "Spam ou publicidade",
    "Discurso de ódio",
    "Assédio ou bullying",
    "Conteúdo violento ou perturbador",
    "Informação falsa",
    "Conteúdo sexual inapropriado",
    "Ameaças",
    "Outro",
  ];

  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (reason: string) => {
    setSelected((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason],
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0 || sending) return;
    setSending(true);
    try {
      await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportedId: msg.senderId, messageId: msg.id, messageContent: msg.content, reasons: selected }),
      });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15161C] p-6 shadow-2xl">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-[15px] font-semibold text-white">Denúncia enviada</p>
            <p className="text-center text-[13px] text-white/50">Sua denúncia é anônima e será revisada pelo criador da Cloud.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[17px] font-bold text-white">Denunciar mensagem</h3>
                <p className="text-[12px] text-white/40 mt-0.5">de {msg.senderName} · anônimo</p>
              </div>
              <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <p className="mb-3 text-[13px] text-white/60">Selecione os motivos:</p>
            <div className="space-y-2 mb-5">
              {REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggle(reason)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] transition ${
                    selected.includes(reason)
                      ? "border-[#A855F7] bg-[#A855F7]/10 text-white"
                      : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected.includes(reason) ? "border-[#A855F7] bg-[#A855F7]" : "border-white/30"}`}>
                    {selected.includes(reason) && (
                      <svg viewBox="0 0 12 12" width={9} height={9} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="10 3 5 9 2 6"/></svg>
                    )}
                  </span>
                  {reason}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={selected.length === 0 || sending}
              className="w-full rounded-full bg-red-500 py-2.5 text-[14px] font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Enviar denúncia"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CloudMessageBubble({
  msg,
  onReact,
  onShowReactions,
  onReply,
  onPin,
  onForward,
  onEdit,
  onDelete,
  onReport,
  onSaveSticker,
  isCloudAuthor,
  isPinned,
  grouped = false,
  showFooter = true,
}: {
  msg: ChatMessage;
  onReact: (messageId: string, emoji: string) => void;
  onShowReactions: (msg: ChatMessage, emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
  onPin: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  onReport: (msg: ChatMessage) => void;
  onSaveSticker: (mediaUrl: string) => void;
  isCloudAuthor: boolean;
  isPinned: boolean;
  grouped?: boolean;
  showFooter?: boolean;
}) {
  const own = msg.side === "right";
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [msgMenuOpen, setMsgMenuOpen] = useState(false);
  const [menuOpenUpward, setMenuOpenUpward] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const openedByLongPressRef = useRef(false);

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  useEffect(() => {
    setMsgMenuOpen(false);
    cancelLongPress();
  }, [msg.id, msg.cloudId]);

  useEffect(() => {
    if (!msgMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuAnchorRef.current?.contains(event.target as Node)) setMsgMenuOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMsgMenuOpen(false);
    };
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== msg.id) setMsgMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("clouds:message-menu-open", closeOther);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("clouds:message-menu-open", closeOther);
    };
  }, [msgMenuOpen, msg.id]);
  const groupedReactions = useMemo(() => {
    return msg.reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    }, {} as Record<string, ReactionPayload[]>);
  }, [msg.reactions]);

  function openMsgMenu() {
    if (menuAnchorRef.current) {
      const rect = menuAnchorRef.current.getBoundingClientRect();
      setMenuOpenUpward(window.innerHeight - rect.bottom < 220);
    }
    setMsgMenuOpen(true);
    document.dispatchEvent(new CustomEvent("clouds:message-menu-open", { detail: msg.id }));
  }

  function closeMsgMenu() {
    setMsgMenuOpen(false);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    pressStartRef.current = null;
  }

  function handleMessagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || (event.target instanceof Element && event.target.closest("[data-message-menu]"))) return;
    cancelLongPress();
    openedByLongPressRef.current = false;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = setTimeout(() => {
      openedByLongPressRef.current = true;
      openMsgMenu();
    }, 900);
  }

  function handleMessagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = pressStartRef.current;
    if (event.pointerType === "touch" && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) cancelLongPress();
  }

  function handleMessagePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    cancelLongPress();
    if (openedByLongPressRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <div
      className={`group flex touch-manipulation select-none items-end gap-2.5 [-webkit-touch-callout:none] md:select-text ${grouped ? "mt-0.5" : "mt-3"} ${own ? "flex-row-reverse" : "flex-row"}`}
      onPointerDown={handleMessagePointerDown}
      onPointerMove={handleMessagePointerMove}
      onPointerUp={handleMessagePointerEnd}
      onPointerCancel={cancelLongPress}
      onClickCapture={(event) => { if (openedByLongPressRef.current) { event.preventDefault(); event.stopPropagation(); openedByLongPressRef.current = false; } }}
      onContextMenu={(event) => { if (!(event.target instanceof Element && event.target.closest("[data-message-menu]"))) { event.preventDefault(); openMsgMenu(); } }}
    >
      {/* Avatar — mb compensa a action row abaixo do bubble para alinhar ao fundo do balão */}
      {showFooter && !own && <Link href={`/users/${encodeURIComponent(msg.senderId)}`} aria-label={`Ver perfil de ${msg.senderName}`} className="mb-6 w-9 shrink-0">
        <UserAvatar
          user={{ id: msg.senderId, username: msg.senderId, displayName: msg.senderName, avatarUrl: msg.senderAvatarUrl }}
          size={34}
        />
      </Link>}
      {!showFooter && !own && <div aria-hidden="true" className="w-9 shrink-0" />}

      <div className={`flex min-w-0 max-w-[calc(100%_-_2.75rem)] items-end gap-2 sm:max-w-[74%] ${own ? "flex-row-reverse" : "flex-row"}`}>
        <div className={`flex min-w-0 flex-col gap-1.5 ${own ? "items-end" : "items-start"}`}>
          {!grouped && <div className={`flex items-center gap-2 px-1 ${own ? "flex-row-reverse" : ""}`}>
            <Link href={`/users/${encodeURIComponent(msg.senderId)}`} className="text-[12px] font-semibold text-white/40 transition hover:text-white hover:underline">{own ? "Você" : msg.senderName}</Link>
            {isPinned && <span className="flex items-center gap-1 text-[10px] text-[#A855F7]"><CloudPinIcon pinned={true} /> fixada</span>}
          </div>}

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
            <div className={`break-words rounded-2xl px-4 py-3 text-[14px] leading-relaxed text-white [overflow-wrap:anywhere] ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
              {msg.content}
            </div>
          ) : (
            <div className={`break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-white [overflow-wrap:anywhere] ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
              <MentionedText content={msg.content} mentions={msg.mentions} />
              {msg.pending && <span className="ml-2 text-[11px] text-white/50">enviando...</span>}
            </div>
          )}

          {/* Reactions */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className={`flex flex-wrap gap-1 px-1 ${own ? "justify-end" : ""}`}>
              {Object.entries(groupedReactions).map(([emoji, reactions]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onShowReactions(msg, emoji)}
                  className="rounded-full bg-white/10 px-2 py-1 text-[12px] transition hover:bg-white/20"
                  title={`${reactions.length} reação(ões) com ${emoji}`}
                >
                  <span>{emoji}</span>
                  <span className="ml-1 text-white/70">{reactions.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* Message actions row */}
          <div className={`flex items-center gap-1 px-1 ${own ? "flex-row-reverse" : ""}`}>
            {showFooter && <div className={`flex items-center gap-1 text-[11px] text-white/30 ${own ? "flex-row-reverse" : ""}`}>
              <span>{msg.time}</span>
              {msg.updatedAt && msg.updatedAt !== msg.isoTime && <span className="italic">editada</span>}
              {own && !msg.pending && <MessageReceipt />}
            </div>}
            <div ref={menuAnchorRef} className="relative">
              {msgMenuOpen && <CloudMsgMenu msg={msg} isRight={own} isCloudAuthor={isCloudAuthor} isPinned={isPinned} openUpward={menuOpenUpward} onPin={onPin} onForward={onForward} onEdit={onEdit} onDelete={onDelete} onReport={onReport} onSaveSticker={onSaveSticker} onReply={onReply} onClose={closeMsgMenu} />}
            </div>
          </div>
        </div>

        {/* Action icons aligned to the side of message box */}
        <div className={`hidden items-center gap-1.5 self-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 md:flex ${own ? "ml-2" : "mr-2"}`}>
          <button type="button" title="Responder" onClick={() => onReply(msg)} className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/15"><CloudReplyIcon /></button>
          {isCloudAuthor && (
            <button
              type="button"
              title={isPinned ? "Desafixar" : "Fixar mensagem"}
              onClick={() => onPin(msg)}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/15 ${isPinned ? "text-[#A855F7]" : "text-white"}`}
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
              disabled={msg.pending}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CloudEmojiIcon />
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
          <button type="button" title="Mais opções" onClick={openMsgMenu} className="flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none text-white transition hover:bg-white/15">⋮</button>
        </div>
      </div>
    </div>
  );
}

export default function CloudChat({ cloudId, title, duration, createdAt, visibility, joinOnEntry = false }: CloudChatProps) {
  const { user, status } = useSessionUser();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const targetScrolledRef = useRef(false);
  const composerFooterRef = useComposerPanLock();
  const hasJoinedRef = useRef(false);
  const messagesLoadRequestRef = useRef(0);
  const audioRecorder = useAudioRecorder((recording) => {
    void handleAudioRecordingStop(recording);
  });

  const [cloud, setCloud] = useState<ReturnType<typeof normalizeCloud> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [draftMentions, setDraftMentions] = useState<CloudMention[]>([]);
  const [caretIndex, setCaretIndex] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stickerSaveNotice, setStickerSaveNotice] = useState<string | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [mediaPickerTab, setMediaPickerTab] = useState<"emoji" | "sticker">("emoji");
  const [hyped, setHyped] = useState(false);
  const [hypesCount, setHypesCount] = useState(0);
  const [hypeUsers, setHypeUsers] = useState<Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }>>([]);
  const [hypeListOpen, setHypeListOpen] = useState(false);
  const [reactionDetailsMessage, setReactionDetailsMessage] = useState<ChatMessage | null>(null);
  const [reactionDetailsEmoji, setReactionDetailsEmoji] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contacts, setContacts] = useState<PublicUserProfile[]>([]);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [typingUserIds, setTypingUserIds] = useState<Record<string, boolean>>({});
  const [isLocallyTyping, setIsLocallyTyping] = useState(false);
  const [typingExiting, setTypingExiting] = useState(false);
  const typingExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<{ name: string } | null>(null);
  const [imageFormatOpen, setImageFormatOpen] = useState(false);
  const [savedStickers, setSavedStickers] = useState<Array<{ id: string; mediaUrl: string }>>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [guestSignupOpen, setGuestSignupOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [titleLongPressTimer, setTitleLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isTitleLongPress, setIsTitleLongPress] = useState(false);
  const [isUpdatingHype, setIsUpdatingHype] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const [isBanningMemberId, setIsBanningMemberId] = useState<string | null>(null);
  const [reportingMsg, setReportingMsg] = useState<ChatMessage | null>(null);
  const [cloudReports, setCloudReports] = useState<Array<{ id: string; reportedId: string; reportedName: string; reportedUsername: string; reportedAvatarUrl: string | null; messageId: string | null; messageContent: string | null; reasons: string[]; count: number }>>([]);
  const [reportNotifCount, setReportNotifCount] = useState(0);
  const [incomingReport, setIncomingReport] = useState<{
    cloudId: string;
    reportedId: string;
    reportedName: string;
    reportedUsername: string;
    reportedAvatarUrl: string | null;
    messageId: string | null;
    messageContent: string | null;
    reasons: string[];
  } | null>(null);
  const [banConfirmOpen, setBanConfirmOpen] = useState(false);
  const [banConfirmUsername, setBanConfirmUsername] = useState("");
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const activeCloudIdRef = useRef(cloudId);
  const outgoingTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTypingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const minimizingRef = useRef(false);
  const leftOnMobileExitRef = useRef(false);

  useEffect(() => {
    activeCloudIdRef.current = cloudId;
    targetScrolledRef.current = false;
    const minimized = window.localStorage.getItem("clouds:minimized-cloud");
    if (minimized) {
      try {
        if (JSON.parse(minimized).id === cloudId) {
          window.localStorage.removeItem("clouds:minimized-cloud");
          window.dispatchEvent(new Event("clouds:minimized-cloud-changed"));
        }
      } catch { /* ignore invalid persisted state */ }
    }
  }, [cloudId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
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

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
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

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenuOpen]);

  useEffect(() => {
    return () => {
      if (titleLongPressTimer) {
        clearTimeout(titleLongPressTimer);
      }
    };
  }, [titleLongPressTimer]);

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
    const requestId = ++messagesLoadRequestRef.current;
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages?take=${MESSAGE_LIMIT}`, { cache: "no-store" });
      const payload = await readJson<{ ok: true; messages: CloudMessagePayload[] }>(response);
      // An older initial request can finish after the join notification was
      // created. Only the latest response may replace the conversation.
      if (requestId === messagesLoadRequestRef.current) {
        setMessages(payload.messages.map((message) => normalizeMessage(message, user?.id)));
      }
    } catch {
      // silently ignore message load errors — cloud still functional
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

  const joinCloud = useCallback((socket: Socket, announce = false) => {
    socket.emit("cloud:join", { cloudId, announce });
  }, [cloudId]);

  const isCloudAuthor = Boolean(user?.id && cloud?.authorId && user.id === cloud.authorId);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches || status !== "authenticated" || !user) return;

    const leaveCloud = () => {
      if (minimizingRef.current || leftOnMobileExitRef.current) return;
      leftOnMobileExitRef.current = true;
      const minimized = window.localStorage.getItem("clouds:minimized-cloud");
      try {
        if (minimized && JSON.parse(minimized).id === cloudId) {
          window.localStorage.removeItem("clouds:minimized-cloud");
          window.dispatchEvent(new Event("clouds:minimized-cloud-changed"));
        }
      } catch { /* ignore invalid persisted state */ }
      void fetch(`/api/clouds/${encodeURIComponent(cloudId)}/${isCloudAuthor ? "exit" : "leave"}`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
      }).catch(() => undefined);
    };

    // Browser back (including Android's gesture/button) leaves the active
    // Cloud. Do not turn that navigation into a Mini Cloud.
    window.addEventListener("popstate", leaveCloud);
    window.addEventListener("pagehide", leaveCloud);
    return () => {
      window.removeEventListener("popstate", leaveCloud);
      window.removeEventListener("pagehide", leaveCloud);
    };
  }, [cloudId, isCloudAuthor, status, user]);
  const isPrivateCloud = (cloud?.visibility ?? visibility ?? "public") === "private";
  const typingPeople = Object.entries(typingUserIds)
    .filter(([, isTyping]) => isTyping)
    .filter(([typingUserId]) => typingUserId !== user?.id) // Exclude current user from typing indicator
    .map(([typingUserId]) => {
      const member = cloud?.members?.find((entry) => entry.userId === typingUserId);
      if (member) {
        return {
          id: typingUserId,
          name: member.user.displayName || member.user.username || "Pessoa",
          avatarUrl: member.user.avatarUrl,
        };
      }

      if (cloud?.authorId === typingUserId) {
        return {
          id: typingUserId,
          name: cloud.author?.name || cloud.author?.username || "Pessoa",
          avatarUrl: cloud.author?.avatarUrl ?? null,
        };
      }

      return {
        id: typingUserId,
        name: "Pessoa",
        avatarUrl: null as string | null,
      };
    });

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

  const fetchHypeUsers = useCallback(async () => {
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/hypes`, {
        credentials: "include",
      });
      const payload = await readJson<{ ok: true; users: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }> }>(response);
      setHypeUsers(payload.users || []);
    } catch (error) {
      console.error("Failed to fetch hype users:", error);
    }
  }, [cloudId]);

  const handleCopyShareLink = useCallback(async () => {
    try {
      const shareUrl = `${window.location.origin}/cloud/${encodeURIComponent(cloudId)}?join=1`;
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

  const resolvedTitle = cloud?.title || title || "Cloud";
  const shouldScrollTitle = resolvedTitle.length > 28;

  const handleTitlePointerDown = useCallback((event: React.PointerEvent) => {
    // Only enable long press on mobile/touch devices
    if (window.matchMedia("(pointer: coarse)").matches) {
      setIsTitleLongPress(false);
      setTitleLongPressTimer(
        setTimeout(() => {
          setIsTitleLongPress(true);
          setActionMenuOpen(true);
        }, 500)
      );
    }
  }, []);

  const handleTitlePointerUp = useCallback((event: React.PointerEvent) => {
    if (titleLongPressTimer) {
      clearTimeout(titleLongPressTimer);
      setTitleLongPressTimer(null);
    }
    // Prevent click event if it was a long press
    if (isTitleLongPress) {
      event.preventDefault();
      event.stopPropagation();
      setIsTitleLongPress(false);
    }
  }, [titleLongPressTimer, isTitleLongPress]);

  const handleTitlePointerLeave = useCallback(() => {
    if (titleLongPressTimer) {
      clearTimeout(titleLongPressTimer);
      setTitleLongPressTimer(null);
    }
  }, [titleLongPressTimer]);

  const handleTitlePointerCancel = useCallback(() => {
    if (titleLongPressTimer) {
      clearTimeout(titleLongPressTimer);
      setTitleLongPressTimer(null);
    }
  }, [titleLongPressTimer]);

  const minimizeCloud = useCallback(() => {
    minimizingRef.current = true;
    window.localStorage.setItem("clouds:minimized-cloud", JSON.stringify({ id: cloudId, title: resolvedTitle, isAuthor: isCloudAuthor, ownerUserId: user?.id, duration: cloud?.duration ?? duration ?? "", createdAt: cloud?.createdAt ?? createdAt ?? new Date().toISOString() }));
    window.dispatchEvent(new Event("clouds:minimized-cloud-changed"));
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [cloud?.createdAt, cloud?.duration, cloudId, createdAt, duration, isCloudAuthor, resolvedTitle, router, user?.id]);

  useEffect(() => {
    // Authenticated entries wait for membership confirmation. Guests viewing a
    // public invitation never create membership, so they must load the chat
    // immediately and see the registration-gated composer instead.
    if (!joinOnEntry || status !== "authenticated" || !user) {
      void loadCloud();
      void loadMessages();
    }
    if (status === "authenticated" && user) void loadContacts();
  }, [joinOnEntry, loadCloud, loadContacts, loadMessages, status, user]);

  useEffect(() => {
    if (status === "loading") return;
    const socketUrl = resolveSocketUrl();
    if (!socketUrl) {
      setConnectionState("disconnected");
      return;
    }

    const socket = io(`${socketUrl}/clouds`, {
      auth: socketAuth,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("session:ready", () => {
      setConnectionState("connected");
    });

    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", () => setConnectionState("disconnected"));

    socket.on("cloud:message:new", (message: CloudMessagePayload) => {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(message, user?.id)));
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
      if (payload.cloudId !== cloudId || payload.userId === user?.id) {
        return;
      }

      const existingTimer = incomingTypingTimersRef.current[payload.userId];
      if (existingTimer) {
        clearTimeout(existingTimer);
        delete incomingTypingTimersRef.current[payload.userId];
      }

      setTypingUserIds((prev) => ({
        ...prev,
        [payload.userId]: payload.isTyping,
      }));

      if (!payload.isTyping) {
        return;
      }

      incomingTypingTimersRef.current[payload.userId] = setTimeout(() => {
        setTypingUserIds((prev) => ({
          ...prev,
          [payload.userId]: false,
        }));
        delete incomingTypingTimersRef.current[payload.userId];
      }, 1000);
    });

    socket.on("cloud:members_updated", (payload: { cloudId: string; membersCount: number; members?: CloudPayload["members"] }) => {
      if (payload.cloudId !== cloudId) return;
      setCloud((prev) => prev ? { ...prev, membersCount: payload.membersCount, ...(payload.members ? { members: normalizeCloud({ ...prev, members: payload.members } as CloudPayload).members } : {}) } : prev);
    });

    socket.on("cloud:banned", (payload: { cloudId: string }) => {
      if (payload.cloudId === cloudId) {
        router.replace("/");
      }
    });

    socket.on("cloud:removed", (payload: { cloudId: string }) => {
      if (payload.cloudId === cloudId) {
        router.replace("/");
      }
    });

    socket.on("cloud:messages:deleted", (payload: { cloudId: string; messageIds: string[] }) => {
      if (payload.cloudId === cloudId) {
        setMessages((prev) => prev.filter((m) => !payload.messageIds.includes(m.id)));
      }
    });

    socket.on("cloud:report", (payload: {
      cloudId: string;
      reportedId: string;
      reportedName: string;
      reportedUsername: string;
      reportedAvatarUrl: string | null;
      messageId: string | null;
      messageContent: string | null;
      reasons: string[];
    }) => {
      if (payload.cloudId === cloudId) {
        setIncomingReport(payload);
        setReportNotifCount((prev) => prev + 1);
      }
    });

    return () => {
      Object.values(incomingTypingTimersRef.current).forEach(clearTimeout);
      incomingTypingTimersRef.current = {};
      socket.emit("cloud:leave", { cloudId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [cloudId, joinCloud, router, status, user?.id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (status === "loading" || !socket) {
      return;
    }

    // Guests can join a public live cloud room only to receive new messages.
    // Any attempt to interact with the composer opens the registration dialog.
    if (status !== "authenticated" || !user) {
      joinCloud(socket, false);
      return;
    }

    // When returning after leaving, restore the persisted membership before
    // asking Socket.IO to join and announce the entry. Otherwise the gateway
    // correctly rejects the socket as a user who is no longer a member.
    if (joinOnEntry && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      // `join=1` is a one-time intent added by the Cloud card. Consume it
      // immediately so a refresh, tab restore, or focus return cannot be
      // mistaken for another explicit entry.
      if (typeof window !== "undefined") {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has("join")) {
          currentUrl.searchParams.delete("join");
          window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
        }
      }
      fetch(`/api/clouds/${encodeURIComponent(cloudId)}/join`, {
        method: "POST",
        credentials: "include",
      }).then((response) => {
        if (response.ok) {
          const minimized = window.localStorage.getItem("clouds:minimized-cloud");
          if (minimized) {
            try {
              if (JSON.parse(minimized).id !== cloudId) {
                window.localStorage.removeItem("clouds:minimized-cloud");
                window.dispatchEvent(new Event("clouds:minimized-cloud-changed"));
              }
            } catch { /* ignore invalid persisted state */ }
          }
          // The HTTP endpoint already persisted and broadcast the entry
          // message. This call only joins the newly-authorized socket room.
          joinCloud(socket, false);
          void loadCloud();
          void loadMessages();
        } else {
          hasJoinedRef.current = false;
        }
      }).catch(() => {
        hasJoinedRef.current = false;
      });
      return;
    }

    // Reconnects only restore the socket room; they must not create another
    // system message.
    joinCloud(socket, false);
  }, [cloudId, connectionState, joinCloud, joinOnEntry, status, user]);

  useEffect(() => {
    const targetId = new URLSearchParams(window.location.search).get("message");
    if (targetId && !targetScrolledRef.current && messages.some((message) => message.id === targetId)) {
      messagesScrollRef.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(targetId)}"]`)?.scrollIntoView({ block: "center" });
      targetScrolledRef.current = true;
      return;
    }
    if (targetId && !targetScrolledRef.current) return;
    if (messages.length > 0) {
      messagesScrollRef.current?.scrollTo({ top: messagesScrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [isLocallyTyping, messages, typingUserIds]);

  // Animação de saída do balão de digitação
  const prevTypingCountRef = useRef(0);
  useEffect(() => {
    const count = typingPeople.length;
    if (prevTypingCountRef.current > 0 && count === 0) {
      setTypingExiting(true);
      if (typingExitTimerRef.current) clearTimeout(typingExitTimerRef.current);
      typingExitTimerRef.current = setTimeout(() => setTypingExiting(false), 220);
    }
    prevTypingCountRef.current = count;
  }, [typingPeople.length]);

  useEffect(() => {
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

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }

    const currentTyping = Boolean(draft.trim());
    socket.emit("cloud:typing", { cloudId, isTyping: currentTyping });

    if (outgoingTypingTimerRef.current) {
      clearTimeout(outgoingTypingTimerRef.current);
    }

    outgoingTypingTimerRef.current = setTimeout(() => {
      socket.emit("cloud:typing", { cloudId, isTyping: false });
    }, currentTyping ? 1000 : 0);
  }, [cloudId, connectionState, draft]);

  const openImagePicker = useCallback(() => {
    if (!audioRecorder || audioRecorder.state !== "idle") {
      return;
    }

    setImageFormatOpen(true);
  }, [audioRecorder]);

  const sendReaction = useCallback(async (messageId: string, emoji: string) => {
    if (messageId.startsWith("client-")) {
      setError("Aguarde o envio da mensagem antes de reagir.");
      return;
    }
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages/${encodeURIComponent(messageId)}`, {
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

  const mentionMatch = draft.slice(0, caretIndex).match(/(?:^|\s)@([\p{L}\p{N}_.]*)$/u);
  const mentionQuery = mentionMatch?.[1]?.toLocaleLowerCase("pt-BR") ?? null;
  const cloudPeople = [
    ...(cloud ? [{ userId: cloud.authorId, username: cloud.author.username, displayName: cloud.author.name, inCloud: true }] : []),
    ...(cloud?.members ?? []).map((member) => ({ userId: member.userId, username: member.user.username, displayName: member.user.displayName, inCloud: true })),
  ];
  const mentionCandidates = buildMentionCandidates(
    mentionQuery,
    cloudPeople,
    contacts.map((contact) => ({ userId: contact.id, username: contact.username, displayName: contact.displayName, inCloud: false })),
    user?.id,
  );
  const selectMention = (member: { userId: string; username: string }) => {
    if (!mentionMatch) return;
    const start = caretIndex - mentionMatch[1].length - 1;
    const replacement = `@${member.username}`;
    const next = `${draft.slice(0, start)}${replacement} ${draft.slice(caretIndex)}`;
    setDraftMentions((current) => [...shiftMentions(current, draft, next), { userId: member.userId, username: member.username, start, end: start + replacement.length }]);
    setDraft(next);
    setCaretIndex(start + replacement.length + 1);
    requestAnimationFrame(() => { composerRef.current?.focus(); composerRef.current?.setSelectionRange(start + replacement.length + 1, start + replacement.length + 1); });
  };

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
      mentions: draftMentions,
      mediaUrl: null,
      replyTo: replyingTo ? { id: replyingTo.id, sender: replyingTo.senderName, content: replyingTo.content } : null,
      reactions: [],
      time: timeLabel(new Date().toISOString()),
      isoTime: new Date().toISOString(),
      pending: true,
      clientMessageId,
    };

    const nextDraft = draft;
    const leadingSpaces = nextDraft.length - nextDraft.trimStart().length;
    const mentions = draftMentions.map((mention) => ({ ...mention, start: mention.start - leadingSpaces, end: mention.end - leadingSpaces })).filter((mention) => mention.start >= 0 && nextDraft.trim().slice(mention.start, mention.end) === `@${mention.username}`);
    setDraft("");
    setDraftMentions([]);
    setCaretIndex(0);
    setReplyingTo(null);
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          content: nextDraft.trim(),
          mentions,
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
  }, [cloudId, draft, draftMentions, replyingTo, user]);

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
      audioPeaks: recording.peaks ?? null,
    };

    setAudioUploading(true);
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      const formData = new FormData();
      formData.set("file", recording.blob, `audio-${Date.now()}.webm`);
      formData.set("clientMessageId", clientMessageId);
      if (recording.peaks && recording.peaks.length) {
        formData.set("peaks", JSON.stringify(recording.peaks));
      }

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

  useEffect(() => {
    if (!user) return;
    const loadStickers = () => {
      void fetch("/api/stickers", { cache: "no-store" }).then((response) => readJson<{ stickers?: Array<{ id: string; mediaUrl: string }> }>(response)).then((payload) => {
        setSavedStickers(payload.stickers ?? []);
      }).catch(() => undefined);
    };
    loadStickers();
    const timer = window.setInterval(loadStickers, 15_000);
    return () => window.clearInterval(timer);
  }, [user]);

  const saveSticker = useCallback(async (mediaUrl: string) => {
    try {
      const response = await fetch("/api/stickers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaUrl }) });
      const payload = await readJson<{ sticker: { id: string; mediaUrl: string }; alreadySaved?: boolean }>(response);
      setSavedStickers((current) => current.some((sticker) => sticker.mediaUrl === payload.sticker.mediaUrl) ? current : [payload.sticker, ...current]);
      setStickerSaveNotice(payload.alreadySaved ? "Já salva!" : "Salva!");
      window.setTimeout(() => setStickerSaveNotice(null), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a figurinha.");
    }
  }, []);

  const handleImageFile = useCallback(async (file: File | null, isSticker = false) => {
    if (!file) {
      return;
    }

    if (!user) {
      setError("Entre na sua conta para enviar imagens e figurinhas.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem para enviar como figurinha.");
      return;
    }

    let fileToSend = file;
    try {
      if (isSticker) fileToSend = await makeStickerFile(file);
    } catch (formatError) {
      setError(formatError instanceof Error ? formatError.message : "Não foi possível transformar a imagem em figurinha.");
      return;
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(fileToSend);
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
      isSticker,
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
      formData.set("file", fileToSend, fileToSend.name || `image-${Date.now()}.jpg`);
      formData.set("clientMessageId", clientMessageId);
      formData.set("isSticker", String(isSticker));

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

  const chooseImageFromSystem = useCallback(async (isSticker: boolean) => {
    type FilePickerWindow = Window & { showOpenFilePicker?: (options: { multiple?: boolean; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<Array<{ getFile: () => Promise<File> }>> };
    try {
      const picker = (window as FilePickerWindow).showOpenFilePicker;
      if (!picker) {
        setError("Seu navegador não oferece o seletor de arquivos necessário. Use um navegador Chromium atualizado.");
        return;
      }
      const [handle] = await picker({ multiple: false, types: [{ description: "Imagens", accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif"] } }] });
      const file = await handle?.getFile();
      if (file) {
        setImageFormatOpen(false);
        await handleImageFile(file, isSticker);
      }
    } catch (pickerError) {
      if ((pickerError as DOMException | undefined)?.name !== "AbortError") {
        setError("Não foi possível selecionar a imagem.");
      }
    }
  }, [handleImageFile]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionCandidates.length && (event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
      event.preventDefault();
      selectMention(mentionCandidates[0]);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendText();
    }
  };

  const handlePin = useCallback((msg: ChatMessage) => {
    setPinnedMessageId((prev) => prev === msg.id ? null : msg.id);
  }, []);

  const handleReply = useCallback((msg: ChatMessage) => {
    setEditingMsg(null);
    setReplyingTo(msg);
  }, []);

  const handleForwardMsg = useCallback((_msg: ChatMessage) => {
    setShareOpen(true);
  }, []);

  const handleEditMsg = useCallback((msg: ChatMessage) => {
    if (msg.kind !== "text") return;
    setReplyingTo(null);
    setEditingMsg(msg);
    setEditDraft(msg.content);
  }, []);

  const submitEditMsg = useCallback(async () => {
    if (!editingMsg || !user) return;
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === editingMsg.content) {
      setEditingMsg(null);
      return;
    }

    const messageId = editingMsg.id;
    const previous = editingMsg.content;
    setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, content: trimmed } : message)));
    setEditingMsg(null);

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!response.ok) {
        setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, content: previous } : message)));
        setError("Não foi possível editar a mensagem.");
      }
    } catch {
      setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, content: previous } : message)));
      setError("Não foi possível editar a mensagem.");
    }
  }, [cloudId, editDraft, editingMsg, user]);

  const handleDeleteMsg = useCallback(async (msg: ChatMessage) => {
    setMessages((prev) => prev.filter((message) => message.id !== msg.id));
    if (pinnedMessageId === msg.id) {
      setPinnedMessageId(null);
    }
    if (msg.pending) {
      return;
    }

    try {
      await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages/${encodeURIComponent(msg.id)}`, {
        method: "DELETE",
      });
    } catch {
      setError("Não foi possível cancelar o envio.");
    }
  }, [cloudId, pinnedMessageId]);

  const handleReportMsg = useCallback((msg: ChatMessage) => {
    setReportingMsg(msg);
  }, []);

  const canReportCloud = Boolean(
    user &&
    cloud &&
    user.id !== cloud.authorId,
  );

  const handleBanMember = useCallback(async (userId: string) => {
    if (isBanningMemberId === userId) return;
    setIsBanningMemberId(userId);
    try {
      const res = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/members/${encodeURIComponent(userId)}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(errBody?.message ?? "Não foi possível banir o membro.");
      }
      // Remove from members list and reports
      setCloud((current) =>
        current ? { ...current, members: current.members?.filter((m) => m.userId !== userId) ?? [] } : current,
      );
      setCloudReports((prev) => prev.filter((r) => r.reportedId !== userId));
      setReportNotifCount((prev) => Math.max(0, prev - 1));
      // Close the incoming report pop-up if it's for this user
      setIncomingReport((prev) => (prev?.reportedId === userId ? null : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível banir o membro.");
    } finally {
      setIsBanningMemberId(null);
    }
  }, [cloudId, isBanningMemberId]);

  // Load reports on mount when cloud author (to populate badge and list)
  useEffect(() => {
    if (!isCloudAuthor) return;
    void (async () => {
      try {
        const res = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/reports`, { credentials: "include" });
        const data = await readJson<{ ok: true; reports: typeof cloudReports }>(res);
        setCloudReports(data.reports);
        // Only set badge count from DB if socket hasn't already added counts
        setReportNotifCount((prev) => Math.max(prev, data.reports.length));
      } catch { /* silent */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloudAuthor]);

  // Reload reports list when manage members modal opens
  useEffect(() => {
    if (!manageMembersOpen || !isCloudAuthor) return;
    void (async () => {
      try {
        const res = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/reports`, { credentials: "include" });
        const data = await readJson<{ ok: true; reports: typeof cloudReports }>(res);
        setCloudReports(data.reports);
      } catch { /* silent */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageMembersOpen]);

  const isAudioBusy = audioUploading || imageUploading || audioRecorder.state !== "idle";
  const managedMembers = useMemo<CloudMemberEntry[]>(() => {
    if (!cloud) return [];
    const host: CloudMemberEntry = {
      id: `host-${cloud.authorId}`,
      userId: cloud.authorId,
      role: "host",
      user: { id: cloud.author.id, displayName: cloud.author.name, username: cloud.author.username, avatarUrl: cloud.author.avatarUrl },
    };
    return [host, ...(cloud.members ?? []).filter((member) => member.userId !== cloud.authorId)];
  }, [cloud]);
  const filteredManagedMembers = managedMembers.filter((member) =>
    `${member.user.displayName} ${member.user.username}`.toLowerCase().includes(memberSearch.trim().toLowerCase()),
  );
  const resolvedParticipants = cloud?.membersCount ?? 0;
  const { formatted: liveTimer, isExpired } = useCountdown(cloud);
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const shareLink = `${publicAppUrl || (typeof window !== "undefined" ? window.location.origin : "")}/cloud/${encodeURIComponent(cloudId)}?join=1`;
  const externalShareText = `*${cloud?.title || "Cloud"}*\nFaltam *${liveTimer}* para participar.\nJunte-se a mim nessa conversa: ${shareLink}`;
  const cloudVisibility = cloud?.visibility ?? (visibility === "private" ? "private" : "public");
  const isDarkCloud = cloudVisibility === "private";

  // Uma Cloud encerrada passa a viver no Read, onde a conversa permanece
  // disponível e pode ser continuada em uma nova Cloud.
  useEffect(() => {
    if (isExpired && cloud) {
      router.replace(`/read?cloud=${encodeURIComponent(cloudId)}`);
    }
  }, [isExpired, cloud, cloudId, router]);

  if (status === "loading" || loadingCloud) {
    return (
      <div className="flex h-[100dvh] min-h-screen items-center justify-center text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
        Carregando a cloud...
      </div>
    );
  }

  return (
    <div onClick={() => setActionMenuOpen(false)} className="flex h-[100dvh] flex-col overflow-hidden overscroll-none text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <div className="grid shrink-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 bg-black px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:gap-x-3 sm:gap-y-1.5 sm:px-4 sm:pb-4 sm:pt-4">
        <button
          type="button"
          aria-label="Minimizar Cloud"
          onClick={minimizeCloud}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-white/70 transition hover:text-white sm:h-9 sm:w-9"
        >
          <ArrowLeftIcon s={18} />
        </button>

        <div className="min-w-0 overflow-hidden">
          <h1
            className={`${shouldScrollTitle ? "cloud-title-marquee md:truncate" : "truncate"} text-[22px] font-bold leading-tight text-white sm:text-[28px]`}
            onPointerDown={handleTitlePointerDown}
            onPointerUp={handleTitlePointerUp}
            onPointerLeave={handleTitlePointerLeave}
            onPointerCancel={handleTitlePointerCancel}
          >
            {shouldScrollTitle ? <><span>{resolvedTitle}</span><span aria-hidden="true">{resolvedTitle}</span></> : resolvedTitle}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {!isDarkCloud && (
            <>
              <div className="relative flex h-10 items-center">
                {hypesCount >= 100 && (
                  <button
                    type="button"
                    aria-label="Ver pessoas que deram hype"
                    onClick={() => { setHypeListOpen(true); void fetchHypeUsers(); }}
                    className="mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#A855F7] bg-black text-[6px] font-extrabold leading-none text-white transition hover:border-[#C084FC]"
                  >
                    100+
                  </button>
                )}
                <button
                  type="button"
                  aria-label={hyped ? "Remover hype" : "Dar hype"}
                  onClick={() => void handleToggleHype()}
                  disabled={isUpdatingHype}
                className={`group flex h-9 w-9 items-center justify-center transition sm:h-10 sm:w-10 ${hyped ? "text-[#FF7A18] hover:text-[#FF8C35]" : "text-white hover:text-[#FF7A18]"}`}
                >
                  <HeaderFireIcon active={hyped} />
                </button>
                {hypesCount > 0 && hypesCount < 100 && (
                  <button
                    type="button"
                    aria-label="Ver pessoas que deram hype"
                    onClick={() => { setHypeListOpen(true); void fetchHypeUsers(); }}
                    className="absolute -bottom-1 -right-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#7C3AED] px-[3px] text-[5px] font-extrabold leading-none text-white transition hover:bg-[#9333EA]"
                  >
                    <span className="scale-[0.65]">{hypesCount}</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Encaminhar"
                onClick={() => setShareOpen(true)}
                className="cloud-share-pulse group flex h-9 w-9 items-center justify-center text-white transition hover:text-white sm:h-10 sm:w-10"
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
                className="group relative hidden h-10 w-10 items-center justify-center text-white/60 transition hover:text-white md:flex"
              >
                <HeaderMembersIcon />
                {reportNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {reportNotifCount > 9 ? "9+" : reportNotifCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label="Excluir cloud"
                onClick={() => setDeleteConfirmOpen(true)}
                className="group hidden h-10 w-10 items-center justify-center text-white transition hover:text-red-500 md:flex"
              >
                <AnimatedTrashIcon s={24} />
              </button>
            </>
          )}

          <div className="relative z-50" data-cloud-action-root="true">
            <button
              type="button"
              aria-label="Mais opções"
              data-cloud-action-toggle="true"
              onClick={(event) => {
                event.stopPropagation();
                setActionMenuOpen((current) => !current);
              }}
              className="group flex h-9 w-9 items-center justify-center text-white transition hover:text-white sm:h-10 sm:w-10"
            >
              <HeaderDotsIcon />
            </button>

            {actionMenuOpen && (
              <div
                data-cloud-action-menu="true"
                onClick={(event) => event.stopPropagation()}
                className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#11141F] shadow-xl"
              >
                {isCloudAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionMenuOpen(false);
                      setManageMembersOpen(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-white/80 transition hover:bg-white/5 hover:text-white md:hidden"
                  >
                    <span className="flex h-6 w-6 items-center justify-center text-white/60"><HeaderMembersIcon /></span>
                    Gerenciar membros
                    {reportNotifCount > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{reportNotifCount > 9 ? "9+" : reportNotifCount}</span>}
                  </button>
                )}
                {isCloudAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionMenuOpen(false);
                      setDeleteConfirmOpen(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-red-300 transition hover:bg-red-500/10 hover:text-red-200 md:hidden"
                  >
                    <span className="flex h-6 w-6 items-center justify-center"><AnimatedTrashIcon s={16} /></span>
                    Excluir Cloud
                  </button>
                )}
                {cloud?.description?.trim() && <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setDescriptionOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-white/60">D</span>
                  Ver descrição
                </button>}
                {canReportCloud && (
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
                )}
              </div>
            )}
          </div>
        </div>

        <div className="col-start-2 col-end-4 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[13px] text-white/50 sm:gap-3 sm:text-[16px]">
          <span className="flex min-w-0 items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#A855F7] animate-pulse sm:h-3 sm:w-3" />
            <span className="md:hidden">{resolvedParticipants} na conversa</span>
            <span className="hidden md:inline">{resolvedParticipants} {resolvedParticipants === 1 ? "pessoa" : "pessoas"} na conversa</span>
          </span>
          <span className="hidden text-white/20 md:inline">|</span>
          <span className="flex shrink-0 items-center gap-1 font-sans text-[18px] font-bold text-[#A855F7] sm:text-[24px]" style={{ fontFamily: "Arial, sans-serif" }}>
            <HeaderClockIcon />
            {liveTimer}
          </span>
        </div>
      </div>

      {error && <div className="border-b border-white/[0.07] bg-[#2A1018] px-5 py-2 text-[12px] text-[#FCA5A5]">{error}</div>}
      {stickerSaveNotice && <div role="status" className="fixed left-1/2 top-5 z-[100] -translate-x-1/2 rounded-full border border-emerald-300/25 bg-emerald-950/95 px-4 py-2 text-[13px] font-semibold text-emerald-100 shadow-xl">{stickerSaveNotice}</div>}

      {pinnedMessageId && (() => {
        const pinned = messages.find((m) => m.id === pinnedMessageId);
        if (!pinned) return null;
        return (
          <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#1a0e3d]/60 px-5 py-2">
            <span className="text-[#A855F7]"><CloudPinIcon pinned={true} /></span>
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

      <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-purple px-3 py-4 sm:px-8 sm:py-6">
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

              const msg = entry as ChatMessage;
              if (msg.kind === "system") {
                return <CloudSystemMessage key={msg.id} message={msg} />;
              }

              const messageIndex = messages.findIndex((item) => item.id === msg.id);
              const previousMessage = messages[messageIndex - 1];
              const nextMessage = messages[messageIndex + 1];
              const grouped = Boolean(previousMessage && previousMessage.kind !== "system" && previousMessage.senderId === msg.senderId && new Date(msg.isoTime).getTime() - new Date(previousMessage.isoTime).getTime() < 5 * 60_000);
              const showFooter = !nextMessage || nextMessage.kind === "system" || nextMessage.senderId !== msg.senderId || new Date(nextMessage.isoTime).getTime() - new Date(msg.isoTime).getTime() >= 5 * 60_000;

              return <div key={msg.id} data-message-id={msg.id}><CloudMessageBubble msg={msg} onReact={sendReaction} onShowReactions={(message, emoji) => { setReactionDetailsMessage(message); setReactionDetailsEmoji(emoji); }} onReply={handleReply} onPin={handlePin} onForward={handleForwardMsg} onEdit={handleEditMsg} onDelete={handleDeleteMsg} onReport={handleReportMsg} onSaveSticker={(mediaUrl) => void saveSticker(mediaUrl)} isCloudAuthor={isCloudAuthor} isPinned={pinnedMessageId === msg.id} grouped={grouped} showFooter={showFooter} /></div>;
            });
          })()
        )}
        <div className="px-3 pb-2 min-h-[44px] flex items-end">
          {(typingPeople.length > 0 || typingExiting) && (
            <TypingBubble avatars={typingPeople.length > 0 ? typingPeople : []} exiting={typingExiting} />
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <div ref={composerFooterRef} className="shrink-0 overscroll-none border-t border-white/[0.07] bg-[#000000] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
        <div className="relative flex min-h-[66px] flex-col gap-2 rounded-full border border-[#6D28D9]/45 bg-[#1a0e3d] px-4 py-3 sm:min-h-0 sm:px-5">
          {status !== "authenticated" && (
            <button type="button" aria-label="Cadastrar para participar da cloud" onClick={() => setGuestSignupOpen(true)} className="absolute inset-0 z-20 cursor-text rounded-full" />
          )}
          {audioRecorder.state === "recording" || audioRecorder.state === "paused" ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-black px-2 py-2.5 sm:flex-nowrap sm:rounded-full sm:px-4">
              <div className="min-w-0 flex-1 text-[12px] text-white sm:text-[14px]" style={{ fontFamily: "Arial, sans-serif" }}>
                {audioRecorder.state === "paused" ? "Pausado" : "Gravando…"} {formatDurationMs(audioRecorder.seconds * 1000) || "0:00"}
              </div>
                <div className="block min-w-0"><Waveform active={audioRecorder.state === "recording"} paused={audioRecorder.state === "paused"} progress={audioRecorder.seconds} /></div>
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <button type="button" aria-label={audioRecorder.state === "paused" ? "Retomar" : "Pausar"} onClick={audioRecorder.state === "paused" ? audioRecorder.resume : audioRecorder.pause} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/10">
                  {audioRecorder.state === "paused" ? <PlayIcon s={16} /> : <PauseIcon s={16} />}
                </button>
                <button type="button" aria-label="Enviar áudio" onClick={audioRecorder.stop} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9]">
                  <SendIcon className="text-white" />
                </button>
                <button type="button" aria-label="Cancelar gravação" onClick={audioRecorder.cancel} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/10 hover:text-red-500">
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
                {mentionCandidates.length > 0 && !editingMsg && <div role="listbox" aria-label="Mencionar pessoa" className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 max-h-52 overflow-y-auto rounded-2xl border border-[#A855F7]/40 bg-[#171325] p-1 shadow-2xl">
                  {mentionCandidates.map((member) => <button key={member.userId} type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(member)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-white hover:bg-white/[0.08]"><span className="font-semibold">{member.displayName}</span><span className="text-white/55">@{member.username}</span><span className="ml-auto text-[11px] text-[#D8B4FE]">{member.inCloud ? "Na Cloud" : "Seguindo"}</span></button>)}
                </div>}
                {editingMsg && (
                  <div className="flex items-center gap-2 rounded-2xl border border-[#7C3AED]/40 bg-white/[0.04] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[#A855F7]">Editando mensagem</p>
                      <input
                        autoFocus
                        type="text"
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void submitEditMsg();
                          }
                          if (event.key === "Escape") setEditingMsg(null);
                        }}
                        className="w-full bg-transparent text-[12px] text-white outline-none"
                      />
                    </div>
                    <button type="button" onClick={() => void submitEditMsg()} className="text-[#A855F7] transition hover:text-white">Salvar</button>
                    <button type="button" onClick={() => setEditingMsg(null)} className="text-white/40 transition hover:text-white">×</button>
                  </div>
                )}
                {replyingTo && !editingMsg && (
                  <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#1a0e3d] px-4 py-2.5">
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
                    className="text-[#9CA3AF] transition hover:text-[#D1D5DB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CloudEmojiIcon />
                  </button>
                  <button
                    type="button"
                    aria-label="Adicionar imagem"
                    onClick={openImagePicker}
                    disabled={isAudioBusy}
                    className="text-[#9CA3AF] transition hover:text-[#D1D5DB] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlusIcon s={18} />
                  </button>
                  <textarea
                    ref={composerRef}
                    name="cloud-message"
                    autoComplete="off"
                    inputMode="text"
                    rows={1}
                    value={draft}
                    onChange={(event) => { setDraftMentions((current) => shiftMentions(current, draft, event.target.value)); setDraft(event.target.value); setCaretIndex(event.target.selectionStart); }}
                    onClick={(event) => setCaretIndex(event.currentTarget.selectionStart)}
                    onKeyUp={(event) => setCaretIndex(event.currentTarget.selectionStart)}
                    onInput={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`; }}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem..."
                    disabled={isAudioBusy}
                    className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent text-[15px] text-white placeholder:text-white/50 outline-none [overflow-wrap:anywhere] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ maxHeight: 120, fieldSizing: "content" }}
                  />
                  {draft.trim() ? (
                    <button type="button" aria-label="Enviar" onClick={() => void sendText()} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9333EA] text-white transition hover:bg-[#6D28D9]">
                      <SendIcon s={18} className="text-white" />
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
                </div>

                {emojiOpen && (
                  <div data-cloud-emoji-picker="true" className="absolute bottom-[calc(100%+8px)] left-1/2 z-10 w-[calc(100vw-2rem)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-[22px] border border-white/10 bg-[#11141F] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                    <div role="tablist" aria-label="Tipo de conteúdo" className="mx-3 mt-3 grid grid-cols-2 rounded-xl border border-white/[0.10] bg-black/20 p-1">
                      <button type="button" role="tab" aria-selected={mediaPickerTab === "emoji"} onClick={() => setMediaPickerTab("emoji")} className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${mediaPickerTab === "emoji" ? "bg-white/[0.12] text-white" : "text-white/45 hover:text-white"}`}>😊 Emojis</button>
                      <button type="button" role="tab" aria-selected={mediaPickerTab === "sticker"} onClick={() => setMediaPickerTab("sticker")} className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${mediaPickerTab === "sticker" ? "bg-white/[0.12] text-white" : "text-white/45 hover:text-white"}`}><svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10a6 6 0 0 1 6-6h5a5 5 0 0 1 5 5v4a7 7 0 0 1-7 7h-3a6 6 0 0 1-6-6v-4Z"/><path d="M14 20a6 6 0 0 1 6-6"/><path d="m14 20 6-6"/></svg>Figurinhas</button>
                    </div>
                    {mediaPickerTab === "emoji" && <div aria-label="Categorias de emojis" className="flex gap-1 overflow-x-auto border-b border-white/[0.07] px-2 pt-2 pb-0 scrollbar-none">
                      {EMOJI_CATEGORIES.map((cat, index) => <button key={cat.label} type="button" onClick={() => setEmojiCategory(index)} title={cat.label} aria-label={cat.label} className={`shrink-0 rounded-t-xl px-3 py-2 text-[18px] transition ${index === emojiCategory ? "bg-white/[0.08]" : "opacity-50 hover:opacity-100"}`}>{cat.icon}</button>)}
                    </div>}
                    <div className="max-h-[28vh] overflow-y-auto p-3 [scrollbar-color:#7C3AED_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#7C3AED]">
                      <div className="mb-2 flex items-center justify-between px-1"><p className="text-[12px] font-semibold text-white/65">{mediaPickerTab === "sticker" ? "Figurinhas do Clouds" : EMOJI_CATEGORIES[emojiCategory]?.label}</p><span className="text-[11px] text-white/35">{mediaPickerTab === "sticker" ? savedStickers.length : EMOJI_CATEGORIES[emojiCategory]?.emojis.length}</span></div>
                      {mediaPickerTab === "sticker" ? (
                        savedStickers.length > 0 ? <div className="grid w-full max-w-[560px] grid-cols-5 gap-3 px-1 py-2">{savedStickers.map((sticker) => <button key={sticker.id} type="button" title="Enviar figurinha" onClick={() => { void fetch(sticker.mediaUrl).then((response) => response.blob()).then((blob) => handleImageFile(new File([blob], "figurinha.webp", { type: blob.type || "image/webp" }), true)); setEmojiOpen(false); }} className="aspect-square w-full overflow-hidden rounded-2xl p-0 transition hover:bg-white/[0.08]"><img src={sticker.mediaUrl} alt="Figurinha salva" className={`h-full w-full object-contain ${sticker.mediaUrl.includes("/api/stickers/system/") ? "scale-125" : "scale-100"}`} /></button>)}</div> : <p className="py-6 text-center text-sm text-white/45">Nenhuma figurinha salva ainda.</p>
                      ) : <div className="flex flex-wrap gap-1.5">{EMOJI_CATEGORIES[emojiCategory]?.emojis.map((emoji, index) => <button key={index} type="button" onClick={() => setDraft((current) => `${current}${emoji}`)} className="flex h-9 w-9 items-center justify-center rounded-xl text-[18px] transition hover:bg-white/[0.07]">{emoji}</button>)}</div>}
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
        <ForwardToContactModal title="Encaminhar Cloud" preview={cloud?.title || "Cloud"} url={shareLink} label={cloud?.title || "Cloud compartilhada"} contacts={contacts} loading={loadingContacts} externalShareText={externalShareText} onClose={() => setShareOpen(false)} />
      )}

      {guestSignupOpen && <GuestCloudSignupModal cloudTitle={cloud?.title || "esta cloud"} returnTo={`/cloud/${encodeURIComponent(cloudId)}`} onClose={() => setGuestSignupOpen(false)} />}

      {imageFormatOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#05020d]/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/[0.12] bg-[radial-gradient(ellipse_at_top,rgba(112,45,190,0.20),transparent_56%),#15161C] shadow-[0_28px_90px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between px-6 pb-3 pt-6">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#C084FC]/30 bg-[#7C3AED]/20 text-[#D8B4FE]"><svg viewBox="0 0 24 24" width={21} height={21} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4.5 18 5-5 3.5 3 2-2 4.5 4"/></svg></div>
                <h2 className="text-[21px] font-bold tracking-tight text-white">Como deseja enviar?</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/55">Escolha o formato antes de selecionar a imagem.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => { setImageFormatOpen(false); setSelectedFilePreview(null); }} className="flex h-9 w-9 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-white">×</button>
            </div>
            <div className="grid gap-3 px-6 pb-5 sm:grid-cols-2">
              <button type="button" onClick={() => void chooseImageFromSystem(false)} className="group rounded-2xl border border-white/[0.13] bg-white/[0.025] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07]">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.08] text-white/80 transition group-hover:bg-white/[0.14]"><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4.5 18 5-5 3.5 3 2-2 4.5 4"/></svg></span>
                <span className="block text-[15px] font-bold text-white">Imagem original</span><span className="mt-1.5 block text-[12px] leading-relaxed text-white/50">Preserva o tamanho e a qualidade do arquivo.</span>
              </button>
              <button type="button" onClick={() => void chooseImageFromSystem(true)} className="group relative overflow-hidden rounded-2xl border border-[#A855F7]/70 bg-[linear-gradient(145deg,rgba(124,58,237,0.32),rgba(77,24,136,0.26))] p-4 text-left shadow-[0_12px_28px_rgba(124,58,237,0.16)] transition duration-200 hover:-translate-y-0.5 hover:border-[#D8B4FE] hover:shadow-[0_15px_34px_rgba(124,58,237,0.30)]">
                <span className="absolute right-3 top-3 rounded-full border border-[#E9D5FF]/30 bg-[#E9D5FF]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#E9D5FF]">Rápido</span>
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#E9D5FF]/20 bg-[#E9D5FF]/15 text-[#F3E8FF]"><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10a6 6 0 0 1 6-6h5a5 5 0 0 1 5 5v4a7 7 0 0 1-7 7h-3a6 6 0 0 1-6-6v-4Z"/><path d="M14 20a6 6 0 0 1 6-6"/><path d="m14 20 6-6"/></svg></span>
                <span className="block text-[15px] font-bold text-white">Figurinha</span><span className="mt-1.5 block text-[12px] leading-relaxed text-[#E9D5FF]/75">Compacta em WebP e envia direto no chat.</span>
              </button>
            </div>
            <div className="border-t border-white/[0.07] px-6 py-3.5 text-center"><button type="button" onClick={() => { setImageFormatOpen(false); setSelectedFilePreview(null); }} className="text-[13px] font-medium text-white/45 transition hover:text-white">Cancelar</button></div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
          <div className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15161C] p-6">
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <h3 className="text-[18px] font-bold">Descrição da Cloud</h3>
              <button type="button" aria-label="Fechar descrição" onClick={() => setDescriptionOpen(false)} className="shrink-0 p-1 text-white/50 hover:text-white">×</button>
            </div>
            <p className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[14px] leading-relaxed text-white/75">
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
            <div className="space-y-3">
              <p className="text-[14px] leading-relaxed text-white/70">
                Selecione o motivo da denúncia e envie para o criador da Cloud revisar.
              </p>
              {[
                "Spam ou publicidade",
                "Discurso de ódio",
                "Assédio ou bullying",
                "Conteúdo violento ou perturbador",
                "Informação falsa",
                "Conteúdo sexual inapropriado",
                "Ameaças",
                "Outro",
              ].map((reason) => (
                <label key={reason} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/75">
                  <input type="checkbox" value={reason} data-cloud-report-reason="true" className="h-4 w-4 accent-[#A855F7]" />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setReportOpen(false)} className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-white/80 transition hover:bg-white/[0.12] hover:text-white">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const checked = Array.from(document.querySelectorAll('[data-cloud-report-reason="true"]:checked')).length;
                  if (!cloud || checked === 0) return;

                  const reasons = Array.from(document.querySelectorAll('[data-cloud-report-reason="true"]:checked')).map((input) => (input as HTMLInputElement).value);

                  try {
                    const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/reports`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        reportedId: cloud.authorId,
                        messageId: null,
                        messageContent: cloud.title,
                        reasons,
                      }),
                    });

                    if (!response.ok) {
                      const errBody = await response.json().catch(() => null) as { message?: string } | null;
                      throw new Error(errBody?.message ?? "Não foi possível enviar a denúncia.");
                    }

                    setReportOpen(false);
                    setError(null);
                  } catch (reportError) {
                    setError(reportError instanceof Error ? reportError.message : "Não foi possível enviar a denúncia.");
                  }
                }}
                className="rounded-full bg-red-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-600"
              >
                Enviar denúncia
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

      {hypeListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setHypeListOpen(false)}>
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#15161C] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[18px] font-bold">Pessoas que deram Hype</h3>
              <button type="button" onClick={() => setHypeListOpen(false)} className="text-white/50 hover:text-white">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-purple space-y-3 pr-1">
              {hypeUsers.length === 0 ? (
                <p className="text-[14px] text-white/50 text-center py-4">Ninguém deu hype ainda</p>
              ) : (
                hypeUsers.map((hypeUser) => (
                  <div key={hypeUser.id} className="flex items-center gap-3">
                    <UserAvatar user={hypeUser} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{hypeUser.displayName}</p>
                      <p className="text-[12px] text-white/50">@{hypeUser.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {reactionDetailsMessage && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => { setReactionDetailsMessage(null); setReactionDetailsEmoji(null); }}>
          <div className="flex max-h-[78dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[#A855F7]/30 bg-[#130a2d] p-5 shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-bold text-white">{reactionDetailsMessage.reactions.length} {reactionDetailsMessage.reactions.length === 1 ? "reação" : "reações"}</h3>
              </div>
              <button type="button" aria-label="Fechar reações" onClick={() => { setReactionDetailsMessage(null); setReactionDetailsEmoji(null); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-xl leading-none text-white/50 transition hover:bg-white/10 hover:text-white">×</button>
            </div>
            <div className="mb-4 flex gap-2 overflow-x-auto border-b border-white/[0.08] pb-4 scrollbar-none">
              {Object.entries(reactionDetailsMessage.reactions.reduce((groups, reaction) => {
                groups[reaction.emoji] = [...(groups[reaction.emoji] ?? []), reaction];
                return groups;
              }, {} as Record<string, ReactionPayload[]>)).map(([emoji, reactions]) => (
                <button type="button" key={emoji} onClick={() => setReactionDetailsEmoji(emoji)} className={`shrink-0 rounded-full border px-3 py-1.5 text-[14px] transition ${reactionDetailsEmoji === emoji ? "border-[#A855F7]/70 bg-[#9333EA]/25 text-white" : "border-white/[0.1] bg-white/[0.06] text-white/75 hover:bg-white/[0.1]"}`}>
                  {emoji} <span className="ml-1 text-white/60">{reactions.length}</span>
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-purple pr-1">
              {reactionDetailsMessage.reactions.filter((reaction) => !reactionDetailsEmoji || reaction.emoji === reactionDetailsEmoji).map((reaction) => {
                const ownReaction = reaction.userId === user?.id;
                return (
                  <button
                    key={reaction.id}
                    type="button"
                    disabled={!ownReaction}
                    onClick={() => {
                      if (ownReaction) {
                        setReactionDetailsMessage(null);
                        setReactionDetailsEmoji(null);
                        void sendReaction(reactionDetailsMessage.id, reaction.emoji);
                      }
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${ownReaction ? "bg-[#9333EA]/10 hover:bg-[#9333EA]/20" : "hover:bg-white/[0.06]"}`}
                  >
                    <UserAvatar user={reaction.user} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-white">{ownReaction ? "Você" : reaction.user.displayName}</p>
                      <p className="truncate text-[12px] text-white/50">{ownReaction ? "Toque para remover sua reação" : `@${reaction.user.username}`}</p>
                    </div>
                    <span className="text-[24px]" aria-label={`Reação ${reaction.emoji}`}>{reaction.emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {manageMembersOpen && isCloudAuthor && cloud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#15161C] p-6 max-h-[85vh] flex flex-col">
            <div className="mb-4 flex items-center justify-between shrink-0">
              <h3 className="text-[18px] font-bold">Gerenciar membros</h3>
              <button type="button" onClick={() => { setManageMembersOpen(false); setReportNotifCount(0); }} className="text-white/50 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="relative mb-4 shrink-0">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">⌕</span>
              <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Buscar participante" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-[#A855F7]/70" />
            </div>

            {/* Denúncias */}
            {cloudReports.length > 0 && (
              <div className="mb-4 shrink-0">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-red-400">
                  ⚑ Denúncias recebidas ({cloudReports.length})
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-purple pr-1">
                  {cloudReports.map((report) => (
                    <div key={report.reportedId} className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          user={{ id: report.reportedId, username: report.reportedUsername, displayName: report.reportedName, avatarUrl: report.reportedAvatarUrl }}
                          size={32}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-white">{report.reportedName}</p>
                          <p className="truncate text-[11px] text-white/40">@{report.reportedUsername}</p>
                          {report.messageContent && (
                            <p className="mt-0.5 truncate text-[11px] text-white/65" title={report.messageContent}>
                              “{report.messageContent}”
                            </p>
                          )}
                          <p className="truncate text-[11px] text-red-400 mt-0.5">{report.reasons.join(" · ")} {report.count > 1 && <span className="text-white/30">({report.count}×)</span>}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleBanMember(report.reportedId)}
                        disabled={isBanningMemberId === report.reportedId}
                        className="shrink-0 rounded-full bg-red-500/20 px-3 py-1.5 text-[12px] font-semibold text-red-400 transition hover:bg-red-500/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isBanningMemberId === report.reportedId ? "Banindo…" : "Banir"}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-white/[0.07]" />
              </div>
            )}

            {/* Lista de membros */}
            <div className="space-y-2 overflow-y-auto scrollbar-purple flex-1 pr-1">
              {filteredManagedMembers.length === 0 ? (
                <p className="text-[14px] text-white/55">Nenhum participante encontrado.</p>
              ) : (
                filteredManagedMembers.map((member) => {
                  const hasReport = cloudReports.some((r) => r.reportedId === member.userId);
                  return (
                    <div key={member.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${hasReport ? "border-red-500/20 bg-red-500/[0.04]" : "border-white/10 bg-white/[0.04]"}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          user={{ id: member.userId, username: member.user.username, displayName: member.user.displayName, avatarUrl: member.user.avatarUrl }}
                          size={32}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-white">{member.user.displayName}</p>
                          <p className="truncate text-[11px] text-white/45">@{member.user.username}{member.role === "host" ? " · Host" : ""}</p>
                        </div>
                      </div>
                      {member.userId !== user?.id && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleBanMember(member.userId)}
                              disabled={isBanningMemberId === member.userId}
                              className="rounded-full bg-red-500/20 px-3 py-1.5 text-[12px] font-semibold text-red-400 transition hover:bg-red-500/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBanningMemberId === member.userId ? "Banindo…" : "Banir"}
                            </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {reportingMsg && (
        <ReportModal
          cloudId={cloudId}
          msg={{
            id: reportingMsg.id,
            senderId: reportingMsg.senderId,
            senderName: reportingMsg.senderName,
            senderAvatarUrl: reportingMsg.senderAvatarUrl,
            content: reportingMsg.kind === "text" ? reportingMsg.content : null,
          }}
          onClose={() => setReportingMsg(null)}
        />
      )}

      {incomingReport && (
        <ReportNotificationModal
          cloudId={cloudId}
          report={incomingReport}
          onBan={handleBanMember}
          onClose={() => setIncomingReport(null)}
        />
      )}

    </div>
  );
}
