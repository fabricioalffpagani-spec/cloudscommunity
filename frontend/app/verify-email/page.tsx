"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionUser } from "../components/session-user";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useSessionUser();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Validando seu email...");

  useEffect(() => {
    const token = searchParams.get("token");
    const returnTo = searchParams.get("returnTo");
    if (!token) {
      setState("error");
      setMessage("O link de validação está incompleto.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message ?? "Este link é inválido ou expirou.");
        await refresh();
        setState("success");
        setMessage("Email validado com sucesso. Sua conta está pronta!");
        sessionStorage.setItem("clouds:show-mobile-tutorial", "1");
        const cloudReturnTo = returnTo?.startsWith("/cloud/") ? returnTo : null;
        window.setTimeout(() => router.replace(cloudReturnTo || "/onboarding"), 1200);
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Não foi possível validar seu email.");
      });
  }, [refresh, router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030208] px-5 text-white">
      <section className="w-full max-w-lg rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-[#FF5C3C]">Validação de email</p>
        <h1 className="mt-4 text-3xl font-semibold">{state === "loading" ? "Só um momento" : state === "success" ? "Tudo certo!" : "Não foi possível validar"}</h1>
        <p className="mt-4 text-white/60">{message}</p>
        {state === "error" && <Link href="/signup" className="mt-6 inline-flex rounded-full bg-[#9333EA] px-6 py-3 font-semibold">Voltar para o cadastro</Link>}
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#030208]" />}><VerifyEmailContent /></Suspense>;
}
