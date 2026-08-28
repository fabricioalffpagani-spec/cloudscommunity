"use client";

import { usePathname } from "next/navigation";
import { NotificationsBell } from "./NotificationsPanel";

export function GlobalNotificationsBell() {
  const pathname = usePathname();

  // A home already renders its own notification control in the header.
  if (pathname === "/") return null;

  return (
    <div className="fixed right-5 top-5 z-[80]">
      <NotificationsBell />
    </div>
  );
}
