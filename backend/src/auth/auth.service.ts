import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma, Session } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import {
  AuthResponse,
  AuthResult,
  AuthSessionPayload,
  AuthUserPayload,
  EmailAvailabilityResponse,
  UsernameAvailabilityResponse,
} from './auth.types';
import {
  createPasswordHash,
  createSessionToken,
  hashSessionToken,
  makeAuthConflict,
  makeAuthUnauthorized,
  normalizeEmail,
  normalizeName,
  normalizeOptionalText,
  normalizeUsername,
  parseBirthDate,
  formatDateOnly,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyPassword,
} from './auth.utils';

type LoginInput = {
  identifier?: string;
  email?: string;
  username?: string;
  password?: string;
};

type SignupInput = {
  email?: string;
  name?: string;
  username?: string;
  password?: string;
  birthDate?: string;
  bio?: string;
  location?: string;
  region?: string;
};

type SessionBundle = {
  session: Session;
  token: string;
};

type UserWithProfile = Prisma.UserGetPayload<{
  include: {
    profile: true;
  };
}>;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(input: SignupInput, meta: { ipAddress: string | null; userAgent: string | null }): Promise<AuthResult> {
    const email = validateEmail(input.email ?? '');
    const name = normalizeName(input.name ?? '');
    const username = validateUsername(input.username ?? '');
    const password = input.password ?? '';
    const birthDate = parseBirthDate(input.birthDate ?? '');

    if (!name) {
      throw new BadRequestException({
        message: 'Nome obrigatório.',
        fieldErrors: { name: 'Informe seu nome.' },
      });
    }

    validatePassword(password);

    const [existingEmail, existingUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.profile.findUnique({ where: { username }, select: { userId: true } }),
    ]);

    if (existingEmail) {
      makeAuthConflict({ email: 'Este email já está em uso.' }, 'Email já cadastrado.');
    }

    if (existingUsername) {
      makeAuthConflict({ username: 'Este nome de usuário já está em uso.' }, 'Username já cadastrado.');
    }

    const passwordHash = createPasswordHash(password);
    const displayLocation = normalizeOptionalText(input.location ?? input.region);
    const bio = normalizeOptionalText(input.bio);
    const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const token = createSessionToken();
    const refreshTokenHash = hashSessionToken(token);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          status: 'active',
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          profile: {
            create: {
              username,
              displayName: name,
              birthDate,
              bio,
              location: displayLocation,
            },
          },
        },
        include: {
          profile: true,
        },
      });

      const session = await tx.session.create({
        data: {
          userId: user.id,
          refreshTokenHash,
          deviceName: this.resolveDeviceName(meta.userAgent),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          expiresAt: sessionExpiresAt,
        },
      });

      return { user, session };
    });

    return {
      ok: true,
      user: this.mapUser(created.user),
      session: this.mapSession(created.session),
      token,
    };
  }

  async login(input: LoginInput, meta: { ipAddress: string | null; userAgent: string | null }): Promise<AuthResult> {
    const identifierRaw = input.identifier ?? input.email ?? input.username ?? '';
    const identifier = identifierRaw.trim();
    const password = input.password ?? '';

    if (!identifier) {
      throw new BadRequestException({
        message: 'Informe email ou nome de usuário.',
        fieldErrors: { identifier: 'Informe email ou nome de usuário.' },
      });
    }

    if (!password) {
      throw new BadRequestException({
        message: 'Informe sua senha.',
        fieldErrors: { password: 'Informe sua senha.' },
      });
    }

    const normalizedEmail = normalizeEmail(identifier);
    const normalizedUsername = normalizeUsername(identifier);
    const [userByEmail, profileByUsername] = await Promise.all([
      this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { profile: true },
      }),
      this.prisma.profile.findUnique({
        where: { username: normalizedUsername },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      }),
    ]);

    const user = userByEmail ?? profileByUsername?.user ?? null;

    if (!user || !user.profile) {
      makeAuthUnauthorized(
        {
          identifier: 'Credenciais inválidas.',
          password: 'Credenciais inválidas.',
        },
        'Credenciais inválidas.',
      );
    }

    const authenticatedUser = user as NonNullable<typeof user>;

    if (authenticatedUser.status !== 'active') {
      throw new BadRequestException({
        message: 'Conta indisponível.',
        fieldErrors: {
          identifier: 'Sua conta não está disponível no momento.',
        },
      });
    }

    if (!verifyPassword(password, authenticatedUser.passwordHash)) {
      makeAuthUnauthorized(
        {
          identifier: 'Credenciais inválidas.',
          password: 'Credenciais inválidas.',
        },
        'Credenciais inválidas.',
      );
    }

    const session = await this.createSession(authenticatedUser.id, meta);

    await this.prisma.user.update({
      where: { id: authenticatedUser.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ok: true,
      user: this.mapUser(authenticatedUser),
      session: this.mapSession(session.session),
      token: session.token,
    };
  }

  async me(token: string | null): Promise<AuthResponse> {
    const current = await this.resolveSession(token);

    if (!current) {
      throw new UnauthorizedException({
        message: 'Sessão não encontrada.',
      });
    }

    return {
      ok: true,
      user: this.mapUser(current.user),
      session: this.mapSession(current.session),
    };
  }

  async session(token: string | null): Promise<AuthResponse> {
    return this.me(token);
  }

  async logout(token: string | null): Promise<{ ok: true }> {
    if (!token) {
      return { ok: true };
    }

    const refreshTokenHash = hashSessionToken(token);
    await this.prisma.session.updateMany({
      where: {
        refreshTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async usernameAvailability(usernameInput: string): Promise<UsernameAvailabilityResponse> {
    const username = validateUsername(usernameInput);
    const existing = await this.prisma.profile.findUnique({
      where: { username },
      select: { userId: true },
    });

    return {
      ok: true,
      available: !existing,
      username,
    };
  }

  async emailAvailability(emailInput: string): Promise<EmailAvailabilityResponse> {
    const email = validateEmail(emailInput);
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return {
      ok: true,
      available: !existing,
      email,
    };
  }

  async createSession(userId: string, meta: { ipAddress: string | null; userAgent: string | null }): Promise<SessionBundle> {
    const token = createSessionToken();
    const refreshTokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        deviceName: this.resolveDeviceName(meta.userAgent),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt,
      },
    });

    return { session, token };
  }

  async resolveSession(token: string | null): Promise<{ session: Session; user: UserWithProfile } | null> {
    if (!token) {
      return null;
    }

    const refreshTokenHash = hashSessionToken(token);
    const session = await this.prisma.session.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    if (!session.user.profile) {
      return null;
    }

    return {
      session,
      user: session.user,
    };
  }

  private mapSession(session: Session): AuthSessionPayload {
    return {
      id: session.id,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
    };
  }

  private mapUser(user: UserWithProfile): AuthUserPayload {
    const profile = user.profile;

    if (!profile) {
      throw new Error('User profile is required.');
    }

    return {
      id: user.id,
      email: user.email,
      username: profile.username,
      name: profile.displayName,
      displayName: profile.displayName,
      birthDate: formatDateOnly(profile.birthDate),
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      coverUrl: profile.coverUrl,
      location: profile.location,
      website: profile.website,
      isPrivate: profile.isPrivate,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private resolveDeviceName(userAgent: string | null): string | null {
    if (!userAgent) {
      return null;
    }

    if (userAgent.includes('Mobile')) {
      return 'Mobile';
    }

    return userAgent.slice(0, 120);
  }
}
