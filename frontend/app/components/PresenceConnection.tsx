"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { socketAuth } from "../lib/socket-auth";
import { useSessionUser } from "./session-user";

/** Keeps live presence tied to the app session, including pages outside Messages. */
export function PresenceConnection() {
  const { status, user, refresh } = useSessionUser();

  useEffect(() => {
    if (status !== "authenticated" || !user?.id) return;
    const socketUrl = (process.env.NEXT_PUBLIC_CLOUDS_SOCKET_URL?.trim() || window.location.origin).replace(/\/+$/, "");
    const socket = io(`${socketUrl}/direct-messages`, {
      auth: socketAuth,
      withCredentials: true,
      transports: ["polling", "websocket"],
    });
    socket.on("profile:stats_updated", refresh);
    return () => {
      socket.off("profile:stats_updated", refresh);
      socket.disconnect();
    };
  }, [status, user?.id, refresh]);

  return null;
}
