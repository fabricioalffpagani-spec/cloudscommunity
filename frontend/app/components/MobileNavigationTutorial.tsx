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

  useEffect(() => {
    if (!user || pathname !== "/" || typeof window === "undefined") return;

    const wasJustCreated = searchParams.get("welcome") === "1" || sessionStorage.getItem("clouds:show-mobile-tutorial") === "1";
    const hasSeen = localStorage.getItem(`${STORAGE_KEY}:${user.id}`) === "1";
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (isMobile && (wasJustCreated || !hasSeen)) {
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
    ["↑", "Role para ver mais tópicos", "Use a rolagem vertical para explorar novas Clouds."],
    ["←", "Deslize para a esquerda", "Arraste o título da Cloud para entrar e participar da conversa."],
    ["◉", "Toque no título", "Veja a descrição, informações ou denuncie uma Cloud."],
  ];

  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-[#080315]/85 p-4 py-7 backdrop-blur-md">
      <section className="relative mx-auto w-full max-w-md rounded-[32px] border border-[#8B5CF6]/50 bg-[radial-gradient(circle_at_0_0,rgba(109,40,217,.25),transparent_34%),linear-gradient(145deg,#090912,#111027)] p-6 pb-7 shadow-[0_0_70px_rgba(109,40,217,.38)]">
        <button type="button" onClick={close} aria-label="Fechar tutorial" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/[.08] text-3xl font-light text-white/85">×</button>
        <div className="mx-auto flex h-16 w-20 items-center justify-center text-5xl text-white" aria-hidden="true">☁</div>
        <h1 className="mt-3 text-center text-[36px] font-extrabold leading-none text-white">Bem-vindo ao Clouds!</h1>
        <p className="mt-3 text-center text-[20px] leading-snug text-[#B7B5DC]">Conversas em tempo real,<br />do seu jeito.</p>
        <div className="mt-6 space-y-3">
          {steps.map(([gesture, title, description], index) => (
            <div key={title} className="flex min-h-28 items-center gap-4 rounded-[24px] border border-white/[.09] bg-black/25 p-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#2D126C]/70 text-[42px] font-light text-[#B844FF] shadow-[0_0_26px_rgba(168,85,247,.42)]">{gesture}</div>
              <div>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#392081] px-2 text-sm font-bold text-white">{index + 1}</span>
                <h2 className="mt-1 text-[20px] font-bold leading-tight text-white">{title}</h2>
                <p className="mt-1 text-[15px] leading-snug text-[#AAA7CD]">{description}</p>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={close} className="mt-7 w-full rounded-full bg-gradient-to-r from-[#6935FF] to-[#9B36FF] py-4 text-[21px] font-bold text-white shadow-[0_12px_35px_rgba(112,47,255,.38)]">Entendi</button>
      </section>
    </div>
  );
}
