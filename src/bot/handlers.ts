import { WASocket, proto } from '@whiskeysockets/baileys';
import { configManager } from '../config/manager';
import { handleAdminCommand } from '../commands/admin';
import { geminiService } from '../ai/gemini';
import { logger } from '../utils/logger';

/**
 * Procesa un mensaje entrante de WhatsApp
 */
export async function handleIncomingMessage(sock: WASocket, m: proto.IWebMessageInfo) {
  try {
    // Evitar procesar mensajes propios o del sistema
    if (!m.message) return;
    const key = m.key;
    if (!key) return;
    if (key.fromMe) return;

    const chatJid = key.remoteJid;
    if (!chatJid) return;

    // En grupos, el sender está en key.participant. En chat privado, está en key.remoteJid.
    const senderJid = key.participant || chatJid;

    // Obtener el texto del mensaje
    const text = extractMessageText(m.message);
    if (!text) return;

    // --- Identidad del bot ---
    // sock.user.id puede venir como "573019998880:5@s.whatsapp.net"
    const rawUserId = sock.user?.id ?? '';
    const myPhone = rawUserId.split('@')[0].split(':')[0]; // ej: "573019998880"

    // WhatsApp usa LIDs (Linked IDs) en grupos modernos.
    // sock.user.lid puede venir como "18671011389604:5@lid"
    const rawLid = (sock.user as any)?.lid ?? '';
    const myLid = rawLid.split('@')[0].split(':')[0]; // ej: "18671011389604"

    logger.debug(`[DEBUG] myPhone=${myPhone} myLid=${myLid}`);
    logger.debug(`[DEBUG] chatJid=${chatJid} senderJid=${senderJid}`);
    logger.debug(`[DEBUG] texto recibido: "${text}"`);

    // 1. Comandos administrativos
    if (text.startsWith('/')) {
      const adminResponse = await handleAdminCommand(senderJid, chatJid, text);
      if (adminResponse) {
        await sendMessage(sock, chatJid, adminResponse, m);
      }
      return;
    }

    const isGroup = chatJid.endsWith('@g.us');
    const isPrivate = chatJid.endsWith('@s.whatsapp.net') || chatJid.endsWith('@lid');

    // 2. Manejo en Grupos
    if (isGroup) {
      const allowedGroups = configManager.getGroups();
      const isRegisteredGroup = allowedGroups.includes(chatJid);

      // Mención nativa: WhatsApp pone el JID/LID del bot en mentionedJid
      // Funciona en CUALQUIER grupo, sin importar el nombre de contacto guardado
      const isNativeMention = checkIfNativeMention(m.message, myPhone, myLid);

      // Mención por texto: cualquier @algo (solo en grupos registrados como fallback)
      const isTextMention = isRegisteredGroup && checkIfTextMention(text);

      logger.debug(`[DEBUG] isGroup=true isRegisteredGroup=${isRegisteredGroup} isNativeMention=${isNativeMention} isTextMention=${isTextMention}`);

      if (!isNativeMention && !isTextMention) {
        return; // Ignorar mensajes sin mención
      }

      // Limpiar las menciones del texto antes de enviar a la IA
      const cleanText = cleanMentions(text, myPhone, myLid);
      if (!cleanText) {
        await sendMessage(sock, chatJid, '⚽ *¡Habla, parce!* ¿En qué te puedo colaborar hoy con lo del Mundial? Pregúntame lo que quieras, panita: partidos, tablas, jugadores o lo que se te ocurra. ¡Qué chimba hablar contigo! 🔥', m);
        return;
      }

      await sock.sendPresenceUpdate('composing', chatJid);
      const reply = await geminiService.getResponse(chatJid, cleanText);
      await sendMessage(sock, chatJid, reply, m);
    }

    // 3. Manejo en Chats Privados
    else if (isPrivate) {
      const allowedChats = configManager.getPrivateChats();
      const adminPhone = configManager.getAdminPhone();
      const senderPhone = senderJid.split('@')[0].split(':')[0];
      const isAdmin = senderPhone === adminPhone;

      // Comparar por número (sin sufijo @lid / @s.whatsapp.net / @s.whatsapp.net)
      // para manejar el caso en que el chat se guardó con un sufijo diferente al que llega
      const chatPhone = chatJid.split('@')[0].split(':')[0];
      const isAllowed = allowedChats.some(c => c.split('@')[0].split(':')[0] === chatPhone);

      if (isAllowed || isAdmin) {
        await sock.sendPresenceUpdate('composing', chatJid);
        const reply = await geminiService.getResponse(chatJid, text);
        await sendMessage(sock, chatJid, reply, m);
      } else {
        logger.debug(`Ignorando mensaje en chat privado no autorizado de: ${chatJid}`);
      }
    }
  } catch (error) {
    logger.error('Error al procesar mensaje entrante:', error);
  }
}

/**
 * Extrae el texto del cuerpo del mensaje de Baileys
 */
function extractMessageText(message: proto.IMessage): string {
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId;
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) return message.listResponseMessage.singleSelectReply.selectedRowId;
  if (message.templateButtonReplyMessage?.selectedId) return message.templateButtonReplyMessage.selectedId;
  return '';
}

/**
 * Verifica si el bot fue mencionado de forma nativa por WhatsApp.
 * Soporta tanto JIDs de teléfono (@s.whatsapp.net) como LIDs (@lid),
 * que es el formato moderno que WhatsApp usa en grupos.
 * No depende del nombre de contacto guardado.
 */
function checkIfNativeMention(message: proto.IMessage, myPhone: string, myLid: string): boolean {
  const mentionedJids: string[] =
    message.extendedTextMessage?.contextInfo?.mentionedJid ||
    message.imageMessage?.contextInfo?.mentionedJid ||
    message.videoMessage?.contextInfo?.mentionedJid ||
    [];

  logger.debug(`[DEBUG] mentionedJids=${JSON.stringify(mentionedJids)} myPhone=${myPhone} myLid=${myLid}`);

  if (mentionedJids.length === 0) return false;

  return mentionedJids.some((jid: string) => {
    // Extraer la parte numérica limpia (sin sufijo :XX ni dominio @...)
    const cleanId = jid.split('@')[0].split(':')[0];
    // Comparar contra teléfono Y contra LID
    return cleanId === myPhone || (myLid && cleanId === myLid);
  });
}

/**
 * Verifica si hay alguna mención de texto (@algo) en el mensaje.
 * Fallback para grupos registrados.
 */
function checkIfTextMention(text: string): boolean {
  return /@\S+/.test(text);
}

/**
 * Remueve todas las menciones del texto antes de enviarlo a la IA
 */
function cleanMentions(text: string, myPhone: string, myLid: string): string {
  let clean = text;
  // Remover mención por número de teléfono
  if (myPhone) clean = clean.replace(new RegExp(`@${myPhone}\\S*`, 'gi'), '');
  // Remover mención por LID
  if (myLid) clean = clean.replace(new RegExp(`@${myLid}\\S*`, 'gi'), '');
  // Remover cualquier otra @mención restante
  clean = clean.replace(/@\S+/g, '');
  return clean.trim();
}

/**
 * Envía un mensaje respondiendo al original
 */
async function sendMessage(sock: WASocket, jid: string, text: string, originalMessage: proto.IWebMessageInfo) {
  try {
    await sock.sendMessage(jid, { text }, { quoted: originalMessage as any });
  } catch (error) {
    logger.error(`Error al enviar respuesta a ${jid}:`, error);
  }
}
