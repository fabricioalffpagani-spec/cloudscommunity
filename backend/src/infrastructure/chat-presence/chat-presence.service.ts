import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class ChatPresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatPresenceService.name);
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType | null> | null = null;
  private readonly local = new Map<string, Set<string>>();
  private readonly localCloudWatch = new Map<string, Set<string>>();
  private readonly leaseMs = 90_000;

  private async getClient() {
    if (this.client) {
      return this.client;
    }

    const endpoint = process.env.CACHE_NODE_ENDPOINT?.trim();
    if (!endpoint) {
      return null;
    }

    if (this.connecting) return this.connecting;
    const client = createClient({ url: endpoint });
    client.on('error', (error) =>
      this.logger.error(`Redis presence error: ${this.describeError(error)}`),
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

  async markOnline(userId: string, socketId: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      const sockets = this.local.get(userId) ?? new Set<string>();
      const wasOffline = sockets.size === 0;
      sockets.add(socketId);
      this.local.set(userId, sockets);
      return wasOffline;
    }

    const key = this.presenceKey(userId);
    await client.zRemRangeByScore(key, '-inf', Date.now());
    const wasOffline = (await client.zCard(key)) === 0;
    await client.zAdd(key, {
      score: Date.now() + this.leaseMs,
      value: socketId,
    });
    await client.expire(key, Math.ceil(this.leaseMs / 1000) + 10);
    return wasOffline;
  }

  async renew(userId: string, socketId: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;
    const key = this.presenceKey(userId);
    await client.zRemRangeByScore(key, '-inf', Date.now());
    const wasOffline = (await client.zCard(key)) === 0;
    await client.zAdd(key, {
      score: Date.now() + this.leaseMs,
      value: socketId,
    });
    await client.expire(key, Math.ceil(this.leaseMs / 1000) + 10);
    return wasOffline;
  }

  async markOffline(userId: string, socketId: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      const sockets = this.local.get(userId);
      sockets?.delete(socketId);
      if (!sockets?.size) this.local.delete(userId);
      return !sockets?.size;
    }
    const key = this.presenceKey(userId);
    await client.zRem(key, socketId);
    await client.zRemRangeByScore(key, '-inf', Date.now());
    return (await client.zCard(key)) === 0;
  }

  async isOnline(userId: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return Boolean(this.local.get(userId)?.size);
    const key = this.presenceKey(userId);
    await client.zRemRangeByScore(key, '-inf', Date.now());
    return (await client.zCard(key)) > 0;
  }

  async watchCloud(userId: string, cloudId: string, socketId: string) {
    const key = this.cloudWatchKey(userId, cloudId);
    const client = await this.getClient();
    if (!client) {
      const sockets = this.localCloudWatch.get(key) ?? new Set<string>();
      sockets.add(socketId);
      this.localCloudWatch.set(key, sockets);
      return;
    }
    await client.zAdd(key, {
      score: Date.now() + this.leaseMs,
      value: socketId,
    });
    await client.expire(key, Math.ceil(this.leaseMs / 1000) + 10);
  }

  async unwatchCloud(userId: string, cloudId: string, socketId: string) {
    const key = this.cloudWatchKey(userId, cloudId);
    const client = await this.getClient();
    if (!client) {
      const sockets = this.localCloudWatch.get(key);
      sockets?.delete(socketId);
      if (!sockets?.size) this.localCloudWatch.delete(key);
      return;
    }
    await client.zRem(key, socketId);
  }

  async isWatchingCloud(userId: string, cloudId: string): Promise<boolean> {
    const key = this.cloudWatchKey(userId, cloudId);
    const client = await this.getClient();
    if (!client) return Boolean(this.localCloudWatch.get(key)?.size);
    await client.zRemRangeByScore(key, '-inf', Date.now());
    return (await client.zCard(key)) > 0;
  }

  async onModuleDestroy() {
    await this.client?.disconnect();
  }

  private presenceKey(userId: string) {
    // The previous presence implementation stored integer counters at the
    // unversioned key. Keep leases in a new key to avoid Redis WRONGTYPE on deploy.
    return `chat:presence:v2:${userId}`;
  }

  private cloudWatchKey(userId: string, cloudId: string) {
    return `chat:mini-cloud:${userId}:${cloudId}`;
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
