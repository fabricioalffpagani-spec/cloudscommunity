import { DirectMessagesGateway } from './direct-messages.gateway';

describe('DirectMessagesGateway message delivery', () => {
  it('sends new messages to every session of both users', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnThis();
    const getConversationById = jest
      .fn()
      .mockResolvedValueOnce({ participant: { id: 'recipient' } })
      .mockResolvedValueOnce({ participant: { id: 'sender' } });
    const gateway = Object.create(
      DirectMessagesGateway.prototype,
    ) as DirectMessagesGateway;
    Reflect.set(gateway, 'server', { to, emit });
    Reflect.set(gateway, 'directMessagesService', { getConversationById });
    const message = { id: 'message-1', conversationId: 'conversation-1' };

    await gateway.broadcastMessageCreated(
      'sender',
      'conversation-1',
      message as Parameters<
        DirectMessagesGateway['broadcastMessageCreated']
      >[2],
    );

    expect(to).toHaveBeenCalledWith('user:sender');
    expect(to).toHaveBeenCalledWith('user:recipient');
    expect(emit).toHaveBeenCalledWith('message:new', message);
    expect(to).not.toHaveBeenCalledWith('conversation:conversation-1');
  });
});
