import { CloudMessagesGateway } from './cloud.gateway';

describe('CloudMessagesGateway message delivery', () => {
  it('delivers a new message to every Cloud session, including another device of the sender', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const requireCloudAccess = jest.fn().mockResolvedValue(undefined);
    const gateway = Object.create(
      CloudMessagesGateway.prototype,
    ) as CloudMessagesGateway;
    Reflect.set(gateway, 'server', { to });
    Reflect.set(gateway, 'cloudService', { requireCloudAccess });
    const message = { id: 'message-1', cloudId: 'cloud-1' };

    await gateway.broadcastMessageCreated(
      'sender',
      'cloud-1',
      message as Parameters<CloudMessagesGateway['broadcastMessageCreated']>[2],
    );

    expect(requireCloudAccess).toHaveBeenCalledWith('cloud-1', 'sender');
    expect(to).toHaveBeenCalledWith('cloud:cloud-1');
    expect(emit).toHaveBeenCalledWith('cloud:message:new', message);
  });

  it('delivers reaction changes to every Cloud session too', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const requireCloudAccess = jest.fn().mockResolvedValue(undefined);
    const gateway = Object.create(
      CloudMessagesGateway.prototype,
    ) as CloudMessagesGateway;
    Reflect.set(gateway, 'server', { to });
    Reflect.set(gateway, 'cloudService', { requireCloudAccess });
    const reaction = { id: 'reaction-1', emoji: '🔥' };

    await gateway.broadcastReactionChange(
      'sender',
      'cloud-1',
      'message-1',
      reaction as Parameters<
        CloudMessagesGateway['broadcastReactionChange']
      >[3],
    );

    expect(requireCloudAccess).toHaveBeenCalledWith('cloud-1', 'sender');
    expect(to).toHaveBeenCalledWith('cloud:cloud-1');
    expect(emit).toHaveBeenCalledWith('cloud:reaction:changed', {
      cloudId: 'cloud-1',
      messageId: 'message-1',
      reaction,
      removed: false,
    });
  });
});
