import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service.js';
import { SlidingWindowRateLimiter } from './common/rate-limiter.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Controller('v1/viewer')
export class ViewerController {
  private readonly redeemLimiter = new SlidingWindowRateLimiter(10, 60 * 1000);

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
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.invite.revokedAt ||
      session.invite.expiresAt <= now ||
      ['ENDED', 'FAILED'].includes(session.invite.broadcast.status)
    ) {
      return { authorized: false };
    }
    return {
      authorized: true,
      broadcastId: session.invite.broadcast.id,
      status: session.invite.broadcast.status,
      streamPath: session.invite.broadcast.streamPath,
    };
  }

  @Post('redeem')
  async redeem(
    @Body() body: { token?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = (req.ip || req.header('x-forwarded-for') || '127.0.0.1').split(',')[0].trim();
    const rateCheck = this.redeemLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      throw new HttpException(
        `Muitas tentativas de validação. Aguarde ${rateCheck.retryAfterSeconds} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = body?.token;
    if (!token || !/^[a-zA-Z0-9_-]{32,128}$/.test(token)) {
      throw new HttpException('Convite inválido', HttpStatus.BAD_REQUEST);
    }

    const now = new Date();
    const tokenHash = sha256(token);
    const sessionSecret = randomBytes(32).toString('base64url');
    const sessionHash = sha256(sessionSecret);

    // Transação serializável com retry para conflito P2034
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: unknown;

    while (attempts < maxAttempts) {
      attempts += 1;
      try {
        const session = await this.prisma.$transaction(
          async (tx) => {
            const invite = await tx.viewerInvite.findUnique({
              where: { tokenHash },
              include: { broadcast: true },
            });

            if (
              !invite ||
              invite.revokedAt ||
              invite.expiresAt <= now ||
              invite.uses >= invite.maxUses
            ) {
              throw new HttpException(
                'Convite expirado ou inválido',
                HttpStatus.FORBIDDEN,
              );
            }

            if (['ENDED', 'FAILED'].includes(invite.broadcast.status)) {
              throw new HttpException('Reunião indisponível', HttpStatus.FORBIDDEN);
            }

            await tx.viewerInvite.update({
              where: { id: invite.id },
              data: { uses: { increment: 1 } },
            });

            const expiresAt = new Date(
              Math.min(
                invite.expiresAt.getTime(),
                now.getTime() + 3 * 60 * 60 * 1000,
              ),
            );

            const created = await tx.viewerSession.create({
              data: { inviteId: invite.id, sessionHash, expiresAt },
            });

            return { created, broadcast: invite.broadcast };
          },
          { isolationLevel: 'Serializable' },
        );

        res.cookie('tv_session', sessionSecret, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          expires: session.created.expiresAt,
        });

        return {
          broadcastId: session.broadcast.id,
          status: session.broadcast.status,
          streamPath: session.broadcast.streamPath,
        };
      } catch (err: any) {
        lastError = err;
        // P2034: Transaction failed due to write conflict or deadlock
        if (err?.code === 'P2034' && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, attempts)));
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const secret = req.cookies?.tv_session;
    if (typeof secret === 'string' && /^[a-zA-Z0-9_-]{40,64}$/.test(secret)) {
      const sessionHash = sha256(secret);
      await this.prisma.viewerSession
        .update({
          where: { sessionHash },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});
    }

    res.clearCookie('tv_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  }
}
