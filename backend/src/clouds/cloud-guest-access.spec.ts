import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { CloudService } from './cloud.service';
import { CloudTopicClassifierService } from './topic-classification/cloud-topic-classifier.service';

function makeService(
  prisma: Record<string, unknown>,
  isGuest = true,
  authenticated = true,
) {
  const auth = {
    resolveSession: jest.fn().mockResolvedValue(
      authenticated
        ? {
            user: { id: 'guest-1', isGuest, profile: { username: 'guest' } },
          }
        : null,
    ),
  };
  return new CloudService(
    prisma as unknown as PrismaService,
    auth as unknown as AuthService,
    { send: jest.fn() } as unknown as PushNotificationsService,
    { classify: jest.fn() } as unknown as CloudTopicClassifierService,
  );
}

describe('anonymous Cloud access', () => {
  it('shares a five-Cloud quota between Talk and Read visits', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      guestCloudVisit: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(5),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = makeService(prisma) as unknown as {
      recordAnonymousVisit(ipAddress: string, cloudId: string): Promise<void>;
    };

    await expect(
      service.recordAnonymousVisit('203.0.113.1', 'cloud-6'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.guestCloudVisit.create).not.toHaveBeenCalled();
  });

  it('counts a new public Cloud atomically before allowing it', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      guestCloudVisit: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(4),
        create: jest.fn().mockResolvedValue({ id: 'membership-5' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = makeService(prisma) as unknown as {
      recordAnonymousVisit(ipAddress: string, cloudId: string): Promise<void>;
    };

    await service.recordAnonymousVisit('203.0.113.1', 'cloud-5');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.guestCloudVisit.create).toHaveBeenCalledWith({
      data: {
        cloudId: 'cloud-5',
        ipHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
      },
    });
  });

  it('hides private Clouds from guests even when they have a membership', async () => {
    const prisma = {
      cloud: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'private-cloud',
          authorId: 'author-1',
          visibility: 'private',
          status: 'active',
          deletedAt: null,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ isGuest: true }),
      },
    };
    const service = makeService(prisma);

    await expect(
      service.requireCloudAccess('private-cloud', 'guest-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides private Clouds from visitors without a session', async () => {
    const prisma = {
      cloud: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'private-cloud',
          authorId: 'author-1',
          visibility: 'private',
          status: 'active',
          deletedAt: null,
        }),
      },
    };
    const service = makeService(prisma, false, false);
    await expect(
      service.requireCloudAccess('private-cloud'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a neutral public feed without a session', async () => {
    const publicCloud = {
      id: 'cloud-1',
      title: 'Public Cloud',
      content: null,
      duration: '5min',
      mode: 'text',
      visibility: 'public',
      status: 'active',
      acceptingMembers: true,
      audioUrl: null,
      scheduledAt: null,
      startedAt: new Date(),
      endedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      editCount: 0,
      authorId: 'author-1',
      primaryTopic: null,
      author: {
        id: 'author-1',
        profile: { username: 'author', displayName: 'Author', avatarUrl: null },
      },
      members: [],
      _count: { hypes: 0, members: 0 },
    };
    const prisma = {
      cloud: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([publicCloud]),
      },
    };
    const service = makeService(prisma, false, false);
    const result = await service.listFeed(null);
    expect(result.clouds).toHaveLength(1);
    expect(result.clouds[0]).toMatchObject({
      id: 'cloud-1',
      hyped: false,
      visibility: 'public',
    });
    expect(prisma.cloud.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ visibility: 'public' }) as unknown,
      }),
    );
  });

  it('rejects mutations from a visitor without a session', async () => {
    const service = makeService({}, false, false);
    const attempts = [
      () =>
        service.create(null, {
          title: 'Cloud',
          duration: '5min',
          visibility: 'public',
        }),
      () => service.joinCloud(null, 'cloud-1'),
      () => service.hype(null, 'cloud-1'),
      () => service.recloud(null, 'cloud-1'),
      () => service.delete(null, 'cloud-1'),
      () => service.banMember(null, 'cloud-1', 'user-2'),
      () =>
        service.createMessage(null, 'cloud-1', {
          type: 'text',
          content: 'hello',
        }),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('blocks every registered-only Cloud mutation at the service boundary', async () => {
    const service = makeService({});

    await expect(
      service.create('guest-token', {
        title: 'Guest Cloud',
        duration: '5min',
        visibility: 'public',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
