import { UsersService } from './users.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';

describe('invitation previews', () => {
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
});
