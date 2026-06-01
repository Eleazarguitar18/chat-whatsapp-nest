import { BadRequestException, Injectable, InternalServerErrorException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
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
    const folderName = process.env.AUTH_FOLDER_NAME || 'auth_info_baileys';

    const { state, saveCreds } = await useMultiFileAuthState(folderName);
    // const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    this.sock = makeWASocket({
      auth: state, // Mantener el estado multifichero de Baileys
      logger: pino({ level: 'silent' }) as any,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      // v7 TIP: Algunas versiones requieren 'syncFullHistory: false' para no colgarse con chats viejos
      syncFullHistory: false,
    });

    // CONFIGURACIÓN COMPATIBLE V7: Forzamos la resolución asíncrona de las credenciales
    this.sock.ev.on('creds.update', async () => {
      await saveCreds();
    });

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
      // 1. Leemos el buffer original con Jimp v0.16
      const image = await Jimp.read(fileBuffer);

      // 2. Redimensionamos usando la constante clásica de tu versión para el alto automático
      // En la v0.16, AUTO está directo en el objeto Jimp o en image.constructor
      const autoHeight = (Jimp as any).AUTO || -1;
      image.resize(200, autoHeight);

      // 3. Obtenemos el buffer usando getBufferAsync que en tu v0.16 pide estrictamente el formato exacto
      const thumbnailBuffer = await image.getBufferAsync('image/jpeg');
      thumbnailBase64 = thumbnailBuffer.toString('base64');

      console.log('Miniatura generada con éxito usando Jimp v0.16.13');
    } catch (err) {
      console.error('No se pudo generar el thumbnail, se enviará sin previsualización:', err);
    }

    // Enviamos a Baileys v7
    return await this.sock.sendMessage(jid, {
      image: fileBuffer,
      mimetype: mimeType,
      caption: caption || undefined,
      jpegThumbnail: thumbnailBase64,
    });
  }

  // ... envio de documentos ...

  async enviarDocumentoDesdeBuffer(phone: string, fileBuffer: Buffer, mimeType: string, fileName: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    // Disparamos el mensaje indicando que es un documento
    return await this.sock.sendMessage(jid, {
      document: fileBuffer,
      mimetype: mimeType,
      fileName: fileName, // El nombre con extensión que verá el usuario en su chat (Ej: documento.pdf)
    });
  }
  async enviarMensajeAGrupo(groupId: string, mensaje: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanGroupId = groupId.trim();

    try {
      console.log(`🚀 [v7] Enviando mensaje directo al grupo: ${cleanGroupId}`);
      // La v7 ya se encarga de todo el cifrado LID de forma nativa aquí adentro
      return await this.sock.sendMessage(cleanGroupId, { text: mensaje });
    } catch (error) {
      console.error('Error crítico al enviar al grupo:', error);
      throw new InternalServerErrorException(`Error de protocolo Baileys v7: ${error.message}`);
    }
  }
  // async enviarMensajeAGrupo(groupId: string, mensaje: string) {
  //   if (!this.sock) {
  //     throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
  //   }

  //   const cleanGroupId = groupId.trim();

  //   try {
  //     console.log(`🔄 Forzando sincronización de llaves para el grupo: ${cleanGroupId}`);

  //     // CRUCIAL: Esto obliga a Baileys a traer a los miembros del grupo de los servidores de Meta
  //     // y crea de forma automática las "sessions" de libsignal que te están faltando.
  //     await this.sock.groupMetadata(cleanGroupId);

  //     // Esperamos un mini delay de 500ms para que libsignal guarde los archivos en disco
  //     await new Promise(resolve => setTimeout(resolve, 500));

  //     console.log(`🚀 Desplegando mensaje al grupo...`);

  //     // Ahora sí, enviamos el mensaje de forma nativa
  //     return await this.sock.sendMessage(cleanGroupId, { text: mensaje });

  //   } catch (error) {
  //     console.error('Error crítico al enviar al grupo:', error);
  //     throw new InternalServerErrorException(
  //       `No se pudo enviar el mensaje al grupo. Detalles: ${error.message}`
  //     );
  //   }
  // }
  // ... dentro de tu WhatsappService (al final de la clase) ...
  async listarMisGrupos() {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    try {
      const grupos = await this.sock.groupFetchAllParticipating();

      // console.log('====== OBJETO CRUDO DE GRUPOS RECIBIDO DE META ======');
      // console.dir(grupos, { depth: null, colors: true });
      // console.log('=====================================================');

      // Devolvemos el mapeo normal para que no rompa tu Swagger
      return Object.values(grupos).map((grupo: any) => ({
        id: grupo.id,
        nombre: grupo.subject,
      }));
    } catch (error) {
      console.error('Error al listar los grupos de WhatsApp:', error);
      throw new InternalServerErrorException('No se pudieron recuperar los grupos.');
    }
  }
  async obtenerParticipantesPorJid(jid: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    try {
      console.log(`🔍 Buscando participantes en el grupo: ${jid}`);

      // 1. Forzamos la sincronización de metadatos para asegurar que Baileys tenga la lista fresca
      const metadata = await this.sock.groupMetadata(jid);

      // 2. Mapeamos la lista oficial de participantes que nos devuelve Meta
      // Nota: En Baileys v6, los participantes ya vienen en el metadata
      const participantes = metadata.participants.map((p: any) => ({
        id: p.id,          // jid completo (ej: 5214491234567@s.whatsapp.net)
        nombre: p.notify,
        esAdmin: p.admin || false
      }));

      console.log(`✅ Encontrados ${participantes.length} participantes.`);
      return participantes;

    } catch (error) {
      console.error('Error al obtener participantes:', error);
      throw new InternalServerErrorException(`No se pudo obtener la lista de participantes del grupo ${jid}.`);
    }
  }
  // async listarMisGrupos() {
  //   if (!this.sock) {
  //     throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
  //   }

  //   try {
  //     // Le pedimos a Baileys que traiga todos los grupos que tiene en memoria
  //     const grupos = await this.sock.groupFetchAllParticipating();
  //     // console.log(grupos);
  //     // Mapeamos la respuesta para que solo nos devuelva el nombre y su JID limpio
  //     const listaGrupos = Object.values(grupos).map((grupo: any) => ({
  //       id: grupo.id,          // <-- Este es el JID que necesitas (ej: 1203633... @g.us)
  //       nombre: grupo.subject, // <-- El nombre del grupo en tu celular
  //     }));

  //     return listaGrupos;
  //   } catch (error) {
  //     console.error('Error al listar los grupos de WhatsApp:', error);
  //     throw new InternalServerErrorException('No se pudieron recuperar los grupos.');
  //   }
  // }
}