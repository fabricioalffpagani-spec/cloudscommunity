import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';

const CHECK_INTERVAL_MS = 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const FIRST_REMINDER_AFTER_MS = 2 * DAY_MS;
const SECOND_REMINDER_AFTER_MS = 3 * DAY_MS;

@Injectable()
export class CloudInactivityNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    CloudInactivityNotificationsService.name,
  );
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  onModuleInit() {
    void this.check();
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async check(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      // The first item for each author is their most recently published Cloud.
      // A later Cloud automatically starts a fresh reminder cycle because it has
      // a different id from the delivery records tied to the previous one.
      const lastClouds = await this.prisma.cloud.findMany({
        where: {
          author: { status: 'active', deletedAt: null },
          deletedAt: null,
          status: { not: 'deleted' },
          OR: [
            { startedAt: { lte: now } },
            { startedAt: null, createdAt: { lte: now } },
          ],
        },
        select: { id: true, authorId: true, createdAt: true, startedAt: true },
        distinct: ['authorId'],
        orderBy: [
          { authorId: 'asc' },
          { startedAt: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      for (const cloud of lastClouds) {
        await this.sendDueReminder(cloud, now);
      }
    } catch (error) {
      this.logger.error(
        'Falha ao verificar usuários sem novas Clouds',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private async sendDueReminder(
    cloud: {
      id: string;
      authorId: string;
      createdAt: Date;
      startedAt?: Date | null;
    },
    now: Date,
  ) {
    const deliveries = await this.prisma.cloudInactivityDelivery.findMany({
      where: { userId: cloud.authorId, lastCloudId: cloud.id },
      select: { stage: true, sentAt: true },
    });
    const firstReminder = deliveries.find((delivery) => delivery.stage === 1);
    const secondReminder = deliveries.find((delivery) => delivery.stage === 2);
    if (secondReminder) return;

    const elapsedMs =
      now.getTime() - (cloud.startedAt ?? cloud.createdAt).getTime();
    if (elapsedMs < FIRST_REMINDER_AFTER_MS) return;
    const stage = !firstReminder
      ? 1
      : elapsedMs >= SECOND_REMINDER_AFTER_MS &&
          now.getTime() - firstReminder.sentAt.getTime() >= DAY_MS
        ? 2
        : null;
    if (!stage) return;

    const daysWithoutPosting = Math.floor(elapsedMs / DAY_MS);
    const body = `Faz ${daysWithoutPosting} dias desde a sua última cloud, bora trocar uma ideia de novo?`;

    try {
      const notification = await this.prisma.$transaction(async (tx) => {
        await tx.cloudInactivityDelivery.create({
          data: {
            userId: cloud.authorId,
            lastCloudId: cloud.id,
            stage,
            sentAt: now,
          },
        });
        return tx.notification.create({
          data: {
            userId: cloud.authorId,
            type: 'cloud_inactivity',
            entityType: 'user',
            entityId: cloud.authorId,
            title: 'Bora trocar uma ideia?',
            body,
            metadata: {
              daysWithoutPosting: String(daysWithoutPosting),
              reminderStage: String(stage),
              lastCloudId: cloud.id,
            },
          },
        });
      });
      await this.pushNotifications.send(cloud.authorId, {
        title: notification.title,
        body: notification.body,
        url: '/cloudscommunity',
        tag: `cloud-inactivity-${cloud.id}-${stage}`,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      this.logger.error(
        `Falha ao enviar lembrete de inatividade para ${cloud.authorId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
