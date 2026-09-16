import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma, Session } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import {
  AuthResponse,
  AuthResult,
  AuthSessionPayload,
  AuthUserPayload,
  EmailAvailabilityResponse,
  SignupPendingResponse,
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
  validateMinimumAge,
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

const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

type UserWithProfile = Prisma.UserGetPayload<{
  include: {
    profile: true;
  };
}>;

type UserStats = {
  followersCount: number;
  followingCount: number;
  cloudsCount: number;
  hypesCount: number;
};

@Injectable()
export class AuthService {
  private readonly resend: Resend | null;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async signup(input: SignupInput, _meta: { ipAddress: string | null; userAgent: string | null }): Promise<SignupPendingResponse> {
    const email = validateEmail(input.email ?? '');
    const name = normalizeName(input.name ?? '');
    const username = validateUsername(input.username ?? '');
    const password = input.password ?? '';
    const birthDate = parseBirthDate(input.birthDate ?? '');
    validateMinimumAge(birthDate);

    if (!name) {
      throw new BadRequestException({
        message: 'Nome obrigatório.',
        fieldErrors: { name: 'Informe seu nome.' },
      });
    }

    validatePassword(password);

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      makeAuthConflict({ email: 'Este email já está em uso.' }, 'Email já cadastrado.');
    }

    const existingUsername = await this.prisma.profile.findUnique({
      where: { username },
      select: { userId: true },
    });

    if (existingUsername) {
      makeAuthConflict({ username: 'Este nome de usuário já está em uso.' }, 'Username já cadastrado.');
    }

    const passwordHash = createPasswordHash(password);
    const displayLocation = normalizeOptionalText(input.location ?? input.region);
    const bio = normalizeOptionalText(input.bio);
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          status: 'pending',
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

      return user;
    });

    await this.sendVerificationEmail(created.id, email, name);
    return { ok: true, pendingVerification: true, email };
  }

  async resendEmailVerification(emailInput: string): Promise<{ ok: true; message: string; retryAfterSeconds?: number }> {
    const email = validateEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email }, include: { profile: true } });

    if (!user || user.status !== 'pending' || !user.profile) {
      return { ok: true, message: 'Se existir uma conta pendente para este email, enviaremos um novo link.' };
    }

    const latestToken = await this.prisma.emailVerificationToken.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const elapsed = latestToken ? Date.now() - latestToken.createdAt.getTime() : EMAIL_RESEND_COOLDOWN_MS;

    if (elapsed < EMAIL_RESEND_COOLDOWN_MS) {
      return {
        ok: true,
        message: 'Aguarde antes de solicitar outro email.',
        retryAfterSeconds: Math.ceil((EMAIL_RESEND_COOLDOWN_MS - elapsed) / 1000),
      };
    }

    await this.sendVerificationEmail(user.id, user.email, user.profile.displayName);
    return { ok: true, message: 'Um novo link de validação foi enviado.' };
  }

  async verifyEmail(token: string, meta: { ipAddress: string | null; userAgent: string | null }): Promise<AuthResult> {
    const rawToken = token.trim();
    if (!rawToken) throw new BadRequestException({ message: 'Link de validação inválido.' });

    const verification = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hashVerificationToken(rawToken) },
      include: { user: { include: { profile: true } } },
    });

    if (!verification || verification.usedAt || verification.expiresAt.getTime() <= Date.now() || !verification.user.profile) {
      throw new BadRequestException({ message: 'Este link de validação é inválido ou expirou.' });
    }

    const claimed = await this.prisma.emailVerificationToken.updateMany({
      where: { id: verification.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException({ message: 'Este link de validação já foi utilizado.' });

    const user = await this.prisma.user.update({
      where: { id: verification.user.id },
      data: { status: 'active', emailVerifiedAt: new Date() },
      include: { profile: true },
    });
    const session = await this.createSession(user.id, meta);

    return { ok: true, user: this.mapUser(user), session: this.mapSession(session.session), token: session.token };
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
    const userByEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    const profileByUsername = userByEmail
      ? null
      : await this.prisma.profile.findUnique({
          where: { username: normalizedUsername },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        });

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

    if (authenticatedUser.status === 'pending') {
      throw new BadRequestException({
        message: 'Valide seu email antes de entrar.',
        fieldErrors: { identifier: 'Verifique seu email para ativar a conta.' },
      });
    }

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
      user: await this.mapUserWithStats(current.user),
      session: this.mapSession(current.session),
    };
  }

  async updateProfile(token: string | null, input: { displayName?: string; bio?: string; location?: string; avatarUrl?: string; isPrivate?: boolean }): Promise<AuthResponse> {    const current = await this.resolveSession(token);
    if (!current) throw new UnauthorizedException({ message: 'Sessão não encontrada.' });

    const displayName = input.displayName === undefined ? undefined : normalizeName(input.displayName);
    if (input.displayName !== undefined && !displayName) {
      throw new BadRequestException({ message: 'Nome obrigatório.' });
    }
    const bio = input.bio === undefined ? undefined : normalizeOptionalText(input.bio);
    const location = input.location === undefined ? undefined : normalizeOptionalText(input.location);
    const avatarUrl = input.avatarUrl === undefined ? undefined : normalizeOptionalText(input.avatarUrl);
    if ((bio && bio.length > 500) || (location && location.length > 120) || (avatarUrl && avatarUrl.length > 4_000_000)) {
      throw new BadRequestException({ message: 'Um dos campos excede o tamanho permitido.' });
    }
    if (avatarUrl && !avatarUrl.startsWith('data:image/') && !/^https?:\/\//.test(avatarUrl)) {
      throw new BadRequestException({ message: 'Imagem de perfil inválida.' });
    }

    const updated = await this.prisma.user.update({
      where: { id: current.user.id },
      data: { profile: { update: { displayName, bio, location, avatarUrl, isPrivate: input.isPrivate } } },
      include: { profile: true },
    });
    return { ok: true, user: await this.mapUserWithStats(updated), session: this.mapSession(current.session) };
  }

  async session(token: string | null): Promise<AuthResponse> {
    return this.me(token);
  }

  async changePassword(token: string | null, input: { currentPassword?: string; newPassword?: string }): Promise<{ ok: true }> {
    const current = await this.resolveSession(token);
    if (!current) throw new UnauthorizedException({ message: 'Sessão não encontrada.' });

    const currentPassword = input.currentPassword ?? '';
    const newPassword = input.newPassword ?? '';

    if (!currentPassword) {
      throw new BadRequestException({ message: 'Senha atual obrigatória.', fieldErrors: { currentPassword: 'Informe a senha atual.' } });
    }

    if (!verifyPassword(currentPassword, current.user.passwordHash)) {
      throw new BadRequestException({ message: 'Senha atual incorreta.', fieldErrors: { currentPassword: 'Senha atual incorreta.' } });
    }

    validatePassword(newPassword);

    const passwordHash = createPasswordHash(newPassword);
    await this.prisma.user.update({
      where: { id: current.user.id },
      data: { passwordHash },
    });

    return { ok: true };
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

  private async sendVerificationEmail(userId: string, email: string, displayName: string): Promise<void> {
    if (!this.resend) {
      throw new Error('RESEND_API_KEY não configurada.');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    const webOrigin = (process.env.APP_WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');
    const verificationUrl = `${webOrigin}/verify-email?token=${encodeURIComponent(rawToken)}`;
    const safeDisplayName = this.escapeHtml(displayName);

    await this.prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
    await this.prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });

    const { error } = await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL?.trim() || 'Clouds <no-reply@cloudscommunity.com.br>',
      to: [email],
      subject: 'Valide seu email no Clouds',
      text: `Olá, ${displayName}! Valide seu email acessando: ${verificationUrl}. Este link expira em 30 minutos.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Valide seu email</h1><p>Olá, ${safeDisplayName}!</p><p>Clique no botão abaixo para concluir seu cadastro no Clouds.</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;background:#9333ea;color:#fff;text-decoration:none;border-radius:999px">Validar meu email</a></p><p>Este link expira em 30 minutos.</p></div>`,
    });

    if (error) {
      await this.prisma.emailVerificationToken.deleteMany({ where: { tokenHash } });
      throw new BadRequestException({ message: 'Não foi possível enviar o email de validação agora.' });
    }
  }

  private hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
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
    return this.buildUserPayload(user);
  }

  private async mapUserWithStats(user: UserWithProfile): Promise<AuthUserPayload> {
    const profile = user.profile;

    if (!profile) {
      throw new Error('User profile is required.');
    }

    const userStats = await this.loadUserStats(user.id);

    return this.buildUserPayload(user, userStats);
  }

  private buildUserPayload(user: UserWithProfile, stats?: UserStats): AuthUserPayload {
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
      followersCount: stats?.followersCount,
      followingCount: stats?.followingCount,
      cloudsCount: stats?.cloudsCount,
      hypesCount: stats?.hypesCount,
    };
  }

  private async loadUserStats(userId: string): Promise<UserStats> {
    const [followersCount, followingCount, cloudsCount, hypesCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
      this.prisma.cloud.count({ where: { authorId: userId, deletedAt: null } }),
      this.prisma.cloudHype.count({ where: { cloud: { authorId: userId, deletedAt: null } } }),
    ]);

    return {
      followersCount,
      followingCount,
      cloudsCount,
      hypesCount,
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
