import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { handleIncomingMessage } from './handlers';
import { cronScheduler } from '../scheduler/cron';

const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');

export class WhatsAppClient {
  private sock: WASocket | null = null;
  private isReconnecting = false;

  constructor() {
    this.ensureAuthDirectory();
  }

  private ensureAuthDirectory() {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  }

  /**
   * Limpia las credenciales almacenadas (se usa al desvincular o sesión inválida)
   */
  private clearAuthSession() {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
          // Mantener la carpeta pero borrar los archivos
          const filePath = path.join(AUTH_DIR, file);
          if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
        logger.info('🔑 [WhatsApp] Sesión de autenticación local borrada con éxito.');
      }
    } catch (err) {
      logger.error('🔑 [WhatsApp] Error al borrar la sesión de autenticación:', err);
    }
  }

  /**
   * Conecta a WhatsApp y configura los manejadores de eventos
   */
  public async connect() {
    if (this.isReconnecting) return;
    logger.info('🟢 [WhatsApp] Iniciando conexión con WhatsApp...');

    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`📋 [WhatsApp] Usando versión de Baileys: v${version.join('.')}, última disponible: ${isLatest}`);

      // Crear socket de conexión
      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // Lo manejamos nosotros manualmente para mejor control
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      // Guardar credenciales automáticamente ante cambios
      this.sock.ev.on('creds.update', saveCreds);

      // Escuchar cambios en la conexión (QR, Conectado, Desconectado)
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info('🔑 [WhatsApp] Nuevo código QR recibido. Escanéalo con tu aplicación de WhatsApp:');
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'connecting') {
          logger.info('🟢 [WhatsApp] Estableciendo conexión...');
        }

        if (connection === 'open') {
          logger.info('✅ [WhatsApp] ¡Conexión establecida exitosamente! Bot listo.');
          this.isReconnecting = false;
          
          // Registrar el callback del scheduler para que use este socket activo
          cronScheduler.init(async (jid, text) => {
            if (this.sock) {
              await this.sock.sendMessage(jid, { text });
            }
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          logger.warn(`❌ [WhatsApp] Conexión cerrada. Código de error: ${statusCode}. Razón: ${lastDisconnect?.error}`);

          if (statusCode === DisconnectReason.loggedOut) {
            logger.error('❌ [WhatsApp] Sesión desvinculada (Logged Out). Se requiere escanear un nuevo QR.');
            this.clearAuthSession();
          }

          if (shouldReconnect) {
            const delayTime = 5000;
            logger.info(`🔄 [WhatsApp] Reconectando en ${delayTime / 1000} segundos...`);
            this.isReconnecting = true;
            setTimeout(() => {
              this.isReconnecting = false;
              this.connect();
            }, delayTime);
          } else {
            logger.info('🔄 [WhatsApp] Reiniciando bot para generar nuevo QR...');
            this.isReconnecting = false;
            this.connect();
          }
        }
      });

      // Escuchar mensajes entrantes
      this.sock.ev.on('messages.upsert', async (chatUpdate) => {
        // Solo procesar mensajes nuevos en tiempo real (notify)
        if (chatUpdate.type === 'notify') {
          for (const message of chatUpdate.messages) {
            await handleIncomingMessage(this.sock!, message);
          }
        }
      });

    } catch (error) {
      logger.error('❌ [WhatsApp] Error crítico durante la inicialización de la conexión:', error);
      // Reintentar conexión después de un error crítico
      setTimeout(() => this.connect(), 10000);
    }
  }

  /**
   * Retorna el socket de conexión activo
   */
  public getSocket(): WASocket | null {
    return this.sock;
  }
}

export const whatsAppClient = new WhatsAppClient();
