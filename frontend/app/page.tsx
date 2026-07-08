"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import CloudChat from "./cloud/[id]/CloudChat";

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
  hypes?: number;
  audioUrl?: string;
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
    href: "/cloud/seed-1",
    hypes: 42,
  },
  {
    id: "seed-2",
    title: "Qual album do ano vai dominar?",
    category: "Music",
    duration: "30 min",
    createdAt: new Date(Date.now() - 14 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-2",
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
    href: "/cloud/seed-3",
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
    href: "/cloud/seed-4",
    hypes: 113,
  },
  {
    id: "seed-5",
    title: "Futebol: tabela e expectativas",
    category: "Sports",
    duration: "30 min",
    createdAt: new Date(Date.now() - 2 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-5",
    hypes: 58,
  },
  {
    id: "seed-6",
    title: "Memes do momento — compartilhe o seu",
    category: "Memes",
    duration: "10 min",
    createdAt: new Date(Date.now() - 1 * 60 * 1000),
    mode: "text",
    visibility: "public",
    href: "/cloud/seed-6",
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

const DURATIONS = ["5 min", "10 min", "30 min", "1h", "24h"];

const DURATION_SECONDS: Record<string, number> = {
  "5 min": 5 * 60,
  "10 min": 10 * 60,
  "30 min": 30 * 60,
  "1h": 60 * 60,
  "24h": 24 * 60 * 60,
};

function parseDurationSeconds(duration: string) {
  return DURATION_SECONDS[duration] ?? 5 * 60;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 1C9.5 5.5 7 8.5 7 12.5c0 5 4 9 5 9s5-4 5-9c0-2-.5-3.5-1.5-5 .3 1.5.2 2.5-.5 3.5C14.5 9 13.5 5.5 12 1Z" />
      <path d="M12 1C10 5 8 8 8 12c0 4.5 3.5 8.5 4 9-.5-1.5-1-3-1-5 0-2 .8-4 1.5-5.5C13 12.5 13 14 12.5 16c1.5-1.5 3-3.5 3-6 0-2-.5-3.5-1-5C15 6.5 15 7.5 14.5 8.5 14 5 13 2.5 12 1Z" />
      <path opacity="0.4" d="M12 7.5c.5 1.5 1 3 1 4.5 0 2.5-1 4.5-1 5-.5-1-1-2.5-1-5 0-1.5.5-3 1-4.5Z" />
    </svg>
  );
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

function HeartIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
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

// ─── Cloud Card ───────────────────────────────────────────────────────────────

function CloudCard({ cloud, onHypar }: { cloud: Cloud; onHypar: () => void }) {
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const siteOrigin = useSiteOrigin();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const cat = CATEGORIES.find(c => c.name === cloud.category) ?? CATEGORIES[1];
  const shareUrl = cloud.href ?? `/cloud/${cloud.id}`;
  const fullShareUrl = `${siteOrigin}${shareUrl}`;
  const messengerHref = `/messages?share=${encodeURIComponent(fullShareUrl)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Participe da Cloud "${cloud.title}" aqui: ${fullShareUrl}`)}`;
  const durationSeconds = parseDurationSeconds(cloud.duration);
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

  return (
    <article className="w-full rounded-2xl border border-white/[0.08] bg-[#111116] px-6 py-5 transition hover:border-white/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold text-white"
          style={{ backgroundColor: cat.bg, color: cat.color ?? "#fff" }}
        >
          {cloud.category.toUpperCase()}
        </span>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ backgroundColor: isLive ? "#22C55E" : "#F87171", opacity: 0.7 }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: isLive ? "#22C55E" : "#F87171" }} />
          </span>
          <span className={isLive ? "text-[#22C55E]" : "text-[#F87171]"}>
            {isLive ? "AO VIVO" : "ENCERRADA"} · {cloud.duration}
          </span>
          {isLive ? (
            <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/80">{countdownLabel}</span>
          ) : (
            <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/60">00:00</span>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${cloud.visibility === "public" ? "bg-[#2563EB]/10 text-[#93C5FD]" : "bg-[#7C3AED]/10 text-[#E9D5FF]"}`}>
          {cloud.visibility === "public" ? "Público" : "Privado"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h2 className="text-[20px] font-semibold text-white leading-snug">{cloud.title}</h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[12px] font-semibold text-white/80">
          <FireIcon s={16} /> {cloud.hypes ?? 0} hypes
        </span>
      </div>

      {cloud.mode === "audio" && cloud.audioUrl && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#1C1730] px-4 py-3">
          <audio controls src={cloud.audioUrl} className="w-full h-8 accent-[#9333EA]" />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
        <span className="text-[12px] text-white/40">Publicado {timeAgo}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={cloud.href ?? "/"} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10">
            Entrar na conversa
          </Link>
          <button
            type="button"
            onClick={onHypar}
            className="inline-flex items-center gap-2 rounded-full bg-[#FF6A00] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#ff7e24] transition"
          >
            <FireIcon s={16} /> Hypar
          </button>
          <div className="relative" ref={shareRef}>
            <button
              type="button"
              onClick={() => setShareOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#7C3AED] transition"
            >
              <ShareIcon /> Compartilhar Cloud
            </button>
            {shareOpen && (
              <div className="absolute right-0 z-20 mt-2 w-[220px] rounded-2xl border border-white/10 bg-[#0F172A] p-2 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                <Link
                  href={messengerHref}
                  className="block rounded-xl px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-white/5"
                  onClick={() => setShareOpen(false)}
                >
                  Enviar no mensageiro
                </Link>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block rounded-xl px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-white/5"
                  onClick={() => setShareOpen(false)}
                >
                  Enviar pelo WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
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

function CreateCloudModal({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: (cloud: Omit<Cloud, "id" | "createdAt" | "mode">) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[1].name);
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const handlePublish = () => {
    if (!title.trim()) return;
    onPublish({ title: title.trim(), category, duration, visibility });
    onClose();
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
              onKeyDown={e => e.key === "Enter" && handlePublish()}
              placeholder="Título da sua Cloud..."
              className="w-full rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#9333EA] transition"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">Categoria</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded-xl bg-[#252840] border border-white/[0.08] px-4 py-3 text-[14px] text-white outline-none focus:border-[#9333EA] transition"
            >
              {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
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
                  onClick={() => setVisibility(option)}
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
            disabled={!title.trim()}
            className="w-full rounded-full bg-[#9333EA] py-3 text-[15px] font-semibold text-white hover:bg-[#7C3AED] transition mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Publicar Cloud
          </button>
        </div>
      </div>
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
  const [category, setCategory] = useState(CATEGORIES[1].name);
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("done");
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRef.current = recorder;
      setSeconds(0);
      setStatus("recording");
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      setError("Permissão de microfone negada. Verifique as configurações do navegador.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handlePublish = () => {
    if (!audioUrl) return;
    onPublish({ title: `Áudio · ${fmt(seconds)}`, category, duration, visibility, audioUrl });
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

          {/* Audio preview */}
          {audioUrl && (
            <audio controls src={audioUrl} className="w-full accent-[#9333EA]" />
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
          AO VIVO · {poll.duration}
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
          {totalVotes} {totalVotes === 1 ? "voto" : "votos"} · publicado {timeAgo}
        </span>
        {poll.votedOptionId && (
          <span className="text-[12px] text-[#22C55E]">✓ Você votou</span>
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

  const addOption = () => { if (options.length < 6) setOptions(o => [...o, ""]); };
  const removeOption = (i: number) => { if (options.length > 2) setOptions(o => o.filter((_, idx) => idx !== i)); };
  const updateOption = (i: number, val: string) => setOptions(o => o.map((v, idx) => idx === i ? val : v));

  const canPublish = question.trim() && options.filter(o => o.trim()).length >= 2;

  const handlePublish = () => {
    if (!canPublish) return;
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

function SearchModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-[560px] rounded-2xl bg-[#1C1F2E] border border-white/10 p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 rounded-xl bg-[#252840] px-4 py-3">
          <SearchIcon s={18} />
          <input autoFocus type="text" placeholder="Buscar clouds, categorias, pessoas..."
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none" />
          <button onClick={onClose} className="text-white/40 hover:text-white"><XIcon s={16} /></button>
        </div>
        <p className="mt-3 px-1 text-[12px] text-white/30">Pressione ESC para fechar</p>
      </div>
    </div>
  );
}

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute right-4 top-[96px] w-[340px] rounded-2xl bg-[#1C1F2E] border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <span className="text-[15px] font-bold text-white">Notificações</span>
          <button onClick={onClose} className="text-white/40 hover:text-white"><XIcon s={16} /></button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <BellIcon s={32} />
          <p className="mt-3 text-[14px] font-semibold text-white">Nenhuma notificação</p>
          <p className="mt-1 text-[12px] text-white/40">Você está em dia com tudo.</p>
        </div>
      </div>
    </div>
  );
}

function ProfileMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute right-4 top-[96px] w-[220px] rounded-2xl bg-[#1C1F2E] border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-[14px] font-bold text-white">F</div>
            <div>
              <p className="text-[14px] font-semibold text-white">Fabrício</p>
              <p className="text-[12px] text-white/40">Ver perfil</p>
            </div>
          </div>
        </div>
        <button className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-white/80 hover:bg-white/[0.05] hover:text-white transition">
          <span className="text-white/50"><UserIcon s={16} /></span> Meu Perfil
        </button>
        <button className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-white/80 hover:bg-white/[0.05] hover:text-white transition">
          <span className="text-white/50"><GearIcon s={16} /></span> Configurações
        </button>
        <div className="border-t border-white/[0.07]">
          <button className="flex w-full items-center gap-3 px-4 py-3 text-[14px] text-red-400 hover:bg-white/[0.05] transition">
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Page() {
  // Menu de categorias removido: feed sem filtro.

  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(0);
  const router = useRouter();
  const [modal, setModal] = useState<"search" | "create" | "notifications" | "profile" | "record" | "poll" | null>(null);
  const [currentCloudIndex, setCurrentCloudIndex] = useState(0);
  // Simulated participant count: starts at a seeded value per cloud, fluctuates every few seconds
  const [participants, setParticipants] = useState<number>(0);

  // Slide animation: "left" = next, "right" = prev, null = settled
  const [slideAnim, setSlideAnim] = useState<"left" | "right" | null>(null);

  const navigateCloud = (direction: number) => {
    const dir = direction > 0 ? "left" : "right";
    setSlideAnim(dir);
    setTimeout(() => {
      setCurrentCloudIndex(prev => {
        const newIndex = prev + direction;
        if (newIndex < 0) return clouds.length - 1;
        if (newIndex >= clouds.length) return 0;
        return newIndex;
      });
      setSlideAnim(null);
    }, 260);
  };


  useEffect(() => {
    // Gate de primeira visita: primeiro acesso vai para /login,
    // visitas seguintes renderizam o feed normalmente.
    let firstVisit = false;
    try {
      const key = "cloudscommunity:seen";
      const seen = localStorage.getItem(key);
      if (!seen) {
        localStorage.setItem(key, "1");
        firstVisit = true;
      }
    } catch {
      // ignore (ex: SSR ou modo privado restrito)
    }

    if (firstVisit) {
      router.replace("/login");
      // Não hidrata o feed — a página será substituída pelo /login.
      return;
    }

    try {
      const storedClouds = localStorage.getItem("cloudscommunity:clouds");
      if (storedClouds) {
        const parsed = JSON.parse(storedClouds) as Array<Omit<Cloud, "createdAt"> & { createdAt: string }>;
        const loaded = parsed.map((cloud) => ({
          ...cloud,
          createdAt: new Date(cloud.createdAt),
        }));
        // Merge seed clouds that are not already stored
        const existingIds = new Set(loaded.map(c => c.id));
        const missing = SEED_CLOUDS.filter(c => !existingIds.has(c.id));
        setClouds([...loaded, ...missing]);
      } else {
        setClouds(SEED_CLOUDS);
      }
    } catch {
      setClouds(SEED_CLOUDS);
    }

    try {
      const storedPolls = localStorage.getItem("cloudscommunity:polls");
      if (storedPolls) {
        const parsed = JSON.parse(storedPolls) as Array<Omit<Poll, "createdAt"> & { createdAt: string }>;
        setPolls(parsed.map((poll) => ({
          ...poll,
          createdAt: new Date(poll.createdAt),
        })));
      }
    } catch {
      // ignore invalid stored polls
    }

    setHydrated(true);
    // router from next/navigation is stable; keeping deps empty is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("cloudscommunity:clouds", JSON.stringify(clouds));
  }, [clouds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("cloudscommunity:polls", JSON.stringify(polls));
  }, [polls, hydrated]);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset + seed participants when active cloud changes
  useEffect(() => {
    if (clouds.length === 0) return;
    const base = 12 + ((clouds[currentCloudIndex]?.id.charCodeAt(0) ?? 0) % 40);
    setParticipants(base);
  }, [currentCloudIndex, clouds]);

  // Simulate users joining/leaving every 3–7 seconds
  useEffect(() => {
    if (clouds.length === 0) return;
    const iv = setInterval(() => {
      setParticipants(p => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(1, p + delta);
      });
    }, 3000 + Math.floor(Math.random() * 4000));
    return () => clearInterval(iv);
  }, [currentCloudIndex, clouds.length]);

  const closeModal = () => setModal(null);

  const publishCloud = (data: Omit<Cloud, "id" | "createdAt" | "mode"> & { audioUrl?: string }) => {
    const id = crypto.randomUUID();
    setClouds(prev => [{
      ...data,
      id,
      createdAt: new Date(),
      mode: data.audioUrl ? "audio" : "text",
      href: `/cloud/${id}`,
      hypes: 0,
    }, ...prev]);
  };

  const hyparCloud = (cloudId: string) => {
    setClouds(prev => prev.map(c => c.id === cloudId ? { ...c, hypes: (c.hypes ?? 0) + 1 } : c));
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
  const visibleItems = allItems;

  // Aguarda hidratação para evitar flash do feed antes de um possível redirect.
  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-[#09090B] text-white">

      {/* Modals */}
      {modal === "search"        && <SearchModal onClose={closeModal} />}
      {modal === "create"        && <CreateCloudModal onClose={closeModal} onPublish={publishCloud} />}
      {modal === "poll"          && <CreatePollModal onClose={closeModal} onPublish={publishPoll} />}
      {modal === "notifications" && <NotificationsPanel onClose={closeModal} />}
      {modal === "profile"       && <ProfileMenu onClose={closeModal} />}
      {modal === "record"        && <RecordAudioModal onClose={closeModal} onPublish={publishCloud} />}

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between gap-4 px-5 lg:px-8">
          <a href="#feed" className="flex shrink-0 items-center gap-3">
            <Image src="/logo_clouds.png" alt="Clouds Community" width={64} height={64} className="object-contain" style={{ width: 64, height: 64 }} priority />
            <div className="leading-none">
              <div className="text-[34px] font-extrabold tracking-[-0.02em] text-white">Clouds</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.6em] text-white/50">Community</div>
            </div>
          </a>

          <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
            <Link href="/" className="relative inline-flex h-12 items-center px-2 text-[17px] font-semibold text-white transition-colors hover:text-white/80">
              For You
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#A855F7]"></span>
            </Link>
            <Link href="/following" className="inline-flex h-12 items-center px-2 text-[17px] font-semibold text-white/60 transition-colors hover:text-white">
              Seguindo
            </Link>

          </nav>

          <div className="flex items-center gap-3">
            <button type="button" aria-label="Buscar" onClick={() => setModal("search")}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <SearchIcon s={23} />
            </button>
            <button type="button" aria-label="Notificações" onClick={() => setModal("notifications")}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <BellIcon s={23} />
            </button>
            <Link href="/settings" aria-label="Configurações"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <GearIcon s={23} />
            </Link>
            <Link href="/profile" aria-label="Meu perfil" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7C3AED] text-[17px] font-bold text-white transition hover:bg-[#6D28D9]">
              F
            </Link>
          </div>
        </div>
      </header>

      {/* Main — ocupa o restante da viewport abaixo do header fixo (88px) e acima da nav (72px) */}
      <main className="fixed inset-x-0 top-[88px] bottom-[72px] overflow-hidden">
        <div className="mx-auto flex h-full max-w-[1280px] flex-col px-5 lg:px-8">

          {/* ── Cloud ativa ── */}
          {clouds.length > 0 && (() => {
            const cloud = clouds[currentCloudIndex];
            const durationSecs = parseDurationSeconds(cloud.duration);
            const elapsed = Math.floor((Date.now() - cloud.createdAt.getTime()) / 1000);
            const remaining = Math.max(durationSecs - elapsed, 0);
            const isLive = remaining > 0;
            void tick;
            return (
              <div className="relative flex flex-1 flex-col overflow-hidden py-4">
                {/* Arrow left */}
                <button
                  onClick={() => navigateCloud(-1)}
                  aria-label="Cloud anterior"
                  className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED]/20 text-[#A855F7] hover:bg-[#7C3AED]/40 transition"
                >
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>

                {/* Card — slide animation */}
                <div
                  className="mx-12 flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111116]"
                  style={{
                    transition: "transform 0.26s cubic-bezier(0.4,0,0.2,1), opacity 0.26s ease",
                    transform: slideAnim === "left"
                      ? "translateX(-48px)"
                      : slideAnim === "right"
                      ? "translateX(48px)"
                      : "translateX(0)",
                    opacity: slideAnim ? 0 : 1,
                  }}
                >

                  {/* ── Cabeçalho fixo dentro do card ── */}
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-4">
                    <div className="min-w-0">
                      <h2 className="text-[20px] font-semibold text-white truncate">{cloud.title}</h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#7C3AED]/20 px-3 py-0.5 text-[11px] font-semibold text-[#C084FC]">{cloud.category}</span>

                        {/* AO VIVO + countdown */}
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22C55E]/15 px-3 py-0.5 text-[11px] font-semibold text-[#22C55E]">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
                            </span>
                            AO VIVO · {formatCountdown(remaining)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/10 px-3 py-0.5 text-[11px] font-semibold text-white/40">ENCERRADA</span>
                        )}

                        {/* Participantes */}
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/50">
                          <UserIcon s={12} />
                          {participants} online
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-[#F97316]">
                      <FireIcon s={14} />
                      {cloud.hypes || 0}
                    </span>
                  </div>

                  {/* ── Chat (ocupa o restante) ── */}
                  <div className="flex-1 overflow-hidden">
                    <CloudChat cloudId={cloud.id} />
                  </div>
                </div>

                {/* Arrow right */}
                <button
                  onClick={() => navigateCloud(1)}
                  aria-label="Próxima Cloud"
                  className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED]/20 text-[#A855F7] hover:bg-[#7C3AED]/40 transition"
                >
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>

                {/* Dot indicator */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pb-1">
                  {clouds.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const dir = i > currentCloudIndex ? "left" : "right";
                        setSlideAnim(dir);
                        setTimeout(() => { setCurrentCloudIndex(i); setSlideAnim(null); }, 260);
                      }}
                      aria-label={`Ir para Cloud ${i + 1}`}
                      className="rounded-full transition-all"
                      style={{
                        width: i === currentCloudIndex ? 20 : 6,
                        height: 6,
                        background: i === currentCloudIndex ? "#A855F7" : "rgba(255,255,255,0.2)",
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Estado vazio ── */}
          {clouds.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1C1F2E] border border-white/[0.08]">
                <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-white/30" aria-hidden="true">
                  <path d="M6 16H5.5a3.5 3.5 0 0 1 0-7 .5.5 0 0 1 .1 0A5 5 0 0 1 15 9.5a3 3 0 0 1 0 6H8" />
                  <path d="M8 16c0 1.5-.5 2.5-1.5 3.5C7.5 19 9 18 9.5 16" />
                </svg>
              </div>
              <div>
                <p className="text-[18px] font-semibold text-white">Nenhuma Cloud ativa</p>
                <p className="mt-2 max-w-[340px] text-[14px] text-white/50">
                  Está muito quieto por aqui. Seja o primeiro a iniciar uma conversa!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#7C3AED]"
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
                Criar uma Cloud
              </button>
            </div>
          )}

        </div>
      </main>


      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-around px-6 py-4">
          <Link href="/" className="flex flex-col items-center gap-1.5">
            <HomeIcon s={24} className="text-[#A855F7]" />
            <span className="text-[12px] font-semibold text-[#A855F7]">Home</span>
          </Link>
          <Link href="/messages" className="flex flex-col items-center gap-1.5">
            <MessageIcon s={24} className="text-white/40" />
            <span className="text-[12px] font-semibold text-white/40">Messages</span>
          </Link>
          <Link href="/meet" className="flex flex-col items-center gap-1.5">
            <MeetIcon s={24} className="text-white/40" />
            <span className="text-[12px] font-semibold text-white/40">Meet</span>
          </Link>
        </div>
      </nav>

      {/* FAB — criar nova Cloud */}
      <button
        type="button"
        aria-label="Criar nova Cloud"
        onClick={() => setModal("create")}
        className="fixed bottom-[120px] right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#9333EA] text-white shadow-[0_4px_24px_rgba(147,51,234,0.5)] transition hover:bg-[#7C3AED] hover:scale-105 active:scale-95"
      >
        <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14" /><path d="M5 12h14" />
        </svg>
      </button>

    </div>
  );
}
