"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Icons ────────────────────────────────────────────────────────────────────

function HashtagIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 9l3 3-3 3" />
      <path d="M20 9l-3 3 3 3" />
      <path d="M12 4v16" />
    </svg>
  );
}

function EyeIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
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

function PaperPlaneIcon({ s = 24, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7Z" />
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

function UserIcon({ s = 16, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function FireIcon({ s = 20, className }: { s?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 1C9.5 5.5 7 8.5 7 12.5c0 5 4 9 5 9s5-4 5-9c0-2-.5-3.5-1.5-5 .3 1.5.2 2.5-.5 3.5C14.5 9 13.5 5.5 12 1Z" />
      <path d="M12 1C10 5 8 8 8 12c0 4.5 3.5 8.5 4 9-.5-1.5-1-3-1-5 0-2 .8-4 1.5-5.5C13 12.5 13 14 12.5 16c1.5-1.5 3-3.5 3-6 0-2-.5-3.5-1-5C15 6.5 15 7.5 14.5 8.5 14 5 13 2.5 12 1Z" />
      <path opacity="0.4" d="M12 7.5c.5 1.5 1 3 1 4.5 0 2.5-1 4.5-1 5-.5-1-1-2.5-1-5 0-1.5.5-3 1-4.5Z" />
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

// ─── Login Page ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao entrar.");
      }

      // demo: guarda só o email (sem sessão real)
      localStorage.setItem("cloudscommunity:remember_email", email);

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Main */}
      <main className="mx-auto max-w-[1280px] px-5 pb-32 pt-[108px] lg:px-8">
        <section className="relative">
          {/* Decorative elements */}
          <div className="absolute -top-8 -left-12 opacity-20">
            <ChatBubbleIcon s={48} className="text-[#A855F7]" />
          </div>
          <div className="absolute top-20 -right-16 opacity-15">
            <ChatBubbleIcon s={64} className="text-[#7C3AED]" />
          </div>
          <div className="absolute top-32 -left-8 opacity-20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#A855F7]/20">
              <UserIcon s={20} className="text-[#A855F7]" />
            </div>
          </div>
          <div className="absolute top-16 right-1/4 opacity-15">
            <HashtagIcon s={36} className="text-[#C084FC]" />
          </div>
          <div className="absolute top-48 -right-8 opacity-20">
            <FireIcon s={32} className="text-[#FF6A00]" />
          </div>
          <div className="absolute bottom-0 left-1/4 opacity-15">
            <CloudIcon s={40} className="text-[#A855F7]" />
          </div>
          <div className="absolute top-40 left-1/3 opacity-15">
            <EyeIcon s={28} className="text-[#C084FC]" />
          </div>
          <div className="absolute bottom-8 right-1/3 opacity-15">
            <HeartIcon s={28} className="text-[#EC4899]" />
          </div>
          <div className="absolute top-24 right-1/2 opacity-15">
            <PaperPlaneIcon s={28} className="text-[#A855F7]" />
          </div>
          <div className="absolute top-12 left-1/2 opacity-12">
            <ChatBubbleIcon s={32} className="text-[#A855F7]" />
          </div>
          <div className="absolute bottom-16 left-1/6 opacity-18">
            <HashtagIcon s={24} className="text-[#C084FC]" />
          </div>
          <div className="absolute top-56 left-1/6 opacity-14">
            <HeartIcon s={20} className="text-[#EC4899]" />
          </div>
          <div className="absolute bottom-20 right-1/6 opacity-16">
            <EyeIcon s={22} className="text-[#C084FC]" />
          </div>
          <div className="absolute top-36 right-1/6 opacity-13">
            <PaperPlaneIcon s={20} className="text-[#A855F7]" />
          </div>
          <div className="absolute bottom-32 left-1/3 opacity-15">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7C3AED]/15">
              <UserIcon s={16} className="text-[#A855F7]" />
            </div>
          </div>
          <div className="absolute top-8 left-1/5 opacity-12">
            <CloudIcon s={28} className="text-[#A855F7]" />
          </div>
          <div className="absolute bottom-4 right-1/4 opacity-14">
            <FireIcon s={24} className="text-[#FF6A00]" />
          </div>
          <div className="absolute top-44 right-1/5 opacity-11">
            <ChatBubbleIcon s={24} className="text-[#7C3AED]" />
          </div>
          <div className="absolute top-28 left-2/3 opacity-13">
            <HashtagIcon s={20} className="text-[#C084FC]" />
          </div>
          <div className="absolute bottom-12 left-2/3 opacity-16">
            <HeartIcon s={18} className="text-[#EC4899]" />
          </div>

          <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.28em] text-[#FF5C3C]">LOGIN</p>
          <h1 className="mt-3 flex flex-col text-[56px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[64px]">
            <span>Descubra</span>
            <span>conversas</span>
            <span>acontecendo</span>
            <span>agora.</span>
          </h1>

          {/* Login Form */}
          <div className="mt-12 max-w-[400px]">
            {error && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-600/10 px-4 py-3 text-[13px] text-red-300">
                {error}
              </div>
            )}
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="sr-only">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="w-full rounded-xl bg-[#1C1F2E] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-[#A855F7] transition"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">Senha</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  required
                  className="w-full rounded-xl bg-[#1C1F2E] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-[#A855F7] transition"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-[#7C3AED] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Entrando..." : "Entrar"}
              </button>
            </form>
            <p className="mt-4 text-center text-[13px] text-white/60">
              Não tem uma conta?{" "}
              <Link href="/signup" className="text-[#A855F7] hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
