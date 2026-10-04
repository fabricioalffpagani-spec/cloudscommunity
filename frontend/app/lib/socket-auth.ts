export function socketAuth(callback: (credentials: { ticket?: string }) => void) {
  void fetch("/api/auth/socket-ticket", { cache: "no-store", credentials: "include" })
    .then(async (response) => response.ok ? response.json() : null)
    .then((payload: { ok?: boolean; ticket?: string } | null) => callback(payload?.ok && payload.ticket ? { ticket: payload.ticket } : {}))
    .catch(() => callback({}));
}
