import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import type { GitLabSystemHook } from './interfaces/gitlab-system-hook.interface';

export type EventoSystemHook =
  | 'proyecto_creado'
  | 'proyecto_eliminado'
  | 'usuario_creado'
  | 'grupo_creado'
  | 'ignorado';

export interface ResultadoSystemHook {
  recibido: boolean;
  notificado: boolean;
  evento: EventoSystemHook;
  eventoGitLab?: string;
  motivo?: string;
}

@Injectable()
export class GitLabSystemHookService {
  private readonly logger = new Logger(GitLabSystemHookService.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  async procesarSystemHook(
    payload: GitLabSystemHook,
  ): Promise<ResultadoSystemHook> {
    const eventoGitLab =
      payload.event_name?.trim() ||
      payload.object_kind?.trim() ||
      'desconocido';

    const { evento, mensaje, motivo } = this.resolverEvento(payload, eventoGitLab);

    if (!mensaje) {
      this.logger.log(`${motivo} (evento: ${eventoGitLab}).`);
      return {
        recibido: true,
        notificado: false,
        evento,
        eventoGitLab,
        motivo,
      };
    }

    const resultado = await this.enviarNotificacion(mensaje);

    return {
      ...resultado,
      evento,
      eventoGitLab,
    };
  }

  private resolverEvento(
    payload: GitLabSystemHook,
    eventoGitLab: string,
  ): {
    evento: EventoSystemHook;
    mensaje?: string;
    motivo?: string;
  } {
    const evento = payload.event_name?.trim() || '';
    const objectKind = payload.object_kind?.trim() || '';

    // Si GitLab no envía event_name, object_kind='project' se considera creación.
    if (evento === 'project_create' || (!evento && objectKind === 'project')) {
      return {
        evento: 'proyecto_creado',
        mensaje: [
          '📦 *Nuevo proyecto en GitLab*',
          `• *Proyecto:* ${this.obtenerProyecto(payload)}`,
          `• *Creado por:* ${this.obtenerCreador(payload)}`,
        ].join('\n'),
      };
    }

    if (evento === 'project_destroy') {
      return {
        evento: 'proyecto_eliminado',
        mensaje: [
          '🗑️ *Proyecto eliminado en GitLab*',
          `• *Proyecto:* ${this.obtenerProyecto(payload)}`,
        ].join('\n'),
      };
    }

    if (evento === 'user_create') {
      return {
        evento: 'usuario_creado',
        mensaje: [
          '👤 *Nuevo usuario en GitLab*',
          `• *Usuario:* ${this.primerValor(payload.username, payload.user_username, payload.user_name, payload.email) ?? 'usuario desconocido'}`,
          `• *Nombre:* ${this.primerValor(payload.name, payload.username, payload.user_username) ?? 'sin nombre'}`,
        ].join('\n'),
      };
    }

    if (evento === 'group_create') {
      return {
        evento: 'grupo_creado',
        mensaje: [
          '👥 *Nuevo grupo en GitLab*',
          `• *Grupo:* ${this.primerValor(payload.full_path, payload.path_with_namespace, payload.name) ?? 'grupo desconocido'}`,
        ].join('\n'),
      };
    }

    return {
      evento: 'ignorado',
      motivo: `Evento de System Hook '${eventoGitLab}' no mapeado`,
    };
  }

  private obtenerProyecto(payload: GitLabSystemHook): string {
    return (
      this.primerValor(
        payload.path_with_namespace,
        payload.name,
        payload.full_path,
      ) ?? 'proyecto desconocido'
    );
  }

  private obtenerCreador(payload: GitLabSystemHook): string {
    return (
      this.primerValor(
        payload.owner_name,
        payload.user_name,
        payload.username,
        payload.user_username,
        payload.email,
      ) ?? 'un usuario'
    );
  }

  private primerValor(
    ...valores: Array<string | undefined>
  ): string | undefined {
    for (const valor of valores) {
      const texto = valor?.trim();
      if (texto) return texto;
    }
    return undefined;
  }

  private async enviarNotificacion(
    mensaje: string,
  ): Promise<Pick<ResultadoSystemHook, 'recibido' | 'notificado' | 'motivo'>> {
    const destinatario =
      process.env.GITLAB_SYSTEM_NOTIFY_TO?.trim() ||
      process.env.GITLAB_NOTIFY_TO?.trim();

    if (!destinatario) {
      this.logger.error(
        'No se envió la notificación: faltan GITLAB_SYSTEM_NOTIFY_TO y GITLAB_NOTIFY_TO.',
      );
      return {
        recibido: true,
        notificado: false,
        motivo: 'GITLAB_NOTIFY_TO no está configurado',
      };
    }

    try {
      // Igual convención que el Push Hook: JID directo, número normalizado.
      if (destinatario.includes('@')) {
        await this.whatsappService.enviarMensajeAGrupo(destinatario, mensaje);
      } else {
        await this.whatsappService.enviarMensajeTexto(destinatario, mensaje);
      }

      this.logger.log(
        `Notificación de System Hook enviada a ${destinatario}.`,
      );
      return { recibido: true, notificado: true };
    } catch (error) {
      this.logger.error(
        `Error al enviar notificación de System Hook a ${destinatario}: ${
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
