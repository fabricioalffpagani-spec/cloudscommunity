import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationsService } from './push-notifications.service';

describe('PushNotificationsService delivery', () => {
  const originalPublicKey = process.env.VAPID_PUBLIC_KEY;
  const originalPrivateKey = process.env.VAPID_PRIVATE_KEY;

  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
    jest.spyOn(webpush, 'setVapidDetails').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalPublicKey === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = originalPublicKey;
    if (originalPrivateKey === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = originalPrivateKey;
  });

  function setup() {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'subscription-1',
            endpoint: 'https://example.test/push',
            p256dh: 'key',
            auth: 'auth',
          },
        ]),
        delete: jest.fn().mockResolvedValue({}),
      },
      notification: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new PushNotificationsService(
      prisma as unknown as PrismaService,
    );
    return { service, prisma };
  }

  it('calls the provider immediately for a Cloud', async () => {
    const { service } = setup();
    const eventAt = new Date();
    let providerAt: Date | undefined;
    const provider = jest
      .spyOn(webpush, 'sendNotification')
      .mockImplementation(() => {
        providerAt = new Date();
        return Promise.resolve({ statusCode: 201, body: '', headers: {} });
      });

    await service.send('recipient', { title: 'Cloud', body: 'Criada' });

    expect(providerAt).toBeDefined();
    expect(providerAt!.getTime() - eventAt.getTime()).toBeLessThan(1000);
    expect(provider.mock.calls[0][2]).toEqual({
      TTL: 600,
      urgency: 'high',
      timeout: 15_000,
    });
  });

  it('keeps the same Web Push delivery options for grouped direct messages', async () => {
    const { service } = setup();
    const provider = jest
      .spyOn(webpush, 'sendNotification')
      .mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    await service.send('recipient', {
      title: 'Ana: Tudo bem?',
      body: 'Tudo bem?',
      tag: 'direct-message-conversation-1',
      messageId: 'message-2',
      unreadMessages: ['Oi', 'Tudo bem?'],
    });

    const payload = JSON.parse(provider.mock.calls[0][1] as string) as {
      title: string;
      body: string;
      tag: string;
      messageId: string;
      unreadMessages: string[];
    };
    expect(payload).toEqual(
      expect.objectContaining({
        title: 'Ana: Tudo bem?',
        body: 'Tudo bem?',
        tag: 'direct-message-conversation-1',
        messageId: 'message-2',
        unreadMessages: ['Oi', 'Tudo bem?'],
      }),
    );
    expect(provider.mock.calls[0][2]).toEqual({
      TTL: 600,
      urgency: 'high',
      timeout: 15_000,
    });
  });

  it.each([404, 410])(
    'uses immediate priority and removes subscriptions rejected with HTTP %i',
    async (statusCode) => {
      const { service, prisma } = setup();
      const provider = jest
        .spyOn(webpush, 'sendNotification')
        .mockRejectedValue({ statusCode });

      await service.send('recipient', { title: 'Activity', body: 'Update' });

      expect(provider.mock.calls[0][2]).toEqual({
        TTL: 600,
        urgency: 'high',
        timeout: 15_000,
      });
      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'subscription-1' },
      });
    },
  );
});
