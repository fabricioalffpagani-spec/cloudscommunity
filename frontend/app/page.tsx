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
import { MessagesNavLink } from "./components/MessagesNavLink";
import { MobileAppNav, useMobileFeedTabSwipe } from "./components/MobileAppChrome";
import { CloudScopeTabs, type CloudScope } from "./components/CloudScopeTabs";
import { SearchModal } from "./components/SearchModal";
import { InviteCloudsButton } from "./components/InviteCloudsButton";
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
  participantProfiles?: Array<{ id: string; name: string; username: string; avatarUrl: string | null }>;
  originCloud?: { id: string; title: string } | null;
  scheduledAt?: string | null;
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

const REPORT_REASONS = [
  "Spam ou publicidade",
  "Discurso de ódio",
  "Assédio ou bullying",
  "Conteúdo violento ou perturbador",
  "Informação falsa",
  "Conteúdo sexual inapropriado",
  "Ameaças",
  "Outro",
] as const;

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
  participantsCount: number;
  participantProfiles: Array<{ id: string; name: string; username: string; avatarUrl: string | null }>;
  originCloud?: { id: string; title: string } | null;
  scheduledAt: string | null;
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
    liveParticipants: cloud.membersCount,
    authorId: cloud.authorId,
    participantProfiles: cloud.participantProfiles,
    originCloud: cloud.originCloud,
    scheduledAt: cloud.scheduledAt,
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
  { name: "Talk",   bg: "#FFFFFF", color: "#111827" },
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
  if (cloud.scheduledAt && new Date(cloud.scheduledAt).getTime() > Date.now()) {
    return parseDurationSeconds(cloud.duration);
  }
  const startAt = cloud.scheduledAt ? new Date(cloud.scheduledAt) : cloud.createdAt;
  const elapsed = Math.floor((Date.now() - startAt.getTime()) / 1000);
  return Math.max(parseDurationSeconds(cloud.duration) - elapsed, 0);
}

function isCloudActive(cloud: Cloud) {
  if (cloud.scheduledAt && new Date(cloud.scheduledAt).getTime() > Date.now()) return true;
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
function CalendarIcon({ s = 18 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function ClockIcon({ s = 18 }: { s?: number }) {
  return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>;
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

function ShareModal({ cloudId, cloudTitle, cloudUrl, onClose }: { cloudId: string; cloudTitle: string; cloudUrl: string; onClose: () => void }) {
  const [view, setView] = useState<"main" | "contacts" | "external">("main");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<ShareContact[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => { void fetch(`/api/clouds/${encodeURIComponent(cloudId)}/share`, { method: "POST" }); }, [cloudId]);

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

  const handleNativeShare = async () => {
    const shareData = { title: `Clouds — ${cloudTitle}`, text: `Participe da Cloud “${cloudTitle}”`, url: cloudUrl };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        onClose();
      } catch (error) {
        // Closing the native sheet is a normal cancellation, not an error.
        if (!(error instanceof DOMException && error.name === "AbortError")) return;
      }
      return;
    }
    handleCopy();
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
            <button
              type="button"
              onClick={() => void handleNativeShare()}
              className="flex items-center gap-4 rounded-2xl border border-[#3B82F6]/35 bg-[#3B82F6]/10 px-5 py-4 text-left transition hover:bg-[#3B82F6]/20"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]/20 text-[#BFDBFE] text-xl">↗</div>
              <div><p className="text-[14px] font-semibold text-white">Compartilhar com apps</p><p className="mt-0.5 text-[12px] text-white/55">Abra a folha de compartilhamento do dispositivo</p></div>
            </button>
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
  const sessionUser = useSessionUser();
  const currentUser = sessionUser.user;
  const [hyped, setHyped] = useState(cloud.hyped ?? false);
  const [hypes, setHypes] = useState(cloud.hypes ?? 0);
  const [hypeLoading, setHypeLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showPremiere, setShowPremiere] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSet, setReminderSet] = useState(() => Boolean(currentUser?.id && cloud.participantProfiles?.some((participant) => participant.id === currentUser.id)));
  const siteOrigin = useSiteOrigin();

  const shareUrl = cloud.href ?? `/cloud/${cloud.id}`;
  const fullShareUrl = `${siteOrigin}${shareUrl}`;
  const scheduledDate = cloud.scheduledAt ? new Date(cloud.scheduledAt) : null;
  const isScheduled = Boolean(scheduledDate && scheduledDate.getTime() > Date.now());
  const durationSeconds = parseDurationSeconds(cloud.duration);
  const elapsedSeconds = Math.floor((Date.now() - cloud.createdAt.getTime()) / 1000);
  const remainingSeconds = Math.max(durationSeconds - elapsedSeconds, 0);
  const isLive = !isScheduled && remainingSeconds > 0;
  const countdownLabel = formatCountdown(isScheduled ? durationSeconds : remainingSeconds);
  const premiereLabel = scheduledDate ? `Estreia em ${scheduledDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às ${scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "";
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

  const activateReminder = async () => {
    if (reminderLoading || reminderSet) return;
    setReminderLoading(true);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/join`, { method: "POST" });
      if (!response.ok) throw new Error("Reminder request failed");
      setReminderSet(true);
    } catch {
      // The button remains available after a failed request.
    } finally {
      setReminderLoading(false);
    }
  };

  return (
    <article className="cloud-card w-full rounded-2xl border border-white/[0.08] bg-[#111116] px-6 py-5 transition hover:border-white/20">

      {/* Top row: live indicator + countdown */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full ${isScheduled ? "" : "animate-ping"}`} style={{ backgroundColor: isScheduled ? "#A855F7" : isLive ? "#22C55E" : "#F87171", opacity: 0.7 }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: isScheduled ? "#A855F7" : isLive ? "#22C55E" : "#F87171" }} />
          </span>
          <span className={isScheduled ? "text-[#C084FC]" : isLive ? "text-[#22C55E]" : "text-[#F87171]"}>
            {isScheduled ? "AGENDADA" : isLive ? "AO VIVO" : "ENCERRADA"} - {cloud.duration}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-1 text-[13px] font-semibold tabular-nums text-white/70">
            {isScheduled || isLive ? countdownLabel : "00:00"}
          </span>
          {isScheduled && <div className="relative"><button type="button" onClick={() => setShowPremiere(value => !value)} aria-label="Ver data de estreia" className="rounded-full p-1.5 text-[#C084FC] transition hover:bg-[#9333EA]/20"><CalendarIcon s={16} /></button>{showPremiere && <span className="absolute left-0 top-9 z-20 w-52 rounded-lg border border-[#A855F7]/30 bg-[#171325] px-3 py-2 text-xs leading-relaxed text-white shadow-xl">{premiereLabel}</span>}</div>}
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${cloud.visibility === "public" ? "bg-[#2563EB]/10 text-[#93C5FD]" : "bg-[#7C3AED]/10 text-[#E9D5FF]"}`}>
          {cloud.visibility === "public" ? "Público" : "Privado"}
        </span>
      </div>

      {/* Title */}
      <h2 lang="pt-BR" className={`mt-4 break-words hyphens-auto font-semibold text-white ${cloud.title.length > 68 ? "text-[18px] leading-[1.3] tracking-[-0.012em]" : "text-[20px] leading-snug"}`}>{cloud.title}</h2>

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

          {!isScheduled && <>
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
            {shareOpen && (
              <ShareModal
                cloudId={cloud.id}
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
          </>}
          {isScheduled && <button type="button" onClick={activateReminder} disabled={reminderLoading || reminderSet} aria-label={reminderSet ? "Lembrete ativado" : "Avisar na estreia"} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold transition ${reminderSet ? "border-[#A855F7]/60 bg-[#9333EA]/20 text-[#E9D5FF]" : "border-[#A855F7]/40 bg-[#9333EA]/10 text-[#C084FC] hover:bg-[#9333EA]/25"}`}><BellIcon s={16} />{reminderSet ? "Lembrete ativado" : "Avisar-me"}</button>}
          {isScheduled && cloud.authorId === sessionUser.user?.id && <button type="button" onClick={async () => { if (!window.confirm("Excluir esta Cloud agendada?")) return; const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}`, { method: "DELETE" }); if (response.ok) window.location.reload(); }} aria-label="Excluir Cloud agendada" className="rounded-full border border-red-400/20 p-2 text-red-300 transition hover:bg-red-500/15"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14" /></svg></button>}
        </div>

        {/* Right — enter */}
        {isScheduled ? <div className="flex items-center -space-x-2" title="Pessoas aguardando a estreia">{cloud.participantProfiles?.slice(0, 5).map((participant) => participant.avatarUrl ? <Image key={participant.id} src={participant.avatarUrl} alt={participant.name} width={30} height={30} className="h-8 w-8 rounded-full border-2 border-[#111116] object-cover" /> : <span key={participant.id} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#111116] bg-[#9333EA] text-[11px] font-bold">{participant.name.charAt(0)}</span>)}</div> : <Link
          href={`${cloud.href ?? `/cloud/${cloud.id}`}?title=${encodeURIComponent(cloud.title)}&duration=${encodeURIComponent(cloud.duration)}&createdAt=${encodeURIComponent(cloud.createdAt.toISOString())}&participants=${cloud.liveParticipants ?? 1}&visibility=${encodeURIComponent(cloud.visibility ?? "public")}&join=1`}
          className="inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED]"
        >
          Entrar na conversa
        </Link>}
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

function CloudsCalendar({ value, onChange, onDaySelect, onTimeComplete }: { value: string; onChange: (value: string) => void; onDaySelect: () => void; onTimeComplete: () => void }) {
  const initial = value ? new Date(value) : new Date(Date.now() + 3_600_000);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | null>(value ? new Date(value).getDate() : null);
  const days = Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => i + 1);
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const latest = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const earliest = new Date();
  const emit = (day: number, nextHour = hour, nextMinute = minute) => onChange(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${nextHour || "00"}:${nextMinute || "00"}`);
  const choose = (day: number) => { setSelectedDay(day); onDaySelect(); emit(day); };
  const updateHour = (nextHour: string) => { setHour(nextHour); if (selectedDay !== null) emit(selectedDay, nextHour, minute); if (minute) onTimeComplete(); };
  const updateMinute = (nextMinute: string) => { setMinute(nextMinute); if (selectedDay !== null) emit(selectedDay, hour, nextMinute); if (hour) onTimeComplete(); };
  const canAdvance = month.getFullYear() < latest.getFullYear() || month.getMonth() < latest.getMonth();
  return <div className="rounded-2xl border border-[#A855F7]/40 bg-[#151027] p-3 shadow-2xl"><div className="relative mb-3 flex items-center justify-center"><strong className="text-sm capitalize">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>{canAdvance && <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="absolute right-0">›</button>}</div><div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/45">{"DSTQQSS".split("").map((d,i)=><span key={i}>{d}</span>)}{days.map(day => { const date = new Date(month.getFullYear(), month.getMonth(), day); return date < new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate()) || date > latest ? <span key={day} /> : <button key={day} type="button" onClick={() => choose(day)} className={`h-8 w-8 rounded-full ${selectedDay === day ? "bg-[#9333EA] text-white shadow-[0_0_0_2px_rgba(216,180,254,.35)]" : "hover:bg-white/10"}`}>{day}</button>; })}</div><div className="mt-3 flex items-center justify-between"><span>Horário</span><div className="flex items-center gap-2"><CloudsTimeWheel value={hour} max={23} onChange={updateHour} /><span>:</span><CloudsTimeWheel value={minute} max={59} onChange={updateMinute} /></div></div></div>;
}

function toLocalDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toScheduledInstant(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function CloudsTimeWheel({ value, max, onChange }: { value: string; max: number; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const values = Array.from({ length: max + 1 }, (_, index) => String(index).padStart(2, "0"));
  if (!open && !value) return <button type="button" onClick={() => setOpen(true)} className="flex h-12 w-14 items-center justify-center rounded-xl border border-white/10 bg-[#252840] text-sm text-white/50">{max === 23 ? "Hr" : "Mn"}</button>;
  return <div className="h-24 w-14 snap-y snap-mandatory overflow-y-auto rounded-xl border border-white/10 bg-[#252840] text-center scrollbar-none">{values.map((item) => <button key={item} type="button" onClick={() => { onChange(item); setOpen(false); }} className={`block h-8 w-full snap-center text-sm transition ${item === value ? "bg-[#9333EA] font-bold text-white" : "text-white/50 hover:bg-white/10"}`}>{item}</button>)}</div>;
}

function CreateCloudModal({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: (cloud: Omit<Cloud, "id" | "createdAt" | "mode"> & { scheduledAt?: string }) => Promise<Cloud>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [scheduledAt, setScheduledAt] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [scheduleTimeComplete, setScheduleTimeComplete] = useState(false);
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
      if (scheduledAt && !scheduleTimeComplete) { setError("Escolha a hora e os minutos para agendar a Cloud."); return; }
      const cloudData = {
        title: title.trim(),
        category: "general",
        description: description.trim() || undefined,
        duration: duration.trim(),
        visibility: "private" as const,
        scheduledAt: toScheduledInstant(scheduledAt),
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
      if (scheduledAt && !scheduleTimeComplete) { setError("Escolha a hora e os minutos para agendar a Cloud."); return; }
      const cloudData = {
        title: normalizedTitle,
        category: "general",
        description: normalizedDescription || undefined,
        duration: duration.trim(),
        visibility,
        scheduledAt: toScheduledInstant(scheduledAt),
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

    const origin = typeof window !== "undefined" ? window.location.origin : "https://clouds.community";
    // Invited users are already Cloud members. Open the Cloud directly so a
    // stale or unavailable invite token cannot block their entry.
    const shareUrl = `${origin}/cloud/${cloudId}?join=1`;

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
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 py-4 sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-[480px] overflow-y-auto rounded-2xl border border-white/10 bg-[#1C1F2E] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-bold text-white">Criar nova Cloud</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><XIcon s={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="new-cloud-title" className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Título</label>
            <input
              id="new-cloud-title"
              autoFocus
              type="text"
              name="new-cloud-topic-title"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              inputMode="text"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 30))}
              onKeyDown={e => e.key === "Enter" && !isPrivateVisibility && handlePublish()}
              placeholder="Título da sua Cloud..."
              maxLength={30}
              className="w-full rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#9333EA] transition"
            />
            <div className="mt-2 flex justify-end text-[11px] text-white/35">{title.length}/30</div>
          </div>
          <div>
            <label htmlFor="new-cloud-description" className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Descrição (opcional)</label>
            <textarea
              id="new-cloud-description"
              name="cloud-description"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Lançamento</label>
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => setScheduledAt("")} className={`rounded-full px-3 py-1.5 text-[12px] ${!scheduledAt ? "bg-[#9333EA] text-white" : "bg-[#252840] text-white/60"}`}>Abrir agora</button>
              <button type="button" onClick={() => { setScheduledAt(toLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000))); setScheduleTimeComplete(false); setCalendarOpen(true); }} className={`rounded-full px-3 py-1.5 text-[12px] ${scheduledAt ? "bg-[#9333EA] text-white" : "bg-[#252840] text-white/60"}`}>Agendar</button>
            </div>
            {scheduledAt && <div className="relative"><button type="button" onClick={() => setCalendarOpen(v => !v)} className="w-full rounded-xl border border-white/[0.08] bg-[#252840] px-4 py-3 text-left text-[14px] text-white">{new Date(scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</button>{calendarOpen && <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20"><CloudsCalendar value={scheduledAt} onChange={setScheduledAt} onDaySelect={() => setScheduleTimeComplete(false)} onTimeComplete={() => { setScheduleTimeComplete(true); setCalendarOpen(false); }} /></div>}</div>}
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
        <div className="fixed inset-0 z-[110] flex items-end p-3 sm:items-center sm:justify-center sm:p-6" onClick={(event) => { event.stopPropagation(); setShowFollowersPopup(false); }}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[420px] flex-col rounded-2xl border border-white/10 bg-[#1C1F2E] p-4 shadow-2xl sm:max-h-[min(640px,calc(100dvh-3rem))] sm:p-6" onClick={event => event.stopPropagation()}>
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <h3 className="text-[16px] font-bold text-white">Convidar seguidores</h3>
            <button 
              onClick={() => setShowFollowersPopup(false)}
              className="text-white/40 hover:text-white p-1"
            >
              <XIcon s={16} />
            </button>
          </div>
          
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-3">
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
              className="shrink-0 rounded-full bg-[#9333EA] px-3 py-2 text-[12px] font-medium text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-[13px]"
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
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
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
  const visibility = "public" as const;
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
              <p className="rounded-xl border border-white/[0.08] bg-[#252840] px-3 py-2.5 text-[12px] leading-relaxed text-white/55">Clouds de áudio ainda não suportam convites privados. Para criar uma Cloud privada, use uma Cloud de texto.</p>
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
              name="poll-question"
              autoComplete="off"
              inputMode="text"
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
                    name={`poll-option-${i}`}
                    autoComplete="off"
                    inputMode="text"
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

function LegacySearchModal({ onClose, feedClouds }: { onClose: () => void; feedClouds: Cloud[] }) {
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
            aria-label="Buscar Clouds e pessoas"
            autoFocus
            type="text"
            name="cloud-search"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            inputMode="text"
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
                        join: "1",
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

      window.localStorage.removeItem("clouds:minimized-cloud");
      window.dispatchEvent(new Event("clouds:minimized-cloud-changed"));
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
                      <h3 lang="pt-BR" className="hyphens-auto break-normal text-[26px] font-extrabold leading-[1.08] tracking-[-0.04em] text-white md:text-[28px]" style={{ hyphenateCharacter: "–" }}>
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
          cloudId={shareTarget.id}
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
          cloudId={cloudId}
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

function DesktopCloudFeed({ clouds, currentUserId, onEnter, onDescription, onReport, onDelete }: { clouds: Cloud[]; currentUserId?: string; onEnter: (cloud: Cloud) => void; onDescription: (cloud: Cloud) => void; onReport: (cloud: Cloud) => void; onDelete: (cloudId: string) => void }) {
  const [optionsCloudId, setOptionsCloudId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const wheelLockedRef = useRef(false);

  useEffect(() => {
    if (!optionsCloudId) return;
    const closeOptions = () => setOptionsCloudId(null);
    document.addEventListener("click", closeOptions);
    return () => document.removeEventListener("click", closeOptions);
  }, [optionsCloudId]);

  const navigateFeed = (direction: number) => {
    const nextIndex = Math.max(0, Math.min(clouds.length - 1, activeIndex + direction));
    const target = feedRef.current?.querySelectorAll<HTMLElement>("[data-cloud-page]")[nextIndex];
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveIndex(nextIndex);
  };

  const syncActiveCloud = () => {
    const feed = feedRef.current;
    if (!feed) return;
    const pages = Array.from(feed.querySelectorAll<HTMLElement>("[data-cloud-page]"));
    if (!pages.length) return;
    const nearestIndex = pages.reduce((best, page, index) =>
      Math.abs(page.offsetTop - feed.scrollTop) < Math.abs(pages[best].offsetTop - feed.scrollTop) ? index : best, 0);
    setActiveIndex(nearestIndex);
  };

  const handleDesktopKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "PageDown" && event.key !== "PageUp") return;
    event.preventDefault();
    navigateFeed(event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1);
  };

  const handleDesktopWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 20 || wheelLockedRef.current) return;
    event.preventDefault();
    wheelLockedRef.current = true;
    navigateFeed(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLockedRef.current = false; }, 520);
  };


  if (clouds.length === 0) return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/empty-clouds-available.png"
        alt="Sem clouds ativas"
        className="h-auto w-[min(72vw,420px)] select-none object-contain md:w-[420px]"
        style={{ aspectRatio: "1536 / 1024" }}
        draggable={false}
      />
      <p className="text-[18px] font-semibold text-white/80">Sem Clouds ativas no momento.</p>
    </div>
  );

  return <div className="relative min-h-0 flex-1"><div ref={feedRef} tabIndex={0} role="region" aria-label="Clouds ativas" onScroll={syncActiveCloud} onWheel={handleDesktopWheel} onKeyDown={handleDesktopKeyDown} className="desktop-cloud-feed cloud-feed-scroller h-full px-8 outline-none">{clouds.map((cloud) => {
    const profile = getTopicProfile(cloud, 0);
    const participants = (cloud.participantProfiles ?? []).filter((participant) => participant.id !== cloud.authorId);
    const isScheduled = Boolean(cloud.scheduledAt && new Date(cloud.scheduledAt).getTime() > Date.now());
    return <article key={cloud.id} data-cloud-page className="relative mx-auto flex h-full min-h-full w-full max-w-[1100px] snap-start flex-col">
      <div className="talk-card-header flex items-center justify-between gap-6 px-12 pb-7 pt-10"><div className="flex min-w-0 items-center gap-5"><span className="relative shrink-0">{profile.avatar ? <img src={profile.avatar} alt="" className="talk-card-avatar h-20 w-20 rounded-full object-cover ring-2 ring-white/10" referrerPolicy="no-referrer" /> : <span className="talk-card-avatar flex h-20 w-20 items-center justify-center rounded-full bg-[#7C3AED] text-2xl font-bold">{profile.name.slice(0, 1).toUpperCase()}</span>}<span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-2 border-[#0f0832] bg-[#22C55E]" /></span><div className="min-w-0"><p className="truncate text-[21px] font-semibold text-white">{profile.name}</p><p className="text-[16px] text-white/45">@{profile.handle}</p></div></div><div className="flex shrink-0 items-center gap-6"><div className="flex -space-x-4" aria-label={`${participants.length} participantes da Cloud`}>{participants.slice(0, 7).map((participant) => participant.avatarUrl ? <img key={participant.id} src={participant.avatarUrl} alt={participant.name} title={participant.name} className="h-14 w-14 rounded-full border-2 border-[#160a3e] object-cover" referrerPolicy="no-referrer" /> : <span key={participant.id} title={participant.name} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#160a3e] bg-[#7C3AED] text-[16px] font-bold">{participant.name.slice(0, 1).toUpperCase()}</span>)}{participants.length > 7 && <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#160a3e] bg-[#32106f] text-[16px] font-bold">+{participants.length - 7}</span>}</div><div className="relative"><button type="button" aria-label="Mais opções da Cloud" onClick={(event) => { event.stopPropagation(); setOptionsCloudId((current) => current === cloud.id ? null : cloud.id); }} className="p-2 text-[26px] leading-none text-white/80 hover:text-white">⋮</button>{optionsCloudId === cloud.id && <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#15161C] py-1 shadow-2xl">{cloud.description?.trim() && <button type="button" onClick={() => { setOptionsCloudId(null); onDescription(cloud); }} className="w-full px-4 py-3 text-left text-[13px] text-white/80 hover:bg-white/5">Ver descrição</button>}<button type="button" onClick={() => { setOptionsCloudId(null); onReport(cloud); }} className="w-full px-4 py-3 text-left text-[13px] text-red-300 hover:bg-white/5">Denunciar Cloud</button>{cloud.authorId === currentUserId && <button type="button" onClick={() => { setOptionsCloudId(null); onDelete(cloud.id); }} className="w-full px-4 py-3 text-left text-[13px] text-red-300 hover:bg-white/5">Excluir Cloud</button>}</div>}</div></div></div>
      <Link href={`/users/${encodeURIComponent(cloud.authorId ?? profile.handle)}`} aria-label={`Ver perfil de ${profile.name}`} className="absolute left-12 top-10 z-20 h-20 w-[340px] rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-[#C084FC]" />
      <div className="talk-card-title flex flex-1 flex-col items-center justify-center px-12 py-10 text-center"><h2 lang="pt-BR" className="max-w-[90%] hyphens-auto break-normal text-[72px] font-extrabold leading-[1.06] tracking-tight text-white" style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif", hyphenateCharacter: "–" }}>{cloud.title}</h2></div>
      <div className="talk-card-actions flex justify-center px-12 pb-16"><button type="button" onClick={() => !isScheduled && onEnter(cloud)} disabled={isScheduled} className="rounded-full border border-[#A855F7]/70 bg-transparent px-28 py-6 text-[21px] font-semibold text-white transition hover:bg-[#A855F7]/20 disabled:cursor-default disabled:opacity-60">{isScheduled ? "Em breve" : "Entrar na Cloud"}</button></div>
      <span className="talk-card-countdown absolute bottom-[72px] right-12 rounded-full bg-white/[0.07] px-6 py-3 text-[22px] font-bold tabular-nums text-white">{formatCountdown(getTopicCountdown(cloud))}</span>
    </article>;
  })}</div>{clouds.length > 1 && <div style={{ right: "max(1rem, calc(50% - 625px))" }} className="pointer-events-none absolute inset-y-0 z-20 hidden flex-col justify-center gap-2 md:flex"><button type="button" aria-label="Cloud anterior" onClick={() => navigateFeed(-1)} disabled={activeIndex === 0} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171325]/25 text-lg text-white/65 shadow-sm backdrop-blur-md transition hover:border-white/20 hover:bg-[#2B174F]/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-20">↑</button><button type="button" aria-label="Próxima Cloud" onClick={() => navigateFeed(1)} disabled={activeIndex >= clouds.length - 1} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#171325]/25 text-lg text-white/65 shadow-sm backdrop-blur-md transition hover:border-white/20 hover:bg-[#2B174F]/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-20">↓</button></div>}</div>;
}

function MobileCloudFeed({ clouds, focusCloudId, onEnter, onCreate, onDescription, onReport, onDelete }: { clouds: Cloud[]; focusCloudId: string | null; onEnter: (cloud: Cloud) => void; onCreate: () => void; onDescription: (cloud: Cloud) => void; onReport: (cloud: Cloud) => void; onDelete: (cloudId: string) => void }) {
  const sessionUser = useSessionUser();
  const currentUser = sessionUser.user;
  const titleTapRef = useRef<{ cloudId: string; at: number } | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const cloudRefs = useRef<Record<string, HTMLElement | null>>({});
  const [premiereId, setPremiereId] = useState<string | null>(null);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
  const [queueCloud, setQueueCloud] = useState<Cloud | null>(null);
  const [optionsCloudId, setOptionsCloudId] = useState<string | null>(null);
  const [participantsCloudId, setParticipantsCloudId] = useState<string | null>(null);
  // Keep the dialog tied to the live feed object, rather than a snapshot taken
  // when it was opened. Membership changes are therefore visible immediately.
  const participantsCloud = clouds.find((cloud) => cloud.id === participantsCloudId) ?? null;

  useEffect(() => {
    if (!optionsCloudId) return;
    const closeOptions = () => setOptionsCloudId(null);
    document.addEventListener("click", closeOptions);
    return () => document.removeEventListener("click", closeOptions);
  }, [optionsCloudId]);

  useEffect(() => {
    if (!focusCloudId) return;
    const frame = window.requestAnimationFrame(() => {
      const cloudElement = cloudRefs.current[focusCloudId];
      if (cloudElement) {
        feedRef.current?.scrollTo({ top: cloudElement.offsetTop, behavior: "smooth" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusCloudId]);

  if (clouds.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/empty-clouds-available.png" alt="Sem Clouds ativas" className="h-auto w-full max-w-[280px] object-contain" draggable={false} />
        <p className="mt-2 text-lg font-semibold text-white/85">Sem Clouds ativas agora</p>
        <button type="button" onClick={onCreate} className="mt-6 rounded-full bg-[#9333EA] px-7 py-3 font-semibold text-white">Criar uma Cloud</button>
      </div>
    );
  }

  return (
    <div ref={feedRef} className="mobile-cloud-feed cloud-feed-scroller">
      {clouds.map((cloud) => {
        const remaining = getTopicCountdown(cloud);
        const profile = getTopicProfile(cloud, 0);
        const scheduledDate = cloud.scheduledAt ? new Date(cloud.scheduledAt) : null;
        const isScheduled = Boolean(scheduledDate && scheduledDate.getTime() > Date.now());
        const premiereLabel = scheduledDate ? `Estreia em ${scheduledDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às ${scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "";
        const activateReminder = async () => {
          if (remindedIds.has(cloud.id)) return;
          const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/join`, { method: "POST" });
          if (response.ok) {
            setRemindedIds(current => new Set(current).add(cloud.id));
            setQueueCloud(cloud);
          }
        };
        return (
          <article key={cloud.id} ref={(element) => { cloudRefs.current[cloud.id] = element; }} className="relative flex min-h-full snap-start flex-col bg-transparent px-6 pb-3 pt-6">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/users/${encodeURIComponent(cloud.authorId ?? profile.handle)}`} aria-label={`Ver perfil de ${profile.name}`} className="flex min-w-0 flex-1 items-center gap-2">
                {profile.avatar ? <img src={profile.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-sm font-bold">{profile.name.slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0"><p className="truncate text-[16px] font-bold leading-[1.25]">{profile.name}</p><p className="mt-0.5 truncate text-[12px] leading-[1.25] text-white/65">@{profile.handle}</p></div>
              </Link>
              <button type="button" onClick={() => setParticipantsCloudId(cloud.id)} className="flex shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC]" aria-label={`Ver ${cloud.participantProfiles?.length ?? 0} participantes da Cloud`}>
                <div className="flex -space-x-2">
                {(cloud.participantProfiles ?? []).filter((participant) => participant.id !== cloud.authorId).slice(0, 4).map((participant) => participant.avatarUrl ? <img key={participant.id} src={participant.avatarUrl} alt={participant.name} className="h-7 w-7 rounded-full border-2 border-[#100625] object-cover" referrerPolicy="no-referrer" /> : <span key={participant.id} title={participant.name} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#100625] bg-[#7C3AED] text-[9px] font-bold">{participant.name.slice(0, 1)}</span>)}
                {(cloud.participantProfiles ?? []).filter((participant) => participant.id !== cloud.authorId).length > 4 && <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#100625] bg-[#32106f] text-[9px] font-bold text-white">+{(cloud.participantProfiles ?? []).filter((participant) => participant.id !== cloud.authorId).length - 4}</span>}
                </div>
              </button><div className="relative"><button type="button" aria-label="Mais opções da Cloud" onClick={(event) => { event.stopPropagation(); setOptionsCloudId((id) => id === cloud.id ? null : cloud.id); }} className="px-1 text-xl text-white/75">⋮</button>{optionsCloudId === cloud.id && <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-8 z-30 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#15161C] py-1 shadow-2xl">{cloud.description?.trim() && <button type="button" onClick={() => { setOptionsCloudId(null); onDescription(cloud); }} className="w-full px-4 py-2.5 text-left text-[13px] text-white/80 hover:bg-white/5">Ver descrição</button>}<button type="button" onClick={() => { setOptionsCloudId(null); onReport(cloud); }} className="w-full px-4 py-2.5 text-left text-[13px] text-red-300 hover:bg-white/5">Denunciar Cloud</button>{cloud.authorId === currentUser?.id && <button type="button" onClick={() => { setOptionsCloudId(null); onDelete(cloud.id); }} className="w-full px-4 py-2.5 text-left text-[13px] text-red-300 hover:bg-white/5">Excluir Cloud</button>}</div>}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isScheduled) return;

                const now = Date.now();
                const previousTap = titleTapRef.current;
                if (previousTap?.cloudId === cloud.id && now - previousTap.at < 300) {
                  titleTapRef.current = null;
                  onEnter(cloud);
                  return;
                }

                titleTapRef.current = { cloudId: cloud.id, at: now };
              }}
              className="flex flex-1 items-center justify-center px-5 text-center touch-pan-y select-none"
              style={{ touchAction: "pan-y" }}
              aria-label={isScheduled ? `Cloud agendada ${cloud.title}. A estreia ainda não começou.` : `Detalhes da Cloud ${cloud.title}. Toque duas vezes para entrar.`}
            >
              <span lang="pt-BR" className={`block break-words hyphens-auto font-display font-bold text-white ${cloud.title.length > 68 ? "text-[43px] leading-[1.17] tracking-[-.035em]" : "text-[52px] leading-[1.13] tracking-[-.045em]"}`}>{cloud.title}</span>
            </button>
            <span className="absolute bottom-6 right-6 rounded-full bg-white/[0.07] px-3 py-1.5 text-[14px] font-bold tabular-nums text-white" aria-label={`${formatCountdown(remaining)} restantes`}>
              {isScheduled ? formatCountdown(parseDurationSeconds(cloud.duration)) : formatCountdown(remaining)}
            </span>
            {isScheduled && <div className="absolute bottom-5 left-6 flex items-center gap-2"><div className="relative"><button type="button" onClick={() => setPremiereId(current => current === cloud.id ? null : cloud.id)} aria-label="Ver data de estreia" className="rounded-full bg-[#9333EA]/20 p-2 text-[#D8B4FE]"><CalendarIcon s={18} /></button>{premiereId === cloud.id && <span className="absolute bottom-11 left-0 z-20 w-52 rounded-xl border border-[#A855F7]/40 bg-[#171325] px-3 py-2 text-xs leading-relaxed text-white shadow-xl">{premiereLabel}</span>}</div><button type="button" onClick={activateReminder} aria-label="Avisar-me na estreia" className={`rounded-full p-2 ${remindedIds.has(cloud.id) ? "bg-[#9333EA] text-white" : "bg-[#9333EA]/20 text-[#D8B4FE]"}`}><BellIcon s={18} /></button></div>}
          </article>
        );
      })}
      {participantsCloud && <div className="fixed inset-0 z-[70] flex items-end bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="participants-title" onClick={() => setParticipantsCloudId(null)}><div className="w-full rounded-t-3xl border border-white/10 bg-[#171821] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between gap-4"><div><h2 id="participants-title" className="text-lg font-bold text-white">Participantes</h2><p className="mt-1 text-sm text-white/60">{participantsCloud.participantProfiles?.length ?? 0} na Cloud “{participantsCloud.title}”</p></div><button type="button" onClick={() => setParticipantsCloudId(null)} aria-label="Fechar" className="text-2xl text-white/55">×</button></div><div className="mt-5 max-h-[55dvh] space-y-3 overflow-y-auto">{(participantsCloud.participantProfiles ?? []).map((participant) => <Link key={participant.id} href={`/users/${encodeURIComponent(participant.id)}`} onClick={() => setParticipantsCloudId(null)} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/5"><span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#9333EA] text-sm font-bold">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : participant.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{participant.name}</span><span className="block truncate text-xs text-white/55">@{participant.username}</span></span></Link>)}</div></div></div>}
      {queueCloud && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-5" role="dialog" aria-modal="true"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171821] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="mb-2 inline-flex rounded-full bg-[#9333EA]/20 p-2 text-[#D8B4FE]"><BellIcon s={19} /></div><h2 className="text-lg font-bold text-white">Você entrou na fila</h2><p className="mt-1 text-sm leading-relaxed text-white/65">Você será notificado quando “{queueCloud.title}” estrear.</p></div><button type="button" onClick={() => setQueueCloud(null)} aria-label="Fechar" className="text-xl text-white/50">×</button></div><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-white/45">Participantes aguardando</p><div className="mt-3 max-h-48 space-y-2 overflow-y-auto">{[...(queueCloud.participantProfiles ?? []), ...(currentUser?.id && !queueCloud.participantProfiles?.some((participant) => participant.id === currentUser.id) ? [{ id: currentUser.id, name: currentUser.displayName, username: currentUser.username, avatarUrl: currentUser.avatarUrl }] : [])].map((participant) => <div key={participant.id} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#9333EA] text-xs font-bold">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" className="h-full w-full object-cover" /> : participant.name.slice(0, 1)}</span><span className="text-sm font-medium text-white">{participant.name}</span></div>)}</div></div><button type="button" onClick={() => setQueueCloud(null)} className="mt-5 w-full rounded-full bg-[#9333EA] py-2.5 text-sm font-semibold text-white">Entendi</button></div></div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PageContent() {
  const { user, refresh, incrementCloudCount } = useSessionUser();
  const router = useRouter();
  const mobileFeedTabSwipe = useMobileFeedTabSwipe();
  const searchParams = useSearchParams();
  const trendingQuery = searchParams.get("q")?.toLowerCase().trim() ?? null;
  const requestedCloudId = searchParams.get("cloud");
  const mobilePreview = searchParams.get("mobilePreview") === "1";

  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState<"search" | "create" | "notifications" | "profile" | "record" | "poll" | null>(null);
  const [originCloudId, setOriginCloudId] = useState<string | null>(null);
  const [homeStage, setHomeStage] = useState<"topics" | "live">("topics");
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [currentCloudIndex, setCurrentCloudIndex] = useState(0);
  const [feedOrder, setFeedOrder] = useState<"default" | "recent">("default");
  const [mobileFocusCloudId, setMobileFocusCloudId] = useState<string | null>(null);
  const [recentNoticeMounted, setRecentNoticeMounted] = useState(false);
  const [recentNoticeVisible, setRecentNoticeVisible] = useState(false);
  const [cloudScope, setCloudScope] = useState<CloudScope>("for-you");
  const [cloudOptionsOpen, setCloudOptionsOpen] = useState(false);
  const [cloudDescriptionOpen, setCloudDescriptionOpen] = useState(false);
  const [cloudReportOpen, setCloudReportOpen] = useState(false);
  const [scheduledQueueOpen, setScheduledQueueOpen] = useState(false);
  const [scheduledReminderLoading, setScheduledReminderLoading] = useState(false);
  const [scheduledReminderCloudId, setScheduledReminderCloudId] = useState<string | null>(null);
  const [scheduledDateOpen, setScheduledDateOpen] = useState(false);
  const scheduledDateHintRef = useRef<HTMLDivElement | null>(null);
  // Simulated participant count: starts at a seeded value per cloud, fluctuates every few seconds

  // Slide animation: "up" = next, "down" = previous, null = settled.
  const recentNoticeTimers = useRef<number[]>([]);

  const toggleRecentClouds = useCallback(() => {
    const willShowRecent = feedOrder !== "recent";
    setFeedOrder(willShowRecent ? "recent" : "default");
    setCurrentCloudIndex(0);
    if (!willShowRecent) return;

    recentNoticeTimers.current.forEach(window.clearTimeout);
    setRecentNoticeMounted(true);
    setRecentNoticeVisible(true);
    recentNoticeTimers.current = [
      window.setTimeout(() => setRecentNoticeVisible(false), 2_700),
      window.setTimeout(() => setRecentNoticeMounted(false), 3_000),
    ];
  }, [feedOrder]);

  useEffect(() => () => recentNoticeTimers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (!cloudOptionsOpen) return;
    const closeCloudOptions = () => setCloudOptionsOpen(false);
    document.addEventListener("click", closeCloudOptions);
    return () => document.removeEventListener("click", closeCloudOptions);
  }, [cloudOptionsOpen]);

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setOriginCloudId(searchParams.get("originCloudId"));
    setModal("create");
    router.replace("/");
  }, [router, searchParams]);

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
  }, [feedOrder, cloudScope]);

  useEffect(() => {
    if (!requestedCloudId) return;
    const index = orderedClouds.filter(isCloudActive).findIndex((cloud) => cloud.id === requestedCloudId);
    if (index >= 0) setCurrentCloudIndex(index);
  }, [orderedClouds, requestedCloudId]);

  const enterConversation = (cloud: Cloud) => {
    const params = new URLSearchParams({
      title: cloud.title,
      duration: cloud.duration,
      createdAt: cloud.createdAt.toISOString(),
      participants: String(cloud.liveParticipants ?? 1),
      join: "1",
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
        const response = await fetch(cloudScope === "following" ? "/api/clouds/following" : "/api/clouds", {
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => null)) as { ok?: boolean; clouds?: CloudApiPayload[] } | null;
        const serverClouds = response.ok && Array.isArray(payload?.clouds)
          ? payload.clouds.map(mapApiCloudToCloud).filter(cloud => {
              // Clouds privadas só aparecem para o criador e convidados.
              if (cloud.visibility === "private") {
                return cloud.authorId === user?.id || cloud.participantProfiles?.some((participant) => participant.id === user?.id);
              }
              return true;
            })
          : [];

        if (!cancelled) {
          setClouds(serverClouds);
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
  }, [cloudScope, user?.id]);

  useEffect(() => {
    const refreshParticipants = async () => {
      try {
        const response = await fetch(cloudScope === "following" ? "/api/clouds/following" : "/api/clouds", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; clouds?: CloudApiPayload[] } | null;
        if (!response.ok || !Array.isArray(payload?.clouds)) return;
        const refreshedClouds = payload.clouds
          .map(mapApiCloudToCloud)
          .filter((cloud) => cloud.visibility !== "private" || cloud.authorId === user?.id || cloud.participantProfiles?.some((participant) => participant.id === user?.id));
        setClouds(refreshedClouds);
      } catch {
        // Keep the last successfully rendered feed while the refresh fails.
      }
    };

    const timer = window.setInterval(() => void refreshParticipants(), 10_000);
    return () => window.clearInterval(timer);
  }, [cloudScope, user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("cloudscommunity:polls", JSON.stringify(polls));
  }, [polls, hydrated]);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const closeModal = () => { setModal(null); setOriginCloudId(null); };

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
      setMobileFocusCloudId(cloud.id);
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
        originCloudId: originCloudId ?? undefined,
        scheduledAt: data.scheduledAt,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { ok?: boolean; cloud?: CloudApiPayload; message?: string } | null;

    const cloudPayload = payload?.cloud;

    if (!response.ok || !cloudPayload) {
      throw new Error(payload?.message ?? "Nao foi possivel criar a cloud.");
    }

    const cloud = mapApiCloudToCloud(cloudPayload);
    setClouds((prev) => mergeClouds([cloud], prev));
    setMobileFocusCloudId(cloud.id);
    await refresh();
    return cloud;
  };

  const hyparCloud = (cloudId: string, newCount: number, wasHyped: boolean) => {
    setClouds(prev => prev.map(c => c.id === cloudId ? { ...c, hypes: newCount, hyped: !wasHyped } : c));
  };

  const deleteScheduledCloud = async (cloudId: string) => {
    if (!window.confirm("Excluir esta Cloud agendada? Ela será removida permanentemente.")) return;
    const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, { method: "DELETE" });
    if (response.ok) setClouds(current => current.filter((cloud) => cloud.id !== cloudId));
  };

  const joinScheduledQueue = async (cloudId: string) => {
    if (scheduledReminderLoading) return;
    setScheduledReminderLoading(true);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/join`, { method: "POST" });
      if (response.ok) {
        setScheduledReminderCloudId(cloudId);
        setScheduledQueueOpen(true);
      }
    } finally {
      setScheduledReminderLoading(false);
    }
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

  useEffect(() => {
    setScheduledDateOpen(false);
  }, [currentCloud?.id]);

  useEffect(() => {
    if (!scheduledDateOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!scheduledDateHintRef.current?.contains(event.target as Node)) {
        setScheduledDateOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [scheduledDateOpen]);

  // Aguarda hidratação para evitar flash do feed antes de um possível redirect.
  if (!hydrated) return null;


  return (
    <div className={`flex h-[100dvh] min-h-screen flex-col overflow-hidden text-white ${mobilePreview ? "mx-auto max-w-[430px] border-x border-white/[.08] shadow-[0_0_80px_rgba(115,45,255,.35)]" : ""}`}
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }} {...mobileFeedTabSwipe}>

      {/* ── Modals ── */}
      {modal === "search"        && <SearchModal onClose={closeModal} />}
      {modal === "create"        && <CreateCloudModal onClose={closeModal} onPublish={publishCloud} />}
      {modal === "poll"          && <CreatePollModal onClose={closeModal} onPublish={publishPoll} />}
      {modal === "profile"       && <ProfileMenu onClose={closeModal} />}
      {modal === "record"        && <RecordAudioModal onClose={closeModal} onPublish={publishCloud} />}
      {recentNoticeMounted && (
        <div className={`pointer-events-none fixed left-1/2 top-24 z-[90] -translate-x-1/2 rounded-full border border-white/15 bg-[#1a0e3d]/95 px-4 py-2 text-[13px] font-semibold text-white shadow-xl backdrop-blur-md transition-opacity duration-300 ${recentNoticeVisible ? "opacity-100" : "opacity-0"}`}>
          Clouds mais recentes
        </div>
      )}

      {/* ── Header — fundo gradiente escuro ── */}
      <header className={mobilePreview ? "hidden" : "hidden flex-none bg-transparent md:block"}>
        <div className="mx-auto grid h-[100px] max-w-[1280px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 px-8 pb-4">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-4 justify-self-start pb-2">
            <HeaderBrand />
          </Link>

          {/* Nav */}
          <nav aria-label="Navegação" className="flex items-end justify-self-center gap-16 pb-2">
            <Link href="/" title="Talk: Clouds ao vivo para conversar agora." className="relative inline-flex h-14 items-center text-[22px] font-semibold text-white">
              Talk
              <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-[#A855F7]" />
            </Link>
            <Link href="/read" title="Read: conversas encerradas disponíveis para leitura." className="inline-flex h-14 items-center text-[22px] font-semibold text-white/50 transition hover:text-white">
              Read
            </Link>
            <Link href="/meet" title="Meet: descubra pessoas para seguir e conhecer." className="inline-flex h-14 items-center text-[22px] font-semibold text-white/50 transition hover:text-white">
              Meet
            </Link>
          </nav>

          {/* Right icons */}
          <div className="flex items-center justify-self-end gap-4 pb-2">
            <InviteCloudsButton />
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

      {/* Cabeçalho compacto do feed móvel */}
      <header className={`${mobilePreview ? "grid" : "grid md:hidden"} h-[76px] flex-none grid-cols-[48px_minmax(0,1fr)_48px] items-center px-5 pt-[max(.5rem,env(safe-area-inset-top))]`}>
        <Link href={mobilePreview ? "/?mobilePreview=1" : "/"} aria-label="Ir para a página inicial" className="flex h-[42px] w-[42px] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_clouds.png" alt="Clouds Community" className="h-[42px] w-[42px] object-contain" />
        </Link>
        <nav aria-label="Categorias do feed" className="flex min-w-0 items-center justify-center gap-8 whitespace-nowrap">
          <span className="relative text-[18px] font-bold text-[#B44DFF]">Talk<span className="absolute -bottom-3 left-1 right-1 h-1 rounded-full bg-[#A855F7]" /></span>
          <Link href={mobilePreview ? "/read?mobilePreview=1" : "/read"} className="text-[18px] font-semibold text-white/60">Read</Link>
          <Link href={mobilePreview ? "/meet?mobilePreview=1" : "/meet"} className="text-[18px] font-semibold text-white/60">Meet</Link>
        </nav>
        <button type="button" aria-label="Buscar" onClick={() => setModal("search")} className="justify-self-center text-white"><SearchIcon s={27} /></button>
      </header>

      <div className="relative">
        <CloudScopeTabs value={cloudScope} onChange={setCloudScope} />
        <div className="absolute right-7 top-1/2 -translate-y-1/2 md:hidden">
          <InviteCloudsButton compact />
        </div>
        {!trendingQuery && <div className={`${mobilePreview ? "flex" : "flex md:hidden"} absolute left-6 top-1/2 -translate-y-1/2`}>
        <button
          type="button"
          onClick={toggleRecentClouds}
          aria-pressed={feedOrder === "recent"}
          title={feedOrder === "recent" ? "Exibindo as Clouds mais recentes primeiro" : "Exibir as Clouds mais recentes primeiro"}
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${feedOrder === "recent" ? "border-[#A855F7]/70 bg-white/[0.08] text-[#A855F7]" : "border-white/[0.10] bg-[#100825]/80 text-white hover:border-[#A855F7]/45"}`}
        >
          <ClockIcon s={15} />
        </button>
        </div>}
      </div>

      <main className={`${mobilePreview ? "flex" : "flex md:hidden"} cloud-feed-main`}>
        <div className="relative flex h-full min-h-0 flex-1 flex-col">
        <MobileCloudFeed
          clouds={activeClouds}
          focusCloudId={mobileFocusCloudId}
          onEnter={enterConversation}
          onCreate={() => setModal("create")}
          onDescription={(cloud) => {
            const index = activeClouds.findIndex((item) => item.id === cloud.id);
            if (index >= 0) setCurrentCloudIndex(index);
            setCloudDescriptionOpen(true);
          }}
          onReport={(cloud) => {
            const index = activeClouds.findIndex((item) => item.id === cloud.id);
            if (index >= 0) setCurrentCloudIndex(index);
            setCloudReportOpen(true);
          }}
          onDelete={deleteScheduledCloud}
        />
        </div>
      </main>

      {homeStage === "topics" && !mobilePreview && <main className="cloud-feed-main relative hidden md:flex">
        {!trendingQuery && <button
          type="button"
          onClick={toggleRecentClouds}
          aria-label={feedOrder === "recent" ? "Exibindo Clouds mais recentes" : "Exibir Clouds mais recentes"}
          aria-pressed={feedOrder === "recent"}
          title={feedOrder === "recent" ? "Exibindo as Clouds mais recentes primeiro" : "Exibir as Clouds mais recentes primeiro"}
          className={`absolute left-[max(2rem,calc(50%-608px))] top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border transition-all ${feedOrder === "recent" ? "border-[#A855F7]/70 bg-white/[0.08] text-[#A855F7] shadow-[0_5px_18px_rgba(124,58,237,0.38)]" : "border-white/[0.10] bg-[#100825]/80 text-white shadow-lg shadow-black/20 backdrop-blur-md hover:border-[#A855F7]/45"}`}
        >
          <ClockIcon s={18} />
        </button>}
        <div className="relative flex h-full min-h-0 flex-1 flex-col">
        <DesktopCloudFeed
          clouds={activeClouds}
          currentUserId={user?.id}
          onEnter={enterConversation}
          onDescription={(cloud) => { const index = activeClouds.findIndex((item) => item.id === cloud.id); if (index >= 0) setCurrentCloudIndex(index); setCloudDescriptionOpen(true); }}
          onReport={(cloud) => { const index = activeClouds.findIndex((item) => item.id === cloud.id); if (index >= 0) setCurrentCloudIndex(index); setCloudReportOpen(true); }}
          onDelete={deleteScheduledCloud}
        />
        </div>
      </main>}

      {/* ── Main: vertical-scroll carousel ── */}
      <main className={mobilePreview || homeStage === "topics" ? "hidden" : "relative hidden min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-6 md:flex"}>
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
                onClick={toggleRecentClouds}
                aria-pressed={feedOrder === "recent"}
                title={feedOrder === "recent" ? "Exibindo as Clouds mais recentes primeiro" : "Exibir as Clouds mais recentes primeiro"}
                className={`absolute left-[max(2.5rem,calc(50%-600px))] top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border transition-all ${feedOrder === "recent" ? "border-[#A855F7]/70 bg-white/[0.08] text-[#A855F7] shadow-[0_5px_18px_rgba(124,58,237,0.38)]" : "border-white/[0.10] bg-[#100825]/80 text-white shadow-lg shadow-black/20 backdrop-blur-md hover:border-[#A855F7]/45"}`}
              >
                <ClockIcon s={18} />
              </button>
            )}
            {currentCloud ? (
            <>

            {/* Cloud card + dot indicators */}
            <div className="flex min-w-0 flex-1 max-w-[1100px] flex-col gap-4 md:mr-20 xl:mr-0">
            <div
              onClick={() => setCloudOptionsOpen(false)}
              className="cloud-card relative flex w-full flex-col overflow-hidden rounded-3xl md:min-h-[680px]"
              style={{
                background: "linear-gradient(175deg, rgba(40,15,100,0.85) 0%, rgba(15,8,50,0.92) 60%, rgba(8,5,30,0.95) 100%)",
                border: "1px solid rgba(168,85,247,0.22)",
                boxShadow: "0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-12 pb-7 pt-10">
                <div className="flex items-center gap-5">
                  <Link href={`/users/${encodeURIComponent(currentCloud.authorId ?? "")}`} aria-label={`Ver perfil de ${currentCloud.authorName ?? "Autor"}`} className="relative">
                    {currentCloud.authorPhoto ? (
                      <img
                        src={currentCloud.authorPhoto}
                        alt={currentCloud.authorName ?? "Autor"}
                        className="h-20 w-20 rounded-full object-cover ring-2 ring-white/10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7C3AED] text-2xl font-bold text-white ring-2 ring-white/10">
                        {(currentCloud.authorName ?? "A").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full border-2 border-[#0f0832] bg-[#22C55E]" />
                  </Link>
                  <div>
                    <p className="flex items-center gap-2 text-[21px] font-semibold text-white">
                      {currentCloud.authorName ?? "Autor"}
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="#A855F7" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </p>
                    <p className="text-[16px] text-white/45">@{currentCloud.authorHandle ?? "user"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex -space-x-4" aria-label={`${currentCloud.participantProfiles?.length ?? 0} participantes da Cloud`}>
                    {currentCloud.participantProfiles?.slice(0, 7).map((participant) => (
                      <Link key={participant.id} href={`/users/${encodeURIComponent(participant.id)}`} aria-label={`Ver perfil de ${participant.name}`}>
                        {participant.avatarUrl ? <img src={participant.avatarUrl} alt={participant.name} title={participant.name} className="h-14 w-14 rounded-full border-2 border-[#160a3e] object-cover" referrerPolicy="no-referrer" /> : <span title={participant.name} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#160a3e] bg-[#7C3AED] text-[16px] font-bold text-white">{participant.name.slice(0, 1).toUpperCase()}</span>}
                      </Link>
                    ))}
                    {(currentCloud.participantProfiles?.length ?? 0) > 7 && <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#160a3e] bg-[#32106f] text-[16px] font-bold text-white">+{(currentCloud.participantProfiles?.length ?? 0) - 7}</span>}
                  </div>
                  {currentCloud.scheduledAt && new Date(currentCloud.scheduledAt).getTime() > Date.now() && currentCloud.authorId === user?.id && <button type="button" onClick={() => deleteScheduledCloud(currentCloud.id)} aria-label="Excluir Cloud agendada" className="rounded-full p-2 text-white/55 transition hover:bg-red-500/15 hover:text-red-300"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14" /></svg></button>}
                  <div className="relative flex items-center">
                    <button type="button" aria-label="Mais opções da Cloud" onClick={(event) => { event.stopPropagation(); setCloudOptionsOpen((open) => !open); }} className="flex items-center text-white hover:text-white/70 transition">
                      <svg viewBox="0 0 24 24" width={22} height={22} fill="#ffffff" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                    </button>
                    {cloudOptionsOpen && (
                      <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#15161C] py-1 shadow-2xl">
                        {currentCloud.description?.trim() && <button type="button" onClick={() => { setCloudOptionsOpen(false); setCloudDescriptionOpen(true); }} className="w-full px-4 py-3 text-left text-[13px] text-white/80 hover:bg-white/5">Ver descrição</button>}
                        <button type="button" onClick={() => { setCloudOptionsOpen(false); setCloudReportOpen(true); }} className="w-full px-4 py-3 text-left text-[13px] text-red-300 hover:bg-white/5">Denunciar Cloud</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Big title */}
              <div className="flex flex-1 flex-col items-center justify-center px-12 py-10 text-center">
                {currentCloud.originCloud && <p className="mb-4 text-[12px] text-white/45">Inspirada em <Link href={`/read?cloud=${encodeURIComponent(currentCloud.originCloud.id)}`} className="font-semibold text-[#C084FC] hover:text-white hover:underline">{currentCloud.originCloud.title}</Link></p>}
                <h2
                  lang="pt-BR"
                  className="hyphens-auto break-normal text-[68px] font-extrabold leading-[1.06] tracking-tight text-white sm:text-[72px]"
                  style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif", hyphenateCharacter: "–" }}
                >
                  {currentCloud.title}
                </h2>
              </div>

              {/* Enter button */}
              <div className="flex justify-center px-12 pb-16">
                {currentCloud.scheduledAt && new Date(currentCloud.scheduledAt).getTime() > Date.now() ? <div className="flex items-center gap-3"><div ref={scheduledDateHintRef} onMouseEnter={() => setScheduledDateOpen(true)} onMouseLeave={() => setScheduledDateOpen(false)} className="relative"><button type="button" onClick={() => setScheduledDateOpen((open) => !open)} aria-label="Ver data de estreia" className="rounded-full border border-[#A855F7]/70 bg-[#9333EA] p-4 text-white transition hover:bg-[#7C3AED]"><CalendarIcon s={21} /></button>{scheduledDateOpen && <span className="absolute bottom-full left-1/2 mb-3 hidden w-60 -translate-x-1/2 rounded-xl border border-[#A855F7]/40 bg-[#171325] px-4 py-3 text-sm leading-relaxed text-white shadow-2xl sm:block">Estreia em {new Date(currentCloud.scheduledAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às {new Date(currentCloud.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}</div><button type="button" onClick={() => joinScheduledQueue(currentCloud.id)} disabled={scheduledReminderLoading || scheduledReminderCloudId === currentCloud.id} aria-label={scheduledReminderCloudId === currentCloud.id ? "Aguardando a estreia" : "Avisar-me na estreia"} className={`inline-flex items-center gap-2 rounded-full border px-12 py-5 text-[18px] font-semibold transition-all duration-300 ease-out ${scheduledReminderCloudId === currentCloud.id ? "scale-105 border-[#A855F7] bg-[#9333EA] text-white shadow-[0_0_24px_rgba(147,51,234,0.5)]" : "border-[#A855F7]/70 bg-transparent text-white hover:bg-[#A855F7]/20"}`}><BellIcon s={20} />{scheduledReminderCloudId === currentCloud.id ? "Aguardando" : "Avisar-me"}</button></div> : <button
                  type="button"
                  onClick={() => enterConversation(currentCloud)}
                  className="rounded-full border border-[#A855F7]/70 bg-transparent px-28 py-6 text-[21px] font-semibold text-white transition hover:bg-[#A855F7]/20"
                >
                  Entrar na Cloud
                </button>}
              </div>
              <span className="absolute bottom-9 right-12 rounded-full bg-white/[0.07] px-6 py-3 text-[22px] font-bold tabular-nums text-white" aria-label={`${formatCountdown(currentCountdown)} restantes`}>
                {formatCountdown(currentCountdown)}
              </span>
            </div>

            </div>

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

      {cloudDescriptionOpen && currentCloud && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161C] p-6"><div className="mb-4 flex items-center justify-between"><h3 className="text-[18px] font-bold">Descrição da Cloud</h3><button onClick={() => setCloudDescriptionOpen(false)} className="text-white/50 hover:text-white">×</button></div><p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/75">{currentCloud.description?.trim() || "O criador não adicionou uma descrição para esta Cloud."}</p></div></div>}
      {cloudReportOpen && currentCloud && currentCloud.authorId && (
        <CloudReportModal
          cloudId={currentCloud.id}
          cloudTitle={currentCloud.title}
          reportedId={currentCloud.authorId}
          onClose={() => setCloudReportOpen(false)}
        />
      )}
      {scheduledQueueOpen && currentCloud && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#171821] p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><span className="mb-3 inline-flex rounded-full bg-[#9333EA]/20 p-2 text-[#D8B4FE]"><BellIcon s={20} /></span><h2 className="text-xl font-bold text-white">Você entrou na fila</h2><p className="mt-2 text-sm leading-relaxed text-white/65">Você será notificado quando “{currentCloud.title}” estrear.</p></div><button type="button" onClick={() => setScheduledQueueOpen(false)} aria-label="Fechar" className="text-2xl text-white/50 hover:text-white">×</button></div><div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-white/45">Participantes aguardando</p><div className="mt-3 max-h-60 space-y-2 overflow-y-auto">{[...(currentCloud.participantProfiles ?? []), ...(user?.id && !currentCloud.participantProfiles?.some((participant) => participant.id === user.id) ? [{ id: user.id, name: user.displayName, username: user.username, avatarUrl: user.avatarUrl }] : [])].map((participant) => <div key={participant.id} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#9333EA] text-xs font-bold">{participant.avatarUrl ? <img src={participant.avatarUrl} alt="" className="h-full w-full object-cover" /> : participant.name.slice(0, 1)}</span><span className="text-sm font-medium text-white">{participant.name}</span></div>)}</div></div><button type="button" onClick={() => setScheduledQueueOpen(false)} className="mt-6 w-full rounded-full bg-[#9333EA] py-3 text-sm font-semibold text-white">Entendi</button></div></div>}

      <nav className={mobilePreview ? "hidden" : "hidden flex-none border-t border-white/[0.07] bg-[#060410] md:block"} aria-label="Navegação inferior">
        <div className="mx-auto grid max-w-[480px] grid-cols-4 items-center px-4 py-5">
          <Link href="/" className="flex flex-col items-center gap-2 text-[#A855F7] transition hover:text-[#C084FC]"><HomeIcon s={32} /><span className="text-[13px] font-semibold">Home</span></Link>
          <MessagesNavLink />
          <button type="button" aria-label="Publicar nova Cloud" onClick={() => setModal("create")} className="group flex flex-col items-center gap-2 text-white transition hover:text-[#A855F7]">
            <span className="relative flex h-8 w-8 items-center justify-center"><img src="/cloud-plus-compact.png" alt="" className="absolute h-20 w-20 scale-[1.45] object-contain drop-shadow-[0_0_0.2px_white] transition-[filter] group-hover:[filter:brightness(0)_saturate(100%)_invert(52%)_sepia(97%)_saturate(2679%)_hue-rotate(241deg)_brightness(100%)_contrast(95%)]" /></span>
            <span className="text-[13px] font-semibold">Publicar</span>
          </button>
          <Link href="/trending" className="-translate-x-4 flex flex-col items-center gap-2 text-white transition hover:text-[#A855F7]"><FlameIcon s={30} /><span className="text-[13px] font-semibold">Trending</span></Link>
        </div>
      </nav>

      <MobileAppNav active="home" force={mobilePreview} />

    </div>
  );
}

function CloudReportModal({
  cloudId,
  cloudTitle,
  reportedId,
  onClose,
}: {
  cloudId: string;
  cloudTitle: string;
  reportedId: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (reason: string) => {
    setSelected((previous) =>
      previous.includes(reason) ? previous.filter((item) => item !== reason) : [...previous, reason],
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0 || sending) return;
    setSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportedId, reasons: selected }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "Não foi possível enviar a denúncia.");
      }

      setDone(true);
      window.setTimeout(onClose, 1800);
    } catch (submitError) {
      setSending(false);
      setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar a denúncia.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15161C] p-6 shadow-2xl">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="text-[15px] font-semibold text-white">Denúncia enviada</p>
            <p className="text-center text-[13px] text-white/50">O host da Cloud foi notificado. A plataforma irá analisar a denúncia e retornará uma resposta em breve.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-bold text-white">Denunciar Cloud</h3>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-white/40">{cloudTitle}</p>
              </div>
              <button type="button" onClick={onClose} className="text-xl leading-none text-white/40 hover:text-white">×</button>
            </div>

            <p className="mb-3 text-[13px] text-white/60">Selecione os motivos:</p>
            <div className="mb-5 space-y-2">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggle(reason)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[13px] transition ${selected.includes(reason) ? "border-[#A855F7] bg-[#A855F7]/10 text-white" : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]"}`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected.includes(reason) ? "border-[#A855F7] bg-[#A855F7]" : "border-white/30"}`}>
                    {selected.includes(reason) && <svg viewBox="0 0 12 12" width={9} height={9} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="10 3 5 9 2 6" /></svg>}
                  </span>
                  {reason}
                </button>
              ))}
            </div>

            {error && <p className="mb-3 text-[12px] text-red-300">{error}</p>}
            <button type="button" onClick={() => void handleSubmit()} disabled={selected.length === 0 || sending} className="w-full rounded-full bg-red-500 py-2.5 text-[14px] font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? "Enviando…" : "Enviar denúncia"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
 
