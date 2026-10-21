"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export type EditableCloud = { id: string; title: string; duration: string; description?: string | null; editCount: number };

export function CloudEditDialog({ cloud, onClose, onSaved }: { cloud: EditableCloud; onClose: () => void; onSaved: (cloud: EditableCloud) => void }) {
  const [title, setTitle] = useState(cloud.title);
  const [duration, setDuration] = useState(cloud.duration);
  const [description, setDescription] = useState(cloud.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const limited = cloud.editCount >= 3;
  const save = async () => {
    setSaving(true); setError("");
    try {
      const changedTitleOrDuration = title.trim() !== cloud.title || duration !== cloud.duration;
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(changedTitleOrDuration ? { title, duration } : {}), description }) });
      const payload = await response.json().catch(() => null) as { cloud?: EditableCloud; message?: string } | null;
      if (!response.ok || !payload?.cloud) throw new Error(payload?.message ?? "Não foi possível editar a Cloud.");
      onSaved(payload.cloud);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível editar a Cloud."); }
    finally { setSaving(false); }
  };
  if (typeof document === "undefined") return null;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={(event) => { if (!saving && event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label="Editar Cloud" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#15161C] p-6 text-white">
    <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Editar Cloud</h2><p className="mt-1 text-xs text-white/50">Título e duração: {Math.max(0, 3 - cloud.editCount)} edição(ões) restante(s). A descrição pode ser alterada a qualquer momento.</p></div><button type="button" aria-label="Fechar edição" disabled={saving} onClick={onClose} className="text-xl text-white/50">×</button></div>
    <label className="block text-sm text-white/75">Título ({title.length}/40)<input value={title} maxLength={40} disabled={saving || limited} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] p-3 text-white disabled:opacity-50" /></label>
    <label className="mt-4 block text-sm text-white/75">Duração<select value={duration} disabled={saving || limited} onChange={(event) => setDuration(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#1f1830] p-3 text-white disabled:opacity-50"><option value="10min">10 minutos</option><option value="30min">30 minutos</option><option value="2h">2 horas</option><option value="5h">5 horas</option><option value="24h">24 horas</option></select></label>
    <label className="mt-4 block text-sm text-white/75">Descrição ({description.length}/2000)<textarea value={description} maxLength={2000} rows={4} disabled={saving} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] p-3 text-white" /></label>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-full bg-white/[0.06] px-4 py-2 text-sm">Cancelar</button><button type="button" disabled={saving || !title.trim()} onClick={() => void save()} className="rounded-full bg-[#9333EA] px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving ? "Salvando..." : "Salvar edição"}</button></div>
  </div></div>, document.body);
}
