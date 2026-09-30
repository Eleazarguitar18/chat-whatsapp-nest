import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
} from '@whiskeysockets/baileys';
import * as QRCodeNode from 'qrcode';
import pino = require('pino');
import { Jimp } from 'jimp';
import * as fs from 'fs';
import * as path from 'path';

export interface ContactoMensaje {
  phone: string;
  message: string;
}

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

    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }) as any,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      syncFullHistory: false,
    });

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
          console.log('🔄 [NestJS] Sesión desvinculada (Logged out). Limpiando credenciales obsoletas y reiniciando...');
          const folderPath = path.resolve(process.cwd(), folderName);
          setTimeout(async () => {
            await this.desmantelarSocket();
            await this.limpiarDirectorioSeguro(folderPath);
            this.conectarWhatsapp();
          }, 2000);
        }
      }

      if (connection === 'open') {
        this.ultimoQr = null;
        console.log('✅ [NestJS] ¡Conexión con WhatsApp establecida con éxito!');
      }
    });
  }

  // =========================================================================
  // 🛡️ MOTOR DE HERRAMIENTAS ANTI-BANEO (HUMAN BEHAVIOR SIMULATOR)
  // =========================================================================

  /**
   * Genera un retraso aleatorio entre minMs y maxMs (Jittering)
   */
  private delayAleatorio(minMs: number, maxMs: number): Promise<void> {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calcula el tiempo de escritura aproximado en milisegundos basado en la longitud del texto
   */
  private calcularTiempoEscritura(texto: string): number {
    const palabras = texto.trim().split(/\s+/).length;
    const msPorPalabra = Math.floor(Math.random() * (350 - 200 + 1)) + 200;
    // Mínimo 2.5s, máximo 12s de tiempo simulado
    return Math.min(Math.max(palabras * msPorPalabra, 2500), 12000);
  }

  /**
   * Simula interacciones humanas reales (Marcar leído -> Escribiendo... -> Pausa)
   */
  private async simularEscribiendoHumano(jid: string, texto?: string): Promise<void> {
    if (!this.sock) return;

    try {
      // 1. Pausa previa simulando lectura del mensaje anterior o apertura del chat
      await this.delayAleatorio(1000, 2500);

      // 2. Enviar evento "Escribiendo..." al chat objetivo
      await this.sock.sendPresenceUpdate('composing', jid);

      // 3. Mantener el estado de escritura durante el tiempo simulado de tipeo
      const tiempoTipeo = texto ? this.calcularTiempoEscritura(texto) : 3000;
      await this.delayAleatorio(tiempoTipeo, tiempoTipeo + 1000);

      // 4. Detener la presencia de tipeo
      await this.sock.sendPresenceUpdate('paused', jid);

      // 5. Pequeña pausa de "reflexión" antes de hacer clic en enviar
      await this.delayAleatorio(500, 1500);
    } catch (error) {
      console.warn(`[Anti-Ban] No se pudo simular presencia para ${jid}:`, error.message);
    }
  }

  // =========================================================================
  // 📤 MÉTODOS DE ENVÍO DE MENSAJES (PROTEGIDOS CON ANTI-BAN)
  // =========================================================================

  async obtenerQrHtml(): Promise<string | null> {
    if (!this.ultimoQr) return null;
    return await QRCodeNode.toDataURL(this.ultimoQr);
  }

  async enviarMensajeTexto(phone: string, message: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    // 🛡️ Simulación Anti-Ban antes del envío de texto
    await this.simularEscribiendoHumano(jid, message);

    return await this.sock.sendMessage(jid, { text: message });
  }

  async enviarImagen(phone: string, imageUrl: string, caption?: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    // 🛡️ Simulación Anti-Ban previa
    await this.simularEscribiendoHumano(jid, caption);

    return await this.sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || undefined,
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
      const image = await Jimp.fromBuffer(fileBuffer);
      image.resize({ w: 200 });

      const thumbnailBuffer = await image.getBuffer('image/jpeg');
      thumbnailBase64 = thumbnailBuffer.toString('base64');
    } catch (err) {
      console.error('No se pudo generar el thumbnail, se enviará sin previsualización:', err);
    }

    // 🛡️ Simulación Anti-Ban previa
    await this.simularEscribiendoHumano(jid, caption);

    return await this.sock.sendMessage(jid, {
      image: fileBuffer,
      mimetype: mimeType,
      caption: caption || undefined,
      jpegThumbnail: thumbnailBase64,
    });
  }

  async enviarDocumentoDesdeBuffer(phone: string, fileBuffer: Buffer, mimeType: string, fileName: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    // 🛡️ Breve pausa previa simulando la adjunción del archivo
    await this.simularEscribiendoHumano(jid, 'Adjuntando archivo...');

    return await this.sock.sendMessage(jid, {
      document: fileBuffer,
      mimetype: mimeType,
      fileName: fileName,
    });
  }

  // =========================================================================
  // 🚀 ENVÍO MASIVO SEGURO (MÉTODO PARA CAMPAÑAS POR LOTES)
  // =========================================================================

  /**
   * Envia una campaña masiva procesando en cola secuencial con pausas anti-bloqueo.
   */
  async enviarMensajesMasivosSeguro(lista: ContactoMensaje[]) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    // 🔥 CORRECCIÓN: Definir explícitamente el tipo de arreglo para evitar el error 'never'
    const resultados: Array<{
      phone: string;
      status: string;
      res?: any;
      error?: string;
    }> = [];

    console.log(`🚀 [Anti-Ban] Iniciando envío de campaña para ${lista.length} destinatarios...`);

    for (let i = 0; i < lista.length; i++) {
      const { phone, message } = lista[i];

      try {
        console.log(`⏳ [${i + 1}/${lista.length}] Procesando envío para ${phone}...`);

        const res = await this.enviarMensajeTexto(phone, message);
        resultados.push({ phone, status: 'ENVIADO', res });

        const retardoChat = Math.floor(Math.random() * (18000 - 8000 + 1)) + 8000;

        if ((i + 1) % 10 === 0 && i !== lista.length - 1) {
          const pausaLarga = Math.floor(Math.random() * (180000 - 90000 + 1)) + 90000;
          console.log(`☕ [Anti-Ban] Pausa de enfriamiento (${Math.round(pausaLarga / 1000)}s)...`);
          await this.delayAleatorio(pausaLarga, pausaLarga + 2000);
        } else {
          console.log(`⏸️ Esperando ${Math.round(retardoChat / 1000)}s antes de continuar...`);
          await this.delayAleatorio(retardoChat, retardoChat + 2000);
        }
      } catch (error) {
        console.error(`❌ Error en el envío para ${phone}:`, error.message);
        resultados.push({ phone, status: 'ERROR', error: error.message });
      }
    }

    console.log(`✅ [Anti-Ban] Campania masiva completada.`);
    return resultados;
  }

  // =========================================================================
  // 👥 GESTIÓN DE GRUPOS DE WHATSAPP
  // =========================================================================

  async enviarMensajeAGrupo(groupId: string, mensaje: string) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanGroupId = groupId.trim();

    try {
      console.log(`🚀 [v7] Enviando mensaje directo al grupo: ${cleanGroupId}`);
      // Simulación ligera para grupos
      await this.sock.sendPresenceUpdate('composing', cleanGroupId);
      await this.delayAleatorio(1500, 3000);
      await this.sock.sendPresenceUpdate('paused', cleanGroupId);

      return await this.sock.sendMessage(cleanGroupId, { text: mensaje });
    } catch (error) {
      console.error('Error crítico al enviar al grupo:', error);
      throw new InternalServerErrorException(`Error de protocolo Baileys v7: ${error.message}`);
    }
  }

  async listarMisGrupos() {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    try {
      const grupos = await this.sock.groupFetchAllParticipating();

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

      const metadata = await this.sock.groupMetadata(jid);

      const participantes = metadata.participants.map((p: any) => ({
        id: p.id,
        nombre: p.notify,
        esAdmin: p.admin || false,
      }));

      console.log(`✅ Encontrados ${participantes.length} participantes.`);
      return participantes;
    } catch (error) {
      console.error('Error al obtener participantes:', error);
      throw new InternalServerErrorException(`No se pudo obtener la lista de participantes del grupo ${jid}.`);
    }
  }

  /**
   * Envía un documento (PDF, Word, Excel, etc.) a un grupo de WhatsApp simulando presencia humana.
   */
  async enviarDocumentoAGrupoDesdeBuffer(
    groupId: string,
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
  ) {
    if (!this.sock) {
      throw new ServiceUnavailableException('El cliente de WhatsApp no está inicializado.');
    }

    const cleanGroupId = groupId.trim();

    try {
      console.log(`🚀 [Anti-Ban] Preparando envío de documento al grupo: ${cleanGroupId}`);

      // 1. Simulación anti-ban: "Escribiendo..." en el grupo de 2 a 4 segundos
      await this.sock.sendPresenceUpdate('composing', cleanGroupId);
      await this.delayAleatorio(2000, 4000);
      await this.sock.sendPresenceUpdate('paused', cleanGroupId);

      // 2. Pequeña pausa adicional antes de liberar el mensaje
      await this.delayAleatorio(500, 1500);

      // 3. Envío del archivo por protocolo Baileys v7
      return await this.sock.sendMessage(cleanGroupId, {
        document: fileBuffer,
        mimetype: mimeType,
        fileName: fileName,
      });
    } catch (error) {
      console.error(`❌ Error al enviar documento al grupo ${cleanGroupId}:`, error);
      throw new InternalServerErrorException(
        `Error de protocolo Baileys v7: ${error.message}`,
      );
    }
  }

  // =========================================================================
  // 🔄 GESTIÓN DE SESIÓN Y AUTENTICACIÓN
  // =========================================================================

  /**
   * Cierra de forma segura el socket activo y elimina listeners
   */
  private async desmantelarSocket(): Promise<void> {
    if (!this.sock) return;

    try {
      // 1. Quitar todos los event listeners para que no sigan escribiendo creds.json
      if (this.sock.ev) {
        try {
          (this.sock.ev as any).removeAllListeners?.('creds.update');
          (this.sock.ev as any).removeAllListeners?.('connection.update');
        } catch (_) {}
      }

      // 2. Cerrar el websocket subyacente si existe
      if ((this.sock as any).ws) {
        try {
          (this.sock as any).ws.close();
        } catch (_) {}
      }

      // 3. Terminar el socket de Baileys
      try {
        this.sock.end(undefined);
      } catch (_) {}
    } catch (err) {
      console.warn('⚠️ [NestJS] Advertencia al desmantelar socket:', err?.message);
    } finally {
      this.sock = null;
      this.ultimoQr = null;
    }
  }

  /**
   * Elimina de forma segura los archivos y la carpeta de autenticación evitando errores EBUSY / bloqueos de archivos.
   */
  private async limpiarDirectorioSeguro(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) return;

    // Intentar hasta 5 veces con pausas progresivas
    for (let intento = 1; intento <= 5; intento++) {
      try {
        // 1. Primero intentar vaciar todos los archivos internos uno por uno
        const archivos = await fs.promises.readdir(dirPath);
        for (const archivo of archivos) {
          const archivoPath = path.join(dirPath, archivo);
          try {
            const stat = await fs.promises.lstat(archivoPath);
            if (stat.isDirectory()) {
              await fs.promises.rm(archivoPath, { recursive: true, force: true }).catch(() => {});
            } else {
              await fs.promises.unlink(archivoPath).catch(() => {});
            }
          } catch (_) {}
        }

        // 2. Intentar eliminar la carpeta raíz
        await fs.promises.rm(dirPath, { recursive: true, force: true });
        console.log(`🗑️ [NestJS] Directorio ${dirPath} eliminado con éxito.`);
        return;
      } catch (err) {
        console.warn(
          `⚠️ [NestJS] Intento ${intento}/5 para limpiar ${dirPath} (${err.code || err.message}). Esperando para reintentar...`,
        );
        // Pausa progresiva para dar tiempo al SO/Docker de liberar descriptores
        await new Promise((resolve) => setTimeout(resolve, intento * 500));
      }
    }

    // Si la carpeta raíz aún persiste por EBUSY pero los archivos adentro ya se borraron:
    try {
      const restantes = await fs.promises.readdir(dirPath);
      if (restantes.length === 0) {
        console.log(`ℹ️ [NestJS] La carpeta '${dirPath}' quedó vacía (suficiente para iniciar sesión limpia).`);
        return;
      }
    } catch (_) {}

    // Si aún quedan archivos, intentar forzar borrado síncrono
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (finalError) {
      console.warn(`⚠️ [NestJS] No se pudo remover la carpeta contenedora: ${finalError.message}, pero el contenido fue vaciado.`);
    }
  }

  /**
   * Cierra la sesión activa de WhatsApp (desvincula el dispositivo)
   * y limpia los datos de autenticación para generar un nuevo QR limpio.
   */
  async cerrarSesion(): Promise<{ success: boolean; message: string }> {
    console.log('🔄 [NestJS] Iniciando proceso de cierre de sesión / logout...');
    const folderName = process.env.AUTH_FOLDER_NAME || 'auth_info_baileys';
    const folderPath = path.resolve(process.cwd(), folderName);

    try {
      if (this.sock) {
        try {
          // Intentar logout en los servidores de WhatsApp con timeout de 4 segundos
          await Promise.race([
            this.sock.logout('Sesión cerrada por el usuario'),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout en logout')), 4000),
            ),
          ]);
          console.log('✅ [NestJS] Logout enviado correctamente a WhatsApp.');
        } catch (err) {
          console.warn('⚠️ [NestJS] Advertencia al cerrar socket remotamente:', err?.message);
        }
      }

      // Desmantelar socket localmente y remover listeners
      await this.desmantelarSocket();

      // Pausa para asegurar liberación de descriptores de archivos
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Limpiar credenciales de forma segura
      await this.limpiarDirectorioSeguro(folderPath);

      // Reiniciar conexión para generar de inmediato un nuevo código QR
      setTimeout(() => {
        this.conectarWhatsapp();
      }, 1500);

      return {
        success: true,
        message:
          'Sesión de WhatsApp cerrada y credenciales limpiadas exitosamente. Se ha reinicializado el servicio para generar un nuevo código QR.',
      };
    } catch (error) {
      console.error('❌ Error al cerrar la sesión de WhatsApp:', error);
      throw new InternalServerErrorException(
        `Error al cerrar la sesión: ${error.message}`,
      );
    }
  }

  /**
   * Elimina la carpeta de autenticación (credenciales/sesión) y reinicia el cliente.
   * Útil cuando los archivos de sesión se corrompen o quedan en bucle de reconexión.
   */
  async borrarCarpetaAuth(): Promise<{ success: boolean; message: string }> {
    console.log('🗑️ [NestJS] Solicitud de borrado forzado de carpeta auth recibida...');
    const folderName = process.env.AUTH_FOLDER_NAME || 'auth_info_baileys';
    const folderPath = path.resolve(process.cwd(), folderName);

    try {
      // 1. Desmantelar socket actual y remover listeners
      await this.desmantelarSocket();

      // 2. Pausa breve
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Eliminar carpeta o su contenido de forma segura sin fallar por EBUSY
      await this.limpiarDirectorioSeguro(folderPath);

      // 4. Reiniciar el cliente WhatsApp para generar un nuevo QR limpio
      setTimeout(() => {
        this.conectarWhatsapp();
      }, 1500);

      return {
        success: true,
        message: `Carpeta de autenticación '${folderName}' eliminada con éxito. Se ha reinicializado el servicio para generar un nuevo QR.`,
      };
    } catch (error) {
      console.error('❌ Error al eliminar la carpeta de autenticación:', error);
      throw new InternalServerErrorException(
        `No se pudo eliminar la carpeta de autenticación: ${error.message}`,
      );
    }
  }
}