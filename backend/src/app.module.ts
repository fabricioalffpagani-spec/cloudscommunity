import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { AuthModule } from './auth/auth.module';
import { CloudModule } from './clouds/cloud.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, CloudModule, UsersModule],
  controllers: [AppController, HealthController],
  providers: [AppService, HealthService],
})
export class AppModule {}
