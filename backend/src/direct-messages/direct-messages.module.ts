import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatPresenceModule } from '../infrastructure/chat-presence/chat-presence.module';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { PushNotificationsModule } from '../infrastructure/push/push-notifications.module';
import { SocketIoRedisModule } from '../infrastructure/socket-io-redis/socket-io-redis.module';
import { DirectMessagesController } from './direct-messages.controller';
import { DirectMessagesGateway } from './direct-messages.gateway';
import { DirectMessagesService } from './direct-messages.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SocketIoRedisModule,
    ChatPresenceModule,
    PushNotificationsModule,
  ],
  controllers: [DirectMessagesController],
  providers: [DirectMessagesService, DirectMessagesGateway],
  exports: [DirectMessagesService, DirectMessagesGateway],
})
export class DirectMessagesModule {}
