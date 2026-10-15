import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { IncomingMessage } from 'node:http';
import { getAllowedOrigins } from '../shared/runtime-env';
import { AuthService } from '../auth/auth.service';
import { SocketTicketService } from '../auth/socket-ticket.service';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants';
import { SocketIoRedisService } from '../infrastructure/socket-io-redis/socket-io-redis.service';
import { ChatPresenceService } from '../infrastructure/chat-presence/chat-presence.service';
import { CloudService } from './cloud.service';
import type {
  CloudMessagePayload,
  CloudMessageReactionPayload,
} from './cloud.types';

type CloudSocketData = {
  userId?: string;
  sessionId?: string;
  guest?: boolean;
  joinedCloudIds?: Set<string>;
  watchedCloudId?: string;
};

function extractTokenFromHandshake(socket: Socket): string | null {
  const authToken =
    typeof socket.handshake.auth?.token === 'string'
      ? socket.handshake.auth.token
      : null;
  if (authToken) {
    return authToken;
  }

  const rawCookie = socket.handshake.headers.cookie ?? '';
  const cookiePairs = rawCookie.split(';');

  for (const pair of cookiePairs) {
    const [name, ...rest] = pair.split('=');
    if (name?.trim() === SESSION_COOKIE_NAME) {
      return rest.join('=').trim() || null;
    }
  }

  return null;
}

@WebSocketGateway({
  namespace: '/clouds',
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
  allowRequest: (
    req: IncomingMessage,
    callback: (error: string | null, allowed: boolean) => void,
  ) => {
    const origin = req.headers.origin;
    callback(null, !origin || getAllowedOrigins().includes(origin));
  },
})
export class CloudMessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly typingTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly miniWatchTimers = new Map<
    string,
    ReturnType<typeof setInterval>
  >();

  constructor(
    private readonly authService: AuthService,
    private readonly socketTicketService: SocketTicketService,
    private readonly cloudService: CloudService,
    private readonly socketIoRedisService: SocketIoRedisService,
    private readonly chatPresenceService: ChatPresenceService,
  ) {}

  afterInit(server: Server) {
    const adapter = this.socketIoRedisService.getAdapter();
    if (adapter) {
      server.adapter(adapter);
    }
    return Promise.resolve();
  }

  async handleConnection(socket: Socket) {
    const ticket =
      typeof socket.handshake.auth?.ticket === 'string'
        ? socket.handshake.auth.ticket
        : null;
    const token = ticket
      ? await this.socketTicketService.consume(ticket)
      : extractTokenFromHandshake(socket);
    const session = await this.authService.resolveSession(token);

    socket.data = {
      ...(socket.data as CloudSocketData),
      userId: session?.user.id,
      sessionId: session?.session.id,
      guest: !session,
      joinedCloudIds: new Set<string>(),
    };

    if (session) await socket.join(this.userRoom(session.user.id));
    socket.emit('session:ready', { userId: session?.user.id ?? null });
  }

  async handleDisconnect(socket: Socket) {
    const userId = (socket.data as CloudSocketData).userId;
    const watchedCloudId = (socket.data as CloudSocketData).watchedCloudId;
    const watchTimer = this.miniWatchTimers.get(socket.id);
    if (watchTimer) clearInterval(watchTimer);
    this.miniWatchTimers.delete(socket.id);
    if (userId && watchedCloudId)
      await this.chatPresenceService.unwatchCloud(
        userId,
        watchedCloudId,
        socket.id,
      );
    const joinedCloudIds =
      (socket.data as CloudSocketData).joinedCloudIds ?? new Set<string>();

    if (userId) await this.clearTypingStatesForUser(userId, joinedCloudIds);
    await Promise.all(
      Array.from(joinedCloudIds, (cloudId) =>
        this.broadcastMembersUpdated(cloudId),
      ),
    );
  }

  @SubscribeMessage('cloud:join')
  async joinCloud(
    @MessageBody() body: { cloudId?: string; announce?: boolean },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = await this.resolveOrHydrateUserId(socket);

    const cloudId = body?.cloudId?.trim();

    if (!cloudId) {
      return { ok: false as const, message: 'Informe a cloud.' };
    }

    const cloud = await this.cloudService.requireCloudAccess(
      cloudId,
      userId ?? undefined,
    );
    if (
      !userId &&
      (cloud.visibility !== 'public' || cloud.status !== 'active')
    ) {
      return {
        ok: false as const,
        message: 'Cloud indisponível para visitantes.',
      };
    }
    const joinedCloudIds =
      (socket.data as CloudSocketData).joinedCloudIds ?? new Set<string>();
    await socket.join(this.cloudRoom(cloudId));
    joinedCloudIds.add(cloudId);

    // Socket reconnections only manage room presence. Entry messages are
    // created by the persisted join endpoint, which can distinguish a true
    // re-entry from a browser refresh.

    await this.broadcastMembersUpdated(cloudId);

    return { ok: true as const, data: { cloudId, cloud } };
  }

  @SubscribeMessage('cloud:leave')
  async leaveCloud(
    @MessageBody() body: { cloudId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const cloudId = body?.cloudId?.trim();

    if (!cloudId) {
      return { ok: false as const, message: 'Informe a cloud.' };
    }

    await socket.leave(this.cloudRoom(cloudId));
    (socket.data as CloudSocketData).joinedCloudIds?.delete(cloudId);
    await this.stopTyping(socket, cloudId);
    await this.broadcastMembersUpdated(cloudId);
    return { ok: true as const, data: { cloudId } };
  }

  @SubscribeMessage('cloud:mini:watch')
  async watchMiniCloud(
    @MessageBody() body: { cloudId?: string | null },
    @ConnectedSocket() socket: Socket,
  ) {
    const data = socket.data as CloudSocketData;
    const userId = data.userId;
    if (!userId)
      return { ok: false as const, message: 'Socket não autenticado.' };
    const nextCloudId = body?.cloudId?.trim() || null;
    if (nextCloudId && !data.joinedCloudIds?.has(nextCloudId))
      return {
        ok: false as const,
        message: 'Entre na Cloud antes de acompanhá-la.',
      };
    const timer = this.miniWatchTimers.get(socket.id);
    if (timer) clearInterval(timer);
    this.miniWatchTimers.delete(socket.id);
    if (data.watchedCloudId)
      await this.chatPresenceService.unwatchCloud(
        userId,
        data.watchedCloudId,
        socket.id,
      );
    data.watchedCloudId = nextCloudId ?? undefined;
    if (nextCloudId) {
      await this.chatPresenceService.watchCloud(userId, nextCloudId, socket.id);
      this.miniWatchTimers.set(
        socket.id,
        setInterval(() => {
          void this.chatPresenceService
            .watchCloud(userId, nextCloudId, socket.id)
            .catch(() => undefined);
        }, 25_000),
      );
    }
    return { ok: true as const };
  }

  @SubscribeMessage('cloud:typing')
  async handleTyping(
    @MessageBody() body: { cloudId?: string; isTyping?: boolean },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = await this.resolveOrHydrateUserId(socket);

    if (!userId) {
      return { ok: false as const, message: 'Socket não autenticado.' };
    }

    const cloudId = body?.cloudId?.trim();
    const isTyping = Boolean(body?.isTyping);

    if (!cloudId) {
      return { ok: false as const, message: 'Informe a cloud.' };
    }

    await this.cloudService.requireCloudAccess(cloudId, userId);

    if (!isTyping) {
      await this.stopTyping(socket, cloudId);
      return { ok: true as const, data: { cloudId, isTyping: false } };
    }

    const payload = { cloudId, userId, isTyping: true };
    this.server.to(this.cloudRoom(cloudId)).emit('cloud:typing', payload);
    this.scheduleTypingTimeout(socket, cloudId);

    return { ok: true as const, data: payload };
  }

  async getConnectedMemberCount(cloudId: string): Promise<number> {
    const sockets = await this.server
      .in(this.cloudRoom(cloudId))
      .fetchSockets();
    return sockets.length;
  }

  async broadcastMembersUpdated(cloudId: string) {
    const members = await this.cloudService.getActiveMembers(cloudId);
    const membersCount = members.length;
    this.server.to(this.cloudRoom(cloudId)).emit('cloud:members_updated', {
      cloudId,
      membersCount,
      members,
    });
    // Feed clients do not join every Cloud room. Send only an invalidation
    // signal globally, so they can refresh their own authorized view without
    // exposing member identities from private Clouds.
    this.server.emit('cloud:feed_updated');
    return membersCount;
  }

  broadcastCloudUpdated(
    cloudId: string,
    cloud: { id: string; title: string; duration: string; editCount: number },
  ) {
    this.server
      .to(this.cloudRoom(cloudId))
      .emit('cloud:updated', { cloudId, cloud });
    this.server.emit('cloud:feed_updated');
  }

  async broadcastMessageCreated(
    userId: string | null,
    cloudId: string,
    message: CloudMessagePayload,
  ) {
    if (userId) {
      await this.cloudService.requireCloudAccess(cloudId, userId);
    }

    const broadcaster = this.server.to(this.cloudRoom(cloudId));
    if (userId) {
      broadcaster
        .except(this.userRoom(userId))
        .emit('cloud:message:new', message);
      return;
    }

    broadcaster.emit('cloud:message:new', message);
  }

  async broadcastMemberBanned(
    cloudId: string,
    bannedUserId: string,
    deletedMessageIds: string[] = [],
  ) {
    // Notify all room members to remove the deleted messages
    if (deletedMessageIds.length > 0) {
      this.server.to(this.cloudRoom(cloudId)).emit('cloud:messages:deleted', {
        cloudId,
        messageIds: deletedMessageIds,
      });
    }
    // Small delay so the system message is processed by the banned user before redirect
    await new Promise((resolve) => setTimeout(resolve, 400));
    // Notify the banned user to force redirect
    this.server
      .to(this.userRoom(bannedUserId))
      .emit('cloud:banned', { cloudId });
  }

  broadcastMemberRemoved(cloudId: string, removedUserId: string) {
    this.server
      .to(this.userRoom(removedUserId))
      .emit('cloud:removed', { cloudId });
    return Promise.resolve();
  }

  broadcastReport(
    authorId: string,
    payload: {
      cloudId: string;
      reportedId: string;
      reportedName: string;
      reportedUsername: string;
      reportedAvatarUrl: string | null;
      messageId: string | null;
      messageContent: string | null;
      reasons: string[];
    },
  ) {
    this.server.to(this.userRoom(authorId)).emit('cloud:report', payload);
    return Promise.resolve();
  }

  async broadcastReactionChange(
    userId: string | null,
    cloudId: string,
    messageId: string,
    reaction: CloudMessageReactionPayload,
    removed = false,
  ) {
    if (userId) {
      await this.cloudService.requireCloudAccess(cloudId, userId);
    }

    const broadcaster = this.server.to(this.cloudRoom(cloudId));
    const payload = {
      cloudId,
      messageId,
      reaction,
      removed,
    };

    if (userId) {
      broadcaster
        .except(this.userRoom(userId))
        .emit('cloud:reaction:changed', payload);
      return;
    }

    broadcaster.emit('cloud:reaction:changed', payload);
  }

  private registerTypingTimer(socket: Socket, cloudId: string) {
    const userId = this.getUserId(socket);

    if (!userId) {
      return;
    }

    const key = this.typingKey(cloudId, userId);
    const existing = this.typingTimers.get(key);

    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.stopTyping(socket, cloudId);
    }, 1000);

    this.typingTimers.set(key, timer);
  }

  private scheduleTypingTimeout(socket: Socket, cloudId: string) {
    this.registerTypingTimer(socket, cloudId);
  }

  private stopTyping(socket: Socket, cloudId: string) {
    const userId = this.getUserId(socket);

    if (!userId) {
      return;
    }

    const key = this.typingKey(cloudId, userId);
    const existing = this.typingTimers.get(key);

    if (existing) {
      clearTimeout(existing);
      this.typingTimers.delete(key);
    }

    this.server.to(this.cloudRoom(cloudId)).emit('cloud:typing', {
      cloudId,
      userId,
      isTyping: false,
    });
    return Promise.resolve();
  }

  private clearTypingStatesForUser(
    userId: string,
    joinedCloudIds: Set<string>,
  ) {
    const keys = Array.from(this.typingTimers.keys()).filter((key) =>
      key.endsWith(`:${userId}`),
    );

    for (const key of keys) {
      const [cloudId] = key.split(':');
      const timer = this.typingTimers.get(key);
      if (timer) {
        clearTimeout(timer);
      }
      this.typingTimers.delete(key);

      if (joinedCloudIds.has(cloudId)) {
        this.server.to(this.cloudRoom(cloudId)).emit('cloud:typing', {
          cloudId,
          userId,
          isTyping: false,
        });
      }
    }
    return Promise.resolve();
  }

  private getUserId(socket: Socket): string | null {
    return (socket.data as CloudSocketData).userId ?? null;
  }

  private async resolveOrHydrateUserId(socket: Socket): Promise<string | null> {
    const existingUserId = this.getUserId(socket);
    if (existingUserId) {
      return existingUserId;
    }

    const token = extractTokenFromHandshake(socket);
    if (!token) {
      return null;
    }

    const session = await this.authService.resolveSession(token);
    if (!session) {
      return null;
    }

    socket.data = {
      ...(socket.data as CloudSocketData),
      userId: session.user.id,
      sessionId: session.session.id,
      joinedCloudIds:
        (socket.data as CloudSocketData).joinedCloudIds ?? new Set<string>(),
    };

    return session.user.id;
  }

  private cloudRoom(cloudId: string): string {
    return `cloud:${cloudId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private typingKey(cloudId: string, userId: string): string {
    return `${cloudId}:${userId}`;
  }
}
