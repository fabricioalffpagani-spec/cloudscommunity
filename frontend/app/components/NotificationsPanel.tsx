"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BellIcon, XIcon } from "./ui-icons";
import { useSessionUser } from "./session-user";
import { subscribeToPushNotifications } from "../lib/push-subscription";

type NotificationActor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string;
};

type AppNotification = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  metadata?: Record<string, string> | null;
  isRead: boolean;
  createdAt: string;
  actor: NotificationActor | null;
  // local state after accept
  accepted?: boolean;
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

async function enableNativeNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
  if (await Notification.requestPermission() !== "granted") return;
  await subscribeToPushNotifications();
}

async function markNotificationsRead() {
  try {
    const response = await fetch("/api/notifications/read", { method: "POST" });
    if (response.ok) window.dispatchEvent(new Event("clouds:notifications-read"));
  } catch { /* The next refresh will retain unread notifications. */ }
}

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [followingBack, setFollowingBack] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const { refresh } = useSessionUser();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications${showAll ? "?all=true" : ""}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        notifications?: AppNotification[];
      } | null;
      setNotifications(response.ok && Array.isArray(payload?.notifications) ? payload.notifications : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 5000);
    const handleFocus = () => void loadNotifications();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadNotifications]);

  const respond = async (notification: AppNotification, action: "accept" | "decline") => {
    if (actingId) return;
    setActingId(notification.id);
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notification.id)}/${action}`, {
        method: "POST",
      });
      if (response.ok) {
        if (action === "accept") {
          // Mark as accepted and refresh follower count
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id ? { ...item, accepted: true } : item,
            ),
          );
          void refresh();
        } else {
          setNotifications((current) => current.filter((item) => item.id !== notification.id));
        }
      }
    } finally {
      setActingId(null);
    }
  };

  const followBack = async (notification: AppNotification) => {
    if (!notification.actor) return;
    setFollowingBack((prev) => new Set(prev).add(notification.id));
    try {
      const response = await fetch(`/api/follow/${encodeURIComponent(notification.actor.username)}`, { method: "POST" });
      if (response.ok) void refresh();
    } finally {
      // keep the "Seguindo" state — don't remove from set
    }
  };

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute right-4 top-[96px] flex max-h-[calc(100dvh-7rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1C1F2E] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <span className="text-[15px] font-bold text-white">Notificações</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
            <XIcon s={16} />
          </button>
        </div>

        <div className={showAll ? "min-h-0 flex-1 overflow-y-auto scrollbar-purple pr-1" : "max-h-[420px] overflow-y-auto scrollbar-purple pr-1"}>
          {loading ? (
            <p className="px-5 py-10 text-center text-[13px] text-white/45">Carregando...</p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <BellIcon s={32} />
              <p className="mt-3 text-[14px] font-semibold text-white">Nenhuma notificação</p>
              <p className="mt-1 text-[12px] text-white/40">Você está em dia com tudo.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => {
                const initials = (notification.actor?.displayName ?? notification.title).trim().charAt(0).toUpperCase() || "C";
                const messageCloudId = notification.metadata?.cloudId;
                const messageId = notification.metadata?.messageId ?? notification.entityId;
                const cloudMessageHref = messageCloudId && (notification.type === "cloud_mention" || notification.type === "cloud_comment")
                  ? `/cloud/${encodeURIComponent(messageCloudId)}/notification?message=${encodeURIComponent(messageId)}`
                  : null;
                const cloudHref = notification.entityType === "cloud"
                  ? `/cloud/${encodeURIComponent(notification.entityId)}/notification`
                  : null;
                const conversationId = notification.metadata?.conversationId ?? (notification.entityType === "conversation" ? notification.entityId : null);
                const messageHref = notification.type === "direct_message" ? (conversationId ? `/messages?conversation=${encodeURIComponent(conversationId)}` : notification.actor?.id ? `/messages?id=${encodeURIComponent(notification.actor.id)}` : "/messages") : null;
                const href = cloudMessageHref ?? cloudHref ?? messageHref ?? notification.actor?.profileUrl ?? null;
                const alreadyFollowingBack = followingBack.has(notification.id);
                const continuation = notification.type === "cloud_continuation" ? notification.metadata : null;

                return (
                  <div key={notification.id} onClick={(event) => { if (!href || (event.target as HTMLElement).closest("a, button")) return; onClose(); router.push(href); }} className={`border-b border-white/[0.05] px-4 py-3 last:border-b-0 ${href ? "cursor-pointer" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {href ? <Link href={href} onClick={onClose} aria-label={`Abrir ${notification.title}`}>
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] text-[13px] font-bold text-white">
                          {notification.actor?.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={notification.actor.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                        </Link> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-[13px] font-bold text-white">{initials}</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        {href ? (
                          <Link href={href} onClick={onClose} className="text-[13px] font-semibold text-white hover:underline">{notification.title}</Link>
                        ) : (
                          <p className="text-[13px] font-semibold text-white">{notification.title}</p>
                        )}
                        {continuation?.continuationCloudId && continuation?.originCloudId ? (
                          <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                            Criou a Cloud{" "}
                            <Link href={`/cloud/${encodeURIComponent(continuation.continuationCloudId)}/notification`} onClick={onClose} className="font-semibold text-[#D8B4FE] hover:text-white hover:underline">{continuation.continuationCloudTitle ?? "continuação"}</Link>{" "}
                            com base em{" "}
                            <Link href={`/cloud/${encodeURIComponent(continuation.originCloudId)}/notification`} onClick={onClose} className="font-semibold text-[#D8B4FE] hover:text-white hover:underline">{continuation.originCloudTitle ?? "sua Cloud"}</Link>.
                          </p>
                        ) : href ? <Link href={href} onClick={onClose} className="mt-0.5 block text-[12px] leading-relaxed text-white/55 hover:text-white">{notification.body}</Link> : <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">{notification.body}</p>}
                        <p className="mt-1 text-[11px] text-white/30">{formatRelativeTime(notification.createdAt)}</p>

                        {notification.type === "follow_request" && !notification.accepted && (
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={actingId === notification.id}
                              onClick={() => void respond(notification, "accept")}
                              className="rounded-full bg-[#7C3AED] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-60"
                            >
                              Aceitar
                            </button>
                            <button
                              type="button"
                              disabled={actingId === notification.id}
                              onClick={() => void respond(notification, "decline")}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-60"
                            >
                              Recusar
                            </button>
                          </div>
                        )}

                        {notification.type === "follow_request" && notification.accepted && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-[12px] text-[#22C55E] font-semibold">✓ Aceito</span>
                            {notification.actor && (
                              <button
                                type="button"
                                disabled={alreadyFollowingBack}
                                onClick={() => void followBack(notification)}
                                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                                  alreadyFollowingBack
                                    ? "border border-white/10 bg-white/[0.04] text-white/40 cursor-default"
                                    : "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                                }`}
                              >
                                {alreadyFollowingBack ? "Seguindo" : "Seguir de volta"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {!loading && notifications.length > 0 && (
          <div className="border-t border-white/[0.07] px-4 py-3">
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="w-full rounded-xl py-2 text-[13px] font-semibold text-[#C084FC] transition hover:bg-white/[0.05] hover:text-white"
            >
              {showAll ? "Mostrar menos" : "Ver tudo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationsBell({
  buttonClassName,
  openFromUrl = false,
}: {
  buttonClassName?: string;
  openFromUrl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const { user, status } = useSessionUser();

  useEffect(() => {
    if (status !== "authenticated" || !user || user.isGuest) return;
    if (!openFromUrl) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("notifications") !== "1") return;
    url.searchParams.delete("notifications");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setOpen(true);
    setUnreadCount(0);
    void markNotificationsRead();
  }, [openFromUrl, status, user]);

  const loadUnread = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { unreadCount?: number } | null;
      if (response.ok) {
        const count = typeof payload?.unreadCount === "number" ? payload.unreadCount : 0;
        setUnreadCount(count);
        const badgeNavigator = navigator as Navigator & { setAppBadge?: (value?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
        if (count > 0) void badgeNavigator.setAppBadge?.(count);
        else void badgeNavigator.clearAppBadge?.();
      }
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user || user.isGuest) return;
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 5000);
    const handleFocus = () => void loadUnread();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadUnread, status, user]);

  return (
    <>
      <button
        type="button"
        aria-label="Notificações"
        onClick={() => {
          if (status !== "authenticated" || !user || user.isGuest) {
            router.push(`/login?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
            return;
          }
          if ("Notification" in window && Notification.permission !== "denied") {
            void enableNativeNotifications();
          }
          setUnreadCount(0);
          void (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.();
          setOpen(true);
          void markNotificationsRead();
        }}
        className={`relative ${buttonClassName ?? "flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]"}`}
      >
        <BellIcon s={28} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#9333EA] px-1 text-[11px] font-bold leading-none text-white ring-2 ring-[#060410]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <NotificationsPanel
          onClose={() => {
            setOpen(false);
            void loadUnread();
          }}
        />
      )}
    </>
  );
}
