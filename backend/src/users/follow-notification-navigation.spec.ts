import { UsersService } from './users.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { DirectMessagesGateway } from '../direct-messages/direct-messages.gateway';

it('sends follower notifications to the profile notifications panel', async () => {
  const send = jest.fn().mockResolvedValue(undefined);
  const service = new UsersService(
    {
      follow: { upsert: jest.fn() },
      followRequest: { deleteMany: jest.fn() },
      notification: {
        deleteMany: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'notification',
          title: 'Novo seguidor',
          body: 'Ana começou a seguir você',
        }),
      },
    } as unknown as PrismaService,
    {} as AuthService,
    { send } as unknown as PushNotificationsService,
    {} as DirectMessagesGateway,
  );
  await (
    service as unknown as {
      createFollow: (a: string, b: string, c: string) => Promise<void>;
    }
  ).createFollow('follower', 'recipient', 'Ana');
  expect(send).toHaveBeenCalledWith(
    'recipient',
    expect.objectContaining({ url: '/profile?notifications=1' }),
  );
});
