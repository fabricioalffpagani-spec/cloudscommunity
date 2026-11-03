import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from './auth.service';
import { createPasswordHash } from './auth.utils';

describe('password and Google authentication coexistence', () => {
  it('keeps password login working for the same user after Google is linked', async () => {
    const now = new Date('2026-11-03T12:00:00.000Z');
    const user = {
      id: 'user-id',
      email: 'person@gmail.com',
      passwordHash: createPasswordHash('Password1!'),
      status: 'active',
      emailVerifiedAt: now,
      termsAcceptedAt: now,
      communityRulesAcceptedAt: now,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      isGuest: false,
      guestIpAddress: null,
      profile: {
        userId: 'user-id',
        username: 'person_1',
        displayName: 'Person',
        birthDate: new Date('2000-01-01T00:00:00.000Z'),
        bio: null,
        avatarUrl: null,
        coverUrl: null,
        location: null,
        website: null,
        isPrivate: false,
        showHypesCount: true,
        showArchivedClouds: true,
        showParticipatingNow: true,
        interests: [],
        interestsCompletedAt: now,
        interestsOnboardingRequired: false,
        createdAt: now,
        updatedAt: now,
      },
      externalIdentities: [
        {
          provider: 'GOOGLE',
          providerAccountId: 'google-sub',
        },
      ],
    };
    const update = jest.fn().mockResolvedValue(user);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user), update },
      profile: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new AuthService(prisma);
    const session = {
      id: 'session-id',
      userId: user.id,
      refreshTokenHash: 'token-hash',
      deviceName: 'Browser',
      ipAddress: null,
      userAgent: 'test',
      expiresAt: new Date('2026-12-03T12:00:00.000Z'),
      revokedAt: null,
      createdAt: now,
    };
    const createSession = jest
      .spyOn(service, 'createSession')
      .mockResolvedValue({
        token: 'session-token',
        session,
      });

    const result = await service.login(
      {
        identifier: 'person@gmail.com',
        password: 'Password1!',
      },
      { ipAddress: null, userAgent: 'test' },
    );

    expect(result.ok).toBe(true);
    expect(result.user.id).toBe('user-id');
    expect(result.token).toBe('session-token');
    expect(createSession).toHaveBeenCalledWith(
      'user-id',
      expect.any(Object),
      false,
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { lastLoginAt: expect.any(Date) as Date },
    });
  });
});
