"use client";

import { useEffect, useState } from "react";
import { cloudInvitation, invitationCountdown } from "../lib/cloud-invitation";
import { filterPeople } from "../lib/filter-people";
import { CloudShareOptions } from "./CloudShareOptions";

type ShareCloud = {
  title: string;
  createdAt: string;
  duration: string;
  membersCount: number;
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function avatarColor(source: string) {
  const palette = [
    "#9333EA",
    "#3B82F6",
    "#22C55E",
    "#F97316",
    "#EC4899",
    "#06B6D4",
  ];
  return palette[hashString(source) % palette.length];
}

type ShareContact = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// ─── Share Modal ──────────────────────────────────────────────────────────────

export function ShareModal({
  cloudId,
  cloudTitle,
  cloudUrl,
  onClose,
}: {
  cloudId: string;
  cloudTitle: string;
  cloudUrl: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<"main" | "contacts">("main");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<ShareContact[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const visibleContacts = filterPeople(contacts, contactQuery);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [shareCloud, setShareCloud] = useState<ShareCloud | null>(null);

  useEffect(() => {
    void fetch(`/api/clouds/${encodeURIComponent(cloudId)}/share`, {
      method: "POST",
    });
    let active = true;
    void fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.cloud) setShareCloud(data.cloud);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cloudId]);

  const invitationText = cloudInvitation({
    title: shareCloud?.title || cloudTitle,
    url: cloudUrl,
    remaining: shareCloud
      ? invitationCountdown(shareCloud.createdAt, shareCloud.duration)
      : undefined,
    participants: shareCloud?.membersCount,
  });

  useEffect(() => {
    if (view !== "contacts" || contactsLoaded || loadingContacts) return;

    setLoadingContacts(true);
    setContactsError(null);
    fetch("/api/users/following", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Não foi possível carregar os contatos.");
        return response.json() as Promise<{ users?: ShareContact[] }>;
      })
      .then((payload) =>
        setContacts(Array.isArray(payload.users) ? payload.users : []),
      )
      .catch((error) =>
        setContactsError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os contatos.",
        ),
      )
      .finally(() => {
        setLoadingContacts(false);
        setContactsLoaded(true);
      });
  }, [contactsLoaded, loadingContacts, view]);

  const handleSendToContact = (contactId: string) => {
    setSent((prev) => ({ ...prev, [contactId]: true }));
    const params = new URLSearchParams({
      id: contactId,
      share: "cloud",
      url: cloudUrl,
      title: cloudTitle,
      autosend: "true",
    });
    window.location.assign(`/messages?${params.toString()}`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(cloudUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleNativeShare = async () => {
    const shareData = { text: invitationText };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        onClose();
      } catch (error) {
        // Closing the native sheet is a normal cancellation, not an error.
        if (!(error instanceof DOMException && error.name === "AbortError"))
          return;
      }
      return;
    }
    handleCopy();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111116] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          {view !== "main" && (
            <button
              type="button"
              onClick={() => setView("main")}
              className="mr-3 text-white/40 hover:text-white transition"
            >
              <svg
                viewBox="0 0 24 24"
                width={18}
                height={18}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          )}
          <span className="text-[16px] font-bold text-white flex-1">
            {view === "main" ? "Compartilhar Cloud" : "Enviar para contato"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white transition"
          >
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* ── Cloud title preview ── */}
        {view === "main" && (
          <div className="mx-5 mt-4 rounded-xl border border-white/[0.07] bg-[#1C1F2E] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
              Cloud
            </p>
            <p className="text-[14px] font-semibold text-white truncate">
              {cloudTitle}
            </p>
          </div>
        )}

        {view === "main" && (
          <CloudShareOptions
            onShare={() => void handleNativeShare()}
            onContacts={() => setView("contacts")}
            onCopy={handleCopy}
            copied={copied}
          />
        )}

        {/* ── Contacts view ── */}
        {view === "contacts" && (
          <div className="flex min-h-0 flex-col p-3 sm:p-4">
            <p className="mb-2 px-1 text-[12px] text-white/40">
              Selecione quem deve receber o link desta Cloud:
            </p>
            <input
              type="search"
              aria-label="Pesquisar contatos"
              placeholder="Buscar por nome ou @username"
              value={contactQuery}
              onChange={(event) => setContactQuery(event.target.value)}
              className="mb-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/40 focus:border-[#A855F7]"
            />
            {loadingContacts ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-white/50">
                Carregando contatos...
              </div>
            ) : contactsError ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-white/50">
                {contactsError}
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-white/50">
                Você ainda não segue ninguém
              </div>
            ) : visibleContacts.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-white/50">
                Nenhum resultado encontrado.
              </div>
            ) : (
              <div className="flex min-h-0 max-h-[50dvh] flex-col gap-0.5 overflow-y-auto overscroll-contain">
                {visibleContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-white/[0.04] sm:gap-3 sm:py-2"
                  >
                    <div className="relative shrink-0">
                      {contact.avatarUrl ? (
                        <img
                          src={contact.avatarUrl}
                          alt={contact.displayName}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white"
                          style={{
                            backgroundColor: avatarColor(contact.username),
                          }}
                        >
                          {contact.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">
                        {contact.displayName}
                      </p>
                      <p className="truncate text-[11px] text-white/40">
                        @{contact.username}
                      </p>
                    </div>
                    {sent[contact.id] ? (
                      <span className="text-[12px] font-semibold text-[#22C55E] flex items-center gap-1">
                        <svg
                          viewBox="0 0 24 24"
                          width={14}
                          height={14}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                        Enviado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendToContact(contact.id)}
                        className="min-h-9 shrink-0 rounded-full bg-[#9333EA] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#7C3AED]"
                      >
                        Enviar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
