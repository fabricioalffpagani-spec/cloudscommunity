"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Conversation = { id: string; unreadCount: number };
type ConversationsResponse = { conversations?: Conversation[] };

export function MessagesNavLink({ active = false }: { active?: boolean }) {
  const [unreadContacts, setUnreadContacts] = useState(0);

  const loadUnreadContacts = useCallback(async () => {
    try {
      const response = await fetch("/api/direct-messages/conversations", { credentials: "include" });
      if (!response.ok) return;

      const payload = (await response.json()) as ConversationsResponse;
      const conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
      setUnreadContacts(new Set(
        conversations
          .filter((conversation) => conversation.unreadCount > 0)
          .map((conversation) => conversation.id),
      ).size);
    } catch {
      // A navegação continua utilizável mesmo se as conversas não puderem ser carregadas.
    }
  }, []);

  useEffect(() => {
    void loadUnreadContacts();
    const refresh = () => void loadUnreadContacts();
    window.addEventListener("focus", refresh);
    const intervalId = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(intervalId);
    };
  }, [loadUnreadContacts]);

  const label = unreadContacts > 0
    ? `Messages, ${unreadContacts} contato${unreadContacts === 1 ? "" : "s"} com mensagens não lidas`
    : "Messages";

  return (
    <Link
      href="/messages"
      aria-label={label}
      className={`flex flex-col items-center gap-2 transition hover:text-white ${active ? "text-[#A855F7]" : "text-white"}`}
    >
      <span className="relative inline-flex" aria-hidden="true">
        <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unreadContacts > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#9333EA] px-1 text-[11px] font-bold leading-none text-white ring-2 ring-[#060410]">
            {unreadContacts > 99 ? "99+" : unreadContacts}
          </span>
        )}
      </span>
      <span className="text-[13px] font-semibold">Messages</span>
    </Link>
  );
}
