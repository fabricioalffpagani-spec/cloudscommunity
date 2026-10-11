import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CloudMode,
  CloudStatus,
  CloudVisibility,
  Prisma,
} from '@prisma/client';
import * as crypto from 'crypto';
import { Resend } from 'resend';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { CloudTopicClassifierService } from './topic-classification/cloud-topic-classifier.service';
import {
  CloudInvitePayload,
  CloudMessagePayload,
  CloudMention,
  CloudMessageReactionPayload,
  CloudPayload,
  CreateCloudInput,
  CreateCloudMessageInput,
  ListCloudMessagesQuery,
} from './cloud.types';

const ALLOWED_DURATIONS = ['10min', '30min', '2h', '5h', '24h'] as const;
const RAPID_HYPES_THRESHOLD = 5;
const RAPID_HYPES_WINDOW_MS = 15 * 60 * 1000;

type CloudWithRelations = Prisma.CloudGetPayload<{
  include: {
    author: {
      include: {
        profile: true;
      };
    };
    originCloud: { select: { id: true; title: true } };
    members: {
      orderBy: { joinedAt: 'asc' };
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

function normalizeDuration(
  value: string,
): (typeof ALLOWED_DURATIONS)[number] | null {
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
  private readonly resend: Resend | null;
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly pushNotifications: PushNotificationsService,
    private readonly topicClassifier: CloudTopicClassifierService,
  ) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async findById(
    token: string | null,
    cloudId: string,
  ): Promise<{ ok: true; cloud: CloudPayload }> {
    const session = await this.authService.resolveSession(token);
    await this.expireDueClouds();

    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(cloudId)) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    // Block banned users from accessing the cloud
    if (session) {
      const ban = await this.prisma.cloudBan.findUnique({
        where: { cloudId_userId: { cloudId, userId: session.user.id } },
      });
      if (ban) {
        throw new NotFoundException({ message: 'Cloud não encontrada.' });
      }
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

    if (cloud.scheduledAt && cloud.scheduledAt.getTime() > Date.now()) {
      throw new NotFoundException({
        message: 'Esta Cloud ainda não estreou.',
      });
    }

    if (session) {
      await this.requireCloudVisibility(cloud, session.user.id);
    } else {
      this.requireGuestCloudObservation(cloud);
    }

    const currentUserHype = session
      ? await this.prisma.cloudHype.findUnique({
          where: { cloudId_userId: { cloudId, userId: session.user.id } },
          select: { cloudId: true },
        })
      : null;

    return {
      ok: true,
      cloud: {
        ...this.mapCloud(cloud),
        hyped: currentUserHype !== null,
      },
    };
  }

  async listFeed(
    token: string | null,
  ): Promise<{ ok: true; clouds: CloudPayload[] }> {
    const current = await this.requireSession(token);
    await this.expireDueClouds();

    const clouds = await this.prisma.cloud.findMany({
      where: {
        deletedAt: null,
        status: CloudStatus.active,
        OR: [
          { authorId: current.user.id },
          {
            visibility: CloudVisibility.private,
            members: { some: { userId: current.user.id } },
          },
          {
            visibility: CloudVisibility.public,
            OR: [
              { author: { profile: { is: { isPrivate: false } } } },
              {
                author: {
                  followers: { some: { followerId: current.user.id } },
                },
              },
            ],
          },
        ],
        // Clouds públicas aparecem para todos, independente do tipo de perfil do criador
        // Clouds privadas só aparecem para o criador ou para quem foi convidado
      },
      include: this.cloudInclude(),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // For You combines declared interests with the themes the member actually
    // engages with. A small discovery lane is added after ranking below.
    const now = Date.now();
    const [blocks, profiles, userHypes, memberships, messages, shares] =
      await Promise.all([
        this.prisma.userBlock.findMany({
          where: {
            OR: [
              { blockerId: current.user.id },
              { blockedId: current.user.id },
            ],
          },
          select: { blockerId: true, blockedId: true },
        }),
        this.prisma.profile.findMany({
          where: { userId: current.user.id },
          select: { interests: true },
        }),
        this.prisma.cloudHype.findMany({
          where: { userId: current.user.id },
          select: { cloudId: true, cloud: { select: { primaryTopic: true } } },
        }),
        this.prisma.cloudMember.findMany({
          where: { userId: current.user.id },
          select: { cloud: { select: { primaryTopic: true } } },
        }),
        this.prisma.cloudMessage.findMany({
          where: {
            userId: current.user.id,
            deletedAt: null,
            type: { not: 'system' },
          },
          select: { cloud: { select: { primaryTopic: true } } },
        }),
        this.prisma.cloudShare.findMany({
          where: { userId: current.user.id },
          select: { cloud: { select: { primaryTopic: true } } },
        }),
      ]);
    const blockedUserIds = new Set(
      blocks.map((block) =>
        block.blockerId === current.user.id ? block.blockedId : block.blockerId,
      ),
    );
    const topicAffinity = new Map<string, number>();
    const addTopicWeight = (topic: string | null, weight: number) => {
      if (topic)
        topicAffinity.set(topic, (topicAffinity.get(topic) ?? 0) + weight);
    };
    profiles[0]?.interests.forEach((topic) => addTopicWeight(topic, 4));
    userHypes.forEach(({ cloud }) => addTopicWeight(cloud.primaryTopic, 6));
    memberships.forEach(({ cloud }) => addTopicWeight(cloud.primaryTopic, 2));
    messages.forEach(({ cloud }) => addTopicWeight(cloud.primaryTopic, 5));
    shares.forEach(({ cloud }) => addTopicWeight(cloud.primaryTopic, 7));

    const scored = clouds
      .filter((cloud) => !blockedUserIds.has(cloud.authorId))
      .map((cloud) => {
        const ageHours = (now - cloud.createdAt.getTime()) / 3_600_000;
        const recency = Math.max(0, 1 - ageHours / 72);
        const popularity = cloud._count.hypes * 3 + recency * 10;
        const affinity = topicAffinity.get(cloud.primaryTopic ?? '') ?? 0;
        return {
          cloud,
          score: popularity + affinity * 4,
          popularity,
          affinity,
        };
      })
      .sort((a, b) => b.score - a.score);
    const discovery = [...scored]
      .filter((item) => item.affinity === 0)
      .sort((a, b) => b.popularity - a.popularity);
    const chosen = new Set<string>();
    const diversified = scored.flatMap((item, index) => {
      const candidate =
        index % 5 === 4
          ? (discovery.find((entry) => !chosen.has(entry.cloud.id)) ?? item)
          : item;
      if (chosen.has(candidate.cloud.id)) return [];
      chosen.add(candidate.cloud.id);
      return [candidate];
    });
    const userHypeIds = new Set(userHypes.map((hype) => hype.cloudId));

    return {
      ok: true,
      clouds: diversified.map(({ cloud }) => ({
        ...this.mapCloud(cloud),
        hyped: userHypeIds.has(cloud.id),
      })),
    };
  }

  private async readableArchiveWhere(
    userId: string,
  ): Promise<Prisma.CloudWhereInput> {
    const blocks = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return {
      deletedAt: null,
      status: CloudStatus.ended,
      visibility: CloudVisibility.public,
      authorId: {
        notIn: blocks.map((block) =>
          block.blockerId === userId ? block.blockedId : block.blockerId,
        ),
      },
      bans: { none: { userId } },
      OR: [
        { authorId: userId },
        { author: { profile: { is: { isPrivate: false } } } },
        { author: { followers: { some: { followerId: userId } } } },
      ],
    };
  }

  async listRead(
    token: string | null,
    scope: 'for-you' | 'following' = 'for-you',
  ) {
    const current = await this.requireSession(token);
    // Neither operation depends on the other. Running them together keeps the
    // archive feed responsive while still ensuring expired Clouds are included.
    const [, archiveWhere] = await Promise.all([
      this.expireDueClouds(),
      this.readableArchiveWhere(current.user.id),
    ]);
    let where = archiveWhere;

    if (scope === 'following') {
      const following = await this.prisma.follow.findMany({
        where: { followerId: current.user.id },
        select: { followingId: true },
      });
      const followingIds = following.map((entry) => entry.followingId);
      if (followingIds.length === 0) return { ok: true, clouds: [] };
      where = { AND: [archiveWhere, { authorId: { in: followingIds } }] };
    }

    const clouds = await this.prisma.cloud.findMany({
      where,
      // Read only displays author data, the first few participant avatars and
      // message/participant totals. Avoid loading every historic membership
      // record (which grows quickly for popular Clouds).
      select: {
        id: true,
        title: true,
        endedAt: true,
        author: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, username: true, avatarUrl: true },
            },
          },
        },
        members: {
          where: { leftAt: null },
          orderBy: { joinedAt: 'asc' },
          take: 8,
          select: {
            user: {
              select: {
                id: true,
                profile: { select: { displayName: true, avatarUrl: true } },
              },
            },
          },
        },
        _count: {
          select: {
            members: { where: { leftAt: null } },
            messages: { where: { deletedAt: null, type: { not: 'system' } } },
          },
        },
      },
      orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
    });
    return {
      ok: true,
      clouds: clouds.map((cloud) => ({
        id: cloud.id,
        title: cloud.title,
        endedAt: cloud.endedAt?.toISOString() ?? null,
        messagesCount: cloud._count.messages,
        participantsCount: cloud._count.members,
        author: {
          name: cloud.author.profile?.displayName ?? 'Usuário',
          id: cloud.author.id,
          username: cloud.author.profile?.username ?? '',
          avatarUrl: cloud.author.profile?.avatarUrl ?? null,
        },
        participantProfiles: cloud.members.flatMap((member) => {
          const profile = member.user.profile;
          return profile
            ? [
                {
                  id: member.user.id,
                  name: profile.displayName,
                  avatarUrl: profile.avatarUrl,
                },
              ]
            : [];
        }),
      })),
    };
  }

  async getPreview(token: string | null, cloudId: string) {
    const current = await this.requireSession(token);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cloudId,
      )
    ) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }
    await this.expireDueClouds();
    const cloud = await this.prisma.cloud.findFirst({
      where: {
        ...(await this.readableArchiveWhere(current.user.id)),
        id: cloudId,
      },
      include: this.cloudInclude(),
    });
    if (!cloud)
      throw new NotFoundException({
        message: 'Cloud encerrada não encontrada.',
      });
    const messages = await this.prisma.cloudMessage.findMany({
      where: { cloudId, deletedAt: null, type: { not: 'system' } },
      select: {
        id: true,
        type: true,
        content: true,
        mediaUrl: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, username: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 10,
    });
    return {
      ok: true,
      cloud: this.mapCloud(cloud),
      messages: messages.map(({ user, ...message }) => ({
        ...message,
        sender: { id: user.id, ...user.profile },
      })),
    };
  }

  async getArchivedMessages(
    token: string | null,
    cloudId: string,
    query: ListCloudMessagesQuery = {},
  ): Promise<{
    ok: true;
    cloud: CloudPayload;
    messages: CloudMessagePayload[];
  }> {
    const current = await this.requireSession(token);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cloudId,
      )
    ) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }
    await this.expireDueClouds();
    const cloud = await this.prisma.cloud.findFirst({
      where: {
        ...(await this.readableArchiveWhere(current.user.id)),
        id: cloudId,
      },
      include: this.cloudInclude(),
    });
    if (!cloud)
      throw new NotFoundException({
        message: 'Cloud encerrada não encontrada.',
      });

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
      orderBy: { createdAt: 'desc' },
      take: this.normalizeTake(query.take),
    });
    return {
      ok: true,
      cloud: this.mapCloud(cloud),
      messages: messages.reverse().map((message) => this.mapMessage(message)),
    };
  }

  private requireActiveCloud(cloud: {
    status: CloudStatus;
    startedAt: Date | null;
    createdAt: Date;
    duration: string;
  }) {
    const end =
      (cloud.startedAt ?? cloud.createdAt).getTime() +
      (DURATION_TO_SECONDS[cloud.duration] ?? 1800) * 1000;
    if (cloud.status !== CloudStatus.active || Date.now() >= end) {
      throw new BadRequestException({
        message: 'Esta cloud está encerrada e disponível apenas para leitura.',
      });
    }
  }

  async listFollowing(
    token: string | null,
  ): Promise<{ ok: true; clouds: CloudPayload[] }> {
    const current = await this.requireSession(token);
    await this.expireDueClouds();

    const following = await this.prisma.follow.findMany({
      where: { followerId: current.user.id },
      select: { followingId: true },
    });

    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: current.user.id }, { blockedId: current.user.id }],
      },
      select: { blockerId: true, blockedId: true },
    });
    const blockedUserIds = new Set(
      blocks.map((block) =>
        block.blockerId === current.user.id ? block.blockedId : block.blockerId,
      ),
    );
    const followingIds = following
      .map((entry) => entry.followingId)
      .filter((id) => !blockedUserIds.has(id));

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
        bans: { none: { userId: current.user.id } },
      },
      include: this.cloudInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      ok: true,
      clouds: clouds.map((cloud) => this.mapCloud(cloud)),
    };
  }

  async listMine(
    token: string | null,
  ): Promise<{ ok: true; clouds: CloudPayload[] }> {
    const current = await this.requireSession(token);
    await this.expireDueClouds();

    const clouds = await this.prisma.cloud.findMany({
      where: {
        deletedAt: null,
        authorId: current.user.id,
        status: { in: [CloudStatus.active, CloudStatus.ended] },
      },
      include: this.cloudInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return {
      ok: true,
      clouds: clouds.map((cloud) => this.mapCloud(cloud)),
    };
  }

  async create(
    token: string | null,
    input: CreateCloudInput,
    invitedUserIds?: string[],
  ): Promise<{
    ok: true;
    userId: string;
    cloud: CloudPayload;
    leftCloudIds: string[];
  }> {
    const current = await this.requireSession(token);
    const title = (input.title ?? '').trim();
    const description = (input.description ?? '').trim();
    const originCloudId = input.originCloudId?.trim() || null;
    const duration = input.duration ?? '';
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const visibility =
      input.visibility === 'private'
        ? CloudVisibility.private
        : CloudVisibility.public;

    if (!title) {
      throw new BadRequestException({
        message: 'Título obrigatório.',
        fieldErrors: { title: 'Informe o título da cloud.' },
      });
    }

    if (title.length > 30) {
      throw new BadRequestException({
        message: 'Título muito longo.',
        fieldErrors: { title: 'O título deve ter até 30 caracteres.' },
      });
    }

    if (description.length > 2000) {
      throw new BadRequestException({
        message: 'Descrição muito longa.',
        fieldErrors: {
          description: 'A descrição deve ter até 2000 caracteres.',
        },
      });
    }

    if (!duration) {
      throw new BadRequestException({
        message: 'Duração obrigatória.',
        fieldErrors: { duration: 'Selecione uma duração.' },
      });
    }

    if (
      input.scheduledAt &&
      (!scheduledAt ||
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt.getTime() <= Date.now() ||
        scheduledAt.getTime() > Date.now() + 15 * 24 * 60 * 60 * 1000)
    ) {
      throw new BadRequestException({
        message: 'Escolha uma data e horário futuros para abrir a cloud.',
      });
    }

    const normalizedDuration = normalizeDuration(duration);

    if (!normalizedDuration) {
      throw new BadRequestException({
        message: 'Duração inválida.',
        fieldErrors: { duration: 'Selecione 10min, 30min, 2h, 5h ou 24h.' },
      });
    }

    let origin: { id: string; authorId: string; title: string } | null = null;
    if (originCloudId) {
      origin = await this.prisma.cloud.findFirst({
        where: {
          id: originCloudId,
          status: CloudStatus.ended,
          deletedAt: null,
        },
        select: { id: true, authorId: true, title: true },
      });
      if (!origin)
        throw new BadRequestException({
          message: 'A conversa de origem não está disponível.',
        });
    }

    const classification = this.topicClassifier.classifyCloudTopic({
      title,
      description,
    });

    const creation = await this.prisma.$transaction(async (tx) => {
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
          scheduledAt,
          startedAt: scheduledAt ?? new Date(),
          originCloudId,
          primaryTopic: classification.primaryTopic,
          topicScores: classification.topics,
          topicKeywords: classification.matchedTerms,
          topicConfidence: classification.confidence,
          classificationVersion: classification.classificationVersion,
          classifiedAt: new Date(),
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

      const previousMemberships = scheduledAt
        ? []
        : await tx.cloudMember.findMany({
            where: {
              userId: current.user.id,
              cloudId: { not: cloud.id },
              leftAt: null,
              cloud: { status: CloudStatus.active, deletedAt: null },
            },
            select: { cloudId: true },
          });
      const leftCloudIds = previousMemberships.map(
        (membership) => membership.cloudId,
      );
      if (leftCloudIds.length > 0) {
        await tx.cloudMember.updateMany({
          where: {
            userId: current.user.id,
            cloudId: { in: leftCloudIds },
            leftAt: null,
          },
          data: { leftAt: new Date() },
        });
      }

      // Add invited users as members for private clouds
      if (
        visibility === CloudVisibility.private &&
        invitedUserIds &&
        invitedUserIds.length > 0
      ) {
        const validUserIds = [...new Set(invitedUserIds)]; // Remove duplicates
        for (const userId of validUserIds) {
          if (userId !== current.user.id) {
            // Don't add the author again
            await tx.cloudMember
              .create({
                data: {
                  cloudId: cloud.id,
                  userId,
                  role: 'member',
                },
              })
              .catch(() => {
                // Ignore errors if user doesn't exist or is already a member
              });
          }
        }
      }

      if (origin && origin.authorId !== current.user.id) {
        const creatorName =
          current.user.profile?.displayName ??
          current.user.profile?.username ??
          'Um usuário';
        await tx.notification.create({
          data: {
            userId: origin.authorId,
            type: 'cloud_continuation',
            entityType: 'cloud',
            entityId: cloud.id,
            title: `${creatorName} continuou uma conversa sua`,
            body: `Criou a Cloud “${title}” com base em “${origin.title}”.`,
            metadata: {
              actorUserId: current.user.id,
              continuationCloudId: cloud.id,
              continuationCloudTitle: title,
              originCloudId: origin.id,
              originCloudTitle: origin.title,
            },
          },
        });
      }

      return {
        cloud: await tx.cloud.findUniqueOrThrow({
          where: { id: cloud.id },
          include: this.cloudInclude(),
        }),
        leftCloudIds,
      };
    });
    const created = creation.cloud;

    if (origin && origin.authorId !== current.user.id) {
      const notification = await this.prisma.notification.findFirst({
        where: {
          userId: origin.authorId,
          type: 'cloud_continuation',
          entityType: 'cloud',
          entityId: created.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (notification) {
        await this.pushNotifications.send(origin.authorId, {
          title: notification.title,
          body: notification.body,
          url: `/cloud/${created.id}`,
          tag: notification.id,
        });
      }
    }

    const followers =
      visibility === CloudVisibility.public
        ? await this.prisma.follow.findMany({
            where: { followingId: current.user.id },
            select: { followerId: true },
          })
        : [];
    await Promise.all(
      followers.map(async ({ followerId }) => {
        const notification = await this.prisma.notification.create({
          data: {
            userId: followerId,
            type: 'cloud_comment',
            entityType: 'cloud',
            entityId: created.id,
            title: 'Nova Cloud de alguém que você segue',
            body: `${current.user.profile?.displayName || 'Alguém'} criou “${created.title}”.`,
            metadata: { actorUserId: current.user.id },
          },
        });
        await this.pushNotifications.send(followerId, {
          title: notification.title,
          body: notification.body,
          url: `/cloud/${created.id}`,
          tag: notification.id,
        });
      }),
    );

    return {
      ok: true,
      userId: current.user.id,
      cloud: this.mapCloud(created),
      leftCloudIds: creation.leftCloudIds,
    };
  }

  /** Internal maintenance entry point for a future batch reclassification job. */
  async reclassifyCloud(cloudId: string) {
    const cloud = await this.prisma.cloud.findUnique({
      where: { id: cloudId },
      select: { id: true, title: true, content: true },
    });
    if (!cloud)
      throw new NotFoundException({ message: 'Cloud não encontrada.' });

    const classification = this.topicClassifier.classifyCloudTopic({
      title: cloud.title,
      description: cloud.content,
    });
    await this.prisma.cloud.update({
      where: { id: cloud.id },
      data: {
        primaryTopic: classification.primaryTopic,
        topicScores: classification.topics,
        topicKeywords: classification.matchedTerms,
        topicConfidence: classification.confidence,
        classificationVersion: classification.classificationVersion,
        classifiedAt: new Date(),
      },
    });
    return classification;
  }

  async hype(
    token: string | null,
    cloudId: string,
  ): Promise<{ ok: true; hypesCount: number }> {
    const current = await this.requireSession(token);
    const cloud = await this.requireCloudAccess(cloudId, current.user.id);

    const existing = await this.prisma.cloudHype.findUnique({
      where: { cloudId_userId: { cloudId, userId: current.user.id } },
      select: { cloudId: true },
    });

    await this.prisma.cloudHype.upsert({
      where: { cloudId_userId: { cloudId, userId: current.user.id } },
      create: { cloudId, userId: current.user.id },
      update: {},
    });

    // A repeated tap is idempotent and must not create duplicate alerts. The
    // cloud's own host also never receives a notification about their own hype.
    if (!existing && cloud.authorId !== current.user.id) {
      const actorName =
        current.user.profile?.displayName ||
        current.user.profile?.username ||
        'Alguém';
      const notification = await this.prisma.notification.create({
        data: {
          userId: cloud.authorId,
          type: 'cloud_hype',
          entityType: 'cloud',
          entityId: cloudId,
          title: 'Novo hype na sua Cloud',
          body: `${actorName} deu hype em “${cloud.title}”.`,
          metadata: { actorUserId: current.user.id },
        },
      });
      await this.pushNotifications.send(cloud.authorId, {
        title: notification.title,
        body: notification.body,
        url: `/cloud/${cloudId}`,
        tag: notification.id,
      });
    }

    if (!existing) {
      await this.notifyRapidHypeGrowth(cloud);
    }

    const hypesCount = await this.prisma.cloudHype.count({
      where: { cloudId },
    });
    return { ok: true, hypesCount };
  }

  async recordShare(
    token: string | null,
    cloudId: string,
  ): Promise<{ ok: true }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(cloudId, current.user.id);
    await this.prisma.cloudShare.upsert({
      where: { cloudId_userId: { cloudId, userId: current.user.id } },
      create: { cloudId, userId: current.user.id },
      update: {},
    });
    return { ok: true };
  }

  private async notifyRapidHypeGrowth(cloud: {
    id: string;
    authorId: string;
    title: string;
    primaryTopic: string | null;
    visibility: CloudVisibility;
  }) {
    if (cloud.visibility !== CloudVisibility.public || !cloud.primaryTopic)
      return;
    const recentHypes = await this.prisma.cloudHype.findMany({
      where: {
        cloudId: cloud.id,
        createdAt: { gte: new Date(Date.now() - RAPID_HYPES_WINDOW_MS) },
      },
      select: { userId: true },
    });
    if (recentHypes.length < RAPID_HYPES_THRESHOLD) return;

    const interestedProfiles = await this.prisma.profile.findMany({
      where: {
        userId: { not: cloud.authorId },
        interests: { has: cloud.primaryTopic },
        interestsOnboardingRequired: false,
        user: { status: 'active', deletedAt: null },
      },
      select: { userId: true },
    });
    await Promise.all(
      interestedProfiles.map(async ({ userId }) => {
        const followsAuthor = await this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: userId,
              followingId: cloud.authorId,
            },
          },
          select: { followerId: true },
        });
        if (followsAuthor) return;
        try {
          const notification = await this.prisma.$transaction(async (tx) => {
            await tx.cloudTrendingDelivery.create({
              data: { userId, cloudId: cloud.id },
            });
            return tx.notification.create({
              data: {
                userId,
                type: 'cloud_trending',
                entityType: 'cloud',
                entityId: cloud.id,
                title: 'Esta Cloud está em alta',
                body: `“${cloud.title}” recebeu ${recentHypes.length} hypes nos últimos 15 minutos.`,
                metadata: {
                  topic: cloud.primaryTopic,
                  forYou: true,
                  recentHypes: recentHypes.length,
                },
              },
            });
          });
          await this.pushNotifications.send(userId, {
            title: notification.title,
            body: notification.body,
            url: `/cloud/${cloud.id}`,
            tag: notification.id,
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            return;
          }
          throw error;
        }
      }),
    );
  }

  async unhype(
    token: string | null,
    cloudId: string,
  ): Promise<{ ok: true; hypesCount: number }> {
    const current = await this.requireSession(token);

    await this.prisma.cloudHype.deleteMany({
      where: { cloudId, userId: current.user.id },
    });

    const hypesCount = await this.prisma.cloudHype.count({
      where: { cloudId },
    });
    return { ok: true, hypesCount };
  }

  async getHypes(
    token: string | null,
    cloudId: string,
  ): Promise<{
    ok: true;
    users: Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    }>;
  }> {
    const current = await this.requireSession(token);
    await this.requireCloudAccess(cloudId, current.user.id);

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

    const users: Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    }> = hypes.map((hype) => ({
      id: hype.user.id,
      username: hype.user.profile?.username || hype.user.email.split('@')[0],
      displayName:
        hype.user.profile?.displayName ||
        hype.user.profile?.username ||
        hype.user.email.split('@')[0],
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

  async removeMember(
    token: string | null,
    cloudId: string,
    userId: string,
  ): Promise<{ ok: true }> {
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
      throw new NotFoundException({
        message: 'Membro não encontrado na cloud.',
      });
    }

    // Removal only ends the current participation. Unlike a ban, the person
    // can enter a public Cloud again (or a private one they were invited to).
    await this.prisma.cloudMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() },
    });

    return { ok: true };
  }

  async banMember(
    token: string | null,
    cloudId: string,
    userId: string,
  ): Promise<{
    ok: true;
    systemMessage: CloudMessagePayload;
    deletedMessageIds: string[];
  }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
      include: { author: { include: { profile: true } } },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({
        message: 'Apenas o criador pode banir membros.',
      });
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
    const reportedMessageIds = [
      ...new Set(
        reportedMessages
          .map((r) => r.messageId)
          .filter((id): id is string => id !== null),
      ),
    ];

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

    // Allow reporting cloud from feed without membership, but require membership for reporting specific messages
    if (messageId) {
      await this.requireCloudMembership(cloudId, current.user.id);
    }

    if (reportedId === current.user.id) {
      throw new BadRequestException({
        message: 'Você não pode denunciar a si mesmo.',
      });
    }

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
      include: { author: { include: { profile: true } } },
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
        throw new NotFoundException({
          message: 'Mensagem não encontrada nesta cloud.',
        });
      }
    }

    const reportedMembership = await this.prisma.cloudMember.findFirst({
      where: { cloudId, userId: reportedId, leftAt: null },
      select: { userId: true },
    });

    // Allow reporting cloud author or cloud members even if reporter is not a member
    // This enables reporting from the feed before joining the cloud
    if (!reportedMembership && reportedId !== cloud.authorId) {
      throw new BadRequestException({
        message: 'O usuário informado não faz parte desta cloud.',
      });
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

    if (!messageId && this.resend) {
      const creatorName =
        cloud.author.profile?.displayName ??
        cloud.author.profile?.username ??
        'Usuário';
      const creatorUsername = cloud.author.profile?.username ?? '';
      const reporterName =
        current.user.profile?.displayName ??
        current.user.profile?.username ??
        'Usuário';
      const reporterUsername = current.user.profile?.username ?? '';
      const text = `DENÚNCIA DE CLOUD\n\nCloud: ${cloud.title}\nID da Cloud: ${cloud.id}\nCriador: ${creatorName} (@${creatorUsername})\nID do criador: ${cloud.authorId}\nDenunciante: ${reporterName} (@${reporterUsername})\nMotivos: ${reasons.join(', ')}`;
      const { error } = await this.resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL?.trim() ||
          'Clouds <no-reply@cloudscommunity.com.br>',
        to: ['cloudscomunidade@gmail.com'],
        subject: 'DENÚNCIA DE CLOUD',
        text,
        html: `<h1>DENÚNCIA DE CLOUD</h1><p><strong>Cloud:</strong> ${this.escapeReportHtml(cloud.title)}<br/><strong>ID da Cloud:</strong> ${cloud.id}</p><p><strong>Criador:</strong> ${this.escapeReportHtml(creatorName)} (@${this.escapeReportHtml(creatorUsername)})<br/><strong>ID do criador:</strong> ${cloud.authorId}</p><p><strong>Denunciante:</strong> ${this.escapeReportHtml(reporterName)} (@${this.escapeReportHtml(reporterUsername)})</p><p><strong>Motivos:</strong> ${reasons.map((reason) => this.escapeReportHtml(reason)).join(', ')}</p>`,
      });
      if (error)
        throw new BadRequestException({
          message:
            'Não foi possível encaminhar a denúncia à plataforma. Tente novamente.',
        });
    }

    const reportedUser = await this.prisma.user.findUnique({
      where: { id: reportedId },
      include: { profile: true },
    });

    let messageContent: string | null = messageContentOverride ?? null;
    if (!messageContent && messageId) {
      const msg = await this.prisma.cloudMessage.findUnique({
        where: { id: messageId },
      });
      messageContent = msg?.content ?? null;
    }

    const reportedName =
      reportedUser?.profile?.displayName ||
      reportedUser?.profile?.username ||
      'Usuário';
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
      const notificationBody = messageId
        ? `Mensagem de @${reportedUsername || reportedName} foi denunciada: ${reasons.join(', ')}. A plataforma irá analisar o caso e retornará uma resposta em breve.`
        : `Sua Cloud foi denunciada. A plataforma irá analisar o caso e retornará uma resposta em breve.`;

      await this.prisma.notification.create({
        data: {
          userId: cloud.authorId,
          type: 'system',
          entityType: 'cloud',
          entityId: cloudId,
          title: messageId ? 'Denúncia de mensagem' : 'Denúncia de Cloud',
          body: notificationBody,
        },
      });
    }

    return { ok: true, authorId: cloud.authorId, reportPayload };
  }

  async getReports(
    token: string | null,
    cloudId: string,
  ): Promise<{
    ok: true;
    reports: Array<{
      id: string;
      reportedId: string;
      reportedName: string;
      reportedUsername: string;
      reportedAvatarUrl: string | null;
      messageId: string | null;
      messageContent: string | null;
      reasons: string[];
      count: number;
      createdAt: string;
    }>;
  }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({
        message: 'Apenas o criador pode ver denúncias.',
      });
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

    const messageIds: string[] = [
      ...new Set(
        raw.flatMap((report) => (report.messageId ? [report.messageId] : [])),
      ),
    ];
    const messages = await this.prisma.cloudMessage.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, content: true },
    });
    const messageContentById = new Map(
      messages.map((message) => [message.id, message.content]),
    );

    const reports = Array.from(grouped.entries()).map(([reportedId, items]) => {
      const user = items[0].reported;
      const allReasons: string[] = [
        ...new Set(items.flatMap((i) => i.reasons)),
      ];
      const reportWithMessage =
        items.find((item) => item.messageId) ?? items[0];
      return {
        id: items[0].id,
        reportedId,
        reportedName:
          user.profile?.displayName || user.profile?.username || 'Usuário',
        reportedUsername: user.profile?.username || '',
        reportedAvatarUrl: user.profile?.avatarUrl ?? null,
        messageId: reportWithMessage.messageId,
        messageContent: reportWithMessage.messageId
          ? (messageContentById.get(reportWithMessage.messageId) ?? null)
          : null,
        reasons: allReasons,
        count: items.length,
        createdAt: items[0].createdAt.toISOString(),
      };
    });

    return { ok: true, reports };
  }

  async pinMessage(
    token: string | null,
    cloudId: string,
    messageId: string,
  ): Promise<{ ok: true }> {
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

    this.requireActiveCloud(cloud);

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
      throw new NotFoundException({
        message: 'Comentário não encontrado nesta cloud.',
      });
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

    if (!message.isPinned && message.userId !== current.user.id) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: message.userId,
          type: 'cloud_message_pinned',
          entityType: 'cloud_message',
          entityId: messageId,
          metadata: { cloudId, messageId, actorUserId: current.user.id },
          title: 'Sua mensagem foi fixada',
          body: `O anfitrião fixou sua mensagem em “${cloud.title}”.`,
        },
      });
      await this.pushNotifications.send(message.userId, {
        title: notification.title,
        body: notification.body,
        url: `/cloud/${cloudId}?message=${messageId}`,
        tag: notification.id,
      });
    }

    return { ok: true };
  }

  async unpinMessage(
    token: string | null,
    cloudId: string,
    messageId: string,
  ): Promise<{ ok: true }> {
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

    this.requireActiveCloud(cloud);

    if (cloud.authorId !== current.user.id) {
      throw new UnauthorizedException({
        message:
          'Você não tem permissão para desfixar comentários nesta cloud.',
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
      throw new NotFoundException({
        message: 'Comentário não encontrado nesta cloud.',
      });
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
    const activeCloud = await this.requireCloudAccess(cloudId, current.user.id);
    this.requireActiveCloud(activeCloud);
    await this.requireCloudMembership(cloudId, current.user.id);

    const messageType =
      body.type === 'audio' || body.type === 'image' || body.type === 'link'
        ? body.type
        : 'text';

    return {
      ok: true,
      message: await this.createCloudMessage(current.user.id, cloudId, {
        type: messageType,
        content: body.content,
        mentions: body.mentions,
        mediaUrl: body.mediaUrl,
        replyToMessageId: body.replyToMessageId,
        clientMessageId: body.clientMessageId,
      }),
    };
  }

  async sendAudioMessage(
    token: string | null,
    cloudId: string,
    body: {
      clientMessageId?: string;
      replyToMessageId?: string;
      isSticker?: boolean;
    },
    file?: {
      mimetype?: string;
      size: number;
      buffer: Buffer;
      originalname?: string | null;
    },
  ): Promise<{ ok: true; message: CloudMessagePayload }> {
    const current = await this.requireSession(token);
    const activeCloud = await this.requireCloudAccess(cloudId, current.user.id);
    this.requireActiveCloud(activeCloud);
    await this.requireCloudMembership(cloudId, current.user.id);

    if (!file) {
      throw new BadRequestException({ message: 'Envie um arquivo de áudio.' });
    }

    if (!file.mimetype?.startsWith('audio/')) {
      throw new BadRequestException({
        message: 'O arquivo enviado precisa ser um áudio.',
      });
    }

    if (file.size > 25 * 1024 * 1024) {
      throw new BadRequestException({
        message: 'O áudio excede o limite permitido.',
      });
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
    body: {
      clientMessageId?: string;
      replyToMessageId?: string;
      isSticker?: boolean;
    },
    file?: {
      mimetype?: string;
      size: number;
      buffer: Buffer;
      originalname?: string | null;
    },
  ): Promise<{ ok: true; message: CloudMessagePayload }> {
    const current = await this.requireSession(token);
    const activeCloud = await this.requireCloudAccess(cloudId, current.user.id);
    this.requireActiveCloud(activeCloud);
    await this.requireCloudMembership(cloudId, current.user.id);

    if (!file) {
      throw new BadRequestException({ message: 'Envie um arquivo de imagem.' });
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException({
        message: 'O arquivo enviado precisa ser uma imagem.',
      });
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException({
        message: 'A imagem excede o limite permitido.',
      });
    }

    return {
      ok: true,
      message: await this.createCloudMessage(current.user.id, cloudId, {
        type: 'image',
        mediaUrl: this.buildDataUrl(file.mimetype, file.buffer),
        isSticker: body.isSticker === true,
        clientMessageId: body.clientMessageId,
        replyToMessageId: body.replyToMessageId,
      }),
    };
  }

  async getSavedStickers(token: string | null) {
    const current = await this.requireSession(token);
    const stickers = await this.prisma.savedSticker.findMany({
      where: { userId: current.user.id },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: 250,
    });
    return { ok: true, stickers };
  }

  async saveSticker(token: string | null, mediaUrl?: string) {
    const current = await this.requireSession(token);
    if (!mediaUrl?.startsWith('data:image/')) {
      throw new BadRequestException({
        message: 'A figurinha precisa ser uma imagem válida.',
      });
    }
    if (mediaUrl.length > 14 * 1024 * 1024) {
      throw new BadRequestException({
        message: 'A figurinha excede o limite permitido.',
      });
    }
    // A saved sticker belongs only to the current user. The global catalogue
    // is reserved for the official Clouds starter pack.
    const contentHash = crypto.createHash('md5').update(mediaUrl).digest('hex');
    const existing = await this.prisma.savedSticker.findUnique({
      where: { userId_contentHash: { userId: current.user.id, contentHash } },
    });
    if (existing) return { ok: true, sticker: existing, alreadySaved: true };

    const sticker = await this.prisma.savedSticker.create({
      data: { userId: current.user.id, mediaUrl, contentHash },
    });
    return { ok: true, sticker, alreadySaved: false };
  }

  async markStickerUsed(token: string | null, mediaUrl?: string) {
    const current = await this.requireSession(token);
    if (!mediaUrl || mediaUrl.length > 14 * 1024 * 1024) {
      throw new BadRequestException({ message: 'Figurinha inválida.' });
    }
    const official = /^\/api\/stickers\/system\/[a-z]+\?v=2$/.test(mediaUrl);
    const contentHash = crypto.createHash('md5').update(mediaUrl).digest('hex');
    const where = {
      userId_contentHash: { userId: current.user.id, contentHash },
    };
    const existing = await this.prisma.savedSticker.findUnique({ where });
    if (!existing && !official) {
      throw new NotFoundException({ message: 'Figurinha não salva.' });
    }
    const sticker = await this.prisma.savedSticker.upsert({
      where,
      create: {
        userId: current.user.id,
        mediaUrl,
        contentHash,
        lastUsedAt: new Date(),
      },
      update: { lastUsedAt: new Date() },
    });
    return { ok: true, sticker };
  }

  async removeSavedSticker(token: string | null, id?: string) {
    const current = await this.requireSession(token);
    if (!id) throw new BadRequestException({ message: 'Figurinha inválida.' });
    await this.prisma.savedSticker.deleteMany({
      where: { id, userId: current.user.id },
    });
    return { ok: true };
  }

  async editMessage(
    token: string | null,
    cloudId: string,
    messageId: string,
    content: string,
  ): Promise<{ ok: true; message: { id: string; content: string } }> {
    const current = await this.requireSession(token);
    const activeCloud = await this.requireCloudAccess(cloudId, current.user.id);
    this.requireActiveCloud(activeCloud);
    await this.requireCloudMembership(cloudId, current.user.id);

    const message = await this.prisma.cloudMessage.findFirst({
      where: { id: messageId, cloudId, deletedAt: null },
    });

    if (!message)
      throw new NotFoundException({ message: 'Mensagem não encontrada.' });
    if (message.userId !== current.user.id)
      throw new UnauthorizedException({
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

    const updated = await this.prisma.cloudMessage.update({
      where: { id: messageId },
      data: { content: trimmed, mentions: [] },
    });

    return {
      ok: true,
      message: { id: updated.id, content: updated.content ?? '' },
    };
  }

  async deleteMessage(
    token: string | null,
    cloudId: string,
    messageId: string,
  ): Promise<{ ok: true }> {
    const current = await this.requireSession(token);
    const activeCloud = await this.requireCloudAccess(cloudId, current.user.id);
    this.requireActiveCloud(activeCloud);
    await this.requireCloudMembership(cloudId, current.user.id);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });
    if (!cloud)
      throw new NotFoundException({ message: 'Cloud não encontrada.' });

    const message = await this.prisma.cloudMessage.findFirst({
      where: { id: messageId, cloudId, deletedAt: null },
    });

    if (!message)
      throw new NotFoundException({ message: 'Mensagem não encontrada.' });

    // Only the message author or the cloud author can delete
    if (
      message.userId !== current.user.id &&
      cloud.authorId !== current.user.id
    )
      throw new UnauthorizedException({
        message: 'Sem permissão para apagar esta mensagem.',
      });

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
    const current = await this.authService.resolveSession(token);
    if (current) {
      await this.requireCloudAccess(cloudId, current.user.id);
      await this.requireCloudMembership(cloudId, current.user.id);
    } else {
      const cloud = await this.requireCloudAccess(cloudId);
      this.requireGuestCloudObservation(cloud);
    }

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
  ): Promise<{
    ok: true;
    reaction: CloudMessageReactionPayload;
    removed: boolean;
  }> {
    const current = await this.requireSession(token);
    const activeCloud = await this.requireCloudAccess(cloudId, current.user.id);
    this.requireActiveCloud(activeCloud);
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

  async getMessageReactions(
    token: string | null,
    cloudId: string,
    messageId: string,
  ): Promise<{ ok: true; reactions: CloudMessageReactionPayload[] }> {
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
      throw new UnauthorizedException({
        message: 'Você precisa ser membro desta cloud para realizar esta ação.',
      });
    }
  }

  private async requireCloudVisibility(
    cloud: {
      id: string;
      authorId: string;
      visibility: CloudVisibility;
      author?: { profile: { isPrivate: boolean } | null };
    },
    viewerId: string,
  ) {
    const ban = await this.prisma.cloudBan.findUnique({
      where: { cloudId_userId: { cloudId: cloud.id, userId: viewerId } },
      select: { cloudId: true },
    });

    if (ban) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: cloud.authorId },
          { blockerId: cloud.authorId, blockedId: viewerId },
        ],
      },
      select: { blockerId: true },
    });

    if (block) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    if (cloud.authorId === viewerId) {
      return;
    }

    // Private Clouds are visible only to the host and explicitly invited
    // members. A past leave does not revoke an invitation; bans do.
    if (cloud.visibility === CloudVisibility.private) {
      const membership = await this.prisma.cloudMember.findFirst({
        where: { cloudId: cloud.id, userId: viewerId },
        select: { id: true },
      });
      if (!membership) {
        throw new NotFoundException({ message: 'Cloud não encontrada.' });
      }
      return;
    }

    if (!cloud.author?.profile?.isPrivate) {
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
    const cloud = await this.requireCloudAccess(cloudId, userId);
    this.requireActiveCloud(cloud);
    const replyToMessageId = input.replyToMessageId?.trim() || null;
    const type =
      input.type === 'audio' || input.type === 'image' || input.type === 'link'
        ? input.type
        : 'text';
    const mentions =
      type === 'text'
        ? await this.validateMentions(
            cloud,
            userId,
            input.content ?? '',
            input.mentions,
          )
        : [];

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
        mentions,
        mediaUrl: input.mediaUrl ?? null,
        isSticker: input.isSticker === true,
        replyToMessageId,
      },
      include: this.messageInclude(),
    });

    const recipients = await this.prisma.cloudMember.findMany({
      where: { cloudId, leftAt: null, userId: { not: userId } },
      select: { userId: true },
    });
    const mentionedIds = new Set(mentions.map((mention) => mention.userId));
    const recipientIds = new Set(
      recipients.map((recipient) => recipient.userId),
    );
    for (const mentionedId of mentionedIds) {
      if (mentionedId !== userId) recipientIds.add(mentionedId);
    }
    const senderName =
      created.user.profile?.displayName ||
      created.user.profile?.username ||
      'Alguém';
    const preview = (created.content || 'enviou uma mensagem')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    await Promise.all(
      Array.from(recipientIds, async (recipientId) => {
        const mentioned = mentionedIds.has(recipientId);
        const notification = await this.prisma.notification.create({
          data: {
            userId: recipientId,
            type: mentioned ? 'cloud_mention' : 'cloud_comment',
            entityType: 'cloud_message',
            entityId: created.id,
            metadata: { cloudId, messageId: created.id },
            title: mentioned
              ? `${senderName} mencionou você na Cloud ${cloud.title}`
              : `Nova mensagem em ${cloud.title}`,
            body: mentioned ? preview : `${senderName}: ${preview}`,
          },
        });
        await this.pushNotifications.send(recipientId, {
          title: notification.title,
          body: notification.body,
          url: `/cloud/${cloudId}?message=${created.id}`,
          tag: notification.id,
          kind: 'cloud_message',
          cloudId,
        });
      }),
    );

    return this.mapMessage(created, input.clientMessageId?.trim() || null);
  }

  private async validateMentions(
    cloud: { id: string; authorId: string },
    authorId: string,
    content: string,
    input?: CloudMention[],
  ): Promise<CloudMention[]> {
    if (input === undefined) return [];
    if (!Array.isArray(input) || input.length > 20)
      throw new BadRequestException({ message: 'Menções inválidas.' });
    const mentions = input.map((item) => ({
      userId: item?.userId,
      username: item?.username,
      start: item?.start,
      end: item?.end,
    }));
    mentions.sort((a, b) => a.start - b.start);
    let lastEnd = 0;
    for (const mention of mentions) {
      if (
        typeof mention.userId !== 'string' ||
        typeof mention.username !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(mention.userId) ||
        !Number.isInteger(mention.start) ||
        !Number.isInteger(mention.end) ||
        mention.start < lastEnd ||
        mention.end <= mention.start ||
        mention.end > content.length ||
        content.slice(mention.start, mention.end) !== `@${mention.username}`
      ) {
        throw new BadRequestException({ message: 'Menções inválidas.' });
      }
      lastEnd = mention.end;
    }
    if (!mentions.length) return [];
    const ids = Array.from(new Set(mentions.map((mention) => mention.userId)));
    const [profiles, members, follows] = await Promise.all([
      this.prisma.profile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, username: true },
      }),
      this.prisma.cloudMember.findMany({
        where: { cloudId: cloud.id, userId: { in: ids }, leftAt: null },
        select: { userId: true },
      }),
      this.prisma.follow.findMany({
        where: { followerId: authorId, followingId: { in: ids } },
        select: { followingId: true },
      }),
    ]);
    const names = new Map(
      profiles.map((profile) => [profile.userId, profile.username]),
    );
    const allowed = new Set([
      cloud.authorId,
      ...members.map((member) => member.userId),
      ...follows.map((follow) => follow.followingId),
    ]);
    if (
      mentions.some(
        (mention) =>
          names.get(mention.userId) !== mention.username ||
          !allowed.has(mention.userId),
      )
    ) {
      throw new BadRequestException({
        message: 'Mencione membros da Cloud ou pessoas que você segue.',
      });
    }
    return mentions;
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

  private mapMessage(
    message: CloudMessageWithRelations,
    clientMessageId: string | null = null,
  ): CloudMessagePayload {
    const profile = message.user.profile;

    if (!profile) {
      throw new Error('Message sender profile is required.');
    }

    return {
      id: message.id,
      cloudId: message.cloudId,
      senderId: message.userId,
      type: message.type,
      content: message.content,
      mentions: Array.isArray(message.mentions)
        ? message.mentions.filter(
            (item): item is CloudMention =>
              typeof item === 'object' &&
              item !== null &&
              'userId' in item &&
              'start' in item &&
              'end' in item &&
              'username' in item,
          )
        : [],
      mediaUrl: message.mediaUrl,
      isSticker: message.isSticker,
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
            sender:
              message.replyToMessage.user.profile?.displayName || 'Usuário',
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

  async createInvite(
    token: string | null,
    cloudId: string,
  ): Promise<{ ok: true; invite: CloudInvitePayload }> {
    const current = await this.requireSession(token);
    const cloud = await this.requireCloudAccess(cloudId, current.user.id);

    // A private invite link can only be generated by its host or an invited
    // member. This prevents authenticated outsiders from minting links.
    if (cloud.visibility === CloudVisibility.private) {
      await this.requireCloudMembership(cloudId, current.user.id);
    }

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
          visibility:
            cloud.visibility === CloudVisibility.private ? 'private' : 'public',
        },
      },
    };
  }

  async resolveInvite(
    token: string | null,
    inviteToken: string,
  ): Promise<{ ok: true; invite: CloudInvitePayload }> {
    // resolveInvite does NOT require a session — anyone with the link can see the cloud details.
    // The join step enforces authentication.

    // Support deterministic fallback token: cid_<cloudIdWithoutDashes>
    if (inviteToken.startsWith('cid_')) {
      const rawId = inviteToken.slice(4);
      // Reconstruct UUID: 8-4-4-4-12
      const uuid = `${rawId.slice(0, 8)}-${rawId.slice(8, 12)}-${rawId.slice(12, 16)}-${rawId.slice(16, 20)}-${rawId.slice(20)}`;
      const cloud = await this.prisma.cloud.findFirst({
        where: { id: uuid, deletedAt: null },
      });
      if (!cloud) {
        throw new NotFoundException({
          message: 'Convite inválido ou expirado.',
        });
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
            visibility:
              cloud.visibility === CloudVisibility.private
                ? 'private'
                : 'public',
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
        throw new NotFoundException({
          message: 'Convite inválido ou expirado.',
        });
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
            visibility:
              invite.cloud.visibility === CloudVisibility.private
                ? 'private'
                : 'public',
          },
        },
      };
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException
      ) {
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
    senderId: string,
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

  async createJoinNotification(
    cloudId: string,
    userId: string,
  ): Promise<CloudMessagePayload> {
    const userWithProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    const displayName =
      userWithProfile?.profile?.displayName ||
      userWithProfile?.profile?.username ||
      'Usuário';
    return this.createSystemMessage(
      cloudId,
      `${displayName} entrou na cloud`,
      userId,
    );
  }

  private escapeReportHtml(value: string): string {
    return value.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[character] ?? character,
    );
  }

  async createLeaveNotification(
    cloudId: string,
    userId: string,
  ): Promise<CloudMessagePayload> {
    const userWithProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    const displayName =
      userWithProfile?.profile?.displayName ||
      userWithProfile?.profile?.username ||
      'Usuário';
    return this.createSystemMessage(
      cloudId,
      `${displayName} saiu da cloud`,
      userId,
    );
  }

  /** Public live clouds may be watched from an external invitation without a session. */
  private requireGuestCloudObservation(cloud: {
    visibility: CloudVisibility;
    status: CloudStatus;
  }) {
    if (
      cloud.visibility !== CloudVisibility.public ||
      cloud.status !== CloudStatus.active
    ) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }
  }

  async joinCloud(
    token: string | null,
    cloudId: string,
  ): Promise<{
    ok: true;
    userId: string;
    entered: boolean;
    waiting: boolean;
    leftCloudIds: string[];
  }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    // A scheduled Cloud accepts its waiting list before it opens, but its
    // chat remains unavailable until the scheduled instant.
    const waiting = Boolean(
      cloud.scheduledAt && cloud.scheduledAt.getTime() > Date.now(),
    );
    if (!waiting) this.requireActiveCloud(cloud);

    // Block banned users
    const ban = await this.prisma.cloudBan.findUnique({
      where: { cloudId_userId: { cloudId, userId: current.user.id } },
    });
    if (ban) {
      throw new UnauthorizedException({
        message: 'Você foi banido desta cloud.',
      });
    }

    // Private Clouds require a membership granted at creation time. Public
    // Clouds continue to create membership on entry.
    const existing = await this.prisma.cloudMember.findFirst({
      where: { cloudId, userId: current.user.id },
    });

    if (
      cloud.visibility === CloudVisibility.private &&
      cloud.authorId !== current.user.id &&
      !existing
    ) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    let membershipChanged = false;
    if (existing) {
      if (existing.leftAt !== null) {
        await this.prisma.cloudMember.update({
          where: { id: existing.id },
          data: { leftAt: null, joinedAt: new Date() },
        });
        membershipChanged = true;
      }
    } else {
      await this.prisma.cloudMember.create({
        data: {
          cloudId,
          userId: current.user.id,
          role: 'member',
        },
      });
      membershipChanged = true;
    }

    // A person may take part in only one live Cloud at a time. Joining a new
    // live Cloud ends every other active participation before the new entry is
    // announced. Scheduled Cloud waiting lists are not participation, so they
    // do not interrupt the current conversation.
    const previousMemberships = waiting
      ? []
      : await this.prisma.cloudMember.findMany({
          where: {
            userId: current.user.id,
            cloudId: { not: cloudId },
            leftAt: null,
            cloud: { status: CloudStatus.active, deletedAt: null },
          },
          select: { cloudId: true },
        });
    const leftCloudIds = previousMemberships.map(
      (membership) => membership.cloudId,
    );
    if (leftCloudIds.length > 0) {
      await this.prisma.cloudMember.updateMany({
        where: {
          userId: current.user.id,
          cloudId: { in: leftCloudIds },
          leftAt: null,
        },
        data: { leftAt: new Date() },
      });
    }

    // The author and invited people are pre-created as members. Their first
    // actual visit must still receive an entry message, while reloads must not.
    const hasEntryNotification = await this.prisma.cloudMessage.findFirst({
      where: {
        cloudId,
        userId: current.user.id,
        type: 'system',
        content: { endsWith: ' entrou na cloud' },
        deletedAt: null,
      },
      select: { id: true },
    });

    const entered = membershipChanged || !hasEntryNotification;
    if (entered && !waiting && cloud.authorId !== current.user.id) {
      const memberName =
        current.user.profile?.displayName ||
        current.user.profile?.username ||
        'Uma pessoa';
      const notification = await this.prisma.notification.create({
        data: {
          userId: cloud.authorId,
          type: 'cloud_member_joined',
          entityType: 'cloud',
          entityId: cloudId,
          title: 'Novo participante na sua Cloud',
          body: `${memberName} entrou em “${cloud.title}”.`,
          metadata: { actorUserId: current.user.id },
        },
      });
      await this.pushNotifications.send(cloud.authorId, {
        title: notification.title,
        body: notification.body,
        url: `/cloud/${cloudId}`,
        tag: notification.id,
      });
    }

    return {
      ok: true,
      userId: current.user.id,
      entered,
      waiting,
      leftCloudIds,
    };
  }

  async leaveCloud(
    token: string | null,
    cloudId: string,
  ): Promise<{ ok: true; userId: string; left: boolean }> {
    const current = await this.requireSession(token);

    const cloud = await this.prisma.cloud.findFirst({
      where: { id: cloudId, deletedAt: null },
    });

    if (!cloud) {
      throw new NotFoundException({ message: 'Cloud não encontrada.' });
    }

    const member = await this.prisma.cloudMember.findFirst({
      where: { cloudId, userId: current.user.id, leftAt: null },
    });

    if (!member) {
      // A minimized Cloud can outlive a tab refresh or a previous successful
      // leave request. Treat a second exit as complete instead of blocking the
      // user with an error; no duplicate system message will be emitted.
      return { ok: true, userId: current.user.id, left: false };
    }

    await this.prisma.cloudMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() },
    });

    return { ok: true, userId: current.user.id, left: true };
  }

  /** Records that the author left the conversation without relinquishing
   * ownership. Keeping the same membership transition makes a later entry
   * from the feed observable just like any other member re-entry. */
  async exitCloudConversation(
    token: string | null,
    cloudId: string,
  ): Promise<{ ok: true; userId: string; left: boolean }> {
    return this.leaveCloud(token, cloudId);
  }

  private cloudInclude() {
    return {
      author: {
        include: {
          profile: true,
        },
      },
      originCloud: { select: { id: true, title: true } },
      members: {
        orderBy: { joinedAt: 'asc' as const },
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
    const durationCutoffs = ALLOWED_DURATIONS.map((duration) => ({
      duration,
      cutoff: new Date(
        now.getTime() - (DURATION_TO_SECONDS[duration] ?? 5 * 60) * 1000,
      ),
    }));
    const activeClouds = await this.prisma.cloud.findMany({
      where: {
        status: CloudStatus.active,
        deletedAt: null,
        OR: durationCutoffs.map(({ duration, cutoff }) => ({
          duration,
          OR: [
            { startedAt: { lte: cutoff } },
            { startedAt: null, createdAt: { lte: cutoff } },
          ],
        })),
      },
      select: { id: true, duration: true, startedAt: true, createdAt: true },
    });

    await Promise.all(
      activeClouds.map(async (cloud) => {
        const durationSeconds = DURATION_TO_SECONDS[cloud.duration] ?? 5 * 60;
        const endTime = new Date(
          (cloud.startedAt ?? cloud.createdAt).getTime() +
            durationSeconds * 1000,
        );
        if (now >= endTime) {
          await this.prisma.cloud.update({
            where: { id: cloud.id },
            data: {
              status: CloudStatus.ended,
              endedAt: endTime,
            },
          });
        }
      }),
    );
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
      visibility:
        cloud.visibility === CloudVisibility.private ? 'private' : 'public',
      createdAt: cloud.createdAt.toISOString(),
      updatedAt: cloud.updatedAt.toISOString(),
      endedAt: cloud.endedAt?.toISOString() ?? null,
      scheduledAt: cloud.scheduledAt?.toISOString() ?? null,
      authorId: cloud.authorId,
      author: {
        id: cloud.author.id,
        name: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        location: profile.location,
      },
      hypesCount: cloud._count.hypes,
      membersCount: cloud._count.members,
      participantsCount: cloud._count.members,
      originCloud: cloud.originCloud
        ? { id: cloud.originCloud.id, title: cloud.originCloud.title }
        : null,
      members: cloud.members
        .filter((member) => member.leftAt === null)
        .filter((member) => member.user.profile)
        .map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          user: {
            id: member.user.id,
            profile: {
              displayName: member.user.profile!.displayName,
              username: member.user.profile!.username,
              avatarUrl: member.user.profile!.avatarUrl,
            },
          },
        })),
      participantProfiles: cloud.members
        .filter((member) => member.leftAt === null)
        .filter((member) => member.user.profile)
        .map((member) => ({
          id: member.user.id,
          name: member.user.profile!.displayName,
          username: member.user.profile!.username,
          avatarUrl: member.user.profile!.avatarUrl,
        })),
      href: `/cloud/${cloud.id}`,
      status: cloud.status,
    };
  }

  async getActiveMembers(cloudId: string) {
    const members = await this.prisma.cloudMember.findMany({
      where: { cloudId, leftAt: null },
      include: { user: { include: { profile: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return members
      .filter((member) => member.user.profile)
      .map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        user: {
          id: member.user.id,
          profile: {
            displayName: member.user.profile!.displayName,
            username: member.user.profile!.username,
            avatarUrl: member.user.profile!.avatarUrl,
          },
        },
      }));
  }
}
