"use client";

import { useCallback, useEffect, useState } from "react";
import { RecloudIcon } from "./RecloudIcon";

type State = { canRecloud: boolean; reclouded: boolean };
export function useRecloud(cloudId: string, enabled = true, refreshKey?: unknown) {
  const [state, setState] = useState<State>({ canRecloud: false, reclouded: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) { setState({ canRecloud: false, reclouded: false }); return; }
    let active = true;
    setState({ canRecloud: false, reclouded: false });
    fetch(`/api/clouds/${encodeURIComponent(cloudId)}/recloud`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: State | null) => { if (active && data) setState({ canRecloud: !!data.canRecloud, reclouded: !!data.reclouded }); })
      .catch(() => {});
    return () => { active = false; };
  }, [cloudId, enabled, refreshKey]);
  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{ cloudId: string; reclouded: boolean }>).detail;
      if (detail?.cloudId === cloudId) setState((current) => ({ ...current, reclouded: detail.reclouded }));
    };
    window.addEventListener("clouds:recloud-changed", changed);
    return () => window.removeEventListener("clouds:recloud-changed", changed);
  }, [cloudId]);
  const toggle = useCallback(async () => {
    if (busy || !state.canRecloud) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/recloud`, { method: state.reclouded ? "DELETE" : "POST" });
      if (!response.ok) { const data = await response.json().catch(() => null) as { message?: string } | null; throw new Error(data?.message || "Não foi possível atualizar o Recloud. Tente novamente."); }
      const reclouded = !state.reclouded;
      setState((current) => ({ ...current, reclouded }));
      window.dispatchEvent(new CustomEvent("clouds:recloud-changed", { detail: { cloudId, reclouded } }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o Recloud. Tente novamente."); }
    finally { setBusy(false); }
  }, [busy, cloudId, state.canRecloud, state.reclouded]);
  return { ...state, busy, error, toggle };
}

export function RecloudMenuItem({ cloudId }: { cloudId: string }) {
  const recloud = useRecloud(cloudId);
  if (!recloud.canRecloud) return null;
  return <><button type="button" disabled={recloud.busy} onClick={() => void recloud.toggle()} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-white/80 hover:bg-white/5 disabled:opacity-50"><RecloudIcon />{recloud.reclouded ? "Desfazer Recloud" : "Republicar Cloud"}</button>{recloud.error && <p role="alert" className="px-4 py-2 text-xs text-red-300">{recloud.error}</p>}</>;
}
