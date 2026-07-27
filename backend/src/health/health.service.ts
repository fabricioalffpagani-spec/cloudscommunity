import { Injectable } from '@nestjs/common';
import * as net from 'node:net';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

type ProbeResult = {
  healthy: boolean;
  error?: string;
};

type HealthReport = {
  healthy: boolean;
  checkedAt: string;
  postgres: ProbeResult;
  redis: ProbeResult;
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(): Promise<HealthReport> {
    const postgres = await this.checkPostgres();
    const redis = await this.checkRedis();

    return {
      healthy: postgres.healthy && redis.healthy,
      checkedAt: new Date().toISOString(),
      postgres,
      redis,
    };
  }

  private async checkPostgres(): Promise<ProbeResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: this.describeError(error) };
    }
  }

  private async checkRedis(): Promise<ProbeResult> {
    const endpoint = process.env.CACHE_NODE_ENDPOINT?.trim();

    if (!endpoint) {
      return {
        healthy: false,
        error: 'CACHE_NODE_ENDPOINT is missing',
      };
    }

    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return {
        healthy: false,
        error: 'CACHE_NODE_ENDPOINT is invalid',
      };
    }

    const host = url.hostname;
    const port = Number(url.port || 6379);

    return new Promise<ProbeResult>((resolve) => {
      const socket = new net.Socket();
      const finish = (result: ProbeResult) => {
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(1500);
      socket.once('connect', () => finish({ healthy: true }));
      socket.once('timeout', () =>
        finish({ healthy: false, error: 'Redis connection timed out' }),
      );
      socket.once('error', (error) =>
        finish({ healthy: false, error: this.describeError(error) }),
      );
      socket.connect(port, host);
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
