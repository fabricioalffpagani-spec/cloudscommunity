import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from './auth.service';
import {
  normalizeEmail,
  normalizeName,
  parseBirthDate,
  validateMinimumAge,
  validateUsername,
  verifyPassword,
} from './auth.utils';

type RequestMeta = { ipAddress: string | null; userAgent: string | null };
type GoogleClaims = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: string | number;
};

export type GoogleCallbackResult = {
  redirectTo: string;
  sessionToken?: string;
  sessionExpiresAt?: Date;
  pendingToken?: string;
  pendingKind?: 'REGISTER' | 'LINK' | 'COMPLETE';
};

type RequiredRegistrationField = 'name' | 'username' | 'birthDate' | 'terms';

const STATE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async start(
    returnToInput: string | undefined,
    intentInput: string | undefined,
    sessionToken: string | null,
  ): Promise<{ authorizationUrl: string; state: string }> {
    const config = this.config();
    const intent = intentInput === 'link' ? 'link' : 'login';
    const current =
      intent === 'link'
        ? await this.authService.requireRegisteredSession(sessionToken)
        : null;
    const state = randomBytes(32).toString('base64url');

    await this.prisma.googleOAuthState.create({
      data: {
        stateHash: this.hash(state),
        intent,
        userId: current?.user.id,
        returnTo: this.safeReturnTo(returnToInput),
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  async callback(input: {
    state?: string;
    cookieState?: string;
    code?: string;
    error?: string;
    meta: RequestMeta;
  }): Promise<GoogleCallbackResult> {
    const webOrigin = this.webOrigin();
    if (
      !input.state ||
      !input.cookieState ||
      input.state !== input.cookieState
    ) {
      throw new BadRequestException('State OAuth inválido ou expirado.');
    }
    const oauthState = await this.consumeState(input.state);
    if (input.error) {
      return {
        redirectTo: `${webOrigin}/login?googleError=${encodeURIComponent(input.error)}`,
      };
    }
    if (!input.code)
      throw new BadRequestException('Callback Google sem código.');

    const claims = await this.exchangeAndValidateCode(input.code);
    if (!claims.email_verified) {
      throw new BadRequestException(
        'O Google não confirmou este endereço de email.',
      );
    }
    const identity = await this.prisma.externalIdentity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId: claims.sub,
        },
      },
      include: { user: { include: { profile: true } } },
    });

    if (identity) {
      if (
        oauthState.intent === 'link' &&
        oauthState.userId !== identity.userId
      ) {
        throw new ConflictException(
          'Esta conta Google já está vinculada a outro usuário.',
        );
      }
      if (identity.user.status !== 'active') {
        throw new UnauthorizedException('Conta indisponível.');
      }
      await this.prisma.externalIdentity.update({
        where: { id: identity.id },
        data: { email: claims.email },
      });
      const missingFields = identity.user.passwordHash
        ? []
        : this.missingRequiredFields(identity.user);
      if (missingFields.length > 0) {
        const pendingToken = await this.createPending({
          kind: 'COMPLETE',
          userId: identity.userId,
          claims,
          returnTo: oauthState.returnTo,
        });
        return {
          redirectTo: `${webOrigin}/google-onboarding?returnTo=${encodeURIComponent(oauthState.returnTo)}`,
          pendingToken,
          pendingKind: 'COMPLETE',
        };
      }
      const session = await this.authService.createSession(
        identity.userId,
        input.meta,
      );
      return {
        redirectTo: `${webOrigin}${oauthState.returnTo}`,
        sessionToken: session.token,
        sessionExpiresAt: session.session.expiresAt,
      };
    }

    if (oauthState.intent === 'link') {
      if (!oauthState.userId)
        throw new UnauthorizedException('Sessão de vinculação inválida.');
      await this.prisma.externalIdentity.create({
        data: {
          userId: oauthState.userId,
          provider: 'GOOGLE',
          providerAccountId: claims.sub,
          email: claims.email,
        },
      });
      return { redirectTo: `${webOrigin}/settings?google=linked` };
    }

    const localUser = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(claims.email) },
      include: { profile: true },
    });
    if (localUser) {
      if (
        localUser.status !== 'active' ||
        localUser.deletedAt ||
        localUser.isGuest ||
        !localUser.passwordHash ||
        !localUser.profile
      ) {
        throw new ConflictException(
          'A conta existente não pode ser vinculada automaticamente.',
        );
      }

      const userGoogleIdentity = await this.prisma.externalIdentity.findFirst({
        where: { userId: localUser.id, provider: 'GOOGLE' },
      });
      if (
        userGoogleIdentity &&
        userGoogleIdentity.providerAccountId !== claims.sub
      ) {
        throw new ConflictException(
          'Esta conta já possui outra identidade Google vinculada.',
        );
      }

      if (!userGoogleIdentity) {
        try {
          await this.prisma.externalIdentity.create({
            data: {
              userId: localUser.id,
              provider: 'GOOGLE',
              providerAccountId: claims.sub,
              email: claims.email,
            },
          });
        } catch (error) {
          if (!this.isUniqueConstraintError(error)) throw error;
          const concurrentIdentity =
            await this.prisma.externalIdentity.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'GOOGLE',
                  providerAccountId: claims.sub,
                },
              },
            });
          if (concurrentIdentity?.userId !== localUser.id) {
            throw new ConflictException(
              'Esta conta Google já está vinculada a outro usuário.',
            );
          }
        }
      }

      const session = await this.authService.createSession(
        localUser.id,
        input.meta,
      );
      return {
        redirectTo: `${webOrigin}${oauthState.returnTo}`,
        sessionToken: session.token,
        sessionExpiresAt: session.session.expiresAt,
      };
    }

    const pendingToken = await this.createPending({
      kind: 'REGISTER',
      claims,
      returnTo: oauthState.returnTo,
    });

    return {
      redirectTo: `${webOrigin}/google-onboarding?returnTo=${encodeURIComponent(oauthState.returnTo)}`,
      pendingToken,
      pendingKind: 'REGISTER',
    };
  }

  async completeRegistration(
    pendingToken: string | null,
    input: {
      name?: string;
      username?: string;
      birthDate?: string;
      acceptedTerms?: boolean;
      acceptedCommunityRules?: boolean;
    },
    meta: RequestMeta,
  ) {
    const pending = await this.requireRegistrationPending(pendingToken);
    const existingUser = pending.userId
      ? await this.prisma.user.findUnique({
          where: { id: pending.userId },
          include: { profile: true },
        })
      : null;
    if (pending.kind === 'COMPLETE' && !existingUser) {
      throw new BadRequestException('Conta Google não encontrada.');
    }
    const missingFields =
      pending.kind === 'COMPLETE'
        ? this.missingRequiredFields(existingUser!)
        : this.missingFieldsForNewRegistration(pending.displayName);
    if (
      missingFields.includes('terms') &&
      (!input.acceptedTerms || !input.acceptedCommunityRules)
    ) {
      throw new BadRequestException(
        'Aceite os Termos de Uso e as Regras da Comunidade.',
      );
    }
    const displayName = normalizeName(
      missingFields.includes('name')
        ? input.name || pending.displayName || ''
        : existingUser?.profile?.displayName || pending.displayName || '',
    );
    if (!displayName) throw new BadRequestException('Informe seu nome.');
    const username = validateUsername(
      missingFields.includes('username')
        ? input.username || ''
        : existingUser?.profile?.username || input.username || '',
    );
    const birthDate = missingFields.includes('birthDate')
      ? parseBirthDate(input.birthDate ?? '')
      : existingUser?.profile?.birthDate ||
        parseBirthDate(input.birthDate ?? '');
    validateMinimumAge(birthDate);

    const user = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.googlePendingAccount.updateMany({
        where: {
          id: pending.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new BadRequestException(
          'Cadastro Google expirado ou já utilizado.',
        );
      const existingUsername = await tx.profile.findUnique({
        where: { username },
        select: { userId: true },
      });
      if (existingUsername && existingUsername.userId !== pending.userId)
        throw new ConflictException('Este nome de usuário já está em uso.');

      if (pending.kind === 'COMPLETE') {
        if (!pending.userId)
          throw new BadRequestException('Conta Google não encontrada.');
        const now = new Date();
        return tx.user.update({
          where: { id: pending.userId },
          data: {
            emailVerifiedAt: existingUser?.emailVerifiedAt ?? now,
            termsAcceptedAt: existingUser?.termsAcceptedAt ?? now,
            communityRulesAcceptedAt:
              existingUser?.communityRulesAcceptedAt ?? now,
            profile: existingUser?.profile
              ? {
                  update: {
                    username,
                    displayName,
                    birthDate,
                  },
                }
              : {
                  create: {
                    username,
                    displayName,
                    birthDate,
                    avatarUrl: pending.avatarUrl,
                    interestsOnboardingRequired: true,
                  },
                },
          },
        });
      }

      const existingEmail = await tx.user.findUnique({
        where: { email: pending.email },
        select: { id: true },
      });
      if (existingEmail)
        throw new ConflictException(
          'Já existe uma conta Clouds Community com este email.',
        );
      return tx.user.create({
        data: {
          email: pending.email,
          passwordHash: null,
          status: 'active',
          emailVerifiedAt: new Date(),
          termsAcceptedAt: new Date(),
          communityRulesAcceptedAt: new Date(),
          profile: {
            create: {
              username,
              displayName,
              birthDate,
              avatarUrl: pending.avatarUrl,
              interestsOnboardingRequired: true,
            },
          },
          externalIdentities: {
            create: {
              provider: 'GOOGLE',
              providerAccountId: pending.providerAccountId,
              email: pending.email,
            },
          },
        },
      });
    });
    const session = await this.authService.createSession(user.id, meta);
    return {
      ok: true as const,
      returnTo: pending.returnTo,
      token: session.token,
      expiresAt: session.session.expiresAt,
    };
  }

  async pendingRegistration(pendingToken: string | null) {
    const pending = await this.requireRegistrationPending(pendingToken);
    const existingUser = pending.userId
      ? await this.prisma.user.findUnique({
          where: { id: pending.userId },
          include: { profile: true },
        })
      : null;
    if (pending.kind === 'COMPLETE' && !existingUser) {
      throw new BadRequestException('Conta Google não encontrada.');
    }
    const missingFields =
      pending.kind === 'COMPLETE'
        ? this.missingRequiredFields(existingUser!)
        : this.missingFieldsForNewRegistration(pending.displayName);
    return {
      ok: true as const,
      email: pending.email,
      displayName:
        existingUser?.profile?.displayName || pending.displayName || null,
      username: existingUser?.profile?.username || null,
      birthDate: existingUser?.profile?.birthDate
        ? existingUser.profile.birthDate.toISOString().slice(0, 10)
        : null,
      missingFields,
      completingExistingAccount: pending.kind === 'COMPLETE',
    };
  }

  async completeLink(
    pendingToken: string | null,
    password: string | undefined,
    meta: RequestMeta,
  ) {
    const pending = await this.requirePending(pendingToken, 'LINK');
    if (!pending.userId) throw new BadRequestException('Vinculação inválida.');
    const user = await this.prisma.user.findUnique({
      where: { id: pending.userId },
      include: { profile: true },
    });
    if (
      !user?.profile ||
      !user.passwordHash ||
      !verifyPassword(password ?? '', user.passwordHash)
    ) {
      throw new UnauthorizedException({
        message: 'Confirme a senha atual da conta para vincular o Google.',
        fieldErrors: { password: 'Senha atual incorreta.' },
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.googlePendingAccount.updateMany({
        where: {
          id: pending.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new BadRequestException('Vinculação expirada ou já utilizada.');
      await tx.externalIdentity.create({
        data: {
          userId: user.id,
          provider: 'GOOGLE',
          providerAccountId: pending.providerAccountId,
          email: pending.email,
        },
      });
    });
    const session = await this.authService.createSession(user.id, meta);
    return {
      ok: true as const,
      returnTo: pending.returnTo,
      token: session.token,
      expiresAt: session.session.expiresAt,
    };
  }

  async status(sessionToken: string | null) {
    const current =
      await this.authService.requireRegisteredSession(sessionToken);
    const identities = await this.prisma.externalIdentity.findMany({
      where: { userId: current.user.id },
      select: { provider: true, email: true },
    });
    return {
      ok: true as const,
      google:
        identities.find((identity) => identity.provider === 'GOOGLE') ?? null,
      hasPassword: Boolean(current.user.passwordHash),
    };
  }

  async unlink(sessionToken: string | null) {
    const current =
      await this.authService.requireRegisteredSession(sessionToken);
    const identities = await this.prisma.externalIdentity.findMany({
      where: { userId: current.user.id },
    });
    const google = identities.find(
      (identity) => identity.provider === 'GOOGLE',
    );
    if (!google) return { ok: true as const };
    if (!current.user.passwordHash && identities.length <= 1) {
      throw new BadRequestException(
        'Defina outra forma de login antes de desvincular o Google.',
      );
    }
    await this.prisma.externalIdentity.delete({ where: { id: google.id } });
    return { ok: true as const };
  }

  private async consumeState(rawState: string) {
    const state = await this.prisma.googleOAuthState.findUnique({
      where: { stateHash: this.hash(rawState) },
    });
    if (!state || state.usedAt || state.expiresAt <= new Date()) {
      throw new BadRequestException('State OAuth inválido ou expirado.');
    }
    const claimed = await this.prisma.googleOAuthState.updateMany({
      where: { id: state.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1)
      throw new BadRequestException('Callback OAuth já utilizado.');
    return state;
  }

  private async exchangeAndValidateCode(code: string): Promise<GoogleClaims> {
    const config = this.config();
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenPayload = (await tokenResponse.json().catch(() => null)) as {
      id_token?: string;
    } | null;
    if (!tokenResponse.ok || !tokenPayload?.id_token)
      throw new UnauthorizedException('Código Google inválido.');

    const verifyResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenPayload.id_token)}`,
      { headers: { accept: 'application/json' } },
    );
    const claims = (await verifyResponse
      .json()
      .catch(() => null)) as GoogleClaims | null;
    const validIssuer =
      claims?.iss === 'https://accounts.google.com' ||
      claims?.iss === 'accounts.google.com';
    const expiry = Number(claims?.exp ?? 0);
    if (
      !verifyResponse.ok ||
      !claims?.sub ||
      !claims.email ||
      claims.aud !== config.clientId ||
      !validIssuer ||
      !Number.isFinite(expiry) ||
      expiry * 1000 <= Date.now()
    ) {
      throw new UnauthorizedException('Token de identidade Google inválido.');
    }
    return {
      ...claims,
      email: normalizeEmail(claims.email),
      email_verified:
        claims.email_verified === true ||
        String(claims.email_verified) === 'true',
    };
  }

  private async createPending(input: {
    kind: 'REGISTER' | 'LINK' | 'COMPLETE';
    userId?: string;
    claims: GoogleClaims;
    returnTo: string;
  }) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.googlePendingAccount.create({
      data: {
        tokenHash: this.hash(token),
        kind: input.kind,
        userId: input.userId,
        providerAccountId: input.claims.sub,
        email: input.claims.email,
        emailVerified: input.claims.email_verified,
        displayName: input.claims.name?.slice(0, 120),
        avatarUrl: input.claims.picture,
        returnTo: input.returnTo,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS),
      },
    });
    return token;
  }

  private async requirePending(
    token: string | null,
    kind: 'REGISTER' | 'LINK' | 'COMPLETE',
  ) {
    if (!token)
      throw new BadRequestException('Fluxo Google não encontrado ou expirado.');
    const pending = await this.prisma.googlePendingAccount.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (
      !pending ||
      pending.kind !== kind ||
      pending.consumedAt ||
      pending.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Fluxo Google não encontrado ou expirado.');
    }
    return pending;
  }

  private async requireRegistrationPending(token: string | null) {
    if (!token)
      throw new BadRequestException('Fluxo Google não encontrado ou expirado.');
    const pending = await this.prisma.googlePendingAccount.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (
      !pending ||
      (pending.kind !== 'REGISTER' && pending.kind !== 'COMPLETE') ||
      pending.consumedAt ||
      pending.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Fluxo Google não encontrado ou expirado.');
    }
    return pending;
  }

  private missingFieldsForNewRegistration(
    googleDisplayName: string | null | undefined,
  ): RequiredRegistrationField[] {
    return [
      ...(normalizeName(googleDisplayName || '') ? [] : (['name'] as const)),
      'username',
      'birthDate',
      'terms',
    ];
  }

  private missingRequiredFields(user: {
    termsAcceptedAt: Date | null;
    communityRulesAcceptedAt: Date | null;
    profile: {
      username: string;
      displayName: string;
      birthDate: Date;
    } | null;
  }): RequiredRegistrationField[] {
    const missing: RequiredRegistrationField[] = [];
    if (!normalizeName(user.profile?.displayName || '')) missing.push('name');
    try {
      validateUsername(user.profile?.username || '');
    } catch {
      missing.push('username');
    }
    try {
      if (!user.profile?.birthDate) throw new Error('missing birth date');
      validateMinimumAge(user.profile.birthDate);
    } catch {
      missing.push('birthDate');
    }
    if (!user.termsAcceptedAt || !user.communityRulesAcceptedAt) {
      missing.push('terms');
    }
    return missing;
  }

  private safeReturnTo(value?: string) {
    if (
      !value ||
      value.length > 512 ||
      !value.startsWith('/') ||
      value.startsWith('//')
    )
      return '/';
    const pathname = value.split('?')[0];
    const allowed = [
      '/',
      '/read',
      '/meet',
      '/profile',
      '/settings',
      '/messages',
      '/notifications',
      '/following',
      '/trending',
    ];
    if (
      allowed.includes(pathname) ||
      /^\/(cloud|users|trending)\/[A-Za-z0-9_.~%-]+(?:\/conversation)?$/.test(
        pathname,
      )
    )
      return value;
    return '/';
  }

  private config() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret)
      throw new BadRequestException(
        'Login com Google ainda não foi configurado.',
      );
    return {
      clientId,
      clientSecret,
      redirectUri:
        process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
        `${this.webOrigin()}/api/auth/google/callback`,
    };
  }

  private webOrigin() {
    return (process.env.APP_WEB_ORIGIN ?? 'http://localhost:3000')
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
