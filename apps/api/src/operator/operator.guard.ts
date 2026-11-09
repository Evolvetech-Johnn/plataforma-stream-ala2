import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'ADMIN' | 'OPERATOR' | 'READ_ONLY'>) =>
  SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedOperator {
  id: string;
  email: string;
  displayName: string;
  sessionId: string;
  memberships: Array<{
    unitId: string;
    role: 'ADMIN' | 'OPERATOR' | 'READ_ONLY';
  }>;
}

declare global {
  namespace Express {
    interface Request {
      operatorUser?: AuthenticatedOperator;
    }
  }
}

@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const sessionCookie = req.cookies?.op_session;

    if (
      typeof sessionCookie !== 'string' ||
      !/^[a-zA-Z0-9_-]{40,64}$/.test(sessionCookie)
    ) {
      throw new UnauthorizedException('Sessão de operador ausente ou inválida');
    }

    const sessionHash = createHash('sha256').update(sessionCookie).digest('hex');
    const now = new Date();

    const session = await this.prisma.operatorSession.findUnique({
      where: { sessionHash },
      include: {
        user: {
          include: {
            memberships: true,
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.user.enabled
    ) {
      throw new UnauthorizedException('Sessão expirada ou revogada');
    }

    req.operatorUser = {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      sessionId: session.id,
      memberships: session.user.memberships.map((m) => ({
        unitId: m.unitId,
        role: m.role,
      })),
    };

    const requiredRoles = this.reflector.getAllAndOverride<
      Array<'ADMIN' | 'OPERATOR' | 'READ_ONLY'>
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRole = req.operatorUser.memberships.some((m) =>
      requiredRoles.includes(m.role),
    );

    if (!hasRole) {
      throw new ForbiddenException('Acesso negado para o seu perfil');
    }

    return true;
  }
}
