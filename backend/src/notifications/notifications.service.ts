import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { UsersService } from '../users/users.service';
import {
  NotificationPayload,
  NotificationsListResponse,
} from './notifications.types';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  async list(
    token: string | null,
    includeAll = false,
  ): Promise<NotificationsListResponse> {
    const current = await this.requireSession(token);

    const items = await this.prisma.notification.findMany({
      where: { userId: current.user.id, type: { not: 'direct_message' } },
      orderBy: { createdAt: 'desc' },
      take: includeAll ? 100 : 10,
    });

    const actorIds = [
      ...new Set(
        items.flatMap((item) => {
          if (item.entityType === 'user' || item.entityType === 'follow')
            return [item.entityId];
          if (
            item.type === 'cloud_continuation' &&
            item.metadata &&
            typeof item.metadata === 'object' &&
            !Array.isArray(item.metadata)
          ) {
            return typeof item.metadata.actorUserId === 'string'
              ? [item.metadata.actorUserId]
              : [];
          }
          return [];
        }),
      ),
    ];

    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          include: { profile: true },
        })
      : [];

    const actorById = new Map(
      actors.flatMap((user) => {
        if (!user.profile) {
          return [];
        }

        return [
          [
            user.id,
            {
              id: user.id,
              username: user.profile.username,
              displayName: user.profile.displayName,
              avatarUrl: user.profile.avatarUrl,
              profileUrl: `/users/${user.profile.username}`,
            },
          ],
        ];
      }),
    );

    const notifications: NotificationPayload[] = items.map((item) => ({
      id: item.id,
      type: item.type,
      entityType: item.entityType,
      entityId: item.entityId,
      title: item.title,
      body: item.body,
      metadata:
        item.metadata &&
        typeof item.metadata === 'object' &&
        !Array.isArray(item.metadata)
          ? Object.fromEntries(
              Object.entries(item.metadata).filter(
                (entry): entry is [string, string] =>
                  typeof entry[1] === 'string',
              ),
            )
          : null,
      isRead: item.isRead,
      createdAt: item.createdAt.toISOString(),
      actor:
        actorById.get(item.entityId) ??
        (item.metadata &&
        typeof item.metadata === 'object' &&
        !Array.isArray(item.metadata) &&
        typeof item.metadata.actorUserId === 'string'
          ? actorById.get(item.metadata.actorUserId)
          : undefined) ??
        null,
    }));

    const unreadCount = await this.prisma.notification.count({
      where: {
        userId: current.user.id,
        isRead: false,
        type: { not: 'direct_message' },
      },
    });

    return {
      ok: true,
      notifications,
      unreadCount,
    };
  }

  async markAllAsRead(token: string | null): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    await this.prisma.notification.updateMany({
      where: {
        userId: current.user.id,
        isRead: false,
        type: { not: 'direct_message' },
      },
      data: { isRead: true },
    });

    return { ok: true };
  }

  async pushPublicKey(token: string | null) {
    await this.requireSession(token);
    return { ok: true, publicKey: this.pushNotifications.publicKey() };
  }

  async savePushSubscription(
    token: string | null,
    subscription: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    },
  ) {
    const current = await this.requireSession(token);
    const endpoint = subscription.endpoint?.trim();
    const p256dh = subscription.keys?.p256dh?.trim();
    const auth = subscription.keys?.auth?.trim();
    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException({
        message: 'Inscrição de notificações inválida.',
      });
    }
    await this.pushNotifications.saveSubscription(current.user.id, {
      endpoint,
      keys: { p256dh, auth },
    });
    return { ok: true };
  }

  async removePushSubscription(token: string | null, endpoint?: string) {
    const current = await this.requireSession(token);
    if (!endpoint?.trim()) {
      throw new BadRequestException({
        message: 'Inscrição de notificações inválida.',
      });
    }
    await this.pushNotifications.removeSubscription(
      current.user.id,
      endpoint.trim(),
    );
    return { ok: true };
  }

  async acceptFollowRequest(token: string | null, notificationId: string) {
    const notification = await this.requireFollowRequestNotification(
      token,
      notificationId,
    );
    return this.usersService.acceptFollowRequest(token, notification.entityId);
  }

  async declineFollowRequest(token: string | null, notificationId: string) {
    const notification = await this.requireFollowRequestNotification(
      token,
      notificationId,
    );
    return this.usersService.declineFollowRequest(token, notification.entityId);
  }

  private async requireFollowRequestNotification(
    token: string | null,
    notificationId: string,
  ) {
    const current = await this.requireSession(token);
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: current.user.id,
      },
    });

    if (!notification) {
      throw new NotFoundException({
        message: 'Notificação não encontrada.',
      });
    }

    if (notification.type !== 'follow_request') {
      throw new BadRequestException({
        message: 'Esta notificação não é uma solicitação para seguir.',
      });
    }

    return notification;
  }

  private async requireSession(token: string | null) {
    if (!token) {
      throw new UnauthorizedException({
        message: 'Sessão não encontrada.',
      });
    }

    const session = await this.authService.resolveSession(token);

    if (!session) {
      throw new UnauthorizedException({
        message: 'Sessão não encontrada.',
      });
    }

    return session;
  }
}
