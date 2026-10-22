"use client";

import { useEffect, useState } from "react";
import { generalInvitationText } from "../lib/cloud-invitation";
import { useSessionUser } from "./session-user";

function InviteArrowIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4l6 6-6 6" />
      <path d="M20 10h-4.5A9.5 9.5 0 0 0 4 19" />
    </svg>
  );
}

export function InviteCloudsButton({ compact = false }: { compact?: boolean }) {
  const [notice, setNotice] = useState("");
  const { user } = useSessionUser();
  const [invitation, setInvitation] = useState<{ ownerId: string; url: string } | null>(null);
  const url = invitation && user && invitation.ownerId === user.id ? (() => { const link = new URL(invitation.url); link.searchParams.set("preview", "avatar"); link.searchParams.set("v", "2"); return link.toString(); })() : "";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const ownerId = user.id;
    void fetch("/api/users/send-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: user.email }) })
      .then(async (response) => { if (!response.ok) throw new Error(); const data = await response.json() as { inviteUrl: string }; if (!cancelled) setInvitation({ ownerId, url: data.inviteUrl }); })
      .catch(() => { if (!cancelled) setNotice("Não foi possível criar seu convite."); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const invite = async () => {
    if (!user) { setNotice("Entre na sua conta para convidar amigos."); return; }
    if (!url) { setNotice("Seu convite ainda está sendo preparado."); return; }
    const text = generalInvitationText(user.displayName || user.name || user.username);
    const invitation = `${text}\n${url}`;
    setNotice("");

    // Some desktop browsers expose Web Share but reject one of the optional
    // fields. Try compatible native payloads before falling back to copying.
    if (typeof navigator.share === "function") {
      const payloads: ShareData[] = [
        { title: "Clouds", text, url },
        { title: "Clouds", text: invitation },
        { text: invitation },
      ];
      for (const payload of payloads) {
        if (typeof navigator.canShare === "function" && !navigator.canShare(payload)) continue;
        try {
          await navigator.share(payload);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNotice("Link do convite copiado.");
    } catch {
      setNotice("Não foi possível abrir o compartilhamento.");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void invite()}
        aria-label="Convidar pessoas para o Clouds"
        title="Convidar pessoas para o Clouds"
        className={`flex items-center justify-center rounded-full text-white transition hover:bg-white/[0.12] active:scale-95 ${compact ? "h-8 w-8" : "h-14 w-14 bg-white/[0.07] hover:bg-white/[0.13]"}`}
      >
        <InviteArrowIcon size={compact ? 19 : 25} />
      </button>
      {notice && <span role="status" className="absolute right-0 top-full z-30 mt-2 w-48 rounded-lg bg-[#1a0e3d] px-3 py-2 text-center text-[11px] text-white shadow-xl">{notice}</span>}
    </div>
  );
}
