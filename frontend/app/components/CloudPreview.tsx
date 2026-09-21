"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReadOnlyCloudMessage, type ReadOnlyMessage } from "./ReadOnlyCloudMessage";

type Preview = {
  cloud: { title: string };
  messages: ReadOnlyMessage[];
};

export function CloudPreview({ cloudId }: { cloudId: string }) {
  return <PreviewContent key={cloudId} cloudId={cloudId} />;
}

function PreviewContent({ cloudId }: { cloudId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/clouds/${encodeURIComponent(cloudId)}/preview`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? "Não foi possível carregar a prévia.");
        if (!controller.signal.aborted) setData(payload);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a prévia.");
      }
    })();
    return () => controller.abort();
  }, [cloudId, attempt]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push("/read");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [router]);

  return <div
    data-testid="preview-backdrop"
    className="min-h-[100dvh] text-white md:fixed md:inset-0 md:z-50 md:flex md:items-center md:justify-center md:bg-black/75 md:p-8 md:backdrop-blur-sm"
    onClick={() => router.push("/read")}
  >
  <main
    role="dialog"
    aria-modal="true"
    aria-label="Prévia da Cloud encerrada"
    onClick={(event) => event.stopPropagation()}
    className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-[#080415] md:h-[min(82dvh,780px)] md:rounded-[28px] md:border md:border-white/10 md:shadow-2xl md:shadow-black/70"
  >
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[#100828]/95 px-5 py-5 backdrop-blur-md">
      <Link href="/read" className="text-sm text-[#C084FC]">← Voltar para Read</Link>
      <h1 className="mt-3 break-words text-xl font-bold">{data?.cloud.title ?? "Prévia da Cloud"}</h1>
      <p className="mt-2 text-sm text-white/60">Cloud encerrada · Somente leitura · 10 primeiras mensagens</p>
    </header>
    <section aria-label="Mensagens da prévia" aria-busy={!data && !error} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      {error ? <div role="alert" className="rounded-2xl border border-white/10 p-5"><p>{error}</p><button onClick={() => { setError(""); setAttempt((value) => value + 1); }} className="mt-4 text-[#C084FC]">Tentar novamente</button></div> : !data ? <p role="status" className="text-white/60">Carregando prévia...</p> : data.messages.length === 0 ? <p className="py-12 text-center text-white/60">Esta cloud foi encerrada sem mensagens.</p> : data.messages.map((message) => (
        <ReadOnlyCloudMessage key={message.id} message={message} />
      ))}
    </section>
    {data && <footer className="sticky bottom-0 border-t border-white/10 bg-[#100828]/95 px-5 py-4 text-center backdrop-blur-md">
      <Link href={`/cloud/${cloudId}/conversation`} className="inline-flex rounded-full bg-[#9333EA] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#7C3AED]">Ver conversa completa</Link>
      <p className="mt-2 text-xs text-white/50">Somente leitura</p>
    </footer>}
  </main>
  </div>;
}
