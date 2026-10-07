"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionUser } from "./session-user";

// Aparece 5 min após autenticação
const POPUP_DELAY_MS = 5 * 60 * 1000;
// Reaparece após 5 dias (em ms)
const REAPPEAR_AFTER_MS = 5 * 24 * 60 * 60 * 1000;

function storageKey(userId: string) {
  return `clouds_invite_popup_${userId}`;
}

// Retorna null se deve mostrar, ou timestamp de quando mostrou pela última vez
function getLastShown(userId: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function markShown(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), String(Date.now()));
  } catch { /* silent */ }
}

function shouldShow(userId: string): boolean {
  const last = getLastShown(userId);
  if (last === null) return true; // nunca mostrou
  return Date.now() - last >= REAPPEAR_AFTER_MS;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill="white" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill="white" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  );
}

export function InvitePopup() {
  const { user, status } = useSessionUser();
  const [visible, setVisible] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(() => typeof window === "undefined" ? "" : `${window.location.origin}/cloudscommunity`);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inviteText = "Ei! Te convido a fazer parte do Clouds Community ☁️ — me acompanha por lá! Compartilhe suas opiniões e visões no Clouds, seu streaming de conversas. Entre agora:";
  const inviteMessage = `${inviteText} ${inviteUrl}`;

  useEffect(() => {
    const previewMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("invitePreview") === "1";
    if (!previewMode && (status !== "authenticated" || !user?.id)) return;

    const userId = user?.id ?? "invite-preview";

    // Não agendar se não está na hora de mostrar
    if (!previewMode && !shouldShow(userId)) return;

    // Agenda o popup para aparecer após o delay
    timerRef.current = setTimeout(async () => {
      // Re-checar ao disparar (usuário pode ter fechado em outra aba)
      if (!previewMode && !shouldShow(userId)) return;

      try {
        if (!user?.id) throw new Error("Prévia sem sessão");
        const res = await fetch("/api/users/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ identifier: user.email }),
        });
        if (res.ok) {
          const data = await res.json() as { ok: true; inviteUrl: string };
          if (data.inviteUrl) setInviteUrl(data.inviteUrl);
        }
      } catch { /* silent */ }

      setVisible(true);
    }, previewMode ? 0 : POPUP_DELAY_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id]);

  const dismiss = () => {
    if (user?.id) markShown(user.id);
    setVisible(false);
  };

  const handleShare = async (platform: "whatsapp" | "instagram") => {
    try {
      await navigator.clipboard.writeText(inviteMessage);
    } catch { /* silent */ }

    setCopiedPlatform(platform);
    setTimeout(() => setCopiedPlatform(null), 2500);

    // Marcar como usado — mesma lógica de dismiss
    if (user?.id) markShown(user.id);
    setVisible(false);

    if (platform === "whatsapp") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      window.open("https://www.instagram.com/direct/inbox/", "_blank", "noopener,noreferrer");
    }
  };

  const copyInviteLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedPlatform("link");
      setTimeout(() => setCopiedPlatform(null), 2500);
      if (user?.id) markShown(user.id);
    } catch { /* silent */ }
  };

  const shareNatively = async () => {
    if (!inviteUrl || !navigator.share) return;
    try {
      // The native Web Share sheet appends `url` itself. Including it in text
      // duplicates the invitation in WhatsApp and other targets.
      await navigator.share({ title: "Clouds Community", text: inviteText, url: inviteUrl });
      if (user?.id) markShown(user.id);
      setVisible(false);
    } catch { /* user cancelled */ }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-6 z-[70] w-auto max-w-[360px] animate-in slide-in-from-bottom-4 overflow-hidden rounded-2xl shadow-2xl shadow-black/60 duration-300 sm:left-auto sm:right-6 sm:w-full">
      {/* Header */}
      <div className="bg-[#1E1040] px-5 pt-5 pb-4 relative">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-4 right-4 text-white/40 hover:text-white text-xl leading-none"
        >
          ×
        </button>

        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6B4EFF]/30">
            <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <div className="pr-6">
            <p className="text-[16px] font-bold leading-snug text-white">
              Traga seus amigos para a festa!
            </p>
            <p className="mt-1 text-[13px] text-[#A78BFA] font-medium leading-snug">
              Convide seus contatos para o Clouds
            </p>
            <p className="mt-1.5 text-[11px] text-white/40 leading-snug">
              Compartilhe nas redes sociais
            </p>
          </div>
        </div>
      </div>

      {/* Sharing options */}
      <div className="bg-[#0E0A1F] px-4 py-4 space-y-3">
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button type="button" onClick={() => void shareNatively()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] px-4 py-3 text-[14px] font-bold text-white transition hover:bg-[#6D28D9]">
            Compartilhar convite
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleShare("whatsapp")}
          className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#15161C] px-4 py-3.5 text-left transition hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
            <WhatsAppIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white">WhatsApp Web</p>
            <p className="text-[12px] text-white/45">
              {copiedPlatform === "whatsapp" ? "Mensagem copiada! Cole no chat →" : "Abrir WhatsApp Web"}
            </p>
          </div>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>

        <button type="button" onClick={() => void copyInviteLink()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] px-4 py-3 text-[13px] font-semibold text-white/75 transition hover:bg-white/[0.06]">
          {copiedPlatform === "link" ? "Link copiado" : "Copiar meu link de convite"}
        </button>

        <button
          type="button"
          onClick={() => void handleShare("instagram")}
          className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#15161C] px-4 py-3.5 text-left transition hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.98]"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}
          >
            <InstagramIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white">Instagram Web</p>
            <p className="text-[12px] text-white/45">
              {copiedPlatform === "instagram" ? "Mensagem copiada! Cole no DM →" : "Abrir Instagram Web"}
            </p>
          </div>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Footer */}
      <div className="bg-[#0E0A1F] border-t border-white/[0.06] px-5 py-3">
        <p className="text-center text-[11px] leading-snug text-white/30">
          A mensagem com o link de cadastro será copiada automaticamente.
        </p>
      </div>
    </div>
  );
}
