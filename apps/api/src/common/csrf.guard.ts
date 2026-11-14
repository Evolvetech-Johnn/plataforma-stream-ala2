import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    if (safeMethods.includes(req.method)) {
      return true;
    }

    // Requisições com cookies autenticados exigem cabeçalho customizado anti-CSRF.
    // Navegadores impedem que requisições cross-origin simples injetem esse cabeçalho sem pré-flight CORS.
    const requestedWith = req.header('x-requested-with');
    const csrfToken = req.header('x-csrf-token');

    if (!requestedWith && !csrfToken) {
      throw new ForbiddenException(
        'Requisição bloqueada por política anti-CSRF (cabeçalho de proteção ausente)',
      );
    }

    return true;
  }
}

