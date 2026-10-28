"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSessionUser } from "./session-user";

export function MobileNavigationTutorial() {
  const { user } = useSessionUser();
  const pathname = usePathname();
  const [open, setOpen] = useState<"talk" | "read" | null>(null);
  const [mobile, setMobile] = useState(true);
  const seenInMemory = useRef(new Set<string>());

  useEffect(() => {
    setOpen(null);
    if (!user || user.interestsOnboardingRequired || (pathname !== "/" && pathname !== "/read")) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    setMobile(isMobile);
    const key = pathname === "/" ? `clouds:${isMobile ? "mobile" : "desktop"}-navigation-tutorial:${user.id}` : `clouds:${isMobile ? "read-first-visit" : "desktop-read-first-visit"}:${user.id}`;
    let seen = seenInMemory.current.has(key);
    try { seen ||= localStorage.getItem(key) === "1"; } catch { /* Storage may be unavailable. */ }
    if (!seen) setOpen(pathname === "/" ? "talk" : "read");
  }, [pathname, user?.id, user?.interestsOnboardingRequired]);

  const close = () => {
    if (user && open) {
      const key = open === "talk" ? `clouds:${mobile ? "mobile" : "desktop"}-navigation-tutorial:${user.id}` : `clouds:${mobile ? "read-first-visit" : "desktop-read-first-visit"}:${user.id}`;
      seenInMemory.current.add(key);
      try { localStorage.setItem(key, "1"); } catch { /* Keep the dismissal for this session. */ }
    }
    setOpen(null);
  };

  if (!open) return null;
  return <div role="dialog" aria-modal="true" aria-labelledby="mobile-welcome-title" className="fixed inset-0 z-[300] flex items-center bg-[#080315]/85 p-5 backdrop-blur-md">
    <section className="relative mx-auto w-full max-w-md rounded-[32px] border border-[#8B5CF6]/50 bg-[#111027] p-6 text-center shadow-[0_0_70px_rgba(109,40,217,.38)]">
      <button type="button" onClick={close} aria-label="Fechar aviso" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/[.08] text-3xl font-light text-white/85">×</button>
      <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#2D126C]/70 text-4xl text-[#D8B4FE]" aria-hidden="true">{open === "talk" ? "☝" : "▤"}</div>
      {open === "talk" && <p className="mt-5 text-[15px] font-semibold text-[#D8B4FE]">Boas-vindas ao Clouds! ☁️</p>}
      <h1 id="mobile-welcome-title" className="mt-5 text-[26px] font-extrabold text-white">{open === "talk" ? "Entre na conversa" : "Conheça a aba Leia"}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-[#B7B5DC]">{open === "talk" ? (mobile ? "Para abrir o chat, toque duas vezes rapidamente no título da conversa." : "Para abrir o chat, clique duas vezes no título da conversa.") : (mobile ? "Leia conversas que já aconteceram e descubra o que as pessoas compartilharam. Para abrir uma conversa, toque duas vezes rapidamente no título." : "Leia conversas que já aconteceram e descubra o que as pessoas compartilharam. Para abrir uma conversa, clique duas vezes no título.")}</p>
      <button type="button" onClick={close} className="mt-7 rounded-full bg-gradient-to-r from-[#6935FF] to-[#9B36FF] px-8 py-3 text-[16px] font-bold text-white">Entendi</button>
    </section>
  </div>;
}
