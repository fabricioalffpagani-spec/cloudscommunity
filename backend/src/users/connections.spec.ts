import { UsersService } from './users.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';

describe('feed connections', () => {
  it('returns followers and followed users once, without the viewer', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { followerId: 'viewer', followingId: 'friend' },
      { followerId: 'friend', followingId: 'viewer' },
      { followerId: 'follower', followingId: 'viewer' },
    ]);
    const service = new UsersService({ follow: { findMany } } as unknown as PrismaService, { resolveSession: jest.fn().mockResolvedValue({ user: { id: 'viewer' } }) } as unknown as AuthService, {} as PushNotificationsService, {} as DirectMessagesGateway);
    await expect(service.getConnectionIds('token')).resolves.toEqual({ ok: true, userIds: ['friend', 'follower'] });
    expect(findMany).toHaveBeenCalledWith({ where: { OR: [{ followerId: 'viewer' }, { followingId: 'viewer' }] }, select: { followerId: true, followingId: true } });
  });
});
