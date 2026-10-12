"use client";

import { useCallback, useEffect, useState } from "react";

type PushTimingRecord = {
  trace: string;
  subscription: number;
  sentAt: string;
  pushReceivedAt: string;
  showNotificationAt?: string;
  showResolvedAt?: string;
  showErrorName?: string;
};

const cacheName = "clouds-push-timing-v1";

async function workerVersion(worker: ServiceWorker | null): Promise<string> {
  if (!worker) return "service worker inativo";
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      resolve("versão anterior ou sem resposta");
    }, 1500);
    channel.port1.onmessage = (event: MessageEvent<{ version?: string }>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data?.version || "versão desconhecida");
    };
    worker.postMessage({ type: "clouds:push-diagnostics-version" }, [
      channel.port2,
    ]);
  });
}

export default function PushDiagnosticsPage() {
  const [records, setRecords] = useState<PushTimingRecord[]>([]);
  const [version, setVersion] = useState("verificando");
  const [permission, setPermission] = useState("verificando");
  const [subscription, setSubscription] = useState("verificando");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("caches" in window)) {
        throw new Error(
          "Este navegador não oferece os recursos de diagnóstico.",
        );
      }
      const registration = await navigator.serviceWorker.register(
        "/clouds-sw.js",
        {
          updateViaCache: "none",
        },
      );
      await registration.update();
      setVersion(await workerVersion(registration.active));
      setPermission(Notification.permission);
      setSubscription(
        (await registration.pushManager.getSubscription())
          ? "ativa"
          : "ausente",
      );

      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      const entries = await Promise.all(
        keys.map(async (key) => {
          const response = await cache.match(key);
          return response
            ? ((await response.json()) as PushTimingRecord)
            : null;
        }),
      );
      setRecords(
        entries
          .filter((entry): entry is PushTimingRecord => entry !== null)
          .sort((a, b) => b.pushReceivedAt.localeCompare(a.pushReceivedAt))
          .slice(0, 30),
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao ler diagnóstico.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copy = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify({ version, permission, subscription, records }, null, 2),
    );
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[#090713] px-5 py-10 text-white">
      <h1 className="text-2xl font-semibold">
        Diagnóstico temporário de Web Push
      </h1>
      <p className="mt-3 text-sm text-white/70">
        Este aparelho guarda apenas identificadores aleatórios e horários das
        etapas do push. Mensagens, chaves e endereços de subscription não são
        registrados.
      </p>
      <dl className="mt-6 space-y-2 rounded-xl border border-white/15 p-4 text-sm">
        <div>Service worker: {version}</div>
        <div>Permissão: {permission}</div>
        <div>Subscription: {subscription}</div>
      </dl>
      {error && <p className="mt-4 text-red-300">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button
          className="rounded-lg bg-purple-600 px-4 py-2"
          onClick={() => void refresh()}
        >
          Atualizar
        </button>
        <button
          className="rounded-lg border border-white/30 px-4 py-2"
          onClick={() => void copy()}
        >
          Copiar relatório
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {records.length === 0 && (
          <p className="text-sm text-white/60">
            Nenhum push registrado neste aparelho.
          </p>
        )}
        {records.map((record) => (
          <pre
            key={`${record.trace}:${record.subscription}`}
            className="overflow-x-auto rounded-xl border border-white/15 p-4 text-xs"
          >
            {JSON.stringify(record, null, 2)}
          </pre>
        ))}
      </div>
    </main>
  );
}
