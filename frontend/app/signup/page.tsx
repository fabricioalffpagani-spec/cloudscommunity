"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionUser } from "../components/session-user";

type SignupErrors = Partial<
  Record<"email" | "name" | "birthDate" | "username" | "password" | "confirmPassword" | "form", string>
>;

type FieldState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

type ApiResponse = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  available?: boolean;
  username?: string;
  email?: string;
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

type SignupDraft = {
  email: string;
  name: string;
  birthDate: string;
  username: string;
  password: string;
};

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
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

function FieldStatus({ state }: { state: FieldState }) {
  const text =
    state === "checking"
      ? "Verificando disponibilidade..."
      : state === "available"
        ? "Nome de usuario disponivel."
        : state === "taken"
          ? "Esse nome de usuario ja existe."
          : state === "invalid"
            ? "Use 3 a 20 caracteres com letras, numeros ou _."
            : state === "error"
              ? "Nao foi possivel verificar agora."
              : "Digite um nome de usuario.";

  const color =
    state === "available"
      ? "text-emerald-300"
      : state === "taken" || state === "invalid" || state === "error"
        ? "text-amber-200"
        : "text-white/35";

  return <p className={`mt-2 text-[12px] ${color}`}>{text}</p>;
}

function EmailStatus({ state }: { state: FieldState }) {
  const text =
    state === "checking"
      ? "Verificando email..."
      : state === "available"
        ? "Email disponivel."
        : state === "taken"
          ? "Esse email ja esta em uso."
          : state === "invalid"
            ? "Digite um email valido."
            : state === "error"
              ? "Nao foi possivel verificar agora."
              : "Digite um email valido.";

  const color =
    state === "available"
      ? "text-emerald-300"
      : state === "taken" || state === "invalid" || state === "error"
        ? "text-amber-200"
        : "text-white/35";

  return <p className={`mt-2 text-[12px] ${color}`}>{text}</p>;
}

function getPasswordError(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "A senha deve conter letras e numeros.";
  }

  return null;
}

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useSessionUser();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    email: "",
    name: "",
    birthDate: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailState, setEmailState] = useState<FieldState>("idle");
  const [usernameState, setUsernameState] = useState<FieldState>("idle");
  const signupDraftRef = useRef<SignupDraft | null>(null);
  const finalizeAttemptRef = useRef(false);

  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email]);
  const normalizedUsername = useMemo(
    () => form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
    [form.username],
  );

  useEffect(() => {
    setForm((current) => {
      const cleaned = current.username.toLowerCase().replace(/[^a-z0-9_]/g, "");
      return cleaned === current.username ? current : { ...current, username: cleaned };
    });
  }, [form.username]);

  useEffect(() => {
    const email = normalizedEmail;

    if (!email) {
      setEmailState("idle");
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setEmailState("invalid");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setEmailState("checking");

      try {
        const response = await fetch(`/api/auth/email-availability?email=${encodeURIComponent(email)}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as ApiResponse | null;

        if (!response.ok) {
          setEmailState("error");
          return;
        }

        setEmailState(payload?.available ? "available" : "taken");
      } catch {
        if (!controller.signal.aborted) {
          setEmailState("error");
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [normalizedEmail]);

  useEffect(() => {
    const username = normalizedUsername;

    if (!username) {
      setUsernameState("idle");
      return;
    }

    if (!USERNAME_PATTERN.test(username)) {
      setUsernameState("invalid");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setUsernameState("checking");

      try {
        const response = await fetch(`/api/auth/username-availability?username=${encodeURIComponent(username)}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as ApiResponse | null;

        if (!response.ok) {
          setUsernameState("error");
          return;
        }

        setUsernameState(payload?.available ? "available" : "taken");
      } catch {
        if (!controller.signal.aborted) {
          setUsernameState("error");
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [normalizedUsername]);

  useEffect(() => {
    if (step !== 2 || resendCountdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [step, resendCountdown]);

  useEffect(() => {
    const finalizeSignup = async () => {
      if (step !== 2 || submitting) {
        return;
      }

      if (finalizeAttemptRef.current) {
        return;
      }

      if (!verificationCode.every((digit) => digit.trim().length > 0)) {
        return;
      }

      const draft = signupDraftRef.current;
      if (!draft) {
        return;
      }

      finalizeAttemptRef.current = true;
      setSubmitting(true);
      setErrors({});

      try {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: draft.email,
            name: draft.name,
            username: draft.username,
            birthDate: draft.birthDate,
            password: draft.password,
          }),
        });

        const payload = (await response.json().catch(() => null)) as ApiResponse | null;

        if (!response.ok) {
          setErrors({
            ...(payload?.fieldErrors ?? {}),
            form: payload?.message ?? "Nao foi possivel criar a conta.",
          });
          return;
        }

        signupDraftRef.current = null;
        await refresh();
        router.replace("/");
      } finally {
        setSubmitting(false);
      }
    };

    void finalizeSignup();
  }, [router, step, submitting, verificationCode]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors || errors.form) {
      setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    }
  };

  const updateVerificationDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    finalizeAttemptRef.current = false;
    setVerificationCode((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
  };

  const handleVerificationPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

    if (!pasted) {
      return;
    }

    event.preventDefault();
    finalizeAttemptRef.current = false;
    setVerificationCode((current) => {
      const next = [...current];

      for (let index = 0; index < 6; index += 1) {
        next[index] = pasted[index] ?? current[index] ?? "";
      }

      return next;
    });
  };

  const handleResendCode = () => {
    if (resendCountdown > 0) {
      return;
    }

    setResendCountdown(60);
  };

  const canSubmit =
    form.email.trim().length > 0 &&
    form.name.trim().length > 0 &&
    form.birthDate.trim().length > 0 &&
    normalizedUsername.length > 0 &&
    USERNAME_PATTERN.test(normalizedUsername) &&
    form.password.length >= PASSWORD_MIN_LENGTH &&
    form.password === form.confirmPassword &&
    emailState === "available" &&
    usernameState !== "checking" &&
    usernameState !== "taken" &&
    usernameState !== "invalid" &&
    usernameState !== "error" &&
    !submitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) {
      const nextErrors: SignupErrors = {};

      if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
        nextErrors.email = "Digite um email valido.";
      } else if (emailState === "taken") {
        nextErrors.email = "Este email ja esta em uso.";
      } else if (emailState === "invalid") {
        nextErrors.email = "Digite um email valido.";
      } else if (emailState === "error") {
        nextErrors.email = "Nao foi possivel validar este email agora.";
      }

      if (!form.name.trim()) {
        nextErrors.name = "Informe seu nome.";
      }

      if (!form.birthDate.trim()) {
        nextErrors.birthDate = "Informe sua data de nascimento.";
      }

      if (!normalizedUsername) {
        nextErrors.username = "Informe um nome de usuario.";
      } else if (!USERNAME_PATTERN.test(normalizedUsername)) {
        nextErrors.username = "Use 3 a 20 caracteres com letras, numeros ou _.";
      } else if (usernameState === "taken") {
        nextErrors.username = "Este nome de usuario ja esta em uso.";
      } else if (usernameState === "invalid") {
        nextErrors.username = "Use 3 a 20 caracteres com letras, numeros ou _.";
      } else if (usernameState === "error") {
        nextErrors.username = "Nao foi possivel validar este nome de usuario agora.";
      }

      const passwordError = getPasswordError(form.password);
      if (passwordError) {
        nextErrors.password = passwordError;
      }

      if (form.password !== form.confirmPassword) {
        nextErrors.confirmPassword = "As senhas nao coincidem.";
      }

      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      signupDraftRef.current = {
        email: normalizedEmail,
        name: form.name.trim(),
        username: normalizedUsername,
        birthDate: form.birthDate,
        password: form.password,
      };

      finalizeAttemptRef.current = false;
      setStep(2);
      setVerificationCode(["", "", "", "", "", ""]);
      setResendCountdown(60);
      setSubmitting(false);
      setErrors({});
      return;
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <main className="mx-auto flex min-h-screen max-w-[1180px] items-center px-5 py-12 lg:px-8">
        <section className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="relative">
            <p className="text-[12px] font-bold uppercase tracking-[0.34em] text-[#FF5C3C]">{step === 1 ? "Cadastro" : "Verificacao"}</p>
            <h1 className="mt-4 max-w-[10ch] text-[56px] font-semibold leading-[0.95] tracking-[-0.04em] text-white sm:text-[72px]">
              {step === 1 ? (
                <>
                  Crie sua conta.
                  Inicie no Clouds.
                </>
              ) : (
                <>
                  Confirme
                  seu email.
                </>
              )}
            </h1>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            {step === 1 ? (
              <>
                <form onSubmit={handleSubmit} className="grid gap-4">
                  <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-[12px] uppercase tracking-[0.22em] text-white/45">
                    <span className="font-semibold text-white">1 Cadastro</span>
                    <span>2 Verificacao</span>
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="seu@email.com"
                      className={`w-full rounded-2xl border bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#A855F7] ${
                        errors.email ? "border-red-500/70" : "border-white/[0.08]"
                      }`}
                    />
                    {errors.email ? <p className="mt-2 text-[12px] text-red-300">{errors.email}</p> : <EmailStatus state={emailState} />}
                  </div>

                  <div>
                    <label htmlFor="name" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Nome
                    </label>
                    <input
                      id="name"
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      className={`w-full rounded-2xl border bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#A855F7] ${
                        errors.name ? "border-red-500/70" : "border-white/[0.08]"
                      }`}
                    />
                    {errors.name && <p className="mt-2 text-[12px] text-red-300">{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="birthDate" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Aniversario
                    </label>
                    <input
                      id="birthDate"
                      type="date"
                      value={form.birthDate}
                      onChange={(event) => updateField("birthDate", event.target.value)}
                      className={`w-full rounded-2xl border bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#A855F7] ${
                        errors.birthDate ? "border-red-500/70" : "border-white/[0.08]"
                      }`}
                    />
                    {errors.birthDate && <p className="mt-2 text-[12px] text-red-300">{errors.birthDate}</p>}
                  </div>

                  <div>
                    <label htmlFor="username" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Nome de usuario
                    </label>
                    <input
                      id="username"
                      value={form.username}
                      onChange={(event) => updateField("username", event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="seu_usuario"
                      autoComplete="username"
                      className={`w-full rounded-2xl border bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#A855F7] ${
                        errors.username || usernameState === "taken" || usernameState === "invalid" || usernameState === "error"
                          ? "border-red-500/70"
                          : usernameState === "available"
                            ? "border-emerald-500/70"
                            : "border-white/[0.08]"
                      }`}
                    />
                    {errors.username ? <p className="mt-2 text-[12px] text-red-300">{errors.username}</p> : <FieldStatus state={usernameState} />}
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(event) => updateField("password", event.target.value)}
                        autoComplete="new-password"
                        placeholder="Minimo 8 caracteres"
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
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white/45">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(event) => updateField("confirmPassword", event.target.value)}
                        autoComplete="new-password"
                        placeholder="Repita a senha"
                        className={`w-full rounded-2xl border bg-[#17171C] px-4 py-3 pr-12 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#A855F7] ${
                          errors.confirmPassword ? "border-red-500/70" : "border-white/[0.08]"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute inset-y-0 right-0 flex items-center px-4 text-white/45 transition hover:text-white"
                      >
                        <EyeIcon open={showConfirmPassword} />
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="mt-2 text-[12px] text-red-300">{errors.confirmPassword}</p>}
                  </div>

                  {errors.form && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                      {errors.form}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-[#7C3AED] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? "Criando conta..." : "Cadastrar"}
                  </button>
                </form>

                <p className="mt-5 text-center text-[13px] text-white/55">
                  Ja tem uma conta?{" "}
                  <Link href="/login" className="font-semibold text-[#A855F7] hover:underline">
                    Entrar
                  </Link>
                </p>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-5">
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-[12px] uppercase tracking-[0.22em] text-white/45">
                  <span>1 Cadastro</span>
                  <span className="font-semibold text-white">2 Verificacao</span>
                </div>

                <div className="space-y-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#FF5C3C]">Verificacao de email</p>
                  <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-white">Insira o codigo de verificacao que mandamos no seu email</h2>
                </div>

                <div className="grid gap-3">
                  <div className="grid grid-cols-6 gap-2">
                    {verificationCode.map((digit, index) => (
                      <input
                        key={`verification-digit-${index}`}
                        aria-label={`Digito ${index + 1}`}
                        inputMode="numeric"
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(event) => updateVerificationDigit(index, event.target.value)}
                        onPaste={handleVerificationPaste}
                        className="h-14 rounded-2xl border border-white/[0.08] bg-[#17171C] text-center text-[18px] font-semibold text-white outline-none transition placeholder:text-white/20 focus:border-[#A855F7]"
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[13px]">
                    <button type="button" className="text-white/55 transition hover:text-white">
                      Nao recebi o codigo
                    </button>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCountdown > 0}
                      className="font-semibold text-[#A855F7] transition hover:underline disabled:cursor-not-allowed disabled:text-white/30"
                    >
                      {resendCountdown > 0 ? `Reenviar em ${String(Math.floor(resendCountdown / 60)).padStart(2, "0")}:${String(resendCountdown % 60).padStart(2, "0")}` : "Reenviar"}
                    </button>
                  </div>
                </div>

                <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white/60">
                  {submitting ? "Finalizando seu cadastro..." : "Ao preencher os 6 digitos, o cadastro sera concluido automaticamente."}
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

