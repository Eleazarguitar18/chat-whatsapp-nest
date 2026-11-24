import { Module } from '@nestjs/common';
import { WhatsappModule } from '../../whatsapp/whatsapp.module';
import { GitLabSystemHookController } from './gitlab-system-hook.controller';
import { GitLabSystemHookService } from './gitlab-system-hook.service';
import { GitLabTokenGuard } from './gitlab-token.guard';
import { GitLabWebhookController } from './gitlab-webhook.controller';
import { GitLabWebhookService } from './gitlab-webhook.service';

@Module({
  imports: [WhatsappModule],
  controllers: [GitLabWebhookController, GitLabSystemHookController],
  providers: [
    GitLabWebhookService,
    GitLabSystemHookService,
    GitLabTokenGuard,
  ],
})
export class GitLabWebhookModule {}
