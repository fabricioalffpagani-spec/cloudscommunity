import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CloudService } from './cloud.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { CloudTopicClassifierService } from './topic-classification/cloud-topic-classifier.service';

const cloudId = '12345678-1234-1234-1234-123456789012';
function setup() {
  const cloud = {
    id: cloudId,
    authorId: 'author',
    status: 'ended',
    visibility: 'public',
    title: 'Topic',
    duration: '10min',
    editCount: 0,
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
    startedAt: null,
    endedAt: new Date(),
    author: {
      id: 'author',
      profile: { displayName: 'Author', username: 'author', isPrivate: false },
    },
    members: [],
    _count: { hypes: 0, members: 0, messages: 12 },
  };
  const prisma = {
    cloud: {
      findMany: jest
        .fn<Promise<unknown>, [Prisma.CloudFindManyArgs]>()
        .mockResolvedValue([]),
      findFirst: jest
        .fn<Promise<unknown>, unknown[]>()
        .mockResolvedValue(cloud),
      update: jest.fn<Promise<unknown>, unknown[]>(),
    },
    cloudMessage: {
      findFirst: jest.fn<Promise<unknown>, unknown[]>(),
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      create: jest.fn<Promise<unknown>, unknown[]>(),
      update: jest.fn<Promise<unknown>, unknown[]>(),
    },
    cloudMessageView: {
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
    },
    userBlock: {
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      findFirst: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue(null),
    },
    cloudHype: {
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
    },
    cloudShare: {
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
    },
    profile: {
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
    },
    cloudMember: {
      create: jest.fn<Promise<unknown>, unknown[]>(),
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      findFirst: jest.fn<Promise<unknown>, unknown[]>(),
      update: jest.fn<Promise<unknown>, unknown[]>(),
      updateMany: jest.fn<Promise<unknown>, unknown[]>(),
    },
    cloudBan: {
      findUnique: jest
        .fn<Promise<unknown>, unknown[]>()
        .mockResolvedValue(null),
      upsert: jest.fn<Promise<unknown>, unknown[]>(),
    },
    follow: {
      findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
    },
  };
  const auth = {
    resolveSession: jest
      .fn<Promise<unknown>, unknown[]>()
      .mockResolvedValue({ user: { id: 'viewer' } }),
  };
  return {
    service: new CloudService(
      prisma as unknown as PrismaService,
      auth as unknown as AuthService,
      { send: jest.fn() } as unknown as PushNotificationsService,
      { classify: jest.fn() } as unknown as CloudTopicClassifierService,
    ),
    prisma,
    auth,
    cloud,
  };
}

describe('structured Cloud mentions', () => {
  const memberId = '11111111-1111-4111-8111-111111111111';
  const followedId = '22222222-2222-4222-8222-222222222222';
  const outsiderId = '33333333-3333-4333-8333-333333333333';
  type Mention = {
    userId: string;
    username: string;
    start: number;
    end: number;
  };
  const validate = (
    service: CloudService,
    content: string,
    mentions: Mention[],
  ) =>
    (
      service as unknown as {
        validateMentions: (
          cloud: { id: string; authorId: string },
          authorId: string,
          content: string,
          mentions: Mention[],
        ) => Promise<Mention[]>;
      }
    ).validateMentions(
      { id: cloudId, authorId: 'author' },
      'viewer',
      content,
      mentions,
    );

  it('accepts a Cloud member and a followed user outside the Cloud in one message', async () => {
    const { service, prisma } = setup();
    prisma.profile.findMany.mockResolvedValue([
      { userId: memberId, username: 'member' },
      { userId: followedId, username: 'followed' },
    ]);
    prisma.cloudMember.findMany.mockResolvedValue([{ userId: memberId }]);
    prisma.follow.findMany.mockResolvedValue([{ followingId: followedId }]);
    const content = '@member e @followed';
    const mentions = [
      { userId: memberId, username: 'member', start: 0, end: 7 },
      { userId: followedId, username: 'followed', start: 10, end: 19 },
    ];
    await expect(validate(service, content, mentions)).resolves.toEqual(
      mentions,
    );
  });

  it('rejects an unrelated user even when the username exists', async () => {
    const { service, prisma } = setup();
    prisma.profile.findMany.mockResolvedValue([
      { userId: outsiderId, username: 'outsider' },
    ]);
    await expect(
      validate(service, '@outsider', [
        { userId: outsiderId, username: 'outsider', start: 0, end: 9 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('Talk / Read regression', () => {
  it('lists active public clouds and private clouds for invited members', async () => {
    const { service, prisma } = setup();
    await service.listFeed('token');
    expect(prisma.cloud.findMany.mock.calls[1][0].where).toMatchObject({
      status: 'active',
      deletedAt: null,
    });
    expect(prisma.cloud.findMany.mock.calls[1][0].where?.OR).toEqual(
      expect.arrayContaining([
        { authorId: 'viewer' },
        {
          visibility: 'private',
          members: { some: { userId: 'viewer' } },
        },
        expect.objectContaining({ visibility: 'public' }),
      ]),
    );
  });
  it('filters active Talk clouds to followed authors and excludes inaccessible clouds', async () => {
    const { service, prisma, cloud } = setup();
    cloud.status = 'active';
    prisma.follow.findMany.mockResolvedValue([{ followingId: 'author' }]);
    prisma.cloud.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([cloud]);
    const result = await service.listFollowing('token');
    expect(prisma.cloud.findMany.mock.calls[1][0].where).toMatchObject({
      status: 'active',
      visibility: 'public',
      authorId: { in: ['author'] },
      bans: { none: { userId: 'viewer' } },
    });
    expect(result.clouds).toHaveLength(1);
  });
  it('lists ended public clouds while honoring bans, blocked users and private profiles', async () => {
    const { service, prisma, cloud } = setup();
    prisma.userBlock.findMany.mockResolvedValue([
      { blockerId: 'viewer', blockedId: 'blocked' },
    ]);
    prisma.cloud.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([cloud]);
    const result = await service.listRead('token');
    const query = prisma.cloud.findMany.mock.calls[1][0];
    expect(query.where).toMatchObject({
      status: 'ended',
      visibility: 'public',
      deletedAt: null,
      authorId: { notIn: ['blocked'] },
      bans: { none: { userId: 'viewer' } },
    });
    expect(query.where?.OR).toContainEqual({
      author: { followers: { some: { followerId: 'viewer' } } },
    });
    expect(result.clouds[0].messagesCount).toBe(12);
    expect(query).toMatchObject({
      select: {
        members: { where: { leftAt: null } },
        _count: { select: { members: { where: { leftAt: null } } } },
      },
    });
  });
  it('filters ended clouds to authors the viewer follows', async () => {
    const { service, prisma, cloud } = setup();
    prisma.follow.findMany.mockResolvedValue([{ followingId: 'author' }]);
    prisma.cloud.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([cloud]);
    const result = await service.listRead('token', 'following');
    const query = prisma.cloud.findMany.mock.calls[1][0];
    expect(prisma.follow.findMany).toHaveBeenCalledWith({
      where: { followerId: 'viewer' },
      select: { followingId: true },
    });
    expect((query.where?.AND as Prisma.CloudWhereInput[])[1]).toEqual({
      authorId: { in: ['author'] },
    });
    expect(result.clouds).toHaveLength(1);
  });
  it('limits the preview to the earliest 10 non-deleted conversation messages', async () => {
    const { service, prisma } = setup();
    prisma.cloudMessage.findMany.mockResolvedValue([
      {
        id: 'first',
        content: 'Hello',
        user: { id: 'author', profile: { displayName: 'Author' } },
      },
    ]);
    const result = await service.getPreview('token', cloudId);
    expect(prisma.cloudMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cloudId, deletedAt: null, type: { not: 'system' } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 10,
      }),
    );
    expect(result.messages[0].sender).toEqual({
      id: 'author',
      displayName: 'Author',
    });
    expect(prisma.cloudMember.create).not.toHaveBeenCalled();
  });
  it('loads the complete archive in read-only pages without requiring membership', async () => {
    const { service, prisma } = setup();
    prisma.cloudMessage.findMany.mockResolvedValue([]);
    await service.getArchivedMessages('token', cloudId, {
      take: 50,
      before: '2026-09-20T12:00:00Z',
    });
    expect(prisma.cloudMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cloudId,
          deletedAt: null,
          createdAt: { lt: new Date('2026-09-20T12:00:00Z') },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
    expect(prisma.cloudMember.findFirst).not.toHaveBeenCalled();
  });
  it('includes active and ended clouds in the owner profile', async () => {
    const { service, prisma } = setup();
    prisma.cloud.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await service.listMine('token');
    expect(prisma.cloud.findMany.mock.calls[1][0].where).toMatchObject({
      authorId: 'viewer',
      status: { in: ['active', 'ended'] },
    });
  });
  it('does not fetch messages when the archive is inaccessible', async () => {
    const { service, prisma } = setup();
    prisma.cloud.findFirst.mockResolvedValue(null);
    await expect(service.getPreview('token', cloudId)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cloudMessage.findMany).not.toHaveBeenCalled();
  });
  it('requires authentication for Read and previews', async () => {
    const { service, prisma, auth } = setup();
    auth.resolveSession.mockResolvedValue(null);
    await expect(service.listRead(null)).rejects.toThrow(UnauthorizedException);
    await expect(service.getPreview(null, cloudId)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.cloud.findMany).not.toHaveBeenCalled();
  });
  it('rejects malformed preview identifiers', async () => {
    const { service } = setup();
    await expect(service.getPreview('token', 'invalid')).rejects.toThrow(
      NotFoundException,
    );
  });
  it('expires overdue clouds at their actual ending time', async () => {
    const { service, prisma, cloud } = setup();
    prisma.cloud.findMany
      .mockResolvedValueOnce([cloud])
      .mockResolvedValueOnce([]);
    await service.listRead('token');
    expect(prisma.cloud.update).toHaveBeenCalledWith({
      where: { id: cloudId },
      data: {
        status: 'ended',
        endedAt: new Date(cloud.createdAt.getTime() + 600000),
      },
    });
  });
  it.each(['ended', 'active'])(
    'rejects joining an expired cloud with status %s',
    async (status) => {
      const { service, cloud } = setup();
      cloud.status = status;
      await expect(service.joinCloud('token', cloudId)).rejects.toThrow(
        BadRequestException,
      );
    },
  );
  it.each(['text', 'audio', 'image', 'link'] as const)(
    'rejects %s messages in ended clouds',
    async (type) => {
      const { service, prisma } = setup();
      await expect(
        service.createMessage('token', cloudId, { type, content: 'Message' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.cloudMessage.create).not.toHaveBeenCalled();
    },
  );
  it('rejects edits and deletion after ending', async () => {
    const { service, prisma } = setup();
    await expect(
      service.editMessage('token', cloudId, 'message', 'Changed'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.deleteMessage('token', cloudId, 'message'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.cloudMessage.update).not.toHaveBeenCalled();
  });
  it('preserves entry into an active cloud', async () => {
    const { service, prisma, cloud } = setup();
    cloud.status = 'active';
    cloud.createdAt = new Date();
    prisma.cloudBan.findUnique.mockResolvedValue(null);
    prisma.cloudMember.findFirst.mockResolvedValue({
      id: 'member',
      leftAt: null,
    });
    prisma.cloudMessage.findFirst = jest
      .fn<Promise<unknown>, unknown[]>()
      .mockResolvedValue({ id: 'entry-notification' });
    await expect(service.joinCloud('token', cloudId)).resolves.toEqual({
      ok: true,
      userId: 'viewer',
      entered: false,
      waiting: false,
      leftCloudIds: [],
    });
  });
  it('leaves every other active cloud before joining a new one', async () => {
    const { service, prisma, cloud } = setup();
    cloud.status = 'active';
    cloud.createdAt = new Date();
    prisma.cloudBan.findUnique.mockResolvedValue(null);
    prisma.cloudMember.findFirst.mockResolvedValue({
      id: 'current-member',
      leftAt: null,
    });
    prisma.cloudMember.findMany.mockResolvedValue([
      { cloudId: 'previous-cloud' },
    ]);
    prisma.cloudMessage.findFirst.mockResolvedValue({
      id: 'entry-notification',
    });

    await expect(service.joinCloud('token', cloudId)).resolves.toMatchObject({
      ok: true,
      leftCloudIds: ['previous-cloud'],
    });
    expect(prisma.cloudMember.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'viewer',
        cloudId: { in: ['previous-cloud'] },
        leftAt: null,
      },
      data: { leftAt: expect.any(Date) as unknown },
    });
  });
  it('hides a private cloud from an authenticated user who was not invited', async () => {
    const { service, prisma, cloud } = setup();
    cloud.status = 'active';
    cloud.visibility = 'private';
    prisma.cloudBan.findUnique.mockResolvedValue(null);
    prisma.cloudMember.findFirst.mockResolvedValue(null);
    await expect(service.findById('token', cloudId)).rejects.toThrow(
      NotFoundException,
    );
  });
  it('does not let an uninvited user join a private cloud', async () => {
    const { service, prisma, cloud } = setup();
    cloud.status = 'active';
    cloud.createdAt = new Date();
    cloud.visibility = 'private';
    prisma.cloudBan.findUnique.mockResolvedValue(null);
    prisma.cloudMember.findFirst.mockResolvedValue(null);
    await expect(service.joinCloud('token', cloudId)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cloudMember.create).not.toHaveBeenCalled();
  });
  it('removes a member without creating a permanent ban', async () => {
    const { service, prisma, auth, cloud } = setup();
    cloud.status = 'active';
    auth.resolveSession.mockResolvedValue({ user: { id: 'author' } });
    prisma.cloudMember.findFirst.mockResolvedValue({ id: 'member-record' });

    await expect(
      service.removeMember('token', cloudId, 'viewer'),
    ).resolves.toEqual({ ok: true });

    expect(prisma.cloudMember.update).toHaveBeenCalledWith({
      where: { id: 'member-record' },
      data: { leftAt: expect.any(Date) as unknown },
    });
    expect(prisma.cloudBan.upsert).not.toHaveBeenCalled();
  });
  it('blocks banned users from all Cloud access paths, including sockets', async () => {
    const { service, prisma } = setup();
    prisma.cloudBan.findUnique.mockResolvedValue({ cloudId, userId: 'viewer' });

    await expect(service.requireCloudAccess(cloudId, 'viewer')).rejects.toThrow(
      NotFoundException,
    );
  });
  it('preserves the existing chat history pagination for members', async () => {
    const { service, prisma } = setup();
    prisma.cloudMember.findFirst.mockResolvedValue({ id: 'member' });
    await service.getMessages('token', cloudId, {
      take: 25,
      before: '2026-09-20T12:00:00Z',
    });
    expect(prisma.cloudMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        orderBy: { createdAt: 'desc' },
        where: {
          cloudId,
          deletedAt: null,
          createdAt: { lt: new Date('2026-09-20T12:00:00Z') },
        },
      }),
    );
  });

  it('allows the author to edit title and duration while edits remain', async () => {
    const { service, prisma, auth, cloud } = setup();
    cloud.editCount = 2;
    auth.resolveSession.mockResolvedValue({ user: { id: 'author' } });
    prisma.cloud.update.mockResolvedValue({
      id: cloudId,
      title: 'Título corrigido',
      duration: '2h',
      editCount: 3,
    });

    await expect(
      service.update('token', cloudId, {
        title: 'Título corrigido',
        duration: '2h',
      }),
    ).resolves.toEqual({
      ok: true,
      cloud: {
        id: cloudId,
        title: 'Título corrigido',
        duration: '2h',
        editCount: 3,
      },
    });
    expect(prisma.cloud.update).toHaveBeenCalledWith({
      where: {
        id: cloudId,
        authorId: 'author',
        deletedAt: null,
        editCount: { lt: 3 },
      },
      data: {
        title: 'Título corrigido',
        duration: '2h',
        editCount: { increment: 1 },
      },
      select: { id: true, title: true, duration: true, editCount: true },
    });
  });

  it('accepts 40 characters on edit and rejects 41 on create and edit', async () => {
    const { service, prisma, auth } = setup();
    auth.resolveSession.mockResolvedValue({ user: { id: 'author' } });
    const title40 = 'a'.repeat(40);
    prisma.cloud.update.mockResolvedValue({
      id: cloudId,
      title: title40,
      duration: '2h',
      editCount: 1,
    });
    await expect(
      service.update('token', cloudId, { title: title40, duration: '2h' }),
    ).resolves.toMatchObject({ cloud: { title: title40 } });
    await expect(
      service.update('token', cloudId, {
        title: `${title40}a`,
        duration: '2h',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create('token', { title: `${title40}a`, duration: '2h' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects reporting a Cloud owned by the reporter', async () => {
    const { service, auth } = setup();
    auth.resolveSession.mockResolvedValue({ user: { id: 'author' } });
    await expect(
      service.reportUser('token', cloudId, 'viewer', null, null, [
        'Spam ou publicidade',
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects the fourth edit and edits from non-authors', async () => {
    const { service, auth, cloud } = setup();
    auth.resolveSession.mockResolvedValue({ user: { id: 'author' } });
    cloud.editCount = 3;
    await expect(
      service.update('token', cloudId, { title: 'Título', duration: '10min' }),
    ).rejects.toThrow(BadRequestException);

    cloud.editCount = 0;
    auth.resolveSession.mockResolvedValue({ user: { id: 'viewer' } });
    await expect(
      service.update('token', cloudId, { title: 'Título', duration: '10min' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a simultaneous edit that reaches the limit first', async () => {
    const { service, prisma, auth, cloud } = setup();
    cloud.editCount = 2;
    auth.resolveSession.mockResolvedValue({ user: { id: 'author' } });
    prisma.cloud.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Cloud changed', {
        code: 'P2025',
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    await expect(
      service.update('token', cloudId, { title: 'Título', duration: '2h' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('hides message-view identities when the author has lost Cloud access', async () => {
    const { service, prisma } = setup();
    prisma.cloudBan.findUnique.mockResolvedValue({ cloudId });

    await expect(
      service.getMessageViews('token', cloudId, 'message-id'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cloudMessage.findFirst).not.toHaveBeenCalled();
    expect(prisma.cloudMessageView.findMany).not.toHaveBeenCalled();
  });
});
