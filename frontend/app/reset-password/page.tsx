"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.58 10.58A1.5 1.5 0 0 0 12 12a1.5 1.5 0 0 0 1.42-.92" /><path d="M9.9 4.24A17.4 17.4 0 0 1 12 4c7 0 10 8 10 8a18.6 18.6 0 0 1-3.2 4.6" /><path d="M6.3 6.3C3.7 8.2 2 12 2 12s3 8 10 8a17.5 17.5 0 0 0 4.08-.49" /></svg>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const token = searchParams.get("token") ?? "";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmation) {
      setState("error");
      setMessage("As senhas não coincidem.");
      return;
    }
    setState("submitting");
    try {
      const response = await fetch("/api/auth/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível redefinir a senha.");
      setState("success");
      setMessage(payload?.message ?? "Senha redefinida com sucesso.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível redefinir a senha.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030208] px-5 text-white" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <section className="w-full max-w-md rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <p className="text-[12px] font-bold uppercase tracking-[0.25em] text-[#C084FC]">Clouds</p>
        <h1 className="mt-3 text-3xl font-semibold">Crie uma nova senha</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">Use no mínimo 8 caracteres, incluindo letras, números e um caractere especial.</p>
        {!token ? <p className="mt-6 rounded-2xl bg-red-500/10 p-4 text-[14px] text-red-200">O link de redefinição está incompleto.</p> : state === "success" ? <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-[14px] text-emerald-100"><p>{message}</p><Link href="/login" className="mt-4 inline-flex font-semibold text-white underline">Ir para o login</Link></div> : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="relative"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="Nova senha" required className="w-full rounded-2xl border border-white/[0.1] bg-[#17171C] px-4 py-3 pr-12 text-white outline-none focus:border-[#A855F7]" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar nova senha" : "Mostrar nova senha"} className="absolute inset-y-0 right-0 flex items-center px-4 text-white/45 transition hover:text-white"><EyeIcon open={showPassword} /></button></div>
            <div className="relative"><input type={showConfirmation ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} autoComplete="new-password" placeholder="Confirme a nova senha" required className="w-full rounded-2xl border border-white/[0.1] bg-[#17171C] px-4 py-3 pr-12 text-white outline-none focus:border-[#A855F7]" /><button type="button" onClick={() => setShowConfirmation((current) => !current)} aria-label={showConfirmation ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"} className="absolute inset-y-0 right-0 flex items-center px-4 text-white/45 transition hover:text-white"><EyeIcon open={showConfirmation} /></button></div>
            {state === "error" && <p className="text-[13px] text-red-300">{message}</p>}
            <button type="submit" disabled={state === "submitting"} className="inline-flex w-full justify-center rounded-full bg-[#9333EA] px-5 py-3 font-semibold transition hover:bg-[#6D28D9] disabled:opacity-50">{state === "submitting" ? "Redefinindo..." : "Confirmar nova senha"}</button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#030208]" />}><ResetPasswordForm /></Suspense>;
}
