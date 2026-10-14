import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CloudStatus, Prisma, UserStatus } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';
import {
  MeetResponse,
  PublicUserProfilePayload,
  ReceivedHypesResponse,
  UserProfileResponse,
  UsersSearchResponse,
} from './users.types';

type SessionUser =
  Awaited<ReturnType<AuthService['resolveSession']>> extends infer T
    ? T extends { user: infer U }
      ? U
      : never
    : never;

type UserWithProfile = Prisma.UserGetPayload<{
  include: {
    profile: true;
  };
}>;

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 10;
const MAX_SEARCH_HISTORY_PER_KIND = 50;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function searchScore(query: string, user: UserWithProfile) {
  const profile = user.profile;
  if (!profile) {
    return -1;
  }

  if (!query) {
    return 0;
  }

  const normalizedName = normalizeText(profile.displayName);
  const normalizedUsername = normalizeText(profile.username);
  const normalizedBio = normalizeText(profile.bio ?? '');

  if (normalizedUsername === query) return 1000;
  if (normalizedName === query) return 980;
  if (normalizedUsername.startsWith(query)) return 900;
  if (normalizedName.startsWith(query)) return 850;
  if (normalizedUsername.includes(query)) return 750;
  if (normalizedName.includes(query)) return 700;
  if (normalizedBio.includes(query)) return 200;
  return 0;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly pushNotifications: PushNotificationsService,
    private readonly directMessagesGateway: DirectMessagesGateway,
  ) {}

  async search(
    token: string | null,
    queryInput: string,
    limitInput?: string | null,
  ): Promise<UsersSearchResponse> {
    const current = await this.resolveCurrentSession(token);
    const query = normalizeText(queryInput ?? '');
    const parsedLimit = Number.parseInt(limitInput ?? '', 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_SEARCH_LIMIT)
      : DEFAULT_SEARCH_LIMIT;

    const candidates = await this.prisma.user.findMany({
      where: {
        status: UserStatus.active,
        deletedAt: null,
      },
      include: {
        profile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    const ranked = candidates
      .filter((user) => Boolean(user.profile))
      .map((user) => ({
        user,
        score: searchScore(query, user),
      }))
      .filter(({ score }) => (query ? score > 0 : true))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.user.createdAt.getTime() - left.user.createdAt.getTime();
      })
      .slice(0, limit);

    const users = await Promise.all(
      ranked.map(({ user }) =>
        this.mapPublicProfile(user, current?.user.id ?? null),
      ),
    );

    return {
      ok: true,
      users,
    };
  }

  async getProfile(
    token: string | null,
    identifierInput: string,
  ): Promise<UserProfileResponse> {
    const current = await this.resolveCurrentSession(token);
    const user = await this.findUserByIdentifier(identifierInput);

    if (!user) {
      throw new NotFoundException({
        message: 'Perfil não encontrado.',
      });
    }

    return {
      ok: true,
      user: await this.mapPublicProfile(user, current?.user.id ?? null),
    };
  }

  async follow(
    token: string | null,
    identifierInput: string,
  ): Promise<UserProfileResponse> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);

    if (target.id === current.user.id) {
      throw new BadRequestException({
        message: 'Você não pode seguir seu próprio perfil.',
      });
    }

    await this.ensureUsersCanInteract(current.user.id, target.id);

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: current.user.id,
          followingId: target.id,
        },
      },
    });

    if (!existingFollow) {
      if (target.profile?.isPrivate) {
        await this.createFollowRequest(
          current.user.id,
          target.id,
          current.user.profile?.displayName ?? 'Alguém',
        );
      } else {
        await this.createFollow(
          current.user.id,
          target.id,
          current.user.profile?.displayName ?? 'Alguém',
        );
        this.emitProfileStatsUpdated(current.user.id, target.id);
      }
    }

    return {
      ok: true,
      user: await this.mapPublicProfile(target, current.user.id),
    };
  }

  async unfollow(
    token: string | null,
    identifierInput: string,
  ): Promise<UserProfileResponse> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);

    if (target.id === current.user.id) {
      throw new BadRequestException({
        message: 'Você não pode deixar de seguir seu próprio perfil.',
      });
    }

    const deleted = await this.prisma.follow.deleteMany({
      where: {
        followerId: current.user.id,
        followingId: target.id,
      },
    });

    await this.cancelFollowRequest(current.user.id, target.id);

    // Remove follow notification when unfollowing
    await this.prisma.notification.deleteMany({
      where: {
        userId: target.id,
        type: 'follow',
        entityId: current.user.id,
      },
    });

    if (deleted.count > 0) {
      this.emitProfileStatsUpdated(current.user.id, target.id);
    }

    return {
      ok: true,
      user: await this.mapPublicProfile(target, current.user.id),
    };
  }

  async getSearchHistory(token: string | null) {
    const current = await this.requireSession(token);
    const searches = await this.prisma.searchHistory.findMany({
      where: { userId: current.user.id },
      orderBy: { updatedAt: 'desc' },
      take: MAX_SEARCH_HISTORY_PER_KIND * 3,
      select: {
        query: true,
        kind: true,
        targetId: true,
        subtitle: true,
        avatarUrl: true,
      },
    });
    return { ok: true, searches };
  }

  async saveSearchHistory(
    token: string | null,
    input: {
      query?: string;
      kind?: string;
      targetId?: string;
      subtitle?: string;
      avatarUrl?: string | null;
    },
  ) {
    const current = await this.requireSession(token);
    const query = (input.query ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!query)
      throw new BadRequestException({ message: 'Informe uma busca.' });
    const kind =
      input.kind === 'profile' || input.kind === 'cloud' ? input.kind : 'query';
    const targetId = (input.targetId ?? query).trim().slice(0, 255);

    await this.prisma.searchHistory.upsert({
      where: {
        userId_kind_targetId: { userId: current.user.id, kind, targetId },
      },
      create: {
        userId: current.user.id,
        query,
        kind,
        targetId,
        subtitle: input.subtitle?.slice(0, 255) ?? null,
        avatarUrl: input.avatarUrl ?? null,
      },
      update: {
        query,
        subtitle: input.subtitle?.slice(0, 255) ?? null,
        avatarUrl: input.avatarUrl ?? null,
        updatedAt: new Date(),
      },
    });
    const staleSearches = await this.prisma.searchHistory.findMany({
      where: { userId: current.user.id, kind },
      orderBy: { updatedAt: 'desc' },
      skip: MAX_SEARCH_HISTORY_PER_KIND,
      select: { id: true },
    });
    if (staleSearches.length) {
      await this.prisma.searchHistory.deleteMany({
        where: { id: { in: staleSearches.map(({ id }) => id) } },
      });
    }
    return this.getSearchHistory(token);
  }

  async clearSearchHistory(token: string | null) {
    const current = await this.requireSession(token);
    await this.prisma.searchHistory.deleteMany({
      where: { userId: current.user.id },
    });
    return { ok: true, searches: [] };
  }

  async deleteSearchHistory(
    token: string | null,
    kind: string,
    targetId: string,
  ) {
    const current = await this.requireSession(token);
    await this.prisma.searchHistory.deleteMany({
      where: { userId: current.user.id, kind, targetId },
    });
    return this.getSearchHistory(token);
  }

  async block(
    token: string | null,
    identifierInput: string,
  ): Promise<{ ok: true }> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);
    if (target.id === current.user.id)
      throw new BadRequestException({
        message: 'Você não pode bloquear a si mesmo.',
      });
    const [, removedFollows] = await this.prisma.$transaction([
      this.prisma.userBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: current.user.id,
            blockedId: target.id,
          },
        },
        update: {},
        create: { blockerId: current.user.id, blockedId: target.id },
      }),
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: current.user.id, followingId: target.id },
            { followerId: target.id, followingId: current.user.id },
          ],
        },
      }),
      this.prisma.followRequest.deleteMany({
        where: {
          OR: [
            { requesterId: current.user.id, targetId: target.id },
            { requesterId: target.id, targetId: current.user.id },
          ],
        },
      }),
    ]);
    if (removedFollows.count > 0) {
      this.emitProfileStatsUpdated(current.user.id, target.id);
    }
    return { ok: true };
  }

  async unblock(
    token: string | null,
    identifierInput: string,
  ): Promise<{ ok: true }> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);
    await this.prisma.userBlock.deleteMany({
      where: { blockerId: current.user.id, blockedId: target.id },
    });
    return { ok: true };
  }

  async removeFollower(
    token: string | null,
    identifierInput: string,
    followerId: string,
  ): Promise<{ ok: true }> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);

    if (target.id !== current.user.id) {
      throw new UnauthorizedException({
        message: 'Você só pode remover seguidores do seu próprio perfil.',
      });
    }

    const deleted = await this.prisma.follow.deleteMany({
      where: { followerId, followingId: current.user.id },
    });
    await this.cancelFollowRequest(followerId, current.user.id);

    // Remove follow notification when removing follower
    await this.prisma.notification.deleteMany({
      where: {
        userId: current.user.id,
        type: 'follow',
        entityId: followerId,
      },
    });

    if (deleted.count > 0) {
      this.emitProfileStatsUpdated(followerId, current.user.id);
    }

    return { ok: true };
  }

  async acceptFollowRequest(
    token: string | null,
    requesterIdentifier: string,
  ): Promise<{ ok: true }> {
    const current = await this.requireSession(token);
    const requester = await this.requireTargetUser(requesterIdentifier);

    if (requester.id === current.user.id) {
      throw new BadRequestException({
        message: 'Você não pode aceitar uma solicitação da sua própria conta.',
      });
    }

    const request = await this.prisma.followRequest.findUnique({
      where: {
        requesterId_targetId: {
          requesterId: requester.id,
          targetId: current.user.id,
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        message: 'Solicitação para seguir não encontrada.',
      });
    }

    await this.createFollow(
      requester.id,
      current.user.id,
      requester.profile?.displayName ?? 'Alguém',
    );
    this.emitProfileStatsUpdated(requester.id, current.user.id);
    await this.cancelFollowRequest(requester.id, current.user.id);
    const acceptedNotification = await this.prisma.notification.create({
      data: {
        userId: requester.id,
        type: 'system',
        entityType: 'user',
        entityId: current.user.id,
        title: 'Solicitação aceita',
        body: `${current.user.profile?.displayName ?? 'A pessoa'} aceitou sua solicitação para seguir.`,
      },
    });
    await this.pushNotifications.send(requester.id, {
      title: acceptedNotification.title,
      body: acceptedNotification.body,
      url: '/notifications',
      tag: acceptedNotification.id,
    });

    return { ok: true };
  }

  async declineFollowRequest(
    token: string | null,
    requesterIdentifier: string,
  ): Promise<{ ok: true }> {
    const current = await this.requireSession(token);
    const requester = await this.requireTargetUser(requesterIdentifier);

    if (requester.id === current.user.id) {
      throw new BadRequestException({
        message: 'Você não pode recusar uma solicitação da sua própria conta.',
      });
    }

    const request = await this.prisma.followRequest.findUnique({
      where: {
        requesterId_targetId: {
          requesterId: requester.id,
          targetId: current.user.id,
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        message: 'Solicitação para seguir não encontrada.',
      });
    }

    await this.cancelFollowRequest(requester.id, current.user.id);

    return { ok: true };
  }

  async getFollowers(
    token: string | null,
    identifierInput: string,
  ): Promise<UsersSearchResponse> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);

    const followers = await this.prisma.follow.findMany({
      where: { followingId: target.id },
      include: {
        follower: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const users: PublicUserProfilePayload[] = [];

    for (const entry of followers) {
      const user = entry.follower;

      if (
        !user.profile ||
        user.status !== UserStatus.active ||
        user.deletedAt !== null
      ) {
        continue;
      }

      users.push(await this.mapPublicProfile(user, current.user.id));
    }

    return {
      ok: true,
      users,
    };
  }

  async getUserFollowing(
    token: string | null,
    identifierInput: string,
  ): Promise<UsersSearchResponse> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);

    const following = await this.prisma.follow.findMany({
      where: { followerId: target.id },
      include: {
        following: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const users: PublicUserProfilePayload[] = [];

    for (const entry of following) {
      const user = entry.following;

      if (
        !user.profile ||
        user.status !== UserStatus.active ||
        user.deletedAt !== null
      ) {
        continue;
      }

      users.push(await this.mapPublicProfile(user, current.user.id));
    }

    return {
      ok: true,
      users,
    };
  }

  async getReceivedHypes(
    token: string | null,
    identifierInput: string,
  ): Promise<ReceivedHypesResponse> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);
    if (!target.profile?.showHypesCount && target.id !== current.user.id) {
      throw new ForbiddenException({
        message: 'Este perfil ocultou os hypes recebidos.',
      });
    }
    const hypes = await this.prisma.cloudHype.findMany({
      where: { cloud: { authorId: target.id, deletedAt: null } },
      include: { user: { include: { profile: true } } },
    });

    const grouped = new Map<string, ReceivedHypesResponse['users'][number]>();
    for (const hype of hypes) {
      const profile = hype.user.profile;
      if (
        !profile ||
        hype.user.status !== UserStatus.active ||
        hype.user.deletedAt !== null
      )
        continue;
      const existing = grouped.get(hype.userId);
      if (existing) {
        existing.hypesCount += 1;
      } else {
        grouped.set(hype.userId, {
          id: hype.userId,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          hypesCount: 1,
        });
      }
    }

    return {
      ok: true,
      users: [...grouped.values()].sort(
        (a, b) =>
          b.hypesCount - a.hypesCount ||
          a.displayName.localeCompare(b.displayName, 'pt-BR'),
      ),
    };
  }

  async following(
    token: string | null,
    sort?: string,
    limit?: string,
  ): Promise<UsersSearchResponse> {
    void sort;
    void limit; // Compatibility parameters; the existing query has fixed ordering.
    const current = await this.requireSession(token);

    const following = await this.prisma.follow.findMany({
      where: { followerId: current.user.id },
      include: {
        following: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const users: PublicUserProfilePayload[] = [];

    for (const entry of following) {
      const user = entry.following;

      if (
        !user.profile ||
        user.status !== UserStatus.active ||
        user.deletedAt !== null
      ) {
        continue;
      }

      users.push(await this.mapPublicProfile(user, current.user.id));
    }

    return {
      ok: true,
      users,
    };
  }

  async meet(token: string | null): Promise<MeetResponse> {
    const current = await this.requireSession(token);
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [allHypes, recentHypes, followers] = await Promise.all([
      this.prisma.cloudHype.findMany({
        where: { cloud: { deletedAt: null } },
        select: { cloud: { select: { authorId: true } } },
      }),
      this.prisma.cloudHype.findMany({
        where: { createdAt: { gte: last24Hours }, cloud: { deletedAt: null } },
        select: { cloud: { select: { authorId: true } } },
      }),
      this.prisma.follow.findMany({
        where: { followingId: current.user.id },
        select: { followerId: true },
      }),
    ]);

    const countAuthors = (entries: Array<{ cloud: { authorId: string } }>) => {
      const counts = new Map<string, number>();
      for (const entry of entries) {
        if (entry.cloud.authorId !== current.user.id) {
          counts.set(
            entry.cloud.authorId,
            (counts.get(entry.cloud.authorId) ?? 0) + 1,
          );
        }
      }
      return counts;
    };

    const popularRecentCounts = countAuthors(recentHypes);
    const popularAllTimeCounts = countAuthors(allHypes);
    const followerIds = followers.map((follower) => follower.followerId);
    const nearbyCounts = new Map<string, number>();

    if (followerIds.length > 0) {
      const followedByFollowers = await this.prisma.follow.findMany({
        where: {
          followerId: { in: followerIds },
          followingId: { not: current.user.id },
        },
        select: { followingId: true },
      });

      for (const entry of followedByFollowers) {
        nearbyCounts.set(
          entry.followingId,
          (nearbyCounts.get(entry.followingId) ?? 0) + 1,
        );
      }
    }

    const rankProfiles = async (counts: Map<string, number>) => {
      const rankedIds = [...counts.entries()]
        .sort(([, left], [, right]) => right - left)
        .slice(0, 10)
        .map(([id]) => id);

      if (rankedIds.length === 0) return [];

      const candidates = await this.prisma.user.findMany({
        where: {
          id: { in: rankedIds },
          status: UserStatus.active,
          deletedAt: null,
        },
        include: { profile: true },
      });
      const byId = new Map(
        candidates
          .filter((candidate) => candidate.profile)
          .map((candidate) => [candidate.id, candidate]),
      );

      return Promise.all(
        rankedIds.flatMap(async (id) => {
          const candidate = byId.get(id);
          if (!candidate) return [];
          return [
            {
              ...(await this.mapPublicProfile(candidate, current.user.id)),
              score: counts.get(id) ?? 0,
            },
          ];
        }),
      );
    };

    const [recentRanked, allTimeRanked, nearbyRanked, newestUsers] =
      await Promise.all([
        rankProfiles(popularRecentCounts),
        rankProfiles(popularAllTimeCounts),
        rankProfiles(nearbyCounts),
        this.prisma.user.findMany({
          where: {
            id: { not: current.user.id },
            status: UserStatus.active,
            deletedAt: null,
          },
          include: { profile: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

    return {
      ok: true,
      popularRecent: recentRanked
        .flat()
        .map(({ score, ...user }) => ({ ...user, hypes: score })),
      popularAllTime: allTimeRanked
        .flat()
        .map(({ score, ...user }) => ({ ...user, hypes: score })),
      nearby: nearbyRanked.flat().map(({ score, ...user }) => ({
        ...user,
        mutualFollowersCount: score,
      })),
      newUsers: await Promise.all(
        newestUsers
          .filter((candidate) => candidate.profile)
          .map((candidate) =>
            this.mapPublicProfile(candidate, current.user.id),
          ),
      ),
    };
  }

  async getNearbyUsers(token: string | null): Promise<UsersSearchResponse> {
    const current = await this.requireSession(token);

    // Get users that the current user's followers also follow
    const followers = await this.prisma.follow.findMany({
      where: { followingId: current.user.id },
      select: { followerId: true },
    });

    if (followers.length === 0) {
      return { ok: true, users: [] };
    }

    const followerIds = followers.map((f) => f.followerId);

    // Get follows of those followers
    const followsOfFollowers = await this.prisma.follow.findMany({
      where: {
        followerId: { in: followerIds },
        followingId: { not: current.user.id },
      },
      include: {
        following: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Count how many followers also follow each user
    const userFollowCount = new Map<string, number>();
    for (const follow of followsOfFollowers) {
      const userId = follow.followingId;
      userFollowCount.set(userId, (userFollowCount.get(userId) || 0) + 1);
    }

    // Get unique users and sort by follower overlap count
    const uniqueUsers = new Map<string, (typeof followsOfFollowers)[0]>();
    for (const follow of followsOfFollowers) {
      if (!uniqueUsers.has(follow.followingId)) {
        uniqueUsers.set(follow.followingId, follow);
      }
    }

    const sortedUsers = Array.from(uniqueUsers.values())
      .sort((a, b) => {
        const countA = userFollowCount.get(a.followingId) || 0;
        const countB = userFollowCount.get(b.followingId) || 0;
        return countB - countA;
      })
      .slice(0, 20);

    const users: PublicUserProfilePayload[] = [];

    for (const entry of sortedUsers) {
      const user = entry.following;

      if (
        !user.profile ||
        user.status !== UserStatus.active ||
        user.deletedAt !== null
      ) {
        continue;
      }

      users.push(await this.mapPublicProfile(user, current.user.id));
    }

    return {
      ok: true,
      users,
    };
  }

  private async resolveCurrentSession(token: string | null) {
    if (!token) {
      return null;
    }

    const session = await this.authService.resolveSession(token);
    return session ? { ...session, user: session.user } : null;
  }

  private async requireSession(token: string | null) {
    const current = await this.resolveCurrentSession(token);

    if (!current) {
      throw new UnauthorizedException({
        message: 'Sessão não encontrada.',
      });
    }

    return current as { user: SessionUser };
  }

  private async requireTargetUser(identifierInput: string) {
    const user = await this.findUserByIdentifier(identifierInput);

    if (!user || !user.profile) {
      throw new NotFoundException({
        message: 'Perfil não encontrado.',
      });
    }

    return user;
  }

  private async findUserByIdentifier(identifierInput: string) {
    const identifier = identifierInput.trim();

    if (!identifier) {
      return null;
    }

    const normalizedUsername = identifier.startsWith('@')
      ? identifier.slice(1)
      : identifier;

    if (isUuid(identifier)) {
      const byId = await this.prisma.user.findUnique({
        where: { id: identifier },
        include: { profile: true },
      });

      if (byId?.profile) {
        return byId;
      }
    }

    const byUsername = await this.prisma.user.findFirst({
      where: {
        profile: {
          username: normalizedUsername,
        },
      },
      include: { profile: true },
    });

    if (byUsername?.profile) {
      return byUsername;
    }

    const normalizedIdentifier = normalizeText(identifier);
    const candidates = await this.prisma.user.findMany({
      where: {
        status: UserStatus.active,
        deletedAt: null,
      },
      include: { profile: true },
      take: 100,
    });

    const byDisplayName = candidates.find((candidate) => {
      const profile = candidate.profile;
      return profile
        ? normalizeText(profile.displayName) === normalizedIdentifier
        : false;
    });

    return byDisplayName?.profile ? byDisplayName : null;
  }

  private async createFollow(
    followerId: string,
    followingId: string,
    followerName: string,
  ) {
    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
      update: {},
      create: {
        followerId,
        followingId,
      },
    });

    await this.prisma.followRequest.deleteMany({
      where: {
        requesterId: followerId,
        targetId: followingId,
      },
    });

    await this.prisma.notification.deleteMany({
      where: {
        userId: followingId,
        type: 'follow_request',
        entityId: followerId,
      },
    });

    const followNotification = await this.prisma.notification.create({
      data: {
        userId: followingId,
        type: 'follow',
        entityType: 'follow',
        entityId: followerId,
        title: 'Novo seguidor',
        body: `${followerName} começou a seguir você`,
      },
    });
    await this.pushNotifications.send(followingId, {
      title: followNotification.title,
      body: followNotification.body,
      url: '/notifications',
      tag: followNotification.id,
    });
  }

  private emitProfileStatsUpdated(...userIds: string[]) {
    this.directMessagesGateway.emitProfileStatsUpdated(userIds);
  }

  private async createFollowRequest(
    requesterId: string,
    targetId: string,
    requesterName: string,
  ) {
    const existing = await this.prisma.followRequest.findUnique({
      where: {
        requesterId_targetId: {
          requesterId,
          targetId,
        },
      },
    });

    if (existing) {
      return;
    }

    await this.prisma.followRequest.create({
      data: {
        requesterId,
        targetId,
      },
    });

    const requestNotification = await this.prisma.notification.create({
      data: {
        userId: targetId,
        type: 'follow_request',
        entityType: 'follow',
        entityId: requesterId,
        title: 'Solicitação para seguir',
        body: `${requesterName} quer seguir você`,
      },
    });
    await this.pushNotifications.send(targetId, {
      title: requestNotification.title,
      body: requestNotification.body,
      url: '/notifications',
      tag: requestNotification.id,
    });
  }

  private async cancelFollowRequest(requesterId: string, targetId: string) {
    await this.prisma.followRequest.deleteMany({
      where: {
        requesterId,
        targetId,
      },
    });

    await this.prisma.notification.deleteMany({
      where: {
        userId: targetId,
        type: 'follow_request',
        entityId: requesterId,
      },
    });
  }

  private async mapPublicProfile(
    user: UserWithProfile,
    currentUserId: string | null,
  ): Promise<PublicUserProfilePayload> {
    const profile = user.profile;

    if (!profile) {
      throw new Error('User profile is required.');
    }

    const [
      followersCount,
      followingCount,
      cloudsCount,
      hypesCount,
      blockRelation,
    ] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: user.id } }),
      this.prisma.follow.count({ where: { followerId: user.id } }),
      this.prisma.cloud.count({
        where: { authorId: user.id, deletedAt: null },
      }),
      this.prisma.cloudHype.count({
        where: { cloud: { authorId: user.id, deletedAt: null } },
      }),
      currentUserId && currentUserId !== user.id
        ? this.prisma.userBlock.findFirst({
            where: {
              OR: [
                { blockerId: currentUserId, blockedId: user.id },
                { blockerId: user.id, blockedId: currentUserId },
              ],
            },
            select: { blockerId: true },
          })
        : null,
    ]);
    const isFollowing = currentUserId
      ? Boolean(
          await this.prisma.follow.findFirst({
            where: {
              followerId: currentUserId,
              followingId: user.id,
            },
            select: { followerId: true },
          }),
        )
      : false;
    const isFollowRequested =
      currentUserId && !isFollowing
        ? Boolean(
            await this.prisma.followRequest.findUnique({
              where: {
                requesterId_targetId: {
                  requesterId: currentUserId,
                  targetId: user.id,
                },
              },
              select: { requesterId: true },
            }),
          )
        : false;

    const isSelf = currentUserId === user.id;
    const isBlockedByMe = blockRelation?.blockerId === currentUserId;
    const isBlockedByUser = blockRelation?.blockerId === user.id;
    const canViewContent =
      !blockRelation && (isSelf || isFollowing || !profile.isPrivate);

    const cloudVisibilityFilter =
      !isSelf && !isFollowing ? { visibility: 'public' as const } : {};
    const activeClouds = canViewContent
      ? await this.prisma.cloud.findMany({
          where: {
            authorId: user.id,
            deletedAt: null,
            status: CloudStatus.active,
            // Non-followers can only see public clouds even when profile is public
            ...cloudVisibilityFilter,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            content: true,
            duration: true,
            createdAt: true,
            scheduledAt: true,
            visibility: true,
            authorId: true,
            members: {
              where: { leftAt: null },
              take: 4,
              orderBy: { joinedAt: 'asc' },
              select: {
                userId: true,
                user: {
                  select: {
                    profile: { select: { displayName: true, avatarUrl: true } },
                  },
                },
              },
            },
          },
        })
      : [];

    const serializedActiveClouds = activeClouds.map<
      PublicUserProfilePayload['activeClouds'][number]
    >((cloud) => ({
      id: cloud.id,
      title: cloud.title,
      description: cloud.content,
      duration: cloud.duration,
      createdAt: cloud.createdAt.toISOString(),
      scheduledAt: cloud.scheduledAt?.toISOString() ?? null,
      authorId: cloud.authorId,
      participantProfiles: cloud.members
        .filter((member) => member.user.profile)
        .map((member) => ({
          id: member.userId,
          name: member.user.profile!.displayName,
          avatarUrl: member.user.profile!.avatarUrl,
        })),
      visibility: cloud.visibility === 'private' ? 'private' : 'public',
      href: `/cloud/${cloud.id}?source=for-you`,
    }));

    const endedClouds =
      canViewContent && (isSelf || profile.showArchivedClouds)
        ? await this.prisma.cloud.findMany({
            where: {
              authorId: user.id,
              deletedAt: null,
              status: CloudStatus.ended,
              ...cloudVisibilityFilter,
            },
            orderBy: [{ endedAt: 'desc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              title: true,
              content: true,
              duration: true,
              createdAt: true,
              endedAt: true,
              visibility: true,
              authorId: true,
              members: {
                where: { leftAt: null },
                take: 4,
                orderBy: { joinedAt: 'asc' },
                select: {
                  userId: true,
                  user: {
                    select: {
                      profile: {
                        select: { displayName: true, avatarUrl: true },
                      },
                    },
                  },
                },
              },
            },
          })
        : [];

    const serializedEndedClouds = endedClouds.map<
      PublicUserProfilePayload['endedClouds'][number]
    >((cloud) => ({
      id: cloud.id,
      title: cloud.title,
      description: cloud.content,
      duration: cloud.duration,
      createdAt: cloud.createdAt.toISOString(),
      endedAt: cloud.endedAt?.toISOString() ?? null,
      authorId: cloud.authorId,
      participantProfiles: cloud.members
        .filter((member) => member.user.profile)
        .map((member) => ({
          id: member.userId,
          name: member.user.profile!.displayName,
          avatarUrl: member.user.profile!.avatarUrl,
        })),
      visibility: cloud.visibility === 'private' ? 'private' : 'public',
      href: `/cloud/${cloud.id}/conversation`,
    }));

    const participatingNow =
      canViewContent && (isSelf || profile.showParticipatingNow)
        ? await this.prisma.cloudMember.findFirst({
            where: {
              userId: user.id,
              leftAt: null,
              cloud: {
                deletedAt: null,
                status: CloudStatus.active,
                ...cloudVisibilityFilter,
              },
            },
            orderBy: { joinedAt: 'desc' },
            select: {
              cloud: { select: { id: true, title: true, duration: true } },
            },
          })
        : null;

    return {
      id: user.id,
      username: profile.username,
      name: profile.displayName,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverUrl: profile.coverUrl,
      location: profile.location,
      website: profile.website,
      isPrivate: profile.isPrivate,
      showArchivedClouds: isSelf || profile.showArchivedClouds,
      showParticipatingNow: isSelf || profile.showParticipatingNow,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      followersCount,
      followingCount,
      cloudsCount,
      hypesCount: isSelf || profile.showHypesCount ? hypesCount : 0,
      showHypesCount: isSelf || profile.showHypesCount,
      isFollowing,
      isFollowRequested,
      isBlockedByMe,
      isBlockedByUser,
      isSelf,
      profileUrl: `/users/${profile.username}`,
      activeCloud: serializedActiveClouds[0] ?? null,
      participatingNow: participatingNow
        ? {
            id: participatingNow.cloud.id,
            title: participatingNow.cloud.title,
            duration: participatingNow.cloud.duration,
            href: `/cloud/${participatingNow.cloud.id}`,
          }
        : null,
      activeClouds: serializedActiveClouds,
      endedClouds: serializedEndedClouds,
    };
  }

  private async ensureUsersCanInteract(
    firstUserId: string,
    secondUserId: string,
  ) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: firstUserId, blockedId: secondUserId },
          { blockerId: secondUserId, blockedId: firstUserId },
        ],
      },
      select: { blockerId: true },
    });

    if (block) {
      throw new ForbiddenException({
        message: 'Não é possível interagir com este perfil.',
      });
    }
  }

  async getInviteContacts(token: string | null): Promise<{
    ok: true;
    contacts: Array<{
      identifier: string;
      displayName: string;
      type: 'email' | 'phone';
    }>;
  }> {
    const current = await this.requireSession(token);
    const contacts: Array<{
      identifier: string;
      displayName: string;
      type: 'email' | 'phone';
    }> = [];

    if (current.user.email) {
      contacts.push({
        identifier: current.user.email,
        displayName: current.user.email,
        type: 'email',
      });
    }

    return { ok: true, contacts };
  }

  async sendInvite(
    token: string | null,
    identifier: string,
  ): Promise<{ ok: true; inviteUrl: string }> {
    void identifier; // The current invitation API returns a shared landing URL.
    await this.requireSession(token);

    const appUrl =
      process.env.APP_WEB_ORIGIN?.split(',')[0]?.trim() ??
      'http://localhost:3000';
    const inviteUrl = `${appUrl}/cloudscommunity`;

    return { ok: true, inviteUrl };
  }
}
