"use client";
import Link from "next/link";
type Props = { cloudTitle?: string; returnTo: string; onClose: () => void };
export function GuestCloudSignupModal({ returnTo, onClose }: Props) {
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Criar conta" className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#15161C] p-6 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <h2 className="text-xl font-bold text-white">Entre para interagir</h2>
      <p className="mt-3 text-sm leading-relaxed text-white/65">Você pode continuar navegando, mas precisa entrar ou criar uma conta para realizar esta ação.</p>
      <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="mt-6 inline-flex w-full justify-center rounded-full bg-[#9333EA] px-5 py-3 text-sm font-semibold text-white">Entrar</Link>
      <Link href={`/signup?from=interaction&returnTo=${encodeURIComponent(returnTo)}`} className="mt-3 inline-flex w-full justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white">Criar minha conta</Link>
      <button type="button" onClick={onClose} className="mt-4 text-sm text-white/50">Agora não</button>
    </section>
  </div>;
}
