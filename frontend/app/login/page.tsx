"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionUser } from "../components/session-user";

type LoginErrors = Partial<Record<"identifier" | "password" | "form", string>>;

type LoginResponse = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function EyeIcon({ open }: { open: boolean }) {
  return !open ? (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A1.5 1.5 0 0 0 12 12a1.5 1.5 0 0 0 1.42-.92" />
      <path d="M9.9 4.24A17.4 17.4 0 0 1 12 4c7 0 10 8 10 8a18.6 18.6 0 0 1-3.2 4.6" />
      <path d="M6.3 6.3C3.7 8.2 2 12 2 12s3 8 10 8a17.5 17.5 0 0 0 4.08-.49" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSessionUser();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resetMessage, setResetMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
          rememberDevice,
        }),
      });

      const payload = (await response.json().catch(() => null)) as LoginResponse | null;

      if (!response.ok) {
        setErrors({
          ...(payload?.fieldErrors ?? {}),
          form: payload?.message ?? "Nao foi possivel entrar.",
        });
        return;
      }

      await refresh();
      router.replace("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !submitting;

  const openResetModal = () => {
    setResetEmail(identifier.includes("@") ? identifier : "");
    setResetState("idle");
    setResetMessage("");
    setResetOpen(true);
  };

  const requestPasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetState("sending");
    setResetMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível solicitar a redefinição.");
      setResetState("sent");
      setResetMessage(payload?.message ?? "Enviamos as instruções para o seu email.");
    } catch (error) {
      setResetState("error");
      setResetMessage(error instanceof Error ? error.message : "Não foi possível solicitar a redefinição.");
    }
  };

  return (
    <div className="min-h-screen text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <main className="mx-auto flex min-h-screen max-w-[1180px] items-center px-5 py-12 lg:px-8">
        <section className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="relative">
            <p className="text-[12px] font-bold uppercase tracking-[0.34em] text-[#FF5C3C]">Login</p>
            <h1 className="mt-4 max-w-[14ch] text-[40px] font-semibold leading-[0.95] tracking-[-0.04em] text-white sm:text-[52px]">
              Faça login no Clouds, seu streaming de conversas.
            </h1>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="identifier" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
                  E-mail ou usuário
                </label>
                <input
                  id="identifier"
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    if (errors.identifier || errors.form) {
                      setErrors((current) => ({ ...current, identifier: undefined, form: undefined }));
                    }
                  }}
                  autoComplete="username"
                  placeholder="seu@email.com ou @usuário"
                  className={`w-full rounded-2xl border bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#A855F7] ${
                    errors.identifier ? "border-red-500/70" : "border-white/[0.08]"
                  }`}
                />
                {errors.identifier && <p className="mt-2 text-[12px] text-red-300">{errors.identifier}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errors.password || errors.form) {
                        setErrors((current) => ({ ...current, password: undefined, form: undefined }));
                      }
                    }}
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    className={`w-full rounded-2xl border bg-[#17171C] px-4 py-3 pr-12 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#A855F7] ${
                      errors.password ? "border-red-500/70" : "border-white/[0.08]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex items-center px-4 text-white/45 transition hover:text-white"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {errors.password && <p className="mt-2 text-[12px] text-red-300">{errors.password}</p>}
                <button type="button" onClick={openResetModal} className="mt-2 text-[13px] font-semibold text-[#C084FC] transition hover:text-white hover:underline">
                  Esqueci minha senha
                </button>
              </div>

              <label className="-mt-1 flex cursor-pointer items-center gap-2.5 text-[13px] text-white/65">
                <input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} className="h-4 w-4 accent-[#A855F7]" />
                Lembrar deste dispositivo por 30 dias
              </label>

              {errors.form && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                  {errors.form}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-[#9333EA] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className="mt-5 text-center text-[13px] text-white/55">
              Nao tem uma conta?{" "}
              <Link href="/signup" className="font-semibold text-[#A855F7] hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </section>
      </main>

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" onClick={() => setResetOpen(false)}>
          <section className="w-full max-w-md rounded-[28px] border border-white/[0.1] bg-[#1a0e3d] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#C084FC]">Redefinir senha</p>
                <h2 className="mt-2 text-xl font-semibold">Vamos enviar um link para você</h2>
              </div>
              <button type="button" onClick={() => setResetOpen(false)} className="text-xl text-white/50 hover:text-white" aria-label="Fechar">×</button>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-white/65">Informe o email usado no login. A plataforma enviará um link seguro para redefinir sua senha.</p>
            {resetState === "sent" ? (
              <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-[13px] text-emerald-100">{resetMessage}</div>
            ) : (
              <form onSubmit={requestPasswordReset} className="mt-5 space-y-4">
                <input type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} autoComplete="email" placeholder="seu@email.com" required className="w-full rounded-2xl border border-white/[0.1] bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none focus:border-[#A855F7]" />
                {resetState === "error" && <p className="text-[13px] text-red-300">{resetMessage}</p>}
                <button type="submit" disabled={resetState === "sending"} className="inline-flex w-full justify-center rounded-full bg-[#9333EA] px-5 py-3 text-[14px] font-semibold transition hover:bg-[#6D28D9] disabled:opacity-50">{resetState === "sending" ? "Enviando..." : "Enviar link de redefinição"}</button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

