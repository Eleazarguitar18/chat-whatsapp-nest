import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { EnviarMensajeDto } from './dto/send-message.dto';
import { EnviarImagenDto } from './dto/send-image.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import express from 'express';
@ApiTags('WhatsApp Gateway')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('connect')
  @ApiOperation({
    summary: 'Visualizar el Código QR',
    description: 'Renderiza el código QR en Base64 o un mensaje de éxito.',
  })
  async renderQrPage() {
    const qrImage = await this.whatsappService.obtenerQrHtml();

    if (!qrImage) {
      return {
        success: true,
        message:
          'WhatsApp ya está vinculado o el código se está generando de fondo...',
      };
    }

    // Si quieres retornar un JSON limpio en lugar de HTML embebido (Ideal para tu Frontend)
    return {
      success: true,
      qrBase64: qrImage,
    };
  }

  @Post('send')
  @HttpCode(HttpStatus.OK) // Cambia el default de POST (201) a 200 OK de forma nativa
  @ApiOperation({
    summary: 'Enviar mensaje de texto',
    description: 'Despacha un texto plano por WhatsApp.',
  })
  @ApiBody({ type: EnviarMensajeDto })
  async sendMessage(@Body() body: EnviarMensajeDto) {
    const result = await this.whatsappService.enviarMensajeTexto(
      body.phone,
      body.message,
    );

    // Solo retornas el objeto y NestJS hace toda la magia del envío HTTP
    return {
      success: true,
      message: 'Mensaje enviado con éxito',
      data: result,
    };
  }

  @Post('send-image')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Enviar un archivo de imagen real',
    description: 'Sube una imagen desde tu máquina y envíala por WhatsApp.',
  })
  // TRUCO DE SWAGGER: Forzamos la estructura combinada del DTO de texto + el archivo binario
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          example: '59171234567',
          description: 'Número de destino.',
        },
        caption: {
          type: 'string',
          example: 'Imagen de prueba',
          description: 'Pie de foto opcional.',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Selecciona el archivo de imagen (.png, .jpg)',
        },
      },
      required: ['phone', 'file'], // 'file' y 'phone' son obligatorios
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // <-- 5 MB en bytes. Si pesa más de esto, NestJS tira un 400 automáticamente
      },
    }),
  )
  async sendImage(
    @Body() body: EnviarImagenDto, // Nest valida phone y caption aquí limpiamente sin chocar
    @UploadedFile() file: any, // Nest captura el binario aquí
  ) {
    if (!file) {
      throw new BadRequestException(
        'Es obligatorio subir un archivo de imagen.',
      );
    }

    const result = await this.whatsappService.enviarImagenDesdeBuffer(
      body.phone,
      file.buffer,
      file.mimetype,
      body.caption,
    );

    return {
      success: true,
      message: 'Archivo de imagen enviado con éxito',
      data: result,
    };
  }
  // 2. GET http://localhost:3000/api/whatsapp/view (Muestra el formulario visual de envío)
  @Get('view')
  renderSendPage(@Res() res: express.Response) {
    return res.send(`
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <title>Panel NestJS - WhatsApp</title>
          <style>
              body { font-family: sans-serif; background-color: #f0f2f5; padding-top: 50px; text-align: center; }
              .card { background: white; display: inline-block; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); text-align: left; width: 400px; }
              h1 { color: #128C7E; font-size: 24px; text-align: center; }
              .phone-container { display: flex; gap: 10px; margin-bottom: 15px; }
              select { width: 40%; padding: 10px; border: 1px solid #ccc; border-radius: 5px; }
              input[type="text"] { width: 60%; padding: 10px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; }
              textarea { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; height: 100px; }
              button { width: 100%; background-color: #25D366; color: white; border: none; padding: 12px; font-weight: bold; border-radius: 5px; cursor: pointer; }
              #status { margin-top: 15px; font-weight: bold; text-align: center; }
          </style>
      </head>
      <body>
          <div class="card">
              <h1>💬 Enviar Mensaje (NestJS)</h1>
              <form id="msgForm">
                  <div class="phone-container">
                      <select id="countryCode">
                          <option value="591" selected>Bolivia (+591)</option>
                          <option value="51">Perú (+51)</option>
                          <option value="54">Argentina (+54)</option>
                          <option value="52">México (+52)</option>
                      </select>
                      <input type="text" id="phone" placeholder="Ej: 71234567" required>
                  </div>
                  <textarea id="message" placeholder="Escribe tu mensaje..." required></textarea>
                  <button type="submit">Enviar Mensaje</button>
              </form>
              <div id="status"></div>
          </div>
          <script>
              document.getElementById('msgForm').addEventListener('submit', async (e) => {
                  e.preventDefault();
                  const countryCode = document.getElementById('countryCode').value;
                  const localPhone = document.getElementById('phone').value;
                  const message = document.getElementById('message').value;
                  const statusDiv = document.getElementById('status');
                  
                  const fullPhone = countryCode + localPhone.replace(/[^0-9]/g, '');
                  statusDiv.innerText = 'Enviando...';

                  try {
                      //http://localhost:3000/api/whatsapp/send
                      // Apunta al endpoint POST controlado por NestJS
                      const response = await fetch('/api/whatsapp/send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone: fullPhone, message })
                      });
                      const data = await response.json();
                      if (response.ok) {
                          statusDiv.style.color = 'green';
                          statusDiv.innerText = '✅ ¡Mensaje enviado con éxito!';
                          document.getElementById('message').value = '';
                      } else {
                          statusDiv.style.color = 'red';
                          statusDiv.innerText = '❌ Error: ' + data.message;
                      }
                  } catch (err) {
                      statusDiv.style.color = 'red';
                      statusDiv.innerText = '❌ Error de conexión.';
                  }
              });
          </script>
      </body>
      </html>
    `);
  }
}
