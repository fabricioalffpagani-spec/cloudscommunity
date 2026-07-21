import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { CloudMode, CloudStatus, CloudVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
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

  async listFeed(token: string | null): Promise<{ ok: true; clouds: CloudPayload[] }> {
    const current = await this.requireSession(token);
    void current;
    await this.expireDueClouds();

    const clouds = await this.prisma.cloud.findMany({
      where: {
        deletedAt: null,
        status: CloudStatus.active,
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        _count: {
          select: {
            hypes: true,
            members: true,
          },
        },
      },
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
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        _count: {
          select: {
            hypes: true,
            members: true,
          },
        },
      },
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
        include: {
          author: {
            include: {
              profile: true,
            },
          },
          _count: {
            select: {
              hypes: true,
              members: true,
            },
          },
        },
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

  private async expireDueClouds() {
    const clouds = await this.prisma.cloud.findMany({
      where: {
        deletedAt: null,
        status: CloudStatus.active,
      },
      select: {
        id: true,
        createdAt: true,
        duration: true,
      },
    });

    const now = Date.now();

    const dueCloudIds = clouds
      .filter((cloud) => {
        const durationSeconds = DURATION_TO_SECONDS[cloud.duration] ?? DURATION_TO_SECONDS['5 min'];
        const expiresAt = cloud.createdAt.getTime() + durationSeconds * 1000;
        return expiresAt <= now;
      })
      .map((cloud) => cloud.id);

    if (dueCloudIds.length === 0) {
      return;
    }

    await this.prisma.cloud.updateMany({
      where: {
        id: { in: dueCloudIds },
        status: CloudStatus.active,
      },
      data: {
        status: CloudStatus.ended,
        endedAt: new Date(),
      },
    });
  }

  private async requireSession(token: string | null) {
    const session = await this.authService.resolveSession(token);

    if (!session) {
      throw new UnauthorizedException({
        message: 'Sessão não encontrada.',
      });
    }

    return session as { user: SessionUser };
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
