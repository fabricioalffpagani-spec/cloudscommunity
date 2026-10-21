const DURATIONS: Record<string, number> = { "10min": 600, "30min": 1800, "2h": 7200, "5h": 18000, "24h": 86400 };

export function cloudRemainingSeconds(cloud: { duration: string; createdAt: Date; startedAt?: string | null; scheduledAt?: string | null }, now = Date.now()): number {
  const duration = DURATIONS[cloud.duration] ?? 300;
  const start = new Date(cloud.startedAt || cloud.scheduledAt || cloud.createdAt).getTime();
  return Math.max(duration - Math.max(0, Math.floor((now - start) / 1000)), 0);
}
