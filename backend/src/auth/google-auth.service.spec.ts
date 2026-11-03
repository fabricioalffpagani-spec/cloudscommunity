/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { createPasswordHash } from './auth.utils';

describe('GoogleAuthService', () => {
  const future = new Date(Date.now() + 60_000);
  const profile = {
    username: 'clouduser',
    displayName: 'Cloud User',
    birthDate: new Date('2000-01-01'),
  };
  const completeUser = {
    id: 'user-id',
    status: 'active',
    termsAcceptedAt: new Date('2026-01-01'),
    communityRulesAcceptedAt: new Date('2026-01-01'),
    profile,
  };
  let prisma: Record<string, unknown>;
  let authService: Record<string, jest.Mock>;
  let service: GoogleAuthService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI =
      'http://localhost:3000/api/auth/google/callback';
    process.env.APP_WEB_ORIGIN = 'http://localhost:3000';
    prisma = {
      googleOAuthState: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'state-id',
          intent: 'login',
          userId: null,
          returnTo: '/read',
          expiresAt: future,
          usedAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      externalIdentity: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      googlePendingAccount: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    authService = {
      createSession: jest.fn().mockResolvedValue({
        token: 'session-token',
        session: { expiresAt: future },
      }),
      requireRegisteredSession: jest.fn(),
    };
    service = new GoogleAuthService(prisma as never, authService as never);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id_token: 'verified-id-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-sub',
          email: 'person@gmail.com',
          email_verified: 'true',
          aud: 'google-client-id',
          iss: 'https://accounts.google.com',
          exp: String(Math.floor(Date.now() / 1000) + 600),
          name: 'Person',
        }),
      });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('logs an existing Google identity into the same local user without duplication', async () => {
    (
      prisma.externalIdentity as { findUnique: jest.Mock; update: jest.Mock }
    ).findUnique.mockResolvedValue({
      id: 'identity-id',
      userId: 'user-id',
      user: completeUser,
    });
    const result = await service.callback({
      state: 'state',
      cookieState: 'state',
      code: 'code',
      meta: { ipAddress: null, userAgent: null },
    });
    expect(result.sessionToken).toBe('session-token');
    expect(authService.createSession).toHaveBeenCalledWith(
      'user-id',
      expect.any(Object),
    );
    expect(
      (prisma.user as { findUnique: jest.Mock }).findUnique,
    ).not.toHaveBeenCalled();
  });

  it('creates a pending registration for a new verified Google user', async () => {
    (
      prisma.externalIdentity as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue(null);
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      null,
    );
    const result = await service.callback({
      state: 'state',
      cookieState: 'state',
      code: 'code',
      meta: { ipAddress: null, userAgent: null },
    });
    expect(result.pendingKind).toBe('REGISTER');
    expect(result.redirectTo).toContain('/google-onboarding');
    expect(
      (prisma.googlePendingAccount as { create: jest.Mock }).create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerAccountId: 'google-sub',
          kind: 'REGISTER',
        }),
      }),
    );
  });

  it('automatically links a verified Google identity to the complete password account with the same email', async () => {
    (
      prisma.externalIdentity as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue(null);
    (
      prisma.externalIdentity as { findFirst: jest.Mock }
    ).findFirst.mockResolvedValue(null);
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: 'local-user-id',
      email: 'person@gmail.com',
      passwordHash: createPasswordHash('Password1!'),
      status: 'active',
      deletedAt: null,
      isGuest: false,
      termsAcceptedAt: null,
      communityRulesAcceptedAt: null,
      profile,
    });
    const result = await service.callback({
      state: 'state',
      cookieState: 'state',
      code: 'code',
      meta: { ipAddress: null, userAgent: null },
    });
    expect(result.sessionToken).toBe('session-token');
    expect(result.redirectTo).toBe('http://localhost:3000/read');
    expect(result.pendingKind).toBeUndefined();
    expect(
      (prisma.externalIdentity as { create: jest.Mock }).create,
    ).toHaveBeenCalledWith({
      data: {
        userId: 'local-user-id',
        provider: 'GOOGLE',
        providerAccountId: 'google-sub',
        email: 'person@gmail.com',
      },
    });
    expect(authService.createSession).toHaveBeenCalledWith(
      'local-user-id',
      expect.any(Object),
    );
    expect(
      (prisma.googlePendingAccount as { create: jest.Mock }).create,
    ).not.toHaveBeenCalled();
  });

  it('does not auto-link when the local user already has another Google identity', async () => {
    (
      prisma.externalIdentity as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue(null);
    (
      prisma.externalIdentity as { findFirst: jest.Mock }
    ).findFirst.mockResolvedValue({
      userId: 'local-user-id',
      providerAccountId: 'different-google-sub',
    });
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      ...completeUser,
      passwordHash: createPasswordHash('Password1!'),
      deletedAt: null,
      isGuest: false,
    });

    await expect(
      service.callback({
        state: 'state',
        cookieState: 'state',
        code: 'code',
        meta: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      (prisma.externalIdentity as { create: jest.Mock }).create,
    ).not.toHaveBeenCalled();
    expect(authService.createSession).not.toHaveBeenCalled();
  });

  it('keeps a linked legacy password account out of Google onboarding on later logins', async () => {
    (
      prisma.externalIdentity as { findUnique: jest.Mock; update: jest.Mock }
    ).findUnique.mockResolvedValue({
      id: 'identity-id',
      userId: 'user-id',
      user: {
        ...completeUser,
        passwordHash: createPasswordHash('Password1!'),
        termsAcceptedAt: null,
        communityRulesAcceptedAt: null,
      },
    });

    const result = await service.callback({
      state: 'state',
      cookieState: 'state',
      code: 'code',
      meta: { ipAddress: null, userAgent: null },
    });

    expect(result.sessionToken).toBe('session-token');
    expect(result.redirectTo).toBe('http://localhost:3000/read');
    expect(result.pendingKind).toBeUndefined();
    expect(
      (prisma.googlePendingAccount as { create: jest.Mock }).create,
    ).not.toHaveBeenCalled();
  });

  it('does not auto-link a non-password local account', async () => {
    (
      prisma.externalIdentity as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue(null);
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      ...completeUser,
      passwordHash: null,
      deletedAt: null,
      isGuest: false,
    });

    await expect(
      service.callback({
        state: 'state',
        cookieState: 'state',
        code: 'code',
        meta: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(authService.createSession).not.toHaveBeenCalled();
  });

  it('does not auto-link when a concurrent request linked the Google identity to another user', async () => {
    (prisma.externalIdentity as { findUnique: jest.Mock }).findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 'other-user-id' });
    (
      prisma.externalIdentity as { findFirst: jest.Mock }
    ).findFirst.mockResolvedValue(null);
    (prisma.externalIdentity as { create: jest.Mock }).create.mockRejectedValue(
      { code: 'P2002' },
    );
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      ...completeUser,
      passwordHash: createPasswordHash('Password1!'),
      deletedAt: null,
      isGuest: false,
    });

    await expect(
      service.callback({
        state: 'state',
        cookieState: 'state',
        code: 'code',
        meta: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(authService.createSession).not.toHaveBeenCalled();
  });

  it('rejects an invalid state before exchanging the authorization code', async () => {
    await expect(
      service.callback({
        state: 'one',
        cookieState: 'other',
        code: 'code',
        meta: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a callback without a code', async () => {
    await expect(
      service.callback({
        state: 'state',
        cookieState: 'state',
        meta: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unverified email when it would be used for account matching', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id_token: 'verified-id-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-sub',
          email: 'person@gmail.com',
          email_verified: 'false',
          aud: 'google-client-id',
          iss: 'accounts.google.com',
          exp: String(Math.floor(Date.now() / 1000) + 600),
        }),
      });
    (
      prisma.externalIdentity as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue(null);
    await expect(
      service.callback({
        state: 'state',
        cookieState: 'state',
        code: 'code',
        meta: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects linking a Google sub that belongs to another user', async () => {
    (
      prisma.googleOAuthState as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue({
      id: 'state-id',
      intent: 'link',
      userId: 'current-user',
      returnTo: '/settings',
      expiresAt: future,
      usedAt: null,
    });
    (
      prisma.externalIdentity as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue({
      id: 'identity-id',
      userId: 'other-user',
      user: { ...completeUser, id: 'other-user' },
    });
    await expect(
      service.callback({
        state: 'state',
        cookieState: 'state',
        code: 'code',
        meta: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a passwordless user, identity and regular Clouds session after onboarding', async () => {
    (
      prisma.googlePendingAccount as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue({
      id: 'pending-id',
      kind: 'REGISTER',
      consumedAt: null,
      expiresAt: future,
      email: 'person@gmail.com',
      displayName: 'Person',
      avatarUrl: null,
      providerAccountId: 'google-sub',
      returnTo: '/read',
      userId: null,
    });
    const tx = {
      googlePendingAccount: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'new-user-id' }),
      },
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    prisma.$transaction = jest.fn(
      async (operation: (client: typeof tx) => unknown) => operation(tx),
    );
    const result = await service.completeRegistration(
      'pending-token',
      {
        name: 'Person',
        username: 'person_1',
        birthDate: '2000-01-01',
        acceptedTerms: true,
        acceptedCommunityRules: true,
      },
      { ipAddress: null, userAgent: null },
    );
    expect(result.returnTo).toBe('/read');
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: null,
          externalIdentities: {
            create: expect.objectContaining({
              providerAccountId: 'google-sub',
            }),
          },
        }),
      }),
    );
    expect(authService.createSession).toHaveBeenCalledWith(
      'new-user-id',
      expect.any(Object),
    );
  });

  it('routes an existing incomplete Google user back to completion without creating a duplicate', async () => {
    (
      prisma.externalIdentity as { findUnique: jest.Mock; update: jest.Mock }
    ).findUnique.mockResolvedValue({
      id: 'identity-id',
      userId: 'user-id',
      user: {
        ...completeUser,
        termsAcceptedAt: null,
        communityRulesAcceptedAt: null,
      },
    });

    const result = await service.callback({
      state: 'state',
      cookieState: 'state',
      code: 'code',
      meta: { ipAddress: null, userAgent: null },
    });

    expect(result.pendingKind).toBe('COMPLETE');
    expect(result.redirectTo).toContain('/google-onboarding');
    expect(authService.createSession).not.toHaveBeenCalled();
    expect(
      (prisma.googlePendingAccount as { create: jest.Mock }).create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'COMPLETE',
          userId: 'user-id',
        }),
      }),
    );
  });

  it('completes a recent incomplete Google user in place and preserves its user id', async () => {
    (
      prisma.googlePendingAccount as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue({
      id: 'pending-id',
      kind: 'COMPLETE',
      consumedAt: null,
      expiresAt: future,
      email: 'person@gmail.com',
      displayName: 'Person',
      avatarUrl: null,
      providerAccountId: 'google-sub',
      returnTo: '/read',
      userId: 'user-id',
    });
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      ...completeUser,
      termsAcceptedAt: null,
      communityRulesAcceptedAt: null,
    });
    const tx = {
      googlePendingAccount: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-id' }),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user-id' }),
      },
    };
    prisma.$transaction = jest.fn(
      async (operation: (client: typeof tx) => unknown) => operation(tx),
    );

    const result = await service.completeRegistration(
      'pending-token',
      {
        acceptedTerms: true,
        acceptedCommunityRules: true,
      },
      { ipAddress: null, userAgent: null },
    );

    expect(result.returnTo).toBe('/read');
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-id' } }),
    );
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(authService.createSession).toHaveBeenCalledWith(
      'user-id',
      expect.any(Object),
    );
  });

  it('links an existing password account only after password proof and keeps its user id', async () => {
    (
      prisma.googlePendingAccount as { findUnique: jest.Mock }
    ).findUnique.mockResolvedValue({
      id: 'pending-id',
      kind: 'LINK',
      consumedAt: null,
      expiresAt: future,
      email: 'person@gmail.com',
      providerAccountId: 'google-sub',
      returnTo: '/meet',
      userId: 'local-user-id',
    });
    (prisma.user as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: 'local-user-id',
      passwordHash: createPasswordHash('Password1!'),
      profile,
    });
    const tx = {
      googlePendingAccount: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      externalIdentity: {
        create: jest.fn().mockResolvedValue({ id: 'identity-id' }),
      },
    };
    prisma.$transaction = jest.fn(
      async (operation: (client: typeof tx) => unknown) => operation(tx),
    );
    const result = await service.completeLink('pending-token', 'Password1!', {
      ipAddress: null,
      userAgent: null,
    });
    expect(result.returnTo).toBe('/meet');
    expect(tx.externalIdentity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'local-user-id',
        providerAccountId: 'google-sub',
      }),
    });
    expect(authService.createSession).toHaveBeenCalledWith(
      'local-user-id',
      expect.any(Object),
    );
  });

  it('treats OAuth cancellation as a consumed state and does not exchange a token', async () => {
    const result = await service.callback({
      state: 'state',
      cookieState: 'state',
      error: 'access_denied',
      meta: { ipAddress: null, userAgent: null },
    });
    expect(result.redirectTo).toContain('googleError=access_denied');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a token rejected by Google validation', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'invalid_grant' }),
    });
    await expect(
      service.callback({
        state: 'state',
        cookieState: 'state',
        code: 'bad-code',
        meta: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
