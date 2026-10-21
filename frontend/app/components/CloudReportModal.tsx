"use client";

import { useState } from "react";

const REPORT_REASONS = [
  "Spam ou publicidade",
  "Discurso de ódio",
  "Assédio ou bullying",
  "Conteúdo violento ou perturbador",
  "Informação falsa",
  "Conteúdo sexual inapropriado",
  "Ameaças",
  "Outro",
] as const;


export function CloudReportModal({
  cloudId,
  cloudTitle,
  reportedId,
  onClose,
}: {
  cloudId: string;
  cloudTitle: string;
  reportedId: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (reason: string) => {
    setSelected((previous) =>
      previous.includes(reason) ? previous.filter((item) => item !== reason) : [...previous, reason],
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0 || sending) return;
    setSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reportedId, reasons: selected }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? "Não foi possível enviar a denúncia.");
      }

      setDone(true);
      window.setTimeout(onClose, 1800);
    } catch (submitError) {
      setSending(false);
      setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar a denúncia.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15161C] p-6 shadow-2xl">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="text-[15px] font-semibold text-white">Denúncia enviada</p>
            <p className="text-center text-[13px] text-white/50">O host da Cloud foi notificado. A plataforma irá analisar a denúncia e retornará uma resposta em breve.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-bold text-white">Denunciar Cloud</h3>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-white/40">{cloudTitle}</p>
              </div>
              <button type="button" onClick={onClose} className="text-xl leading-none text-white/40 hover:text-white">×</button>
            </div>

            <p className="mb-3 text-[13px] text-white/60">Selecione os motivos:</p>
            <div className="mb-5 space-y-2">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggle(reason)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[13px] transition ${selected.includes(reason) ? "border-[#A855F7] bg-[#A855F7]/10 text-white" : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]"}`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected.includes(reason) ? "border-[#A855F7] bg-[#A855F7]" : "border-white/30"}`}>
                    {selected.includes(reason) && <svg viewBox="0 0 12 12" width={9} height={9} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="10 3 5 9 2 6" /></svg>}
                  </span>
                  {reason}
                </button>
              ))}
            </div>

            {error && <p className="mb-3 text-[12px] text-red-300">{error}</p>}
            <button type="button" onClick={() => void handleSubmit()} disabled={selected.length === 0 || sending} className="w-full rounded-full bg-red-500 py-2.5 text-[14px] font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? "Enviando…" : "Enviar denúncia"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
