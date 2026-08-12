"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import { FlameIcon } from "../components/FlameIcon";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";
import CloudChat from "../cloud/[id]/CloudChat";

type CloudAuthor = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
};

type FollowingCloud = {
  id: string;
  title: string;
  description: string | null;
  duration: string;
  visibility: "public" | "private";
  status: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  author: CloudAuthor;
  hypesCount: number;
  membersCount: number;
  href: string;
};

function SearchIcon({ s = 23 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function BellIcon({ s = 23 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function GearIcon({ s = 23 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function HomeIcon({ s = 24, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function MessageIcon({ s = 24, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MeetIcon({ s = 24, className = "" }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TrendingIcon({ s = 24, className = "" }: { s?: number; className?: string }) {
  return <FlameIcon s={s} className={className} />;
}

function parseDurationSeconds(duration: string) {
  const map: Record<string, number> = {
    "5 min": 5 * 60,
    "10 min": 10 * 60,
    "30 min": 30 * 60,
    "1h": 60 * 60,
    "24h": 24 * 60 * 60,
  };

  return map[duration] ?? 5 * 60;
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

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
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

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ShareModal({ cloudTitle, cloudUrl, onClose }: { cloudTitle: string; cloudUrl: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-t-3xl border border-white/[0.08] bg-[#1a0e3d] p-5 pb-8" onClick={(event) => event.stopPropagation()}>
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
            <ShareIcon />
            Compartilhar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function FollowingCloudStage({
  clouds,
  expandedCloudId,
  onToggleExpand,
  onEnterConversation,
}: {
  clouds: FollowingCloud[];
  expandedCloudId: string | null;
  onToggleExpand: (cloudId: string) => void;
  onEnterConversation: (cloudId: string) => void; // keeps cloudId: just sets stage index
}) {
  const [shareTarget, setShareTarget] = useState<FollowingCloud | null>(null);
  const siteOrigin = useSiteOrigin();

  return (
    <>
      <div className="topic-scroll flex h-full flex-col gap-4 overflow-y-auto py-4 pr-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">
            <span className="h-2 w-2 rounded-full bg-[#9333EA]" />
            Ao vivo agora
          </div>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-[#120a2e] px-4 text-[13px] font-semibold text-white/80 transition hover:border-white/20 hover:bg-[#16161C]"
          >
            Todos os tópicos
            <ChevronRightIcon />
          </button>
        </div>

        {clouds.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-[#1a0e3d]">
              <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-white/30" aria-hidden="true">
                <path d="M6 16H5.5a3.5 3.5 0 0 1 0-7 .5.5 0 0 1 .1 0A5 5 0 0 1 15 9.5a3 3 0 0 1 0 6H8" />
                <path d="M8 16c0 1.5-.5 2.5-1.5 3.5C7.5 19 9 18 9.5 16" />
              </svg>
            </div>
            <div>
              <p className="text-[18px] font-semibold text-white">Nenhum tópico disponível</p>
              <p className="mt-2 max-w-[340px] text-[14px] text-white/50">
                As pessoas que você segue não têm Clouds ativas no momento. Que tal descobrir novos perfis?
              </p>
            </div>
            <Link
              href="/meet"
              className="inline-flex items-center gap-2 rounded-full bg-[#A855F7] px-8 py-3 text-[15px] font-semibold text-white transition hover:bg-[#9333EA]"
            >
              <MeetIcon s={18} className="text-white" />
              Descobrir pessoas
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-2">
            {clouds.map((cloud) => {
              const remaining = Math.max(parseDurationSeconds(cloud.duration) - Math.floor((Date.now() - new Date(cloud.createdAt).getTime()) / 1000), 0);
              const isEnded = remaining <= 0;
              const isEndingSoon = remaining > 0 && remaining < 5 * 60;
              const expanded = expandedCloudId === cloud.id;
              const creatorHandle = cloud.author.username.replace(/^@/, "");
              const creatorName = cloud.author.name;
              const createdLabel = "há pouco";
              const participantAvatars = [
                cloud.author.avatarUrl ?? `https://i.pravatar.cc/96?img=${(hashString(`${cloud.id}-author`) % 70) + 1}`,
                `https://i.pravatar.cc/96?img=${(hashString(`${cloud.id}-participant-1`) % 70) + 1}`,
                `https://i.pravatar.cc/96?img=${(hashString(`${cloud.id}-participant-2`) % 70) + 1}`,
              ];
              const participantLabel = cloud.membersCount >= 1000
                ? `${(cloud.membersCount / 1000).toFixed(1).replace(".0", "")}K participantes`
                : `${cloud.membersCount} participantes`;

              return (
                <article
                  key={cloud.id}
                  className="rounded-[22px] border border-white/[0.10] bg-[radial-gradient(circle_at_78%_42%,rgba(74,25,70,0.16),transparent_26%),linear-gradient(135deg,#0D1018,#08090E_62%)] px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.24)] transition hover:border-white/[0.18] md:px-7 md:py-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Link href={`/users/${creatorHandle}`} className="shrink-0">
                        {cloud.author.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cloud.author.avatarUrl}
                            alt={creatorName}
                            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/15 md:h-14 md:w-14"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#9333EA] text-[14px] font-bold text-white ring-1 ring-white/15 md:h-14 md:w-14">
                            {creatorName.trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                      </Link>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/users/${creatorHandle}`} className="truncate text-[15px] font-semibold text-white hover:underline md:text-[17px]">
                            @{creatorHandle}
                          </Link>
                          <span className="rounded-full border border-[#A855F7]/70 px-2.5 py-0.5 text-[12px] font-medium text-[#C084FC]">Criador</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-white/50 md:text-[13px]">{createdLabel}</p>
                      </div>
                    </div>
                    <button type="button" aria-label="Mais opções" className="rounded-full p-2 text-[20px] leading-none text-white/70 transition hover:bg-white/10 hover:text-white">
                      ⋮
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_285px] lg:items-center">
                    <div className="min-w-0">
                      <h3 className="text-[26px] font-extrabold leading-[1.08] tracking-[-0.04em] text-white md:text-[31px]">
                        {cloud.title}
                      </h3>
                      {expanded ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-6 text-white/65 md:text-[16px]">
                          {cloud.description ?? `Tópico em alta sobre ${cloud.title.toLowerCase()}.`}
                        </p>
                      ) : (
                        <p className="mt-2 line-clamp-2 text-[15px] leading-6 text-white/65 md:text-[16px]">
                          {cloud.description ?? `Tópico em alta sobre ${cloud.title.toLowerCase()}.`}
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
                          <span>{String(Math.floor(remaining / 3600)).padStart(2, "0")}</span><span>:</span><span>{String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}</span><span>:</span><span>{String(remaining % 60).padStart(2, "0")}</span>
                        </div>
                      )}
                      {!isEnded && <div className="mt-1 grid grid-cols-3 text-center text-[11px] uppercase text-white/50 md:text-[13px]"><span>horas</span><span>min</span><span>seg</span></div>}
                      <button
                        type="button"
                        onClick={() => onEnterConversation(cloud.id)}
                        className="mt-3 flex h-11 w-full items-center justify-center rounded-[20px] border border-[#9B6CFF] bg-[#0C0D18] px-6 text-[16px] font-semibold text-white shadow-[inset_0_0_20px_rgba(124,58,237,0.12),0_0_25px_rgba(124,58,237,0.12)] transition hover:bg-[#161128] md:text-[17px]"
                      >
                        Entrar na conversa
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.07] pt-4 md:mt-5 md:flex-row md:items-center">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-white/70 md:text-[16px]">
                      <button type="button" className="inline-flex items-center gap-3 transition hover:text-pink-300">
                        <HeartIcon s={25} className="text-white/65" />
                        <span>{Math.max(1, Math.round((cloud.hypesCount ?? 0) * 3.05))}</span>
                      </button>
                      <button type="button" className="inline-flex items-center gap-3 transition hover:text-orange-300">
                        <FlameIcon s={24} className="text-[#FF632D]" />
                        <span>{cloud.hypesCount ?? 0}</span>
                      </button>
                      <button type="button" onClick={() => setShareTarget(cloud)} className="inline-flex items-center gap-3 transition hover:text-[#C084FC]">
                        <ShareIcon />
                        <span>Compartilhar</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 self-start md:self-auto">
                      <div className="flex -space-x-3">
                        {participantAvatars.map((avatar) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={avatar} src={avatar} alt="Participante" className="h-10 w-10 rounded-full border-2 border-[#0B0C12] object-cover md:h-12 md:w-12" referrerPolicy="no-referrer" />
                        ))}
                        {cloud.membersCount > 3 && <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0B0C12] bg-[#1B1D26] text-[11px] font-semibold text-white/80 md:h-12 md:w-12">+{cloud.membersCount >= 1000 ? "1K" : cloud.membersCount - 3}</span>}
                      </div>
                      <span className="text-[14px] text-white/55 md:text-[17px]">{participantLabel}</span>
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
          cloudUrl={`${siteOrigin}${shareTarget.href}`}
          onClose={() => setShareTarget(null)}
        />
      )}
    </>
  );
}

export default function FollowingPage() {
  const { user } = useSessionUser();
  const [clouds, setClouds] = useState<FollowingCloud[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [expandedCloudId, setExpandedCloudId] = useState<string | null>(null);
  const [homeStage, setHomeStage] = useState<"topics" | "live">("topics");
  const [currentCloudIndex, setCurrentCloudIndex] = useState(0);
  const [slideAnim, setSlideAnim] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadFollowing = async () => {
      setLoading(true);

      try {
        const response = await fetch("/api/clouds/following", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { ok?: boolean; clouds?: FollowingCloud[] } | null;

        if (!cancelled) {
          setClouds(response.ok && Array.isArray(payload?.clouds) ? payload.clouds : []);
        }
      } catch {
        if (!cancelled) {
          setClouds([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFollowing();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (clouds.length === 0) {
      setCurrentCloudIndex(0);
      setHomeStage("topics");
      return;
    }

    setCurrentCloudIndex((current) => Math.min(current, clouds.length - 1));
  }, [clouds.length]);

  const navigateCloud = (direction: number) => {
    const dir = direction > 0 ? "left" : "right";
    setSlideAnim(dir);
    setTimeout(() => {
      setCurrentCloudIndex((prev) => {
        const newIndex = prev + direction;
        if (newIndex < 0) return clouds.length - 1;
        if (newIndex >= clouds.length) return 0;
        return newIndex;
      });
      setSlideAnim(null);
    }, 260);
  };

  const enterConversation = (cloudId: string) => {
    const nextIndex = clouds.findIndex((cloud) => cloud.id === cloudId);
    setCurrentCloudIndex(nextIndex >= 0 ? nextIndex : 0);
    setSlideAnim(null);
    setExpandedCloudId(null);
    setHomeStage("live");
  };

  const currentCloud = useMemo(() => clouds[currentCloudIndex], [clouds, currentCloudIndex]);
  const remaining = currentCloud
    ? Math.max(parseDurationSeconds(currentCloud.duration) - Math.floor((now - new Date(currentCloud.createdAt).getTime()) / 1000), 0)
    : 0;
  const isLive = remaining > 0;
  const isEndingSoon = remaining > 0 && remaining < 5 * 60;

  return (
    <div className="min-h-screen text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08]" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,5,40,0.40) 0%, rgba(8,3,20,0.85) 45%, #030208 100%)" }}>
        <div className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between gap-4 px-3 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <HeaderBrand />
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
            <Link href="/" className="inline-flex h-12 items-center rounded-xl px-4 text-[17px] font-semibold text-white/60 transition-colors hover:text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 45%, transparent 100%)" }}>
              For You
            </Link>
            <Link href="/following" className="relative inline-flex h-12 items-center rounded-xl px-4 text-[17px] font-semibold text-white transition-colors hover:text-white/80" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(168,85,247,0.25) 0%, rgba(168,85,247,0.10) 45%, transparent 100%)" }}>
              Seguindo
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#A855F7]" />
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <button type="button" aria-label="Buscar" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <SearchIcon s={23} />
            </button>
            <button type="button" aria-label="Notificações" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <BellIcon s={23} />
            </button>
            <Link href="/settings" aria-label="Configurações" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">
              <GearIcon s={23} />
            </Link>
            <Link href="/profile" aria-label="Meu perfil" className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#9333EA] text-[17px] font-bold text-white transition hover:bg-[#6D28D9]">
              <SessionUserAvatar user={user} size={48} />
            </Link>
          </div>
        </div>
      </header>

      <main className="fixed inset-x-0 top-[88px] bottom-[72px] overflow-y-auto">
        <div className="mx-auto flex h-full max-w-[1280px] px-3 py-4 lg:px-6">
          {loading ? (
            <div className="flex flex-1 items-center justify-center rounded-[28px] border border-white/[0.06] bg-[#120a2e] p-6 text-center text-[13px] text-white/45">
              Carregando clouds de quem você segue...
            </div>
          ) : homeStage === "topics" ? (
            <div className="flex-1">
              <FollowingCloudStage
                clouds={clouds}
                expandedCloudId={expandedCloudId}
                onToggleExpand={(cloudId) => setExpandedCloudId((current) => (current === cloudId ? null : cloudId))}
                onEnterConversation={enterConversation}
              />
            </div>
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
                <div className="relative flex flex-1 flex-col overflow-hidden py-4">
                  <button
                    onClick={() => navigateCloud(-1)}
                    aria-label="Cloud anterior"
                    className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[#9333EA]/20 text-[#A855F7] transition hover:bg-[#9333EA]/40"
                  >
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>

                  <div
                    className="mx-12 flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#120a2e]"
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
                    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[20px] font-semibold text-white">{currentCloud.title}</h2>
                        <div className="mt-1.5 flex items-center gap-2">
                          {isLive ? (
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-semibold ${isEndingSoon ? "bg-[#FF5B5B]/15 text-[#FF5B5B]" : "bg-[#22C55E]/15 text-[#22C55E]"}`}>
                              <span className="relative flex h-2 w-2">
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isEndingSoon ? "bg-[#FF5B5B]" : "bg-[#22C55E]"}`} />
                                <span className={`relative inline-flex h-2 w-2 rounded-full ${isEndingSoon ? "bg-[#FF5B5B]" : "bg-[#22C55E]"}`} />
                              </span>
                              AO VIVO · {formatCountdown(remaining)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-white/10 px-3 py-0.5 text-[11px] font-semibold text-white/40">ENCERRADA</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <CloudChat
                        cloudId={currentCloud.id}
                        title={currentCloud.title}
                        duration={currentCloud.duration}
                        createdAt={currentCloud.createdAt}
                        participants={currentCloud.membersCount}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => navigateCloud(1)}
                    aria-label="Próxima Cloud"
                    className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-[#9333EA]/20 text-[#A855F7] transition hover:bg-[#9333EA]/40"
                  >
                    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-[#060410]">
        <div className="mx-auto flex max-w-[480px] items-center justify-around px-4 py-5">
          <Link href="/" className="flex flex-col items-center gap-2 text-white/40 transition hover:text-white">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"/>
              <path d="M9 21V12h6v9"/>
            </svg>
            <span className="text-[13px] font-semibold">Home</span>
          </Link>
          <Link href="/messages" className="flex flex-col items-center gap-2 text-white/40 transition hover:text-white">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="text-[13px] font-semibold">Messages</span>
          </Link>
          <Link href="/trending" className="flex flex-col items-center gap-2 text-white/40 transition hover:text-white">
            <FlameIcon s={30} />
            <span className="text-[13px] font-semibold">Trending</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
