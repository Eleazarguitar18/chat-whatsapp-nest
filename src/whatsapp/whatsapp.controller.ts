import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { EnviarMensajeDto } from './dto/send-message.dto';
import { EnviarImagenDto } from './dto/send-image.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('WhatsApp Gateway')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) { }

  @Get('connect')
  @ApiOperation({ summary: 'Visualizar el Código QR', description: 'Renderiza el código QR en Base64 o un mensaje de éxito.' })
  async renderQrPage() {
    const qrImage = await this.whatsappService.obtenerQrHtml();

    if (!qrImage) {
      return {
        success: true,
        message: 'WhatsApp ya está vinculado o el código se está generando de fondo...'
      };
    }

    // Si quieres retornar un JSON limpio en lugar de HTML embebido (Ideal para tu Frontend)
    return {
      success: true,
      qrBase64: qrImage
    };
  }

  @Post('send')
  @HttpCode(HttpStatus.OK) // Cambia el default de POST (201) a 200 OK de forma nativa
  @ApiOperation({ summary: 'Enviar mensaje de texto', description: 'Despacha un texto plano por WhatsApp.' })
  @ApiBody({ type: EnviarMensajeDto })
  async sendMessage(@Body() body: EnviarMensajeDto) {
    const result = await this.whatsappService.enviarMensajeTexto(body.phone, body.message);

    // Solo retornas el objeto y NestJS hace toda la magia del envío HTTP
    return {
      success: true,
      message: 'Mensaje enviado con éxito',
      data: result
    };
  }

  @Post('send-image')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar un archivo de imagen real', description: 'Sube una imagen desde tu máquina y envíala por WhatsApp.' })
  // TRUCO DE SWAGGER: Forzamos la estructura combinada del DTO de texto + el archivo binario
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', example: '59171234567', description: 'Número de destino.' },
        caption: { type: 'string', example: 'Imagen de prueba', description: 'Pie de foto opcional.' },
        file: { type: 'string', format: 'binary', description: 'Selecciona el archivo de imagen (.png, .jpg)' },
      },
      required: ['phone', 'file'], // 'file' y 'phone' son obligatorios
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 5 * 1024 * 1024, // <-- 5 MB en bytes. Si pesa más de esto, NestJS tira un 400 automáticamente
    }
  }))
  async sendImage(
    @Body() body: EnviarImagenDto, // Nest valida phone y caption aquí limpiamente sin chocar
    @UploadedFile() file: any,     // Nest captura el binario aquí
  ) {
    if (!file) {
      throw new BadRequestException('Es obligatorio subir un archivo de imagen.');
    }

    const result = await this.whatsappService.enviarImagenDesdeBuffer(
      body.phone,
      file.buffer,
      file.mimetype,
      body.caption
    );

    return {
      success: true,
      message: 'Archivo de imagen enviado con éxito',
      data: result
    };
  }
}