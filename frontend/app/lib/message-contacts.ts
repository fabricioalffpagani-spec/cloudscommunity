type ConversationContact = {
  peerId: string;
  peerUsername: string;
  name: string;
};

type FollowedContact = {
  id: string;
  username: string;
  displayName: string;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function matches(values: string[], query: string) {
  const normalizedQuery = normalize(query.replace(/^@+/, ""));
  return !normalizedQuery || values.some((value) => normalize(value).includes(normalizedQuery));
}

export function buildMessageContactList<C extends ConversationContact, F extends FollowedContact>(
  conversations: C[],
  followedContacts: F[],
  query: string,
): Array<C | F> {
  const conversationPeerIds = new Set(conversations.map((conversation) => conversation.peerId));
  const visibleConversations = conversations.filter((conversation) => matches([conversation.name, conversation.peerUsername], query));
  const availableFollowedContacts = followedContacts.filter((contact) =>
    !conversationPeerIds.has(contact.id) && matches([contact.displayName, contact.username], query),
  );

  return [...visibleConversations, ...availableFollowedContacts];
}
