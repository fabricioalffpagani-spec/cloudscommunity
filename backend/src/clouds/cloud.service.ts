import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CloudMode, CloudStatus, CloudVisibility, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import {
  CloudInvitePayload,
  CloudMessagePayload,
  CloudMessageReactionPayload,
  CloudPayload,
  CreateCloudInput,
  CreateCloudMessageInput,
  ListCloudMessagesQuery,
} from './cloud.types';

const ALLOWED_DURATIONS = ['10min', '30min', '2h', '5h', '24h'] as const;

type CloudWithRelations = Prisma.CloudGetPayload<{
  include: {
    author: {
      include: {
        profile: true;
      };
    };
    members: {
      where: { leftAt: null };
      include: {
        user: {
          include: {
            profile: true;
          };
        };
      };
    };
    _count: {
      select: {
        hypes: true;
        members: { where: { leftAt: null } };
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
  '10min': 10 * 60,
  '30min': 30 * 60,
  '2h': 2 * 60 * 60,
  '5h': 5 * 60 * 60,
  '24h': 24 * 60 * 60,
};

function normalizeDuration(value: string): (typeof ALLOWED_DURATIONS)[number] | null {
  const compactValue = value.trim().toLowerCase().replace(/[\s.]/g, '');
  const aliases: Record<string, (typeof ALLOWED_DURATIONS)[number]> = {
    '10min': '10min',
    '10m': '10min',
    '10minutos': '10min',
    '30min': '30min',
    '30m': '30min',
    '30minutos': '30min',
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
    const session = await this.requireSession(token);

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(cloudId)) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    // Block banned users from accessing the cloud
    const ban = await this.prisma.cloudBan.findUnique({
      where: { cloudId_userId: { cloudId, userId: session.user.id } },
    });
    if (ban) {
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

    await this.requireCloudVisibility(cloud, session.user.id);

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
        // Clouds públicas aparecem para todos, independente do tipo de perfil do criador
        // Clouds privadas só aparecem para o criador ou para quem foi convidado
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
        visibility: CloudVisibility.public,
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

  async create(token: string | null, input: CreateCloudInput, invitedUserIds?: string[]): Promise<{ ok: true; cloud: CloudPayload }> {
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
        fieldErrors: { duration: 'Selecione 10min, 30min, 2h, 5h ou 24h.' },
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

      // Add invited users as members for private clouds
      if (visibility === CloudVisibility.private && invitedUserIds && invitedUserIds.length > 0) {
        const validUserIds = [...new Set(invitedUserIds)]; // Remove duplicates
        for (const userId of validUserIds) {
          if (userId !== current.user.id) { // Don't add the author again
            await tx.cloudMember.create({
              data: {
                cloudId: cloud.id,
                userId,
                role: 'member',
              },
            }).catch(() => {
              // Ignore errors if user doesn't exist or is already a member
            });
          }
        }
      }

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

  async getHypes(token: string | null, cloudId: string): Promise<{ ok: true; users: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }> }> {
    await this.requireSession(token);

    const hypes = await this.prisma.cloudHype.findMany({
      where: { cloudId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    const users: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }> = hypes.map((hype) => ({
      id: hype.user.id,
      username: hype.user.profile?.username || hype.user.email.split('@')[0],
      displayName: hype.user.profile?.displayName || hype.user.profile?.username || hype.user.email.split('@')[0],
      avatarUrl: hype.user.profile?.avatarUrl ?? null,
    }));

    return { ok: true, users };
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

  async banMember(
    token: string | null,
    cloudId: string,
    userId: string,
  ): Promise<{ ok: true; systemMessage: CloudMessagePayload; deletedMessageIds: string[] }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({ message: 'Apenas o criador pode banir membros.' });
    }

    if (userId === current.user.id) {
      throw new BadRequestException({ message: 'Você não pode se banir.' });
    }

    // Upsert ban (idempotent)
    await this.prisma.cloudBan.upsert({
      where: { cloudId_userId: { cloudId, userId } },
      create: { cloudId, userId, bannedById: current.user.id },
      update: { bannedById: current.user.id, createdAt: new Date() },
    });

    // Also kick from active members
    await this.prisma.cloudMember.updateMany({
      where: { cloudId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    // Soft-delete reported messages from this user in this cloud
    const reportedMessages = await this.prisma.cloudReport.findMany({
      where: { cloudId, reportedId: userId, messageId: { not: null } },
      select: { messageId: true },
    });
    const reportedMessageIds = [...new Set(
      reportedMessages.map((r) => r.messageId).filter((id): id is string => id !== null)
    )];

    if (reportedMessageIds.length > 0) {
      await this.prisma.cloudMessage.updateMany({
        where: { id: { in: reportedMessageIds }, cloudId },
        data: { deletedAt: new Date() },
      });
    }

    const bannedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    const displayName =
      bannedUser?.profile?.displayName ||
      bannedUser?.profile?.username ||
      'Usuário';

    const systemMessage = await this.createSystemMessage(
      cloudId,
      `@${bannedUser?.profile?.username ?? displayName} foi banido da Cloud`,
      current.user.id,
    );

    return { ok: true, systemMessage, deletedMessageIds: reportedMessageIds };
  }

  async reportUser(
    token: string | null,
    cloudId: string,
    reportedId: string,
    messageId: string | null,
    messageContentOverride: string | null,
    reasons: string[],
  ): Promise<{
    ok: true;
    authorId: string;
    reportPayload: {
      cloudId: string;
      reportedId: string;
      reportedName: string;
      reportedUsername: string;
      reportedAvatarUrl: string | null;
      messageId: string | null;
      messageContent: string | null;
      reasons: string[];
    };
  }> {
    const current = await this.requireSession(token);

    await this.requireCloudMembership(cloudId, current.user.id);

    if (reportedId === current.user.id) {
      throw new BadRequestException({ message: 'Você não pode denunciar a si mesmo.' });
    }

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (messageId) {
      const message = await this.prisma.cloudMessage.findFirst({
        where: { id: messageId, cloudId, deletedAt: null },
        select: { id: true, userId: true },
      });

      if (!message) {
        throw new NotFoundException({ message: 'Mensagem não encontrada nesta cloud.' });
      }
    }

    const reportedMembership = await this.prisma.cloudMember.findFirst({
      where: { cloudId, userId: reportedId, leftAt: null },
      select: { userId: true },
    });

    if (!reportedMembership && reportedId !== cloud.authorId) {
      throw new BadRequestException({ message: 'O usuário informado não faz parte desta cloud.' });
    }

    await this.prisma.cloudReport.create({
      data: {
        cloudId,
        reportedId,
        reporterId: current.user.id,
        messageId: messageId ?? null,
        reasons,
      },
    });

    const reportedUser = await this.prisma.user.findUnique({
      where: { id: reportedId },
      include: { profile: true },
    });

    let messageContent: string | null = messageContentOverride ?? null;
    if (!messageContent && messageId) {
      const msg = await this.prisma.cloudMessage.findUnique({ where: { id: messageId } });
      messageContent = msg?.content ?? null;
    }

    const reportedName = reportedUser?.profile?.displayName || reportedUser?.profile?.username || 'Usuário';
    const reportedUsername = reportedUser?.profile?.username || '';
    const reportedAvatarUrl = reportedUser?.profile?.avatarUrl ?? null;

    const reportPayload = {
      cloudId,
      reportedId,
      reportedName,
      reportedUsername,
      reportedAvatarUrl,
      messageId,
      messageContent,
      reasons,
    };

    // Persist notification for the cloud author
    if (cloud.authorId !== current.user.id) {
      await this.prisma.notification.create({
        data: {
          userId: cloud.authorId,
          type: 'system',
          entityType: 'cloud',
          entityId: cloudId,
          title: `Denúncia em "${cloud.title}"`,
          body: `Um membro denunciou @${reportedUsername || reportedName}: ${reasons.join(', ')}`,
        },
      });
    }

    return { ok: true, authorId: cloud.authorId, reportPayload };
  }

  async getReports(
    token: string | null,
    cloudId: string,
  ): Promise<{ ok: true; reports: Array<{ id: string; reportedId: string; reportedName: string; reportedUsername: string; reportedAvatarUrl: string | null; messageId: string | null; messageContent: string | null; reasons: string[]; count: number; createdAt: string }> }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({ message: 'Apenas o criador pode ver denúncias.' });
    }

    const raw = await this.prisma.cloudReport.findMany({
      where: { cloudId },
      include: {
        reported: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by reportedId
    const grouped = new Map<string, typeof raw>();
    for (const r of raw) {
      const arr = grouped.get(r.reportedId) ?? [];
      arr.push(r);
      grouped.set(r.reportedId, arr);
    }

    const messageIds: string[] = [...new Set(raw.flatMap((report) => report.messageId ? [report.messageId as string] : []))];
    const messages = await this.prisma.cloudMessage.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, content: true },
    });
    const messageContentById = new Map(messages.map((message) => [message.id, message.content]));

    const reports = Array.from(grouped.entries()).map(([reportedId, items]) => {
      const user = items[0].reported;
      const allReasons: string[] = [...new Set(items.flatMap((i) => i.reasons as string[]))];
      const reportWithMessage = items.find((item) => item.messageId) ?? items[0];
      return {
        id: items[0].id,
        reportedId,
        reportedName: user.profile?.displayName || user.profile?.username || 'Usuário',
        reportedUsername: user.profile?.username || '',
        reportedAvatarUrl: user.profile?.avatarUrl ?? null,
        messageId: reportWithMessage.messageId,
        messageContent: reportWithMessage.messageId ? (messageContentById.get(reportWithMessage.messageId) ?? null) : null,
        reasons: allReasons,
        count: items.length,
        createdAt: items[0].createdAt.toISOString(),
      };
    });

    return { ok: true, reports };
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
    body: CreateCloudMessageInput,
  ): Promise<{ ok: true; message: CloudMessagePayload }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.requireCloudMembership(cloudId, current.user.id);

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
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.requireCloudMembership(cloudId, current.user.id);

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
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.requireCloudMembership(cloudId, current.user.id);

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

  async editMessage(token: string | null, cloudId: string, messageId: string, content: string): Promise<{ ok: true; message: { id: string; content: string } }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.requireCloudMembership(cloudId, current.user.id);

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
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.requireCloudMembership(cloudId, current.user.id);

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

  async getMessages(
    token: string | null,
    cloudId: string,
    query: ListCloudMessagesQuery = {},
  ): Promise<{ ok: true; messages: CloudMessagePayload[] }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.requireCloudMembership(cloudId, current.user.id);

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
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.requireCloudMembership(cloudId, current.user.id);

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
    const current = await this.requireSession(token);
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.requireCloudMembership(cloudId, current.user.id);

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

  async requireCloudAccess(cloudId: string, viewerId?: string) {
    const cloud = await this.prisma.cloud.findFirst({
      where: {
        id: cloudId,
        deletedAt: null,
      },
      include: {
        author: {
          include: { profile: true },
        },
      },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (viewerId) {
      await this.requireCloudVisibility(cloud, viewerId);
    }

    return cloud;
  }

  private async requireCloudMembership(cloudId: string, userId: string) {
    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
      select: { authorId: true },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId === userId) {
      return;
    }

    const member = await this.prisma.cloudMember.findFirst({
      where: { cloudId, userId, leftAt: null },
      select: { id: true },
    });

    if (!member) {
      throw new UnauthorizedException({ message: 'Você precisa ser membro desta cloud para realizar esta ação.' });
    }
  }

  private async requireCloudVisibility(
    cloud: { id: string; authorId: string; author?: { profile: { isPrivate: boolean } | null } },
    viewerId: string,
  ) {
    if (cloud.authorId === viewerId || !cloud.author?.profile?.isPrivate) {
      return;
    }

    const member = await this.prisma.cloudMember.findFirst({
      where: { cloudId: cloud.id, userId: viewerId, leftAt: null },
      select: { id: true },
    });

    if (member) {
      return;
    }

    const followsAuthor = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: cloud.authorId,
        },
      },
      select: { followerId: true },
    });

    if (!followsAuthor) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }
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
    await this.requireCloudAccess(cloudId, userId);
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

  // ── Invite ────────────────────────────────────────────────────────────────

  async createInvite(token: string | null, cloudId: string): Promise<{ ok: true; invite: CloudInvitePayload }> {
    await this.requireSession(token);

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

  private async createSystemMessage(
    cloudId: string,
    content: string,
    senderId: string
  ): Promise<CloudMessagePayload> {
    const created = await this.prisma.cloudMessage.create({
      data: {
        cloudId,
        userId: senderId,
        type: 'system',
        content,
      },
      include: this.messageInclude(),
    });
    return this.mapMessage(created, null);
  }

  async createJoinNotification(cloudId: string, userId: string): Promise<CloudMessagePayload> {
    const userWithProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    const displayName = userWithProfile?.profile?.displayName || userWithProfile?.profile?.username || 'Usuário';
    return this.createSystemMessage(cloudId, `${displayName} entrou na cloud`, userId);
  }

  async joinCloud(token: string | null, cloudId: string): Promise<{ ok: true }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    // Block banned users
    const ban = await this.prisma.cloudBan.findUnique({
      where: { cloudId_userId: { cloudId, userId: current.user.id } },
    });
    if (ban) {
      throw new UnauthorizedException({ message: 'Você foi banido desta cloud.' });
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
        where: { leftAt: null as Date | null },
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
          members: { where: { leftAt: null as Date | null } },
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
      // CloudMember is membership/history data, not real-time presence.
      membersCount: 0,
      href: `/cloud/${cloud.id}`,
      status: cloud.status === CloudStatus.active ? 'active' : 'inactive',
    };
  }
}
