"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { HeaderBrand } from "../components/HeaderBrand";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";

type Status = "online" | "offline" | "busy";
type MessageKind = "text" | "audio" | "image" | "link";

type BackendConversation = {
  id: string;
  participantOneId: string;
  participantTwoId: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  participant: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
  };
};

type BackendMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageKind;
  content: string | null;
  clientMessageId: string | null;
  createdAt: string;
  readAt: string | null;
  mediaAsset: {
    id: string;
    url: string;
    mimeType: string;
    sizeBytes: string;
    originalFileName: string | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  } | null;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

type Conversation = {
  id: string;
  peerId: string;
  peerUsername: string;
  name: string;
  status: Status;
  avatar: string;
  color: string;
  lastMessage: string;
  time: string;
  unread: number;
  lastMessageAt: string | null;
  isPending?: boolean;
};

type PublicUserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isPrivate: boolean;
};

type Msg = {
  id: string;
  conversationId: string;
  side: "left" | "right";
  sender: string;
  kind: MessageKind;
  content: string;
  time: string;
  isoTime: string;
  readAt: string | null;
  mediaUrl: string | null;
  durationMs: number | null;
  linkUrl: string | null;
  linkLabel: string | null;
  pending?: boolean;
  clientMessageId?: string | null;
};

type SocketAck<T> = { ok: true; data: T } | { ok: false; message: string };

const SOCKET_URL = process.env.NEXT_PUBLIC_CLOUDS_SOCKET_URL?.trim() || "";
const MESSAGE_LIMIT = 50;
const EMOJI_BANK = ["😀", "🔥", "❤️", "😂", "🙌", "🎉", "💬", "👍", "👀", "✨"];

const statusDot: Record<Status, string> = {
  online: "bg-[#22C55E]",
  busy: "bg-[#F59E0B]",
  offline: "bg-[#6B7280]",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function avatarColor(source: string) {
  const palette = ["#7C3AED", "#3B82F6", "#22C55E", "#F97316", "#EC4899", "#06B6D4"];
  return palette[hashString(source) % palette.length];
}

function mapStatus(status: string): Status {
  if (status === "active") return "online";
  if (status === "pending") return "busy";
  return "offline";
}

function timeLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs <= 0) {
    return "";
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function previewForMessage(message: BackendMessage) {
  if (message.type === "audio") {
    const duration = formatDuration(message.mediaAsset?.durationMs ?? null);
    return duration ? `Áudio · ${duration}` : "Áudio";
  }

  if (message.type === "image") {
    return "Imagem";
  }

  if (message.type === "link") {
    try {
      const parsed = JSON.parse(message.content || "{}") as { url?: string; label?: string | null };
      if (parsed.label?.trim()) {
        return parsed.label.trim();
      }
      if (parsed.url) {
        return new URL(parsed.url).hostname.replace(/^www\./, "");
      }
    } catch {
      if (message.content) {
        try {
          return new URL(message.content).hostname.replace(/^www\./, "");
        } catch {
          // fall through
        }
      }
    }
    return "Link compartilhado";
  }

  return message.content || "";
}

function dateLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return "Hoje";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function buildConversation(payload: BackendConversation): Conversation {
  const name = payload.participant.displayName || payload.participant.username;
  return {
    id: payload.id,
    peerId: payload.participant.id,
    peerUsername: payload.participant.username,
    name,
    status: mapStatus(payload.participant.status),
    avatar: initials(name),
    color: avatarColor(payload.participant.id),
    lastMessage: payload.lastMessagePreview || "",
    time: timeLabel(payload.lastMessageAt),
    unread: payload.unreadCount,
    lastMessageAt: payload.lastMessageAt,
  };
}

function buildMessage(payload: BackendMessage, currentUserId: string): Msg {
  let linkUrl: string | null = null;
  let linkLabel: string | null = null;

  if (payload.type === "link") {
    try {
      const parsed = JSON.parse(payload.content || "{}") as { url?: string; label?: string | null };
      linkUrl = parsed.url ?? null;
      linkLabel = parsed.label?.trim() || null;
    } catch {
      linkUrl = payload.content || null;
    }
  }

  return {
    id: payload.id,
    conversationId: payload.conversationId,
    side: payload.senderId === currentUserId ? "right" : "left",
    sender: payload.senderId === currentUserId ? "Você" : payload.sender.displayName || payload.sender.username,
    kind: payload.type,
    content: payload.content || "",
    time: timeLabel(payload.createdAt),
    isoTime: payload.createdAt,
    readAt: payload.readAt,
    mediaUrl: payload.mediaAsset?.url ?? null,
    durationMs: payload.mediaAsset?.durationMs ?? null,
    linkUrl,
    linkLabel,
    clientMessageId: payload.clientMessageId,
  };
}

function mergeMessage(list: Msg[], next: Msg) {
  const index = next.clientMessageId ? list.findIndex((item) => item.clientMessageId === next.clientMessageId) : -1;
  if (index >= 0) return list.map((item, i) => (i === index ? { ...next, pending: false } : item));
  if (list.some((item) => item.id === next.id)) return list;
  return [...list, next];
}

function sortConversations(list: Conversation[]) {
  return [...list].sort((a, b) => (new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()));
}

function resolveSocketUrl() {
  if (SOCKET_URL) return SOCKET_URL.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin.replace(/\/+$/, "");
  return "";
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) throw new Error("Falha ao carregar dados.");
  return payload;
}

function Avatar({ name, size = 36, color }: { name: string; size?: number; color: string }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}>
      {name}
    </div>
  );
}

type RecordedAudio = {
  blob: Blob;
  durationMs: number;
  mimeType: string;
};

type AudioRecorderState = "idle" | "recording";

function useAudioRecorder(onStop: (recording: RecordedAudio) => void) {
  const [state, setState] = useState<AudioRecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  const stopTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (state !== "idle") {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"].find((type) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      secondsRef.current = 0;
      setSeconds(0);
      setState("recording");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTimers();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        onStop({
          blob,
          durationMs: secondsRef.current * 1000,
          mimeType: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        cleanupStream();
        recorderRef.current = null;
        setState("idle");
        setSeconds(0);
        secondsRef.current = 0;
      };

      recorder.start();
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
    } catch {
      stopTimers();
      cleanupStream();
      setState("idle");
      setSeconds(0);
      secondsRef.current = 0;
      throw new Error("Permissão de microfone negada.");
    }
  }, [cleanupStream, onStop, state, stopTimers]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    stopTimers();
    chunksRef.current = [];

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Ignore stop races.
      }
    }

    cleanupStream();
    recorderRef.current = null;
    setState("idle");
    setSeconds(0);
    secondsRef.current = 0;
  }, [cleanupStream, stopTimers]);

  useEffect(() => () => {
    stopTimers();
    cleanupStream();
  }, [cleanupStream, stopTimers]);

  return { state, seconds, start, stop, cancel };
}

function AudioMessageBubble({ msg }: { msg: Msg }) {
  const isRight = msg.side === "right";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const stopPlaying = () => setPlaying(false);
    audio.addEventListener("ended", stopPlaying);
    audio.addEventListener("pause", stopPlaying);

    return () => {
      audio.removeEventListener("ended", stopPlaying);
      audio.removeEventListener("pause", stopPlaying);
    };
  }, []);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play();
      setPlaying(true);
      return;
    }

    audio.pause();
    setPlaying(false);
  }, []);

  return (
    <div className={`rounded-2xl border px-4 py-3 ${isRight ? "rounded-br-[4px] border-[#7C3AED]/30 bg-[#7C3AED]" : "rounded-bl-[4px] border-white/[0.08] bg-[#1C1F2E]"}`} style={{ minWidth: "220px", maxWidth: "320px" }}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Reproduzir áudio"
          onClick={togglePlayback}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition ${isRight ? "bg-white/20 hover:bg-white/30" : "bg-[#7C3AED] hover:bg-[#6D28D9]"}`}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-white/50" style={{ width: "42%" }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-white/65">
            <span>Áudio</span>
            <span>{formatDuration(msg.durationMs) || "0:00"}</span>
          </div>
        </div>
      </div>
      {msg.mediaUrl && <audio ref={audioRef} src={msg.mediaUrl} className="hidden" controls={false} preload="metadata" />}
      {msg.pending && <div className="mt-2 text-[11px] text-white/70">enviando...</div>}
    </div>
  );
}

function ImageMessageBubble({ msg }: { msg: Msg }) {
  const isRight = msg.side === "right";
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className={`overflow-hidden rounded-2xl border text-left transition ${isRight ? "rounded-br-[4px] border-[#7C3AED]/30 bg-[#7C3AED]" : "rounded-bl-[4px] border-white/[0.08] bg-[#1C1F2E]"}`}
      style={{ maxWidth: "320px" }}
    >
      {msg.mediaUrl ? (
        <img
          src={msg.mediaUrl}
          alt="Imagem enviada"
          className={`block w-full object-cover transition ${expanded ? "max-h-[420px]" : "max-h-[240px]"}`}
        />
      ) : (
        <div className="flex h-[180px] items-center justify-center text-[13px] text-white/50">
          Imagem indisponível
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-3 py-2 text-[11px] text-white/75">
        <span>Imagem</span>
        <span>{expanded ? "reduzir" : "ampliar"}</span>
      </div>
      {msg.pending && <div className="px-3 pb-3 text-[11px] text-white/70">enviando...</div>}
    </button>
  );
}

function LinkMessageBubble({ msg }: { msg: Msg }) {
  const isRight = msg.side === "right";
  const host = msg.linkUrl ? new URL(msg.linkUrl).hostname.replace(/^www\./, "") : "Link";
  const label = msg.linkLabel || host;

  return (
    <a
      href={msg.linkUrl || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`block overflow-hidden rounded-2xl border px-4 py-3 text-left transition hover:brightness-110 ${isRight ? "rounded-br-[4px] border-[#7C3AED]/30 bg-[#7C3AED]" : "rounded-bl-[4px] border-white/[0.08] bg-[#1C1F2E]"}`}
      style={{ maxWidth: "320px" }}
      onClick={(event) => {
        if (!msg.linkUrl) {
          event.preventDefault();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
          ↗
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-white">{label}</p>
          <p className="mt-1 truncate text-[12px] text-white/65">{msg.linkUrl || "Link compartilhado"}</p>
        </div>
      </div>
      {msg.pending && <div className="mt-2 text-[11px] text-white/70">enviando...</div>}
    </a>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isRight = msg.side === "right";
  return (
    <div className={`flex items-end gap-2.5 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-9 shrink-0">
        <Avatar name={initials(msg.sender)} size={34} color={isRight ? "#8B5CF6" : "#3B82F6"} />
      </div>
      <div className={`flex flex-col gap-2 ${isRight ? "items-end" : "items-start"}`} style={{ maxWidth: "72%" }}>
        <span className="px-1 text-[12px] font-semibold text-white/40">{msg.sender}</span>
        {msg.kind === "audio" ? (
          <AudioMessageBubble msg={msg} />
        ) : msg.kind === "image" ? (
          <ImageMessageBubble msg={msg} />
        ) : msg.kind === "link" ? (
          <LinkMessageBubble msg={msg} />
        ) : (
          <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-white ${isRight ? "rounded-br-[4px] bg-[#7C3AED]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1C1F2E]"}`}>
            {msg.content}
            {msg.pending && <span className="ml-2 text-[11px] text-white/50">enviando...</span>}
          </div>
        )}
        <div className={`flex items-center gap-1 px-1 text-[11px] text-white/30 ${isRight ? "flex-row-reverse" : ""}`}>
          <span>{msg.time}</span>
          {isRight && (
            <span className="text-[#C084FC]">
              {msg.readAt ? "✓✓ visto" : "✓✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MessagesPageContent() {
  const { user, status } = useSessionUser();
  const searchParams = useSearchParams();
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const typingConversationIdRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceByUserIdRef = useRef<Record<string, Status>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const openedPeerRef = useRef<string | null>(null);
  const sidebarSearchRef = useRef<HTMLInputElement | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Msg[]>>({});
  const [typingByConversation, setTypingByConversation] = useState<Record<string, boolean>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [linkUploading, setLinkUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sharedLink, setSharedLink] = useState<{ url: string; label: string } | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [conversationSearch, setConversationSearch] = useState(() => searchParams.get("q")?.trim() || "");
  const [followedUsers, setFollowedUsers] = useState<PublicUserProfile[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const handleAudioRecordingStop = useCallback(async (recording: RecordedAudio) => {
    if (!activeConversationIdRef.current || !user?.id) {
      return;
    }

    const conversationId = activeConversationIdRef.current;
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(recording.blob);
    const optimistic: Msg = {
      id: clientMessageId,
      conversationId,
      side: "right",
      sender: "Você",
      kind: "audio",
      content: "",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isoTime: new Date().toISOString(),
      readAt: null,
      mediaUrl: tempUrl,
      durationMs: recording.durationMs,
      linkUrl: null,
      linkLabel: null,
      pending: true,
      clientMessageId,
    };

    setAudioUploading(true);
    setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], optimistic) }));
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastMessage: "Áudio", time: optimistic.time, lastMessageAt: optimistic.isoTime, unread: 0 }
            : conversation,
        ),
      ),
    );

    try {
      const formData = new FormData();
      formData.set("file", recording.blob, `audio-${Date.now()}.webm`);
      formData.set("clientMessageId", clientMessageId);
      formData.set("durationMs", String(recording.durationMs));

      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/audio`, {
        method: "POST",
        body: formData,
      });

      const payload = await readJson<{ ok: true; message: BackendMessage }>(response);
      const confirmed = buildMessage(payload.message, user.id);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], confirmed) }));
      URL.revokeObjectURL(tempUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar o áudio.");
      URL.revokeObjectURL(tempUrl);
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((message) => message.clientMessageId !== clientMessageId),
      }));
    } finally {
      setAudioUploading(false);
    }
  }, [user?.id]);
  const audioRecorder = useAudioRecorder((recording) => {
    void handleAudioRecordingStop(recording);
  });

  useEffect(() => {
    const shareType = searchParams.get("share")?.trim().toLowerCase() || "";
    const rawUrl = searchParams.get("url")?.trim() || "";
    const rawId = searchParams.get("id")?.trim() || "";
    const rawLabel = searchParams.get("title")?.trim() || searchParams.get("name")?.trim() || "";

    if (!shareType) {
      return;
    }

    if (shareType === "cloud" && rawId) {
      const url = rawUrl || (typeof window !== "undefined" ? `${window.location.origin}/cloud/${rawId}` : `/cloud/${rawId}`);
      setSharedLink({ url, label: rawLabel || "Cloud compartilhada" });
      return;
    }

    if (shareType === "profile" && rawId) {
      const url = rawUrl || (typeof window !== "undefined" ? `${window.location.origin}/users/${rawId}` : `/users/${rawId}`);
      setSharedLink({ url, label: rawLabel || "Perfil compartilhado" });
    }
  }, [searchParams]);

  useEffect(() => {
    setConversationSearch(searchParams.get("q")?.trim() || "");
  }, [searchParams]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!emojiOpen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const picker = document.querySelector('[data-emoji-picker="true"]');
      const button = document.querySelector('[data-emoji-toggle="true"]');
      if (picker?.contains(target) || button?.contains(target)) {
        return;
      }

      setEmojiOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEmojiOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [emojiOpen]);

  const handleImageFile = useCallback(async (file: File | null) => {
    if (!file || !activeConversationIdRef.current || !user?.id) {
      return;
    }

    const conversationId = activeConversationIdRef.current;
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(file);
    const optimistic: Msg = {
      id: clientMessageId,
      conversationId,
      side: "right",
      sender: "VocÃª",
      kind: "image",
      content: "",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isoTime: new Date().toISOString(),
      readAt: null,
      mediaUrl: tempUrl,
      durationMs: null,
      linkUrl: null,
      linkLabel: null,
      pending: true,
      clientMessageId,
    };

    setImageUploading(true);
    setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], optimistic) }));
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastMessage: "Imagem", time: optimistic.time, lastMessageAt: optimistic.isoTime, unread: 0 }
            : conversation,
        ),
      ),
    );

    try {
      const formData = new FormData();
      formData.set("file", file, file.name || `image-${Date.now()}.jpg`);
      formData.set("clientMessageId", clientMessageId);

      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/image`, {
        method: "POST",
        body: formData,
      });

      const payload = await readJson<{ ok: true; message: BackendMessage }>(response);
      const confirmed = buildMessage(payload.message, user.id);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], confirmed) }));
      URL.revokeObjectURL(tempUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a imagem.");
      URL.revokeObjectURL(tempUrl);
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((message) => message.clientMessageId !== clientMessageId),
      }));
    } finally {
      setImageUploading(false);
    }
  }, [user?.id]);

  const triggerImagePicker = useCallback(() => {
    if (activeConversationId && !imageUploading && audioRecorder.state === "idle") {
      imageInputRef.current?.click();
    }
  }, [activeConversationId, audioRecorder.state, imageUploading]);

  const sendSharedLink = useCallback(async () => {
    if (!sharedLink || !activeConversationIdRef.current || !user?.id) {
      return;
    }

    const conversationId = activeConversationIdRef.current;
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Msg = {
      id: clientMessageId,
      conversationId,
      side: "right",
      sender: "Você",
      kind: "link",
      content: sharedLink.url,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isoTime: new Date().toISOString(),
      readAt: null,
      mediaUrl: null,
      durationMs: null,
      linkUrl: sharedLink.url,
      linkLabel: sharedLink.label,
      pending: true,
      clientMessageId,
    };

    setLinkUploading(true);
    setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], optimistic) }));
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastMessage: sharedLink.label, time: optimistic.time, lastMessageAt: optimistic.isoTime, unread: 0 }
            : conversation,
        ),
      ),
    );

    try {
      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: sharedLink.url,
          label: sharedLink.label,
          clientMessageId,
        }),
      });

      const payload = await readJson<{ ok: true; message: BackendMessage }>(response);
      const confirmed = buildMessage(payload.message, user.id);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: mergeMessage(prev[conversationId] || [], confirmed) }));
      setSharedLink(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível compartilhar o link.");
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((message) => message.clientMessageId !== clientMessageId),
      }));
    } finally {
      setLinkUploading(false);
    }
  }, [sharedLink, user?.id]);

  const insertEmoji = useCallback((emoji: string) => {
    setDraft((current) => `${current}${emoji}`);
    setEmojiOpen(false);
  }, []);

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    
    const matchedConversations = query
      ? conversations.filter((conversation) =>
          [conversation.name, conversation.peerUsername].some((value) => value.toLowerCase().includes(query)),
        )
      : conversations;
    
    const matchedFollowedUsers = query
      ? followedUsers.filter((user) =>
          [user.displayName, user.username].some((value) => value.toLowerCase().includes(query)) &&
          !conversations.some((c) => c.peerId === user.id)
        )
      : [];
    
    return [...sortConversations(matchedConversations), ...matchedFollowedUsers];
  }, [conversationSearch, conversations, followedUsers]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || null;
  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] || [] : [];
  const isActiveConversationTyping = Boolean(activeConversationId && typingByConversation[activeConversationId]);
  const isAudioBusy = audioUploading || imageUploading || linkUploading || audioRecorder.state !== "idle";

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setError(null);
    try {
      const response = await fetch("/api/direct-messages/conversations", { cache: "no-store" });
      const payload = await readJson<{ ok: true; conversations: BackendConversation[] }>(response);
      const mapped = payload.conversations.map((conversation) => {
        const built = buildConversation(conversation);
        return {
          ...built,
          status: presenceByUserIdRef.current[built.peerId] ?? built.status,
        };
      });
      setConversations(mapped);
      if (!activeConversationIdRef.current && mapped.length > 0) {
        setActiveConversationId(mapped[0].id);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar as conversas.");
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadFollowedUsers = useCallback(async () => {
    setLoadingFollowed(true);
    try {
      const response = await fetch("/api/users/following", { cache: "no-store" });
      const payload = await readJson<{ ok: true; users: PublicUserProfile[] }>(response);
      // Exclude current user
      setFollowedUsers(payload.users.filter(u => u.id !== user?.id));
    } catch {
      setFollowedUsers([]);
    } finally {
      setLoadingFollowed(false);
    }
  }, [user?.id]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await fetch(`/api/direct-messages/conversations/${encodeURIComponent(conversationId)}/messages?take=${MESSAGE_LIMIT}`, { cache: "no-store" });
      const payload = await readJson<{ ok: true; messages: BackendMessage[] }>(response);
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: payload.messages.map((message) => buildMessage(message, user?.id || "")) }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Não foi possível carregar as mensagens.");
    } finally {
      setLoadingMessages(false);
    }
  }, [user?.id]);

  const ensureConversation = useCallback(async (peerUserId: string) => {
    if (!peerUserId || openedPeerRef.current === peerUserId) return;
    openedPeerRef.current = peerUserId;
    try {
      const response = await fetch("/api/direct-messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerUserId }),
      });
      const payload = await readJson<{ ok: true; conversation: BackendConversation }>(response);
      const built = buildConversation(payload.conversation);
      const conversation = {
        ...built,
        status: presenceByUserIdRef.current[built.peerId] ?? built.status,
      };
      setConversations((prev) => sortConversations(prev.some((item) => item.id === conversation.id) ? prev.map((item) => (item.id === conversation.id ? conversation : item)) : [conversation, ...prev]));
      setActiveConversationId(conversation.id);
    } catch (conversationError) {
      setError(conversationError instanceof Error ? conversationError.message : "Não foi possível abrir a conversa.");
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    void loadConversations();
  }, [loadConversations, status, user]);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    const peerUserId = searchParams.get("id")?.trim();
    if (!peerUserId) return;
    void ensureConversation(peerUserId);
  }, [ensureConversation, searchParams, status, user]);

  useEffect(() => {
    if (!activeConversationId) return;
    activeConversationIdRef.current = activeConversationId;
    void loadMessages(activeConversationId);

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("conversation:join", { conversationId: activeConversationId });
      socket.emit("conversation:read", { conversationId: activeConversationId });
    }
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    const socketUrl = resolveSocketUrl();
    if (!socketUrl) {
      setConnectionState("disconnected");
      return;
    }

    const socket = io(`${socketUrl}/direct-messages`, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("connect", () => {
      setConnectionState("connected");
      const conversationId = activeConversationIdRef.current;
      if (conversationId) {
        socket.emit("conversation:join", { conversationId });
        socket.emit("conversation:read", { conversationId });
      }
    });

    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", () => setConnectionState("disconnected"));

    socket.on("presence:update", (payload: { userId: string; status: "online" | "offline" }) => {
      presenceByUserIdRef.current = {
        ...presenceByUserIdRef.current,
        [payload.userId]: payload.status === "online" ? "online" : "offline",
      };

      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation.peerId === payload.userId
              ? { ...conversation, status: payload.status === "online" ? "online" : "offline" }
              : conversation,
          ),
        ),
      );
    });

    socket.on("conversation:typing", (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.userId === user.id) {
        return;
      }

      setTypingByConversation((prev) => ({
        ...prev,
        [payload.conversationId]: payload.isTyping,
      }));
    });

    socket.on("message:new", (message: BackendMessage) => {
      const mapped = buildMessage(message, user.id);
      setMessagesByConversation((prev) => ({
        ...prev,
        [message.conversationId]: mergeMessage(prev[message.conversationId] || [], mapped),
      }));

      setConversations((prev) =>
        sortConversations(
          prev.map((conversation) =>
            conversation.id === message.conversationId
              ? {
                  ...conversation,
                  lastMessage: previewForMessage(message) || conversation.lastMessage,
                  time: timeLabel(message.createdAt),
                  lastMessageAt: message.createdAt,
                  unread: message.senderId === user.id ? conversation.unread : conversation.unread + 1,
                }
              : conversation,
          ),
        ),
      );

      if (message.conversationId === activeConversationIdRef.current && message.senderId !== user.id) {
        socket.emit("conversation:read", { conversationId: message.conversationId });
      }
    });

    socket.on("conversation:updated", (conversation: BackendConversation) => {
      const built = buildConversation(conversation);
      const mapped = {
        ...built,
        status: presenceByUserIdRef.current[built.peerId] ?? built.status,
      };
      setConversations((prev) =>
        sortConversations(prev.some((item) => item.id === mapped.id) ? prev.map((item) => (item.id === mapped.id ? mapped : item)) : [mapped, ...prev]),
      );
    });

    socket.on("conversation:read", (payload: { conversationId: string; readerId: string; readAt: string }) => {
      if (payload.readerId === user.id) {
        return;
      }

      setMessagesByConversation((prev) => ({
        ...prev,
        [payload.conversationId]: (prev[payload.conversationId] || []).map((message) =>
          message.side === "right" && message.isoTime <= payload.readAt
            ? { ...message, readAt: payload.readAt, pending: false }
            : message,
        ),
      }));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [status, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, activeConversationId]);

  const selectConversation = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    const currentConversationId = typingConversationIdRef.current;

    if (socket?.connected && currentConversationId) {
      socket.emit("conversation:typing", { conversationId: currentConversationId, isTyping: false });
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (currentConversationId) {
      setTypingByConversation((prev) => ({
        ...prev,
        [currentConversationId]: false,
      }));
    }

    typingConversationIdRef.current = null;
    setDraft("");
    setEmojiOpen(false);
    setActiveConversationId(conversationId);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    const currentConversationId = activeConversationId;
    const text = draft.trim();

    if (!socket?.connected || !currentConversationId) {
      return undefined;
    }

    if (!text) {
      if (typingConversationIdRef.current === currentConversationId) {
        socket.emit("conversation:typing", { conversationId: currentConversationId, isTyping: false });
        typingConversationIdRef.current = null;
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      setTypingByConversation((prev) => ({
        ...prev,
        [currentConversationId]: false,
      }));

      return undefined;
    }

    if (typingConversationIdRef.current !== currentConversationId) {
      socket.emit("conversation:typing", { conversationId: currentConversationId, isTyping: true });
      typingConversationIdRef.current = currentConversationId;
      setTypingByConversation((prev) => ({
        ...prev,
        [currentConversationId]: true,
      }));
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      const activeSocket = socketRef.current;
      if (activeSocket?.connected && typingConversationIdRef.current === currentConversationId) {
        activeSocket.emit("conversation:typing", { conversationId: currentConversationId, isTyping: false });
        typingConversationIdRef.current = null;
        setTypingByConversation((prev) => ({
          ...prev,
          [currentConversationId]: false,
        }));
      }
    }, 1800);

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [activeConversationId, draft, connectionState]);

  const sendText = useCallback(() => {
    const socket = socketRef.current;
    const content = draft.trim();
    if (!socket || !socket.connected || !activeConversationId || !content) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (typingConversationIdRef.current === activeConversationId) {
      socket.emit("conversation:typing", { conversationId: activeConversationId, isTyping: false });
      typingConversationIdRef.current = null;
      setTypingByConversation((prev) => ({
        ...prev,
        [activeConversationId]: false,
      }));
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Msg = {
      id: clientMessageId,
      conversationId: activeConversationId,
      side: "right",
      sender: "Você",
      kind: "text",
      content,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      isoTime: new Date().toISOString(),
      readAt: null,
      mediaUrl: null,
      durationMs: null,
      linkUrl: null,
      linkLabel: null,
      pending: true,
      clientMessageId,
    };

    setMessagesByConversation((prev) => ({ ...prev, [activeConversationId]: mergeMessage(prev[activeConversationId] || [], optimistic) }));
    setConversations((prev) =>
      sortConversations(
        prev.map((conversation) =>
          conversation.id === activeConversationId
            ? { ...conversation, lastMessage: content, time: optimistic.time, lastMessageAt: optimistic.isoTime, unread: 0 }
            : conversation,
        ),
      ),
    );
    setDraft("");

    socket.emit(
      "message:send",
      { conversationId: activeConversationId, content, clientMessageId },
      (ack: SocketAck<BackendMessage>) => {
        if (!ack.ok) {
          setError(ack.message);
          setMessagesByConversation((prev) => ({
            ...prev,
            [activeConversationId]: (prev[activeConversationId] || []).filter((message) => message.clientMessageId !== clientMessageId),
          }));
          return;
        }

        const confirmed = buildMessage(ack.data, user?.id || "");
        setMessagesByConversation((prev) => ({ ...prev, [activeConversationId]: mergeMessage(prev[activeConversationId] || [], confirmed) }));
      },
    );
  }, [activeConversationId, draft, user?.id]);

  const startAudioRecording = useCallback(() => {
    if (!activeConversationId || isAudioBusy) {
      return;
    }

    setError(null);
    void audioRecorder.start().catch((recordingError) => {
      setError(recordingError instanceof Error ? recordingError.message : "Não foi possível iniciar a gravação.");
    });
  }, [activeConversationId, audioRecorder, isAudioBusy]);

  const stopAudioRecording = useCallback(() => {
    audioRecorder.stop();
  }, [audioRecorder]);

  const cancelAudioRecording = useCallback(() => {
    audioRecorder.cancel();
  }, [audioRecorder]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendText();
    }
  }, [sendText]);

  if (status === "loading") {
    return <div className="flex h-screen items-center justify-center bg-[#09090B] text-white">Carregando sua sessão...</div>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#09090B] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#09090B]">
        <div className="mx-auto flex h-[88px] max-w-[1280px] items-center justify-between gap-4 px-3 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <HeaderBrand />
          </Link>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Buscar" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">⌕</button>
            <button type="button" aria-label="Notificações" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">◌</button>
            <Link href="/settings" aria-label="Configurações" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1C1C1F] text-white transition hover:bg-[#28282C]">⚙</Link>
            <Link href="/profile" aria-label="Meu perfil" className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#7C3AED] text-[17px] font-bold text-white transition hover:bg-[#6D28D9]">
              <SessionUserAvatar user={user} size={48} />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden pt-[88px]">
        <aside className="flex w-[400px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0D0D10]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <span className="text-[17px] font-bold text-white">Mensagens</span>
            <button
              type="button"
              aria-label="Nova conversa"
              onClick={() => {
                sidebarSearchRef.current?.focus();
                setConversationSearch("");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              +
            </button>
          </div>

          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-3 rounded-full border border-white/[0.08] bg-[#1C1F2E] px-4 py-2">
              <span className="text-[14px] text-white/30">âŒ•</span>
              <input
                ref={sidebarSearchRef}
                type="search"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Buscar..."
                aria-label="Buscar conversas"
                className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 outline-none"
              />
              {conversationSearch.trim() && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => {
                    setConversationSearch("");
                    sidebarSearchRef.current?.focus();
                  }}
                  className="text-[13px] text-white/35 transition hover:text-white/60"
                >
                  Ã—
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1">
            {loadingConversations && conversations.length === 0 ? (
              <div className="px-3 py-6 text-center text-[14px] text-white/40">Carregando conversas...</div>
            ) : (
              filteredConversations.map((item) => {
                const isConversation = "lastMessageAt" in item;
                
                if (isConversation) {
                  const conversation = item as Conversation;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${activeConversationId === conversation.id ? "bg-[#1C1F2E]" : "hover:bg-white/[0.04]"}`}
                    >
                      <Link href={`/users/${conversation.peerId}`} className="relative shrink-0">
                        <Avatar name={conversation.avatar} size={44} color={conversation.color} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0D0D10] ${statusDot[conversation.status]}`} />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/users/${conversation.peerId}`} className="truncate text-[14px] font-semibold text-white hover:underline">{conversation.name}</Link>
                          <span className="shrink-0 text-[12px] text-white/40">{conversation.time}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-[13px] text-white/50">{conversation.lastMessage || "Sem mensagens ainda"}</span>
                          {(conversation.unread ?? 0) > 0 && <span className="ml-auto shrink-0 rounded-full bg-[#7C3AED] px-1.5 py-0.5 text-[11px] font-bold text-white">{conversation.unread}</span>}
                        </div>
                      </div>
                    </button>
                  );
                } else {
                  const followedUser = item as PublicUserProfile;
                  return (
                    <button
                      key={followedUser.id}
                      type="button"
                      onClick={() => {
                        ensureConversation(followedUser.id);
                      }}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${activeConversationId === followedUser.id ? "bg-[#1C1F2E]" : "hover:bg-white/[0.04]"}`}
                    >
                      <Link href={`/users/${followedUser.id}`} className="relative shrink-0">
                        <Avatar name={initials(followedUser.displayName || followedUser.username)} size={44} color={avatarColor(followedUser.id)} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0D0D10] ${statusDot[followedUser.isPrivate ? "offline" : "online"]}`} />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/users/${followedUser.id}`} className="truncate text-[14px] font-semibold text-white hover:underline">{followedUser.displayName || followedUser.username}</Link>
                          <span className="shrink-0 text-[11px] font-medium text-[#7C3AED]">Nova conversa</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-[13px] text-white/50">Nenhuma mensagem ainda</span>
                        </div>
                      </div>
                    </button>
                  );
                }
              })
            )}
            {!loadingConversations && filteredConversations.length === 0 && (
              <p className="px-3 py-6 text-center text-[14px] text-white/40">Nenhum contato encontrado.</p>
            )}
          </div>

          <div className="border-t border-white/[0.07] px-5 py-4">
            <Link href="/profile" className="flex items-center gap-3">
              <SessionUserAvatar user={user} size={38} />
              <span className="text-[14px] font-medium text-white/70">Você</span>
            </Link>
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0D0D10] px-6 py-4">
            {activeConversation ? (
              <div className="flex items-center gap-3">
                <Link href={`/users/${activeConversation.peerId}`} className="relative">
                  <Avatar name={activeConversation.avatar} size={44} color={activeConversation.color} />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0D0D10] ${statusDot[activeConversation.status]}`} />
                </Link>
                <div>
                  <Link href={`/users/${activeConversation.peerId}`} className="text-[16px] font-semibold text-white hover:underline">{activeConversation.name}</Link>
                  <p className={`text-[13px] ${activeConversation.status === "online" ? "text-[#22C55E]" : activeConversation.status === "busy" ? "text-[#F59E0B]" : "text-white/40"}`}>
                    {isActiveConversationTyping
                      ? "digitando..."
                      : activeConversation.status === "online"
                        ? "online"
                        : activeConversation.status === "busy"
                          ? "ocupado"
                          : "offline"}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[16px] font-semibold text-white">Nenhuma conversa selecionada</p>
                <p className="text-[13px] text-white/40">Abra uma conversa para começar.</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[12px] ${connectionState === "connected" ? "bg-[#22C55E]/15 text-[#22C55E]" : connectionState === "connecting" ? "bg-[#F59E0B]/15 text-[#F59E0B]" : "bg-white/10 text-white/50"}`}>
                {connectionState === "connected" ? "tempo real ativo" : connectionState === "connecting" ? "conectando..." : "offline"}
              </span>
              <button type="button" aria-label="Buscar na conversa" className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white transition">⌕</button>
            </div>
          </div>

          {error && <div className="border-b border-white/[0.07] bg-[#2A1018] px-5 py-2 text-[12px] text-[#FCA5A5]">{error}</div>}

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            {!activeConversationId ? (
              <div className="flex h-full items-center justify-center text-center text-white/40">
                <div>
                  <p className="text-[16px] font-semibold text-white/70">Selecione uma conversa</p>
                  <p className="mt-1 text-[14px]">As mensagens aparecerão aqui.</p>
                </div>
              </div>
            ) : loadingMessages && activeMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-white/40">Carregando mensagens...</div>
            ) : (
              (() => {
                const rows: Array<Msg | { id: string; type: "date"; label: string }> = [];
                let previous = "";
                for (const message of activeMessages) {
                  const current = new Date(message.isoTime).toDateString();
                  if (current !== previous) {
                    rows.push({ id: `date-${current}`, type: "date", label: dateLabel(message.isoTime) });
                    previous = current;
                  }
                  rows.push(message);
                }
                return rows.map((entry) => {
                  if ("type" in entry && entry.type === "date") {
                    return (
                      <div key={entry.id} className="flex justify-center py-1">
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/40">{entry.label}</span>
                      </div>
                    );
                  }

                  return <MessageBubble key={entry.id} msg={entry as Msg} />;
                });
              })()
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/[0.07] bg-[#0D0D10] px-5 py-4">
            <div className="relative flex flex-col gap-2 rounded-full border border-white/[0.08] bg-[#1C1F2E] px-5 py-3">
              {audioRecorder.state === "recording" ? (
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Cancelar gravação" onClick={cancelAudioRecording} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/40 transition hover:bg-white/[0.05] hover:text-white">
                    ×
                  </button>
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-white">Gravando áudio</p>
                    <p className="text-[12px] text-white/45">{formatDuration(audioRecorder.seconds * 1000) || "0:00"}</p>
                  </div>
                  <button type="button" aria-label="Enviar áudio" onClick={stopAudioRecording} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9]">
                    ➤
                  </button>
                </div>
              ) : (
                <>
                  {sharedLink && (
                    <div className="flex items-center justify-between gap-3 rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">Link pronto para enviar</p>
                        <p className="truncate text-[14px] font-semibold text-white">{sharedLink.label}</p>
                        <p className="truncate text-[12px] text-white/45">{sharedLink.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSharedLink(null)}
                          className="rounded-full border border-white/10 px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          Remover
                        </button>
                        <button
                          type="button"
                          onClick={sendSharedLink}
                          disabled={!activeConversationId || linkUploading || isAudioBusy}
                          className="rounded-full bg-cyan-500 px-4 py-2 text-[12px] font-semibold text-[#04111F] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {linkUploading ? "Enviando..." : "Enviar link"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="relative flex items-center gap-3">
                    {emojiOpen && (
                      <div data-emoji-picker="true" className="absolute bottom-[calc(100%+12px)] left-0 z-20 grid w-[260px] grid-cols-5 gap-2 rounded-[24px] border border-white/10 bg-[#11141F] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                        {EMOJI_BANK.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl text-[20px] transition hover:bg-white/[0.07]"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label="Abrir emojis"
                      data-emoji-toggle="true"
                      onClick={() => setEmojiOpen((current) => !current)}
                      disabled={!activeConversationId || isAudioBusy}
                      className="text-white/25 transition hover:text-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      😀
                    </button>
                    <button
                      type="button"
                      aria-label="Adicionar imagem"
                      onClick={triggerImagePicker}
                      disabled={!activeConversationId || isAudioBusy}
                      className="text-white/25 transition hover:text-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                    <input
                      type="text"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={activeConversationId ? "Mensagem..." : "Selecione uma conversa para começar"}
                      disabled={!activeConversationId || isAudioBusy}
                      className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {draft.trim() ? (
                      <button type="button" aria-label="Enviar" onClick={sendText} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9]">
                        ➤
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="Gravar áudio"
                        onClick={startAudioRecording}
                        disabled={!activeConversationId || isAudioBusy}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#1C1F2E] text-white/70 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ◉
                      </button>
                    )}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        event.currentTarget.value = "";
                        void handleImageFile(file);
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-white/35">
                    {audioUploading || imageUploading
                      ? "Enviando mídia..."
                      : "Texto em tempo real via NestJS + Socket.IO. Áudio e imagens já funcionam em tempo real também."}
                  </p>
                </>
              )}
            </div>
          </div>        </main>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex h-screen items-center justify-center bg-[#09090B] text-white">
          Carregando mensagens...
        </div>
      )}
    >
      <MessagesPageContent />
    </Suspense>
  );
}
