import { io, type Socket } from "socket.io-client";
import { socketAuth } from "./socket-auth";

const SOCKET_URL = process.env.NEXT_PUBLIC_CLOUDS_SOCKET_URL?.trim() || "";

export type CloudPresenceUpdate = {
  cloudId: string;
  membersCount: number;
};

function resolveSocketUrl() {
  if (SOCKET_URL) return SOCKET_URL.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin.replace(/\/+$/, "");
  return "";
}

export function subscribeToCloudPresence(onUpdate: (update: CloudPresenceUpdate) => void) {
  const socketUrl = resolveSocketUrl();
  if (!socketUrl) return () => undefined;

  const socket: Socket = io(`${socketUrl}/clouds`, {
    auth: socketAuth,
    withCredentials: true,
    transports: ["polling", "websocket"],
  });

  socket.on("cloud:members_updated", onUpdate);

  return () => {
    socket.removeListener("cloud:members_updated", onUpdate);
    socket.disconnect();
  };
}

export function subscribeToCloudFeedUpdates(onUpdate: () => void) {
  const socketUrl = resolveSocketUrl();
  if (!socketUrl) return () => undefined;

  const socket: Socket = io(`${socketUrl}/clouds`, {
    auth: socketAuth,
    withCredentials: true,
    transports: ["polling", "websocket"],
  });
  socket.on("cloud:feed_updated", onUpdate);

  return () => {
    socket.removeListener("cloud:feed_updated", onUpdate);
    socket.disconnect();
  };
}
