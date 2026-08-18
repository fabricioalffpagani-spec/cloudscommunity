export type CloudVisibilityValue = 'public' | 'private';

export type CloudAuthorPayload = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
};

export type CloudMessageReactionPayload = {
  id: string;
  emoji: string;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
};

export type CloudMessageReplyPayload = {
  id: string;
  sender: string;
  content: string | null;
};

export type CloudMessageAuthorPayload = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type CloudMessagePayload = {
  id: string;
  cloudId: string;
  senderId: string;
  type: 'text' | 'audio' | 'image' | 'link';
  content: string | null;
  mediaUrl: string | null;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sender: CloudMessageAuthorPayload;
  replyTo: CloudMessageReplyPayload | null;
  reactions: CloudMessageReactionPayload[];
};

export type CloudPayload = {
  id: string;
  title: string;
  description: string | null;
  duration: string;
  visibility: CloudVisibilityValue;
  status: string;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  author: CloudAuthorPayload;
  hypesCount: number;
  membersCount: number;
  href: string;
};

export type CreateCloudInput = {
  title?: string;
  description?: string;
  duration?: string;
  visibility?: CloudVisibilityValue;
};

export type ListCloudMessagesQuery = {
  take?: number;
  before?: string;
};

export type CreateCloudMessageInput = {
  type: 'text' | 'audio' | 'image' | 'link';
  content?: string;
  mediaUrl?: string;
  clientMessageId?: string;
  replyToMessageId?: string;
};
