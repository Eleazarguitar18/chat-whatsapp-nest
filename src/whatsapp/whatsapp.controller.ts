import { Controller, Get, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import express from 'express';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { EnviarMensajeDto } from './dto/send-message.dto';
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  // 1. GET http://localhost:3000/api/whatsapp/connect (Muestra el QR en el navegador)
  @Get('connect')
  @ApiOperation({
    summary: 'Visualizar el Código QR',
    description:
      'Renderiza el código QR actual de Baileys para vincular tu dispositivo móvil.',
  })
  async renderQrPage(@Res() res: express.Response) {
    const qrImage = await this.whatsappService.obtenerQrHtml();

    if (!qrImage) {
      return res.send(`
        <div style="text-align: center; font-family: sans-serif; margin-top: 50px;">
            <h2>✅ WhatsApp está conectado o el código se está generando...</h2>
        </div>
      `);
    }

    return res.send(`
      <html lang="es">
      <body style="font-family: sans-serif; text-align: center; background-color: #f0f2f5; padding-top: 50px;">
          <div style="background: white; display: inline-block; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              <h1 style="color: #128C7E;">Vincular NestJS API</h1>
              <img src="${qrImage}" style="width: 300px; height: 300px;"/>
          </div>
      </body>
      </html>
    `);
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
                      const response = await fetch('/whatsapp/send', {
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

  // 3. POST http://localhost:3000/api/whatsapp/send (Endpoint API puro)
  @ApiOperation({
    summary: 'Enviar un mensaje de texto individual',
    description: 'Despacha un mensaje a través del socket activo de WhatsApp.',
  })
  @ApiBody({ type: EnviarMensajeDto }) // Le dice a Swagger qué campos debe mostrar en el formulario de prueba
  @ApiResponse({ status: 200, description: 'Mensaje enviado exitosamente.' })
  @ApiResponse({
    status: 503,
    description: 'El socket de WhatsApp no está conectado todavía.',
  })
  @Post('send')
  async sendMessage(
    @Body() body: { phone: string; message: string },
    @Res() res: express.Response,
  ) {
    try {
      const result = await this.whatsappService.enviarMensajeTexto(
        body.phone,
        body.message,
      );
      return res.status(HttpStatus.OK).json({ success: true, data: result });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }
}
