import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CloudStatus, CloudVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RECOMMENDATION_HOURS = new Set([9, 15, 21]);
const TIME_ZONE = 'America/Sao_Paulo';

type RecommendationSlot = { key: string; hour: number };

@Injectable()
export class CloudInterestRecommendationsService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastCheckedSlot: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  onModuleInit() {
    void this.sendScheduledRecommendations();
    this.timer = setInterval(
      () => void this.sendScheduledRecommendations(),
      CHECK_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private currentSlot(now = new Date()): RecommendationSlot | null {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const values = Object.fromEntries(
      parts
        .filter(({ type }) => type !== 'literal')
        .map(({ type, value }) => [type, value]),
    );
    const hour = Number(values.hour);
    if (!RECOMMENDATION_HOURS.has(hour)) return null;
    return {
      hour,
      key: `${values.year}-${values.month}-${values.day}-${String(hour).padStart(2, '0')}`,
    };
  }

  private async sendScheduledRecommendations() {
    const slot = this.currentSlot();
    if (!slot || this.running || this.lastCheckedSlot === slot.key) return;
    this.running = true;
    this.lastCheckedSlot = slot.key;
    try {
      const profiles = await this.prisma.profile.findMany({
        where: {
          interests: { isEmpty: false },
          interestsOnboardingRequired: false,
          user: { status: 'active', deletedAt: null },
        },
        select: { userId: true, interests: true },
      });
      await Promise.all(
        profiles.map((profile) =>
          this.sendRecommendationForUser(profile.userId, profile.interests, slot),
        ),
      );
    } finally {
      this.running = false;
    }
  }

  private async sendRecommendationForUser(
    userId: string,
    interests: string[],
    slot: RecommendationSlot,
  ) {
    const followed = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const excludedAuthorIds = [userId, ...followed.map(({ followingId }) => followingId)];
    const previous = await this.prisma.cloudInterestRecommendationDelivery.findMany({
      where: { userId },
      select: { cloudId: true },
    });
    const cloud = await this.prisma.cloud.findFirst({
      where: {
        authorId: { notIn: excludedAuthorIds },
        id: { notIn: previous.map(({ cloudId }) => cloudId) },
        primaryTopic: { in: interests },
        visibility: CloudVisibility.public,
        status: CloudStatus.active,
        deletedAt: null,
        startedAt: { lte: new Date() },
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, primaryTopic: true },
    });
    if (!cloud) return;

    try {
      const notification = await this.prisma.$transaction(async (tx) => {
        await tx.cloudInterestRecommendationDelivery.create({
          data: { userId, cloudId: cloud.id, slotKey: slot.key },
        });
        return tx.notification.create({
          data: {
            userId,
            type: 'cloud_recommendation',
            entityType: 'cloud',
            entityId: cloud.id,
            title: 'Uma Cloud para você',
            body: `“${cloud.title}” combina com seus interesses.`,
            metadata: { topic: cloud.primaryTopic, forYou: true },
          },
        });
      });
      await this.pushNotifications.send(userId, {
        title: notification.title,
        body: notification.body,
        url: `/cloud/${cloud.id}`,
        tag: notification.id,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
  }
}
