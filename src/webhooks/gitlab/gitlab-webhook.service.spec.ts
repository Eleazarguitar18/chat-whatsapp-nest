// Baileys es ESM y Jest no lo transforma: se moquea el servicio completo.
jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { GitLabWebhookService } from './gitlab-webhook.service';
import { GitLabPushHook } from './interfaces/gitlab-push-hook.interface';

describe('GitLabWebhookService', () => {
  let service: GitLabWebhookService;
  const enviarMensajeAGrupo = jest.fn().mockResolvedValue({});
  const enviarMensajeTexto = jest.fn().mockResolvedValue({});
  const envOriginal = { ...process.env };

  const payloadBase: GitLabPushHook = {
    object_kind: 'push',
    ref: 'refs/heads/feature/nueva-funcion',
    before: '1111111111111111111111111111111111111111',
    after: '2222222222222222222222222222222222222222',
    user_name: 'Juan Perez',
    project: {
      name: 'mi-proyecto',
      path_with_namespace: 'mi-grupo/mi-proyecto',
      web_url: 'https://gitlab.com/mi-grupo/mi-proyecto',
    },
    commits: [{ message: 'Agrega nueva funcionalidad' }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.GITLAB_NOTIFY_TO = '120363000000000000@g.us';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitLabWebhookService,
        {
          provide: WhatsappService,
          useValue: { enviarMensajeAGrupo, enviarMensajeTexto },
        },
      ],
    }).compile();

    service = module.get<GitLabWebhookService>(GitLabWebhookService);
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  it('notifica la creación de una rama con el formato esperado', async () => {
    const resultado = await service.procesarPush({
      ...payloadBase,
      before: '0000000000000000000000000000000000000000',
    });

    expect(resultado.notificado).toBe(true);
    expect(resultado.evento).toBe('rama_nueva');
    expect(enviarMensajeAGrupo).toHaveBeenCalledWith(
      '120363000000000000@g.us',
      [
        '🌱 *Nueva rama en GitLab*',
        '• *Proyecto:* mi-grupo/mi-proyecto',
        '• *Rama:* `feature/nueva-funcion`',
        '• *Creada por:* Juan Perez',
        '• *Enlace:* https://gitlab.com/mi-grupo/mi-proyecto',
      ].join('\n'),
    );
  });

  it('limita los commits a 5 e indica cuántos quedan fuera', async () => {
    const resultado = await service.procesarPush({
      ...payloadBase,
      commits: Array.from({ length: 7 }, (_, i) => ({
        message: `Commit ${i + 1}\nbody del commit`,
      })),
      total_commits_count: 7,
    });

    expect(resultado.evento).toBe('push');
    const mensaje = enviarMensajeAGrupo.mock.calls[0][1] as string;
    expect(mensaje).toContain('🚀 *Nuevo Push en GitLab*');
    expect(mensaje.match(/^  - /gm)).toHaveLength(6); // 5 commits + aviso
    expect(mensaje).toContain('  - _... y 2 commits más_');
    expect(mensaje).toContain('  - Commit 1');
    expect(mensaje).not.toContain('body del commit');
  });

  it('no envía nada cuando la rama fue eliminada', async () => {
    const resultado = await service.procesarPush({
      ...payloadBase,
      after: '0000000000000000000000000000000000000000',
    });

    expect(resultado).toMatchObject({
      recibido: true,
      notificado: false,
      evento: 'rama_eliminada',
    });
    expect(enviarMensajeAGrupo).not.toHaveBeenCalled();
    expect(enviarMensajeTexto).not.toHaveBeenCalled();
  });

  it('devuelve una respuesta controlada si Baileys falla', async () => {
    enviarMensajeAGrupo.mockRejectedValueOnce(new Error('Baileys desconectado'));

    const resultado = await service.procesarPush(payloadBase);

    expect(resultado.recibido).toBe(true);
    expect(resultado.notificado).toBe(false);
    expect(resultado.motivo).toContain('Baileys');
  });

  it('usa el método de texto cuando el destinatario es un número', async () => {
    process.env.GITLAB_NOTIFY_TO = '59171234567';

    await service.procesarPush(payloadBase);

    expect(enviarMensajeTexto).toHaveBeenCalledTimes(1);
    expect(enviarMensajeAGrupo).not.toHaveBeenCalled();
  });
});
