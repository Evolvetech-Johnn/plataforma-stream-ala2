import { Body, Controller, Get, HttpException, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Controller('v1/viewer')
export class ViewerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('session')
  async session(@Req() req: Request) {
    const secret = req.cookies?.tv_session;
    if (typeof secret !== 'string' || !/^[a-zA-Z0-9_-]{40,64}$/.test(secret)) {
      return { authorized: false };
    }
    const session = await this.prisma.viewerSession.findUnique({
      where: { sessionHash: sha256(secret) },
      include: { invite: { include: { broadcast: true } } },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now ||
        session.invite.revokedAt || session.invite.expiresAt <= now ||
        ['ENDED', 'FAILED'].includes(session.invite.broadcast.status)) {
      return { authorized: false };
    }
    return { authorized: true, broadcastId: session.invite.broadcast.id };
  }

  @Post('redeem')
  async redeem(@Body() body: { token?: string }, @Res({ passthrough: true }) res: Response) {
    const token = body?.token;
    if (!token || !/^[a-zA-Z0-9_-]{32,128}$/.test(token)) {
      throw new HttpException('Convite inválido', HttpStatus.BAD_REQUEST);
    }
    const now = new Date();
    const tokenHash = sha256(token);
    const sessionSecret = randomBytes(32).toString('base64url');
    const sessionHash = sha256(sessionSecret);

    // Transação serializável impede resgates concorrentes acima do limite.
    // Implementar retry de conflito P2034 antes de disponibilizar em produção.
    const session = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.viewerInvite.findUnique({
        where: { tokenHash }, include: { broadcast: true },
      });
      if (!invite || invite.revokedAt || invite.expiresAt <= now || invite.uses >= invite.maxUses) {
        throw new HttpException('Convite expirado ou inválido', HttpStatus.FORBIDDEN);
      }
      if (['ENDED', 'FAILED'].includes(invite.broadcast.status)) {
        throw new HttpException('Reunião indisponível', HttpStatus.FORBIDDEN);
      }
      await tx.viewerInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
      const expiresAt = new Date(Math.min(invite.expiresAt.getTime(), now.getTime() + 3 * 60 * 60 * 1000));
      const created = await tx.viewerSession.create({
        data: { inviteId: invite.id, sessionHash, expiresAt },
      });
      return { created, broadcast: invite.broadcast };
    }, { isolationLevel: 'Serializable' });

    res.cookie('tv_session', sessionSecret, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/',
      expires: session.created.expiresAt,
    });
    return {
      broadcastId: session.broadcast.id,
      status: session.broadcast.status,
      streamPath: session.broadcast.streamPath,
    };
  }
}
