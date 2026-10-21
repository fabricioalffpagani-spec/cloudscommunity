"use client";

import { useState } from "react";
import { ProfileScheduleActions } from "./ProfileScheduleActions";

export function DesktopScheduledCloudActions({ cloudId, title, scheduledAt, initiallyReminded = false }: { cloudId: string; title: string; scheduledAt: string | null | undefined; initiallyReminded?: boolean }) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) return null;

  return <>
    <ProfileScheduleActions cloudId={cloudId} scheduledAt={scheduledAt} initiallyReminded={initiallyReminded} onReminderActivated={() => setConfirmationOpen(true)} />
    {confirmationOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" aria-labelledby="desktop-queue-title"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#171821] p-6 shadow-2xl"><h2 id="desktop-queue-title" className="text-lg font-bold text-white">Você entrou na fila</h2><p className="mt-2 text-sm text-white/65">Você será notificado quando “{title}” estrear.</p><button type="button" onClick={() => setConfirmationOpen(false)} className="mt-5 w-full rounded-full bg-[#9333EA] py-2.5 text-sm font-semibold text-white">Entendi</button></div></div>}
  </>;
}
