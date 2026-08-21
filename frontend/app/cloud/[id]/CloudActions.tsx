"use client";

import { useState } from "react";
import { FlameIcon } from "../../components/FlameIcon";

function FireIcon({ filled }: { filled: boolean }) {
  return <FlameIcon s={26} filled={filled} />;
}

type CloudActionsProps = {
  cloudId: string;
  initialHyped?: boolean;
  initialHypes?: number;
};

export default function CloudActions({ cloudId, initialHyped = false, initialHypes = 0 }: CloudActionsProps) {
  const [hyped, setHyped] = useState(initialHyped);
  const [hypes, setHypes] = useState(initialHypes);
  const [loading, setLoading] = useState(false);

  async function toggleHype() {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const wasHyped = hyped;
    setHyped(!wasHyped);
    setHypes((n) => (wasHyped ? n - 1 : n + 1));

    try {
      const res = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/hype`, {
        method: wasHyped ? "DELETE" : "POST",
      });

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { hypesCount?: number } | null;
        if (data?.hypesCount !== undefined) {
          setHypes(data.hypesCount);
        }
      } else {
        // Revert on failure
        setHyped(wasHyped);
        setHypes((n) => (wasHyped ? n + 1 : n - 1));
      }
    } catch {
      setHyped(wasHyped);
      setHypes((n) => (wasHyped ? n + 1 : n - 1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleHype}
        disabled={loading}
        aria-label={hyped ? "Remover hype" : "Hypar Cloud"}
        className={`inline-flex items-center gap-1.5 rounded-3xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
          hyped
            ? "border-[#F97316]/40 bg-[#F97316]/20 text-[#F97316]"
            : "border-white/10 bg-white/5 text-white/70 hover:border-[#F97316]/30 hover:bg-[#F97316]/10 hover:text-[#F97316]"
        }`}
      >
        <FireIcon filled={hyped} />
        <span>Hype · {hypes}</span>
      </button>
    </div>
  );
}
