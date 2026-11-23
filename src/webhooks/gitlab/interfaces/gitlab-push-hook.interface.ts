/**
 * Tipado mínimo del payload que GitLab envía en un "Push Hook".
 *
 * Se usa una interface (y no una clase DTO) a propósito: el ValidationPipe
 * global tiene `whitelist` y `forbidNonWhitelisted` activos, por lo que una
 * clase sin decoradores haría que Nest rechazara los campos adicionales que
 * GitLab incluye en el payload.
 */
export interface GitLabCommit {
  id?: string;
  message?: string;
  url?: string;
  author?: {
    name?: string;
    email?: string;
  };
}

export interface GitLabProject {
  name?: string;
  path_with_namespace?: string;
  web_url?: string;
}

export interface GitLabPushHook {
  object_kind?: string;
  ref?: string;
  before?: string;
  after?: string;
  user_name?: string;
  project?: GitLabProject;
  commits?: GitLabCommit[];
  total_commits_count?: number;
}
