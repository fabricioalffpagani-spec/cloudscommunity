import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { MediaAsset, Prisma } from '@prisma/client';
type MulterFile = Express.Multer.File;
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import {
  CreateConversationInput,
  DirectConversationPayload,
  DirectMessagePayload,
  DirectMessageReactionPayload,
  ListDirectMessagesQuery,
  SendAudioMessageInput,
  SendImageMessageInput,
  SendLinkMessageInput,
  SendDirectMessageInput,
} from './direct-messages.types';

type UserSummary = Prisma.UserGetPayload<{
  include: { profile: true };
}>;

type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: {
    participantOne: { include: { profile: true } };
    participantTwo: { include: { profile: true } };
    lastMessage: {
      include: {
        sender: { include: { profile: true } };
        mediaAsset: true;
      };
    };
  };
}>;

type MessageWithRelations = Prisma.DirectMessageGetPayload<{
  include: {
    sender: { include: { profile: true } };
    mediaAsset: true;
    reactions: true;
  };
}>;

const DEFAULT_MESSAGE_TAKE = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function buildConversationKey(
  participantOneId: string,
  participantTwoId: string,
): string {
  return [participantOneId, participantTwoId].sort().join(':');
}

export function truncatePreview(value: string, maxLength = 255): string {
  let previewValue = value;
  try {
    const parsed = JSON.parse(value) as {
      type?: string;
      cloudTitle?: string;
    };
    if (parsed.type === 'cloud_comment_reply') {
      previewValue = `Respondeu ao seu comentário na Cloud${parsed.cloudTitle ? ` “${parsed.cloudTitle}”` : ''}.`;
    }
  } catch {
    // Ordinary messages are stored as plain text.
  }
  const normalized = previewValue.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength);
}

@Injectable()
export class DirectMessagesService {
  private readonly logger = new Logger(DirectMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  async createOrResolveConversation(
    userId: string,
    input: CreateConversationInput,
  ): Promise<DirectConversationPayload> {
    const peerUserId = input.peerUserId.trim();

    if (!peerUserId) {
      throw new BadRequestException({
        message: 'Informe o destinatário.',
      });
    }

    if (peerUserId === userId) {
      throw new BadRequestException({
        message: 'Você não pode abrir uma conversa com você mesmo.',
      });
    }
    await this.assertCanContact(userId, peerUserId);

    const [participantOneId, participantTwoId] = [userId, peerUserId].sort();
    const conversationKey = buildConversationKey(
      participantOneId,
      participantTwoId,
    );

    const existing = await this.prisma.conversation.findUnique({
      where: { conversationKey },
      include: this.conversationInclude(),
    });

    if (existing) {
      return this.mapConversation(existing, userId);
    }

    const peer = await this.requireUserSummary(peerUserId);

    const created = await this.prisma.conversation.create({
      data: {
        conversationKey,
        participantOneId,
        participantTwoId,
        members: {
          createMany: {
            data: [{ userId: participantOneId }, { userId: participantTwoId }],
            skipDuplicates: true,
          },
        },
      },
      include: this.conversationInclude(),
    });

    return this.mapConversation(created, userId, peer);
  }

  async listConversations(
    userId: string,
  ): Promise<DirectConversationPayload[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        deletedAt: null,
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      include: this.conversationInclude(),
    });

    const blocks = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return conversations.map((conversation) => {
      const peerId = this.getPeerId(conversation, userId);
      const block = blocks.find(
        (entry) => entry.blockerId === peerId || entry.blockedId === peerId,
      );
      return this.mapConversation(conversation, userId, undefined, {
        blockedByPeer: block?.blockerId === peerId,
        blockedByMe: block?.blockerId === userId,
      });
    });
  }

  async listConversationPeerIds(userId: string): Promise<string[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        deletedAt: null,
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      select: {
        participantOneId: true,
        participantTwoId: true,
      },
    });

    const peerIds = new Set<string>();

    for (const conversation of conversations) {
      const peerId =
        conversation.participantOneId === userId
          ? conversation.participantTwoId
          : conversation.participantOneId;
      peerIds.add(peerId);
    }

    return Array.from(peerIds);
  }

  async listPresenceWatcherIds(userId: string): Promise<string[]> {
    const [peers, followers] = await Promise.all([
      this.listConversationPeerIds(userId),
      this.prisma.follow.findMany({
        where: { followingId: userId },
        select: { followerId: true },
      }),
    ]);
    return Array.from(
      new Set([...peers, ...followers.map((follow) => follow.followerId)]),
    );
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: ListDirectMessagesQuery,
  ): Promise<DirectMessagePayload[]> {
    await this.requireConversationAccess(conversationId, userId);

    const take = this.normalizeTake(query.take);
    const cursor = query.before?.trim() || null;

    const messages = await this.prisma.directMessage.findMany({
      where: {
        conversationId,
        deletedAt: null,
      },
      // Fetch the newest page first. Ascending order returned the oldest 50
      // messages, so newly persisted messages vanished after a reload.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: this.messageInclude(),
    });

    return messages.reverse().map((message) => this.mapMessage(message));
  }

  async listPinnedMessages(
    userId: string,
    conversationId: string,
  ): Promise<DirectMessagePayload[]> {
    await this.requireConversationAccess(conversationId, userId);
    const messages = await this.prisma.directMessage.findMany({
      where: { conversationId, deletedAt: null, isPinned: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: this.messageInclude(),
    });
    return messages.map((message) => this.mapMessage(message));
  }

  async toggleReaction(
    userId: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ reaction: DirectMessageReactionPayload; removed: boolean }> {
    const normalizedEmoji = emoji.trim();
    if (!normalizedEmoji || normalizedEmoji.length > 32) {
      throw new BadRequestException({ message: 'Reação inválida.' });
    }
    await this.requireConversationAccess(conversationId, userId);
    const message = await this.prisma.directMessage.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
      select: { id: true },
    });
    if (!message)
      throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    const existing = await this.prisma.directMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji: normalizedEmoji },
      },
    });
    if (existing) {
      await this.prisma.directMessageReaction.delete({
        where: { id: existing.id },
      });
      return {
        reaction: {
          id: existing.id,
          emoji: existing.emoji,
          userId,
          createdAt: existing.createdAt.toISOString(),
        },
        removed: true,
      };
    }
    const reaction = await this.prisma.directMessageReaction.create({
      data: { messageId, userId, emoji: normalizedEmoji },
    });
    return {
      reaction: {
        id: reaction.id,
        emoji: reaction.emoji,
        userId,
        createdAt: reaction.createdAt.toISOString(),
      },
      removed: false,
    };
  }

  async sendTextMessage(
    userId: string,
    input: SendDirectMessageInput,
  ): Promise<DirectMessagePayload> {
    const content = input.content.replace(/\s+/g, ' ').trim();

    if (!content) {
      throw new BadRequestException({
        message: 'A mensagem não pode ficar vazia.',
      });
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException({
        message: 'A mensagem excede o limite permitido.',
      });
    }

    const conversation = await this.requireConversationAccess(
      input.conversationId,
      userId,
    );
    await this.assertCanContact(userId, this.getPeerId(conversation, userId));
    const clientMessageId = input.clientMessageId?.trim() || null;
    const replyToMessageId = input.replyToMessageId?.trim() || null;

    if (clientMessageId) {
      const existing = await this.prisma.directMessage.findFirst({
        where: {
          conversationId: input.conversationId,
          clientMessageId,
          deletedAt: null,
        },
        include: this.messageInclude(),
      });

      if (existing) {
        return this.mapMessage(existing);
      }
    }

    if (replyToMessageId) {
      const replyTarget = await this.prisma.directMessage.findFirst({
        where: {
          id: replyToMessageId,
          conversationId: input.conversationId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!replyTarget) {
        throw new BadRequestException({
          message: 'A mensagem de resposta não foi encontrada.',
        });
      }
    }

    const createdAt = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: {
          conversationId: input.conversationId,
          senderId: userId,
          type: 'text',
          content,
          clientMessageId,
          replyToMessageId,
        },
        include: this.messageInclude(),
      });

      const preview = truncatePreview(
        content.replace(
          /^↗\s*Encaminhada \[cloud:[^\]\s]+\](?:\s|$)/i,
          '↗ Encaminhada ',
        ),
      );
      const unreadField =
        conversation.participantOneId === userId
          ? 'participantTwoUnreadCount'
          : 'participantOneUnreadCount';
      await tx.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageId: created.id,
          lastMessageType: 'text',
          lastMessageAt: createdAt,
          lastMessagePreview: preview,
          [unreadField]: {
            increment: 1,
          },
        },
      });

      return created;
    });

    void this.notifyRecipientAfterCommit(
      message.id,
      input.conversationId,
      userId,
      message.content,
    );
    return this.mapMessage(message);
  }

  /**
   * Sends a text reply on behalf of a platform-managed account. This follows
   * the same conversation bookkeeping as a regular message, but intentionally
   * does not require a browser session for the managed account.
   */
  async sendAutomatedTextMessage(
    senderId: string,
    conversationId: string,
    rawContent: string,
  ): Promise<DirectMessagePayload> {
    const content = rawContent.replace(/\s+/g, ' ').trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException({
        message: 'A mensagem automática é inválida.',
      });
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        deletedAt: null,
        OR: [{ participantOneId: senderId }, { participantTwoId: senderId }],
      },
      select: { participantOneId: true, participantTwoId: true },
    });
    if (!conversation) {
      throw new BadRequestException({ message: 'Conversa não encontrada.' });
    }

    const createdAt = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: { conversationId, senderId, type: 'text', content },
        include: this.messageInclude(),
      });
      const unreadField =
        conversation.participantOneId === senderId
          ? 'participantTwoUnreadCount'
          : 'participantOneUnreadCount';
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: created.id,
          lastMessageType: 'text',
          lastMessageAt: createdAt,
          lastMessagePreview: truncatePreview(content),
          [unreadField]: { increment: 1 },
        },
      });
      return created;
    });

    void this.notifyRecipientAfterCommit(
      message.id,
      conversationId,
      senderId,
      message.content,
    );
    return this.mapMessage(message);
  }

  async sendAudioMessage(
    userId: string,
    input: SendAudioMessageInput,
    file: MulterFile,
  ): Promise<DirectMessagePayload> {
    if (!file) {
      throw new BadRequestException({
        message: 'Envie um arquivo de áudio.',
      });
    }

    if (!file.mimetype?.startsWith('audio/')) {
      throw new BadRequestException({
        message: 'O arquivo enviado precisa ser um áudio.',
      });
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      throw new BadRequestException({
        message: 'O áudio excede o limite permitido.',
      });
    }

    const conversation = await this.requireConversationAccess(
      input.conversationId,
      userId,
    );
    await this.assertCanContact(userId, this.getPeerId(conversation, userId));
    const clientMessageId = input.clientMessageId?.trim() || null;
    const replyToMessageId = input.replyToMessageId?.trim() || null;

    if (clientMessageId) {
      const existing = await this.prisma.directMessage.findFirst({
        where: {
          conversationId: input.conversationId,
          clientMessageId,
          deletedAt: null,
        },
        include: this.messageInclude(),
      });

      if (existing) {
        return this.mapMessage(existing);
      }
    }

    if (replyToMessageId) {
      const replyTarget = await this.prisma.directMessage.findFirst({
        where: {
          id: replyToMessageId,
          conversationId: input.conversationId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!replyTarget) {
        throw new BadRequestException({
          message: 'A mensagem de resposta não foi encontrada.',
        });
      }
    }

    const createdAt = new Date();
    const audioPreview = this.buildAudioPreview(input.durationMs);
    const message = await this.prisma.$transaction(async (tx) => {
      const mediaAsset = await tx.mediaAsset.create({
        data: {
          ownerId: userId,
          url: this.buildDataUrl(file.mimetype, file.buffer),
          mimeType: file.mimetype,
          sizeBytes: BigInt(file.size),
          storageKey: `direct-message-audio-${randomUUID()}`,
          originalFileName: file.originalname || null,
          durationMs: input.durationMs ?? null,
        },
      });

      const created = await tx.directMessage.create({
        data: {
          conversationId: input.conversationId,
          senderId: userId,
          type: 'audio',
          content: input.forwarded
            ? input.forwardedOrigin === 'cloud'
              ? input.cloudId?.trim() && input.cloudName?.trim()
                ? `↗ Encaminhada [cloud:${encodeURIComponent(input.cloudId.slice(0, 200))}:${encodeURIComponent(input.cloudName.slice(0, 200))}]`
                : '↗ Encaminhada de uma cloud'
              : '↗ Encaminhada'
            : null,
          mediaAssetId: mediaAsset.id,
          clientMessageId,
          replyToMessageId,
        },
        include: this.messageInclude(),
      });

      const unreadField =
        conversation.participantOneId === userId
          ? 'participantTwoUnreadCount'
          : 'participantOneUnreadCount';
      await tx.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageId: created.id,
          lastMessageType: 'audio',
          lastMessageAt: createdAt,
          lastMessagePreview: audioPreview,
          [unreadField]: {
            increment: 1,
          },
        },
      });

      return created;
    });

    void this.notifyRecipientAfterCommit(
      message.id,
      input.conversationId,
      userId,
      message.content,
    );
    return this.mapMessage(message);
  }

  async sendImageMessage(
    userId: string,
    input: SendImageMessageInput,
    file: MulterFile,
  ): Promise<DirectMessagePayload> {
    if (!file) {
      throw new BadRequestException({
        message: 'Envie um arquivo de imagem.',
      });
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException({
        message: 'O arquivo enviado precisa ser uma imagem.',
      });
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException({
        message: 'A imagem excede o limite permitido.',
      });
    }

    const conversation = await this.requireConversationAccess(
      input.conversationId,
      userId,
    );
    await this.assertCanContact(userId, this.getPeerId(conversation, userId));
    const clientMessageId = input.clientMessageId?.trim() || null;
    const replyToMessageId = input.replyToMessageId?.trim() || null;

    if (clientMessageId) {
      const existing = await this.prisma.directMessage.findFirst({
        where: {
          conversationId: input.conversationId,
          clientMessageId,
          deletedAt: null,
        },
        include: this.messageInclude(),
      });

      if (existing) {
        return this.mapMessage(existing);
      }
    }

    if (replyToMessageId) {
      const replyTarget = await this.prisma.directMessage.findFirst({
        where: {
          id: replyToMessageId,
          conversationId: input.conversationId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!replyTarget) {
        throw new BadRequestException({
          message: 'A mensagem de resposta não foi encontrada.',
        });
      }
    }

    const createdAt = new Date();
    const imagePreview = this.buildImagePreview();
    const message = await this.prisma.$transaction(async (tx) => {
      const mediaAsset = await tx.mediaAsset.create({
        data: {
          ownerId: userId,
          url: this.buildDataUrl(file.mimetype, file.buffer),
          mimeType: file.mimetype,
          sizeBytes: BigInt(file.size),
          storageKey: `direct-message-image-${randomUUID()}`,
          originalFileName: file.originalname || null,
        },
      });

      const created = await tx.directMessage.create({
        data: {
          conversationId: input.conversationId,
          senderId: userId,
          type: 'image',
          content: input.forwarded
            ? input.forwardedOrigin === 'cloud'
              ? input.cloudId?.trim() && input.cloudName?.trim()
                ? `↗ Encaminhada [cloud:${encodeURIComponent(input.cloudId.slice(0, 200))}:${encodeURIComponent(input.cloudName.slice(0, 200))}]`
                : '↗ Encaminhada de uma cloud'
              : '↗ Encaminhada'
            : null,
          mediaAssetId: mediaAsset.id,
          clientMessageId,
          replyToMessageId,
        },
        include: this.messageInclude(),
      });

      const unreadField =
        conversation.participantOneId === userId
          ? 'participantTwoUnreadCount'
          : 'participantOneUnreadCount';

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageId: created.id,
          lastMessageType: 'image',
          lastMessageAt: createdAt,
          lastMessagePreview: imagePreview,
          [unreadField]: {
            increment: 1,
          },
        },
      });

      return created;
    });

    void this.notifyRecipientAfterCommit(
      message.id,
      input.conversationId,
      userId,
      message.content,
    );
    return this.mapMessage(message);
  }

  async sendLinkMessage(
    userId: string,
    input: SendLinkMessageInput,
  ): Promise<DirectMessagePayload> {
    const url = input.url.trim();

    if (!url) {
      throw new BadRequestException({
        message: 'Informe o link da cloud.',
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadRequestException({
        message: 'O link informado é inválido.',
      });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException({
        message: 'Use um link http ou https.',
      });
    }

    const conversation = await this.requireConversationAccess(
      input.conversationId,
      userId,
    );
    await this.assertCanContact(userId, this.getPeerId(conversation, userId));
    const cloudPath = parsedUrl.pathname.match(/^\/cloud\/([0-9a-f-]{36})(?:\/conversation)?\/?$/i);
    if (cloudPath) {
      const cloud = await this.prisma.cloud.findUnique({ where: { id: cloudPath[1] }, select: { authorId: true, visibility: true } });
      if (cloud?.visibility === 'private') {
        if (cloud.authorId !== userId) throw new BadRequestException({ message: 'Somente o criador pode enviar convites para esta Cloud privada.' });
        const member = await this.prisma.cloudMember.findFirst({ where: { cloudId: cloudPath[1], userId: this.getPeerId(conversation, userId) }, select: { id: true } });
        if (!member) throw new BadRequestException({ message: 'A pessoa precisa ser convidada para esta Cloud privada.' });
      }
    }
    const invitePath = parsedUrl.pathname.match(/^\/invite\/([^/]+)\/?$/);
    if (invitePath) {
      const invite = await this.prisma.cloudInvite.findUnique({ where: { token: invitePath[1] }, include: { cloud: { select: { id: true, authorId: true, visibility: true } } } });
      if (invite?.cloud.visibility === 'private') {
        if (invite.cloud.authorId !== userId) throw new BadRequestException({ message: 'Somente o criador pode enviar convites para esta Cloud privada.' });
        const member = await this.prisma.cloudMember.findFirst({ where: { cloudId: invite.cloud.id, userId: this.getPeerId(conversation, userId) }, select: { id: true } });
        if (!member) throw new BadRequestException({ message: 'A pessoa precisa ser convidada para esta Cloud privada.' });
      }
    }
    const clientMessageId = input.clientMessageId?.trim() || null;
    const replyToMessageId = input.replyToMessageId?.trim() || null;

    if (clientMessageId) {
      const existing = await this.prisma.directMessage.findFirst({
        where: {
          conversationId: input.conversationId,
          clientMessageId,
          deletedAt: null,
        },
        include: this.messageInclude(),
      });

      if (existing) {
        return this.mapMessage(existing);
      }
    }

    if (replyToMessageId) {
      const replyTarget = await this.prisma.directMessage.findFirst({
        where: {
          id: replyToMessageId,
          conversationId: input.conversationId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!replyTarget) {
        throw new BadRequestException({
          message: 'A mensagem de resposta não foi encontrada.',
        });
      }
    }

    const createdAt = new Date();
    const linkPreview = this.buildLinkPreview(input.label, parsedUrl);
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: {
          conversationId: input.conversationId,
          senderId: userId,
          type: 'link',
          content: JSON.stringify({
            url: parsedUrl.toString(),
            label: input.label?.trim() || null,
          }),
          clientMessageId,
          replyToMessageId,
        },
        include: this.messageInclude(),
      });

      const unreadField =
        conversation.participantOneId === userId
          ? 'participantTwoUnreadCount'
          : 'participantOneUnreadCount';

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageId: created.id,
          lastMessageType: 'link',
          lastMessageAt: createdAt,
          lastMessagePreview: linkPreview,
          [unreadField]: {
            increment: 1,
          },
        },
      });

      return created;
    });

    void this.notifyRecipientAfterCommit(
      message.id,
      input.conversationId,
      userId,
      message.content,
    );
    return this.mapMessage(message);
  }

  async markConversationRead(
    userId: string,
    conversationId: string,
  ): Promise<DirectConversationPayload> {
    const conversation = await this.requireConversationAccess(
      conversationId,
      userId,
    );
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.directMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
          deletedAt: null,
        },
        data: {
          readAt: now,
        },
      });

      if (conversation.participantOneId === userId) {
        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            participantOneLastReadAt: now,
            participantOneUnreadCount: 0,
          },
        });
      } else {
        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            participantTwoLastReadAt: now,
            participantTwoUnreadCount: 0,
          },
        });
      }
    });

    return this.getConversationById(userId, conversationId);
  }

  async setMessagePinned(
    userId: string,
    conversationId: string,
    messageId: string,
    pinned: boolean,
  ): Promise<DirectMessagePayload> {
    await this.requireConversationAccess(conversationId, userId);
    const message = await this.prisma.directMessage.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
      select: { id: true },
    });
    if (!message) {
      throw new BadRequestException({ message: 'Mensagem não encontrada.' });
    }
    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { isPinned: pinned },
      include: this.messageInclude(),
    });
    return this.mapMessage(updated);
  }

  async getConversationById(
    userId: string,
    conversationId: string,
  ): Promise<DirectConversationPayload> {
    const conversation = await this.requireConversationAccess(
      conversationId,
      userId,
    );
    return this.mapConversation(conversation, userId);
  }

  async requireConversationContactAccess(
    userId: string,
    conversationId: string,
  ): Promise<ConversationWithRelations> {
    const conversation = await this.requireConversationAccess(
      conversationId,
      userId,
    );
    await this.assertCanContact(userId, this.getPeerId(conversation, userId));
    return conversation;
  }

  private async requireConversationAccess(
    conversationId: string,
    userId: string,
  ): Promise<ConversationWithRelations> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        deletedAt: null,
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      include: this.conversationInclude(),
    });

    if (!conversation) {
      throw new NotFoundException({
        message: 'Conversa não encontrada.',
      });
    }

    return conversation;
  }

  private getPeerId(conversation: ConversationWithRelations, userId: string) {
    return conversation.participantOneId === userId
      ? conversation.participantTwoId
      : conversation.participantOneId;
  }

  private async assertCanContact(userId: string, peerUserId: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: peerUserId },
          { blockerId: peerUserId, blockedId: userId },
        ],
      },
      select: { blockerId: true },
    });
    if (block) {
      throw new ForbiddenException({
        message:
          block.blockerId === peerUserId
            ? 'Esta pessoa bloqueou você. Suas novas mensagens não serão entregues.'
            : 'Você bloqueou esta pessoa. Desbloqueie-a para enviar mensagens.',
      });
    }

    const peer = await this.prisma.user.findUnique({
      where: { id: peerUserId },
      include: { profile: true },
    });
    if (peer?.profile?.isPrivate) {
      const followsPeer = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: peerUserId,
          },
        },
        select: { followerId: true },
      });
      if (!followsPeer) {
        throw new ForbiddenException({
          message:
            'Este perfil é privado. Siga a pessoa primeiro para enviar uma mensagem.',
        });
      }
    }
  }

  private async requireUserSummary(userId: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new NotFoundException({
        message: 'Usuário não encontrado.',
      });
    }

    return user;
  }

  private normalizeTake(rawTake: number | undefined): number {
    if (!rawTake || Number.isNaN(rawTake)) {
      return DEFAULT_MESSAGE_TAKE;
    }

    return Math.max(1, Math.min(rawTake, 100));
  }

  private conversationInclude() {
    return {
      participantOne: { include: { profile: true } },
      participantTwo: { include: { profile: true } },
      lastMessage: {
        include: {
          sender: { include: { profile: true } },
          mediaAsset: true,
        },
      },
    } as const;
  }

  async editMessage(
    userId: string,
    conversationId: string,
    messageId: string,
    content: string,
  ): Promise<DirectMessagePayload> {
    await this.requireConversationContactAccess(userId, conversationId);

    const message = await this.prisma.directMessage.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
      include: this.messageInclude(),
    });

    if (!message)
      throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    if (message.senderId !== userId)
      throw new ForbiddenException({
        message: 'Você só pode editar suas próprias mensagens.',
      });
    if (message.type !== 'text')
      throw new BadRequestException({
        message: 'Apenas mensagens de texto podem ser editadas.',
      });

    const trimmed = (content ?? '').trim();
    if (!trimmed)
      throw new BadRequestException({
        message: 'O conteúdo não pode ser vazio.',
      });

    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { content: trimmed, editedAt: new Date() },
      include: this.messageInclude(),
    });

    return this.mapMessage(updated);
  }

  async deleteMessage(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.requireConversationContactAccess(userId, conversationId);

    const message = await this.prisma.directMessage.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
    });

    if (!message)
      throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    if (message.senderId !== userId)
      throw new ForbiddenException({
        message: 'Você só pode apagar suas próprias mensagens.',
      });

    await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  private async notifyRecipientAfterCommit(
    messageId: string,
    conversationId: string,
    senderId: string,
    content: string | null,
  ) {
    try {
      await this.notifyRecipient(messageId, conversationId, senderId, content);
    } catch (error) {
      // The database transaction has committed. Keep the HTTP response truthful
      // even if a later push lookup or delivery fails.
      this.logger.warn(
        `Could not notify recipient for message ${messageId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyRecipient(
    messageId: string,
    conversationId: string,
    senderId: string,
    content: string | null,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { participantOneId: true, participantTwoId: true },
    });
    if (!conversation) return;
    const recipientId =
      conversation.participantOneId === senderId
        ? conversation.participantTwoId
        : conversation.participantOneId;
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      include: { profile: true },
    });
    const senderName =
      sender?.profile?.displayName || sender?.profile?.username || 'Alguém';
    const preview = truncatePreview(content || 'enviou uma mensagem', 140);
    const unreadMessages = await this.prisma.directMessage.findMany({
      where: {
        conversationId,
        senderId,
        readAt: null,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { content: true },
    });
    if (unreadMessages.length === 0) return;
    // Direct messages belong to the Messages badge, not the activity bell.
    await this.pushNotifications.send(recipientId, {
      // Some Android notification layouts only surface the title while the
      // notification is collapsed. Keep the message preview there as well as
      // in the body so the recipient can still read it in that layout.
      title: `${senderName}: ${preview}`,
      body: preview,
      url: `/messages?conversation=${conversationId}`,
      tag: `direct-message-${conversationId}`,
      messageId,
      unreadMessages: unreadMessages.map((message) =>
        truncatePreview(message.content || 'enviou uma mensagem', 140),
      ),
    });
  }

  private messageInclude() {
    return {
      sender: { include: { profile: true } },
      mediaAsset: true,
      reactions: { orderBy: { createdAt: 'asc' } },
    } as const;
  }

  private mapConversation(
    conversation: ConversationWithRelations,
    viewerId: string,
    peerOverride?: UserSummary,
    blockState: { blockedByPeer: boolean; blockedByMe: boolean } = {
      blockedByPeer: false,
      blockedByMe: false,
    },
  ): DirectConversationPayload {
    const participantOne = conversation.participantOne;
    const participantTwo = conversation.participantTwo;
    const participant =
      participantOne.id === viewerId ? participantTwo : participantOne;
    const peerProfile = participant.profile ?? peerOverride?.profile;

    if (!peerProfile) {
      throw new Error('Conversation participant profile is required.');
    }

    const unreadCount =
      conversation.participantOneId === viewerId
        ? conversation.participantOneUnreadCount
        : conversation.participantTwoUnreadCount;

    return {
      id: conversation.id,
      conversationKey: conversation.conversationKey,
      participantOneId: conversation.participantOneId,
      participantTwoId: conversation.participantTwoId,
      lastMessageId: conversation.lastMessageId,
      lastMessageType: conversation.lastMessageType,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: conversation.lastMessagePreview,
      unreadCount,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      blockedByPeer: blockState.blockedByPeer,
      blockedByMe: blockState.blockedByMe,
      participant: {
        id: participant.id,
        username: peerProfile.username,
        displayName: peerProfile.displayName,
        avatarUrl: peerProfile.avatarUrl,
        status: participant.status,
      },
    };
  }

  private mapMessage(message: MessageWithRelations): DirectMessagePayload {
    const profile = message.sender.profile;

    if (!profile) {
      throw new Error('Message sender profile is required.');
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      clientMessageId: message.clientMessageId,
      replyToMessageId: message.replyToMessageId,
      readAt: message.readAt?.toISOString() ?? null,
      editedAt: message.editedAt?.toISOString() ?? null,
      isPinned: message.isPinned,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      deletedAt: message.deletedAt?.toISOString() ?? null,
      sender: {
        id: message.senderId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
      mediaAsset: message.mediaAsset
        ? this.mapMediaAsset(message.mediaAsset)
        : null,
      reactions: (message.reactions ?? []).map((reaction) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        createdAt: reaction.createdAt.toISOString(),
      })),
    };
  }

  private mapMediaAsset(asset: MediaAsset): DirectMessagePayload['mediaAsset'] {
    return {
      id: asset.id,
      url: asset.url,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes.toString(),
      originalFileName: asset.originalFileName,
      width: asset.width,
      height: asset.height,
      durationMs: asset.durationMs,
    };
  }

  private buildAudioPreview(durationMs?: number | null): string {
    if (!durationMs || durationMs <= 0) {
      return 'Áudio';
    }

    return `Áudio · ${this.formatDuration(durationMs)}`;
  }

  private buildImagePreview(): string {
    return 'Imagem';
  }

  private buildLinkPreview(label: string | undefined, parsedUrl: URL): string {
    const cleanLabel = label?.trim();

    if (cleanLabel) {
      // Detect cloud_invitation JSON and return human-readable preview
      try {
        const parsed = JSON.parse(cleanLabel) as {
          type?: string;
          cloudTitle?: string;
          cloudVisibility?: string;
        };
        if (parsed.type === 'cloud_invitation') {
          const visibility =
            parsed.cloudVisibility === 'private' ? 'privada' : 'pública';
          return parsed.cloudTitle
            ? `Convite: ${parsed.cloudTitle}`
            : `Convite para Cloud ${visibility}`;
        }
      } catch {
        /* not JSON, use as-is */
      }

      return truncatePreview(cleanLabel);
    }

    return truncatePreview(parsedUrl.hostname.replace(/^www\./, ''));
  }

  private formatDuration(durationMs: number): string {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private buildDataUrl(mimeType: string, buffer: Buffer): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
}
