import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CloudStatus, Prisma, UserStatus } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PublicUserProfilePayload, UserProfileResponse, UsersSearchResponse } from './users.types';

type SessionUser = Awaited<ReturnType<AuthService['resolveSession']>> extends infer T
  ? T extends { user: infer U } ? U : never
  : never;

type UserWithProfile = Prisma.UserGetPayload<{
  include: {
    profile: true;
  };
}>;

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 10;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  ) {}

  async search(token: string | null, queryInput: string, limitInput?: string | null): Promise<UsersSearchResponse> {
    const current = await this.resolveCurrentSession(token);
    const query = normalizeText(queryInput ?? '');
    const parsedLimit = Number.parseInt(limitInput ?? '', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_SEARCH_LIMIT) : DEFAULT_SEARCH_LIMIT;

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
      .filter(({ score }) => query ? score > 0 : true)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.user.createdAt.getTime() - left.user.createdAt.getTime();
      })
      .slice(0, limit);

    const users = await Promise.all(ranked.map(({ user }) => this.mapPublicProfile(user, current?.user.id ?? null)));

    return {
      ok: true,
      users,
    };
  }

  async getProfile(token: string | null, identifierInput: string): Promise<UserProfileResponse> {
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

  async follow(token: string | null, identifierInput: string): Promise<UserProfileResponse> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);

    if (target.id === current.user.id) {
      throw new BadRequestException({
        message: 'Você não pode seguir seu próprio perfil.',
      });
    }

    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: current.user.id,
          followingId: target.id,
        },
      },
      update: {},
      create: {
        followerId: current.user.id,
        followingId: target.id,
      },
    });

    return {
      ok: true,
      user: await this.mapPublicProfile(target, current.user.id),
    };
  }

  async unfollow(token: string | null, identifierInput: string): Promise<UserProfileResponse> {
    const current = await this.requireSession(token);
    const target = await this.requireTargetUser(identifierInput);

    if (target.id === current.user.id) {
      throw new BadRequestException({
        message: 'Você não pode deixar de seguir seu próprio perfil.',
      });
    }

    await this.prisma.follow.deleteMany({
      where: {
        followerId: current.user.id,
        followingId: target.id,
      },
    });

    return {
      ok: true,
      user: await this.mapPublicProfile(target, current.user.id),
    };
  }

  async following(token: string | null): Promise<UsersSearchResponse> {
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

      if (!user.profile || user.status !== UserStatus.active || user.deletedAt !== null) {
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
    return session ? { ...session, user: session.user as SessionUser } : null;
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

    const normalizedUsername = identifier.startsWith('@') ? identifier.slice(1) : identifier;

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
      return profile ? normalizeText(profile.displayName) === normalizedIdentifier : false;
    });

    return byDisplayName?.profile ? byDisplayName : null;
  }

  private async mapPublicProfile(user: UserWithProfile, currentUserId: string | null): Promise<PublicUserProfilePayload> {
    const profile = user.profile;

    if (!profile) {
      throw new Error('User profile is required.');
    }

    const followersCount = await this.prisma.follow.count({ where: { followingId: user.id } });
    const followingCount = await this.prisma.follow.count({ where: { followerId: user.id } });
    const cloudsCount = await this.prisma.cloud.count({ where: { authorId: user.id, deletedAt: null } });
    const hypesCount = await this.prisma.cloudHype.count({ where: { userId: user.id } });
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

    const activeClouds = await this.prisma.cloud.findMany({
      where: {
        authorId: user.id,
        deletedAt: null,
        status: CloudStatus.active,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        duration: true,
        createdAt: true,
        visibility: true,
      },
    });

    const serializedActiveClouds = activeClouds.map((cloud) => ({
      id: cloud.id,
      title: cloud.title,
      description: cloud.content,
      duration: cloud.duration,
      createdAt: cloud.createdAt.toISOString(),
      visibility: (cloud.visibility === 'private' ? 'private' : 'public') as 'private' | 'public',
      href: `/cloud/${cloud.id}?source=for-you`,
    }));

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
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      followersCount,
      followingCount,
      cloudsCount,
      hypesCount,
      isFollowing,
      isSelf: currentUserId === user.id,
      profileUrl: `/users/${profile.username}`,
      activeCloud: serializedActiveClouds[0] ?? null,
      activeClouds: serializedActiveClouds,
    };
  }
}
