"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function NotificationCloudRedirect({ cloudId }: { cloudId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messageId = searchParams.get("message");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = encodeURIComponent(cloudId);
    void fetch(`/api/clouds/${id}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Cloud indisponível");
      const payload = await response.json() as { cloud?: { status?: string } };
      if (!payload.cloud?.status) throw new Error("Cloud indisponível");
      if (cancelled) return;
      if (payload.cloud.status === "active") {
        const message = messageId ? `&message=${encodeURIComponent(messageId)}` : "";
        router.replace(`/cloud/${id}?join=1${message}`);
      } else if (payload.cloud.status === "ended" || payload.cloud.status === "archived") {
        router.replace(`/cloud/${id}/conversation?from=read`);
      } else {
        setError(true);
      }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [cloudId, messageId, router]);

  return <div className="flex min-h-screen items-center justify-center bg-[#030208] px-6 text-center text-white">{error ? "Não foi possível abrir esta cloud. Ela pode não estar mais disponível." : "Abrindo a cloud..."}</div>;
}
