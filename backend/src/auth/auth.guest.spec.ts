import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

function guestUser() {
  const now = new Date('2026-10-30T12:00:00.000Z');
  return {
    id: 'guest-1',
    email: 'userguest@guest.invalid',
    passwordHash: 'hash',
    status: 'active',
    emailVerifiedAt: null,
    termsAcceptedAt: null,
    communityRulesAcceptedAt: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    isGuest: true,
    guestIpAddress: '203.0.113.10',
    profile: {
      userId: 'guest-1',
      username: 'userguest',
      displayName: 'userguest',
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
      interestsCompletedAt: null,
      interestsOnboardingRequired: false,
      createdAt: now,
      updatedAt: now,
    },
  };
}

describe('guest authentication', () => {
  it('reuses the same guest identity for the same IP address', async () => {
    const user = guestUser();
    const upsert = jest.fn().mockResolvedValue(user);
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const createSession = jest.fn().mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      refreshTokenHash: 'token-hash',
      deviceName: 'Browser',
      ipAddress: user.guestIpAddress,
      userAgent: 'test',
      expiresAt: new Date('2026-11-29T12:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-10-30T12:00:00.000Z'),
    });
    const service = new AuthService({
      user: { upsert },
      session: { deleteMany, create: createSession },
    } as unknown as PrismaService);

    await service.createGuest({
      ipAddress: user.guestIpAddress,
      userAgent: 'test',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { guestIpAddress: user.guestIpAddress },
      }),
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lte: expect.any(Date) as Date } },
          { revokedAt: { not: null } },
        ],
      },
    });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's asymmetric matcher is intentionally dynamic here.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          userId: user.id,
          ipAddress: user.guestIpAddress,
        }),
      }),
    );
  });

  it('rejects registered-only operations for a guest session', async () => {
    const service = new AuthService({} as PrismaService);
    jest.spyOn(service, 'resolveSession').mockResolvedValue({
      user: { id: 'guest-1', isGuest: true },
      session: { id: 'session-1' },
    } as never);

    await expect(
      service.requireRegisteredSession('guest-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
