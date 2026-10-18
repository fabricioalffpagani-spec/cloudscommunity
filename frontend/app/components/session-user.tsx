"use client";

import Link from "next/link";
import { createContext, useContext, useCallback, useEffect, useState } from "react";

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  displayName: string;
  birthDate: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  website: string | null;
  isPrivate: boolean;
  showHypesCount: boolean;
  showArchivedClouds: boolean;
  showParticipatingNow: boolean;
  interests: string[];
  interestsCompletedAt: string | null;
  interestsOnboardingRequired: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  followersCount?: number;
  followingCount?: number;
  cloudsCount?: number;
  hypesCount?: number;
};

type SessionContextValue = {
  user: SessionUser | null;
  status: "loading" | "authenticated" | "anonymous" | "error";
  refresh: () => Promise<void>;
  incrementCloudCount: () => void;
  decrementCloudCount: () => void;
};

const SessionUserContext = createContext<SessionContextValue | null>(null);

type SessionPayload = {
  ok?: boolean;
  user?: SessionUser;
};

export function SessionUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionContextValue["status"]>("loading");
  const incrementCloudCount = useCallback(() => {
    setUser((current) => current ? { ...current, cloudsCount: (current.cloudsCount ?? 0) + 1 } : current);
  }, []);
  const decrementCloudCount = useCallback(() => {
    setUser((current) => current ? { ...current, cloudsCount: Math.max(0, (current.cloudsCount ?? 0) - 1) } : current);
  }, []);

  const refresh = useCallback(async () => {
    setStatus((current) =>
      current === "authenticated" || current === "anonymous" ? current : "loading",
    );

    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      const payload = (await response.json().catch(() => null)) as SessionPayload | null;

      if (!response.ok || !payload?.user) {
        setUser(null);
        setStatus(response.status === 401 ? "anonymous" : "error");
        return;
      }

      setUser(payload.user);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const revalidateSession = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", revalidateSession);
    document.addEventListener("visibilitychange", revalidateSession);

    return () => {
      window.removeEventListener("focus", revalidateSession);
      document.removeEventListener("visibilitychange", revalidateSession);
    };
  }, [refresh]);

  return (
    <SessionUserContext.Provider value={{ user, status, refresh, incrementCloudCount, decrementCloudCount }}>
      {children}
    </SessionUserContext.Provider>
  );
}

export function useSessionUser() {
  const context = useContext(SessionUserContext);

  if (!context) {
    throw new Error("useSessionUser must be used within SessionUserProvider");
  }

  return context;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getSessionUserDisplayName(user: AvatarUser) {
  return user?.displayName?.trim() || user?.username?.trim() || "Você";
}

export function getSessionUserHandle(user: AvatarUser) {
  return user?.username ? `@${user.username}` : "@voce";
}

export function getSessionUserInitial(user: AvatarUser) {
  const value = getSessionUserDisplayName(user);
  return value.trim().charAt(0).toUpperCase() || "C";
}

export function getSessionUserColor(user: AvatarUser) {
  const palette = ["#7C3AED", "#3B82F6", "#22C55E", "#F97316", "#EC4899", "#06B6D4"];
  const source = user?.id ?? user?.username ?? "clouds";
  return palette[hashString(source) % palette.length];
}

type AvatarUser = Pick<SessionUser, "id" | "username" | "displayName" | "avatarUrl"> | null | undefined;

export function UserAvatar({
  user,
  size = 48,
  className = "",
}: {
  user: AvatarUser;
  size?: number;
  className?: string;
}) {
  const initial = getSessionUserInitial(user);
  const backgroundColor = getSessionUserColor(user);
  const [imageError, setImageError] = useState(false);
  const hasAvatar = Boolean(user?.avatarUrl) && !imageError;

  useEffect(() => {
    setImageError(false);
  }, [user?.avatarUrl]);

  if (hasAvatar) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={user?.avatarUrl || ""}
          alt={getSessionUserDisplayName(user)}
          referrerPolicy="no-referrer"
          width={size}
          height={size}
          decoding="async"
          className="block h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ width: size, height: size, backgroundColor, fontSize: Math.max(14, size * 0.4) }}
    >
      {initial}
    </div>
  );
}

export function SessionUserAvatar({
  user,
  size = 48,
  className = "",
}: {
  user: SessionUser | null | undefined;
  size?: number;
  className?: string;
}) {
  return <UserAvatar user={user} size={size} className={className} />;
}

export function SessionUserLink({
  className = "",
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { user } = useSessionUser();
  const displayName = getSessionUserDisplayName(user);
  const handle = getSessionUserHandle(user);

  return (
    <Link
      href="/profile"
      aria-label={user ? `Meu perfil de ${displayName}` : "Meu perfil"}
      className={`inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-white transition hover:bg-white/[0.08] ${className}`}
    >
      <SessionUserAvatar user={user} size={40} />
      {showLabel && (
        <span className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
          <span className="truncate text-[13px] font-semibold text-white">{displayName}</span>
          <span className="truncate text-[11px] text-white/55">{handle}</span>
        </span>
      )}
    </Link>
  );
}

