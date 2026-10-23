"use client";

export function CloudShareOptions({ onShare, onContacts, onCopy, copied }: { onShare: () => void; onContacts: () => void; onCopy: () => void; copied: boolean }) {
  return <div className="flex flex-col gap-3 p-5">
    <button type="button" onClick={onShare} className="flex items-center gap-4 rounded-2xl border border-[#3B82F6]/35 bg-[#3B82F6]/10 px-5 py-4 text-left transition hover:bg-[#3B82F6]/20">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]/20 text-[#BFDBFE]">
        <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
      </div>
      <div><p className="text-[14px] font-semibold text-white">Compartilhar com apps</p><p className="mt-0.5 text-[12px] text-white/55">Abra a folha de compartilhamento do dispositivo</p></div>
    </button>
    <button type="button" onClick={onContacts} className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#1C1F2E] px-5 py-4 text-left transition hover:border-[#9333EA]/40 hover:bg-[#9333EA]/10">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9333EA]/20 text-[#C084FC] group-hover:bg-[#9333EA]/30"><svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div>
      <div><p className="text-[14px] font-semibold text-white">Enviar no mensageiro</p><p className="mt-0.5 text-[12px] text-white/45">Escolha um contato da plataforma</p></div>
      <svg className="ml-auto text-white/30" viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </button>
    <button type="button" onClick={onCopy} className="flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-white/50 transition hover:bg-white/[0.04] hover:text-white/80">
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      {copied ? "Link copiado!" : "Copiar link"}
    </button>
  </div>;
}
