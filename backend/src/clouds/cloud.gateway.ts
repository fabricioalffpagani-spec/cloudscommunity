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
import { AuthService } from '../auth/auth.service';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants';
import { SocketIoRedisService } from '../infrastructure/socket-io-redis/socket-io-redis.service';
import { CloudService } from './cloud.service';
import type { CloudMessagePayload, CloudMessageReactionPayload } from './cloud.types';

type CloudSocketData = {
  userId?: string;
  sessionId?: string;
  joinedCloudIds?: Set<string>;
};

function extractTokenFromHandshake(socket: Socket): string | null {
  const authToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null;
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
    origin: process.env.APP_WEB_ORIGIN?.split(',').map((origin) => origin.trim()) ?? true,
    credentials: true,
  },
})
export class CloudMessagesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly authService: AuthService,
    private readonly cloudService: CloudService,
    private readonly socketIoRedisService: SocketIoRedisService,
  ) {}

  async afterInit(server: Server) {
    const adapter = this.socketIoRedisService.getAdapter();
    if (adapter) {
      server.adapter(adapter);
    }
  }

  async handleConnection(socket: Socket) {
    const token = extractTokenFromHandshake(socket);
    const session = await this.authService.resolveSession(token);

    if (!session) {
      socket.disconnect(true);
      return;
    }

    socket.data = {
      ...(socket.data as CloudSocketData),
      userId: session.user.id,
      sessionId: session.session.id,
      joinedCloudIds: new Set<string>(),
    };

    await socket.join(this.userRoom(session.user.id));
  }

  async handleDisconnect(socket: Socket) {
    const userId = (socket.data as CloudSocketData).userId;
    const joinedCloudIds = (socket.data as CloudSocketData).joinedCloudIds ?? new Set<string>();

    if (!userId) {
      return;
    }

    await this.clearTypingStatesForUser(userId, joinedCloudIds);
    await Promise.all(Array.from(joinedCloudIds, (cloudId) => this.broadcastMembersUpdated(cloudId)));
  }

  @SubscribeMessage('cloud:join')
  async joinCloud(
    @MessageBody() body: { cloudId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = await this.resolveOrHydrateUserId(socket);

    if (!userId) {
      return { ok: false as const, message: 'Socket não autenticado.' };
    }

    const cloudId = body?.cloudId?.trim();

    if (!cloudId) {
      return { ok: false as const, message: 'Informe a cloud.' };
    }

    const cloud = await this.cloudService.requireCloudAccess(cloudId, userId);
    const joinedCloudIds = (socket.data as CloudSocketData).joinedCloudIds ?? new Set<string>();
    const isNewSocketRoomJoin = !joinedCloudIds.has(cloudId);
    await socket.join(this.cloudRoom(cloudId));
    joinedCloudIds.add(cloudId);

    if (isNewSocketRoomJoin) {
      const systemMessage = await this.cloudService.createJoinNotification(cloudId, userId);
      await this.broadcastMessageCreated(null, cloudId, systemMessage);
    }

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
    const sockets = await this.server.in(this.cloudRoom(cloudId)).fetchSockets();
    return sockets.length;
  }

  async broadcastMembersUpdated(cloudId: string) {
    const membersCount = await this.getConnectedMemberCount(cloudId);
    this.server.emit('cloud:members_updated', { cloudId, membersCount });
    return membersCount;
  }

  async broadcastMessageCreated(userId: string | null, cloudId: string, message: CloudMessagePayload) {
    if (userId) {
      await this.cloudService.requireCloudAccess(cloudId, userId);
    }

    const broadcaster = this.server.to(this.cloudRoom(cloudId));
    if (userId) {
      broadcaster.except(this.userRoom(userId)).emit('cloud:message:new', message);
      return;
    }

    broadcaster.emit('cloud:message:new', message);
  }

  async broadcastMemberBanned(cloudId: string, bannedUserId: string, deletedMessageIds: string[] = []) {
    // Notify all room members to remove the deleted messages
    if (deletedMessageIds.length > 0) {
      this.server.to(this.cloudRoom(cloudId)).emit('cloud:messages:deleted', { cloudId, messageIds: deletedMessageIds });
    }
    // Small delay so the system message is processed by the banned user before redirect
    await new Promise((resolve) => setTimeout(resolve, 400));
    // Notify the banned user to force redirect
    this.server.to(this.userRoom(bannedUserId)).emit('cloud:banned', { cloudId });
  }

  async broadcastReport(
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
      broadcaster.except(this.userRoom(userId)).emit('cloud:reaction:changed', payload);
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

  private async stopTyping(socket: Socket, cloudId: string) {
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
  }

  private async clearTypingStatesForUser(userId: string, joinedCloudIds: Set<string>) {
    const keys = Array.from(this.typingTimers.keys()).filter((key) => key.endsWith(`:${userId}`));

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
      joinedCloudIds: (socket.data as CloudSocketData).joinedCloudIds ?? new Set<string>(),
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
