import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const { method, originalUrl } = req;
    const startTime = Date.now();
    const rawIp = req.ip || req.header('x-forwarded-for') || '127.0.0.1';
    const clientIp = String(rawIp).split(',')[0].trim();

    // Sanitiza caminho removendo tokens de query string se houver
    const sanitizedPath = originalUrl.split('?')[0];

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;
          this.logger.log(
            `[${method}] ${sanitizedPath} ${statusCode} - ${duration}ms - IP: ${clientIp}`,
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const status = err?.status || 500;
          this.logger.warn(
            `[${method}] ${sanitizedPath} ${status} - ${duration}ms - IP: ${clientIp} - ${err?.message || 'Error'}`,
          );
        },
      }),
    );
  }
}

