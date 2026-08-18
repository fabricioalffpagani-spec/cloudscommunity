import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CloudMode, CloudStatus, CloudVisibility, Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { CloudMessagePayload, CloudMessageReactionPayload, CloudPayload, CreateCloudInput, CreateCloudMessageInput, ListCloudMessagesQuery } from './cloud.types';

const ALLOWED_DURATIONS = ['5 min', '10 min', '30 min', '1h', '24h'] as const;

type SessionUser = Awaited<ReturnType<AuthService['resolveSession']>> extends infer T
  ? T extends { user: infer U } ? U : never
  : never;

type CloudWithRelations = Prisma.CloudGetPayload<{
  include: {
    author: {
      include: {
        profile: true;
      };
    };
    _count: {
      select: {
        hypes: true;
        members: true;
      };
    };
  };
}>;

type CloudMessageWithRelations = Prisma.CloudMessageGetPayload<{
  include: {
    user: {
      include: {
        profile: true;
      };
    };
    replyToMessage: {
      include: {
        user: {
          include: {
            profile: true;
          };
        };
      };
    };
    reactions: {
      include: {
        user: {
          include: {
            profile: true;
          };
        };
      };
    };
  };
}>;

const DURATION_TO_SECONDS: Record<string, number> = {
  '5 min': 5 * 60,
  '10 min': 10 * 60,
  '30 min': 30 * 60,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
};

@Injectable()
export class CloudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findById(token: string | null, cloudId: string): Promise<{ ok: true; cloud: CloudPayload }> {
    await this.requireSession(token);

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(cloudId)) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
      include: this.cloudInclude(),
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    return {
      ok: true,
      cloud: this.mapCloud(cloud),
    };
  }

  async listFeed(token: string | null): Promise<{ ok: true; clouds: CloudPayload[] }> {
    const current = await this.requireSession(token);
    void current;
    await this.expireDueClouds();

    const clouds = await this.prisma.cloud.findMany({
      where: {
        deletedAt: null,
        status: CloudStatus.active,
      },
      include: this.cloudInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      ok: true,
      clouds: clouds.map((cloud) => this.mapCloud(cloud)),
    };
  }

  async listFollowing(token: string | null): Promise<{ ok: true; clouds: CloudPayload[] }> {
    const current = await this.requireSession(token);
    await this.expireDueClouds();

    const following = await this.prisma.follow.findMany({
      where: { followerId: current.user.id },
      select: { followingId: true },
    });

    const followingIds = following.map((entry) => entry.followingId);

    if (followingIds.length === 0) {
      return {
        ok: true,
        clouds: [],
      };
    }

    const clouds = await this.prisma.cloud.findMany({
      where: {
        deletedAt: null,
        status: CloudStatus.active,
        authorId: { in: followingIds },
      },
      include: this.cloudInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      ok: true,
      clouds: clouds.map((cloud) => this.mapCloud(cloud)),
    };
  }

  async listMine(token: string | null): Promise<{ ok: true; clouds: CloudPayload[] }> {
    const current = await this.requireSession(token);
    await this.expireDueClouds();

    const clouds = await this.prisma.cloud.findMany({
      where: {
        deletedAt: null,
        authorId: current.user.id,
        status: CloudStatus.active,
      },
      include: this.cloudInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      ok: true,
      clouds: clouds.map((cloud) => this.mapCloud(cloud)),
    };
  }

  async create(token: string | null, input: CreateCloudInput): Promise<{ ok: true; cloud: CloudPayload }> {
    const current = await this.requireSession(token);
    const title = (input.title ?? '').trim();
    const description = (input.description ?? '').trim();
    const duration = (input.duration ?? '').trim();
    const visibility = input.visibility === 'private' ? CloudVisibility.private : CloudVisibility.public;

    if (!title) {
      throw new BadRequestException({
        message: 'Título obrigatório.',
        fieldErrors: { title: 'Informe o título da cloud.' },
      });
    }

    if (title.length > 180) {
      throw new BadRequestException({
        message: 'Título muito longo.',
        fieldErrors: { title: 'O título deve ter até 180 caracteres.' },
      });
    }

    if (description.length > 2000) {
      throw new BadRequestException({
        message: 'Descrição muito longa.',
        fieldErrors: { description: 'A descrição deve ter até 2000 caracteres.' },
      });
    }

    if (!ALLOWED_DURATIONS.includes(duration as (typeof ALLOWED_DURATIONS)[number])) {
      throw new BadRequestException({
        message: 'Duração inválida.',
        fieldErrors: { duration: 'Selecione uma duração válida.' },
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const cloud = await tx.cloud.create({
        data: {
          authorId: current.user.id,
          title,
          content: description || null,
          category: 'general',
          mode: CloudMode.text,
          visibility,
          status: CloudStatus.active,
          duration,
          startedAt: new Date(),
        },
        include: this.cloudInclude(),
      });

      await tx.cloudMember.create({
        data: {
          cloudId: cloud.id,
          userId: current.user.id,
          role: 'host',
        },
      });

      return cloud;
    });

    return {
      ok: true,
      cloud: this.mapCloud(created),
    };
  }

  async delete(token: string | null, cloudId: string): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({
        message: 'Você não tem permissão para excluir esta cloud.',
      });
    }

    await this.prisma.cloud.update({
      where: { id: cloudId },
      data: {
        deletedAt: new Date(),
        status: CloudStatus.ended,
        endedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async removeMember(token: string | null, cloudId: string, userId: string): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({
        message: 'Você não tem permissão para remover membros desta cloud.',
      });
    }

    if (userId === current.user.id) {
      throw new BadRequestException({
        message: 'Você não pode remover a si mesmo da cloud.',
      });
    }

    const member = await this.prisma.cloudMember.findFirst({
      where: {
        cloudId,
        userId,
        leftAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException({ message: 'Membro não encontrado na cloud.' });
    }

    await this.prisma.cloudMember.update({
      where: { id: member.id },
      data: {
        leftAt: new Date(),
      },
    });

    return { ok: true };
  }

  async pinMessage(token: string | null, cloudId: string, messageId: string): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({
        message: 'Você não tem permissão para fixar comentários nesta cloud.',
      });
    }

    const message = await this.prisma.cloudMessage.findFirst({
      where: {
        id: messageId,
        cloudId,
        deletedAt: null,
      },
    });

    if (!message) {
      throw new NotFoundException({ message: 'Comentário não encontrado nesta cloud.' });
    }

    // Desfixar qualquer mensagem já fixada nesta cloud
    await this.prisma.cloudMessage.updateMany({
      where: {
        cloudId,
        isPinned: true,
        id: { not: messageId },
      },
      data: {
        isPinned: false,
      },
    });

    // Fixar a nova mensagem
    await this.prisma.cloudMessage.update({
      where: { id: messageId },
      data: {
        isPinned: true,
      },
    });

    return { ok: true };
  }

  async unpinMessage(token: string | null, cloudId: string, messageId: string): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({
        message: 'Você não tem permissão para desfixar comentários nesta cloud.',
      });
    }

    const message = await this.prisma.cloudMessage.findFirst({
      where: {
        id: messageId,
        cloudId,
        deletedAt: null,
      },
    });

    if (!message) {
      throw new NotFoundException({ message: 'Comentário não encontrado nesta cloud.' });
    }

    await this.prisma.cloudMessage.update({
      where: { id: messageId },
      data: {
        isPinned: false,
      },
    });

    return { ok: true };
  }

  async createMessage(
    token: string | null,
    cloudId: string,
    body: { type: string; content?: string; mediaUrl?: string; replyToMessageId?: string; clientMessageId?: string },
  ): Promise<{ ok: true; message: CloudMessagePayload }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(current.user.id, cloudId);

    const messageType = body.type === 'audio' || body.type === 'image' || body.type === 'link' ? body.type : 'text';

    return {
      ok: true,
      message: await this.createCloudMessage(current.user.id, cloudId, {
        type: messageType,
        content: body.content,
        mediaUrl: body.mediaUrl,
        replyToMessageId: body.replyToMessageId,
        clientMessageId: body.clientMessageId,
      }),
    };
  }

  async sendAudioMessage(
    token: string | null,
    cloudId: string,
    body: { clientMessageId?: string; replyToMessageId?: string },
    file?: { mimetype?: string; size: number; buffer: Buffer; originalname?: string | null },
  ): Promise<{ ok: true; message: CloudMessagePayload }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(current.user.id, cloudId);

    if (!file) {
      throw new BadRequestException({ message: 'Envie um arquivo de áudio.' });
    }

    if (!file.mimetype?.startsWith('audio/')) {
      throw new BadRequestException({ message: 'O arquivo enviado precisa ser um áudio.' });
    }

    if (file.size > 25 * 1024 * 1024) {
      throw new BadRequestException({ message: 'O áudio excede o limite permitido.' });
    }

    return {
      ok: true,
      message: await this.createCloudMessage(current.user.id, cloudId, {
        type: 'audio',
        mediaUrl: this.buildDataUrl(file.mimetype, file.buffer),
        clientMessageId: body.clientMessageId,
        replyToMessageId: body.replyToMessageId,
      }),
    };
  }

  async sendImageMessage(
    token: string | null,
    cloudId: string,
    body: { clientMessageId?: string; replyToMessageId?: string },
    file?: { mimetype?: string; size: number; buffer: Buffer; originalname?: string | null },
  ): Promise<{ ok: true; message: CloudMessagePayload }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(current.user.id, cloudId);

    if (!file) {
      throw new BadRequestException({ message: 'Envie um arquivo de imagem.' });
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException({ message: 'O arquivo enviado precisa ser uma imagem.' });
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException({ message: 'A imagem excede o limite permitido.' });
    }

    return {
      ok: true,
      message: await this.createCloudMessage(current.user.id, cloudId, {
        type: 'image',
        mediaUrl: this.buildDataUrl(file.mimetype, file.buffer),
        clientMessageId: body.clientMessageId,
        replyToMessageId: body.replyToMessageId,
      }),
    };
  }

  async getMessages(
    token: string | null,
    cloudId: string,
    query: ListCloudMessagesQuery = {},
  ): Promise<{ ok: true; messages: CloudMessagePayload[] }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(current.user.id, cloudId);

    const take = this.normalizeTake(query.take);
    const before = query.before ? new Date(query.before) : null;

    const messages = await this.prisma.cloudMessage.findMany({
      where: {
        cloudId,
        deletedAt: null,
        ...(before && !Number.isNaN(before.getTime())
          ? { createdAt: { lt: before } }
          : {}),
      },
      include: this.messageInclude(),
      orderBy: {
        createdAt: 'desc',
      },
      take,
    });

    return {
      ok: true,
      messages: messages.reverse().map((message) => this.mapMessage(message)),
    };
  }

  async addReaction(
    token: string | null,
    cloudId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ ok: true; reaction: CloudMessageReactionPayload; removed: boolean }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    const message = await this.prisma.cloudMessage.findFirst({
      where: {
        id: messageId,
        cloudId,
        deletedAt: null,
      },
    });

    if (!message) {
      throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    }

    // Check if user is a member of the cloud
    const member = await this.prisma.cloudMember.findFirst({
      where: {
        cloudId,
        userId: current.user.id,
        leftAt: null,
      },
    });

    if (!member) {
      throw new UnauthorizedException({
        message: 'Você não é membro desta cloud.',
      });
    }

    // Check if user already reacted with this emoji
    const existingReaction = await this.prisma.cloudMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: current.user.id,
          emoji,
        },
      },
    });

    if (existingReaction) {
      // Remove the reaction (toggle behavior)
      await this.prisma.cloudMessageReaction.delete({
        where: {
          id: existingReaction.id,
        },
      });

      return {
        ok: true,
        removed: true,
        reaction: {
          id: existingReaction.id,
          emoji: existingReaction.emoji,
          userId: existingReaction.userId,
          user: {
            id: current.user.id,
            username: current.user.profile?.username || '',
            displayName: current.user.profile?.displayName || '',
            avatarUrl: current.user.profile?.avatarUrl ?? null,
          },
          createdAt: existingReaction.createdAt.toISOString(),
        },
      };
    }

    // Add new reaction
    const reaction = await this.prisma.cloudMessageReaction.create({
      data: {
        messageId,
        userId: current.user.id,
        emoji,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    return {
      ok: true,
      removed: false,
      reaction: {
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        user: {
          id: reaction.user.id,
          username: reaction.user.profile?.username || '',
          displayName: reaction.user.profile?.displayName || '',
          avatarUrl: reaction.user.profile?.avatarUrl ?? null,
        },
        createdAt: reaction.createdAt.toISOString(),
      },
    };
  }

  async getMessageReactions(token: string | null, cloudId: string, messageId: string): Promise<{ ok: true; reactions: CloudMessageReactionPayload[] }> {
    await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    const message = await this.prisma.cloudMessage.findFirst({
      where: {
        id: messageId,
        cloudId,
        deletedAt: null,
      },
    });

    if (!message) {
      throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    }

    const reactions = await this.prisma.cloudMessageReaction.findMany({
      where: {
        messageId,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      ok: true,
      reactions: reactions.map((reaction) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        user: {
          id: reaction.user.id,
          username: reaction.user.profile?.username || '',
          displayName: reaction.user.profile?.displayName || '',
          avatarUrl: reaction.user.profile?.avatarUrl ?? null,
        },
        createdAt: reaction.createdAt.toISOString(),
      })),
    };
  }

  async requireCloudAccess(userId: string, cloudId: string) {
    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    return cloud;
  }

  private normalizeTake(rawTake?: number): number {
    if (!rawTake || Number.isNaN(rawTake)) {
      return 50;
    }

    return Math.max(1, Math.min(rawTake, 100));
  }

  private async createCloudMessage(
    userId: string,
    cloudId: string,
    input: CreateCloudMessageInput,
  ): Promise<CloudMessagePayload> {
    const cloud = await this.requireCloudAccess(userId, cloudId);
    const replyToMessageId = input.replyToMessageId?.trim() || null;
    const type = input.type === 'audio' || input.type === 'image' || input.type === 'link' ? input.type : 'text';

    if (replyToMessageId) {
      const replyTarget = await this.prisma.cloudMessage.findFirst({
        where: {
          id: replyToMessageId,
          cloudId,
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

    const created = await this.prisma.cloudMessage.create({
      data: {
        cloudId,
        userId,
        type,
        content: input.content ?? null,
        mediaUrl: input.mediaUrl ?? null,
        replyToMessageId,
      },
      include: this.messageInclude(),
    });

    void cloud;
    return this.mapMessage(created, input.clientMessageId?.trim() || null);
  }

  private messageInclude() {
    return {
      user: {
        include: {
          profile: true,
        },
      },
      replyToMessage: {
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
      reactions: {
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
    } as const;
  }

  private mapMessage(message: CloudMessageWithRelations, clientMessageId: string | null = null): CloudMessagePayload {
    const profile = message.user.profile;

    if (!profile) {
      throw new Error('Message sender profile is required.');
    }

    return {
      id: message.id,
      cloudId: message.cloudId,
      senderId: message.userId,
      type: message.type as CloudMessagePayload['type'],
      content: message.content,
      mediaUrl: message.mediaUrl,
      clientMessageId,
      replyToMessageId: message.replyToMessageId,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      deletedAt: message.deletedAt?.toISOString() ?? null,
      sender: {
        id: message.user.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
      replyTo: message.replyToMessage
        ? {
            id: message.replyToMessage.id,
            sender: message.replyToMessage.user.profile?.displayName || 'Usuário',
            content: message.replyToMessage.content,
          }
        : null,
      reactions: message.reactions.map((reaction) => ({
        id: reaction.id,
        emoji: reaction.emoji,
        userId: reaction.userId,
        user: {
          id: reaction.user.id,
          username: reaction.user.profile?.username || '',
          displayName: reaction.user.profile?.displayName || '',
          avatarUrl: reaction.user.profile?.avatarUrl ?? null,
        },
        createdAt: reaction.createdAt.toISOString(),
      })),
    };
  }

  private buildDataUrl(mimeType: string, buffer: Buffer) {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  private cloudInclude() {
    return {
      author: {
        include: {
          profile: true,
        },
      },
      members: {
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
      _count: {
        select: {
          hypes: true,
          members: true,
        },
      },
    };
  }

  private async requireSession(token: string | null) {
    const session = await this.authService.resolveSession(token);
    if (!session) {
      throw new UnauthorizedException({ message: 'Sessão não encontrada.' });
    }
    return session;
  }

  // Check for expired clouds
  private async expireDueClouds() {
    const now = new Date();
    const activeClouds = await this.prisma.cloud.findMany({
      where: {
        status: CloudStatus.active,
        deletedAt: null,
      },
      select: { id: true, duration: true, startedAt: true },
    });

    for (const cloud of activeClouds) {
      if (!cloud.startedAt) continue;
      
      const durationSeconds = DURATION_TO_SECONDS[cloud.duration] ?? 5 * 60;
      const endTime = new Date(cloud.startedAt.getTime() + durationSeconds * 1000);
      if (now >= endTime) {
        await this.prisma.cloud.update({
          where: { id: cloud.id },
          data: {
            status: CloudStatus.ended,
            endedAt: now,
          },
        });
      }
    }
  }

  private mapCloud(cloud: CloudWithRelations): CloudPayload {
    const profile = cloud.author.profile;

    if (!profile) {
      throw new Error('Author profile is required.');
    }

    return {
      id: cloud.id,
      title: cloud.title,
      description: cloud.content,
      duration: cloud.duration,
      visibility: cloud.visibility === CloudVisibility.private ? 'private' : 'public',
      createdAt: cloud.createdAt.toISOString(),
      updatedAt: cloud.updatedAt.toISOString(),
      authorId: cloud.authorId,
      author: {
        id: cloud.author.id,
        name: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
      },
      hypesCount: cloud._count.hypes,
      membersCount: Math.max(1, cloud._count.members),
      href: `/cloud/${cloud.id}`,
      status: cloud.status === CloudStatus.active ? 'active' : 'inactive',
    };
  }
}
