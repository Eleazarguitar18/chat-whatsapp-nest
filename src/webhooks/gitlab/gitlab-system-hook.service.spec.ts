// Baileys es ESM y Jest no lo transforma: se moquea el servicio completo.
jest.mock('../../whatsapp/whatsapp.service', () => ({
  WhatsappService: class {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { GitLabSystemHookService } from './gitlab-system-hook.service';

describe('GitLabSystemHookService', () => {
  let service: GitLabSystemHookService;
  const enviarMensajeAGrupo = jest.fn().mockResolvedValue({});
  const enviarMensajeTexto = jest.fn().mockResolvedValue({});
  const envOriginal = { ...process.env };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.GITLAB_NOTIFY_TO = '120363000000000000@g.us';
    delete process.env.GITLAB_SYSTEM_NOTIFY_TO;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitLabSystemHookService,
        {
          provide: WhatsappService,
          useValue: { enviarMensajeAGrupo, enviarMensajeTexto },
        },
      ],
    }).compile();

    service = module.get<GitLabSystemHookService>(GitLabSystemHookService);
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('notifica la creación de un proyecto con el formato esperado', async () => {
    const resultado = await service.procesarSystemHook({
      event_name: 'project_create',
      object_kind: 'project',
      name: 'mi-proyecto',
      path_with_namespace: 'mi-grupo/mi-proyecto',
      owner_name: 'Juan Perez',
    });

    expect(resultado).toMatchObject({
      recibido: true,
      notificado: true,
      evento: 'proyecto_creado',
      eventoGitLab: 'project_create',
    });
    expect(enviarMensajeAGrupo).toHaveBeenCalledWith(
      '120363000000000000@g.us',
      [
        '📦 *Nuevo proyecto en GitLab*',
        '• *Proyecto:* mi-grupo/mi-proyecto',
        '• *Creado por:* Juan Perez',
      ].join('\n'),
    );
  });

  it('usa object_kind=project como creación cuando falta event_name', async () => {
    const resultado = await service.procesarSystemHook({
      object_kind: 'project',
      name: 'proyecto-sin-evento',
    });

    expect(resultado.evento).toBe('proyecto_creado');
    expect(enviarMensajeAGrupo).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('• *Proyecto:* proyecto-sin-evento'),
    );
  });

  it('notifica la eliminación de un proyecto', async () => {
    const resultado = await service.procesarSystemHook({
      event_name: 'project_destroy',
      name: 'mi-proyecto',
      path_with_namespace: 'mi-grupo/mi-proyecto',
    });

    expect(resultado.evento).toBe('proyecto_eliminado');
    expect(enviarMensajeAGrupo).toHaveBeenCalledWith(
      '120363000000000000@g.us',
      [
        '🗑️ *Proyecto eliminado en GitLab*',
        '• *Proyecto:* mi-grupo/mi-proyecto',
      ].join('\n'),
    );
  });

  it('notifica la creación de un usuario', async () => {
    const resultado = await service.procesarSystemHook({
      event_name: 'user_create',
      username: 'jperez',
      name: 'Juan Perez',
      email: 'juan@example.com',
    });

    expect(resultado.evento).toBe('usuario_creado');
    expect(enviarMensajeAGrupo).toHaveBeenCalledWith(
      '120363000000000000@g.us',
      [
        '👤 *Nuevo usuario en GitLab*',
        '• *Usuario:* jperez',
        '• *Nombre:* Juan Perez',
      ].join('\n'),
    );
  });

  it('notifica la creación de un grupo', async () => {
    const resultado = await service.procesarSystemHook({
      event_name: 'group_create',
      name: 'mi-grupo',
      full_path: 'organizacion/mi-grupo',
    });

    expect(resultado.evento).toBe('grupo_creado');
    expect(enviarMensajeAGrupo).toHaveBeenCalledWith(
      '120363000000000000@g.us',
      [
        '👥 *Nuevo grupo en GitLab*',
        '• *Grupo:* organizacion/mi-grupo',
      ].join('\n'),
    );
  });

  it('responde 200 controlado sin enviar para eventos no mapeados', async () => {
    const resultado = await service.procesarSystemHook({
      event_name: 'project_update',
      name: 'mi-proyecto',
    });

    expect(resultado).toMatchObject({
      recibido: true,
      notificado: false,
      evento: 'ignorado',
      eventoGitLab: 'project_update',
    });
    expect(resultado.motivo).toContain('no mapeado');
    expect(enviarMensajeAGrupo).not.toHaveBeenCalled();
    expect(enviarMensajeTexto).not.toHaveBeenCalled();
  });

  it('devuelve una respuesta controlada si Baileys falla', async () => {
    enviarMensajeAGrupo.mockRejectedValueOnce(new Error('Baileys desconectado'));

    const resultado = await service.procesarSystemHook({
      event_name: 'project_create',
      name: 'mi-proyecto',
    });

    expect(resultado.recibido).toBe(true);
    expect(resultado.notificado).toBe(false);
    expect(resultado.motivo).toContain('Baileys');
  });

  it('usa GITLAB_SYSTEM_NOTIFY_TO cuando está definido', async () => {
    process.env.GITLAB_SYSTEM_NOTIFY_TO = '59171234567';

    await service.procesarSystemHook({
      event_name: 'project_create',
      name: 'mi-proyecto',
    });

    expect(enviarMensajeTexto).toHaveBeenCalledTimes(1);
    expect(enviarMensajeAGrupo).not.toHaveBeenCalled();
  });

  it('hace fallback a GITLAB_NOTIFY_TO si no hay destinatario específico', async () => {
    await service.procesarSystemHook({
      event_name: 'project_create',
      name: 'mi-proyecto',
    });

    expect(enviarMensajeAGrupo).toHaveBeenCalledTimes(1);
    expect(enviarMensajeAGrupo.mock.calls[0][0]).toBe(
      '120363000000000000@g.us',
    );
  });
});
