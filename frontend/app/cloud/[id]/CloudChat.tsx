"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { io, type Socket } from "socket.io-client";

import { UserAvatar, getSessionUserDisplayName, useSessionUser } from "../../components/session-user";
import { ArrowLeftIcon, BellIcon, CheckIcon, GearIcon, MicIcon, PauseIcon, PlayIcon, PlusIcon, SearchIcon, SendIcon, TrashIcon } from "../../components/ui-icons";

type CloudPayload = {
  id: string;
  title: string;
  description: string | null;
  duration: string;
  status: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
  membersCount: number;
  href: string;
};

type ReactionPayload = {
  id: string;
  emoji: string;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
};

type CloudMessagePayload = {
  id: string;
  cloudId: string;
  senderId: string;
  type: "text" | "audio" | "image" | "link";
  content: string | null;
  mediaUrl: string | null;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  replyTo: {
    id: string;
    sender: string;
    content: string | null;
  } | null;
  reactions: ReactionPayload[];
};

type CloudChatProps = {
  cloudId: string;
  title?: string;
  duration?: string;
  createdAt?: string;
  participants?: number;
};

type RecordedAudio = {
  blob: Blob;
  durationMs: number;
  mimeType: string;
};

type RecorderState = "idle" | "recording" | "paused";

type ChatMessage = {
  id: string;
  cloudId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  side: "left" | "right";
  kind: "text" | "audio" | "image" | "link";
  content: string;
  mediaUrl: string | null;
  replyTo: {
    id: string;
    sender: string;
    content: string | null;
  } | null;
  reactions: ReactionPayload[];
  time: string;
  isoTime: string;
  pending?: boolean;
  clientMessageId?: string | null;
  audioDurationMs?: number | null;
};

const SOCKET_URL = process.env.NEXT_PUBLIC_CLOUDS_SOCKET_URL?.trim() || "";
const MESSAGE_LIMIT = 50;
const EMOJI_BANK = ["😀", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😍", "🤩", "😘", "🥳", "😎", "🤗", "🤔", "😇", "👍", "🙏", "❤️", "🔥", "✨", "🎉", "💬"];

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return "Hoje";
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function resolveSocketUrl() {
  if (SOCKET_URL) {
    return SOCKET_URL.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "";
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) {
    throw new Error("Falha ao carregar dados.");
  }

  return payload;
}

function mergeMessage(list: ChatMessage[], next: ChatMessage) {
  const index = next.clientMessageId ? list.findIndex((item) => item.clientMessageId === next.clientMessageId) : -1;

  if (index >= 0) {
    return list.map((item, currentIndex) => {
      if (currentIndex !== index) {
        return item;
      }

      return {
        ...item,
        ...next,
        pending: false,
        audioDurationMs: next.audioDurationMs ?? item.audioDurationMs ?? null,
      };
    });
  }

  if (list.some((item) => item.id === next.id)) {
    return list;
  }

  return [...list, next];
}

function normalizeMessage(payload: CloudMessagePayload, currentUserId?: string | null): ChatMessage {
  const isOwn = Boolean(currentUserId && payload.senderId === currentUserId);

  return {
    id: payload.id,
    cloudId: payload.cloudId,
    senderId: payload.senderId,
    senderName: payload.sender.displayName || payload.sender.username || "Usuário",
    senderAvatarUrl: payload.sender.avatarUrl,
    side: isOwn ? "right" : "left",
    kind: payload.type,
    content: payload.content || "",
    mediaUrl: payload.mediaUrl,
    replyTo: payload.replyTo,
    reactions: payload.reactions || [],
    time: timeLabel(payload.createdAt),
    isoTime: payload.createdAt,
    clientMessageId: payload.clientMessageId,
  };
}

function normalizeCloud(payload: CloudPayload) {
  return {
    id: payload.id,
    title: payload.title,
    duration: payload.duration,
    status: payload.status,
    authorId: payload.authorId,
    membersCount: payload.membersCount,
    author: payload.author,
  };
}

function useAudioRecorder(onStop: (recording: RecordedAudio) => void) {
  const [state, setState] = useState<RecorderState>("idle");
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

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }

    recorder.pause();
    stopTimers();
    setState("paused");
  }, [stopTimers]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") {
      return;
    }

    recorder.resume();
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    setState("recording");
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }

    chunksRef.current = [];
    stopTimers();
    cleanupStream();
    setState("idle");
    setSeconds(0);
    secondsRef.current = 0;
  }, [cleanupStream, stopTimers]);

  useEffect(() => () => {
    stopTimers();
    cleanupStream();
  }, [cleanupStream, stopTimers]);

  return { state, seconds, start, stop, pause, resume, cancel };
}

function MessageReceipt() {
  return <CheckIcon s={14} className="text-white/45" />;
}

function AudioBubble({ msg, own }: { msg: ChatMessage; own?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) {
      return;
    }

    const onEnded = () => setPlaying(false);
    a.addEventListener("ended", onEnded);
    return () => a.removeEventListener("ended", onEnded);
  }, []);

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`} style={{ minWidth: 220 }}>
      <button
        type="button"
        onClick={() => {
          const audio = audioRef.current;
          if (!audio) {
            return;
          }

          if (playing) {
            audio.pause();
            setPlaying(false);
            return;
          }

          void audio.play();
          setPlaying(true);
        }}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${own ? "bg-white/20 hover:bg-white/30" : "bg-[#7C3AED] hover:bg-[#6D28D9]"}`}
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        {playing ? <PauseIcon s={14} /> : <PlayIcon s={14} />}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[12px] text-white/60">
          <span>Áudio</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{msg.audioDurationMs ? `${Math.max(1, Math.round(msg.audioDurationMs / 1000))}s` : "0s"}</span>
        </div>
        {msg.mediaUrl && <audio ref={audioRef} src={msg.mediaUrl} className="hidden" preload="metadata" />}
      </div>
    </div>
  );
}

function ImageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <a href={msg.mediaUrl || "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a0e3d]">
      {msg.mediaUrl ? (
        <img src={msg.mediaUrl} alt="Imagem enviada" className="max-h-[320px] max-w-full object-cover" />
      ) : (
        <div className="px-4 py-8 text-[14px] text-white/50">Imagem indisponível</div>
      )}
    </a>
  );
}

function CloudMessageBubble({
  msg,
  onReact,
}: {
  msg: ChatMessage;
  onReact: (messageId: string, emoji: string) => void;
}) {
  const own = msg.side === "right";
  const groupedReactions = useMemo(() => {
    return msg.reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction);
      return acc;
    }, {} as Record<string, ReactionPayload[]>);
  }, [msg.reactions]);

  return (
    <div className={`flex items-end gap-2.5 ${own ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-9 shrink-0 pt-0.5">
        <UserAvatar
          user={{ id: msg.senderId, username: msg.senderId, displayName: msg.senderName, avatarUrl: msg.senderAvatarUrl }}
          size={34}
        />
      </div>

      <div className={`flex flex-col gap-1.5 ${own ? "items-end" : "items-start"}`} style={{ maxWidth: "74%" }}>
        <div className={`flex items-center gap-2 px-1 ${own ? "flex-row-reverse" : ""}`}>
          <span className="text-[12px] font-semibold text-white/40">{own ? "Você" : msg.senderName}</span>
        </div>

        {msg.replyTo && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] text-white/70">
            <p className="font-semibold text-white">{msg.replyTo.sender}</p>
            <p className="mt-1 line-clamp-2 leading-snug">{msg.replyTo.content || ""}</p>
          </div>
        )}

        {msg.kind === "audio" ? (
          <AudioBubble msg={msg} own={own} />
        ) : msg.kind === "image" ? (
          <ImageBubble msg={msg} />
        ) : msg.kind === "link" ? (
          <div className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed text-white ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
            {msg.content}
          </div>
        ) : (
          <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-white ${own ? "rounded-br-[4px] bg-[#9333EA]" : "rounded-bl-[4px] border border-white/[0.08] bg-[#1a0e3d]"}`}>
            {msg.content}
            {msg.pending && <span className="ml-2 text-[11px] text-white/50">enviando...</span>}
          </div>
        )}

        <div className={`flex items-center gap-1 px-1 text-[11px] text-white/30 ${own ? "flex-row-reverse" : ""}`}>
          <span>{msg.time}</span>
          {own && !msg.pending && <MessageReceipt />}
        </div>

        {Object.keys(groupedReactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 px-1 ${own ? "justify-end" : ""}`}>
            {Object.entries(groupedReactions).map(([emoji, reactions]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(msg.id, emoji)}
                className="rounded-full bg-white/10 px-2 py-1 text-[12px] transition hover:bg-white/20"
                title={`${reactions.length} reação(ões) com ${emoji}`}
              >
                <span>{emoji}</span>
                <span className="ml-1 text-white/70">{reactions.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CloudChat({ cloudId, title, duration, createdAt, participants }: CloudChatProps) {
  const { user, status } = useSessionUser();
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioRecorder = useAudioRecorder((recording) => {
    void handleAudioRecordingStop(recording);
  });

  const [cloud, setCloud] = useState<ReturnType<typeof normalizeCloud> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [typingUserIds, setTypingUserIds] = useState<Record<string, boolean>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<{ name: string } | null>(null);
  const activeCloudIdRef = useRef(cloudId);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeCloudIdRef.current = cloudId;
  }, [cloudId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!emojiOpen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const picker = document.querySelector('[data-cloud-emoji-picker="true"]');
      const button = document.querySelector('[data-cloud-emoji-toggle="true"]');
      if (picker?.contains(target) || button?.contains(target)) {
        return;
      }

      setEmojiOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [emojiOpen]);

  const loadCloud = useCallback(async () => {
    setLoadingCloud(true);
    setError(null);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, { cache: "no-store" });
      const payload = await readJson<{ ok: true; cloud: CloudPayload }>(response);
      setCloud(normalizeCloud(payload.cloud));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a cloud.");
    } finally {
      setLoadingCloud(false);
    }
  }, [cloudId]);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages?take=${MESSAGE_LIMIT}`, { cache: "no-store" });
      const payload = await readJson<{ ok: true; messages: CloudMessagePayload[] }>(response);
      setMessages(payload.messages.map((message) => normalizeMessage(message, user?.id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as mensagens.");
    } finally {
      setLoadingMessages(false);
    }
  }, [cloudId, user?.id]);

  const joinCloud = useCallback((socket: Socket) => {
    socket.emit("cloud:join", { cloudId });
  }, [cloudId]);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      return;
    }

    void loadCloud();
    void loadMessages();
  }, [loadCloud, loadMessages, status, user]);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      return;
    }

    const socketUrl = resolveSocketUrl();
    if (!socketUrl) {
      setConnectionState("disconnected");
      return;
    }

    const socket = io(`${socketUrl}/clouds`, {
      withCredentials: true,
      transports: ["polling", "websocket"],
    });

    socketRef.current = socket;
    setConnectionState("connecting");

    socket.on("connect", () => {
      setConnectionState("connected");
    });

    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", () => setConnectionState("disconnected"));

    socket.on("cloud:message:new", (message: CloudMessagePayload) => {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(message, user.id)));
    });

    socket.on("cloud:reaction:changed", (payload: { cloudId: string; messageId: string; reaction: ReactionPayload; removed: boolean }) => {
      if (payload.cloudId !== cloudId) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== payload.messageId) {
            return message;
          }

          const reactions = payload.removed
            ? message.reactions.filter((reaction) => reaction.id !== payload.reaction.id)
            : [...message.reactions.filter((reaction) => reaction.id !== payload.reaction.id), payload.reaction];

          return { ...message, reactions };
        }),
      );
    });

    socket.on("cloud:typing", (payload: { cloudId: string; userId: string; isTyping: boolean }) => {
      if (payload.cloudId !== cloudId || payload.userId === user.id) {
        return;
      }

      setTypingUserIds((prev) => ({
        ...prev,
        [payload.userId]: payload.isTyping,
      }));

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = setTimeout(() => {
        setTypingUserIds((prev) => ({
          ...prev,
          [payload.userId]: false,
        }));
      }, 3500);
    });

    return () => {
      socket.emit("cloud:leave", { cloudId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [cloudId, joinCloud, status, user]);

  useEffect(() => {
    const socket = socketRef.current;
    if (status !== "authenticated" || !user || connectionState !== "connected" || !socket?.connected) {
      return;
    }

    const timer = setTimeout(() => {
      if (socket.connected) {
        socket.emit("cloud:join", { cloudId });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [cloudId, connectionState, status, user]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return;
    }

    const currentTyping = Boolean(draft.trim());
    socket.emit("cloud:typing", { cloudId, isTyping: currentTyping });

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      socket.emit("cloud:typing", { cloudId, isTyping: false });
    }, currentTyping ? 1500 : 0);
  }, [cloudId, draft]);

  const openImagePicker = useCallback(() => {
    if (!audioRecorder || audioRecorder.state !== "idle") {
      return;
    }

    imageInputRef.current?.click();
  }, [audioRecorder]);

  const sendReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      const payload = await readJson<{ ok: true; reaction: ReactionPayload; removed: boolean }>(response);
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const reactions = payload.removed
            ? message.reactions.filter((reaction) => reaction.id !== payload.reaction.id)
            : [...message.reactions.filter((reaction) => reaction.id !== payload.reaction.id), payload.reaction];

          return { ...message, reactions };
        }),
      );
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível reagir à mensagem.");
    }
  }, [cloudId]);

  const sendText = useCallback(async () => {
    if (!draft.trim() || !user) {
      return;
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessage = {
      id: clientMessageId,
      cloudId,
      senderId: user.id,
      senderName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      side: "right",
      kind: "text",
      content: draft.trim(),
      mediaUrl: null,
      replyTo: null,
      reactions: [],
      time: timeLabel(new Date().toISOString()),
      isoTime: new Date().toISOString(),
      pending: true,
      clientMessageId,
    };

    const nextDraft = draft;
    setDraft("");
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          content: nextDraft.trim(),
          clientMessageId,
        }),
      });

      const payload = await readJson<{ ok: true; message: CloudMessagePayload }>(response);
      setMessages((prev) => mergeMessage(prev, normalizeMessage(payload.message, user.id)));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a mensagem.");
      setMessages((prev) => prev.filter((message) => message.clientMessageId !== clientMessageId));
    }
  }, [cloudId, draft, user]);

  const handleAudioRecordingStop = useCallback(async (recording: RecordedAudio) => {
    if (!user) {
      return;
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(recording.blob);
    const optimistic: ChatMessage = {
      id: clientMessageId,
      cloudId,
      senderId: user.id,
      senderName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      side: "right",
      kind: "audio",
      content: "",
      mediaUrl: tempUrl,
      replyTo: null,
      reactions: [],
      time: timeLabel(new Date().toISOString()),
      isoTime: new Date().toISOString(),
      pending: true,
      clientMessageId,
      audioDurationMs: recording.durationMs,
    };

    setAudioUploading(true);
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      const formData = new FormData();
      formData.set("file", recording.blob, `audio-${Date.now()}.webm`);
      formData.set("clientMessageId", clientMessageId);

      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/audio`, {
        method: "POST",
        body: formData,
      });

      const payload = await readJson<{ ok: true; message: CloudMessagePayload }>(response);
      setMessages((prev) => mergeMessage(prev, normalizeMessage(payload.message, user.id)));
      URL.revokeObjectURL(tempUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar o áudio.");
      URL.revokeObjectURL(tempUrl);
      setMessages((prev) => prev.filter((message) => message.clientMessageId !== clientMessageId));
    } finally {
      setAudioUploading(false);
      setSelectedFilePreview(null);
    }
  }, [cloudId, user]);

  const handleImageFile = useCallback(async (file: File | null) => {
    if (!file || !user) {
      return;
    }

    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempUrl = URL.createObjectURL(file);
    const optimistic: ChatMessage = {
      id: clientMessageId,
      cloudId,
      senderId: user.id,
      senderName: getSessionUserDisplayName(user),
      senderAvatarUrl: user.avatarUrl ?? null,
      side: "right",
      kind: "image",
      content: "",
      mediaUrl: tempUrl,
      replyTo: null,
      reactions: [],
      time: timeLabel(new Date().toISOString()),
      isoTime: new Date().toISOString(),
      pending: true,
      clientMessageId,
    };

    setImageUploading(true);
    setMessages((prev) => mergeMessage(prev, optimistic));

    try {
      const formData = new FormData();
      formData.set("file", file, file.name || `image-${Date.now()}.jpg`);
      formData.set("clientMessageId", clientMessageId);

      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/image`, {
        method: "POST",
        body: formData,
      });

      const payload = await readJson<{ ok: true; message: CloudMessagePayload }>(response);
      setMessages((prev) => mergeMessage(prev, normalizeMessage(payload.message, user.id)));
      URL.revokeObjectURL(tempUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Não foi possível enviar a imagem.");
      URL.revokeObjectURL(tempUrl);
      setMessages((prev) => prev.filter((message) => message.clientMessageId !== clientMessageId));
    } finally {
      setImageUploading(false);
      setSelectedFilePreview(null);
    }
  }, [cloudId, user]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendText();
    }
  }, [sendText]);

  const isAudioBusy = audioUploading || imageUploading || audioRecorder.state !== "idle";
  const typingMessage = Object.keys(typingUserIds).filter((id) => typingUserIds[id]);

  if (status === "loading" || loadingCloud) {
    return (
      <div className="flex h-screen items-center justify-center text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
        Carregando a cloud...
      </div>
    );
  }

  const resolvedTitle = cloud?.title || title || "Cloud";
  const resolvedParticipants = cloud?.membersCount ?? participants ?? 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#000000] px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Voltar para home" className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/[0.06] hover:text-white/80">
            <ArrowLeftIcon s={18} />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-white">{resolvedTitle}</p>
            <p className="text-[12px] text-white/40">
              {resolvedParticipants} participante(s)
              {duration ? ` · ${duration}` : ""}
              {createdAt ? ` · ${dateLabel(createdAt)}` : ""}
            </p>
            <p className="text-[12px] text-white/45">
              {typingMessage.length === 0
                ? "online"
                : typingMessage.length === 1
                  ? "digitando..."
                  : `${typingMessage.length} pessoas digitando...`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[12px] ${connectionState === "connected" ? "bg-[#22C55E]/15 text-[#22C55E]" : connectionState === "connecting" ? "bg-[#F59E0B]/15 text-[#F59E0B]" : "bg-white/10 text-white/50"}`}>
            {connectionState === "connected" ? "tempo real ativo" : connectionState === "connecting" ? "conectando..." : "offline"}
          </span>
          <button type="button" aria-label="Buscar na conversa" className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.06] hover:text-white">
            <SearchIcon s={18} />
          </button>
          <button type="button" aria-label="Notificações" className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.06] hover:text-white">
            <BellIcon s={18} />
          </button>
          <button type="button" aria-label="Configurações" className="flex h-10 w-10 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.06] hover:text-white">
            <GearIcon s={18} />
          </button>
        </div>
      </div>

      {error && <div className="border-b border-white/[0.07] bg-[#2A1018] px-5 py-2 text-[12px] text-[#FCA5A5]">{error}</div>}

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loadingMessages && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-white/40">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-white/40">
            <div>
              <p className="text-[16px] font-semibold text-white/70">Nenhuma mensagem ainda</p>
              <p className="mt-1 text-[14px]">Seja o primeiro a escrever nessa cloud.</p>
            </div>
          </div>
        ) : (
          (() => {
            const rows: Array<ChatMessage | { id: string; type: "date"; label: string }> = [];
            let previous = "";
            for (const message of messages) {
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

              return <CloudMessageBubble key={entry.id} msg={entry as ChatMessage} onReact={sendReaction} />;
            });
          })()
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.07] bg-[#000000] px-5 py-4">
        <div className="relative flex flex-col gap-2 rounded-full border border-white/[0.08] bg-[#1a0e3d] px-5 py-3">
          {audioRecorder.state === "recording" || audioRecorder.state === "paused" ? (
            <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-black px-4 py-2.5">
              <div className="flex-1 text-[14px] text-white"> 
                {audioRecorder.state === "paused" ? "Pausado" : "Gravando…"} {Math.max(0, audioRecorder.seconds)}s
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={audioRecorder.state === "paused" ? "Retomar" : "Pausar"} onClick={audioRecorder.state === "paused" ? audioRecorder.resume : audioRecorder.pause} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/10">
                  {audioRecorder.state === "paused" ? <PlayIcon s={16} /> : <PauseIcon s={16} />}
                </button>
                <button type="button" aria-label="Enviar áudio" onClick={audioRecorder.stop} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9]">
                  <SendIcon />
                </button>
                <button type="button" aria-label="Cancelar gravação" onClick={audioRecorder.cancel} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white transition hover:bg-white/10">
                  <TrashIcon s={16} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {selectedFilePreview && (
                <div className="flex items-center justify-between gap-3 rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/80">Arquivo pronto para enviar</p>
                    <p className="truncate text-[14px] font-semibold text-white">{selectedFilePreview.name}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedFilePreview(null)} className="rounded-full border border-white/10 px-3 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.05] hover:text-white">
                    Remover
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Abrir emojis"
                    data-cloud-emoji-toggle="true"
                    onClick={() => setEmojiOpen((current) => !current)}
                    disabled={isAudioBusy}
                    className="text-white/25 transition hover:text-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    😀
                  </button>
                  <button
                    type="button"
                    aria-label="Adicionar imagem"
                    onClick={openImagePicker}
                    disabled={isAudioBusy}
                    className="text-white/25 transition hover:text-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlusIcon s={18} />
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem..."
                    disabled={isAudioBusy}
                    className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {draft.trim() ? (
                    <button type="button" aria-label="Enviar" onClick={() => void sendText()} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#9333EA] text-white transition hover:bg-[#6D28D9]">
                      <SendIcon s={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Gravar áudio"
                      onClick={() => void audioRecorder.start().catch((recordError) => setError(recordError instanceof Error ? recordError.message : "Não foi possível iniciar a gravação."))}
                      disabled={isAudioBusy}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#1a0e3d] text-white/70 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MicIcon s={18} />
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
                      if (file) {
                        setSelectedFilePreview({ name: file.name || "Imagem" });
                        void handleImageFile(file);
                      }
                    }}
                  />
                </div>

                {emojiOpen && (
                  <div data-cloud-emoji-picker="true" className="max-h-[32vh] overflow-y-auto rounded-[22px] border border-white/10 bg-[#11141F] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                    <div className="flex flex-wrap gap-2">
                      {EMOJI_BANK.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setDraft((current) => `${current}${emoji}`);
                            setEmojiOpen(false);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-2xl text-[18px] transition hover:bg-white/[0.07]"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {audioUploading || imageUploading ? <p className="text-[11px] text-white/35">Enviando mídia...</p> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
