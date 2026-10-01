import type { MessageType } from '@prisma/client';

export type DirectMessageAuthorPayload = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type DirectMessageAssetPayload = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: string;
  originalFileName: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type DirectMessagePayload = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  readAt: string | null;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sender: DirectMessageAuthorPayload;
  mediaAsset: DirectMessageAssetPayload | null;
};

export type DirectConversationParticipantPayload = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
};

export type DirectConversationPayload = {
  id: string;
  conversationKey: string;
  participantOneId: string;
  participantTwoId: string;
  lastMessageId: string | null;
  lastMessageType: MessageType | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  blockedByPeer: boolean;
  blockedByMe: boolean;
  participant: DirectConversationParticipantPayload;
};

export type ConversationPresencePayload = {
  userId: string;
  status: 'online' | 'offline';
};

export type ConversationTypingPayload = {
  conversationId: string;
  userId: string;
  isTyping: boolean;
};

export type ConversationReadPayload = {
  conversationId: string;
  readerId: string;
  readAt: string;
};

export type ListDirectMessagesQuery = {
  take?: number;
  before?: string;
};

export type SendDirectMessageInput = {
  conversationId: string;
  content: string;
  clientMessageId?: string;
  replyToMessageId?: string;
};

export type SendAudioMessageInput = {
  conversationId: string;
  clientMessageId?: string;
  replyToMessageId?: string;
  durationMs?: number | null;
  forwarded?: boolean;
};

export type SendImageMessageInput = {
  conversationId: string;
  clientMessageId?: string;
  replyToMessageId?: string;
  forwarded?: boolean;
};

export type SendLinkMessageInput = {
  conversationId: string;
  url: string;
  label?: string;
  clientMessageId?: string;
  replyToMessageId?: string;
};

export type CreateConversationInput = {
  peerUserId: string;
};
