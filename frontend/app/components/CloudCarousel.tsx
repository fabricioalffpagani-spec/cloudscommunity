"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type CarouselCloud = {
  id: string;
  title: string;
  duration: string;
  createdAt: Date;
  liveParticipants?: number;
  authorPhoto?: string;
  authorName?: string;
  authorHandle?: string;
  authorId?: string;
  visibility?: "public" | "private";
  href?: string;
  participantProfiles?: Array<{ id: string; name: string; username: string; avatarUrl: string | null }>;
};

function parseDurationSeconds(duration: string) {
  const map: Record<string, number> = {
    "10min": 10 * 60,
    "30min": 30 * 60,
    "2h": 2 * 60 * 60,
    "5h": 5 * 60 * 60,
    "24h": 24 * 60 * 60,
  };

  return map[duration] ?? 30 * 60;
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

function PlusIcon({ s = 22 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function isCloudActive(cloud: CarouselCloud, now: number) {
  const elapsed = Math.floor((now - cloud.createdAt.getTime()) / 1000);
  return Math.max(parseDurationSeconds(cloud.duration) - elapsed, 0) > 0;
}

export function CloudCarousel({ clouds, onCreateCloud }: { clouds: CarouselCloud[]; onCreateCloud?: () => void }) {
  const router = useRouter();
  const [currentCloudIndex, setCurrentCloudIndex] = useState(0);
  const [slideAnim, setSlideAnim] = useState<"left" | "right" | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeClouds = clouds.filter((cloud) => isCloudActive(cloud, now));
  const safeIndex = activeClouds.length > 0 ? Math.min(currentCloudIndex, activeClouds.length - 1) : 0;
  const currentCloud = activeClouds[safeIndex] ?? null;
  const currentCountdown = currentCloud
    ? Math.max(parseDurationSeconds(currentCloud.duration) - Math.floor((now - currentCloud.createdAt.getTime()) / 1000), 0)
    : 0;

  const participants = currentCloud
    ? Math.max(1, (currentCloud.liveParticipants ?? 12 + ((currentCloud.id.charCodeAt(0) ?? 0) % 40)) + ((Math.floor(now / 4000) % 3) - 1))
    : 0;

  const navigateCloud = (direction: number) => {
    if (activeClouds.length <= 1) return;

    const dir = direction > 0 ? "left" : "right";
    setSlideAnim(dir);
    setTimeout(() => {
      setCurrentCloudIndex((prev) => {
        const newIndex = prev + direction;
        if (newIndex < 0) return activeClouds.length - 1;
        if (newIndex >= activeClouds.length) return 0;
        return newIndex;
      });
      setSlideAnim(null);
    }, 260);
  };

  const enterConversation = (cloud: CarouselCloud) => {
    const params = new URLSearchParams({
      title: cloud.title,
      duration: cloud.duration,
      createdAt: cloud.createdAt.toISOString(),
      participants: String(cloud.liveParticipants ?? 1),
      join: "1",
    });
    router.push(`/cloud/${cloud.id}?${params.toString()}`);
  };

  if (activeClouds.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/empty-clouds-available.png"
          alt="Sem clouds ativas"
          className="h-auto w-[min(72vw,420px)] select-none object-contain md:w-[420px]"
          style={{ mixBlendMode: "normal", aspectRatio: "1536 / 1024" }}
          draggable={false}
        />
        <p className="mt-4 text-[18px] font-semibold text-white/80">
          Sem clouds ativas no momento
        </p>
        {onCreateCloud && (
          <button
            type="button"
            onClick={onCreateCloud}
            className="mt-6 rounded-full bg-[#A855F7] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#9333EA]"
          >
            Criar uma Cloud
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-16">
      <button
        onClick={() => navigateCloud(-1)}
        aria-label="Cloud anterior"
        className="absolute left-[calc(50%-630px)] z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.10] text-white transition hover:bg-white/[0.20]"
      >
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <div
        className="cloud-card relative w-full max-w-[1100px] overflow-hidden rounded-3xl"
        style={{
          background: "linear-gradient(175deg, rgba(40,15,100,0.85) 0%, rgba(15,8,50,0.92) 60%, rgba(8,5,30,0.95) 100%)",
          border: "1px solid rgba(168,85,247,0.22)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          transition: "transform 0.25s ease, opacity 0.25s ease",
          transform: slideAnim === "left" ? "translateX(-36px)" : slideAnim === "right" ? "translateX(36px)" : "translateX(0)",
          opacity: slideAnim ? 0.15 : 1,
        }}
      >
        <div className="flex items-center justify-between px-10 pt-8 pb-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              {currentCloud?.authorPhoto ? (
                <img
                  src={currentCloud.authorPhoto}
                  alt={currentCloud.authorName ?? "Autor"}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED] text-xl font-bold text-white ring-2 ring-white/10">
                  {(currentCloud?.authorName ?? "A").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#0f0832] bg-[#22C55E]" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-[18px] font-semibold text-white">
                {currentCloud?.authorName ?? "Autor"}
                <svg viewBox="0 0 24 24" width={18} height={18} fill="#A855F7" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </p>
              <p className="text-[14px] text-white/45">@{currentCloud?.authorHandle ?? "user"}</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div className="flex -space-x-3" aria-label="Participantes da Cloud">
              {currentCloud?.participantProfiles?.slice(0, 7).map((participant) => participant.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={participant.id} src={participant.avatarUrl} alt={participant.name} title={participant.name} className="h-11 w-11 rounded-full border-2 border-[#160a3e] object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span key={participant.id} title={participant.name} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#160a3e] bg-[#7C3AED] text-[13px] font-bold text-white">{participant.name.slice(0, 1).toUpperCase()}</span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.07)", borderRadius: "9999px", padding: "10px 20px" }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 6v6l4 2" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              <span style={{ fontSize: "21px", fontWeight: 700, color: "#ffffff", fontVariantNumeric: "tabular-nums" }}>
                {currentCloud ? formatCountdown(currentCountdown) : "00:00:00"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", fontWeight: 600, color: "#ffffff" }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={{ color: "#ffffff" }}>{formatParticipantCount(participants)}</span>
            </div>
            <button type="button" style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <svg viewBox="0 0 24 24" width={22} height={22} fill="#ffffff" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-12 py-12 text-center">
          <h2
            className="text-[58px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[72px]"
            style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif" }}
          >
            {currentCloud?.title ?? "Nenhuma Cloud ativa no momento"}
          </h2>
        </div>

        <div className="flex justify-center px-12 pb-12">
          <button
            type="button"
            onClick={() => currentCloud && enterConversation(currentCloud)}
            disabled={!currentCloud}
            className="rounded-full border border-[#A855F7]/70 bg-transparent px-24 py-5 text-[18px] font-semibold text-white transition hover:bg-[#A855F7]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Entrar na Cloud
          </button>
        </div>

        {activeClouds.length > 1 && (
          <div className="flex justify-center gap-2 pb-5">
            {activeClouds.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  const dir = i > safeIndex ? "left" : "right";
                  setSlideAnim(dir);
                  setTimeout(() => {
                    setCurrentCloudIndex(i);
                    setSlideAnim(null);
                  }, 250);
                }}
                className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-6 bg-[#A855F7]" : "w-1.5 bg-white/20"}`}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => navigateCloud(1)}
        aria-label="Próxima Cloud"
        className="absolute left-[calc(50%+580px)] z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.10] text-white transition hover:bg-white/[0.20]"
      >
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      <button
        type="button"
        aria-label="Publicar nova Cloud"
        className="absolute bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#A855F7] text-white transition hover:scale-105 hover:bg-[#9333EA] active:scale-95"
      >
        <PlusIcon s={22} />
      </button>
    </div>
  );
}
