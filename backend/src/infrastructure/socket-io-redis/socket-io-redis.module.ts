import { Module } from '@nestjs/common';
import { SocketIoRedisService } from './socket-io-redis.service';

@Module({
  providers: [SocketIoRedisService],
  exports: [SocketIoRedisService],
})
export class SocketIoRedisModule {}
