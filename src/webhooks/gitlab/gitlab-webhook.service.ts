import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import type {
  GitLabCommit,
  GitLabPushHook,
} from './interfaces/gitlab-push-hook.interface';

const ZERO_SHA = '0000000000000000000000000000000000000000';
const MAX_COMMITS = 5;
const MAX_LONGITUD_COMMIT = 120;

export type TipoEventoGitLab =
  | 'rama_nueva'
  | 'push'
  | 'rama_eliminada'
  | 'ignorado';

export interface ResultadoWebhook {
  recibido: boolean;
  notificado: boolean;
  evento: TipoEventoGitLab;
  rama?: string;
  proyecto?: string;
  motivo?: string;
}

@Injectable()
export class GitLabWebhookService {
  private readonly logger = new Logger(GitLabWebhookService.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  async procesarPush(payload: GitLabPushHook): Promise<ResultadoWebhook> {
    const proyecto =
      payload.project?.path_with_namespace?.trim() ||
      payload.project?.name?.trim() ||
      'proyecto desconocido';
    const rama = this.obtenerNombreRama(payload.ref);

    // GitLab también envía Tag Push Hook; este endpoint sólo notifica ramas.
    if (payload.object_kind && payload.object_kind !== 'push') {
      this.logger.log(
        `Evento GitLab '${payload.object_kind}' ignorado (${proyecto}/${rama}).`,
      );
      return {
        recibido: true,
        notificado: false,
        evento: 'ignorado',
        rama,
        proyecto,
        motivo: `Evento '${payload.object_kind}' no soportado`,
      };
    }

    // after en cero = la rama se eliminó: GitLab lo reporta como Push Hook.
    if (payload.after === ZERO_SHA) {
      this.logger.log(`Rama eliminada ignorada (${proyecto}/${rama}).`);
      return {
        recibido: true,
        notificado: false,
        evento: 'rama_eliminada',
        rama,
        proyecto,
      };
    }

    const esRamaNueva = payload.before === ZERO_SHA;
    const mensaje = esRamaNueva
      ? this.construirMensajeRamaNueva(payload, proyecto, rama)
      : this.construirMensajePush(payload, proyecto, rama);

    const resultado = await this.enviarNotificacion(mensaje);

    return {
      ...resultado,
      evento: esRamaNueva ? 'rama_nueva' : 'push',
      rama,
      proyecto,
    };
  }

  private obtenerNombreRama(ref?: string): string {
    if (!ref?.trim()) return 'desconocida';
    return ref.replace(/^refs\/heads\//, '');
  }

  private construirMensajeRamaNueva(
    payload: GitLabPushHook,
    proyecto: string,
    rama: string,
  ): string {
    const creador = payload.user_name?.trim() || 'un usuario';
    const enlace = payload.project?.web_url?.trim() || 'sin enlace';

    return [
      '🌱 *Nueva rama en GitLab*',
      `• *Proyecto:* ${proyecto}`,
      `• *Rama:* \`${rama}\``,
      `• *Creada por:* ${creador}`,
      `• *Enlace:* ${enlace}`,
    ].join('\n');
  }

  private construirMensajePush(
    payload: GitLabPushHook,
    proyecto: string,
    rama: string,
  ): string {
    const autor = payload.user_name?.trim() || 'un usuario';
    const enlace = payload.project?.web_url?.trim() || 'sin enlace';
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    const visibles = commits.slice(0, MAX_COMMITS);
    const total = payload.total_commits_count ?? commits.length;

    const lineasCommits = visibles.map(
      (commit: GitLabCommit) => `  - ${this.limpiarMensajeCommit(commit.message)}`,
    );

    if (total > visibles.length) {
      const restantes = total - visibles.length;
      lineasCommits.push(
        `  - _... y ${restantes} commit${restantes === 1 ? '' : 's'} más_`,
      );
    }

    if (lineasCommits.length === 0) {
      lineasCommits.push('  - _Sin mensajes de commit_');
    }

    return [
      '🚀 *Nuevo Push en GitLab*',
      `• *Proyecto:* ${proyecto}`,
      `• *Rama:* \`${rama}\``,
      `• *Autor:* ${autor}`,
      '• *Commits:*',
      ...lineasCommits,
      `• *Enlace:* ${enlace}`,
    ].join('\n');
  }

  private limpiarMensajeCommit(mensaje?: string): string {
    const texto = mensaje?.trim();
    if (!texto) return '(sin mensaje)';

    // Sólo la primera línea, en una sola línea y con longitud acotada.
    const primeraLinea = texto.split(/\r?\n/)[0].replace(/\s+/g, ' ').trim();

    return primeraLinea.length > MAX_LONGITUD_COMMIT
      ? `${primeraLinea.slice(0, MAX_LONGITUD_COMMIT - 1)}…`
      : primeraLinea;
  }

  private async enviarNotificacion(
    mensaje: string,
  ): Promise<Pick<ResultadoWebhook, 'recibido' | 'notificado' | 'motivo'>> {
    const destinatario = process.env.GITLAB_NOTIFY_TO?.trim();

    if (!destinatario) {
      this.logger.error(
        'No se envió la notificación: falta la variable GITLAB_NOTIFY_TO.',
      );
      return {
        recibido: true,
        notificado: false,
        motivo: 'GITLAB_NOTIFY_TO no está configurado',
      };
    }

    try {
      // Los JID (@g.us / @s.whatsapp.net) van directo; los números se
      // normalizan con el método de texto existente de WhatsappService.
      if (destinatario.includes('@')) {
        await this.whatsappService.enviarMensajeAGrupo(destinatario, mensaje);
      } else {
        await this.whatsappService.enviarMensajeTexto(destinatario, mensaje);
      }

      this.logger.log(`Notificación de GitLab enviada a ${destinatario}.`);
      return { recibido: true, notificado: true };
    } catch (error) {
      this.logger.error(
        `Error al enviar notificación de GitLab a ${destinatario}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        recibido: true,
        notificado: false,
        motivo:
          'No se pudo enviar el mensaje por WhatsApp (Baileys puede estar desconectado)',
      };
    }
  }
}
