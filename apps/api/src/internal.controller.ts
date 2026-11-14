import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { PrismaService } from './prisma.service.js';

@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('hls-authorize')
  async authorize(@Req() req: Request, @Res() res: Response) {
    const secret = req.cookies?.tv_session;
    // forward_auth passa a URI original (já sem o prefixo /hls no handle_path).
    const path = String(req.header('X-Forwarded-Uri') ?? '').split('?')[0];
    if (typeof secret !== 'string' || !/^[a-zA-Z0-9_-]{40,64}$/.test(secret) ||
        !/^\/(?:hls\/)?ala01\/(?:[a-zA-Z0-9_.-]+)$/.test(path)) {
      return res.status(403).send();
    }
    const sessionHash = createHash('sha256').update(secret).digest('hex');
    const now = new Date();
    const session = await this.prisma.viewerSession.findUnique({
      where: { sessionHash },
      include: { invite: { include: { broadcast: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= now ||
        session.invite.revokedAt || session.invite.expiresAt <= now ||
        session.invite.broadcast.streamPath !== 'ala01' ||
        session.invite.broadcast.status !== 'LIVE') {
      return res.status(403).send();
    }
    return res.status(204).send();
  }
}
