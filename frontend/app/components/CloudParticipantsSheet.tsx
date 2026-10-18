"use client";

import Link from "next/link";

export type CloudParticipant = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
};

export function CloudParticipantsSheet({
  title,
  participants,
  onClose,
}: {
  title: string;
  participants: CloudParticipant[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="participants-title"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl border border-white/10 bg-[#171821] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="participants-title"
              className="text-lg font-bold text-white"
            >
              Participantes
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {participants.length} na Cloud “{title}”
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-2xl text-white/55"
          >
            ×
          </button>
        </div>
        <div className="mt-5 max-h-[55dvh] space-y-3 overflow-y-auto">
          {participants.map((participant) => (
            <Link
              key={participant.id}
              href={`/users/${encodeURIComponent(participant.id)}`}
              onClick={onClose}
              className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/5"
            >
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#9333EA] text-sm font-bold">
                {participant.avatarUrl ? (
                  <img
                    src={participant.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  participant.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">
                  {participant.name}
                </span>
                <span className="block truncate text-xs text-white/55">
                  @{participant.username}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
