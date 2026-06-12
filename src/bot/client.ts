import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
  Browsers
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
      let { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

      // Si la sesión local no está registrada (es nueva o falló la anterior), limpiamos para evitar corrupción
      if (!state.creds.registered) {
        logger.info('🧹 [WhatsApp] Sesión no registrada. Limpiando archivos locales para evitar conflictos de vinculación...');
        this.clearAuthSession();
        // Recargar el estado de autenticación totalmente limpio
        const freshAuth = await useMultiFileAuthState(AUTH_DIR);
        state = freshAuth.state;
        saveCreds = freshAuth.saveCreds;
      }

      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`📋 [WhatsApp] Usando versión de Baileys: v${version.join('.')}, última disponible: ${isLatest}`);

      // Determinar si usar pairing code o QR
      const pairingPhone = process.env.PAIRING_PHONE_NUMBER?.replace(/[^0-9]/g, '');
      const usePairing = !!pairingPhone && !state.creds.registered;

      // Crear socket de conexión
      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: !usePairing, // Solo imprime QR si no usamos pairing code
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        browser: Browsers.macOS('Chrome')
      });

      // Guardar credenciales automáticamente ante cambios
      this.sock.ev.on('creds.update', saveCreds);

      // Si se usa pairing code, solicitarlo cuando el socket esté listo
      if (usePairing) {
        logger.info(`📱 [WhatsApp] Modo Pairing Code activado para el número: +${pairingPhone}`);
        // Esperar un momento para que el socket se estabilice antes de pedir el código
        setTimeout(async () => {
          try {
            if (this.sock && !state.creds.registered) {
              const code = await this.sock.requestPairingCode(pairingPhone!);
              const formattedCode = code.match(/.{1,4}/g)?.join('-') ?? code;
              logger.info('');
              logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              logger.info('🔑  CÓDIGO DE VINCULACIÓN WHATSAPP');
              logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              logger.info(`➡️   CÓDIGO: ${formattedCode}`);
              logger.info('');
              logger.info('📲 Pasos para vincular:');
              logger.info('   1. Abre WhatsApp Business en tu teléfono');
              logger.info('   2. Ve a ⋮ Menú → Dispositivos vinculados');
              logger.info('   3. Toca "Vincular con número de teléfono"');
              logger.info(`   4. Ingresa el código: ${formattedCode}`);
              logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              logger.info('');
            }
          } catch (err) {
            logger.error('❌ [WhatsApp] Error al solicitar pairing code:', err);
            logger.info('🔄 [WhatsApp] Intentando con QR como fallback...');
          }
        }, 3000);
      }

      // Escuchar cambios en la conexión (QR, Conectado, Desconectado)
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Mostrar QR solo si no estamos en modo pairing code
        if (qr && !usePairing) {
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
            logger.error('❌ [WhatsApp] Sesión desvinculada (Logged Out). Se requiere nueva vinculación.');
            this.clearAuthSession();
          }

          const isImmediate = statusCode === DisconnectReason.restartRequired || 
                              statusCode === DisconnectReason.connectionClosed ||
                              statusCode === 515 || statusCode === 428;

          if (isImmediate) {
            logger.info('🔄 [WhatsApp] Reinicio o cierre normal de conexión detectado. Reconectando de inmediato...');
            this.isReconnecting = false;
            this.connect();
          } else if (shouldReconnect) {
            const delayTime = 5000;
            logger.info(`🔄 [WhatsApp] Reconectando en ${delayTime / 1000} segundos...`);
            this.isReconnecting = true;
            setTimeout(() => {
              this.isReconnecting = false;
              this.connect();
            }, delayTime);
          } else {
            logger.info('🔄 [WhatsApp] Reiniciando bot para generar nueva vinculación...');
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
