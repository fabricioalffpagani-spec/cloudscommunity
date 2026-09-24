import { Module } from '@nestjs/common';
import { CloudModule } from '../clouds/cloud.module';
import { DirectMessagesModule } from '../direct-messages/direct-messages.module';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { ClouderService } from './clouder.service';

@Module({
  imports: [PrismaModule, CloudModule, DirectMessagesModule],
  providers: [ClouderService],
})
export class ClouderModule {}
