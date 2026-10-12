import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CloudStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';

const PREMIERE_POLL_INTERVAL_MS = 30_000;

@Injectable()
export class CloudPremiereNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  onModuleInit() {
    void this.notifyDueClouds();
    this.timer = setInterval(
      () => void this.notifyDueClouds(),
      PREMIERE_POLL_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async notifyDueClouds() {
    if (this.running) return;
    this.running = true;
    try {
      const clouds = await this.prisma.cloud.findMany({
        where: {
          status: CloudStatus.active,
          deletedAt: null,
          scheduledAt: { lte: new Date() },
        },
        select: {
          id: true,
          title: true,
          members: { where: { leftAt: null }, select: { userId: true } },
        },
      });

      await Promise.all(
        clouds.flatMap((cloud) =>
          cloud.members.map(async ({ userId }) => {
            const notification = await this.createPremiereNotification(
              cloud.id,
              cloud.title,
              userId,
            );
            if (!notification) return;
            await this.pushNotifications.send(userId, {
              title: notification.title,
              body: notification.body,
              url: `/cloud/${cloud.id}?join=1`,
              tag: notification.id,
            });
          }),
        ),
      );
    } finally {
      this.running = false;
    }
  }

  private async createPremiereNotification(
    cloudId: string,
    cloudTitle: string,
    userId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.cloudPremiereDelivery.create({ data: { cloudId, userId } });
        return tx.notification.create({
          data: {
            userId,
            type: 'system',
            entityType: 'cloud',
            entityId: cloudId,
            title: 'Sua Cloud estreou',
            body: `“${cloudTitle}” acabou de começar. Entre para participar.`,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }
}
