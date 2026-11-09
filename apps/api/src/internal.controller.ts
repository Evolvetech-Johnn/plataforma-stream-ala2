import { Controller, Get, Req, Res, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { PrismaService } from './prisma.service.js';

@Controller('internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('hls-authorize')
  async authorize(@Req() req: Request, @Res() res: Response) {
    try {
      const secret = req.cookies?.tv_session;
      const forwardedUri = req.header('X-Forwarded-Uri') ?? req.url;
      const path = String(forwardedUri).split('?')[0];

      // Formato esperado: /hls/<streamPath>/<file> ou /<streamPath>/<file>
      const match = path.match(/^\/(?:hls\/)?([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
      if (!match) {
        return res.status(403).send();
      }

      const [, requestedStreamPath, fileName] = match;

      // Validação de extensão de manifesto e fragmentos HLS
      if (!/\.(m3u8|ts|m4s|mp4)$/i.test(fileName)) {
        return res.status(403).send();
      }

      // Validação de formato do cookie
      if (typeof secret !== 'string' || !/^[a-zA-Z0-9_-]{40,64}$/.test(secret)) {
        return res.status(403).send();
      }

      const sessionHash = createHash('sha256').update(secret).digest('hex');
      const now = new Date();

      const session = await this.prisma.viewerSession.findUnique({
        where: { sessionHash },
        include: {
          invite: {
            include: { broadcast: true },
          },
        },
      });

      // Validações rigorosas de sessão e transmissão
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= now ||
        session.invite.revokedAt ||
        session.invite.expiresAt <= now ||
        session.invite.broadcast.streamPath !== requestedStreamPath ||
        session.invite.broadcast.status !== 'LIVE'
      ) {
        return res.status(403).send();
      }

      // Acesso permitido
      return res.status(204).send();
    } catch (err) {
      // INVARIANTE: Falha fechada (fail-closed).
      // Qualquer erro de BD ou exceção resulta em negação 403, nunca liberação.
      this.logger.warn(`HLS auth fail-closed error: ${err instanceof Error ? err.message : 'Unknown'}`);
      return res.status(403).send();
    }
  }
}
