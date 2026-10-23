import { CloudController } from './cloud.controller';

describe('CloudController', () => {
  it('broadcasts a Cloud edit only after persistence succeeds', async () => {
    const message = {
      id: 'm1',
      content: 'Novo texto',
      editedAt: '2026-10-23T12:00:00.000Z',
    };
    const cloudService = {
      editMessage: jest.fn().mockResolvedValue({ ok: true, message }),
    };
    const gateway = { broadcastMessageEdited: jest.fn() };
    const controller = new CloudController(
      cloudService as never,
      {} as never,
      gateway as never,
    );
    const req = { headers: { cookie: '' } } as never;
    await controller.editMessage(
      'cloud-id',
      'm1',
      { content: 'Novo texto' },
      req,
    );
    expect(gateway.broadcastMessageEdited).toHaveBeenCalledWith(
      'cloud-id',
      message,
    );
    cloudService.editMessage.mockRejectedValueOnce(new Error('denied'));
    await expect(
      controller.editMessage('cloud-id', 'm1', { content: 'Novo texto' }, req),
    ).rejects.toThrow('denied');
    expect(gateway.broadcastMessageEdited).toHaveBeenCalledTimes(1);
  });
  it('broadcasts message removal only after successful persistence', async () => {
    const cloudService = {
      deleteMessage: jest.fn().mockResolvedValue({
        ok: true,
        moderationNotice: 'Removida pelo host',
      }),
    };
    const gateway = { broadcastMessageRemoved: jest.fn() };
    const controller = new CloudController(
      cloudService as never,
      {} as never,
      gateway as never,
    );
    const req = { headers: { cookie: '' } } as never;
    await controller.deleteMessage('cloud-id', 'message-id', req);
    expect(gateway.broadcastMessageRemoved).toHaveBeenCalledWith(
      'cloud-id',
      'message-id',
      'Removida pelo host',
    );
    cloudService.deleteMessage.mockRejectedValueOnce(new Error('denied'));
    await expect(
      controller.deleteMessage('cloud-id', 'message-id', req),
    ).rejects.toThrow('denied');
    expect(gateway.broadcastMessageRemoved).toHaveBeenCalledTimes(1);
  });
  it('broadcasts a Cloud pin only after persistence succeeds', async () => {
    const cloudService = {
      pinMessage: jest.fn().mockResolvedValue({ ok: true }),
      unpinMessage: jest.fn().mockResolvedValue({ ok: true }),
    };
    const gateway = { broadcastMessagePinned: jest.fn() };
    const controller = new CloudController(
      cloudService as never,
      {} as never,
      gateway as never,
    );
    const req = { headers: { cookie: '' } } as never;

    await controller.pinMessage('cloud-id', 'message-id', req);
    expect(cloudService.pinMessage).toHaveBeenCalledWith(
      null,
      'cloud-id',
      'message-id',
    );
    expect(gateway.broadcastMessagePinned).toHaveBeenCalledWith(
      'cloud-id',
      'message-id',
    );

    await controller.unpinMessage('cloud-id', 'message-id', req);
    expect(gateway.broadcastMessagePinned).toHaveBeenCalledWith(
      'cloud-id',
      null,
    );

    cloudService.pinMessage.mockRejectedValueOnce(new Error('denied'));
    await expect(
      controller.pinMessage('cloud-id', 'message-id', req),
    ).rejects.toThrow('denied');
    expect(gateway.broadcastMessagePinned).toHaveBeenCalledTimes(2);
  });
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

  it('returns the current topic suggestions without requiring a session', async () => {
    const cloudService = {
      listTrendingTopics: jest.fn().mockResolvedValue({
        ok: true,
        topics: [{ id: 'tecnologia', name: 'Tecnologia' }],
      }),
    };
    const controller = new CloudController(
      cloudService as never,
      {} as never,
      {} as never,
    );

    await expect(controller.trendingTopics()).resolves.toEqual({
      ok: true,
      topics: [{ id: 'tecnologia', name: 'Tecnologia' }],
    });
    expect(cloudService.listTrendingTopics).toHaveBeenCalledWith();
  });
});
