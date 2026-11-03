"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionUser } from "./session-user";

export function OnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useSessionUser();

  useEffect(() => {
    if (
      status === "authenticated" &&
      pathname !== "/onboarding" &&
      user?.interestsOnboardingRequired
    ) {
      const current = `${window.location.pathname}${window.location.search}`;
      router.replace(`/onboarding?returnTo=${encodeURIComponent(current)}`);
    }
  }, [pathname, router, status, user?.interestsOnboardingRequired]);

  return null;
}
