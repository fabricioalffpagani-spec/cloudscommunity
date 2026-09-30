import { CloudController } from './cloud.controller';

describe('CloudController', () => {
  it('forwards selected private-cloud invitees to the creation service', async () => {
    const cloudService = {
      create: jest.fn().mockResolvedValue({
        ok: true,
        cloud: { id: 'cloud-id' },
        leftCloudIds: [],
      }),
    };
    const controller = new CloudController(
      cloudService as never,
      {} as never,
      {} as never,
    );

    await controller.create(
      {
        title: 'Cloud privada',
        duration: '30min',
        visibility: 'private',
        invitedUserIds: ['member-a', 12, '', 'member-b'],
      },
      { headers: { cookie: '' } } as never,
    );

    expect(cloudService.create).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        title: 'Cloud privada',
        duration: '30min',
        visibility: 'private',
      }),
      ['member-a', 'member-b'],
    );
  });
});
