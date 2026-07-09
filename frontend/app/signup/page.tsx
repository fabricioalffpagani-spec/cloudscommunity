"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Icons ────────────────────────────────────────────────────────────────────

function EyeIcon({ s = 20, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeSlashIcon({ s = 20, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A1.5 1.5 0 0 0 12 12a1.5 1.5 0 0 0 1.42-.92" />
      <path d="M9.9 4.24A17.4 17.4 0 0 1 12 4c7 0 10 8 10 8a18.6 18.6 0 0 1-3.2 4.6" />
      <path d="M6.3 6.3C3.7 8.2 2 12 2 12s3 8 10 8a17.5 17.5 0 0 0 4.08-.49" />
    </svg>
  );
}

function ChatBubbleIcon({ s = 32, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HashtagIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 9l3 3-3 3" />
      <path d="M20 9l-3 3 3 3" />
      <path d="M12 4v16" />
    </svg>
  );
}

function UserIcon({ s = 16, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function FireIcon({ s = 20, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 1C9.5 5.5 7 8.5 7 12.5c0 5 4 9 5 9s5-4 5-9c0-2-.5-3.5-1.5-5 .3 1.5.2 2.5-.5 3.5C14.5 9 13.5 5.5 12 1Z" />
    </svg>
  );
}

function HeartIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function CloudIcon({ s = 22, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 16H5.5a3.5 3.5 0 0 1 0-7 .5.5 0 0 1 .1 0A5 5 0 0 1 15 9.5a3 3 0 0 1 0 6H8" />
      <path d="M8 16 C8 17.5 7.5 18.5 6.5 19.5 C7.5 19 9 18 9.5 16" />
    </svg>
  );
}

function CheckCircleIcon({ s = 48, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-5" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "profile" | "verify" | "done";

interface ProfileForm {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  bio: string;
  birthDate: string;
  region: string;
  gender: string;
}

// ─── Input helper ─────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  maxLength,
  note,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-medium uppercase tracking-wider text-white/50">
        {label}{required && <span className="ml-1 text-[#A855F7]">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="w-full rounded-xl bg-[#1C1F2E] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#A855F7] transition"
      />
      {note && <p className="text-[11px] text-white/35">{note}</p>}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-medium uppercase tracking-wider text-white/50">
        {label}{required && <span className="ml-1 text-[#A855F7]">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl bg-[#1C1F2E] border border-white/[0.08] px-4 py-3 text-[14px] text-white outline-none focus:border-[#A855F7] transition appearance-none"
      >
        <option value="" disabled>Selecionar...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Decorative background icons ─────────────────────────────────────────────

function BgDecorations() {
  return (
    <>
      <div className="pointer-events-none absolute -top-8 -left-12 opacity-20">
        <ChatBubbleIcon s={48} className="text-[#A855F7]" />
      </div>
      <div className="pointer-events-none absolute top-20 -right-16 opacity-15">
        <ChatBubbleIcon s={64} className="text-[#7C3AED]" />
      </div>
      <div className="pointer-events-none absolute top-32 -left-8 opacity-20">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#A855F7]/20">
          <UserIcon s={20} className="text-[#A855F7]" />
        </div>
      </div>
      <div className="pointer-events-none absolute top-16 right-1/4 opacity-15">
        <HashtagIcon s={36} className="text-[#C084FC]" />
      </div>
      <div className="pointer-events-none absolute top-48 -right-8 opacity-20">
        <FireIcon s={32} className="text-[#FF6A00]" />
      </div>
      <div className="pointer-events-none absolute bottom-0 left-1/4 opacity-15">
        <CloudIcon s={40} className="text-[#A855F7]" />
      </div>
      <div className="pointer-events-none absolute top-40 left-1/3 opacity-15">
        <EyeIcon s={28} className="text-[#C084FC]" />
      </div>
      <div className="pointer-events-none absolute bottom-8 right-1/3 opacity-15">
        <HeartIcon s={28} className="text-[#EC4899]" />
      </div>
    </>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "profile", label: "Perfil" },
    { id: "verify", label: "Verificação" },
    { id: "done", label: "Concluído" },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="mb-8 flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition ${
                i < currentIdx
                  ? "bg-[#A855F7] text-white"
                  : i === currentIdx
                  ? "bg-[#7C3AED] text-white ring-2 ring-[#A855F7]/40"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {i < currentIdx ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${i <= currentIdx ? "text-white/70" : "text-white/25"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-2 mb-4 h-px w-12 transition ${i < currentIdx ? "bg-[#A855F7]" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Signup Page ─────────────────────────────────────────────────────────────

const REGIONS = [
  { value: "norte", label: "Norte" },
  { value: "nordeste", label: "Nordeste" },
  { value: "centro-oeste", label: "Centro-Oeste" },
  { value: "sudeste", label: "Sudeste" },
  { value: "sul", label: "Sul" },
  { value: "internacional", label: "Internacional" },
];

const GENDERS = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "nao-binario", label: "Não-binário" },
  { value: "prefiro-nao-dizer", label: "Prefiro não dizer" },
];

export default function SignupPage() {
  const router = useRouter();

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("profile");

  // ── Profile fields ────────────────────────────────────────────────────────
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    bio: "",
    birthDate: "",
    region: "",
    gender: "",
  });

  const setField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Verify step ───────────────────────────────────────────────────────────
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Errors / loading ──────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Validation ────────────────────────────────────────────────────────────
  const profileValid = useMemo(() => {
    if (!form.name.trim()) return false;
    if (!form.username.trim()) return false;
    if (!form.email.trim()) return false;
    if (!form.password) return false;
    if (!form.confirmPassword) return false;
    if (form.password !== form.confirmPassword) return false;
    if (!form.birthDate) return false;
    if (!form.region) return false;
    if (!form.gender) return false;
    return true;
  }, [form]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  // Step 1 → Step 2: send OTP
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/i.test(form.username)) {
      setError("Nome de usuário inválido. Use 3–20 caracteres: letras, números ou _.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        dev?: boolean;
        emailWarning?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Falha ao enviar código.");

      setEmailWarning(data?.emailWarning ?? null);
      setCodeSent(true);
      setStep("verify");
      startResendCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar código.");
    } finally {
      setSubmitting(false);
    }
  };

  function startResendCooldown() {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(t); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        emailWarning?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || "Falha ao reenviar código.");
      setEmailWarning(data?.emailWarning ?? null);
      startResendCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reenviar código.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 → Done: verify + register
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          bio: form.bio.trim(),
          birthDate: form.birthDate,
          region: form.region,
          gender: form.gender,
          code: verificationCode.trim(),
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "Falha ao criar conta.");

      setStep("done");
      // Redirect after brief celebration delay
      setTimeout(() => router.replace("/"), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar conta.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <main className="mx-auto max-w-[1280px] px-5 pb-32 pt-[80px] lg:px-8">
        <section className="relative">
          <BgDecorations />

          <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.28em] text-[#FF5C3C]">SIGN UP</p>
          <h1 className="mt-3 flex flex-col text-[48px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[56px]">
            <span>Crie</span>
            <span>sua conta.</span>
          </h1>

          <div className="mt-10 max-w-[480px]">
            <StepIndicator step={step} />

            {/* ── Error banner ── */}
            {error && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-600/10 px-4 py-3 text-[13px] text-red-300">
                {error}
              </div>
            )}

            {/* ══════════════════════════════════════════
                STEP 1 — Profile
            ══════════════════════════════════════════ */}
            {step === "profile" && (
              <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
                <p className="mb-1 text-[13px] text-white/50">
                  Preencha seus dados para criar sua conta na Clouds Community.
                </p>

                <Field
                  id="name"
                  label="Nome completo"
                  value={form.name}
                  onChange={(v) => setField("name", v)}
                  placeholder="Seu nome"
                  required
                />

                <Field
                  id="username"
                  label="Nome de usuário"
                  value={form.username}
                  onChange={(v) => setField("username", v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="@username"
                  required
                  note="3–20 caracteres: letras minúsculas, números e _"
                />

                <Field
                  id="email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setField("email", v)}
                  placeholder="seu@email.com"
                  required
                />

                {/* Password row */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="password" className="text-[12px] font-medium uppercase tracking-wider text-white/50">
                    Senha <span className="text-[#A855F7]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="w-full rounded-xl bg-[#1C1F2E] border border-white/[0.08] px-4 py-3 pr-12 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#A855F7] transition"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="confirmPassword" className="text-[12px] font-medium uppercase tracking-wider text-white/50">
                    Confirmar senha <span className="text-[#A855F7]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => setField("confirmPassword", e.target.value)}
                      placeholder="Repita a senha"
                      required
                      className={`w-full rounded-xl bg-[#1C1F2E] border px-4 py-3 pr-12 text-[14px] text-white placeholder:text-white/30 outline-none transition ${
                        form.confirmPassword && form.password !== form.confirmPassword
                          ? "border-red-500/60"
                          : "border-white/[0.08] focus:border-[#A855F7]"
                      }`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="bio" className="text-[12px] font-medium uppercase tracking-wider text-white/50">Bio</label>
                  <textarea
                    id="bio"
                    value={form.bio}
                    onChange={(e) => setField("bio", e.target.value)}
                    placeholder="Uma frase curta sobre você (opcional)"
                    maxLength={160}
                    rows={2}
                    className="w-full resize-none rounded-xl bg-[#1C1F2E] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#A855F7] transition"
                  />
                  <p className="text-right text-[11px] text-white/25">{form.bio.length}/160</p>
                </div>

                <Field
                  id="birthDate"
                  label="Data de nascimento"
                  type="date"
                  value={form.birthDate}
                  onChange={(v) => setField("birthDate", v)}
                  required
                />

                <Select
                  id="region"
                  label="Região"
                  value={form.region}
                  onChange={(v) => setField("region", v)}
                  options={REGIONS}
                  required
                />

                <Select
                  id="gender"
                  label="Gênero"
                  value={form.gender}
                  onChange={(v) => setField("gender", v)}
                  options={GENDERS}
                  required
                />

                <button
                  type="submit"
                  disabled={!profileValid || submitting}
                  className="mt-2 w-full rounded-full bg-[#7C3AED] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Enviando código..." : "Continuar — verificar email"}
                </button>

                <p className="mt-1 text-center text-[13px] text-white/50">
                  Já tem uma conta?{" "}
                  <Link href="/login" className="text-[#A855F7] hover:underline">
                    Entrar
                  </Link>
                </p>
              </form>
            )}

            {/* ══════════════════════════════════════════
                STEP 2 — Email verification
            ══════════════════════════════════════════ */}
            {step === "verify" && (
              <form onSubmit={handleVerifySubmit} className="flex flex-col gap-5">
                <div className="rounded-xl border border-white/[0.08] bg-[#1C1F2E] px-5 py-4">
                  <p className="text-[13px] text-white/70">
                    Enviamos um código de 6 dígitos para{" "}
                    <span className="font-semibold text-white">{form.email}</span>.
                    Digite-o abaixo para confirmar seu endereço de email.
                  </p>
                  {emailWarning ? (
                    <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-600/10 px-3 py-2 text-[11px] text-amber-200">
                      O e-mail não pôde ser enviado: {emailWarning}.
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-white/30">
                      Se você não receber o e-mail, verifique a caixa de spam e tente reenviar o código.
                    </p>
                  )} 

                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="code" className="text-[12px] font-medium uppercase tracking-wider text-white/50">
                    Código de verificação <span className="text-[#A855F7]">*</span>
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    className="w-full rounded-xl bg-[#1C1F2E] border border-white/[0.08] px-4 py-3 text-center text-[24px] font-mono tracking-[0.4em] text-white placeholder:text-white/20 outline-none focus:border-[#A855F7] transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={verificationCode.length !== 6 || submitting}
                  className="w-full rounded-full bg-[#7C3AED] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Verificando..." : "Confirmar e criar conta"}
                </button>

                <div className="flex items-center justify-between text-[13px]">
                  <button
                    type="button"
                    onClick={() => { setStep("profile"); setError(null); }}
                    className="text-white/50 hover:text-white transition"
                  >
                    ← Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || submitting}
                    className="text-[#A855F7] hover:underline disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
                  </button>
                </div>
              </form>
            )}

            {/* ══════════════════════════════════════════
                STEP 3 — Done
            ══════════════════════════════════════════ */}
            {step === "done" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <CheckCircleIcon s={56} className="text-[#22C55E]" />
                <h2 className="text-[22px] font-semibold text-white">Conta criada com sucesso!</h2>
                <p className="text-[14px] text-white/60">
                  Bem-vindo à Clouds Community,{" "}
                  <span className="font-semibold text-white">{form.name.split(" ")[0]}</span>!
                  Você será redirecionado em instantes…
                </p>
                <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full animate-[progress_2.2s_linear_forwards] rounded-full bg-[#A855F7]" />
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
