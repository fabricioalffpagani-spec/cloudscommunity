import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';

describe('invitation signup', () => {
  it('stores the valid inviter alongside the pending signup', async () => {
    const created = { id: 'new' };
    const tx = {
      user: { create: jest.fn().mockResolvedValue(created) },
      invitationReferral: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      invitationCode: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'inviter' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn: (value: typeof tx) => unknown) => fn(tx)),
    };
    const service = new AuthService(prisma as unknown as PrismaService);
    Object.defineProperty(service, 'sendVerificationEmail', {
      value: jest.fn().mockResolvedValue(undefined),
    });
    await service.signup(
      {
        email: 'new@example.com',
        name: 'New User',
        username: 'newuser',
        password: 'Pass123!',
        birthDate: '1990-01-01',
        acceptedTerms: true,
        acceptedCommunityRules: true,
        invitationCode: 'abc1234',
      },
      { ipAddress: null, userAgent: null },
    );
    expect(prisma.invitationCode.findUnique).toHaveBeenCalledWith({
      where: { code: 'ABC1234' },
    });
    expect(tx.invitationReferral.create).toHaveBeenCalledWith({
      data: { invitedUserId: 'new', inviterUserId: 'inviter' },
    });
  });

  it('accepts an invitation link shared before the code migration', async () => {
    const tx = {
      user: { create: jest.fn().mockResolvedValue({ id: 'new' }) },
      invitationReferral: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      invitationCode: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ userId: 'inviter' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn: (value: typeof tx) => unknown) => fn(tx)),
    };
    const service = new AuthService(prisma as unknown as PrismaService);
    Object.defineProperty(service, 'sendVerificationEmail', {
      value: jest.fn().mockResolvedValue(undefined),
    });

    await service.signup(
      {
        email: 'legacy@example.com',
        name: 'Legacy Invitee',
        username: 'legacyuser',
        password: 'Pass123!',
        birthDate: '1990-01-01',
        acceptedTerms: true,
        acceptedCommunityRules: true,
        invitationCode: 'abc1234',
      },
      { ipAddress: null, userAgent: null },
    );

    expect(prisma.invitationCode.findUnique).toHaveBeenNthCalledWith(2, {
      where: { legacyCode: 'ABC1234' },
    });
    expect(tx.invitationReferral.create).toHaveBeenCalledWith({
      data: { invitedUserId: 'new', inviterUserId: 'inviter' },
    });
  });

  it('rejects an unknown invitation code before creating an account', async () => {
    const prisma = {
      invitationCode: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new AuthService(prisma as unknown as PrismaService);
    await expect(
      service.signup(
        {
          email: 'new@example.com',
          name: 'New User',
          username: 'newuser',
          password: 'Pass123!',
          birthDate: '1990-01-01',
          acceptedTerms: true,
          acceptedCommunityRules: true,
          invitationCode: 'INVALID',
        },
        { ipAddress: null, userAgent: null },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('credits and notifies the inviter in the verification transaction only once', async () => {
    const now = new Date();
    const user = {
      id: 'new',
      email: 'new@example.com',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      profile: {
        username: 'newuser',
        displayName: 'Pessoa',
        birthDate: new Date('1990-01-01'),
        interests: [],
      },
    };
    let used = false;
    const tx = {
      emailVerificationToken: {
        updateMany: jest.fn(() => ({ count: used ? 0 : ((used = true), 1) })),
      },
      user: { update: jest.fn().mockResolvedValue(user) },
      invitationReferral: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ inviterUserId: 'inviter', creditedAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: {
        create: jest.fn(({ data }: { data: object }) => ({
          id: 'notification',
          ...data,
        })),
      },
    };
    const prisma = {
      emailVerificationToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'token',
          usedAt: null,
          expiresAt: new Date(Date.now() + 60000),
          user,
        }),
      },
      $transaction: jest.fn((fn: (value: typeof tx) => unknown) => fn(tx)),
    };
    const push = { send: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      push as unknown as PushNotificationsService,
    );
    jest.spyOn(service, 'createSession').mockResolvedValue({
      token: 'session',
      session: {
        id: 'session',
        createdAt: now,
        expiresAt: new Date(now.getTime() + 60000),
        revokedAt: null,
      },
    } as never);
    await service.verifyEmail('token', { ipAddress: null, userAgent: null });
    await expect(
      service.verifyEmail('token', { ipAddress: null, userAgent: null }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.invitationReferral.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        userId: 'inviter',
        body: 'Pessoa entrou no Clouds com seu convite! +10 hypes foram adicionados em seu perfil!',
      },
    });
    expect(push.send).toHaveBeenCalledTimes(1);
  });
});
