import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GitLabTokenGuard } from './gitlab-token.guard';

describe('GitLabTokenGuard', () => {
  const envOriginal = { ...process.env };
  const guard = new GitLabTokenGuard();

  const contexto = (token?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: token ? { 'x-gitlab-token': token } : {},
        }),
      }),
    }) as unknown as ExecutionContext;

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  it('acepta el token correcto', () => {
    process.env.GITLAB_WEBHOOK_SECRET = 'token-super-secreto';

    expect(guard.canActivate(contexto('token-super-secreto'))).toBe(true);
  });

  it('rechaza un token inválido o ausente', () => {
    process.env.GITLAB_WEBHOOK_SECRET = 'token-super-secreto';

    expect(() => guard.canActivate(contexto('otro-token'))).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(contexto())).toThrow(UnauthorizedException);
  });

  it('permite la petición si no hay secreto configurado', () => {
    delete process.env.GITLAB_WEBHOOK_SECRET;

    expect(guard.canActivate(contexto())).toBe(true);
  });
});
