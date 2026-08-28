export type NotificationActor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  profileUrl: string;
};

export type NotificationPayload = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  actor: NotificationActor | null;
};

export type NotificationsListResponse = {
  ok: true;
  notifications: NotificationPayload[];
  unreadCount: number;
};
