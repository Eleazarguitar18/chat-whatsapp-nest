/**
 * Tipado mínimo de los payloads enviados por los System Hooks de GitLab.
 *
 * Se usa una interface (y no una clase DTO) a propósito: el ValidationPipe
 * global tiene `whitelist` y `forbidNonWhitelisted` activos, por lo que una
 * clase sin decoradores haría que Nest rechazara los campos adicionales que
 * GitLab incluye según el evento.
 */
export interface GitLabSystemHook {
  event_name?: string;
  object_kind?: string;
  name?: string;
  path_with_namespace?: string;
  full_path?: string;
  owner_name?: string;
  username?: string;
  user_username?: string;
  user_name?: string;
  email?: string;
  [campoAdicional: string]: unknown;
}
