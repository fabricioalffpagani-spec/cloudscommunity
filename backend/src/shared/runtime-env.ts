export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    // Fallback para desenvolvimento local
    const defaults: Record<string, string> = {
      CACHE_NODE_ENDPOINT: 'redis://localhost:6379',
      APP_HTTP_PORT: '3001',
      APP_WEB_ORIGIN: 'http://localhost:3000',
    };

    if (process.env.NODE_ENV !== 'production' && defaults[name]) {
      console.warn(`Using development default for ${name}`);
      return defaults[name];
    }

    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAllowedOrigins(): string[] {
  const origins = getRequiredEnv('APP_WEB_ORIGIN')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!origins.length)
    throw new Error('APP_WEB_ORIGIN must list explicit origins');
  for (const origin of origins) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== origin ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    ) {
      throw new Error(
        'APP_WEB_ORIGIN must list HTTP origins (HTTPS in production)',
      );
    }
  }
  return origins;
}

export function getPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
