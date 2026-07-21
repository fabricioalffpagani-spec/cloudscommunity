import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { CloudController } from './cloud.controller';
import { CloudService } from './cloud.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CloudController],
  providers: [CloudService],
})
export class CloudModule {}
