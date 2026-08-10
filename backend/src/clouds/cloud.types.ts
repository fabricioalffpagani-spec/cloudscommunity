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
