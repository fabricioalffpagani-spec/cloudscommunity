import {
  BadRequestException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma, Session } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { SESSION_TTL_MS } from './auth.constants';
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
  rememberDevice?: boolean;
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
  acceptedTerms?: boolean;
  acceptedCommunityRules?: boolean;
  returnTo?: string;
  invitationCode?: string;
};

type SessionBundle = {
  session: Session;
  token: string;
};

const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_TTL_MS =
  Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 30) * 60 * 1000;

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

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly push?: PushNotificationsService,
  ) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async deleteAccount(token: string | null): Promise<void> {
    const current = await this.resolveSession(token);
    if (!current)
      throw new UnauthorizedException({ message: 'Sessão não encontrada.' });
    await this.prisma.user.delete({ where: { id: current.user.id } });
  }

  async signup(
    input: SignupInput,
    _meta: { ipAddress: string | null; userAgent: string | null },
  ): Promise<SignupPendingResponse> {
    void _meta; // Signup metadata is reserved for future audit logging.
    const email = validateEmail(input.email ?? '');
    const name = normalizeName(input.name ?? '');
    const username = validateUsername(input.username ?? '');
    const password = input.password ?? '';
    const birthDate = parseBirthDate(input.birthDate ?? '');
    validateMinimumAge(birthDate);

    if (!input.acceptedTerms || !input.acceptedCommunityRules) {
      throw new BadRequestException({
        message: 'Aceite obrigatório.',
        fieldErrors: {
          form: 'Aceite os Termos de Uso e as Regras da Comunidade para concluir o cadastro.',
        },
      });
    }

    if (!name) {
      throw new BadRequestException({
        message: 'Nome obrigatório.',
        fieldErrors: { name: 'Informe seu nome.' },
      });
    }

    validatePassword(password);

    const inviteCode = input.invitationCode?.trim().toUpperCase() || '';
    const inviter = inviteCode
      ? ((await this.prisma.invitationCode.findUnique({
          where: { code: inviteCode },
        })) ??
        (await this.prisma.invitationCode.findUnique({
          where: { legacyCode: inviteCode },
        })))
      : null;
    if (inviteCode && !inviter)
      throw new BadRequestException({
        message: 'Código de convite inválido.',
        fieldErrors: { invitationCode: 'Código de convite inválido.' },
      });

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      makeAuthConflict(
        { email: 'Este email já está em uso.' },
        'Email já cadastrado.',
      );
    }

    const existingUsername = await this.prisma.profile.findUnique({
      where: { username },
      select: { userId: true },
    });

    if (existingUsername) {
      makeAuthConflict(
        { username: 'Este nome de usuário já está em uso.' },
        'Username já cadastrado.',
      );
    }

    const passwordHash = createPasswordHash(password);
    const displayLocation = normalizeOptionalText(
      input.location ?? input.region,
    );
    const bio = normalizeOptionalText(input.bio);
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          termsAcceptedAt: new Date(),
          communityRulesAcceptedAt: new Date(),
          status: 'pending',
          profile: {
            create: {
              username,
              displayName: name,
              birthDate,
              bio,
              location: displayLocation,
              interestsOnboardingRequired: true,
            },
          },
        },
        include: {
          profile: true,
        },
      });

      if (inviter)
        await tx.invitationReferral.create({
          data: { invitedUserId: user.id, inviterUserId: inviter.userId },
        });

      return user;
    });

    await this.sendVerificationEmail(
      created.id,
      email,
      name,
      this.normalizeVerificationReturnTo(input.returnTo),
    );
    return { ok: true, pendingVerification: true, email };
  }

  async resendEmailVerification(
    emailInput: string,
  ): Promise<{ ok: true; message: string; retryAfterSeconds?: number }> {
    const email = validateEmail(emailInput);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || user.status !== 'pending' || !user.profile) {
      return {
        ok: true,
        message:
          'Se existir uma conta pendente para este email, enviaremos um novo link.',
      };
    }

    const latestToken = await this.prisma.emailVerificationToken.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const elapsed = latestToken
      ? Date.now() - latestToken.createdAt.getTime()
      : EMAIL_RESEND_COOLDOWN_MS;

    if (elapsed < EMAIL_RESEND_COOLDOWN_MS) {
      return {
        ok: true,
        message: 'Aguarde antes de solicitar outro email.',
        retryAfterSeconds: Math.ceil(
          (EMAIL_RESEND_COOLDOWN_MS - elapsed) / 1000,
        ),
      };
    }

    await this.sendVerificationEmail(
      user.id,
      user.email,
      user.profile.displayName,
    );
    return { ok: true, message: 'Um novo link de validação foi enviado.' };
  }

  async verifyEmail(
    token: string,
    meta: { ipAddress: string | null; userAgent: string | null },
  ): Promise<AuthResult> {
    const rawToken = token.trim();
    if (!rawToken)
      throw new BadRequestException({ message: 'Link de validação inválido.' });

    const verification = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hashVerificationToken(rawToken) },
      include: { user: { include: { profile: true } } },
    });

    if (
      !verification ||
      verification.usedAt ||
      verification.expiresAt.getTime() <= Date.now() ||
      !verification.user.profile
    ) {
      throw new BadRequestException({
        message: 'Este link de validação é inválido ou expirou.',
      });
    }

    const { user, notification } = await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.emailVerificationToken.updateMany({
          where: { id: verification.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (claimed.count !== 1)
          throw new BadRequestException({
            message: 'Este link de validação já foi utilizado.',
          });
        const user = await tx.user.update({
          where: { id: verification.user.id },
          data: { status: 'active', emailVerifiedAt: new Date() },
          include: { profile: true },
        });
        const referral = await tx.invitationReferral.findUnique({
          where: { invitedUserId: user.id },
        });
        if (!referral || referral.creditedAt)
          return { user, notification: null };
        const claimedReferral = await tx.invitationReferral.updateMany({
          where: { invitedUserId: user.id, creditedAt: null },
          data: { creditedAt: new Date() },
        });
        if (!claimedReferral.count) return { user, notification: null };
        const body = `${user.profile?.displayName || 'Um novo usuário'} entrou no Clouds com seu convite! +10 hypes foram adicionados em seu perfil!`;
        const notification = await tx.notification.create({
          data: {
            userId: referral.inviterUserId,
            type: 'system',
            entityType: 'user',
            entityId: user.id,
            title: 'Novo convite aceito',
            body,
          },
        });
        return { user, notification };
      },
    );
    if (notification && this.push)
      void this.push
        .send(notification.userId, {
          title: notification.title,
          body: notification.body,
          url: '/profile',
          tag: notification.id,
        })
        .catch(() => undefined);
    const session = await this.createSession(user.id, meta);

    return {
      ok: true,
      user: this.mapUser(user),
      session: this.mapSession(session.session),
      token: session.token,
    };
  }

  async requestPasswordReset(
    emailInput: string,
  ): Promise<{ ok: true; message: string }> {
    const email = validateEmail(emailInput);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    const message =
      'Se houver uma conta com este email, enviaremos um link para redefinir a senha.';

    if (!user || user.status !== 'active' || !user.profile) {
      return { ok: true, message };
    }

    await this.sendPasswordResetEmail(
      user.id,
      user.email,
      user.profile.displayName,
    );
    return { ok: true, message };
  }

  async resetPassword(
    tokenInput: string,
    passwordInput: string,
  ): Promise<{ ok: true; message: string }> {
    const rawToken = tokenInput.trim();
    if (!rawToken)
      throw new BadRequestException({
        message: 'Link de redefinição inválido.',
      });

    validatePassword(passwordInput);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashVerificationToken(rawToken) },
      include: { user: { include: { profile: true } } },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() <= Date.now() ||
      !resetToken.user.profile
    ) {
      throw new BadRequestException({
        message: 'Este link de redefinição é inválido ou expirou.',
      });
    }

    const passwordHash = createPasswordHash(passwordInput);
    const changedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: changedAt },
      });
      if (claimed.count !== 1)
        throw new BadRequestException({
          message: 'Este link de redefinição já foi utilizado.',
        });

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId, usedAt: null },
      });
      await tx.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: changedAt },
      });
      return {
        email: resetToken.user.email,
        displayName: resetToken.user.profile!.displayName,
      };
    });

    await this.sendPasswordResetConfirmationEmail(
      result.email,
      result.displayName,
    );
    return {
      ok: true,
      message:
        'Senha redefinida com sucesso. Você já pode entrar com a nova senha.',
    };
  }

  async login(
    input: LoginInput,
    meta: { ipAddress: string | null; userAgent: string | null },
  ): Promise<AuthResult> {
    const identifierRaw =
      input.identifier ?? input.email ?? input.username ?? '';
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

    const session = await this.createSession(
      authenticatedUser.id,
      meta,
      input.rememberDevice === true,
    );

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

  async createGuest(meta: { ipAddress: string | null; userAgent: string | null }): Promise<AuthResult> {
    void meta;
    const suffix = randomBytes(5).toString('hex').slice(0, 9);
    const username = `user${suffix}`;
    const user = await this.prisma.user.create({ data: { email: `${username}@guest.invalid`, passwordHash: createPasswordHash(randomBytes(24).toString('hex')), status: 'active', isGuest: true, profile: { create: { username, displayName: username, birthDate: new Date('2000-01-01'), interestsOnboardingRequired: false } }, }, include: { profile: true } });
    const session = await this.createSession(user.id, meta);
    return { ok: true, user: this.mapUser(user), session: this.mapSession(session.session), token: session.token };
  }

  async updateProfile(
    token: string | null,
    input: {
      displayName?: string;
      bio?: string;
      location?: string;
      avatarUrl?: string;
      isPrivate?: boolean;
      showHypesCount?: boolean;
      showArchivedClouds?: boolean;
      showParticipatingNow?: boolean;
      interests?: string[];
    },
  ): Promise<AuthResponse> {
    const current = await this.resolveSession(token);
    if (!current)
      throw new UnauthorizedException({ message: 'Sessão não encontrada.' });

    const displayName =
      input.displayName === undefined
        ? undefined
        : normalizeName(input.displayName);
    if (input.displayName !== undefined && !displayName) {
      throw new BadRequestException({ message: 'Nome obrigatório.' });
    }
    const bio =
      input.bio === undefined ? undefined : normalizeOptionalText(input.bio);
    const location =
      input.location === undefined
        ? undefined
        : normalizeOptionalText(input.location);
    const avatarUrl =
      input.avatarUrl === undefined
        ? undefined
        : normalizeOptionalText(input.avatarUrl);
    if (
      (bio && bio.length > 500) ||
      (location && location.length > 120) ||
      (avatarUrl && avatarUrl.length > 4_000_000)
    ) {
      throw new BadRequestException({
        message: 'Um dos campos excede o tamanho permitido.',
      });
    }
    if (
      avatarUrl &&
      !avatarUrl.startsWith('data:image/') &&
      !/^https?:\/\//.test(avatarUrl)
    ) {
      throw new BadRequestException({ message: 'Imagem de perfil inválida.' });
    }
    const allowedInterests = new Set([
      'musica',
      'filmes_series',
      'games',
      'esportes',
      'tecnologia',
      'relacionamentos',
      'humor_internet',
      'livros_cultura',
      'atualidades',
      'politica_sociedade',
    ]);
    const interests =
      input.interests === undefined
        ? undefined
        : [
            ...new Set(
              input.interests
                .map((interest) => interest.trim())
                .filter((interest) => allowedInterests.has(interest)),
            ),
          ];
    if (interests !== undefined && interests.length < 3) {
      throw new BadRequestException({
        message: 'Escolha pelo menos 3 temas para continuar.',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: current.user.id },
      data: {
        profile: {
          update: {
            displayName,
            bio,
            location,
            avatarUrl,
            isPrivate: input.isPrivate,
            showHypesCount: input.showHypesCount,
            showArchivedClouds: input.showArchivedClouds,
            showParticipatingNow: input.showParticipatingNow,
            interests,
            interestsCompletedAt:
              interests === undefined ? undefined : new Date(),
            interestsOnboardingRequired:
              interests === undefined ? undefined : false,
          },
        },
      },
      include: { profile: true },
    });
    return {
      ok: true,
      user: await this.mapUserWithStats(updated),
      session: this.mapSession(current.session),
    };
  }

  async session(token: string | null): Promise<AuthResponse> {
    return this.me(token);
  }

  async changePassword(
    token: string | null,
    input: { currentPassword?: string; newPassword?: string },
  ): Promise<{ ok: true }> {
    const current = await this.resolveSession(token);
    if (!current)
      throw new UnauthorizedException({ message: 'Sessão não encontrada.' });

    const currentPassword = input.currentPassword ?? '';
    const newPassword = input.newPassword ?? '';

    if (!currentPassword) {
      throw new BadRequestException({
        message: 'Senha atual obrigatória.',
        fieldErrors: { currentPassword: 'Informe a senha atual.' },
      });
    }

    if (!verifyPassword(currentPassword, current.user.passwordHash)) {
      throw new BadRequestException({
        message: 'Senha atual incorreta.',
        fieldErrors: { currentPassword: 'Senha atual incorreta.' },
      });
    }

    validatePassword(newPassword);

    const passwordHash = createPasswordHash(newPassword);
    await this.prisma.user.update({
      where: { id: current.user.id },
      data: { passwordHash },
    });

    return { ok: true };
  }

  async sendFeedback(
    token: string | null,
    messageInput: string,
  ): Promise<{ ok: true }> {
    const current = await this.resolveSession(token);
    if (!current)
      throw new UnauthorizedException({ message: 'Sessão não encontrada.' });

    const message = messageInput.trim();
    if (message.length < 10) {
      throw new BadRequestException({
        message: 'Escreva uma mensagem com pelo menos 10 caracteres.',
      });
    }
    if (message.length > 4_000) {
      throw new BadRequestException({
        message: 'A mensagem pode ter no máximo 4.000 caracteres.',
      });
    }
    if (!this.resend) {
      throw new BadRequestException({
        message:
          'O serviço de email está temporariamente indisponível. Tente novamente mais tarde.',
      });
    }

    const username = current.user.profile?.username ?? 'usuário';
    const displayName = current.user.profile?.displayName ?? username;
    const { error } = await this.resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL?.trim() ||
        'Clouds <no-reply@cloudscommunity.com.br>',
      to: ['cloudscomunidade@gmail.com'],
      subject: `SUGESTÃO/RECLAMAÇÃO do usuário @${username}`,
      text: `SUGESTÃO/RECLAMAÇÃO do usuário @${username}\n\nNome: ${displayName}\nE-mail: ${current.user.email}\n\nMensagem:\n${message}`,
      html: `<h1>SUGESTÃO/RECLAMAÇÃO do usuário @${this.escapeHtml(username)}</h1><p><strong>Nome:</strong> ${this.escapeHtml(displayName)}<br/><strong>E-mail:</strong> ${this.escapeHtml(current.user.email)}</p><p><strong>Mensagem:</strong></p><p>${this.escapeHtml(message).replace(/\n/g, '<br/>')}</p>`,
    });

    if (error) {
      throw new BadRequestException({
        message:
          'Não foi possível enviar sua mensagem agora. Tente novamente mais tarde.',
      });
    }

    return { ok: true };
  }

  async logout(token: string | null): Promise<{ ok: true }> {
    if (!token) {
      return { ok: true };
    }

    const refreshTokenHash = hashSessionToken(token);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash, revokedAt: null },
      select: {
        userId: true,
        user: {
          include: {
            profile: { select: { username: true, displayName: true } },
          },
        },
      },
    });

    if (session) {
      const activeMemberships = await this.prisma.cloudMember.findMany({
        where: {
          userId: session.userId,
          leftAt: null,
          cloud: { status: 'active' },
        },
        select: { id: true, cloudId: true },
      });
      if (activeMemberships.length > 0) {
        const leftAt = new Date();
        const displayName =
          session.user.profile?.displayName ||
          session.user.profile?.username ||
          'Usuário';
        await this.prisma.$transaction([
          this.prisma.cloudMember.updateMany({
            where: {
              id: { in: activeMemberships.map((membership) => membership.id) },
            },
            data: { leftAt },
          }),
          this.prisma.cloudMessage.createMany({
            data: activeMemberships.map((membership) => ({
              cloudId: membership.cloudId,
              userId: session.userId,
              type: 'system',
              content: `${displayName} saiu da cloud`,
            })),
          }),
        ]);
      }
    }

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

  async usernameAvailability(
    usernameInput: string,
  ): Promise<UsernameAvailabilityResponse> {
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

  async emailAvailability(
    emailInput: string,
  ): Promise<EmailAvailabilityResponse> {
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

  async createSession(
    userId: string,
    meta: { ipAddress: string | null; userAgent: string | null },
    rememberDevice = true,
  ): Promise<SessionBundle> {
    const token = createSessionToken();
    const refreshTokenHash = hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + (rememberDevice ? SESSION_TTL_MS : 1000 * 60 * 60 * 24),
    );

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

  private async sendVerificationEmail(
    userId: string,
    email: string,
    displayName: string,
    returnTo?: string,
  ): Promise<void> {
    if (!this.resend) {
      throw new Error('RESEND_API_KEY não configurada.');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    const webOrigin = (process.env.APP_WEB_ORIGIN ?? 'http://localhost:3000')
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
    const verificationUrl = `${webOrigin}/verify-email?token=${encodeURIComponent(rawToken)}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`;
    const safeDisplayName = this.escapeHtml(displayName);

    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId, usedAt: null },
    });
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    const { error } = await this.resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL?.trim() ||
        'Clouds <no-reply@cloudscommunity.com.br>',
      to: [email],
      subject: 'Valide seu email no Clouds',
      text: `Olá, ${displayName}! Valide seu email acessando: ${verificationUrl}. ${returnTo ? 'Após validar, você voltará para a Cloud que estava acompanhando. ' : ''}Este link expira em 30 minutos.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Valide seu email</h1><p>Olá, ${safeDisplayName}!</p><p>Clique no botão abaixo para concluir seu cadastro no Clouds${returnTo ? ' e voltar para a Cloud que você estava acompanhando' : ''}.</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;background:#9333ea;color:#fff;text-decoration:none;border-radius:999px">Validar meu email${returnTo ? ' e voltar para a Cloud' : ''}</a></p><p>Este link expira em 30 minutos.</p></div>`,
    });

    if (error) {
      await this.prisma.emailVerificationToken.deleteMany({
        where: { tokenHash },
      });
      throw new BadRequestException({
        message: 'Não foi possível enviar o email de validação agora.',
      });
    }
  }

  private normalizeVerificationReturnTo(value?: string): string | undefined {
    if (!value?.startsWith('/cloud/')) return undefined;
    return value.length <= 512 ? value : undefined;
  }

  private async sendPasswordResetEmail(
    userId: string,
    email: string,
    displayName: string,
  ): Promise<void> {
    if (!this.resend) {
      throw new BadRequestException({
        message:
          'O serviço de email está temporariamente indisponível. Tente novamente mais tarde.',
      });
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    const webOrigin = (process.env.APP_WEB_ORIGIN ?? 'http://localhost:3000')
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
    const resetUrl = `${webOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const safeDisplayName = this.escapeHtml(displayName);

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    });
    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    const { error } = await this.resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL?.trim() ||
        'Clouds <no-reply@cloudscommunity.com.br>',
      to: [email],
      subject: 'Redefina sua senha do Clouds',
      text: `Olá, ${displayName}! Recebemos um pedido para redefinir sua senha. Use este link: ${resetUrl}. Ele expira em 30 minutos. Se não foi você, ignore este email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Redefinição de senha</h1><p>Olá, ${safeDisplayName}!</p><p>Recebemos um pedido para redefinir sua senha no Clouds.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#9333ea;color:#fff;text-decoration:none;border-radius:999px">Redefinir minha senha</a></p><p>Este link expira em 30 minutos. Se não foi você, ignore este email.</p></div>`,
    });
    if (error) {
      await this.prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
      throw new BadRequestException({
        message: 'Não foi possível enviar o email de redefinição agora.',
      });
    }
  }

  private async sendPasswordResetConfirmationEmail(
    email: string,
    displayName: string,
  ): Promise<void> {
    if (!this.resend) {
      throw new BadRequestException({
        message:
          'O serviço de email está temporariamente indisponível. Tente novamente mais tarde.',
      });
    }
    const safeDisplayName = this.escapeHtml(displayName);
    const { error } = await this.resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL?.trim() ||
        'Clouds <no-reply@cloudscommunity.com.br>',
      to: [email],
      subject: '✅ Senha alterada com sucesso — Clouds',
      text: `✅ Olá, ${displayName}! Sua senha foi alterada com sucesso. 🔒 Está tudo certo com a sua conta Clouds. Se não foi você, entre em contato com o suporte imediatamente.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>✅ Senha alterada!</h1><p>Olá, ${safeDisplayName}!</p><p>🔒 Sua senha foi redefinida com sucesso e está tudo certo com a sua conta Clouds.</p><p>Se você não fez essa alteração, entre em contato com o suporte imediatamente.</p></div>`,
    });
    if (error)
      throw new BadRequestException({
        message:
          'Senha alterada, mas não foi possível enviar o email de confirmação.',
      });
  }

  private hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private escapeHtml(value: string): string {
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

  async resolveSession(
    token: string | null,
  ): Promise<{ session: Session; user: UserWithProfile } | null> {
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

  private async mapUserWithStats(
    user: UserWithProfile,
  ): Promise<AuthUserPayload> {
    const profile = user.profile;

    if (!profile) {
      throw new Error('User profile is required.');
    }

    const userStats = await this.loadUserStats(user.id);

    return this.buildUserPayload(user, userStats);
  }

  private buildUserPayload(
    user: UserWithProfile,
    stats?: UserStats,
  ): AuthUserPayload {
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
      showHypesCount: profile.showHypesCount,
      showArchivedClouds: profile.showArchivedClouds,
      showParticipatingNow: profile.showParticipatingNow,
      interests: profile.interests,
      interestsCompletedAt: profile.interestsCompletedAt?.toISOString() ?? null,
      interestsOnboardingRequired: profile.interestsOnboardingRequired,
      status: user.status,
      isGuest: user.isGuest,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      followersCount: stats?.followersCount,
      followingCount: stats?.followingCount,
      cloudsCount: stats?.cloudsCount,
      hypesCount: stats?.hypesCount,
    };
  }

  private async loadUserStats(userId: string): Promise<UserStats> {
    const [
      followersCount,
      followingCount,
      cloudsCount,
      cloudHypes,
      referralCount,
    ] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
      this.prisma.cloud.count({
        where: { authorId: userId, deletedAt: null },
      }),
      this.prisma.cloudHype.count({
        where: { cloud: { authorId: userId, deletedAt: null } },
      }),
      this.prisma.invitationReferral.count({
        where: { inviterUserId: userId, creditedAt: { not: null } },
      }),
    ]);

    return {
      followersCount,
      followingCount,
      cloudsCount,
      hypesCount: cloudHypes + referralCount * 10,
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
