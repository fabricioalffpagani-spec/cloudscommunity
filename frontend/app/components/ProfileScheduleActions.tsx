"use client";

import { useState } from "react";

export function ProfileScheduleActions({ cloudId, scheduledAt, initiallyReminded = false, onReminderActivated }: { cloudId: string; scheduledAt: string; initiallyReminded?: boolean; onReminderActivated?: () => void }) {
  const [showDate, setShowDate] = useState(false);
  const [reminded, setReminded] = useState(initiallyReminded);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const remind = async () => {
    if (loading || reminded) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/join`, { method: "POST" });
      if (!response.ok) { const payload = typeof response.json === "function" ? await response.json().catch(() => null) as { message?: string } | null : null; throw new Error(payload?.message || "Não foi possível ativar o lembrete."); }
      setReminded(true); onReminderActivated?.();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível ativar o lembrete."); } finally { setLoading(false); }
  };
  return <div className="mt-3 flex flex-col items-center gap-2">
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Ver data de estreia" aria-expanded={showDate} onClick={() => setShowDate((value) => !value)} className="rounded-full bg-[#9333EA]/20 p-2 text-[#D8B4FE] hover:bg-[#9333EA]/40"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg></button>
      <button type="button" aria-label={reminded ? "Lembrete ativado" : "Avisar-me na estreia"} disabled={loading || reminded} onClick={() => void remind()} className={`rounded-full p-2 ${reminded ? "bg-[#9333EA] text-white" : "bg-[#9333EA]/20 text-[#D8B4FE] hover:bg-[#9333EA]/40"}`}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" /><path d="M10 19a2 2 0 0 0 4 0" /></svg></button>
    </div>
    {showDate && <p className="text-xs text-white/75">Estreia em {new Date(scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}
