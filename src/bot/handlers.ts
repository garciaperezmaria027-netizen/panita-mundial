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
    if (key.fromMe) return;

    const chatJid = key.remoteJid;
    if (!chatJid) return;

    // Obtener JID del emisor
    // En grupos, el sender está en key.participant. En chat privado, está en key.remoteJid.
    const senderJid = key.participant || chatJid;
    
    // Obtener el texto del mensaje de diferentes tipos posibles de mensaje en Baileys
    const text = extractMessageText(m.message);
    if (!text) return;

    // Obtener nuestro propio JID
    const myJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
    const myPhone = myJid.split('@')[0];

    // 1. Verificar si es un comando administrativo (los comandos admin siempre empiezan con '/')
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
      
      // Ignorar si el grupo no está autorizado
      if (!allowedGroups.includes(chatJid)) {
        return;
      }

      // Verificar si el bot fue mencionado
      const isMentioned = checkIfMentioned(m.message, myPhone, text);
      if (!isMentioned) {
        return; // Ignorar mensajes normales para evitar spam
      }

      // Limpiar las menciones del texto para enviarlo a Gemini
      const cleanText = cleanMentions(text, myPhone);
      if (!cleanText) {
        await sendMessage(sock, chatJid, '⚽ *¡Habla, parce!* ¿En qué te puedo colaborar hoy con lo del Mundial? Pregúntame lo que quieras, panita: partidos, tablas, jugadores o lo que se te ocurra. ¡Qué chimba hablar contigo! 🔥', m);
        return;
      }

      // Indicar que el bot está "escribiendo..." para mejorar la experiencia
      await sock.sendPresenceUpdate('composing', chatJid);
      
      // Consultar a Gemini
      const reply = await geminiService.getResponse(chatJid, cleanText);
      await sendMessage(sock, chatJid, reply, m);
    } 
    
    // 3. Manejo en Chats Privados
    else if (isPrivate) {
      const allowedChats = configManager.getPrivateChats();
      const adminPhone = configManager.getAdminPhone();
      const senderPhone = senderJid.split('@')[0].split(':')[0];
      const isAdmin = senderPhone === adminPhone;

      // Responder solo a chats autorizados o al administrador
      if (allowedChats.includes(chatJid) || isAdmin) {
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
  
  // Si es un mensaje de tipo botón o lista (Baileys)
  if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId;
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) return message.listResponseMessage.singleSelectReply.selectedRowId;
  if (message.templateButtonReplyMessage?.selectedId) return message.templateButtonReplyMessage.selectedId;

  return '';
}

/**
 * Verifica si el bot fue mencionado de forma explícita
 */
function checkIfMentioned(message: proto.IMessage, myPhone: string, text: string): boolean {
  // 1. Mención formal en contextInfo de WhatsApp
  const mentionedJids = message.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const myJidFormat = `${myPhone}@s.whatsapp.net`;
  
  if (mentionedJids.includes(myJidFormat)) {
    return true;
  }

  // 2. Mención por texto plano (ej: @MundialBot, @panitamundial, @panita, @bot o mención de su número)
  const plainTextLower = text.toLowerCase();
  if (plainTextLower.includes('@mundialbot') || plainTextLower.includes('@panitamundial') || plainTextLower.includes('@panita') || plainTextLower.includes('@bot')) {
    return true;
  }

  if (plainTextLower.includes(`@${myPhone}`)) {
    return true;
  }

  return false;
}

/**
 * Remueve menciones del bot del texto
 */
function cleanMentions(text: string, myPhone: string): string {
  let clean = text;
  
  // Remover la mención del número @57300...
  const numberRegex = new RegExp(`@${myPhone}\\b`, 'gi');
  clean = clean.replace(numberRegex, '');
  
  // Remover otras menciones habituales
  clean = clean.replace(/@mundialbot/gi, '');
  clean = clean.replace(/@panitamundial/gi, '');
  clean = clean.replace(/@panita/gi, '');
  clean = clean.replace(/@bot/gi, '');
  
  // Limpiar cualquier otra mención general para evitar ruido
  clean = clean.replace(/@\d+\b/g, '');
  
  return clean.trim();
}

/**
 * Envía un mensaje respondiendo al original si es posible
 */
async function sendMessage(sock: WASocket, jid: string, text: string, originalMessage: proto.IWebMessageInfo) {
  try {
    await sock.sendMessage(jid, { 
      text: text 
    }, { 
      quoted: originalMessage 
    });
  } catch (error) {
    logger.error(`Error al enviar respuesta a ${jid}:`, error);
  }
}
