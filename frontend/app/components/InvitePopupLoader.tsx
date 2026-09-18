"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const InvitePopup = dynamic(
  () => import("./InvitePopup").then((m) => ({ default: m.InvitePopup })),
  { ssr: false }
);

export function InvitePopupLoader() {
  const pathname = usePathname();
  const previewMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("invitePreview") === "1";

  // Só no feed (homepage) — não em cloudchats, DMs, settings, etc.
  if (pathname !== "/" && !previewMode) return null;

  return <InvitePopup />;
}
