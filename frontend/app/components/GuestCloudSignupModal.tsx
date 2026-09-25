"use client";

import { useState } from "react";

type Props = { cloudTitle: string; returnTo: string; onClose: () => void };

function ageFrom(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const now = new Date();
  return now.getFullYear() - year - (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0);
}

export function GuestCloudSignupModal({ cloudTitle, returnTo, onClose }: Props) {
  const [form, setForm] = useState({ email: "", name: "", username: "", birthDate: "", password: "", confirmPassword: "", accepted: false });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (ageFrom(form.birthDate) < 16) return setError("Você precisa ter pelo menos 16 anos para participar.");
    if (form.password !== form.confirmPassword) return setError("As senhas não coincidem.");
    if (!form.accepted) return setError("Aceite o Documento completo da plataforma para continuar.");
    setSending(true);
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email, name: form.name, username: form.username, birthDate: form.birthDate, password: form.password, acceptedTerms: true, acceptedCommunityRules: true, returnTo }) });
      const payload = await response.json().catch(() => null) as { message?: string; fieldErrors?: Record<string, string> } | null;
      if (!response.ok) throw new Error(payload?.fieldErrors?.email || payload?.fieldErrors?.username || payload?.fieldErrors?.password || payload?.fieldErrors?.birthDate || payload?.message || "Não foi possível concluir o cadastro.");
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir o cadastro.");
    } finally { setSending(false); }
  };

  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#15161C] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-[19px] font-bold text-white">Participe da conversa</h2><p className="mt-1 text-[13px] text-white/55">Crie sua conta para falar em “{cloudTitle}”.</p></div><button type="button" onClick={onClose} className="text-xl text-white/45 hover:text-white" aria-label="Fechar">×</button></div>
      {sent ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-[14px] leading-relaxed text-emerald-100">Enviamos um e-mail de confirmação. Valide seu e-mail para participar da cloud.</div> : <form onSubmit={submit} className="space-y-3">
        <input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="E-mail" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none focus:border-[#A855F7]" />
        <input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Nome" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none focus:border-[#A855F7]" />
        <input required minLength={4} maxLength={15} value={form.username} onChange={(event) => update("username", event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="Nome de usuário" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none focus:border-[#A855F7]" />
        <label className="block text-[12px] text-white/55">Aniversário<input required type="date" value={form.birthDate} onChange={(event) => update("birthDate", event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none focus:border-[#A855F7]" /></label>
        <input required type="password" minLength={8} value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="Defina uma senha" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none focus:border-[#A855F7]" />
        <input required type="password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} placeholder="Confirme sua senha" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none focus:border-[#A855F7]" />
        <label className="flex gap-2 text-[11px] leading-relaxed text-white/60"><input type="checkbox" checked={form.accepted} onChange={(event) => update("accepted", event.target.checked)} className="mt-0.5 accent-[#A855F7]" /><span>Li e aceito o <a href="/legal/documentos-da-plataforma.pdf" target="_blank" rel="noreferrer" className="text-[#D8B4FE] underline">Documento completo da plataforma (PDF)</a>, que reúne todos os termos, regras e políticas.</span></label>
        {error && <p className="text-[12px] text-red-300">{error}</p>}
        <button disabled={sending} className="w-full rounded-full bg-[#9333EA] py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-50">{sending ? "Enviando..." : "Criar conta e receber confirmação"}</button>
      </form>}
    </div>
  </div>;
}
