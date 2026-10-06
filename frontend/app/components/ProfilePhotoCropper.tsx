"use client";

import { useEffect, useRef, useState } from "react";

type CropperProps = {
  source: string | null;
  onCancel: () => void;
  onConfirm: (image: string) => void;
};

const OUTPUT_SIZE = 512;

export function ProfilePhotoCropper({ source, onCancel, onConfirm }: CropperProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ width: 0, height: 0 });
    setError("");
  }, [source]);

  if (!source) return null;

  const baseScale = naturalSize.width && naturalSize.height
    ? Math.max(OUTPUT_SIZE / naturalSize.width, OUTPUT_SIZE / naturalSize.height)
    : 1;
  const scale = baseScale * zoom;
  const renderedWidth = naturalSize.width * scale;
  const renderedHeight = naturalSize.height * scale;
  const maxOffset = {
    x: Math.max(0, (renderedWidth - OUTPUT_SIZE) / 2),
    y: Math.max(0, (renderedHeight - OUTPUT_SIZE) / 2),
  };
  const clampOffset = (next: { x: number; y: number }) => ({
    x: Math.min(maxOffset.x, Math.max(-maxOffset.x, next.x)),
    y: Math.min(maxOffset.y, Math.max(-maxOffset.y, next.y)),
  });

  const setZoomAndKeepPosition = (nextZoom: number) => {
    setZoom(nextZoom);
    const nextScale = baseScale * nextZoom;
    const nextMax = {
      x: Math.max(0, (naturalSize.width * nextScale - OUTPUT_SIZE) / 2),
      y: Math.max(0, (naturalSize.height * nextScale - OUTPUT_SIZE) / 2),
    };
    setOffset((current) => ({
      x: Math.min(nextMax.x, Math.max(-nextMax.x, current.x)),
      y: Math.min(nextMax.y, Math.max(-nextMax.y, current.y)),
    }));
  };

  const crop = () => {
    const image = imageRef.current;
    if (!image || !naturalSize.width || !naturalSize.height) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Não foi possível preparar a imagem.");
      return;
    }
    context.drawImage(image, (OUTPUT_SIZE - renderedWidth) / 2 + offset.x, (OUTPUT_SIZE - renderedHeight) / 2 + offset.y, renderedWidth, renderedHeight);
    onConfirm(canvas.toDataURL("image/jpeg", 0.88));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/75 p-4 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="profile-photo-crop-title">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#17102f] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="profile-photo-crop-title" className="text-lg font-bold text-white">Ajustar foto</h2><p className="mt-1 text-sm text-white/60">Arraste para reposicionar e use o controle para aproximar.</p></div>
          <button type="button" onClick={onCancel} aria-label="Cancelar recorte" className="text-2xl leading-none text-white/55 transition hover:text-white">×</button>
        </div>
        <div
          className="relative mx-auto mt-5 aspect-square w-full max-w-[280px] touch-none overflow-hidden rounded-full bg-black"
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }; }}
          onPointerMove={(event) => { const start = dragStart.current; if (start) setOffset(clampOffset({ x: start.offsetX + (event.clientX - start.x) * (OUTPUT_SIZE / 280), y: start.offsetY + (event.clientY - start.y) * (OUTPUT_SIZE / 280) })); }}
          onPointerUp={() => { dragStart.current = null; }}
          onPointerCancel={() => { dragStart.current = null; }}
        >
          <img ref={imageRef} src={source} alt="Prévia da foto selecionada" draggable={false} onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} className="absolute left-1/2 top-1/2 max-w-none select-none" style={{ width: renderedWidth * (280 / OUTPUT_SIZE), height: renderedHeight * (280 / OUTPUT_SIZE), transform: `translate(calc(-50% + ${offset.x * (280 / OUTPUT_SIZE)}px), calc(-50% + ${offset.y * (280 / OUTPUT_SIZE)}px))` }} />
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/60 ring-inset" />
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm text-white/75"><span>Zoom</span><input aria-label="Zoom da foto" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoomAndKeepPosition(Number(event.target.value))} className="accent-[#A855F7]" /></label>
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white">Cancelar</button><button type="button" onClick={crop} disabled={!naturalSize.width} className="rounded-full bg-[#A855F7] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#9333EA] disabled:opacity-50">Usar foto</button></div>
      </div>
    </div>
  );
}
