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
import { GitLabWebhookService, ResultadoWebhook } from './gitlab-webhook.service';
import type { GitLabPushHook } from './interfaces/gitlab-push-hook.interface';

@ApiTags('GitLab Webhooks')
@Controller('webhooks/gitlab')
export class GitLabWebhookController {
  constructor(private readonly gitlabWebhookService: GitLabWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(GitLabTokenGuard)
  @ApiOperation({
    summary: 'Recibir Push Hook de GitLab y notificar por WhatsApp',
    description:
      'Procesa push a ramas existentes, creación de ramas e ignora eliminación de ramas. ' +
      'La ruta pública completa es POST /api/webhooks/gitlab. ' +
      'Protegida mediante el header x-gitlab-token contra GITLAB_WEBHOOK_SECRET.',
  })
  @ApiHeader({
    name: 'x-gitlab-token',
    description:
      'Secret Token configurado en GitLab. Obligatorio cuando GITLAB_WEBHOOK_SECRET está definido.',
    required: false,
    example: 'mi-token-secreto',
  })
  @ApiBody({
    description: 'Payload enviado por GitLab en un Push Hook.',
    schema: {
      type: 'object',
      example: {
        object_kind: 'push',
        ref: 'refs/heads/feature/nueva-funcion',
        before: '0000000000000000000000000000000000000000',
        after: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
        user_name: 'Juan Pérez',
        project: {
          name: 'mi-proyecto',
          path_with_namespace: 'mi-grupo/mi-proyecto',
          web_url: 'https://gitlab.com/mi-grupo/mi-proyecto',
        },
        commits: [
          {
            id: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
            message: 'Agrega nueva funcionalidad',
            url: 'https://gitlab.com/mi-grupo/mi-proyecto/-/commit/1a2b3c4d',
          },
        ],
        total_commits_count: 1,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Webhook procesado. `notificado: false` indica que no se envió mensaje (rama eliminada, evento ignorado o error controlado de WhatsApp).',
    schema: {
      example: {
        recibido: true,
        notificado: true,
        evento: 'rama_nueva',
        rama: 'feature/nueva-funcion',
        proyecto: 'mi-grupo/mi-proyecto',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Header x-gitlab-token ausente o inválido.',
  })
  handlePush(@Body() payload: GitLabPushHook): Promise<ResultadoWebhook> {
    return this.gitlabWebhookService.procesarPush(payload);
  }
}
