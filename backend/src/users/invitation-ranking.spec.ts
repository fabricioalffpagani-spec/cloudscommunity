import { UsersService } from './users.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';

describe('invitation ranking', () => {
  it('loads the full list of shared followers while excluding blocked accounts', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        follower: {
          id: 'f1',
          profile: { username: 'ana', displayName: 'Ana', avatarUrl: null },
        },
      },
    ]);
    const service = new UsersService(
      { follow: { findMany } } as unknown as PrismaService,
      {
        resolveSession: jest.fn().mockResolvedValue({ user: { id: 'viewer' } }),
      } as unknown as AuthService,
      {} as PushNotificationsService,
      {} as DirectMessagesGateway,
    );
    Object.defineProperty(service, 'requireTargetUser', {
      value: jest.fn().mockResolvedValue({ id: 'target' }),
    });
    await expect(service.getMutualFollowers('token', 'alvo')).resolves.toEqual({
      ok: true,
      followers: [
        {
          id: 'f1',
          username: 'ana',
          displayName: 'Ana',
          avatarUrl: null,
          profileUrl: '/users/ana',
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          followingId: 'target',
          follower: expect.objectContaining({
            following: { some: { followingId: 'viewer' } },
            blockedUsers: { none: { blockedId: 'viewer' } },
            blockedByUsers: { none: { blockerId: 'viewer' } },
          }) as unknown,
        }) as unknown,
      }),
    );
  });
  it('returns the visible shared followers with each nearby suggestion', async () => {
    const mutual = [
      {
        followingId: 'target',
        follower: {
          id: 'f1',
          profile: { username: 'ana', displayName: 'Ana', avatarUrl: null },
        },
      },
      {
        followingId: 'target',
        follower: {
          id: 'f2',
          profile: { username: 'bia', displayName: 'Bia', avatarUrl: 'photo' },
        },
      },
    ];
    const findFollows = jest
      .fn()
      .mockResolvedValueOnce([{ followerId: 'f1' }, { followerId: 'f2' }])
      .mockResolvedValueOnce(mutual);
    const prisma = {
      cloudHype: { findMany: jest.fn().mockResolvedValue([]) },
      invitationReferral: { groupBy: jest.fn().mockResolvedValue([]) },
      follow: { findMany: findFollows },
      user: {
        findMany: jest.fn(({ where }: { where: { id: { in?: string[] } } }) =>
          (where.id.in ?? []).map((id) => ({ id, profile: {} })),
        ),
      },
    };
    const auth = {
      resolveSession: jest.fn().mockResolvedValue({ user: { id: 'viewer' } }),
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      auth as unknown as AuthService,
      {} as PushNotificationsService,
      {} as DirectMessagesGateway,
    );
    Object.defineProperty(service, 'mapPublicProfile', {
      value: (user: { id: string }) => Promise.resolve({ id: user.id }),
    });
    const result = await service.meet('token');
    expect(result.nearby[0]).toMatchObject({
      id: 'target',
      mutualFollowersCount: 2,
      mutualFollowers: [
        { id: 'f1', displayName: 'Ana', profileUrl: '/users/ana' },
        { id: 'f2', displayName: 'Bia', profileUrl: '/users/bia' },
      ],
    });
    expect(findFollows).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          follower: expect.objectContaining({
            deletedAt: null,
            blockedUsers: { none: { blockedId: 'viewer' } },
            blockedByUsers: { none: { blockerId: 'viewer' } },
          }) as unknown,
        }) as unknown,
      }),
    );
  });
  it('adds ten points per confirmed invitation to lifetime Cloud hypes', async () => {
    const prisma = {
      cloudHype: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { cloud: { authorId: 'cloud-author' } },
            { cloud: { authorId: 'cloud-author' } },
          ]),
      },
      invitationReferral: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { inviterUserId: 'inviter', _count: { _all: 1 } },
          ]),
      },
      follow: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findMany: jest.fn(({ where }: { where: { id: { in?: string[] } } }) =>
          (where.id.in ?? []).map((id) => ({ id, profile: {} })),
        ),
      },
    };
    const auth = {
      resolveSession: jest.fn().mockResolvedValue({ user: { id: 'viewer' } }),
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      auth as unknown as AuthService,
      {} as PushNotificationsService,
      {} as DirectMessagesGateway,
    );
    Object.defineProperty(service, 'mapPublicProfile', {
      value: (user: { id: string }) => Promise.resolve({ id: user.id }),
    });
    const result = await service.meet('token');
    expect(
      result.popularAllTime.map((entry) => [entry.id, entry.hypes]),
    ).toEqual([
      ['inviter', 10],
      ['cloud-author', 2],
    ]);
  });
});
