import { BadRequestException } from '@nestjs/common';
import { CloudService } from './cloud.service';
import type { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { AuthService } from '../auth/auth.service';
import type { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import type { CloudTopicClassifierService } from './topic-classification/cloud-topic-classifier.service';

const cloudId = '11111111-1111-4111-8111-111111111111';
const authorId = '22222222-2222-4222-8222-222222222222';
const mentionedId = '33333333-3333-4333-8333-333333333333';
const otherId = '44444444-4444-4444-8444-444444444444';

function setup() {
  const cloud = {
    id: cloudId,
    authorId,
    title: 'Teste',
    status: 'active',
    createdAt: new Date(),
    duration: '30min',
  };
  const prisma = {
    profile: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ userId: mentionedId, username: 'beta' }]),
    },
    cloudMember: {
      findMany: jest.fn((query: { where: { userId?: { in: string[] } } }) => {
        const { where } = query;
        return where.userId?.in
          ? [{ userId: mentionedId }]
          : [{ userId: mentionedId }, { userId: otherId }];
      }),
    },
    cloudMessage: {
      findFirst: jest.fn(),
      create: jest.fn((input: { data: Record<string, unknown> }) => ({
        ...input.data,
        id: '55555555-5555-4555-8555-555555555555',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        isSticker: false,
        replyToMessageId: null,
        replyToMessage: null,
        reactions: [],
        user: {
          id: authorId,
          profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
        },
      })),
    },
    notification: {
      create: jest.fn(
        (input: {
          data: { userId: string; type: string; metadata?: unknown };
        }) => ({
          id: `notification-${input.data.userId}`,
          ...input.data,
        }),
      ),
    },
  };
  const auth = {
    resolveSession: jest.fn().mockResolvedValue({ user: { id: authorId } }),
  };
  const push = {
    send: jest.fn(
      (
        id: string,
        payload: { cloudId?: string; kind?: string; url: string },
      ) => {
        if (!id || !payload.url) throw new Error('Push inválido no teste');
        return Promise.resolve();
      },
    ),
  };
  const service = new CloudService(
    prisma as unknown as PrismaService,
    auth as unknown as AuthService,
    push as unknown as PushNotificationsService,
    {} as CloudTopicClassifierService,
  );
  jest.spyOn(service, 'requireCloudAccess').mockResolvedValue(cloud as never);
  jest
    .spyOn(service as never, 'requireCloudMembership' as never)
    .mockResolvedValue(undefined as never);
  return { service, prisma, push };
}

describe('Cloud structured mentions', () => {
  it('rejects offsets that do not point at the selected username', async () => {
    const { service, prisma } = setup();
    await expect(
      service.createMessage('session', cloudId, {
        type: 'text',
        content: 'Olá @beta',
        mentions: [{ userId: mentionedId, username: 'beta', start: 0, end: 5 }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.cloudMessage.create).not.toHaveBeenCalled();
  });

  it('persists user IDs and sends one mention notification per recipient', async () => {
    const { service, prisma, push } = setup();
    const result = await service.createMessage('session', cloudId, {
      type: 'text',
      content: '@beta e @beta',
      mentions: [
        { userId: mentionedId, username: 'beta', start: 0, end: 5 },
        { userId: mentionedId, username: 'beta', start: 8, end: 13 },
      ],
    });
    expect(result.message.mentions).toHaveLength(2);
    expect(prisma.cloudMessage.create.mock.calls[0][0].data.mentions).toEqual(
      result.message.mentions,
    );
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    expect(
      prisma.notification.create.mock.calls.map(([input]) => input.data),
    ).toEqual([
      {
        userId: mentionedId,
        type: 'cloud_mention',
        metadata: { cloudId, messageId: result.message.id },
        entityType: 'cloud_message',
        entityId: result.message.id,
        title: 'Alpha mencionou você na Cloud Teste',
        body: '@beta e @beta',
      },
      {
        userId: otherId,
        type: 'cloud_comment',
        metadata: { cloudId, messageId: result.message.id },
        entityType: 'cloud_message',
        entityId: result.message.id,
        title: 'Nova mensagem em Teste',
        body: 'Alpha: @beta e @beta',
      },
    ]);
    expect(
      push.send.mock.calls.some(
        ([id, payload]) =>
          id === mentionedId &&
          payload.cloudId === cloudId &&
          payload.kind === 'cloud_message' &&
          payload.url === `/cloud/${cloudId}?message=${result.message.id}`,
      ),
    ).toBe(true);
  });
});
