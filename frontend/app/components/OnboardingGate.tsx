"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionUser } from "./session-user";

export function OnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useSessionUser();

  useEffect(() => {
    if (status === "authenticated" && pathname !== "/onboarding" && user?.interestsOnboardingRequired) {
      router.replace("/onboarding");
    }
  }, [pathname, router, status, user?.interestsOnboardingRequired]);

  return null;
}
