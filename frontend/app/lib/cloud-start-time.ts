export function cloudElapsedSeconds(cloud: { createdAt: string; startedAt?: string | null }, now: number): number {
  return Math.floor((now - new Date(cloud.startedAt ?? cloud.createdAt).getTime()) / 1000);
}
