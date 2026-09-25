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
  showHypesCount: boolean;
  showArchivedClouds: boolean;
  showParticipatingNow: boolean;
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followingCount: number;
  cloudsCount: number;
  hypesCount: number;
  isFollowing: boolean;
  isFollowRequested: boolean;
  isBlockedByMe: boolean;
  isBlockedByUser: boolean;
  isSelf: boolean;
  profileUrl: string;
  activeCloud?: {
    id: string;
    title: string;
    duration: string;
    createdAt: string;
    visibility: 'public' | 'private';
  } | null;
  participatingNow: {
    id: string;
    title: string;
    duration: string;
    href: string;
  } | null;
  activeClouds: Array<{
    id: string;
    title: string;
    description: string | null;
    duration: string;
    createdAt: string;
    visibility: 'public' | 'private';
    href: string;
  }>;
  endedClouds: Array<{
    id: string;
    title: string;
    description: string | null;
    duration: string;
    createdAt: string;
    endedAt: string | null;
    visibility: 'public' | 'private';
    href: string;
  }>;
};

export type UsersSearchResponse = {
  ok: true;
  users: PublicUserProfilePayload[];
};

export type ReceivedHypeUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  hypesCount: number;
};

export type ReceivedHypesResponse = {
  ok: true;
  users: ReceivedHypeUser[];
};

export type MeetResponse = {
  ok: true;
  popularRecent: Array<PublicUserProfilePayload & { hypes: number }>;
  popularAllTime: Array<PublicUserProfilePayload & { hypes: number }>;
  nearby: Array<PublicUserProfilePayload & { mutualFollowersCount: number }>;
};

export type UserProfileResponse = {
  ok: true;
  user: PublicUserProfilePayload;
};
