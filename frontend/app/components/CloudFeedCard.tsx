"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FlameIcon } from "./FlameIcon";

export type FeedCloud = {
  id: string;
  title: string;
  category: string;
  duration: string;
  createdAt: Date;
  visibility: "public" | "private";
  href?: string;
  likes?: number;
  hypes?: number;
  description?: string;
  liveParticipants?: number;
  authorName?: string;
  authorHandle?: string;
  authorPhoto?: string;
  authorId?: string;
};

function parseDurationSeconds(duration: string) {
  const map: Record<string, number> = {
    "30min": 30 * 60,
    "1h": 60 * 60,
    "2h": 2 * 60 * 60,
    "5h": 5 * 60 * 60,
    "24h": 24 * 60 * 60,
  };

  return map[duration] ?? 30 * 60;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function useSiteOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "http://localhost:3000",
  );
}

function ShareModal({ cloudTitle, cloudUrl, onClose }: { cloudTitle: string; cloudUrl: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[520px] rounded-t-3xl border border-white/[0.08] bg-[#1a0e3d] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <p className="mb-4 text-[13px] font-semibold text-white/50">Compartilhar {cloudTitle}</p>
        <div className="rounded-2xl border border-white/[0.08] bg-[#120a2e] px-4 py-3 text-[13px] text-white/60">
          {cloudUrl}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(cloudUrl);
              onClose();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#9333EA] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9]"
          >
            Copiar link
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Veja esta cloud: ${cloudUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-[14px] font-semibold text-white/80 transition hover:bg-white/[0.1]"
          >
            Compartilhar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

export function CloudFeedCard({ cloud, onHypar }: { cloud: FeedCloud; onHypar: () => void }) {
  const [hyped, setHyped] = useState(false);
  const [hypes, setHypes] = useState(cloud.hypes ?? 0);
  const [shareOpen, setShareOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const siteOrigin = useSiteOrigin();

  const shareUrl = cloud.href ?? `/cloud/${cloud.id}`;
  const fullShareUrl = `${siteOrigin}${shareUrl}`;
  const durationSeconds = parseDurationSeconds(cloud.duration);
  const elapsedSeconds = Math.floor((now - cloud.createdAt.getTime()) / 1000);
  const remainingSeconds = Math.max(durationSeconds - elapsedSeconds, 0);
  const isLive = remainingSeconds > 0;
  const countdownLabel = formatCountdown(remainingSeconds);
  const participantCount = cloud.liveParticipants ?? Math.max(18, (cloud.hypes ?? 0) + 24);
  const participantAvatars = [
    cloud.authorPhoto ?? `https://i.pravatar.cc/96?img=${(hashString(`${cloud.id}-author`) % 70) + 1}`,
    `https://i.pravatar.cc/96?img=${(hashString(`${cloud.id}-participant-1`) % 70) + 1}`,
    `https://i.pravatar.cc/96?img=${(hashString(`${cloud.id}-participant-2`) % 70) + 1}`,
  ];

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleHypar = () => {
    setHyped((value) => !value);
    setHypes((value) => (hyped ? value - 1 : value + 1));
    onHypar();
  };

  return (
    <article className="w-full rounded-2xl border border-white/[0.08] bg-[#111116] px-6 py-5 transition hover:border-white/20">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full"
              style={{ backgroundColor: isLive ? "#22C55E" : "#F87171", opacity: 0.7 }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: isLive ? "#22C55E" : "#F87171" }}
            />
          </span>
          <span className={isLive ? "text-[#22C55E]" : "text-[#F87171]"}>
            {isLive ? "AO VIVO" : "ENCERRADA"} - {cloud.duration}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/60">
            {isLive ? countdownLabel : "00:00"}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
            cloud.visibility === "public" ? "bg-[#2563EB]/10 text-[#93C5FD]" : "bg-[#7C3AED]/10 text-[#E9D5FF]"
          }`}
        >
          {cloud.visibility === "public" ? "Público" : "Privado"}
        </span>
      </div>

      <h2 className="mt-4 text-[20px] font-semibold leading-snug text-white">{cloud.title}</h2>

      {cloud.description && (
        <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-white/60">
          {cloud.description}
        </p>
      )}

      <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-4 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-white/70 md:text-[16px]">
          <button type="button" onClick={handleHypar} className="inline-flex items-center gap-3 transition hover:text-orange-300">
            <FlameIcon s={24} className="text-[#FF632D]" />
            <span>{hypes}</span>
          </button>
          <button type="button" onClick={() => setShareOpen(true)} className="inline-flex items-center gap-3 transition hover:text-[#C084FC]">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 11 13" />
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
            </svg>
            <span>Compartilhar</span>
          </button>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex -space-x-3">
            {participantAvatars.map((avatar) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={avatar}
                src={avatar}
                alt="Participante"
                className="h-10 w-10 rounded-full border-2 border-[#0B0C12] object-cover md:h-12 md:w-12"
                referrerPolicy="no-referrer"
              />
            ))}
            {participantCount > 3 && (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0B0C12] bg-[#1B1D26] text-[11px] font-semibold text-white/80 md:h-12 md:w-12">
                +{participantCount >= 1000 ? "1K" : participantCount - 3}
              </span>
            )}
          </div>
          <span className="text-[14px] text-white md:text-[17px]">
            {participantCount >= 1000 ? `${(participantCount / 1000).toFixed(1).replace(".0", "")}K participantes` : `${participantCount} participantes`}
          </span>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={`${cloud.href ?? `/cloud/${cloud.id}`}?title=${encodeURIComponent(cloud.title)}&duration=${encodeURIComponent(cloud.duration)}&createdAt=${encodeURIComponent(cloud.createdAt.toISOString())}&participants=${cloud.liveParticipants ?? 1}&visibility=${encodeURIComponent(cloud.visibility)}`}
          className="inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED]"
        >
          Entrar na conversa
        </Link>
      </div>

      {shareOpen && (
        <ShareModal cloudTitle={cloud.title} cloudUrl={fullShareUrl} onClose={() => setShareOpen(false)} />
      )}
    </article>
  );
}
