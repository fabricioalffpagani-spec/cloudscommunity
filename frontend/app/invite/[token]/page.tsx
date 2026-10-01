"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type InviteCloud = {
  id: string;
  title: string;
  duration: string;
  createdAt: string;
  authorId: string;
  visibility: "public" | "private";
};

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" viewBox="0 0 24 24" width={32} height={32} fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#A855F7" strokeWidth="3" />
      <path className="opacity-75" fill="#A855F7" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z" />
    </svg>
  );
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";

  const [cloud, setCloud] = useState<InviteCloud | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/invite/${encodeURIComponent(token)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.invite?.cloud) {
          throw new Error(data?.message ?? "Convite inválido ou expirado.");
        }
        return data.invite.cloud as InviteCloud;
      })
      .then(async (c) => {
        // The author may reach this URL from their own private Cloud. They are
        // already authorized and should enter directly, without an invite CTA.
        const sessionResponse = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" }).catch(() => null);
        const session = sessionResponse ? await sessionResponse.json().catch(() => null) as { user?: { id?: string } } | null : null;
        if (session?.user?.id === c.authorId) {
          const query = new URLSearchParams({
            title: c.title,
            duration: c.duration,
            createdAt: c.createdAt,
            visibility: c.visibility,
          });
          window.location.replace(`/cloud/${encodeURIComponent(c.id)}?${query.toString()}`);
          return;
        }
        setCloud(c);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar convite.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    if (!cloud) return;
    setJoining(true);

    try {
      const res = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/join`, {
        method: "POST",
        credentials: "include",
      });

      // Accept both 200 (joined) and 401 (not logged in — let CloudChat handle it)
      // but bail on unexpected server errors
      if (!res.ok && res.status !== 401) {
        const data = await res.json().catch(() => null);
        throw new Error((data as { message?: string } | null)?.message ?? "Não foi possível entrar na Cloud.");
      }
    } catch (err) {
      // If the join explicitly failed (not just auth), show the error instead of navigating
      if (err instanceof Error && err.message !== "Não foi possível entrar na Cloud.") {
        // network error — try to navigate anyway
      } else if (err instanceof Error) {
        setJoining(false);
        setError(err.message);
        return;
      }
    }

    // Navigate using hard redirect so Next.js fully loads the page
    const query = new URLSearchParams({
      title: cloud.title,
      duration: cloud.duration,
      createdAt: cloud.createdAt,
      visibility: cloud.visibility,
    });

    window.location.assign(`/cloud/${encodeURIComponent(cloud.id)}?${query.toString()}`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#030208]">
        <SpinnerIcon />
      </div>
    );
  }

  if (error || !cloud) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#030208] px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
          <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-white">Convite inválido</h1>
        <p className="max-w-xs text-[14px] text-white/60">{error ?? "Este convite não existe ou já expirou."}</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-2 rounded-full bg-[#9333EA] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#7C3AED]"
        >
          Ir para o início
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#030208] px-6">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[340px] w-[340px] rounded-full bg-[#7C3AED]/10 blur-[120px]" />
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#A855F7]/20 bg-[#A855F7]/10">
          {cloud.visibility === "private" ? <LockIcon /> : <CloudIcon />}
        </div>

        {/* Badge */}
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
            cloud.visibility === "private"
              ? "bg-[#7C3AED]/10 text-[#E9D5FF]"
              : "bg-[#2563EB]/10 text-[#93C5FD]"
          }`}
        >
          {cloud.visibility === "private" ? "Cloud Privada" : "Cloud Pública"}
        </span>

        {/* Cloud info */}
        <div className="w-full rounded-2xl border border-white/[0.08] bg-[#111116] px-6 py-5 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-white/40 mb-2">
            Você foi convidado para
          </p>
          <h1 className="text-[22px] font-bold leading-snug text-white" style={{ fontFamily: 'Arial, sans-serif' }}>{cloud.title}</h1>
          <div className="mt-3 flex items-center justify-center gap-2 text-[13px] text-white/50">
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 15" />
            </svg>
            <span>Duração: {cloud.duration}</span>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining}
          className="w-full rounded-full bg-[#9333EA] py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#9333EA]/30 transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {joining ? "Entrando..." : "Entrar na Cloud"}
        </button>

        <button
          type="button"
          onClick={() => router.replace("/")}
          className="text-[13px] text-white/40 transition hover:text-white/70"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
