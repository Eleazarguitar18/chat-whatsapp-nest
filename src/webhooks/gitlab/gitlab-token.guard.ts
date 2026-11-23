import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Valida el header `x-gitlab-token` (Secret Token configurado en GitLab)
 * contra la variable de entorno GITLAB_WEBHOOK_SECRET.
 */
@Injectable()
export class GitLabTokenGuard implements CanActivate {
  private readonly logger = new Logger(GitLabTokenGuard.name);
  private advertenciaEmitida = false;

  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.GITLAB_WEBHOOK_SECRET;
    const request = context.switchToHttp().getRequest<Request>();
    const rawToken = request.headers['x-gitlab-token'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    // Si no hay secreto configurado, el webhook queda abierto. Se avisa una
    // sola vez para no llenar los logs con cada petición.
    if (!secret) {
      if (!this.advertenciaEmitida) {
        this.logger.warn(
          'GITLAB_WEBHOOK_SECRET no está configurado: POST /api/webhooks/gitlab aceptará peticiones sin verificación de token.',
        );
        this.advertenciaEmitida = true;
      }
      return true;
    }

    if (!token || !this.tokenCoincide(token, secret)) {
      throw new UnauthorizedException('Token de GitLab inválido o ausente');
    }

    return true;
  }

  private tokenCoincide(token: string, secret: string): boolean {
    const recibido = Buffer.from(token, 'utf8');
    const esperado = Buffer.from(secret, 'utf8');

    // timingSafeEqual exige buffers del mismo tamaño.
    if (recibido.length !== esperado.length) {
      return false;
    }

    return timingSafeEqual(recibido, esperado);
  }
}
