import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { GitLabWebhookModule } from './webhooks/gitlab/gitlab-webhook.module';

@Module({
  imports: [WhatsappModule, GitLabWebhookModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
