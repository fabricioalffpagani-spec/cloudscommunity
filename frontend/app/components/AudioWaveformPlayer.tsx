"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

const BAR_COUNT = 32;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function decodePeaks(src: string, barCount: number): Promise<number[]> {
  try {
    let arrayBuffer: ArrayBuffer;

    if (src.startsWith("data:")) {
      const base64 = src.split(",")[1] ?? "";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      // slice to get ArrayBuffer with correct byte length
      arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    } else {
      const res = await fetch(src);
      arrayBuffer = await res.arrayBuffer();
    }

    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    // close context to free resources
    void ctx.close?.();

    const channel = decoded.getChannelData(0);
    const blockSize = Math.floor(channel.length / barCount);
    const peaks: number[] = [];

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      let max = 0;
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channel.length);
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j]);
        if (v > max) max = v;
        sum += v;
      }
      // mix max + average to keep sensitivity, normalize to 0..1
      const avg = sum / Math.max(1, end - start);
      const val = Math.max(max * 0.9 + avg * 0.3, 0.08);
      peaks.push(Math.min(1, val));
    }

    // normalize so tallest is 1
    const globalMax = Math.max(...peaks, 0.01);
    return peaks.map(p => p / globalMax);
  } catch {
    // fallback: pseudo-random but stable by src hash
    let hash = 0;
    for (let i = 0; i < src.length; i++) hash = (hash * 31 + src.charCodeAt(i)) >>> 0;
    const seeded = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    return Array.from({ length: barCount }, (_, i) => 0.25 + seeded(hash + i * 917) * 0.75);
  }
}

type Props = {
  src: string;
  peaks?: number[];
  durationMs?: number | null;
  isOwn?: boolean;
  roundedCorner?: "left" | "right";
};

export function AudioWaveformPlayer({ src, peaks: providedPeaks, durationMs, isOwn = false, roundedCorner = "right" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [decodedPeaks, setDecodedPeaks] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, () => 0.3));
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(() => (durationMs ? durationMs / 1000 : 0));
  const [decoded, setDecoded] = useState(false);

  const hasProvided = !!providedPeaks && providedPeaks.length > 0;
  const bars = hasProvided ? providedPeaks : decodedPeaks;
  const barCount = bars.length;

  // use provided peaks directly, otherwise decode from audio data
  useEffect(() => {
    if (hasProvided) {
      setDecoded(true);
      return;
    }
    let cancelled = false;
    setDecoded(false);
    decodePeaks(src, BAR_COUNT).then(p => {
      if (!cancelled) {
        setDecodedPeaks(p);
        setDecoded(true);
      }
    });
    return () => { cancelled = true; };
  }, [src, hasProvided]);

  // keep duration in sync with prop when available
  useEffect(() => {
    if (durationMs && durationMs > 0) setDuration(durationMs / 1000);
  }, [durationMs]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
    } else {
      a.pause();
    }
  }, []);

  const onTimeUpdate = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setCurrent(a.currentTime);
    if (!durationMs && Number.isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration);
    }
  }, [durationMs]);

  const onLoadedMetadata = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (Number.isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration);
    }
  }, []);

  const onEnded = useCallback(() => {
    setPlaying(false);
    setCurrent(0);
  }, []);

  const onPlay = useCallback(() => setPlaying(true), []);
  const onPause = useCallback(() => setPlaying(false), []);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(1, Math.max(0, current / duration));
  }, [current, duration]);

  const progressBars = Math.round(progress * barCount);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, x / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(ratio * duration);
  }, [duration]);

  const displayTime = playing ? formatTime(current) : formatTime(duration || (durationMs ? durationMs / 1000 : 0));

  // colors tuned to match screenshot: deep purple pill
  const containerClass = isOwn
    ? "bg-[#9333EA]"
    : "bg-[#1c1530] border border-white/[0.08]";

  const pillRadius = isOwn
    ? (roundedCorner === "right" ? "rounded-2xl rounded-br-[4px]" : "rounded-2xl rounded-bl-[4px]")
    : (roundedCorner === "right" ? "rounded-2xl rounded-br-[4px]" : "rounded-2xl rounded-bl-[4px]");

  const playButtonClass = isOwn
    ? "bg-white/25 hover:bg-white/30 text-white backdrop-blur"
    : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white shadow-[0_0_12px_rgba(124,58,237,0.35)]";

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 ${pillRadius} ${containerClass}`}
      style={{ minWidth: 248, maxWidth: 320 }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${playButtonClass}`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true" className="ml-0.5">
            <path d="M8 5.14v14l11-7-11-7Z" />
          </svg>
        )}
      </button>

      <div className="flex flex-1 flex-col justify-center gap-1">
        <div
          className="flex items-center gap-[2.5px] cursor-pointer select-none"
          style={{ height: 28 }}
          onClick={handleSeek}
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {bars.map((peak, i) => {
            const isPlayed = i < progressBars;
            const h = decoded
              ? Math.max(4, Math.round(peak * 22 + 4)) // 4..26 px
              : Math.round(6 + Math.random() * 6);

            // colors
            let bg: string;
            if (isOwn) {
              bg = isPlayed ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.38)";
            } else {
              bg = isPlayed ? "#A855F7" : "rgba(255,255,255,0.28)";
            }

            return (
              <span
                key={i}
                className="block w-[3px] rounded-full transition-colors duration-100"
                style={{
                  height: `${h}px`,
                  background: bg,
                  opacity: decoded ? 1 : 0.5,
                }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[11px] leading-none">
          <span className={isOwn ? "text-white/70" : "text-white/45"}>Áudio</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${isOwn ? "bg-white/15 text-white/90" : "bg-white/10 text-white/70"}`}>
            {displayTime}
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
      />
    </div>
  );
}
