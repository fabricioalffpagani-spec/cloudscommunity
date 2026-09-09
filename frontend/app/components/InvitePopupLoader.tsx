"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const InvitePopup = dynamic(
  () => import("./InvitePopup").then((m) => ({ default: m.InvitePopup })),
  { ssr: false }
);

export function InvitePopupLoader() {
  const pathname = usePathname();

  // Só no feed (homepage) — não em cloudchats, DMs, settings, etc.
  if (pathname !== "/") return null;

  return <InvitePopup />;
}
