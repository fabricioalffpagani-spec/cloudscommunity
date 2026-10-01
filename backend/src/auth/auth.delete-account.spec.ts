import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

describe('account deletion', () => {
  it('deletes only the user resolved from the session', async () => {
    const userDelete = jest.fn().mockResolvedValue({ id: 'user-1' });
    const service = new AuthService({
      user: { delete: userDelete },
    } as unknown as PrismaService);
    jest
      .spyOn(service, 'resolveSession')
      .mockResolvedValue({ user: { id: 'user-1' } } as never);

    await service.deleteAccount('session-token');

    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('does not delete an account without a valid session', async () => {
    const userDelete = jest.fn();
    const service = new AuthService({
      user: { delete: userDelete },
    } as unknown as PrismaService);
    jest.spyOn(service, 'resolveSession').mockResolvedValue(null);

    await expect(service.deleteAccount(null)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(userDelete).not.toHaveBeenCalled();
  });
});
