import { UsersService } from './users.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';

describe('creator results', () => {
  it('summarizes profile visits, For You reach and access rate without exposing visitors', async () => {
    const afterRecommendation = new Date('2026-11-02T10:00:00.000Z');
    const recommendationAt = new Date('2026-11-01T10:00:00.000Z');
    const prisma = {
      cloud: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cloud-1',
            title: 'Cloud com alcance',
            _count: { members: 7, hypes: 4 },
          },
          {
            id: 'cloud-2',
            title: 'Cloud menor',
            _count: { members: 2, hypes: 6 },
          },
        ]),
      },
      profileVisit: { count: jest.fn().mockResolvedValue(18) },
      follow: {
        count: jest.fn().mockResolvedValueOnce(44).mockResolvedValueOnce(5),
      },
      cloudHype: { count: jest.fn().mockResolvedValue(10) },
      cloudMessage: { count: jest.fn().mockResolvedValue(71) },
      cloudMember: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { userId: 'reader-a' },
            { userId: 'reader-b' },
          ])
          .mockResolvedValueOnce([
            {
              cloudId: 'cloud-1',
              userId: 'reader-a',
              joinedAt: afterRecommendation,
            },
            {
              cloudId: 'cloud-2',
              userId: 'reader-b',
              joinedAt: new Date('2026-10-31T10:00:00.000Z'),
            },
          ]),
      },
      cloudForYouImpression: {
        findMany: jest.fn().mockResolvedValue([
          {
            cloudId: 'cloud-1',
            userId: 'reader-a',
            firstSeenAt: recommendationAt,
          },
          {
            cloudId: 'cloud-2',
            userId: 'reader-b',
            firstSeenAt: recommendationAt,
          },
        ]),
      },
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      {
        resolveSession: jest
          .fn()
          .mockResolvedValue({ user: { id: 'owner', isGuest: false } }),
      } as unknown as AuthService,
      {} as PushNotificationsService,
      {} as DirectMessagesGateway,
    );

    await expect(service.getCreatorResults('token')).resolves.toEqual({
      ok: true,
      results: {
        profileVisitors: 18,
        forYouReach: 2,
        forYouAccessRate: 50,
        forYouAccesses: 1,
        followers: 44,
        newFollowersLast30Days: 5,
        totalClouds: 2,
        uniqueCloudVisitors: 2,
        totalHypes: 10,
        totalMessages: 71,
        bestCloud: { title: 'Cloud com alcance', participants: 7, hypes: 4 },
      },
    });
  });
});
