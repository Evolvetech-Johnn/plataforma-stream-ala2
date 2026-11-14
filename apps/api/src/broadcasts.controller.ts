import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Controller('v1/broadcasts')
export class BroadcastsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('current')
  async current() {
    const b = await this.prisma.broadcast.findFirst({
      where: { status: { in: ['SCHEDULED', 'READY', 'LIVE', 'PAUSED'] } },
      orderBy: { scheduledAt: 'desc' },
      select: { id: true, title: true, status: true, scheduledAt: true },
    });
    return b ?? { status: 'NONE' };
  }
}
