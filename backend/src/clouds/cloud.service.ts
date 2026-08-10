import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CloudMode, CloudStatus, CloudVisibility, Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { CloudPayload, CreateCloudInput } from './cloud.types';

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

  async getMessages(token: string | null, cloudId: string): Promise<{ ok: true; messages: any[] }> {
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
        own: message.userId === cloud.authorId,
        isPinned: message.isPinned,
        replyTo: message.replyToMessage && message.replyToMessage.user ? {
          id: message.replyToMessage.id,
          sender: message.replyToMessage.user.profile?.displayName || 'Usuário',
          content: message.replyToMessage.content,
        } : undefined,
      })),
    };
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
