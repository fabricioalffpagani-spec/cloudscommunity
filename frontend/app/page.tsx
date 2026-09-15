"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Suspense, useState, useRef, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const CloudChat = dynamic(() => import("./cloud/[id]/CloudChat"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-[14px] text-white/45">
      Carregando conversa...
    </div>
  ),
});
import { HeaderBrand } from "./components/HeaderBrand";
import { FlameIcon } from "./components/FlameIcon";
import { NotificationsBell } from "./components/NotificationsPanel";
import { AudioWaveformPlayer } from "./components/AudioWaveformPlayer";
import {
  SessionUserAvatar,
  getSessionUserDisplayName,
  getSessionUserHandle,
  useSessionUser,
} from "./components/session-user";

// ─── Types

type Category = { name: string; bg: string; color?: string };

type Cloud = {
  id: string;
  title: string;
  category: string;
  duration: string;
  createdAt: Date;
  mode: "text" | "audio";
  visibility: "public" | "private";
  href?: string;
  likes?: number;
  hypes?: number;
  hyped?: boolean;
  audioUrl?: string;
  audioPeaks?: number[];
  authorName?: string;
  authorHandle?: string;
  authorPhoto?: string;
  description?: string;
  liveParticipants?: number;
  authorId?: string;
};

type PollOption = { id: string; text: string; votes: number };

type Poll = {
  id: string;
  question: string;
  options: PollOption[];
  category: string;
  duration: string;
  createdAt: Date;
  votedOptionId: string | null;
};

type FeedItem = ({ kind: "cloud" } & Cloud) | ({ kind: "poll" } & Poll);

type CloudApiAuthor = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
};

type CloudApiPayload = {
  id: string;
  title: string;
  description: string | null;
  duration: string;
  visibility: "public" | "private";
  status: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  author: CloudApiAuthor;
  hypesCount: number;
  hyped?: boolean;
  membersCount: number;
  href: string;
};

function mergeClouds(base: Cloud[], incoming: Cloud[]) {
  const byId = new Map<string, Cloud>();

  [...incoming, ...base].forEach((cloud) => {
    byId.set(cloud.id, cloud);
  });

  return Array.from(byId.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}

function mapApiCloudToCloud(cloud: CloudApiPayload): Cloud {
  return {
    id: cloud.id,
    title: cloud.title,
    category: "Geral",
    duration: cloud.duration,
    createdAt: new Date(cloud.createdAt),
    mode: "text",
    visibility: cloud.visibility,
    href: cloud.href,
    hypes: cloud.hypesCount,
    hyped: cloud.hyped ?? false,
    authorName: cloud.author.name,
    authorHandle: cloud.author.username,
    authorPhoto: cloud.author.avatarUrl ?? undefined,
    description: cloud.description ?? undefined,
    liveParticipants: Math.max(1, cloud.membersCount),
    authorId: cloud.authorId,
  };
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SEED_CLOUDS: Cloud[] = [
  {
    id: "seed-1",
    title: "Tendências da semana em Tech",
    category: "Tech",
    duration: "1h",
    createdAt: new Date(Date.now() - 8 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-1?title=Tendências%20da%20semana%20em%20Tech&duration=1h&createdAt=" + new Date(Date.now() - 8 * 60 * 1000).toISOString() + "&participants=42",
    hypes: 42,
  },
  {
    id: "seed-2",
    title: "Qual álbum do ano vai dominar?",
    category: "Music",
    duration: "30min",
    createdAt: new Date(Date.now() - 14 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-2?title=Qual%20álbum%20do%20ano%20vai%20dominar%3F&duration=30min&createdAt=" + new Date(Date.now() - 14 * 60 * 1000).toISOString() + "&participants=87",
    hypes: 87,
  },
  {
    id: "seed-3",
    title: "Gaming: o melhor lançamento de 2025",
    category: "Gaming",
    duration: "1h",
    createdAt: new Date(Date.now() - 3 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-3?title=Gaming%3A%20o%20melhor%20lançamento%20de%202025&duration=1h&createdAt=" + new Date(Date.now() - 3 * 60 * 1000).toISOString() + "&participants=31",
    hypes: 31,
  },
  {
    id: "seed-4",
    title: "Drama das redes: o que você acha?",
    category: "Drama",
    duration: "24h",
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-4?title=Drama%20das%20redes%3A%20o%20que%20você%20acha%3F&duration=24h&createdAt=" + new Date(Date.now() - 30 * 60 * 1000).toISOString() + "&participants=113",
    hypes: 113,
  },
  {
    id: "seed-5",
    title: "Futebol: tabela e expectativas",
    category: "Sports",
    duration: "30min",
    createdAt: new Date(Date.now() - 2 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-5?title=Futebol%3A%20tabela%20e%20expectativas&duration=30min&createdAt=" + new Date(Date.now() - 2 * 60 * 1000).toISOString() + "&participants=58",
    hypes: 58,
  },
  {
    id: "seed-6",
    title: "Memes do momento - compartilhe o seu",
    category: "Memes",
    duration: "30min",
    createdAt: new Date(Date.now() - 1 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-6?title=Memes%20do%20momento%20-%20compartilhe%20o%20seu&duration=30min&createdAt=" + new Date(Date.now() - 1 * 60 * 1000).toISOString() + "&participants=204",
    hypes: 204,
  },
];

const CATEGORIES: Category[] = [
  { name: "For You",   bg: "#FFFFFF", color: "#111827" },
  { name: "Trending",  bg: "#A855F7" },
  { name: "Drama",     bg: "#EF4444" },
  { name: "Funny",     bg: "#EAB308" },
  { name: "Sports",    bg: "#22C55E" },
  { name: "Real Life", bg: "#3B82F6" },
  { name: "Pop",       bg: "#8B5CF6" },
  { name: "Politics",  bg: "#0EA5E9" },
  { name: "Tech",      bg: "#14B8A6" },
  { name: "Gaming",    bg: "#F97316" },
  { name: "Music",     bg: "#EC4899" },
  { name: "Movies",    bg: "#84CC16" },
  { name: "Memes",     bg: "#F43F5E" },
];

const DURATIONS = ["10min", "30min", "2h", "5h", "24h"];

const DURATION_SECONDS: Record<string, number> = {
  "10min": 10 * 60,
  "30min": 30 * 60,
  "2h": 2 * 60 * 60,
  "5h": 5 * 60 * 60,
  "24h": 24 * 60 * 60,
};

function parseDurationSeconds(duration: string) {
  return DURATION_SECONDS[duration] ?? 5 * 60;
}

function formatCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatParticipantCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
  }
  return `${value}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function avatarColor(source: string) {
  const palette = ["#9333EA", "#3B82F6", "#22C55E", "#F97316", "#EC4899", "#06B6D4"];
  return palette[hashString(source) % palette.length];
}

function getCloudRemainingSeconds(cloud: Cloud) {
  const elapsed = Math.floor((Date.now() - cloud.createdAt.getTime()) / 1000);
  return Math.max(parseDurationSeconds(cloud.duration) - elapsed, 0);
}

function isCloudActive(cloud: Cloud) {
  return getCloudRemainingSeconds(cloud) > 0;
}

function getTopicCountdown(cloud: Cloud) {
  return getCloudRemainingSeconds(cloud);
}

function getTopicProfile(cloud: Cloud, index: number) {
  const categoryProfiles: Record<string, {
    name: string;
    handle: string;
    description: string;
    participants: number;
  }> = {
    Tech: {
      name: "pedro.dev",
      handle: "pedro.dev",
      description: "IA vai substituir programadores? Debate com exemplos, dúvidas práticas e opiniões sem filtro.",
      participants: 54,
    },
    Music: {
      name: "lais_moraes",
      handle: "lais_moraes",
      description: "Qual álbum do ano merece o topo? Você entra, comenta e acompanha a conversa ao vivo.",
      participants: 112,
    },
    Gaming: {
      name: "lucasx7",
      handle: "lucasx7",
      description: "Jogos, lançamentos e tretas da semana em um papo rápido que muda a cada minuto.",
      participants: 91,
    },
    Drama: {
      name: "mariana_rib",
      handle: "mariana_rib",
      description: "Os tópicos mais comentados do momento, com espaço para leitura rápida e discussão ao vivo.",
      participants: 417,
    },
    Sports: {
      name: "gabriel_souza",
      handle: "gabriel_souza",
      description: "Brasileirão, seleção, bastidores e tudo que está puxando a conversa esportiva agora.",
      participants: 326,
    },
    Memes: {
      name: "ana_santos",
      handle: "ana_santos",
      description: "Memes, cortes e o caos leve da internet, tudo organizado em uma conversa ao vivo.",
      participants: 78,
    },
  };

  return {
    name: cloud.authorName ?? categoryProfiles[cloud.category]?.name ?? `user_${index + 1}`,
    handle: cloud.authorHandle ?? categoryProfiles[cloud.category]?.handle ?? `user_${index + 1}`,
    description: cloud.description ?? categoryProfiles[cloud.category]?.description ?? `Tópico em alta sobre ${cloud.category.toLowerCase()}.`,
    avatar: cloud.authorPhoto ?? null,
    participants: cloud.liveParticipants ?? categoryProfiles[cloud.category]?.participants ?? Math.max(18, (cloud.hypes ?? 0) + 24),
  };
}

function useSiteOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "http://localhost:3000",
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function SearchIcon({ s = 20 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" /><path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
function UploadIcon({ s = 20 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" />
    </svg>
  );
}
function BellIcon({ s = 20 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function GearIcon({ s = 20 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
function CloudIcon({ s = 22, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 16H5.5a3.5 3.5 0 0 1 0-7 .5.5 0 0 1 .1 0A5 5 0 0 1 15 9.5a3 3 0 0 1 0 6H8" />
      <path d="M8 16 C8 17.5 7.5 18.5 6.5 19.5 C7.5 19 9 18 9.5 16" />
    </svg>
  );
}

function FireIcon({ s = 20, className }: { s?: number; className?: string }) {
  return <FlameIcon s={s} className={className} />;
}

function CloudBadge({ s = 32 }: { s?: number }) {
  return (
    <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-gradient-to-br from-[#FFF0F8] to-[#F5E6F9] shadow-md">
      <svg viewBox="0 0 32 26" width={s} height={s} fill="none" aria-hidden="true">
        <path d="M9.5 21a5 5 0 1 1 0-10 7 7 0 0 1 13.3 2.4 4.6 4.6 0 0 1-1.2 9.1H9.5Z" stroke="#7C3AED" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M20 10l4 4M24 10l-4 4" stroke="#7C3AED" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
function ListIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 7h14" /><path d="M5 12h14" /><path d="M5 17h14" />
    </svg>
  );
}
function MicIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 12a7 7 0 0 1-14 0" /><path d="M12 19v3" />
    </svg>
  );
}
function XIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12" /><path d="M18 6 6 18" />
    </svg>
  );
}
function PlusIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}
function UserIcon({ s = 16, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function PlayIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v14l11-7-11-7Z" />
    </svg>
  );
}
function StopIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function PollIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="9" width="4" height="12" rx="1" />
      <rect x="17" y="4" width="4" height="17" rx="1" />
    </svg>
  );
}

function HashtagIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 9l3 3-3 3" />
      <path d="M20 9l-3 3 3 3" />
      <path d="M12 4v16" />
    </svg>
  );
}

function EyeIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PaperPlaneIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function ChatBubbleIcon({ s = 32, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HomeIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function MessageIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MeetIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ─── Contacts (shared with share modal) ──────────────────────────────────────

const DIRECT_MESSAGES_STORAGE_KEY = "cloudscommunity:direct-messages:v1";

type ShareContact = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({ cloudTitle, cloudUrl, onClose }: { cloudTitle: string; cloudUrl: string; onClose: () => void }) {
  const [view, setView] = useState<"main" | "contacts" | "external">("main");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<ShareContact[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const encodedText = encodeURIComponent(`Participe da Cloud "${cloudTitle}" aqui: ${cloudUrl}`);

  useEffect(() => {
    if (view !== "contacts" || contacts.length > 0 || loadingContacts) return;

    setLoadingContacts(true);
    setContactsError(null);
    fetch("/api/users/following", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Não foi possível carregar os contatos.");
        return response.json() as Promise<{ users?: ShareContact[] }>;
      })
      .then(payload => setContacts(Array.isArray(payload.users) ? payload.users : []))
      .catch(error => setContactsError(error instanceof Error ? error.message : "Não foi possível carregar os contatos."))
      .finally(() => setLoadingContacts(false));
  }, [contacts.length, loadingContacts, view]);

  const handleSendToContact = (contactId: string) => {
    setSent(prev => ({ ...prev, [contactId]: true }));
    const params = new URLSearchParams({ id: contactId, share: "cloud", url: cloudUrl, title: cloudTitle, autosend: "true" });
    window.location.assign(`/messages?${params.toString()}`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(cloudUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const externalOptions = [
    {
      label: "WhatsApp",
      color: "#25D366",
      href: `https://wa.me/?text=${encodedText}`,
      icon: (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
        </svg>
      ),
    },
    {
      label: "Instagram",
      color: "#E1306C",
      href: `https://www.instagram.com/`,
      icon: (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
        </svg>
      ),
    },
    {
      label: "Facebook",
      color: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cloudUrl)}`,
      icon: (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
    },
    {
      label: "X (Twitter)",
      color: "#000000",
      href: `https://twitter.com/intent/tweet?text=${encodedText}`,
      icon: (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.627L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
        </svg>
      ),
    },
    {
      label: "Telegram",
      color: "#229ED9",
      href: `https://t.me/share/url?url=${encodeURIComponent(cloudUrl)}&text=${encodeURIComponent(`Participe da Cloud "${cloudTitle}"!`)}`,
      icon: (
        <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-[#111116] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          {view !== "main" && (
            <button type="button" onClick={() => setView("main")} className="mr-3 text-white/40 hover:text-white transition">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          )}
          <span className="text-[16px] font-bold text-white flex-1">
            {view === "main" ? "Compartilhar Cloud" : view === "contacts" ? "Enviar para contato" : "Compartilhar fora da plataforma"}
          </span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white transition">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12" /><path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* ── Cloud title preview ── */}
        {view === "main" && (
          <div className="mx-5 mt-4 rounded-xl border border-white/[0.07] bg-[#1C1F2E] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">Cloud</p>
            <p className="text-[14px] font-semibold text-white truncate">{cloudTitle}</p>
          </div>
        )}

        {/* ── Main view: two options ── */}
        {view === "main" && (
          <div className="flex flex-col gap-3 p-5">
            {/* Mensageiro */}
            <button
              type="button"
              onClick={() => setView("contacts")}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#1C1F2E] px-5 py-4 text-left transition hover:border-[#9333EA]/40 hover:bg-[#9333EA]/10 group"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9333EA]/20 text-[#C084FC] group-hover:bg-[#9333EA]/30">
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">Enviar no mensageiro</p>
                <p className="text-[12px] text-white/45 mt-0.5">Escolha um contato da plataforma</p>
              </div>
              <svg className="ml-auto text-white/30" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>

            {/* Redes sociais */}
            <button
              type="button"
              onClick={() => setView("external")}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#1C1F2E] px-5 py-4 text-left transition hover:border-[#3B82F6]/40 hover:bg-[#3B82F6]/10 group"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]/15 text-[#93C5FD] group-hover:bg-[#3B82F6]/25">
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">Enviar para fora</p>
                <p className="text-[12px] text-white/45 mt-0.5">WhatsApp, Instagram, Facebook e mais</p>
              </div>
              <svg className="ml-auto text-white/30" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>

            {/* Copy link */}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-white/50 transition hover:bg-white/[0.04] hover:text-white/80"
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {copied ? "? Link copiado!" : "Copiar link"}
            </button>
          </div>
        )}

        {/* ── Contacts view ── */}
        {view === "contacts" && (
          <div className="p-4">
            <p className="mb-3 px-1 text-[12px] text-white/40">Selecione quem deve receber o link desta Cloud:</p>
            {loadingContacts ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-white/50">
                Carregando contatos...
              </div>
            ) : contactsError ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-white/50">
                {contactsError}
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-white/50">
                Você ainda não segue ninguém
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {contacts.map(contact => (
                  <div key={contact.id} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.04]">
                    <div className="relative shrink-0">
                      {contact.avatarUrl ? (
                        <img 
                          src={contact.avatarUrl} 
                          alt={contact.displayName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold text-white"
                          style={{ backgroundColor: avatarColor(contact.username) }}>
                          {contact.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{contact.displayName}</p>
                      <p className="text-[11px] text-white/40">@{contact.username}</p>
                    </div>
                    {sent[contact.id] ? (
                      <span className="text-[12px] font-semibold text-[#22C55E] flex items-center gap-1">
                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>
                        Enviado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendToContact(contact.id)}
                        className="shrink-0 rounded-full bg-[#9333EA] px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#7C3AED]"
                      >
                        Enviar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── External view ── */}
        {view === "external" && (
          <div className="p-5">
            <p className="mb-4 text-[12px] text-white/40">Compartilhe o convite desta Cloud nas redes sociais:</p>
            <div className="grid grid-cols-2 gap-3">
              {externalOptions.map(opt => (
                <a
                  key={opt.label}
                  href={opt.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {}}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#1C1F2E] px-4 py-3 text-[13px] font-semibold text-white transition hover:border-white/20 hover:bg-[#252840]"
                >
                  <span style={{ color: opt.color }}>{opt.icon}</span>
                  {opt.label}
                </a>
              ))}
            </div>
            {/* Copy link */}
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-[13px] font-medium text-white/50 transition hover:border-white/20 hover:text-white/80"
            >
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {copied ? "? Link copiado!" : "Copiar link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cloud Card ───────────────────────────────────────────────────────────────

function CloudCard({ cloud, onHypar }: { cloud: Cloud; onHypar: (newCount: number, wasHyped: boolean) => void }) {
  const [hyped, setHyped] = useState(cloud.hyped ?? false);
  const [hypes, setHypes] = useState(cloud.hypes ?? 0);
  const [hypeLoading, setHypeLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const siteOrigin = useSiteOrigin();

  const shareUrl = cloud.href ?? `/cloud/${cloud.id}`;
  const fullShareUrl = `${siteOrigin}${shareUrl}`;  const durationSeconds = parseDurationSeconds(cloud.duration);
  const elapsedSeconds = Math.floor((Date.now() - cloud.createdAt.getTime()) / 1000);
  const remainingSeconds = Math.max(durationSeconds - elapsedSeconds, 0);
  const isLive = remainingSeconds > 0;
  const countdownLabel = formatCountdown(remainingSeconds);
  const timeAgo = (() => {
    const diff = Math.floor((Date.now() - cloud.createdAt.getTime()) / 1000);
    if (diff < 60) return "agora mesmo";
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    return `${Math.floor(diff / 3600)}h atrás`;
  })();

  const handleHypar = async () => {
    if (hypeLoading) return;
    setHypeLoading(true);
    const wasHyped = hyped;
    setHyped(!wasHyped);
    setHypes(v => wasHyped ? v - 1 : v + 1);
    try {
      const res = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/hype`, {
        method: wasHyped ? "DELETE" : "POST",
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { hypesCount?: number } | null;
        const newCount = data?.hypesCount ?? (wasHyped ? hypes - 1 : hypes + 1);
        setHypes(newCount);
        onHypar(newCount, wasHyped);
      } else {
        setHyped(wasHyped);
        setHypes(v => wasHyped ? v + 1 : v - 1);
      }
    } catch {
      setHyped(wasHyped);
      setHypes(v => wasHyped ? v + 1 : v - 1);
    } finally {
      setHypeLoading(false);
    }
  };

  return (
    <article className="cloud-card w-full rounded-2xl border border-white/[0.08] bg-[#111116] px-6 py-5 transition hover:border-white/20">

      {/* Top row: live indicator + countdown */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ backgroundColor: isLive ? "#22C55E" : "#F87171", opacity: 0.7 }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: isLive ? "#22C55E" : "#F87171" }} />
          </span>
          <span className={isLive ? "text-[#22C55E]" : "text-[#F87171]"}>
            {isLive ? "AO VIVO" : "ENCERRADA"} - {cloud.duration}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/60">
            {isLive ? countdownLabel : "00:00"}
          </span>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${cloud.visibility === "public" ? "bg-[#2563EB]/10 text-[#93C5FD]" : "bg-[#7C3AED]/10 text-[#E9D5FF]"}`}>
          {cloud.visibility === "public" ? "Público" : "Privado"}
        </span>
      </div>

      {/* Title */}
      <h2 className="mt-4 text-[20px] font-semibold text-white leading-snug">{cloud.title}</h2>

      {cloud.description && (
        <p className="mt-2 text-[14px] leading-relaxed text-white/60 line-clamp-3">
          {cloud.description}
        </p>
      )}

      {/* Audio player - waveform real */}
      {cloud.mode === "audio" && cloud.audioUrl && (
        <div className="mt-4">
          <AudioWaveformPlayer src={cloud.audioUrl} peaks={cloud.audioPeaks} isOwn={false} roundedCorner="left" />
        </div>
      )}

      {/* Footer: action buttons */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">

        {/* Left - reaction buttons */}
        <div className="flex items-center gap-2">

          {/* Hypar */}
          <button
            type="button"
            onClick={handleHypar}
            aria-label="Hypar"
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
              hyped
                ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                : "border-white/10 bg-white/5 text-white/70 hover:border-orange-500/40 hover:text-orange-400"
            }`}
          >
            <FireIcon s={24} />
            {hypes > 0 && <span>{hypes}</span>}
          </button>

          {/* Compartilhar */}
          {shareOpen && (
            <ShareModal
              cloudTitle={cloud.title}
              cloudUrl={fullShareUrl}
              onClose={() => setShareOpen(false)}
            />
          )}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Compartilhar"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white/70 hover:border-[#9333EA]/50 hover:text-[#C084FC] transition"
          >
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7Z" />
            </svg>
            Compartilhar
          </button>
        </div>

        {/* Right — enter */}
        <Link
          href={`${cloud.href ?? `/cloud/${cloud.id}`}?title=${encodeURIComponent(cloud.title)}&duration=${encodeURIComponent(cloud.duration)}&createdAt=${encodeURIComponent(cloud.createdAt.toISOString())}&participants=${cloud.liveParticipants ?? 1}&visibility=${encodeURIComponent(cloud.visibility ?? "public")}`}
          className="inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED]"
        >
          Entrar na conversa
        </Link>
      </div>
    </article>
  );
}

// ─── Create Cloud Modal ───────────────────────────────────────────────────────

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

export function CreateCloudModal({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: (cloud: Omit<Cloud, "id" | "createdAt" | "mode">) => Promise<Cloud>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFollowersPopup, setShowFollowersPopup] = useState(false);
  const [followers, setFollowers] = useState<Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }>>([]);
  const [selectedFollowers, setSelectedFollowers] = useState<Set<string>>(new Set());
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [followersError, setFollowersError] = useState<string | null>(null);
  const isPrivateVisibility = visibility === "private";

  const fetchFollowers = async () => {
    setLoadingFollowers(true);
    setFollowersError(null);
    try {
      const response = await fetch("/api/users/following", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch followers");
      const data = await response.json();
      setFollowers(data.users || []);
    } catch (err) {
      setFollowersError("Não foi possível carregar seus seguidores.");
    } finally {
      setLoadingFollowers(false);
    }
  };

  const handleVisibilityChange = (option: "public" | "private") => {
    setVisibility(option);
    if (option === "private") {
      setShowFollowersPopup(true);
      fetchFollowers();
    } else {
      setShowFollowersPopup(false);
      setSelectedFollowers(new Set());
    }
  };

  const toggleFollowerSelection = (followerId: string) => {
    setSelectedFollowers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(followerId)) {
        newSet.delete(followerId);
      } else {
        newSet.add(followerId);
      }
      return newSet;
    });
  };

  const handlePublishPrivate = async () => {
    if (!title.trim()) {
      setError("Por favor, forneça um título para a cloud.");
      return;
    }

    if (!duration) {
      setError("Selecione uma duração para a cloud.");
      return;
    }

    if (selectedFollowers.size === 0) {
      setError("Selecione ao menos um contato para a cloud privada.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const invitedUserIds = Array.from(selectedFollowers);
      const cloudData = {
        title: title.trim(),
        category: "general",
        description: description.trim() || undefined,
        duration: duration.trim(),
        visibility: "private" as const,
        invitedUserIds,
      };

      // Criar cloud privada com os usuários convidados como membros
      const publishedCloud = await onPublish(cloudData);
      
      // Enviar convites para os seguidores selecionados
      await sendCloudInvitations(cloudData, publishedCloud.id);
      
      onClose();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Não foi possível criar a cloud privada.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();

    if (!normalizedTitle) {
      setError("Informe um título para a cloud.");
      return;
    }

    if (!duration) {
      setError("Selecione uma duração para a cloud.");
      return;
    }

    if (visibility === "private") {
      setError("Para clouds privadas, clique em 'Confirmar convidados' para criar.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const cloudData = {
        title: normalizedTitle,
        category: "general",
        description: normalizedDescription || undefined,
        duration: duration.trim(),
        visibility,
      };

      const publishedCloud = await onPublish(cloudData);
      onClose();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Nao foi possivel criar a cloud.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendCloudInvitations = async (cloudData: { title: string; duration: string; visibility: string }, cloudId: string) => {
    const followerIds = Array.from(selectedFollowers);

    // For private clouds, generate an invite token first so recipients go through /invite/[token]
    let inviteToken: string | null = null;
    if (cloudData.visibility === "private") {
      try {
        const tokenRes = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/invite`, {
          method: "POST",
          credentials: "include",
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json().catch(() => null) as { invite?: { token: string } } | null;
          inviteToken = tokenData?.invite?.token ?? null;
        }
      } catch {
        // non-critical — fall back to direct cloud URL
      }
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "https://clouds.community";
    const shareUrl = inviteToken
      ? `${origin}/invite/${inviteToken}`
      : `${origin}/cloud/${cloudId}`;

    for (const followerId of followerIds) {
      try {
        // Create conversation with follower
        const conversationResponse = await fetch("/api/direct-messages/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ peerUserId: followerId }),
        });

        if (!conversationResponse.ok) {
          const errorText = await conversationResponse.text();
          console.error(`Failed to create conversation with ${followerId}:`, conversationResponse.statusText, errorText);
          continue;
        }

        const conversationData = await conversationResponse.json();
        
        // Handle different response formats
        const conversationId = conversationData.id || conversationData.conversation?.id;
        
        if (!conversationId) {
          console.error(`No conversation ID found in response for ${followerId}:`, conversationData);
          continue;
        }

        const invitationContent = JSON.stringify({
          type: "cloud_invitation",
          cloudId: cloudId,
          inviteToken: inviteToken ?? null,
          cloudTitle: cloudData.title,
          cloudDuration: cloudData.duration,
          cloudVisibility: cloudData.visibility,
        });

        const messageResponse = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: shareUrl,
            label: invitationContent,
            clientMessageId: `invitation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          }),
        });

        if (!messageResponse.ok) {
          const errorText = await messageResponse.text();
          console.error(`Failed to send invitation to ${followerId}:`, messageResponse.statusText, errorText);
        }
      } catch (error) {
        console.error(`Error sending invitation to ${followerId}:`, error);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-[480px] rounded-2xl bg-[#1C1F2E] border border-white/10 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-bold text-white">Criar nova Cloud</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><XIcon s={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Título</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !isPrivateVisibility && handlePublish()}
              placeholder="Título da sua Cloud..."
              className="w-full rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#9333EA] transition"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="Conte sobre o assunto, contexto ou objetivo da Cloud..."
              rows={7}
              className="w-full rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#9333EA] transition resize-none"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-white/35">
              <span>Até 2000 caracteres.</span>
              <span>{description.length}/2000</span>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Duração</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
                    duration === d
                      ? "bg-[#9333EA] text-white border border-[#9333EA]"
                      : "bg-[#252840] border border-white/[0.08] text-white/60 hover:border-[#9333EA] hover:text-white"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Visibilidade</label>
            <div className="flex gap-2 flex-wrap">
              {(["public", "private"] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleVisibilityChange(option)}
                  className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
                    visibility === option
                      ? "bg-[#9333EA] text-white border border-[#9333EA]"
                      : "bg-[#252840] border border-white/[0.08] text-white/60 hover:border-[#9333EA] hover:text-white"
                  }`}
                >
                  {option === "public" ? "Público" : "Privado"}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handlePublish}
            disabled={isPrivateVisibility || !title.trim() || !duration || submitting}
            className={`w-full rounded-full py-3 text-[15px] font-semibold transition mt-2 ${
              isPrivateVisibility
                ? "bg-[#3B3048] text-white/40 cursor-not-allowed opacity-70"
                : "bg-[#9333EA] text-white hover:bg-[#7C3AED] disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {isPrivateVisibility ? "Cloud privada - confirme convidados" : (submitting ? "Publicando..." : "Publicar Cloud")}
          </button>
          {error && <p className="text-[12px] text-red-300">{error}</p>}
        </div>
      </div>

      {/* Followers Popup */}
      {showFollowersPopup && (
        <div className="absolute right-0 top-0 w-[420px] rounded-2xl bg-[#1C1F2E] border border-white/10 p-6 shadow-2xl z-50" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-bold text-white">Convidar seguidores</h3>
            <button 
              onClick={() => setShowFollowersPopup(false)}
              className="text-white/40 hover:text-white p-1"
            >
              <XIcon s={16} />
            </button>
          </div>
          
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <span className="text-[13px] text-white/60">Participantes: {selectedFollowers.size}</span>
            <button
              onClick={async () => {
                if (selectedFollowers.size === 0 || submitting) return;

                setShowFollowersPopup(false);
                onClose();
                
                // Para clouds privadas, não publicar no feed, apenas criar
                if (visibility === "private") {
                  await handlePublishPrivate();
                } else {
                  await handlePublish();
                }
              }}
              disabled={selectedFollowers.size === 0 || submitting}
              className="px-4 py-2 rounded-full bg-[#9333EA] text-white text-[13px] font-medium hover:bg-[#7C3AED] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Criando..." : "Confirmar convidados"}
            </button>
          </div>

          {loadingFollowers ? (
            <p className="text-[13px] text-white/50 text-center py-4">Carregando seguidores...</p>
          ) : followersError ? (
            <p className="text-[13px] text-red-300 text-center py-4">{followersError}</p>
          ) : followers.length === 0 ? (
            <p className="text-[13px] text-white/50 text-center py-4">Você ainda não segue ninguém.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {followers.map(follower => (
                <div 
                  key={follower.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#252840] border border-white/[0.08] hover:border-white/20 transition"
                >
                  <div className="flex items-center gap-3">
                    {follower.avatarUrl ? (
                      <img 
                        src={follower.avatarUrl} 
                        alt={follower.displayName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#A855F7] flex items-center justify-center text-sm font-semibold text-white">
                        {follower.displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-[14px] font-semibold text-white">{follower.displayName}</p>
                      <p className="text-[12px] text-white/50">@{follower.username}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollowerSelection(follower.id)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ${
                      selectedFollowers.has(follower.id)
                        ? "bg-[#9333EA] text-white"
                        : "bg-white/10 text-white/60 hover:bg-white/20"
                    }`}
                  >
                    {selectedFollowers.has(follower.id) ? "Convidado" : "Convidar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Record Audio Modal ───────────────────────────────────────────────────────

function RecordAudioModal({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: (cloud: Omit<Cloud, "id" | "createdAt" | "mode">) => void;
}) {
  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPeaks, setAudioPeaks] = useState<number[] | null>(null);
  const [category, setCategory] = useState(CATEGORIES[1].name);
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const peaksRef = useRef<number[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      peaksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("done");
        // build waveform from captured peaks
        const raw = peaksRef.current.length ? peaksRef.current : [0.3];
        const max = Math.max(...raw, 0.0001);
        const normalized = raw.map(v => Math.max(0.05, v / max));
        if (normalized.length > 40) {
          const out: number[] = [];
          const chunk = normalized.length / 40;
          for (let i = 0; i < 40; i++) {
            const start = Math.floor(i * chunk);
            const end = Math.max(start + 1, Math.floor((i + 1) * chunk));
            let sum = 0;
            for (let j = start; j < end; j++) sum += normalized[j];
            out.push(sum / (end - start));
          }
          setAudioPeaks(out);
        } else {
          setAudioPeaks(normalized);
        }
        // cleanup audio graph
        if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
        if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch { /* ignore */ } sourceRef.current = null; }
        if (audioCtxRef.current) { try { void audioCtxRef.current.close(); } catch { /* ignore */ } audioCtxRef.current = null; }
        analyserRef.current = null;
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRef.current = recorder;
      setSeconds(0);
      setStatus("recording");
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);

      // capture waveform live
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
      } catch {
        peaksRef.current = [];
      }
    } catch {
      setError("Permissão de microfone negada. Verifique as configurações do navegador.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch { /* ignore */ } }
    if (audioCtxRef.current) { try { void audioCtxRef.current.close(); } catch { /* ignore */ } }
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handlePublish = () => {
    if (!audioUrl) return;
    if (!duration) {
      setError("Selecione uma duração para a cloud.");
      return;
    }
    onPublish({ title: `Áudio - ${fmt(seconds)}`, category, duration, visibility, audioUrl, audioPeaks: audioPeaks ?? undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-[420px] rounded-2xl bg-[#1C1F2E] border border-white/10 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-bold text-white">Gravar Áudio</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><XIcon s={18} /></button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-900/40 border border-red-500/30 px-4 py-3 text-[13px] text-red-300">{error}</div>
        )}

        <div className="flex flex-col items-center gap-5">
          {/* Timer */}
          <div className={`flex h-24 w-24 items-center justify-center rounded-full border-2 transition-all ${
            status === "recording"
              ? "border-red-500 bg-red-500/10 animate-pulse"
              : status === "done"
              ? "border-[#22C55E] bg-[#22C55E]/10"
              : "border-[#9333EA] bg-[#9333EA]/10"
          }`}>
            {status === "recording" ? (
              <span className="text-[22px] font-mono font-bold text-red-400">{fmt(seconds)}</span>
            ) : status === "done" ? (
              <span className="text-[13px] font-semibold text-[#22C55E]">Gravado!</span>
            ) : (
              <MicIcon s={36} />
            )}
          </div>

          {/* Audio preview - waveform real */}
          {audioUrl && (
            <AudioWaveformPlayer src={audioUrl} peaks={audioPeaks ?? undefined} isOwn={false} roundedCorner="left" />
          )}

          {/* Category + Duration when done */}
          {status === "done" && (
            <div className="w-full space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">Categoria</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-2.5 text-[14px] text-white outline-none focus:border-[#9333EA]"
                >
                  {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">Duração no feed</label>
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map(d => (
                    <button key={d} type="button" onClick={() => setDuration(d)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                        duration === d ? "bg-[#9333EA] text-white" : "bg-[#252840] border border-white/[0.08] text-white/60 hover:text-white"
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">Visibilidade</label>
                <div className="flex gap-2 flex-wrap">
                  {(["public", "private"] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setVisibility(option)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                        visibility === option ? "bg-[#9333EA] text-white" : "bg-[#252840] border border-white/[0.08] text-white/60 hover:text-white"
                      }`}
                    >
                      {option === "public" ? "Público" : "Privado"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex w-full gap-3">
            {status === "idle" && (
              <button onClick={startRecording}
                className="flex-1 rounded-full bg-[#9333EA] py-3 text-[15px] font-semibold text-white hover:bg-[#7C3AED] transition flex items-center justify-center gap-2">
                <MicIcon s={18} /> Iniciar gravação
              </button>
            )}
            {status === "recording" && (
              <button onClick={stopRecording}
                className="flex-1 rounded-full bg-red-600 py-3 text-[15px] font-semibold text-white hover:bg-red-700 transition flex items-center justify-center gap-2">
                <StopIcon s={18} /> Parar
              </button>
            )}
            {status === "done" && (
              <>
                <button onClick={startRecording}
                  className="flex-1 rounded-full bg-[#252840] py-3 text-[14px] font-semibold text-white/70 hover:text-white transition">
                  Regravar
                </button>
                <button onClick={handlePublish}
                  className="flex-1 rounded-full bg-[#9333EA] py-3 text-[14px] font-semibold text-white hover:bg-[#7C3AED] transition">
                  Publicar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Poll Card ────────────────────────────────────────────────────────────────

function PollCard({ poll, onVote }: { poll: Poll; onVote: (pollId: string, optionId: string) => void }) {
  const cat = CATEGORIES.find(c => c.name === poll.category) ?? CATEGORIES[1];
  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
  const timeAgo = (() => {
    const diff = Math.floor((Date.now() - poll.createdAt.getTime()) / 1000);
    if (diff < 60) return "agora mesmo";
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    return `${Math.floor(diff / 3600)}h atrás`;
  })();

  return (
    <article className="w-full rounded-2xl border border-white/[0.08] bg-[#111116] px-6 py-5 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold text-white"
            style={{ backgroundColor: cat.bg, color: cat.color ?? "#fff" }}>
            {poll.category.toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1730] px-3 py-1 text-[11px] font-semibold text-[#C084FC]">
            <PollIcon s={12} /> ENQUETE
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#22C55E]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
          </span>
          AO VIVO - {poll.duration}
        </div>
      </div>

      <h2 className="text-[20px] font-bold text-white leading-snug mb-4">{poll.question}</h2>

      <div className="flex flex-col gap-3">
        {poll.options.map(opt => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const isVoted = poll.votedOptionId === opt.id;
          const hasVoted = poll.votedOptionId !== null;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={hasVoted}
              onClick={() => onVote(poll.id, opt.id)}
              className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition ${
                isVoted
                  ? "border-[#9333EA] bg-[#9333EA]/15"
                  : hasVoted
                  ? "border-white/[0.06] bg-[#1C1F2E] cursor-default"
                  : "border-white/[0.08] bg-[#1C1F2E] hover:border-[#9333EA]/50 hover:bg-[#9333EA]/10"
              }`}
            >
              {/* Progress bar */}
              {hasVoted && (
                <span
                  className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: isVoted ? "rgba(147,51,234,0.25)" : "rgba(255,255,255,0.04)" }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className={`text-[14px] font-medium ${isVoted ? "text-[#C084FC]" : "text-white"}`}>{opt.text}</span>
                {hasVoted && (
                  <span className={`text-[13px] font-bold ${isVoted ? "text-[#C084FC]" : "text-white/40"}`}>{pct}%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-4">
        <span className="text-[12px] text-white/40">
          {totalVotes} {totalVotes === 1 ? "voto" : "votos"} - publicado {timeAgo}
        </span>
        {poll.votedOptionId && (
          <span className="text-[12px] text-[#22C55E]">? Você votou</span>
        )}
      </div>
    </article>
  );
}

// ─── Create Poll Modal ────────────────────────────────────────────────────────

function CreatePollModal({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: (poll: Omit<Poll, "id" | "createdAt" | "votedOptionId">) => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [category, setCategory] = useState(CATEGORIES[1].name);
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [error, setError] = useState<string | null>(null);

  const addOption = () => { if (options.length < 6) setOptions(o => [...o, ""]); };
  const removeOption = (i: number) => { if (options.length > 2) setOptions(o => o.filter((_, idx) => idx !== i)); };
  const updateOption = (i: number, val: string) => setOptions(o => o.map((v, idx) => idx === i ? val : v));

  const canPublish = question.trim() && options.filter(o => o.trim()).length >= 2 && duration;

  const handlePublish = () => {
    if (!canPublish) return;
    if (!duration) {
      setError("Selecione uma duração para a enquete.");
      return;
    }
    onPublish({
      question: question.trim(),
      options: options.filter(o => o.trim()).map(text => ({ id: crypto.randomUUID(), text, votes: 0 })),
      category,
      duration,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-[500px] rounded-2xl bg-[#1C1F2E] border border-white/10 p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9333EA]/20 text-[#C084FC]">
              <PollIcon s={16} />
            </span>
            <h2 className="text-[18px] font-bold text-white">Criar Enquete</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><XIcon s={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Question */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">
              Pergunta <span className="text-white/30 normal-case">({question.length}/120)</span>
            </label>
            <input
              autoFocus
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value.slice(0, 120))}
              placeholder="O que você quer perguntar?"
              className="w-full rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#9333EA] transition"
            />
          </div>

          {/* Options */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">
              Opções <span className="text-white/30 normal-case">(mín. 2, máx. 6)</span>
            </label>
            <div className="flex flex-col gap-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#252840] text-[11px] font-bold text-white/50">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={e => updateOption(i, e.target.value)}
                    placeholder={`Opção ${String.fromCharCode(65 + i)}`}
                    className="flex-1 rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-2.5 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#9333EA] transition"
                  />
                  {options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/30 hover:bg-red-500/20 hover:text-red-400 transition">
                      <XIcon s={14} />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button type="button" onClick={addOption}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-2.5 text-[13px] text-white/40 hover:border-[#9333EA]/50 hover:text-[#C084FC] transition">
                  <PlusIcon s={14} /> Adicionar opção
                </button>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-3 text-[14px] text-white outline-none focus:border-[#9333EA] transition">
              {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Duração</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button key={d} type="button" onClick={() => setDuration(d)}
                  className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
                    duration === d ? "bg-[#9333EA] text-white" : "bg-[#252840] border border-white/[0.08] text-white/60 hover:border-[#9333EA] hover:text-white"
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handlePublish} disabled={!canPublish}
            className="w-full rounded-full bg-[#9333EA] py-3 text-[15px] font-semibold text-white hover:bg-[#7C3AED] transition disabled:opacity-40 disabled:cursor-not-allowed">
            Publicar Enquete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Other Modals ─────────────────────────────────────────────────────────────

type SearchResult = {
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
  }>;
  clouds: Cloud[];
};

function SearchModal({ onClose, feedClouds }: { onClose: () => void; feedClouds: Cloud[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("cloudscommunity:search-history") ?? "[]");
      if (Array.isArray(stored)) setHistory(stored.filter((item): item is string => typeof item === "string").slice(0, 6));
    } catch {
      setHistory([]);
    }
  }, []);

  const saveSearch = (value: string) => {
    const term = value.trim();
    if (!term) return;
    setHistory((current) => {
      const next = [term, ...current.filter((item) => item.toLocaleLowerCase() !== term.toLocaleLowerCase())].slice(0, 6);
      localStorage.setItem("cloudscommunity:search-history", JSON.stringify(next));
      return next;
    });
  };

  const clearHistory = () => {
    localStorage.removeItem("cloudscommunity:search-history");
    setHistory([]);
  };

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const usersRes = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}&limit=5`);
        const usersPayload = usersRes.ok ? (await usersRes.json().catch(() => null)) : null;
        const users: SearchResult["users"] = Array.isArray(usersPayload?.users)
          ? usersPayload.users.slice(0, 5).map((u: { id: string; username: string; displayName: string; avatarUrl: string | null; bio: string | null }) => ({
              id: u.id,
              username: u.username,
              displayName: u.displayName,
              avatarUrl: u.avatarUrl,
              bio: u.bio,
            }))
          : [];

        const lowerTrimmed = trimmed.toLowerCase();
        const matchedClouds = feedClouds
          .filter(
            (c) =>
              c.title.toLowerCase().includes(lowerTrimmed) ||
              (c.description ?? "").toLowerCase().includes(lowerTrimmed) ||
              (c.authorHandle ?? "").toLowerCase().includes(lowerTrimmed) ||
              (c.authorName ?? "").toLowerCase().includes(lowerTrimmed)
          )
          .slice(0, 5);

        setResults({ users, clouds: matchedClouds });
      } catch {
        setResults({ users: [], clouds: [] });
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, feedClouds]);

  const hasResults = results && (results.users.length > 0 || results.clouds.length > 0);
  const showEmpty = results && !hasResults && !loading;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-[560px] rounded-2xl bg-[#1C1F2E] border border-white/10 p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 rounded-xl bg-[#252840] px-4 py-3">
          <SearchIcon s={18} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveSearch(query); }}
            placeholder="Buscar clouds, pessoas..."
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none"
          />
          {loading ? (
            <span className="text-white/30">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            </span>
          ) : query ? (
            <button onClick={() => setQuery("")} className="text-white/40 hover:text-white"><XIcon s={16} /></button>
          ) : (
            <button onClick={onClose} className="text-white/40 hover:text-white"><XIcon s={16} /></button>
          )}
        </div>

        {/* Results */}
        {hasResults && (
          <div className="mt-3 flex flex-col gap-1 max-h-[420px] overflow-y-auto">
            {results.users.length > 0 && (
              <div>
                <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">Pessoas</p>
                {results.users.map(user => (
                  <button
                    key={user.id}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.06] transition"
                    onClick={() => { saveSearch(query); router.push(`/users/${user.id}`); onClose(); }}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#A855F7] text-[13px] font-bold text-white overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                      ) : (
                        user.displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white">{user.displayName}</p>
                      <p className="truncate text-[12px] text-white/40">@{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {results.clouds.length > 0 && (
              <div className={results.users.length > 0 ? "mt-1" : ""}>
                <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">Clouds</p>
                {results.clouds.map(cloud => (
                  <button
                    key={cloud.id}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.06] transition"
                    onClick={() => {
                      saveSearch(query);
                      const params = new URLSearchParams({
                        title: cloud.title,
                        duration: cloud.duration,
                        createdAt: cloud.createdAt.toISOString(),
                        participants: String(cloud.liveParticipants ?? 1),
                      });
                      router.push(`/cloud/${cloud.id}?${params.toString()}`);
                      onClose();
                    }}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#252840] text-white/60">
                      <CloudIcon s={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-white">{cloud.title}</p>
                      {cloud.authorHandle && (
                        <p className="truncate text-[12px] text-white/40">@{cloud.authorHandle}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showEmpty && (
          <div className="mt-6 pb-3 text-center text-[13px] text-white/30">
            Nenhum resultado para <span className="text-white/50">&ldquo;{query}&rdquo;</span>
          </div>
        )}

        {!query && (
          <div className="mt-3">
            {history.length > 0 ? (
              <>
                <div className="mb-2 flex items-center justify-between px-1"><p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Pesquisas recentes</p><button type="button" onClick={clearHistory} className="text-[11px] font-medium text-[#C084FC] transition hover:text-white">Limpar</button></div>
                <div className="flex flex-wrap gap-2">
                  {history.map((term) => <button key={term} type="button" onClick={() => setQuery(term)} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/65 transition hover:border-[#A855F7]/45 hover:bg-[#A855F7]/10 hover:text-white"><svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>{term}</button>)}
                </div>
              </>
            ) : <p className="px-1 text-[12px] text-white/30">Suas pesquisas recentes aparecerão aqui.</p>}
            <p className="mt-4 px-1 text-[12px] text-white/30">Pressione ESC para fechar</p>
          </div>
        )}
      </div>
    </div>
  );
}



function ProfileMenu({ onClose }: { onClose: () => void }) {
  const { user } = useSessionUser();
  const displayName = getSessionUserDisplayName(user);
  const handle = getSessionUserHandle(user);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return;
      }

      router.replace("/login");
      router.refresh();
      onClose();
    } catch {
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute right-4 top-[96px] w-[220px] rounded-2xl bg-[#1C1F2E] border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <SessionUserAvatar user={user} size={40} />
            <div>
              <p className="text-[14px] font-semibold text-white">{displayName}</p>
              <p className="text-[12px] text-white/40">{handle}</p>
            </div>
          </div>
        </div>        <button className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-white/80 hover:bg-white/[0.05] hover:text-white transition">
          <span className="text-white/50"><UserIcon s={16} /></span> Meu Perfil
        </button>
        <button className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-white/80 hover:bg-white/[0.05] hover:text-white transition">
          <span className="text-white/50"><GearIcon s={16} /></span> Configurações
        </button>
        <div className="border-t border-white/[0.07]">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-red-400 hover:bg-white/[0.05] transition">
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicHypeButton({ cloud, onHypar }: { cloud: Cloud; onHypar?: (newCount: number, wasHyped: boolean) => void }) {
  const [hyped, setHyped] = useState(cloud.hyped ?? false);
  const [hypes, setHypes] = useState(cloud.hypes ?? 0);
  const [loading, setLoading] = useState(false);

  const handleHype = async () => {
    if (loading) return;
    setLoading(true);
    const wasHyped = hyped;
    setHyped(!wasHyped);
    setHypes(v => wasHyped ? v - 1 : v + 1);
    try {
      const res = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/hype`, {
        method: wasHyped ? "DELETE" : "POST",
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { hypesCount?: number } | null;
        const newCount = data?.hypesCount ?? (wasHyped ? hypes - 1 : hypes + 1);
        setHypes(newCount);
        onHypar?.(newCount, wasHyped);
      } else {
        setHyped(wasHyped);
        setHypes(v => wasHyped ? v + 1 : v - 1);
      }
    } catch {
      setHyped(wasHyped);
      setHypes(v => wasHyped ? v + 1 : v - 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleHype}
      className={`inline-flex items-center gap-3 transition disabled:opacity-60 ${hyped ? "text-orange-400" : "hover:text-orange-300"}`}
    >
      <FireIcon s={24} className={hyped ? "text-orange-400" : "text-[#FF632D]"} />
      <span>{hypes}</span>
    </button>
  );
}

function TopicFeedStage({
  clouds,
  expandedTopicId,
  onToggleExpand,
  onEnterConversation,
  onCreateCloud,
  currentUserId,
}: {
  clouds: Cloud[];
  expandedTopicId: string | null;
  onToggleExpand: (cloudId: string) => void;
  onEnterConversation: (cloud: Cloud) => void;
  onCreateCloud: () => void;
  currentUserId?: string;
}) {
  const [shareTarget, setShareTarget] = useState<Cloud | null>(null);
  const siteOrigin = useSiteOrigin();

  return (
    <>
      <div className="topic-scroll flex h-full flex-col gap-4 overflow-y-auto py-4 pr-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">
          <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
          Ao vivo agora
        </div>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-[#111116] px-4 text-[13px] font-semibold text-white/80 transition hover:border-white/20 hover:bg-[#16161C]"
        >
          Todos os tópicos
          <ChevronRightIcon />
        </button>
      </div>

      {clouds.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-[#1C1F2E]">
            <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-white/30" aria-hidden="true">
              <path d="M6 16H5.5a3.5 3.5 0 0 1 0-7 .5.5 0 0 1 .1 0A5 5 0 0 1 15 9.5a3 3 0 0 1 0 6H8" />
              <path d="M8 16c0 1.5-.5 2.5-1.5 3.5C7.5 19 9 18 9.5 16" />
            </svg>
          </div>
          <div>
            <p className="text-[18px] font-semibold text-white">Nenhum tópico disponível</p>
            <p className="mt-2 max-w-[340px] text-[14px] text-white/50">
              Ainda não há tópicos ativos. Quando alguém publicar, eles aparecem aqui primeiro.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateCloud}
            className="inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#7C3AED]"
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Criar uma Cloud
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          {clouds
            .map((cloud, index) => ({
              cloud,
              index,
              profile: getTopicProfile(cloud, index),
              remaining: getTopicCountdown(cloud),
            }))
            .map(({ cloud, profile, remaining }) => {
              const isEnded = remaining <= 0;
              const isEndingSoon = remaining > 0 && remaining < 5 * 60;
              const expanded = expandedTopicId === cloud.id;
              const hours = Math.floor(remaining / 3600);
              const minutes = Math.floor((remaining % 3600) / 60);
              const seconds = remaining % 60;
              const createdLabel = "há pouco";
              const participantAvatars = profile.avatar ? [profile.avatar] : [];
              const participantLabel = profile.participants >= 1000
                ? `${(profile.participants / 1000).toFixed(1).replace(".0", "")}K participantes`
                : `${profile.participants} participantes`;

              return (
                <article
                  key={cloud.id}
                  className="cloud-card rounded-[22px] bg-[radial-gradient(circle_at_78%_42%,rgba(74,25,70,0.16),transparent_26%),linear-gradient(135deg,#0D1018,#08090E_62%)] px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] transition md:px-7 md:py-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Link href={`/users/${profile.handle.replace(/^@/, "")}`} className="shrink-0">
                        {profile.avatar ? (
                          <img
                            src={profile.avatar}
                            alt={profile.name}
                            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/15 md:h-14 md:w-14"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7C3AED] text-lg font-bold text-white ring-1 ring-white/15 md:h-14 md:w-14">
                            {profile.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </Link>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/users/${profile.handle.replace(/^@/, "")}`} className="truncate text-[15px] font-semibold text-white hover:underline md:text-[17px]">
                            @{profile.handle.replace(/^@/, "")}
                          </Link>
                          <span className="rounded-full border border-[#A855F7]/70 px-2.5 py-0.5 text-[12px] font-medium text-[#C084FC]">Criador</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-white/50 md:text-[13px]">{createdLabel}</p>
                      </div>
                    </div>
                    <button type="button" aria-label="Mais opções" className="rounded-full p-2 text-[20px] leading-none text-white transition hover:bg-white/10">
                      ?
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_285px] lg:items-center">
                    <div className="min-w-0">
                      <h3 className="text-[26px] font-extrabold leading-[1.08] tracking-[-0.04em] text-white md:text-[31px]">
                        {cloud.title}
                      </h3>
                      {expanded ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-6 text-white/65 md:text-[16px]">
                          {profile.description}
                        </p>
                      ) : (
                        <p className="mt-2 line-clamp-2 text-[15px] leading-6 text-white/65 md:text-[16px]">
                          {profile.description}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleExpand(cloud.id)}
                        className="mt-2 inline-flex items-center gap-2 text-[14px] font-medium text-[#C084FC] transition hover:text-[#DDD6FE] md:text-[15px]"
                      >
                        {expanded ? "Ler menos" : "Ler mais"}
                        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={expanded ? "rotate-180 transition-transform" : "transition-transform"}>
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                    </div>

                    <div className="lg:pb-0.5">
                      <p className="text-center text-[13px] text-white/65 md:text-[15px]">{isEnded ? "Encerrada" : "Encerra em"}</p>
                      {isEnded ? (
                        <p className="mt-2 text-center text-[38px] font-semibold tracking-[0.14em] text-white/45">00:00:00</p>
                      ) : (
                        <div className={`mt-1 flex justify-center gap-1 text-[29px] font-semibold tracking-[0.05em] md:text-[35px] ${isEndingSoon ? "text-[#FF405C]" : "text-[#FF4B67]"}`} style={{ textShadow: "0 0 18px rgba(255,64,92,0.42)" }}>
                          <span>{String(hours).padStart(2, "0")}</span><span>:</span><span>{String(minutes).padStart(2, "0")}</span><span>:</span><span>{String(seconds).padStart(2, "0")}</span>
                        </div>
                      )}
                      {!isEnded && <div className="mt-1 grid grid-cols-3 text-center text-[11px] uppercase text-white/50 md:text-[13px]"><span>horas</span><span>min</span><span>seg</span></div>}
                      <button
                        type="button"
                        onClick={() => onEnterConversation(cloud)}
                        className="mt-3 flex h-11 w-full items-center justify-center rounded-[20px] border border-[#9B6CFF] bg-[#0C0D18] px-6 text-[16px] font-semibold text-white shadow-[inset_0_0_20px_rgba(124,58,237,0.12),0_0_25px_rgba(124,58,237,0.12)] transition hover:bg-[#161128] md:text-[17px]"
                      >
                        Entrar na conversa
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-4 md:mt-5 md:flex-row md:items-center">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-white/70 md:text-[16px]">
                      <TopicHypeButton cloud={cloud} />
                      {(cloud.visibility !== "private" || cloud.authorId === currentUserId) && (
                        <button type="button" onClick={() => setShareTarget(cloud)} className="inline-flex items-center gap-3 transition hover:text-[#C084FC]">
                          <PaperPlaneIcon s={25} className="text-white/65" />
                          <span>Compartilhar</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 self-start md:self-auto">
                      <div className="flex -space-x-3">
                        {participantAvatars.map(avatar => (
                          <img key={avatar} src={avatar} alt="Participante" className="h-10 w-10 rounded-full border-2 border-[#0B0C12] object-cover md:h-12 md:w-12" referrerPolicy="no-referrer" />
                        ))}
                        {!profile.avatar && <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0B0C12] bg-[#7C3AED] text-[12px] font-bold text-white md:h-12 md:w-12">{profile.name.slice(0, 1).toUpperCase()}</span>}
                        {profile.participants > 3 && <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0B0C12] bg-[#1B1D26] text-[11px] font-semibold text-white/80 md:h-12 md:w-12">+{profile.participants >= 1000 ? "1K" : profile.participants - 3}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {cloud.visibility === "private" && (
                          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        )}
                        <span className="text-[14px] text-white md:text-[17px]">{participantLabel}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      )}
      </div>
      {shareTarget && (
        <ShareModal
          cloudTitle={shareTarget.title}
          cloudUrl={`${siteOrigin}${shareTarget.href ?? `/cloud/${shareTarget.id}`}`}
          onClose={() => setShareTarget(null)}
        />
      )}
    </>
  );
}

// ─── Live Card Action Buttons ────────────────────────────────────────────────

function LiveCardActionButton({ cloudId, initialHypes, initialHyped, onHypar }: { cloudId: string; initialHypes: number; initialHyped?: boolean; onHypar?: (newCount: number, wasHyped: boolean) => void }) {
  const [hyped, setHyped] = useState(initialHyped ?? false);
  const [hypes, setHypes] = useState(initialHypes);
  const [loading, setLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const siteOrigin = useSiteOrigin();
  const fullUrl = `${siteOrigin}/cloud/${cloudId}`;

  const handleHype = async () => {
    if (loading) return;
    setLoading(true);
    const wasHyped = hyped;
    setHyped(!wasHyped);
    setHypes(v => wasHyped ? v - 1 : v + 1);
    try {
      const res = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/hype`, {
        method: wasHyped ? "DELETE" : "POST",
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { hypesCount?: number } | null;
        const newCount = data?.hypesCount ?? (wasHyped ? hypes - 1 : hypes + 1);
        setHypes(newCount);
        onHypar?.(newCount, wasHyped);
      } else {
        setHyped(wasHyped);
        setHypes(v => wasHyped ? v + 1 : v - 1);
      }
    } catch {
      setHyped(wasHyped);
      setHypes(v => wasHyped ? v + 1 : v - 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {shareOpen && (
        <ShareModal
          cloudTitle="Cloud ao vivo"
          cloudUrl={fullUrl}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Hypar */}
      <button
        type="button"
        aria-label="Hypar"
        disabled={loading}
        onClick={handleHype}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-60 ${hyped ? "border-orange-500/40 bg-orange-500/15 text-orange-400" : "border-white/10 bg-white/5 text-white/60 hover:border-orange-500/40 hover:text-orange-400"}`}
      >
        <FireIcon s={14} />
        {hypes > 0 ? hypes : "Hypar"}
      </button>

      {/* Compartilhar */}
      <button
        type="button"
        aria-label="Compartilhar"
        onClick={() => setShareOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/60 transition hover:border-[#9333EA]/50 hover:text-[#C084FC]"
      >
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7Z" />
        </svg>
        Compartilhar
      </button>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PageContent() {
  const { user, refresh, incrementCloudCount } = useSessionUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const trendingQuery = searchParams.get("q")?.toLowerCase().trim() ?? null;

  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState<"search" | "create" | "notifications" | "profile" | "record" | "poll" | null>(null);
  const [homeStage, setHomeStage] = useState<"topics" | "live">("topics");
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [currentCloudIndex, setCurrentCloudIndex] = useState(0);
  const [feedOrder, setFeedOrder] = useState<"default" | "recent">("default");
  const [cloudOptionsOpen, setCloudOptionsOpen] = useState(false);
  const [cloudInfoOpen, setCloudInfoOpen] = useState(false);
  const [cloudDescriptionOpen, setCloudDescriptionOpen] = useState(false);
  // Simulated participant count: starts at a seeded value per cloud, fluctuates every few seconds
  const [participants, setParticipants] = useState<number>(0);

  // Slide animation: "left" = next, "right" = prev, null = settled
  const [slideAnim, setSlideAnim] = useState<"left" | "right" | null>(null);

  // A ordem é aplicada antes de alimentar o carrossel, garantindo que as setas
  // A ordem é aplicada antes de alimentar o carrossel, garantindo que as setas
  // e o card visível respeitem o filtro selecionado.
  const orderedClouds = useMemo(() => {
    let sorted: Cloud[];
    if (feedOrder === "recent") {
      // Recentes: ordena por data de criação
      sorted = [...clouds].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      // Default: respeita a ordem do servidor (já ordenada por hype score + recência)
      // mas reordena localmente pelo score de hypes para refletir hypes feitos na sessão
      const now = Date.now();
      sorted = [...clouds].sort((a, b) => {
        const ageA = (now - a.createdAt.getTime()) / 3_600_000;
        const ageB = (now - b.createdAt.getTime()) / 3_600_000;
        const scoreA = (a.hypes ?? 0) * 3 + Math.max(0, 1 - ageA / 72) * 10;
        const scoreB = (b.hypes ?? 0) * 3 + Math.max(0, 1 - ageB / 72) * 10;
        return scoreB - scoreA;
      });
    }
    // Se veio do Trending com ?q=palavra, coloca as clouds com essa palavra primeiro
    if (trendingQuery) {
      sorted = [
        ...sorted.filter((c) => c.title.toLowerCase().includes(trendingQuery)),
        ...sorted.filter((c) => !c.title.toLowerCase().includes(trendingQuery)),
      ];
    }
    return sorted;
  }, [clouds, feedOrder, trendingQuery]);

  // Reseta o índice sempre que a ordem muda para mostrar a 1ª cloud da nova ordenação
  useEffect(() => {
    setCurrentCloudIndex(0);
  }, [feedOrder]);

  const navigateCloud = (direction: number) => {
    const activeClouds = orderedClouds.filter(isCloudActive);
    if (activeClouds.length <= 1) return;

    const dir = direction > 0 ? "left" : "right";
    setSlideAnim(dir);
    setTimeout(() => {
      setCurrentCloudIndex(prev => {
        const newIndex = prev + direction;
        if (newIndex < 0) return activeClouds.length - 1;
        if (newIndex >= activeClouds.length) return 0;
        return newIndex;
      });
      setSlideAnim(null);
    }, 260);
  };

  const enterConversation = (cloud: Cloud) => {
    const params = new URLSearchParams({
      title: cloud.title,
      duration: cloud.duration,
      createdAt: cloud.createdAt.toISOString(),
      participants: String(cloud.liveParticipants ?? 1),
    });
    router.push(`/cloud/${cloud.id}?${params.toString()}`);
  };


  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      try {
        const storedPolls = localStorage.getItem("cloudscommunity:polls");
        if (storedPolls) {
          const parsed = JSON.parse(storedPolls) as Array<Omit<Poll, "createdAt"> & { createdAt: string }>;
          if (!cancelled) {
            setPolls(parsed.map((poll) => ({
              ...poll,
              createdAt: new Date(poll.createdAt),
            })));
          }
        }
      } catch {
        // ignore invalid stored polls
      }

      try {
        const response = await fetch("/api/clouds", {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as { ok?: boolean; clouds?: CloudApiPayload[] } | null;
        const serverClouds = response.ok && Array.isArray(payload?.clouds)
          ? payload.clouds.map(mapApiCloudToCloud).filter(cloud => {
              // Clouds privadas só aparecem para o criador
              if (cloud.visibility === "private") {
                return cloud.authorId === user?.id;
              }
              return true;
            })
          : [];

        if (!cancelled) {
          setClouds((current) => mergeClouds(current, serverClouds));
        }
      } catch {
        if (!cancelled) {
          setClouds([]);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("cloudscommunity:polls", JSON.stringify(polls));
  }, [polls, hydrated]);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const activeClouds = orderedClouds.filter(isCloudActive);
    if (activeClouds.length === 0) {
      setParticipants(0);
      return;
    }

    const current = activeClouds[Math.min(currentCloudIndex, Math.max(0, activeClouds.length - 1))] ?? activeClouds[0];
    const base = current?.liveParticipants ?? 12 + ((current?.id.charCodeAt(0) ?? 0) % 40);
    setParticipants(base);
  }, [currentCloudIndex, orderedClouds]);

  useEffect(() => {
    const activeClouds = orderedClouds.filter(isCloudActive);
    if (activeClouds.length === 0) return;

    const current = activeClouds[Math.min(currentCloudIndex, Math.max(0, activeClouds.length - 1))] ?? activeClouds[0];
    const base = current?.liveParticipants ?? 12 + ((current?.id.charCodeAt(0) ?? 0) % 40);

    const iv = window.setInterval(() => {
      const delta = Math.floor(Math.random() * 3) - 1;
      setParticipants(() => Math.max(1, base + delta));
    }, 4000);

    return () => window.clearInterval(iv);
  }, [currentCloudIndex, orderedClouds]);

  const closeModal = () => setModal(null);

  const publishCloud = async (data: Omit<Cloud, "id" | "createdAt" | "mode"> & { audioUrl?: string; invitedUserIds?: string[] }) => {
    if (data.audioUrl) {
      const id = crypto.randomUUID();
      const cloud = {
        ...data,
        id,
        createdAt: new Date(),
        mode: "audio" as const,
        href: `/cloud/${id}`,
        hypes: 0,
      };
      setClouds((prev) => mergeClouds([cloud], prev));
      incrementCloudCount();
      return cloud;
    }

    const response = await fetch("/api/clouds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: data.title,
        description: data.description ?? "",
        duration: data.duration,
        visibility: data.visibility,
        invitedUserIds: data.invitedUserIds,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { ok?: boolean; cloud?: CloudApiPayload; message?: string } | null;

    const cloudPayload = payload?.cloud;

    if (!response.ok || !cloudPayload) {
      throw new Error(payload?.message ?? "Nao foi possivel criar a cloud.");
    }

    const cloud = mapApiCloudToCloud(cloudPayload);
    setClouds((prev) => mergeClouds([cloud], prev));
    await refresh();
    return cloud;
  };

  const hyparCloud = (cloudId: string, newCount: number, wasHyped: boolean) => {
    setClouds(prev => prev.map(c => c.id === cloudId ? { ...c, hypes: newCount, hyped: !wasHyped } : c));
  };

  const publishPoll = (data: Omit<Poll, "id" | "createdAt" | "votedOptionId">) => {
    setPolls(prev => [{
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      votedOptionId: null,
    }, ...prev]);
  };

  const voteOnPoll = (pollId: string, optionId: string) => {
    setPolls(prev => prev.map(p =>
      p.id === pollId && p.votedOptionId === null
        ? { ...p, votedOptionId: optionId, options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o) }
        : p
    ));
  };

  // Merge clouds + polls sorted by createdAt descending
  const allItems: FeedItem[] = [
    ...clouds.map(c => ({ kind: "cloud" as const, ...c })),
    ...polls.map(p => ({ kind: "poll" as const, ...p })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Categorias removidas: feed sempre mostra todos os itens em ordem por createdAt.
  const visibleItems = feedOrder === "recent" ? [...allItems].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) : allItems;
  const activeClouds = orderedClouds.filter(isCloudActive);
  const currentCloud = activeClouds[Math.min(currentCloudIndex, Math.max(0, activeClouds.length - 1))] ?? null;
  const currentCountdown = currentCloud ? getTopicCountdown(currentCloud) : 0;

  useEffect(() => {
    if (homeStage === "live" && !currentCloud) {
      setHomeStage("topics");
      setExpandedTopicId(null);
    }
  }, [currentCloud, homeStage]);

  // Aguarda hidratação para evitar flash do feed antes de um possível redirect.
  if (!hydrated) return null;


  return (
    <div className="flex h-screen flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>

      {/* ── Modals ── */}
      {modal === "search"        && <SearchModal onClose={closeModal} feedClouds={clouds} />}
      {modal === "create"        && <CreateCloudModal onClose={closeModal} onPublish={publishCloud} />}
      {modal === "poll"          && <CreatePollModal onClose={closeModal} onPublish={publishPoll} />}
      {modal === "profile"       && <ProfileMenu onClose={closeModal} />}
      {modal === "record"        && <RecordAudioModal onClose={closeModal} onPublish={publishCloud} />}

      {/* ── Header — fundo gradiente escuro ── */}
      <header className="flex-none bg-transparent">
        <div className="mx-auto flex h-[100px] max-w-[1280px] items-end justify-between gap-4 px-8 pb-4">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-4 pb-2">
            <HeaderBrand />
          </Link>

          {/* Nav */}
          <nav aria-label="Navegação" className="flex items-end gap-12 pb-2">
            <Link href="/" className="relative inline-flex h-12 items-center text-[22px] font-semibold text-white">
              For You
              <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-[#A855F7]" />
            </Link>
            <Link href="/following" className="inline-flex h-12 items-center text-[22px] font-semibold text-white/50 transition hover:text-white">
              Seguindo
            </Link>
          </nav>

          {/* Right icons */}
          <div className="flex items-center gap-4 pb-2">
            <button type="button" aria-label="Buscar" onClick={() => setModal("search")}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.12] text-white transition hover:bg-white/[0.20]">
              <SearchIcon s={28} />
            </button>
            <NotificationsBell buttonClassName="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]" />
            <Link href="/profile" aria-label="Meu perfil"
              className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#A855F7] text-[18px] font-bold text-white">
              <SessionUserAvatar user={user} size={56} className="rounded-full" />
            </Link>
            <Link href="/settings" aria-label="Configurações"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]">
              <GearIcon s={28} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main: card + arrows ── */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 gap-4">
        {homeStage === "topics" ? (
          <>
            {trendingQuery ? (
              <div className="absolute left-6 top-5 z-20 flex items-center gap-2 rounded-full border border-[#A855F7]/50 bg-[#1a0a3d]/90 px-4 py-2 text-[12px] font-semibold text-white backdrop-blur-md shadow-lg">
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#A855F7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m18 15-6-6-6 6"/>
                </svg>
                <span className="text-[#C084FC]">#{trendingQuery.charAt(0).toUpperCase() + trendingQuery.slice(1)}</span>
                <span className="text-white/50">em alta</span>
                <Link href="/" className="ml-1 text-white/30 hover:text-white transition">×</Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setFeedOrder((current) => current === "recent" ? "default" : "recent"); setCurrentCloudIndex(0); }}
                aria-pressed={feedOrder === "recent"}
                title={feedOrder === "recent" ? "Exibindo as Clouds mais recentes primeiro" : "Exibir as Clouds mais recentes primeiro"}
                className={`absolute left-6 top-5 z-20 flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-bold transition-all ${feedOrder === "recent" ? "border-[#A855F7]/70 bg-[#7C3AED] text-white shadow-[0_5px_18px_rgba(124,58,237,0.38)]" : "border-white/[0.10] bg-[#100825]/80 text-white/65 shadow-lg shadow-black/20 backdrop-blur-md hover:border-[#A855F7]/45 hover:text-white"}`}
              >
                <span className="text-[15px] leading-none">+</span>
                Recentes
              </button>
            )}
            {currentCloud ? (
            <>
            {/* Left arrow */}
            <button
              onClick={() => navigateCloud(-1)}
              aria-label="Cloud anterior"
              className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white transition hover:bg-white/[0.20]"
            >
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>

            {/* Cloud card + dot indicators */}
            <div className="flex min-w-0 flex-1 max-w-[1100px] flex-col gap-4">
            <div
              className="cloud-card relative w-full overflow-hidden rounded-3xl"
              style={{
                background: "linear-gradient(175deg, rgba(40,15,100,0.85) 0%, rgba(15,8,50,0.92) 60%, rgba(8,5,30,0.95) 100%)",
                border: "1px solid rgba(168,85,247,0.22)",
                boxShadow: "0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
                transition: "transform 0.25s ease, opacity 0.25s ease",
                transform: slideAnim === "left" ? "translateX(-36px)" : slideAnim === "right" ? "translateX(36px)" : "translateX(0)",
                opacity: slideAnim ? 0.15 : 1,
              }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-10 pt-8 pb-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {currentCloud.authorPhoto ? (
                      <img
                        src={currentCloud.authorPhoto}
                        alt={currentCloud.authorName ?? "Autor"}
                        className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED] text-xl font-bold text-white ring-2 ring-white/10">
                        {(currentCloud.authorName ?? "A").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#0f0832] bg-[#22C55E]" />
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-[18px] font-semibold text-white">
                      {currentCloud.authorName ?? "Autor"}
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="#A855F7" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </p>
                    <p className="text-[14px] text-white/45">@{currentCloud.authorHandle ?? "user"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  {/* Timer */}
                  <div className="flex items-center gap-2.5 rounded-full bg-white/[0.07] px-5 py-2.5">
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/>
                    </svg>
                    <span className="text-[19px] font-bold tabular-nums text-white">
                      {formatCountdown(currentCountdown)}
                    </span>
                  </div>
                  {/* Participants */}
                  <div className="flex items-center gap-2 text-[16px] font-semibold text-white">
                    {currentCloud.visibility === "private" && (
                      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {formatParticipantCount(participants)}
                  </div>
                  <div className="relative flex items-center">
                    <button type="button" aria-label="Mais opções da Cloud" onClick={() => setCloudOptionsOpen((open) => !open)} className="flex items-center text-white hover:text-white/70 transition">
                      <svg viewBox="0 0 24 24" width={22} height={22} fill="#ffffff" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                    </button>
                    {cloudOptionsOpen && (
                      <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#15161C] py-1 shadow-2xl">
                        <button type="button" onClick={() => { setCloudOptionsOpen(false); setCloudInfoOpen(true); }} className="w-full px-4 py-3 text-left text-[13px] text-white/80 hover:bg-white/5">Informações da Cloud</button>
                        <button type="button" onClick={() => { setCloudOptionsOpen(false); setCloudDescriptionOpen(true); }} className="w-full px-4 py-3 text-left text-[13px] text-white/80 hover:bg-white/5">Ler descrição</button>
                        <button type="button" onClick={() => { setCloudOptionsOpen(false); window.alert("Denúncia registrada. Nossa equipe analisará esta Cloud."); }} className="w-full px-4 py-3 text-left text-[13px] text-red-300 hover:bg-white/5">Denunciar Cloud</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Big title */}
              <div className="px-12 py-12 text-center">
                <h2
                  className="text-[58px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[72px]"
                  style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif" }}
                >
                  {currentCloud.title}
                </h2>
              </div>

              {/* Enter button */}
              <div className="flex justify-center px-12 pb-12">
                <button
                  type="button"
                  onClick={() => enterConversation(currentCloud)}
                  className="rounded-full border border-[#A855F7]/70 bg-transparent px-24 py-5 text-[18px] font-semibold text-white transition hover:bg-[#A855F7]/20"
                >
                  Entrar na Cloud
                </button>
              </div>
            </div>

          {/* Dot indicators */}
          {activeClouds.length > 1 && (
            <div className="flex justify-center gap-2">
              {activeClouds.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const dir = i > currentCloudIndex ? "left" : "right";
                    setSlideAnim(dir);
                    setTimeout(() => { setCurrentCloudIndex(i); setSlideAnim(null); }, 250);
                  }}
                  className={`h-1.5 rounded-full transition-all ${i === currentCloudIndex ? "w-6 bg-[#A855F7]" : "w-1.5 bg-white/20"}`}
                />
              ))}
            </div>
          )}
            </div>

        {/* Right arrow */}
        <button
          onClick={() => navigateCloud(1)}
          aria-label="Próxima Cloud"
          className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white transition hover:bg-white/[0.20]"
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
            </>
            ) : (
            /* Empty state — sem cards, sem setas */
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/empty-clouds-available.png"
                alt="Sem clouds ativas"
                className="h-auto w-[min(72vw,420px)] select-none object-contain md:w-[420px]"
                style={{ mixBlendMode: "normal", aspectRatio: "1536 / 1024" }}
                draggable={false}
              />
              <p className="text-[18px] font-semibold text-white/80">
                Sem clouds ativas no momento, que tal começar alguma?
              </p>
              <button
                type="button"
                onClick={() => setModal("create")}
                className="rounded-full bg-[#A855F7] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#9333EA]"
              >
                Criar uma Cloud
              </button>
            </div>
            )}

        {/* FAB + */}
        <button
          type="button"
          aria-label="Publicar nova Cloud"
          onClick={() => setModal("create")}
          className="absolute bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#A855F7] text-white transition hover:bg-[#9333EA] hover:scale-105 active:scale-95"
        >
          <PlusIcon s={22} />
        </button>
        </>
        ) : (
          <div className="absolute inset-0 flex h-full flex-col px-3 py-4 lg:px-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setHomeStage("topics")}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#120a2e] px-4 py-2 text-[13px] font-semibold text-white/75 transition hover:border-white/15 hover:bg-[#16161C]"
              >
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Voltar aos tópicos
              </button>
              <span className="hidden text-[12px] font-semibold uppercase tracking-[0.18em] text-white/35 md:inline">
                Conversa ao vivo
              </span>
            </div>
            {currentCloud && (
              <CloudChat
                cloudId={currentCloud.id}
                title={currentCloud.title}
                duration={currentCloud.duration}
                createdAt={currentCloud.createdAt.toISOString()}
                participants={currentCloud.liveParticipants ?? 1}
              />
            )}
          </div>
        )}
      </main>

      {cloudInfoOpen && currentCloud && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6"><div className="mb-4 flex items-center justify-between"><h3 className="text-[18px] font-bold">Informações da Cloud</h3><button onClick={() => setCloudInfoOpen(false)} className="text-white/50 hover:text-white">×</button></div><div className="space-y-3 text-[14px] text-white/70"><p><span className="text-white/40">Título: </span>{currentCloud.title}</p><p><span className="text-white/40">Duração: </span>{currentCloud.duration}</p><p><span className="text-white/40">Participantes: </span>{formatParticipantCount(participants)}</p></div></div></div>}
      {cloudDescriptionOpen && currentCloud && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6"><div className="mb-4 flex items-center justify-between"><h3 className="text-[18px] font-bold">Descrição da Cloud</h3><button onClick={() => setCloudDescriptionOpen(false)} className="text-white/50 hover:text-white">×</button></div><p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/75">{currentCloud.description?.trim() || "O criador não adicionou uma descrição para esta Cloud."}</p></div></div>}

      {/* ── Bottom navigation ── */}
      <nav className="flex-none border-t border-white/[0.07] bg-[#060410]" aria-label="Navegação inferior">
        <div className="mx-auto grid max-w-[480px] grid-cols-3 items-center px-4 py-5">

          {/* Home */}
          <Link href="/" className="flex flex-col items-center gap-2 text-[#A855F7]">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"/>
              <path d="M9 21V12h6v9"/>
            </svg>
            <span className="text-[13px] font-semibold">Home</span>
          </Link>

          {/* Messages */}
          <Link href="/messages" className="flex flex-col items-center gap-2 text-white transition hover:text-white">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="text-[13px] font-semibold">Messages</span>
          </Link>

          {/* Trending */}
          <Link href="/trending" className="flex flex-col items-center gap-2 text-white transition hover:text-white">
            <FlameIcon s={30} />
            <span className="text-[13px] font-semibold">Trending</span>
          </Link>

        </div>
      </nav>

    </div>
  );
}
 
