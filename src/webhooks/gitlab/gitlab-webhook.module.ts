import { Module } from '@nestjs/common';
import { WhatsappModule } from '../../whatsapp/whatsapp.module';
import { GitLabTokenGuard } from './gitlab-token.guard';
import { GitLabWebhookController } from './gitlab-webhook.controller';
import { GitLabWebhookService } from './gitlab-webhook.service';

@Module({
  imports: [WhatsappModule],
  controllers: [GitLabWebhookController],
  providers: [GitLabWebhookService, GitLabTokenGuard],
})
export class GitLabWebhookModule {}
