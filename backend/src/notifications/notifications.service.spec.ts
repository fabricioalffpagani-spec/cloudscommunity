import { NotificationsService } from './notifications.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';

describe('activity notifications', () => {
  it('resolves the actor of a recloud notification', async () => {
    const findActors = jest.fn().mockResolvedValue([
      {
        id: 'actor',
        profile: { username: 'ana', displayName: 'Ana', avatarUrl: 'avatar' },
      },
    ]);
    const service = new NotificationsService(
      {
        notification: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'n',
              type: 'cloud_recloud',
              entityType: 'cloud',
              entityId: 'cloud',
              title: 'Novo Recloud',
              body: 'Ana republicou sua cloud em seu perfil',
              metadata: { actorUserId: 'actor' },
              isRead: false,
              createdAt: new Date(),
            },
          ]),
          count: jest.fn().mockResolvedValue(1),
        },
        user: { findMany: findActors },
      } as unknown as PrismaService,
      {
        resolveSession: jest
          .fn()
          .mockResolvedValue({ user: { id: 'recipient' } }),
      } as unknown as AuthService,
      {} as UsersService,
      {} as PushNotificationsService,
    );
    const result = await service.list('token');
    expect(findActors).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['actor'] } } }),
    );
    expect(result.notifications[0].actor).toMatchObject({
      displayName: 'Ana',
      avatarUrl: 'avatar',
      profileUrl: '/users/ana',
    });
  });
  it('resolves the profile for a user notification', async () => {
    const service = new NotificationsService(
      {
        notification: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'n',
              userId: 'recipient',
              type: 'system',
              entityType: 'user',
              entityId: 'actor',
              title: 'Convite',
              body: 'Entrou',
              metadata: null,
              isRead: false,
              createdAt: new Date(),
            },
          ]),
          count: jest.fn().mockResolvedValue(1),
        },
        user: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'actor',
              profile: {
                username: 'ana',
                displayName: 'Ana',
                avatarUrl: null,
              },
            },
          ]),
        },
      } as unknown as PrismaService,
      {
        resolveSession: jest
          .fn()
          .mockResolvedValue({ user: { id: 'recipient' } }),
      } as unknown as AuthService,
      {} as UsersService,
      {} as PushNotificationsService,
    );
    const result = await service.list('token');
    expect(result.notifications[0].actor?.profileUrl).toBe('/users/ana');
  });
  it('excludes existing direct messages from the bell and unread count', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new NotificationsService(
      {
        notification: { findMany, count, updateMany },
      } as unknown as PrismaService,
      {
        resolveSession: jest
          .fn()
          .mockResolvedValue({ user: { id: 'recipient' } }),
      } as unknown as AuthService,
      {} as UsersService,
      {} as PushNotificationsService,
    );

    await service.list('token');
    await service.markAllAsRead('token');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'recipient', type: { not: 'direct_message' } },
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: 'recipient',
        isRead: false,
        type: { not: 'direct_message' },
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'recipient',
        isRead: false,
        type: { not: 'direct_message' },
      },
      data: { isRead: true },
    });
  });
});
