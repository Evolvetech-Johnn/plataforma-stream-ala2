import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { HealthController } from './health.controller.js';
import { BroadcastsController } from './broadcasts.controller.js';
import { ViewerController } from './viewer.controller.js';
import { InternalController } from './internal.controller.js';

@Module({
  controllers: [HealthController, BroadcastsController, ViewerController, InternalController],
  providers: [PrismaService],
})
export class AppModule {}
