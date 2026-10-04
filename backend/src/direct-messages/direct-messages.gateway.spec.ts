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

  it('sends each reader update with the other participant for that viewer', async () => {
    const emissions: Array<{
      room: string;
      event: string;
      participantId?: string;
    }> = [];
    const server = {
      to: (room: string) => ({
        emit: (event: string, payload: { participant?: { id: string } }) => {
          emissions.push({
            room,
            event,
            participantId: payload.participant?.id,
          });
        },
      }),
    };
    const readerConversation = { participant: { id: 'sender' } };
    const peerConversation = { participant: { id: 'reader' } };
    const getConversationById = jest.fn().mockResolvedValue(peerConversation);
    const gateway = Object.create(
      DirectMessagesGateway.prototype,
    ) as DirectMessagesGateway;
    Reflect.set(gateway, 'server', server);
    Reflect.set(gateway, 'directMessagesService', {
      markConversationRead: jest.fn().mockResolvedValue(readerConversation),
      getConversationById,
    });

    await gateway.broadcastConversationRead('reader', 'conversation-1');

    expect(getConversationById).toHaveBeenCalledWith(
      'sender',
      'conversation-1',
    );
    expect(emissions).toEqual(
      expect.arrayContaining([
        {
          room: 'user:reader',
          event: 'conversation:updated',
          participantId: 'sender',
        },
        {
          room: 'user:sender',
          event: 'conversation:updated',
          participantId: 'reader',
        },
      ]),
    );
  });
});
