import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { CloudEndingNotificationsService } from './cloud-ending-notifications.service';
import { Prisma } from '@prisma/client';

describe('CloudEndingNotificationsService', () => {
  it('notifies active participants once during the last five minutes, excluding the creator', async () => {
    const now = new Date('2026-10-20T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);
    const deliveries = new Set<string>();
    const createDelivery = jest.fn(({ data }: { data: { cloudId: string; userId: string } }) => {
      const key = `${data.cloudId}:${data.userId}`;
      if (deliveries.has(key)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
      deliveries.add(key);
    });
    const createNotification = jest.fn(({ data }: { data: { title: string; body: string } }) => data);
    const clouds = [
      { id: 'due', title: 'Assunto', authorId: 'creator', duration: '10min', startedAt: new Date(now.getTime() - 5 * 60_000), createdAt: now, members: [{ userId: 'creator' }, { userId: 'member' }] },
      { id: 'early', title: 'Cedo', authorId: 'creator', duration: '10min', startedAt: new Date(now.getTime() - 4 * 60_000), createdAt: now, members: [{ userId: 'member' }] },
      { id: 'ended', title: 'Fim', authorId: 'creator', duration: '10min', startedAt: new Date(now.getTime() - 10 * 60_000), createdAt: now, members: [{ userId: 'member' }] },
    ];
    const prisma = { cloud: { findMany: jest.fn().mockResolvedValue(clouds) }, $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({ cloudEndingDelivery: { create: createDelivery }, notification: { create: createNotification } })) };
    const push = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new CloudEndingNotificationsService(prisma as unknown as PrismaService, push as unknown as PushNotificationsService);
    try {
      await service.check();
      await service.check();
      expect(createNotification).toHaveBeenCalledTimes(1);
      expect(push.send).toHaveBeenCalledTimes(1);
      expect(push.send).toHaveBeenCalledWith('member', expect.objectContaining({ body: 'A cloud Assunto está se encerrando...', url: '/cloud/due' }));
      expect(prisma.cloud.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ members: { where: { leftAt: null }, select: { userId: true } } }) }));
    } finally { jest.useRealTimers(); }
  });
});
