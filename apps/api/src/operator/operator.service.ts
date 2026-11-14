import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { authenticator } from 'otplib';

export interface OperatorSessionResult {
  sessionSecret: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    displayName: string;
    memberships: Array<{ unitId: string; role: string }>;
  };
}

@Injectable()
export class OperatorService {
  constructor(private readonly prisma: PrismaService) {}

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async login(
    email: string,
    passwordPlain: string,
    ip?: string,
    userAgent?: string,
  ): Promise<
    | { mfaRequired: true; tempToken: string }
    | { mfaRequired: false; session: OperatorSessionResult }
  > {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { memberships: true },
    });

    if (!user || !user.enabled || !user.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValid = await argon2.verify(user.passwordHash, passwordPlain);
    if (!passwordValid) {
      await this.prisma.auditEvent.create({
        data: {
          action: 'OPERATOR_LOGIN_FAILED_PASSWORD',
          actorId: user.id,
          details: { ip: ip ?? 'unknown' },
        },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.mfaEnabled && user.mfaSecret) {
      const tempToken = randomBytes(24).toString('hex');
      return { mfaRequired: true, tempToken };
    }

    const session = await this.createOperatorSession(user, ip, userAgent);
    return { mfaRequired: false, session };
  }

  async verifyMfa(
    email: string,
    code: string,
    ip?: string,
    userAgent?: string,
  ): Promise<OperatorSessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { memberships: true },
    });

    if (!user || !user.enabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA não habilitado ou usuário inválido');
    }

    const isValid = authenticator.verify({
      token: code.trim(),
      secret: user.mfaSecret,
    });

    if (!isValid) {
      await this.prisma.auditEvent.create({
        data: {
          action: 'OPERATOR_MFA_FAILED',
          actorId: user.id,
          details: { ip: ip ?? 'unknown' },
        },
      });
      throw new UnauthorizedException('Código MFA inválido');
    }

    return this.createOperatorSession(user, ip, userAgent);
  }

  private async createOperatorSession(
    user: {
      id: string;
      email: string;
      displayName: string;
      memberships: Array<{ unitId: string; role: string }>;
    },
    ip?: string,
    userAgent?: string,
  ): Promise<OperatorSessionResult> {
    const sessionSecret = randomBytes(32).toString('base64url');
    const sessionHash = this.sha256(sessionSecret);
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 horas

    await this.prisma.operatorSession.create({
      data: {
        userId: user.id,
        sessionHash,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'OPERATOR_LOGIN_SUCCESS',
        actorId: user.id,
        unitId: user.memberships[0]?.unitId,
        details: { ip: ip ?? 'unknown', userAgent: userAgent ?? 'unknown' },
      },
    });

    return {
      sessionSecret,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        memberships: user.memberships.map((m) => ({
          unitId: m.unitId,
          role: m.role,
        })),
      },
    };
  }

  async logout(sessionId: string, actorId: string): Promise<void> {
    await this.prisma.operatorSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'OPERATOR_LOGOUT',
        actorId,
      },
    });
  }

  async getBroadcasts(unitId: string) {
    return this.prisma.broadcast.findMany({
      where: { unitId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        _count: {
          select: { invites: true },
        },
      },
    });
  }

  async getBroadcast(id: string, unitId: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, unitId },
      include: {
        invites: {
          select: {
            id: true,
            maxUses: true,
            uses: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
            _count: { select: { sessions: true } },
          },
        },
      },
    });

    if (!broadcast) throw new NotFoundException('Transmissão não encontrada');
    return broadcast;
  }

  async createBroadcast(
    unitId: string,
    data: { title: string; scheduledAt: string; streamPath?: string },
    actorId: string,
  ) {
    const scheduledDate = new Date(data.scheduledAt);
    const slug = `reuniao-${scheduledDate.toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`;

    const created = await this.prisma.broadcast.create({
      data: {
        unitId,
        slug,
        title: data.title,
        scheduledAt: scheduledDate,
        streamPath: data.streamPath?.trim() || 'ala01',
        status: 'SCHEDULED',
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'BROADCAST_CREATED',
        actorId,
        unitId,
        broadcastId: created.id,
        details: { title: created.title, slug: created.slug },
      },
    });

    return created;
  }

  async startBroadcast(id: string, unitId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.broadcast.findFirst({ where: { id, unitId } });
      if (!current) throw new NotFoundException('Transmissão não encontrada');

      if (!['SCHEDULED', 'READY'].includes(current.status)) {
        throw new BadRequestException(
          `Não é possível iniciar transmissão em estado ${current.status}`,
        );
      }

      // Garante que nenhuma outra transmissão esteja LIVE ou PAUSED
      const activeOther = await tx.broadcast.findFirst({
        where: {
          unitId,
          id: { not: id },
          status: { in: ['READY', 'LIVE', 'PAUSED'] },
        },
      });

      if (activeOther) {
        throw new ConflictException(
          `Já existe uma transmissão ativa nesta unidade (${activeOther.title})`,
        );
      }

      const updated = await tx.broadcast.update({
        where: { id },
        data: {
          status: 'LIVE',
          startedAt: current.startedAt ?? new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'BROADCAST_STARTED_LIVE',
          actorId,
          unitId,
          broadcastId: id,
        },
      });

      return updated;
    });
  }

  async pauseBroadcast(id: string, unitId: string, actorId: string) {
    const current = await this.prisma.broadcast.findFirst({
      where: { id, unitId },
    });
    if (!current) throw new NotFoundException('Transmissão não encontrada');

    if (current.status !== 'LIVE') {
      throw new BadRequestException(
        `Transmissão não está AO VIVO (estado atual: ${current.status})`,
      );
    }

    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: { status: 'PAUSED' },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'BROADCAST_PAUSED_SACRAMENT',
        actorId,
        unitId,
        broadcastId: id,
      },
    });

    return updated;
  }

  async resumeBroadcast(id: string, unitId: string, actorId: string) {
    const current = await this.prisma.broadcast.findFirst({
      where: { id, unitId },
    });
    if (!current) throw new NotFoundException('Transmissão não encontrada');

    if (current.status !== 'PAUSED') {
      throw new BadRequestException(
        `Transmissão não está pausada (estado atual: ${current.status})`,
      );
    }

    const updated = await this.prisma.broadcast.update({
      where: { id },
      data: { status: 'LIVE' },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'BROADCAST_RESUMED_LIVE',
        actorId,
        unitId,
        broadcastId: id,
      },
    });

    return updated;
  }

  async endBroadcast(id: string, unitId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.broadcast.findFirst({ where: { id, unitId } });
      if (!current) throw new NotFoundException('Transmissão não encontrada');

      if (['ENDED', 'FAILED'].includes(current.status)) {
        throw new BadRequestException('Transmissão já finalizada');
      }

      const updated = await tx.broadcast.update({
        where: { id },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
        },
      });

      // Revoga imediatamente todas as sessões ativas desta transmissão
      await tx.viewerSession.updateMany({
        where: {
          invite: { broadcastId: id },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await tx.auditEvent.create({
        data: {
          action: 'BROADCAST_ENDED_DEFINITIVE',
          actorId,
          unitId,
          broadcastId: id,
        },
      });

      return updated;
    });
  }

  async createInvite(
    broadcastId: string,
    unitId: string,
    actorId: string,
    options?: { maxUses?: number; expiresInHours?: number },
  ) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId, unitId },
    });
    if (!broadcast) throw new NotFoundException('Transmissão não encontrada');

    if (['ENDED', 'FAILED'].includes(broadcast.status)) {
      throw new BadRequestException(
        'Não é possível criar convites para transmissão finalizada',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.sha256(token);
    const maxUses = options?.maxUses ?? 2;
    const expiresInHours = options?.expiresInHours ?? 4;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const created = await this.prisma.viewerInvite.create({
      data: {
        broadcastId,
        tokenHash,
        maxUses,
        expiresAt,
        createdById: actorId,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'INVITE_CREATED',
        actorId,
        unitId,
        broadcastId,
        details: { inviteId: created.id, maxUses, expiresAt },
      },
    });

    return {
      token, // Exibido UMA ÚNICA VEZ ao operador
      id: created.id,
      maxUses: created.maxUses,
      expiresAt: created.expiresAt,
    };
  }

  async listInvites(broadcastId: string, unitId: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId, unitId },
    });
    if (!broadcast) throw new NotFoundException('Transmissão não encontrada');

    return this.prisma.viewerInvite.findMany({
      where: { broadcastId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        maxUses: true,
        uses: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
    });
  }

  async revokeInvite(inviteId: string, unitId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.viewerInvite.findFirst({
        where: { id: inviteId, broadcast: { unitId } },
      });
      if (!invite) throw new NotFoundException('Convite não encontrado');

      const updated = await tx.viewerInvite.update({
        where: { id: inviteId },
        data: { revokedAt: new Date() },
      });

      await tx.viewerSession.updateMany({
        where: { inviteId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditEvent.create({
        data: {
          action: 'INVITE_REVOKED',
          actorId,
          unitId,
          broadcastId: invite.broadcastId,
          details: { inviteId },
        },
      });

      return updated;
    });
  }

  async getStreamHealth(streamPath = 'ala01') {
    const mtxApiUrl = process.env.MEDIAMTX_API_URL || 'http://mediamtx:9997';
    try {
      const res = await fetch(`${mtxApiUrl}/v3/paths/get/${streamPath}`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        return {
          srtConnected: false,
          hlsAvailable: false,
          message: 'Canal MediaMTX sem sinal ativo do encoder',
        };
      }

      const data = (await res.json()) as {
        name?: string;
        source?: { type?: string; id?: string };
        readers?: unknown[];
        tracks?: unknown[];
      };

      const srtConnected = Boolean(data.source && data.source.type);

      return {
        srtConnected,
        hlsAvailable: srtConnected,
        sourceType: data.source?.type ?? null,
        readersCount: data.readers?.length ?? 0,
        tracks: data.tracks ?? [],
      };
    } catch {
      return {
        srtConnected: false,
        hlsAvailable: false,
        message: 'Origem MediaMTX indisponível ou aguardando sinal SRT',
      };
    }
  }

  async getAuditLogs(unitId: string, limit = 50) {
    return this.prisma.auditEvent.findMany({
      where: { unitId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        actor: {
          select: { displayName: true, email: true },
        },
        broadcast: {
          select: { title: true },
        },
      },
    });
  }

  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'TransmissaoAla', secret);

    return { secret, otpauthUrl };
  }

  async enableMfa(userId: string, secret: string, code: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const isValid = authenticator.verify({
      token: code.trim(),
      secret: secret.trim(),
    });

    if (!isValid) {
      throw new BadRequestException('Código de verificação TOTP inválido. O MFA não foi ativado.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret.trim(),
        mfaEnabled: true,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'OPERATOR_MFA_ENABLED',
        actorId: userId,
      },
    });

    return { success: true };
  }

  async disableMfa(userId: string, passwordPlain: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new NotFoundException('Usuário não encontrado');

    const passwordValid = await argon2.verify(user.passwordHash, passwordPlain);
    if (!passwordValid) {
      throw new UnauthorizedException('Senha incorreta para desativar o MFA');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: null,
        mfaEnabled: false,
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        action: 'OPERATOR_MFA_DISABLED',
        actorId: userId,
      },
    });

    return { success: true };
  }

  async purgeExpiredData(actorId: string, daysToKeep = 7) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const deletedViewerSessions = await tx.viewerSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: cutoffDate } },
            { revokedAt: { lt: cutoffDate } },
          ],
        },
      });

      const deletedInvites = await tx.viewerInvite.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: cutoffDate } },
            { revokedAt: { lt: cutoffDate } },
          ],
        },
      });

      const deletedOperatorSessions = await tx.operatorSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: cutoffDate } },
            { revokedAt: { lt: cutoffDate } },
          ],
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'DATA_PURGED_LGPD',
          actorId,
          details: {
            cutoffDate,
            deletedViewerSessions: deletedViewerSessions.count,
            deletedInvites: deletedInvites.count,
            deletedOperatorSessions: deletedOperatorSessions.count,
          },
        },
      });

      return {
        deletedViewerSessions: deletedViewerSessions.count,
        deletedInvites: deletedInvites.count,
        deletedOperatorSessions: deletedOperatorSessions.count,
      };
    });
  }
}

