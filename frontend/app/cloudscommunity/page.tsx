"use client";

import { useEffect } from "react";

export default function CloudsCommunityInvitePage() {
  useEffect(() => {
    window.location.replace("/signup");
  }, []);

  return null;
}
