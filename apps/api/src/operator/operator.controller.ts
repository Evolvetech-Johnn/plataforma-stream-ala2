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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  OperatorService,
} from './operator.service.js';
import {
  OperatorGuard,
  Roles,
} from './operator.guard.js';
import {
  LoginDto,
  MfaVerifyDto,
  CreateBroadcastDto,
  CreateInviteDto,
} from './operator.dto.js';

@Controller('v1/operator')
export class OperatorController {
  constructor(private readonly operatorService: OperatorService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.header('x-forwarded-for') || undefined;
    const userAgent = req.header('user-agent') || undefined;

    const result = await this.operatorService.login(
      body.email,
      body.password,
      ip,
      userAgent,
    );

    if (result.mfaRequired) {
      return { mfaRequired: true, tempToken: result.tempToken };
    }

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
    const ip = req.ip || req.header('x-forwarded-for') || undefined;
    const userAgent = req.header('user-agent') || undefined;

    const session = await this.operatorService.verifyMfa(
      body.email,
      body.code,
      ip,
      userAgent,
    );

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

  @Post('logout')
  @UseGuards(OperatorGuard)
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
  @UseGuards(OperatorGuard)
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
  @UseGuards(OperatorGuard)
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
  @UseGuards(OperatorGuard)
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
  @UseGuards(OperatorGuard)
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
  @UseGuards(OperatorGuard)
  @Roles('ADMIN', 'OPERATOR')
  async endBroadcast(@Param('id') id: string, @Req() req: Request) {
    const unitId = req.operatorUser!.memberships[0]?.unitId;
    return this.operatorService.endBroadcast(id, unitId, req.operatorUser!.id);
  }

  @Post('broadcasts/:id/invites')
  @UseGuards(OperatorGuard)
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
  @UseGuards(OperatorGuard)
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
}
