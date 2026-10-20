import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CloudStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';

const INTERVAL_MS = 30_000;
const FIVE_MINUTES_MS = 5 * 60_000;
const DURATIONS: Record<string, number> = {
  '5min': 5 * 60_000,
  '10min': 10 * 60_000,
  '30min': 30 * 60_000,
  '1h': 60 * 60_000,
  '2h': 2 * 60 * 60_000,
  '5h': 5 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

@Injectable()
export class CloudEndingNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CloudEndingNotificationsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
  ) {}

  onModuleInit() {
    void this.check();
    this.timer = setInterval(() => void this.check(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async check() {
    if (this.running) return;
    this.running = true;
    try {
      const now = Date.now();
      const clouds = await this.prisma.cloud.findMany({
        where: {
          status: CloudStatus.active,
          deletedAt: null,
          OR: [
            { startedAt: { lte: new Date(now) } },
            { startedAt: null, createdAt: { lte: new Date(now) } },
          ],
        },
        select: {
          id: true,
          title: true,
          authorId: true,
          duration: true,
          startedAt: true,
          createdAt: true,
          members: { where: { leftAt: null }, select: { userId: true } },
        },
      });
      for (const cloud of clouds) {
        const duration = DURATIONS[cloud.duration] ?? 30 * 60_000;
        const remaining =
          (cloud.startedAt ?? cloud.createdAt).getTime() + duration - now;
        if (remaining <= 0 || remaining > FIVE_MINUTES_MS) continue;
        for (const member of cloud.members) {
          if (member.userId === cloud.authorId) continue;
          try {
            const notification = await this.prisma.$transaction(async (tx) => {
              await tx.cloudEndingDelivery.create({
                data: { cloudId: cloud.id, userId: member.userId },
              });
              return tx.notification.create({
                data: {
                  userId: member.userId,
                  type: 'system',
                  entityType: 'cloud',
                  entityId: cloud.id,
                  title: 'Clouds',
                  body: `A cloud ${cloud.title} está se encerrando...`,
                },
              });
            });
            await this.push.send(member.userId, {
              title: notification.title,
              body: notification.body,
              url: `/cloud/${cloud.id}`,
              tag: `cloud-ending-${cloud.id}`,
            });
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            )
              continue;
            this.logger.error(
              `Falha ao notificar encerramento da Cloud ${cloud.id}`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Falha ao verificar encerramento de Clouds',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
