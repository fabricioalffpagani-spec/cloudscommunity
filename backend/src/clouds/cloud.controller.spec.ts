import { CloudController } from './cloud.controller';

describe('CloudController', () => {
  it('returns persisted active participant counts and avatars instead of socket totals', async () => {
    const cloud = {
      id: 'cloud-id',
      membersCount: 1,
      members: [{ userId: 'active' }],
    };
    const cloudService = {
      listFeed: jest.fn().mockResolvedValue({ ok: true, clouds: [cloud] }),
      findById: jest.fn().mockResolvedValue({ ok: true, cloud }),
    };
    const gateway = { getConnectedMemberCount: jest.fn().mockResolvedValue(9) };
    const controller = new CloudController(
      cloudService as never,
      {} as never,
      gateway as never,
    );
    const req = { headers: { cookie: '' } } as never;

    expect((await controller.feed(req)).clouds[0]).toEqual(cloud);
    expect((await controller.findById('cloud-id', req)).cloud).toEqual(cloud);
    expect(gateway.getConnectedMemberCount).not.toHaveBeenCalled();
  });

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
