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
    follow: {
      findMany: jest.fn().mockResolvedValue([]),
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
      findFirst: jest.fn().mockResolvedValue(null),
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
  return { service, prisma, push, auth };
}

describe('Cloud structured mentions', () => {
  it('notifies a followed user outside the Cloud without duplicating recipients', async () => {
    const { service, prisma } = setup();
    prisma.cloudMember.findMany.mockImplementation(
      (query: { where: { userId?: { in: string[] } } }) =>
        query.where.userId?.in ? [] : [{ userId: otherId }],
    );
    prisma.follow.findMany.mockResolvedValue([{ followingId: mentionedId }]);
    const result = await service.createMessage('session', cloudId, {
      type: 'text',
      content: 'Olá @beta',
      mentions: [{ userId: mentionedId, username: 'beta', start: 4, end: 9 }],
    });
    expect(result.message.mentions).toEqual([
      { userId: mentionedId, username: 'beta', start: 4, end: 9 },
    ]);
    expect(
      prisma.notification.create.mock.calls.map(([input]) => input.data.userId),
    ).toEqual([mentionedId, otherId]);
    expect(prisma.notification.create.mock.calls[0][0].data.type).toBe(
      'cloud_mention',
    );
  });

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
        type: 'cloud_activity',
        entityType: 'cloud',
        entityId: cloudId,
        title: 'Novos comentários na cloud Teste',
        body: 'Há novos comentários em “Teste”.',
        metadata: { activityVariant: 'general' },
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

  it('alternates participant activity between general and comment previews while keeping the throttle', async () => {
    const { service, prisma, push } = setup();
    prisma.cloudMember.findMany.mockReturnValue([{ userId: otherId }]);
    prisma.notification.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ metadata: { activityVariant: 'general' } });
    await service.createMessage('session', cloudId, { type: 'text', content: 'Olá pessoal' });
    expect(push.send).toHaveBeenCalledWith(otherId, expect.objectContaining({ title: 'Alguém comentou em Teste: Olá pessoal' }));

    prisma.notification.findFirst.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ metadata: { activityVariant: 'comment' } });
    await service.createMessage('session', cloudId, { type: 'text', content: 'Outra mensagem' });
    expect(push.send).toHaveBeenLastCalledWith(otherId, expect.objectContaining({ title: 'Novos comentários na cloud Teste' }));

    prisma.notification.findFirst.mockReset().mockResolvedValueOnce({ id: 'recent' });
    await service.createMessage('session', cloudId, { type: 'text', content: 'Mensagem recente' });
    expect(push.send).toHaveBeenCalledTimes(2);
  });

  it('immediately notifies the author of a directly replied comment', async () => {
    const { service, prisma, push } = setup();
    prisma.cloudMessage.findFirst.mockResolvedValue({
      id: 'reply-target',
      userId: otherId,
    });
    prisma.cloudMember.findMany.mockResolvedValue([]);

    await service.createMessage('session', cloudId, {
      type: 'text',
      content: 'Resposta',
      replyToMessageId: 'reply-target',
    });

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: otherId,
      type: 'cloud_comment',
      title: 'Alpha respondeu ao seu comentário na Cloud Teste',
    });
    expect(push.send).toHaveBeenCalledWith(
      otherId,
      expect.objectContaining({
        url: `/cloud/${cloudId}?message=55555555-5555-4555-8555-555555555555`,
      }),
    );
  });

  it('notifies only the creator for other users activity and respects the stored throttle', async () => {
    const { service, prisma, push, auth } = setup();
    prisma.notification.findFirst.mockResolvedValue(null);
    (
      service as unknown as { requireCloudAccess: jest.Mock }
    ).requireCloudAccess.mockResolvedValue({
      id: cloudId,
      authorId,
      title: 'Teste',
      status: 'active',
      createdAt: new Date(),
      duration: '30min',
    });
    auth.resolveSession.mockResolvedValue({ user: { id: otherId } });

    await service.createMessage('session', cloudId, {
      type: 'text',
      content: 'Uma nova mensagem',
    });

    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: authorId,
      type: 'cloud_activity',
      entityType: 'cloud',
      entityId: cloudId,
      title: 'Há movimentações em sua Cloud',
    });
    expect(push.send).toHaveBeenCalledWith(
      authorId,
      expect.objectContaining({ tag: `cloud-activity-${cloudId}` }),
    );

    prisma.notification.create.mockClear();
    prisma.notification.findFirst.mockResolvedValue({ id: 'recent-activity' });
    await service.createMessage('session', cloudId, {
      type: 'text',
      content: 'Outra mensagem',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
