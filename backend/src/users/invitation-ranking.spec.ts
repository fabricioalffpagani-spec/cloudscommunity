import { UsersService } from './users.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';

describe('invitation ranking', () => {
  it('adds ten points per confirmed invitation to lifetime Cloud hypes', async () => {
    const prisma = {
      cloudHype: { findMany: jest.fn().mockResolvedValue([{ cloud: { authorId: 'cloud-author' } }, { cloud: { authorId: 'cloud-author' } }]) },
      invitationReferral: { groupBy: jest.fn().mockResolvedValue([{ inviterUserId: 'inviter', _count: { _all: 1 } }]) },
      follow: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn(({ where }: { where: { id: { in?: string[] } } }) => (where.id.in ?? []).map((id) => ({ id, profile: {} }))) },
    };
    const auth = { resolveSession: jest.fn().mockResolvedValue({ user: { id: 'viewer' } }) };
    const service = new UsersService(prisma as unknown as PrismaService, auth as unknown as AuthService, {} as PushNotificationsService, {} as DirectMessagesGateway);
    Object.defineProperty(service, 'mapPublicProfile', { value: (user: { id: string }) => Promise.resolve({ id: user.id }) });
    const result = await service.meet('token');
    expect(result.popularAllTime.map((entry) => [entry.id, entry.hypes])).toEqual([['inviter', 10], ['cloud-author', 2]]);
  });
});
