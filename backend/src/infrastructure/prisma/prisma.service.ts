import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { getRequiredEnv } from '../../shared/runtime-env';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg(getRequiredEnv('PGX_CONN_STR'));
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      // Don't throw error to allow app to start without database for development
      console.warn('Application will run without database connection. Some features may not work.');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
