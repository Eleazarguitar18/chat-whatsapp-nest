import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, WASocket } from '@whiskeysockets/baileys';
import * as QRCodeNode from 'qrcode';
import pino = require('pino');
import Jimp from 'jimp';
@Injectable()
export class WhatsappService implements OnModuleInit {
  private sock: WASocket | null = null;
  private ultimoQr: string | null = null;

  // Se ejecuta automáticamente al arrancar la aplicación de NestJS
  async onModuleInit() {
    await this.conectarWhatsapp();
  }

  private async conectarWhatsapp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }) as any,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.ultimoQr = qr;
        console.log('🔄 [NestJS] Nuevo código QR generado.');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`❌ Conexión cerrada (Status: ${statusCode}). ¿Reconectando?: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(() => this.conectarWhatsapp(), 5000);
        } else {
          this.ultimoQr = null;
        }
      }

      if (connection === 'open') {
        this.ultimoQr = null;
        console.log('✅ [NestJS] ¡Conexión con WhatsApp establecida con éxito!');
      }
    });
  }

  // Método para obtener el QR en formato Base64 para la vista web
  async obtenerQrHtml(): Promise<string | null> {
    if (!this.ultimoQr) return null;
    return await QRCodeNode.toDataURL(this.ultimoQr);
  }

  // Método de negocio para enviar mensajes (Inyectable en cualquier parte del sistema)
  async enviarMensajeTexto(phone: string, message: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    return await this.sock.sendMessage(jid, { text: message });
  }
  async enviarImagen(phone: string, imageUrl: string, caption?: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    // Baileys detecta automáticamente si es una URL web (http/https) o una ruta local
    return await this.sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || undefined // Pie de foto opcional
    });
  }
  async enviarImagenDesdeBuffer(phone: string, fileBuffer: Buffer, mimeType: string, caption?: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    let thumbnailBase64: string | undefined;

    try {
      // Leemos el buffer original con Jimp
      const image: any = await Jimp.read(fileBuffer);

      // Redimensionamos a un tamaño pequeño de miniatura (ej: ancho 200px, alto automático)
      image.resize({ w: 200 });

      // Obtenemos el buffer comprimido en formato JPEG
      const thumbnailBuffer = await image.getBuffer('image/jpeg');
      thumbnailBase64 = thumbnailBuffer.toString('base64');
    } catch (err) {
      console.error('No se pudo generar el thumbnail, se enviará sin previsualización:', err);
    }

    // Enviamos a Baileys
    return await this.sock.sendMessage(jid, {
      image: fileBuffer,
      mimetype: mimeType,
      caption: caption || undefined,
      jpegThumbnail: thumbnailBase64, // Si falló Jimp, va undefined y no rompe el flujo principal
    });
  }
}