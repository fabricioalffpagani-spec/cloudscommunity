"use client";

import Link from "next/link";
import { UserAvatar } from "./session-user";

export function CloudSystemMessage({
  message,
}: {
  message: {
    content: string | null;
    senderId: string;
    senderName: string;
    senderAvatarUrl?: string | null;
  };
}) {
  return (
    <div className="flex w-full justify-center py-1.5">
      <div className="flex items-center gap-2 rounded-full border border-white/[0.05] bg-white/[0.06] px-3 py-1.5">
        {message.senderAvatarUrl ? (
          <Link
            href={`/users/${encodeURIComponent(message.senderId)}`}
            aria-label={`Ver perfil de ${message.senderName}`}
          >
            <UserAvatar
              user={{
                id: message.senderId,
                username: message.senderId,
                displayName: message.senderName,
                avatarUrl: message.senderAvatarUrl,
              }}
              size={20}
            />
          </Link>
        ) : (
          <Link
            href={`/users/${encodeURIComponent(message.senderId)}`}
            aria-label={`Ver perfil de ${message.senderName}`}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED] text-[10px] font-bold text-white"
          >
            {message.senderName.charAt(0).toUpperCase()}
          </Link>
        )}
        <span className="text-[12px] font-medium text-white/60">
          {message.content}
        </span>
      </div>
    </div>
  );
}
