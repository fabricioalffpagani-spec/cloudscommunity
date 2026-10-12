import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  messageId?: string;
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

  async send(userId: string, message: PushMessage, eventAt?: Date) {
    if (!this.enabled) return;
    const diagnostics = process.env.PUSH_TIMING_DIAGNOSTICS === '1';
    const traceId = diagnostics ? randomUUID() : undefined;
    const eventTimestamp = eventAt?.toISOString();
    const [subscriptions, badgeCount] = await Promise.all([
      this.prisma.pushSubscription.findMany({ where: { userId } }),
      this.prisma.notification.count({
        where: { userId, isRead: false, type: { not: 'direct_message' } },
      }),
    ]);
    if (diagnostics)
      this.logger.log(
        `push_timing trace=${traceId} event=${eventTimestamp ?? 'unknown'} subscriptions=${subscriptions.length}`,
      );
    await Promise.all(
      subscriptions.map(async (subscription, index) => {
        const sendAt = new Date();
        const payload = JSON.stringify({
          ...message,
          badgeCount,
          ...(diagnostics
            ? {
                pushTiming: {
                  traceId,
                  subscription: index,
                  sentAt: sendAt.toISOString(),
                },
              }
            : {}),
        });
        if (diagnostics)
          this.logger.log(
            `push_timing trace=${traceId} subscription=${index} send=${sendAt.toISOString()} event_to_send_ms=${eventAt ? sendAt.getTime() - eventAt.getTime() : 'unknown'} ttl=${DELIVERY_OPTIONS.TTL} urgency=${DELIVERY_OPTIONS.urgency}`,
          );
        try {
          const response = await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            DELIVERY_OPTIONS,
          );
          if (diagnostics)
            this.logger.log(
              `push_timing trace=${traceId} subscription=${index} response=${new Date().toISOString()} status=${response.statusCode} retries=0`,
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
          if (diagnostics)
            this.logger.warn(
              `push_timing trace=${traceId} subscription=${index} failure=${new Date().toISOString()} status=${statusCode ?? 'unknown'} retries=0 subscription_removed=${statusCode === 404 || statusCode === 410}`,
            );
        }
      }),
    );
  }
}
