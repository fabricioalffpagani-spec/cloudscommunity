"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeaderBrand } from "../components/HeaderBrand";
import { MutualFollowers, type MutualFollower } from "../components/MutualFollowers";
import { FlameIcon } from "../components/FlameIcon";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";
import { NotificationsBell } from "../components/NotificationsPanel";
import { MessagesNavLink } from "../components/MessagesNavLink";
import { MobileAppNav, MobileFeedHeader, useMobileFeedTabSwipe } from "../components/MobileAppChrome";
import { GuestCloudSignupModal } from "../components/GuestCloudSignupModal";

type PublicUserProfile = {
  id: string;
  username: string;
  name: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  website: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followingCount: number;
  cloudsCount: number;
  hypesCount: number;
  showHypesCount: boolean;
  isFollowing: boolean;
  isFollowRequested?: boolean;
  isSelf: boolean;
  profileUrl: string;
};


type MeetPayload = {
  ok: boolean;
  popularRecent: Array<PublicUserProfile & { hypes: number }>;
  popularAllTime: Array<PublicUserProfile & { hypes: number }>;
  nearby: Array<PublicUserProfile & { mutualFollowersCount: number; mutualFollowers: MutualFollower[] }>;
  newUsers: PublicUserProfile[];
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



function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ProfileRow({
  user,
  onToggleFollow,
  pending,
  detail,
  mutualFollowers,
  mutualFollowersCount,
}: {
  user: PublicUserProfile;
  onToggleFollow: (user: PublicUserProfile) => void;
  pending: boolean;
  detail?: string;
  mutualFollowers?: MutualFollower[];
  mutualFollowersCount?: number;
}) {
  const initials = user.displayName.trim().charAt(0).toUpperCase() || user.username.trim().charAt(0).toUpperCase() || "C";
  const avatarColor = user.avatarUrl ? undefined : "#9333EA";
  const followLabel = user.isFollowing ? "Following" : user.isFollowRequested ? "Requested" : "Follow";

  return (
    <div className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-[#37337b] bg-[#09082a]/70 px-5 py-3 transition hover:border-[#5953a6]">
      <Link href={user.profileUrl} className="shrink-0">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={user.displayName} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#b03cff] to-[#7622d5] text-[20px] font-bold text-white">
            {initials}
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={user.profileUrl} className="truncate text-[17px] font-bold text-white hover:underline">
            {user.displayName}
          </Link>
          {user.isSelf && (
            <span className="shrink-0 rounded-full bg-[#9333EA]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#C084FC]">
              Você
            </span>
          )}
        </div>
        <p className="truncate text-[13px] text-[#9b98ed]">@{user.username}{detail ? ` · ${detail}` : ""}</p>
        {mutualFollowers && <MutualFollowers username={user.username} displayName={user.displayName} preview={mutualFollowers} count={mutualFollowersCount} />}
      </div>

      {!user.isSelf && (
        <button
          type="button"
          onClick={() => onToggleFollow(user)}
          disabled={pending}
          className={`shrink-0 rounded-full px-5 py-2 text-[13px] font-semibold transition ${
            user.isFollowing || user.isFollowRequested
              ? "border border-white/10 bg-transparent text-white/40"
              : "bg-[#9333EA] text-white hover:bg-[#6D28D9]"
          } ${pending ? "opacity-60" : ""}`}
        >
          {pending ? "..." : followLabel}
        </button>
      )}

    </div>
  );
}

export default function MeetPage() {
  return <Suspense fallback={null}><MeetPageContent /></Suspense>;
}

function MeetPageContent() {
  const { user, refresh: refreshSessionUser } = useSessionUser();
  const router = useRouter();
  const mobileFeedTabSwipe = useMobileFeedTabSwipe();
  const meetSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [guestSignupOpen, setGuestSignupOpen] = useState(false);
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null);
  const [meetData, setMeetData] = useState<MeetPayload | null>(null);
  const [meetLoading, setMeetLoading] = useState(true);
  const [meetCategory, setMeetCategory] = useState<"popular" | "nearby" | "new">("popular");

  const normalizedQuery = useMemo(() => normalize(searchQuery), [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(normalizedQuery)}&limit=10`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as { ok?: boolean; users?: PublicUserProfile[] } | null;

        if (!cancelled) {
          setResults(response.ok && Array.isArray(payload?.users) ? payload.users : []);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [normalizedQuery]);

  useEffect(() => {
    let cancelled = false;

    const loadMeet = async (initial = false) => {
      if (initial) setMeetLoading(true);
      try {
        const response = await fetch("/api/users/meet", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as MeetPayload | null;
        if (!cancelled && response.ok && payload?.ok) {
          setMeetData(payload);
        }
      } catch {
        // Keep the last successful ranking if a refresh fails.
      } finally {
        if (!cancelled && initial) setMeetLoading(false);
      }
    };

    void loadMeet(true);
    const refreshTimer = window.setInterval(() => { if (document.visibilityState === "visible") void loadMeet(); }, 5_000);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void loadMeet();
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  const toggleFollow = async (target: PublicUserProfile) => {
    if (target.isSelf) {
      return;
    }
    if (user?.isGuest) { setGuestSignupOpen(true); return; }

    setMutating(target.id);

    try {
      const method = target.isFollowing ? "DELETE" : "POST";
      const response = await fetch(`/api/follow/${encodeURIComponent(target.username)}`, {
        method,
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; user?: PublicUserProfile; message?: string } | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.message ?? "Não foi possível atualizar o follow.");
      }

      setResults((current) => current.map((item) => (item.id === payload.user!.id ? payload.user! : item)));
      void refreshSessionUser();
      setMeetData((current) => current && {
        ...current,
        popularRecent: current.popularRecent.map((item) => item.id === payload.user!.id ? { ...payload.user!, hypes: item.hypes } : item),
        popularAllTime: current.popularAllTime.map((item) => item.id === payload.user!.id ? { ...payload.user!, hypes: item.hypes } : item),
        nearby: current.nearby.map((item) => item.id === payload.user!.id ? { ...payload.user!, mutualFollowersCount: item.mutualFollowersCount, mutualFollowers: item.mutualFollowers } : item),
        newUsers: current.newUsers.map((item) => item.id === payload.user!.id ? payload.user! : item),
      });
    } catch {
      // mantém silencioso para não interromper a navegação
    } finally {
      setMutating(null);
    }
  };

  return (
    <div className="flex h-[100dvh] min-h-screen flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }} {...mobileFeedTabSwipe}>
      <header className="hidden flex-none bg-transparent md:block">
        <div className="mx-auto grid h-[100px] max-w-[1280px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 px-8 pb-4">
          <Link href="/" className="flex shrink-0 items-center gap-4 justify-self-start pb-2"><HeaderBrand /></Link>
          <nav aria-label="Navegação" className="flex items-end justify-self-center gap-16 pb-2">
            <Link href="/" title="Converse: Clouds ao vivo para conversar agora." className="inline-flex h-14 items-center text-[13px] font-semibold text-white/50 transition hover:text-white">Converse</Link>
            <Link href="/read" title="Leia: conversas encerradas disponíveis para leitura." className="inline-flex h-14 items-center text-[13px] font-semibold text-white/50 transition hover:text-white">Leia</Link>
            <Link href="/meet" title="Conheça: descubra pessoas para seguir e conhecer." className="relative inline-flex h-14 items-center text-[13px] font-semibold text-white">Conheça<span className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full bg-[#A855F7]" /></Link>
          </nav>
          <div className="flex items-center justify-self-end gap-4 pb-2">
            <NotificationsBell buttonClassName="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]" />
            <Link href="/profile" aria-label="Meu perfil" className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#A855F7] text-[18px] font-bold text-white"><SessionUserAvatar user={user} size={56} /></Link>
            <Link href="/settings" aria-label="Configurações" className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]"><GearIcon s={28} /></Link>
          </div>
        </div>
      </header>
      <MobileFeedHeader active="meet" />
      <main
        className="mx-auto w-full max-w-[860px] flex-1 overflow-y-auto px-4 pb-28 pt-6 md:px-6 md:pb-28 md:pt-8"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (touch) meetSwipeStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = meetSwipeStart.current;
          meetSwipeStart.current = null;
          const touch = event.changedTouches[0];
          if (!start || !touch || !window.matchMedia("(max-width: 767px)").matches) return;
          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;
          if (deltaX > 48 && deltaX > Math.abs(deltaY)) {
            event.stopPropagation();
            router.push("/read");
          }
        }}
        onTouchCancel={() => { meetSwipeStart.current = null; }}
      >
        <div className="mb-6">
          <h1 className="text-[32px] font-bold tracking-tight text-white md:text-[42px]">Conheça</h1>
          <p className="mt-1 text-[16px] text-[#9b98ed]">Encontre pessoas para conhecer e acompanhar.</p>
        </div>

        <div className="mb-7 flex h-14 items-center gap-4 rounded-full border border-[#37337b] bg-[#09082a]/60 px-5">
          <SearchIcon s={24} />
          <input
            type="text"
            placeholder="Search profile..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-transparent text-[17px] text-white placeholder:text-[#7773bb] outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-white/30 transition hover:text-white/60"
            >
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>

        {searchQuery ? (
          <>
            <div className="mb-3 text-[12px] text-white/35">
              {loading ? "Buscando perfis..." : `${results.length} resultado${results.length === 1 ? "" : "s"} encontrados`}
            </div>
            <div className="flex flex-col gap-2">
              {results.map((item) => <ProfileRow key={item.id} user={item} onToggleFollow={toggleFollow} pending={mutating === item.id} />)}
              {!loading && results.length === 0 && <p className="py-12 text-center text-[14px] text-white/30">Nenhum perfil encontrado.</p>}
            </div>
          </>
        ) : (
          <div>
            <div className="mb-7 flex w-full max-w-[520px] rounded-full border border-[#37337b] bg-[#0d0b38]/70 p-1">
              <button type="button" onClick={() => setMeetCategory("popular")} className={`flex-1 rounded-full py-2 text-[16px] font-bold transition ${meetCategory === "popular" ? "bg-gradient-to-r from-[#9d31f6] to-[#b13bfa] text-white shadow-[0_8px_24px_rgba(147,51,234,0.38)]" : "text-[#aaa6ef] hover:text-white"}`}>Quem seguir</button>
              <button type="button" onClick={() => setMeetCategory("nearby")} className={`flex-1 rounded-full py-2 text-[16px] font-bold transition ${meetCategory === "nearby" ? "bg-gradient-to-r from-[#9d31f6] to-[#b13bfa] text-white shadow-[0_8px_24px_rgba(147,51,234,0.38)]" : "text-[#aaa6ef] hover:text-white"}`}>Próximos a você</button>
              <button type="button" onClick={() => setMeetCategory("new")} className={`flex-1 rounded-full py-2 text-[16px] font-bold transition ${meetCategory === "new" ? "bg-gradient-to-r from-[#9d31f6] to-[#b13bfa] text-white shadow-[0_8px_24px_rgba(147,51,234,0.38)]" : "text-[#aaa6ef] hover:text-white"}`}>Novos</button>
            </div>
            <section>
              <div className="mb-7 flex items-center justify-between gap-5">
                <h2 className="text-[23px] font-bold text-white">{meetCategory === "popular" ? "Perfis em destaque:" : meetCategory === "nearby" ? "Perfis que seus seguidores também acompanham." : "Pessoas que acabaram de entrar no Clouds."}</h2>
              </div>
              <div className="flex flex-col gap-4">
                {(meetCategory === "popular" ? meetData?.popularAllTime : meetCategory === "nearby" ? meetData?.nearby : meetData?.newUsers)?.map((item) => {
                  const hypes = "hypes" in item ? item.hypes : 0;
                  const nearbyItem = meetCategory === "nearby" ? item as MeetPayload["nearby"][number] : undefined;
                  return <ProfileRow key={item.id} user={item} detail={meetCategory === "popular" ? (item.showHypesCount ? `${hypes} hype${hypes === 1 ? "" : "s"}` : "Perfil em destaque") : meetCategory === "new" ? "Novo no Clouds" : undefined} mutualFollowers={nearbyItem?.mutualFollowers} mutualFollowersCount={nearbyItem?.mutualFollowersCount} onToggleFollow={toggleFollow} pending={mutating === item.id} />;
                })}
                {meetLoading && <p className="py-5 text-center text-[15px] text-white/30">Carregando sugestões...</p>}
                {!meetLoading && meetCategory === "popular" && meetData?.popularAllTime.length === 0 && <p className="py-5 text-center text-[15px] text-white/30">Ainda não há hypes suficientes.</p>}
                {!meetLoading && meetCategory === "nearby" && meetData?.nearby.length === 0 && <p className="py-5 text-center text-[15px] text-white/30">Suas conexões ainda não geraram sugestões.</p>}
                {!meetLoading && meetCategory === "new" && meetData?.newUsers.length === 0 && <p className="py-5 text-center text-[15px] text-white/30">Ainda não há novos perfis para mostrar.</p>}
              </div>
            </section>
          </div>
        )}
      </main>

      <nav className="hidden flex-none border-t border-white/[0.07] bg-[#060410] md:block" aria-label="Navegação inferior">
        <div className="mx-auto grid max-w-[480px] grid-cols-4 items-center px-4 py-5">
          <Link href="/" className="flex flex-col items-center gap-2 text-white transition hover:text-white"><HomeIcon s={32} /><span className="text-[13px] font-semibold">Home</span></Link>
          <MessagesNavLink />
          <Link href="/?create=1" aria-label="Publicar nova Cloud" className="group flex flex-col items-center gap-2 text-white transition hover:text-[#A855F7]"><span className="relative flex h-8 w-8 items-center justify-center"><img src="/cloud-plus-compact.png" alt="" className="absolute h-20 w-20 scale-[1.45] object-contain drop-shadow-[0_0_0.2px_white] transition-[filter] group-hover:[filter:brightness(0)_saturate(100%)_invert(52%)_sepia(97%)_saturate(2679%)_hue-rotate(241deg)_brightness(100%)_contrast(95%)]" /></span><span className="text-[13px] font-semibold">Publicar</span></Link>
          <Link href="/trending" className="-translate-x-4 flex flex-col items-center gap-2 text-white transition hover:text-[#A855F7]"><FlameIcon s={30} /><span className="text-[13px] font-semibold">Trending</span></Link>
        </div>
      </nav>
      <MobileAppNav />
      {guestSignupOpen && <GuestCloudSignupModal cloudTitle="o Clouds" returnTo="/meet" onClose={() => setGuestSignupOpen(false)} />}

    </div>
  );
}
