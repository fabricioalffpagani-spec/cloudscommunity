"use client";
import { useEffect } from "react";

export function InvitationRedirect() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    window.location.replace(ref ? `/signup?ref=${encodeURIComponent(ref)}` : "/signup");
  }, []);
  return null;
}
