import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { CloudService } from './cloud.service';
import { CloudTopicClassifierService } from './topic-classification/cloud-topic-classifier.service';

function makeService(prisma: Record<string, unknown>, isGuest = true) {
  const auth = {
    resolveSession: jest.fn().mockResolvedValue({
      user: { id: 'guest-1', isGuest, profile: { username: 'guest' } },
    }),
  };
  return new CloudService(
    prisma as unknown as PrismaService,
    auth as unknown as AuthService,
    { send: jest.fn() } as unknown as PushNotificationsService,
    { classify: jest.fn() } as unknown as CloudTopicClassifierService,
  );
}

describe('guest Cloud access', () => {
  it('shares a five-Cloud quota between Talk and Read visits', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      cloudMember: {
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
      recordGuestVisit(userId: string, cloudId: string): Promise<void>;
    };

    await expect(
      service.recordGuestVisit('guest-1', 'cloud-6'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.cloudMember.create).not.toHaveBeenCalled();
  });

  it('counts a new public Cloud atomically before allowing it', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      cloudMember: {
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
      recordGuestVisit(userId: string, cloudId: string): Promise<void>;
    };

    await service.recordGuestVisit('guest-1', 'cloud-5');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.cloudMember.create).toHaveBeenCalledWith({
      data: { cloudId: 'cloud-5', userId: 'guest-1', role: 'member' },
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
