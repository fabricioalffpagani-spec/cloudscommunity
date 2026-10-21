"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

const BAR_COUNT = 32;
const PLAYBACK_RATES = [1, 1.5, 2] as const;

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
  flatTop?: boolean;
};

export function AudioWaveformPlayer({ src, peaks: providedPeaks, durationMs, flatTop = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [decodedPeaks, setDecodedPeaks] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, () => 0.3));
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(() => (durationMs ? durationMs / 1000 : 0));
  const [decoded, setDecoded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_RATES)[number]>(1);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackRate;
  }, [playbackRate]);

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

  const handlePlaybackRateChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRate = Number(event.target.value);
    if (PLAYBACK_RATES.includes(nextRate as (typeof PLAYBACK_RATES)[number])) {
      setPlaybackRate(nextRate as (typeof PLAYBACK_RATES)[number]);
    }
  }, []);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(1, Math.max(0, current / duration));
  }, [current, duration]);

  const progressBars = Math.round(progress * barCount);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const x = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, x / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(ratio * duration);
  }, [duration]);

  const handleSeekKey = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === "Home" ? 0 : event.key === "End" ? duration : Math.max(0, Math.min(duration, audio.currentTime + (event.key === "ArrowRight" ? 5 : -5)));
    audio.currentTime = target;
    setCurrent(target);
  }, [duration]);

  const displayTime = playing ? formatTime(current) : formatTime(duration || (durationMs ? durationMs / 1000 : 0));

  return (
    <div
      className={`flex w-[min(340px,calc(100vw-7rem))] max-w-full min-w-0 items-center gap-2 bg-[#8a20e9] px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 ${flatTop ? "rounded-b-2xl" : "rounded-2xl"}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 sm:h-12 sm:w-12"
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

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="flex h-9 min-w-0 flex-1 cursor-pointer select-none items-center gap-[2px] overflow-hidden"
          onClick={handleSeek}
          onKeyDown={handleSeekKey}
          role="slider"
          tabIndex={0}
          aria-label="Posição do áudio"
          aria-valuenow={Math.round(current)}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuetext={`${formatTime(current)} de ${formatTime(duration)}`}
        >
          {bars.map((peak, i) => {
            const isPlayed = i < progressBars;
            const h = decoded
              ? Math.max(4, Math.round(peak * 22 + 4)) // 4..26 px
              : 8;

            // colors
            const bg = isPlayed ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.38)";

            return (
              <span
                key={i}
                className="block min-w-[1px] flex-1 rounded-full transition-colors duration-100"
                style={{
                  height: `${h}px`,
                  background: bg,
                  opacity: decoded ? 1 : 0.5,
                }}
              />
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] leading-none">
          <select
            aria-label="Velocidade de reprodução"
            value={playbackRate}
            onChange={handlePlaybackRateChange}
            className="cursor-pointer rounded-full border-0 bg-white/20 px-1.5 py-2 text-[11px] font-semibold text-white outline-none sm:px-2 sm:text-xs"
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate} className="bg-[#1c1530] text-white">
                {String(rate).replace(".", ",")}×
              </option>
            ))}
          </select>
          <span className="rounded-full bg-white/20 px-2 py-2 text-[11px] font-semibold tabular-nums text-white sm:text-xs">
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
