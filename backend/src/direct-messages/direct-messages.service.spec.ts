import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DirectMessagesService, buildConversationKey, truncatePreview } from './direct-messages.service';

function createPrismaMock() {
  const prisma: any = {
    userBlock: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    directMessage: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    mediaAsset: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => callback(prisma)),
  };

  return prisma;
}

describe('DirectMessagesService', () => {
  it('builds a deterministic conversation key', () => {
    expect(buildConversationKey('b', 'a')).toBe('a:b');
  });

  it('truncates the preview safely', () => {
    expect(truncatePreview('  hello   world  ')).toBe('hello world');
  });

  it('throws when sending an empty message', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(prisma);

    await expect(
      service.sendTextMessage('user-1', {
        conversationId: 'conv-1',
        content: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends a message and updates the conversation metadata', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(prisma);
    const conversation = {
      id: 'conv-1',
      conversationKey: 'a:b',
      participantOneId: 'user-1',
      participantTwoId: 'user-2',
      lastMessageId: null,
      lastMessageType: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      participantOneUnreadCount: 0,
      participantTwoUnreadCount: 0,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
      deletedAt: null,
      participantOne: {
        id: 'user-1',
        status: 'active',
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      participantTwo: {
        id: 'user-2',
        status: 'active',
        profile: { username: 'beta', displayName: 'Beta', avatarUrl: null },
      },
      lastMessage: null,
    };

    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.directMessage.create.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      type: 'text',
      content: 'oi tudo bem',
      clientMessageId: 'client-1',
      replyToMessageId: null,
      readAt: null,
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
      updatedAt: new Date('2026-07-22T10:00:00.000Z'),
      deletedAt: null,
      sender: {
        id: 'user-1',
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      mediaAsset: null,
    });
    prisma.conversation.update.mockResolvedValue({});

    const message = await service.sendTextMessage('user-1', {
      conversationId: 'conv-1',
      content: '  oi tudo bem  ',
      clientMessageId: 'client-1',
    });

    expect(message.content).toBe('oi tudo bem');
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          lastMessageType: 'text',
          lastMessagePreview: 'oi tudo bem',
        }),
      }),
    );
  });

  it('sends an audio message and stores the media asset', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(prisma);
    const conversation = {
      id: 'conv-1',
      conversationKey: 'a:b',
      participantOneId: 'user-1',
      participantTwoId: 'user-2',
      lastMessageId: null,
      lastMessageType: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      participantOneUnreadCount: 0,
      participantTwoUnreadCount: 0,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
      deletedAt: null,
      participantOne: {
        id: 'user-1',
        status: 'active',
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      participantTwo: {
        id: 'user-2',
        status: 'active',
        profile: { username: 'beta', displayName: 'Beta', avatarUrl: null },
      },
      lastMessage: null,
    };

    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.mediaAsset.create.mockResolvedValue({
      id: 'asset-1',
      ownerId: 'user-1',
      url: 'data:audio/webm;base64,Zm9v',
      mimeType: 'audio/webm',
      sizeBytes: BigInt(3),
      storageKey: 'direct-message-audio-1',
      originalFileName: 'audio.webm',
      width: null,
      height: null,
      durationMs: 1200,
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
    });
    prisma.directMessage.create.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      type: 'audio',
      content: null,
      clientMessageId: 'client-1',
      replyToMessageId: null,
      readAt: null,
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
      updatedAt: new Date('2026-07-22T10:00:00.000Z'),
      deletedAt: null,
      sender: {
        id: 'user-1',
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      mediaAsset: {
        id: 'asset-1',
        url: 'data:audio/webm;base64,Zm9v',
        mimeType: 'audio/webm',
        sizeBytes: BigInt(3),
        storageKey: 'direct-message-audio-1',
        originalFileName: 'audio.webm',
        width: null,
        height: null,
        durationMs: 1200,
        createdAt: new Date('2026-07-22T10:00:00.000Z'),
      },
    });
    prisma.conversation.update.mockResolvedValue({});

    const message = await service.sendAudioMessage(
      'user-1',
      {
        conversationId: 'conv-1',
        clientMessageId: 'client-1',
        durationMs: 1200,
      },
      {
        buffer: Buffer.from('foo'),
        mimetype: 'audio/webm',
        originalname: 'audio.webm',
        size: 3,
      } as Express.Multer.File,
    );

    expect(message.type).toBe('audio');
    expect(message.mediaAsset?.durationMs).toBe(1200);
    expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'user-1',
          mimeType: 'audio/webm',
          durationMs: 1200,
        }),
      }),
    );
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          lastMessageType: 'audio',
          lastMessagePreview: 'Áudio · 0:01',
        }),
      }),
    );
  });

  it('sends an image message and stores the media asset', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(prisma);
    const conversation = {
      id: 'conv-1',
      conversationKey: 'a:b',
      participantOneId: 'user-1',
      participantTwoId: 'user-2',
      lastMessageId: null,
      lastMessageType: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      participantOneUnreadCount: 0,
      participantTwoUnreadCount: 0,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
      deletedAt: null,
      participantOne: {
        id: 'user-1',
        status: 'active',
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      participantTwo: {
        id: 'user-2',
        status: 'active',
        profile: { username: 'beta', displayName: 'Beta', avatarUrl: null },
      },
      lastMessage: null,
    };

    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.mediaAsset.create.mockResolvedValue({
      id: 'asset-2',
      ownerId: 'user-1',
      url: 'data:image/png;base64,Zm9v',
      mimeType: 'image/png',
      sizeBytes: BigInt(3),
      storageKey: 'direct-message-image-1',
      originalFileName: 'image.png',
      width: null,
      height: null,
      durationMs: null,
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
    });
    prisma.directMessage.create.mockResolvedValue({
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'user-1',
      type: 'image',
      content: null,
      clientMessageId: 'client-2',
      replyToMessageId: null,
      readAt: null,
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
      updatedAt: new Date('2026-07-22T10:00:00.000Z'),
      deletedAt: null,
      sender: {
        id: 'user-1',
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      mediaAsset: {
        id: 'asset-2',
        url: 'data:image/png;base64,Zm9v',
        mimeType: 'image/png',
        sizeBytes: BigInt(3),
        storageKey: 'direct-message-image-1',
        originalFileName: 'image.png',
        width: null,
        height: null,
        durationMs: null,
        createdAt: new Date('2026-07-22T10:00:00.000Z'),
      },
    });
    prisma.conversation.update.mockResolvedValue({});

    const message = await service.sendImageMessage(
      'user-1',
      {
        conversationId: 'conv-1',
        clientMessageId: 'client-2',
      },
      {
        buffer: Buffer.from('foo'),
        mimetype: 'image/png',
        originalname: 'image.png',
        size: 3,
      } as any,
    );

    expect(message.type).toBe('image');
    expect(message.mediaAsset?.mimeType).toBe('image/png');
    expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'user-1',
          mimeType: 'image/png',
        }),
      }),
    );
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          lastMessageType: 'image',
          lastMessagePreview: 'Imagem',
        }),
      }),
    );
  });

  it('sends a link message and stores the preview', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(prisma);
    const conversation = {
      id: 'conv-1',
      conversationKey: 'a:b',
      participantOneId: 'user-1',
      participantTwoId: 'user-2',
      lastMessageId: null,
      lastMessageType: null,
      lastMessageAt: null,
      lastMessagePreview: null,
      participantOneUnreadCount: 0,
      participantTwoUnreadCount: 0,
      createdAt: new Date('2026-07-22T00:00:00.000Z'),
      updatedAt: new Date('2026-07-22T00:00:00.000Z'),
      deletedAt: null,
      participantOne: {
        id: 'user-1',
        status: 'active',
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      participantTwo: {
        id: 'user-2',
        status: 'active',
        profile: { username: 'beta', displayName: 'Beta', avatarUrl: null },
      },
      lastMessage: null,
    };

    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.directMessage.create.mockResolvedValue({
      id: 'msg-3',
      conversationId: 'conv-1',
      senderId: 'user-1',
      type: 'link',
      content: JSON.stringify({ url: 'https://clouds.community/cloud/abc', label: 'Cloud legal' }),
      clientMessageId: 'client-3',
      replyToMessageId: null,
      readAt: null,
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
      updatedAt: new Date('2026-07-22T10:00:00.000Z'),
      deletedAt: null,
      sender: {
        id: 'user-1',
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      mediaAsset: null,
    });
    prisma.conversation.update.mockResolvedValue({});

    const message = await service.sendLinkMessage('user-1', {
      conversationId: 'conv-1',
      url: 'https://clouds.community/cloud/abc',
      label: 'Cloud legal',
      clientMessageId: 'client-3',
    });

    expect(message.type).toBe('link');
    expect(message.content).toContain('clouds.community/cloud/abc');
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          lastMessageType: 'link',
          lastMessagePreview: 'Cloud legal',
        }),
      }),
    );
  });

  it('rejects access to a missing conversation', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(prisma);
    prisma.conversation.findFirst.mockResolvedValue(null);

    await expect(service.getConversationById('user-1', 'conv-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
