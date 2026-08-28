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
import { ChatPresenceService } from '../infrastructure/chat-presence/chat-presence.service';
import { SocketIoRedisService, type RedisAdapter } from '../infrastructure/socket-io-redis/socket-io-redis.service';
import { DirectMessagesService } from './direct-messages.service';
import type {
  ConversationPresencePayload,
  ConversationReadPayload,
  ConversationTypingPayload,
  DirectConversationPayload,
  DirectMessagePayload,
  SendDirectMessageInput,
} from './direct-messages.types';

type ChatSocketData = {
  userId?: string;
  sessionId?: string;
  joinedConversationIds?: Set<string>;
};

type AckResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

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
  namespace: '/direct-messages',
  cors: {
    origin: process.env.APP_WEB_ORIGIN?.split(',').map((origin) => origin.trim()) ?? true,
    credentials: true,
  },
})
export class DirectMessagesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly authService: AuthService,
    private readonly directMessagesService: DirectMessagesService,
    private readonly socketIoRedisService: SocketIoRedisService,
    private readonly chatPresenceService: ChatPresenceService,
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

    const userId = session.user.id;
    socket.data = {
      ...(socket.data as ChatSocketData),
      userId,
      sessionId: session.session.id,
      joinedConversationIds: new Set<string>(),
    };

    await socket.join(this.userRoom(userId));
    const shouldBroadcast = await this.chatPresenceService.markOnline(userId);
    if (shouldBroadcast) {
      await this.broadcastPresence(userId, 'online');
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = (socket.data as ChatSocketData).userId;
    const joinedConversationIds = (socket.data as ChatSocketData).joinedConversationIds ?? new Set<string>();

    if (userId) {
      const shouldBroadcast = await this.chatPresenceService.markOffline(userId);
      if (shouldBroadcast) {
        await this.broadcastPresence(userId, 'offline');
      }

      await this.clearTypingStatesForUser(userId, joinedConversationIds);
    }
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(
    @MessageBody() body: { conversationId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = this.getUserId(socket);

    if (!userId) {
      return { ok: false as const, message: 'Socket não autenticado.' };
    }

    const conversationId = body?.conversationId?.trim();

    if (!conversationId) {
      return { ok: false as const, message: 'Informe a conversa.' };
    }

    const conversation = await this.directMessagesService.getConversationById(userId, conversationId);
    await socket.join(this.conversationRoom(conversationId));
    (socket.data as ChatSocketData).joinedConversationIds?.add(conversationId);

    return { ok: true as const, data: conversation };
  }

  @SubscribeMessage('conversation:leave')
  async leaveConversation(
    @MessageBody() body: { conversationId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const conversationId = body?.conversationId?.trim();

    if (!conversationId) {
      return { ok: false as const, message: 'Informe a conversa.' };
    }

    await socket.leave(this.conversationRoom(conversationId));
    (socket.data as ChatSocketData).joinedConversationIds?.delete(conversationId);
    await this.stopTyping(socket, conversationId);
    return { ok: true as const, data: { conversationId } };
  }

  @SubscribeMessage('conversation:typing')
  async handleTyping(
    @MessageBody() body: { conversationId?: string; isTyping?: boolean },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = this.getUserId(socket);

    if (!userId) {
      return { ok: false as const, message: 'Socket não autenticado.' };
    }

    const conversationId = body?.conversationId?.trim();
    const isTyping = Boolean(body?.isTyping);

    if (!conversationId) {
      return { ok: false as const, message: 'Informe a conversa.' };
    }

    if (!isTyping) {
      await this.stopTyping(socket, conversationId);
      return { ok: true as const, data: { conversationId, isTyping: false } };
    }

    const conversation = await this.directMessagesService.getConversationById(userId, conversationId);
    const payload: ConversationTypingPayload = {
      conversationId,
      userId,
      isTyping: true,
    };

    this.emitTypingToPeer(conversation.participant.id, payload);
    this.scheduleTypingTimeout(socket, conversationId);

    return { ok: true as const, data: payload };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @MessageBody() body: SendDirectMessageInput,
    @ConnectedSocket() socket: Socket,
    ack?: (payload: AckResult<unknown>) => void,
  ) {
    const userId = this.getUserId(socket);

    if (!userId) {
      const payload = { ok: false as const, message: 'Socket não autenticado.' };
      ack?.(payload);
      return payload;
    }

    try {
      const message = await this.directMessagesService.sendTextMessage(userId, body);
      await this.broadcastMessageCreated(userId, body.conversationId, message);
      await this.stopTyping(socket, body.conversationId);

      const payload = { ok: true as const, data: message };
      ack?.(payload);
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
      const payload = { ok: false as const, message };
      ack?.(payload);
      return payload;
    }
  }

  @SubscribeMessage('conversation:read')
  async readConversation(
    @MessageBody() body: { conversationId?: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = this.getUserId(socket);

    if (!userId) {
      return { ok: false as const, message: 'Socket não autenticado.' };
    }

    const conversationId = body?.conversationId?.trim();

    if (!conversationId) {
      return { ok: false as const, message: 'Informe a conversa.' };
    }

    const conversation = await this.directMessagesService.markConversationRead(userId, conversationId);
    const readAt = new Date().toISOString();
    const payload: ConversationReadPayload = {
      conversationId,
      readerId: userId,
      readAt,
    };

    this.server.to(this.conversationRoom(conversationId)).emit('conversation:read', payload);
    this.server.to(this.userRoom(userId)).emit('conversation:updated', conversation);
    this.server.to(this.userRoom(conversation.participant.id)).emit('conversation:updated', conversation);

    return { ok: true as const, data: conversation };
  }

  async broadcastPresence(userId: string, status: ConversationPresencePayload['status']) {
    const peerIds = await this.directMessagesService.listConversationPeerIds(userId);
    const payload: ConversationPresencePayload = { userId, status };

    for (const peerId of peerIds) {
      this.server.to(this.userRoom(peerId)).emit('presence:update', payload);
    }
  }

  async broadcastMessageCreated(userId: string, conversationId: string, message: DirectMessagePayload) {
    const senderConversation = await this.directMessagesService.getConversationById(userId, conversationId);
    const recipientConversation = await this.directMessagesService.getConversationById(senderConversation.participant.id, conversationId);

    this.server.to(this.conversationRoom(conversationId)).emit('message:new', message);
    this.server.to(this.userRoom(userId)).emit('conversation:updated', senderConversation);
    this.server.to(this.userRoom(senderConversation.participant.id)).emit('conversation:updated', recipientConversation);
  }

  async broadcastMessageEdited(conversationId: string, message: DirectMessagePayload) {
    this.server.to(this.conversationRoom(conversationId)).emit('message:edited', message);
  }

  async broadcastMessageDeleted(conversationId: string, messageId: string) {
    this.server.to(this.conversationRoom(conversationId)).emit('message:deleted', { messageId });
  }

  async broadcastConversationRead(userId: string, conversationId: string) {
    const conversation = await this.directMessagesService.markConversationRead(userId, conversationId);
    const readAt = new Date().toISOString();
    const payload: ConversationReadPayload = {
      conversationId,
      readerId: userId,
      readAt,
    };

    this.server.to(this.conversationRoom(conversationId)).emit('conversation:read', payload);
    this.server.to(this.userRoom(userId)).emit('conversation:updated', conversation);
    this.server.to(this.userRoom(conversation.participant.id)).emit('conversation:updated', conversation);
  }

  async broadcastTyping(userId: string, conversationId: string, isTyping: boolean) {
    const conversation = await this.directMessagesService.getConversationById(userId, conversationId);
    const payload: ConversationTypingPayload = {
      conversationId,
      userId,
      isTyping,
    };

    this.server.to(this.userRoom(conversation.participant.id)).emit('conversation:typing', payload);
  }

  private registerTypingTimer(socket: Socket, conversationId: string) {
    const userId = this.getUserId(socket);

    if (!userId) {
      return;
    }

    const key = this.typingKey(conversationId, userId);
    const existing = this.typingTimers.get(key);

    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.stopTyping(socket, conversationId);
    }, 1000);

    this.typingTimers.set(key, timer);
  }

  private scheduleTypingTimeout(socket: Socket, conversationId: string) {
    this.registerTypingTimer(socket, conversationId);
  }

  private async stopTyping(socket: Socket, conversationId: string) {
    const userId = this.getUserId(socket);

    if (!userId) {
      return;
    }

    const key = this.typingKey(conversationId, userId);
    const existing = this.typingTimers.get(key);

    if (existing) {
      clearTimeout(existing);
      this.typingTimers.delete(key);
    }

    try {
      await this.broadcastTyping(userId, conversationId, false);
    } catch {
      // Ignore stale conversations during disconnect/leave cleanup.
    }
  }

  private async clearTypingStatesForUser(userId: string, joinedConversationIds: Set<string>) {
    const keys = Array.from(this.typingTimers.keys()).filter((key) => key.endsWith(`:${userId}`));

    for (const key of keys) {
      const [conversationId] = key.split(':');
      const timer = this.typingTimers.get(key);
      if (timer) {
        clearTimeout(timer);
      }
      this.typingTimers.delete(key);

      if (joinedConversationIds.has(conversationId)) {
        await this.broadcastTyping(userId, conversationId, false);
      }
    }
  }

  private emitTypingToPeer(peerId: string, payload: ConversationTypingPayload) {
    this.server.to(this.userRoom(peerId)).emit('conversation:typing', payload);
  }

  private getUserId(socket: Socket): string | null {
    return (socket.data as ChatSocketData).userId ?? null;
  }

  private conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private typingKey(conversationId: string, userId: string): string {
    return `${conversationId}:${userId}`;
  }
}
