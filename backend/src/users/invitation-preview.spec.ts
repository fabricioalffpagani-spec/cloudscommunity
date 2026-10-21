import { UsersService } from './users.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';

describe('invitation previews', () => {
  it('generates new codes with four letters and three digits', async () => {
    const prisma = {
      invitationCode: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      {} as AuthService,
      {} as PushNotificationsService,
      {} as DirectMessagesGateway,
    );
    jest.spyOn(service as any, 'requireSession').mockResolvedValue({
      user: { id: 'sender', profile: { username: 'ana_17' } },
    });
    const result = await service.sendInvite('session', '');
    expect(result.code).toMatch(/^ANAX[0-9]{3}$/);
    expect(result.inviteUrl).toContain(`ref=${result.code}`);
  });

  it('skips a new code already reserved by an old invitation link', async () => {
    const prisma = {
      invitationCode: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ userId: 'previous-inviter' })
          .mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      {} as AuthService,
      {} as PushNotificationsService,
      {} as DirectMessagesGateway,
    );
    jest.spyOn(service as any, 'requireSession').mockResolvedValue({
      user: { id: 'sender', profile: { username: 'ana' } },
    });

    const result = await service.sendInvite('session', '');

    expect(result.code).toMatch(/^ANAX[0-9]{3}$/);
    expect(prisma.invitationCode.findUnique).toHaveBeenCalledTimes(3);
    expect(prisma.invitationCode.create).toHaveBeenCalledTimes(1);
  });

  it('returns only the profile belonging to the invitation code', async () => {
    const prisma = {
      invitationCode: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'sender' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          profile: {
            displayName: 'Ana',
            username: 'ana',
            avatarUrl: 'data:image/png;base64,abc',
          },
        }),
      },
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      {} as AuthService,
      {} as PushNotificationsService,
      {} as DirectMessagesGateway,
    );
    expect(await service.invitationPreview('ana1234')).toEqual({
      ok: true,
      profile: {
        displayName: 'Ana',
        username: 'ana',
        avatarUrl: 'data:image/png;base64,abc',
      },
    });
    expect(prisma.invitationCode.findUnique).toHaveBeenCalledWith({
      where: { code: 'ANA1234' },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sender' } }),
    );
    expect(await service.invitationPreview('../other')).toEqual({ ok: false });
  });

  it('still previews a previously shared invitation code after migration', async () => {
    const prisma = {
      invitationCode: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ userId: 'sender' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          profile: { displayName: 'Ana', username: 'ana', avatarUrl: null },
        }),
      },
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      {} as AuthService,
      {} as PushNotificationsService,
      {} as DirectMessagesGateway,
    );

    expect(await service.invitationPreview('ana1234')).toMatchObject({
      ok: true,
    });
    expect(prisma.invitationCode.findUnique).toHaveBeenNthCalledWith(2, {
      where: { legacyCode: 'ANA1234' },
    });
  });
});
