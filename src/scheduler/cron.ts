import * as cron from 'node-cron';
import { configManager } from '../config/manager';
import { sportsService } from '../services/sports';
import * as formatter from '../utils/formatter';
import { logger } from '../utils/logger';

type SendMessageCallback = (jid: string, text: string) => Promise<any>;

class CronScheduler {
  private activeTask: cron.ScheduledTask | null = null;
  private sendMessageCallback: SendMessageCallback | null = null;

  constructor() {
    // El scheduler se iniciará formalmente cuando se registre el callback de WhatsApp
  }

  /**
   * Registra la función para enviar mensajes a WhatsApp e inicia el scheduler
   */
  public init(sendCallback: SendMessageCallback) {
    this.sendMessageCallback = sendCallback;
    this.startSchedule();
  }

  /**
   * Inicia o reinicia la tarea programada basada en la configuración actual
   */
  public startSchedule() {
    if (this.activeTask) {
      this.activeTask.stop();
      this.activeTask = null;
    }

    const hourStr = configManager.getDailyMessageHour();
    const timezone = configManager.getTimezone();

    // Parsear HH:MM a formato Cron (m h * * *)
    const parts = hourStr.split(':');
    if (parts.length !== 2) {
      logger.error(`Formato de hora inválido en configuración: ${hourStr}. Debe ser HH:MM.`);
      return;
    }

    const [hour, minute] = parts;
    const cronExpression = `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;

    try {
      this.activeTask = cron.schedule(cronExpression, async () => {
        logger.info('⏰ [Scheduler] Iniciando tarea programada: Enviar resumen diario...');
        await this.sendDailySummary();
      }, {
        scheduled: true,
        timezone: timezone // 'America/Bogota'
      });

      logger.info(`⏰ [Scheduler] Tarea programada registrada exitosamente: "${cronExpression}" en la zona horaria ${timezone}`);
    } catch (error) {
      logger.error('⏰ [Scheduler] Error al registrar la tarea programada:', error);
    }
  }

  /**
   * Ejecuta el envío inmediato del resumen diario (para testing o cron)
   */
  public async sendDailySummary(): Promise<void> {
    if (!this.sendMessageCallback) {
      logger.error('⏰ [Scheduler] No se puede enviar el resumen diario: Callback de mensajería no registrado.');
      return;
    }

    try {
      const matches = await sportsService.getMatchesToday();
      const messageText = formatter.formatDailySummary(matches);
      
      const privateChats = configManager.getPrivateChats();
      const groups = configManager.getGroups();
      
      const recipients = [...privateChats, ...groups];
      
      if (recipients.length === 0) {
        logger.warn('⏰ [Scheduler] No hay chats privados ni grupos autorizados para recibir el resumen diario.');
        return;
      }

      logger.info(`⏰ [Scheduler] Despachando resumen a ${recipients.length} destinatarios...`);

      for (const jid of recipients) {
        try {
          logger.info(`⏰ [Scheduler] Enviando resumen diario a: ${jid}`);
          await this.sendMessageCallback(jid, messageText);
          
          // Espera de 2 segundos entre envíos para prevenir spam y baneo del número
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (sendError) {
          logger.error(`⏰ [Scheduler] Error al enviar mensaje a ${jid}:`, sendError);
        }
      }

      logger.info('⏰ [Scheduler] Despacho de resumen diario finalizado.');
    } catch (error) {
      logger.error('⏰ [Scheduler] Error crítico durante el envío del resumen diario:', error);
    }
  }

  /**
   * Detiene el scheduler
   */
  public stop() {
    if (this.activeTask) {
      this.activeTask.stop();
      logger.info('⏰ [Scheduler] Scheduler detenido.');
    }
  }
}

export const cronScheduler = new CronScheduler();
export { SendMessageCallback };
