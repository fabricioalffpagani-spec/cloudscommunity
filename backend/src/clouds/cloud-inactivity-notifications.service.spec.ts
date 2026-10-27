import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { CloudInactivityNotificationsService } from './cloud-inactivity-notifications.service';

describe('CloudInactivityNotificationsService', () => {
  it('notifies after two inactive days, once more after three, and restarts for a new Cloud', async () => {
    const firstCloudAt = new Date('2026-10-01T12:00:00Z');
    let now = new Date('2026-10-03T12:00:00Z');
    let latestCloud = { id: 'cloud-1', authorId: 'user-1', createdAt: firstCloudAt };
    const deliveries: Array<{
      userId: string;
      lastCloudId: string;
      stage: number;
      sentAt: Date;
    }> = [];
    const createDelivery = jest.fn(
      ({ data }: { data: (typeof deliveries)[number] }) => {
        deliveries.push(data);
        return data;
      },
    );
    const createNotification = jest.fn(
      ({ data }: { data: { title: string; body: string } }) => data,
    );
    const prisma = {
      cloud: { findMany: jest.fn(async () => [latestCloud]) },
      cloudInactivityDelivery: {
        findMany: jest.fn(async ({ where }: { where: { userId: string; lastCloudId: string } }) =>
          deliveries
            .filter((delivery) => delivery.userId === where.userId && delivery.lastCloudId === where.lastCloudId)
            .map(({ stage, sentAt }) => ({ stage, sentAt })),
        ),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback({
          cloudInactivityDelivery: { create: createDelivery },
          notification: { create: createNotification },
        }),
      ),
    };
    const push = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new CloudInactivityNotificationsService(
      prisma as unknown as PrismaService,
      push as unknown as PushNotificationsService,
    );

    await service.check(now);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: 'Faz 2 dias desde a sua última cloud, bora trocar uma ideia de novo?',
          metadata: expect.objectContaining({ reminderStage: '1' }),
        }),
      }),
    );

    await service.check(new Date('2026-10-03T18:00:00Z'));
    expect(createNotification).toHaveBeenCalledTimes(1);

    now = new Date('2026-10-04T12:00:00Z');
    await service.check(now);
    expect(createNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: 'Faz 3 dias desde a sua última cloud, bora trocar uma ideia de novo?',
          metadata: expect.objectContaining({ reminderStage: '2' }),
        }),
      }),
    );

    await service.check(new Date('2026-10-05T12:00:00Z'));
    expect(createNotification).toHaveBeenCalledTimes(2);

    latestCloud = {
      id: 'cloud-2',
      authorId: 'user-1',
      createdAt: new Date('2026-10-04T12:00:00Z'),
    };
    await service.check(new Date('2026-10-06T12:00:00Z'));
    expect(createNotification).toHaveBeenCalledTimes(3);
    expect(deliveries).toContainEqual(
      expect.objectContaining({ lastCloudId: 'cloud-2', stage: 1 }),
    );
    expect(push.send).toHaveBeenCalledTimes(3);
    expect(prisma.cloud.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ['authorId'] }),
    );
  });
});
