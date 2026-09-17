"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellIcon, XIcon } from "./ui-icons";
import { useSessionUser } from "./session-user";

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
  entityId: string;
  title: string;
  body: string;
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

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
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
      await fetch(`/api/follow/${encodeURIComponent(notification.actor.username)}`, { method: "POST" });
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
                const href = notification.actor?.profileUrl ?? (notification.type === "direct_message" ? "/messages" : "/");
                const alreadyFollowingBack = followingBack.has(notification.id);

                return (
                  <div key={notification.id} className="border-b border-white/[0.05] px-4 py-3 last:border-b-0">
                    <div className="flex items-start gap-3">
                      <Link href={href} onClick={onClose} className="mt-0.5 shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] text-[13px] font-bold text-white">
                          {notification.actor?.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={notification.actor.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-white">{notification.title}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">{notification.body}</p>
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
}: {
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { unreadCount?: number } | null;
      if (response.ok) {
        setUnreadCount(typeof payload?.unreadCount === "number" ? payload.unreadCount : 0);
      }
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 30000);
    const handleFocus = () => void loadUnread();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadUnread]);

  return (
    <>
      <button
        type="button"
        aria-label="Notificações"
        onClick={() => {
          setUnreadCount(0);
          setOpen(true);
          void fetch("/api/notifications/read", { method: "POST" });
        }}
        className={buttonClassName ?? "relative flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]"}
      >
        <BellIcon s={28} />
        {unreadCount > 0 && (
          <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#A855F7]" />
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
