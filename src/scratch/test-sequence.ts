import * as dotenv from 'dotenv';
import { geminiService } from '../ai/gemini';
import { logger } from '../utils/logger';

dotenv.config();

async function runSequence() {
  logger.info('🧪 [Test Sequence] Iniciando simulación de secuencia de mensajes...');

  const testJid = `test-seq-${Date.now()}@s.whatsapp.net`;
  
  const messages = [
    'Hola',
    'Que partidos hay hoy',
    'No me reepondiste'
  ];

  for (const msg of messages) {
    logger.info(`\n💬 Usuario: "${msg}"`);
    try {
      const start = Date.now();
      const reply = await geminiService.getResponse(testJid, msg);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      logger.info(`⏱️ Tiempo de respuesta: ${elapsed}s`);
      logger.info(`🤖 Bot: ${reply.substring(0, 100)}...`);
    } catch (error: any) {
      logger.error(`❌ Error en "${msg}":`, error.message || error);
    }
  }
}

runSequence();
