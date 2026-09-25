export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    // Fallback para desenvolvimento local
    const defaults: Record<string, string> = {
      PGX_CONN_STR:
        'postgresql://postgres:root@localhost:5433/clouds?schema=public',
      CACHE_NODE_ENDPOINT: 'redis://localhost:6379',
      APP_HTTP_PORT: '3001',
      APP_WEB_ORIGIN: 'http://localhost:3000',
    };

    if (defaults[name]) {
      console.warn(`Using default value for ${name}: ${defaults[name]}`);
      return defaults[name];
    }

    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
