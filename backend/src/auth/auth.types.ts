export type AuthUserPayload = {
  id: string;
  email: string;
  username: string;
  name: string;
  displayName: string;
  birthDate: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  location: string | null;
  website: string | null;
  isPrivate: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSessionPayload = {
  id: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
};

export type AuthResponse = {
  ok: true;
  user: AuthUserPayload;
  session: AuthSessionPayload;
};

export type AuthResult = AuthResponse & {
  token: string;
};

export type UsernameAvailabilityResponse = {
  ok: true;
  available: boolean;
  username: string;
};
