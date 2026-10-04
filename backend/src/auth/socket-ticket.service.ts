import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { createClient, type RedisClientType } from 'redis';
import { AuthService } from './auth.service';

@Injectable()
export class SocketTicketService implements OnModuleDestroy {
  private readonly logger = new Logger(SocketTicketService.name);
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType | null> | null = null;
  private readonly local = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  constructor(private readonly authService: AuthService) {}

  private async getClient() {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    const endpoint = process.env.CACHE_NODE_ENDPOINT?.trim();
    if (!endpoint) return null;
    const client = createClient({ url: endpoint });
    client.on('error', (error) =>
      this.logger.error(
        `Redis socket ticket error: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    this.connecting = client
      .connect()
      .then(() => {
        this.client = client;
        return client;
      })
      .finally(() => {
        this.connecting = null;
      });
    return this.connecting;
  }

  async issue(sessionToken: string | null) {
    const session = await this.authService.resolveSession(sessionToken);
    if (!session || !sessionToken) return null;
    const ticket = randomBytes(32).toString('base64url');
    const key = this.key(ticket);
    const client = await this.getClient();
    if (client) await client.set(key, sessionToken, { EX: 60 });
    else
      this.local.set(key, {
        token: sessionToken,
        expiresAt: Date.now() + 60_000,
      });
    return ticket;
  }

  async consume(ticket: string): Promise<string | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
    const key = this.key(ticket);
    const client = await this.getClient();
    if (client) return client.getDel(key);
    const value = this.local.get(key);
    this.local.delete(key);
    return value && value.expiresAt > Date.now() ? value.token : null;
  }

  async onModuleDestroy() {
    await this.client?.disconnect();
  }

  private key(ticket: string) {
    return `socket:ticket:${createHash('sha256').update(ticket).digest('hex')}`;
  }
}
