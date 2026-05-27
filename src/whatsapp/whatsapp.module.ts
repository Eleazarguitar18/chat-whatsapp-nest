import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService], // ¡Al exportarlo, otros módulos de tu sistema podrán usarlo!
})
export class WhatsappModule {}