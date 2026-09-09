import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { NotificationPayload, NotificationsListResponse } from './notifications.types';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async list(token: string | null, includeAll = false): Promise<NotificationsListResponse> {
    const current = await this.requireSession(token);

    const items = await this.prisma.notification.findMany({
      where: { userId: current.user.id },
      orderBy: { createdAt: 'desc' },
      ...(includeAll ? {} : { take: 10 }),
    });

    const actorIds = [...new Set(
      items
        .filter((item) => item.type === 'follow' || item.type === 'follow_request')
        .map((item) => item.entityId),
    )];

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

        return [[user.id, {
          id: user.id,
          username: user.profile.username,
          displayName: user.profile.displayName,
          avatarUrl: user.profile.avatarUrl,
          profileUrl: `/users/${user.profile.username}`,
        }]];
      }),
    );

    const notifications: NotificationPayload[] = items.map((item) => ({
      id: item.id,
      type: item.type,
      entityType: item.entityType,
      entityId: item.entityId,
      title: item.title,
      body: item.body,
      isRead: item.isRead,
      createdAt: item.createdAt.toISOString(),
      actor: actorById.get(item.entityId) ?? null,
    }));

    const unreadCount = await this.prisma.notification.count({
      where: { userId: current.user.id, isRead: false },
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
      where: { userId: current.user.id, isRead: false },
      data: { isRead: true },
    });

    return { ok: true };
  }

  async acceptFollowRequest(token: string | null, notificationId: string) {
    const notification = await this.requireFollowRequestNotification(token, notificationId);
    return this.usersService.acceptFollowRequest(token, notification.entityId);
  }

  async declineFollowRequest(token: string | null, notificationId: string) {
    const notification = await this.requireFollowRequestNotification(token, notificationId);
    return this.usersService.declineFollowRequest(token, notification.entityId);
  }

  private async requireFollowRequestNotification(token: string | null, notificationId: string) {
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
