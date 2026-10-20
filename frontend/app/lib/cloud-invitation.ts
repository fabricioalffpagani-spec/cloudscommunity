export function cloudInvitationUrl(url: string): string {
  const result = new URL(url, typeof window === "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") : window.location.origin);
  result.searchParams.set("join", "1");
  return result.href;
}

export function cloudInvitation({ title, url, remaining, participants }: { title: string; url: string; remaining?: string; participants?: number }): string {
  const lines = [`*${title}*`];
  if (remaining !== undefined) lines.push(`Faltam *${remaining}* para participar.`);
  if (participants !== undefined) lines.push(`${participants} ${participants === 1 ? "pessoa está" : "pessoas estão"} discutindo este tema ao vivo.`);
  lines.push(`Junte-se a mim nessa conversa: ${cloudInvitationUrl(url)}`);
  return lines.join("\n");
}

export function invitationCountdown(createdAt: string | Date, duration: string, now = Date.now()): string | undefined {
  const durations: Record<string, number> = { "5min": 300, "10min": 600, "30min": 1800, "1h": 3600, "2h": 7200, "5h": 18000, "24h": 86400 };
  const seconds = durations[duration.trim().toLowerCase().replace(/\s+/g, "")];
  const start = new Date(createdAt).getTime();
  if (!seconds || !Number.isFinite(start)) return undefined;
  const remaining = Math.max(0, seconds - Math.floor((now - start) / 1000));
  const hours = Math.floor(remaining / 3600), minutes = Math.floor((remaining % 3600) / 60), rest = remaining % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function generalInvitationText(name?: string | null): string {
  return `${name?.trim() || "Alguém"} está te convidando para o Clouds! Descubra conversas acontecendo agora...`;
}
