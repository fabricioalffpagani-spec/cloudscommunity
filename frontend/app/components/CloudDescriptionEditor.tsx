"use client";

import { useState } from "react";

export function CloudDescriptionEditor({ cloudId, description, onSaved }: { cloudId: string; description: string | null; onSaved: (description: string | null) => void }) {
  const [draft, setDraft] = useState(description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: draft }) });
      const payload = await response.json().catch(() => null) as { cloud?: { description: string | null }; message?: string } | null;
      if (!response.ok || !payload?.cloud) throw new Error(payload?.message ?? "Não foi possível salvar a descrição.");
      onSaved(payload.cloud.description);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a descrição."); }
    finally { setSaving(false); }
  };
  return <div className="mt-4"><label className="block text-sm text-white/75">Descrição <span className="text-white/40">({draft.length}/2000)</span><textarea value={draft} maxLength={2000} rows={4} onChange={(event) => setDraft(event.target.value)} disabled={saving} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] p-3 text-sm text-white" /></label>{error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}<button type="button" onClick={() => void save()} disabled={saving} className="mt-3 rounded-full bg-[#9333EA] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar descrição"}</button></div>;
}
