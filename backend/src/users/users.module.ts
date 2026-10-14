import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DirectMessagesModule } from '../direct-messages/direct-messages.module';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { PushNotificationsModule } from '../infrastructure/push/push-notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PushNotificationsModule,
    DirectMessagesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
