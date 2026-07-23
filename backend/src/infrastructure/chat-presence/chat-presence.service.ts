import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class ChatPresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatPresenceService.name);
  private client: RedisClientType | null = null;

  private async getClient() {
    if (this.client) {
      return this.client;
    }

    const endpoint = process.env.CACHE_NODE_ENDPOINT?.trim();
    if (!endpoint) {
      return null;
    }

    this.client = createClient({ url: endpoint });
    this.client.on('error', (error) => this.logger.error(`Redis presence error: ${this.describeError(error)}`));
    await this.client.connect();
    return this.client;
  }

  async markOnline(userId: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      return true;
    }

    const count = await client.incr(this.presenceKey(userId));
    return count === 1;
  }

  async markOffline(userId: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      return true;
    }

    const key = this.presenceKey(userId);
    const count = Math.max(0, await client.decr(key));
    if (count <= 0) {
      await client.del(key);
      return true;
    }

    return false;
  }

  async onModuleDestroy() {
    await this.client?.disconnect();
  }

  private presenceKey(userId: string) {
    return `chat:presence:${userId}`;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
