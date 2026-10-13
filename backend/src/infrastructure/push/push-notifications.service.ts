import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  messageId?: string;
  unreadMessages?: string[];
  badgeCount?: number;
  kind?: 'cloud_message';
  cloudId?: string;
};

const DELIVERY_OPTIONS = {
  TTL: 10 * 60,
  urgency: 'high',
  timeout: 15_000,
} as const;

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly enabled: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject =
      process.env.VAPID_SUBJECT?.trim() || 'mailto:suporte@clouds.community';
    this.enabled = Boolean(publicKey && privateKey);
    if (this.enabled) webpush.setVapidDetails(subject, publicKey!, privateKey!);
    else
      this.logger.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes; push externo desativado.',
      );
  }

  publicKey() {
    return process.env.VAPID_PUBLIC_KEY?.trim() || null;
  }

  async saveSubscription(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async removeSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async send(userId: string, message: PushMessage) {
    if (!this.enabled) return;
    const [subscriptions, badgeCount] = await Promise.all([
      this.prisma.pushSubscription.findMany({ where: { userId } }),
      this.prisma.notification.count({
        where: { userId, isRead: false, type: { not: 'direct_message' } },
      }),
    ]);
    await Promise.all(
      subscriptions.map(async (subscription) => {
        const payload = JSON.stringify({
          ...message,
          badgeCount,
        });
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            DELIVERY_OPTIONS,
          );
        } catch (error: unknown) {
          const statusCode =
            typeof error === 'object' && error && 'statusCode' in error
              ? (error as { statusCode?: number }).statusCode
              : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: subscription.id } })
              .catch(() => undefined);
          } else {
            this.logger.warn(
              `Falha no envio push (HTTP ${statusCode ?? 'desconhecido'}).`,
            );
          }
        }
      }),
    );
  }
}
