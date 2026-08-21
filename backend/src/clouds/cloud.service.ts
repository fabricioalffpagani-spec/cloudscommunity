import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CloudMode, CloudStatus, CloudVisibility, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { CloudInvitePayload, CloudMessageReactionPayload, CloudPayload, CreateCloudInput } from './cloud.types';

const ALLOWED_DURATIONS = ['30min', '1h', '2h', '5h', '24h'] as const;

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

const DURATION_TO_SECONDS: Record<string, number> = {
  '30min': 30 * 60,
  '1h': 60 * 60,
  '2h': 2 * 60 * 60,
  '5h': 5 * 60 * 60,
  '24h': 24 * 60 * 60,
};

function normalizeDuration(value: string): (typeof ALLOWED_DURATIONS)[number] | null {
  const compactValue = value.trim().toLowerCase().replace(/[\s.]/g, '');
  const aliases: Record<string, (typeof ALLOWED_DURATIONS)[number]> = {
    '30min': '30min',
    '30m': '30min',
    '30minutos': '30min',
    '1h': '1h',
    '1hora': '1h',
    '1horas': '1h',
    '2h': '2h',
    '2horas': '2h',
    '5h': '5h',
    '5horas': '5h',
    '24h': '24h',
    '24horas': '24h',
  };

  return aliases[compactValue] ?? null;
}

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
    await this.expireDueClouds();

    const clouds = await this.prisma.cloud.findMany({
      where: {
        deletedAt: null,
        status: CloudStatus.active,
        visibility: CloudVisibility.public,
      },
      include: this.cloudInclude(),
    });

    // Score = hypeCount * 3 + recency decay (hours since creation, capped at 72h)
    const now = Date.now();
    const scored = clouds
      .map((cloud) => {
        const ageHours = (now - cloud.createdAt.getTime()) / 3_600_000;
        const recency = Math.max(0, 1 - ageHours / 72);
        const score = cloud._count.hypes * 3 + recency * 10;
        return { cloud, score };
      })
      .sort((a, b) => b.score - a.score);

    const userHypes = new Set(
      (
        await this.prisma.cloudHype.findMany({
          where: { userId: current.user.id },
          select: { cloudId: true },
        })
      ).map((h) => h.cloudId),
    );

    return {
      ok: true,
      clouds: scored.map(({ cloud }) => ({
        ...this.mapCloud(cloud),
        hyped: userHypes.has(cloud.id),
      })),
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
    const duration = input.duration ?? '';
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

    if (!duration) {
      throw new BadRequestException({
        message: 'Duração obrigatória.',
        fieldErrors: { duration: 'Selecione uma duração.' },
      });
    }

    const normalizedDuration = normalizeDuration(duration);

    if (!normalizedDuration) {
      throw new BadRequestException({
        message: 'Duração inválida.',
        fieldErrors: { duration: 'Selecione 30min, 1h, 2h, 5h ou 24h.' },
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
          duration: normalizedDuration,
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

  async hype(token: string | null, cloudId: string): Promise<{ ok: true; hypesCount: number }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    await this.prisma.cloudHype.upsert({
      where: { cloudId_userId: { cloudId, userId: current.user.id } },
      create: { cloudId, userId: current.user.id },
      update: {},
    });

    const hypesCount = await this.prisma.cloudHype.count({ where: { cloudId } });
    return { ok: true, hypesCount };
  }

  async unhype(token: string | null, cloudId: string): Promise<{ ok: true; hypesCount: number }> {
    const current = await this.requireSession(token);

    await this.prisma.cloudHype.deleteMany({
      where: { cloudId, userId: current.user.id },
    });

    const hypesCount = await this.prisma.cloudHype.count({ where: { cloudId } });
    return { ok: true, hypesCount };
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

  async createMessage(token: string | null, cloudId: string, body: { type: string; content?: string; mediaUrl?: string; replyToMessageId?: string }): Promise<{ ok: true; message: any }> {
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

    const messageType = body.type === 'audio' ? 'audio' : 'text';

    const message = await this.prisma.cloudMessage.create({
      data: {
        cloudId,
        userId: current.user.id,
        type: messageType,
        content: body.content ?? null,
        mediaUrl: body.mediaUrl ?? null,
        replyToMessageId: body.replyToMessageId ?? null,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    console.log('[CloudService] Message created:', {
      cloudId,
      messageId: message.id,
      userId: current.user.id,
      sender: message.user.profile?.displayName,
      content: body.content,
    });

    return {
      ok: true,
      message: {
        id: message.id,
        type: message.type,
        content: message.content,
        mediaUrl: message.mediaUrl,
        replyToMessageId: message.replyToMessageId,
        createdAt: message.createdAt,
        sender: message.user.profile?.displayName || 'Usuário',
        initials: message.user.profile?.displayName?.substring(0, 2).toUpperCase() || 'US',
        color: '#8B5CF6',
        own: message.userId === current.user.id,
        isPinned: message.isPinned,
      },
    };
  }

  async editMessage(token: string | null, cloudId: string, messageId: string, content: string): Promise<{ ok: true; message: { id: string; content: string } }> {
    const current = await this.requireSession(token);

    const message = await this.prisma.cloudMessage.findFirst({
      where: { id: messageId, cloudId, deletedAt: null },
    });

    if (!message) throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    if (message.userId !== current.user.id)
      throw new UnauthorizedException({ message: 'Você só pode editar suas próprias mensagens.' });
    if (message.type !== 'text')
      throw new BadRequestException({ message: 'Apenas mensagens de texto podem ser editadas.' });

    const trimmed = (content ?? '').trim();
    if (!trimmed) throw new BadRequestException({ message: 'O conteúdo não pode ser vazio.' });

    const updated = await this.prisma.cloudMessage.update({
      where: { id: messageId },
      data: { content: trimmed },
    });

    return { ok: true, message: { id: updated.id, content: updated.content ?? '' } };
  }

  async deleteMessage(token: string | null, cloudId: string, messageId: string): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({ where: { id: cloudId, deletedAt: null } });
    if (!cloud) throw new NotFoundException({ message: 'Cloud não encontrada.' });

    const message = await this.prisma.cloudMessage.findFirst({
      where: { id: messageId, cloudId, deletedAt: null },
    });

    if (!message) throw new NotFoundException({ message: 'Mensagem não encontrada.' });

    // Only the message author or the cloud author can delete
    if (message.userId !== current.user.id && cloud.authorId !== current.user.id)
      throw new UnauthorizedException({ message: 'Sem permissão para apagar esta mensagem.' });

    await this.prisma.cloudMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return { ok: true };
  }

  async getMessages(token: string | null, cloudId: string): Promise<{ ok: true; messages: any[] }> {
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

    const messages = await this.prisma.cloudMessage.findMany({
      where: {
        cloudId,
        deletedAt: null,
      },
      include: {
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
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      ok: true,
      messages: messages.map((message) => ({
        id: message.id,
        type: message.type,
        content: message.content,
        mediaUrl: message.mediaUrl,
        replyToMessageId: message.replyToMessageId,
        createdAt: message.createdAt,
        sender: message.user.profile?.displayName || 'Usuário',
        initials: message.user.profile?.displayName?.substring(0, 2).toUpperCase() || 'US',
        color: '#8B5CF6',
        own: message.userId === current.user.id,
        isPinned: message.isPinned,
        replyTo: message.replyToMessage ? {
          id: message.replyToMessage.id,
          sender: message.replyToMessage.user.profile?.displayName || 'Usuário',
          content: message.replyToMessage.content,
        } : undefined,
        reactions: message.reactions.map((reaction) => ({
          id: reaction.id,
          emoji: reaction.emoji,
          userId: reaction.userId,
          user: {
            id: reaction.user.id,
            username: reaction.user.profile?.username || '',
            displayName: reaction.user.profile?.displayName || '',
            avatarUrl: reaction.user.profile?.avatarUrl,
          },
          createdAt: reaction.createdAt,
        })),
      })),
    };
  }

  async addReaction(token: string | null, cloudId: string, messageId: string, emoji: string): Promise<{ ok: true; reaction: CloudMessageReactionPayload }> {
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

  // ── Invite ────────────────────────────────────────────────────────────────

  async createInvite(token: string | null, cloudId: string): Promise<{ ok: true; invite: CloudInvitePayload }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    // Any member can generate an invite for a private cloud (not just the author)

    let inviteToken: string;

    try {
      // Reuse an existing non-expired invite if one exists
      const existing = await this.prisma.cloudInvite.findFirst({
        where: {
          cloudId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        inviteToken = existing.token;
      } else {
        const created = await this.prisma.cloudInvite.create({
          data: {
            cloudId,
            token: crypto.randomBytes(24).toString('hex'),
          },
        });
        inviteToken = created.token;
      }
    } catch {
      // CloudInvite table may not exist yet (migration pending) — use a deterministic token
      inviteToken = `cid_${cloudId.replace(/-/g, '')}`;
    }

    return {
      ok: true,
      invite: {
        token: inviteToken,
        cloudId: cloud.id,
        cloud: {
          id: cloud.id,
          title: cloud.title,
          duration: cloud.duration,
          createdAt: cloud.createdAt.toISOString(),
          authorId: cloud.authorId,
          visibility: cloud.visibility === CloudVisibility.private ? 'private' : 'public',
        },
      },
    };
  }

  async resolveInvite(token: string | null, inviteToken: string): Promise<{ ok: true; invite: CloudInvitePayload }> {
    // resolveInvite does NOT require a session — anyone with the link can see the cloud details.
    // The join step enforces authentication.

    // Support deterministic fallback token: cid_<cloudIdWithoutDashes>
    if (inviteToken.startsWith('cid_')) {
      const rawId = inviteToken.slice(4);
      // Reconstruct UUID: 8-4-4-4-12
      const uuid = `${rawId.slice(0,8)}-${rawId.slice(8,12)}-${rawId.slice(12,16)}-${rawId.slice(16,20)}-${rawId.slice(20)}`;
      const cloud = await this.prisma.cloud.findFirst({
        where: { id: uuid, deletedAt: null },
      });
      if (!cloud) {
        throw new NotFoundException({ message: 'Convite inválido ou expirado.' });
      }
      return {
        ok: true,
        invite: {
          token: inviteToken,
          cloudId: cloud.id,
          cloud: {
            id: cloud.id,
            title: cloud.title,
            duration: cloud.duration,
            createdAt: cloud.createdAt.toISOString(),
            authorId: cloud.authorId,
            visibility: cloud.visibility === CloudVisibility.private ? 'private' : 'public',
          },
        },
      };
    }

    try {
      const invite = await this.prisma.cloudInvite.findUnique({
        where: { token: inviteToken },
        include: { cloud: true },
      });

      if (!invite || invite.cloud.deletedAt !== null) {
        throw new NotFoundException({ message: 'Convite inválido ou expirado.' });
      }

      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new BadRequestException({ message: 'Este convite expirou.' });
      }

      return {
        ok: true,
        invite: {
          token: invite.token,
          cloudId: invite.cloudId,
          cloud: {
            id: invite.cloud.id,
            title: invite.cloud.title,
            duration: invite.cloud.duration,
            createdAt: invite.cloud.createdAt.toISOString(),
            authorId: invite.cloud.authorId,
            visibility: invite.cloud.visibility === CloudVisibility.private ? 'private' : 'public',
          },
        },
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      // Table doesn't exist yet — re-throw as not found
      throw new NotFoundException({ message: 'Convite inválido ou expirado.' });
    }
  }

  // ── Join / Leave ──────────────────────────────────────────────────────────

  async joinCloud(token: string | null, cloudId: string): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    // Upsert: rejoin if previously left, or create fresh membership
    const existing = await this.prisma.cloudMember.findFirst({
      where: { cloudId, userId: current.user.id },
    });

    if (existing) {
      if (existing.leftAt !== null) {
        await this.prisma.cloudMember.update({
          where: { id: existing.id },
          data: { leftAt: null, joinedAt: new Date() },
        });
      }
      // already an active member — no-op
    } else {
      await this.prisma.cloudMember.create({
        data: {
          cloudId,
          userId: current.user.id,
          role: 'member',
        },
      });
    }

    return { ok: true };
  }

  async leaveCloud(token: string | null, cloudId: string): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId === current.user.id) {
      throw new BadRequestException({ message: 'O criador não pode sair da própria cloud.' });
    }

    const member = await this.prisma.cloudMember.findFirst({
      where: { cloudId, userId: current.user.id, leftAt: null },
    });

    if (!member) {
      throw new NotFoundException({ message: 'Você não é membro desta cloud.' });
    }

    await this.prisma.cloudMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() },
    });

    return { ok: true };
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
