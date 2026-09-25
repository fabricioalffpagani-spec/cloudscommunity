import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';

export type RedisAdapter = ReturnType<typeof createAdapter>;

@Injectable()
export class SocketIoRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SocketIoRedisService.name);
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;
  private adapter: RedisAdapter | null = null;

  async onModuleInit() {
    const endpoint = process.env.CACHE_NODE_ENDPOINT?.trim();
    if (!endpoint) {
      this.logger.warn(
        'CACHE_NODE_ENDPOINT is missing. Socket.IO will run without Redis adapter.',
      );
      return;
    }

    this.pubClient = createClient({ url: endpoint });
    this.subClient = this.pubClient.duplicate();

    this.pubClient.on('error', (error) =>
      this.logger.error(`Redis pub client error: ${this.describeError(error)}`),
    );
    this.subClient.on('error', (error) =>
      this.logger.error(`Redis sub client error: ${this.describeError(error)}`),
    );

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    this.adapter = createAdapter(this.pubClient, this.subClient);
    this.logger.log('Socket.IO Redis adapter created.');
  }

  getAdapter(): RedisAdapter | null {
    return this.adapter;
  }

  async onModuleDestroy() {
    await Promise.allSettled([
      this.pubClient?.disconnect(),
      this.subClient?.disconnect(),
    ]);
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
