import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GitLabTokenGuard } from './gitlab-token.guard';
import {
  GitLabSystemHookService,
  ResultadoSystemHook,
} from './gitlab-system-hook.service';
import type { GitLabSystemHook } from './interfaces/gitlab-system-hook.interface';

@ApiTags('GitLab Webhooks')
@Controller('webhooks/gitlab-system')
export class GitLabSystemHookController {
  constructor(
    private readonly gitlabSystemHookService: GitLabSystemHookService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(GitLabTokenGuard)
  @ApiOperation({
    summary: 'Recibir System Hook de GitLab y notificar por WhatsApp',
    description:
      'Procesa eventos a nivel de instancia: creación/eliminación de proyectos, ' +
      'creación de usuarios y grupos. La ruta pública completa es ' +
      'POST /api/webhooks/gitlab-system. Protegida con x-gitlab-token contra GITLAB_WEBHOOK_SECRET.',
  })
  @ApiHeader({
    name: 'x-gitlab-token',
    description:
      'Secret Token configurado en GitLab. Obligatorio cuando GITLAB_WEBHOOK_SECRET está definido.',
    required: false,
    example: 'mi-token-secreto',
  })
  @ApiBody({
    description: 'Payload enviado por GitLab en un System Hook.',
    schema: {
      type: 'object',
      example: {
        event_name: 'project_create',
        object_kind: 'project',
        name: 'mi-proyecto',
        path_with_namespace: 'mi-grupo/mi-proyecto',
        full_path: 'mi-grupo/mi-proyecto',
        owner_name: 'Juan Perez',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'System Hook procesado. `notificado: false` indica evento no mapeado o error controlado de WhatsApp.',
    schema: {
      example: {
        recibido: true,
        notificado: true,
        evento: 'proyecto_creado',
        eventoGitLab: 'project_create',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Header x-gitlab-token ausente o inválido.',
  })
  handleSystemHook(
    @Body() payload: GitLabSystemHook,
  ): Promise<ResultadoSystemHook> {
    return this.gitlabSystemHookService.procesarSystemHook(payload);
  }
}
