export type ConversationParticipantIds = {
  participantOneId: string;
  participantTwoId: string;
  participant: { id: string };
};

export function isConversationForViewer(
  conversation: ConversationParticipantIds,
  viewerId: string,
): boolean {
  const peerId =
    conversation.participantOneId === viewerId
      ? conversation.participantTwoId
      : conversation.participantTwoId === viewerId
        ? conversation.participantOneId
        : null;

  return Boolean(
    peerId && peerId !== viewerId && conversation.participant.id === peerId,
  );
}
