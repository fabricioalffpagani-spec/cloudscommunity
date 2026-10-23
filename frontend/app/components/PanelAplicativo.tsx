"use client";

import { useEffect, useState } from "react";
import { useSessionUser } from "./session-user";
import {
  clearRememberedInstallPrompt,
  forgetRecordedInstall,
  getRememberedInstallPrompt,
  hasRecordedInstall,
  isAppleMobileDevice,
  isMacSafariBrowser,
  recordInstall,
  rememberInstallPrompt,
  type InstallPromptEvent,
} from "../lib/pwa-install";

function CheckIcon() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>; }
function DeviceIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M10 18h4" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>; }
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-2xl border border-white/[0.08] bg-[#120a2e] p-4 sm:p-6 ${className}`}>{children}</div>; }
function Sub({ children }: { children: React.ReactNode }) { return <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white">{children}</h3>; }

export function PanelAplicativo() {
  const { user } = useSessionUser();
  const [, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [recordedInstall, setRecordedInstall] = useState(false);
  const [installError, setInstallError] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [showRemovalInstructions, setShowRemovalInstructions] = useState(false);
  const [iosInstallHelpOpen, setIosInstallHelpOpen] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(isStandalone);
    setRecordedInstall(hasRecordedInstall());
    if (new URLSearchParams(window.location.search).get("installHelp") === "1") setShowInstructions(true);
    setCanInstall(window.isSecureContext || window.location.hostname === "localhost");
    setInstallPrompt(getRememberedInstallPrompt());
    const handleBeforeInstallPrompt = (event: Event) => { event.preventDefault(); const prompt = event as InstallPromptEvent; rememberInstallPrompt(prompt); setInstallPrompt(prompt); };
    const handlePromptReady = () => setInstallPrompt(getRememberedInstallPrompt());
    const handleInstalled = () => { recordInstall(); setRecordedInstall(true); setInstallPrompt(null); clearRememberedInstallPrompt(); };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("clouds:pwa-install-ready", handlePromptReady);
    window.addEventListener("appinstalled", handleInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt); window.removeEventListener("clouds:pwa-install-ready", handlePromptReady); window.removeEventListener("appinstalled", handleInstalled); };
  }, []);

  const install = async () => {
    const prompt = getRememberedInstallPrompt();
    setInstallError("");
    if (!prompt) { setShowInstructions(true); return; }
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { setInstallError("Não foi possível abrir a instalação. Siga as instruções do navegador abaixo."); setShowInstructions(true); }
    finally { setInstallPrompt(null); clearRememberedInstallPrompt(); }
  };

  const isIos = typeof navigator !== "undefined" && isAppleMobileDevice(navigator);
  const isMacSafari = typeof navigator !== "undefined" && isMacSafariBrowser(navigator);
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const needsAppleInstallGuide = isIos || isMacSafari;
  return <div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Aplicativo</h2>
    <Card><Sub>Clouds no seu dispositivo</Sub><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[14px] font-medium text-white">Instalar Clouds</p><p className="mt-1 text-[12px] leading-5 text-white/60">Crie um atalho com ícone na tela inicial ou área de trabalho e abra o Clouds como aplicativo.</p></div>{installed ? <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#9333EA]/20 px-4 py-2.5 text-[13px] font-semibold text-[#E9D5FF]"><CheckIcon />Aberto como aplicativo</span> : <button type="button" onClick={() => needsAppleInstallGuide ? setIosInstallHelpOpen(true) : void install()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#9333EA] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED]"><DeviceIcon />Adicionar atalho para o Clouds</button>}</div>
      {recordedInstall && !installed && <p className="mt-3 text-[12px] text-white/65">A instalação foi confirmada ou informada neste navegador. Se você removeu o atalho, <button type="button" className="underline" onClick={() => { forgetRecordedInstall(user?.id, user?.username); setRecordedInstall(false); }}>informe que removeu</button> para voltar a receber lembretes.</p>}{installError && <p role="alert" className="mt-3 text-[12px] text-red-300">{installError}</p>}{!installed && (needsAppleInstallGuide || showInstructions) && <p className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[12px] leading-5 text-white/65">{isIos ? "No iPhone ou iPad, o botão abre o guia para adicionar o Clouds à Tela de Início." : isMacSafari ? "No Safari do Mac, o botão abre o guia para adicionar o Clouds ao Dock." : isAndroid ? "Abra o menu do navegador (⋮), escolha Instalar aplicativo ou Adicionar à tela inicial e confirme. Os nomes podem variar conforme o navegador." : canInstall ? "Abra o menu do navegador e procure Instalar aplicativo ou Criar atalho. As opções variam conforme o navegador." : "A instalação automática exige que o Clouds esteja em HTTPS."}</p>}
    </Card>
    {iosInstallHelpOpen && <div className="fixed inset-0 z-[100] flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="ios-install-title" onClick={() => setIosInstallHelpOpen(false)}><section className="w-full rounded-t-3xl border border-white/10 bg-[#171821] p-6 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-[12px] font-semibold uppercase tracking-[.16em] text-[#C084FC]">{isMacSafari ? "Safari para Mac" : "iPhone e iPad"}</p><h3 id="ios-install-title" className="mt-1 text-xl font-bold text-white">{isMacSafari ? "Adicione o Clouds ao Dock" : "Adicione o Clouds à Tela de Início"}</h3></div><button type="button" onClick={() => setIosInstallHelpOpen(false)} aria-label="Fechar" className="text-2xl leading-none text-white/55">×</button></div><p className="mt-3 text-sm leading-relaxed text-white/65">{isMacSafari ? "O Safari exige esta confirmação manual. São só dois passos:" : "No iPhone ou iPad, a instalação é concluída pelo navegador:"}</p><ol className="mt-5 space-y-3">{isMacSafari ? <><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9333EA] text-sm font-bold">1</span><p className="pt-1 text-sm text-white/85">Na barra de menus do Safari, abra <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold">Arquivo</span>.</p></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9333EA] text-sm font-bold">2</span><p className="pt-1 text-sm text-white/85">Escolha <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold">Adicionar ao Dock</span> e confirme.</p></li></> : <><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9333EA] text-sm font-bold">1</span><p className="pt-1 text-sm text-white/85">No navegador, toque no botão <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold">Compartilhar</span>. A posição varia conforme o navegador.</p></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9333EA] text-sm font-bold">2</span><p className="pt-1 text-sm text-white/85">Escolha <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold">Adicionar à Tela de Início</span>. Se não aparecer, procure Editar Ações. Ative “Abrir como App Web”, se disponível, e confirme em Adicionar.</p></li></>}</ol><p className="mt-5 rounded-xl bg-[#9333EA]/10 px-3 py-2.5 text-xs leading-relaxed text-[#E9D5FF]">{isMacSafari ? "O Clouds ficará disponível no Dock e abrirá em sua própria janela." : "Depois, o ícone do Clouds aparecerá na sua tela inicial e abrirá como aplicativo."}</p><button type="button" onClick={() => setIosInstallHelpOpen(false)} className="mt-6 w-full rounded-full bg-[#9333EA] py-3 text-sm font-semibold text-white">Entendi</button></section></div>}
    <Card className="border-red-500/20"><Sub>Remover do dispositivo</Sub><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[14px] font-medium text-white">Remover atalho do Clouds</p><p className="mt-1 text-[12px] leading-5 text-white/60">Remove apenas o ícone e o acesso rápido deste dispositivo; sua conta e seus dados não serão apagados.</p></div><button type="button" onClick={() => setShowRemovalInstructions((open) => !open)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-5 py-2.5 text-[13px] font-semibold text-red-200 transition hover:bg-red-500/20"><TrashIcon />Remover atalho</button></div>{showRemovalInstructions && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/[0.06] px-3 py-2.5 text-[12px] leading-5 text-white/70">{isIos ? "Na Tela de Início, mantenha pressionado o ícone do Clouds e toque em “Remover App”." : "Abra o Clouds instalado, use o menu de três pontos da janela e escolha “Desinstalar Clouds”. No Android, mantenha o ícone pressionado e toque em “Desinstalar” ou “Remover”."}</p>}</Card>
  </div>;
}
