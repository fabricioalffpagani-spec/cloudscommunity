"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSessionUser } from "./session-user";

const STORAGE_KEY = "clouds:mobile-navigation-tutorial";

export function MobileNavigationTutorial() {
  const { user } = useSessionUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user || pathname !== "/" || typeof window === "undefined") return;

    const wasJustCreated = searchParams.get("welcome") === "1" || sessionStorage.getItem("clouds:show-mobile-tutorial") === "1";
    const hasSeen = localStorage.getItem(`${STORAGE_KEY}:${user.id}`) === "1";
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (isMobile && (wasJustCreated || !hasSeen)) {
      setStep(0);
      setOpen(true);
      sessionStorage.removeItem("clouds:show-mobile-tutorial");
    }
  }, [pathname, searchParams, user]);

  const close = () => {
    if (user) localStorage.setItem(`${STORAGE_KEY}:${user.id}`, "1");
    setOpen(false);
  };

  if (!open) return null;

  const steps = [
    { icon: "☁", title: "Talk: Clouds ao vivo", description: "Na aba Talk, role verticalmente para descobrir conversas acontecendo agora." },
    { icon: "☝", title: "Entre na conversa", description: "Toque uma vez no título para ver detalhes. Toque duas vezes para entrar na Cloud e participar do chat." },
    { icon: "+", title: "Crie sua própria Cloud", description: "Use o botão central da barra inferior para começar uma conversa com a sua comunidade." },
    { icon: "▤", title: "Read: converse no seu ritmo", description: "Na aba Read, veja Clouds encerradas e leia a conversa completa quando quiser." },
    { icon: "⌁", title: "Meet: descubra pessoas", description: "Na aba Meet, encontre perfis, siga pessoas e amplie sua comunidade." },
    { icon: "✉", title: "Mensagens e Em alta", description: "Use Mensagens para conversas privadas. Em alta mostra os assuntos e Clouds que estão ganhando destaque." },
    { icon: "◌", title: "Seu Perfil e notificações", description: "No Perfil, edite suas informações, acompanhe suas Clouds e toque no sino para ver novas mensagens, seguidores e avisos." },
  ];
  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[300] flex items-center bg-[#080315]/85 p-5 backdrop-blur-md">
      <section className="relative mx-auto w-full max-w-md overflow-hidden rounded-[32px] border border-[#8B5CF6]/50 bg-[radial-gradient(circle_at_0_0,rgba(109,40,217,.25),transparent_34%),linear-gradient(145deg,#090912,#111027)] p-6 pb-7 shadow-[0_0_70px_rgba(109,40,217,.38)]">
        <button type="button" onClick={close} aria-label="Fechar tutorial" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/[.08] text-3xl font-light text-white/85">×</button>
        <p className="pr-10 text-[13px] font-bold uppercase tracking-[0.18em] text-[#C084FC]">Passo {step + 1} de {steps.length}</p>
        <div key={currentStep.title} className="mt-8 min-h-64 animate-[pulse_180ms_ease-out] text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] bg-[#2D126C]/70 text-5xl font-light text-[#D8B4FE] shadow-[0_0_35px_rgba(168,85,247,.42)]" aria-hidden="true">{currentStep.icon}</div>
          <h1 className="mt-7 text-[30px] font-extrabold leading-tight text-white">{currentStep.title}</h1>
          <p className="mx-auto mt-4 max-w-sm text-[17px] leading-relaxed text-[#B7B5DC]">{currentStep.description}</p>
        </div>
        <div className="mt-6 flex justify-center gap-2" aria-label={`Passo ${step + 1} de ${steps.length}`}>{steps.map((item, index) => <span key={item.title} className={`h-2 rounded-full transition-all ${index === step ? "w-7 bg-[#B44DFF]" : "w-2 bg-white/20"}`} />)}</div>
        <div className="mt-7 flex items-center gap-3">
          {step > 0 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="rounded-full px-5 py-3 text-[15px] font-bold text-white/65 transition hover:text-white">Voltar</button> : <button type="button" onClick={close} className="rounded-full px-3 py-3 text-[15px] font-bold text-white/65 transition hover:text-white">Pular tutorial</button>}
          <button type="button" onClick={() => isLastStep ? close() : setStep((current) => current + 1)} className="ml-auto rounded-full bg-gradient-to-r from-[#6935FF] to-[#9B36FF] px-7 py-3.5 text-[16px] font-bold text-white shadow-[0_12px_35px_rgba(112,47,255,.38)]">{isLastStep ? "Começar" : "Próximo"}</button>
        </div>
      </section>
    </div>
  );
}
