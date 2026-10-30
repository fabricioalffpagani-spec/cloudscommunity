"use client";

import { BirthDateInput } from "../components/BirthDateInput";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type SignupErrors = Partial<
  Record<"email" | "name" | "birthDate" | "username" | "password" | "confirmPassword" | "terms" | "form" | "invitationCode", string>
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

const USERNAME_PATTERN = /^[a-z0-9_]{4,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

type SignupDraft = {
  email: string;
  name: string;
  birthDate: string;
  location: string;
  username: string;
  password: string;
  acceptedTerms: boolean;
  acceptedCommunityRules: boolean;
  invitationCode: string;
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

function FieldStatus({ state }: { state: FieldState }) {
  const text =
    state === "checking"
      ? "Verificando disponibilidade..."
      : state === "available"
        ? "Nome de usuário disponível."
        : state === "taken"
          ? "Esse nome de usuário já existe."
          : state === "invalid"
            ? "Use 4 a 15 caracteres com letras, números ou _."
            : state === "error"
              ? "Não foi possível verificar agora."
              : "Digite um nome de usuário.";

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
          ? "Esse e-mail já está em uso."
          : state === "invalid"
            ? "Digite um email valido."
            : state === "error"
              ? "Não foi possível verificar agora."
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

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z\s0-9]/.test(password)) {
    return "A senha deve conter letras, números e um caractere especial.";
  }

  return null;
}

function getAge(birthDate: string) {
  const [year, month, day] = birthDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;

  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    age -= 1;
  }

  return age;
}

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fromInteraction, setFromInteraction] = useState(false);
  const [returnTo, setReturnTo] = useState("/");
  const [form, setForm] = useState({
    email: "",
    name: "",
    birthDate: "",
    location: "",
    username: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
    acceptedCommunityRules: false,
    invitationCode: "",
  });
  const [invitationLocked, setInvitationLocked] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [resendMessage, setResendMessage] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [emailState, setEmailState] = useState<FieldState>("idle");
  const [usernameState, setUsernameState] = useState<FieldState>("idle");
  const signupDraftRef = useRef<SignupDraft | null>(null);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) { setForm((current) => ({ ...current, invitationCode: ref.toUpperCase() })); setInvitationLocked(true); }
    const params = new URLSearchParams(window.location.search);
    setFromInteraction(params.get("from") === "interaction");
    const requested = params.get("returnTo") || "/";
    setReturnTo(requested.startsWith("/") && !requested.startsWith("//") ? requested : "/");
  }, []);

  const normalizedEmail = useMemo(() => form.email.trim().toLowerCase(), [form.email]);
  const normalizedUsername = useMemo(
    () => form.username.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, ""),
    [form.username],
  );

  useEffect(() => {
    setForm((current) => {
      const cleaned = current.username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
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
    if (step !== 3 || resendCountdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [step, resendCountdown]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors || errors.form) {
      setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
    }
  };

  const useDeviceLocation = () => {
    if (locating) return;
    if (!("geolocation" in navigator)) {
      setLocationMessage("A localização não está disponível neste dispositivo. Informe sua região manualmente.");
      return;
    }

    setLocating(true);
    setLocationMessage("Solicitando acesso à sua localização...");
    navigator.geolocation.getCurrentPosition(
      () => {
        updateField("location", "Brasil, Xanxerê");
        setLocationMessage("Localização adicionada: Brasil, Xanxerê.");
        setLocating(false);
      },
      () => {
        setLocationMessage("Não foi possível acessar sua localização. Você pode informar sua região manualmente.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const handleResendEmail = async () => {
    const draft = signupDraftRef.current;
    if (!draft || resendCountdown > 0 || submitting) return;
    setSubmitting(true);
    setResendMessage("");
    try {
      const response = await fetch("/api/auth/email-verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: draft.email }),
      });
      const payload = await response.json().catch(() => null) as ApiResponse & { retryAfterSeconds?: number } | null;
      if (!response.ok) {
        setResendMessage(payload?.message ?? "Não foi possível reenviar o email.");
        return;
      }
      setResendCountdown(payload?.retryAfterSeconds ?? 60);
      setResendMessage(payload?.message ?? "Novo email enviado.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    form.email.trim().length > 0 &&
    form.name.trim().length > 0 &&
    form.birthDate.trim().length > 0 &&
    getAge(form.birthDate) >= 16 && getAge(form.birthDate) <= 100 &&
    normalizedUsername.length > 0 &&
    USERNAME_PATTERN.test(normalizedUsername) &&
    !getPasswordError(form.password) &&
    form.password === form.confirmPassword &&
    form.acceptedTerms && form.acceptedCommunityRules &&
    emailState === "available" &&
    usernameState !== "checking" &&
    usernameState !== "taken" &&
    usernameState !== "invalid" &&
    usernameState !== "error" &&
    !submitting;

  const passwordValidationError = form.password ? getPasswordError(form.password) : null;
  const passwordMessage = errors.password ?? passwordValidationError;
  const confirmPasswordMessage = errors.confirmPassword ?? (form.confirmPassword && form.password !== form.confirmPassword ? "As senhas não coincidem." : null);
  const birthDateMessage = errors.birthDate ?? (form.birthDate && getAge(form.birthDate) < 16 ? "Você não tem idade suficiente para se cadastrar. O Clouds é destinado a pessoas com 16 anos ou mais." : form.birthDate && getAge(form.birthDate) > 100 ? "A idade máxima permitida é de 100 anos." : null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 1) {
      const nextErrors: SignupErrors = {};

      if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
        nextErrors.email = "Digite um email valido.";
      } else if (emailState === "taken") {
        nextErrors.email = "Este e-mail já está em uso.";
      } else if (emailState === "invalid") {
        nextErrors.email = "Digite um email valido.";
      } else if (emailState === "error") {
        nextErrors.email = "Não foi possível validar este e-mail agora.";
      }

      if (!normalizedUsername) {
        nextErrors.username = "Informe um nome de usuário.";
      } else if (!USERNAME_PATTERN.test(normalizedUsername)) {
        nextErrors.username = "Use 4 a 15 caracteres com letras, números ou _.";
      } else if (usernameState === "taken") {
        nextErrors.username = "Este nome de usuário já está em uso.";
      } else if (usernameState === "invalid") {
        nextErrors.username = "Use 4 a 15 caracteres com letras, números ou _.";
      } else if (usernameState === "error") {
        nextErrors.username = "Não foi possível validar este nome de usuário agora.";
      }

      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      setStep(3);
      return;
    }

    if (step === 2) {
      const nextErrors: SignupErrors = {};
      if (!form.name.trim()) nextErrors.name = "Informe seu nome.";
      if (!form.birthDate.trim() || getAge(form.birthDate) < 16 || getAge(form.birthDate) > 100) nextErrors.birthDate = "Informe uma data de nascimento válida.";
      const passwordError = getPasswordError(form.password);
      if (passwordError) nextErrors.password = passwordError;
      if (form.password !== form.confirmPassword) nextErrors.confirmPassword = "As senhas não coincidem.";
      if (!form.acceptedTerms || !form.acceptedCommunityRules) nextErrors.terms = "Aceite os Termos de Uso e as Regras da Comunidade para continuar.";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      const draft = {
        email: normalizedEmail,
        name: form.name.trim(),
        username: normalizedUsername,
        birthDate: form.birthDate,
        location: form.location.trim(),
        password: form.password,
        acceptedTerms: form.acceptedTerms,
        acceptedCommunityRules: form.acceptedCommunityRules,
        invitationCode: form.invitationCode.trim().toUpperCase(),
      };

      signupDraftRef.current = draft;
      setSubmitting(true);
      setErrors({});
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, returnTo }),
      });
      const payload = await response.json().catch(() => null) as ApiResponse | null;
      if (!response.ok) {
        setErrors({ ...(payload?.fieldErrors ?? {}), form: payload?.message ?? "Não foi possível criar a conta." });
        setSubmitting(false);
        return;
      }
      setStep(2);
      window.dispatchEvent(new CustomEvent("clouds:signup-complete", { detail: { username: normalizedUsername } }));
      setResendCountdown(60);
      setResendMessage("");
      setSubmitting(false);
      setErrors({});
      return;
    }
  };
  return (
    <div className="min-h-screen text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      <main className="mx-auto flex min-h-screen max-w-[1180px] items-center px-5 py-12 lg:px-8">
        <section className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="relative">
            <p className="text-[12px] font-bold uppercase tracking-[0.34em] text-[#FF5C3C]">{step === 1 ? "Cadastro · etapa 1 de 2" : step === 2 ? "Cadastro · etapa 2 de 2" : "Verificação"}</p>
            <h1 className="mt-4 max-w-[20ch] text-[40px] font-semibold leading-[0.95] tracking-[-0.04em] text-white sm:text-[52px]">
              {step === 1 ? (
                <>
                  Escolha seu e-mail e nickname no Clouds.
                </>
              ) : step === 2 ? (
                <>
                  Quase lá! Complete seu cadastro. ☁️
                </>
              ) : <>Confira seu e-mail. ☁️</>}
            </h1>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            {step === 1 || step === 2 ? (
              <>
                <form onSubmit={handleSubmit} className="grid gap-4">
                  <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-[12px] uppercase tracking-[0.22em] text-white/45">
                    <span className="font-semibold text-white">1 Cadastro</span>
                    <span>2 Verificação</span>
                  </div>

                  <div className={step === 2 ? "hidden" : ""}>
                    <label htmlFor="email" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
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

                  <div className={step === 2 ? "hidden" : ""}>
                    <label htmlFor="name" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
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

                  <div className={step === 1 ? "hidden" : ""}>
                    <label htmlFor="birthDate" className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-[#D8B4FE]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M8.5 5.5l1 1M15.5 5.5l-1 1"/><path d="M7 9h10v3H7zM5 12h14v7H5z"/></svg>Aniversário
                    </label>
                    <BirthDateInput id="birthDate" value={form.birthDate} onChange={(value) => updateField("birthDate", value)} invalid={Boolean(birthDateMessage)} />
                    {birthDateMessage && <p className="mt-2 text-[12px] text-red-300">{birthDateMessage}</p>}
                  </div>

                  <div className={step === 1 ? "hidden" : ""}>
                    <label htmlFor="invitationCode" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">Código de convite <span className="normal-case tracking-normal text-white/45">(opcional)</span></label>
                    <input id="invitationCode" value={form.invitationCode} readOnly={invitationLocked} maxLength={7} onChange={(event) => updateField("invitationCode", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="Código de quem convidou você" className="w-full rounded-2xl border border-white/[0.08] bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none focus:border-[#A855F7]" />
                    {errors.invitationCode && <p className="mt-2 text-[12px] text-red-300">{errors.invitationCode}</p>}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="location" className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
                        Região
                      </label>
                      <button
                        type="button"
                        onClick={useDeviceLocation}
                        disabled={locating}
                        className="text-[12px] font-semibold text-[#C084FC] transition hover:text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        {locating ? "Localizando..." : "Usar minha localização"}
                      </button>
                    </div>
                    <input
                      id="location"
                      value={form.location}
                      onFocus={useDeviceLocation}
                      onChange={(event) => updateField("location", event.target.value)}
                      placeholder="Brasil, Xanxerê"
                      autoComplete="address-level2"
                      className="w-full rounded-2xl border border-white/[0.08] bg-[#17171C] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#A855F7]"
                    />
                    <p aria-live="polite" className="mt-2 text-[12px] text-white/45">{locationMessage || "Toque no campo para usar a localização do dispositivo ou informe manualmente."}</p>
                  </div>

                  <div className={step === 1 ? "hidden" : ""}>
                    <label htmlFor="username" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
                      Nome de usuário
                    </label>
                    <input
                      id="username"
                      value={form.username}
                      maxLength={15}
                      onChange={(event) => updateField("username", event.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, ""))}
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

                  <div className={step === 1 ? "hidden" : ""}>
                    <label htmlFor="password" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
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
                          passwordMessage ? "border-red-500/70" : "border-white/[0.08]"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute inset-y-0 right-0 z-10 flex min-h-[48px] min-w-[48px] items-center justify-center px-3 text-white/65 transition hover:text-white active:text-white"
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>
                    {passwordMessage ? <p className="mt-2 text-[12px] text-red-300">{passwordMessage}</p> : <p className="mt-2 text-[12px] text-white/45">Mínimo de 8 caracteres, com letras, números e caractere especial.</p>}
                  </div>

                  <div className={step === 1 ? "hidden" : ""}>
                    <label htmlFor="confirmPassword" className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
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
                          confirmPasswordMessage ? "border-red-500/70" : "border-white/[0.08]"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute inset-y-0 right-0 z-10 flex min-h-[48px] min-w-[48px] items-center justify-center px-3 text-white/65 transition hover:text-white active:text-white"
                      >
                        <EyeIcon open={showConfirmPassword} />
                      </button>
                    </div>
                    {confirmPasswordMessage && <p className="mt-2 text-[12px] text-red-300">{confirmPasswordMessage}</p>}
                  </div>

                  <div className={`${step === 1 ? "hidden " : ""}rounded-2xl border p-4 text-[12px] leading-relaxed ${errors.terms ? "border-red-500/70 bg-red-500/5" : "border-white/[0.08] bg-white/[0.03]"}`}>
                    <label className="flex cursor-pointer items-start gap-3 text-white/70"><input type="checkbox" checked={form.acceptedTerms && form.acceptedCommunityRules} onChange={(event) => { const accepted = event.target.checked; setForm((current) => ({ ...current, acceptedTerms: accepted, acceptedCommunityRules: accepted })); setErrors((current) => ({ ...current, terms: undefined, form: undefined })); }} className="mt-0.5 h-4 w-4 accent-[#A855F7]" /><span>Li e aceito o <a href="/legal/documentos-da-plataforma.pdf" target="_blank" rel="noreferrer" className="font-semibold text-[#C084FC] hover:underline">Documento completo da plataforma (PDF)</a>, que reúne os Termos de Uso, as Regras da Comunidade e todas as políticas.</span></label>
                    {errors.terms && <p className="mt-3 text-red-300">{errors.terms}</p>}
                  </div>

                  {errors.form && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                      {errors.form}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={step === 1 ? !(emailState === "available" && usernameState === "available") : !canSubmit}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-[#9333EA] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? "Criando conta..." : step === 1 ? "Continuar" : "Cadastrar"}
                  </button>
                </form>

                <p className="mt-5 text-center text-[13px] text-white/55">
                  Ja tem uma conta?{" "}
                  <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-[#A855F7] hover:underline">
                    Entrar
                  </Link>
                </p>
              </>
            ) : (
              <div className="grid gap-5">
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-[12px] uppercase tracking-[0.22em] text-white/45">
                  <span>1 Cadastro</span>
                  <span className="font-semibold text-white">2 Verificação</span>
                </div>

                <div className="space-y-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-[#FF5C3C]">Verificação de email</p>
                  <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-white">Enviamos um link de confirmação para o seu e-mail</h2>
                </div>

                <div className="grid gap-4">
                  <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-[14px] leading-6 text-white/65">
                    Acesse sua caixa de entrada e clique no link para validar seu endereço de e-mail. Não encontrou? Verifique também a pasta de <strong className="font-semibold text-white">spam ou lixo eletrônico</strong>.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-[13px]">
                    <button
                      type="button"
                      onClick={handleResendEmail}
                      disabled={resendCountdown > 0}
                      className="font-semibold text-[#A855F7] transition hover:underline disabled:cursor-not-allowed disabled:text-white/30"
                    >
                      Reenviar email
                    </button>
                    {resendCountdown > 0 && <span className="text-white/45">disponível em {String(Math.floor(resendCountdown / 60)).padStart(2, "0")}:{String(resendCountdown % 60).padStart(2, "0")}</span>}
                  </div>
                  {resendMessage && <p className="text-[13px] text-white/60">{resendMessage}</p>}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      {step === 1 && !fromInteraction && <div className="fixed inset-x-0 bottom-12 z-10 text-center"><Link href="/" className="text-sm font-semibold text-[#D8B4FE] underline underline-offset-4">Continuar sem conta</Link></div>}
      <div className="fixed inset-x-0 bottom-0 z-10 h-2 bg-white/10" role="progressbar" aria-label="Progresso do cadastro" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step}><div className="h-full bg-[#A855F7] transition-all" style={{ width: `${step * 50}%` }} /></div>
    </div>
  );
}

