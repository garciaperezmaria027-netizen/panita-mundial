import { configManager } from '../config/manager';
import { cronScheduler } from '../scheduler/cron';
import { cacheManager } from '../services/cache';
import { logger } from '../utils/logger';

/**
 * Procesa comandos administrativos y retorna la respuesta de texto (o null si no era comando)
 * @param senderJid JID de la persona que envió el mensaje
 * @param chatJid JID del chat donde se envió (puede ser grupo @g.us o privado @s.whatsapp.net)
 * @param messageText Contenido del mensaje
 */
export async function handleAdminCommand(
  senderJid: string,
  chatJid: string,
  messageText: string
): Promise<string | null> {
  const text = messageText.trim();
  
  // Si no empieza con /, no es un comando
  if (!text.startsWith('/')) {
    return null;
  }

  // Extraer el teléfono del emisor para validar si es el administrador
  // JID de Baileys: "573001234567@s.whatsapp.net" o "573001234567:2@s.whatsapp.net"
  const senderPhone = senderJid.split('@')[0].split(':')[0];
  const adminPhone = configManager.getAdminPhone();

  if (senderPhone !== adminPhone) {
    logger.warn(`Intento de comando no autorizado de JID: ${senderJid} (${senderPhone}) - Comando: ${text}`);
    return '⚠️ *Panita Mundial:* No tienes permisos de administrador para ejecutar este comando, parce.';
  }

  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  const isGroup = chatJid.endsWith('@g.us');

  switch (command) {
    case '/agregargrupo': {
      if (!isGroup) {
        return '❌ Este comando solo se puede usar dentro de un grupo.';
      }
      const added = configManager.addGroup(chatJid);
      return added 
        ? '✅ *Panita Mundial:* ¡Grupo agregado con éxito! Este grupo ahora recibirá el resumen diario de partidos y soporte del Asistente IA, panita.'
        : 'ℹ️ *Panita Mundial:* Este grupo ya se encuentra registrado.';
    }

    case '/eliminargrupo': {
      if (!isGroup) {
        return '❌ Este comando solo se puede usar dentro de un grupo.';
      }
      const removed = configManager.removeGroup(chatJid);
      return removed 
        ? '✅ *Panita Mundial:* Grupo eliminado. Se han desactivado las notificaciones y el soporte IA para este grupo.'
        : 'ℹ️ *Panita Mundial:* Este grupo no estaba registrado.';
    }

    case '/agregarchat': {
      let targetJid = chatJid;
      
      // Si se provee un teléfono como argumento
      if (args.length > 0) {
        const phone = args[0].replace(/[^0-9]/g, '');
        if (phone.length < 8) {
          return '❌ Teléfono inválido. Formato: `/agregarchat [número_con_código_país]`';
        }
        targetJid = `${phone}@s.whatsapp.net`;
      } else if (isGroup) {
        return '❌ Si estás en un grupo, debes especificar el teléfono: `/agregarchat 573001234567`';
      }

      const added = configManager.addPrivateChat(targetJid);
      return added 
        ? `✅ *Panita Mundial:* Chat privado \`${targetJid.split('@')[0]}\` agregado con éxito.`
        : 'ℹ️ *Panita Mundial:* Este chat privado ya se encuentra registrado.';
    }

    case '/eliminarchat': {
      let targetJid = chatJid;

      if (args.length > 0) {
        const phone = args[0].replace(/[^0-9]/g, '');
        targetJid = `${phone}@s.whatsapp.net`;
      } else if (isGroup) {
        return '❌ Si estás en un grupo, debes especificar el teléfono: `/eliminarchat 573001234567`';
      }

      const removed = configManager.removePrivateChat(targetJid);
      return removed 
        ? `✅ *Panita Mundial:* Chat privado \`${targetJid.split('@')[0]}\` eliminado.`
        : 'ℹ️ *Panita Mundial:* Este chat privado no estaba registrado.';
    }

    case '/listargrupos': {
      const groups = configManager.getGroups();
      if (groups.length === 0) {
        return '📊 *Panita Mundial:* No hay ningún grupo registrado.';
      }
      let response = '📊 *GRUPOS REGISTRADOS:*\n\n';
      groups.forEach((g, idx) => {
        response += `${idx + 1}. JID: \`${g}\`\n`;
      });
      return response;
    }

    case '/listarchats': {
      const chats = configManager.getPrivateChats();
      if (chats.length === 0) {
        return '📊 *Panita Mundial:* No hay ningún chat privado registrado.';
      }
      let response = '📊 *CHATS PRIVADOS REGISTRADOS:*\n\n';
      chats.forEach((c, idx) => {
        response += `${idx + 1}. Teléfono: \`${c.split('@')[0]}\`\n`;
      });
      return response;
    }

    case '/cambiarhora': {
      if (args.length === 0) {
        return '❌ Debes especificar la hora. Ejemplo: `/cambiarhora 08:30`';
      }
      const newHour = args[0];
      const updated = configManager.setDailyMessageHour(newHour);
      
      if (!updated) {
        return '❌ Hora inválida. Debe estar en formato HH:MM (24 horas), de 00:00 a 23:59.';
      }

      // Reiniciar programador cron
      cronScheduler.startSchedule();
      return `✅ *Panita Mundial:* Hora del resumen diario actualizada a las *${newHour}* (Hora Colombia). El programador ha sido reiniciado.`;
    }

    case '/resumen': {
      // Forzar envío manual e inmediato del resumen diario
      logger.info(`[Admin Command] Envío manual del resumen diario gatillado por administrador.`);
      // No bloqueamos la respuesta, lo ejecutamos en background para que no cause timeout en Baileys
      cronScheduler.sendDailySummary().then(() => {
        logger.info('[Admin Command] Resumen manual enviado con éxito.');
      }).catch(err => {
        logger.error('[Admin Command] Error en resumen manual:', err);
      });
      return '⏳ *Panita Mundial:* Despachando resumen diario a todos los destinatarios registrados en segundo plano...';
    }

    case '/limpiarcache': {
      cacheManager.clear();
      return '🧹 *Panita Mundial:* Toda la caché de datos deportivos ha sido eliminada con éxito, parce. Las siguientes consultas obtendrán datos frescos de la API.';
    }

    case '/estado': {
      const memory = process.memoryUsage();
      const memUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
      const uptimeSec = Math.round(process.uptime());
      const uptimeStr = formatUptime(uptimeSec);
      
      let statusText = `🤖 *ESTADO DEL PANITA MUNDIAL* ⚽\n\n`;
      statusText += `🟢 *Sistema:* Activo\n`;
      statusText += `⏱️ *Uptime:* ${uptimeStr}\n`;
      statusText += `🧠 *Memoria Usada:* ${memUsedMb} MB\n`;
      statusText += `📅 *Zona Horaria:* ${configManager.getTimezone()}\n`;
      statusText += `⏰ *Hora Resumen:* ${configManager.getDailyMessageHour()}\n\n`;
      
      statusText += `👥 *Suscripciones:*\n`;
      statusText += `  • Chats Privados: *${configManager.getPrivateChats().length}*\n`;
      statusText += `  • Grupos: *${configManager.getGroups().length}*\n\n`;
      
      statusText += `🔧 *Configuración de API:*\n`;
      const provider = process.env.SPORTS_PROVIDER || 'api-football';
      statusText += `  • Proveedor Deportivo: *${provider}*\n`;
      if (provider !== 'free-2026') {
        statusText += `  • API-Football League ID: *${configManager.getApiFootballLeague()}*\n`;
        statusText += `  • API-Football Season: *${configManager.getApiFootballSeason()}*\n\n`;
      } else {
        statusText += '\n';
      }
      
      statusText += `💡 _Tip: Envía \`/resumen\` para forzar el resumen del día o \`/limpiarcache\` para actualizar datos._`;
      
      return statusText;
    }

    default:
      return `❓ *Panita Mundial:* Comando admin desconocido: \`${command}\`. Envía uno válido o revisa la ortografía, parce.`;
  }
}

/**
 * Formatea segundos en formato de días, horas y minutos legibles
 */
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  
  return parts.join(' ');
}
