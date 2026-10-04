import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SocketTicketService } from './socket-ticket.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, SocketTicketService],
  exports: [AuthService, SocketTicketService],
})
export class AuthModule {}
