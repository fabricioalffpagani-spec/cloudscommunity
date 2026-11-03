import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SocketTicketService } from './socket-ticket.service';
import { PushNotificationsModule } from '../infrastructure/push/push-notifications.module';
import { GoogleAuthService } from './google-auth.service';

@Module({
  imports: [PrismaModule, PushNotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleAuthService, SocketTicketService],
  exports: [AuthService, SocketTicketService],
})
export class AuthModule {}
