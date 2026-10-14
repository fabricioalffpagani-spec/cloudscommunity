import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import {
  DirectMessagesService,
  buildConversationKey,
  truncatePreview,
} from './direct-messages.service';

function createPrismaMock() {
  const prisma = {
    userBlock: {
      findFirst: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn<Promise<unknown>, unknown[]>(),
    },
    conversation: {
      findUnique: jest.fn<Promise<unknown>, unknown[]>(),
      findFirst: jest.fn<Promise<unknown>, unknown[]>(),
      create: jest.fn<Promise<unknown>, unknown[]>(),
      update: jest.fn<Promise<unknown>, unknown[]>(),
      findMany: jest.fn<Promise<unknown>, unknown[]>(),
    },
    directMessage: {
      findFirst: jest.fn<Promise<unknown>, unknown[]>(),
      findMany: jest.fn<Promise<unknown>, unknown[]>(),
      create: jest.fn<Promise<unknown>, unknown[]>(),
      updateMany: jest.fn<Promise<unknown>, unknown[]>(),
    },
    mediaAsset: {
      create: jest.fn<Promise<unknown>, unknown[]>(),
    },
  };

  return {
    ...prisma,
    $transaction: jest.fn((callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    ),
  };
}

describe('DirectMessagesService', () => {
  it('sends message push without adding an activity-bell notification', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const notificationCreate = jest.fn();
    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue({
          participantOneId: 'sender',
          participantTwoId: 'recipient',
        }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ profile: { displayName: 'Vicente' } }),
      },
      directMessage: {
        findMany: jest.fn().mockResolvedValue([{ content: 'Olá' }]),
      },
      notification: { create: notificationCreate },
    };
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send } as never,
    );
    await (
      service as unknown as {
        notifyRecipient: (
          messageId: string,
          conversationId: string,
          senderId: string,
          content: string,
        ) => Promise<void>;
      }
    ).notifyRecipient('message', 'conversation', 'sender', 'Olá');
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      'recipient',
      expect.objectContaining({
        title: 'Vicente: Olá',
        body: 'Olá',
        url: '/messages?conversation=conversation',
        tag: 'direct-message-conversation',
        messageId: 'message',
        unreadMessages: ['Olá'],
      }),
    );
  });

  it('includes all unread messages in conversation order and excludes read messages', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { content: 'Oi' },
        { content: 'Tudo bem?' },
        { content: 'Até logo' },
      ]);
    const service = new DirectMessagesService(
      {
        conversation: {
          findUnique: jest.fn().mockResolvedValue({
            participantOneId: 'sender',
            participantTwoId: 'recipient',
          }),
        },
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ profile: { displayName: 'Vicente' } }),
        },
        directMessage: { findMany },
      } as unknown as PrismaService,
      { send } as never,
    );
    await (
      service as unknown as {
        notifyRecipient: (
          messageId: string,
          conversationId: string,
          senderId: string,
          content: string,
        ) => Promise<void>;
      }
    ).notifyRecipient('m3', 'conversation', 'sender', 'Até logo');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId: 'conversation',
          senderId: 'sender',
          readAt: null,
          deletedAt: null,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(send).toHaveBeenCalledWith(
      'recipient',
      expect.objectContaining({
        title: 'Vicente: Até logo',
        body: 'Até logo',
        unreadMessages: ['Oi', 'Tudo bem?', 'Até logo'],
      }),
    );
  });

  it('does not notify when the conversation was read before push dispatch', async () => {
    const send = jest.fn();
    const service = new DirectMessagesService(
      {
        conversation: {
          findUnique: jest.fn().mockResolvedValue({
            participantOneId: 'sender',
            participantTwoId: 'recipient',
          }),
        },
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ profile: { displayName: 'Vicente' } }),
        },
        directMessage: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService,
      { send } as never,
    );
    await (
      service as unknown as {
        notifyRecipient: (
          messageId: string,
          conversationId: string,
          senderId: string,
          content: string,
        ) => Promise<void>;
      }
    ).notifyRecipient('m1', 'conversation', 'sender', 'Oi');
    expect(send).not.toHaveBeenCalled();
  });

  it('builds a deterministic conversation key', () => {
    expect(buildConversationKey('b', 'a')).toBe('a:b');
  });

  it('truncates the preview safely', () => {
    expect(truncatePreview('  hello   world  ')).toBe('hello world');
  });

  it('uses a human-readable preview for a reply to a Read Cloud comment', () => {
    expect(
      truncatePreview(JSON.stringify({
        type: 'cloud_comment_reply',
        cloudTitle: 'Cores de fundo',
        comment: 'Esse roxo traz personalidade',
        response: 'Concordo',
      })),
    ).toBe('Respondeu ao seu comentário na Cloud “Cores de fundo”.');
  });

  it('throws when sending an empty message', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send: jest.fn() } as never,
    );

    await expect(
      service.sendTextMessage('user-1', {
        conversationId: 'conv-1',
        content: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('loads the newest messages and returns them in display order', async () => {
    const prisma = createPrismaMock();
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    const makeMessage = (id: string, minute: number) => ({
      id,
      conversationId: 'conv-1',
      senderId: 'user-1',
      type: 'text',
      content: id,
      clientMessageId: null,
      replyToMessageId: null,
      readAt: null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(
        `2026-07-22T10:${String(minute).padStart(2, '0')}:00.000Z`,
      ),
      updatedAt: new Date(
        `2026-07-22T10:${String(minute).padStart(2, '0')}:00.000Z`,
      ),
      sender: {
        profile: { username: 'alpha', displayName: 'Alpha', avatarUrl: null },
      },
      mediaAsset: null,
      reactions: [],
    });
    prisma.directMessage.findMany.mockResolvedValue([
      makeMessage('newest', 2),
      makeMessage('older', 1),
    ]);
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send: jest.fn() } as never,
    );

    const messages = await service.listMessages('user-1', 'conv-1', {
      take: 50,
    });

    expect(prisma.directMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conv-1', deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
    );
    expect(messages.map((message) => message.id)).toEqual(['older', 'newest']);
  });

  it('never updates the conversation preview when message creation fails', async () => {
    const prisma = createPrismaMock();
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      participantOneId: 'user-1',
      participantTwoId: 'user-2',
    });
    prisma.directMessage.create.mockRejectedValue(
      new Error('database write failed'),
    );
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send: jest.fn() } as never,
    );

    await expect(
      service.sendTextMessage('user-1', {
        conversationId: 'conv-1',
        content: 'hello',
      }),
    ).rejects.toThrow('database write failed');
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('returns a committed message before push lookup finishes, even if it later fails', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send: jest.fn() } as never,
    );
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
    let rejectPushLookup!: (error: Error) => void;
    prisma.conversation.findUnique.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPushLookup = reject;
      }),
    );
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const message = await service.sendTextMessage('user-1', {
      conversationId: 'conv-1',
      content: '  oi tudo bem  ',
      clientMessageId: 'client-1',
    });

    expect(message.content).toBe('oi tudo bem');
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining<unknown>({
          lastMessageType: 'text',
          lastMessagePreview: 'oi tudo bem',
        }) as unknown,
      }),
    );
    expect(warning).not.toHaveBeenCalled();
    rejectPushLookup(new Error('push lookup failed'));
    await new Promise((resolve) => setImmediate(resolve));
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });

  it('sends an audio message and stores the media asset', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send: jest.fn() } as never,
    );
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
        data: expect.objectContaining<unknown>({
          ownerId: 'user-1',
          mimeType: 'audio/webm',
          durationMs: 1200,
        }) as unknown,
      }),
    );
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining<unknown>({
          lastMessageType: 'audio',
          lastMessagePreview: 'Áudio · 0:01',
        }) as unknown,
      }),
    );
  });

  it('sends an image message and stores the media asset', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send: jest.fn() } as never,
    );
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
        data: expect.objectContaining<unknown>({
          ownerId: 'user-1',
          mimeType: 'image/png',
        }) as unknown,
      }),
    );
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining<unknown>({
          lastMessageType: 'image',
          lastMessagePreview: 'Imagem',
        }) as unknown,
      }),
    );
  });

  it('sends a link message and stores the preview', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send: jest.fn() } as never,
    );
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
      content: JSON.stringify({
        url: 'https://clouds.community/cloud/abc',
        label: 'Cloud legal',
      }),
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
        data: expect.objectContaining<unknown>({
          lastMessageType: 'link',
          lastMessagePreview: 'Cloud legal',
        }) as unknown,
      }),
    );
  });

  it('rejects access to a missing conversation', async () => {
    const prisma = createPrismaMock();
    const service = new DirectMessagesService(
      prisma as unknown as PrismaService,
      { send: jest.fn() } as never,
    );
    prisma.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.getConversationById('user-1', 'conv-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
