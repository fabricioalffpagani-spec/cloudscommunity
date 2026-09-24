import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { SocketIoRedisModule } from '../infrastructure/socket-io-redis/socket-io-redis.module';
import { CloudController } from './cloud.controller';
import { CloudMessagesGateway } from './cloud.gateway';
import { CloudService } from './cloud.service';
import { CloudTopicClassifierService } from './topic-classification/cloud-topic-classifier.service';

@Module({
  imports: [PrismaModule, AuthModule, SocketIoRedisModule],
  controllers: [CloudController],
  providers: [CloudService, CloudMessagesGateway, CloudTopicClassifierService],
  exports: [CloudTopicClassifierService],
})
export class CloudModule {}
