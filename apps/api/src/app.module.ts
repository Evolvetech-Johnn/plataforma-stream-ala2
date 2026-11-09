import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { HealthController } from './health.controller.js';
import { BroadcastsController } from './broadcasts.controller.js';
import { ViewerController } from './viewer.controller.js';
import { InternalController } from './internal.controller.js';
import { OperatorController } from './operator/operator.controller.js';
import { OperatorService } from './operator/operator.service.js';
import { OperatorGuard } from './operator/operator.guard.js';

@Module({
  controllers: [
    HealthController,
    BroadcastsController,
    ViewerController,
    InternalController,
    OperatorController,
  ],
  providers: [
    PrismaService,
    OperatorService,
    OperatorGuard,
  ],
})
export class AppModule {}
