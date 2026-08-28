export type PublicUserProfilePayload = {
  id: string;
  username: string;
  name: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  website: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followingCount: number;
  cloudsCount: number;
  isFollowing: boolean;
  isFollowRequested: boolean;
  isSelf: boolean;
  profileUrl: string;
  activeCloud?: {
    id: string;
    title: string;
    duration: string;
    createdAt: string;
    visibility: "public" | "private";
  } | null;
  activeClouds: Array<{
    id: string;
    title: string;
    description: string | null;
    duration: string;
    createdAt: string;
    visibility: "public" | "private";
    href: string;
  }>;
};

export type UsersSearchResponse = {
  ok: true;
  users: PublicUserProfilePayload[];
};

export type UserProfileResponse = {
  ok: true;
  user: PublicUserProfilePayload;
};
