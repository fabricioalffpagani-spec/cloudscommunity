import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { AuthModule } from './auth/auth.module';
import { CloudModule } from './clouds/cloud.module';
import { DirectMessagesModule } from './direct-messages/direct-messages.module';
import { ChatPresenceModule } from './infrastructure/chat-presence/chat-presence.module';
import { SocketIoRedisModule } from './infrastructure/socket-io-redis/socket-io-redis.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CloudModule,
    UsersModule,
    NotificationsModule,
    SocketIoRedisModule,
    ChatPresenceModule,
    DirectMessagesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService],
})
export class AppModule {}
