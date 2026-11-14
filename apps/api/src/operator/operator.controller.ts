import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OperatorService } from './operator.service.js';
import { OperatorGuard, Roles } from './operator.guard.js';
import { CsrfGuard } from '../common/csrf.guard.js';
import { SlidingWindowRateLimiter } from '../common/rate-limiter.js';
import {
  LoginDto,
  MfaVerifyDto,
  MfaEnableDto,
  MfaDisableDto,
  CreateBroadcastDto,
  CreateInviteDto,
} from './operator.dto.js';

@Controller('v1/operator')
export class OperatorController {
  // Limita tentativas de login do operador: 5 requisições por IP a cada 5 minutos
  private readonly loginLimiter = new SlidingWindowRateLimiter(5, 5 * 60 * 1000);

  constructor(private readonly operatorService: OperatorService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawIp = req.ip || req.header('x-forwarded-for') || '127.0.0.1';
    const clientIp = String(rawIp).split(',')[0].trim();

    const rateCheck = this.loginLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      throw new HttpException(
        `Muitas tentativas de login. Aguarde ${rateCheck.retryAfterSeconds} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const userAgent = req.header('user-agent') || undefined;

    const result = await this.operatorService.login(
      body.email,
      body.password,
      clientIp,
      userAgent,
    );

    if (result.mfaRequired) {
      return { mfaRequired: true, tempToken: result.tempToken };
    }

    // Reset rate limiter on successful login
    this.loginLimiter.reset(clientIp);

    res.cookie('op_session', result.session.sessionSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
      expires: result.session.expiresAt,
    });

    return {
      mfaRequired: false,
      user: result.session.user,
    };
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() body: MfaVerifyDto & { email: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawIp = req.ip || req.header('x-forwarded-for') || '127.0.0.1';
    const clientIp = String(rawIp).split(',')[0].trim();
    const userAgent = req.header('user-agent') || undefined;

    const session = await this.operatorService.verifyMfa(
      body.email,
      body.code,
      clientIp,
      userAgent,
    );

    this.loginLimiter.reset(clientIp);

    res.cookie('op_session', session.sessionSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
      expires: session.expiresAt,
    });

    return {
      user: session.user,
    };
  }

  @Post('mfa/setup')
  @UseGuards(OperatorGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async setupMfa(@Req() req: Request) {
    return this.operatorService.setupMfa(req.operatorUser!.id);
  }

  @Post('mfa/enable')
  @UseGuards(OperatorGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async enableMfa(@Body() body: MfaEnableDto, @Req() req: Request) {
    return this.operatorService.enableMfa(
      req.operatorUser!.id,
      body.secret,
      body.code,
    );
  }

  @Post('mfa/disable')
  @UseGuards(OperatorGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async disableMfa(@Body() body: MfaDisableDto, @Req() req: Request) {
    return this.operatorService.disableMfa(
      req.operatorUser!.id,
      body.password,
    );
  }

  @Post('logout')
  @UseGuards(OperatorGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.operatorUser) {
      await this.operatorService.logout(
        req.operatorUser.sessionId,
        req.operatorUser.id,
      );
    }

    res.clearCookie('op_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
    });

    return { success: true };
  }

  @Get('me')
  @UseGuards(OperatorGuard)
  me(@Req() req: Request) {
    return { user: req.operatorUser };
  }

  @Get('broadcasts')
  @UseGuards(OperatorGuard)
  async getBroadcasts(@Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.getBroadcasts(unitId);
  }

  @Post('broadcasts')
  @UseGuards(OperatorGuard, CsrfGuard)
  @Roles('ADMIN', 'OPERATOR')
  async createBroadcast(
    @Body() body: CreateBroadcastDto,
    @Req() req: Request,
  ) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.createBroadcast(
      unitId,
      body,
      req.operatorUser!.id,
    );
  }

  @Get('broadcasts/:id')
  @UseGuards(OperatorGuard)
  async getBroadcast(@Param('id') id: string, @Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.getBroadcast(id, unitId);
  }

  @Post('broadcasts/:id/start')
  @UseGuards(OperatorGuard, CsrfGuard)
  @Roles('ADMIN', 'OPERATOR')
  async startBroadcast(@Param('id') id: string, @Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.startBroadcast(
      id,
      unitId,
      req.operatorUser!.id,
    );
  }

  @Post('broadcasts/:id/pause')
  @UseGuards(OperatorGuard, CsrfGuard)
  @Roles('ADMIN', 'OPERATOR')
  async pauseBroadcast(@Param('id') id: string, @Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.pauseBroadcast(
      id,
      unitId,
      req.operatorUser!.id,
    );
  }

  @Post('broadcasts/:id/resume')
  @UseGuards(OperatorGuard, CsrfGuard)
  @Roles('ADMIN', 'OPERATOR')
  async resumeBroadcast(@Param('id') id: string, @Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.resumeBroadcast(
      id,
      unitId,
      req.operatorUser!.id,
    );
  }

  @Post('broadcasts/:id/end')
  @UseGuards(OperatorGuard, CsrfGuard)
  @Roles('ADMIN', 'OPERATOR')
  async endBroadcast(@Param('id') id: string, @Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.endBroadcast(id, unitId, req.operatorUser!.id);
  }

  @Post('broadcasts/:id/invites')
  @UseGuards(OperatorGuard, CsrfGuard)
  @Roles('ADMIN', 'OPERATOR')
  async createInvite(
    @Param('id') id: string,
    @Body() body: CreateInviteDto,
    @Req() req: Request,
  ) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.createInvite(
      id,
      unitId,
      req.operatorUser!.id,
      body,
    );
  }

  @Get('broadcasts/:id/invites')
  @UseGuards(OperatorGuard)
  async listInvites(@Param('id') id: string, @Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.listInvites(id, unitId);
  }

  @Delete('invites/:id')
  @UseGuards(OperatorGuard, CsrfGuard)
  @Roles('ADMIN', 'OPERATOR')
  async revokeInvite(@Param('id') id: string, @Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.revokeInvite(id, unitId, req.operatorUser!.id);
  }

  @Get('stream-health')
  @UseGuards(OperatorGuard)
  async getStreamHealth(@Query('streamPath') streamPath?: string) {
    return this.operatorService.getStreamHealth(streamPath);
  }

  @Get('audit')
  @UseGuards(OperatorGuard)
  async getAuditLogs(
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.getAuditLogs(
      unitId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('purge-expired')
  @UseGuards(OperatorGuard, CsrfGuard)
  @Roles('ADMIN')
  async purgeExpired(@Req() req: Request, @Query('days') days?: string) {
    const daysToKeep = days ? parseInt(days, 10) : 7;
    return this.operatorService.purgeExpiredData(req.operatorUser!.id, daysToKeep);
  }
}
