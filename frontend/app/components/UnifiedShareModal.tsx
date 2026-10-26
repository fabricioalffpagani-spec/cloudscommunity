"use client";

import { useEffect, useState } from "react";
import { cloudInvitation, invitationCountdown } from "../lib/cloud-invitation";
import { ForwardToContactModal, type ForwardContact } from "./ForwardToContactModal";

type ShareCloud = {
  title: string;
  createdAt: string;
  duration: string;
  membersCount: number;
};

export function ShareModal({ cloudId, cloudTitle, cloudUrl, onClose }: {
  cloudId: string;
  cloudTitle: string;
  cloudUrl: string;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<ForwardContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [shareCloud, setShareCloud] = useState<ShareCloud | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/clouds/${encodeURIComponent(cloudId)}/share`, { method: "POST" });
    void fetch(`/api/clouds/${encodeURIComponent(cloudId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data?.cloud) setShareCloud(data.cloud); })
      .catch(() => undefined);
    void fetch("/api/users/following?compact=1", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os contatos.");
        return response.json() as Promise<{ users?: ForwardContact[] }>;
      })
      .then((payload) => { if (active) setContacts(Array.isArray(payload.users) ? payload.users : []); })
      .catch((error) => {
        if (active) setContactsError(error instanceof Error ? error.message : "Não foi possível carregar os contatos.");
      })
      .finally(() => { if (active) setLoadingContacts(false); });
    return () => { active = false; };
  }, [cloudId]);

  const invitationText = cloudInvitation({
    title: shareCloud?.title || cloudTitle,
    url: cloudUrl,
    remaining: shareCloud ? invitationCountdown(shareCloud.createdAt, shareCloud.duration) : undefined,
    participants: shareCloud?.membersCount,
  });

  return <ForwardToContactModal
    title="Compartilhar Cloud"
    preview={cloudTitle}
    url={cloudUrl}
    label={cloudTitle}
    forwarded={false}
    contacts={contacts}
    loading={loadingContacts}
    contactsError={contactsError}
    externalShareText={invitationText}
    onClose={onClose}
  />;
}
