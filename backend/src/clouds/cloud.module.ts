import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { PushNotificationsModule } from '../infrastructure/push/push-notifications.module';
import { SocketIoRedisModule } from '../infrastructure/socket-io-redis/socket-io-redis.module';
import { ChatPresenceModule } from '../infrastructure/chat-presence/chat-presence.module';
import { CloudController } from './cloud.controller';
import { CloudPremiereNotificationsService } from './cloud-premiere-notifications.service';
import { CloudEndingNotificationsService } from './cloud-ending-notifications.service';
import { CloudInterestRecommendationsService } from './cloud-interest-recommendations.service';
import { CloudInactivityNotificationsService } from './cloud-inactivity-notifications.service';
import { CloudMessagesGateway } from './cloud.gateway';
import { CloudService } from './cloud.service';
import { CloudTopicClassifierService } from './topic-classification/cloud-topic-classifier.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SocketIoRedisModule,
    PushNotificationsModule,
    ChatPresenceModule,
  ],
  controllers: [CloudController],
  providers: [
    CloudService,
    CloudMessagesGateway,
    CloudTopicClassifierService,
    CloudPremiereNotificationsService,
    CloudEndingNotificationsService,
    CloudInterestRecommendationsService,
    CloudInactivityNotificationsService,
  ],
  exports: [CloudTopicClassifierService],
})
export class CloudModule {}
