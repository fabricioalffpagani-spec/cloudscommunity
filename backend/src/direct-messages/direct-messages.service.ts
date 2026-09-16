import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Conversation, DirectMessage, MediaAsset, Prisma } from '@prisma/client';
import type { File as MulterFile } from 'multer';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import {
  CreateConversationInput,
  DirectConversationPayload,
  DirectMessagePayload,
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
  };
}>;

const DEFAULT_MESSAGE_TAKE = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function buildConversationKey(participantOneId: string, participantTwoId: string): string {
  return [participantOneId, participantTwoId].sort().join(':');
}

export function truncatePreview(value: string, maxLength = 255): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength);
}

@Injectable()
export class DirectMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrResolveConversation(userId: string, input: CreateConversationInput): Promise<DirectConversationPayload> {
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

    const [participantOneId, participantTwoId] = [userId, peerUserId].sort();
    const conversationKey = buildConversationKey(participantOneId, participantTwoId);

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

  async listConversations(userId: string): Promise<DirectConversationPayload[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        deletedAt: null,
        OR: [{ participantOneId: userId }, { participantTwoId: userId }],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      include: this.conversationInclude(),
    });

    return conversations.map((conversation) => this.mapConversation(conversation, userId));
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
      const peerId = conversation.participantOneId === userId
        ? conversation.participantTwoId
        : conversation.participantOneId;
      peerIds.add(peerId);
    }

    return Array.from(peerIds);
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
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: cursor ? -take : take,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: this.messageInclude(),
    });

    return messages.map((message) => this.mapMessage(message));
  }

  async sendTextMessage(userId: string, input: SendDirectMessageInput): Promise<DirectMessagePayload> {
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

    const conversation = await this.requireConversationAccess(input.conversationId, userId);
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

      const preview = truncatePreview(content);
      const unreadField = conversation.participantOneId === userId ? 'participantTwoUnreadCount' : 'participantOneUnreadCount';
      const recipientId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;

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

      // Get sender profile for notification
      const senderProfile = await tx.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      // Create notification for the recipient
      await tx.notification.create({
        data: {
          userId: recipientId,
          type: 'direct_message',
          entityType: 'direct_message',
          entityId: created.id,
          title: 'Nova mensagem',
          body: `${senderProfile?.profile?.displayName || 'Alguém'} te enviou uma mensagem`,
        },
      });

      return created;
    });

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

    const conversation = await this.requireConversationAccess(input.conversationId, userId);
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
          content: input.forwarded ? '↗ Encaminhada' : null,
          mediaAssetId: mediaAsset.id,
          clientMessageId,
          replyToMessageId,
        },
        include: this.messageInclude(),
      });

      const unreadField = conversation.participantOneId === userId ? 'participantTwoUnreadCount' : 'participantOneUnreadCount';
      const recipientId = conversation.participantOneId === userId ? conversation.participantTwoId : conversation.participantOneId;

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

      // Get sender profile for notification
      const senderProfile = await tx.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      // Create notification for the recipient
      await tx.notification.create({
        data: {
          userId: recipientId,
          type: 'direct_message',
          entityType: 'direct_message',
          entityId: created.id,
          title: 'Nova mensagem',
          body: `${senderProfile?.profile?.displayName || 'Alguém'} te enviou uma mensagem de áudio`,
        },
      });

      return created;
    });

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

    const conversation = await this.requireConversationAccess(input.conversationId, userId);
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
          content: input.forwarded ? '↗ Encaminhada' : null,
          mediaAssetId: mediaAsset.id,
          clientMessageId,
          replyToMessageId,
        },
        include: this.messageInclude(),
      });

      const unreadField = conversation.participantOneId === userId ? 'participantTwoUnreadCount' : 'participantOneUnreadCount';

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

    const conversation = await this.requireConversationAccess(input.conversationId, userId);
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

      const unreadField = conversation.participantOneId === userId ? 'participantTwoUnreadCount' : 'participantOneUnreadCount';

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

    return this.mapMessage(message);
  }

  async markConversationRead(userId: string, conversationId: string): Promise<DirectConversationPayload> {
    const conversation = await this.requireConversationAccess(conversationId, userId);
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

  async getConversationById(userId: string, conversationId: string): Promise<DirectConversationPayload> {
    const conversation = await this.requireConversationAccess(conversationId, userId);
    return this.mapConversation(conversation, userId);
  }

  private async requireConversationAccess(conversationId: string, userId: string): Promise<ConversationWithRelations> {
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
    await this.requireConversationAccess(conversationId, userId);

    const message = await this.prisma.directMessage.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
      include: this.messageInclude(),
    });

    if (!message) throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    if (message.senderId !== userId)
      throw new ForbiddenException({ message: 'Você só pode editar suas próprias mensagens.' });
    if (message.type !== 'text')
      throw new BadRequestException({ message: 'Apenas mensagens de texto podem ser editadas.' });

    const trimmed = (content ?? '').trim();
    if (!trimmed) throw new BadRequestException({ message: 'O conteúdo não pode ser vazio.' });

    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { content: trimmed },
      include: this.messageInclude(),
    });

    return this.mapMessage(updated);
  }

  async deleteMessage(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.requireConversationAccess(conversationId, userId);

    const message = await this.prisma.directMessage.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
    });

    if (!message) throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    if (message.senderId !== userId)
      throw new ForbiddenException({ message: 'Você só pode apagar suas próprias mensagens.' });

    await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  private messageInclude() {
    return {
      sender: { include: { profile: true } },
      mediaAsset: true,
    } as const;
  }

  private mapConversation(
    conversation: ConversationWithRelations,
    viewerId: string,
    peerOverride?: UserSummary,
  ): DirectConversationPayload {
    const participantOne = conversation.participantOne;
    const participantTwo = conversation.participantTwo;
    const participant = participantOne.id === viewerId ? participantTwo : participantOne;
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
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      deletedAt: message.deletedAt?.toISOString() ?? null,
      sender: {
        id: message.senderId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
      mediaAsset: message.mediaAsset ? this.mapMediaAsset(message.mediaAsset) : null,
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
        const parsed = JSON.parse(cleanLabel) as { type?: string; cloudTitle?: string; cloudVisibility?: string };
        if (parsed.type === 'cloud_invitation') {
          const visibility = parsed.cloudVisibility === 'private' ? 'privada' : 'pública';
          return parsed.cloudTitle
            ? `Convite: ${parsed.cloudTitle}`
            : `Convite para Cloud ${visibility}`;
        }
      } catch { /* not JSON, use as-is */ }

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
