"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionUser } from "../components/session-user";

const TOPICS = [
  { id: "musica", label: "Música", icon: "🎵" },
  { id: "filmes_series", label: "Filmes & Séries", icon: "🎬" },
  { id: "games", label: "Games", icon: "🎮" },
  { id: "esportes", label: "Esportes", icon: "⚽" },
  { id: "tecnologia", label: "Tecnologia", icon: "💻" },
  { id: "relacionamentos", label: "Relacionamentos", icon: "💬" },
  { id: "humor_internet", label: "Humor & Internet", icon: "😂" },
  { id: "livros_cultura", label: "Livros & Cultura", icon: "📚" },
  { id: "atualidades", label: "Atualidades", icon: "🌎" },
  { id: "politica_sociedade", label: "Política & Sociedade", icon: "🏛️" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, status, refresh } = useSessionUser();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated" && !user?.interestsOnboardingRequired) router.replace("/?welcome=1");
  }, [router, status, user?.interestsOnboardingRequired]);

  const toggle = (id: string) => {
    setError("");
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const continueToClouds = async () => {
    if (selected.length < 3) {
      setError("Escolha pelo menos 3 temas para continuar.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível salvar seus temas.");
      await refresh();
      router.replace("/?welcome=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar seus temas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030208] px-5 py-10 text-white" style={{ background: "radial-gradient(ellipse at 50% 15%, rgba(91,33,182,.48), transparent 55%), #030208" }}>
      <section className="w-full max-w-3xl rounded-[32px] border border-white/[.1] bg-[#12101d]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,.5)] sm:p-10">
        <p className="text-center text-[12px] font-bold uppercase tracking-[.28em] text-[#c084fc]">Personalize o Clouds</p>
        <p className="mt-5 text-center text-lg font-semibold text-white/90">Bem-vindo(a) ao Clouds!</p>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-[-.035em] sm:text-4xl">O que está em sua mente?</h1>
        <p className="mt-3 text-center text-white/60">Escolha quantos temas quiser. Precisamos de pelo menos 3 para recomendar as melhores Clouds para você.</p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOPICS.map((topic) => {
            const active = selected.includes(topic.id);
            return <button key={topic.id} type="button" aria-pressed={active} onClick={() => toggle(topic.id)} className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition ${active ? "border-[#b44dff] bg-[#7025b4]/35 shadow-[0_0_0_1px_rgba(180,77,255,.25)]" : "border-white/[.1] bg-white/[.03] hover:border-white/[.25]"}`}><span className="text-2xl" aria-hidden="true">{topic.icon}</span><span className="flex-1 font-semibold">{topic.label}</span><span className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${active ? "border-[#d8a9ff] bg-[#a855f7]" : "border-white/30"}`}>{active ? "✓" : ""}</span></button>;
          })}
        </div>
        <div className="mt-7 flex flex-col items-center gap-3">
          <span className={`text-sm ${selected.length >= 3 ? "text-[#d8a9ff]" : "text-white/45"}`}>{selected.length} de 3 temas selecionados</span>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="button" disabled={saving || selected.length < 3} onClick={() => void continueToClouds()} className="rounded-full bg-[#a855f7] px-9 py-3 font-bold text-white transition hover:bg-[#c084fc] disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Salvando..." : "Continuar"}</button>
        </div>
      </section>
    </main>
  );
}
